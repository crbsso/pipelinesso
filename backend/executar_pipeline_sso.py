"""Portal SSO: orquestrador operacional proposto (RM, Cobli, Prevsys e AVCB).

Um BAT existente chama main() sem argumentos. NAO executar em producao ate
implantar e autorizar o contrato incremental do Historico.

--plano: mostra a sequencia, sem dependencias ou rede.
--verificar: checa integridade local, sem extracao ou rede.
Sem argumentos: preflight remoto de leitura ANTES de qualquer extracao,
seguido do ETL completo com controle de estados de publicacao.

Velocidade nao e extraida nem publicada. Bronze/Prata/Ouro nao sao apagados.
"""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import sys


RAIZ = Path(__file__).resolve().parents[1]
DATA = RAIZ / "data"
MOTORISTAS = RAIZ / "backend" / "motoristas"


def backend(*partes: str) -> Path:
    return RAIZ.joinpath("backend", *partes)


# Ordem historica do projeto: RM / mapa mestre -> Cobli -> Prevsys / AVCB.
# Publicacoes separadas sao relatadas separadamente, sem rollback ficticio.
ETAPAS = [
    ("COLABORADORES - EXTRACAO RM", backend("cadastros", "colaboradores", "extrair_colaboradores.py")),
    ("COLABORADORES - MAPA MESTRE", backend("cadastros", "colaboradores", "gerar_mapa_colaboradores.py")),
    ("MOTORISTAS - EXTRACAO CADASTRO COBLI", backend("motoristas", "extrair_cobli_motoristas.py")),
    ("MOTORISTAS - CAMADA PRATA CADASTRO", backend("motoristas", "tratar_motoristas.py")),
    ("MOTORISTAS - QUALITY GATE CADASTRO", backend("motoristas", "validar_prata_motoristas.py")),
    ("MOTORISTAS - EXTRACOES COBLI SINCRONIZADAS", backend("motoristas", "executar_extracoes_cobli_sincronizadas.py")),
    ("MOTORISTAS - CAMADA PRATA VIAGENS", backend("motoristas", "tratar_motorista_veiculo.py")),
    ("MOTORISTAS - QUALITY GATE VIAGENS", backend("motoristas", "validar_prata_motorista_veiculo.py")),
    ("HISTORICO MOTORISTAS - QUALITY GATE LOCAL", backend("motoristas", "publicar_historico_motoristas.py")),
    ("MOTORISTAS - CAMADA PRATA SEGURANCA", backend("motoristas", "tratar_seguranca_motoristas.py")),
    ("MOTORISTAS - QUALITY GATE SEGURANCA", backend("motoristas", "validar_prata_seguranca_motoristas.py")),
    ("MOTORISTAS - CAMADA OURO", backend("motoristas", "gerar_ouro_motoristas.py")),
    ("PREVSYS - EXTRACOES", backend("prevsys", "extrair_prevsys.py")),
    ("INSPECOES - CAMADA PRATA", backend("inspecoes", "tratar_quantidade.py")),
    ("INSPECOES - CAMADA OURO", backend("inspecoes", "gerar_ouro_inspecoes.py")),
    ("AVCB - EXTRACAO", backend("avcb", "extrair_avcb.py")),
    ("AVCB - QUALITY GATE BRONZE", backend("avcb", "validar_qualidade.py")),
    ("AVCB - CAMADA PRATA", backend("avcb", "tratar_avcb.py")),
    ("AVCB - CAMADA OURO", backend("avcb", "gerar_ouro_avcb.py")),
    ("PLANOS DE ACAO - CAMADA PRATA", backend("planos_acao", "tratar_planos_acao.py")),
    ("PLANOS DE ACAO - CAMADA OURO", backend("planos_acao", "gerar_ouro_planos_acao.py")),
    ("ACOES CORRETIVAS - CAMADA PRATA", backend("acoes_corretivas", "tratar_acoes_corretivas.py")),
    ("ACOES CORRETIVAS - CAMADA OURO", backend("acoes_corretivas", "gerar_ouro_acoes_corretivas.py")),
    ("PUBLICACAO GLOBAL ATOMICA", backend("publicar_pipeline_sso.py")),
    ("PUBLICACAO ACOES CORRETIVAS (TRANSACAO SEPARADA)", backend("acoes_corretivas", "publicar_ouro_acoes_corretivas.py")),
    ("HISTORICO MOTORISTAS - PUBLICACAO INCREMENTAL (TRANSACAO SEPARADA)", backend("motoristas", "publicar_historico_motoristas.py")),
]

