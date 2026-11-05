"""Testes locais sem conexao com SQL Server ou Supabase."""

from copy import deepcopy
import unittest

from validar_inspecoes_intranet import (
    DadosInvalidos,
    analisar,
    conferir_outubro_2026,
)


def exemplo():
    return {
        "origem": "SQL Server Intranet",
        "inicio_inclusivo": "2026-10-01",
        "fim_exclusivo": "2026-11-01",
        "fuso_origem": "nao_verificado",
        "registros": [
            {
                "id_inspecao": 1,
                "ficha_id": 2,
                "aba_id": 3,
                "ativo_id": 4,
                "data_inspecao": "2026-10-15T10:30:00.0000000",
                "familia": "Inspeção em Veículos",
                "tipo": "Mensal de Veículo Utilitário",
                "periodicidade": "Mensal",
            }
        ],
    }


class TesteValidacao(unittest.TestCase):

    def test_resumo_basico(self):
        resultado = analisar(exemplo())

        self.assertEqual(
            resultado["total_registros"], 1
        )

        self.assertEqual(
            resultado["veiculos_distintos_modalidades_mensais"],
            1,
        )

    def test_fuso_confirmado_aceito_pelo_quality_gate(self):
        dados = exemplo()
        dados["fuso_origem"] = "America/Sao_Paulo"
        self.assertEqual(analisar(dados)["total_registros"], 1)

    def test_fuso_desconhecido_bloqueado(self):
        dados = exemplo()
        dados["fuso_origem"] = "UTC"
        with self.assertRaises(DadosInvalidos):
            analisar(dados)

    def test_sem_registros_valido(self):
        dados = exemplo()
        dados["registros"] = []

        self.assertEqual(
            analisar(dados)["total_registros"],
            0,
        )

    def test_chave_duplicada_bloqueada(self):
        dados = exemplo()

        dados["registros"].append(
            deepcopy(dados["registros"][0])
        )

        with self.assertRaises(DadosInvalidos):
            analisar(dados)

    def test_data_fora_do_periodo_bloqueada(self):
        dados = exemplo()

        dados["registros"][0]["data_inspecao"] = (
            "2026-11-01T00:00:00"
        )

        with self.assertRaises(DadosInvalidos):
            analisar(dados)

    def test_identificador_ausente_bloqueado(self):
        dados = exemplo()
        dados["registros"][0]["id_inspecao"] = None

        with self.assertRaises(DadosInvalidos):
            analisar(dados)

    def test_referencia_historica_divergente(self):
        with self.assertRaises(DadosInvalidos):
            conferir_outubro_2026(
                analisar(exemplo())
            )


if __name__ == "__main__":
    unittest.main()