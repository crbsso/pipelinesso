"""Valida o JSON de extracao Intranet sem escrever em bancos ou arquivos."""

import argparse
from collections import Counter, defaultdict
from datetime import date, datetime
import json
from pathlib import Path


class DadosInvalidos(ValueError):
    pass


def analisar(documento):
    if not isinstance(documento, dict):
        raise DadosInvalidos("JSON raiz deve ser um objeto.")

    if documento.get("origem") != "SQL Server Intranet":
        raise DadosInvalidos("Origem inesperada.")

    if documento.get("fuso_origem") not in ("nao_verificado", "America/Sao_Paulo"):
        raise DadosInvalidos("Contrato de fuso inesperado.")

    try:
        inicio = date.fromisoformat(documento["inicio_inclusivo"])
        fim = date.fromisoformat(documento["fim_exclusivo"])
    except (KeyError, TypeError, ValueError) as exc:
        raise DadosInvalidos("Periodo ausente ou invalido.") from exc

    if not inicio < fim or (fim - inicio).days > 93:
        raise DadosInvalidos("Periodo fora do intervalo permitido.")

    registros = documento.get("registros")

    if not isinstance(registros, list):
        raise DadosInvalidos("Campo registros deve ser uma lista.")

    vistos = set()
    por_tipo = Counter()
    ativos_por_tipo = defaultdict(set)
    locais_por_familia = defaultdict(set)
    veiculos_mensais = set()

    tipos_veiculos = {
        "Mensal de Caminhão",
        "Mensal de Máquinas Pesadas",
        "Mensal de Veículo Utilitário",
        "Mensal PTA",
    }

    for indice, registro in enumerate(registros, start=1):
        if not isinstance(registro, dict):
            raise DadosInvalidos(
                f"Registro {indice}: estrutura invalida."
            )

        campos = (
            "id_inspecao",
            "ficha_id",
            "aba_id",
            "data_inspecao",
            "familia",
            "tipo",
        )

        for campo in campos:
            if (
                registro.get(campo) is None
                or not str(registro[campo]).strip()
            ):
                raise DadosInvalidos(
                    f"Registro {indice}: campo {campo} ausente."
                )

        chave = tuple(
            str(registro[c])
            for c in ("id_inspecao", "ficha_id", "aba_id")
        )

        if chave in vistos:
            raise DadosInvalidos(
                f"Registro {indice}: chave de inspecao duplicada."
            )

        vistos.add(chave)

        try:
            momento = datetime.fromisoformat(
                str(registro["data_inspecao"])
            )
        except ValueError as exc:
            raise DadosInvalidos(
                f"Registro {indice}: data invalida."
            ) from exc

        if (
            momento.tzinfo is not None
            or not (inicio <= momento.date() < fim)
        ):
            raise DadosInvalidos(
                f"Registro {indice}: data fora do periodo "
                "ou com fuso nao esperado."
            )

        familia = str(registro["familia"])
        tipo = str(registro["tipo"])

        por_tipo[(familia, tipo)] += 1
        locais_por_familia[familia].add(chave[1:])

        ativo = registro.get("ativo_id")

        if ativo is not None and str(ativo).strip():
            ativos_por_tipo[(familia, tipo)].add(str(ativo))

            if (
                familia == "Inspeção em Veículos"
                and tipo in tipos_veiculos
            ):
                veiculos_mensais.add(str(ativo))

    return {
        "inicio": inicio.isoformat(),
        "fim_exclusivo": fim.isoformat(),
        "total_registros": len(registros),
        "por_tipo": [
            {
                "familia": familia,
                "tipo": tipo,
                "inspecoes": quantidade,
                "ativos_distintos": len(
                    ativos_por_tipo[(familia, tipo)]
                ),
            }
            for (familia, tipo), quantidade
            in sorted(por_tipo.items())
        ],
        "locais_distintos_por_familia": {
            familia: len(locais)
            for familia, locais
            in sorted(locais_por_familia.items())
        },
        "veiculos_distintos_modalidades_mensais": len(
            veiculos_mensais
        ),
    }


def conferir_outubro_2026(resumo):
    if (
        resumo["inicio"] != "2026-10-01"
        or resumo["fim_exclusivo"] != "2026-11-01"
    ):
        raise DadosInvalidos(
            "Conferencia de outubro exige "
            "2026-10-01 a 2026-11-01."
        )

    contagens = {
        (item["familia"], item["tipo"]): item["inspecoes"]
        for item in resumo["por_tipo"]
    }

    referencias = {
        ("Inspeção de EPIs", "Cinto de segurança"): 185,
        (
            "Inspeção de Movimentação de Carga e Acessórios",
            "Acessórios",
        ): 19,
    }

    divergencias = []

    for chave, esperado in referencias.items():
        observado = contagens.get(chave, 0)

        if observado != esperado:
            divergencias.append(
                f"{chave[1]}: esperado {esperado}, "
                f"observado {observado}"
            )

    extintores = resumo[
        "locais_distintos_por_familia"
    ].get("Inspeção em Extintores de Incêndio", 0)

    if extintores != 60:
        divergencias.append(
            f"Extintores: esperado 60, observado {extintores}"
        )

    veiculos = resumo[
        "veiculos_distintos_modalidades_mensais"
    ]

    if veiculos != 111:
        divergencias.append(
            f"Veiculos: esperado 111, observado {veiculos}"
        )

    if divergencias:
        raise DadosInvalidos(
            "Divergencia com referencia anterior: "
            + "; ".join(divergencias)
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)

    parser.add_argument(
        "--arquivo",
        type=Path,
        required=True,
    )

    parser.add_argument(
        "--conferir-outubro-2026",
        action="store_true",
    )

    args = parser.parse_args()

    try:
        with args.arquivo.open(
            "r", encoding="utf-8-sig"
        ) as arquivo:
            documento = json.load(arquivo)

        resumo = analisar(documento)

        if args.conferir_outubro_2026:
            conferir_outubro_2026(resumo)

        print(
            json.dumps(
                resumo,
                ensure_ascii=False,
                indent=2,
            )
        )

        print("VALIDACAO: APROVADA")

    except (
        OSError,
        json.JSONDecodeError,
        DadosInvalidos,
    ) as exc:
        parser.exit(
            1,
            f"VALIDACAO: REPROVADA - {exc}\n"
        )


if __name__ == "__main__":
    main()