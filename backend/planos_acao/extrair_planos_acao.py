from pathlib import Path
import os
import re
import time
import zipfile

from openpyxl import load_workbook
from playwright.sync_api import (
    sync_playwright,
    TimeoutError as PlaywrightTimeoutError,
)


# =========================================================
# CONFIGURACOES DO PROJETO
# =========================================================

PASTA_PROJETO = Path(__file__).resolve().parents[2]

URL_PREVSIS = os.getenv(
    "PREVSIS_URL",
    "https://celeo.prevsis.com/Login/LoginForm",
)

PROFILE_DIR = (
    PASTA_PROJETO
    / ".edge_sso_playwright"
)


# =========================================================
# BRONZE - INSPECOES / QUANTIDADE
# =========================================================

PASTA_BRONZE = (
    PASTA_PROJETO
    / "data"
    / "bronze"
    / "planos_acao"
)

ARQUIVO_FINAL = (
    PASTA_BRONZE
    / "Planos_de_acao_detalhados.xlsx"
)

ARQUIVO_TEMPORARIO = (
    PASTA_BRONZE
    / "Planos_de_acao_detalhados_novo.xlsx"
)


# =========================================================
# CAMPOS MINIMOS ESPERADOS
# =========================================================

COLUNAS_OBRIGATORIAS = {
    "Plano de identifica??o",
    "ID da resposta",
    "Nome do plano de a??o",
    "M?dulo de origem",
    "In?cio do plano",
    "Cria??o do plano",
    "Cronograma do plano",
    "Encerramento do plano",
    "N?vel organizacional",
    "Divis?o do plano",
    "Estado do plano",
    "Criador do plano",
    "Gestor de Plano",
    "Descri??o do plano de a??o",
    "Contrato de plano de a??o",
}


# =========================================================
# UTILITARIOS PLAYWRIGHT
# =========================================================

def frames_da_pagina(page):
    """
    Retorna o frame principal e todos os iframes carregados.

    O dashboard do Prevsys utiliza Amazon QuickSight,
    portanto parte dos elementos pode estar dentro de iframe.
    """
    return page.frames


def localizar_texto(
    page,
    texto,
    exact=False,
):
    """
    Procura o texto no frame principal e nos iframes.

    Quando existem elementos duplicados, retorna
    somente um elemento realmente visivel.
    """

    for frame in frames_da_pagina(page):

        try:
            locators = frame.get_by_text(
                texto,
                exact=exact,
            )

            quantidade = locators.count()

            for indice in range(quantidade):

                locator = locators.nth(indice)

                try:
                    if locator.is_visible():
                        return frame, locator
                except Exception:
                    continue

        except Exception:
            continue

    return None, None



def aguardar_texto(
    page,
    texto,
    timeout=60000,
    exact=False,
):
    """
    Aguarda um texto aparecer em qualquer frame.
    """

    limite = time.time() + timeout / 1000

    while time.time() < limite:

        frame, locator = localizar_texto(
            page,
            texto,
            exact=exact,
        )

        if locator is not None:

            try:
                if locator.is_visible():
                    return frame, locator
            except Exception:
                pass

        time.sleep(0.5)

    raise RuntimeError(
        f"O texto '{texto}' não apareceu "
        f"dentro de {timeout / 1000:.0f}s."
    )


# =========================================================
# LOGIN
# =========================================================

def garantir_login(page):
    """Confirma sessao no menu interno; nunca confunde LoginForm com login completo.

    A autenticacao Azure pode redirecionar a aba original ou abrir outra.
    Devolve a aba autenticada para o restante da extracao.
    """
    from urllib.parse import urlsplit

    print("Abrindo Prevsys...")
    page.goto(
        URL_PREVSIS,
        wait_until="domcontentloaded",
        timeout=60000,
    )

    page.wait_for_timeout(1500)
    _, botao_login = localizar_texto(
        page, "Azure AD Login", exact=True,
    )
    if botao_login is not None:
        try:
            if botao_login.is_visible():
                print("Tela de login: acionando Azure AD Login...")
                botao_login.click(timeout=20000)
        except Exception as erro:
            # O clique pode iniciar a navegacao antes de retornar.
            # A confirmacao abaixo e a unica fonte de verdade.
            print("Aviso no acionamento do Azure AD:", type(erro).__name__)

    print("Aguardando pagina autenticada e menu 'Reporte 360'...")
    print("Se houver solicitacao Microsoft/MFA, conclua-a no Edge.")

    contexto = page.context
    prazo = time.monotonic() + 180

    while time.monotonic() < prazo:
        # Considera a aba inicial e as abas abertas pelo login federado.
        abas = [page]
        try:
            abas.extend(p for p in contexto.pages if p is not page)
        except Exception:
            pass

        for aba in abas:
            try:
                if aba.is_closed():
                    continue
                atual = urlsplit(aba.url)
                caminho = atual.path.lower().rstrip("/")
                if atual.scheme != "https" or atual.hostname != "celeo.prevsis.com":
                    continue
                if caminho in ("", "/login") or caminho.startswith("/login/"):
                    continue
                _, menu = localizar_texto(aba, "Reporte 360", exact=False)
                if menu is None or not menu.is_visible():
                    continue
                print("Sessao autenticada confirmada:", atual.hostname + atual.path)
                return aba
            except Exception:
                continue

        # O wait do Playwright permite que redirecionamentos e popups avancem.
        try:
            aba_espera = next((a for a in abas if not a.is_closed()), None)
            if aba_espera is None:
                raise RuntimeError("Todas as abas foram fechadas durante o login")
            aba_espera.wait_for_timeout(750)
        except Exception:
            time.sleep(0.75)

    raise RuntimeError(
        "Login Prevsys nao foi confirmado: pagina interna com o menu "
        "'Reporte 360' nao apareceu em ate 180s. "
        "A tela /Login/LoginForm NAO prova autenticacao. "
        "Verifique no Edge se o Microsoft/Azure AD ou MFA ficou pendente. "
        "Nenhuma extracao oficial deve prosseguir neste estado."
    )


