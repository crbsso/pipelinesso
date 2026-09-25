import argparse
import os
import uuid
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client


PASTA_PROJETO = Path(__file__).resolve().parents[2]

ARQUIVO_OURO = (
    PASTA_PROJETO
    / "data"
    / "ouro"
    / "avcb"
    / "mart_avcb.xlsx"
)

NOME_ABA = "mart_avcb"

TABELA_MART = "mart_avcb"
TABELA_BUFFER = "stg_mart_avcb"
RPC_PROMOVER = "promover_mart_avcb"

TAMANHO_LOTE = 500

COLUNAS_ESPERADAS = [
    "projeto",
    "subestacao",
    "localidade",
    "estado",
    "responsavel",
    "empresa",
    "instalacao",
    "gestao_avcb",
    "responsabilidade_avcb",
    "situacao",
    "projeto_incendio",
    "alvara_bombeiros",
    "sdai",
    "brigada_incendio",
    "validade_avcb_uf_anos",
    "vigencia_alvara",
    "dias_para_vencer",
    "status_validade",
    "status_gestao",
    "data_atualizacao",
]

COLUNAS_TEXTO = [
    "projeto",
    "subestacao",
    "localidade",
    "estado",
    "responsavel",
    "empresa",
    "instalacao",
    "gestao_avcb",
    "responsabilidade_avcb",
    "situacao",
    "projeto_incendio",
    "alvara_bombeiros",
    "sdai",
    "brigada_incendio",
    "status_validade",
    "status_gestao",
]


def texto(valor):
    if valor is None:
        return ""

    try:
        if pd.isna(valor):
            return ""
    except TypeError:
        pass

    return str(valor).strip()


def data_iso(valor):
    return pd.to_datetime(
        valor,
        errors="raise",
    ).strftime("%Y-%m-%d")


def normalizar_registro(registro):
    return {
        "projeto": texto(registro["projeto"]),
        "subestacao": texto(registro["subestacao"]),
        "localidade": texto(registro["localidade"]),
        "estado": texto(registro["estado"]),
        "responsavel": texto(registro["responsavel"]),
        "empresa": texto(registro["empresa"]),
        "instalacao": texto(registro["instalacao"]),
        "gestao_avcb": texto(registro["gestao_avcb"]),
        "responsabilidade_avcb": texto(
            registro["responsabilidade_avcb"]
        ),
        "situacao": texto(registro["situacao"]),
        "projeto_incendio": texto(
            registro["projeto_incendio"]
        ),
        "alvara_bombeiros": texto(
            registro["alvara_bombeiros"]
        ),
        "sdai": texto(registro["sdai"]),
        "brigada_incendio": texto(
            registro["brigada_incendio"]
        ),
        "validade_avcb_uf_anos": int(
            registro["validade_avcb_uf_anos"]
        ),
        "vigencia_alvara": data_iso(
            registro["vigencia_alvara"]
        ),
        "dias_para_vencer": int(
            registro["dias_para_vencer"]
        ),
        "status_validade": texto(
            registro["status_validade"]
        ),
        "status_gestao": texto(
            registro["status_gestao"]
        ),
        "data_atualizacao": data_iso(
            registro["data_atualizacao"]
        ),
    }


def carregar_configuracao():
    arquivo_env = PASTA_PROJETO / ".env"

    if not arquivo_env.exists():
        raise FileNotFoundError(
            f".env nao encontrado: {arquivo_env}"
        )

    load_dotenv(
        dotenv_path=arquivo_env,
        override=True,
    )

    url = os.getenv("SUPABASE_URL")
    secret = os.getenv("SUPABASE_SECRET_KEY")

    if not url:
        raise RuntimeError(
            "SUPABASE_URL nao encontrada."
        )

    if not secret:
        raise RuntimeError(
            "SUPABASE_SECRET_KEY nao encontrada."
        )

    return url, secret


