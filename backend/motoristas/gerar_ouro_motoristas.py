from pathlib import Path
from datetime import time
import sys

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]

PASTA_PRATA = (
    ROOT
    / "data"
    / "prata"
    / "motoristas"
)

ARQUIVO_CADASTRO = (
    PASTA_PRATA
    / "motoristas.csv"
)

ARQUIVO_VIAGENS = (
    PASTA_PRATA
    / "motorista_veiculo.csv"
)

ARQUIVO_SEGURANCA = (
    PASTA_PRATA
    / "seguranca_motoristas.csv"
)

PASTA_OURO = (
    ROOT
    / "data"
    / "ouro"
    / "motoristas"
)

ARQUIVO_OURO = (
    PASTA_OURO
    / "mart_motoristas.xlsx"
)


ROTULOS = {
    "ATIVO_REGULAR":
        "Ativo regular",

    "PENDENTE_DESATIVACAO_COBLI":
        "Pendente de desativação Cobli",

    "SEM_IDENTIDADE_RM":
        "Sem identidade RM",

    "REVISAR_SITUACAO_RM":
        "Revisar situação RM",
}


CAMPOS_RISCO = [
    "velocidade_via_eventos_qtd",
    "aceleracao_brusca_qtd",
    "frenagem_brusca_qtd",
    "curva_brusca_qtd",
    "direcao_distraida_qtd",
    "uso_celular_qtd",
    "olhos_fechados_qtd",
    "bocejo_qtd",
    "fumo_qtd",
    "distancia_insegura_qtd",
]


COLUNAS_PROIBIDAS_OURO = {
    "nome_completo_rm",
    "nome_cobli",
    "nome_normalizado_cobli",
    "driver_name_cobli",
    "driver_id_cobli",
    "driver_code_cobli",
    "cod_colaborador",
    "vehicle_id_cobli",
    "cobli_id",
    "placa",
}


def falhar(mensagem):

    raise RuntimeError(
        "QUALITY GATE OURO REPROVADO: "
        + mensagem
    )


def ler_csv(
    arquivo,
    descricao,
):

    if not arquivo.exists():
        raise RuntimeError(
            f"{descricao} nao encontrada: "
            f"{arquivo}"
        )

    return pd.read_csv(
        arquivo,
        sep=";",
        dtype=str,
        encoding="utf-8-sig",
    ).fillna("")


def validar_colunas(
    df,
    obrigatorias,
    descricao,
):

    ausentes = (
        set(obrigatorias)
        - set(df.columns)
    )

    if ausentes:
        raise RuntimeError(
            f"{descricao} sem colunas: "
            + ", ".join(
                sorted(ausentes)
            )
        )


def percentual(
    numerador,
    denominador,
):

    if not denominador:
        return 0.0

    return (
        float(numerador)
        /
        float(denominador)
        * 100
    )


def eh_noturno(valor):

    horario = valor.time()

    return (
        horario >= time(
            18,
            30,
        )
        or
        horario < time(
            6,
            0,
        )
    )