# =========================================================
# ABRE REPORTE 360
# =========================================================

def abrir_reporte_360(page):

    print("Procurando Reporte 360...")

    _, locator = aguardar_texto(
        page,
        "Reporte 360",
        timeout=60000,
        exact=False,
    )

    print("Reporte 360 visivel encontrado.")

    locator.scroll_into_view_if_needed()

    locator.click(
        timeout=15000,
    )

    print(
        "Reporte 360 acionado. "
        "Aguardando pagina do relatorio..."
    )

    try:
        page.wait_for_url(
            re.compile(
                r".*/KPI/VistaKPI.*",
                re.IGNORECASE,
            ),
            timeout=120000,
        )
    except PlaywrightTimeoutError:
        raise RuntimeError(
            "O clique em Reporte 360 ocorreu, "
            "mas a pagina KPI/VistaKPI nao foi carregada."
        )

    print(
        f"Reporte 360 carregado: {page.url}"
    )

    # Aguarda a interface do QuickSight iniciar.
    time.sleep(5)


# =========================================================
# ABRE ANALISE DA LISTA DE VERIFICACAO
# =========================================================

def abrir_plano_acao(page):
    """Seleciona e confirma a aba SUPERIOR do Reporte 360.

    Evita o menu lateral 'Plano de Acao' e nao aceita o clique como
    confirmacao de que o painel do QuickSight foi trocado.
    """
    print("Procurando ABA SUPERIOR 'Analise Plano de Acao'...")
    padrao = re.compile(
        r"^\s*An[aá]lise\s+Plano\s+de\s+A[cç][aã]o\s*$",
        re.IGNORECASE,
    )
    prazo = time.monotonic() + 60
    clicou = False
    while time.monotonic() < prazo and not clicou:
        candidatos = page.main_frame.get_by_text(padrao)
        for indice in range(candidatos.count()):
            candidato = candidatos.nth(indice)
            try:
                if not candidato.is_visible():
                    continue
                candidato.scroll_into_view_if_needed(timeout=10000)
                candidato.click(timeout=15000)
                clicou = True
                break
            except Exception:
                continue
        if not clicou:
            page.wait_for_timeout(750)

    if not clicou:
        raise RuntimeError(
            "A ABA SUPERIOR 'Analise Plano de Acao' nao foi localizada "
            "no Reporte 360. Nenhum download iniciado."
        )

    print("Aba superior de Plano de Acao acionada; confirmando painel...")
    prazo = time.monotonic() + 45
    while time.monotonic() < prazo:
        encontrados = page.main_frame.get_by_text(padrao)
        posicoes = []
        for indice in range(encontrados.count()):
            try:
                elemento = encontrados.nth(indice)
                if elemento.is_visible():
                    caixa = elemento.bounding_box()
                    if caixa:
                        posicoes.append(caixa["y"])
            except Exception:
                continue
        if len(posicoes) >= 2 and max(posicoes)-min(posicoes) >= 35:
            print("Painel 'Analise Plano de Acao': CONFIRMADO.")
            return
        page.wait_for_timeout(750)

    raise RuntimeError(
        "A aba de Plano de Acao foi clicada, mas seu cabecalho "
        "nao apareceu. Nao exportar: pode ser a analise errada."
    )


def selecionar_aba_interna_planos(page):
    """Seleciona explicitamente a aba INTERNA 'Planos de acao'.

    A localizacao exata do visual detalhado e sua exportacao continuam
    por conta de abrir_menu_planos_acao, que faz rolagem progressiva.
    """
    print("Selecionando aba interna 'Planos de acao'...")
    padrao = re.compile(r"^\s*Planos\s+de\s+a[cç][aã]o\s*$", re.IGNORECASE)
    prazo = time.monotonic() + 60
    while time.monotonic() < prazo:
        # Preferencia por tabs semanticas dentro do dashboard do QuickSight;
        # fallback para texto exato (versoes antigas nao usam role=tab).
        # O Prevsys pode incorporar o QuickSight em iframe ou no proprio
        # documento principal. Preserva-se a compatibilidade com ambos.
        contextos = [f for f in page.frames if f is not page.main_frame]
        contextos.append(page.main_frame)
        for contexto in contextos:
            try:
                grupos = (
                    contexto.get_by_role("tab", name=padrao),
                    contexto.get_by_text(padrao),
                )
                for candidatos in grupos:
                    for indice in range(candidatos.count()):
                        candidato = candidatos.nth(indice)
                        try:
                            if not candidato.is_visible():
                                continue
                            candidato.scroll_into_view_if_needed(timeout=10000)
                            candidato.click(timeout=15000)
                            print("Aba interna 'Planos de acao' acionada.")
                            return
                        except Exception:
                            continue
            except Exception:
                continue
        page.wait_for_timeout(750)
    raise RuntimeError(
        "A aba interna 'Planos de acao' nao foi encontrada dentro "
        "da analise. A exportacao foi bloqueada."
    )


