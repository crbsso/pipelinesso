from pathlib import Path
import os
import json
import sys

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]

PASTA_BRONZE = (
    ROOT
    / "data"
    / "bronze"
    / "motoristas"
)

ARQUIVO_EVENTOS = (
    ROOT
    / "data"
    / "prata"
    / "motoristas"
    / "motorista_veiculo.csv"
)

ARQUIVO_MOTORISTAS = (
    ROOT
    / "data"
    / "prata"
    / "motoristas"
    / "motoristas.csv"
)


TIPOS_EVENTO_VALIDOS = {
    "VIAGEM",
    "PARADA",
}


SITUACOES_VINCULO_VALIDAS = {
    "MOTORISTA_ATIVO",
    "MOTORISTA_PENDENTE_DESATIVACAO",
    "MOTORISTA_SEM_IDENTIDADE_RM",
    "MOTORISTA_REVISAR",
    "SEM_MOTORISTA_IDENTIFICADO_COBLI",
    "DRIVER_NAO_ENCONTRADO_CADASTRO_COBLI",
}


def falhar(mensagem):

    raise RuntimeError(
        "QUALITY GATE REPROVADO: "
        + mensagem
    )


def localizar_bronze():

    selecionado = os.getenv(
        "COBLI_BRONZE_TRIPS_STOPS",
        "",
    ).strip()

    if selecionado:
        pasta = PASTA_BRONZE.resolve()
        candidato = (pasta / selecionado).resolve()

        if candidato.parent != pasta:
            falhar(
                "Bronze selecionada fora da pasta permitida."
            )

        if not (
            candidato.name.startswith("cobli_trips_stops_")
            and candidato.suffix == ".json"
            and candidato.is_file()
        ):
            falhar(
                "Bronze selecionada invalida ou inexistente."
            )

        return candidato

    arquivos = sorted(
        PASTA_BRONZE.glob(
            "cobli_trips_stops_*.json"
        ),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    if not arquivos:
        falhar(
            "Bronze trips-and-stops "
            "nao encontrada."
        )

    return arquivos[0]


def carregar_bronze():

    arquivo = localizar_bronze()

    dados = json.loads(
        arquivo.read_text(
            encoding="utf-8-sig"
        )
    )

    rows = (
        dados
        .get("payload", {})
        .get("data", {})
        .get("rows", [])
    )

    if not isinstance(
        rows,
        list,
    ):
        falhar(
            "payload.data.rows "
            "nao e lista."
        )

    return (
        arquivo,
        rows,
    )


def carregar_csv(
    caminho,
    descricao,
):

    if not caminho.exists():
        falhar(
            f"{descricao} nao encontrado."
        )

    return pd.read_csv(
        caminho,
        sep=";",
        dtype=str,
        encoding="utf-8-sig",
    ).fillna("")


def validar():

    bronze_arquivo, bronze = (
        carregar_bronze()
    )

    eventos = carregar_csv(
        ARQUIVO_EVENTOS,
        "Prata motorista_veiculo.csv",
    )

    motoristas = carregar_csv(
        ARQUIVO_MOTORISTAS,
        "Prata motoristas.csv",
    )

    print("=" * 72)
    print(
        "QUALITY GATE - MOTORISTA x VEICULO"
    )
    print("=" * 72)

    print()
    print(
        "Bronze:",
        bronze_arquivo.name,
    )

    print(
        "Eventos Bronze:",
        len(bronze),
    )

    print(
        "Eventos Prata:",
        len(eventos),
    )

    # ---------------------------------------------------------
    # 1. CONSERVACAO
    # ---------------------------------------------------------

    if len(bronze) != len(eventos):
        falhar(
            "quantidade Bronze e Prata diverge."
        )

    # ---------------------------------------------------------
    # 2. CONTRATO
    # ---------------------------------------------------------

    obrigatorias = {
        "evento_id",
        "cobli_id",
        "tipo_evento",
        "driver_id_cobli",
        "driver_name_cobli",
        "cod_colaborador",
        "nome_exibicao",
        "metodo_identificacao",
        "situacao_motorista",
        "situacao_vinculo_evento",
        "vehicle_id_cobli",
        "placa",
        "marca",
        "modelo",
        "latitude_inicio",
        "longitude_inicio",
        "latitude_fim",
        "longitude_fim",
        "inicio",
        "fim",
        "distancia_km",
        "duracao_viagem_min",
        "duracao_parada_min",
        "marcha_lenta_min",
        "data_evento",
        "ano_evento",
        "mes_evento",
    }

    ausentes = (
        obrigatorias
        - set(eventos.columns)
    )

    if ausentes:
        falhar(
            "colunas ausentes: "
            + ", ".join(
                sorted(ausentes)
            )
        )

    # ---------------------------------------------------------
    # 3. EVENTO ID
    # ---------------------------------------------------------

    if eventos[
        "evento_id"
    ].eq("").any():
        falhar(
            "evento_id vazio."
        )

    if eventos[
        "evento_id"
    ].duplicated().any():
        falhar(
            "evento_id duplicado."
        )

    # ---------------------------------------------------------
    # 4. VEICULO
    # ---------------------------------------------------------

    if eventos[
        "vehicle_id_cobli"
    ].eq("").any():
        falhar(
            "evento sem vehicle_id_cobli."
        )

    if eventos[
        "placa"
    ].eq("").any():
        falhar(
            "evento sem placa."
        )

    # ---------------------------------------------------------
    # 5. TIPO EVENTO
    # ---------------------------------------------------------

    tipos = set(
        eventos[
            "tipo_evento"
        ].unique()
    )

    invalidos = (
        tipos
        - TIPOS_EVENTO_VALIDOS
    )

    if invalidos:
        falhar(
            "tipo_evento invalido: "
            + ", ".join(
                sorted(invalidos)
            )
        )

    # ---------------------------------------------------------
    # 6. SITUACAO DO VINCULO
    # ---------------------------------------------------------

    situacoes = set(
        eventos[
            "situacao_vinculo_evento"
        ].unique()
    )

    invalidas = (
        situacoes
        - SITUACOES_VINCULO_VALIDAS
    )

    if invalidas:
        falhar(
            "situacao_vinculo_evento "
            "invalida: "
            + ", ".join(
                sorted(invalidas)
            )
        )

    # ---------------------------------------------------------
    # 7. SEM DRIVER COBLI
    # ---------------------------------------------------------

    sem_driver = eventos[
        eventos[
            "driver_id_cobli"
        ].eq("")
    ]

    if not (
        sem_driver[
            "situacao_vinculo_evento"
        ]
        == (
            "SEM_MOTORISTA_IDENTIFICADO_COBLI"
        )
    ).all():

        falhar(
            "evento sem driver_id possui "
            "classificacao incorreta."
        )

    # ---------------------------------------------------------
    # 8. DRIVER PRESENTE
    # ---------------------------------------------------------

    com_driver = eventos[
        eventos[
            "driver_id_cobli"
        ].ne("")
    ]

    if (
        com_driver[
            "situacao_vinculo_evento"
        ]
        == (
            "SEM_MOTORISTA_IDENTIFICADO_COBLI"
        )
    ).any():

        falhar(
            "evento com driver_id classificado "
            "como sem motorista."
        )

    # ---------------------------------------------------------
    # 9. CONSISTENCIA COM CADASTRO COBLI
    # ---------------------------------------------------------

    ids_cadastro = set(
        motoristas[
            "driver_id_cobli"
        ]
        .astype(str)
        .str.strip()
    )

    ids_cadastro.discard("")

    ids_eventos = set(
        com_driver[
            "driver_id_cobli"
        ]
        .astype(str)
        .str.strip()
    )

    ids_eventos.discard("")

    drivers_fora_cadastro = (
        ids_eventos
        - ids_cadastro
    )

    status_driver_historico = (
        "DRIVER_NAO_ENCONTRADO_CADASTRO_COBLI"
    )

    eventos_driver_fora = (
        com_driver[
            com_driver[
                "driver_id_cobli"
            ]
            .astype(str)
            .str.strip()
            .isin(
                drivers_fora_cadastro
            )
        ]
    )

    if not eventos_driver_fora.empty:

        if not (
            eventos_driver_fora[
                "situacao_vinculo_evento"
            ]
            == status_driver_historico
        ).all():

            falhar(
                "driver ausente do cadastro atual "
                "sem classificacao historica correta."
            )

        if (
            eventos_driver_fora[
                "driver_name_cobli"
            ]
            .astype(str)
            .str.strip()
            .eq("")
            .any()
        ):

            falhar(
                "driver historico fora do cadastro "
                "atual sem nome informado pela Cobli."
            )

    classificados_historicos = eventos[
        eventos[
            "situacao_vinculo_evento"
        ]
        == status_driver_historico
    ]

    if not classificados_historicos.empty:

        ids_classificados_historicos = set(
            classificados_historicos[
                "driver_id_cobli"
            ]
            .astype(str)
            .str.strip()
        )

        ids_classificados_historicos.discard("")

        inconsistentes = (
            ids_classificados_historicos
            & ids_cadastro
        )

        if inconsistentes:

            falhar(
                "driver classificado como fora do "
                "cadastro Cobli, mas presente em "
                "motoristas.csv."
            )

    if drivers_fora_cadastro:

        print()
        print(
            "Drivers historicos fora do cadastro atual:",
            len(
                drivers_fora_cadastro
            ),
        )

        print(
            "Eventos desses drivers:",
            len(
                eventos_driver_fora
            ),
        )

    # ---------------------------------------------------------
    # 10. CLASSIFICACAO RM
    # ---------------------------------------------------------

    ativos = eventos[
        eventos[
            "situacao_vinculo_evento"
        ]
        == "MOTORISTA_ATIVO"
    ]

    if not (
        ativos[
            "situacao_motorista"
        ]
        == "ATIVO_REGULAR"
    ).all():

        falhar(
            "MOTORISTA_ATIVO inconsistente "
            "com situacao_motorista."
        )

    sem_identidade = eventos[
        eventos[
            "situacao_vinculo_evento"
        ]
        == "MOTORISTA_SEM_IDENTIDADE_RM"
    ]

    if not (
        sem_identidade[
            "situacao_motorista"
        ]
        == "SEM_IDENTIDADE_RM"
    ).all():

        falhar(
            "MOTORISTA_SEM_IDENTIDADE_RM "
            "inconsistente."
        )

    # ---------------------------------------------------------
    # 11. DATAS
    # ---------------------------------------------------------

    if eventos[
        "data_evento"
    ].eq("").any():

        falhar(
            "evento sem data_evento."
        )

    meses = pd.to_numeric(
        eventos[
            "mes_evento"
        ],
        errors="coerce",
    )

    if (
        meses.isna().any()
        or (meses < 1).any()
        or (meses > 12).any()
    ):

        falhar(
            "mes_evento invalido."
        )

    # ---------------------------------------------------------
    # 12. COORDENADAS
    # ---------------------------------------------------------

    limites_coordenadas = {
        "latitude_inicio":
            (-90, 90),

        "longitude_inicio":
            (-180, 180),

        "latitude_fim":
            (-90, 90),

        "longitude_fim":
            (-180, 180),
    }


    coordenadas_preenchidas = {}


    for (
        coluna,
        limites,
    ) in limites_coordenadas.items():

        serie_texto = (
            eventos[coluna]
            .astype(str)
            .str.strip()
        )

        preenchido = (
            serie_texto.ne("")
        )

        coordenadas_preenchidas[
            coluna
        ] = preenchido

        numeros = pd.to_numeric(
            serie_texto.where(
                preenchido
            ),
            errors="coerce",
        )

        if numeros[
            preenchido
        ].isna().any():

            falhar(
                "coordenada nao numerica "
                f"em {coluna}."
            )

        minimo, maximo = limites

        fora_limite = (
            preenchido
            &
            (
                (numeros < minimo)
                |
                (numeros > maximo)
            )
        )

        if fora_limite.any():

            falhar(
                "coordenada fora do "
                f"intervalo em {coluna}."
            )


    inicio_lat = (
        coordenadas_preenchidas[
            "latitude_inicio"
        ]
    )

    inicio_lon = (
        coordenadas_preenchidas[
            "longitude_inicio"
        ]
    )

    fim_lat = (
        coordenadas_preenchidas[
            "latitude_fim"
        ]
    )

    fim_lon = (
        coordenadas_preenchidas[
            "longitude_fim"
        ]
    )


    if (
        inicio_lat
        != inicio_lon
    ).any():

        falhar(
            "localizacao inicial possui "
            "latitude/longitude incompletas."
        )


    if (
        fim_lat
        != fim_lon
    ).any():

        falhar(
            "localizacao final possui "
            "latitude/longitude incompletas."
        )


    sem_local_inicio = eventos[
        ~inicio_lat
    ]

    sem_local_fim = eventos[
        ~fim_lat
    ]


    # ---------------------------------------------------------
    # 13. METRICAS
    # ---------------------------------------------------------

    distancia = pd.to_numeric(
        eventos[
            "distancia_km"
        ],
        errors="coerce",
    )

    if (
        distancia.dropna()
        < 0
    ).any():

        falhar(
            "distancia negativa encontrada."
        )

    # ---------------------------------------------------------
    # RESUMO
    # ---------------------------------------------------------

    print()
    print("TIPO EVENTO:")

    print(
        eventos[
            "tipo_evento"
        ]
        .value_counts()
        .to_string()
    )

    print()
    print("SITUACAO DO VINCULO:")

    print(
        eventos[
            "situacao_vinculo_evento"
        ]
        .value_counts()
        .to_string()
    )

    print()
    print(
        "Motoristas distintos:",
        com_driver[
            "driver_id_cobli"
        ].nunique(),
    )

    print(
        "Veiculos distintos:",
        eventos[
            "vehicle_id_cobli"
        ].nunique(),
    )

    print(
        "Eventos sem motorista:",
        len(sem_driver),
    )

    print(
        "Eventos sem identidade RM:",
        len(sem_identidade),
    )

    print(
        "Sem localizacao inicial:",
        len(
            sem_local_inicio
        ),
    )

    if not sem_local_inicio.empty:

        print(
            "  Por tipo:",
            sem_local_inicio[
                "tipo_evento"
            ]
            .value_counts()
            .to_dict(),
        )


    print(
        "Sem localizacao final:",
        len(
            sem_local_fim
        ),
    )

    if not sem_local_fim.empty:

        print(
            "  Por tipo:",
            sem_local_fim[
                "tipo_evento"
            ]
            .value_counts()
            .to_dict(),
        )


    print(
        "Distancia total km:",
        round(
            distancia.fillna(0).sum(),
            2,
        ),
    )

    print()
    print("=" * 72)
    print(
        "QUALITY GATE MOTORISTA x VEICULO: "
        "APROVADO"
    )
    print("=" * 72)


if __name__ == "__main__":

    try:
        validar()

    except Exception as erro:

        print()
        print(
            str(erro),
            file=sys.stderr,
        )

        sys.exit(1)