# Hash dos dois scripts de isolamento de Velocidade ja instalados na Etapa 2D.
# Evita que uma copia antiga seja executada acidentalmente pelo BAT.
HASHES_ISOLAMENTO = {
    "backend/publicar_pipeline_sso.py": "7734d117d517f1f0dbea56b36e7e42a5054a870fdfffe7f6070a79401c698a7a",
    "backend/motoristas/executar_extracoes_cobli_sincronizadas.py": "2a73e4fa5301043d8f673d92bcb6399395cf454b89b494a1d01c5a600e386439",
}

PUBLICACOES = {
    "PUBLICACAO GLOBAL ATOMICA": "nucleo",
    "PUBLICACAO ACOES CORRETIVAS (TRANSACAO SEPARADA)": "acoes",
    "HISTORICO MOTORISTAS - PUBLICACAO INCREMENTAL (TRANSACAO SEPARADA)": "historico",
}


def conferir_arquivos() -> None:
    if len(ETAPAS) != 26:
        raise RuntimeError("Contrato de 26 etapas inesperado.")
    if not all(script.is_file() for _, script in ETAPAS):
        faltam = [nome for nome, script in ETAPAS if not script.is_file()]
        raise RuntimeError("Scripts ausentes: " + ", ".join(faltam))
    for relativo, esperado in HASHES_ISOLAMENTO.items():
        atual = hashlib.sha256((RAIZ / relativo).read_bytes()).hexdigest()
        if atual != esperado:
            raise RuntimeError("Isolamento de Velocidade alterado: " + relativo)
    historico = (MOTORISTAS / "publicar_historico_motoristas.py").read_text(encoding="utf-8-sig")
    for marcador in ("--local-only", "--publicar-producao", "--verificar-ambiente-prod"):
        if marcador not in historico:
            raise RuntimeError("Publicador de Historico nao contem " + marcador)


def listar_plano() -> None:
    print("PORTAL SSO - ORQUESTRADOR INTEGRADO (PROPOSTA)")
    for indice, (nome, _) in enumerate(ETAPAS, 1):
        if nome == "HISTORICO MOTORISTAS - QUALITY GATE LOCAL":
            nome += "  [--local-only]"
        if nome in PUBLICACOES and PUBLICACOES[nome] == "historico":
            nome += "  [--publicar-producao]"
        print(f"{indice:02d}. {nome}")
    print("Velocidade: ISOLADA; cleanup: DESABILITADO")
    print("Contrato Historico na PRODUCAO: pendente de migracao e aprovacao especifica")


def executar_etapa(indice: int, nome: str, script: Path, args: list[str] | None = None,
                   variaveis: dict[str, str] | None = None) -> None:
    print(f"\n{'=' * 72}\nETAPA {indice}/{len(ETAPAS)} - {nome}\n{'=' * 72}", flush=True)
    resultado = subprocess.run([sys.executable, "-B", str(script), *(args or [])],
                               cwd=str(RAIZ), env=variaveis, check=False)
    if resultado.returncode != 0:
        raise RuntimeError(f"Etapa {indice} interrompida: {nome} (codigo {resultado.returncode})")
    print("ETAPA APROVADA:", nome, flush=True)


def instantaneo_bronzes() -> dict[str, tuple[int, int]]:
    pasta = DATA / "bronze" / "motoristas"
    return {p.name: (p.stat().st_mtime_ns, p.stat().st_size)
            for p in pasta.glob("cobli_trips_stops_*.json") if p.is_file()}


def bronze_novo(antes: dict[str, tuple[int, int]]) -> str:
    depois = instantaneo_bronzes()
    alterados = [nome for nome, info in depois.items() if antes.get(nome) != info]
    if len(alterados) != 1:
        raise RuntimeError("Cobli deveria gerar exatamente uma Bronze Trips/Stops nova ou renovada; encontradas: " + str(len(alterados)))
    return alterados[0]


def status_final(estados: dict[str, str]) -> None:
    print("\n===== STATUS DE PUBLICACOES (TRANSACOES INDEPENDENTES) =====", flush=True)
    for nome, estado in estados.items():
        print(f"{nome.upper()}: {estado}", flush=True)
    print("VELOCIDADE: BLOQUEADA; DATA/: PRESERVADA; CLEANUP: DESABILITADO", flush=True)


