from pathlib import Path
import unicodedata

import pandas as pd


BASE = Path(__file__).resolve().parents[3]

ARQUIVO_BRONZE = (
    BASE
    / "data"
    / "bronze"
    / "cadastros"
    / "colaboradores"
    / "Colaboradores_RM.xlsx"
)

ARQUIVO_BRONZE_FOLHA = (
    BASE
    / "data"
    / "bronze"
    / "cadastros"
    / "colaboradores"
    / "Colaboradores_Folha_RM.xlsx"
)

ARQUIVO_SITUACOES = (
    BASE
    / "backend"
    / "cadastros"
    / "colaboradores"
    / "config"
    / "situacoes_rm.csv"
)

PASTA_MASTER = (
    BASE
    / "data"
    / "master"
    / "colaboradores"
)

ARQUIVO_MASTER = (
    PASTA_MASTER
    / "mapa_colaboradores.csv"
)

CODCOLIGADA_CRB = "1"
FILIAL_AGRUPAMENTO_CRB = "CRB-RJ"

CODFUNCAO_CONSELHEIRO = "00073"


def normalizar_nome(valor):
    texto = str(valor or "").strip().upper()

    texto = unicodedata.normalize(
        "NFKD",
        texto,
    )

    texto = "".join(
        caractere
        for caractere in texto
        if not unicodedata.combining(caractere)
    )

    texto = " ".join(
        texto.split()
    )

    return texto


def criar_nome_exibicao(nome):
    partes = str(nome or "").strip().split()

    if not partes:
        return ""

    if len(partes) == 1:
        return partes[0].title()

    primeiro = partes[0].title()
    ultimo = partes[-1].title()

    return f"{primeiro} {ultimo}"


def carregar_rm():
    if not ARQUIVO_BRONZE.exists():
        raise FileNotFoundError(
            f"Bronze RM nao encontrado: {ARQUIVO_BRONZE}"
        )

    df = pd.read_excel(
        ARQUIVO_BRONZE,
        dtype=str,
    )

    colunas_esperadas = [
        "CODCOLIGADA",
        "CODFILIAL",
        "FILIAL",
        "CHAPA",
        "COLABORADOR",
        "CODFUNCAO",
        "FUNCAO",
        "CODSITUACAO",
        "CODSECAO",
        "SECAO",
    ]

    ausentes = [
        coluna
        for coluna in colunas_esperadas
        if coluna not in df.columns
    ]

    if ausentes:
        raise RuntimeError(
            "Colunas ausentes no Bronze RM: "
            + ", ".join(ausentes)
        )

    for coluna in colunas_esperadas:
        df[coluna] = (
            df[coluna]
            .fillna("")
            .astype(str)
            .str.strip()
        )

    df["nome_normalizado"] = (
        df["COLABORADOR"]
        .apply(normalizar_nome)
    )

    df["cod_colaborador_rm"] = (
        df["CHAPA"]
        + "-"
        + df["CODCOLIGADA"]
    )

    if df["cod_colaborador_rm"].duplicated().any():
        duplicados = df[
            df["cod_colaborador_rm"]
            .duplicated(
                keep=False
            )
        ]

        print(
            duplicados[
                [
                    "cod_colaborador_rm",
                    "COLABORADOR",
                    "CODCOLIGADA",
                    "CODFILIAL",
                ]
            ].to_string(
                index=False
            )
        )

        raise RuntimeError(
            "A chave CHAPA-CODCOLIGADA "
            "nao e unica no RM."
        )

    return df


