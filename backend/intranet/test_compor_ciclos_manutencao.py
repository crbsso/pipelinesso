import copy
import unittest
from compor_ciclos_manutencao import compor
from test_painel_manutencao import documento

def fixture():
    base=documento()
    base["extraido_em"]="2026-11-18T12:00:00Z"
    row=base["registros"][0]
    base["registros"]=[{**row,"id_inspecao":1,"ficha_id":1,"aba_id":10,"data_inspecao":"2026-10-15T08:00:00"},
        {**row,"id_inspecao":2,"ficha_id":13,"aba_id":130,"data_inspecao":"2026-11-10T08:00:00"},
        {**row,"id_inspecao":3,"ficha_id":11,"aba_id":106,"ativo_id":100,"data_inspecao":"2026-11-11T08:00:00"}]
    aux={"versao":1,"origem":"SQL Server Intranet","extraido_em":"2026-11-18T12:01:00Z",
        "inicio_inclusivo":base["inicio_inclusivo"],"fim_exclusivo":base["fim_exclusivo"],
        "locais":[{"ficha_id":1,"aba_id":10,"nome":"Instalação teste"},{"ficha_id":13,"aba_id":130,"nome":"Extintores teste"}],
        "frota":[{"ativo_id":100,"codigo":"Frota teste","concessao":"CRTE","localizacao":"Local teste","grupo":"VU"}],
        "inspecoes_com_respostas":[1,3]}
    pos=[]
    for regra,inicio,fim in (("ferr-eat","2026-10-01","2026-12-31"),("ferr-lt","2026-10-01","2026-12-31"),
        ("carga-148","2026-11-01","2026-11-30"),("carga-149","2026-11-01","2026-12-31")):
        pos.append({"regra_id":regra,"data_corte":"2026-11-17","inicio_ciclo":inicio,"fim_ciclo":fim,"registros":0,
            "unidades_no_recorte":2,"unidades_com_registro":0,"unidades_com_respostas":None,"populacao":"provisoria",
            "detalhe":"nao_carregado","unidades":[],"fonte":"Consulta conferida — fixture"})
    return base,aux,{"posicoes_ciclo":pos}

class TestComposicao(unittest.TestCase):
    def test_concilia_registros_populacao_e_respostas_sem_inventar_conclusao(self):
        args=fixture(); antes=copy.deepcopy(args); resultado=compor(*args)
        self.assertEqual(args,antes)
        self.assertEqual(len(resultado["posicoes_ciclo"]),15)
        mapa={p["regra_id"]:p for p in resultado["posicoes_ciclo"]}
        self.assertEqual(mapa["inst"]["registros"],1)
        self.assertEqual(mapa["ext"]["unidades_com_registro"],1)
        self.assertEqual(mapa["ext"]["unidades_com_respostas"],0)
        self.assertEqual(mapa["veic"]["unidades_com_respostas"],1)
        self.assertEqual(mapa["ferr-eat"]["data_corte"],"2026-11-17")
        self.assertEqual(mapa["veic"]["data_corte"],"2026-11-18")
        self.assertIsNone(mapa["epi-150"]["unidades_no_recorte"])
        self.assertIsNone(mapa["sso-154"]["fim_ciclo"])

    def test_rejeita_cadastro_vazio_duplicado_ou_registro_fora_da_populacao(self):
        for caso in ("vazio","duplicado","fora","sem_vinculo"):
            with self.subTest(caso=caso):
                base,aux,antigas=fixture()
                if caso=="vazio": aux["frota"]=[]
                if caso=="duplicado": aux["locais"].append(copy.deepcopy(aux["locais"][0]))
                if caso=="fora": base["registros"][0]["aba_id"]=999
                if caso=="sem_vinculo": base["registros"][2]["ativo_id"]=None
                with self.assertRaises(ValueError): compor(base,aux,antigas)

    def test_rejeita_recorte_ausente_janela_divergente_e_cadastro_de_outro_dia(self):
        for caso in ("recorte","janela","cadastro"):
            base,aux,antigas=fixture()
            if caso=="recorte": antigas["posicoes_ciclo"].pop()
            if caso=="janela": aux["inicio_inclusivo"]="2026-11-01"
            if caso=="cadastro": aux["extraido_em"]="2026-11-17T12:01:00Z"
            with self.subTest(caso=caso),self.assertRaises(ValueError): compor(base,aux,antigas)

    def test_trimestre_com_mes_de_trinta_dias(self):
        base,aux,antigas=fixture()
        for obj in (base,aux): obj["inicio_inclusivo"]="2026-04-01"; obj["fim_exclusivo"]="2026-07-01"; obj["extraido_em"]="2026-06-18T12:00:00Z"
        base["programacao"]={"inicio":"2026-04-01","fim_exclusivo":"2026-07-01","fim_realizacoes_exclusivo":"2026-07-01","ordens":[],"vinculos":[]}
        base["atividades"]=[]
        for i,r in enumerate(base["registros"]): r["data_inspecao"]="2026-04-15T08:00:00" if i==0 else "2026-06-10T08:00:00"
        for p in antigas["posicoes_ciclo"]:
            p["data_corte"]="2026-06-17"
            p["inicio_ciclo"]="2026-04-01" if p["regra_id"].startswith("ferr-") else "2026-05-01" if p["regra_id"]=="carga-149" else "2026-06-01"
            p["fim_ciclo"]="2026-06-30"
        resultado=compor(base,aux,antigas)
        self.assertEqual(resultado["posicoes_ciclo"][0]["fim_ciclo"],"2026-06-30")

if __name__=="__main__": unittest.main()
