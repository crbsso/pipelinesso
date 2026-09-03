from pathlib import Path
from datetime import datetime

import pandas as pd


# =========================================================
# CONFIGURAÇÕES
# =========================================================

PASTA_PROJETO = Path(__file__).resolve().parent

ARQUIVO_PRATA = (
    PASTA_PROJETO
    / "prata"
    / "avcb"
    / "avcb_prata.xlsx"
)

PASTA_OURO = (
    PASTA_PROJETO
    / "ouro"
    / "avcb"
)

ARQUIVO_OURO = (
    PASTA_OURO
    / "mart_avcb.xlsx"
)

NOME_ABA_PRATA = "AVCB"

# AVCB com vencimento entre hoje e 90 dias
# será classificado como A VENCER.
JANELA_A_VENCER_DIAS = 90


# =========================================================
# REGRA DE NEGÓCIO — STATUS DE VALIDADE
# =========================================================

def classificar_status_validade(dias_para_vencer):

    if dias_para_vencer < 0:
        return "VENCIDO"

    if dias_para_vencer <= JANELA_A_VENCER_DIAS:
        return "A VENCER"

    return "REGULAR"


# =========================================================
# REGRA DE NEGÓCIO — RESPONSABILIDADE DO AVCB
# =========================================================
#
# A responsabilidade é definida pela coluna GESTÃO DO AVCB.
#
# PRÓPRIO  -> CELEO
# TERCEIRO -> TERCEIROS
#
# INSTALAÇÃO é uma característica separada e NÃO define
# a responsabilidade pela gestão do AVCB.
# =========================================================

def definir_responsabilidade_avcb(gestao_avcb):

    valor = (
        str(gestao_avcb)
        .strip()
        .upper()
    )

    if valor == "PRÓPRIA":
        return "CELEO"

    if valor == "TERCEIRO":
        return "TERCEIROS"

    raise ValueError(
        "Valor de GESTÃO DO AVCB não reconhecido: "
        f"{gestao_avcb}. "
        "Valores esperados: PRÓPRIA ou TERCEIRO."
    )


# =========================================================
# VERIFICAÇÃO DA CAMADA PRATA
# =========================================================

def verificar_prata():

    if not ARQUIVO_PRATA.exists():

        print("=" * 50)
        print("CAMADA OURO BLOQUEADA")
        print("=" * 50)

        print()
        print(
            "A camada Prata do AVCB ainda "
            "não foi gerada."
        )

        print()
        print("Arquivo esperado:")
        print(ARQUIVO_PRATA)

        print()
        print(
            "A Ouro só poderá ser gerada "
            "depois que a Bronze passar "
            "pela validação de qualidade "
            "e a camada Prata for gerada."
        )

        return False

    return True


# =========================================================
# GERAÇÃO DA CAMADA OURO
# =========================================================

