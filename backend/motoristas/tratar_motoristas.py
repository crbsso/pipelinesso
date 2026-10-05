from pathlib import Path
import csv
import json
import re
import sys
import unicodedata

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]

PASTA_BRONZE_COBLI = (
    ROOT
    / "data"
    / "bronze"
    / "motoristas"
)

ARQUIVO_MAPA = (
    ROOT
    / "data"
    / "master"
    / "colaboradores"
    / "mapa_colaboradores.csv"
)

ARQUIVO_FOLHA = (
    ROOT
    / "data"
    / "bronze"
    / "cadastros"
    / "colaboradores"
    / "Colaboradores_Folha_RM.xlsx"
)

ARQUIVO_ALIASES = (
    ROOT
    / "backend"
    / "motoristas"
    / "config"
    / "aliases_motoristas_cobli.json"
)

ARQUIVO_COLIGADAS = (
    ROOT
    / "backend"
    / "motoristas"
    / "config"
    / "coligadas.csv"
)

PASTA_PRATA = (
    ROOT
    / "data"
    / "prata"
    / "motoristas"
)

ARQUIVO_PRATA = (
    PASTA_PRATA
    / "motoristas.csv"
)


def texto_limpo(valor):
    if valor is None:
        return ""

    if pd.isna(valor):
        return ""

    return str(valor).strip()


def normalizar_nome(valor):
    texto = texto_limpo(valor).upper()

    texto = unicodedata.normalize(
        "NFKD",
        texto,
    )

    texto = "".join(
        caractere
        for caractere in texto
        if not unicodedata.combining(
            caractere
        )
    )

    texto = re.sub(
        r"\s+",
        " ",
        texto,
    )

    return texto.strip()


def localizar_bronze_cobli():
    arquivos = sorted(
        PASTA_BRONZE_COBLI.glob(
            "cobli_motoristas_*.json"
        ),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    if not arquivos:
        raise RuntimeError(
            "Bronze Cobli de motoristas nao encontrado."
        )

    return arquivos[0]


def carregar_cobli():
    arquivo = localizar_bronze_cobli()

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
            "Payload Cobli nao possui lista data."
        )

    return registros


def carregar_mapa():
    if not ARQUIVO_MAPA.exists():
        raise RuntimeError(
            "Mapa de colaboradores nao encontrado. "
            "O tratamento de Motoristas deve executar "
            "depois de gerar_mapa_colaboradores.py "
            "e antes do cleanup."
        )

    mapa = {}

    with ARQUIVO_MAPA.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as arquivo:

        leitor = csv.DictReader(
            arquivo,
            delimiter=";",
        )

        obrigatorias = {
            "cod_colaborador",
            "nome_normalizado",
            "nome_completo_rm",
            "nome_exibicao",
            "data_admissao",
            "data_demissao",
            "funcao_rm",
            "secao_rm",
            "cod_coligada_rm",
            "filial_rm",
            "origem_registro",
            "cod_situacao",
            "descricao_situacao",
            "origem_situacao",
        }

        campos = set(
            leitor.fieldnames or []
        )

        ausentes = obrigatorias - campos

        if ausentes:
            raise RuntimeError(
                "Mapa sem colunas obrigatorias: "
                + ", ".join(
                    sorted(ausentes)
                )
            )

        for linha in leitor:
            nome = normalizar_nome(
                linha.get(
                    "nome_normalizado"
                )
                or linha.get(
                    "nome_completo_rm"
                )
            )

            if not nome:
                continue

            if nome in mapa:
                raise RuntimeError(
                    "Nome normalizado duplicado "
                    f"no mapa: {nome}"
                )

            mapa[nome] = linha

    return mapa


def carregar_historico_folha():
    if not ARQUIVO_FOLHA.exists():
        raise RuntimeError(
            "Bronze Folha RM nao encontrado. "
            "Motoristas precisa executar antes "
            "do cleanup."
        )

    folha = pd.read_excel(
        ARQUIVO_FOLHA,
        dtype=str,
    )

    obrigatorias = {
        "CODPESSOA",
        "NOME",
        "CODSITUACAO",
        "DATADEMISSAO",
    }

    ausentes = (
        obrigatorias
        - set(folha.columns)
    )

    if ausentes:
        raise RuntimeError(
            "Folha RM sem colunas obrigatorias: "
            + ", ".join(
                sorted(ausentes)
            )
        )

    folha = folha.copy()

    folha["nome_normalizado_motoristas"] = (
        folha["NOME"]
        .apply(normalizar_nome)
    )

    folha["DATADEMISSAO_DT"] = (
        pd.to_datetime(
            folha["DATADEMISSAO"],
            errors="coerce",
        )
    )

    return folha


