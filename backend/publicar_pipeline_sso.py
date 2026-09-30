import argparse
import sys
import uuid
from pathlib import Path

from supabase import create_client


# =========================================================
# IMPORTS DO PROJETO
# =========================================================

RAIZ = Path(
    __file__
).resolve().parents[1]

if str(RAIZ) not in sys.path:
    sys.path.insert(
        0,
        str(RAIZ),
    )


from backend.inspecoes import (
    publicar_ouro_inspecoes as inspecoes,
)

from backend.avcb import (
    publicar_ouro_avcb as avcb,
)

from backend.planos_acao import (
    publicar_ouro_planos_acao as planos,
)


RPC_GLOBAL = "promover_pipeline_sso"


# =========================================================
# CONFIGURACAO
# =========================================================

def criar_cliente():

    url_inspecoes, secret_inspecoes = (
        inspecoes.carregar_configuracao()
    )

    url_avcb, secret_avcb = (
        avcb.carregar_configuracao()
    )

    url_planos, secret_planos = (
        planos.carregar_configuracao()
    )

    urls = {
        url_inspecoes,
        url_avcb,
        url_planos,
    }

    if len(urls) != 1:

        raise RuntimeError(
            "Inspecoes, AVCB e Planos de Acao "
            "apontam para Supabase diferentes."
        )

    secrets = {
        secret_inspecoes,
        secret_avcb,
        secret_planos,
    }

    if len(secrets) != 1:

        raise RuntimeError(
            "Inspecoes, AVCB e Planos de Acao "
            "utilizam credenciais diferentes."
        )

    return create_client(
        url_inspecoes,
        secret_inspecoes,
    )


# =========================================================
# OUROS LOCAIS
# =========================================================

def carregar_ouros():

    registros_inspecoes, _ = (
        inspecoes.carregar_ouro()
    )

    registros_avcb = (
        avcb.carregar_ouro()
    )

    registros_planos = (
        planos.carregar_ouro()
    )

    if not registros_inspecoes:

        raise RuntimeError(
            "Mart local de Inspecoes vazia."
        )

    if not registros_avcb:

        raise RuntimeError(
            "Mart local de AVCB vazia."
        )

    if not registros_planos:

        raise RuntimeError(
            "Mart local de Planos de Acao vazia."
        )

    indicadores_planos = (
        planos.validar_local(
            registros_planos
        )
    )

    return (
        registros_inspecoes,
        registros_avcb,
        registros_planos,
        indicadores_planos,
    )


# =========================================================
# ESTADO REMOTO
# =========================================================

def validar_estado_remoto_inicial(
    cliente,
):

    staging_inspecoes = (
        inspecoes.contar_registros(
            cliente,
            inspecoes.TABELA_STAGING,
        )
    )

    buffer_avcb = (
        avcb.contar(
            cliente,
            avcb.TABELA_BUFFER,
        )
    )

    staging_planos = (
        planos.contar_remoto(
            cliente,
            planos.TABELA_STAGING,
        )
    )

    mart_inspecoes = (
        inspecoes.contar_registros(
            cliente,
            inspecoes.TABELA_MART,
        )
    )

    mart_avcb = (
        avcb.contar(
            cliente,
            avcb.TABELA_MART,
        )
    )

    mart_planos = (
        planos.contar_remoto(
            cliente,
            planos.TABELA_MART,
        )
    )

    print(
        "   Staging Inspecoes:",
        staging_inspecoes,
    )

    print(
        "   Buffer AVCB:",
        buffer_avcb,
    )

    print(
        "   Staging Planos de Acao:",
        staging_planos,
    )

    print(
        "   Mart Inspecoes atual:",
        mart_inspecoes,
    )

    print(
        "   Mart AVCB atual:",
        mart_avcb,
    )

    print(
        "   Mart Planos de Acao atual:",
        mart_planos,
    )

    if staging_inspecoes != 0:

        raise RuntimeError(
            "Staging de Inspecoes "
            "nao esta vazia. "
            "Publicacao global bloqueada."
        )

    if buffer_avcb != 0:

        raise RuntimeError(
            "Buffer de AVCB "
            "nao esta vazio. "
            "Publicacao global bloqueada."
        )

    if staging_planos != 0:

        raise RuntimeError(
            "Staging de Planos de Acao "
            "nao esta vazia. "
            "Publicacao global bloqueada."
        )


# =========================================================
# RPC GLOBAL
# =========================================================

