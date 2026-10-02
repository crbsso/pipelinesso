from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import json
import os
import sys


ROOT = Path(__file__).resolve().parents[2]

if str(ROOT) not in sys.path:
    sys.path.insert(
        0,
        str(ROOT),
    )

import backend.motoristas.extrair_cobli_motoristas as cobli


PASTA_BRONZE = (
    ROOT
    / "data"
    / "bronze"
    / "motoristas"
)

DIAS_JANELA = 7

TIPOS_VELOCIDADE = [
    "ROAD_SPEED_EVENT",
    "VEHICLE_SPEED_EVENT",
]




def resolver_janela():
    """
    Resolve a janela temporal usada pela Cobli.

    Se COBLI_JANELA_INICIO e COBLI_JANELA_FIM
    estiverem definidos, os dois extratores usam
    exatamente a mesma janela.

    Caso contrario, preserva o comportamento
    standalone de ultimos 7 dias.
    """

    tz = ZoneInfo(
        "America/Sao_Paulo"
    )

    inicio_env = os.getenv(
        "COBLI_JANELA_INICIO",
        "",
    ).strip()

    fim_env = os.getenv(
        "COBLI_JANELA_FIM",
        "",
    ).strip()

    if bool(inicio_env) != bool(fim_env):

        raise RuntimeError(
            "COBLI_JANELA_INICIO e "
            "COBLI_JANELA_FIM devem ser "
            "informados juntos."
        )

    if inicio_env and fim_env:

        try:
            inicio = datetime.fromisoformat(
                inicio_env
            )

            fim = datetime.fromisoformat(
                fim_env
            )

        except ValueError as erro:

            raise RuntimeError(
                "Janela Cobli externa possui "
                "formato ISO invalido."
            ) from erro

        if (
            inicio.tzinfo is None
            or fim.tzinfo is None
        ):

            raise RuntimeError(
                "Janela Cobli externa precisa "
                "conter timezone/offset."
            )

        inicio = inicio.astimezone(
            tz
        )

        fim = fim.astimezone(
            tz
        )

    else:

        fim = datetime.now(
            tz
        )

        inicio = (
            fim
            - timedelta(
                days=7
            )
        )

    if fim <= inicio:

        raise RuntimeError(
            "Janela Cobli invalida: "
            "fim deve ser posterior ao inicio."
        )

    return inicio, fim


def requisitar(
    url,
    api_key,
    tipo,
    inicio,
    fim,
):

    body = {
        "start_date":
            inicio.isoformat(
                timespec="seconds"
            ),

        "end_date":
            fim.isoformat(
                timespec="seconds"
            ),

        "timezone":
            "America/Sao_Paulo",

        "speed_event_type":
            tipo,
    }

    req = Request(
        url,
        data=json.dumps(
            body
        ).encode("utf-8"),
        headers={
            "accept":
                "application/json",

            "content-type":
                "application/json",

            "cobli-api-key":
                api_key,
        },
        method="POST",
    )

    try:

        with urlopen(
            req,
            timeout=90,
        ) as resposta:

            status = resposta.status

            payload = json.loads(
                resposta.read()
                .decode("utf-8")
            )

    except HTTPError as erro:

        corpo = (
            erro.read()
            .decode(
                "utf-8",
                errors="replace",
            )
        )

        raise RuntimeError(
            f"{tipo}: "
            f"HTTP {erro.code}: "
            f"{corpo[:500]}"
        ) from erro

    except URLError as erro:

        raise RuntimeError(
            f"{tipo}: "
            f"falha de conexao: {erro}"
        ) from erro

    if status != 200:
        raise RuntimeError(
            f"{tipo}: "
            f"status inesperado {status}"
        )

    return payload


