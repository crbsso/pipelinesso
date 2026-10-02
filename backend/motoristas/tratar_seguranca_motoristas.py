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

ARQUIVO_MOTORISTAS = (
    ROOT
    / "data"
    / "prata"
    / "motoristas"
    / "motoristas.csv"
)

PASTA_PRATA = (
    ROOT
    / "data"
    / "prata"
    / "motoristas"
)

ARQUIVO_SAIDA = (
    PASTA_PRATA
    / "seguranca_motoristas.csv"
)


TIPO_ROAD = "ROAD_SPEED_EVENT"
TIPO_VEHICLE = "VEHICLE_SPEED_EVENT"


CAMPOS_COMUNS = [
    "driven_distance_in_kms",
    "driven_time_in_minutes",
    "fast_acceleration_events_count",
    "hard_break_events_count",
    "speedy_turn_events_count",
    "distracted_driving_events_count",
    "phone_usage_events_count",
    "eyes_closed_events_count",
    "yawn_events_count",
    "smoking_events_count",
    "tailgating_events_count",
]


def texto(valor):

    if valor is None:
        return ""

    return str(valor).strip()


def numero(valor):

    if valor is None:
        return 0

    try:
        return float(valor)

    except (
        TypeError,
        ValueError,
    ):
        raise RuntimeError(
            f"Valor numerico invalido: {valor}"
        )


def inteiro(valor):

    if valor is None:
        return 0

    try:
        return int(valor)

    except (
        TypeError,
        ValueError,
    ):
        raise RuntimeError(
            f"Valor inteiro invalido: {valor}"
        )


