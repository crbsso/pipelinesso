import argparse
import hashlib
import json
import math
import os
import sys
import uuid
from datetime import date, datetime
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client


ROOT = Path(__file__).resolve().parents[2]

ARQUIVO_OURO = (
    ROOT
    / "data"
    / "ouro"
    / "motoristas"
    / "mart_motoristas.xlsx"
)

RPC_PROMOVER = (
    "promover_mart_motoristas"
)

TAMANHO_LOTE = 500


MARTS = {
    "motoristas": {
        "tabela":
            "mart_motoristas",

        "staging":
            "stg_mart_motoristas",

        "colunas": [
            "nome_exibicao",
            "coligada",
            "secao_rm",
            "situacao_motorista",
            "situacao_exibicao",
            "status_cobli",
            "status_rm",
            "data_demissao",
            "dias_desde_demissao",
        ],
    },

    "resumo": {
        "tabela":
            "mart_motoristas_resumo",

        "staging":
            "stg_mart_motoristas_resumo",

        "colunas": [
            "grupo",
            "indicador",
            "valor",
            "unidade",
        ],
    },

    "coligadas": {
        "tabela":
            "mart_motoristas_coligadas",

        "staging":
            "stg_mart_motoristas_coligadas",

        "colunas": [
            "coligada",
            "motoristas",
            "ativos_rm",
            "a_desabilitar",
            "sem_identidade_rm",
        ],
    },

    "viagens": {
        "tabela":
            "mart_motoristas_viagens",

        "staging":
            "stg_mart_motoristas_viagens",

        "colunas": [
            "data_evento",
            "ano_evento",
            "mes_evento",
            "inicio",
            "fim",
            "nome_exibicao",
            "coligada",
            "secao_rm",
            "situacao_motorista",
            "status_identificacao_condutor",
            "tipo_registro",
            "fim_de_semana",
            "noturno",
            "fim_semana_noturno",
            "distancia_km",
            "duracao_viagem_min",
            "marcha_lenta_min",
        ],
    },

    "uso_setor": {
        "tabela":
            "mart_motoristas_uso_setor",

        "staging":
            "stg_mart_motoristas_uso_setor",

        "colunas": [
            "cenario",
            "secao_rm",
            "viagens",
            "km",
            "motoristas",
        ],
    },

    "pendencias_condutor": {
        "tabela":
            "mart_motoristas_pendencias_condutor",

        "staging":
            "stg_mart_motoristas_pendencias_condutor",

        "colunas": [
            "cenario",
            "tipo_registro",
            "viagens",
            "km",
            "registros_cobli",
        ],
    },

    "seguranca": {
        "tabela":
            "mart_motoristas_seguranca",

        "staging":
            "stg_mart_motoristas_seguranca",

        "colunas": [
            "nome_exibicao",
            "coligada",
            "secao_rm",
            "distancia_km",
            "tempo_dirigido_min",
            "velocidade_via_eventos_qtd",
            "aceleracao_brusca_qtd",
            "frenagem_brusca_qtd",
            "curva_brusca_qtd",
            "direcao_distraida_qtd",
            "uso_celular_qtd",
            "olhos_fechados_qtd",
            "bocejo_qtd",
            "fumo_qtd",
            "distancia_insegura_qtd",
            "eventos_risco_total",
            "taxa_eventos_100km",
            "elegivel_ranking",
        ],
    },

    "ranking_uso": {
        "tabela":
            "mart_motoristas_ranking_uso",

        "staging":
            "stg_mart_motoristas_ranking_uso",

        "colunas": [
            "posicao",
            "nome_exibicao",
            "coligada",
            "secao_rm",
            "distancia_km",
            "viagens",
        ],
    },

    "ranking_seguranca": {
        "tabela":
            "mart_motoristas_ranking_seguranca",

        "staging":
            "stg_mart_motoristas_ranking_seguranca",

        "colunas": [
            "posicao",
            "ranking",
            "nome_exibicao",
            "coligada",
            "secao_rm",
            "distancia_km",
            "eventos_risco_total",
            "taxa_eventos_100km",
        ],
    },
}


COLUNAS_PROIBIDAS = {
    "nome_completo_rm",
    "nome_cobli",
    "nome_normalizado_cobli",
    "driver_name_cobli",
    "driver_id_cobli",
    "driver_code_cobli",
    "cod_colaborador",
    "vehicle_id_cobli",
    "cobli_id",
    "placa",
}


