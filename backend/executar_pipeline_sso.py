from pathlib import Path
import os
import shutil
import subprocess
import sys
import uuid


RAIZ = Path(
    __file__
).resolve().parents[1]

DATA = RAIZ / "data"


ETAPAS = [
    (
        "COLABORADORES - EXTRACAO RM",
        RAIZ
        / "backend"
        / "cadastros"
        / "colaboradores"
        / "extrair_colaboradores.py",
    ),
    (
        "COLABORADORES - MAPA MESTRE",
        RAIZ
        / "backend"
        / "cadastros"
        / "colaboradores"
        / "gerar_mapa_colaboradores.py",
    ),
    (
        "MOTORISTAS - EXTRACAO CADASTRO COBLI",
        RAIZ
        / "backend"
        / "motoristas"
        / "extrair_cobli_motoristas.py",
    ),
    (
        "MOTORISTAS - CAMADA PRATA CADASTRO",
        RAIZ
        / "backend"
        / "motoristas"
        / "tratar_motoristas.py",
    ),
    (
        "MOTORISTAS - QUALITY GATE CADASTRO",
        RAIZ
        / "backend"
        / "motoristas"
        / "validar_prata_motoristas.py",
    ),
    (
        "MOTORISTAS - EXTRACOES COBLI SINCRONIZADAS",
        RAIZ
        / "backend"
        / "motoristas"
        / "executar_extracoes_cobli_sincronizadas.py",
    ),
    (
        "MOTORISTAS - CAMADA PRATA VIAGENS",
        RAIZ
        / "backend"
        / "motoristas"
        / "tratar_motorista_veiculo.py",
    ),
    (
        "MOTORISTAS - QUALITY GATE VIAGENS",
        RAIZ
        / "backend"
        / "motoristas"
        / "validar_prata_motorista_veiculo.py",
    ),
    (
        "MOTORISTAS - CAMADA PRATA SEGURANCA",
        RAIZ
        / "backend"
        / "motoristas"
        / "tratar_seguranca_motoristas.py",
    ),
    (
        "MOTORISTAS - QUALITY GATE SEGURANCA",
        RAIZ
        / "backend"
        / "motoristas"
        / "validar_prata_seguranca_motoristas.py",
    ),
    (
        "MOTORISTAS - CAMADA OURO",
        RAIZ
        / "backend"
        / "motoristas"
        / "gerar_ouro_motoristas.py",
    ),
    (
        "PREVSYS - EXTRACOES",
        RAIZ
        / "backend"
        / "prevsys"
        / "extrair_prevsys.py",
    ),
    (
        "INSPECOES - CAMADA PRATA",
        RAIZ
        / "backend"
        / "inspecoes"
        / "tratar_quantidade.py",
    ),
    (
        "INSPECOES - CAMADA OURO",
        RAIZ
        / "backend"
        / "inspecoes"
        / "gerar_ouro_inspecoes.py",
    ),
    (
        "AVCB - EXTRACAO",
        RAIZ
        / "backend"
        / "avcb"
        / "extrair_avcb.py",
    ),
    (
        "AVCB - QUALITY GATE BRONZE",
        RAIZ
        / "backend"
        / "avcb"
        / "validar_qualidade.py",
    ),
    (
        "AVCB - CAMADA PRATA",
        RAIZ
        / "backend"
        / "avcb"
        / "tratar_avcb.py",
    ),
    (
        "AVCB - CAMADA OURO",
        RAIZ
        / "backend"
        / "avcb"
        / "gerar_ouro_avcb.py",
    ),
    (
        "PLANOS DE ACAO - CAMADA PRATA",
        RAIZ
        / "backend"
        / "planos_acao"
        / "tratar_planos_acao.py",
    ),
    (
        "PLANOS DE ACAO - CAMADA OURO",
        RAIZ
        / "backend"
        / "planos_acao"
        / "gerar_ouro_planos_acao.py",
    ),
    (
        "PUBLICACAO GLOBAL ATOMICA",
        RAIZ
        / "backend"
        / "publicar_pipeline_sso.py",
    ),
]


def executar_etapa(
    numero,
    total,
    nome,
    script,
):

    print()
    print("=" * 78)
    print(
        f"ETAPA {numero}/{total} - {nome}"
    )
    print("=" * 78)

    if not script.exists():

        raise RuntimeError(
            "Script nao encontrado: "
            f"{script}"
        )

    resultado = subprocess.run(
        [
            sys.executable,
            str(script),
        ],
        cwd=RAIZ,
    )

    if resultado.returncode != 0:

        raise RuntimeError(
            f"Etapa falhou: {nome}. "
            f"Codigo: {resultado.returncode}"
        )

    print()
    print(
        f"ETAPA APROVADA: {nome}"
    )


