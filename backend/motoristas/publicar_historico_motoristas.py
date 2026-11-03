import argparse
import hashlib
import json
import os
import sys
import uuid
from datetime import datetime
from urllib.parse import urlparse
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client


ROOT = Path(__file__).resolve().parents[2]

PASTA_BRONZE = (
    ROOT
    / "data"
    / "bronze"
    / "motoristas"
)

PASTA_PRATA = (
    ROOT
    / "data"
    / "prata"
    / "motoristas"
)

ARQUIVO_VIAGENS = (
    PASTA_PRATA
    / "motorista_veiculo.csv"
)

ARQUIVO_MOTORISTAS = (
    PASTA_PRATA
    / "motoristas.csv"
)

TABELA = (
    "fato_motoristas_viagens"
)

TAMANHO_LOTE = 200
# Contrato REAL consultado somente por leitura em HML em 27/10/2026.
TABELA_STAGING = "stg_backfill_motoristas_viagens_sso"
RPC_PROMOVER_HISTORICO = "promover_backfill_motoristas_viagens_sso"
HML_PROJECT_REF = "ckfsarzmudwdehiiltwi"
PROD_PROJECT_REF = "lkhidajhsqgebjltyicb"
MAX_PAGINAS_HISTORICO = 1000


COLUNAS_FATO = [
    "evento_id",
    "cobli_id",
    "tipo_evento",
    "driver_id_cobli",
    "driver_name_cobli",
    "cod_colaborador",
    "nome_exibicao",
    "metodo_identificacao",
    "situacao_motorista",
    "situacao_vinculo_evento",
    "vehicle_id_cobli",
    "placa",
    "marca",
    "modelo",
    "alias_veiculo",
    "coligada",
    "secao_rm",
    "inicio",
    "fim",
    "data_evento",
    "ano_evento",
    "mes_evento",
    "distancia_km",
    "duracao_viagem_min",
    "duracao_parada_min",
    "marcha_lenta_min",
    "latitude_inicio",
    "longitude_inicio",
    "latitude_fim",
    "longitude_fim",
    "janela_inicio",
    "janela_fim",
    "extraido_em_utc",
]


def localizar_bronze():

    selecionado = os.getenv(
        "COBLI_BRONZE_TRIPS_STOPS",
        "",
    ).strip()

    if selecionado:
        pasta = PASTA_BRONZE.resolve()
        candidato = (pasta / selecionado).resolve()

        if candidato.parent != pasta:
            raise RuntimeError(
                "Bronze selecionada fora da pasta permitida."
            )

        if not (
            candidato.name.startswith("cobli_trips_stops_")
            and candidato.suffix == ".json"
            and candidato.is_file()
        ):
            raise RuntimeError(
                "Bronze selecionada invalida ou inexistente."
            )

        return candidato

    arquivos = sorted(
        PASTA_BRONZE.glob(
            "cobli_trips_stops_*.json"
        ),
        key=lambda p:
            p.stat().st_mtime,
        reverse=True,
    )

    if not arquivos:
        raise RuntimeError(
            "Bronze trips-and-stops "
            "nao encontrada."
        )

    return arquivos[0]


def carregar_bronze():

    arquivo = localizar_bronze()

    dados = json.loads(
        arquivo.read_text(
            encoding="utf-8-sig"
        )
    )

    obrigatorios = [
        "janela_inicio",
        "janela_fim",
        "extraido_em_utc",
    ]

    faltantes = [
        campo
        for campo in obrigatorios
        if not dados.get(campo)
    ]

    if faltantes:
        raise RuntimeError(
            "Bronze sem metadados: "
            + ", ".join(faltantes)
        )

    return arquivo, dados


def carregar_csv(
    arquivo,
    descricao,
):

    if not arquivo.exists():
        raise RuntimeError(
            f"{descricao} nao encontrado."
        )

    return pd.read_csv(
        arquivo,
        sep=";",
        dtype=str,
        encoding="utf-8-sig",
    ).fillna("")


