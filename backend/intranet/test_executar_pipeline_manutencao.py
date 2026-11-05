"""O modo Intranet nao inicia o pipeline de producao por acidente."""
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import Mock, patch
import executar_pipeline_manutencao as pipeline

class TestePipelineManutencao(unittest.TestCase):
    def test_modo_padrao_so_valida_localmente(self):
        with patch.object(pipeline.subprocess, 'run', return_value=Mock(returncode=0)) as executar:
            self.assertEqual(pipeline.main(['--arquivo', __file__, '--confirmar-fuso-origem', 'America/Sao_Paulo']), 0)
            comando = executar.call_args.args[0]
            self.assertNotIn('--publicar-hml', comando)
            self.assertIn('publicar_inspecoes_manutencao.py', comando[2])
            self.assertEqual(executar.call_count, 1)

    def test_extracao_nao_sobrescreve_arquivo(self):
        with patch.object(pipeline.subprocess, 'run') as executar:
            with self.assertRaises(SystemExit):
                pipeline.main(['--arquivo', __file__, '--confirmar-fuso-origem', 'America/Sao_Paulo', '--extrair'])
            executar.assert_not_called()

    def test_excecao_certificado_exige_extracao(self):
        with patch.object(pipeline.subprocess, 'run') as executar:
            with self.assertRaises(SystemExit):
                pipeline.main(['--arquivo', __file__, '--confirmar-fuso-origem', 'America/Sao_Paulo', '--permitir-certificado-temporario'])
            executar.assert_not_called()

    def test_modos_conflitantes_bloqueiam_antes_de_preflight_ou_etl(self):
        script = Path(__file__).resolve().parents[1] / 'executar_pipeline_sso.py'
        for argumentos in [['--manutencao', '--teste-hml'], ['--arquivo-intranet', 'nao_existe.json'], ['--manutencao']]:
            r = subprocess.run([sys.executable, '-B', str(script), *argumentos], capture_output=True, text=True)
            self.assertEqual(r.returncode, 2)
            self.assertNotIn('PREFLIGHT DE PRODUCAO', r.stdout)
            self.assertNotIn('ETAPA 1/', r.stdout)

if __name__ == '__main__':
    unittest.main()