def carregar_ouro():
    if not ARQUIVO_OURO.exists():
        raise FileNotFoundError(
            f"Ouro AVCB nao encontrada: {ARQUIVO_OURO}"
        )

    df = pd.read_excel(
        ARQUIVO_OURO,
        sheet_name=NOME_ABA,
    )

    if df.empty:
        raise RuntimeError(
            "A Mart AVCB esta vazia."
        )

    recebidas = df.columns.tolist()

    if recebidas != COLUNAS_ESPERADAS:
        raise RuntimeError(
            "Contrato da Mart AVCB divergente.\n"
            f"Esperado: {COLUNAS_ESPERADAS}\n"
            f"Recebido: {recebidas}"
        )

    if df.isna().any().any():
        nulos = (
            df.isna()
            .sum()
        )

        nulos = nulos[
            nulos > 0
        ].to_dict()

        raise RuntimeError(
            f"Mart AVCB possui nulos: {nulos}"
        )

    for coluna in COLUNAS_TEXTO:
        valores = (
            df[coluna]
            .astype(str)
            .str.strip()
        )

        if valores.eq("").any():
            raise RuntimeError(
                f"Valor vazio em {coluna}."
            )

    for coluna in [
        "vigencia_alvara",
        "data_atualizacao",
    ]:
        datas = pd.to_datetime(
            df[coluna],
            errors="coerce",
        )

        if datas.isna().any():
            raise RuntimeError(
                f"Data invalida em {coluna}."
            )

    for coluna in [
        "validade_avcb_uf_anos",
        "dias_para_vencer",
    ]:
        numeros = pd.to_numeric(
            df[coluna],
            errors="coerce",
        )

        if (
            numeros.isna().any()
            or numeros.mod(1).ne(0).any()
        ):
            raise RuntimeError(
                f"Inteiro invalido em {coluna}."
            )

    if df.duplicated().any():
        raise RuntimeError(
            "Mart AVCB possui linhas duplicadas."
        )

    registros = [
        normalizar_registro(registro)
        for registro
        in df.to_dict(
            orient="records"
        )
    ]

    return registros


def contar(
    cliente,
    tabela,
    carga_id=None,
):
    coluna = (
        "linha_id"
        if tabela == TABELA_BUFFER
        else "projeto"
    )

    consulta = (
        cliente
        .table(tabela)
        .select(
            coluna,
            count="exact",
        )
    )

    if carga_id is not None:
        consulta = consulta.eq(
            "carga_id",
            carga_id,
        )

    resposta = (
        consulta
        .limit(1)
        .execute()
    )

    return int(
        resposta.count or 0
    )


def buscar(
    cliente,
    tabela,
    carga_id=None,
):
    consulta = (
        cliente
        .table(tabela)
        .select(
            ",".join(COLUNAS_ESPERADAS)
        )
    )

    if carga_id is not None:
        consulta = consulta.eq(
            "carga_id",
            carga_id,
        )

    resposta = consulta.execute()

    return resposta.data or []


def assinatura(registro):
    registro = normalizar_registro(
        registro
    )

    return tuple(
        registro[coluna]
        for coluna
        in COLUNAS_ESPERADAS
    )


def validar_conteudo(
    local,
    remoto,
    origem,
):
    if len(local) != len(remoto):
        raise RuntimeError(
            f"{origem}: quantidade divergente. "
            f"Local={len(local)} "
            f"Remoto={len(remoto)}"
        )

    assinatura_local = Counter(
        assinatura(registro)
        for registro in local
    )

    assinatura_remota = Counter(
        assinatura(registro)
        for registro in remoto
    )

    if assinatura_local != assinatura_remota:
        faltantes = (
            assinatura_local
            - assinatura_remota
        )

        extras = (
            assinatura_remota
            - assinatura_local
        )

        raise RuntimeError(
            f"{origem}: conteudo divergente. "
            f"Faltantes={sum(faltantes.values())} "
            f"Extras={sum(extras.values())}"
        )


def validar_buffer(
    cliente,
    carga_id,
    registros,
):
    quantidade = contar(
        cliente,
        TABELA_BUFFER,
        carga_id,
    )

    if quantidade != len(registros):
        raise RuntimeError(
            "Buffer AVCB com quantidade "
            "diferente da esperada."
        )

    remotos = buscar(
        cliente,
        TABELA_BUFFER,
        carga_id,
    )

    validar_conteudo(
        registros,
        remotos,
        "BUFFER AVCB",
    )


def validar_mart(
    cliente,
    registros,
):
    quantidade = contar(
        cliente,
        TABELA_MART,
    )

    if quantidade != len(registros):
        raise RuntimeError(
            "Mart AVCB com quantidade "
            "diferente da esperada."
        )

    remotos = buscar(
        cliente,
        TABELA_MART,
    )

    validar_conteudo(
        registros,
        remotos,
        "MART AVCB",
    )