FRAGMENTOS_PROIBIDOS = {
    "cpf",
    "matricula",
    "email",
    "telefone",
    "cnh",
}


ABAS_PODEM_SER_VAZIAS = {
    "uso_setor",
    "pendencias_condutor",
}


def carregar_configuracao():

    load_dotenv(
        ROOT / ".env"
    )

    url = os.getenv(
        "SUPABASE_URL"
    )

    secret = os.getenv(
        "SUPABASE_SECRET_KEY"
    )

    if not url:

        raise RuntimeError(
            "SUPABASE_URL nao encontrada."
        )

    if not secret:

        raise RuntimeError(
            "SUPABASE_SECRET_KEY nao encontrada."
        )

    return url, secret


def criar_cliente():

    url, secret = (
        carregar_configuracao()
    )

    return create_client(
        url,
        secret,
    )


def normalizar_valor(valor):

    if valor is None:
        return None

    try:

        if pd.isna(valor):
            return None

    except (
        TypeError,
        ValueError,
    ):
        pass

    if isinstance(
        valor,
        (
            pd.Timestamp,
            datetime,
            date,
        ),
    ):

        return valor.isoformat()

    if hasattr(
        valor,
        "item",
    ):

        try:
            valor = valor.item()

        except Exception:
            pass

    if isinstance(
        valor,
        bool,
    ):

        return bool(valor)

    if isinstance(
        valor,
        float,
    ):

        if not math.isfinite(
            valor
        ):
            return None

        return float(valor)

    if isinstance(
        valor,
        int,
    ):

        return int(valor)

    if isinstance(
        valor,
        str,
    ):

        return valor.strip()

    return valor


COLUNAS_INTEGER = {
    "motoristas": {
        "dias_desde_demissao",
    },

    "resumo": set(),

    "coligadas": {
        "motoristas",
        "ativos_rm",
        "a_desabilitar",
        "sem_identidade_rm",
    },

    "viagens": {
        "ano_evento",
        "mes_evento",
    },

    "uso_setor": {
        "viagens",
        "motoristas",
    },

    "pendencias_condutor": {
        "viagens",
        "registros_cobli",
    },

    "seguranca": {
        "velocidade_via_eventos_qtd",
        "aceleracao_brusca_qtd",
        "frenagem_brusca_qtd",
        "curva_brusca_qtd",
        "direcao_distraida_qtd",
        "uso_celular_qtd",
        "olhos_fechados_qtd",
        "bocejo_qtd",
        "fumo_qtd",
        "distancia_insegura_qtd",
        "eventos_risco_total",
    },

    "ranking_uso": {
        "posicao",
        "viagens",
    },

    "ranking_seguranca": {
        "posicao",
        "eventos_risco_total",
    },
}


def normalizar_integer(
    valor,
    aba,
    coluna,
):

    if valor is None:
        return None

    try:

        if pd.isna(valor):
            return None

    except (
        TypeError,
        ValueError,
    ):
        pass

    if isinstance(
        valor,
        bool,
    ):

        raise RuntimeError(
            f"{aba}.{coluna}: "
            "booleano recebido em coluna integer."
        )

    try:

        numero = float(
            valor
        )

    except (
        TypeError,
        ValueError,
    ) as erro:

        raise RuntimeError(
            f"{aba}.{coluna}: "
            f"valor nao numerico: {valor!r}"
        ) from erro

    if not math.isfinite(
        numero
    ):

        raise RuntimeError(
            f"{aba}.{coluna}: "
            "valor nao finito."
        )

    if not numero.is_integer():

        raise RuntimeError(
            f"{aba}.{coluna}: "
            f"valor fracionario inesperado: {valor!r}"
        )

    return int(
        numero
    )


def dataframe_para_registros(
    df,
    aba,
):

    registros = []

    colunas_integer = (
        COLUNAS_INTEGER.get(
            aba,
            set(),
        )
    )

    for registro in (
        df.to_dict(
            orient="records"
        )
    ):

        preparado = {}

        for (
            chave,
            valor,
        ) in registro.items():

            if chave in colunas_integer:

                preparado[
                    chave
                ] = normalizar_integer(
                    valor,
                    aba,
                    chave,
                )

            else:

                preparado[
                    chave
                ] = normalizar_valor(
                    valor
                )

        registros.append(
            preparado
        )

    return registros


