import argparse
from datetime import date, datetime, time, timedelta
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
    argumentos=None,
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
            *(argumentos or []),
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

    parser = argparse.ArgumentParser(
        description="Extracoes sincronizadas da Cobli."
    )

    parser.add_argument("--inicio")
    parser.add_argument("--fim")

    args = parser.parse_args()

    if bool(args.inicio) != bool(args.fim):
        raise RuntimeError(
            "Informe --inicio e --fim conjuntamente."
        )

    tz = ZoneInfo(TIMEZONE)

    hoje = datetime.now(tz).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    if args.inicio:
        data_inicio = date.fromisoformat(args.inicio)
        data_fim = date.fromisoformat(args.fim)

        inicio = datetime.combine(
            data_inicio,
            time.min,
            tzinfo=tz,
        )

        fim = datetime.combine(
            data_fim,
            time.min,
            tzinfo=tz,
        )
    else:
        fim = hoje
        inicio = fim - timedelta(days=DIAS_JANELA)

    dias = (fim.date() - inicio.date()).days

    if not 1 <= dias <= DIAS_JANELA:
        raise RuntimeError(
            "A janela deve ter entre 1 e 7 dias."
        )

    if fim > hoje:
        raise RuntimeError(
            "A janela nao pode incluir o dia em andamento."
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

    # Eventos individuais de Velocidade nao entram no fluxo normal.
    # As extracoes de Viagens e Safety Driver continuam obrigatorias.
    print("Velocidade individual: NAO EXTRAIDA (em validacao).")

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
