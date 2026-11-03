from pathlib import Path
from datetime import datetime
import os
try:
    from backend.inspecoes.identidades_supabase import (
        carregar_identidades_supabase,
    )
except ModuleNotFoundError:
    from identidades_supabase import (
        carregar_identidades_supabase,
    )

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

    identidades, _, _ = (
        carregar_identidades_supabase()
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

def resolver_vinculo_historico(mart, mapa):
    # Preserva autoria historica; atributos organizacionais sao atuais.
    antigo, atual = "001112-10", "000072-16"
    alvo = mart["cod_colaborador"].eq(antigo)
    if not alvo.any():
        return mart

    esperadas = {
        4263: "2026-09-04", 4262: "2026-09-04",
        2509: "2026-06-23", 2507: "2026-06-23",
    }
    recebidas = {
        int(l["id_resposta"]): pd.to_datetime(
            l["data_inspecao_normalizada"], errors="raise"
        ).strftime("%Y-%m-%d")
        for _, l in mart.loc[alvo].iterrows()
    }

    if (int(alvo.sum()) != 4 or recebidas != esperadas
            or not mart.loc[
                alvo, "status_vinculo_colaborador"
            ].eq("VINCULADO").all()):
        raise RuntimeError("Escopo do vinculo historico mudou.")

    pasta = RAIZ / "data/bronze/cadastros/colaboradores"
    folha = pd.read_excel(
        pasta / "Colaboradores_Folha_RM.xlsx",
        dtype=str, keep_default_na=False,
    )
    gestao = pd.read_excel(
        pasta / "Colaboradores_RM.xlsx",
        dtype=str, keep_default_na=False,
    )

    def chaves(df):
        def normaliza(coluna):
            return (
                df[coluna].astype(str).str.strip()
                .str.lstrip("0").replace("", "0")
            )
        return normaliza("CHAPA") + "-" + normaliza("CODCOLIGADA")

    historico = folha.loc[chaves(folha).eq("1112-10")]
    gestao_atual = gestao.loc[chaves(gestao).eq("72-16")]
    mapa_atual = mapa.loc[mapa["cod_colaborador"].eq(atual)]

    if (len(historico) != 1 or len(gestao_atual) != 1
            or len(mapa_atual) != 1
            or mapa["cod_colaborador"].eq(antigo).any()):
        raise RuntimeError("Vinculos RM ou mapa divergentes.")

    registro = historico.iloc[0]
    pessoa = texto(registro["CODPESSOA"])
    mesma_pessoa = folha.loc[
        folha["CODPESSOA"].astype(str).str.strip().eq(pessoa)
    ]
    candidatos = set(chaves(mesma_pessoa)) & set(chaves(gestao))

    if (not pessoa or candidatos != {"72-16"}
            or texto(registro["CODSITUACAO"]).upper() != "D"):
        raise RuntimeError("Identidade historica nao confirmada.")

    admissao = pd.to_datetime(registro["DATAADMISSAO"], errors="coerce")
    demissao = pd.to_datetime(registro["DATADEMISSAO"], errors="coerce")

    if (pd.isna(admissao) or pd.isna(demissao)
            or demissao.strftime("%Y-%m-%d") != "2026-10-01"
            or any(
                not admissao <= pd.Timestamp(data) <= demissao
                for data in esperadas.values()
            )):
        raise RuntimeError("Periodo historico inconsistente.")

    dados_rm = gestao_atual.iloc[0]
    dados_mapa = mapa_atual.iloc[0]

    if (texto(dados_rm["FUNCAO"]) != texto(dados_mapa["funcao_rm"])
            or texto(dados_rm["SECAO"]) != texto(dados_mapa["secao_rm"])):
        raise RuntimeError("Cargo ou setor diverge entre RM e mapa.")

    campos = {
        "nome_exibicao": "nome_exibicao",
        "cargo_colaborador": "funcao_rm",
        "setor_colaborador": "secao_rm",
        "empresa_colaborador": "filial_agrupamento",
    }

    for destino, origem in campos.items():
        valor = texto(dados_mapa[origem])
        if not valor or mart.loc[alvo, destino].apply(texto).ne("").any():
            raise RuntimeError("Atributo invalido: " + destino)
        mart.loc[alvo, destino] = valor

    print("Vinculo historico validado: 4 inspecoes.")
    print("Codigo historico preservado: 001112-10.")
    print("Atributos atuais provenientes de: 000072-16.")
    return mart


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

    mart = resolver_vinculo_historico(mart, mapa)

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
    if mart_enriquecida["cod_colaborador"].eq("001112-10").any():
        parametros.loc[len(parametros)] = {
            "parametro": "vinculo_historico_001112-10",
            "valor": "4 inspecoes; atributos atuais do vinculo 000072-16",
            "descricao": (
                "Codigo historico 001112-10 preservado. "
                "Nome, cargo, setor e empresa obtidos do vinculo "
                "atual da mesma pessoa, confirmado por CODPESSOA. "
                "Atributos de exibicao nao necessariamente historicos."
            ),
        }

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
