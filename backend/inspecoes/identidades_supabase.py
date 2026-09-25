from collections import Counter
import os
import re

from dotenv import load_dotenv
from supabase import create_client


TABELA = "config_identidades_inspecoes"


def carregar_configuracao():

    load_dotenv()

    url = os.getenv(
        "SUPABASE_URL"
    )

    secret = os.getenv(
        "SUPABASE_SECRET_KEY"
    )

    if not url:
        raise RuntimeError(
            "SUPABASE_URL nao configurada."
        )

    if not secret:
        raise RuntimeError(
            "SUPABASE_SECRET_KEY nao configurada."
        )

    return url, secret


def carregar_identidades_supabase():

    url, secret = carregar_configuracao()

    cliente = create_client(
        url,
        secret,
    )

    resposta = (
        cliente
        .table(
            TABELA
        )
        .select(
            "codigo_inspecao,"
            "cod_colaborador,"
            "status_vinculo,"
            "metodo_vinculo"
        )
        .order(
            "codigo_inspecao"
        )
        .execute()
    )

    registros = resposta.data or []

    if not registros:

        raise RuntimeError(
            "Nenhuma identidade encontrada "
            "no Supabase."
        )

    identidades = {}

    status = Counter()
    metodos = Counter()

    for item in registros:

        codigo = str(
            item.get(
                "codigo_inspecao",
                "",
            )
        ).strip().upper()

        cod_colaborador = item.get(
            "cod_colaborador"
        )

        cod_colaborador = (
            ""
            if cod_colaborador is None
            else str(
                cod_colaborador
            ).strip()
        )

        status_vinculo = str(
            item.get(
                "status_vinculo",
                "",
            )
        ).strip().upper()

        metodo_vinculo = str(
            item.get(
                "metodo_vinculo",
                "",
            )
        ).strip().upper()

        if not codigo:

            raise RuntimeError(
                "codigo_inspecao vazio "
                "no Supabase."
            )

        if codigo in identidades:

            raise RuntimeError(
                "codigo_inspecao duplicado "
                "no Supabase: "
                f"{codigo}"
            )

        if status_vinculo == "VINCULADO":

            if not re.fullmatch(
                r"[0-9]+-[0-9]+",
                cod_colaborador,
            ):

                raise RuntimeError(
                    "cod_colaborador invalido "
                    "para identidade VINCULADA: "
                    f"{codigo}"
                )

            if metodo_vinculo not in {
                "EXATO",
                "SIMILARIDADE_VALIDADA",
            }:

                raise RuntimeError(
                    "Metodo invalido para "
                    "identidade VINCULADA: "
                    f"{codigo}"
                )

        elif status_vinculo == "NAO_VINCULADO":

            if cod_colaborador:

                raise RuntimeError(
                    "Identidade NAO_VINCULADA "
                    "possui cod_colaborador: "
                    f"{codigo}"
                )

            if metodo_vinculo != "NAO_VINCULADO":

                raise RuntimeError(
                    "Metodo invalido para "
                    "identidade NAO_VINCULADA: "
                    f"{codigo}"
                )

        else:

            raise RuntimeError(
                "status_vinculo invalido: "
                f"{codigo}"
            )

        identidades[
            codigo
        ] = {
            "cod_colaborador":
                cod_colaborador,
            "status_vinculo":
                status_vinculo,
            "metodo_vinculo":
                metodo_vinculo,
        }

        status[
            status_vinculo
        ] += 1

        metodos[
            metodo_vinculo
        ] += 1

    return (
        identidades,
        status,
        metodos,
    )
