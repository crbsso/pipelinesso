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

ARQUIVO_PRATA = (
    ROOT
    / "data"
    / "prata"
    / "motoristas"
    / "seguranca_motoristas.csv"
)

ARQUIVO_MOTORISTAS = (
    ROOT
    / "data"
    / "prata"
    / "motoristas"
    / "motoristas.csv"
)

TIPO_ROAD = "ROAD_SPEED_EVENT"
TIPO_VEHICLE = "VEHICLE_SPEED_EVENT"


def falhar(msg):
    raise RuntimeError(
        "QUALITY GATE REPROVADO: "
        + msg
    )


def texto(valor):
    if valor is None:
        return ""

    return str(valor).strip()


def numero(valor):
    if valor is None:
        return 0.0

    try:
        return float(valor)

    except (
        TypeError,
        ValueError,
    ):
        falhar(
            f"valor numerico invalido: {valor}"
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
        falhar(
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
        "payloads",
        {}
    )

    resultado = {}

    for tipo in [
        TIPO_ROAD,
        TIPO_VEHICLE,
    ]:

        rows = (
            payloads
            .get(tipo, {})
            .get("data", {})
            .get("rows", [])
        )

        if not isinstance(
            rows,
            list,
        ):
            falhar(
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
                falhar(
                    f"{tipo}: driver invalido."
                )

            driver_id = texto(
                driver.get("id")
            )

            if not driver_id:
                falhar(
                    f"{tipo}: driver sem id."
                )

            if driver_id in indice:
                falhar(
                    f"{tipo}: driver duplicado."
                )

            indice[
                driver_id
            ] = registro

        resultado[
            tipo
        ] = indice

    return (
        arquivo,
        resultado,
    )


def validar():

    print("=" * 72)
    print("QUALITY GATE - SEGURANCA MOTORISTAS")
    print("=" * 72)

    bronze_arquivo, fontes = (
        carregar_bronze()
    )

    if not ARQUIVO_PRATA.exists():
        falhar(
            "seguranca_motoristas.csv "
            "nao encontrada."
        )

    prata = pd.read_csv(
        ARQUIVO_PRATA,
        sep=";",
        dtype=str,
        encoding="utf-8-sig",
    ).fillna("")

    motoristas = pd.read_csv(
        ARQUIVO_MOTORISTAS,
        sep=";",
        dtype=str,
        encoding="utf-8-sig",
    ).fillna("")

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

    ids_prata = set(
        prata[
            "driver_id_cobli"
        ]
        .astype(str)
        .str.strip()
    )

    ids_cadastro = set(
        motoristas[
            "driver_id_cobli"
        ]
        .astype(str)
        .str.strip()
    )

    ids_cadastro.discard("")

    print()
    print(
        "Bronze:",
        bronze_arquivo.name,
    )

    print(
        "Drivers ROAD:",
        len(ids_road),
    )

    print(
        "Drivers VEHICLE:",
        len(ids_vehicle),
    )

    print(
        "Drivers Prata:",
        len(prata),
    )

    # -----------------------------------------------------
    # 1. CONSERVACAO
    # -----------------------------------------------------

    if ids_road != ids_vehicle:
        falhar(
            "ROAD e VEHICLE possuem "
            "drivers diferentes."
        )

    if ids_prata != ids_road:
        falhar(
            "IDs da Prata divergem "
            "da Bronze."
        )

    if len(prata) != len(ids_road):
        falhar(
            "quantidade de linhas diverge."
        )

    if prata[
        "driver_id_cobli"
    ].duplicated().any():

        falhar(
            "driver_id duplicado."
        )

    # -----------------------------------------------------
    # 2. CONTRATO
    # -----------------------------------------------------

    obrigatorias = {
        "driver_id_cobli",
        "driver_name_cobli",
        "status_cadastro_cobli",
        "cod_colaborador",
        "nome_exibicao",
        "metodo_identificacao",
        "situacao_motorista",
        "janela_inicio",
        "janela_fim",
        "distancia_km",
        "tempo_dirigido_min",
        "aceleracao_brusca_qtd",
        "frenagem_brusca_qtd",
        "curva_brusca_qtd",
        "direcao_distraida_qtd",
        "uso_celular_qtd",
        "olhos_fechados_qtd",
        "bocejo_qtd",
        "fumo_qtd",
        "distancia_insegura_qtd",
        "velocidade_via_eventos_qtd",
        "velocidade_via_tempo_acima_min",
        "velocidade_via_percentual_tempo_acima",
        "velocidade_via_km_por_evento",
        "velocidade_veiculo_eventos_qtd",
        "velocidade_veiculo_tempo_acima_min",
        "velocidade_veiculo_percentual_tempo_acima",
        "velocidade_veiculo_km_por_evento",
    }

    ausentes = (
        obrigatorias
        - set(prata.columns)
    )

    if ausentes:
        falhar(
            "colunas ausentes: "
            + ", ".join(
                sorted(ausentes)
            )
        )

    # -----------------------------------------------------
    # 3. STATUS CADASTRO
    # -----------------------------------------------------

    permitidos = {
        "CADASTRO_COBLI_ATUAL",
        "FORA_CADASTRO_COBLI_ATUAL",
    }

    encontrados = set(
        prata[
            "status_cadastro_cobli"
        ].unique()
    )

    if not encontrados.issubset(
        permitidos
    ):
        falhar(
            "status_cadastro_cobli "
            "invalido."
        )

    atuais = prata[
        prata[
            "status_cadastro_cobli"
        ]
        == "CADASTRO_COBLI_ATUAL"
    ]

    fora = prata[
        prata[
            "status_cadastro_cobli"
        ]
        == "FORA_CADASTRO_COBLI_ATUAL"
    ]

    ids_atuais = set(
        atuais[
            "driver_id_cobli"
        ]
    )

    ids_fora = set(
        fora[
            "driver_id_cobli"
        ]
    )

    if ids_atuais != (
        ids_road
        & ids_cadastro
    ):
        falhar(
            "classificacao de cadastro "
            "atual inconsistente."
        )

    if ids_fora != (
        ids_road
        - ids_cadastro
    ):
        falhar(
            "classificacao fora do cadastro "
            "inconsistente."
        )

    # -----------------------------------------------------
    # 4. PRIVACIDADE / IDENTIDADE
    # -----------------------------------------------------

    if fora[
        "nome_exibicao"
    ].ne("").any():
        falhar(
            "driver fora do cadastro "
            "recebeu nome_exibicao."
        )

    if fora[
        "cod_colaborador"
    ].ne("").any():
        falhar(
            "driver fora do cadastro "
            "recebeu cod_colaborador."
        )

    vinculados_rm = atuais[
        atuais[
            "situacao_motorista"
        ].isin(
            [
                "ATIVO_REGULAR",
                "PENDENTE_DESATIVACAO_COBLI",
            ]
        )
    ]

    if vinculados_rm[
        "nome_exibicao"
    ].eq("").any():
        falhar(
            "motorista identificado no RM "
            "sem nome_exibicao."
        )

    # -----------------------------------------------------
    # 5. VALORES NAO NEGATIVOS
    # -----------------------------------------------------

    colunas_numericas = [
        "distancia_km",
        "tempo_dirigido_min",
        "aceleracao_brusca_qtd",
        "frenagem_brusca_qtd",
        "curva_brusca_qtd",
        "direcao_distraida_qtd",
        "uso_celular_qtd",
        "olhos_fechados_qtd",
        "bocejo_qtd",
        "fumo_qtd",
        "distancia_insegura_qtd",
        "velocidade_via_eventos_qtd",
        "velocidade_via_tempo_acima_min",
        "velocidade_via_percentual_tempo_acima",
        "velocidade_via_km_por_evento",
        "velocidade_veiculo_eventos_qtd",
        "velocidade_veiculo_tempo_acima_min",
        "velocidade_veiculo_percentual_tempo_acima",
        "velocidade_veiculo_km_por_evento",
    ]

    for coluna in colunas_numericas:

        valores = pd.to_numeric(
            prata[
                coluna
            ],
            errors="coerce",
        )

        if valores.isna().any():
            falhar(
                f"{coluna} possui "
                "valor nao numerico."
            )

        if (
            valores < 0
        ).any():
            falhar(
                f"{coluna} possui "
                "valor negativo."
            )

    # -----------------------------------------------------
    # 6. PERCENTUAIS
    # -----------------------------------------------------

    # O criterio VEHICLE deve permanecer entre 0 e 100.
    # Para ROAD, a Cobli pode retornar casos em que
    # driven_time_above_limit_in_minutes > driven_time_in_minutes,
    # produzindo percentual acima de 100.
    #
    # Nesses casos:
    # - preservamos o valor RAW;
    # - validamos sua consistencia matematica;
    # - registramos aviso;
    # - nao bloqueamos a Prata apenas por ultrapassar 100.

    percentual_vehicle = pd.to_numeric(
        prata[
            "velocidade_veiculo_percentual_tempo_acima"
        ],
        errors="raise",
    )

    if (
        (percentual_vehicle < 0)
        | (percentual_vehicle > 100)
    ).any():

        falhar(
            "velocidade_veiculo_percentual_tempo_acima "
            "fora do intervalo 0-100."
        )

    percentual_road = pd.to_numeric(
        prata[
            "velocidade_via_percentual_tempo_acima"
        ],
        errors="raise",
    )

    tempo_total = pd.to_numeric(
        prata[
            "tempo_dirigido_min"
        ],
        errors="raise",
    )

    tempo_acima = pd.to_numeric(
        prata[
            "velocidade_via_tempo_acima_min"
        ],
        errors="raise",
    )

    if (
        percentual_road < 0
    ).any():

        falhar(
            "velocidade_via_percentual_tempo_acima "
            "possui valor negativo."
        )

    # Tempo dirigido igual a zero somente pode coexistir
    # com tempo acima e percentual tamb?m iguais a zero.
    mask_tempo_zero = (
        tempo_total == 0
    )

    inconsistente_zero = (
        mask_tempo_zero
        &
        (
            (tempo_acima != 0)
            | (percentual_road != 0)
        )
    )

    if inconsistente_zero.any():

        falhar(
            "Existe registro ROAD com "
            "tempo_dirigido_min = 0, mas "
            "tempo acima ou percentual diferente de zero."
        )

    # Para tempo dirigido > 0, o percentual precisa ser
    # matematicamente coerente com:
    #
    # tempo_acima / tempo_total * 100
    #
    # Tolerancia de 0.11 ponto percentual para acomodar
    # arredondamento da propria API.
    mask_tempo_positivo = (
        tempo_total > 0
    )

    percentual_calculado = pd.Series(
        0.0,
        index=prata.index,
    )

    percentual_calculado.loc[
        mask_tempo_positivo
    ] = (
        tempo_acima.loc[
            mask_tempo_positivo
        ]
        /
        tempo_total.loc[
            mask_tempo_positivo
        ]
        * 100
    )

    diferenca = (
        percentual_road
        - percentual_calculado
    ).abs()

    inconsistentes = (
        mask_tempo_positivo
        &
        (
            diferenca > 0.11
        )
    )

    if inconsistentes.any():

        falhar(
            "velocidade_via_percentual_tempo_acima "
            "nao confere com "
            "tempo_acima / tempo_dirigido."
        )

    anomalias_fonte = (
        percentual_road > 100
    )

    qtd_anomalias_fonte = int(
        anomalias_fonte.sum()
    )

    if qtd_anomalias_fonte:

        print()
        print(
            "ATENCAO - ANOMALIA DA FONTE COBLI:"
        )

        print(
            "Percentual ROAD acima de 100%:",
            qtd_anomalias_fonte,
        )

        print(
            "Os valores foram preservados porque "
            "tambem existem na Bronze e sao "
            "matematicamente coerentes com "
            "tempo_acima / tempo_dirigido."
        )

    # -----------------------------------------------------
    # 7. CONSISTENCIA COM BRONZE
    # -----------------------------------------------------

    indice_prata = (
        prata
        .set_index(
            "driver_id_cobli"
        )
    )

    for driver_id in ids_road:

        r = road[
            driver_id
        ]

        v = vehicle[
            driver_id
        ]

        p = indice_prata.loc[
            driver_id
        ]

        checks = {
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

            "aceleracao_brusca_qtd":
                numero(
                    r.get(
                        "fast_acceleration_events_count"
                    )
                ),

            "frenagem_brusca_qtd":
                numero(
                    r.get(
                        "hard_break_events_count"
                    )
                ),

            "curva_brusca_qtd":
                numero(
                    r.get(
                        "speedy_turn_events_count"
                    )
                ),

            "velocidade_via_eventos_qtd":
                numero(
                    r.get(
                        "speed_events_count"
                    )
                ),

            "velocidade_veiculo_eventos_qtd":
                numero(
                    v.get(
                        "speed_events_count"
                    )
                ),
        }

        for coluna, esperado in (
            checks.items()
        ):

            atual = float(
                p[coluna]
            )

            if abs(
                atual - esperado
            ) > 0.000001:

                falhar(
                    f"{coluna} diverge "
                    "da Bronze."
                )

    # -----------------------------------------------------
    # RESUMO
    # -----------------------------------------------------

    diferenca_speed = (
        (
            pd.to_numeric(
                prata[
                    "velocidade_via_eventos_qtd"
                ]
            )
            !=
            pd.to_numeric(
                prata[
                    "velocidade_veiculo_eventos_qtd"
                ]
            )
        )
        |
        (
            pd.to_numeric(
                prata[
                    "velocidade_via_tempo_acima_min"
                ]
            )
            !=
            pd.to_numeric(
                prata[
                    "velocidade_veiculo_tempo_acima_min"
                ]
            )
        )
        |
        (
            pd.to_numeric(
                prata[
                    "velocidade_via_percentual_tempo_acima"
                ]
            )
            !=
            pd.to_numeric(
                prata[
                    "velocidade_veiculo_percentual_tempo_acima"
                ]
            )
        )
        |
        (
            pd.to_numeric(
                prata[
                    "velocidade_via_km_por_evento"
                ]
            )
            !=
            pd.to_numeric(
                prata[
                    "velocidade_veiculo_km_por_evento"
                ]
            )
        )
    ).sum()

    print()
    print(
        "Cadastro atual:",
        len(atuais),
    )

    print(
        "Fora cadastro atual:",
        len(fora),
    )

    print(
        "Diferenca criterios velocidade:",
        int(
            diferenca_speed
        ),
    )

    print()
    print(
        "Distancia total km:",
        round(
            pd.to_numeric(
                prata[
                    "distancia_km"
                ]
            ).sum(),
            2,
        ),
    )

    print(
        "Tempo total min:",
        round(
            pd.to_numeric(
                prata[
                    "tempo_dirigido_min"
                ]
            ).sum(),
            2,
        ),
    )

    print()
    print("EVENTOS:")

    resumo = [
        "aceleracao_brusca_qtd",
        "frenagem_brusca_qtd",
        "curva_brusca_qtd",
        "direcao_distraida_qtd",
        "uso_celular_qtd",
        "olhos_fechados_qtd",
        "bocejo_qtd",
        "fumo_qtd",
        "distancia_insegura_qtd",
        "velocidade_via_eventos_qtd",
        "velocidade_veiculo_eventos_qtd",
    ]

    for coluna in resumo:

        total = pd.to_numeric(
            prata[coluna]
        ).sum()

        print(
            f"  {coluna}: "
            f"{int(total)}"
        )

    print()
    print("=" * 72)
    print(
        "QUALITY GATE SEGURANCA MOTORISTAS: "
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
