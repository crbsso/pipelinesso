from pathlib import Path
from datetime import datetime
import json
import os

import pandas as pd


# =========================================================
# CAMINHOS
# =========================================================

RAIZ = Path(__file__).resolve().parents[2]

ARQUIVO_PRATA = (
    RAIZ
    / "data"
    / "prata"
    / "inspecoes"
    / "quantidade"
    / "Inspecoes_Quantidade.xlsx"
)

ARQUIVO_MAPA_COLABORADORES = (
    RAIZ
    / "data"
    / "master"
    / "colaboradores"
    / "mapa_colaboradores.csv"
)

ARQUIVO_IDENTIDADES = (
    RAIZ
    / "backend"
    / "inspecoes"
    / "config"
    / "identidades_colaboradores.json"
)

PASTA_OURO = (
    RAIZ
    / "data"
    / "ouro"
    / "inspecoes"
)

ARQUIVO_OURO = (
    PASTA_OURO
    / "mart_inspecoes.xlsx"
)

ARQUIVO_TEMP = (
    PASTA_OURO
    / "mart_inspecoes_novo.xlsx"
)


# =========================================================
# UTILITARIOS
# =========================================================

def texto(valor):

    if pd.isna(valor):
        return ""

    return str(valor).strip()


# =========================================================
# CARREGA IDENTIDADES
# =========================================================

def carregar_identidades():

    if not ARQUIVO_IDENTIDADES.exists():

        raise FileNotFoundError(
            "Arquivo de identidades nao encontrado: "
            f"{ARQUIVO_IDENTIDADES}"
        )

    with ARQUIVO_IDENTIDADES.open(
        "r",
        encoding="utf-8",
    ) as arquivo:

        configuracao = json.load(
            arquivo
        )

    if configuracao.get("versao") != 1:

        raise RuntimeError(
            "Versao invalida de "
            "identidades_colaboradores.json."
        )

    if (
        str(
            configuracao.get(
                "sistema_origem",
                "",
            )
        )
        .strip()
        .upper()
        != "INSPECOES"
    ):

        raise RuntimeError(
            "sistema_origem invalido "
            "na configuracao de identidades."
        )

    registros = configuracao.get(
        "identidades"
    )

    if not isinstance(
        registros,
        list,
    ):

        raise RuntimeError(
            "Campo identidades deve ser uma lista."
        )

    identidades = {}

    for item in registros:

        codigo = (
            str(
                item.get(
                    "codigo_inspecao",
                    "",
                )
            )
            .strip()
            .upper()
        )

        if not codigo:

            raise RuntimeError(
                "codigo_inspecao vazio "
                "na configuracao."
            )

        if codigo in identidades:

            raise RuntimeError(
                "codigo_inspecao duplicado: "
                f"{codigo}"
            )

        identidades[codigo] = {
            "cod_colaborador":
                str(
                    item.get(
                        "cod_colaborador",
                        "",
                    )
                ).strip(),
            "nome_exibicao":
                str(
                    item.get(
                        "nome_exibicao",
                        "",
                    )
                ).strip(),
            "status_vinculo":
                str(
                    item.get(
                        "status_vinculo",
                        "",
                    )
                ).strip().upper(),
            "metodo_vinculo":
                str(
                    item.get(
                        "metodo_vinculo",
                        "",
                    )
                ).strip().upper(),
        }

    if not identidades:

        raise RuntimeError(
            "Nenhuma identidade encontrada."
        )

    return identidades


# =========================================================
# CARREGA MAPA DE COLABORADORES
# =========================================================