def preflight_remoto() -> None:
    """Leitura HML nao permitida aqui. Apenas PROD, flags e staging acessivel.

    Historico verifica URL/segredo de PROD, 2 flags de habilitacao e staging
    vazia, ANTES de qualquer extracao. A RPC precisa ser instalada e aprovada
    antes que essas flags sejam definidas. Jamais chamar a RPC no preflight.
    """
    script = MOTORISTAS / "publicar_historico_motoristas.py"
    print("PREFLIGHT DE PRODUCAO (SOMENTE LEITURA), ANTES DAS EXTRACOES", flush=True)
    proc = subprocess.run([sys.executable, "-B", str(script), "--verificar-ambiente-prod"],
                          cwd=str(RAIZ), check=False)
    if proc.returncode != 0:
        raise RuntimeError("Historico de producao nao habilitado/indisponivel. Nenhuma extracao iniciada.")



def preflight_paineis_sem_historico() -> None:
    """Confere PROD localmente; nao libera a etapa 26."""
    from dotenv import dotenv_values

    valores = dotenv_values(RAIZ / ".env")
    ref_prod = "lkhidajhsqgebjltyicb"
    url_prod = f"https://{ref_prod}.supabase.co"

    url = (
        os.environ.get("SUPABASE_URL")
        or valores.get("SUPABASE_URL")
        or ""
    ).strip()

    ref = (
        os.environ.get("SSO_SUPABASE_PROJECT_REF")
        or valores.get("SSO_SUPABASE_PROJECT_REF")
        or ""
    ).strip()

    chave = (
        os.environ.get("SUPABASE_SECRET_KEY")
        or valores.get("SUPABASE_SECRET_KEY")
        or ""
    ).strip()

    if url != url_prod or not chave or (ref and ref != ref_prod):
        raise RuntimeError(
            "Modo atualizar-paineis exige URL e credencial de PROD "
            "e rejeita referencia divergente. Nenhuma extracao iniciada."
        )

    # Propaga a referencia validada aos publicadores subprocessos.
    os.environ["SSO_SUPABASE_PROJECT_REF"] = ref_prod

    print(
        "PREFLIGHT PAINEIS: configuracao local PROD confirmada; "
        "Historico PROD bloqueado.",
        flush=True,
    )

