-- =========================================================
-- CORRECAO DA PROMOCAO ATOMICA - MART INSPECOES
--
-- Motivo:
-- safeupdate exige clausula WHERE no DELETE.
--
-- id_resposta e PRIMARY KEY e, portanto, NOT NULL.
-- O predicado abaixo continua removendo todo o snapshot
-- anterior antes da insercao da nova carga.
-- =========================================================

create or replace function
public.promover_mart_inspecoes(
    p_carga_id uuid,
    p_quantidade_esperada integer
)
returns integer

language plpgsql

security definer

set search_path =
    pg_catalog,
    public

as $$

declare

    v_staging integer;

    v_publicado integer;

begin

    if p_carga_id is null then

        raise exception
            'carga_id nao pode ser nulo.';

    end if;


    if (
        p_quantidade_esperada
        is null
        or p_quantidade_esperada <= 0
    ) then

        raise exception
            'quantidade esperada invalida: %',
            p_quantidade_esperada;

    end if;


    select count(*)
    into v_staging
    from public.stg_mart_inspecoes
    where carga_id = p_carga_id;


    if v_staging = 0 then

        raise exception
            'Nenhum registro encontrado '
            'na staging para carga_id %.',
            p_carga_id;

    end if;


    if (
        v_staging
        <> p_quantidade_esperada
    ) then

        raise exception
            'Quantidade da staging (%) '
            'difere da esperada (%).',
            v_staging,
            p_quantidade_esperada;

    end if;


    -- Impede duas promocoes simultaneas
    -- da mesma MART.

    lock table
        public.mart_inspecoes
    in exclusive mode;


    delete
    from public.mart_inspecoes
    where id_resposta is not null;


    insert into public.mart_inspecoes (

        id_resposta,
        nome_formulario,
        contrato,
        data_inspecao,
        area_organizacional,
        local,
        empresa_inspecao,
        estado_plano_acao,
        acoes_corretivas_atrasadas,
        cod_colaborador,
        status_vinculo_colaborador,
        nome_exibicao,
        cargo_colaborador,
        setor_colaborador,
        empresa_colaborador,
        data_atualizacao

    )

    select

        id_resposta,
        nome_formulario,
        contrato,
        data_inspecao,
        area_organizacional,
        local,
        empresa_inspecao,
        estado_plano_acao,
        acoes_corretivas_atrasadas,
        cod_colaborador,
        status_vinculo_colaborador,
        nome_exibicao,
        cargo_colaborador,
        setor_colaborador,
        empresa_colaborador,
        data_atualizacao

    from public.stg_mart_inspecoes

    where carga_id = p_carga_id;


    select count(*)
    into v_publicado
    from public.mart_inspecoes;


    if (
        v_publicado
        <> p_quantidade_esperada
    ) then

        raise exception
            'Quantidade publicada (%) '
            'difere da esperada (%).',
            v_publicado,
            p_quantidade_esperada;

    end if;


    return v_publicado;

end;

$$;


-- =========================================================
-- SEGURANCA DA RPC
-- =========================================================

revoke all
on function public.promover_mart_inspecoes(
    uuid,
    integer
)
from public, anon, authenticated;


grant execute
on function public.promover_mart_inspecoes(
    uuid,
    integer
)
to service_role;