def numero_ou_none(valor):

    texto = str(
        valor or ""
    ).strip()

    if not texto:
        return None

    return float(texto)


def inteiro_ou_none(valor):

    texto = str(
        valor or ""
    ).strip()

    if not texto:
        return None

    return int(
        float(texto)
    )


def texto_ou_none(valor):

    texto = str(
        valor or ""
    ).strip()

    if not texto:
        return None

    return texto


def texto_identidade(valor):

    if valor is None:
        return ""

    return str(
        valor
    ).strip()


def numero_identidade(valor):

    if valor is None:
        return None

    try:

        return float(
            valor
        )

    except (
        TypeError,
        ValueError,
    ):

        return None


def hash_identidade_evento(
    registro,
):

    canonico = json.dumps(
        registro,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )

    return hashlib.sha256(
        canonico.encode(
            "utf-8"
        )
    ).hexdigest()


def validar_bronze_prata(
    bronze,
    viagens,
):

    rows = (
        bronze
        .get(
            "payload",
            {},
        )
        .get(
            "data",
            {},
        )
        .get(
            "rows",
            [],
        )
    )

    if not isinstance(
        rows,
        list,
    ):

        raise RuntimeError(
            "Bronze sem payload.data.rows "
            "em formato de lista."
        )

    ids_esperados = []

    for registro in rows:

        if not isinstance(
            registro,
            dict,
        ):

            raise RuntimeError(
                "Registro invalido na Bronze."
            )

        vehicle = registro.get(
            "vehicle"
        )

        if not isinstance(
            vehicle,
            dict,
        ):

            vehicle = {}

        vehicle_id = texto_identidade(
            vehicle.get(
                "id"
            )
        )

        if not vehicle_id:

            raise RuntimeError(
                "Evento Bronze sem vehicle.id."
            )

        distancia = numero_identidade(
            registro.get(
                "driven_distance_in_kms"
            )
        )

        duracao_viagem = (
            numero_identidade(
                registro.get(
                    "trip_duration_in_minutes"
                )
            )
        )

        if (
            distancia is not None
            or duracao_viagem is not None
        ):

            tipo_evento = "VIAGEM"

        else:

            tipo_evento = "PARADA"

        inicio = texto_identidade(
            registro.get(
                "start_time"
            )
        )

        fim = texto_identidade(
            registro.get(
                "end_time"
            )
        )

        if not inicio and not fim:

            raise RuntimeError(
                "Evento Bronze sem "
                "start_time e end_time."
            )

        evento_id = (
            hash_identidade_evento(
                {
                    "vehicle_id_cobli":
                        vehicle_id,

                    "inicio":
                        inicio,

                    "fim":
                        fim,

                    "tipo_evento":
                        tipo_evento,
                }
            )
        )

        ids_esperados.append(
            evento_id
        )

    if (
        len(ids_esperados)
        != len(viagens)
    ):

        raise RuntimeError(
            "Bronze e Prata possuem "
            "quantidades diferentes. "
            f"Bronze={len(ids_esperados)}, "
            f"Prata={len(viagens)}."
        )

    if (
        len(ids_esperados)
        != len(
            set(
                ids_esperados
            )
        )
    ):

        raise RuntimeError(
            "Bronze produz evento_id "
            "duplicado pela chave natural."
        )

    ids_prata = (
        viagens[
            "evento_id"
        ]
        .astype(str)
        .str.strip()
        .tolist()
    )

    if any(
        not evento_id
        for evento_id in ids_prata
    ):

        raise RuntimeError(
            "Prata possui evento_id vazio."
        )

    esperados = set(
        ids_esperados
    )

    recebidos = set(
        ids_prata
    )

    if esperados != recebidos:

        faltantes = len(
            esperados
            - recebidos
        )

        extras = len(
            recebidos
            - esperados
        )

        raise RuntimeError(
            "Bronze e Prata nao correspondem. "
            f"IDs ausentes na Prata={faltantes}; "
            f"IDs extras na Prata={extras}. "
            "Regere a Prata antes de publicar."
        )

    print(
        "Vinculo Bronze x Prata: APROVADO"
    )


