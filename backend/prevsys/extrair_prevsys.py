from pathlib import Path
import sys
import time
import re
import unicodedata

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
from backend.acoes_corretivas import extrair_acoes_corretivas as acoes_corretivas


def validar_configuracao_compartilhada():

    perfis = {
        "Inspecoes": Path(
            inspecoes.PROFILE_DIR
        ).resolve(),

        "Planos de Acao": Path(
            planos.PROFILE_DIR
        ).resolve(),

        "Acoes Corretivas": Path(
            acoes_corretivas.PROFILE_DIR
        ).resolve(),
    }

    if len(
        set(
            perfis.values()
        )
    ) != 1:

        raise RuntimeError(
            "As fontes PREVSYS utilizam "
            "PROFILE_DIR diferentes. "
            "Sessao compartilhada bloqueada. "
            f"Perfis: {perfis}"
        )

    urls = {
        "Inspecoes": (
            str(
                inspecoes.URL_PREVSIS
            )
            .strip()
            .rstrip("/")
        ),

        "Planos de Acao": (
            str(
                planos.URL_PREVSIS
            )
            .strip()
            .rstrip("/")
        ),

        "Acoes Corretivas": (
            str(
                acoes_corretivas.URL_PREVSIS
            )
            .strip()
            .rstrip("/")
        ),
    }

    if len(
        set(
            urls.values()
        )
    ) != 1:

        raise RuntimeError(
            "As fontes PREVSYS utilizam "
            "URLs diferentes. "
            "Sessao compartilhada bloqueada. "
            f"URLs: {urls}"
        )

    print(
        "Configuracao compartilhada do Prevsys: OK"
    )


def abrir_nova_aba_reporte(
    context,
    url_reporte_360,
    nome_fonte,
):

    print()

    print(
        f"Abrindo {nome_fonte} em nova aba "
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
            f"A nova aba de {nome_fonte} "
            "nao reutilizou corretamente "
            "a sessao autenticada do Prevsys. "
            f"URL atual: {page.url}"
        )

    print(
        "Sessao autenticada reutilizada "
        "sem novo login."
    )

    print(
        f"Reporte 360: {page.url}"
    )

    return page


def selecionar_aba_superior(page, titulo):
    """Confirma o botao superior e o painel realmente ativos."""
    def normalizar(valor):
        texto = unicodedata.normalize("NFKD", str(valor or ""))
        texto = "".join(
            c for c in texto if not unicodedata.combining(c)
        )
        return " ".join(texto.lower().split())

    esperado = normalizar(titulo)

    abas = page.locator(
        "ul.menu-box-level2[role='tablist'] > li > a[role='tab']"
    )

    prazo = time.monotonic() + 60
    while time.monotonic() < prazo:
        candidatos = [
            abas.nth(n) for n in range(abas.count())
            if abas.nth(n).is_visible()
            and normalizar(abas.nth(n).inner_text()) == esperado
        ]

        if len(candidatos) == 1:
            candidatos[0].click(timeout=15000)
            break

        if len(candidatos) > 1:
            raise RuntimeError("Aba ambigua: " + titulo)

        page.wait_for_timeout(500)
    else:
        raise RuntimeError("Aba nao encontrada: " + titulo)

    prazo = time.monotonic() + 45
    while time.monotonic() < prazo:
        ativos = page.locator(
            "ul.menu-box-level2[role='tablist'] > li.active > a[role='tab']"
        ).all_inner_texts()

        titulos = page.locator(
            ".tab-pane.active .titulo-view"
        ).all_inner_texts()

        if (
            len(ativos) == 1
            and normalizar(ativos[0]) == esperado
            and any(normalizar(t) == esperado for t in titulos)
        ):
            print("ABA SUPERIOR E PAINEL CONFIRMADOS:", titulo)
            return

        page.wait_for_timeout(500)

    raise RuntimeError(
        "Aba ou painel nao confirmados: " + titulo
    )


def extrair_prevsys():

    print(
        "=" * 70
    )

    print(
        "EXTRACAO PREVSYS - INSPECOES + PLANOS DE ACAO + ACOES CORRETIVAS"
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

    acoes_corretivas.PASTA_BRONZE.mkdir(
        parents=True,
        exist_ok=True,
    )

    inspecoes.limpar_temporario()
    planos.limpar_temporario()
    acoes_corretivas.limpar_temporario()

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

                page_inspecoes = inspecoes.garantir_login(
                    page_inspecoes
                )

                # =================================================
                # 1/3 - INSPECOES
                # =================================================

                print()
                print(
                    "=" * 70
                )

                print(
                    "PREVSYS 1/3 - INSPECOES"
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
                    "para as proximas extracoes."
                )

                selecionar_aba_superior(
                    page_inspecoes, "analise da lista de verificacao"
                )

                arquivo_inspecoes = planos.exportar_excel(
                    page_inspecoes,
                    abrir_menu_func=lambda pagina: planos.abrir_menu_planos_acao(
                        pagina,
                        padrao_titulo=re.compile(
                            r"\bDetalle\s+Checklist\b", re.IGNORECASE
                        ),
                        nome_visual="Detalle Checklist",
                    ),
                    pasta_bronze=inspecoes.PASTA_BRONZE,
                    arquivo_temporario=inspecoes.ARQUIVO_TEMPORARIO,
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
                # 2/3 - PLANOS
                #
                # Nova aba, MESMO contexto.
                # Nao executa garantir_login novamente.
                # Nao abre novo Edge.
                # =================================================

                page_planos = (
                    abrir_nova_aba_reporte(
                        context,
                        url_reporte_360,
                        "Planos de Acao",
                    )
                )

                print()
                print(
                    "=" * 70
                )

                print(
                    "PREVSYS 2/3 - PLANOS DE ACAO"
                )

                print(
                    "=" * 70
                )

                selecionar_aba_superior(
                    page_planos, "analise plano de acao"
                )

                planos.selecionar_aba_interna_planos(page_planos)

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
                # 3/3 - ACOES CORRETIVAS
                #
                # Nova aba, MESMO contexto.
                # Nao executa login novamente.
                # Nao abre novo Edge.
                # =================================================

                page_acoes = (
                    abrir_nova_aba_reporte(
                        context,
                        url_reporte_360,
                        "Acoes Corretivas",
                    )
                )

                print()
                print(
                    "=" * 70
                )

                print(
                    "PREVSYS 3/3 - ACOES CORRETIVAS"
                )

                print(
                    "=" * 70
                )

                selecionar_aba_superior(
                    page_acoes, "analise plano de acao"
                )

                acoes_corretivas.abrir_acoes_corretivas(
                    page_acoes
                )

                arquivo_acoes = (
                    acoes_corretivas.exportar_excel(
                        page_acoes
                    )
                )

                acoes_corretivas.validar_excel_acoes_corretivas(
                    arquivo_acoes
                )

                print()

                print(
                    "Acoes Corretivas baixadas "
                    "e validadas."
                )

                print(
                    "Bronze oficial ainda nao promovida."
                )

                # =================================================
                # PROMOCAO SO DEPOIS DAS TRES VALIDACOES
                # =================================================

                print()
                print(
                    "=" * 70
                )

                print(
                    "PROMOVENDO AS TRES FONTES "
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

                acoes_corretivas.atualizar_bronze(
                    arquivo_acoes
                )

            finally:

                print()
                print(
                    "Fechando Prevsys / Edge "
                    "somente apos as tres extracoes..."
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
            "Acoes Corretivas: BAIXADAS E VALIDADAS"
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
