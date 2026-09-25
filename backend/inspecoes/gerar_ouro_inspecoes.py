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
            "Configuracao de identidades "
            "nao encontrada: "
            f"{ARQUIVO_IDENTIDADES}"
        )

    with ARQUIVO_IDENTIDADES.open(
        "r",
        encoding="utf-8",
    ) as arquivo:

        configuracao = json.load(
            arquivo
        )

    if configuracao.get(
        "versao"
    ) != 1:

        raise RuntimeError(
            "Versao invalida de "
            "identidades_colaboradores.json."
        )

    sistema_origem = str(
        configuracao.get(
            "sistema_origem",
            "",
        )
    ).strip().upper()

    if sistema_origem != "INSPECOES":

        raise RuntimeError(
            "sistema_origem invalido: "
            f"{sistema_origem}"
        )

    registros = configuracao.get(
        "identidades"
    )

    if not isinstance(
        registros,
        list,
    ):

        raise RuntimeError(
            "Campo identidades deve ser "
            "uma lista."
        )

    obrigatorias = {
        "codigo_inspecao",
        "cod_colaborador",
        "status_vinculo",
        "metodo_vinculo",
    }

    identidades = {}

    for item in registros:

        if not isinstance(
            item,
            dict,
        ):

            raise RuntimeError(
                "Identidade invalida."
            )

        faltantes = (
            obrigatorias
            - set(item)
        )

        if faltantes:

            raise RuntimeError(
                "Identidade sem campos "
                "obrigatorios: "
                + ", ".join(
                    sorted(faltantes)
                )
            )

        codigo = str(
            item.get(
                "codigo_inspecao",
                "",
            )
        ).strip().upper()

        cod_colaborador = str(
            item.get(
                "cod_colaborador",
                "",
            )
        ).strip()

        status = str(
            item.get(
                "status_vinculo",
                "",
            )
        ).strip().upper()

        metodo = str(
            item.get(
                "metodo_vinculo",
                "",
            )
        ).strip().upper()

        if not codigo:

            raise RuntimeError(
                "codigo_inspecao vazio."
            )

        if codigo in identidades:

            raise RuntimeError(
                "codigo_inspecao duplicado: "
                f"{codigo}"
            )

        if status == "VINCULADO":

            if not cod_colaborador:

                raise RuntimeError(
                    "VINCULADO sem "
                    "cod_colaborador: "
                    f"{codigo}"
                )

            if metodo not in {
                "EXATO",
                "SIMILARIDADE_VALIDADA",
            }:

                raise RuntimeError(
                    "Metodo invalido para "
                    "VINCULADO: "
                    f"{codigo} -> {metodo}"
                )

        elif status == "NAO_VINCULADO":

            if cod_colaborador:

                raise RuntimeError(
                    "NAO_VINCULADO com "
                    "cod_colaborador: "
                    f"{codigo}"
                )

            if metodo != "NAO_VINCULADO":

                raise RuntimeError(
                    "Metodo invalido para "
                    "NAO_VINCULADO: "
                    f"{codigo}"
                )

        else:

            raise RuntimeError(
                "status_vinculo invalido: "
                f"{codigo} -> {status}"
            )

        identidades[codigo] = {
            "cod_colaborador":
                cod_colaborador,
            "status_vinculo":
                status,
            "metodo_vinculo":
                metodo,
        }

    if not identidades:

        raise RuntimeError(
            "Nenhuma identidade encontrada."
        )

    return identidades


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
    # Valida Prata contra configuracao de identidades
    # -----------------------------------------------------

    metodos_vinculo = []

    for indice, linha in prata.iterrows():

        identificador = texto(
            linha[
                "identificador_criador"
            ]
        ).upper()

        codigo = texto(
            linha[
                "cod_colaborador"
            ]
        )

        status = texto(
            linha[
                "status_vinculo_colaborador"
            ]
        ).upper()

        identidade = identidades.get(
            identificador
        )

        if identidade is None:

            raise RuntimeError(
                "Identidade inexistente na "
                "configuracao: "
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
                "entre Prata e identidade: "
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
                "entre Prata e identidade: "
                f"{identificador}"
            )

        metodos_vinculo.append(
            identidade[
                "metodo_vinculo"
            ]
        )

    prata[
        "metodo_vinculo_colaborador"
    ] = metodos_vinculo

    # -----------------------------------------------------
    # Enriquecimento com MAPA_COLABORADORES
    # -----------------------------------------------------

    dimensao = mapa[
        [
            "cod_colaborador",
            "nome_exibicao",
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


# =========================================================
# PREPARA MART DE CONSUMO
# =========================================================

def preparar_mart_consumo(
    mart_enriquecida,
):

    colunas_origem = {
        "id_resposta",
        "nome_formulario",
        "contrato",
        "data_inspecao_normalizada",
        "area_organizacional",
        "local",
        "empresa",
        "estado_do_plano_de_acao",
        "acciones_correctivas_atrasadas",
        "cod_colaborador",
        "status_vinculo_colaborador",
        "nome_exibicao",
        "cargo_colaborador",
        "setor_colaborador",
        "empresa_colaborador",
        "data_atualizacao",
    }

    faltantes = (
        colunas_origem
        - set(
            mart_enriquecida.columns
        )
    )

    if faltantes:
        raise RuntimeError(
            "Base enriquecida sem colunas "
            "necessarias para a Mart: "
            + ", ".join(
                sorted(
                    faltantes
                )
            )
        )

    base = mart_enriquecida.copy()

    mart = pd.DataFrame(
        index=base.index
    )

    mart["id_resposta"] = pd.to_numeric(
        base["id_resposta"],
        errors="raise",
    ).astype("int64")

    mart["nome_formulario"] = (
        base["nome_formulario"]
        .apply(texto)
    )

    contrato = (
        base["contrato"]
        .apply(texto)
    )

    mart["contrato"] = contrato.mask(
        contrato.isin(
            [
                "",
                "-",
            ]
        ),
        pd.NA,
    )

    mart["data_inspecao"] = pd.to_datetime(
        base["data_inspecao_normalizada"],
        errors="raise",
    ).dt.normalize()

    mart["area_organizacional"] = (
        base["area_organizacional"]
        .apply(texto)
    )

    mart["local"] = (
        base["local"]
        .apply(texto)
    )

    empresa_inspecao = (
        base["empresa"]
        .apply(texto)
    )

    mart["empresa_inspecao"] = (
        empresa_inspecao.mask(
            empresa_inspecao.isin(
                [
                    "",
                    "-",
                ]
            ),
            pd.NA,
        )
    )

    mart["estado_plano_acao"] = (
        base["estado_do_plano_de_acao"]
        .apply(texto)
    )

    acoes = (
        base[
            "acciones_correctivas_atrasadas"
        ]
        .apply(texto)
        .replace(
            {
                "": "0",
                "-": "0",
            }
        )
    )

    mart[
        "acoes_corretivas_atrasadas"
    ] = pd.to_numeric(
        acoes,
        errors="raise",
    ).astype("int64")

    codigo_colaborador = (
        base["cod_colaborador"]
        .apply(texto)
    )

    mart["cod_colaborador"] = (
        codigo_colaborador.mask(
            codigo_colaborador.eq(""),
            pd.NA,
        )
    )

    mart[
        "status_vinculo_colaborador"
    ] = (
        base[
            "status_vinculo_colaborador"
        ]
        .apply(texto)
        .str.upper()
    )

    mart["nome_exibicao"] = (
        base["nome_exibicao"]
        .apply(texto)
    )

    for coluna in [
        "cargo_colaborador",
        "setor_colaborador",
        "empresa_colaborador",
    ]:

        valores = (
            base[coluna]
            .apply(texto)
        )

        mart[coluna] = valores.mask(
            valores.eq(""),
            pd.NA,
        )

    mart["data_atualizacao"] = (
        pd.to_datetime(
            base["data_atualizacao"],
            errors="raise",
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

    mart.loc[
        nao_vinculados,
        [
            "cod_colaborador",
            "cargo_colaborador",
            "setor_colaborador",
            "empresa_colaborador",
        ],
    ] = pd.NA

    mart.loc[
        nao_vinculados,
        "nome_exibicao",
    ] = "Nao vinculado"

    return mart.reset_index(
        drop=True
    )


def gerar_parametros():

    return pd.DataFrame(
        [
            {
                "parametro":
                    "fonte_nome_exibicao",
                "valor":
                    "MAPA_COLABORADORES",
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

    colunas_esperadas = [
        "id_resposta",
        "nome_formulario",
        "contrato",
        "data_inspecao",
        "area_organizacional",
        "local",
        "empresa_inspecao",
        "estado_plano_acao",
        "acoes_corretivas_atrasadas",
        "cod_colaborador",
        "status_vinculo_colaborador",
        "nome_exibicao",
        "cargo_colaborador",
        "setor_colaborador",
        "empresa_colaborador",
        "data_atualizacao",
    ]

    if (
        mart.columns.tolist()
        != colunas_esperadas
    ):

        raise RuntimeError(
            "Contrato da Mart diferente "
            "do esperado.\n"
            f"Esperado: {colunas_esperadas}\n"
            f"Recebido: {mart.columns.tolist()}"
        )

    ids = pd.to_numeric(
        mart["id_resposta"],
        errors="coerce",
    )

    if ids.isna().any():

        raise RuntimeError(
            "A Ouro possui "
            "id_resposta invalido."
        )

    if ids.duplicated().any():

        raise RuntimeError(
            "A Ouro possui "
            "id_resposta duplicado."
        )

    if ids.mod(1).ne(0).any():

        raise RuntimeError(
            "A Ouro possui "
            "id_resposta nao inteiro."
        )

    for coluna in [
        "nome_formulario",
        "area_organizacional",
        "local",
        "estado_plano_acao",
        "status_vinculo_colaborador",
        "nome_exibicao",
    ]:

        valores = (
            mart[coluna]
            .fillna("")
            .astype(str)
            .str.strip()
        )

        if valores.eq("").any():

            raise RuntimeError(
                "A Ouro possui valor vazio em "
                f"{coluna}."
            )

    if (
        pd.to_datetime(
            mart["data_inspecao"],
            errors="coerce",
        )
        .isna()
        .any()
    ):

        raise RuntimeError(
            "A Ouro possui "
            "data_inspecao invalida."
        )

    if (
        pd.to_datetime(
            mart["data_atualizacao"],
            errors="coerce",
        )
        .isna()
        .any()
    ):

        raise RuntimeError(
            "A Ouro possui "
            "data_atualizacao invalida."
        )

    acoes = pd.to_numeric(
        mart[
            "acoes_corretivas_atrasadas"
        ],
        errors="coerce",
    )

    if acoes.isna().any():

        raise RuntimeError(
            "A Ouro possui quantidade invalida "
            "de acoes corretivas atrasadas."
        )

    if (
        acoes.lt(0).any()
        or acoes.mod(1).ne(0).any()
    ):

        raise RuntimeError(
            "A Ouro possui quantidade invalida "
            "de acoes corretivas atrasadas."
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

    if (
        ~status.isin(
            [
                "VINCULADO",
                "NAO_VINCULADO",
            ]
        )
    ).any():

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
        vinculados
        & ~codigo.str.fullmatch(
            r"[0-9]+-[0-9]+"
        )
    ).any():

        raise RuntimeError(
            "Ouro possui cod_colaborador "
            "invalido."
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
        "cargo_colaborador",
        "setor_colaborador",
        "empresa_colaborador",
    ]:

        valores = (
            mart[coluna]
            .fillna("")
            .astype(str)
            .str.strip()
        )

        if (
            vinculados
            & valores.eq("")
        ).any():

            raise RuntimeError(
                "Colaborador vinculado sem "
                f"{coluna}."
            )

        if (
            nao_vinculados
            & valores.ne("")
        ).any():

            raise RuntimeError(
                "Registro NAO_VINCULADO possui "
                f"{coluna}."
            )

    nomes = (
        mart[
            "nome_exibicao"
        ]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    if (
        nao_vinculados
        & nomes.ne(
            "Nao vinculado"
        )
    ).any():

        raise RuntimeError(
            "Registro NAO_VINCULADO com "
            "nome_exibicao inesperado."
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

    mart_enriquecida = construir_mart(
        prata,
        mapa,
        identidades,
    )

    indicadores = gerar_indicadores(
        mart_enriquecida
    )

    mart = preparar_mart_consumo(
        mart_enriquecida
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
