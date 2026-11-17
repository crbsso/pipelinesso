"""Validação das posições de inspeção por ciclo; sem acesso a banco ou credenciais."""
import calendar
from datetime import date

PERIODOS = {
    "inst": 3, "ext": 1, "veic": 1, "ferr-eat": 3, "ferr-lt": 3,
    "carga-148": 1, "carga-149": 2, "epi-150": 3, "epi-151": 2,
    "epi-467": 0, "epi-468": 2,
    "sso-152": 0, "sso-153": 0, "sso-154": 0, "sso-248": 0,
}

def exigir(condicao, mensagem):
    if not condicao:
        raise ValueError(mensagem)

def inteiro(n):
    return type(n) is int and n >= 0

def texto(s):
    return isinstance(s, str) and len(s) <= 1000

def opcional(s):
    return s is None or texto(s)

def validar_posicoes_ciclo(posicoes, inicio, fim):
    exigir(isinstance(posicoes, list) and len(posicoes) <= len(PERIODOS) * 3, "Posições de ciclo inválidas")
    vistos = set()
    for p in posicoes:
        exigir(isinstance(p, dict) and p.get("regra_id") in PERIODOS, "Regra de ciclo desconhecida")
        corte = date.fromisoformat(p["data_corte"])
        exigir(inicio <= corte < fim, "Data de corte fora da janela")
        chave = (p["regra_id"], corte.year, corte.month)
        exigir(chave not in vistos, "Posição duplicada na competência")
        vistos.add(chave)
        tamanho = PERIODOS[p["regra_id"]]
        if tamanho:
            primeiro = ((corte.month - 1) // tamanho) * tamanho + 1
            ultimo = primeiro + tamanho - 1
            exigir(p.get("inicio_ciclo") == date(corte.year, primeiro, 1).isoformat(), "Início de ciclo divergente")
            exigir(p.get("fim_ciclo") == date(corte.year, ultimo, calendar.monthrange(corte.year, ultimo)[1]).isoformat(), "Fim de ciclo divergente")
        else:
            exigir(p.get("inicio_ciclo") is None and p.get("fim_ciclo") is None, "Demanda não possui ciclo periódico")
        registros, total, com = p.get("registros"), p.get("unidades_no_recorte"), p.get("unidades_com_registro")
        respostas = p.get("unidades_com_respostas")
        exigir(inteiro(registros), "Quantidade de registros inválida")
        exigir((total is None and com is None) or (inteiro(total) and inteiro(com) and com <= total), "População e atendimento inconsistentes")
        exigir(respostas is None or (inteiro(respostas) and com is not None and respostas <= com), "Respostas fora da cobertura")
        exigir(p.get("populacao") in ("provisoria", "homologada", "nao_definida"), "Estado de população inválido")
        exigir((total is None) == (p["populacao"] == "nao_definida"), "População desconhecida não é homologada")
        exigir(p.get("detalhe") in ("completo", "somente_sem_registro", "nao_carregado"), "Detalhamento inválido")
        exigir(texto(p.get("fonte")) and p["fonte"].strip(), "Fonte ausente")
        unidades = p.get("unidades")
        exigir(isinstance(unidades, list) and len(unidades) <= 20000, "Unidades inválidas")
        chaves = set()
        for u in unidades:
            exigir(isinstance(u, dict) and texto(u.get("chave")) and u["chave"].strip() and u["chave"] not in chaves, "Unidade ausente ou duplicada")
            chaves.add(u["chave"])
            exigir(texto(u.get("nome")) and u["nome"].strip() and all(opcional(u.get(c)) for c in ("concessao", "localizacao", "grupo")) and inteiro(u.get("registros")), "Unidade inválida")
            exigir(u.get("com_respostas") is None or type(u["com_respostas"]) is bool, "Indicador de respostas inválido")
            exigir(u["registros"] > 0 or u.get("com_respostas") is not True, "Respostas sem registro")
        if p["detalhe"] == "completo":
            exigir(total == len(unidades) and com == sum(u["registros"] > 0 for u in unidades) and registros == sum(u["registros"] for u in unidades), "População individual não concilia")
            if respostas is not None:
                exigir(respostas == sum(u.get("com_respostas") is True for u in unidades), "Respostas individuais não conciliam")
        elif p["detalhe"] == "somente_sem_registro":
            exigir(total is not None and com is not None and len(unidades) == total - com and all(u["registros"] == 0 for u in unidades), "Lista sem registro não concilia")
        else:
            exigir(not unidades, "Detalhamento não carregado deve estar vazio")
    return posicoes
