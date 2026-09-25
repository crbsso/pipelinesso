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

    if url_inspecoes != url_avcb:

        raise RuntimeError(
            "Inspecoes e AVCB apontam "
            "para Supabase diferentes."
        )

    if secret_inspecoes != secret_avcb:

        raise RuntimeError(
            "Inspecoes e AVCB utilizam "
            "credenciais diferentes."
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

    if not registros_inspecoes:

        raise RuntimeError(
            "Mart local de Inspecoes vazia."
        )

    if not registros_avcb:

        raise RuntimeError(
            "Mart local de AVCB vazia."
        )

    return (
        registros_inspecoes,
        registros_avcb,
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

    print(
        "   Staging Inspecoes:",
        staging_inspecoes,
    )

    print(
        "   Buffer AVCB:",
        buffer_avcb,
    )

    print(
        "   Mart Inspecoes atual:",
        mart_inspecoes,
    )

    print(
        "   Mart AVCB atual:",
        mart_avcb,
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


# =========================================================
# RPC GLOBAL
# =========================================================

def promover_globalmente(
    cliente,
    carga_inspecoes,
    quantidade_inspecoes,
    carga_avcb,
    quantidade_avcb,
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

    staging_enviada = False
    buffer_enviado = False


    try:

        # =================================================
        # INSPECOES
        # =================================================

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

        staging_enviada = True


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


        # =================================================
        # AVCB
        # =================================================

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

        buffer_enviado = True


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


        # =================================================
        # GATE GLOBAL ATOMICO
        # =================================================

        print(
            "\n8. Executando promocao "
            "global atomica..."
        )

        retorno = promover_globalmente(
            cliente,
            carga_inspecoes,
            len(registros_inspecoes),
            carga_avcb,
            len(registros_avcb),
        )

        print(
            "   RPC global concluida."
        )

        print(
            "   Retorno:",
            retorno,
        )


        # =================================================
        # VALIDACAO DAS MARTS OFICIAIS
        # =================================================

        print(
            "\n9. Validando Mart "
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
            "\n10. Validando Mart AVCB..."
        )

        avcb.validar_mart(
            cliente,
            registros_avcb,
        )

        print(
            "   Mart AVCB validada."
        )


        # =================================================
        # LIMPEZA DAS CARGAS TECNICAS
        # =================================================

        print(
            "\n11. Limpando staging "
            "de Inspecoes..."
        )

        inspecoes.limpar_staging(
            cliente,
            carga_inspecoes,
        )

        print(
            "   Staging limpa."
        )


        print(
            "\n12. Limpando buffer AVCB..."
        )

        avcb.limpar_buffer(
            cliente,
            carga_avcb,
        )

        print(
            "   Buffer limpo."
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

        if staging_enviada:

            print(
                "Staging de Inspecoes "
                "preservada para diagnostico."
            )

            print(
                "carga_id Inspecoes:",
                carga_inspecoes,
            )

        if buffer_enviado:

            print(
                "Buffer AVCB preservado "
                "para diagnostico."
            )

            print(
                "carga_id AVCB:",
                carga_avcb,
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
        "Staging Inspecoes: LIMPA"
    )

    print(
        "Buffer AVCB: LIMPO"
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
            "Publica Inspecoes e AVCB "
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