def promover_globalmente(
    cliente,
    carga_inspecoes,
    quantidade_inspecoes,
    carga_avcb,
    quantidade_avcb,
    carga_planos_acao,
    quantidade_planos_acao,
):

    resposta = (
        cliente
        .rpc(
            RPC_GLOBAL,
            {
                "p_carga_inspecoes":
                    carga_inspecoes,
                "p_quantidade_inspecoes":
                    quantidade_inspecoes,
                "p_carga_avcb":
                    carga_avcb,
                "p_quantidade_avcb":
                    quantidade_avcb,
                "p_carga_planos_acao":
                    carga_planos_acao,
                "p_quantidade_planos_acao":
                    quantidade_planos_acao,
            },
        )
        .execute()
    )

    retorno = resposta.data

    if not isinstance(
        retorno,
        dict,
    ):

        raise RuntimeError(
            "RPC global retornou "
            "formato inesperado."
        )

    inspecoes_publicadas = (
        retorno.get(
            "inspecoes"
        )
    )

    avcb_publicados = (
        retorno.get(
            "avcb"
        )
    )

    planos_publicados = (
        retorno.get(
            "planos_acao"
        )
    )

    if (
        inspecoes_publicadas
        != quantidade_inspecoes
    ):

        raise RuntimeError(
            "RPC global retornou "
            "quantidade divergente "
            "para Inspecoes."
        )

    if (
        avcb_publicados
        != quantidade_avcb
    ):

        raise RuntimeError(
            "RPC global retornou "
            "quantidade divergente "
            "para AVCB."
        )

    if (
        planos_publicados
        != quantidade_planos_acao
    ):

        raise RuntimeError(
            "RPC global retornou "
            "quantidade divergente "
            "para Planos de Acao."
        )

    return retorno


# =========================================================
# PUBLICACAO GLOBAL
# =========================================================

