import copy
from datetime import date
import unittest
from ciclos_manutencao import validar_posicoes_ciclo
from painel_manutencao import preparar_cargas
from test_painel_manutencao import documento


def posicao():
    return {"regra_id": "ext", "data_corte": "2026-11-04", "inicio_ciclo": "2026-11-01", "fim_ciclo": "2026-11-30",
        "registros": 2, "unidades_no_recorte": 2, "unidades_com_registro": 1, "unidades_com_respostas": 1,
        "populacao": "provisoria", "detalhe": "completo", "fonte": "Fixture SQL",
        "unidades": [{"chave": str(i), "nome": "Local " + str(i), "concessao": "CRTE", "localizacao": "Local", "grupo": None,
            "registros": 2 if i == 1 else 0, "com_respostas": i == 1} for i in (1, 2)]}


class TestCiclos(unittest.TestCase):
    def validar(self, p):
        return validar_posicoes_ciclo(p, date(2026,10,1), date(2026,12,1))

    def test_repeticao_de_registros_nao_multiplica_cobertura(self):
        self.assertEqual(self.validar([posicao()])[0]["unidades_com_registro"], 1)

    def test_rejeita_populacao_e_detalhe_inconsistentes(self):
        for alteracao in ({"unidades_no_recorte": 3}, {"unidades_com_registro": 3}, {"registros": True},
            {"registros": 3}, {"unidades_com_respostas": 2}, {"populacao": "nao_definida"}, {"fim_ciclo": "2026-12-31"}):
            with self.subTest(alteracao=alteracao), self.assertRaises(ValueError):
                self.validar([{**posicao(), **alteracao}])

    def test_rejeita_duplicacao_de_mes_e_unidade(self):
        p = posicao()
        with self.assertRaises(ValueError): self.validar([p, copy.deepcopy(p)])
        p["unidades"].append(copy.deepcopy(p["unidades"][0]))
        with self.assertRaises(ValueError): self.validar([p])

    def test_lista_parcial_nao_finge_ser_populacao_completa(self):
        p = posicao()
        p["detalhe"] = "somente_sem_registro"
        p["unidades"] = [p["unidades"][1]]
        self.validar([p])
        p["detalhe"] = "completo"
        with self.assertRaises(ValueError): self.validar([p])

    def test_carga_preserva_posicao_no_mes_correto_e_contrato_antigo(self):
        anterior = preparar_cargas(documento())
        self.assertNotIn("posicoes_ciclo", anterior[0]["conteudo"])
        d = documento()
        d["posicoes_ciclo"] = [posicao()]
        cargas = preparar_cargas(d)
        self.assertEqual(cargas[0]["conteudo"]["posicoes_ciclo"], [])
        self.assertEqual(cargas[1]["conteudo"]["posicoes_ciclo"], [posicao()])
        self.assertEqual(cargas[0]["conteudo"]["dados"], anterior[0]["conteudo"]["dados"])


if __name__ == "__main__": unittest.main()
