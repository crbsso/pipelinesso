"""Publicador isolado das Inspecoes da Manutencao - Portal SSO."""

import argparse
import hashlib
import json
import os
import subprocess
import sys
import uuid
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

HML_REF = "ckfsarzmudwdehiiltwi"
HASH_VALIDADO = "4DC1AC209991D6482E5CA8E783DB06CC14C5FBB256383BDC823A4BB0CDEE8F9D"
INICIO = "2026-10-01"
FIM = "2026-11-01"
QUANTIDADE_VALIDADA = 740

FAMILIAS = {
    "Inspeção de EPIs",
    "Inspeção de Ferramentas e Equipamentos Rotativos",
    "Inspeção de Movimentação de Carga e Acessórios",
    "Inspeção de Segurança em Instalações",
    "Inspeção em Extintores de Incêndio",
    "Inspeção em Veículos",
}

CAMPOS = {
    "id_inspecao",
    "ficha_id",
    "aba_id",
    "ativo_id",
    "data_inspecao",
    "concessao",
    "localizacao",
    "familia",
    "tipo",
    "periodicidade",
}


def exigir(condicao, mensagem):
    if not condicao:
        raise ValueError(mensagem)


def validar_arquivo(caminho, fuso_confirmado=None):
    bruto = caminho.read_bytes()
    hash_real = hashlib.sha256(bruto).hexdigest().upper()

    exigir(
        hash_real == HASH_VALIDADO,
        "SHA256 diferente do arquivo aprovado.",
    )

    dados = json.loads(bruto.decode("utf-8-sig"))
    exigir(isinstance(dados, dict), "Raiz JSON invalida.")

    exigir(
        dados.get("inicio_inclusivo") == INICIO,
        "Inicio da janela divergente.",
    )
    exigir(
        dados.get("fim_exclusivo") == FIM,
        "Fim da janela divergente.",
    )
    exigir(
        fuso_confirmado in (None, "America/Sao_Paulo"),
        "Confirmacao de fuso nao suportada.",
    )
    fuso_documento = dados.get("fuso_origem")
    exigir(
        fuso_documento == "America/Sao_Paulo"
        or (
            fuso_documento == "nao_verificado"
            and fuso_confirmado == "America/Sao_Paulo"
        ),
        "Fuso de origem nao confirmado ou divergente. "
        "Confirme o fuso da fonte antes de usar --confirmar-fuso-origem.",
    )
    exigir(
        isinstance(dados.get("origem"), str)
        and bool(dados["origem"].strip()),
        "Origem ausente.",
    )

    registros = dados.get("registros")
    exigir(isinstance(registros, list), "Registros invalidos.")
    exigir(
        len(registros) == QUANTIDADE_VALIDADA,
        "Quantidade de registros divergente.",
    )

    chaves = set()
    familias_encontradas = set()
    preparados = []

    for registro in registros:
        exigir(isinstance(registro, dict), "Registro invalido.")
        exigir(
            set(registro) == CAMPOS,
            "Campos inesperados ou ausentes no JSON.",
        )

        for campo in ("id_inspecao", "ficha_id", "aba_id"):
            exigir(
                type(registro[campo]) is int and registro[campo] > 0,
                "Identificador obrigatorio invalido.",
            )

        ativo = registro["ativo_id"]
        exigir(
            ativo is None or type(ativo) is int,
            "Tipo invalido de ativo_id.",
        )

        for campo in ("familia", "tipo"):
            exigir(
                isinstance(registro[campo], str)
                and bool(registro[campo].strip()),
                "Texto obrigatorio invalido.",
            )

        for campo in ("concessao", "localizacao", "periodicidade"):
            valor = registro[campo]
            exigir(
                valor is None or isinstance(valor, str),
                "Campo textual opcional invalido.",
            )

        familia = registro["familia"]
        exigir(
            familia in FAMILIAS,
            "Familia fora do escopo aprovado.",
        )
        familias_encontradas.add(familia)

        data_texto = registro["data_inspecao"]
        exigir(
            isinstance(data_texto, str),
            "Data de inspecao invalida.",
        )

        data = datetime.fromisoformat(data_texto)
        exigir(
            data.tzinfo is None,
            "Data SQL Server deveria ser sem fuso embutido.",
        )
        exigir(
            INICIO <= data.date().isoformat() < FIM,
            "Registro fora de outubro de 2026.",
        )

        chave = (
            registro["id_inspecao"],
            registro["ficha_id"],
            registro["aba_id"],
        )
        exigir(chave not in chaves, "Chave de inspecao duplicada.")
        chaves.add(chave)

        preparados.append({
            **registro,
            "origem": "SQL Server Intranet",
        })

    exigir(
        familias_encontradas == FAMILIAS,
        "Conjunto de familias diferente do aprovado.",
    )

    validador = (
        Path(__file__).resolve().parent
        / "validar_inspecoes_intranet.py"
    )

    exigir(validador.is_file(), "Quality Gate nao encontrado.")

    resultado = subprocess.run(
        [
            sys.executable,
            "-B",
            str(validador),
            "--arquivo",
            str(caminho),
            "--conferir-outubro-2026",
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    exigir(
        resultado.returncode == 0
        and "VALIDACAO: APROVADA" in resultado.stdout,
        "Quality Gate existente reprovado.",
    )

    return preparados, hash_real


def contar(cliente, tabela, inicio=None, fim=None):
    consulta = cliente.table(tabela).select(
        "id_inspecao",
        count="exact",
        head=True,
    )

    if inicio is not None:
        consulta = consulta.gte("data_inspecao", inicio)
    if fim is not None:
        consulta = consulta.lt("data_inspecao", fim)

    resposta = consulta.execute()

    exigir(
        isinstance(resposta.count, int),
        "Contagem remota nao disponivel.",
    )
    return resposta.count


def publicar_hml(registros, confirmacao):
    exigir(
        confirmacao == HML_REF,
        "Identificador HML nao confirmado.",
    )

    url = os.environ.get("SUPABASE_URL", "").strip()
    segredo = os.environ.get("SUPABASE_SECRET_KEY", "").strip()

    exigir(bool(segredo), "Credencial Supabase ausente.")
    exigir(
        urlparse(url).scheme == "https"
        and urlparse(url).hostname == f"{HML_REF}.supabase.co",
        "URL nao corresponde ao Supabase HML autorizado.",
    )

    from supabase import create_client

    cliente = create_client(url, segredo)

    exigir(
        contar(cliente, "stg_inspecoes_manutencao") == 0,
        "Staging nao esta vazia. Conciliacao necessaria.",
    )
    exigir(
        contar(
            cliente,
            "mart_inspecoes_manutencao",
            INICIO,
            FIM,
        ) == 0,
        "Ja existem registros no mes. Publicacao bloqueada.",
    )

    carga_id = str(uuid.uuid4())

    print("AMBIENTE: HML")
    print("PROJETO:", HML_REF)
    print("CARGA_ID:", carga_id)

    for inicio in range(0, len(registros), 100):
        lote = [
            {"carga_id": carga_id, **registro}
            for registro in registros[inicio:inicio + 100]
        ]

        cliente.table("stg_inspecoes_manutencao").insert(
            lote
        ).execute()

    consulta = (
        cliente.table("stg_inspecoes_manutencao")
        .select("id_inspecao", count="exact", head=True)
        .eq("carga_id", carga_id)
    )
    resposta = consulta.execute()

    exigir(
        resposta.count == len(registros),
        "Staging incompleta. Promocao nao executada.",
    )

    print("STAGING: VALIDADA")
    print("PROMOCAO: INICIANDO")

    promovido = cliente.rpc(
        "promover_inspecoes_manutencao",
        {
            "p_carga_id": carga_id,
            "p_quantidade_esperada": len(registros),
            "p_inicio": INICIO,
            "p_fim": FIM,
        },
    ).execute()

    exigir(
        type(promovido.data) is int
        and promovido.data == len(registros),
        "Resultado da RPC divergente. Reconciliar sem repetir.",
    )

    quantidade_final = contar(
        cliente,
        "mart_inspecoes_manutencao",
        INICIO,
        FIM,
    )

    exigir(
        quantidade_final == len(registros),
        "Contagem final divergente. Reconciliar sem repetir.",
    )

    print("PROMOCAO: APROVADA")
    print("MART_OUTUBRO:", quantidade_final)
    print("STAGING: PRESERVADA PARA RASTREABILIDADE")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--arquivo", required=True, type=Path)
    parser.add_argument("--publicar-hml", action="store_true")
    parser.add_argument("--confirmar-hml")
    parser.add_argument(
        "--confirmar-fuso-origem",
        choices=("America/Sao_Paulo",),
        help="Usar apenas apos confirmar o fuso dos horarios na fonte SQL.",
    )
    args = parser.parse_args()

    registros, hash_real = validar_arquivo(
        args.arquivo, args.confirmar_fuso_origem
    )

    print("QUALITY_GATE: APROVADO")
    print("FUSO_ORIGEM: America/Sao_Paulo (confirmado)")
    print("SHA256:", hash_real)
    print("PERIODO:", INICIO, "a", FIM, "(fim exclusivo)")
    print("REGISTROS:", len(registros))
    print("FAMILIAS:", len(FAMILIAS))

    if not args.publicar_hml:
        print("MODO: SOMENTE VALIDACAO LOCAL")
        print("SUPABASE: NAO ACESSADO")
        return

    publicar_hml(registros, args.confirmar_hml)


if __name__ == "__main__":
    try:
        main()
    except Exception as erro:
        print(
            "PUBLICADOR REPROVADO:",
            type(erro).__name__,
            str(erro),
            file=sys.stderr,
        )
        sys.exit(1)