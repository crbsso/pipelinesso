"""Entrada isolada do piloto Intranet: extracao opcional, validacao e publicacao HML."""
import argparse
import os
from pathlib import Path
import subprocess
import sys

RAIZ = Path(__file__).resolve().parents[2]

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--arquivo", required=True, type=Path)
    parser.add_argument("--confirmar-fuso-origem", choices=("America/Sao_Paulo",), required=True)
    parser.add_argument("--extrair", action="store_true")
    parser.add_argument("--permitir-certificado-temporario", action="store_true")
    parser.add_argument("--publicar-hml", action="store_true")
    args = parser.parse_args(argv)
    if args.permitir_certificado_temporario and not args.extrair:
        parser.error("A excecao de certificado exige --extrair.")
    arquivo = args.arquivo.resolve()
    if args.extrair:
        if arquivo.exists():
            parser.error("Destino ja existe; selecione um novo arquivo para preservar a extracao anterior.")
        arquivo.parent.mkdir(parents=True, exist_ok=True)
        powershell = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32/WindowsPowerShell/v1.0/powershell.exe"
        comando = [str(powershell), "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
                   str(Path(__file__).with_name("consultar_inspecoes_intranet.ps1")),
                   "-Inicio", "2026-10-01", "-Fim", "2026-11-01", "-DestinoJson", str(arquivo)]
        if args.permitir_certificado_temporario:
            comando.append("-PermitirCertificadoTemporario")
        resultado = subprocess.run(comando, cwd=RAIZ, check=False)
        if resultado.returncode:
            return resultado.returncode
    comando = [sys.executable, "-B", str(Path(__file__).with_name("publicar_inspecoes_manutencao.py")),
               "--arquivo", str(arquivo), "--confirmar-fuso-origem", args.confirmar_fuso_origem]
    ambiente = os.environ.copy()
    if args.publicar_hml:
        from dotenv import dotenv_values
        # Credenciais permanecem no processo; o publicador confere a URL HML.
        for chave, valor in dotenv_values(RAIZ / ".env").items():
            if valor is not None:
                ambiente.setdefault(chave, valor)
        comando.extend(["--publicar-hml", "--confirmar-hml", "ckfsarzmudwdehiiltwi"])
    return subprocess.run(comando, cwd=RAIZ, env=ambiente, check=False).returncode

if __name__ == "__main__":
    sys.exit(main())
