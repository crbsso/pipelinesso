import argparse
import os
import uuid
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client


PASTA_PROJETO = Path(__file__).resolve().parents[2]

ARQUIVO_OURO = (
    PASTA_PROJETO
    / "data"
    / "ouro"
    / "inspecoes"
    / "mart_inspecoes.xlsx"
)

NOME_ABA = "mart_inspecoes"

TABELA_MART = "mart_inspecoes"
TABELA_STAGING = "stg_mart_inspecoes"
RPC_PROMOVER = "promover_mart_inspecoes"

TAMANHO_LOTE = 500
TAMANHO_PAGINA = 1000


COLUNAS_ESPERADAS = [
    "id_resposta",
    "nome_formulario",
    "contrato",
    "data_inspecao",
    "area_organizacional",
    "local",
    "empresa_inspecao",
    "estado_plano_acao",
    "acoes_corretivas_atrasadas",
    "cod_colaborador",
    "status_vinculo_colaborador",
    "nome_exibicao",
    "cargo_colaborador",
    "setor_colaborador",
    "empresa_colaborador",
    "data_atualizacao",
]


def texto(valor):
    if valor is None:
        return ""

    try:
        if pd.isna(valor):
            return ""
    except TypeError:
        pass

    return str(valor).strip()


def texto_opcional(
    valor,
    hifen_nulo=False,
):
    valor = texto(valor)

    if not valor:
        return None

    if (
        hifen_nulo
        and valor == "-"
    ):
        return None

    return valor


def normalizar_data(valor):
    data = pd.to_datetime(
        valor,
        errors="raise",
    )

    return data.strftime(
        "%Y-%m-%d"
    )


def normalizar_timestamp(valor):
    timestamp = pd.to_datetime(
        valor,
        errors="raise",
    )

    if timestamp.tzinfo is not None:
        timestamp = timestamp.tz_convert(
            None
        )

    return timestamp.strftime(
        "%Y-%m-%dT%H:%M:%S.%f"
    )


def normalizar_registro(registro):
    return {
        "id_resposta": int(
            registro["id_resposta"]
        ),
        "nome_formulario": texto(
            registro["nome_formulario"]
        ),
        "contrato": texto_opcional(
            registro.get("contrato"),
            hifen_nulo=True,
        ),
        "data_inspecao": normalizar_data(
            registro["data_inspecao"]
        ),
        "area_organizacional": texto(
            registro["area_organizacional"]
        ),
        "local": texto(
            registro["local"]
        ),
        "empresa_inspecao": texto_opcional(
            registro.get(
                "empresa_inspecao"
            ),
            hifen_nulo=True,
        ),
        "estado_plano_acao": texto(
            registro["estado_plano_acao"]
        ),
        "acoes_corretivas_atrasadas": int(
            registro[
                "acoes_corretivas_atrasadas"
            ]
        ),
        "cod_colaborador": texto_opcional(
            registro.get(
                "cod_colaborador"
            )
        ),
        "status_vinculo_colaborador": texto(
            registro[
                "status_vinculo_colaborador"
            ]
        ).upper(),
        "nome_exibicao": texto(
            registro["nome_exibicao"]
        ),
        "cargo_colaborador": texto_opcional(
            registro.get(
                "cargo_colaborador"
            )
        ),
        "setor_colaborador": texto_opcional(
            registro.get(
                "setor_colaborador"
            )
        ),
        "empresa_colaborador": texto_opcional(
            registro.get(
                "empresa_colaborador"
            )
        ),
        "data_atualizacao": normalizar_timestamp(
            registro["data_atualizacao"]
        ),
    }