def preparar():

    bronze_arquivo, bronze = (
        carregar_bronze()
    )

    viagens = carregar_csv(
        ARQUIVO_VIAGENS,
        "Prata motorista_veiculo.csv",
    )

    motoristas = carregar_csv(
        ARQUIVO_MOTORISTAS,
        "Prata motoristas.csv",
    )


    if viagens.empty:
        raise RuntimeError(
            "Prata de viagens vazia."
        )


    if viagens[
        "evento_id"
    ].duplicated().any():

        raise RuntimeError(
            "evento_id duplicado "
            "na Prata."
        )


    validar_bronze_prata(
        bronze,
        viagens,
    )

    cadastro = (
        motoristas[
            [
                "driver_id_cobli",
                "coligada",
                "secao_rm",
            ]
        ]
        .copy()
    )


    cadastro = cadastro[
        cadastro[
            "driver_id_cobli"
        ].ne("")
    ]


    if cadastro[
        "driver_id_cobli"
    ].duplicated().any():

        raise RuntimeError(
            "driver_id_cobli duplicado "
            "em motoristas.csv."
        )


    viagens = viagens.merge(
        cadastro,
        on="driver_id_cobli",
        how="left",
        validate="many_to_one",
    )


    viagens[
        "coligada"
    ] = (
        viagens[
            "coligada"
        ]
        .fillna("")
    )


    viagens[
        "secao_rm"
    ] = (
        viagens[
            "secao_rm"
        ]
        .fillna("")
    )


    viagens[
        "janela_inicio"
    ] = bronze[
        "janela_inicio"
    ]

    viagens[
        "janela_fim"
    ] = bronze[
        "janela_fim"
    ]

    viagens[
        "extraido_em_utc"
    ] = bronze[
        "extraido_em_utc"
    ]


    chaves_naturais = (
        viagens[
            [
                "vehicle_id_cobli",
                "inicio",
                "fim",
                "tipo_evento",
            ]
        ]
        .astype(str)
        .agg(
            "|".join,
            axis=1,
        )
    )


    if chaves_naturais.duplicated().any():

        raise RuntimeError(
            "Chave natural duplicada "
            "na Prata."
        )


    registros = []


    campos_float = {
        "distancia_km",
        "duracao_viagem_min",
        "duracao_parada_min",
        "marcha_lenta_min",
        "latitude_inicio",
        "longitude_inicio",
        "latitude_fim",
        "longitude_fim",
    }


    campos_int = {
        "ano_evento",
        "mes_evento",
    }


    for registro in (
        viagens[
            COLUNAS_FATO
        ]
        .to_dict(
            orient="records"
        )
    ):

        saida = {}

        for coluna in COLUNAS_FATO:

            valor = registro.get(
                coluna
            )

            if coluna in campos_float:

                saida[
                    coluna
                ] = numero_ou_none(
                    valor
                )

            elif coluna in campos_int:

                saida[
                    coluna
                ] = inteiro_ou_none(
                    valor
                )

            else:

                saida[
                    coluna
                ] = texto_ou_none(
                    valor
                )

        registros.append(
            saida
        )


    print(
        "Bronze:",
        bronze_arquivo.name,
    )

    print(
        "Janela:",
        bronze[
            "janela_inicio"
        ],
        "->",
        bronze[
            "janela_fim"
        ],
    )

    print(
        "Registros preparados:",
        len(registros),
    )

    print(
        "Viagens:",
        int(
            viagens[
                "tipo_evento"
            ]
            .eq("VIAGEM")
            .sum()
        ),
    )

    print(
        "Paradas:",
        int(
            viagens[
                "tipo_evento"
            ]
            .eq("PARADA")
            .sum()
        ),
    )

    print(
        "Com motorista:",
        int(
            viagens[
                "driver_id_cobli"
            ]
            .ne("")
            .sum()
        ),
    )

    print(
        "Sem motorista:",
        int(
            viagens[
                "driver_id_cobli"
            ]
            .eq("")
            .sum()
        ),
    )

    print(
        "Com coligada:",
        int(
            viagens[
                "coligada"
            ]
            .ne("")
            .sum()
        ),
    )

    print(
        "Com secao:",
        int(
            viagens[
                "secao_rm"
            ]
            .ne("")
            .sum()
        ),
    )

    print(
        "Sem local inicial:",
        int(
            viagens[
                "latitude_inicio"
            ]
            .eq("")
            .sum()
        ),
    )

    print(
        "Sem local final:",
        int(
            viagens[
                "latitude_fim"
            ]
            .eq("")
            .sum()
        ),
    )


    return registros