def validar_privacidade(
    aba,
    colunas,
):

    normalizadas = {
        str(coluna)
        .strip()
        .lower()

        for coluna
        in colunas
    }

    proibidas = (
        normalizadas
        & COLUNAS_PROIBIDAS
    )

    fragmentos = {
        coluna

        for coluna
        in normalizadas

        if any(
            fragmento in coluna
            for fragmento
            in FRAGMENTOS_PROIBIDOS
        )
    }

    problemas = (
        proibidas
        | fragmentos
    )

    if problemas:

        raise RuntimeError(
            f"Aba {aba} expoe "
            "colunas proibidas: "
            + ", ".join(
                sorted(
                    problemas
                )
            )
        )


def carregar_ouro():

    if not ARQUIVO_OURO.exists():

        raise FileNotFoundError(
            "Ouro Motoristas "
            f"nao encontrada: {ARQUIVO_OURO}"
        )

    xls = pd.ExcelFile(
        ARQUIVO_OURO,
        engine="openpyxl",
    )

    abas_recebidas = (
        xls.sheet_names
    )

    abas_esperadas = list(
        MARTS.keys()
    )

    if (
        abas_recebidas
        != abas_esperadas
    ):

        raise RuntimeError(
            "Abas da Ouro Motoristas "
            "diferem do contrato.\n"
            f"Esperado: {abas_esperadas}\n"
            f"Recebido: {abas_recebidas}"
        )

    saida = {}

    for (
        aba,
        contrato,
    ) in MARTS.items():

        df = pd.read_excel(
            ARQUIVO_OURO,
            sheet_name=aba,
            engine="openpyxl",
        )

        colunas = (
            df.columns.tolist()
        )

        esperadas = (
            contrato[
                "colunas"
            ]
        )

        if colunas != esperadas:

            raise RuntimeError(
                f"Aba {aba} com contrato "
                "diferente.\n"
                f"Esperado: {esperadas}\n"
                f"Recebido: {colunas}"
            )

        if (
            df.empty
            and aba
            not in ABAS_PODEM_SER_VAZIAS
        ):

            raise RuntimeError(
                f"Aba {aba} esta vazia."
            )

        validar_privacidade(
            aba,
            colunas,
        )

        saida[
            aba
        ] = dataframe_para_registros(
            df,
            aba,
        )

    return saida


def validar_local(
    ouros,
):

    contagens = {
        aba:
            len(
                registros
            )

        for aba, registros
        in ouros.items()
    }

    if (
        contagens[
            "motoristas"
        ]
        <= 0
    ):

        raise RuntimeError(
            "Mart Motoristas vazia."
        )

    if (
        contagens[
            "viagens"
        ]
        <= 0
    ):

        raise RuntimeError(
            "Mart Viagens vazia."
        )

    if (
        contagens[
            "seguranca"
        ]
        <= 0
    ):

        raise RuntimeError(
            "Mart Seguranca vazia."
        )

    if (
        contagens[
            "ranking_uso"
        ]
        != 5
    ):

        raise RuntimeError(
            "Ranking de uso "
            "nao possui 5 linhas."
        )

    if (
        contagens[
            "ranking_seguranca"
        ]
        != 10
    ):

        raise RuntimeError(
            "Ranking de seguranca "
            "nao possui 10 linhas."
        )

    return contagens


def contar_remoto(
    cliente,
    tabela,
    carga_id=None,
):

    consulta = (
        cliente
        .table(
            tabela
        )
        .select(
            "*",
            count="exact",
        )
    )

    if carga_id is not None:

        consulta = consulta.eq(
            "carga_id",
            str(
                carga_id
            ),
        )

    resposta = (
        consulta
        .limit(1)
        .execute()
    )

    return int(
        resposta.count
        or 0
    )


def validar_estado_remoto_inicial(
    cliente,
):

    for contrato in (
        MARTS.values()
    ):

        staging = (
            contrato[
                "staging"
            ]
        )

        quantidade = contar_remoto(
            cliente,
            staging,
        )

        if quantidade != 0:

            raise RuntimeError(
                f"{staging} possui "
                f"{quantidade} registro(s). "
                "Publicacao bloqueada."
            )


