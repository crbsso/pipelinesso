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

    df = carregar_rm()

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