def abrir_menu_planos_acao(
    page,
    padrao_titulo=None,
    nome_visual="Planos de acao detalhados",
):

    print(
        f"Procurando visual '{nome_visual}'..."
    )

    if padrao_titulo is None:
        padrao_titulo = re.compile(
            r"Planos\s+de\s+a..o\s+detalhados",
            re.IGNORECASE,
        )

    if not hasattr(padrao_titulo, "search"):
        raise TypeError("padrao_titulo deve ser uma expressao regular compilada.")


    # =====================================================
    # CONTEXTOS DISPONIVEIS
    # =====================================================

    def obter_contextos():

        contextos = []

        try:
            contextos.append(
                (
                    "PAGINA_PRINCIPAL",
                    page,
                )
            )
        except Exception:
            pass


        try:

            for indice, frame in enumerate(
                page.frames
            ):

                try:

                    # Ignora somente frames realmente mortos.
                    frame.locator(
                        "body"
                    ).count()

                    contextos.append(
                        (
                            f"FRAME_{indice}",
                            frame,
                        )
                    )

                except Exception:
                    continue

        except Exception:
            pass


        return contextos


    # =====================================================
    # PROCURA O TITULO EM TODOS OS CONTEXTOS
    # =====================================================

    def localizar_titulo():

        for nome, contexto in obter_contextos():

            try:

                candidatos = (
                    contexto.get_by_text(
                        padrao_titulo
                    )
                )


                for indice in range(
                    candidatos.count()
                ):

                    candidato = (
                        candidatos.nth(
                            indice
                        )
                    )

                    try:

                        if (
                            candidato.is_visible()
                        ):

                            return (
                                nome,
                                contexto,
                                candidato,
                            )

                    except Exception:
                        continue

            except Exception:
                continue


        return (
            None,
            None,
            None,
        )


    # =====================================================
    # PROCURA ANTES DE ROLAR
    # =====================================================

    (
        nome_contexto,
        contexto_titulo,
        titulo,
    ) = localizar_titulo()


    if titulo is not None:

        print(
            "Visual encontrado "
            "sem necessidade de rolagem."
        )


    # =====================================================
    # ROLAGEM PROGRESSIVA
    # =====================================================

    tentativa = 0

    limite = (
        time.time() + 150
    )


    while (
        titulo is None
        and
        time.time() < limite
    ):

        tentativa += 1

        contextos = (
            obter_contextos()
        )


        if tentativa == 1:

            print(
                "Visual ainda nao visivel."
            )

            print(
                "Foram encontrados "
                f"{len(contextos)} contextos."
            )

            print(
                "Percorrendo todas as "
                "barras verticais relevantes..."
            )


        resumo = []


        for (
            nome,
            contexto,
        ) in contextos:

            try:

                resultado = (
                    contexto.evaluate(
                        """
                        () => {

                            const viewportW =
                                window.innerWidth;

                            const viewportH =
                                window.innerHeight;


                            const todos = [
                                document.scrollingElement,
                                ...document.querySelectorAll("*")
                            ].filter(Boolean);


                            const rolaveis = [];


                            for (
                                const el
                                of todos
                            ) {

                                try {

                                    const clientH =
                                        el.clientHeight || 0;

                                    const scrollH =
                                        el.scrollHeight || 0;

                                    const diferenca =
                                        scrollH - clientH;


                                    if (
                                        clientH < 100
                                        ||
                                        diferenca < 100
                                    ) {
                                        continue;
                                    }


                                    const rect =
                                        el.getBoundingClientRect();

                                    const estilo =
                                        getComputedStyle(el);


                                    const overflowY =
                                        estilo.overflowY;


                                    const candidato =
                                        (
                                            overflowY === "auto"
                                            ||
                                            overflowY === "scroll"
                                            ||
                                            overflowY === "overlay"
                                            ||
                                            diferenca > 400
                                        );


                                    if (
                                        !candidato
                                    ) {
                                        continue;
                                    }


                                    rolaveis.push({
                                        el: el,

                                        diferenca:
                                            diferenca,

                                        clientH:
                                            clientH,

                                        scrollH:
                                            scrollH,

                                        top:
                                            rect.top,

                                        left:
                                            rect.left,

                                        width:
                                            rect.width,

                                        height:
                                            rect.height,

                                        overflowY:
                                            overflowY
                                    });

                                } catch (_) {
                                }
                            }


                            rolaveis.sort(
                                (a, b) =>
                                    b.diferenca -
                                    a.diferenca
                            );


                            let movimentados = 0;

                            const detalhes = [];


                            for (
                                const item
                                of rolaveis.slice(
                                    0,
                                    15
                                )
                            ) {

                                const el =
                                    item.el;

                                const antes =
                                    el.scrollTop || 0;

                                const maximo =
                                    Math.max(
                                        0,
                                        el.scrollHeight -
                                        el.clientHeight
                                    );


                                if (
                                    antes >= maximo
                                ) {

                                    detalhes.push({
                                        movido:
                                            false,

                                        top:
                                            antes,

                                        maximo:
                                            maximo,

                                        width:
                                            item.width,

                                        height:
                                            item.height,

                                        overflow:
                                            item.overflowY
                                    });

                                    continue;
                                }


                                const passo =
                                    Math.max(
                                        450,
                                        Math.floor(
                                            el.clientHeight *
                                            0.65
                                        )
                                    );


                                el.scrollTop =
                                    Math.min(
                                        maximo,
                                        antes + passo
                                    );


                                const depois =
                                    el.scrollTop || 0;


                                if (
                                    depois !== antes
                                ) {

                                    movimentados += 1;
                                }


                                detalhes.push({
                                    movido:
                                        depois !== antes,

                                    antes:
                                        antes,

                                    depois:
                                        depois,

                                    maximo:
                                        maximo,

                                    width:
                                        item.width,

                                    height:
                                        item.height,

                                    overflow:
                                        item.overflowY
                                });
                            }


                            try {

                                window.scrollBy(
                                    0,
                                    Math.max(
                                        400,
                                        Math.floor(
                                            viewportH * 0.6
                                        )
                                    )
                                );

                            } catch (_) {
                            }


                            return {
                                total:
                                    rolaveis.length,

                                movimentados:
                                    movimentados,

                                detalhes:
                                    detalhes.slice(
                                        0,
                                        8
                                    )
                            };
                        }
                        """
                    )
                )


                resumo.append(
                    (
                        nome,
                        resultado,
                    )
                )

            except Exception:
                continue


        time.sleep(
            0.8
        )


        (
            nome_contexto,
            contexto_titulo,
            titulo,
        ) = localizar_titulo()


        if titulo is not None:

            print(
                f"Visual '{nome_visual}' encontrado."
            )

            print(
                "Contexto:",
                nome_contexto,
            )

            break


        if (
            tentativa % 5
            == 0
        ):

            print()
            print(
                f"Tentativa {tentativa}"
            )

            for (
                nome,
                resultado,
            ) in resumo:

                print(
                    nome,
                    "->",
                    resultado,
                )


    # =====================================================
    # FALHA CONTROLADA
    # =====================================================

    if (
        titulo is None
        or
        contexto_titulo is None
    ):

        print()
        print(
            "=" * 70
        )

        print(
            "DIAGNOSTICO DE CONTEXTOS"
        )

        print(
            "=" * 70
        )


        for (
            nome,
            contexto,
        ) in obter_contextos():

            print()
            print(
                f"[{nome}]"
            )

            try:

                print(
                    "URL:",
                    contexto.url
                )

            except Exception:

                print(
                    "URL: indisponivel"
                )


            try:

                dados = contexto.evaluate(
                    """
                    () => {

                        const lista = [];

                        const elementos = [
                            document.scrollingElement,
                            ...document.querySelectorAll("*")
                        ].filter(Boolean);


                        for (
                            const el
                            of elementos
                        ) {

                            try {

                                const client =
                                    el.clientHeight || 0;

                                const total =
                                    el.scrollHeight || 0;


                                if (
                                    total <=
                                    client + 100
                                ) {
                                    continue;
                                }


                                const rect =
                                    el.getBoundingClientRect();

                                const estilo =
                                    getComputedStyle(el);


                                lista.push({
                                    tag:
                                        el.tagName,

                                    id:
                                        el.id || "",

                                    classe:
                                        String(
                                            el.className || ""
                                        ).slice(
                                            0,
                                            100
                                        ),

                                    scrollTop:
                                        el.scrollTop || 0,

                                    client:
                                        client,

                                    total:
                                        total,

                                    width:
                                        rect.width,

                                    height:
                                        rect.height,

                                    left:
                                        rect.left,

                                    top:
                                        rect.top,

                                    overflowY:
                                        estilo.overflowY
                                });

                            } catch (_) {
                            }
                        }


                        lista.sort(
                            (a, b) =>
                                (
                                    b.total -
                                    b.client
                                )
                                -
                                (
                                    a.total -
                                    a.client
                                )
                        );


                        return lista.slice(
                            0,
                            20
                        );
                    }
                    """
                )


                for item in dados:

                    print(
                        item
                    )

            except Exception as erro:

                print(
                    "Nao foi possivel "
                    "inspecionar:",
                    erro,
                )


        raise RuntimeError(
            "O visual nao foi localizado. "
            "O diagnostico acima mostra "
            "as barras de rolagem reais."
        )


    # =====================================================
    # POSICIONA O VISUAL
    # =====================================================

    try:

        titulo.scroll_into_view_if_needed(
            timeout=10000
        )

    except Exception:
        pass


    try:

        titulo.hover(
            timeout=10000
        )

    except Exception:
        pass


    time.sleep(1)


    # =====================================================
    # MENU DE EXPORTACAO DO VISUAL
    # =====================================================

    print(
        f"Preparando menu de '{nome_visual}'..."
    )


    # =====================================================
    # 1. RECUPERA O MESMO CONTAINER QUE FUNCIONOU
    #    NO DIAGNOSTICO DOM
    # =====================================================

    hover_alvo = titulo

    container_encontrado = False


    for nivel in range(12):

        try:

            pai = hover_alvo.locator(
                "xpath=.."
            )


            info = pai.evaluate(
                """
                (el) => {

                    const r =
                        el.getBoundingClientRect();

                    return {
                        largura:
                            r.width,

                        altura:
                            r.height,

                        texto:
                            (
                                el.innerText || ""
                            ).slice(
                                0,
                                500
                            )
                    };
                }
                """
            )


            hover_alvo = pai


            if (
                info["largura"] > 600
                and
                info["altura"] > 180
                and
                padrao_titulo.search(info["texto"])
            ):

                print(
                    "Container de hover encontrado."
                )

                print(
                    f"Nivel: {nivel + 1}"
                )

                print(
                    "Dimensoes: "
                    f"{info['largura']:.0f} x "
                    f"{info['altura']:.0f}"
                )

                container_encontrado = True

                break


        except Exception:
            break


    if not container_encontrado:

        raise RuntimeError(
            "Nao foi possivel recuperar "
            "o container de hover do visual."
        )


    # =====================================================
    # 2. POSICIONA O CONTAINER
    # =====================================================

    try:

        hover_alvo.scroll_into_view_if_needed(
            timeout=10000
        )

    except Exception:
        pass


    # =====================================================
    # 3. HOVER EXATAMENTE COMO NO DIAGNOSTICO
    #    QUE FEZ O MENU APARECER
    # =====================================================

    print(
        "Aplicando hover no container..."
    )


    try:

        hover_alvo.hover(
            timeout=10000
        )

    except Exception as erro:

        raise RuntimeError(
            "Nao foi possivel aplicar "
            "hover no container."
        ) from erro


    time.sleep(1)


    # Segundo hover no canto superior direito.
    try:

        caixa = (
            hover_alvo.bounding_box()
        )


        if caixa:

            hover_alvo.hover(
                position={
                    "x": max(
                        1,
                        caixa["width"] - 25
                    ),
                    "y": 20,
                },
                timeout=10000,
            )

            print(
                "Hover aplicado no canto "
                "superior direito."
            )


    except Exception as erro:

        print(
            "Aviso: hover no canto "
            "nao foi aplicado:",
            erro,
        )


    time.sleep(2)


    # =====================================================
    # 4. AGUARDA O BOTAO DINAMICO DO QUICKSIGHT
    # =====================================================

    print(
        "Aguardando botao dos tres pontos..."
    )


    botao_alvo = None

    limite = (
        time.time() + 20
    )


    while (
        time.time() < limite
        and
        botao_alvo is None
    ):

        try:

            botoes = (
                contexto_titulo.locator(
                    'button['
                    'data-automation-id='
                    '"analysis_visual_dropdown_menu_button"'
                    ']'
                )
            )


            for indice in range(
                botoes.count()
            ):

                botao = (
                    botoes.nth(
                        indice
                    )
                )


                try:

                    if not botao.is_visible():
                        continue


                    aria = (
                        botao.get_attribute(
                            "aria-label"
                        )
                        or ""
                    )


                    aria_lower = (
                        aria.lower()
                    )


                    if (
                        "menu options"
                        in aria_lower
                        and
                        padrao_titulo.search(aria)
                        and
                        "table"
                        in aria_lower
                    ):

                        botao_alvo = botao

                        print(
                            "Botao dos tres pontos "
                            "encontrado."
                        )

                        print(
                            "aria-label:",
                            aria,
                        )

                        break


                except Exception:
                    continue


        except Exception:
            pass


        if (
            botao_alvo
            is None
        ):

            # Mantem o estado hover ativo enquanto
            # o QuickSight renderiza os controles.
            try:

                hover_alvo.hover(
                    timeout=3000
                )

            except Exception:
                pass


            time.sleep(
                0.5
            )


    if (
        botao_alvo
        is None
    ):

        raise RuntimeError(
            "O container recebeu hover, "
            "mas o botao dos tres pontos "
            "nao apareceu."
        )


    # =====================================================
    # 5. CLICA NO MENU
    # =====================================================

    print(
        "Clicando nos tres pontos..."
    )


    try:

        botao_alvo.click(
            timeout=10000
        )

    except Exception:

        try:

            botao_alvo.evaluate(
                "(el) => el.click()"
            )

        except Exception as erro:

            raise RuntimeError(
                "O botao foi encontrado, "
                "mas nao foi possivel clicar."
            ) from erro


    time.sleep(1)


    # =====================================================
    # 6. LOCALIZA EXPORT TO EXCEL
    # =====================================================

    print(
        "Procurando opcao "
        "'Export to Excel'..."
    )


    contextos_menu = [
        (
            "PAGINA",
            page,
        ),
        (
            "FRAME_VISUAL",
            contexto_titulo,
        ),
    ]


    try:

        for numero_frame, frame in enumerate(
            page.frames
        ):

            contextos_menu.append(
                (
                    f"FRAME_{numero_frame}",
                    frame,
                )
            )

    except Exception:
        pass


    limite_export = (
        time.time() + 15
    )


    while (
        time.time()
        < limite_export
    ):

        for (
            nome_contexto,
            contexto,
        ) in contextos_menu:

            try:

                opcoes = (
                    contexto.get_by_text(
                        re.compile(
                            r"Export\s+to\s+Excel",
                            re.IGNORECASE,
                        )
                    )
                )


                for indice in range(
                    opcoes.count()
                ):

                    opcao = (
                        opcoes.nth(
                            indice
                        )
                    )


                    try:

                        if opcao.is_visible():

                            print(
                                "Export to Excel encontrado."
                            )

                            print(
                                "Contexto:",
                                nome_contexto,
                            )

                            # Retorna com o menu aberto.
                            # exportar_excel() continua
                            # a partir daqui.
                            return contexto


                    except Exception:
                        continue


            except Exception:
                continue


        time.sleep(
            0.5
        )


    raise RuntimeError(
        "Os tres pontos foram abertos, "
        "mas Export to Excel "
        "nao foi localizado."
    )


