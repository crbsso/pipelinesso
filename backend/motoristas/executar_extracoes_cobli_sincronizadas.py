from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import os
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]

TIMEZONE = "America/Sao_Paulo"
DIAS_JANELA = 7


def executar(
    script,
    env,
):

    caminho = (
        ROOT
        / "backend"
        / "motoristas"
        / script
    )

    print()
    print("=" * 80)
    print(
        "EXECUTANDO:",
        script,
    )
    print("=" * 80)

    resultado = subprocess.run(
        [
            sys.executable,
            str(caminho),
        ],
        cwd=str(ROOT),
        env=env,
    )

    if resultado.returncode != 0:

        raise RuntimeError(
            f"{script} falhou com "
            f"codigo {resultado.returncode}."
        )


def main():

    tz = ZoneInfo(
        TIMEZONE
    )

    fim = datetime.now(
        tz
    )

    inicio = (
        fim
        - timedelta(
            days=DIAS_JANELA
        )
    )

    inicio_iso = inicio.isoformat()
    fim_iso = fim.isoformat()

    print("=" * 80)
    print("JANELA UNICA COBLI")
    print("=" * 80)

    print(
        "Timezone:",
        TIMEZONE,
    )

    print(
        "Inicio:",
        inicio_iso,
    )

    print(
        "Fim:",
        fim_iso,
    )

    env = os.environ.copy()

    env[
        "COBLI_JANELA_INICIO"
    ] = inicio_iso

    env[
        "COBLI_JANELA_FIM"
    ] = fim_iso

    executar(
        "extrair_cobli_trips_stops.py",
        env,
    )

    executar(
        "extrair_cobli_safety_driver.py",
        env,
    )

    print()
    print("=" * 80)
    print(
        "EXTRACOES COBLI "
        "SINCRONIZADAS CONCLUIDAS"
    )
    print("=" * 80)

    print(
        "Inicio comum:",
        inicio_iso,
    )

    print(
        "Fim comum:",
        fim_iso,
    )


if __name__ == "__main__":
    main()
