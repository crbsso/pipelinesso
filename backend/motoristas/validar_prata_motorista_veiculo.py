from pathlib import Path
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

    ids_eventos = set(
        com_driver[
            "driver_id_cobli"
        ]
        .astype(str)
        .str.strip()
    )

    drivers_fora_cadastro = (
        ids_eventos
        - ids_cadastro
    )

    if drivers_fora_cadastro:

        falhar(
            "existem drivers nos eventos "
            "que nao constam em motoristas.csv: "
            f"{len(drivers_fora_cadastro)}"
        )

    if (
        eventos[
            "situacao_vinculo_evento"
        ]
        == (
            "DRIVER_NAO_ENCONTRADO_CADASTRO_COBLI"
        )
    ).any():

        falhar(
            "existem eventos com driver "
            "nao encontrado no cadastro Cobli."
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
    # 12. METRICAS
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
