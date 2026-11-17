"""Converte os resultados conferidos da proposta em posições de ciclo, sem publicar."""
import argparse
from datetime import date
import json
from pathlib import Path
try:
    from .ciclos_manutencao import validar_posicoes_ciclo
except ImportError:
    from ciclos_manutencao import validar_posicoes_ciclo

def converter_proposta(documento):
    if documento.get("version") != 2 or documento.get("live") is not False:
        raise ValueError("Use o arquivo de evidências da proposta revisada, versão 2")
    posicoes = []
    for item in documento["items"]:
        unidades = []
        detalhe = "nao_carregado"
        if item["id"] == "veic":
            detalhe = "completo"
            unidades = [{"chave": str(u["asset"]), "nome": u["name"], "concessao": u["concession"],
                "localizacao": u["location"], "grupo": u["group"], "registros": u["records"],
                "com_respostas": u["records"] > 0} for u in documento["fleetPopulation"]]
        elif item["id"] in ("inst", "ext"):
            detalhe = "somente_sem_registro"
            unidades = [{"chave": f'aba:{u["aba"]}', "nome": u["name"], "concessao": None,
                "localizacao": u["name"], "grupo": None, "registros": 0, "com_respostas": False}
                for u in documento["pendingUnits"] if u["id"] == item["id"]]
        posicoes.append({"regra_id": item["id"], "data_corte": item["cut"], "inicio_ciclo": item["start"], "fim_ciclo": item["end"],
            "registros": item["records"], "unidades_no_recorte": item["population"], "unidades_com_registro": item["covered"],
            "unidades_com_respostas": item.get("answeredUnits"), "populacao": "nao_definida" if item["population"] is None else "provisoria",
            "detalhe": detalhe, "unidades": unidades, "fonte": "Consultas SQL conferidas — referência aprovada em 17/11/2026"})
    meses = sorted({p["data_corte"][:7] for p in posicoes})
    primeiro = date.fromisoformat(meses[0] + "-01")
    ano, mes = map(int, meses[-1].split("-"))
    fim = date(ano + (mes == 12), 1 if mes == 12 else mes + 1, 1)
    validar_posicoes_ciclo(posicoes, primeiro, fim)
    return {"versao": 1, "origem": "consultas_sql_conferidas", "posicoes_ciclo": posicoes}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--entrada", required=True, type=Path)
    parser.add_argument("--saida", required=True, type=Path)
    args = parser.parse_args()
    if args.saida.exists():
        parser.error("O destino deve ser um arquivo novo")
    convertido = converter_proposta(json.loads(args.entrada.read_text(encoding="utf-8-sig")))
    args.saida.parent.mkdir(parents=True, exist_ok=True)
    args.saida.write_text(json.dumps(convertido, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"posicoes": len(convertido["posicoes_ciclo"]), "publicado": False}))

if __name__ == "__main__":
    main()