def enviar_staging(
    cliente,
    carga_id,
    ouros,
):

    for (
        aba,
        registros,
    ) in ouros.items():

        tabela = (
            MARTS[
                aba
            ][
                "staging"
            ]
        )

        preparados = [
            {
                "carga_id":
                    str(
                        carga_id
                    ),

                **registro,
            }

            for registro
            in registros
        ]

        for inicio in range(
            0,
            len(preparados),
            TAMANHO_LOTE,
        ):

            lote = preparados[
                inicio:
                inicio
                + TAMANHO_LOTE
            ]

            (
                cliente
                .table(
                    tabela
                )
                .insert(
                    lote
                )
                .execute()
            )


def validar_staging(
    cliente,
    carga_id,
    contagens,
):

    for (
        aba,
        esperado,
    ) in contagens.items():

        tabela = (
            MARTS[
                aba
            ][
                "staging"
            ]
        )

        atual = contar_remoto(
            cliente,
            tabela,
            carga_id=carga_id,
        )

        if atual != esperado:

            raise RuntimeError(
                f"{tabela}: quantidade "
                "divergente. "
                f"Esperado={esperado}; "
                f"Atual={atual}"
            )


def limpar_staging(
    cliente,
    carga_id,
):

    for contrato in (
        MARTS.values()
    ):

        tabela = (
            contrato[
                "staging"
            ]
        )

        (
            cliente
            .table(
                tabela
            )
            .delete()
            .eq(
                "carga_id",
                str(
                    carga_id
                ),
            )
            .execute()
        )

        restante = contar_remoto(
            cliente,
            tabela,
            carga_id=carga_id,
        )

        if restante != 0:

            raise RuntimeError(
                f"{tabela}: carga "
                "permaneceu apos limpeza."
            )


def carregar_tabela_remota(
    cliente,
    tabela,
    colunas,
):

    saida = []

    inicio = 0
    tamanho = 1000

    selecao = ",".join(
        colunas
    )

    while True:

        resposta = (
            cliente
            .table(
                tabela
            )
            .select(
                selecao
            )
            .range(
                inicio,
                inicio
                + tamanho
                - 1,
            )
            .execute()
        )

        lote = (
            resposta.data
            or []
        )

        saida.extend(
            lote
        )

        if len(lote) < tamanho:
            break

        inicio += tamanho

    return saida


def valor_assinatura(valor):

    if valor is None:
        return None

    if isinstance(
        valor,
        bool,
    ):

        return valor

    if isinstance(
        valor,
        (
            int,
            float,
        ),
    ):

        numero = float(
            valor
        )

        if not math.isfinite(
            numero
        ):
            return None

        return format(
            numero,
            ".15g",
        )

    return str(
        valor
    ).strip()


def assinatura(
    registros,
    colunas,
):

    linhas = []

    for registro in registros:

        normalizado = {
            coluna:
                valor_assinatura(
                    registro.get(
                        coluna
                    )
                )

            for coluna
            in colunas
        }

        linhas.append(
            json.dumps(
                normalizado,
                ensure_ascii=False,
                sort_keys=True,
                separators=(
                    ",",
                    ":",
                ),
            )
        )

    linhas.sort()

    texto = "\n".join(
        linhas
    )

    return hashlib.sha256(
        texto.encode(
            "utf-8"
        )
    ).hexdigest()


def validar_marts_remotas(
    cliente,
    ouros,
):

    for (
        aba,
        registros_locais,
    ) in ouros.items():

        contrato = (
            MARTS[
                aba
            ]
        )

        tabela = (
            contrato[
                "tabela"
            ]
        )

        colunas = (
            contrato[
                "colunas"
            ]
        )

        registros_remotos = (
            carregar_tabela_remota(
                cliente,
                tabela,
                colunas,
            )
        )

        if (
            len(
                registros_remotos
            )
            !=
            len(
                registros_locais
            )
        ):

            raise RuntimeError(
                f"{tabela}: quantidade "
                "remota diferente da local."
            )

        local_hash = assinatura(
            registros_locais,
            colunas,
        )

        remoto_hash = assinatura(
            registros_remotos,
            colunas,
        )

        if (
            local_hash
            != remoto_hash
        ):

            raise RuntimeError(
                f"{tabela}: conteudo "
                "remoto diferente da Ouro local."
            )