def enviar_buffer(
    cliente,
    carga_id,
    registros,
):
    preparados = [
        {
            "carga_id": carga_id,
            "linha_id": indice,
            **registro,
        }
        for indice, registro
        in enumerate(
            registros,
            start=1,
        )
    ]

    total = len(preparados)

    for inicio in range(
        0,
        total,
        TAMANHO_LOTE,
    ):
        fim = min(
            inicio + TAMANHO_LOTE,
            total,
        )

        (
            cliente
            .table(TABELA_BUFFER)
            .insert(
                preparados[inicio:fim]
            )
            .execute()
        )

        print(
            f"   Buffer: {fim}/{total}"
        )


def promover(
    cliente,
    carga_id,
    quantidade,
):
    resposta = (
        cliente
        .rpc(
            RPC_PROMOVER,
            {
                "p_carga_id": carga_id,
                "p_quantidade_esperada": quantidade,
            },
        )
        .execute()
    )

    if (
        isinstance(resposta.data, int)
        and resposta.data != quantidade
    ):
        raise RuntimeError(
            "RPC retornou quantidade inesperada."
        )

    return resposta.data


def limpar_buffer(
    cliente,
    carga_id,
):
    (
        cliente
        .table(TABELA_BUFFER)
        .delete()
        .eq(
            "carga_id",
            carga_id,
        )
        .execute()
    )

    restante = contar(
        cliente,
        TABELA_BUFFER,
        carga_id,
    )

    if restante != 0:
        raise RuntimeError(
            "Carga permaneceu no buffer."
        )


def publicar(dry_run=False):
    print("=" * 70)
    print("PUBLICACAO OURO - AVCB")
    print("=" * 70)

    print("\n1. Validando Ouro local...")

    registros = carregar_ouro()

    print(
        f"   Registros: {len(registros)}"
    )

    print("\n2. Conectando ao Supabase...")

    url, secret = carregar_configuracao()

    host = (
        urlparse(url).hostname
        or ""
    )

    print(
        f"   Supabase: {host}"
    )

    cliente = create_client(
        url,
        secret,
    )

    print("\n3. Validando estado remoto...")

    buffer_total = contar(
        cliente,
        TABELA_BUFFER,
    )

    mart_total = contar(
        cliente,
        TABELA_MART,
    )

    print(
        f"   Buffer atual: {buffer_total}"
    )

    print(
        f"   Mart atual: {mart_total}"
    )

    if buffer_total != 0:
        raise RuntimeError(
            "Buffer AVCB nao esta vazio. "
            "Publicacao bloqueada."
        )

    if dry_run:
        print("\nDRY RUN APROVADO.")
        print(
            "Nenhum dado foi alterado "
            "no Supabase."
        )
        return

    carga_id = str(
        uuid.uuid4()
    )

    carga_enviada = False

    try:
        print("\n4. Enviando Ouro ao buffer...")
        print(
            f"   carga_id: {carga_id}"
        )

        enviar_buffer(
            cliente,
            carga_id,
            registros,
        )

        carga_enviada = True

        print(
            "\n5. Validando buffer remoto..."
        )

        validar_buffer(
            cliente,
            carga_id,
            registros,
        )

        print("   Buffer validado.")

        print(
            "\n6. Promovendo atomicamente..."
        )

        retorno = promover(
            cliente,
            carga_id,
            len(registros),
        )

        print(
            f"   Retorno RPC: {retorno}"
        )

        print(
            "\n7. Validando Mart oficial..."
        )

        validar_mart(
            cliente,
            registros,
        )

        print(
            "   Mart oficial validada."
        )

        print(
            "\n8. Limpando buffer..."
        )

        limpar_buffer(
            cliente,
            carga_id,
        )

        print("   Buffer limpo.")

    except Exception:
        print(
            "\nPUBLICACAO AVCB INTERROMPIDA."
        )
        print(
            "Nenhum arquivo local "
            "foi removido."
        )

        if carga_enviada:
            print(
                "Buffer preservado para diagnostico."
            )
            print(
                f"carga_id: {carga_id}"
            )

        raise

    print("\n" + "=" * 70)
    print(
        "PUBLICACAO AVCB CONCLUIDA COM SUCESSO"
    )
    print("=" * 70)
    print(
        f"Registros: {len(registros)}"
    )
    print(
        f"carga_id: {carga_id}"
    )
    print(
        "Arquivos locais: PRESERVADOS"
    )


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Publica a Ouro AVCB "
            "com promocao atomica."
        )
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Valida local e remoto "
            "sem alterar o Supabase."
        ),
    )

    args = parser.parse_args()

    publicar(
        dry_run=args.dry_run
    )


if __name__ == "__main__":
    main()