# =========================================================
# EXPORTA EXCEL
# =========================================================

def exportar_excel(
    page,
    abrir_menu_func=None,
    pasta_bronze=None,
    arquivo_temporario=None,
):

    import base64

    if abrir_menu_func is None:
        abrir_menu_func = abrir_menu_planos_acao
    if not callable(abrir_menu_func):
        raise TypeError("abrir_menu_func deve ser uma funcao.")

    destino_bronze = Path(pasta_bronze) if pasta_bronze is not None else PASTA_BRONZE
    destino_temporario = (
        Path(arquivo_temporario)
        if arquivo_temporario is not None
        else ARQUIVO_TEMPORARIO
    )
    if destino_temporario.parent.resolve() != destino_bronze.resolve():
        raise RuntimeError("Arquivo temporario fora da pasta Bronze selecionada.")

    frame = abrir_menu_func(page)

    print(
        "Selecionando Export to Excel..."
    )

    exportar = frame.get_by_text(
        "Export to Excel",
        exact=True,
    )

    if exportar.count() == 0:

        _, exportar = aguardar_texto(
            page,
            "Export to Excel",
            timeout=10000,
            exact=True,
        )

    destino_bronze.mkdir(
        parents=True,
        exist_ok=True,
    )

    if destino_temporario.exists():
        destino_temporario.unlink()

    estado_blob = {
        "capturado": False,
        "nome": "",
        "tamanho": 0,
        "erro": "",
    }

    def salvar_blob_quicksight(payload):

        try:

            conteudo_base64 = payload.get(
                "base64",
                ""
            )

            nome = payload.get(
                "nome",
                ""
            )

            dados = base64.b64decode(
                conteudo_base64,
                validate=True,
            )

            if not dados:

                raise RuntimeError(
                    "Blob recebido sem dados."
                )

            destino_temporario.write_bytes(
                dados
            )

            estado_blob[
                "capturado"
            ] = True

            estado_blob[
                "nome"
            ] = nome

            estado_blob[
                "tamanho"
            ] = len(dados)

            print(
                "Blob do Excel capturado "
                "diretamente do QuickSight."
            )

            print(
                f"Tamanho capturado: "
                f"{len(dados):,} bytes"
            )

            return True

        except Exception as erro:

            estado_blob[
                "erro"
            ] = str(erro)

            return False

    page.expose_function(
        "__salvar_excel_quicksight",
        salvar_blob_quicksight,
    )

    script_interceptador = r'''
() => {

    if (window.__qs_blob_interceptor_installed) {
        return true;
    }

    window.__qs_blob_interceptor_installed = true;

    const blobs = new Map();

    window.__qs_blob_map = blobs;

    const originalCreateObjectURL =
        URL.createObjectURL.bind(URL);

    URL.createObjectURL = function(objeto) {

        const url =
            originalCreateObjectURL(
                objeto
            );

        try {

            if (objeto instanceof Blob) {

                blobs.set(
                    url,
                    objeto
                );

            }

        } catch (erro) {
        }

        return url;
    };


    async function capturarAnchor(anchor) {

        try {

            const href =
                anchor.href
                ||
                anchor.getAttribute(
                    "href"
                )
                ||
                "";

            if (!href.startsWith("blob:")) {
                return false;
            }

            const blob =
                blobs.get(
                    href
                );

            if (!blob) {
                return false;
            }

            if (window.__qs_blob_capture_running) {
                return true;
            }

            window.__qs_blob_capture_running =
                true;

            const buffer =
                await blob.arrayBuffer();

            const bytes =
                new Uint8Array(
                    buffer
                );

            let binario = "";

            const tamanhoBloco =
                32768;

            for (
                let inicio = 0;
                inicio < bytes.length;
                inicio += tamanhoBloco
            ) {

                const parte =
                    bytes.subarray(
                        inicio,
                        Math.min(
                            inicio + tamanhoBloco,
                            bytes.length
                        )
                    );

                binario +=
                    String.fromCharCode(
                        ...parte
                    );

            }

            const base64 =
                btoa(
                    binario
                );

            const nome =
                anchor.download
                ||
                "Detalle_Checklist.xlsx";

            const resultado =
                await window
                    .__salvar_excel_quicksight(
                        {
                            base64: base64,
                            nome: nome,
                            tipo: blob.type || "",
                            tamanho: blob.size || 0,
                        }
                    );

            window.__qs_blob_capture_ok =
                Boolean(
                    resultado
                );

            return Boolean(
                resultado
            );

        } catch (erro) {

            window.__qs_blob_capture_error =
                String(
                    erro
                );

            return false;

        } finally {

            window.__qs_blob_capture_running =
                false;

        }
    }


    const originalAnchorClick =
        HTMLAnchorElement
            .prototype
            .click;

    HTMLAnchorElement
        .prototype
        .click = function() {

            const href =
                this.href
                ||
                this.getAttribute(
                    "href"
                )
                ||
                "";

            if (
                href.startsWith("blob:")
                &&
                blobs.has(href)
            ) {

                capturarAnchor(
                    this
                );

                return;
            }

            return originalAnchorClick
                .apply(
                    this,
                    arguments
                );
        };


    document.addEventListener(
        "click",
        function(evento) {

            let anchor =
                evento.target;

            try {

                if (
                    anchor
                    &&
                    anchor.closest
                ) {

                    anchor =
                        anchor.closest(
                            "a"
                        );

                }

            } catch (erro) {

                return;

            }

            if (!anchor) {
                return;
            }

            const href =
                anchor.href
                ||
                anchor.getAttribute(
                    "href"
                )
                ||
                "";

            if (
                href.startsWith("blob:")
                &&
                blobs.has(href)
            ) {

                evento.preventDefault();

                evento.stopImmediatePropagation();

                capturarAnchor(
                    anchor
                );
            }

        },
        true
    );


    const originalDispatch =
        EventTarget
            .prototype
            .dispatchEvent;

    EventTarget
        .prototype
        .dispatchEvent =
        function(evento) {

            try {

                if (
                    this instanceof HTMLAnchorElement
                    &&
                    evento
                    &&
                    evento.type === "click"
                ) {

                    const href =
                        this.href
                        ||
                        this.getAttribute(
                            "href"
                        )
                        ||
                        "";

                    if (
                        href.startsWith("blob:")
                        &&
                        blobs.has(href)
                    ) {

                        capturarAnchor(
                            this
                        );

                        return true;
                    }
                }

            } catch (erro) {
            }

            return originalDispatch
                .apply(
                    this,
                    arguments
                );
        };


    return true;
}
'''

    frames_instaladas = 0

    for frame_atual in page.frames:

        try:

            resultado = frame_atual.evaluate(
                script_interceptador
            )

            if resultado:
                frames_instaladas += 1

        except Exception:
            pass

    print(
        "Interceptador de Blob instalado "
        f"em {frames_instaladas} frame(s)."
    )

    estado_download = {
        "detectado": False,
        "erro": "",
    }

    def ao_download(download):

        estado_download[
            "detectado"
        ] = True

        try:

            print(
                "Download nativo detectado: "
                f"{download.suggested_filename}"
            )

            download.save_as(
                str(
                    destino_temporario
                )
            )

            print(
                "Download persistido "
                "pelo Playwright."
            )

        except Exception as erro:

            estado_download[
                "erro"
            ] = str(erro)

            print(
                "[AVISO] O download nativo "
                "foi detectado, mas save_as "
                "falhou."
            )

    page.on(
        "download",
        ao_download,
    )

    exportar.first.click()

    limite = time.time() + 180

    while time.time() < limite:

        if (
            destino_temporario.exists()
            and
            destino_temporario.stat().st_size > 0
        ):

            break

        try:

            page.wait_for_timeout(
                250
            )

        except Exception:

            time.sleep(
                0.25
            )

        if (
            estado_blob["erro"]
            and
            estado_download["erro"]
        ):

            break

    if not destino_temporario.exists():

        detalhes = []

        if estado_blob["erro"]:

            detalhes.append(
                "Blob: "
                + estado_blob["erro"]
            )

        if estado_download["erro"]:

            detalhes.append(
                "Playwright: "
                + estado_download["erro"]
            )

        detalhe = (
            " | ".join(
                detalhes
            )
            or
            "nenhum arquivo foi persistido"
        )

        raise RuntimeError(
            "Falha ao persistir o Excel "
            "exportado pelo QuickSight. "
            + detalhe
        )

    tamanho = (
        destino_temporario
        .stat()
        .st_size
    )

    if tamanho <= 0:

        raise RuntimeError(
            "O arquivo temporario "
            "possui tamanho zero."
        )

    print(
        "Arquivo temporario persistido: "
        f"{tamanho:,} bytes"
    )

    print(
        "Download salvo temporariamente em:"
    )

    print(
        destino_temporario
    )

    return destino_temporario