def main() -> int:
    parser = argparse.ArgumentParser(description="Orquestracao Portal SSO - RM, Cobli, Prevsys e AVCB")
    parser.add_argument("--plano", action="store_true", help="Somente mostrar etapas")
    parser.add_argument("--verificar", action="store_true", help="Checagem estatica sem rede ou execucao")
    parser.add_argument("--teste-hml", action="store_true", help="Etapas 1-23 sem publicacoes ou PROD")
    parser.add_argument(
        "--atualizar-paineis",
        action="store_true",
        help="PROD: etapas 1-25, sem publicar Historico",
    )
    parser.add_argument(
        "--retomar-14a23",
        action="store_true",
        help="Executar somente etapas 14 a 23, sem publicacoes",
    )
    parser.add_argument("--manutencao", action="store_true", help="Executar somente o piloto Intranet, independente das 26 etapas")
    parser.add_argument("--arquivo-intranet", type=Path)
    parser.add_argument("--confirmar-fuso-origem", choices=("America/Sao_Paulo",))
    parser.add_argument("--extrair-intranet", action="store_true")
    parser.add_argument("--permitir-certificado-temporario", action="store_true")
    parser.add_argument("--publicar-manutencao-hml", action="store_true")
    parser.add_argument("--publicar-manutencao-prod", action="store_true")
    parser.add_argument("--confirmar-producao")
    parser.add_argument("--painel-completo-manutencao", action="store_true")
    parser.add_argument("--inicio-intranet")
    parser.add_argument("--fim-intranet")
    args = parser.parse_args()
    parametros_manutencao = (args.publicar_manutencao_prod or args.confirmar_producao or args.painel_completo_manutencao or args.inicio_intranet or args.fim_intranet or args.arquivo_intranet or args.confirmar_fuso_origem
        or args.extrair_intranet or args.permitir_certificado_temporario or args.publicar_manutencao_hml)
    if parametros_manutencao and not args.manutencao:
        parser.error("Os argumentos da Intranet exigem --manutencao.")
    if args.publicar_manutencao_hml and args.publicar_manutencao_prod:
        parser.error("Selecione um único ambiente para a Manutenção")
    if args.publicar_manutencao_prod and (not args.painel_completo_manutencao or args.confirmar_producao != "lkhidajhsqgebjltyicb"):
        parser.error("Produção exige painel completo e confirmação do projeto")
    if args.manutencao:
        if args.plano or args.verificar or args.teste_hml or args.retomar_14a23 or getattr(args, "atualizar_paineis", False):
            parser.error("--manutencao nao pode ser combinado com outros modos.")
        if not args.arquivo_intranet or not args.confirmar_fuso_origem:
            parser.error("--manutencao exige --arquivo-intranet e --confirmar-fuso-origem.")
        entrada = "painel_manutencao.py" if args.painel_completo_manutencao else "executar_pipeline_manutencao.py"
        comando = [sys.executable, "-B", str(backend("intranet", entrada)),
                   "--arquivo", str(args.arquivo_intranet.resolve()),
                   "--confirmar-fuso-origem", args.confirmar_fuso_origem]
        if args.painel_completo_manutencao and args.inicio_intranet and args.fim_intranet:
            comando.extend(["--inicio", args.inicio_intranet, "--fim", args.fim_intranet])
        if args.extrair_intranet:
            comando.append("--extrair")
        if args.permitir_certificado_temporario:
            comando.append("--permitir-certificado-temporario")
        if args.publicar_manutencao_prod:
            comando.extend(["--publicar-prod", "--confirmar-producao", args.confirmar_producao])
        if args.publicar_manutencao_hml:
            comando.append("--publicar-hml")
        return subprocess.run(comando, cwd=RAIZ, check=False).returncode
    if args.teste_hml and (args.plano or args.verificar or args.retomar_14a23):
        parser.error("--teste-hml nao pode ser combinado com outros modos")
    if args.atualizar_paineis and (
        args.plano or args.verificar
        or args.teste_hml or args.retomar_14a23
    ):
        parser.error(
            "--atualizar-paineis nao pode ser combinado com outros modos"
        )
    if args.plano:
        listar_plano()
        return 0
    try:
        conferir_arquivos()
        if args.verificar:
            print("INTEGRACAO LOCAL: 26 ETAPAS E ISOLAMENTO DE VELOCIDADE VERIFICADOS")
            print("SEM ETL | SEM REDE | SEM SQL | SEM ALTERACAO DE ARQUIVOS")
            return 0
        if args.retomar_14a23:
            if (
                len(ETAPAS) != 26
                or ETAPAS[13][0] != "INSPECOES - CAMADA PRATA"
                or ETAPAS[22][0] != "ACOES CORRETIVAS - CAMADA OURO"
                or ETAPAS[23][0] != "PUBLICACAO GLOBAL ATOMICA"
            ):
                raise RuntimeError("Contrato da retomada mudou.")

            arquivos_exigidos = [
                DATA / "bronze" / "inspecoes" / "quantidade"
                    / "Detalle_Checklist.xlsx",
                DATA / "bronze" / "planos_acao"
                    / "Planos_de_acao_detalhados.xlsx",
                DATA / "bronze" / "acoes_corretivas"
                    / "Detalhes_das_acoes_corretivas.xlsx",
                DATA / "ouro" / "motoristas"
                    / "mart_motoristas.xlsx",
            ]

            for fonte in arquivos_exigidos:
                if not fonte.is_file() or fonte.stat().st_size == 0:
                    raise RuntimeError(
                        f"Artefato de retomada ausente ou vazio: {fonte}"
                    )

            print(
                "RETOMADA LOCAL: ETAPAS 14-23; "
                "PUBLICACOES 24-26 BLOQUEADAS",
                flush=True,
            )
        elif args.teste_hml:
            from dotenv import dotenv_values

            valores = dotenv_values(RAIZ / ".env")
            ref_hml = "ckfsarzmudwdehiiltwi"
            url_hml = f"https://{ref_hml}.supabase.co"

            url_efetiva = os.environ.get(
                "SUPABASE_URL", valores.get("SUPABASE_URL")
            )
            ref_efetiva = os.environ.get(
                "SSO_SUPABASE_PROJECT_REF",
                valores.get("SSO_SUPABASE_PROJECT_REF"),
            )

            if url_efetiva != url_hml or ref_efetiva != ref_hml:
                raise RuntimeError(
                    "TESTE HML BLOQUEADO: URL ou project ref divergente."
                )

            if os.environ.get("SSO_HML_URL") not in (None, url_hml):
                raise RuntimeError(
                    "TESTE HML BLOQUEADO: SSO_HML_URL divergente."
                )

            print(
                "TESTE OPERACIONAL HML: etapas 1-23, "
                "publicacoes bloqueadas.",
                flush=True,
            )
        elif args.atualizar_paineis:
            preflight_paineis_sem_historico()
        else:
            # Modo normal: preserva o preflight de producao.
            preflight_remoto()
    except Exception as exc:
        print("BLOQUEIO ANTES DE QUALQUER EXTRACAO:", exc, file=sys.stderr)
        return 2

    estados = {"nucleo": "NAO INICIADO", "acoes": "NAO INICIADO", "historico": "NAO INICIADO"}
    bronze_antes = instantaneo_bronzes()
    bronze_selecionada = None
    bronze_acoes = DATA / "bronze" / "acoes_corretivas" / "Detalhes_das_acoes_corretivas.xlsx"
    mtime_acao_anterior = bronze_acoes.stat().st_mtime_ns if bronze_acoes.is_file() else None
    print("PIPELINE SSO - INTEGRACAO GLOBAL AUTORIZADA")
    print("HISTORICOS E ARQUIVOS EXISTENTES: PRESERVADOS; SEM CLEANUP AUTOMATICO")

    try:
        for indice, (nome, script) in enumerate(ETAPAS, 1):
            if args.retomar_14a23 and not (14 <= indice <= 23):
                continue
            if args.atualizar_paineis and indice == 26:
                continue
            if args.teste_hml and indice > 23:
                continue

            argumentos = []
            ambiente = os.environ.copy()
            if nome == "HISTORICO MOTORISTAS - QUALITY GATE LOCAL":
                argumentos = ["--local-only"]
            elif nome == "HISTORICO MOTORISTAS - PUBLICACAO INCREMENTAL (TRANSACAO SEPARADA)":
                argumentos = ["--publicar-producao"]
            if nome.startswith("HISTORICO MOTORISTAS"):
                if not bronze_selecionada:
                    raise RuntimeError("Bronze Cobli desta execucao ainda nao identificada.")
                ambiente["COBLI_BRONZE_TRIPS_STOPS"] = bronze_selecionada

            publicacao = PUBLICACOES.get(nome)
            if publicacao:
                estados[publicacao] = "INICIADA (RESULTADO REMOTO PODE ESTAR INDETERMINADO)"
            executar_etapa(indice, nome, script, argumentos, ambiente)
            if publicacao:
                estados[publicacao] = "CONCLUIDA E CONFIRMADA PELO PUBLICADOR"

            if nome == "MOTORISTAS - EXTRACOES COBLI SINCRONIZADAS":
                bronze_selecionada = bronze_novo(bronze_antes)
                print("Bronze Trips/Stops selecionada:", bronze_selecionada)
            if nome == "PREVSYS - EXTRACOES":
                if not bronze_acoes.is_file():
                    raise RuntimeError("Prevsys nao gerou Bronze de Acoes Corretivas.")
                if mtime_acao_anterior is not None and bronze_acoes.stat().st_mtime_ns == mtime_acao_anterior:
                    raise RuntimeError("Bronze de Acoes Corretivas nao foi renovada na execucao.")
                print("Bronze Prevsys de Acoes Corretivas renovada.")

        if args.teste_hml:
            print(
                "\nTESTE HML CONCLUIDO: ETAPAS 1 A 23 APROVADAS",
                flush=True,
            )
            print(
                "PUBLICACOES 24-26: NAO EXECUTADAS",
                flush=True,
            )
            status_final(estados)
            return 0

        if args.retomar_14a23:
            print(
                "\nRETOMADA CONCLUIDA: ETAPAS 14 A 23 APROVADAS",
                flush=True,
            )
            print(
                "PUBLICACOES 24-26: NAO EXECUTADAS",
                flush=True,
            )
            status_final(estados)
            return 0

        if args.atualizar_paineis:
            print(
                "\nPAINEIS: ETAPAS 1-25 CONCLUIDAS; "
                "PUBLICACAO DO HISTORICO NAO EXECUTADA",
                flush=True,
            )
            status_final(estados)
            return 0

        print("\nPIPELINE SSO: TODAS AS ETAPAS CONCLUIDAS, INCLUSIVE HISTORICO")
        print("DIRECAO CONTINUA: view dependente de historico; validacao funcional positiva ainda pendente")
        status_final(estados)
        return 0
    except Exception as exc:
        print("\nPIPELINE SSO INTERROMPIDO:", exc, file=sys.stderr)
        print("NAO REEXECUTAR SEM RECONCILIAR PUBLICACOES INICIADAS", file=sys.stderr)
        status_final(estados)
        return 1


if __name__ == "__main__":
    sys.exit(main())