def carregar_mapa():

    if not ARQUIVO_MAPA_COLABORADORES.exists():

        raise FileNotFoundError(
            "Mapa de colaboradores nao encontrado: "
            f"{ARQUIVO_MAPA_COLABORADORES}"
        )

    mapa = pd.read_csv(
        ARQUIVO_MAPA_COLABORADORES,
        sep=";",
        dtype=str,
        encoding="utf-8-sig",
    ).fillna("")

    colunas_necessarias = {
        "cod_colaborador",
        "funcao_rm",
        "secao_rm",
        "filial_agrupamento",
    }

    faltantes = (
        colunas_necessarias
        - set(
            mapa.columns
        )
    )

    if faltantes:

        raise RuntimeError(
            "Mapa sem colunas necessarias: "
            + ", ".join(
                sorted(
                    faltantes
                )
            )
        )

    mapa[
        "cod_colaborador"
    ] = (
        mapa[
            "cod_colaborador"
        ]
        .astype(str)
        .str.strip()
    )

    duplicados = (
        mapa[
            "cod_colaborador"
        ]
        .duplicated(
            keep=False
        )
    )

    if duplicados.any():

        codigos = sorted(
            mapa.loc[
                duplicados,
                "cod_colaborador",
            ]
            .unique()
            .tolist()
        )

        raise RuntimeError(
            "Mapa possui cod_colaborador "
            "duplicado: "
            f"{codigos}"
        )

    return mapa


# =========================================================
# VERIFICA ENTRADAS
# =========================================================

def verificar_entradas():

    arquivos = [
        ARQUIVO_PRATA,
        ARQUIVO_MAPA_COLABORADORES,
        ARQUIVO_IDENTIDADES,
    ]

    ausentes = [
        caminho
        for caminho in arquivos
        if not caminho.exists()
    ]

    if ausentes:

        mensagem = (
            "Camada Ouro bloqueada. "
            "Arquivos ausentes:\n"
        )

        mensagem += "\n".join(
            str(caminho)
            for caminho in ausentes
        )

        raise FileNotFoundError(
            mensagem
        )


# =========================================================
# GERA MART
# =========================================================