def gerar():

    print("=" * 80)
    print("OURO MOTORISTAS - MULTIMART")
    print("=" * 80)

    cadastro = ler_csv(
        ARQUIVO_CADASTRO,
        "Prata de cadastro",
    )

    viagens = ler_csv(
        ARQUIVO_VIAGENS,
        "Prata de viagens",
    )

    seguranca = ler_csv(
        ARQUIVO_SEGURANCA,
        "Prata de seguranca",
    )

    validar_colunas(
        cadastro,
        {
            "driver_id_cobli",
            "nome_exibicao",
            "cobli_active",
            "situacao_motorista",
            "data_demissao",
            "secao_rm",
            "cod_coligada_rm",
            "coligada",
        },
        "Cadastro",
    )

    validar_colunas(
        viagens,
        {
            "evento_id",
            "tipo_evento",
            "driver_id_cobli",
            "vehicle_id_cobli",
            "placa",
            "inicio",
            "fim",
            "distancia_km",
            "duracao_viagem_min",
            "marcha_lenta_min",
            "data_evento",
            "ano_evento",
            "mes_evento",
        },
        "Viagens",
    )

    validar_colunas(
        seguranca,
        {
            "driver_id_cobli",
            "distancia_km",
            "tempo_dirigido_min",
            *CAMPOS_RISCO,
        },
        "Seguranca",
    )

    # ========================================================
    # 1. CADASTRO / GOVERNANCA
    # ========================================================

    cadastro = cadastro.copy()

    for coluna in [
        "driver_id_cobli",
        "nome_exibicao",
        "situacao_motorista",
        "data_demissao",
        "secao_rm",
        "cod_coligada_rm",
        "coligada",
    ]:
        cadastro[coluna] = (
            cadastro[coluna]
            .astype(str)
            .str.strip()
        )

    identificados = (
        cadastro[
            "situacao_motorista"
        ]
        != "SEM_IDENTIDADE_RM"
    )

    if cadastro.loc[
        identificados,
        "nome_exibicao",
    ].eq("").any():

        falhar(
            "colaborador identificado "
            "sem nome_exibicao."
        )

    if cadastro.loc[
        identificados,
        "coligada",
    ].eq("").any():

        falhar(
            "colaborador identificado "
            "sem coligada classificada."
        )

    mart_motoristas = pd.DataFrame()

    mart_motoristas[
        "nome_exibicao"
    ] = cadastro[
        "nome_exibicao"
    ]

    mart_motoristas[
        "coligada"
    ] = cadastro[
        "coligada"
    ]

    mart_motoristas[
        "secao_rm"
    ] = cadastro[
        "secao_rm"
    ]

    mart_motoristas[
        "situacao_motorista"
    ] = cadastro[
        "situacao_motorista"
    ]

    mart_motoristas[
        "situacao_exibicao"
    ] = (
        mart_motoristas[
            "situacao_motorista"
        ]
        .map(ROTULOS)
        .fillna(
            "Situação não classificada"
        )
    )

    mart_motoristas[
        "status_cobli"
    ] = (
        cadastro[
            "cobli_active"
        ]
        .astype(str)
        .str.strip()
        .str.lower()
        .map(
            {
                "true": "ATIVO",
                "false": "INATIVO",
            }
        )
        .fillna("DESCONHECIDO")
    )

    mart_motoristas[
        "status_rm"
    ] = (
        mart_motoristas[
            "situacao_motorista"
        ]
        .map(
            {
                "ATIVO_REGULAR":
                    "ATIVO",

                "PENDENTE_DESATIVACAO_COBLI":
                    "DESLIGADO",

                "SEM_IDENTIDADE_RM":
                    "NAO_IDENTIFICADO",

                "REVISAR_SITUACAO_RM":
                    "REVISAR",
            }
        )
        .fillna("REVISAR")
    )

    mart_motoristas[
        "data_demissao"
    ] = cadastro[
        "data_demissao"
    ]

    data_demissao = pd.to_datetime(
        mart_motoristas[
            "data_demissao"
        ],
        errors="coerce",
    )

    hoje = (
        pd.Timestamp.now()
        .normalize()
    )

    mart_motoristas[
        "dias_desde_demissao"
    ] = (
        hoje
        - data_demissao
    ).dt.days.astype(
        "Int64"
    )

    mask_sem_identidade = (
        mart_motoristas[
            "situacao_motorista"
        ]
        == "SEM_IDENTIDADE_RM"
    )

    mart_motoristas.loc[
        mask_sem_identidade,
        "nome_exibicao",
    ] = "Não identificado"

    mart_motoristas.loc[
        mask_sem_identidade,
        "coligada",
    ] = "SEM_IDENTIDADE_RM"

    mart_motoristas.loc[
        mask_sem_identidade,
        "secao_rm",
    ] = ""

    mart_motoristas.loc[
        mask_sem_identidade,
        "data_demissao",
    ] = ""

    mart_motoristas.loc[
        mask_sem_identidade,
        "dias_desde_demissao",
    ] = pd.NA

    ordem = {
        "PENDENTE_DESATIVACAO_COBLI":
            1,

        "SEM_IDENTIDADE_RM":
            2,

        "REVISAR_SITUACAO_RM":
            3,

        "ATIVO_REGULAR":
            4,
    }

    mart_motoristas[
        "_ordem"
    ] = (
        mart_motoristas[
            "situacao_motorista"
        ]
        .map(ordem)
        .fillna(99)
    )

    mart_motoristas = (
        mart_motoristas
        .sort_values(
            [
                "_ordem",
                "nome_exibicao",
            ]
        )
        .drop(
            columns=[
                "_ordem"
            ]
        )
        .reset_index(
            drop=True
        )
    )

    total_motoristas = len(
        cadastro
    )

    ativos = int(
        (
            cadastro[
                "situacao_motorista"
            ]
            == "ATIVO_REGULAR"
        ).sum()
    )

    pendentes = int(
        (
            cadastro[
                "situacao_motorista"
            ]
            ==
            "PENDENTE_DESATIVACAO_COBLI"
        ).sum()
    )

    sem_identidade = int(
        (
            cadastro[
                "situacao_motorista"
            ]
            == "SEM_IDENTIDADE_RM"
        ).sum()
    )

    revisar = int(
        (
            cadastro[
                "situacao_motorista"
            ]
            == "REVISAR_SITUACAO_RM"
        ).sum()
    )

    cobertura = percentual(
        total_motoristas
        - sem_identidade,
        total_motoristas,
    )

    # ========================================================
    # 2. COLIGADAS
    # ========================================================

    cadastro[
        "coligada_painel"
    ] = cadastro[
        "coligada"
    ]

    cadastro.loc[
        cadastro[
            "situacao_motorista"
        ]
        == "SEM_IDENTIDADE_RM",
        "coligada_painel",
    ] = "SEM_IDENTIDADE_RM"

    cadastro.loc[
        cadastro[
            "coligada_painel"
        ].eq(""),
        "coligada_painel",
    ] = "NAO_RESOLVIDA"

    mart_coligadas = (
        cadastro
        .groupby(
            "coligada_painel"
        )
        .agg(
            motoristas=(
                "driver_id_cobli",
                "count",
            ),
            ativos_rm=(
                "situacao_motorista",
                lambda s: (
                    s
                    == "ATIVO_REGULAR"
                ).sum(),
            ),
            a_desabilitar=(
                "situacao_motorista",
                lambda s: (
                    s
                    ==
                    "PENDENTE_DESATIVACAO_COBLI"
                ).sum(),
            ),
            sem_identidade_rm=(
                "situacao_motorista",
                lambda s: (
                    s
                    == "SEM_IDENTIDADE_RM"
                ).sum(),
            ),
        )
        .reset_index()
        .rename(
            columns={
                "coligada_painel":
                    "coligada"
            }
        )
        .sort_values(
            [
                "motoristas",
                "coligada",
            ],
            ascending=[
                False,
                True,
            ],
        )
        .reset_index(
            drop=True
        )
    )

    # ========================================================
    # 3. VIAGENS
    # ========================================================

    viagens = viagens.copy()

    viagens[
        "_distancia_km"
    ] = pd.to_numeric(
        viagens[
            "distancia_km"
        ],
        errors="coerce",
    ).fillna(0)

    viagens[
        "_duracao_viagem_min"
    ] = pd.to_numeric(
        viagens[
            "duracao_viagem_min"
        ],
        errors="coerce",
    ).fillna(0)

    viagens[
        "_marcha_lenta_min"
    ] = pd.to_numeric(
        viagens[
            "marcha_lenta_min"
        ],
        errors="coerce",
    ).fillna(0)

    mov = viagens[
        (
            viagens[
                "tipo_evento"
            ]
            == "VIAGEM"
        )
        &
        (
            viagens[
                "_distancia_km"
            ]
            > 0
        )
    ].copy()

    lookup = (
        cadastro[
            [
                "driver_id_cobli",
                "nome_exibicao",
                "situacao_motorista",
                "secao_rm",
                "coligada",
            ]
        ]
        .drop_duplicates(
            subset=[
                "driver_id_cobli"
            ]
        )
        .rename(
            columns={
                "nome_exibicao":
                    "_nome_exibicao_cad",

                "situacao_motorista":
                    "_situacao_motorista_cad",

                "secao_rm":
                    "_secao_rm_cad",

                "coligada":
                    "_coligada_cad",
            }
        )
    )

    mov = mov.merge(
        lookup,
        on="driver_id_cobli",
        how="left",
    )

    for coluna in [
        "_nome_exibicao_cad",
        "_situacao_motorista_cad",
        "_secao_rm_cad",
        "_coligada_cad",
    ]:
        mov[coluna] = (
            mov[coluna]
            .fillna("")
            .astype(str)
            .str.strip()
        )

    mov[
        "_inicio_dt"
    ] = pd.to_datetime(
        mov["inicio"],
        errors="coerce",
        format="mixed",
    )

    if mov[
        "_inicio_dt"
    ].isna().any():

        falhar(
            "existem viagens com "
            "inicio invalido."
        )

    mov[
        "fim_de_semana"
    ] = (
        mov[
            "_inicio_dt"
        ]
        .dt.dayofweek
        .isin(
            [5, 6]
        )
    )

    mov[
        "noturno"
    ] = (
        mov[
            "_inicio_dt"
        ]
        .apply(
            eh_noturno
        )
    )

    mov[
        "fim_semana_noturno"
    ] = (
        mov[
            "fim_de_semana"
        ]
        &
        mov[
            "noturno"
        ]
    )

    mov[
        "tipo_registro"
    ] = "VEICULO"

    mov.loc[
        mov[
            "placa"
        ]
        .str.contains(
            "OBD",
            case=False,
            regex=False,
            na=False,
        ),
        "tipo_registro",
    ] = "OBD"

    def classificar_condutor(
        linha,
    ):

        driver = str(
            linha.get(
                "driver_id_cobli",
                "",
            )
        ).strip()

        situacao = str(
            linha.get(
                "_situacao_motorista_cad",
                "",
            )
        ).strip()

        setor = str(
            linha.get(
                "_secao_rm_cad",
                "",
            )
        ).strip()

        if not driver:
            return (
                "SEM_MOTORISTA_IDENTIFICADO"
            )

        if not situacao:
            return (
                "MOTORISTA_FORA_CADASTRO_ATUAL"
            )

        if (
            situacao
            ==
            "SEM_IDENTIDADE_RM"
        ):
            return (
                "MOTORISTA_SEM_IDENTIDADE_RM"
            )

        if (
            situacao
            ==
            "PENDENTE_DESATIVACAO_COBLI"
        ):
            return (
                "MOTORISTA_DESLIGADO_IDENTIFICADO"
            )

        if (
            situacao
            ==
            "REVISAR_SITUACAO_RM"
        ):
            return (
                "MOTORISTA_REVISAR_RM"
            )

        if not setor:
            return (
                "MOTORISTA_RM_SEM_SETOR"
            )

        return (
            "IDENTIFICADO_COM_SETOR"
        )

    mov[
        "status_identificacao_condutor"
    ] = mov.apply(
        classificar_condutor,
        axis=1,
    )

    mov[
        "_nome_portal"
    ] = mov[
        "_nome_exibicao_cad"
    ]

    mask_nome_nao_identificado = (
        mov[
            "status_identificacao_condutor"
        ]
        .isin(
            [
                "SEM_MOTORISTA_IDENTIFICADO",
                "MOTORISTA_SEM_IDENTIDADE_RM",
                "MOTORISTA_FORA_CADASTRO_ATUAL",
            ]
        )
    )

    mov.loc[
        mask_nome_nao_identificado,
        "_nome_portal",
    ] = "Não identificado"

    mart_viagens = pd.DataFrame(
        {
            "data_evento":
                mov[
                    "data_evento"
                ],

            "ano_evento":
                mov[
                    "ano_evento"
                ],

            "mes_evento":
                mov[
                    "mes_evento"
                ],

            "inicio":
                mov[
                    "inicio"
                ],

            "fim":
                mov[
                    "fim"
                ],

            "nome_exibicao":
                mov[
                    "_nome_portal"
                ],

            "coligada":
                mov[
                    "_coligada_cad"
                ],

            "secao_rm":
                mov[
                    "_secao_rm_cad"
                ],

            "situacao_motorista":
                mov[
                    "_situacao_motorista_cad"
                ],

            "status_identificacao_condutor":
                mov[
                    "status_identificacao_condutor"
                ],

            "tipo_registro":
                mov[
                    "tipo_registro"
                ],

            "fim_de_semana":
                mov[
                    "fim_de_semana"
                ],

            "noturno":
                mov[
                    "noturno"
                ],

            "fim_semana_noturno":
                mov[
                    "fim_semana_noturno"
                ],

            "distancia_km":
                mov[
                    "_distancia_km"
                ].round(2),

            "duracao_viagem_min":
                mov[
                    "_duracao_viagem_min"
                ].round(2),

            "marcha_lenta_min":
                mov[
                    "_marcha_lenta_min"
                ].round(2),
        }
    )

    # ========================================================
    # 4. INDICADORES DE VIAGEM
    # ========================================================

    total_viagens = len(
        mov
    )

    km_total = float(
        mov[
            "_distancia_km"
        ].sum()
    )

    sem_condutor = mov[
        mov[
            "status_identificacao_condutor"
        ]
        ==
        "SEM_MOTORISTA_IDENTIFICADO"
    ]

    viagens_sem_condutor = len(
        sem_condutor
    )

    km_sem_condutor = float(
        sem_condutor[
            "_distancia_km"
        ].sum()
    )

    obd_sem_condutor = (
        sem_condutor[
            sem_condutor[
                "tipo_registro"
            ]
            == "OBD"
        ][
            "vehicle_id_cobli"
        ]
        .nunique()
    )

    veiculos_sem_condutor = (
        sem_condutor[
            sem_condutor[
                "tipo_registro"
            ]
            == "VEICULO"
        ][
            "vehicle_id_cobli"
        ]
        .nunique()
    )

    # ========================================================
    # 5. USO POR SETOR
    # ========================================================

    uso_setor_partes = []

    cenarios = {
        "TOTAL":
            pd.Series(
                True,
                index=mov.index,
            ),

        "NOTURNO":
            mov[
                "noturno"
            ],

        "FIM_DE_SEMANA":
            mov[
                "fim_de_semana"
            ],

        "FIM_SEMANA_NOTURNO":
            mov[
                "fim_semana_noturno"
            ],
    }

    for (
        nome_cenario,
        mascara_cenario,
    ) in cenarios.items():

        base = mov[
            mascara_cenario
            &
            (
                mov[
                    "status_identificacao_condutor"
                ]
                ==
                "IDENTIFICADO_COM_SETOR"
            )
        ]

        agrupado = (
            base
            .groupby(
                "_secao_rm_cad"
            )
            .agg(
                viagens=(
                    "evento_id",
                    "count",
                ),
                km=(
                    "_distancia_km",
                    "sum",
                ),
                motoristas=(
                    "driver_id_cobli",
                    "nunique",
                ),
            )
            .reset_index()
            .rename(
                columns={
                    "_secao_rm_cad":
                        "secao_rm"
                }
            )
        )

        agrupado.insert(
            0,
            "cenario",
            nome_cenario,
        )

        agrupado[
            "km"
        ] = (
            agrupado[
                "km"
            ]
            .round(2)
        )

        uso_setor_partes.append(
            agrupado
        )

    mart_uso_setor = pd.concat(
        uso_setor_partes,
        ignore_index=True,
    )

    mart_uso_setor = (
        mart_uso_setor
        .sort_values(
            [
                "cenario",
                "viagens",
                "km",
            ],
            ascending=[
                True,
                False,
                False,
            ],
        )
        .reset_index(
            drop=True
        )
    )

    # ========================================================
    # 6. PENDENCIAS DE IDENTIFICACAO
    # ========================================================

    pendencias_partes = []

    for (
        nome_cenario,
        mascara_cenario,
    ) in cenarios.items():

        base = mov[
            mascara_cenario
            &
            (
                mov[
                    "status_identificacao_condutor"
                ]
                ==
                "SEM_MOTORISTA_IDENTIFICADO"
            )
        ]

        if base.empty:
            continue

        agrupado = (
            base
            .groupby(
                "tipo_registro"
            )
            .agg(
                viagens=(
                    "evento_id",
                    "count",
                ),
                km=(
                    "_distancia_km",
                    "sum",
                ),
                registros_cobli=(
                    "vehicle_id_cobli",
                    "nunique",
                ),
            )
            .reset_index()
        )

        agrupado.insert(
            0,
            "cenario",
            nome_cenario,
        )

        agrupado[
            "km"
        ] = (
            agrupado[
                "km"
            ]
            .round(2)
        )

        pendencias_partes.append(
            agrupado
        )

    mart_pendencias = pd.concat(
        pendencias_partes,
        ignore_index=True,
    )

    # ========================================================
    # 7. TOP 5 QUEM MAIS DIRIGE
    # ========================================================

    uso_ativos = mov[
        (
            mov[
                "_situacao_motorista_cad"
            ]
            == "ATIVO_REGULAR"
        )
        &
        (
            mov[
                "driver_id_cobli"
            ].ne("")
        )
    ]

    ranking_uso = (
        uso_ativos
        .groupby(
            "driver_id_cobli"
        )
        .agg(
            distancia_km=(
                "_distancia_km",
                "sum",
            ),
            viagens=(
                "evento_id",
                "count",
            ),
            nome_exibicao=(
                "_nome_exibicao_cad",
                "first",
            ),
            coligada=(
                "_coligada_cad",
                "first",
            ),
            secao_rm=(
                "_secao_rm_cad",
                "first",
            ),
        )
        .reset_index()
        .sort_values(
            [
                "distancia_km",
                "viagens",
            ],
            ascending=[
                False,
                False,
            ],
        )
        .head(5)
        .reset_index(
            drop=True
        )
    )

    ranking_uso.insert(
        0,
        "posicao",
        range(
            1,
            len(ranking_uso) + 1,
        ),
    )

    ranking_uso[
        "distancia_km"
    ] = (
        ranking_uso[
            "distancia_km"
        ]
        .round(2)
    )

    mart_ranking_uso = (
        ranking_uso[
            [
                "posicao",
                "nome_exibicao",
                "coligada",
                "secao_rm",
                "distancia_km",
                "viagens",
            ]
        ]
        .copy()
    )

    # ========================================================
    # 8. SEGURANCA
    # ========================================================

    seguranca = seguranca.copy()

    metricas_seguranca = [
        "distancia_km",
        "tempo_dirigido_min",
        *CAMPOS_RISCO,
    ]

    for coluna in metricas_seguranca:

        seguranca[
            coluna
        ] = pd.to_numeric(
            seguranca[
                coluna
            ],
            errors="coerce",
        ).fillna(0)

    ids_ativos = set(
        cadastro.loc[
            cadastro[
                "situacao_motorista"
            ]
            == "ATIVO_REGULAR",
            "driver_id_cobli",
        ]
    )

    seg_ativos = seguranca[
        seguranca[
            "driver_id_cobli"
        ].isin(
            ids_ativos
        )
    ].copy()

    seg_ativos = seg_ativos.merge(
        lookup,
        on="driver_id_cobli",
        how="left",
    )

    seg_ativos[
        "eventos_risco_total"
    ] = (
        seg_ativos[
            CAMPOS_RISCO
        ]
        .sum(
            axis=1
        )
    )

    seg_ativos[
        "taxa_eventos_100km"
    ] = 0.0

    mask_distancia = (
        seg_ativos[
            "distancia_km"
        ] > 0
    )

    seg_ativos.loc[
        mask_distancia,
        "taxa_eventos_100km",
    ] = (
        seg_ativos.loc[
            mask_distancia,
            "eventos_risco_total",
        ]
        /
        seg_ativos.loc[
            mask_distancia,
            "distancia_km",
        ]
        * 100
    )

    seg_ativos[
        "elegivel_ranking"
    ] = (
        seg_ativos[
            "distancia_km"
        ]
        >= 100
    )

    mart_seguranca = pd.DataFrame(
        {
            "nome_exibicao":
                seg_ativos[
                    "_nome_exibicao_cad"
                ],

            "coligada":
                seg_ativos[
                    "_coligada_cad"
                ],

            "secao_rm":
                seg_ativos[
                    "_secao_rm_cad"
                ],

            "distancia_km":
                seg_ativos[
                    "distancia_km"
                ].round(2),

            "tempo_dirigido_min":
                seg_ativos[
                    "tempo_dirigido_min"
                ].round(2),

            "velocidade_via_eventos_qtd":
                seg_ativos[
                    "velocidade_via_eventos_qtd"
                ],

            "aceleracao_brusca_qtd":
                seg_ativos[
                    "aceleracao_brusca_qtd"
                ],

            "frenagem_brusca_qtd":
                seg_ativos[
                    "frenagem_brusca_qtd"
                ],

            "curva_brusca_qtd":
                seg_ativos[
                    "curva_brusca_qtd"
                ],

            "direcao_distraida_qtd":
                seg_ativos[
                    "direcao_distraida_qtd"
                ],

            "uso_celular_qtd":
                seg_ativos[
                    "uso_celular_qtd"
                ],

            "olhos_fechados_qtd":
                seg_ativos[
                    "olhos_fechados_qtd"
                ],

            "bocejo_qtd":
                seg_ativos[
                    "bocejo_qtd"
                ],

            "fumo_qtd":
                seg_ativos[
                    "fumo_qtd"
                ],

            "distancia_insegura_qtd":
                seg_ativos[
                    "distancia_insegura_qtd"
                ],

            "eventos_risco_total":
                seg_ativos[
                    "eventos_risco_total"
                ],

            "taxa_eventos_100km":
                seg_ativos[
                    "taxa_eventos_100km"
                ].round(2),

            "elegivel_ranking":
                seg_ativos[
                    "elegivel_ranking"
                ],
        }
    )

    com_risco = int(
        (
            seg_ativos[
                "eventos_risco_total"
            ]
            > 0
        ).sum()
    )

    elegiveis = seg_ativos[
        seg_ativos[
            "elegivel_ranking"
        ]
    ].copy()

    melhores = (
        elegiveis
        .sort_values(
            [
                "taxa_eventos_100km",
                "distancia_km",
            ],
            ascending=[
                True,
                False,
            ],
        )
        .head(5)
        .copy()
    )

    piores = (
        elegiveis
        .sort_values(
            [
                "taxa_eventos_100km",
                "distancia_km",
            ],
            ascending=[
                False,
                False,
            ],
        )
        .head(5)
        .copy()
    )

    ranking_seguranca_partes = []

    for (
        tipo_ranking,
        base,
    ) in [
        (
            "MELHORES",
            melhores,
        ),
        (
            "PIORES",
            piores,
        ),
    ]:

        saida = pd.DataFrame(
            {
                "posicao":
                    range(
                        1,
                        len(base) + 1,
                    ),

                "ranking":
                    tipo_ranking,

                "nome_exibicao":
                    base[
                        "_nome_exibicao_cad"
                    ].values,

                "coligada":
                    base[
                        "_coligada_cad"
                    ].values,

                "secao_rm":
                    base[
                        "_secao_rm_cad"
                    ].values,

                "distancia_km":
                    base[
                        "distancia_km"
                    ].round(2).values,

                "eventos_risco_total":
                    base[
                        "eventos_risco_total"
                    ].values,

                "taxa_eventos_100km":
                    base[
                        "taxa_eventos_100km"
                    ].round(2).values,
            }
        )

        ranking_seguranca_partes.append(
            saida
        )

    mart_ranking_seguranca = (
        pd.concat(
            ranking_seguranca_partes,
            ignore_index=True,
        )
    )

    # ========================================================
    # 9. RESUMO GERAL
    # ========================================================

    linhas_resumo = []

    def indicador(
        grupo,
        nome,
        valor,
        unidade="qtd",
    ):

        linhas_resumo.append(
            {
                "grupo":
                    grupo,

                "indicador":
                    nome,

                "valor":
                    valor,

                "unidade":
                    unidade,
            }
        )

    indicador(
        "CADASTRO",
        "motoristas_cobli",
        total_motoristas,
    )

    indicador(
        "CADASTRO",
        "motoristas_ativos_regulares",
        ativos,
    )

    indicador(
        "CADASTRO",
        "pendentes_desativacao_cobli",
        pendentes,
    )

    indicador(
        "CADASTRO",
        "sem_identidade_rm",
        sem_identidade,
    )

    indicador(
        "CADASTRO",
        "revisar_situacao_rm",
        revisar,
    )

    indicador(
        "CADASTRO",
        "cobertura_identificacao_pct",
        round(
            cobertura,
            2,
        ),
        "pct",
    )

    indicador(
        "VIAGENS",
        "viagens_total",
        total_viagens,
    )

    indicador(
        "VIAGENS",
        "km_total",
        round(
            km_total,
            2,
        ),
        "km",
    )

    indicador(
        "ASSOCIACAO",
        "viagens_sem_motorista_identificado",
        viagens_sem_condutor,
    )

    indicador(
        "ASSOCIACAO",
        "viagens_sem_motorista_pct",
        round(
            percentual(
                viagens_sem_condutor,
                total_viagens,
            ),
            2,
        ),
        "pct",
    )

    indicador(
        "ASSOCIACAO",
        "km_sem_motorista_identificado",
        round(
            km_sem_condutor,
            2,
        ),
        "km",
    )

    indicador(
        "ASSOCIACAO",
        "km_sem_motorista_pct",
        round(
            percentual(
                km_sem_condutor,
                km_total,
            ),
            2,
        ),
        "pct",
    )

    indicador(
        "ASSOCIACAO",
        "obds_com_viagem_sem_motorista",
        int(
            obd_sem_condutor
        ),
    )

    indicador(
        "ASSOCIACAO",
        "veiculos_com_viagem_sem_motorista",
        int(
            veiculos_sem_condutor
        ),
    )

    for (
        grupo,
        mascara,
    ) in [
        (
            "NOTURNO",
            mov[
                "noturno"
            ],
        ),
        (
            "FIM_DE_SEMANA",
            mov[
                "fim_de_semana"
            ],
        ),
        (
            "FIM_SEMANA_NOTURNO",
            mov[
                "fim_semana_noturno"
            ],
        ),
    ]:

        base = mov[
            mascara
        ]

        base_sem = base[
            base[
                "status_identificacao_condutor"
            ]
            ==
            "SEM_MOTORISTA_IDENTIFICADO"
        ]

        indicador(
            grupo,
            "viagens",
            len(base),
        )

        indicador(
            grupo,
            "km",
            round(
                base[
                    "_distancia_km"
                ].sum(),
                2,
            ),
            "km",
        )

        indicador(
            grupo,
            "viagens_sem_motorista_identificado",
            len(base_sem),
        )

        indicador(
            grupo,
            "sem_motorista_pct",
            round(
                percentual(
                    len(base_sem),
                    len(base),
                ),
                2,
            ),
            "pct",
        )

    indicador(
        "SEGURANCA",
        "motoristas_ativos_na_base_safety",
        len(
            seg_ativos
        ),
    )

    indicador(
        "SEGURANCA",
        "motoristas_com_evento_risco",
        com_risco,
    )

    indicador(
        "SEGURANCA",
        "motoristas_com_evento_risco_pct",
        round(
            percentual(
                com_risco,
                len(seg_ativos),
            ),
            2,
        ),
        "pct",
    )

    indicador(
        "SEGURANCA",
        "motoristas_elegiveis_ranking_100km",
        len(
            elegiveis
        ),
    )

    for coluna in CAMPOS_RISCO:

        indicador(
            "SEGURANCA",
            coluna,
            int(
                seg_ativos[
                    coluna
                ].sum()
            ),
        )

    mart_resumo = pd.DataFrame(
        linhas_resumo
    )

    # ========================================================
    # 10. QUALITY GATE OURO
    # ========================================================

    if (
        len(
            mart_motoristas
        )
        !=
        len(
            cadastro
        )
    ):

        falhar(
            "quantidade de motoristas "
            "diverge do cadastro."
        )

    if (
        int(
            mart_coligadas[
                "motoristas"
            ].sum()
        )
        !=
        total_motoristas
    ):

        falhar(
            "soma por coligada "
            "nao fecha com cadastro."
        )

    if (
        len(
            mart_viagens
        )
        !=
        total_viagens
    ):

        falhar(
            "mart de viagens "
            "nao fecha com viagens reais."
        )

    if (
        (
            mart_ranking_seguranca[
                "distancia_km"
            ]
            < 100
        ).any()
    ):

        falhar(
            "ranking de seguranca possui "
            "motorista abaixo de 100 km."
        )

    saidas = {
        "motoristas":
            mart_motoristas,

        "resumo":
            mart_resumo,

        "coligadas":
            mart_coligadas,

        "viagens":
            mart_viagens,

        "uso_setor":
            mart_uso_setor,

        "pendencias_condutor":
            mart_pendencias,

        "seguranca":
            mart_seguranca,

        "ranking_uso":
            mart_ranking_uso,

        "ranking_seguranca":
            mart_ranking_seguranca,
    }

    for (
        nome,
        df,
    ) in saidas.items():

        proibidas = (
            set(
                df.columns
            )
            &
            COLUNAS_PROIBIDAS_OURO
        )

        if proibidas:

            falhar(
                f"{nome} expoe colunas proibidas: "
                + ", ".join(
                    sorted(
                        proibidas
                    )
                )
            )

    # ========================================================
    # 11. GRAVACAO
    # ========================================================

    PASTA_OURO.mkdir(
        parents=True,
        exist_ok=True,
    )

    with pd.ExcelWriter(
        ARQUIVO_OURO,
        engine="openpyxl",
    ) as writer:

        for (
            nome,
            df,
        ) in saidas.items():

            df.to_excel(
                writer,
                sheet_name=nome,
                index=False,
            )

    # ========================================================
    # RESUMO DE EXECUCAO
    # ========================================================

    print()
    print(
        "Cadastro:",
        total_motoristas,
    )

    print(
        "Ativos:",
        ativos,
    )

    print(
        "A desabilitar:",
        pendentes,
    )

    print(
        "Sem identidade RM:",
        sem_identidade,
    )

    print()
    print(
        "Viagens:",
        total_viagens,
    )

    print(
        "Viagens sem motorista:",
        viagens_sem_condutor,
    )

    print(
        "Km sem motorista:",
        round(
            km_sem_condutor,
            2,
        ),
    )

    print()
    print(
        "Viagens noturnas:",
        int(
            mov[
                "noturno"
            ].sum()
        ),
    )

    print(
        "Viagens fim de semana:",
        int(
            mov[
                "fim_de_semana"
            ].sum()
        ),
    )

    print(
        "Fim de semana + noite:",
        int(
            mov[
                "fim_semana_noturno"
            ].sum()
        ),
    )

    print()
    print(
        "Motoristas Safety ativos:",
        len(
            seg_ativos
        ),
    )

    print(
        "Com evento de risco:",
        com_risco,
    )

    print(
        "Elegiveis ranking >=100 km:",
        len(
            elegiveis
        ),
    )

    print()
    print(
        "Abas geradas:"
    )

    for nome, df in saidas.items():

        print(
            f"  {nome}: {len(df)}"
        )

    print()
    print(
        "Arquivo:",
        ARQUIVO_OURO,
    )

    print()
    print("=" * 80)
    print("QUALITY GATE OURO: APROVADO")
    print("OURO MOTORISTAS MULTIMART GERADA")
    print("=" * 80)


if __name__ == "__main__":

    try:
        gerar()

    except Exception as erro:

        print(
            f"ERRO: {erro}",
            file=sys.stderr,
        )

        sys.exit(1)