def carregar_configuracao():

    load_dotenv(
        ROOT
        / ".env"
    )

    url = os.getenv(
        "SUPABASE_URL"
    )

    secret = os.getenv(
        "SUPABASE_SECRET_KEY"
    )

    if not url:
        raise RuntimeError(
            "SUPABASE_URL nao encontrada."
        )

    if not secret:
        raise RuntimeError(
            "SUPABASE_SECRET_KEY nao encontrada."
        )

    return url, secret


def validar_autorizacao_hml():
    """Exige credenciais EXCLUSIVAS de HML, nunca o .env de producao."""
    if os.getenv("SSO_HISTORICO_PUBLICACAO_HML_AUTORIZADA") != "SIM":
        raise RuntimeError("Publicacao HML nao autorizada.")

    url = (os.getenv("SSO_HML_URL") or "").strip()
    chave = (os.getenv("SSO_HML_KEY") or "").strip()
    if not url or not chave:
        raise RuntimeError("Defina SSO_HML_URL e SSO_HML_KEY no ambiente.")

    analise = urlparse(url)
    if (analise.scheme != "https" or analise.hostname !=
            f"{HML_PROJECT_REF}.supabase.co"):
        raise RuntimeError("URL nao pertence a HML aprovada.")
    if (analise.port is not None or analise.username or analise.password or
            analise.path not in ("", "/") or analise.query or analise.fragment):
        raise RuntimeError("URL da HML possui componentes inesperados.")
    return url, chave



def validar_autorizacao_producao():
    """Producao: liberacao dupla, projeto exato, nenhum fallback para HML."""
    if os.getenv("SSO_HISTORICO_CONTRATO_PROD_APROVADO") != "SIM":
        raise RuntimeError("Contrato incremental de producao ainda nao aprovado.")
    if os.getenv("SSO_HISTORICO_PRODUCAO_AUTORIZADA") != "SIM":
        raise RuntimeError("Publicacao do Historico em producao nao autorizada.")

    load_dotenv(ROOT / ".env", override=False)
    url = (os.getenv("SUPABASE_URL") or "").strip()
    chave = (os.getenv("SUPABASE_SECRET_KEY") or "").strip()
    if not url or not chave:
        raise RuntimeError("Credenciais de producao nao configuradas.")
    parsed = urlparse(url)
    if (parsed.scheme != "https" or parsed.hostname !=
            f"{PROD_PROJECT_REF}.supabase.co" or parsed.port is not None or
            parsed.username or parsed.password or parsed.path not in ("", "/") or
            parsed.query or parsed.fragment):
        raise RuntimeError("SUPABASE_URL nao corresponde ao projeto de producao aprovado.")
    return url, chave


def verificar_ambiente_producao():
    """Preflight somente leitura; NAO chama RPC nem escreve em staging."""
    url, chave = validar_autorizacao_producao()
    cliente = create_client(url, chave)
    resposta = (cliente.table(TABELA_STAGING)
                .select("carga_id", count="exact").limit(1).execute())
    if resposta.count is None:
        raise RuntimeError("Contagem da staging de producao indisponivel.")
    if int(resposta.count) != 0:
        raise RuntimeError("Staging do Historico de producao nao esta vazia; reconciliar antes de executar.")
    print("PREFLIGHT HISTORICO PROD: staging acessivel e vazia; SEM ESCRITA")
    print("ATENCAO: a existencia/ACL da RPC deve ser aprovada no rollout especifico.")


