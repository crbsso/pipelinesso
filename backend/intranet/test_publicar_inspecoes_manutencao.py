"""Contrato do arquivo imutavel e da confirmacao de fuso do piloto."""
import hashlib
import json
from pathlib import Path
import unittest
from unittest.mock import Mock, patch

import publicar_inspecoes_manutencao as publicador


class TestePublicador(unittest.TestCase):
    def validar(self, fuso_documento="nao_verificado", confirmacao=None, hash_invalido=False):
        documento = {
            "origem": "SQL Server Intranet",
            "inicio_inclusivo": "2026-10-01",
            "fim_exclusivo": "2026-11-01",
            "fuso_origem": fuso_documento,
            "registros": [{
                "id_inspecao": 1, "ficha_id": 2, "aba_id": 3,
                "ativo_id": None, "data_inspecao": "2026-10-15T10:30:00",
                "concessao": None, "localizacao": None,
                "familia": "Inspeção de EPIs", "tipo": "Cinto de segurança",
                "periodicidade": "Mensal",
            }],
        }
        bruto = json.dumps(documento).encode("utf-8")
        caminho = Mock()
        caminho.read_bytes.return_value = bruto
        digest = "invalido" if hash_invalido else hashlib.sha256(bruto).hexdigest().upper()
        resultado_gate = Mock(returncode=0, stdout="VALIDACAO: APROVADA")
        with patch.object(publicador, "HASH_VALIDADO", digest), patch.object(
            publicador, "QUANTIDADE_VALIDADA", 1
        ), patch.object(publicador, "FAMILIAS", {"Inspeção de EPIs"}), patch.object(
            publicador.subprocess, "run", return_value=resultado_gate
        ):
            return publicador.validar_arquivo(caminho, confirmacao)

    def test_arquivo_nao_verificado_exige_confirmacao(self):
        with self.assertRaisesRegex(ValueError, "Fuso de origem nao confirmado"):
            self.validar()

    def test_confirmacao_separada_preserva_arquivo_original(self):
        registros, digest = self.validar(confirmacao="America/Sao_Paulo")
        self.assertEqual(len(registros), 1)
        self.assertEqual(len(digest), 64)

    def test_fuso_confirmado_no_documento_aceito(self):
        self.assertEqual(len(self.validar(fuso_documento="America/Sao_Paulo")[0]), 1)

    def test_confirmacao_nao_sobrescreve_fuso_divergente(self):
        with self.assertRaisesRegex(ValueError, "Fuso de origem nao confirmado"):
            self.validar(fuso_documento="UTC", confirmacao="America/Sao_Paulo")

    def test_fuso_de_confirmacao_nao_suportado_bloqueado(self):
        with self.assertRaisesRegex(ValueError, "Confirmacao de fuso nao suportada"):
            self.validar(confirmacao="UTC")

    def test_confirmacao_nao_contorna_assinatura(self):
        with self.assertRaisesRegex(ValueError, "SHA256 diferente"):
            self.validar(confirmacao="America/Sao_Paulo", hash_invalido=True)


if __name__ == "__main__":
    unittest.main()