def promover(
    cliente,
    carga_id,
    contagens,
):

    resposta = (
        cliente
        .rpc(
            RPC_PROMOVER,
            {
                "p_carga_motoristas":
                    str(
                        carga_id
                    ),

                "p_quantidades":
                    contagens,
            },
        )
        .execute()
    )

    retorno = (
        resposta.data
    )

    if not isinstance(
        retorno,
        dict,
    ):

        raise RuntimeError(
            "RPC Motoristas retornou "
            "formato inesperado."
        )

    for (
        aba,
        esperado,
    ) in contagens.items():

        atual = retorno.get(
            aba
        )

        if atual != esperado:

            raise RuntimeError(
                "RPC Motoristas retornou "
                f"quantidade divergente para {aba}. "
                f"Esperado={esperado}; "
                f"Retornado={atual}"
            )

    return retorno


def publicar(
    dry_run=False,
    local_only=False,
):

    print("=" * 78)
    print("PUBLICACAO OURO - MOTORISTAS")
    print("=" * 78)

    print()
    print(
        "1. Validando Ouro local..."
    )

    ouros = carregar_ouro()

    contagens = validar_local(
        ouros
    )

    for (
        aba,
        quantidade,
    ) in contagens.items():

        print(
            f"   {aba}: {quantidade}"
        )

    print()
    print(
        "   Privacidade local: APROVADA"
    )

    if local_only:

        print()
        print("=" * 78)
        print(
            "VALIDACAO LOCAL MOTORISTAS: APROVADA"
        )
        print("=" * 78)
        print(
            "Nenhuma conexao com "
            "Supabase foi realizada."
        )

        return

    print()
    print(
        "2. Conectando ao Supabase..."
    )

    cliente = criar_cliente()

    print(
        "   Conexao criada."
    )

    print()
    print(
        "3. Validando estado remoto..."
    )

    validar_estado_remoto_inicial(
        cliente
    )

    print(
        "   Stagings Motoristas: LIMPAS"
    )

    if dry_run:

        print()
        print("=" * 78)
        print(
            "DRY RUN MOTORISTAS: APROVADO"
        )
        print("=" * 78)

        print(
            "Nenhum dado foi alterado "
            "no Supabase."
        )

        return

    carga_id = uuid.uuid4()

    staging_enviada = False

    try:

        print()
        print(
            "4. Enviando stagings "
            "de Motoristas..."
        )

        print(
            "   carga_id:",
            carga_id,
        )

        enviar_staging(
            cliente,
            carga_id,
            ouros,
        )

        staging_enviada = True

        print()
        print(
            "5. Validando stagings..."
        )

        validar_staging(
            cliente,
            carga_id,
            contagens,
        )

        print(
            "   Stagings validadas."
        )

        print()
        print(
            "6. Executando promocao "
            "atomica de Motoristas..."
        )

        retorno = promover(
            cliente,
            carga_id,
            contagens,
        )

        print(
            "   Retorno:",
            retorno,
        )

        print()
        print(
            "7. Validando marts remotas..."
        )

        validar_marts_remotas(
            cliente,
            ouros,
        )

        print(
            "   Marts remotas validadas."
        )

        print()
        print(
            "8. Limpando stagings..."
        )

        limpar_staging(
            cliente,
            carga_id,
        )

        print(
            "   Stagings limpas."
        )

    except Exception:

        print()
        print("=" * 78)
        print(
            "PUBLICACAO MOTORISTAS INTERROMPIDA"
        )
        print("=" * 78)

        if staging_enviada:

            print(
                "Stagings preservadas "
                "para diagnostico."
            )

            print(
                "carga_id:",
                carga_id,
            )

        raise

    print()
    print("=" * 78)
    print(
        "PUBLICACAO MOTORISTAS "
        "CONCLUIDA COM SUCESSO"
    )
    print("=" * 78)

    for (
        aba,
        quantidade,
    ) in contagens.items():

        print(
            f"{aba}: {quantidade}"
        )


def main():

    parser = argparse.ArgumentParser(
        description=(
            "Publica as marts de "
            "Motoristas no Supabase."
        )
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
    )

    parser.add_argument(
        "--local-only",
        action="store_true",
        help=(
            "Valida somente a Ouro local "
            "sem conectar ao Supabase."
        ),
    )

    args = parser.parse_args()

    if (
        args.dry_run
        and args.local_only
    ):

        raise RuntimeError(
            "Use apenas um entre "
            "--dry-run e --local-only."
        )

    publicar(
        dry_run=args.dry_run,
        local_only=args.local_only,
    )


if __name__ == "__main__":

    try:
        main()

    except Exception as erro:

        print(
            f"ERRO: {erro}",
            file=sys.stderr,
        )

        sys.exit(1)