def validar_contrato_local(registros):
    if not registros:
        raise RuntimeError("Historico local vazio.")
    ids = [r.get("evento_id") for r in registros]
    if any(not isinstance(v, str) or len(v) != 64 or
           any(c not in "0123456789abcdef" for c in v) for v in ids):
        raise RuntimeError("evento_id invalido ou sem SHA256 hex.")
    if len(set(ids)) != len(ids):
        raise RuntimeError("evento_id duplicado na carga.")
    if any(set(r) != set(COLUNAS_FATO) for r in registros):
        raise RuntimeError("Contrato de colunas do Historico divergente.")
    for r in registros:
        chave_natural_rpc(r)  # valida intervalos e campos da chave


def normalizar_timestamp(valor):
    """Normaliza somente timestamps locais sem fuso (schema HML timestamp naive)."""
    if valor is None or str(valor).strip() == "":
        return None
    try:
        data = datetime.fromisoformat(str(valor).strip())
    except (ValueError, TypeError) as erro:
        raise RuntimeError("Timestamp historico invalido.") from erro
    if data.tzinfo is not None:
        raise RuntimeError("Timestamp historico contem fuso inesperado.")
    return data.isoformat(timespec="microseconds")


def chave_identidade_temporal(registro):
    veiculo = str(registro.get("vehicle_id_cobli") or "").strip()
    tipo = str(registro.get("tipo_evento") or "").strip()
    if not veiculo or tipo not in ("VIAGEM", "PARADA"):
        raise RuntimeError("Registro com chave temporal incompleta.")
    inicio = normalizar_timestamp(registro.get("inicio"))
    fim = normalizar_timestamp(registro.get("fim"))
    if tipo == "VIAGEM" and inicio is None:
        raise RuntimeError("Viagem sem inicio.")
    if tipo == "PARADA" and fim is None:
        raise RuntimeError("Parada sem fim.")
    if inicio is not None and fim is not None and fim < inicio:
        raise RuntimeError("Intervalo invertido.")
    return (veiculo, tipo, inicio, fim)


def chave_natural_rpc(registro):
    """Identidade operacional usada pela RPC existente em HML."""
    veiculo, tipo, inicio, fim = chave_identidade_temporal(registro)
    return (veiculo, tipo, inicio if tipo == "VIAGEM" else fim)


def consultar_historico_hml(cliente):
    """Leitura paginada; nunca assume que a API devolve tudo em uma pagina."""
    remoto = {}
    colunas = "evento_id,vehicle_id_cobli,tipo_evento,inicio,fim"
    for pagina in range(MAX_PAGINAS_HISTORICO):
        inicio = pagina * TAMANHO_LOTE
        resposta = (cliente.table(TABELA)
                    .select(colunas)
                    .order("evento_id")
                    .range(inicio, inicio + TAMANHO_LOTE - 1)
                    .execute())
        dados = resposta.data
        if not isinstance(dados, list):
            raise RuntimeError("Leitura da tabela historica invalida.")
        for linha in dados:
            eid = str(linha.get("evento_id") or "").strip()
            if not eid or eid in remoto:
                raise RuntimeError("Identidade remota invalida ou duplicada.")
            remoto[eid] = linha
        if len(dados) < TAMANHO_LOTE:
            return remoto
    raise RuntimeError("Limite de paginacao da HML atingido; nao publicar.")


