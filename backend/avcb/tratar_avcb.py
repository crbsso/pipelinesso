from pathlib import Path
import pandas as pd

from validar_qualidade import validar_avcb


# =========================================================
# CONFIGURAÇÕES
# =========================================================

PASTA_PROJETO = Path(__file__).resolve().parents[2]

ARQUIVO_BRONZE = (
    PASTA_PROJETO
    / "data"
    / "bronze"
    / "avcb"
    / "Controle de AVCB.xlsx"
)

PASTA_PRATA = (
    PASTA_PROJETO
    / "data"
    / "prata"
    / "avcb"
)

ARQUIVO_PRATA = (
    PASTA_PRATA
    / "avcb_prata.xlsx"
)

NOME_ABA_BRONZE = "Em Criação"


# =========================================================
# CONTRATO DE COLUNAS
# BRONZE → PRATA
# =========================================================

MAPA_COLUNAS = {
    "PROJETO": "projeto",
    "SUBESTAÇÃO": "subestacao",
    "LOCALIDADE": "localidade",
    "ESTADO": "estado",
    "RESPONSÁVEL": "responsavel",
    "VALIDADE AVCB NA UF EM ANOS": "validade_avcb_uf_anos",
    "INSTALAÇÃO": "instalacao",
    "EMPRESA": "empresa",
    "SITUAÇÃO": "situacao",
    "GESTÃO DO AVCB": "gestao_avcb",
    "PROJETO DE INCÊNDIO": "projeto_incendio",
    "ÁLVARA CORPO DE BOMBEIROS": "alvara_bombeiros",
    "VIGÊNCIA DO ÁLVARA CORPO DE BOMBEIROS": "vigencia_alvara",
    "SDAI": "sdai",
    "BRIGADA DE INCÊNDIO": "brigada_incendio",
    "Status de Gestão": "status_gestao",
}


# =========================================================
# VERIFICA SE A BRONZE PASSOU PELO GATE
# =========================================================

def bronze_aprovada():

    print("Verificando qualidade da camada Bronze...")

    resultado = validar_avcb()

    possui_problema = (
        not resultado["estrutura_ok"]
        or len(resultado["problemas_vazios"]) > 0
        or len(resultado["problemas_tipo"]) > 0
    )

    if possui_problema:

        print()
        print("=" * 50)
        print("CAMADA PRATA BLOQUEADA")
        print("=" * 50)

        print(
            f"Campos vazios: "
            f"{len(resultado['problemas_vazios'])}"
        )

        print(
            f"Erros de tipo: "
            f"{len(resultado['problemas_tipo'])}"
        )

        if not resultado["estrutura_ok"]:
            print(
                "Estrutura inválida: "
                "quantidade de colunas diferente de 16."
            )

        print()
        print(
            "Corrija os dados na fonte, "
            "atualize a Bronze e execute novamente."
        )

        return False

    print("Bronze aprovada para processamento.")

    return True


# =========================================================
# LIMPEZA DE TEXTOS
# =========================================================

def limpar_texto(serie):

    return (
        serie
        .astype("string")
        .str.strip()
        .str.replace(
            r"\s+",
            " ",
            regex=True
        )
    )


# =========================================================
# TRATAMENTO BRONZE → PRATA
# =========================================================

def tratar_avcb():

    if not bronze_aprovada():
        return

    print()
    print("Lendo camada Bronze...")

    df = pd.read_excel(
        ARQUIVO_BRONZE,
        sheet_name=NOME_ABA_BRONZE
    )


    # -----------------------------------------------------
    # CONFIRMA QUE AS 16 COLUNAS ESPERADAS EXISTEM
    # -----------------------------------------------------

    colunas_ausentes = [
        coluna
        for coluna in MAPA_COLUNAS
        if coluna not in df.columns
    ]

    if colunas_ausentes:

        raise ValueError(
            "As seguintes colunas esperadas "
            f"não foram encontradas: {colunas_ausentes}"
        )


    # -----------------------------------------------------
    # MANTÉM SOMENTE AS COLUNAS DO CONTRATO
    # E NA ORDEM DEFINIDA
    # -----------------------------------------------------

    df = df[
        list(MAPA_COLUNAS.keys())
    ].copy()


    # -----------------------------------------------------
    # RENOMEIA PARA PADRÃO TÉCNICO
    # -----------------------------------------------------

    df = df.rename(
        columns=MAPA_COLUNAS
    )


    # -----------------------------------------------------
    # LIMPEZA DOS CAMPOS DE TEXTO
    # -----------------------------------------------------

    colunas_texto = [
        "projeto",
        "subestacao",
        "localidade",
        "estado",
        "responsavel",
        "instalacao",
        "empresa",
        "situacao",
        "gestao_avcb",
        "projeto_incendio",
        "alvara_bombeiros",
        "sdai",
        "brigada_incendio",
        "status_gestao",
    ]

    for coluna in colunas_texto:

        df[coluna] = limpar_texto(
            df[coluna]
        )


    # -----------------------------------------------------
    # ESTADO → UF EM MAIÚSCULA
    # -----------------------------------------------------

    df["estado"] = (
        df["estado"]
        .str.upper()
    )


    # -----------------------------------------------------
    # GESTÃO DO AVCB → MAIÚSCULA
    # -----------------------------------------------------

    df["gestao_avcb"] = (
        df["gestao_avcb"]
        .str.upper()
    )


    # -----------------------------------------------------
    # STATUS DE GESTÃO → MAIÚSCULA
    # -----------------------------------------------------

    df["status_gestao"] = (
        df["status_gestao"]
        .str.upper()
    )


    # -----------------------------------------------------
    # COLUNA F → INTEIRO
    # -----------------------------------------------------

    df["validade_avcb_uf_anos"] = (
        pd.to_numeric(
            df["validade_avcb_uf_anos"],
            errors="raise"
        )
        .astype("int64")
    )


    # -----------------------------------------------------
    # COLUNA M → DATA
    # -----------------------------------------------------

    df["vigencia_alvara"] = (
        pd.to_datetime(
            df["vigencia_alvara"],
            errors="raise",
            dayfirst=True
        )
        .dt.normalize()
    )


    # -----------------------------------------------------
    # SALVA CAMADA PRATA
    # -----------------------------------------------------

    PASTA_PRATA.mkdir(
        parents=True,
        exist_ok=True
    )

    with pd.ExcelWriter(
        ARQUIVO_PRATA,
        engine="openpyxl",
        datetime_format="DD/MM/YYYY"
    ) as writer:

        df.to_excel(
            writer,
            sheet_name="AVCB",
            index=False
        )


    # -----------------------------------------------------
    # RESULTADO
    # -----------------------------------------------------

    print()
    print("=" * 50)
    print("CAMADA PRATA GERADA COM SUCESSO")
    print("=" * 50)

    print(
        f"Registros: {len(df)}"
    )

    print(
        f"Colunas: {len(df.columns)}"
    )

    print()

    print("Arquivo:")

    print(
        ARQUIVO_PRATA
    )


# =========================================================
# EXECUÇÃO
# =========================================================

if __name__ == "__main__":
    tratar_avcb()