def gerar_ouro_avcb():

    if not verificar_prata():
        return

    print(
        "Lendo camada Prata do AVCB..."
    )

    df = pd.read_excel(
        ARQUIVO_PRATA,
        sheet_name=NOME_ABA_PRATA
    )

    print(
        f"Registros recebidos: {len(df)}"
    )

    print(
        f"Colunas recebidas: {len(df.columns)}"
    )


    # =====================================================
    # VERIFICA COLUNAS NECESSÁRIAS
    # =====================================================

    colunas_necessarias = [
        "projeto",
        "subestacao",
        "localidade",
        "estado",
        "responsavel",
        "validade_avcb_uf_anos",
        "instalacao",
        "empresa",
        "situacao",
        "gestao_avcb",
        "projeto_incendio",
        "alvara_bombeiros",
        "vigencia_alvara",
        "sdai",
        "brigada_incendio",
        "status_gestao",
    ]

    colunas_ausentes = [
        coluna
        for coluna in colunas_necessarias
        if coluna not in df.columns
    ]

    if colunas_ausentes:

        raise ValueError(
            "A camada Prata não possui "
            "todas as colunas necessárias. "
            f"Ausentes: {colunas_ausentes}"
        )


    # =====================================================
    # GARANTE TIPO DATA
    # =====================================================

    df["vigencia_alvara"] = pd.to_datetime(
        df["vigencia_alvara"],
        errors="raise"
    )


    # =====================================================
    # DATA DE REFERÊNCIA DO PROCESSAMENTO
    # =====================================================

    data_referencia = (
        pd.Timestamp.today().normalize()
    )


    # =====================================================
    # DIAS PARA VENCER
    # =====================================================

    df["dias_para_vencer"] = (
        df["vigencia_alvara"]
        - data_referencia
    ).dt.days


    # =====================================================
    # STATUS DE VALIDADE
    # =====================================================
    #
    # dias < 0
    # -> VENCIDO
    #
    # 0 <= dias <= 90
    # -> A VENCER
    #
    # dias > 90
    # -> REGULAR
    # =====================================================

    df["status_validade"] = (
        df["dias_para_vencer"]
        .apply(
            classificar_status_validade
        )
    )


    # =====================================================
    # RESPONSABILIDADE DO AVCB
    # =====================================================
    #
    # GESTÃO DO AVCB = PRÓPRIO
    # -> CELEO
    #
    # GESTÃO DO AVCB = TERCEIRO
    # -> TERCEIROS
    # =====================================================

    df["responsabilidade_avcb"] = (
        df["gestao_avcb"]
        .apply(
            definir_responsabilidade_avcb
        )
    )


    # =====================================================
    # DATA DE ATUALIZAÇÃO DA CAMADA OURO
    # =====================================================

    df["data_atualizacao"] = (
        data_referencia
    )


    # =====================================================
    # ORDENA COLUNAS PARA O MART
    # =====================================================

    colunas_mart = [
        "projeto",
        "subestacao",
        "localidade",
        "estado",
        "responsavel",
        "empresa",

        # Característica da instalação
        "instalacao",

        # Quem faz a gestão do AVCB
        "gestao_avcb",

        # Responsabilidade calculada
        "responsabilidade_avcb",

        "situacao",
        "projeto_incendio",
        "alvara_bombeiros",
        "sdai",
        "brigada_incendio",
        "validade_avcb_uf_anos",

        # Vigência e classificação
        "vigencia_alvara",
        "dias_para_vencer",
        "status_validade",

        # Controle manual informado pelos técnicos
        "status_gestao",

        "data_atualizacao",
    ]

    mart_avcb = df[
        colunas_mart
    ].copy()


    # =====================================================
    # INDICADORES BÁSICOS
    # =====================================================

    total_avcbs = len(
        mart_avcb
    )


    # -----------------------------------------------------
    # RESPONSABILIDADE
    # -----------------------------------------------------

    total_proprios = (
        mart_avcb[
            "responsabilidade_avcb"
        ]
        .eq("CELEO")
        .sum()
    )

    total_terceiros = (
        mart_avcb[
            "responsabilidade_avcb"
        ]
        .eq("TERCEIROS")
        .sum()
    )


    # -----------------------------------------------------
    # VERIFICAÇÃO DE CONSISTÊNCIA
    # -----------------------------------------------------

    total_classificado = (
        total_proprios
        + total_terceiros
    )

    if total_classificado != total_avcbs:

        raise ValueError(
            "Erro na classificação de responsabilidade. "
            f"Total de AVCBs: {total_avcbs}. "
            f"Classificados: {total_classificado}."
        )


    # -----------------------------------------------------
    # STATUS DE VALIDADE — TOTAL GERAL
    # -----------------------------------------------------

    total_regulares = (
        mart_avcb[
            "status_validade"
        ]
        .eq("REGULAR")
        .sum()
    )

    total_a_vencer = (
        mart_avcb[
            "status_validade"
        ]
        .eq("A VENCER")
        .sum()
    )

    total_vencidos = (
        mart_avcb[
            "status_validade"
        ]
        .eq("VENCIDO")
        .sum()
    )


    # -----------------------------------------------------
    # STATUS DE GESTÃO — TOTAL GERAL
    # -----------------------------------------------------

    total_ativos = (
        mart_avcb[
            "status_gestao"
        ]
        .eq("ATIVO")
        .sum()
    )

    total_em_atualizacao = (
        mart_avcb[
            "status_gestao"
        ]
        .eq("EM ATUALIZAÇÃO")
        .sum()
    )

    total_desativados = (
        mart_avcb[
            "status_gestao"
        ]
        .eq("DESATIVADO")
        .sum()
    )


    # =====================================================
    # INDICADORES PARA O DASHBOARD
    # =====================================================

    indicadores = pd.DataFrame(
        [
            {
                "indicador": "total_avcbs",
                "valor": total_avcbs
            },
            {
                "indicador": "total_avcbs_proprios",
                "valor": total_proprios
            },
            {
                "indicador": "total_avcbs_terceiros",
                "valor": total_terceiros
            },
            {
                "indicador": "total_regulares",
                "valor": total_regulares
            },
            {
                "indicador": "total_a_vencer",
                "valor": total_a_vencer
            },
            {
                "indicador": "total_vencidos",
                "valor": total_vencidos
            },
            {
                "indicador": "total_ativos",
                "valor": total_ativos
            },
            {
                "indicador": "total_em_atualizacao",
                "valor": total_em_atualizacao
            },
            {
                "indicador": "total_desativados",
                "valor": total_desativados
            },
        ]
    )


    # =====================================================
    # PARÂMETROS / REGRAS DO DASHBOARD
    # =====================================================

    parametros = pd.DataFrame(
        [
            {
                "parametro": "janela_a_vencer_dias",
                "valor": JANELA_A_VENCER_DIAS,
                "descricao": (
                    "AVCBs com vencimento entre "
                    "0 e 90 dias são classificados "
                    "como A VENCER."
                )
            },
            {
                "parametro": "criterio_vencido",
                "valor": "< 0 dias",
                "descricao": (
                    "AVCB com data de vigência "
                    "anterior à data de referência "
                    "é classificado como VENCIDO."
                )
            },
            {
                "parametro": "criterio_regular",
                "valor": "> 90 dias",
                "descricao": (
                    "AVCB com mais de 90 dias "
                    "até o vencimento é classificado "
                    "como REGULAR."
                )
            },
            {
                "parametro": "gestao_proprio",
                "valor": "CELEO",
                "descricao": (
                    "Quando GESTÃO DO AVCB é PRÓPRIO, "
                    "a responsabilidade do AVCB é "
                    "classificada como CELEO."
                )
            },
            {
                "parametro": "gestao_terceiro",
                "valor": "TERCEIROS",
                "descricao": (
                    "Quando GESTÃO DO AVCB é TERCEIRO, "
                    "a responsabilidade do AVCB é "
                    "classificada como TERCEIROS."
                )
            },
            {
                "parametro": "criterio_dashboard_a_vencer",
                "valor": "90 dias",
                "descricao": (
                    "O dashboard deve informar "
                    "explicitamente que A VENCER "
                    "representa AVCBs com vencimento "
                    "nos próximos 90 dias."
                )
            },
            {
                "parametro": "data_processamento",
                "valor": datetime.now().strftime(
                    "%d/%m/%Y %H:%M"
                ),
                "descricao": (
                    "Data e hora da geração "
                    "da camada Ouro."
                )
            }
        ]
    )


    # =====================================================
    # SALVA CAMADA OURO
    # =====================================================

    PASTA_OURO.mkdir(
        parents=True,
        exist_ok=True
    )

    with pd.ExcelWriter(
        ARQUIVO_OURO,
        engine="openpyxl",
        datetime_format="DD/MM/YYYY"
    ) as writer:

        # Base final de consumo do dashboard
        mart_avcb.to_excel(
            writer,
            sheet_name="mart_avcb",
            index=False
        )

        # KPIs
        indicadores.to_excel(
            writer,
            sheet_name="indicadores",
            index=False
        )

        # Regras utilizadas
        parametros.to_excel(
            writer,
            sheet_name="parametros",
            index=False
        )


    # =====================================================
    # RESULTADO
    # =====================================================

    print()
    print("=" * 50)
    print(
        "CAMADA OURO GERADA COM SUCESSO"
    )
    print("=" * 50)

    print(
        f"Registros: {len(mart_avcb)}"
    )

    print(
        f"Colunas: {len(mart_avcb.columns)}"
    )

    print()

    print(
        f"Total AVCBs: "
        f"{total_avcbs}"
    )

    print(
        f"Total AVCBs próprios / CELEO: "
        f"{total_proprios}"
    )

    print(
        f"Total AVCBs terceiros: "
        f"{total_terceiros}"
    )

    print()

    print(
        "Conferência:"
    )

    print(
        f"{total_proprios} + "
        f"{total_terceiros} = "
        f"{total_classificado}"
    )

    print()

    print(
        "Status de validade:"
    )

    print(
        f"Regulares: "
        f"{total_regulares}"
    )

    print(
        f"A vencer: "
        f"{total_a_vencer}"
    )

    print(
        f"Vencidos: "
        f"{total_vencidos}"
    )

    print()

    print(
        "Status de gestão:"
    )

    print(
        f"Ativos: "
        f"{total_ativos}"
    )

    print(
        f"Em atualização: "
        f"{total_em_atualizacao}"
    )

    print(
        f"Desativados: "
        f"{total_desativados}"
    )

    print()

    print(
        "Regra de A VENCER:"
    )

    print(
        f"0 a {JANELA_A_VENCER_DIAS} dias"
    )

    print()

    print(
        "Arquivo:"
    )

    print(
        ARQUIVO_OURO
    )


# =========================================================
# EXECUÇÃO
# =========================================================

if __name__ == "__main__":
    gerar_ouro_avcb()