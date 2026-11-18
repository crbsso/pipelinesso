"""Combina a extração SQL com populações atuais e posições conferidas, sem publicar."""
import argparse
import calendar
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
from ciclos_manutencao import PERIODOS, validar_posicoes_ciclo
from painel_manutencao import preparar_cargas

ABAS = {"veic": (106,107,108,246,384,496), "epi-150": (150,), "epi-151": (151,), "epi-467": (467,), "epi-468": (468,),
    "sso-152": (152,), "sso-153": (153,), "sso-154": (154,), "sso-248": (248,)}

def compor(base, auxiliares, conferidas):
    preparar_cargas(base)
    if auxiliares.get("versao") != 1 or auxiliares.get("origem") != "SQL Server Intranet":
        raise ValueError("Origem das populações inválida")
    if any(auxiliares.get(k) != base[k] for k in ("inicio_inclusivo", "fim_exclusivo")):
        raise ValueError("Janelas de extração divergentes")
    if not all(isinstance(auxiliares.get(k), list) for k in ("locais", "frota", "inspecoes_com_respostas")):
        raise ValueError("Populações incompletas")
    corte = datetime.fromisoformat(base["extraido_em"].replace("Z", "+00:00")).astimezone(timezone(timedelta(hours=-3))).date()
    instante_aux = datetime.fromisoformat(auxiliares["extraido_em"].replace("Z", "+00:00"))
    if instante_aux.tzinfo is None or instante_aux.astimezone(timezone(timedelta(hours=-3))).date() != corte:
        raise ValueError("Cadastros e registros devem ser extraídos na mesma data de corte")
    if not date.fromisoformat(base["inicio_inclusivo"]) <= corte < date.fromisoformat(base["fim_exclusivo"]):
        raise ValueError("A extração deve abranger o mês corrente da data de corte")
    mes = corte.replace(day=1)
    proximo = date(mes.year + (mes.month == 12), 1 if mes.month == 12 else mes.month+1, 1)
    trimestre = date(mes.year, ((mes.month-1)//3)*3+1, 1)
    respostas = set(auxiliares["inspecoes_com_respostas"])
    registros = base["registros"]
    if not isinstance(conferidas.get("posicoes_ciclo"), list): raise ValueError("Posições conferidas ausentes")
    validar_posicoes_ciclo(conferidas["posicoes_ciclo"], date.fromisoformat(base["inicio_inclusivo"]), date.fromisoformat(base["fim_exclusivo"]))
    antigas = {p["regra_id"]: p for p in conferidas["posicoes_ciclo"] if p["data_corte"][:7] == mes.isoformat()[:7]}
    posicoes = []
    def pertencentes(ficha, inicio, abas=None):
        return [r for r in registros if r["ficha_id"] == ficha and (abas is None or r["aba_id"] in abas) and inicio.isoformat() <= r["data_inspecao"][:10] <= corte.isoformat()]
    def posicao(regra, inicio, fim, rows, unidades=None):
        return {"regra_id": regra,"data_corte":corte.isoformat(),"inicio_ciclo":inicio.isoformat() if inicio else None,"fim_ciclo":fim.isoformat() if fim else None,
            "registros":len(rows),"unidades_no_recorte":len(unidades) if unidades is not None else None,
            "unidades_com_registro":sum(u["registros"]>0 for u in unidades) if unidades is not None else None,
            "unidades_com_respostas":sum(u["com_respostas"] is True for u in unidades) if unidades is not None else None,
            "populacao":"provisoria" if unidades is not None else "nao_definida","detalhe":"completo" if unidades is not None else "nao_carregado",
            "unidades":unidades or [],"fonte":"SQL Server Intranet — registros e cadastro atual; elegibilidade pendente"}
    fim_trimestre=date(mes.year,trimestre.month+2,calendar.monthrange(mes.year,trimestre.month+2)[1])
    for regra,ficha,inicio,fim in (("inst",1,trimestre,fim_trimestre),("ext",13,mes,proximo-timedelta(days=1))):
        if inicio < date.fromisoformat(base["inicio_inclusivo"]): raise ValueError("Extração não cobre o início do ciclo")
        rows=pertencentes(ficha,inicio)
        cadastro=[u for u in auxiliares["locais"] if u["ficha_id"]==ficha]
        if not cadastro or len({u["aba_id"] for u in cadastro}) != len(cadastro): raise ValueError("Cadastro de locais vazio ou duplicado")
        if any(r["aba_id"] not in {u["aba_id"] for u in cadastro} for r in rows): raise ValueError("Há registros fora do cadastro atual de locais; conciliar antes de publicar")
        unidades=[]
        for u in cadastro:
            rr=[r for r in rows if r["aba_id"]==u["aba_id"]]
            concessoes={r["concessao"] for r in rr if r.get("concessao")}
            unidades.append({"chave":"aba:"+str(u["aba_id"]),"nome":u["nome"],"localizacao":u["nome"],"grupo":None,
                "concessao":next(iter(concessoes)) if len(concessoes)==1 else None,"registros":len(rr),"com_respostas":any(r["id_inspecao"] in respostas for r in rr)})
        posicoes.append(posicao(regra,inicio,fim,rows,unidades))
    frota=auxiliares["frota"]
    if not frota or len({u["ativo_id"] for u in frota}) != len(frota): raise ValueError("Frota vazia ou com IDs duplicados")
    rows=pertencentes(11,mes,ABAS["veic"])
    if any(not r.get("ativo_id") or r["ativo_id"] not in {u["ativo_id"] for u in frota} for r in rows):
        raise ValueError("Há veículos sem vínculo positivo na população; conciliar antes de publicar")
    unidades=[]
    for u in frota:
        rr=[r for r in rows if r["ativo_id"]==u["ativo_id"]]
        unidades.append({"chave":str(u["ativo_id"]),"nome":u["codigo"] or str(u["ativo_id"]),"concessao":u["concessao"],"localizacao":u["localizacao"],"grupo":u["grupo"],
            "registros":len(rr),"com_respostas":any(r["id_inspecao"] in respostas for r in rr)})
    posicoes.append(posicao("veic",mes,proximo-timedelta(days=1),rows,unidades))
    for regra in PERIODOS:
        if regra in ("inst","ext","veic"): continue
        if regra.startswith("ferr-") or regra.startswith("carga-"):
            if regra not in antigas: raise ValueError("Recorte do BI sem posição conferida: "+regra)
            if antigas[regra]["data_corte"] > corte.isoformat(): raise ValueError("Posição conferida posterior à extração")
            posicoes.append(antigas[regra]); continue
        tamanho=PERIODOS[regra]
        inicio=date(mes.year,((mes.month-1)//tamanho)*tamanho+1,1) if tamanho else mes
        fim=date(inicio.year+(inicio.month+tamanho>12),(inicio.month+tamanho-1)%12+1,1)-timedelta(days=1) if tamanho else None
        if inicio < date.fromisoformat(base["inicio_inclusivo"]): raise ValueError("Extração não cobre início do ciclo")
        rows=pertencentes(17 if regra.startswith("sso-") else 16,inicio,ABAS[regra])
        posicoes.append(posicao(regra,inicio if tamanho else None,fim,rows))
    resultado={**base,"posicoes_ciclo":posicoes}
    preparar_cargas(resultado)
    return resultado

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for nome in ("base","auxiliares","conferidas","saida"): parser.add_argument("--"+nome,type=Path,required=True)
    args=parser.parse_args()
    if args.saida.exists(): parser.error("O destino deve ser novo")
    documento=compor(*[json.loads(getattr(args,n).read_text(encoding="utf-8-sig")) for n in ("base","auxiliares","conferidas")])
    args.saida.write_text(json.dumps(documento,ensure_ascii=False),encoding="utf-8")
    print(json.dumps({"posicoes":len(documento["posicoes_ciclo"]),"inspecoes":len(documento["registros"]),"publicado":False}))

if __name__=="__main__": main()
