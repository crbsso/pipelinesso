from pathlib import Path
from datetime import datetime
import subprocess
import sys
import time

from validar_qualidade import validar_avcb


# =========================================================
# CONFIGURAÇÕES
# =========================================================

PASTA_PROJETO = Path(__file__).resolve().parent

SCRIPT_EXTRACAO = (
    PASTA_PROJETO
    / "extrair_avcb.py"
)

SCRIPT_PRATA = (
    PASTA_PROJETO
    / "tratar_avcb.py"
)

SCRIPT_OURO = (
    PASTA_PROJETO
    / "gerar_ouro_avcb.py"
)

ARQUIVO_BRONZE = (
    PASTA_PROJETO
    / "bronze"
    / "avcb"
    / "Controle de AVCB.xlsx"
)

ARQUIVO_PRATA = (
    PASTA_PROJETO
    / "prata"
    / "avcb"
    / "avcb_prata.xlsx"
)

ARQUIVO_OURO = (
    PASTA_PROJETO
    / "ouro"
    / "avcb"
    / "mart_avcb.xlsx"
)


# =========================================================
# FUNÇÕES AUXILIARES
# =========================================================

def titulo(texto):

    print()
    print("=" * 60)
    print(texto)
    print("=" * 60)
    print()


def executar_script(script):

    resultado = subprocess.run(
        [
            sys.executable,
            str(script)
        ],
        cwd=PASTA_PROJETO
    )

    if resultado.returncode != 0:

        raise RuntimeError(
            f"Falha durante a execução de: {script.name}"
        )


def verificar_arquivo(arquivo, nome_camada):

    if not arquivo.exists():

        raise FileNotFoundError(
            f"{nome_camada} não foi encontrada.\n"
            f"Arquivo esperado:\n{arquivo}"
        )


# =========================================================
# ETAPA 1 — EXTRAÇÃO
# =========================================================

def etapa_extracao():

    titulo(
        "ETAPA 1/4 — EXTRAÇÃO DO AVCB"
    )

    executar_script(
        SCRIPT_EXTRACAO
    )

    verificar_arquivo(
        ARQUIVO_BRONZE,
        "Camada Bronze"
    )

    print()
    print(
        "✅ EXTRAÇÃO CONCLUÍDA"
    )

    print(
        f"Bronze:\n{ARQUIVO_BRONZE}"
    )


# =========================================================
# ETAPA 2 — QUALIDADE
# =========================================================

def etapa_qualidade():

    titulo(
        "ETAPA 2/4 — GATE DE QUALIDADE"
    )

    resultado = validar_avcb()

    estrutura_ok = (
        resultado["estrutura_ok"]
    )

    quantidade_vazios = len(
        resultado["problemas_vazios"]
    )

    quantidade_erros_tipo = len(
        resultado["problemas_tipo"]
    )

    possui_problema = (
        not estrutura_ok
        or quantidade_vazios > 0
        or quantidade_erros_tipo > 0
    )

    if possui_problema:

        print()
        print("=" * 60)
        print(
            "⛔ PIPELINE INTERROMPIDO"
        )
        print("=" * 60)

        print()

        if not estrutura_ok:
            print(
                "Estrutura da Bronze inválida."
            )

        print(
            f"Campos vazios: "
            f"{quantidade_vazios}"
        )

        print(
            f"Erros de tipo: "
            f"{quantidade_erros_tipo}"
        )

        print()

        print(
            "A camada Prata NÃO será atualizada."
        )

        print(
            "A camada Ouro NÃO será atualizada."
        )

        print()

        print(
            "Corrija a planilha original no SharePoint "
            "e execute o pipeline novamente."
        )

        return False

    print()
    print(
        "✅ GATE DE QUALIDADE APROVADO"
    )

    print(
        "A Bronze está liberada para processamento."
    )

    return True


# =========================================================
# ETAPA 3 — PRATA
# =========================================================

def etapa_prata():

    titulo(
        "ETAPA 3/4 — GERAÇÃO DA CAMADA PRATA"
    )

    executar_script(
        SCRIPT_PRATA
    )

    verificar_arquivo(
        ARQUIVO_PRATA,
        "Camada Prata"
    )

    print()
    print(
        "✅ CAMADA PRATA CONCLUÍDA"
    )

    print(
        f"Prata:\n{ARQUIVO_PRATA}"
    )


# =========================================================
# ETAPA 4 — OURO
# =========================================================

def etapa_ouro():

    titulo(
        "ETAPA 4/4 — GERAÇÃO DA CAMADA OURO"
    )

    executar_script(
        SCRIPT_OURO
    )

    verificar_arquivo(
        ARQUIVO_OURO,
        "Camada Ouro"
    )

    print()
    print(
        "✅ CAMADA OURO CONCLUÍDA"
    )

    print(
        f"Ouro:\n{ARQUIVO_OURO}"
    )


# =========================================================
# EXECUÇÃO COMPLETA
# =========================================================

def executar_pipeline():

    inicio = time.time()

    titulo(
        "PIPELINE SSO — AVCB"
    )

    print(
        "Início:"
    )

    print(
        datetime.now().strftime(
            "%d/%m/%Y %H:%M:%S"
        )
    )

    try:

        # -------------------------------------------------
        # 1 — SHAREPOINT → BRONZE
        # -------------------------------------------------

        etapa_extracao()


        # -------------------------------------------------
        # 2 — GATE DE QUALIDADE
        # -------------------------------------------------

        qualidade_aprovada = (
            etapa_qualidade()
        )

        if not qualidade_aprovada:
            return


        # -------------------------------------------------
        # 3 — BRONZE → PRATA
        # -------------------------------------------------

        etapa_prata()


        # -------------------------------------------------
        # 4 — PRATA → OURO
        # -------------------------------------------------

        etapa_ouro()


        # -------------------------------------------------
        # SUCESSO
        # -------------------------------------------------

        duracao = (
            time.time()
            - inicio
        )

        titulo(
            "✅ PIPELINE CONCLUÍDO COM SUCESSO"
        )

        print(
            "Fluxo executado:"
        )

        print()

        print(
            "SharePoint"
        )

        print(
            "   ↓"
        )

        print(
            "Bronze"
        )

        print(
            "   ↓"
        )

        print(
            "Qualidade"
        )

        print(
            "   ↓"
        )

        print(
            "Prata"
        )

        print(
            "   ↓"
        )

        print(
            "Ouro"
        )

        print()

        print(
            "Arquivo final:"
        )

        print(
            ARQUIVO_OURO
        )

        print()

        print(
            f"Tempo total: "
            f"{duracao:.1f} segundos"
        )

        print()

        print(
            "Fim:"
        )

        print(
            datetime.now().strftime(
                "%d/%m/%Y %H:%M:%S"
            )
        )


    except Exception as erro:

        titulo(
            "❌ PIPELINE INTERROMPIDO"
        )

        print(
            "Ocorreu um erro durante "
            "a execução."
        )

        print()

        print(
            f"Erro: {erro}"
        )

        print()

        print(
            "As etapas seguintes não "
            "foram executadas."
        )

        sys.exit(1)


# =========================================================
# INÍCIO
# =========================================================

if __name__ == "__main__":
    executar_pipeline()