import subprocess
import sys
from pathlib import Path


PASTA_PROJETO = Path(__file__).resolve().parent


ETAPAS = [
    (
        "EXTRAÇÃO AVCB",
        "extrair_avcb.py",
    ),
    (
        "VALIDAÇÃO DE QUALIDADE",
        "validar_qualidade.py",
    ),
    (
        "GERAÇÃO DA CAMADA PRATA",
        "tratar_avcb.py",
    ),
    (
        "GERAÇÃO DA CAMADA OURO",
        "gerar_ouro_avcb.py",
    ),
    (
        "PUBLICAÇÃO NO SUPABASE",
        "publicar_ouro_avcb.py",
    ),
]


def executar_etapa(numero, total, nome, arquivo):
    caminho_script = PASTA_PROJETO / arquivo

    if not caminho_script.exists():
        raise FileNotFoundError(
            f"Script não encontrado: {caminho_script}"
        )

    print("\n" + "=" * 70)
    print(f"ETAPA {numero}/{total} - {nome}")
    print("=" * 70)

    resultado = subprocess.run(
        [sys.executable, str(caminho_script)],
        cwd=PASTA_PROJETO,
    )

    if resultado.returncode != 0:
        print("\n" + "=" * 70)
        print("PIPELINE INTERROMPIDO")
        print("=" * 70)
        print(f"Etapa com erro: {numero}/{total} - {nome}")
        print(f"Script: {arquivo}")
        print(f"Código de saída: {resultado.returncode}")

        sys.exit(resultado.returncode)

    print(f"\nETAPA {numero}/{total} CONCLUÍDA COM SUCESSO")


def main():
    total_etapas = len(ETAPAS)

    print("\n" + "=" * 70)
    print("PIPELINE SSO - AVCB")
    print("=" * 70)
    print(f"Total de etapas: {total_etapas}")

    for numero, (nome, arquivo) in enumerate(
        ETAPAS,
        start=1,
    ):
        executar_etapa(
            numero,
            total_etapas,
            nome,
            arquivo,
        )

    print("\n" + "=" * 70)
    print("PIPELINE SSO CONCLUÍDO COM SUCESSO")
    print("=" * 70)
    print("Etapas executadas:")
    print("1. Extração")
    print("2. Validação de qualidade")
    print("3. Camada Prata")
    print("4. Camada Ouro")
    print("5. Publicação no Supabase")


if __name__ == "__main__":
    main()