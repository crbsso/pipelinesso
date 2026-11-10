import unittest
from unittest.mock import patch

from backend.inspecoes import tratar_quantidade as t


class TestExcecao6615(unittest.TestCase):
    def setUp(self):
        self.excecao = t.carregar_excecao_6615()
        self.brasil = {"brasil": "BRASIL"}

    def registro(self, identificador="6615", area=None):
        return {
            "id_resposta": identificador,
            "area_organizacional": (self.excecao["area_organizacional"] if area is None else area),
            "nome_formulario": self.excecao["nome_formulario"],
            "data_da_inspecao": "2026-11-08",
        }

    def test_configuracao_restrita(self):
        self.assertEqual(self.excecao["id_resposta"], "6615")
        self.assertEqual(self.excecao["status"], "PENDENTE_VERIFICACAO")

    def test_excecao_preserva_inspecao_brasileira(self):
        registros = [self.registro(), self.registro("9001", "Brasil")]
        with patch.object(
            t, "assinatura_registro_escopo",
            return_value=self.excecao["sha256_registro"]
        ):
            t.classificar_registros(registros, self.brasil, {})

        brasil, fora = t.selecionar_brasil(registros)

        self.assertEqual([r["id_resposta"] for r in brasil], ["9001"])
        self.assertEqual(fora, 0)
        self.assertEqual(
            registros[0]["_escopo_calculado"], "PENDENTE_VERIFICACAO"
        )

    def test_registro_6615_alterado_bloqueia(self):
        with self.assertRaisesRegex(RuntimeError, "6615 mudou"):
            t.classificar_registros(
                [self.registro(area="Outra area")], self.brasil, {}
            )

    def test_registro_6615_duplicado_bloqueia(self):
        with self.assertRaisesRegex(RuntimeError, "6615 duplicada"):
            t.classificar_registros(
                [self.registro(), self.registro()], self.brasil, {}
            )

    def test_outras_areas_desconhecidas_continuam_bloqueadas(self):
        with self.assertRaisesRegex(RuntimeError, "nao classificadas"):
            t.classificar_registros(
                [self.registro("9002", "Area desconhecida")],
                self.brasil, {}
            )


    def test_bronze_real_completa(self):
        import os
        from pathlib import Path

        self.assertEqual(
            self.excecao["area_organizacional"],
            "Constru\u00e7\u00e3o"
        )
        self.assertEqual(
            self.excecao["nome_formulario"],
            "CH - ECC-01 Lista de Verifica\u00e7\u00e3o de Condu\u00e7\u00e3o de Ve\u00edculos"
        )

        caminho = os.environ.get("SSO_BRONZE_6615")
        if not caminho:
            self.skipTest("Bronze real nao fornecida")

        with patch.object(t, "ARQUIVO_BRONZE", Path(caminho)):
            _, registros = t.ler_bronze()

        self.assertEqual(len(registros), 4326)

        alvos = [
            r for r in registros
            if t.id_normalizado(r.get("id_resposta")) == "6615"
        ]

        self.assertEqual(len(alvos), 1)
        self.assertEqual(
            t.assinatura_registro_escopo(alvos[0]),
            self.excecao["sha256_registro"]
        )

        t.classificar_registros(
            registros,
            t.carregar_dimensao(),
            t.carregar_regras_compostas()
        )

        brasil, fora = t.selecionar_brasil(registros)

        pendentes = [
            r for r in registros
            if r.get("_escopo_calculado") == "PENDENTE_VERIFICACAO"
        ]

        self.assertEqual(len(pendentes), 1)
        self.assertEqual(
            t.id_normalizado(pendentes[0]["id_resposta"]),
            "6615"
        )
        self.assertEqual(
            len(brasil) + fora + len(pendentes),
            len(registros)
        )

        unicos = t.deduplicar(brasil)

        print("BRONZE_REAL:", len(registros))
        print("BRASIL:", len(brasil))
        print("FORA_BRASIL:", fora)
        print("PENDENTES:", len(pendentes))
        print("BRASIL_UNICOS:", len(unicos))


    def test_escopo_brasil_e_fora_brasil_preservados(self):
        registros = [
            self.registro("9003", "Brasil"),
            self.registro("9004", "Chile"),
        ]

        t.classificar_registros(
            registros,
            {"brasil": "BRASIL", "chile": "FORA_BRASIL"},
            {}
        )

        brasil, fora = t.selecionar_brasil(registros)

        self.assertEqual(len(brasil), 1)
        self.assertEqual(fora, 1)


if __name__ == "__main__":
    unittest.main()