def separar_ineditos(registros, remoto):
    """Pula eventos existentes sem alterar historico; aborta se houver conflito."""
    chaves_remotas = {}
    for eid, linha in remoto.items():
        chave = chave_natural_rpc(linha)
        if chave in chaves_remotas and chaves_remotas[chave] != eid:
            raise RuntimeError("Historico remoto apresenta chave natural ambigua.")
        chaves_remotas[chave] = eid

    novos = []
    existentes = 0
    chaves_lote = set()
    for registro in registros:
        eid = registro["evento_id"]
        chave = chave_natural_rpc(registro)
        if chave in chaves_lote:
            raise RuntimeError("Chave natural duplicada na preparacao.")
        chaves_lote.add(chave)

        if eid in remoto:
            if chave_identidade_temporal(remoto[eid]) != chave_identidade_temporal(registro):
                raise RuntimeError("Mesmo evento_id com identidade temporal divergente.")
            existentes += 1
            continue

        if chave in chaves_remotas:
            raise RuntimeError("Chave natural ja existente com evento_id diferente.")
        novos.append(registro)

    return novos, existentes


def publicar_hml(registros):
    """PROPOSTA DE REVISAO: escrita somente em HML, ainda nao executar."""
    validar_contrato_local(registros)
    url, chave = validar_autorizacao_hml()  # nunca usa .env de producao
    if not os.getenv("COBLI_BRONZE_TRIPS_STOPS", "").strip():
        raise RuntimeError("Selecione explicitamente COBLI_BRONZE_TRIPS_STOPS.")
    cliente = create_client(url, chave)
    remoto = consultar_historico_hml(cliente)
    novos, existentes = separar_ineditos(registros, remoto)
    total_antes = len(remoto)

    print("HML: existentes no lote=", existentes,
          "novos=", len(novos), "historico inicial=", total_antes)
    if not novos:
        print("NENHUM EVENTO NOVO: nenhuma escrita realizada.")
        return {"total_antes": total_antes,
                "inseridos": 0, "total_depois": total_antes,
                "historicos_atualizados": 0}

    carga_id = str(uuid.uuid4())
    print("Carga de HML proposta:", carga_id)
    try:
        for inicio in range(0, len(novos), TAMANHO_LOTE):
            bloco = [{"carga_id": carga_id,
                      "evento_id": registro["evento_id"],
                      "dados": registro}
                     for registro in novos[inicio:inicio + TAMANHO_LOTE]]
            cliente.table(TABELA_STAGING).insert(bloco).execute()

        # Contrato JA IMPLANTADO: (uuid, integer, integer) -> jsonb.
        resposta = cliente.rpc(
            RPC_PROMOVER_HISTORICO,
            {"p_carga_id": carga_id,
             "p_quantidade": len(novos),
             "p_total_inicial": total_antes},
        ).execute()
    except Exception as erro:
        raise RuntimeError(
            "Envio ou promocao HML com estado indeterminado: "
            f"carga_id={carga_id}. Reconciliar HML antes de nova tentativa; "
            "nao apagar staging automaticamente."
        ) from erro

    resultado = resposta.data
    if not isinstance(resultado, dict) or (
            resultado.get("total_antes") != total_antes or
            resultado.get("inseridos") != len(novos) or
            resultado.get("total_depois") != total_antes + len(novos) or
            resultado.get("historicos_atualizados") != 0):
        raise RuntimeError(
            "Resposta RPC divergente. Conferir estado remoto antes de tentar "
            f"novamente. carga_id={carga_id}"
        )
    print("PROMOCAO HML CONFERIDA:",
          {"total_antes": total_antes, "inseridos": len(novos),
           "total_depois": resultado["total_depois"]})
    return resultado