def carregar_coligadas():

    if not ARQUIVO_COLIGADAS.exists():
        raise RuntimeError(
            "Arquivo de coligadas nao encontrado."
        )

    df = pd.read_csv(
        ARQUIVO_COLIGADAS,
        sep=";",
        dtype=str,
        encoding="utf-8-sig",
    ).fillna("")

    obrigatorias = {
        "cod_coligada",
        "coligada",
    }

    ausentes = (
        obrigatorias
        - set(df.columns)
    )

    if ausentes:
        raise RuntimeError(
            "coligadas.csv sem colunas: "
            + ", ".join(
                sorted(ausentes)
            )
        )

    if df[
        "cod_coligada"
    ].duplicated().any():
        raise RuntimeError(
            "cod_coligada duplicado "
            "em coligadas.csv."
        )

    return dict(
        zip(
            df["cod_coligada"],
            df["coligada"],
        )
    )


def carregar_aliases(mapa):
    if not ARQUIVO_ALIASES.exists():
        raise RuntimeError(
            "Arquivo de aliases Cobli nao encontrado."
        )

    dados = json.loads(
        ARQUIVO_ALIASES.read_text(
            encoding="utf-8-sig"
        )
    )

    aliases = {}

    for item in dados.get(
        "aliases",
        [],
    ):
        origem = normalizar_nome(
            item.get("nome_cobli")
        )

        destino = normalizar_nome(
            item.get("nome_rm")
        )

        if not origem or not destino:
            raise RuntimeError(
                "Alias Cobli possui nome vazio."
            )

        if origem in aliases:
            raise RuntimeError(
                "Alias Cobli duplicado: "
                f"{origem}"
            )

        if destino not in mapa:
            raise RuntimeError(
                "Destino do alias nao existe "
                "no mapa RM: "
                f"{destino}"
            )

        aliases[origem] = destino

    return aliases


def localizar_historico(
    nome_normalizado,
    folha,
):
    encontrados = folha[
        folha[
            "nome_normalizado_motoristas"
        ]
        == nome_normalizado
    ].copy()

    if encontrados.empty:
        return None

    demitidos = encontrados[
        encontrados[
            "DATADEMISSAO_DT"
        ].notna()
    ].copy()

    if demitidos.empty:
        return None

    demitidos = demitidos.sort_values(
        "DATADEMISSAO_DT",
        ascending=False,
    )

    registro = demitidos.iloc[0]

    return {
        "nome_completo_rm":
            texto_limpo(
                registro.get("NOME")
            ),
        "data_demissao":
            (
                registro[
                    "DATADEMISSAO_DT"
                ].strftime("%Y-%m-%d")
            ),
        "cod_situacao":
            texto_limpo(
                registro.get(
                    "CODSITUACAO"
                )
            ),
    }