def carregar_rm_consolidado():
    """
    Consolida duas fontes do TOTVS RM:

    1. Gestao de Pessoas:
       populacao atual e atributos organizacionais.

    2. Folha de Pagamento:
       CODPESSOA, admissao, demissao e historico.

    Regra operacional:
    - atuais permanecem no mapa;
    - demitidos permanecem por ate 1 ano;
    - quem ja voltou para a populacao atual nao e
      duplicado;
    - historicos com varios vinculos sao
      canonizados por CODPESSOA.
    """

    df_atual = carregar_rm()

    if not ARQUIVO_BRONZE_FOLHA.exists():
        raise FileNotFoundError(
            "Bronze Folha RM nao encontrado: "
            f"{ARQUIVO_BRONZE_FOLHA}"
        )

    folha = pd.read_excel(
        ARQUIVO_BRONZE_FOLHA,
        dtype=str,
    )

    colunas_folha = [
        "CODCOLIGADA",
        "CODPESSOA",
        "CHAPA",
        "NOME",
        "CODSITUACAO",
        "CODSECAO",
        "DATAADMISSAO",
        "DATADEMISSAO",
    ]

    ausentes = [
        coluna
        for coluna in colunas_folha
        if coluna not in folha.columns
    ]

    if ausentes:
        raise RuntimeError(
            "Colunas ausentes no Bronze Folha RM: "
            + ", ".join(ausentes)
        )

    for coluna in [
        "CODCOLIGADA",
        "CODPESSOA",
        "CHAPA",
        "NOME",
        "CODSITUACAO",
        "CODSECAO",
    ]:
        folha[coluna] = (
            folha[coluna]
            .fillna("")
            .astype(str)
            .str.strip()
        )

    folha["DATAADMISSAO"] = pd.to_datetime(
        folha["DATAADMISSAO"],
        errors="coerce",
    )

    folha["DATADEMISSAO"] = pd.to_datetime(
        folha["DATADEMISSAO"],
        errors="coerce",
    )

    if folha[
        [
            "CODCOLIGADA",
            "CHAPA",
        ]
    ].duplicated().any():

        duplicados = folha[
            folha[
                [
                    "CODCOLIGADA",
                    "CHAPA",
                ]
            ].duplicated(
                keep=False
            )
        ]

        print(
            duplicados[
                [
                    "CODCOLIGADA",
                    "CHAPA",
                    "CODPESSOA",
                    "NOME",
                ]
            ].to_string(
                index=False
            )
        )

        raise RuntimeError(
            "Folha possui chave "
            "CODCOLIGADA + CHAPA duplicada."
        )

    folha["nome_normalizado"] = (
        folha["NOME"]
        .apply(normalizar_nome)
    )

    folha["chave_vinculo"] = (
        folha["CODCOLIGADA"]
        + "|"
        + folha["CHAPA"]
    )

    df_atual["chave_vinculo"] = (
        df_atual["CODCOLIGADA"]
        + "|"
        + df_atual["CHAPA"]
    )

    chaves_atuais = set(
        df_atual["chave_vinculo"]
    )

    # -----------------------------------------------------
    # ENRIQUECE OS ATUAIS COM A FOLHA
    # -----------------------------------------------------

    dados_folha_atual = folha[
        [
            "CODCOLIGADA",
            "CHAPA",
            "CODPESSOA",
            "NOME",
            "CODSITUACAO",
            "CODSECAO",
            "DATAADMISSAO",
            "DATADEMISSAO",
        ]
    ].rename(
        columns={
            "NOME":
                "NOME_FOLHA",
            "CODSITUACAO":
                "CODSITUACAO_FOLHA",
            "CODSECAO":
                "CODSECAO_FOLHA",
        }
    )

    df_atual = df_atual.merge(
        dados_folha_atual,
        how="left",
        on=[
            "CODCOLIGADA",
            "CHAPA",
        ],
        validate="one_to_one",
    )

    if df_atual["CODPESSOA"].fillna("").eq("").any():
        raise RuntimeError(
            "Existe colaborador atual da Gestao "
            "sem correspondencia na Folha."
        )

    nomes_folha = (
        df_atual["NOME_FOLHA"]
        .apply(normalizar_nome)
    )

    if not (
        nomes_folha
        == df_atual["nome_normalizado"]
    ).all():
        raise RuntimeError(
            "Nome diverge entre Gestao e Folha "
            "para colaborador atual."
        )

    if not (
        df_atual["CODSITUACAO"]
        == df_atual["CODSITUACAO_FOLHA"]
    ).all():
        raise RuntimeError(
            "CODSITUACAO diverge entre "
            "Gestao e Folha."
        )

    if not (
        df_atual["CODSECAO"]
        == df_atual["CODSECAO_FOLHA"]
    ).all():
        raise RuntimeError(
            "CODSECAO diverge entre "
            "Gestao e Folha."
        )

    df_atual = df_atual.drop(
        columns=[
            "NOME_FOLHA",
            "CODSITUACAO_FOLHA",
            "CODSECAO_FOLHA",
        ]
    )

    df_atual["origem_registro"] = (
        "GESTAO_ATUAL"
    )

    df_atual["origem_secao_rm"] = (
        "GESTAO"
    )

    df_atual["elegivel_planos_acao"] = 1

    df_atual[
        "data_limite_elegibilidade"
    ] = pd.NaT

    # -----------------------------------------------------
    # HISTORICOS DA FOLHA
    # -----------------------------------------------------

    historicos = folha[
        ~folha["chave_vinculo"]
        .isin(
            chaves_atuais
        )
    ].copy()

    situacoes_inesperadas = sorted(
        set(
            historicos[
                "CODSITUACAO"
            ]
            .dropna()
            .tolist()
        )
        - {
            "",
            "D",
        }
    )

    if situacoes_inesperadas:
        raise RuntimeError(
            "Folha possui registros fora da "
            "Gestao com situacao inesperada: "
            + ", ".join(
                situacoes_inesperadas
            )
        )

    data_referencia = (
        pd.Timestamp.now()
        .normalize()
    )

    historicos[
        "data_limite_elegibilidade"
    ] = (
        historicos[
            "DATADEMISSAO"
        ]
        + pd.DateOffset(
            years=1
        )
    )

    recentes = historicos[
        historicos[
            "DATADEMISSAO"
        ].notna()
        &
        (
            data_referencia
            <= historicos[
                "data_limite_elegibilidade"
            ]
        )
    ].copy()

    codpessoa_atuais = set(
        df_atual[
            "CODPESSOA"
        ]
    )

    nomes_atuais = set(
        df_atual[
            "nome_normalizado"
        ]
    )

    mask_ja_atual = (
        recentes[
            "CODPESSOA"
        ].isin(
            codpessoa_atuais
        )
        |
        recentes[
            "nome_normalizado"
        ].isin(
            nomes_atuais
        )
    )

    recentes_recontratados = (
        recentes.loc[
            mask_ja_atual
        ]
        .copy()
    )

    historicos_validos = (
        recentes.loc[
            ~mask_ja_atual
        ]
        .copy()
    )

    if historicos_validos[
        "CODPESSOA"
    ].eq("").any():
        raise RuntimeError(
            "Historico recente sem CODPESSOA."
        )

    nomes_por_pessoa = (
        historicos_validos
        .groupby(
            "CODPESSOA"
        )[
            "nome_normalizado"
        ]
        .nunique()
    )

    conflitos_identidade = (
        nomes_por_pessoa[
            nomes_por_pessoa > 1
        ]
    )

    if not conflitos_identidade.empty:
        raise RuntimeError(
            "Mesmo CODPESSOA associado a "
            "mais de um nome no historico."
        )

    # -----------------------------------------------------
    # CANONIZACAO DOS HISTORICOS
    #
    # 1. demissao mais recente
    # 2. menor CODCOLIGADA
    # 3. menor CHAPA
    # -----------------------------------------------------

    historicos_validos[
        "_ord_coligada"
    ] = pd.to_numeric(
        historicos_validos[
            "CODCOLIGADA"
        ],
        errors="coerce",
    )

    historicos_validos[
        "_ord_chapa"
    ] = pd.to_numeric(
        historicos_validos[
            "CHAPA"
        ],
        errors="coerce",
    )

    historicos_validos[
        "_ord_coligada"
    ] = historicos_validos[
        "_ord_coligada"
    ].fillna(
        10**9
    )

    historicos_validos[
        "_ord_chapa"
    ] = historicos_validos[
        "_ord_chapa"
    ].fillna(
        10**9
    )

    canonicos = (
        historicos_validos
        .sort_values(
            [
                "CODPESSOA",
                "DATADEMISSAO",
                "_ord_coligada",
                "_ord_chapa",
            ],
            ascending=[
                True,
                False,
                True,
                True,
            ],
        )
        .drop_duplicates(
            subset=[
                "CODPESSOA",
            ],
            keep="first",
        )
        .copy()
    )

    # -----------------------------------------------------
    # DIMENSAO GLOBAL CODSECAO -> SECAO
    # -----------------------------------------------------

    dim_secao = (
        df_atual[
            [
                "CODSECAO",
                "SECAO",
            ]
        ]
        .drop_duplicates()
    )

    quantidade_descricoes = (
        dim_secao
        .groupby(
            "CODSECAO"
        )[
            "SECAO"
        ]
        .nunique()
    )

    conflitos_secao = (
        quantidade_descricoes[
            quantidade_descricoes > 1
        ]
    )

    if not conflitos_secao.empty:
        raise RuntimeError(
            "CODSECAO possui mais de uma "
            "descricao na Gestao."
        )

    dim_secao = (
        dim_secao
        .drop_duplicates(
            subset=[
                "CODSECAO",
            ]
        )
    )

    canonicos = canonicos.merge(
        dim_secao,
        how="left",
        on="CODSECAO",
        validate="many_to_one",
    )

    canonicos["SECAO"] = (
        canonicos["SECAO"]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    # -----------------------------------------------------
    # TRANSFORMA HISTORICOS PARA O CONTRATO DO MAPA
    # -----------------------------------------------------

    historico_mapa = pd.DataFrame(
        {
            "CODCOLIGADA":
                canonicos[
                    "CODCOLIGADA"
                ],
            "CODFILIAL":
                "",
            "FILIAL":
                "",
            "CHAPA":
                canonicos[
                    "CHAPA"
                ],
            "COLABORADOR":
                canonicos[
                    "NOME"
                ],
            "CODFUNCAO":
                "",
            "FUNCAO":
                "",
            "CODSITUACAO":
                canonicos[
                    "CODSITUACAO"
                ],
            "CODSECAO":
                canonicos[
                    "CODSECAO"
                ],
            "SECAO":
                canonicos[
                    "SECAO"
                ],
            "nome_normalizado":
                canonicos[
                    "nome_normalizado"
                ],
            "cod_colaborador_rm":
                (
                    canonicos[
                        "CHAPA"
                    ]
                    + "-"
                    + canonicos[
                        "CODCOLIGADA"
                    ]
                ),
            "CODPESSOA":
                canonicos[
                    "CODPESSOA"
                ],
            "DATAADMISSAO":
                canonicos[
                    "DATAADMISSAO"
                ],
            "DATADEMISSAO":
                canonicos[
                    "DATADEMISSAO"
                ],
            "data_limite_elegibilidade":
                canonicos[
                    "data_limite_elegibilidade"
                ],
            "origem_registro":
                "FOLHA_DEMITIDO_ATE_1_ANO",
            "origem_secao_rm":
                canonicos[
                    "SECAO"
                ]
                .ne("")
                .map(
                    {
                        True:
                            "CODSECAO_GLOBAL",
                        False:
                            "NAO_RESOLVIDA",
                    }
                ),
            "elegivel_planos_acao":
                1,
        }
    )

    historico_mapa[
        "chave_vinculo"
    ] = (
        historico_mapa[
            "CODCOLIGADA"
        ]
        + "|"
        + historico_mapa[
            "CHAPA"
        ]
    )

    consolidado = pd.concat(
        [
            df_atual,
            historico_mapa,
        ],
        ignore_index=True,
        sort=False,
    )

    for coluna in [
        "DATAADMISSAO",
        "DATADEMISSAO",
        "data_limite_elegibilidade",
    ]:

        consolidado[coluna] = (
            pd.to_datetime(
                consolidado[coluna],
                errors="coerce",
            )
            .dt.strftime(
                "%Y-%m-%d"
            )
            .fillna("")
        )

    consolidado = consolidado.drop(
        columns=[
            "chave_vinculo",
        ],
        errors="ignore",
    )

    if consolidado[
        "cod_colaborador_rm"
    ].duplicated().any():
        raise RuntimeError(
            "Mapa consolidado possui "
            "cod_colaborador_rm duplicado."
        )

    sem_secao_historico = (
        historico_mapa[
            "SECAO"
        ]
        .eq("")
    )

    print()
    print("=" * 90)
    print("CONSOLIDACAO DAS FONTES RM")
    print("=" * 90)

    print(
        "Gestao atual:",
        len(df_atual),
    )

    print(
        "Historicos dentro de 1 ano:",
        len(recentes),
    )

    print(
        "Linhas removidas por pessoa ja atual:",
        len(recentes_recontratados),
    )

    print(
        "Historicos canonicos adicionados:",
        len(historico_mapa),
    )

    print(
        "Historicos sem SECAO resolvida:",
        int(
            sem_secao_historico.sum()
        ),
    )

    print(
        "Registros consolidados:",
        len(consolidado),
    )

    if sem_secao_historico.any():

        print()
        print(
            "ATENCAO - historico sem "
            "descricao de SECAO:"
        )

        print(
            historico_mapa.loc[
                sem_secao_historico,
                [
                    "CODPESSOA",
                    "CODCOLIGADA",
                    "CHAPA",
                    "COLABORADOR",
                    "CODSECAO",
                ],
            ].to_string(
                index=False
            )
        )

    return consolidado


def carregar_situacoes():
    if not ARQUIVO_SITUACOES.exists():
        raise FileNotFoundError(
            "Mapa de situacoes RM nao encontrado: "
            f"{ARQUIVO_SITUACOES}"
        )

    situacoes = pd.read_csv(
        ARQUIVO_SITUACOES,
        sep=";",
        dtype=str,
        encoding="utf-8",
    )

    colunas_esperadas = [
        "cod_situacao",
        "descricao_situacao",
        "origem",
    ]

    ausentes = [
        coluna
        for coluna in colunas_esperadas
        if coluna not in situacoes.columns
    ]

    if ausentes:
        raise RuntimeError(
            "Colunas ausentes em situacoes_rm.csv: "
            + ", ".join(ausentes)
        )

    for coluna in situacoes.columns:
        situacoes[coluna] = (
            situacoes[coluna]
            .fillna("")
            .astype(str)
            .str.strip()
        )

    if situacoes["cod_situacao"].duplicated().any():
        raise RuntimeError(
            "situacoes_rm.csv possui "
            "cod_situacao duplicado."
        )

    return situacoes


def selecionar_registro_canonico(grupo):
    quantidade = len(grupo)

    if quantidade == 1:
        escolhido = grupo.iloc[0].copy()

        escolhido["regra_canonizacao"] = (
            "REGISTRO_UNICO"
        )

        escolhido["forcar_agrupamento_crb"] = False
        escolhido["classificacao_mapa"] = ""

        return escolhido

    grupo_crb = grupo[
        grupo["CODCOLIGADA"]
        == CODCOLIGADA_CRB
    ]

    if len(grupo_crb) == 1:
        escolhido = grupo_crb.iloc[0].copy()

        escolhido["regra_canonizacao"] = (
            "CRB_PREVALECE"
        )

        escolhido["forcar_agrupamento_crb"] = False
        escolhido["classificacao_mapa"] = ""

        return escolhido

    if len(grupo_crb) > 1:
        raise RuntimeError(
            "Nome duplicado possui mais de um "
            "registro dentro da CRB: "
            f"{grupo.iloc[0]['nome_normalizado']}"
        )

    grupo = grupo.copy()

    grupo["_codcoligada_num"] = pd.to_numeric(
        grupo["CODCOLIGADA"],
        errors="raise",
    )

    menor_coligada = (
        grupo["_codcoligada_num"]
        .min()
    )

    candidatos = grupo[
        grupo["_codcoligada_num"]
        == menor_coligada
    ]

    if len(candidatos) != 1:
        print()
        print("=" * 90)
        print("AMBIGUIDADE NA MENOR COLIGADA")
        print("=" * 90)

        print(
            candidatos[
                [
                    "cod_colaborador_rm",
                    "CODCOLIGADA",
                    "CODFILIAL",
                    "FILIAL",
                    "CHAPA",
                    "COLABORADOR",
                    "FUNCAO",
                ]
            ].to_string(
                index=False
            )
        )

        raise RuntimeError(
            "Existe mais de um registro do mesmo "
            "nome na menor CODCOLIGADA."
        )

    escolhido = candidatos.iloc[0].copy()

    escolhido["regra_canonizacao"] = (
        "MENOR_COLIGADA_AGRUPADO_CRB"
    )

    escolhido["forcar_agrupamento_crb"] = True
    escolhido["classificacao_mapa"] = "Diretor"

    return escolhido


def selecionar_registros_canonicos(df):
    selecionados = []
    auditoria = []

    for nome, grupo in df.groupby(
        "nome_normalizado",
        sort=True,
    ):
        escolhido = selecionar_registro_canonico(
            grupo
        )

        selecionados.append(
            escolhido
        )

        if len(grupo) > 1:
            auditoria.append(
                {
                    "nome_normalizado":
                        nome,
                    "quantidade_registros_rm":
                        len(grupo),
                    "cod_colaborador_escolhido":
                        escolhido[
                            "cod_colaborador_rm"
                        ],
                    "cod_coligada_escolhida":
                        escolhido[
                            "CODCOLIGADA"
                        ],
                    "regra":
                        escolhido[
                            "regra_canonizacao"
                        ],
                }
            )

    mapa = pd.DataFrame(
        selecionados
    ).reset_index(
        drop=True
    )

    auditoria = pd.DataFrame(
        auditoria
    )

    return mapa, auditoria


def enriquecer_situacoes(
    mapa,
    situacoes,
):
    situacoes = situacoes.rename(
        columns={
            "cod_situacao":
                "CODSITUACAO",
            "origem":
                "origem_situacao",
        }
    )

    mapa = mapa.merge(
        situacoes[
            [
                "CODSITUACAO",
                "descricao_situacao",
                "origem_situacao",
            ]
        ],
        how="left",
        on="CODSITUACAO",
        validate="many_to_one",
    )

    sem_descricao = mapa[
        mapa["descricao_situacao"]
        .isna()
    ]

    if not sem_descricao.empty:
        codigos = sorted(
            sem_descricao[
                "CODSITUACAO"
            ]
            .dropna()
            .unique()
            .tolist()
        )

        raise RuntimeError(
            "CODSITUACAO sem correspondencia "
            "em situacoes_rm.csv: "
            + ", ".join(codigos)
        )

    return mapa


def montar_mapa_final(mapa):
    mapa = mapa.copy()

    mapa["nome_exibicao"] = (
        mapa["COLABORADOR"]
        .apply(criar_nome_exibicao)
    )

    mapa["cod_coligada_rm"] = (
        mapa["CODCOLIGADA"]
    )

    mapa["cod_filial_rm"] = (
        mapa["CODFILIAL"]
    )

    mapa["filial_rm"] = (
        mapa["FILIAL"]
    )

    mapa["funcao_rm"] = (
        mapa["FUNCAO"]
    )

    mapa["secao_rm"] = (
        mapa["SECAO"]
    )

    mapa["cod_coligada_agrupamento"] = (
        mapa["CODCOLIGADA"]
    )

    mapa["cod_filial_agrupamento"] = (
        mapa["CODFILIAL"]
    )

    mapa["filial_agrupamento"] = (
        mapa["FILIAL"]
    )

    mascara_crb_forcada = (
        mapa["forcar_agrupamento_crb"]
        .astype(bool)
    )

    mapa.loc[
        mascara_crb_forcada,
        "cod_coligada_agrupamento",
    ] = CODCOLIGADA_CRB

    mapa.loc[
        mascara_crb_forcada,
        "cod_filial_agrupamento",
    ] = "1"

    mapa.loc[
        mascara_crb_forcada,
        "filial_agrupamento",
    ] = FILIAL_AGRUPAMENTO_CRB

    mapa["contabiliza_funcionario"] = (
        mapa["CODFUNCAO"]
        .ne(
            CODFUNCAO_CONSELHEIRO
        )
        .astype(int)
    )

    final = mapa[
        [
            "cod_colaborador_rm",
            "nome_normalizado",
            "COLABORADOR",
            "nome_exibicao",

            "CHAPA",
            "CODPESSOA",
            "DATAADMISSAO",
            "DATADEMISSAO",
            "data_limite_elegibilidade",
            "origem_registro",
            "origem_secao_rm",
            "elegivel_planos_acao",

            "cod_coligada_rm",
            "cod_filial_rm",
            "filial_rm",

            "CODFUNCAO",
            "funcao_rm",

            "CODSECAO",
            "secao_rm",

            "CODSITUACAO",
            "descricao_situacao",
            "origem_situacao",

            "cod_coligada_agrupamento",
            "cod_filial_agrupamento",
            "filial_agrupamento",

            "classificacao_mapa",
            "contabiliza_funcionario",
            "regra_canonizacao",
        ]
    ].copy()

    final = final.rename(
        columns={
            "cod_colaborador_rm":
                "cod_colaborador",
            "COLABORADOR":
                "nome_completo_rm",
            "CHAPA":
                "chapa",
            "CODPESSOA":
                "cod_pessoa_rm",
            "DATAADMISSAO":
                "data_admissao",
            "DATADEMISSAO":
                "data_demissao",
            "CODFUNCAO":
                "cod_funcao",
            "CODSECAO":
                "cod_secao",
            "CODSITUACAO":
                "cod_situacao",
        }
    )

    final = final.sort_values(
        [
            "nome_normalizado",
            "cod_colaborador",
        ]
    ).reset_index(
        drop=True
    )

    return final


def validar_mapa(
    mapa,
    df_rm,
):
    if mapa["cod_colaborador"].duplicated().any():
        raise RuntimeError(
            "Mapa possui cod_colaborador duplicado."
        )

    if mapa["nome_normalizado"].duplicated().any():
        duplicados = mapa[
            mapa["nome_normalizado"]
            .duplicated(
                keep=False
            )
        ]

        print(
            duplicados.to_string(
                index=False
            )
        )

        raise RuntimeError(
            "Mapa possui nomes normalizados "
            "duplicados."
        )

    if mapa["nome_completo_rm"].eq("").any():
        raise RuntimeError(
            "Mapa possui nome vazio."
        )

    nomes_unicos_rm = (
        df_rm["nome_normalizado"]
        .nunique()
    )

    if len(mapa) != nomes_unicos_rm:
        raise RuntimeError(
            "Quantidade de linhas do mapa "
            "nao corresponde a quantidade de "
            "pessoas por nome normalizado. "
            f"Mapa={len(mapa)} / "
            f"Nomes RM={nomes_unicos_rm}"
        )

    conselheiros = mapa[
        mapa["cod_funcao"]
        == CODFUNCAO_CONSELHEIRO
    ]

    if not (
        conselheiros[
            "contabiliza_funcionario"
        ]
        == 0
    ).all():
        raise RuntimeError(
            "Existe CONSELHEIRO sendo "
            "contabilizado como funcionario."
        )

    nao_conselheiros = mapa[
        mapa["cod_funcao"]
        != CODFUNCAO_CONSELHEIRO
    ]

    if not (
        nao_conselheiros[
            "contabiliza_funcionario"
        ]
        == 1
    ).all():
        raise RuntimeError(
            "Existe nao-conselheiro marcado "
            "como fora do headcount."
        )


def main():
    print("=" * 90)
    print("GERACAO DO MAPA DE COLABORADORES")
    print("=" * 90)

    df = carregar_rm_consolidado()

    print(
        f"Registros recebidos do RM: "
        f"{len(df)}"
    )

    print(
        f"Nomes unicos no RM: "
        f"{df['nome_normalizado'].nunique()}"
    )

    situacoes = carregar_situacoes()

    mapa, auditoria = (
        selecionar_registros_canonicos(
            df
        )
    )

    mapa = enriquecer_situacoes(
        mapa,
        situacoes,
    )

    mapa = montar_mapa_final(
        mapa
    )

    validar_mapa(
        mapa,
        df,
    )

    print()
    print("=" * 90)
    print("DUPLICIDADES RESOLVIDAS")
    print("=" * 90)

    if auditoria.empty:
        print(
            "Nenhuma duplicidade encontrada."
        )
    else:
        print(
            auditoria.to_string(
                index=False
            )
        )

    print()
    print("=" * 90)
    print("RESUMO DO MAPA")
    print("=" * 90)

    print(
        f"Colaboradores unicos: "
        f"{len(mapa)}"
    )

    print(
        "Contabilizados como funcionarios: "
        f"{int(mapa['contabiliza_funcionario'].sum())}"
    )

    print(
        "Nao contabilizados como funcionarios: "
        f"{int((mapa['contabiliza_funcionario'] == 0).sum())}"
    )

    print(
        "Agrupados artificialmente na CRB: "
        f"{int((mapa['regra_canonizacao'] == 'MENOR_COLIGADA_AGRUPADO_CRB').sum())}"
    )

    PASTA_MASTER.mkdir(
        parents=True,
        exist_ok=True,
    )

    mapa.to_csv(
        ARQUIVO_MASTER,
        sep=";",
        index=False,
        encoding="utf-8-sig",
    )

    print()
    print(
        "Mapa gerado:"
    )

    print(
        ARQUIVO_MASTER
    )

    print()
    print("=" * 90)
    print("MAPA DE COLABORADORES CONCLUIDO")
    print("=" * 90)


if __name__ == "__main__":
    main()