def publicar(
    dry_run=False,
):

    print("=" * 70)
    print("PUBLICACAO GLOBAL - PIPELINE SSO")
    print("=" * 70)

    print(
        "\n1. Validando marts locais..."
    )

    (
        registros_inspecoes,
        registros_avcb,
        registros_planos,
        indicadores_planos,
    ) = carregar_ouros()

    print(
        "   Inspecoes:",
        len(registros_inspecoes),
    )

    print(
        "   AVCB:",
        len(registros_avcb),
    )

    print(
        "   Planos de Acao:",
        len(registros_planos),
    )

    print(
        "\n2. Conectando ao Supabase..."
    )

    cliente = criar_cliente()

    print(
        "   Conexao criada."
    )

    print(
        "\n3. Validando estado remoto..."
    )

    validar_estado_remoto_inicial(
        cliente
    )

    if dry_run:

        print()
        print(
            "DRY RUN GLOBAL: APROVADO"
        )

        print(
            "Nenhum dado foi alterado "
            "no Supabase."
        )

        return

    carga_inspecoes = str(
        uuid.uuid4()
    )

    carga_avcb = str(
        uuid.uuid4()
    )

    carga_planos_acao = str(
        uuid.uuid4()
    )

    staging_inspecoes_enviada = False
    buffer_avcb_enviado = False
    staging_planos_enviada = False

    try:

        print(
            "\n4. Enviando staging "
            "de Inspecoes..."
        )

        print(
            "   carga_id:",
            carga_inspecoes,
        )

        inspecoes.enviar_staging(
            cliente,
            carga_inspecoes,
            registros_inspecoes,
        )

        staging_inspecoes_enviada = True

        print(
            "\n5. Validando staging "
            "de Inspecoes..."
        )

        inspecoes.validar_staging(
            cliente,
            carga_inspecoes,
            registros_inspecoes,
        )

        print(
            "   Staging de Inspecoes "
            "validada."
        )

        print(
            "\n6. Enviando buffer AVCB..."
        )

        print(
            "   carga_id:",
            carga_avcb,
        )

        avcb.enviar_buffer(
            cliente,
            carga_avcb,
            registros_avcb,
        )

        buffer_avcb_enviado = True

        print(
            "\n7. Validando buffer AVCB..."
        )

        avcb.validar_buffer(
            cliente,
            carga_avcb,
            registros_avcb,
        )

        print(
            "   Buffer AVCB validado."
        )

        print(
            "\n8. Enviando staging "
            "de Planos de Acao..."
        )

        print(
            "   carga_id:",
            carga_planos_acao,
        )

        planos.carregar_staging(
            cliente,
            registros_planos,
            carga_planos_acao,
        )

        staging_planos_enviada = True

        quantidade_planos_staging = (
            planos.contar_remoto(
                cliente,
                planos.TABELA_STAGING,
                carga_id=carga_planos_acao,
            )
        )

        if (
            quantidade_planos_staging
            != indicadores_planos[
                "total"
            ]
        ):

            raise RuntimeError(
                "Quantidade na staging de "
                "Planos de Acao difere "
                "da Ouro local."
            )

        print(
            "   Staging de Planos de Acao "
            "validada."
        )

        print(
            "\n9. Executando promocao "
            "global atomica..."
        )

        retorno = promover_globalmente(
            cliente,
            carga_inspecoes,
            len(registros_inspecoes),
            carga_avcb,
            len(registros_avcb),
            carga_planos_acao,
            indicadores_planos[
                "total"
            ],
        )

        print(
            "   RPC global concluida."
        )

        print(
            "   Retorno:",
            retorno,
        )

        print(
            "\n10. Validando Mart "
            "de Inspecoes..."
        )

        inspecoes.validar_mart(
            cliente,
            registros_inspecoes,
        )

        print(
            "   Mart de Inspecoes "
            "validada."
        )

        print(
            "\n11. Validando Mart AVCB..."
        )

        avcb.validar_mart(
            cliente,
            registros_avcb,
        )

        print(
            "   Mart AVCB validada."
        )

        print(
            "\n12. Validando Mart "
            "de Planos de Acao..."
        )

        planos.validar_mart_remota(
            cliente,
            indicadores_planos,
        )

        print(
            "   Mart de Planos de Acao "
            "validada."
        )

        print(
            "\n13. Limpando staging "
            "de Inspecoes..."
        )

        inspecoes.limpar_staging(
            cliente,
            carga_inspecoes,
        )

        print(
            "   Staging de Inspecoes limpa."
        )

        print(
            "\n14. Limpando buffer AVCB..."
        )

        avcb.limpar_buffer(
            cliente,
            carga_avcb,
        )

        print(
            "   Buffer AVCB limpo."
        )

        print(
            "\n15. Limpando staging "
            "de Planos de Acao..."
        )

        planos.limpar_staging(
            cliente,
            carga_planos_acao,
        )

        print(
            "   Staging de Planos de Acao limpa."
        )

    except Exception:

        print()
        print("=" * 70)
        print(
            "PUBLICACAO GLOBAL INTERROMPIDA"
        )
        print("=" * 70)

        print(
            "Nenhum arquivo local "
            "foi removido."
        )

        if staging_inspecoes_enviada:

            print(
                "Staging de Inspecoes "
                "preservada para diagnostico."
            )

            print(
                "carga_id Inspecoes:",
                carga_inspecoes,
            )

        if buffer_avcb_enviado:

            print(
                "Buffer AVCB preservado "
                "para diagnostico."
            )

            print(
                "carga_id AVCB:",
                carga_avcb,
            )

        if staging_planos_enviada:

            print(
                "Staging de Planos de Acao "
                "preservada para diagnostico."
            )

            print(
                "carga_id Planos de Acao:",
                carga_planos_acao,
            )

        raise

    print()
    print("=" * 70)

    print(
        "PUBLICACAO GLOBAL CONCLUIDA "
        "COM SUCESSO"
    )

    print("=" * 70)

    print(
        "Inspecoes publicadas:",
        len(registros_inspecoes),
    )

    print(
        "AVCB publicados:",
        len(registros_avcb),
    )

    print(
        "Planos de Acao publicados:",
        indicadores_planos[
            "total"
        ],
    )

    print(
        "Staging Inspecoes: LIMPA"
    )

    print(
        "Buffer AVCB: LIMPO"
    )

    print(
        "Staging Planos de Acao: LIMPA"
    )

    print(
        "Arquivos locais: PRESERVADOS"
    )


# =========================================================
# CLI
# =========================================================

def main():

    parser = argparse.ArgumentParser(
        description=(
            "Publica Inspecoes, AVCB e Planos de Acao "
            "atomicamente no Supabase."
        )
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Valida marts locais e "
            "estado remoto sem alterar "
            "o Supabase."
        ),
    )

    args = parser.parse_args()

    publicar(
        dry_run=args.dry_run
    )


if __name__ == "__main__":

    main()
