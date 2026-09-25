begin;

-- =========================================================
-- CONFIGURACAO PRIVADA - IDENTIDADES DE INSPECOES
-- =========================================================

create table if not exists
public.config_identidades_inspecoes (

    codigo_inspecao text
        primary key,

    cod_colaborador text,

    status_vinculo text
        not null,

    metodo_vinculo text
        not null,

    criado_em timestamptz
        not null
        default now(),

    atualizado_em timestamptz
        not null
        default now(),

    constraint chk_identidade_codigo
        check (
            btrim(codigo_inspecao) <> ''
        ),

    constraint chk_identidade_status
        check (
            status_vinculo in (
                'VINCULADO',
                'NAO_VINCULADO'
            )
        ),

    constraint chk_identidade_metodo
        check (
            metodo_vinculo in (
                'EXATO',
                'SIMILARIDADE_VALIDADA',
                'NAO_VINCULADO'
            )
        ),

    constraint chk_identidade_cod_colaborador
        check (
            cod_colaborador is null
            or cod_colaborador ~ '^[0-9]+-[0-9]+$'
        ),

    constraint chk_identidade_coerencia
        check (
            (
                status_vinculo = 'VINCULADO'
                and cod_colaborador is not null
                and metodo_vinculo in (
                    'EXATO',
                    'SIMILARIDADE_VALIDADA'
                )
            )
            or
            (
                status_vinculo = 'NAO_VINCULADO'
                and cod_colaborador is null
                and metodo_vinculo = 'NAO_VINCULADO'
            )
        )
);


-- =========================================================
-- SEGURANCA
-- =========================================================

alter table
public.config_identidades_inspecoes
enable row level security;


revoke all
on table public.config_identidades_inspecoes
from anon, authenticated;


grant select, insert, update
on table public.config_identidades_inspecoes
to service_role;


revoke delete, truncate
on table public.config_identidades_inspecoes
from service_role;


commit;