# =========================================================
# VALIDACAO XLSX
# =========================================================

def validar_estrutura_xlsx(arquivo):

    if not arquivo.exists():
        raise RuntimeError(
            "O arquivo exportado não foi encontrado."
        )

    tamanho = arquivo.stat().st_size

    if tamanho <= 0:
        raise RuntimeError(
            "O arquivo exportado possui tamanho zero."
        )

    if not zipfile.is_zipfile(
        arquivo
    ):
        raise RuntimeError(
            "O arquivo recebido não é um XLSX válido."
        )

    return tamanho


def validar_excel_planos_acao(arquivo):

    import unicodedata
    import re as _re

    print(
        "Validando Excel de Planos de Acao..."
    )

    tamanho = validar_estrutura_xlsx(
        arquivo
    )


    # =====================================================
    # NORMALIZACAO
    # =====================================================

    def normalizar(valor):

        if valor is None:
            return ""

        texto = str(valor)

        texto = texto.replace(
            "\xa0",
            " ",
        )

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

        texto = _re.sub(
            r"\s+",
            " ",
            texto,
        )

        return (
            texto
            .strip()
            .lower()
        )


    # IMPORTANTE:
    # o contrato abaixo usa somente ASCII.
    # Os cabecalhos vindos do Excel sao
    # normalizados antes da comparacao.

    colunas_obrigatorias = {
        "plano de identificacao",
        "id da resposta",
        "nome do plano de acao",
        "modulo de origem",
        "inicio do plano",
        "criacao do plano",
        "cronograma do plano",
        "encerramento do plano",
        "nivel organizacional",
        "divisao do plano",
        "estado do plano",
        "criador do plano",
        "gestor de plano",
        "descricao do plano de acao",
        "contrato de plano de acao",
    }


    workbook = load_workbook(
        arquivo,
        read_only=True,
        data_only=True,
    )


    try:

        if not workbook.sheetnames:

            raise RuntimeError(
                "O Excel nao possui abas."
            )


        worksheet = workbook[
            workbook.sheetnames[0]
        ]


        linha_cabecalho = None
        cabecalho_original = None
        cabecalho_normalizado = None


        # QuickSight coloca o titulo do visual
        # antes do cabecalho real.
        for numero_linha, valores in enumerate(
            worksheet.iter_rows(
                min_row=1,
                max_row=15,
                values_only=True,
            ),
            start=1,
        ):

            originais = [
                str(valor).strip()
                if valor is not None
                else ""
                for valor in valores
            ]


            normalizados = [
                normalizar(valor)
                for valor in valores
            ]


            if (
                "plano de identificacao"
                in normalizados
            ):

                linha_cabecalho = (
                    numero_linha
                )

                cabecalho_original = (
                    originais
                )

                cabecalho_normalizado = (
                    normalizados
                )

                break


        if linha_cabecalho is None:

            raise RuntimeError(
                "Nao foi encontrado o "
                "cabecalho de Plano de Acao."
            )


        cabecalho_set = {
            valor
            for valor
            in cabecalho_normalizado
            if valor
        }


        ausentes = (
            colunas_obrigatorias
            - cabecalho_set
        )


        if ausentes:

            raise RuntimeError(
                "O Excel nao contem todas "
                "as colunas esperadas. "
                "Ausentes: "
                + ", ".join(
                    sorted(
                        ausentes
                    )
                )
            )


        indice_plano = (
            cabecalho_normalizado.index(
                "plano de identificacao"
            )
        )


        indice_divisao = (
            cabecalho_normalizado.index(
                "divisao do plano"
            )
        )


        planos = []

        linhas_dados = 0
        linhas_brasil = 0


        for valores in worksheet.iter_rows(
            min_row=linha_cabecalho + 1,
            values_only=True,
        ):

            if not any(
                valor is not None
                and str(valor).strip()
                for valor in valores
            ):

                continue


            linhas_dados += 1


            plano = (
                valores[indice_plano]
                if indice_plano < len(valores)
                else None
            )


            divisao = (
                valores[indice_divisao]
                if indice_divisao < len(valores)
                else None
            )


            plano_texto = (
                str(plano).strip()
                if plano is not None
                else ""
            )


            divisao_texto = (
                normalizar(
                    divisao
                )
            )


            if plano_texto:

                planos.append(
                    plano_texto
                )


            if (
                divisao_texto
                == "celeo brasil"
            ):

                linhas_brasil += 1


    finally:

        workbook.close()


    if linhas_dados == 0:

        raise RuntimeError(
            "Nenhum Plano de Acao foi "
            "encontrado no arquivo."
        )


    if not planos:

        raise RuntimeError(
            "Nenhum identificador de Plano "
            "de Acao foi encontrado."
        )


    total_planos = len(
        planos
    )


    planos_unicos = len(
        set(
            planos
        )
    )


    print()
    print(
        "Excel de Planos de Acao valido."
    )

    print(
        f"Linha do cabecalho: "
        f"{linha_cabecalho}"
    )

    print(
        f"Colunas validadas: "
        f"{len(colunas_obrigatorias)}"
    )

    print(
        f"Linhas de dados: "
        f"{linhas_dados}"
    )

    print(
        f"Planos identificados: "
        f"{total_planos}"
    )

    print(
        f"Planos unicos: "
        f"{planos_unicos}"
    )

    print(
        f"Registros Celeo Brasil: "
        f"{linhas_brasil}"
    )


    if (
        total_planos
        != planos_unicos
    ):

        print()
        print(
            "[AVISO] Existem IDs de Planos "
            "duplicados na Bronze."
        )

        print(
            "[AVISO] A Bronze sera preservada "
            "sem deduplicacao."
        )


    print(
        f"Tamanho: {tamanho:,} bytes"
    )


