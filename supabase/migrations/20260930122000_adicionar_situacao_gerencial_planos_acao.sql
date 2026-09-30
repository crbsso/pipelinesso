begin;

-- ============================================================
-- SITUACAO GERENCIAL - PLANOS DE ACAO
-- ============================================================

alter table public.stg_mart_planos_acao
    add column if not exists situacao_gerencial text;

alter table public.mart_planos_acao
    add column if not exists situacao_gerencial text;


-- ============================================================
-- REGRA CENTRAL DE CLASSIFICACAO GERENCIAL
-- ============================================================

create or replace function
public.definir_situacao_gerencial_planos_acao()
returns trigger
language plpgsql
as $$
begin

    new.situacao_gerencial :=
        case

            when lower(
                coalesce(
                    new.estado_plano_fonte,
                    ''
                )
            ) = 'fechado após o prazo'
                then 'FECHADO_APOS_PRAZO'

            when lower(
                coalesce(
                    new.estado_plano_fonte,
                    ''
                )
            ) = 'fechado'
                then 'FECHADO_NO_PRAZO'

            when new.situacao_prazo_calculada = 'VENCIDO'
                then 'VENCIDO'

            when new.situacao_prazo_calculada in (
                'EM_PRAZO',
                'VENCE_HOJE'
            )
                then 'EM_PRAZO'

            else 'NAO_APLICAVEL'

        end;

    return new;

end;
$$;


-- ============================================================
-- STAGING
-- ============================================================

drop trigger if exists
trg_situacao_gerencial_stg_planos_acao
on public.stg_mart_planos_acao;

create trigger
trg_situacao_gerencial_stg_planos_acao
before insert or update
on public.stg_mart_planos_acao
for each row
execute function
public.definir_situacao_gerencial_planos_acao();


-- ============================================================
-- MART
-- ============================================================

drop trigger if exists
trg_situacao_gerencial_mart_planos_acao
on public.mart_planos_acao;

create trigger
trg_situacao_gerencial_mart_planos_acao
before insert or update
on public.mart_planos_acao
for each row
execute function
public.definir_situacao_gerencial_planos_acao();


-- ============================================================
-- DADOS JA EXISTENTES
-- ============================================================

update public.stg_mart_planos_acao
set situacao_gerencial = situacao_gerencial;

update public.mart_planos_acao
set situacao_gerencial = situacao_gerencial;


-- ============================================================
-- VALIDACAO
-- ============================================================

alter table public.stg_mart_planos_acao
    drop constraint if exists
    chk_stg_mart_planos_acao_situacao_gerencial;

alter table public.stg_mart_planos_acao
    add constraint
    chk_stg_mart_planos_acao_situacao_gerencial
    check (
        situacao_gerencial in (
            'VENCIDO',
            'EM_PRAZO',
            'FECHADO_NO_PRAZO',
            'FECHADO_APOS_PRAZO',
            'NAO_APLICAVEL'
        )
    );


alter table public.mart_planos_acao
    drop constraint if exists
    chk_mart_planos_acao_situacao_gerencial;

alter table public.mart_planos_acao
    add constraint
    chk_mart_planos_acao_situacao_gerencial
    check (
        situacao_gerencial in (
            'VENCIDO',
            'EM_PRAZO',
            'FECHADO_NO_PRAZO',
            'FECHADO_APOS_PRAZO',
            'NAO_APLICAVEL'
        )
    );


create index if not exists
idx_mart_planos_acao_situacao_gerencial
on public.mart_planos_acao(
    situacao_gerencial
);

commit;
