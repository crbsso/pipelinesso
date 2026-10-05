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
    / "motoristas.csv"
)


SITUACOES_VALIDAS = {
    "ATIVO_REGULAR",
    "PENDENTE_DESATIVACAO_COBLI",
    "SEM_IDENTIDADE_RM",
    "REVISAR_SITUACAO_RM",
}

METODOS_VALIDOS = {
    "MAPA_RM_EXATO",
    "MAPA_RM_ALIAS",
    "FOLHA_RM_HISTORICO_EXATO",
    "NAO_RESOLVIDO",
}


def localizar_bronze():
    arquivos = sorted(
        PASTA_BRONZE.glob(
            "cobli_motoristas_*.json"
        ),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    if not arquivos:
        raise RuntimeError(
            "Bronze Cobli de Motoristas "
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

    registros = (
        dados
        .get("payload", {})
        .get("data", [])
    )

    if not isinstance(
        registros,
        list,
    ):
        raise RuntimeError(
            "Bronze Cobli sem payload.data "
            "em formato de lista."
        )

    return (
        arquivo,
        registros,
    )


def carregar_prata():
    if not ARQUIVO_PRATA.exists():
        raise RuntimeError(
            "Prata de Motoristas "
            "nao encontrada."
        )

    df = pd.read_csv(
        ARQUIVO_PRATA,
        sep=";",
        dtype=str,
        encoding="utf-8-sig",
    ).fillna("")

    return df


def falhar(mensagem):
    raise RuntimeError(
        f"QUALITY GATE REPROVADO: {mensagem}"
    )


def validar():
    bronze_arquivo, bronze = (
        carregar_bronze()
    )

    prata = carregar_prata()

    total_bronze = len(bronze)
    total_prata = len(prata)

    print("=" * 72)
    print("QUALITY GATE - MOTORISTAS")
    print("=" * 72)

    print()
    print(
        "Bronze utilizada:",
        bronze_arquivo.name,
    )

    print(
        "Registros Bronze:",
        total_bronze,
    )

    print(
        "Registros Prata:",
        total_prata,
    )

    # ---------------------------------------------------------
    # 1. CONSERVACAO DE REGISTROS
    # ---------------------------------------------------------

    if total_bronze != total_prata:
        falhar(
            "quantidade Bronze e Prata diverge. "
            f"Bronze={total_bronze} / "
            f"Prata={total_prata}"
        )

    # ---------------------------------------------------------
    # 2. CONTRATO DE COLUNAS
    # ---------------------------------------------------------

    colunas_obrigatorias = {
        "driver_id_cobli",
        "nome_cobli",
        "nome_normalizado_cobli",
        "cobli_active",
        "cod_colaborador",
        "nome_completo_rm",
        "nome_exibicao",
        "origem_registro_rm",
        "data_demissao",
        "cod_situacao_rm",
        "descricao_situacao_rm",
        "metodo_identificacao",
        "situacao_motorista",
    }

    ausentes = (
        colunas_obrigatorias
        - set(prata.columns)
    )

    if ausentes:
        falhar(
            "colunas obrigatorias ausentes: "
            + ", ".join(
                sorted(ausentes)
            )
        )

    # ---------------------------------------------------------
    # 3. DRIVER ID
    # ---------------------------------------------------------

    if prata[
        "driver_id_cobli"
    ].eq("").any():
        falhar(
            "existe driver_id_cobli vazio."
        )

    if prata[
        "driver_id_cobli"
    ].duplicated().any():
        falhar(
            "existe driver_id_cobli duplicado."
        )

    ids_bronze = {
        str(
            registro.get(
                "id",
                ""
            )
        ).strip()
        for registro in bronze
    }

    ids_prata = set(
        prata[
            "driver_id_cobli"
        ]
        .astype(str)
        .str.strip()
    )

    if ids_bronze != ids_prata:
        faltando = (
            ids_bronze
            - ids_prata
        )

        sobrando = (
            ids_prata
            - ids_bronze
        )

        falhar(
            "IDs Bronze e Prata divergem. "
            f"Faltando={len(faltando)} / "
            f"Sobrando={len(sobrando)}"
        )

    # ---------------------------------------------------------
    # 4. STATUS CONTROLADOS
    # ---------------------------------------------------------

    situacoes_encontradas = set(
        prata[
            "situacao_motorista"
        ]
        .unique()
    )

    invalidas = (
        situacoes_encontradas
        - SITUACOES_VALIDAS
    )

    if invalidas:
        falhar(
            "situacao_motorista invalida: "
            + ", ".join(
                sorted(invalidas)
            )
        )

    metodos_encontrados = set(
        prata[
            "metodo_identificacao"
        ]
        .unique()
    )

    metodos_invalidos = (
        metodos_encontrados
        - METODOS_VALIDOS
    )

    if metodos_invalidos:
        falhar(
            "metodo_identificacao invalido: "
            + ", ".join(
                sorted(metodos_invalidos)
            )
        )

    # ---------------------------------------------------------
    # 5. IDENTIFICADOS NO MAPA
    # ---------------------------------------------------------

    identificados_mapa = prata[
        prata[
            "metodo_identificacao"
        ].isin(
            {
                "MAPA_RM_EXATO",
                "MAPA_RM_ALIAS",
            }
        )
    ]

    if identificados_mapa[
        "cod_colaborador"
    ].eq("").any():
        falhar(
            "identificado no mapa sem "
            "cod_colaborador."
        )

    if identificados_mapa[
        "nome_exibicao"
    ].eq("").any():
        falhar(
            "identificado no mapa sem "
            "nome_exibicao."
        )

    # ---------------------------------------------------------
    # 6. NAO RESOLVIDOS
    # ---------------------------------------------------------

    nao_resolvidos = prata[
        prata[
            "metodo_identificacao"
        ]
        == "NAO_RESOLVIDO"
    ]

    if not (
        nao_resolvidos[
            "situacao_motorista"
        ]
        == "SEM_IDENTIDADE_RM"
    ).all():
        falhar(
            "NAO_RESOLVIDO com situacao "
            "diferente de SEM_IDENTIDADE_RM."
        )

    # ---------------------------------------------------------
    # 7. ATIVOS REGULARES
    # ---------------------------------------------------------

    ativos = prata[
        prata[
            "situacao_motorista"
        ]
        == "ATIVO_REGULAR"
    ]

    if not (
        ativos[
            "origem_registro_rm"
        ]
        == "GESTAO_ATUAL"
    ).all():
        falhar(
            "ATIVO_REGULAR sem origem "
            "GESTAO_ATUAL."
        )

    # ---------------------------------------------------------
    # 8. PENDENTES COBLI
    # ---------------------------------------------------------

    pendentes = prata[
        prata[
            "situacao_motorista"
        ]
        == "PENDENTE_DESATIVACAO_COBLI"
    ]

    if pendentes.empty:
        print()
        print(
            "ATENCAO: nenhum pendente de "
            "desativacao foi encontrado."
        )

    # ---------------------------------------------------------
    # 9. CONSERVACAO DAS SITUACOES
    # ---------------------------------------------------------

    soma_situacoes = (
        len(
            prata[
                prata[
                    "situacao_motorista"
                ]
                == "ATIVO_REGULAR"
            ]
        )
        +
        len(
            prata[
                prata[
                    "situacao_motorista"
                ]
                == (
                    "PENDENTE_DESATIVACAO_COBLI"
                )
            ]
        )
        +
        len(
            prata[
                prata[
                    "situacao_motorista"
                ]
                == "SEM_IDENTIDADE_RM"
            ]
        )
        +
        len(
            prata[
                prata[
                    "situacao_motorista"
                ]
                == "REVISAR_SITUACAO_RM"
            ]
        )
    )

    if soma_situacoes != total_prata:
        falhar(
            "soma das situacoes nao fecha "
            "com o total da Prata."
        )

    # ---------------------------------------------------------
    # RESUMO
    # ---------------------------------------------------------

    print()
    print("METODOS DE IDENTIFICACAO:")
    print(
        prata[
            "metodo_identificacao"
        ]
        .value_counts()
        .to_string()
    )

    print()
    print("SITUACAO MOTORISTA:")
    print(
        prata[
            "situacao_motorista"
        ]
        .value_counts()
        .to_string()
    )

    print()
    print(
        "Cobertura de identificacao:",
        f"{(
            1
            - len(nao_resolvidos)
            / total_prata
        ) * 100:.2f}%",
    )

    print()
    print("=" * 72)
    print("QUALITY GATE MOTORISTAS: APROVADO")
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
