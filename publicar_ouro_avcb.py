import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client


PASTA_PROJETO = Path(__file__).resolve().parent

ARQUIVO_OURO = (
    PASTA_PROJETO
    / "ouro"
    / "avcb"
    / "mart_avcb.xlsx"
)

NOME_ABA = "mart_avcb"
NOME_TABELA = "mart_avcb"

COLUNAS_ESPERADAS = [
    "projeto",
    "subestacao",
    "localidade",
    "estado",
    "responsavel",
    "empresa",
    "instalacao",
    "gestao_avcb",
    "responsabilidade_avcb",
    "situacao",
    "projeto_incendio",
    "alvara_bombeiros",
    "sdai",
    "brigada_incendio",
    "validade_avcb_uf_anos",
    "vigencia_alvara",
    "dias_para_vencer",
    "status_validade",
    "status_gestao",
    "data_atualizacao",
]


def carregar_configuracao():
    load_dotenv(PASTA_PROJETO / ".env")

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_secret_key = os.getenv("SUPABASE_SECRET_KEY")

    if not supabase_url:
        raise RuntimeError(
            "SUPABASE_URL não encontrada no arquivo .env."
        )

    if not supabase_secret_key:
        raise RuntimeError(
            "SUPABASE_SECRET_KEY não encontrada no arquivo .env."
        )

    return supabase_url, supabase_secret_key


def carregar_ouro():
    if not ARQUIVO_OURO.exists():
        raise FileNotFoundError(
            f"Arquivo Ouro não encontrado: {ARQUIVO_OURO}"
        )

    df = pd.read_excel(
        ARQUIVO_OURO,
        sheet_name=NOME_ABA,
    )

    colunas_recebidas = df.columns.tolist()

    if colunas_recebidas != COLUNAS_ESPERADAS:
        raise ValueError(
            "Estrutura da camada Ouro diferente da esperada.\n"
            f"Esperado: {COLUNAS_ESPERADAS}\n"
            f"Recebido: {colunas_recebidas}"
        )

    if df.empty:
        raise ValueError(
            "A camada Ouro está vazia. Publicação cancelada."
        )

    return df


def preparar_dados(df):
    df = df.copy()

    # Datas em formato compatível com PostgreSQL / Supabase
    df["vigencia_alvara"] = pd.to_datetime(
        df["vigencia_alvara"]
    ).dt.strftime("%Y-%m-%d")

    df["data_atualizacao"] = pd.to_datetime(
        df["data_atualizacao"]
    ).dt.strftime("%Y-%m-%d")

    # Inteiros nativos para serialização JSON
    df["validade_avcb_uf_anos"] = (
        df["validade_avcb_uf_anos"].astype(int)
    )

    df["dias_para_vencer"] = (
        df["dias_para_vencer"].astype(int)
    )

    registros = df.to_dict(orient="records")

    return registros


def publicar():
    print("=" * 60)
    print("PUBLICAÇÃO DA CAMADA OURO - AVCB")
    print("=" * 60)

    supabase_url, supabase_secret_key = carregar_configuracao()

    print("\n1. Carregando camada Ouro...")
    df = carregar_ouro()

    print(f"   Registros encontrados: {len(df)}")

    registros = preparar_dados(df)

    print("\n2. Conectando ao Supabase...")

    supabase = create_client(
        supabase_url,
        supabase_secret_key,
    )

    print("   Conexão configurada.")

    print("\n3. Limpando dados anteriores...")

    supabase.table(NOME_TABELA).delete().neq(
        "projeto",
        "__VALOR_QUE_NAO_EXISTE__",
    ).execute()

    print("   Dados anteriores removidos.")

    print("\n4. Publicando dados atuais...")

    resposta = (
        supabase
        .table(NOME_TABELA)
        .insert(registros)
        .execute()
    )

    quantidade_publicada = len(resposta.data or [])

    print(
        f"   Registros publicados: "
        f"{quantidade_publicada}"
    )

    if quantidade_publicada != len(registros):
        raise RuntimeError(
            "Quantidade publicada diferente da quantidade esperada.\n"
            f"Esperado: {len(registros)}\n"
            f"Publicado: {quantidade_publicada}"
        )

    print("\n" + "=" * 60)
    print("PUBLICAÇÃO CONCLUÍDA COM SUCESSO")
    print("=" * 60)
    print(f"Tabela: public.{NOME_TABELA}")
    print(f"Registros: {quantidade_publicada}")


if __name__ == "__main__":
    publicar()