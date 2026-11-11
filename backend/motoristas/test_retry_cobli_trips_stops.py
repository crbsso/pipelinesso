import io
import json
import unittest
from unittest.mock import call, patch
from urllib.error import HTTPError, URLError

from backend.motoristas import extrair_cobli_trips_stops as modulo


class RespostaFake:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self):
        return json.dumps(
            {"data": {"rows": [{"id": 1}]}}
        ).encode("utf-8")


class TestRetryCobli(unittest.TestCase):
    def setUp(self):
        self.corpo = {"page": 37, "size": 100}

    @patch.object(modulo.time, "sleep")
    @patch.object(modulo, "urlopen")
    def test_mesma_pagina_apos_erro(self, abrir, dormir):
        abrir.side_effect = [URLError("ssl timeout"), RespostaFake()]

        resultado = modulo.requisitar(
            "https://example.test", "fake-key", self.corpo
        )

        self.assertEqual(resultado["data"]["rows"], [{"id": 1}])
        self.assertEqual(abrir.call_count, 2)
        dormir.assert_called_once_with(1)

        for chamada in abrir.call_args_list:
            req = chamada.args[0]
            self.assertEqual(json.loads(req.data), self.corpo)
            self.assertEqual(req.get_method(), "POST")

    @patch.object(modulo.time, "sleep")
    @patch.object(modulo, "urlopen")
    def test_limite_de_tentativas(self, abrir, dormir):
        abrir.side_effect = URLError("tls timeout")

        with self.assertRaisesRegex(
            RuntimeError, "apos 3 tentativas na pagina 37"
        ):
            modulo.requisitar(
                "https://example.test", "fake-key", self.corpo
            )

        self.assertEqual(abrir.call_count, 3)
        self.assertEqual(
            dormir.call_args_list, [call(1), call(2)]
        )

    @patch.object(modulo.time, "sleep")
    @patch.object(modulo, "urlopen")
    def test_http_sem_retry(self, abrir, dormir):
        abrir.side_effect = HTTPError(
            "https://example.test",
            429,
            "Too Many Requests",
            None,
            io.BytesIO(b"rate limit"),
        )

        with self.assertRaisesRegex(RuntimeError, "Status=429"):
            modulo.requisitar(
                "https://example.test", "fake-key", self.corpo
            )

        self.assertEqual(abrir.call_count, 1)
        dormir.assert_not_called()

    @patch.object(modulo.time, "sleep")
    @patch.object(modulo, "urlopen")
    def test_timeout_direto(self, abrir, dormir):
        abrir.side_effect = [
            TimeoutError("handshake"),
            RespostaFake(),
        ]

        modulo.requisitar(
            "https://example.test", "fake-key", self.corpo
        )

        self.assertEqual(abrir.call_count, 2)
        dormir.assert_called_once_with(1)

    @patch.object(modulo.time, "sleep")
    @patch.object(modulo, "urlopen")
    def test_connection_reset_refaz_mesma_pagina(self, abrir, dormir):
        abrir.side_effect = [
            ConnectionResetError(10054, "conexao encerrada"),
            RespostaFake(),
        ]

        resultado = modulo.requisitar(
            "https://example.test", "fake-key", self.corpo
        )

        self.assertEqual(resultado["data"]["rows"], [{"id": 1}])
        self.assertEqual(abrir.call_count, 2)
        dormir.assert_called_once_with(1)

        for chamada in abrir.call_args_list:
            req = chamada.args[0]
            self.assertEqual(json.loads(req.data), self.corpo)
            self.assertEqual(req.get_method(), "POST")

    @patch.object(modulo.time, "sleep")
    @patch.object(modulo, "urlopen")
    def test_connection_reset_esgota_tentativas(self, abrir, dormir):
        abrir.side_effect = ConnectionResetError(
            10054, "conexao encerrada"
        )

        with self.assertRaisesRegex(
            RuntimeError,
            "apos 3 tentativas na pagina 37: ConnectionResetError"
        ):
            modulo.requisitar(
                "https://example.test", "fake-key", self.corpo
            )

        self.assertEqual(abrir.call_count, 3)
        self.assertEqual(
            dormir.call_args_list, [call(1), call(2)]
        )

    @patch.object(modulo.time, "sleep")
    @patch.object(modulo, "urlopen")
    def test_json_invalido_sem_retry(self, abrir, dormir):
        resposta = RespostaFake()
        resposta.read = lambda: b"{not json}"
        abrir.return_value = resposta

        with self.assertRaises(json.JSONDecodeError):
            modulo.requisitar(
                "https://example.test", "fake-key", self.corpo
            )

        self.assertEqual(abrir.call_count, 1)
        dormir.assert_not_called()
