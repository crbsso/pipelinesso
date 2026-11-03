"""Normalizacao explicita das datas recebidas da Cobli.

Contrato de eventos com fuso Sao Paulo validado em 02/10/2026
para road-speed-events. vehicle-speed-events requer auditoria
antes de liberar publicacoes.
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

SAO_PAULO = ZoneInfo("America/Sao_Paulo")


def horario_viagem_utc(valor):
    if not valor or not str(valor).strip():
        return None

    dt = datetime.fromisoformat(
        str(valor).strip().replace("Z", "+00:00")
    )

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=SAO_PAULO)

    return dt.astimezone(timezone.utc)


def horario_evento_utc(valor, timezone_consulta):
    if not valor or not str(valor).strip():
        return None

    dt = datetime.fromisoformat(
        str(valor).strip().replace("Z", "+00:00")
    )

    if dt.tzinfo is None:
        raise ValueError("Evento Cobli sem timezone")

    if timezone_consulta == "UTC":
        return dt.astimezone(timezone.utc)

    if timezone_consulta == "America/Sao_Paulo":
        if dt.utcoffset().total_seconds() != 0:
            raise ValueError("Formato de evento inesperado")

        # Comportamento observado na API road-speed-events:
        # hora local retornada com sufixo Z.
        return dt.replace(
            tzinfo=SAO_PAULO
        ).astimezone(timezone.utc)

    raise ValueError(
        "Fuso de consulta desconhecido: " + str(timezone_consulta)
    )
