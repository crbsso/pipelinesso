from pathlib import Path
import sys
import time

from playwright.sync_api import (
    sync_playwright,
)


RAIZ = Path(__file__).resolve().parents[2]

if str(RAIZ) not in sys.path:
    sys.path.insert(
        0,
        str(RAIZ),
    )


from backend.inspecoes import extrair_quantidade as inspecoes
from backend.planos_acao import extrair_planos_acao as planos


def validar_configuracao_compartilhada():

    perfil_inspecoes = Path(
        inspecoes.PROFILE_DIR
    ).resolve()

    perfil_planos = Path(
        planos.PROFILE_DIR
    ).resolve()

    if perfil_inspecoes != perfil_planos:
        raise RuntimeError(
            "Inspecoes e Planos de Acao utilizam "
            "PROFILE_DIR diferentes. "
            "Sessao compartilhada bloqueada."
        )

    url_inspecoes = (
        str(
            inspecoes.URL_PREVSIS
        )
        .strip()
        .rstrip("/")
    )

    url_planos = (
        str(
            planos.URL_PREVSIS
        )
        .strip()
        .rstrip("/")
    )

    if url_inspecoes != url_planos:
        raise RuntimeError(
            "Inspecoes e Planos de Acao utilizam "
            "URLs Prevsys diferentes. "
            "Sessao compartilhada bloqueada."
        )

    print(
        "Configuracao compartilhada do Prevsys: OK"
    )


def abrir_segunda_aba_reporte(
    context,
    url_reporte_360,
):

    print()
    print(
        "Abrindo Planos de Acao em nova aba "
        "da mesma sessao autenticada..."
    )

    page = context.new_page()

    page.goto(
        url_reporte_360,
        wait_until="domcontentloaded",
        timeout=60000,
    )

    time.sleep(
        5
    )

    if "/KPI/VistaKPI" not in page.url:

        raise RuntimeError(
            "A segunda aba nao reutilizou corretamente "
            "a sessao autenticada do Prevsys. "
            f"URL atual: {page.url}"
        )

    print(
        "Sessao autenticada reutilizada sem novo login."
    )

    print(
        f"Reporte 360: {page.url}"
    )

    return page


def extrair_prevsys():

    print(
        "=" * 70
    )

    print(
        "EXTRACAO PREVSYS - INSPECOES + PLANOS DE ACAO"
    )

    print(
        "=" * 70
    )

    print()

    validar_configuracao_compartilhada()

    inspecoes.PASTA_BRONZE.mkdir(
        parents=True,
        exist_ok=True,
    )

    planos.PASTA_BRONZE.mkdir(
        parents=True,
        exist_ok=True,
    )

    inspecoes.limpar_temporario()
    planos.limpar_temporario()

    try:

        with sync_playwright() as p:

            print()
            print(
                "Abrindo Microsoft Edge uma unica vez..."
            )

            context = (
                p.chromium.launch_persistent_context(
                    user_data_dir=str(
                        inspecoes.PROFILE_DIR
                    ),
                    channel="msedge",
                    headless=False,
                    accept_downloads=True,
                    viewport=None,
                    chromium_sandbox=True,
                    args=[
                        "--start-maximized",
                    ],
                )
            )

            try:

                page_inspecoes = (
                    context.pages[0]
                    if context.pages
                    else context.new_page()
                )

                # =================================================
                # LOGIN UNICO
                # =================================================

                print()
                print(
                    "=" * 70
                )

                print(
                    "PREVSYS - LOGIN UNICO"
                )

                print(
                    "=" * 70
                )

                inspecoes.garantir_login(
                    page_inspecoes
                )

                # =================================================
                # 1/2 - INSPECOES
                # =================================================

                print()
                print(
                    "=" * 70
                )

                print(
                    "PREVSYS 1/2 - INSPECOES"
                )

                print(
                    "=" * 70
                )

                inspecoes.abrir_reporte_360(
                    page_inspecoes
                )

                url_reporte_360 = (
                    page_inspecoes.url
                )

                print(
                    "URL do Reporte 360 preservada "
                    "para a segunda extracao."
                )

                inspecoes.abrir_lista_verificacao(
                    page_inspecoes
                )

                arquivo_inspecoes = (
                    inspecoes.exportar_excel(
                        page_inspecoes
                    )
                )

                inspecoes.validar_excel_inspecoes(
                    arquivo_inspecoes
                )

                print()
                print(
                    "Inspecoes baixadas e validadas."
                )

                print(
                    "Bronze oficial ainda nao promovida."
                )

                # =================================================
                # 2/2 - PLANOS
                #
                # Nova aba, MESMO contexto.
                # Nao executa garantir_login novamente.
                # Nao abre novo Edge.
                # =================================================

                page_planos = (
                    abrir_segunda_aba_reporte(
                        context,
                        url_reporte_360,
                    )
                )

                print()
                print(
                    "=" * 70
                )

                print(
                    "PREVSYS 2/2 - PLANOS DE ACAO"
                )

                print(
                    "=" * 70
                )

                planos.abrir_plano_acao(
                    page_planos
                )

                arquivo_planos = (
                    planos.exportar_excel(
                        page_planos
                    )
                )

                planos.validar_excel_planos_acao(
                    arquivo_planos
                )

                print()
                print(
                    "Planos de Acao baixados e validados."
                )

                print(
                    "Bronze oficial ainda nao promovida."
                )

                # =================================================
                # PROMOCAO SO DEPOIS DAS DUAS VALIDACOES
                # =================================================

                print()
                print(
                    "=" * 70
                )

                print(
                    "PROMOVENDO AS DUAS FONTES "
                    "PREVSYS PARA O BRONZE"
                )

                print(
                    "=" * 70
                )

                inspecoes.atualizar_bronze(
                    arquivo_inspecoes
                )

                planos.atualizar_bronze(
                    arquivo_planos
                )

            finally:

                print()
                print(
                    "Fechando Prevsys / Edge "
                    "somente apos as duas extracoes..."
                )

                try:
                    context.close()

                except Exception:
                    pass

        print()
        print(
            "=" * 70
        )

        print(
            "EXTRACAO PREVSYS CONCLUIDA COM SUCESSO"
        )

        print(
            "=" * 70
        )

        print(
            "Edge aberto: 1 vez"
        )

        print(
            "Login Prevsys: 1 vez"
        )

        print(
            "Inspecoes: BAIXADAS E VALIDADAS"
        )

        print(
            "Planos de Acao: BAIXADOS E VALIDADOS"
        )

        print(
            "Bronzes oficiais: ATUALIZADAS"
        )

        print(
            "Edge fechado: 1 vez"
        )

    except Exception:

        inspecoes.limpar_temporario()
        planos.limpar_temporario()

        raise


if __name__ == "__main__":
    extrair_prevsys()
