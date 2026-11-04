"""Executor de console do BAT Portal SSO.

Preserva stdin interativo, encaminha stdout/stderr ao console
e ao log, e devolve o codigo de saida do orquestrador.
"""

import os
import subprocess
import sys


def main():
    python = os.environ.get("BAT_PYTHON", "").strip()
    script = os.environ.get("BAT_SCRIPT", "").strip()
    log = os.environ.get("BAT_LOG", "").strip()
    modo = os.environ.get("BAT_MODO", "").strip()

    if modo not in ("", "--teste-hml"):
        print("ERRO: modo nao autorizado.", file=sys.stderr)
        return 90

    if not python or not os.path.isfile(python):
        print("ERRO: Python nao encontrado.", file=sys.stderr)
        return 90

    if not script or not os.path.isfile(script):
        print("ERRO: orquestrador nao encontrado.", file=sys.stderr)
        return 90

    if not log:
        print("ERRO: caminho do log ausente.", file=sys.stderr)
        return 90

    comando = [python, "-u", script]

    if modo == "--teste-hml":
        comando.append("--teste-hml")

    processo = None

    try:
        with open(log, "ab", buffering=0) as arquivo:
            processo = subprocess.Popen(
                comando,
                stdin=None,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=0,
            )

            with processo.stdout:
                while True:
                    bloco = os.read(
                        processo.stdout.fileno(),
                        4096,
                    )

                    if not bloco:
                        break

                    sys.stdout.buffer.write(bloco)
                    sys.stdout.buffer.flush()
                    arquivo.write(bloco)

            return processo.wait()

    except KeyboardInterrupt:
        print(
            "EXECUCAO INTERROMPIDA. "
            "Nao repetir publicacoes sem reconciliar.",
            file=sys.stderr,
            flush=True,
        )
        return 130

    except Exception as erro:
        print(
            "ERRO: executor interativo ou log falhou. "
            "Tipo: " + type(erro).__name__,
            file=sys.stderr,
            flush=True,
        )
        return 90

    finally:
        if processo is not None and processo.poll() is None:
            try:
                processo.terminate()
                processo.wait(timeout=5)
            except Exception:
                try:
                    processo.kill()
                    processo.wait(timeout=5)
                except Exception:
                    pass


if __name__ == "__main__":
    sys.exit(main())