def construir_mart(
    prata,
    mapa,
    identidades,
):

    colunas_necessarias = {
        "id_resposta",
        "identificador_criador",
        "cod_colaborador",
        "status_vinculo_colaborador",
    }

    faltantes = (
        colunas_necessarias
        - set(
            prata.columns
        )
    )

    if faltantes:

        raise RuntimeError(
            "Prata sem colunas necessarias: "
            + ", ".join(
                sorted(
                    faltantes
                )
            )
        )

    # -----------------------------------------------------
    # Normalizacao das chaves
    # -----------------------------------------------------

    prata = prata.copy()

    prata[
        "identificador_criador"
    ] = (
        prata[
            "identificador_criador"
        ]
        .apply(texto)
        .str.upper()
    )

    prata[
        "cod_colaborador"
    ] = (
        prata[
            "cod_colaborador"
        ]
        .apply(texto)
    )

    prata[
        "status_vinculo_colaborador"
    ] = (
        prata[
            "status_vinculo_colaborador"
        ]
        .apply(texto)
        .str.upper()
    )

    # -----------------------------------------------------
    # Remove nome completo vindo do sistema de origem
    # -----------------------------------------------------

    if (
        "criador_de_checklist"
        in prata.columns
    ):

        prata = prata.drop(
            columns=[
                "criador_de_checklist"
            ]
        )

    # -----------------------------------------------------
    # Valida Prata contra JSON e prepara nome publico
    # -----------------------------------------------------

    nomes_exibicao = []
    metodos_vinculo = []

    for indice, linha in prata.iterrows():

        identificador = linha[
            "identificador_criador"
        ]

        codigo = linha[
            "cod_colaborador"
        ]

        status = linha[
            "status_vinculo_colaborador"
        ]

        identidade = identidades.get(
            identificador
        )

        if identidade is None:

            raise RuntimeError(
                "Identidade inexistente no JSON: "
                f"{identificador}"
            )

        if (
            codigo
            != identidade[
                "cod_colaborador"
            ]
        ):

            raise RuntimeError(
                "cod_colaborador diverge "
                "entre Prata e JSON: "
                f"{identificador}"
            )

        if (
            status
            != identidade[
                "status_vinculo"
            ]
        ):

            raise RuntimeError(
                "status de vinculo diverge "
                "entre Prata e JSON: "
                f"{identificador}"
            )

        if status == "VINCULADO":

            nome_exibicao = (
                identidade[
                    "nome_exibicao"
                ]
            )

            if not nome_exibicao:

                raise RuntimeError(
                    "Identidade vinculada sem "
                    "nome_exibicao: "
                    f"{identificador}"
                )

        elif status == "NAO_VINCULADO":

            nome_exibicao = (
                "Nao vinculado"
            )

        else:

            raise RuntimeError(
                "Status de vinculo invalido: "
                f"{status}"
            )

        nomes_exibicao.append(
            nome_exibicao
        )

        metodos_vinculo.append(
            identidade[
                "metodo_vinculo"
            ]
        )

    prata[
        "nome_exibicao"
    ] = nomes_exibicao

    prata[
        "metodo_vinculo_colaborador"
    ] = metodos_vinculo

    # -----------------------------------------------------
    # Enriquecimento com MAPA_COLABORADORES
    # -----------------------------------------------------

    dimensao = mapa[
        [
            "cod_colaborador",
            "funcao_rm",
            "secao_rm",
            "filial_agrupamento",
        ]
    ].copy()

    dimensao = dimensao.rename(
        columns={
            "funcao_rm":
                "cargo_colaborador",
            "secao_rm":
                "setor_colaborador",
            "filial_agrupamento":
                "empresa_colaborador",
        }
    )

    mart = prata.merge(
        dimensao,
        how="left",
        on="cod_colaborador",
        validate="many_to_one",
    )

    # -----------------------------------------------------
    # Quality Gate do enriquecimento
    # -----------------------------------------------------

    vinculados = (
        mart[
            "status_vinculo_colaborador"
        ]
        .eq(
            "VINCULADO"
        )
    )

    nao_vinculados = (
        mart[
            "status_vinculo_colaborador"
        ]
        .eq(
            "NAO_VINCULADO"
        )
    )

    for coluna in [
        "cargo_colaborador",
        "setor_colaborador",
        "empresa_colaborador",
    ]:

        ausentes_vinculados = (
            mart.loc[
                vinculados,
                coluna,
            ]
            .apply(texto)
            .eq("")
        )

        if ausentes_vinculados.any():

            codigos = (
                mart.loc[
                    vinculados,
                    [
                        "cod_colaborador",
                        coluna,
                    ],
                ]
                .loc[
                    ausentes_vinculados
                ][
                    "cod_colaborador"
                ]
                .drop_duplicates()
                .tolist()
            )

            raise RuntimeError(
                "Colaboradores vinculados sem "
                f"{coluna}: "
                f"{codigos}"
            )

    # Para nao vinculados, os atributos corporativos
    # devem permanecer vazios.
    for coluna in [
        "cargo_colaborador",
        "setor_colaborador",
        "empresa_colaborador",
    ]:

        mart.loc[
            nao_vinculados,
            coluna,
        ] = ""

    mart[
        "data_atualizacao"
    ] = datetime.now()

    return mart


# =========================================================
# INDICADORES
# =========================================================

def gerar_indicadores(
    mart,
):

    vinculadas = (
        mart[
            "status_vinculo_colaborador"
        ]
        .eq(
            "VINCULADO"
        )
    )

    nao_vinculadas = (
        mart[
            "status_vinculo_colaborador"
        ]
        .eq(
            "NAO_VINCULADO"
        )
    )

    return pd.DataFrame(
        [
            {
                "indicador":
                    "total_inspecoes",
                "valor":
                    len(mart),
            },
            {
                "indicador":
                    "inspecoes_vinculadas",
                "valor":
                    int(
                        vinculadas.sum()
                    ),
            },
            {
                "indicador":
                    "inspecoes_nao_vinculadas",
                "valor":
                    int(
                        nao_vinculadas.sum()
                    ),
            },
            {
                "indicador":
                    "criadores_distintos",
                "valor":
                    mart[
                        "identificador_criador"
                    ].nunique(),
            },
            {
                "indicador":
                    "colaboradores_vinculados_distintos",
                "valor":
                    mart.loc[
                        vinculadas,
                        "cod_colaborador",
                    ].nunique(),
            },
        ]
    )


