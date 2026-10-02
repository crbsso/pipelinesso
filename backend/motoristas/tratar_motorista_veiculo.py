from pathlib import Path
import hashlib
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
    / "motorista_veiculo.csv"
)


def texto(valor):

    if valor is None:
        return ""

    return str(valor).strip()


def localizar_bronze():

    arquivos = sorted(
        PASTA_BRONZE.glob(
            "cobli_trips_stops_*.json"
        ),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    if not arquivos:
        raise RuntimeError(
            "Bronze trips-and-stops "
            "nao encontrada."
        )

    return arquivos[0]


def carregar_eventos():

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
        raise RuntimeError(
            "Bronze sem payload.data.rows "
            "em formato de lista."
        )

    return (
        arquivo,
        rows,
    )


def carregar_motoristas():

    if not ARQUIVO_MOTORISTAS.exists():
        raise RuntimeError(
            "Prata motoristas.csv "
            "nao encontrada."
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

    return df


def hash_evento(registro):

    canonico = json.dumps(
        registro,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )

    return hashlib.sha256(
        canonico.encode("utf-8")
    ).hexdigest()


def numero(valor):

    if valor is None:
        return None

    try:
        return float(valor)

    except (
        TypeError,
        ValueError,
    ):
        return None


def tratar():

    print("=" * 72)
    print("PRATA MOTORISTA x VEICULO")
    print("=" * 72)

    bronze_arquivo, eventos = (
        carregar_eventos()
    )

    motoristas = carregar_motoristas()

    cadastro = (
        motoristas
        .set_index(
            "driver_id_cobli",
            drop=False,
        )
        .to_dict(
            orient="index"
        )
    )

    # ---------------------------------------------------------
    # VERIFICA DUPLICACAO REAL DO PAYLOAD
    # ---------------------------------------------------------

    hashes = [
        hash_evento(
            registro
        )
        for registro in eventos
    ]

    duplicados_exatos = (
        len(hashes)
        - len(set(hashes))
    )

    if duplicados_exatos:
        raise RuntimeError(
            "Foram encontradas "
            f"{duplicados_exatos} linhas "
            "exatamente duplicadas na Bronze. "
            "Interrompendo tratamento."
        )

    resultados = []

    for registro, evento_id in zip(
        eventos,
        hashes,
    ):

        driver = registro.get(
            "driver"
        )

        vehicle = registro.get(
            "vehicle"
        )

        if not isinstance(
            driver,
            dict,
        ):
            driver = {}

        if not isinstance(
            vehicle,
            dict,
        ):
            vehicle = {}

        driver_id = texto(
            driver.get("id")
        )

        driver_name = texto(
            driver.get("name")
        )

        vehicle_id = texto(
            vehicle.get("id")
        )

        if not vehicle_id:
            raise RuntimeError(
                "Evento sem vehicle.id."
            )

        # -----------------------------------------------------
        # IDENTIDADE DO MOTORISTA
        # -----------------------------------------------------

        nome_exibicao = ""
        cod_colaborador = ""
        situacao_motorista = ""
        metodo_identificacao = ""

        if not driver_id:

            situacao_vinculo_evento = (
                "SEM_MOTORISTA_IDENTIFICADO_COBLI"
            )

        elif driver_id in cadastro:

            pessoa = cadastro[
                driver_id
            ]

            nome_exibicao = texto(
                pessoa.get(
                    "nome_exibicao"
                )
            )

            cod_colaborador = texto(
                pessoa.get(
                    "cod_colaborador"
                )
            )

            situacao_motorista = texto(
                pessoa.get(
                    "situacao_motorista"
                )
            )

            metodo_identificacao = texto(
                pessoa.get(
                    "metodo_identificacao"
                )
            )

            if (
                situacao_motorista
                == "ATIVO_REGULAR"
            ):

                situacao_vinculo_evento = (
                    "MOTORISTA_ATIVO"
                )

            elif (
                situacao_motorista
                == "PENDENTE_DESATIVACAO_COBLI"
            ):

                situacao_vinculo_evento = (
                    "MOTORISTA_PENDENTE_DESATIVACAO"
                )

            elif (
                situacao_motorista
                == "SEM_IDENTIDADE_RM"
            ):

                situacao_vinculo_evento = (
                    "MOTORISTA_SEM_IDENTIDADE_RM"
                )

            else:

                situacao_vinculo_evento = (
                    "MOTORISTA_REVISAR"
                )

        else:

            situacao_vinculo_evento = (
                "DRIVER_NAO_ENCONTRADO_CADASTRO_COBLI"
            )

        # -----------------------------------------------------
        # TIPO DO EVENTO
        # -----------------------------------------------------

        distancia = numero(
            registro.get(
                "driven_distance_in_kms"
            )
        )

        duracao_viagem = numero(
            registro.get(
                "trip_duration_in_minutes"
            )
        )

        if (
            distancia is not None
            or duracao_viagem is not None
        ):

            tipo_evento = "VIAGEM"

        else:

            tipo_evento = "PARADA"

        resultados.append(
            {
                "evento_id":
                    evento_id,

                "cobli_id":
                    texto(
                        registro.get(
                            "cobli_id"
                        )
                    ),

                "tipo_evento":
                    tipo_evento,

                "driver_id_cobli":
                    driver_id,

                # interno da Prata
                "driver_name_cobli":
                    driver_name,

                "cod_colaborador":
                    cod_colaborador,

                "nome_exibicao":
                    nome_exibicao,

                "metodo_identificacao":
                    metodo_identificacao,

                "situacao_motorista":
                    situacao_motorista,

                "situacao_vinculo_evento":
                    situacao_vinculo_evento,

                "vehicle_id_cobli":
                    vehicle_id,

                "placa":
                    texto(
                        vehicle.get(
                            "license_plate"
                        )
                    ),

                "marca":
                    texto(
                        vehicle.get(
                            "brand"
                        )
                    ),

                "modelo":
                    texto(
                        vehicle.get(
                            "model"
                        )
                    ),

                "alias_veiculo":
                    texto(
                        vehicle.get(
                            "alias"
                        )
                    ),

                "inicio":
                    texto(
                        registro.get(
                            "start_time"
                        )
                    ),

                "fim":
                    texto(
                        registro.get(
                            "end_time"
                        )
                    ),

                "distancia_km":
                    distancia,

                "duracao_viagem_min":
                    duracao_viagem,

                "duracao_parada_min":
                    numero(
                        registro.get(
                            "stop_duration_in_minutes"
                        )
                    ),

                "marcha_lenta_min":
                    numero(
                        registro.get(
                            "idle_engine_duration_in_minutes"
                        )
                    ),
            }
        )

    df = pd.DataFrame(
        resultados
    )

    # ---------------------------------------------------------
    # VALIDACOES
    # ---------------------------------------------------------

    if len(df) != len(eventos):
        raise RuntimeError(
            "Quantidade da Prata diverge "
            "da Bronze."
        )

    if df[
        "evento_id"
    ].duplicated().any():

        raise RuntimeError(
            "evento_id duplicado."
        )

    if df[
        "vehicle_id_cobli"
    ].eq("").any():

        raise RuntimeError(
            "Existe evento sem vehicle_id."
        )

    # ---------------------------------------------------------
    # DATA AUXILIAR
    # ---------------------------------------------------------

    data_base = pd.to_datetime(
        df["inicio"],
        errors="coerce",
        utc=True,
    )

    sem_inicio = data_base.isna()

    if sem_inicio.any():

        data_fim = pd.to_datetime(
            df.loc[
                sem_inicio,
                "fim",
            ],
            errors="coerce",
            utc=True,
        )

        data_base.loc[
            sem_inicio
        ] = data_fim

    df["data_evento"] = (
        data_base
        .dt.strftime(
            "%Y-%m-%d"
        )
        .fillna("")
    )

    df["ano_evento"] = (
        data_base
        .dt.strftime(
            "%Y"
        )
        .fillna("")
    )

    df["mes_evento"] = (
        data_base
        .dt.strftime(
            "%m"
        )
        .fillna("")
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

    print()
    print(
        "Bronze:",
        bronze_arquivo.name,
    )

    print(
        "Eventos Bronze:",
        len(eventos),
    )

    print(
        "Eventos Prata:",
        len(df),
    )

    print()
    print("TIPO EVENTO:")
    print(
        df[
            "tipo_evento"
        ]
        .value_counts()
        .to_string()
    )

    print()
    print(
        "SITUACAO DO VINCULO:"
    )

    print(
        df[
            "situacao_vinculo_evento"
        ]
        .value_counts()
        .to_string()
    )

    print()
    print(
        "Motoristas distintos nos eventos:",
        df.loc[
            df[
                "driver_id_cobli"
            ].ne(""),
            "driver_id_cobli",
        ].nunique(),
    )

    print(
        "Veiculos distintos nos eventos:",
        df[
            "vehicle_id_cobli"
        ].nunique(),
    )

    print()
    print(
        "Distancia total km:",
        round(
            df[
                "distancia_km"
            ]
            .fillna(0)
            .sum(),
            2,
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
        "PRATA MOTORISTA x VEICULO "
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