def publicar_producao(registros):
    """Mesma politica de insercao-only de HML, com isolamento de credenciais."""
    validar_contrato_local(registros)
    url, chave = validar_autorizacao_producao()
    if not os.getenv("COBLI_BRONZE_TRIPS_STOPS", "").strip():
        raise RuntimeError("Bronze Cobli desta execucao deve ser explicitamente selecionada.")
    cliente = create_client(url, chave)
    remoto = consultar_historico_hml(cliente)
    novos, existentes = separar_ineditos(registros, remoto)
    total_antes = len(remoto)
    print("PRODUCAO: existentes no lote=", existentes,
          "novos=", len(novos), "historico inicial=", total_antes)
    if not novos:
        print("HISTORICO JA ATUALIZADO: nenhuma escrita realizada.")
        return {"total_antes": total_antes, "inseridos": 0,
                "total_depois": total_antes, "historicos_atualizados": 0}
    carga_id = str(uuid.uuid4())
    print("Carga Historico PRODUCAO:", carga_id)
    try:
        for inicio in range(0, len(novos), TAMANHO_LOTE):
            bloco = [{"carga_id": carga_id,
                      "evento_id": registro["evento_id"],
                      "dados": registro}
                     for registro in novos[inicio:inicio + TAMANHO_LOTE]]
            cliente.table(TABELA_STAGING).insert(bloco).execute()
        resposta = cliente.rpc(
            RPC_PROMOVER_HISTORICO,
            {"p_carga_id": carga_id, "p_quantidade": len(novos),
             "p_total_inicial": total_antes}
        ).execute()
    except Exception as erro:
        raise RuntimeError(
            "Envio ou promocao PROD com estado INDETERMINADO: "
            f"carga_id={carga_id}. Nao repetir automaticamente; reconciliar "+
            "Historico e staging antes de nova tentativa."
        ) from erro
    resultado = resposta.data
    if not isinstance(resultado, dict) or (
            resultado.get("total_antes") != total_antes or
            resultado.get("inseridos") != len(novos) or
            resultado.get("total_depois") != total_antes + len(novos) or
            resultado.get("historicos_atualizados") != 0):
        raise RuntimeError("RPC PROD retornou contagens divergentes; "
                           f"reconciliar antes de reexecutar. carga_id={carga_id}")
    print("PROMOCAO HISTORICO PROD CONFIRMADA:", resultado)
    return resultado


def main():

    parser = argparse.ArgumentParser(
        description=(
            "Publica o historico "
            "incremental de Motoristas."
        )
    )

    modos = parser.add_mutually_exclusive_group(required=True)
    modos.add_argument(
        "--local-only",
        action="store_true",
        help="Prepara e valida localmente, sem conectar ao Supabase.",
    )
    modos.add_argument(
        "--publicar-hml",
        action="store_true",
        help="PROPOSTA: reutiliza RPC existente da HML; exige autorizacao.",
    )

    modos.add_argument(
        "--publicar-producao", action="store_true",
        help="Exige contrato implantado, autorizacao e URL exata de producao.",
    )
    modos.add_argument(
        "--verificar-ambiente-prod", action="store_true",
        help="Verificacao exclusivamente de leitura; falha fechado se nao autorizado.",
    )

    args = parser.parse_args()


    print(
        "=" * 78
    )

    print(
        "HISTORICO MOTORISTAS - VIAGENS"
    )

    print(
        "=" * 78
    )


    if args.verificar_ambiente_prod:
        verificar_ambiente_producao()
        return

    # Bloqueia antes de preparar dados se o ambiente nao foi autorizado.
    if args.publicar_producao:
        validar_autorizacao_producao()
        if not os.getenv("COBLI_BRONZE_TRIPS_STOPS", "").strip():
            raise RuntimeError("Selecione explicitamente uma Bronze de producao.")
    if args.publicar_hml:
        validar_autorizacao_hml()
        if not os.getenv("COBLI_BRONZE_TRIPS_STOPS", "").strip():
            raise RuntimeError("Selecione uma Bronze explicita para HML.")

    registros = preparar()


    if args.local_only:

        print()

        print(
            "=" * 78
        )

        print(
            "VALIDACAO LOCAL: APROVADA"
        )

        print(
            "=" * 78
        )

        print(
            "Nenhuma conexao com "
            "Supabase foi realizada."
        )

        return

    if args.publicar_hml:
        publicar_hml(registros)
    if args.publicar_producao:
        publicar_producao(registros)


if __name__ == "__main__":

    try:

        main()

    except Exception as erro:

        print(
            f"ERRO: {erro}",
            file=sys.stderr,
        )

        sys.exit(1)