def validar_payload(
    payload,
    tipo,
):

    data = payload.get(
        "data"
    )

    if not isinstance(
        data,
        dict,
    ):
        raise RuntimeError(
            f"{tipo}: data invalido."
        )

    rows = data.get(
        "rows"
    )

    if not isinstance(
        rows,
        list,
    ):
        raise RuntimeError(
            f"{tipo}: rows invalido."
        )

    count = data.get(
        "count"
    )

    if (
        isinstance(count, int)
        and count != len(rows)
    ):
        raise RuntimeError(
            f"{tipo}: count={count} "
            f"mas rows={len(rows)}."
        )

    ids = []

    for registro in rows:

        driver = registro.get(
            "driver"
        )

        if not isinstance(
            driver,
            dict,
        ):
            raise RuntimeError(
                f"{tipo}: registro "
                "sem driver dict."
            )

        driver_id = str(
            driver.get(
                "id",
                ""
            )
        ).strip()

        if not driver_id:
            raise RuntimeError(
                f"{tipo}: driver sem id."
            )

        ids.append(
            driver_id
        )

    if len(ids) != len(set(ids)):
        raise RuntimeError(
            f"{tipo}: driver_id duplicado."
        )

    return rows


def indexar(rows):

    return {
        str(
            registro[
                "driver"
            ][
                "id"
            ]
        ).strip():
            registro

        for registro in rows
    }


def extrair():

    print("=" * 72)
    print("EXTRACAO COBLI - SAFETY DRIVER")
    print("=" * 72)

    if hasattr(
        cobli,
        "carregar_env",
    ):
        cobli.carregar_env()

    base_url, api_key = (
        cobli.obter_configuracao_cobli()
    )

    api_url = (
        f"{base_url}"
        "/public/v1/safety/driver"
    )
    inicio, fim = resolver_janela()


    payloads = {}
    rows_por_tipo = {}

    for tipo in TIPOS_VELOCIDADE:

        print()
        print(
            "Consultando:",
            tipo,
        )

        payload = requisitar(
            api_url,
            api_key,
            tipo,
            inicio,
            fim,
        )

        rows = validar_payload(
            payload,
            tipo,
        )

        payloads[tipo] = payload
        rows_por_tipo[tipo] = rows

        print(
            "Registros:",
            len(rows),
        )

    road = indexar(
        rows_por_tipo[
            "ROAD_SPEED_EVENT"
        ]
    )

    vehicle = indexar(
        rows_por_tipo[
            "VEHICLE_SPEED_EVENT"
        ]
    )

    ids_road = set(
        road.keys()
    )

    ids_vehicle = set(
        vehicle.keys()
    )

    if ids_road != ids_vehicle:

        raise RuntimeError(
            "ROAD e VEHICLE possuem "
            "conjuntos diferentes "
            "de driver_id."
        )

    campos_speed = [
        "speed_events_count",
        "driven_time_above_limit_in_minutes",
        "time_above_limit_percentage",
        "kms_per_event",
    ]

    diferencas_speed = 0

    for driver_id in ids_road:

        r = road[
            driver_id
        ]

        v = vehicle[
            driver_id
        ]

        if any(
            r.get(campo)
            != v.get(campo)

            for campo
            in campos_speed
        ):
            diferencas_speed += 1

    agora_utc = datetime.now(
        timezone.utc
    )

    timestamp = (
        agora_utc.strftime(
            "%Y%m%dT%H%M%SZ"
        )
    )

    PASTA_BRONZE.mkdir(
        parents=True,
        exist_ok=True,
    )

    arquivo = (
        PASTA_BRONZE
        / (
            "cobli_safety_driver_"
            f"{timestamp}.json"
        )
    )

    bronze = {
        "fonte":
            "COBLI",

        "endpoint":
            api_url,

        "extraido_em_utc":
            agora_utc.isoformat(),

        "janela_inicio":
            inicio.isoformat(),

        "janela_fim":
            fim.isoformat(),

        "timezone":
            "America/Sao_Paulo",

        "payloads":
            payloads,
    }

    arquivo.write_text(
        json.dumps(
            bronze,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print()
    print(
        "Drivers ROAD:",
        len(road),
    )

    print(
        "Drivers VEHICLE:",
        len(vehicle),
    )

    print(
        "Drivers comuns:",
        len(
            ids_road
            & ids_vehicle
        ),
    )

    print(
        "Drivers com diferenca "
        "nas metricas dependentes "
        "de velocidade:",
        diferencas_speed,
    )

    print()
    print(
        "Bronze:",
        arquivo,
    )

    print()
    print("=" * 72)
    print(
        "BRONZE SAFETY DRIVER "
        "GERADA COM SUCESSO"
    )
    print("=" * 72)


if __name__ == "__main__":

    try:
        extrair()

    except Exception as erro:

        print(
            f"ERRO: {erro}",
            file=sys.stderr,
        )

        sys.exit(1)
