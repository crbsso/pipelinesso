import unittest

from backend.motoristas import publicar_historico_motoristas as h


class TestComplementacaoFimHistorico(unittest.TestCase):

    def viagem(self, eid, fim=None, inicio="2026-11-09T12:00:00"):
        return {
            "evento_id": eid,
            "vehicle_id_cobli": "veiculo-teste",
            "tipo_evento": "VIAGEM",
            "inicio": inicio,
            "fim": fim,
        }

    def test_complementacao_nulo_para_preenchido(self):
        antigo = self.viagem("a" * 64)
        novo = self.viagem("b" * 64, "2026-11-09T12:15:00")

        novos, existentes, complementacoes = (
            h.classificar_lote_incremental(
                [novo], {antigo["evento_id"]: antigo}
            )
        )

        self.assertEqual(len(novos), 0)
        self.assertEqual(existentes, 0)
        self.assertEqual(len(complementacoes), 1)
        self.assertEqual(
            complementacoes[0]["evento_id_historico"],
            antigo["evento_id"],
        )

    def test_publicacao_permanece_bloqueada(self):
        antigo = self.viagem("a" * 64)
        novo = self.viagem("b" * 64, "2026-11-09T12:15:00")

        with self.assertRaisesRegex(
            RuntimeError, "COMPLEMENTACAO_FIM_PENDENTE"
        ):
            h.separar_ineditos([novo], {antigo["evento_id"]: antigo})

    def test_evento_identico_e_preservado(self):
        antigo = self.viagem("a" * 64)

        novos, existentes, complementacoes = (
            h.classificar_lote_incremental(
                [dict(antigo)], {antigo["evento_id"]: antigo}
            )
        )

        self.assertEqual((len(novos), existentes, len(complementacoes)),
                         (0, 1, 0))

    def test_evento_novo_e_elegivel(self):
        novo = self.viagem("b" * 64, "2026-11-09T12:15:00")

        novos, existentes, complementacoes = (
            h.classificar_lote_incremental([novo], {})
        )

        self.assertEqual((len(novos), existentes, len(complementacoes)),
                         (1, 0, 0))

    def test_conflito_nao_autorizado_e_bloqueado(self):
        antigo = self.viagem("a" * 64, "2026-11-09T12:10:00")
        novo = self.viagem("b" * 64, "2026-11-09T12:15:00")

        with self.assertRaisesRegex(
            RuntimeError, "nao e complementacao"
        ):
            h.classificar_lote_incremental(
                [novo], {antigo["evento_id"]: antigo}
            )

    def test_evento_id_reutilizado_com_tempo_diferente_bloqueia(self):
        antigo = self.viagem("a" * 64)
        novo = self.viagem("a" * 64, "2026-11-09T12:15:00")

        with self.assertRaisesRegex(
            RuntimeError, "identidade temporal divergente"
        ):
            h.classificar_lote_incremental(
                [novo], {antigo["evento_id"]: antigo}
            )

    def test_chave_local_duplicada_bloqueia(self):
        primeiro = self.viagem("a" * 64)
        segundo = self.viagem("b" * 64)

        with self.assertRaisesRegex(
            RuntimeError, "Chave natural duplicada"
        ):
            h.classificar_lote_incremental(
                [primeiro, segundo], {}
            )


if __name__ == "__main__":
    unittest.main()
