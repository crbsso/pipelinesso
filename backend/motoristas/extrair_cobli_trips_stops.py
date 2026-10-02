from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import json
import os
import time
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
TAMANHO_PAGINA = 100




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
    body,
):

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
            f"Erro HTTP Cobli. "
            f"Status={erro.code}. "
            f"Resposta={corpo[:500]}"
        ) from erro

    except URLError as erro:

        raise RuntimeError(
            f"Falha de conexao Cobli: "
            f"{erro}"
        ) from erro

    if status != 200:

        raise RuntimeError(
            f"Status inesperado Cobli: "
            f"{status}"
        )

    return payload


def extrair():

    print("=" * 72)
    print("EXTRACAO COBLI - TRIPS AND STOPS")
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
        "/public/v1/trips-and-stops"
    )
    inicio, fim = resolver_janela()


    todos = []

    pagina = 0
    total_api = None

    while True:

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

            "page":
                pagina,

            "size":
                TAMANHO_PAGINA,
        }

        payload = requisitar(
            api_url,
            api_key,
            body,
        )

        data = payload.get(
            "data",
            {}
        )

        if not isinstance(
            data,
            dict,
        ):
            raise RuntimeError(
                "Cobli retornou data "
                "fora do formato esperado."
            )

        rows = data.get(
            "rows",
            []
        )

        if not isinstance(
            rows,
            list,
        ):
            raise RuntimeError(
                "Cobli retornou rows "
                "fora do formato esperado."
            )

        if total_api is None:
            total_api = data.get(
                "count"
            )

        print(
            f"Pagina {pagina}: "
            f"{len(rows)} registros"
        )

        if not rows:
            break

        todos.extend(
            rows
        )

        if (
            isinstance(
                total_api,
                int,
            )
            and len(todos)
            >= total_api
        ):
            break

        if (
            len(rows)
            < TAMANHO_PAGINA
        ):
            break

        pagina += 1

        time.sleep(
            0.15
        )

    # ---------------------------------------------------------
    # VALIDACOES
    # ---------------------------------------------------------

    cobli_ids = [
        str(
            item.get(
                "cobli_id",
                ""
            )
        ).strip()
        for item in todos
    ]

    vazios = sum(
        1
        for item in cobli_ids
        if not item
    )

    if vazios:
        raise RuntimeError(
            f"Existem {vazios} "
            "registros sem cobli_id."
        )

    cobli_ids_distintos = len(
        set(cobli_ids)
    )

    # cobli_id NAO e chave unica do evento.
    # O mesmo identificador aparece em varios
    # trajetos/paradas do periodo.
    #
    # Para diagnosticar duplicacao real de linhas,
    # comparamos o registro completo.
    registros_canonicos = [
        json.dumps(
            item,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        for item in todos
    ]

    linhas_exatas_duplicadas = (
        len(registros_canonicos)
        - len(
            set(
                registros_canonicos
            )
        )
    )

    if (
        isinstance(
            total_api,
            int,
        )
        and len(todos)
        != total_api
    ):
        raise RuntimeError(
            "Quantidade extraida diverge "
            "do total informado pela API. "
            f"API={total_api} / "
            f"Extraido={len(todos)}"
        )

    # ---------------------------------------------------------
    # GRAVACAO BRONZE
    # ---------------------------------------------------------

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
            "cobli_trips_stops_"
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

        "total_informado_api":
            total_api,

        "total_extraido":
            len(todos),

        "payload": {
            "data": {
                "count":
                    total_api,

                "rows":
                    todos,
            }
        },
    }

    arquivo.write_text(
        json.dumps(
            bronze,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    # ---------------------------------------------------------
    # RESUMO SEM DADOS SENSIVEIS
    # ---------------------------------------------------------

    com_driver = sum(
        1
        for item in todos
        if isinstance(
            item.get("driver"),
            dict,
        )
        and item["driver"].get(
            "id"
        )
    )

    com_vehicle = sum(
        1
        for item in todos
        if isinstance(
            item.get("vehicle"),
            dict,
        )
        and item["vehicle"].get(
            "id"
        )
    )

    viagens = sum(
        1
        for item in todos
        if (
            item.get(
                "driven_distance_in_kms"
            )
            is not None
            or item.get(
                "trip_duration_in_minutes"
            )
            is not None
        )
    )

    paradas = (
        len(todos)
        - viagens
    )

    print()
    print(
        "Total API:",
        total_api,
    )

    print(
        "Total extraido:",
        len(todos),
    )

    print(
        "cobli_id distintos:",
        cobli_ids_distintos,
    )

    print(
        "Linhas exatas duplicadas:",
        linhas_exatas_duplicadas,
    )

    print(
        "Com motorista:",
        com_driver,
    )

    print(
        "Sem motorista:",
        len(todos) - com_driver,
    )

    print(
        "Com veiculo:",
        com_vehicle,
    )

    print(
        "Viagens provaveis:",
        viagens,
    )

    print(
        "Paradas provaveis:",
        paradas,
    )

    print()
    print(
        "Bronze:",
        arquivo,
    )

    print()
    print("=" * 72)
    print(
        "BRONZE TRIPS AND STOPS "
        "GERADA COM SUCESSO"
    )
    print("=" * 72)


if __name__ == "__main__":
    extrair()
