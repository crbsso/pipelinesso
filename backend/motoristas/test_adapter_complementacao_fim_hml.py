import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from backend.motoristas import publicar_historico_motoristas as h


class ClienteFalso:
    def __init__(self, situacao="REGISTRADA"):
        self.chamadas = []
        self.situacao = situacao
        self.parametros = None

    def rpc(self, nome, parametros):
        self.chamadas.append(nome)
        self.parametros = parametros
        return self

    def execute(self):
        return SimpleNamespace(data={
            "situacao": self.situacao,
            "evento_id_historico":
                self.parametros["p_evento_id_historico"],
            "evento_id_observado":
                self.parametros["p_evento_id_observado"],
        })


class TestAdapterHML(unittest.TestCase):
    def setUp(self):
        self.antigo = {
            "evento_id": "a" * 64,
            "vehicle_id_cobli": "veiculo-teste",
            "tipo_evento": "VIAGEM",
            "inicio": "2026-11-09T12:00:00",
            "fim": None,
        }
        self.novo = dict.fromkeys(h.COLUNAS_FATO)
        self.novo.update({
            "evento_id": "b" * 64,
            "vehicle_id_cobli": "veiculo-teste",
            "tipo_evento": "VIAGEM",
            "inicio": "2026-11-09T12:00:00",
            "fim": "2026-11-09T12:15:00",
            "extraido_em_utc": "2026-11-13T14:00:00+00:00",
        })
        self.remoto = {self.antigo["evento_id"]: self.antigo}

    def test_diagnostico_sem_escrita(self):
        cliente = ClienteFalso()
        resultado = h.processar_complementacoes_hml(
            [self.novo], self.remoto, cliente, aplicar=False
        )
        self.assertEqual(resultado["complementacoes_identificadas"], 1)
        self.assertEqual(resultado["registradas"], 0)
        self.assertEqual(cliente.chamadas, [])

    def test_escrita_exige_autorizacao(self):
        cliente = ClienteFalso()
        with patch.dict(os.environ, {
            "SSO_HISTORICO_COMPLEMENTACAO_HML_AUTORIZADA": ""
        }):
            with self.assertRaisesRegex(
                RuntimeError, "sem autorizacao"
            ):
                h.processar_complementacoes_hml(
                    [self.novo], self.remoto, cliente, aplicar=True
                )
        self.assertEqual(cliente.chamadas, [])

    def test_resposta_valida_e_idempotente(self):
        for situacao in ("REGISTRADA", "JA_REGISTRADA"):
            with self.subTest(situacao=situacao):
                cliente = ClienteFalso(situacao)
                with patch.dict(os.environ, {
                    "SSO_HISTORICO_COMPLEMENTACAO_HML_AUTORIZADA": "SIM"
                }):
                    resultado = h.processar_complementacoes_hml(
                        [self.novo], self.remoto, cliente, aplicar=True
                    )
                self.assertEqual(len(cliente.chamadas), 1)
                self.assertEqual(
                    resultado["registradas"]
                    + resultado["ja_registradas"], 1
                )

    def test_extracao_sem_fuso_bloqueia_antes_da_rpc(self):
        cliente = ClienteFalso()
        registro = dict(self.novo)
        registro["extraido_em_utc"] = "2026-11-13T14:00:00"
        with patch.dict(os.environ, {
            "SSO_HISTORICO_COMPLEMENTACAO_HML_AUTORIZADA": "SIM"
        }):
            with self.assertRaisesRegex(
                RuntimeError, "sem fuso UTC"
            ):
                h.processar_complementacoes_hml(
                    [registro], self.remoto, cliente, aplicar=True
                )
        self.assertEqual(cliente.chamadas, [])


if __name__ == "__main__":
    unittest.main()