def carregar_configuracao():
    arquivo_env = (
        PASTA_PROJETO
        / ".env"
    )

    if not arquivo_env.exists():
        raise FileNotFoundError(
            ".env nao encontrado em: "
            f"{arquivo_env}"
        )

    load_dotenv(
        dotenv_path=arquivo_env,
        override=True,
    )

    supabase_url = os.getenv(
        "SUPABASE_URL"
    )

    supabase_secret_key = os.getenv(
        "SUPABASE_SECRET_KEY"
    )

    if not supabase_url:
        raise RuntimeError(
            "SUPABASE_URL nao encontrada."
        )

    if not supabase_secret_key:
        raise RuntimeError(
            "SUPABASE_SECRET_KEY nao encontrada."
        )

    return (
        supabase_url,
        supabase_secret_key,
    )


def validar_ouro(df):
    if df.empty:
        raise RuntimeError(
            "A Mart de Inspecoes esta vazia."
        )

    if (
        df.columns.tolist()
        != COLUNAS_ESPERADAS
    ):
        raise RuntimeError(
            "Contrato da Mart diferente "
            "do esperado.\n"
            f"Esperado: {COLUNAS_ESPERADAS}\n"
            f"Recebido: {df.columns.tolist()}"
        )

    ids = pd.to_numeric(
        df["id_resposta"],
        errors="coerce",
    )

    if ids.isna().any():
        raise RuntimeError(
            "id_resposta invalido."
        )

    if ids.duplicated().any():
        raise RuntimeError(
            "id_resposta duplicado."
        )

    if ids.mod(1).ne(0).any():
        raise RuntimeError(
            "id_resposta nao inteiro."
        )

    for coluna in [
        "nome_formulario",
        "area_organizacional",
        "local",
        "estado_plano_acao",
        "status_vinculo_colaborador",
        "nome_exibicao",
    ]:
        valores = (
            df[coluna]
            .fillna("")
            .astype(str)
            .str.strip()
        )

        if valores.eq("").any():
            raise RuntimeError(
                "Valor vazio em coluna "
                f"obrigatoria: {coluna}"
            )

    data_inspecao = pd.to_datetime(
        df["data_inspecao"],
        errors="coerce",
    )

    if data_inspecao.isna().any():
        raise RuntimeError(
            "data_inspecao invalida."
        )

    data_atualizacao = pd.to_datetime(
        df["data_atualizacao"],
        errors="coerce",
    )

    if data_atualizacao.isna().any():
        raise RuntimeError(
            "data_atualizacao invalida."
        )

    acoes = pd.to_numeric(
        df[
            "acoes_corretivas_atrasadas"
        ],
        errors="coerce",
    )

    if acoes.isna().any():
        raise RuntimeError(
            "Quantidade invalida de "
            "acoes corretivas atrasadas."
        )

    if (
        acoes.lt(0).any()
        or acoes.mod(1).ne(0).any()
    ):
        raise RuntimeError(
            "Quantidade invalida de "
            "acoes corretivas atrasadas."
        )

    status = (
        df[
            "status_vinculo_colaborador"
        ]
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
    )

    permitidos = {
        "VINCULADO",
        "NAO_VINCULADO",
    }

    if (
        ~status.isin(
            permitidos
        )
    ).any():
        raise RuntimeError(
            "status_vinculo_colaborador "
            "invalido."
        )

    vinculados = (
        status
        == "VINCULADO"
    )

    nao_vinculados = (
        status
        == "NAO_VINCULADO"
    )

    codigos = (
        df["cod_colaborador"]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    if (
        codigos.loc[
            vinculados
        ]
        .eq("")
        .any()
    ):
        raise RuntimeError(
            "Registro VINCULADO sem "
            "cod_colaborador."
        )

    if (
        ~codigos.loc[
            vinculados
        ]
        .str.fullmatch(
            r"[0-9]+-[0-9]+"
        )
    ).any():
        raise RuntimeError(
            "cod_colaborador invalido."
        )

    if (
        codigos.loc[
            nao_vinculados
        ]
        .ne("")
        .any()
    ):
        raise RuntimeError(
            "Registro NAO_VINCULADO "
            "com cod_colaborador."
        )

    for coluna in [
        "cargo_colaborador",
        "setor_colaborador",
        "empresa_colaborador",
    ]:
        valores = (
            df[coluna]
            .fillna("")
            .astype(str)
            .str.strip()
        )

        if (
            valores.loc[
                vinculados
            ]
            .eq("")
            .any()
        ):
            raise RuntimeError(
                "Registro VINCULADO sem "
                f"{coluna}."
            )

        if (
            valores.loc[
                nao_vinculados
            ]
            .ne("")
            .any()
        ):
            raise RuntimeError(
                "Registro NAO_VINCULADO "
                f"com {coluna}."
            )

    nomes = (
        df["nome_exibicao"]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    if (
        nomes.loc[
            nao_vinculados
        ]
        .ne(
            "Nao vinculado"
        )
        .any()
    ):
        raise RuntimeError(
            "nome_exibicao inesperado "
            "para NAO_VINCULADO."
        )

    return {
        "total": len(df),
        "vinculados": int(
            vinculados.sum()
        ),
        "nao_vinculados": int(
            nao_vinculados.sum()
        ),
    }


def carregar_ouro():
    if not ARQUIVO_OURO.exists():
        raise FileNotFoundError(
            "Arquivo Ouro nao encontrado: "
            f"{ARQUIVO_OURO}"
        )

    df = pd.read_excel(
        ARQUIVO_OURO,
        sheet_name=NOME_ABA,
    )

    indicadores = validar_ouro(
        df
    )

    registros = [
        normalizar_registro(
            registro
        )
        for registro
        in df.to_dict(
            orient="records"
        )
    ]

    return (
        registros,
        indicadores,
    )


def contar_registros(
    cliente,
    tabela,
    carga_id=None,
):
    consulta = (
        cliente
        .table(tabela)
        .select(
            "id_resposta",
            count="exact",
        )
    )

    if carga_id is not None:
        consulta = consulta.eq(
            "carga_id",
            carga_id,
        )

    resposta = (
        consulta
        .limit(1)
        .execute()
    )

    return int(
        resposta.count or 0
    )


def buscar_registros(
    cliente,
    tabela,
    carga_id=None,
):
    encontrados = []
    inicio = 0

    while True:
        consulta = (
            cliente
            .table(tabela)
            .select(
                ",".join(
                    COLUNAS_ESPERADAS
                )
            )
        )

        if carga_id is not None:
            consulta = consulta.eq(
                "carga_id",
                carga_id,
            )

        resposta = (
            consulta
            .order(
                "id_resposta"
            )
            .range(
                inicio,
                inicio
                + TAMANHO_PAGINA
                - 1,
            )
            .execute()
        )

        lote = (
            resposta.data
            or []
        )

        encontrados.extend(
            lote
        )

        if (
            len(lote)
            < TAMANHO_PAGINA
        ):
            break

        inicio += (
            TAMANHO_PAGINA
        )

    return encontrados


def validar_conteudo(
    registros_locais,
    registros_remotos,
    origem,
):
    if (
        len(registros_remotos)
        != len(registros_locais)
    ):
        raise RuntimeError(
            f"{origem}: quantidade "
            "divergente. "
            f"Local: {len(registros_locais)}. "
            "Remoto: "
            f"{len(registros_remotos)}."
        )

    locais = {}

    for registro in registros_locais:
        normalizado = (
            normalizar_registro(
                registro
            )
        )

        identificador = (
            normalizado[
                "id_resposta"
            ]
        )

        if identificador in locais:
            raise RuntimeError(
                f"{origem}: ID local "
                "duplicado."
            )

        locais[
            identificador
        ] = normalizado

    remotos = {}

    for registro in registros_remotos:
        normalizado = (
            normalizar_registro(
                registro
            )
        )

        identificador = (
            normalizado[
                "id_resposta"
            ]
        )

        if identificador in remotos:
            raise RuntimeError(
                f"{origem}: ID remoto "
                "duplicado."
            )

        remotos[
            identificador
        ] = normalizado

    if (
        set(locais)
        != set(remotos)
    ):
        faltantes = sorted(
            set(locais)
            - set(remotos)
        )

        extras = sorted(
            set(remotos)
            - set(locais)
        )

        raise RuntimeError(
            f"{origem}: IDs divergentes. "
            f"Faltantes: {faltantes[:10]}. "
            f"Extras: {extras[:10]}."
        )

    for identificador in sorted(
        locais
    ):
        local = locais[
            identificador
        ]

        remoto = remotos[
            identificador
        ]

        divergentes = [
            coluna
            for coluna
            in COLUNAS_ESPERADAS
            if (
                local[coluna]
                != remoto[coluna]
            )
        ]

        if divergentes:
            raise RuntimeError(
                f"{origem}: conteudo "
                "divergente no "
                f"id_resposta "
                f"{identificador}. "
                "Colunas divergentes: "
                + ", ".join(
                    divergentes
                )
            )


def validar_staging(
    cliente,
    carga_id,
    registros,
):
    esperado = len(
        registros
    )

    quantidade = contar_registros(
        cliente,
        TABELA_STAGING,
        carga_id=carga_id,
    )

    if quantidade != esperado:
        raise RuntimeError(
            "STAGING: quantidade "
            "remota divergente. "
            f"Esperado: {esperado}. "
            f"Encontrado: {quantidade}."
        )

    remotos = buscar_registros(
        cliente,
        TABELA_STAGING,
        carga_id=carga_id,
    )

    validar_conteudo(
        registros,
        remotos,
        "STAGING",
    )


def validar_mart(
    cliente,
    registros,
):
    esperado = len(
        registros
    )

    quantidade = contar_registros(
        cliente,
        TABELA_MART,
    )

    if quantidade != esperado:
        raise RuntimeError(
            "MART: quantidade "
            "remota divergente. "
            f"Esperado: {esperado}. "
            f"Encontrado: {quantidade}."
        )

    remotos = buscar_registros(
        cliente,
        TABELA_MART,
    )

    validar_conteudo(
        registros,
        remotos,
        "MART",
    )


def enviar_staging(
    cliente,
    carga_id,
    registros,
):
    registros_staging = [
        {
            "carga_id": carga_id,
            **registro,
        }
        for registro in registros
    ]

    total = len(
        registros_staging
    )

    for inicio in range(
        0,
        total,
        TAMANHO_LOTE,
    ):
        fim = min(
            inicio
            + TAMANHO_LOTE,
            total,
        )

        lote = (
            registros_staging[
                inicio:fim
            ]
        )

        (
            cliente
            .table(
                TABELA_STAGING
            )
            .insert(
                lote
            )
            .execute()
        )

        print(
            "   Staging: "
            f"{fim}/{total}"
        )


def promover(
    cliente,
    carga_id,
    quantidade,
):
    resposta = (
        cliente
        .rpc(
            RPC_PROMOVER,
            {
                "p_carga_id": (
                    carga_id
                ),
                "p_quantidade_esperada": (
                    quantidade
                ),
            },
        )
        .execute()
    )

    retorno = (
        resposta.data
    )

    if (
        isinstance(
            retorno,
            int,
        )
        and retorno
        != quantidade
    ):
        raise RuntimeError(
            "RPC retornou quantidade "
            "diferente da esperada."
        )

    return retorno


def limpar_staging(
    cliente,
    carga_id,
):
    (
        cliente
        .table(
            TABELA_STAGING
        )
        .delete()
        .eq(
            "carga_id",
            carga_id,
        )
        .execute()
    )

    restante = contar_registros(
        cliente,
        TABELA_STAGING,
        carga_id=carga_id,
    )

    if restante != 0:
        raise RuntimeError(
            "A carga permaneceu na "
            "staging apos a limpeza."
        )


def publicar(
    dry_run=False,
):
    print("=" * 70)
    print(
        "PUBLICACAO OURO - INSPECOES"
    )
    print("=" * 70)

    print(
        "\n1. Validando Mart local..."
    )

    registros, indicadores = (
        carregar_ouro()
    )

    print(
        "   Registros: "
        f"{indicadores['total']}"
    )

    print(
        "   Vinculados: "
        f"{indicadores['vinculados']}"
    )

    print(
        "   Nao vinculados: "
        f"{indicadores['nao_vinculados']}"
    )

    print(
        "\n2. Carregando configuracao..."
    )

    (
        supabase_url,
        supabase_secret_key,
    ) = carregar_configuracao()

    host = (
        urlparse(
            supabase_url
        ).hostname
        or ""
    )

    print(
        f"   Supabase: {host}"
    )

    cliente = create_client(
        supabase_url,
        supabase_secret_key,
    )

    print(
        "\n3. Validando estado remoto..."
    )

    staging_total = (
        contar_registros(
            cliente,
            TABELA_STAGING,
        )
    )

    mart_total = (
        contar_registros(
            cliente,
            TABELA_MART,
        )
    )

    print(
        "   Staging atual: "
        f"{staging_total}"
    )

    print(
        "   Mart atual: "
        f"{mart_total}"
    )

    if staging_total != 0:
        raise RuntimeError(
            "A staging possui registros "
            "de uma carga anterior. "
            "Publicacao bloqueada para "
            "preservar o diagnostico."
        )

    if dry_run:
        print(
            "\nDRY RUN APROVADO."
        )

        print(
            "Nenhum dado foi alterado "
            "no Supabase."
        )

        return

    carga_id = str(
        uuid.uuid4()
    )

    carga_enviada = False

    try:
        print(
            "\n4. Enviando staging..."
        )

        print(
            f"   carga_id: {carga_id}"
        )

        enviar_staging(
            cliente,
            carga_id,
            registros,
        )

        carga_enviada = True

        print(
            "\n5. Validando staging "
            "remotamente..."
        )

        validar_staging(
            cliente,
            carga_id,
            registros,
        )

        print(
            "   Staging validada."
        )

        print(
            "\n6. Promovendo carga "
            "atomicamente..."
        )

        retorno = promover(
            cliente,
            carga_id,
            len(registros),
        )

        print(
            "   RPC concluida. "
            f"Retorno: {retorno}"
        )

        print(
            "\n7. Validando Mart "
            "oficial..."
        )

        validar_mart(
            cliente,
            registros,
        )

        print(
            "   Mart oficial validada."
        )

        print(
            "\n8. Limpando somente "
            "a carga da staging..."
        )

        limpar_staging(
            cliente,
            carga_id,
        )

        print(
            "   Staging limpa."
        )

    except Exception:
        print(
            "\nPUBLICACAO INTERROMPIDA."
        )

        print(
            "Nenhum arquivo local "
            "foi removido."
        )

        if carga_enviada:
            print(
                "A staging foi preservada "
                "para diagnostico."
            )

            print(
                f"carga_id: {carga_id}"
            )

        raise

    print(
        "\n"
        + "=" * 70
    )

    print(
        "PUBLICACAO CONCLUIDA "
        "COM SUCESSO"
    )

    print(
        "=" * 70
    )

    print(
        f"Registros: {len(registros)}"
    )

    print(
        f"carga_id: {carga_id}"
    )

    print(
        "Arquivos locais: PRESERVADOS"
    )


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Publica a Mart Ouro de "
            "Inspecoes no Supabase."
        )
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Valida local e remoto "
            "sem alterar dados."
        ),
    )

    argumentos = (
        parser.parse_args()
    )

    publicar(
        dry_run=argumentos.dry_run
    )


if __name__ == "__main__":
    main()