def resolver_motorista(
    registro_cobli,
    mapa,
    aliases,
    folha,
    coligadas,
):
    nome_cobli = texto_limpo(
        registro_cobli.get("name")
    )

    nome_normalizado = (
        normalizar_nome(
            nome_cobli
        )
    )

    resultado = {
        "driver_id_cobli":
            texto_limpo(
                registro_cobli.get("id")
            ),
        "driver_code_cobli":
            texto_limpo(
                registro_cobli.get(
                    "driver_code"
                )
            ),
        "nome_cobli":
            nome_cobli,
        "nome_normalizado_cobli":
            nome_normalizado,
        "cobli_active":
            bool(
                registro_cobli.get(
                    "active"
                )
            ),
        "cod_colaborador":
            "",
        "nome_completo_rm":
            "",
        "nome_exibicao":
            "",
        "origem_registro_rm":
            "",
        "data_admissao":
            "",
        "data_demissao":
            "",
        "funcao_rm":
            "",
        "secao_rm":
            "",
        "cod_coligada_rm":
            "",
        "coligada":
            "",
        "filial_rm":
            "",
        "cod_situacao_rm":
            "",
        "descricao_situacao_rm":
            "",
        "origem_situacao_rm":
            "",
        "metodo_identificacao":
            "",
        "situacao_motorista":
            "",
    }

    destino = None
    metodo = None

    if nome_normalizado in mapa:
        destino = nome_normalizado
        metodo = "MAPA_RM_EXATO"

    elif nome_normalizado in aliases:
        destino = aliases[
            nome_normalizado
        ]
        metodo = "MAPA_RM_ALIAS"

    if destino is not None:
        pessoa = mapa[destino]

        origem = texto_limpo(
            pessoa.get(
                "origem_registro"
            )
        )

        resultado.update(
            {
                "cod_colaborador":
                    texto_limpo(
                        pessoa.get(
                            "cod_colaborador"
                        )
                    ),
                "nome_completo_rm":
                    texto_limpo(
                        pessoa.get(
                            "nome_completo_rm"
                        )
                    ),
                "nome_exibicao":
                    texto_limpo(
                        pessoa.get(
                            "nome_exibicao"
                        )
                    ),
                "origem_registro_rm":
                    origem,
                "data_admissao":
                    texto_limpo(
                        pessoa.get(
                            "data_admissao"
                        )
                    ),
                "data_demissao":
                    texto_limpo(
                        pessoa.get(
                            "data_demissao"
                        )
                    ),
                "funcao_rm":
                    texto_limpo(
                        pessoa.get(
                            "funcao_rm"
                        )
                    ),
                "secao_rm":
                    texto_limpo(
                        pessoa.get(
                            "secao_rm"
                        )
                    ),
                "cod_coligada_rm":
                    texto_limpo(
                        pessoa.get(
                            "cod_coligada_rm"
                        )
                    ),
                "coligada":
                    coligadas.get(
                        texto_limpo(
                            pessoa.get(
                                "cod_coligada_rm"
                            )
                        ),
                        "NAO_RESOLVIDA",
                    ),
                "filial_rm":
                    texto_limpo(
                        pessoa.get(
                            "filial_rm"
                        )
                    ),
                "cod_situacao_rm":
                    texto_limpo(
                        pessoa.get(
                            "cod_situacao"
                        )
                    ),
                "descricao_situacao_rm":
                    texto_limpo(
                        pessoa.get(
                            "descricao_situacao"
                        )
                    ),
                "origem_situacao_rm":
                    texto_limpo(
                        pessoa.get(
                            "origem_situacao"
                        )
                    ),
                "metodo_identificacao":
                    metodo,
            }
        )

        if origem == "GESTAO_ATUAL":
            resultado[
                "situacao_motorista"
            ] = "ATIVO_REGULAR"

        elif origem == (
            "FOLHA_DEMITIDO_ATE_1_ANO"
        ):
            resultado[
                "situacao_motorista"
            ] = (
                "PENDENTE_DESATIVACAO_COBLI"
            )

        else:
            resultado[
                "situacao_motorista"
            ] = "REVISAR_SITUACAO_RM"

        return resultado

    historico = localizar_historico(
        nome_normalizado,
        folha,
    )

    if historico is not None:
        resultado.update(
            {
                "nome_completo_rm":
                    historico[
                        "nome_completo_rm"
                    ],
                "data_demissao":
                    historico[
                        "data_demissao"
                    ],
                "cod_situacao_rm":
                    historico[
                        "cod_situacao"
                    ],
                "metodo_identificacao":
                    "FOLHA_RM_HISTORICO_EXATO",
                "situacao_motorista":
                    "PENDENTE_DESATIVACAO_COBLI",
            }
        )

        return resultado

    resultado[
        "metodo_identificacao"
    ] = "NAO_RESOLVIDO"

    resultado[
        "situacao_motorista"
    ] = "SEM_IDENTIDADE_RM"

    return resultado


def main():
    print("=" * 72)
    print("TRATAMENTO MOTORISTAS - COBLI x RM")
    print("=" * 72)

    cobli = carregar_cobli()
    mapa = carregar_mapa()
    folha = carregar_historico_folha()

    coligadas = carregar_coligadas()

    aliases = carregar_aliases(
        mapa
    )

    resultados = [
        resolver_motorista(
            registro,
            mapa,
            aliases,
            folha,
            coligadas,
        )
        for registro in cobli
    ]

    df = pd.DataFrame(
        resultados
    )

    if df.empty:
        raise RuntimeError(
            "Prata de Motoristas ficou vazia."
        )

    if df[
        "driver_id_cobli"
    ].duplicated().any():
        raise RuntimeError(
            "driver_id_cobli duplicado."
        )

    PASTA_PRATA.mkdir(
        parents=True,
        exist_ok=True,
    )

    df.to_csv(
        ARQUIVO_PRATA,
        sep=";",
        index=False,
        encoding="utf-8-sig",
    )

    print()
    print("Cobli:", len(df))

    print()
    print("METODOS DE IDENTIFICACAO:")
    print(
        df[
            "metodo_identificacao"
        ]
        .value_counts(
            dropna=False
        )
        .to_string()
    )

    print()
    print("SITUACAO MOTORISTA:")
    print(
        df[
            "situacao_motorista"
        ]
        .value_counts(
            dropna=False
        )
        .to_string()
    )

    print()
    print(
        "Pendentes de desativacao Cobli:",
        int(
            (
                df[
                    "situacao_motorista"
                ]
                == (
                    "PENDENTE_DESATIVACAO_COBLI"
                )
            ).sum()
        ),
    )

    print(
        "Sem identidade RM:",
        int(
            (
                df[
                    "situacao_motorista"
                ]
                == "SEM_IDENTIDADE_RM"
            ).sum()
        ),
    )

    print()
    print(
        "Prata:",
        ARQUIVO_PRATA,
    )

    print()
    print("=" * 72)
    print(
        "TRATAMENTO MOTORISTAS CONCLUIDO"
    )
    print("=" * 72)


if __name__ == "__main__":
    try:
        main()

    except Exception as erro:
        print(
            f"ERRO: {erro}",
            file=sys.stderr,
        )

        sys.exit(1)