# =========================================================
# PARAMETROS
# =========================================================

def gerar_parametros():

    return pd.DataFrame(
        [
            {
                "parametro":
                    "fonte_nome_exibicao",
                "valor":
                    "identidades_colaboradores.json",
                "descricao":
                    "Nome controlado para exibicao "
                    "no dashboard.",
            },
            {
                "parametro":
                    "fonte_cargo_setor_empresa",
                "valor":
                    "MAPA_COLABORADORES",
                "descricao":
                    "Cargo, setor e empresa sao "
                    "obtidos pela chave "
                    "cod_colaborador.",
            },
            {
                "parametro":
                    "politica_nao_vinculado",
                "valor":
                    "Nao vinculado",
                "descricao":
                    "Nao expoe o nome completo "
                    "recebido do sistema de origem.",
            },
            {
                "parametro":
                    "data_processamento",
                "valor":
                    datetime.now().strftime(
                        "%d/%m/%Y %H:%M:%S"
                    ),
                "descricao":
                    "Data e hora da geracao "
                    "da camada Ouro.",
            },
        ]
    )


# =========================================================
# SALVA TEMPORARIO
# =========================================================

def escrever_temporario(
    mart,
    indicadores,
    parametros,
):

    PASTA_OURO.mkdir(
        parents=True,
        exist_ok=True,
    )

    if ARQUIVO_TEMP.exists():

        ARQUIVO_TEMP.unlink()

    with pd.ExcelWriter(
        ARQUIVO_TEMP,
        engine="openpyxl",
        datetime_format=(
            "DD/MM/YYYY HH:MM:SS"
        ),
    ) as writer:

        mart.to_excel(
            writer,
            sheet_name="mart_inspecoes",
            index=False,
        )

        indicadores.to_excel(
            writer,
            sheet_name="indicadores",
            index=False,
        )

        parametros.to_excel(
            writer,
            sheet_name="parametros",
            index=False,
        )


# =========================================================
# QUALITY GATE DO ARQUIVO TEMPORARIO
# =========================================================