ARQUIVOS_OPERACIONAIS = [
    Path(
        r"prata\motoristas\motoristas.csv"
    ),
    Path(
        r"prata\motoristas\revisao_nomes_motoristas.csv"
    ),
    Path(
        r"prata\motoristas\motorista_veiculo.csv"
    ),
    Path(
        r"prata\motoristas\seguranca_motoristas.csv"
    ),
    Path(
        r"ouro\motoristas\mart_motoristas.xlsx"
    ),
    Path(
        r"bronze\avcb\Controle de AVCB.xlsx"
    ),
    Path(
        r"bronze\cadastros\colaboradores"
        r"\Colaboradores_RM.xlsx"
    ),
    Path(
        r"bronze\cadastros\colaboradores"
        r"\Colaboradores_Folha_RM.xlsx"
    ),
    Path(
        r"bronze\inspecoes\quantidade"
        r"\Detalle_Checklist.xlsx"
    ),
    Path(
        r"master\colaboradores"
        r"\mapa_colaboradores.csv"
    ),
    Path(
        r"ouro\avcb\mart_avcb.xlsx"
    ),
    Path(
        r"ouro\inspecoes\mart_inspecoes.xlsx"
    ),
    Path(
        r"prata\avcb\avcb_prata.xlsx"
    ),
    Path(
        r"prata\inspecoes\quantidade"
        r"\criadores_para_classificar.csv"
    ),
    Path(
        r"prata\inspecoes\quantidade"
        r"\Inspecoes_Quantidade.xlsx"
    ),
    Path(
        r"bronze\planos_acao\Planos_de_acao_detalhados.xlsx"
    ),
    Path(
        r"prata\planos_acao\Planos_de_acao.xlsx"
    ),
    Path(
        r"ouro\planos_acao\mart_planos_acao.xlsx"
    ),
    Path(
        r"diagnosticos\planos_acao_dom_menu.png"
    ),
    Path(
        r"diagnosticos\planos_acao_menu.png"
    ),
    Path(
        r"diagnosticos\prevsis_detalle_nao_encontrado.png"
    ),

]


def arquivos_temporarios():

    if not DATA.exists():

        return []

    return sorted(
        arquivo
        for arquivo in DATA.rglob("*")
        if arquivo.is_file()
        and (
            arquivo.name.endswith(
                "_novo.xlsx"
            )
            or arquivo.name.endswith(
                "_novo.xls"
            )
        )
    )


def arquivos_conhecidos():

    conhecidos = {
        DATA / relativo
        for relativo in ARQUIVOS_OPERACIONAIS
    }

    conhecidos.update(
        arquivos_temporarios()
    )

    # Bronzes Cobli possuem timestamp no nome.
    # Apenas os tres contratos conhecidos de Motoristas
    # pertencem a fronteira de cleanup.

    pasta_bronze_motoristas = (
        DATA
        / "bronze"
        / "motoristas"
    )

    if pasta_bronze_motoristas.exists():

        for padrao in [
            "cobli_motoristas_*.json",
            "cobli_trips_stops_*.json",
            "cobli_safety_driver_*.json",
        ]:

            conhecidos.update(
                pasta_bronze_motoristas.glob(
                    padrao
                )
            )

    return conhecidos


def validar_fronteira_cleanup():

    if not DATA.exists():

        return

    existentes = {
        arquivo
        for arquivo in DATA.rglob("*")
        if arquivo.is_file()
    }

    conhecidos = arquivos_conhecidos()

    desconhecidos = sorted(
        existentes - conhecidos
    )

    if desconhecidos:

        raise RuntimeError(
            "Cleanup bloqueado. "
            "Arquivos desconhecidos encontrados "
            "em data/: "
            + ", ".join(
                str(
                    arquivo.relative_to(
                        RAIZ
                    )
                )
                for arquivo in desconhecidos
            )
        )


def listar_arquivos_operacionais():

    if not DATA.exists():

        return []

    validar_fronteira_cleanup()

    return sorted(
        arquivo
        for arquivo in arquivos_conhecidos()
        if arquivo.exists()
    )


