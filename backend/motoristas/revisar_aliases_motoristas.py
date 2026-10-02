from pathlib import Path
import json
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]

REVISAO = (
    ROOT
    / "data"
    / "prata"
    / "motoristas"
    / "revisao_nomes_motoristas.csv"
)

MAPA = (
    ROOT
    / "data"
    / "master"
    / "colaboradores"
    / "mapa_colaboradores.csv"
)

ALIASES = (
    ROOT
    / "backend"
    / "motoristas"
    / "config"
    / "aliases_motoristas_cobli.json"
)


def carregar():
    if not REVISAO.exists():
        raise RuntimeError(
            "Arquivo de revisao nao encontrado."
        )

    if not MAPA.exists():
        raise RuntimeError(
            "Mapa de colaboradores nao encontrado."
        )

    revisao = pd.read_csv(
        REVISAO,
        sep=";",
        dtype=str,
        encoding="utf-8-sig",
    ).fillna("")

    mapa = pd.read_csv(
        MAPA,
        sep=";",
        dtype=str,
        encoding="utf-8-sig",
    ).fillna("")

    if ALIASES.exists():
        dados = json.loads(
            ALIASES.read_text(
                encoding="utf-8-sig"
            )
        )
    else:
        dados = {
            "aliases": []
        }

    return (
        revisao,
        mapa,
        dados,
    )


def salvar_aliases(aliases):
    ALIASES.write_text(
        json.dumps(
            {
                "aliases": aliases
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def main():
    (
        revisao,
        mapa,
        dados,
    ) = carregar()

    aliases = dados.get(
        "aliases",
        [],
    )

    origens_existentes = {
        str(
            item.get(
                "nome_cobli",
                ""
            )
        )
        .strip()
        .upper()
        for item in aliases
    }

    aprovados = 0
    mantidos = 0

    grupos = revisao.groupby(
        [
            "driver_id_cobli",
            "nome_cobli",
        ],
        sort=False,
    )

    for (
        driver_id,
        nome_cobli,
    ), grupo in grupos:

        origem_norm = (
            nome_cobli
            .strip()
            .upper()
        )

        if origem_norm in origens_existentes:
            print()
            print(
                "Alias ja existe para:",
                nome_cobli,
            )
            continue

        grupo = grupo.sort_values(
            "posicao_candidato"
        )

        print()
        print("=" * 80)
        print("MOTORISTA COBLI")
        print("=" * 80)
        print(nome_cobli)
        print()

        for _, linha in grupo.iterrows():
            print(
                f"[{linha['posicao_candidato']}] "
                f"{linha['nome_exibicao_rm']} "
                f"- similaridade "
                f"{linha['similaridade_pct']}%"
            )

        print(
            "[0] Nenhum candidato correto"
        )

        while True:
            escolha = input(
                "Escolha: "
            ).strip()

            if escolha in {
                "0",
                "1",
                "2",
                "3",
                "4",
                "5",
            }:
                break

            print(
                "Digite 0, 1, 2, 3, 4 ou 5."
            )

        if escolha == "0":
            print(
                "Mantido como NAO_RESOLVIDO."
            )

            mantidos += 1
            continue

        candidato = grupo[
            grupo[
                "posicao_candidato"
            ]
            == escolha
        ]

        if candidato.empty:
            raise RuntimeError(
                "Candidato selecionado "
                "nao encontrado."
            )

        candidato = candidato.iloc[0]

        nome_norm_rm = candidato[
            "nome_normalizado_rm"
        ]

        pessoa_rm = mapa[
            mapa[
                "nome_normalizado"
            ]
            == nome_norm_rm
        ]

        if len(pessoa_rm) != 1:
            raise RuntimeError(
                "Candidato RM nao e unico "
                "no mapa."
            )

        nome_completo_rm = (
            pessoa_rm.iloc[0][
                "nome_completo_rm"
            ]
        )

        print()
        confirma = input(
            "Confirmar este alias? "
            "[S/N]: "
        ).strip().upper()

        if confirma != "S":
            print(
                "Alias nao gravado."
            )
            mantidos += 1
            continue

        aliases.append(
            {
                "nome_cobli":
                    nome_cobli,
                "nome_rm":
                    nome_completo_rm,
            }
        )

        origens_existentes.add(
            origem_norm
        )

        salvar_aliases(
            aliases
        )

        aprovados += 1

        print(
            "Alias gravado com sucesso."
        )

    print()
    print("=" * 80)
    print("REVISAO CONCLUIDA")
    print("=" * 80)

    print(
        "Aliases aprovados:",
        aprovados,
    )

    print(
        "Mantidos sem correspondencia:",
        mantidos,
    )

    print(
        "Total de aliases:",
        len(aliases),
    )

    print(
        "Arquivo:",
        ALIASES,
    )


if __name__ == "__main__":
    main()
