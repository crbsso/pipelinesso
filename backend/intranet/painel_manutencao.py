"""Carga mensal completa do painel: formulários e atividades das OS da Manutenção."""
import argparse
from datetime import date, datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid
from urllib.parse import urlparse

RAIZ = Path(__file__).resolve().parents[2]
HML_REF = "ckfsarzmudwdehiiltwi"
ATIVIDADES = {7911, 7913, 7915, 7917, 7918, 7919}

def exigir(condicao, mensagem):
    if not condicao:
        raise ValueError(mensagem)

def proximo_mes(data):
    return date(data.year + (data.month == 12), 1 if data.month == 12 else data.month + 1, 1)

def inteiro(valor, nome):
    exigir(type(valor) is int and valor > 0, f"{nome} inválido")

def preparar_cargas(documento):
    exigir(documento.get("versao") == 1 and documento.get("origem") == "SQL Server Intranet", "Contrato de origem inválido")
    exigir(documento.get("fuso_origem") == "America/Sao_Paulo", "Fuso deve estar confirmado")
    inicio, fim = date.fromisoformat(documento["inicio_inclusivo"]), date.fromisoformat(documento["fim_exclusivo"])
    exigir(inicio.day == fim.day == 1 and 0 < (fim-inicio).days <= 93, "Janela deve conter meses completos, até 93 dias")
    extraido = datetime.fromisoformat(documento["extraido_em"].replace("Z", "+00:00"))
    exigir(extraido.tzinfo is not None, "Extração deve ter fuso")
    dados, p, atividades = documento["registros"], documento["programacao"], documento["atividades"]
    exigir(isinstance(dados, list) and isinstance(atividades, list), "Coleções inválidas")
    exigir(p["inicio"] == inicio.isoformat() and p["fim_exclusivo"] == fim.isoformat(), "Cobertura divergente")
    ordens, vinculos = p["ordens"], p["vinculos"]
    exigir(isinstance(ordens, list) and isinstance(vinculos, list), "Programação inválida")
    vistos = set()
    for r in dados:
        for c in ("id_inspecao", "ficha_id", "aba_id"):
            inteiro(r.get(c), c)
        key = tuple(r[c] for c in ("id_inspecao", "ficha_id", "aba_id"))
        exigir(key not in vistos, "Inspeção duplicada")
        vistos.add(key)
        instante = datetime.fromisoformat(r["data_inspecao"])
        exigir(instante.tzinfo is None and inicio <= instante.date() < fim, "Data de inspeção fora da janela ou com fuso embutido")
        exigir(all(isinstance(r.get(c), str) and r[c].strip() for c in ("familia", "tipo")), "Texto obrigatório ausente")
        for c in ("concessao", "localizacao", "periodicidade"):
            exigir(r.get(c) is None or isinstance(r[c], str), f"{c} inválido")
    mapa = {}
    for o in ordens:
        inteiro(o.get("os_id"), "OS")
        exigir(o["os_id"] not in mapa, "OS duplicada")
        exigir(o["plano_id"] in (197, 143), "Plano fora do escopo")
        exigir(inicio <= date.fromisoformat(o["data_prevista"]) < fim, "OS fora da janela")
        for c in ("concessao", "localizacao"):
            exigir(o.get(c) is None or isinstance(o[c], str), f"{c} da OS inválida")
        mapa[o["os_id"]] = o
    vistos_atividades, obrigacoes = set(), set()
    for a in atividades:
        inteiro(a.get("atividade_os_id"), "Atividade")
        exigir(a["atividade_os_id"] not in vistos_atividades, "Atividade duplicada")
        vistos_atividades.add(a["atividade_os_id"])
        exigir(a.get("atividade_id") in ATIVIDADES and a.get("os_id") in mapa, "Atividade sem programação válida")
        exigir(mapa[a["os_id"]]["plano_id"] == 197, "Atividade não pertence ao PE-017")
        exigir(type(a.get("status")) is int and a["status"] >= 0, "Estado da atividade inválido")
        key = (a["os_id"], a["atividade_id"])
        exigir(key not in obrigacoes, "Obrigação duplicada")
        obrigacoes.add(key)
    exigir(len(dados) <= 100000 and len(ordens) <= 100000 and len(atividades) <= 600000, "Volume fora do limite")
    cargas = []
    mes = inicio
    while mes < fim:
        ate = proximo_mes(mes)
        registros_mes = [r for r in dados if r["data_inspecao"][:7] == mes.isoformat()[:7]]
        ordens_mes = [o for o in ordens if o["data_prevista"][:7] == mes.isoformat()[:7]]
        ids = {o["os_id"] for o in ordens_mes}
        conteudo = {"versao": 1, "origem": documento["origem"], "dados": registros_mes,
            "programacao": {"inicio": mes.isoformat(), "fim_exclusivo": ate.isoformat(),
                "fim_realizacoes_exclusivo": p["fim_realizacoes_exclusivo"],
                "ordens": ordens_mes, "vinculos": [v for v in vinculos if v["data_inspecao"][:7] == mes.isoformat()[:7]]},
            "atividades": [a for a in atividades if a["os_id"] in ids]}
        bruto = json.dumps(conteudo, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
        cargas.append({"competencia": mes.isoformat(), "carga_id": str(uuid.uuid4()),
            "extraido_em": extraido.astimezone(timezone.utc).isoformat(),
            "sha256": hashlib.sha256(bruto).hexdigest(), "conteudo": conteudo})
        mes = ate
    return cargas

def publicar(cargas, url, segredo):
    exigir(urlparse(url).scheme == "https" and urlparse(url).hostname == f"{HML_REF}.supabase.co", "Publicação permitida somente na homologação")
    exigir(bool(segredo), "SUPABASE_SECRET_KEY ausente")
    import requests
    resposta = requests.post(url.rstrip("/") + "/rest/v1/rpc/publicar_painel_manutencao",
        headers={"apikey": segredo, "Authorization": "Bearer " + segredo},
        json={"p_cargas": cargas}, timeout=90)
    exigir(resposta.status_code == 200, f"Publicação recusada (HTTP {resposta.status_code}); consulte a homologação")
    exigir(resposta.json() == len(cargas), "Conciliação da quantidade de meses divergente")
    return len(cargas)

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--arquivo", required=True, type=Path)
    parser.add_argument("--inicio")
    parser.add_argument("--fim")
    parser.add_argument("--extrair", action="store_true")
    parser.add_argument("--confirmar-fuso-origem", choices=["America/Sao_Paulo"], required=True)
    parser.add_argument("--permitir-certificado-temporario", action="store_true")
    parser.add_argument("--publicar-hml", action="store_true")
    parser.add_argument("--saida-cargas", type=Path)
    args = parser.parse_args(argv)
    if args.permitir_certificado_temporario and not args.extrair:
        parser.error("A exceção de certificado exige extração")
    if args.extrair:
        if not args.inicio or not args.fim or args.arquivo.exists():
            parser.error("Extração exige início/fim e destino novo")
        args.arquivo.resolve().parent.mkdir(parents=True, exist_ok=True)
        ps = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32/WindowsPowerShell/v1.0/powershell.exe"
        comando = [str(ps), "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
            str(Path(__file__).with_name("extrair_painel_manutencao.ps1")),
            "-Inicio", args.inicio, "-Fim", args.fim, "-DestinoJson", str(args.arquivo.resolve()),
            "-ConfirmarFusoOrigem", args.confirmar_fuso_origem]
        if args.permitir_certificado_temporario:
            comando.append("-PermitirCertificadoTemporario")
        subprocess.run(comando, check=True)
    documento = json.loads(args.arquivo.read_text(encoding="utf-8-sig"))
    cargas = preparar_cargas(documento)
    if args.saida_cargas:
        args.saida_cargas.parent.mkdir(parents=True, exist_ok=True)
        args.saida_cargas.write_text(json.dumps(cargas, ensure_ascii=False), encoding="utf-8")
    if args.publicar_hml:
        from dotenv import dotenv_values
        config = {**dotenv_values(RAIZ / ".env"), **os.environ}
        publicar(cargas, config.get("SUPABASE_URL", ""), config.get("SUPABASE_SECRET_KEY", ""))
    print(json.dumps({"validacao": "APROVADA", "meses": len(cargas),
        "inspecoes": sum(len(c["conteudo"]["dados"]) for c in cargas),
        "atividades": sum(len(c["conteudo"]["atividades"]) for c in cargas),
        "publicado_hml": args.publicar_hml}, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    sys.exit(main())