def localizar_bronze():

    arquivos = sorted(
        PASTA_BRONZE.glob(
            "cobli_safety_driver_*.json"
        ),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    if not arquivos:
        raise RuntimeError(
            "Bronze Safety Driver "
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

    payloads = dados.get(
        "payloads"
    )

    if not isinstance(
        payloads,
        dict,
    ):
        raise RuntimeError(
            "Bronze sem payloads validos."
        )

    resultado = {}

    for tipo in [
        TIPO_ROAD,
        TIPO_VEHICLE,
    ]:

        payload = payloads.get(
            tipo,
            {}
        )

        rows = (
            payload
            .get("data", {})
            .get("rows", [])
        )

        if not isinstance(
            rows,
            list,
        ):
            raise RuntimeError(
                f"{tipo}: rows invalido."
            )

        indice = {}

        for registro in rows:

            driver = registro.get(
                "driver"
            )

            if not isinstance(
                driver,
                dict,
            ):
                raise RuntimeError(
                    f"{tipo}: driver invalido."
                )

            driver_id = texto(
                driver.get("id")
            )

            if not driver_id:
                raise RuntimeError(
                    f"{tipo}: driver sem id."
                )

            if driver_id in indice:
                raise RuntimeError(
                    f"{tipo}: driver_id duplicado."
                )

            indice[
                driver_id
            ] = registro

        resultado[
            tipo
        ] = indice

    return (
        arquivo,
        dados,
        resultado,
    )


def carregar_motoristas():

    if not ARQUIVO_MOTORISTAS.exists():
        raise RuntimeError(
            "motoristas.csv nao encontrado."
        )

    df = pd.read_csv(
        ARQUIVO_MOTORISTAS,
        sep=";",
        dtype=str,
        encoding="utf-8-sig",
    ).fillna("")

    if (
        df["driver_id_cobli"]
        .duplicated()
        .any()
    ):
        raise RuntimeError(
            "driver_id_cobli duplicado "
            "em motoristas.csv."
        )

    return (
        df
        .set_index(
            "driver_id_cobli",
            drop=False,
        )
        .to_dict(
            orient="index"
        )
    )


def validar_consistencia(
    driver_id,
    road,
    vehicle,
):

    nome_road = texto(
        road
        .get("driver", {})
        .get("name")
    )

    nome_vehicle = texto(
        vehicle
        .get("driver", {})
        .get("name")
    )

    if nome_road != nome_vehicle:

        raise RuntimeError(
            "Mesmo driver_id possui "
            "nomes diferentes entre "
            "ROAD e VEHICLE. "
            f"driver_id={driver_id}"
        )

    divergencias = []

    for campo in CAMPOS_COMUNS:

        if (
            road.get(campo)
            != vehicle.get(campo)
        ):

            divergencias.append(
                campo
            )

    if divergencias:

        raise RuntimeError(
            "Metricas comuns divergentes "
            "entre ROAD e VEHICLE. "
            f"driver_id={driver_id}. "
            "Campos: "
            + ", ".join(
                divergencias
            )
        )


def tratar():

    print("=" * 72)
    print("PRATA - SEGURANCA MOTORISTAS")
    print("=" * 72)

    (
        bronze_arquivo,
        bronze,
        fontes,
    ) = carregar_bronze()

    cadastro = carregar_motoristas()

    road = fontes[
        TIPO_ROAD
    ]

    vehicle = fontes[
        TIPO_VEHICLE
    ]

    ids_road = set(
        road.keys()
    )

    ids_vehicle = set(
        vehicle.keys()
    )

    if ids_road != ids_vehicle:

        raise RuntimeError(
            "ROAD e VEHICLE possuem "
            "drivers diferentes."
        )

    resultados = []

    for driver_id in sorted(
        ids_road
    ):

        r = road[
            driver_id
        ]

        v = vehicle[
            driver_id
        ]

        validar_consistencia(
            driver_id,
            r,
            v,
        )

        driver_name = texto(
            r
            .get("driver", {})
            .get("name")
        )

        if driver_id in cadastro:

            pessoa = cadastro[
                driver_id
            ]

            status_cadastro = (
                "CADASTRO_COBLI_ATUAL"
            )

            cod_colaborador = texto(
                pessoa.get(
                    "cod_colaborador"
                )
            )

            nome_exibicao = texto(
                pessoa.get(
                    "nome_exibicao"
                )
            )

            metodo_identificacao = texto(
                pessoa.get(
                    "metodo_identificacao"
                )
            )

            situacao_motorista = texto(
                pessoa.get(
                    "situacao_motorista"
                )
            )

        else:

            status_cadastro = (
                "FORA_CADASTRO_COBLI_ATUAL"
            )

            cod_colaborador = ""
            nome_exibicao = ""
            metodo_identificacao = ""
            situacao_motorista = ""

        resultados.append(
            {
                "driver_id_cobli":
                    driver_id,

                # Somente Prata/backend.
                "driver_name_cobli":
                    driver_name,

                "status_cadastro_cobli":
                    status_cadastro,

                "cod_colaborador":
                    cod_colaborador,

                "nome_exibicao":
                    nome_exibicao,

                "metodo_identificacao":
                    metodo_identificacao,

                "situacao_motorista":
                    situacao_motorista,

                "janela_inicio":
                    texto(
                        bronze.get(
                            "janela_inicio"
                        )
                    ),

                "janela_fim":
                    texto(
                        bronze.get(
                            "janela_fim"
                        )
                    ),

                # -------------------------
                # EXPOSICAO / USO
                # -------------------------

                "distancia_km":
                    numero(
                        r.get(
                            "driven_distance_in_kms"
                        )
                    ),

                "tempo_dirigido_min":
                    numero(
                        r.get(
                            "driven_time_in_minutes"
                        )
                    ),

                # -------------------------
                # COMPORTAMENTO
                # -------------------------

                "aceleracao_brusca_qtd":
                    inteiro(
                        r.get(
                            "fast_acceleration_events_count"
                        )
                    ),

                "frenagem_brusca_qtd":
                    inteiro(
                        r.get(
                            "hard_break_events_count"
                        )
                    ),

                "curva_brusca_qtd":
                    inteiro(
                        r.get(
                            "speedy_turn_events_count"
                        )
                    ),

                "direcao_distraida_qtd":
                    inteiro(
                        r.get(
                            "distracted_driving_events_count"
                        )
                    ),

                "uso_celular_qtd":
                    inteiro(
                        r.get(
                            "phone_usage_events_count"
                        )
                    ),

                "olhos_fechados_qtd":
                    inteiro(
                        r.get(
                            "eyes_closed_events_count"
                        )
                    ),

                "bocejo_qtd":
                    inteiro(
                        r.get(
                            "yawn_events_count"
                        )
                    ),

                "fumo_qtd":
                    inteiro(
                        r.get(
                            "smoking_events_count"
                        )
                    ),

                "distancia_insegura_qtd":
                    inteiro(
                        r.get(
                            "tailgating_events_count"
                        )
                    ),

                # -------------------------
                # VELOCIDADE - VIA
                # -------------------------

                "velocidade_via_eventos_qtd":
                    inteiro(
                        r.get(
                            "speed_events_count"
                        )
                    ),

                "velocidade_via_tempo_acima_min":
                    numero(
                        r.get(
                            "driven_time_above_limit_in_minutes"
                        )
                    ),

                "velocidade_via_percentual_tempo_acima":
                    numero(
                        r.get(
                            "time_above_limit_percentage"
                        )
                    ),

                "velocidade_via_km_por_evento":
                    numero(
                        r.get(
                            "kms_per_event"
                        )
                    ),

                # -------------------------
                # VELOCIDADE - VEICULO
                # -------------------------

                "velocidade_veiculo_eventos_qtd":
                    inteiro(
                        v.get(
                            "speed_events_count"
                        )
                    ),

                "velocidade_veiculo_tempo_acima_min":
                    numero(
                        v.get(
                            "driven_time_above_limit_in_minutes"
                        )
                    ),

                "velocidade_veiculo_percentual_tempo_acima":
                    numero(
                        v.get(
                            "time_above_limit_percentage"
                        )
                    ),

                "velocidade_veiculo_km_por_evento":
                    numero(
                        v.get(
                            "kms_per_event"
                        )
                    ),
            }
        )

    df = pd.DataFrame(
        resultados
    )

    # ---------------------------------------------------------
    # VALIDACOES BASICAS
    # ---------------------------------------------------------

    if len(df) != len(ids_road):

        raise RuntimeError(
            "Quantidade tratada diverge "
            "da Bronze."
        )

    if df[
        "driver_id_cobli"
    ].duplicated().any():

        raise RuntimeError(
            "driver_id_cobli duplicado "
            "na Prata Safety."
        )

    if df[
        "driver_id_cobli"
    ].eq("").any():

        raise RuntimeError(
            "driver_id_cobli vazio."
        )

    # ---------------------------------------------------------
    # GRAVACAO
    # ---------------------------------------------------------

    PASTA_PRATA.mkdir(
        parents=True,
        exist_ok=True,
    )

    df.to_csv(
        ARQUIVO_SAIDA,
        sep=";",
        index=False,
        encoding="utf-8-sig",
    )

    # ---------------------------------------------------------
    # RESUMO
    # ---------------------------------------------------------

    atuais = int(
        (
            df[
                "status_cadastro_cobli"
            ]
            == "CADASTRO_COBLI_ATUAL"
        ).sum()
    )

    fora = int(
        (
            df[
                "status_cadastro_cobli"
            ]
            == (
                "FORA_CADASTRO_COBLI_ATUAL"
            )
        ).sum()
    )

    diferenca_velocidade = int(
        (
            (
                df[
                    "velocidade_via_eventos_qtd"
                ]
                !=
                df[
                    "velocidade_veiculo_eventos_qtd"
                ]
            )
            |
            (
                df[
                    "velocidade_via_tempo_acima_min"
                ]
                !=
                df[
                    "velocidade_veiculo_tempo_acima_min"
                ]
            )
            |
            (
                df[
                    "velocidade_via_percentual_tempo_acima"
                ]
                !=
                df[
                    "velocidade_veiculo_percentual_tempo_acima"
                ]
            )
            |
            (
                df[
                    "velocidade_via_km_por_evento"
                ]
                !=
                df[
                    "velocidade_veiculo_km_por_evento"
                ]
            )
        ).sum()
    )

    print()
    print(
        "Bronze:",
        bronze_arquivo.name,
    )

    print(
        "Motoristas Safety:",
        len(df),
    )

    print(
        "No cadastro Cobli atual:",
        atuais,
    )

    print(
        "Fora do cadastro Cobli atual:",
        fora,
    )

    print(
        "Com diferenca entre "
        "criterios de velocidade:",
        diferenca_velocidade,
    )

    print()
    print(
        "Distancia total km:",
        round(
            df[
                "distancia_km"
            ].sum(),
            2,
        ),
    )

    print(
        "Tempo dirigido total min:",
        round(
            df[
                "tempo_dirigido_min"
            ].sum(),
            2,
        ),
    )

    print()
    print("EVENTOS DE CONDUCAO:")

    for coluna in [
        "aceleracao_brusca_qtd",
        "frenagem_brusca_qtd",
        "curva_brusca_qtd",
        "direcao_distraida_qtd",
        "uso_celular_qtd",
        "olhos_fechados_qtd",
        "bocejo_qtd",
        "fumo_qtd",
        "distancia_insegura_qtd",
    ]:

        print(
            f"  {coluna}: "
            f"{int(df[coluna].sum())}"
        )

    print()
    print("VELOCIDADE:")

    print(
        "  eventos criterio via:",
        int(
            df[
                "velocidade_via_eventos_qtd"
            ].sum()
        ),
    )

    print(
        "  eventos criterio veiculo:",
        int(
            df[
                "velocidade_veiculo_eventos_qtd"
            ].sum()
        ),
    )

    print()
    print(
        "Prata:",
        ARQUIVO_SAIDA,
    )

    print()
    print("=" * 72)
    print(
        "PRATA SEGURANCA MOTORISTAS "
        "CONCLUIDA"
    )
    print("=" * 72)


if __name__ == "__main__":

    try:
        tratar()

    except Exception as erro:

        print(
            f"ERRO: {erro}",
            file=sys.stderr,
        )

        sys.exit(1)