def validar_temporario(
    quantidade_esperada,
):

    if not ARQUIVO_TEMP.exists():

        raise RuntimeError(
            "Arquivo temporario da Ouro "
            "nao foi gerado."
        )

    mart = pd.read_excel(
        ARQUIVO_TEMP,
        sheet_name="mart_inspecoes",
    )

    if len(mart) != quantidade_esperada:

        raise RuntimeError(
            "Quantidade da Ouro diverge "
            "da Prata. "
            f"Esperado: {quantidade_esperada}. "
            f"Encontrado: {len(mart)}."
        )

    colunas_obrigatorias = {
        "id_resposta",
        "identificador_criador",
        "cod_colaborador",
        "status_vinculo_colaborador",
        "nome_exibicao",
        "metodo_vinculo_colaborador",
        "cargo_colaborador",
        "setor_colaborador",
        "empresa_colaborador",
        "data_atualizacao",
    }

    faltantes = (
        colunas_obrigatorias
        - set(
            mart.columns
        )
    )

    if faltantes:

        raise RuntimeError(
            "Ouro sem colunas obrigatorias: "
            + ", ".join(
                sorted(
                    faltantes
                )
            )
        )

    if (
        "criador_de_checklist"
        in mart.columns
    ):

        raise RuntimeError(
            "A Ouro contem "
            "criador_de_checklist. "
            "O nome completo de origem "
            "nao deve ser publicado."
        )

    ids = (
        mart[
            "id_resposta"
        ]
        .astype(str)
        .str.strip()
    )

    if ids.duplicated().any():

        raise RuntimeError(
            "A Ouro possui "
            "id_resposta duplicado."
        )

    status = (
        mart[
            "status_vinculo_colaborador"
        ]
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
    )

    invalidos = (
        ~status.isin(
            [
                "VINCULADO",
                "NAO_VINCULADO",
            ]
        )
    )

    if invalidos.any():

        raise RuntimeError(
            "A Ouro possui status de "
            "vinculo invalido."
        )

    vinculados = status.eq(
        "VINCULADO"
    )

    nao_vinculados = status.eq(
        "NAO_VINCULADO"
    )

    codigo = (
        mart[
            "cod_colaborador"
        ]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    if (
        vinculados
        & codigo.eq("")
    ).any():

        raise RuntimeError(
            "Ouro possui registro VINCULADO "
            "sem cod_colaborador."
        )

    if (
        nao_vinculados
        & codigo.ne("")
    ).any():

        raise RuntimeError(
            "Ouro possui registro "
            "NAO_VINCULADO com "
            "cod_colaborador."
        )

    for coluna in [
        "nome_exibicao",
        "cargo_colaborador",
        "setor_colaborador",
        "empresa_colaborador",
    ]:

        valores = (
            mart[
                coluna
            ]
            .fillna("")
            .astype(str)
            .str.strip()
        )

        if coluna == "nome_exibicao":

            if (
                vinculados
                & valores.eq("")
            ).any():

                raise RuntimeError(
                    "Colaborador vinculado sem "
                    "nome_exibicao."
                )

        else:

            if (
                vinculados
                & valores.eq("")
            ).any():

                raise RuntimeError(
                    "Colaborador vinculado sem "
                    f"{coluna}."
                )

    print(
        "Quality Gate da Ouro: APROVADO"
    )

    print(
        "Inspecoes vinculadas: "
        f"{int(vinculados.sum())}"
    )

    print(
        "Inspecoes nao vinculadas: "
        f"{int(nao_vinculados.sum())}"
    )


# =========================================================
# EXECUCAO
# =========================================================

def gerar_ouro_inspecoes():

    print("=" * 70)
    print("GERACAO OURO - INSPECOES")
    print("=" * 70)
    print()

    verificar_entradas()

    prata = pd.read_excel(
        ARQUIVO_PRATA,
    )

    print(
        "Registros recebidos da Prata: "
        f"{len(prata)}"
    )

    mapa = carregar_mapa()

    print(
        "Colaboradores no mapa: "
        f"{len(mapa)}"
    )

    identidades = (
        carregar_identidades()
    )

    print(
        "Identidades de Inspecoes: "
        f"{len(identidades)}"
    )

    mart = construir_mart(
        prata,
        mapa,
        identidades,
    )

    indicadores = gerar_indicadores(
        mart
    )

    parametros = gerar_parametros()

    try:

        escrever_temporario(
            mart,
            indicadores,
            parametros,
        )

        validar_temporario(
            len(prata)
        )

        os.replace(
            ARQUIVO_TEMP,
            ARQUIVO_OURO,
        )

    except Exception:

        if ARQUIVO_TEMP.exists():

            ARQUIVO_TEMP.unlink()

        raise

    print()
    print("=" * 70)
    print(
        "CAMADA OURO DE INSPECOES "
        "ATUALIZADA COM SUCESSO"
    )
    print("=" * 70)

    print(
        "Arquivo: "
        f"{ARQUIVO_OURO}"
    )

    print(
        "Inspecoes: "
        f"{len(mart)}"
    )


if __name__ == "__main__":

    gerar_ouro_inspecoes()
