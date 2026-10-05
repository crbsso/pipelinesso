from pathlib import Path
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
import json
import os
import sys


LIMITE = 2000

ROOT = Path(__file__).resolve().parents[2]

PASTA_BRONZE = (
    ROOT
    / "data"
    / "bronze"
    / "motoristas"
)


def carregar_env():
    """
    Carrega variaveis do arquivo .env da raiz do projeto
    sem sobrescrever variaveis ja existentes no ambiente.
    """

    arquivo_env = ROOT / ".env"

    if not arquivo_env.exists():
        raise RuntimeError(
            f"Arquivo .env nao encontrado em: {arquivo_env}"
        )

    for linha in arquivo_env.read_text(
        encoding="utf-8-sig"
    ).splitlines():

        linha = linha.strip()

        if (
            not linha
            or linha.startswith("#")
            or "=" not in linha
        ):
            continue

        chave, valor = linha.split("=", 1)

        chave = chave.strip()
        valor = valor.strip()

        if (
            len(valor) >= 2
            and valor[0] == valor[-1]
            and valor[0] in ('"', "'")
        ):
            valor = valor[1:-1]

        if chave:
            os.environ.setdefault(
                chave,
                valor,
            )


def obter_configuracao_cobli():
    base_url = os.getenv(
        "COBLI_API_BASE_URL",
        "",
    ).strip().rstrip("/")

    api_key = os.getenv(
        "COBLI_API_KEY",
        "",
    ).strip()

    if not base_url:
        raise RuntimeError(
            "Variavel COBLI_API_BASE_URL nao definida no .env."
        )

    if not api_key:
        raise RuntimeError(
            "Variavel COBLI_API_KEY nao definida no .env."
        )

    return base_url, api_key


def requisitar_motoristas():
    base_url, api_key = obter_configuracao_cobli()

    api_url = (
        f"{base_url}/public/v1/drivers"
    )

    params = urlencode(
        {
            "limit": LIMITE,
            "page": 1,
        }
    )

    url = f"{api_url}?{params}"

    request = Request(
        url,
        headers={
            "accept": "application/json",
            "cobli-api-key": api_key,
        },
        method="GET",
    )

    try:
        with urlopen(
            request,
            timeout=60,
        ) as response:

            status = response.status
            conteudo = response.read()

    except HTTPError as erro:
        corpo = erro.read().decode(
            "utf-8",
            errors="replace",
        )

        raise RuntimeError(
            "Erro HTTP na API Cobli. "
            f"Status={erro.code}. "
            f"Resposta={corpo[:500]}"
        ) from erro

    except URLError as erro:
        raise RuntimeError(
            "Falha de conexao com a API Cobli: "
            f"{erro}"
        ) from erro

    if status != 200:
        raise RuntimeError(
            f"Status inesperado da Cobli: {status}"
        )

    try:
        payload = json.loads(
            conteudo.decode("utf-8")
        )

    except json.JSONDecodeError as erro:
        raise RuntimeError(
            "Resposta da Cobli nao e JSON valido."
        ) from erro

    return api_url, payload


def quantidade_aparente(payload):
    if isinstance(
        payload,
        list,
    ):
        return len(payload)

    if isinstance(
        payload,
        dict,
    ):
        for chave in (
            "data",
            "items",
            "results",
            "drivers",
        ):
            valor = payload.get(
                chave
            )

            if isinstance(
                valor,
                list,
            ):
                return len(valor)

    return None


def main():
    carregar_env()

    print(
        "=" * 70
    )

    print(
        "EXTRACAO COBLI - MOTORISTAS"
    )

    print(
        "=" * 70
    )

    api_url, payload = (
        requisitar_motoristas()
    )

    agora = datetime.now(
        timezone.utc
    )

    timestamp = agora.strftime(
        "%Y%m%dT%H%M%SZ"
    )

    PASTA_BRONZE.mkdir(
        parents=True,
        exist_ok=True,
    )

    arquivo = (
        PASTA_BRONZE
        / f"cobli_motoristas_{timestamp}.json"
    )

    bronze = {
        "fonte": "COBLI",
        "endpoint": api_url,
        "extraido_em_utc": (
            agora.isoformat()
        ),
        "page": 1,
        "limit": LIMITE,
        "payload": payload,
    }

    arquivo.write_text(
        json.dumps(
            bronze,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print()
    print(
        f"Endpoint: {api_url}"
    )

    print(
        f"Arquivo Bronze: {arquivo}"
    )

    print(
        f"Tipo do payload: "
        f"{type(payload).__name__}"
    )

    if isinstance(
        payload,
        dict,
    ):
        print(
            "Chaves do payload:"
        )

        for chave in payload.keys():
            print(
                f"  - {chave}"
            )

    quantidade = (
        quantidade_aparente(
            payload
        )
    )

    print()

    if quantidade is None:
        print(
            "Quantidade de motoristas: "
            "a identificar pela estrutura real."
        )

    else:
        print(
            "Motoristas aparentes na resposta: "
            f"{quantidade}"
        )

    print()
    print(
        "=" * 70
    )

    print(
        "BRONZE COBLI GERADA COM SUCESSO"
    )

    print(
        "=" * 70
    )


if __name__ == "__main__":
    try:
        main()

    except Exception as erro:
        print(
            f"ERRO: {erro}",
            file=sys.stderr,
        )

        sys.exit(1)