# =========================================================
# PROMOCAO PARA BRONZE
# =========================================================

def atualizar_bronze(
    arquivo_baixado
):

    if not arquivo_baixado.exists():
        raise RuntimeError(
            "Arquivo temporário não encontrado."
        )

    os.replace(
        arquivo_baixado,
        ARQUIVO_FINAL,
    )

    print()
    print(
        "Camada Bronze atualizada com sucesso:"
    )
    print(
        ARQUIVO_FINAL
    )


def limpar_temporario():

    try:

        if ARQUIVO_TEMPORARIO.exists():

            ARQUIVO_TEMPORARIO.unlink()

    except Exception:

        pass


# =========================================================
# EXECUCAO PRINCIPAL
# =========================================================

def extrair_planos_acao():

    print(
        "=" * 70
    )

    print(
        "EXTRACAO PLANOS DE ACAO - PREVSYS"
    )

    print(
        "=" * 70
    )

    print()

    PASTA_BRONZE.mkdir(
        parents=True,
        exist_ok=True,
    )

    try:

        with sync_playwright() as p:

            print(
                "Abrindo Microsoft Edge com "
                "perfil persistente..."
            )

            context = (
                p.chromium.launch_persistent_context(
                    user_data_dir=str(
                        PROFILE_DIR
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

                page = (
                    context.pages[0]
                    if context.pages
                    else context.new_page()
                )

                page = garantir_login(
                    page
                )

                abrir_reporte_360(
                    page
                )

                abrir_plano_acao(
                    page
                )

                selecionar_aba_interna_planos(page)

                arquivo = exportar_excel(
                    page
                )

                validar_excel_planos_acao(
                    arquivo
                )

                atualizar_bronze(
                    arquivo
                )

            finally:

                try:
                    context.close()
                except Exception:
                    pass

        print()
        print(
            "=" * 70
        )

        print(
            "EXTRACAO DE PLANOS DE ACAO CONCLUIDA COM SUCESSO"
        )

        print(
            "=" * 70
        )

    except Exception:

        limpar_temporario()

        raise


if __name__ == "__main__":
    extrair_planos_acao()
