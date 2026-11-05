import copy
import unittest
from painel_manutencao import preparar_cargas, publicar

def documento():
    return {"versao": 1, "origem": "SQL Server Intranet", "fuso_origem": "America/Sao_Paulo",
      "inicio_inclusivo": "2026-10-01", "fim_exclusivo": "2026-12-01", "extraido_em": "2026-11-05T12:00:00Z",
      "registros": [{"id_inspecao": 1, "ficha_id": 1, "aba_id": 1, "ativo_id": None,
        "data_inspecao": "2026-10-31T23:59:59", "familia": "Inspeção de EPIs", "tipo": "Cinto",
        "concessao": "A", "localizacao": "SE 1", "periodicidade": "Mensal"}],
      "programacao": {"inicio": "2026-10-01", "fim_exclusivo": "2026-12-01", "fim_realizacoes_exclusivo": "2026-12-01",
        "ordens": [{"os_id": 10, "plano_id": 197, "data_prevista": "2026-10-01", "concessao": "A", "localizacao": "SE 1"}], "vinculos": []},
      "atividades": [{"atividade_os_id": 20, "os_id": 10, "atividade_id": 7911, "status": 2}]}

class TestPainel(unittest.TestCase):
    def test_separa_meses_sem_transformar_ausencia_em_novos_registros(self):
        cargas = preparar_cargas(documento())
        self.assertEqual(len(cargas), 2)
        self.assertEqual(len(cargas[0]["conteudo"]["dados"]), 1)
        self.assertEqual(cargas[1]["conteudo"]["dados"], [])
        self.assertEqual(cargas[1]["conteudo"]["atividades"], [])
    def test_rejeita_duplicacoes_que_inflariam_metas(self):
        for colecao in ("registros", "atividades"):
            d = documento()
            d[colecao].append(copy.deepcopy(d[colecao][0]))
            with self.assertRaises(ValueError):
                preparar_cargas(d)
    def test_rejeita_obrigacao_duplicada_com_outro_identificador(self):
        d = documento()
        d["atividades"].append({**d["atividades"][0], "atividade_os_id": 21})
        with self.assertRaises(ValueError):
            preparar_cargas(d)
    def test_rejeita_atividade_sem_os_ou_de_outro_plano(self):
        for campo, valor in (("os_id", 999), ("atividade_id", 3048)):
            d = documento(); d["atividades"][0][campo] = valor
            with self.assertRaises(ValueError):
                preparar_cargas(d)
    def test_preserva_outros_estados_sem_rotular_como_concluidos(self):
        d = documento(); d["atividades"][0]["status"] = 3
        self.assertEqual(preparar_cargas(d)[0]["conteudo"]["atividades"][0]["status"], 3)
    def test_nao_publica_em_producao(self):
        with self.assertRaises(ValueError):
            publicar([], "https://producao.supabase.co", "segredo-ficticio")
    def test_producao_exige_confirmacao_e_url_do_projeto_correto(self):
        for url, confirmacao in (("https://lkhidajhsqgebjltyicb.supabase.co", None), ("https://ckfsarzmudwdehiiltwi.supabase.co", "lkhidajhsqgebjltyicb")):
            with self.assertRaises(ValueError):
                publicar([], url, "fixture", "producao", confirmacao)
    def test_producao_confirmada_envia_somente_ao_projeto_selecionado(self):
        import sys
        from types import SimpleNamespace
        from unittest.mock import patch, Mock
        post = Mock(return_value=SimpleNamespace(status_code=200, json=lambda: 1))
        with patch.dict(sys.modules, {"requests": SimpleNamespace(post=post)}):
            self.assertEqual(publicar([{}], "https://lkhidajhsqgebjltyicb.supabase.co", "fixture", "producao", "lkhidajhsqgebjltyicb"), 1)
        self.assertEqual(post.call_args.args[0], "https://lkhidajhsqgebjltyicb.supabase.co/rest/v1/rpc/publicar_painel_manutencao")
    def test_limites_de_tempo_e_fuso(self):
        for alteracao in ({"fuso_origem": "nao_verificado"}, {"inicio_inclusivo": "2026-10-02"}, {"fim_exclusivo": "2027-02-01"}):
            with self.assertRaises(ValueError):
                preparar_cargas({**documento(), **alteracao})
        d = documento(); d["registros"][0]["data_inspecao"] = "2026-12-01T00:00:00"
        with self.assertRaises(ValueError):
            preparar_cargas(d)

if __name__ == "__main__":
    unittest.main()