def remover_pastas_vazias():

    if not DATA.exists():

        return

    pastas = sorted(
        (
            pasta
            for pasta in DATA.rglob("*")
            if pasta.is_dir()
        ),
        key=lambda pasta: len(
            pasta.parts
        ),
        reverse=True,
    )

    for pasta in pastas:

        try:

            pasta.rmdir()

        except OSError:

            pass


def limpar_dados_operacionais():

    print()
    print("=" * 78)
    print("CLEANUP LOCAL")
    print("=" * 78)

    if not DATA.exists():

        print(
            "Pasta data nao existe. "
            "Nada para remover."
        )

        return


    arquivos = (
        listar_arquivos_operacionais()
    )

    print(
        "Arquivos operacionais encontrados:",
        len(arquivos),
    )


    if not arquivos:

        print(
            "Nenhum arquivo operacional "
            "para remover."
        )

        remover_pastas_vazias()

        return


    quarentena = (
        DATA
        / (
            ".cleanup_"
            + uuid.uuid4().hex
        )
    )

    quarentena.mkdir(
        parents=True,
        exist_ok=False,
    )


    movidos = []


    try:

        print(
            "Movendo arquivos para "
            "quarentena local..."
        )

        for origem in arquivos:

            relativo = origem.relative_to(
                DATA
            )

            destino = (
                quarentena
                / relativo
            )

            destino.parent.mkdir(
                parents=True,
                exist_ok=True,
            )

            os.replace(
                origem,
                destino,
            )

            movidos.append(
                (
                    origem,
                    destino,
                )
            )


    except Exception:

        print(
            "Falha antes da exclusao. "
            "Tentando restaurar dados..."
        )

        for origem, destino in reversed(
            movidos
        ):

            if destino.exists():

                origem.parent.mkdir(
                    parents=True,
                    exist_ok=True,
                )

                os.replace(
                    destino,
                    origem,
                )

        shutil.rmtree(
            quarentena,
            ignore_errors=True,
        )

        raise


    print(
        "Excluindo dados operacionais..."
    )

    try:

        shutil.rmtree(
            quarentena
        )

    except Exception:

        print()
        print(
            "ATENCAO: publicacao global "
            "foi concluida, mas o cleanup "
            "local nao terminou."
        )

        print(
            "Verifique:",
            quarentena,
        )

        raise


    remover_pastas_vazias()


    restantes = (
        listar_arquivos_operacionais()
    )

    if restantes:

        raise RuntimeError(
            "Arquivos operacionais "
            "permaneceram apos cleanup: "
            + ", ".join(
                str(arquivo)
                for arquivo in restantes
            )
        )


    print(
        "CLEANUP LOCAL: APROVADO"
    )

    print(
        "Arquivos operacionais locais: 0"
    )

def main():

    print("=" * 78)
    print("PIPELINE SSO - EXECUCAO GLOBAL")
    print("=" * 78)

    print()
    print("=" * 78)
    print("PRE-FLIGHT - FRONTEIRA DO CLEANUP")
    print("=" * 78)

    validar_fronteira_cleanup()

    print(
        "Fronteira de dados locais: APROVADA"
    )

    total = len(
        ETAPAS
    )

    try:

        for numero, etapa in enumerate(
            ETAPAS,
            start=1,
        ):

            nome, script = etapa

            executar_etapa(
                numero,
                total,
                nome,
                script,
            )


        print()
        print("=" * 78)
        print(
            "PUBLICACAO GLOBAL VALIDADA"
        )
        print("=" * 78)

        print(
            "Todas as etapas anteriores "
            "foram aprovadas."
        )

        print(
            "Iniciando cleanup "
            "dos dados locais."
        )


        limpar_dados_operacionais()


    except Exception as erro:

        print()
        print("=" * 78)
        print(
            "PIPELINE SSO INTERROMPIDO"
        )
        print("=" * 78)

        print(
            f"Erro: {erro}"
        )

        print(
            "Se a falha ocorreu antes "
            "da publicacao global, "
            "os dados locais foram "
            "preservados."
        )

        return 1


    print()
    print("=" * 78)
    print(
        "PIPELINE SSO CONCLUIDO "
        "COM SUCESSO"
    )
    print("=" * 78)

    print(
        "Publicacao global: APROVADA"
    )

    print(
        "Cleanup local: APROVADO"
    )

    return 0


if __name__ == "__main__":

    sys.exit(
        main()
    )
