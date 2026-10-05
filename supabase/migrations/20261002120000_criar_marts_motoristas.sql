begin;

-- =========================================================
-- MOTORISTAS - MARTS + STAGINGS + PROMOCAO ATOMICA
-- =========================================================

create table if not exists public.mart_motoristas (
    nome_exibicao text,
    coligada text,
    secao_rm text,
    situacao_motorista text,
    situacao_exibicao text,
    status_cobli text,
    status_rm text,
    data_demissao date,
    dias_desde_demissao integer
);

create table if not exists public.stg_mart_motoristas (
    carga_id uuid not null,
    nome_exibicao text,
    coligada text,
    secao_rm text,
    situacao_motorista text,
    situacao_exibicao text,
    status_cobli text,
    status_rm text,
    data_demissao date,
    dias_desde_demissao integer
);

create index if not exists
idx_stg_mart_motoristas_carga
on public.stg_mart_motoristas(carga_id);

alter table public.mart_motoristas
enable row level security;

alter table public.stg_mart_motoristas
enable row level security;

revoke all
on table public.mart_motoristas
from anon, authenticated;

revoke all
on table public.stg_mart_motoristas
from anon, authenticated;

revoke insert, update, delete, truncate
on table public.mart_motoristas
from service_role;

grant select
on table public.mart_motoristas
to service_role;

grant select, insert, delete
on table public.stg_mart_motoristas
to service_role;

create table if not exists public.mart_motoristas_resumo (
    grupo text,
    indicador text,
    valor double precision,
    unidade text
);

create table if not exists public.stg_mart_motoristas_resumo (
    carga_id uuid not null,
    grupo text,
    indicador text,
    valor double precision,
    unidade text
);

create index if not exists
idx_stg_mart_motoristas_resumo_carga
on public.stg_mart_motoristas_resumo(carga_id);

alter table public.mart_motoristas_resumo
enable row level security;

alter table public.stg_mart_motoristas_resumo
enable row level security;

revoke all
on table public.mart_motoristas_resumo
from anon, authenticated;

revoke all
on table public.stg_mart_motoristas_resumo
from anon, authenticated;

revoke insert, update, delete, truncate
on table public.mart_motoristas_resumo
from service_role;

grant select
on table public.mart_motoristas_resumo
to service_role;

grant select, insert, delete
on table public.stg_mart_motoristas_resumo
to service_role;

create table if not exists public.mart_motoristas_coligadas (
    coligada text,
    motoristas integer,
    ativos_rm integer,
    a_desabilitar integer,
    sem_identidade_rm integer
);

create table if not exists public.stg_mart_motoristas_coligadas (
    carga_id uuid not null,
    coligada text,
    motoristas integer,
    ativos_rm integer,
    a_desabilitar integer,
    sem_identidade_rm integer
);

create index if not exists
idx_stg_mart_motoristas_coligadas_carga
on public.stg_mart_motoristas_coligadas(carga_id);

alter table public.mart_motoristas_coligadas
enable row level security;

alter table public.stg_mart_motoristas_coligadas
enable row level security;

revoke all
on table public.mart_motoristas_coligadas
from anon, authenticated;

revoke all
on table public.stg_mart_motoristas_coligadas
from anon, authenticated;

revoke insert, update, delete, truncate
on table public.mart_motoristas_coligadas
from service_role;

grant select
on table public.mart_motoristas_coligadas
to service_role;

grant select, insert, delete
on table public.stg_mart_motoristas_coligadas
to service_role;

create table if not exists public.mart_motoristas_viagens (
    data_evento date,
    ano_evento integer,
    mes_evento integer,
    inicio timestamp without time zone,
    fim timestamp without time zone,
    nome_exibicao text,
    coligada text,
    secao_rm text,
    situacao_motorista text,
    status_identificacao_condutor text,
    tipo_registro text,
    fim_de_semana boolean,
    noturno boolean,
    fim_semana_noturno boolean,
    distancia_km double precision,
    duracao_viagem_min double precision,
    marcha_lenta_min double precision
);

create table if not exists public.stg_mart_motoristas_viagens (
    carga_id uuid not null,
    data_evento date,
    ano_evento integer,
    mes_evento integer,
    inicio timestamp without time zone,
    fim timestamp without time zone,
    nome_exibicao text,
    coligada text,
    secao_rm text,
    situacao_motorista text,
    status_identificacao_condutor text,
    tipo_registro text,
    fim_de_semana boolean,
    noturno boolean,
    fim_semana_noturno boolean,
    distancia_km double precision,
    duracao_viagem_min double precision,
    marcha_lenta_min double precision
);

create index if not exists
idx_stg_mart_motoristas_viagens_carga
on public.stg_mart_motoristas_viagens(carga_id);

alter table public.mart_motoristas_viagens
enable row level security;

alter table public.stg_mart_motoristas_viagens
enable row level security;

revoke all
on table public.mart_motoristas_viagens
from anon, authenticated;

revoke all
on table public.stg_mart_motoristas_viagens
from anon, authenticated;

revoke insert, update, delete, truncate
on table public.mart_motoristas_viagens
from service_role;

grant select
on table public.mart_motoristas_viagens
to service_role;

grant select, insert, delete
on table public.stg_mart_motoristas_viagens
to service_role;

create table if not exists public.mart_motoristas_uso_setor (
    cenario text,
    secao_rm text,
    viagens integer,
    km double precision,
    motoristas integer
);

create table if not exists public.stg_mart_motoristas_uso_setor (
    carga_id uuid not null,
    cenario text,
    secao_rm text,
    viagens integer,
    km double precision,
    motoristas integer
);

create index if not exists
idx_stg_mart_motoristas_uso_setor_carga
on public.stg_mart_motoristas_uso_setor(carga_id);

alter table public.mart_motoristas_uso_setor
enable row level security;

alter table public.stg_mart_motoristas_uso_setor
enable row level security;

revoke all
on table public.mart_motoristas_uso_setor
from anon, authenticated;

revoke all
on table public.stg_mart_motoristas_uso_setor
from anon, authenticated;

revoke insert, update, delete, truncate
on table public.mart_motoristas_uso_setor
from service_role;

grant select
on table public.mart_motoristas_uso_setor
to service_role;

grant select, insert, delete
on table public.stg_mart_motoristas_uso_setor
to service_role;

create table if not exists public.mart_motoristas_pendencias_condutor (
    cenario text,
    tipo_registro text,
    viagens integer,
    km double precision,
    registros_cobli integer
);

create table if not exists public.stg_mart_motoristas_pendencias_condutor (
    carga_id uuid not null,
    cenario text,
    tipo_registro text,
    viagens integer,
    km double precision,
    registros_cobli integer
);

create index if not exists
idx_stg_mart_motoristas_pendencias_condutor_carga
on public.stg_mart_motoristas_pendencias_condutor(carga_id);

alter table public.mart_motoristas_pendencias_condutor
enable row level security;

alter table public.stg_mart_motoristas_pendencias_condutor
enable row level security;

revoke all
on table public.mart_motoristas_pendencias_condutor
from anon, authenticated;

revoke all
on table public.stg_mart_motoristas_pendencias_condutor
from anon, authenticated;

revoke insert, update, delete, truncate
on table public.mart_motoristas_pendencias_condutor
from service_role;

grant select
on table public.mart_motoristas_pendencias_condutor
to service_role;

grant select, insert, delete
on table public.stg_mart_motoristas_pendencias_condutor
to service_role;

create table if not exists public.mart_motoristas_seguranca (
    nome_exibicao text,
    coligada text,
    secao_rm text,
    distancia_km double precision,
    tempo_dirigido_min double precision,
    velocidade_via_eventos_qtd integer,
    aceleracao_brusca_qtd integer,
    frenagem_brusca_qtd integer,
    curva_brusca_qtd integer,
    direcao_distraida_qtd integer,
    uso_celular_qtd integer,
    olhos_fechados_qtd integer,
    bocejo_qtd integer,
    fumo_qtd integer,
    distancia_insegura_qtd integer,
    eventos_risco_total integer,
    taxa_eventos_100km double precision,
    elegivel_ranking boolean
);

create table if not exists public.stg_mart_motoristas_seguranca (
    carga_id uuid not null,
    nome_exibicao text,
    coligada text,
    secao_rm text,
    distancia_km double precision,
    tempo_dirigido_min double precision,
    velocidade_via_eventos_qtd integer,
    aceleracao_brusca_qtd integer,
    frenagem_brusca_qtd integer,
    curva_brusca_qtd integer,
    direcao_distraida_qtd integer,
    uso_celular_qtd integer,
    olhos_fechados_qtd integer,
    bocejo_qtd integer,
    fumo_qtd integer,
    distancia_insegura_qtd integer,
    eventos_risco_total integer,
    taxa_eventos_100km double precision,
    elegivel_ranking boolean
);

create index if not exists
idx_stg_mart_motoristas_seguranca_carga
on public.stg_mart_motoristas_seguranca(carga_id);

alter table public.mart_motoristas_seguranca
enable row level security;

alter table public.stg_mart_motoristas_seguranca
enable row level security;

revoke all
on table public.mart_motoristas_seguranca
from anon, authenticated;

revoke all
on table public.stg_mart_motoristas_seguranca
from anon, authenticated;

revoke insert, update, delete, truncate
on table public.mart_motoristas_seguranca
from service_role;

grant select
on table public.mart_motoristas_seguranca
to service_role;

grant select, insert, delete
on table public.stg_mart_motoristas_seguranca
to service_role;

create table if not exists public.mart_motoristas_ranking_uso (
    posicao integer,
    nome_exibicao text,
    coligada text,
    secao_rm text,
    distancia_km double precision,
    viagens integer
);

create table if not exists public.stg_mart_motoristas_ranking_uso (
    carga_id uuid not null,
    posicao integer,
    nome_exibicao text,
    coligada text,
    secao_rm text,
    distancia_km double precision,
    viagens integer
);

create index if not exists
idx_stg_mart_motoristas_ranking_uso_carga
on public.stg_mart_motoristas_ranking_uso(carga_id);

alter table public.mart_motoristas_ranking_uso
enable row level security;

alter table public.stg_mart_motoristas_ranking_uso
enable row level security;

revoke all
on table public.mart_motoristas_ranking_uso
from anon, authenticated;

revoke all
on table public.stg_mart_motoristas_ranking_uso
from anon, authenticated;

revoke insert, update, delete, truncate
on table public.mart_motoristas_ranking_uso
from service_role;

grant select
on table public.mart_motoristas_ranking_uso
to service_role;

grant select, insert, delete
on table public.stg_mart_motoristas_ranking_uso
to service_role;

create table if not exists public.mart_motoristas_ranking_seguranca (
    posicao integer,
    ranking text,
    nome_exibicao text,
    coligada text,
    secao_rm text,
    distancia_km double precision,
    eventos_risco_total integer,
    taxa_eventos_100km double precision
);

create table if not exists public.stg_mart_motoristas_ranking_seguranca (
    carga_id uuid not null,
    posicao integer,
    ranking text,
    nome_exibicao text,
    coligada text,
    secao_rm text,
    distancia_km double precision,
    eventos_risco_total integer,
    taxa_eventos_100km double precision
);

create index if not exists
idx_stg_mart_motoristas_ranking_seguranca_carga
on public.stg_mart_motoristas_ranking_seguranca(carga_id);

alter table public.mart_motoristas_ranking_seguranca
enable row level security;

alter table public.stg_mart_motoristas_ranking_seguranca
enable row level security;

revoke all
on table public.mart_motoristas_ranking_seguranca
from anon, authenticated;

revoke all
on table public.stg_mart_motoristas_ranking_seguranca
from anon, authenticated;

revoke insert, update, delete, truncate
on table public.mart_motoristas_ranking_seguranca
from service_role;

grant select
on table public.mart_motoristas_ranking_seguranca
to service_role;

grant select, insert, delete
on table public.stg_mart_motoristas_ranking_seguranca
to service_role;

create index if not exists
idx_mart_motoristas_coligada
on public.mart_motoristas(coligada);

create index if not exists
idx_mart_motoristas_secao
on public.mart_motoristas(secao_rm);

create index if not exists
idx_mart_motoristas_viagens_data
on public.mart_motoristas_viagens(data_evento);

create index if not exists
idx_mart_motoristas_viagens_coligada
on public.mart_motoristas_viagens(coligada);

create index if not exists
idx_mart_motoristas_viagens_secao
on public.mart_motoristas_viagens(secao_rm);

create index if not exists
idx_mart_motoristas_viagens_noturno
on public.mart_motoristas_viagens(noturno);

create index if not exists
idx_mart_motoristas_uso_setor_cenario
on public.mart_motoristas_uso_setor(cenario);

create or replace function
public.promover_mart_motoristas(
    p_carga_motoristas uuid,
    p_quantidades jsonb
)
returns jsonb

language plpgsql

security definer

set search_path =
    pg_catalog,
    public

as $$

declare

    v_esperado_motoristas integer;
    v_staging_motoristas integer;
    v_inserido_motoristas integer;
    v_esperado_resumo integer;
    v_staging_resumo integer;
    v_inserido_resumo integer;
    v_esperado_coligadas integer;
    v_staging_coligadas integer;
    v_inserido_coligadas integer;
    v_esperado_viagens integer;
    v_staging_viagens integer;
    v_inserido_viagens integer;
    v_esperado_uso_setor integer;
    v_staging_uso_setor integer;
    v_inserido_uso_setor integer;
    v_esperado_pendencias_condutor integer;
    v_staging_pendencias_condutor integer;
    v_inserido_pendencias_condutor integer;
    v_esperado_seguranca integer;
    v_staging_seguranca integer;
    v_inserido_seguranca integer;
    v_esperado_ranking_uso integer;
    v_staging_ranking_uso integer;
    v_inserido_ranking_uso integer;
    v_esperado_ranking_seguranca integer;
    v_staging_ranking_seguranca integer;
    v_inserido_ranking_seguranca integer;

begin

    if p_carga_motoristas is null then

        raise exception
            'carga_id de Motoristas nao pode ser nulo.';

    end if;

    if (
        p_quantidades is null
        or jsonb_typeof(p_quantidades) <> 'object'
    ) then

        raise exception
            'p_quantidades de Motoristas deve ser objeto JSON.';

    end if;


    v_esperado_motoristas :=
        nullif(
            p_quantidades ->> 'motoristas',
            ''
        )::integer;

    if (
        v_esperado_motoristas is null
        or v_esperado_motoristas <= 0
    ) then

        raise exception
            'Quantidade esperada invalida para motoristas: %',
            v_esperado_motoristas;

    end if;

    select count(*)
    into v_staging_motoristas
    from public.stg_mart_motoristas
    where carga_id = p_carga_motoristas;

    if v_staging_motoristas <> v_esperado_motoristas then

        raise exception
            'Staging motoristas divergente. Esperado: %. Encontrado: %.',
            v_esperado_motoristas,
            v_staging_motoristas;

    end if;

    v_esperado_resumo :=
        nullif(
            p_quantidades ->> 'resumo',
            ''
        )::integer;

    if (
        v_esperado_resumo is null
        or v_esperado_resumo <= 0
    ) then

        raise exception
            'Quantidade esperada invalida para resumo: %',
            v_esperado_resumo;

    end if;

    select count(*)
    into v_staging_resumo
    from public.stg_mart_motoristas_resumo
    where carga_id = p_carga_motoristas;

    if v_staging_resumo <> v_esperado_resumo then

        raise exception
            'Staging resumo divergente. Esperado: %. Encontrado: %.',
            v_esperado_resumo,
            v_staging_resumo;

    end if;

    v_esperado_coligadas :=
        nullif(
            p_quantidades ->> 'coligadas',
            ''
        )::integer;

    if (
        v_esperado_coligadas is null
        or v_esperado_coligadas <= 0
    ) then

        raise exception
            'Quantidade esperada invalida para coligadas: %',
            v_esperado_coligadas;

    end if;

    select count(*)
    into v_staging_coligadas
    from public.stg_mart_motoristas_coligadas
    where carga_id = p_carga_motoristas;

    if v_staging_coligadas <> v_esperado_coligadas then

        raise exception
            'Staging coligadas divergente. Esperado: %. Encontrado: %.',
            v_esperado_coligadas,
            v_staging_coligadas;

    end if;

    v_esperado_viagens :=
        nullif(
            p_quantidades ->> 'viagens',
            ''
        )::integer;

    if (
        v_esperado_viagens is null
        or v_esperado_viagens <= 0
    ) then

        raise exception
            'Quantidade esperada invalida para viagens: %',
            v_esperado_viagens;

    end if;

    select count(*)
    into v_staging_viagens
    from public.stg_mart_motoristas_viagens
    where carga_id = p_carga_motoristas;

    if v_staging_viagens <> v_esperado_viagens then

        raise exception
            'Staging viagens divergente. Esperado: %. Encontrado: %.',
            v_esperado_viagens,
            v_staging_viagens;

    end if;

    v_esperado_uso_setor :=
        nullif(
            p_quantidades ->> 'uso_setor',
            ''
        )::integer;

    if (
        v_esperado_uso_setor is null
        or v_esperado_uso_setor < 0
    ) then

        raise exception
            'Quantidade esperada invalida para uso_setor: %',
            v_esperado_uso_setor;

    end if;

    select count(*)
    into v_staging_uso_setor
    from public.stg_mart_motoristas_uso_setor
    where carga_id = p_carga_motoristas;

    if v_staging_uso_setor <> v_esperado_uso_setor then

        raise exception
            'Staging uso_setor divergente. Esperado: %. Encontrado: %.',
            v_esperado_uso_setor,
            v_staging_uso_setor;

    end if;

    v_esperado_pendencias_condutor :=
        nullif(
            p_quantidades ->> 'pendencias_condutor',
            ''
        )::integer;

    if (
        v_esperado_pendencias_condutor is null
        or v_esperado_pendencias_condutor < 0
    ) then

        raise exception
            'Quantidade esperada invalida para pendencias_condutor: %',
            v_esperado_pendencias_condutor;

    end if;

    select count(*)
    into v_staging_pendencias_condutor
    from public.stg_mart_motoristas_pendencias_condutor
    where carga_id = p_carga_motoristas;

    if v_staging_pendencias_condutor <> v_esperado_pendencias_condutor then

        raise exception
            'Staging pendencias_condutor divergente. Esperado: %. Encontrado: %.',
            v_esperado_pendencias_condutor,
            v_staging_pendencias_condutor;

    end if;

    v_esperado_seguranca :=
        nullif(
            p_quantidades ->> 'seguranca',
            ''
        )::integer;

    if (
        v_esperado_seguranca is null
        or v_esperado_seguranca <= 0
    ) then

        raise exception
            'Quantidade esperada invalida para seguranca: %',
            v_esperado_seguranca;

    end if;

    select count(*)
    into v_staging_seguranca
    from public.stg_mart_motoristas_seguranca
    where carga_id = p_carga_motoristas;

    if v_staging_seguranca <> v_esperado_seguranca then

        raise exception
            'Staging seguranca divergente. Esperado: %. Encontrado: %.',
            v_esperado_seguranca,
            v_staging_seguranca;

    end if;

    v_esperado_ranking_uso :=
        nullif(
            p_quantidades ->> 'ranking_uso',
            ''
        )::integer;

    if (
        v_esperado_ranking_uso is null
        or v_esperado_ranking_uso <= 0
    ) then

        raise exception
            'Quantidade esperada invalida para ranking_uso: %',
            v_esperado_ranking_uso;

    end if;

    select count(*)
    into v_staging_ranking_uso
    from public.stg_mart_motoristas_ranking_uso
    where carga_id = p_carga_motoristas;

    if v_staging_ranking_uso <> v_esperado_ranking_uso then

        raise exception
            'Staging ranking_uso divergente. Esperado: %. Encontrado: %.',
            v_esperado_ranking_uso,
            v_staging_ranking_uso;

    end if;

    v_esperado_ranking_seguranca :=
        nullif(
            p_quantidades ->> 'ranking_seguranca',
            ''
        )::integer;

    if (
        v_esperado_ranking_seguranca is null
        or v_esperado_ranking_seguranca <= 0
    ) then

        raise exception
            'Quantidade esperada invalida para ranking_seguranca: %',
            v_esperado_ranking_seguranca;

    end if;

    select count(*)
    into v_staging_ranking_seguranca
    from public.stg_mart_motoristas_ranking_seguranca
    where carga_id = p_carga_motoristas;

    if v_staging_ranking_seguranca <> v_esperado_ranking_seguranca then

        raise exception
            'Staging ranking_seguranca divergente. Esperado: %. Encontrado: %.',
            v_esperado_ranking_seguranca,
            v_staging_ranking_seguranca;

    end if;


    lock table
        public.mart_motoristas,
        public.mart_motoristas_resumo,
        public.mart_motoristas_coligadas,
        public.mart_motoristas_viagens,
        public.mart_motoristas_uso_setor,
        public.mart_motoristas_pendencias_condutor,
        public.mart_motoristas_seguranca,
        public.mart_motoristas_ranking_uso,
        public.mart_motoristas_ranking_seguranca
    in exclusive mode;


    delete from public.mart_motoristas;

    insert into public.mart_motoristas (
        nome_exibicao,
        coligada,
        secao_rm,
        situacao_motorista,
        situacao_exibicao,
        status_cobli,
        status_rm,
        data_demissao,
        dias_desde_demissao
    )
    select
        nome_exibicao,
        coligada,
        secao_rm,
        situacao_motorista,
        situacao_exibicao,
        status_cobli,
        status_rm,
        data_demissao,
        dias_desde_demissao
    from public.stg_mart_motoristas
    where carga_id = p_carga_motoristas;

    get diagnostics
        v_inserido_motoristas = row_count;

    if v_inserido_motoristas <> v_esperado_motoristas then

        raise exception
            'Promocao motoristas divergente. Esperado: %. Inserido: %.',
            v_esperado_motoristas,
            v_inserido_motoristas;

    end if;

    delete from public.mart_motoristas_resumo;

    insert into public.mart_motoristas_resumo (
        grupo,
        indicador,
        valor,
        unidade
    )
    select
        grupo,
        indicador,
        valor,
        unidade
    from public.stg_mart_motoristas_resumo
    where carga_id = p_carga_motoristas;

    get diagnostics
        v_inserido_resumo = row_count;

    if v_inserido_resumo <> v_esperado_resumo then

        raise exception
            'Promocao resumo divergente. Esperado: %. Inserido: %.',
            v_esperado_resumo,
            v_inserido_resumo;

    end if;

    delete from public.mart_motoristas_coligadas;

    insert into public.mart_motoristas_coligadas (
        coligada,
        motoristas,
        ativos_rm,
        a_desabilitar,
        sem_identidade_rm
    )
    select
        coligada,
        motoristas,
        ativos_rm,
        a_desabilitar,
        sem_identidade_rm
    from public.stg_mart_motoristas_coligadas
    where carga_id = p_carga_motoristas;

    get diagnostics
        v_inserido_coligadas = row_count;

    if v_inserido_coligadas <> v_esperado_coligadas then

        raise exception
            'Promocao coligadas divergente. Esperado: %. Inserido: %.',
            v_esperado_coligadas,
            v_inserido_coligadas;

    end if;

    delete from public.mart_motoristas_viagens;

    insert into public.mart_motoristas_viagens (
        data_evento,
        ano_evento,
        mes_evento,
        inicio,
        fim,
        nome_exibicao,
        coligada,
        secao_rm,
        situacao_motorista,
        status_identificacao_condutor,
        tipo_registro,
        fim_de_semana,
        noturno,
        fim_semana_noturno,
        distancia_km,
        duracao_viagem_min,
        marcha_lenta_min
    )
    select
        data_evento,
        ano_evento,
        mes_evento,
        inicio,
        fim,
        nome_exibicao,
        coligada,
        secao_rm,
        situacao_motorista,
        status_identificacao_condutor,
        tipo_registro,
        fim_de_semana,
        noturno,
        fim_semana_noturno,
        distancia_km,
        duracao_viagem_min,
        marcha_lenta_min
    from public.stg_mart_motoristas_viagens
    where carga_id = p_carga_motoristas;

    get diagnostics
        v_inserido_viagens = row_count;

    if v_inserido_viagens <> v_esperado_viagens then

        raise exception
            'Promocao viagens divergente. Esperado: %. Inserido: %.',
            v_esperado_viagens,
            v_inserido_viagens;

    end if;

    delete from public.mart_motoristas_uso_setor;

    insert into public.mart_motoristas_uso_setor (
        cenario,
        secao_rm,
        viagens,
        km,
        motoristas
    )
    select
        cenario,
        secao_rm,
        viagens,
        km,
        motoristas
    from public.stg_mart_motoristas_uso_setor
    where carga_id = p_carga_motoristas;

    get diagnostics
        v_inserido_uso_setor = row_count;

    if v_inserido_uso_setor <> v_esperado_uso_setor then

        raise exception
            'Promocao uso_setor divergente. Esperado: %. Inserido: %.',
            v_esperado_uso_setor,
            v_inserido_uso_setor;

    end if;

    delete from public.mart_motoristas_pendencias_condutor;

    insert into public.mart_motoristas_pendencias_condutor (
        cenario,
        tipo_registro,
        viagens,
        km,
        registros_cobli
    )
    select
        cenario,
        tipo_registro,
        viagens,
        km,
        registros_cobli
    from public.stg_mart_motoristas_pendencias_condutor
    where carga_id = p_carga_motoristas;

    get diagnostics
        v_inserido_pendencias_condutor = row_count;

    if v_inserido_pendencias_condutor <> v_esperado_pendencias_condutor then

        raise exception
            'Promocao pendencias_condutor divergente. Esperado: %. Inserido: %.',
            v_esperado_pendencias_condutor,
            v_inserido_pendencias_condutor;

    end if;

    delete from public.mart_motoristas_seguranca;

    insert into public.mart_motoristas_seguranca (
        nome_exibicao,
        coligada,
        secao_rm,
        distancia_km,
        tempo_dirigido_min,
        velocidade_via_eventos_qtd,
        aceleracao_brusca_qtd,
        frenagem_brusca_qtd,
        curva_brusca_qtd,
        direcao_distraida_qtd,
        uso_celular_qtd,
        olhos_fechados_qtd,
        bocejo_qtd,
        fumo_qtd,
        distancia_insegura_qtd,
        eventos_risco_total,
        taxa_eventos_100km,
        elegivel_ranking
    )
    select
        nome_exibicao,
        coligada,
        secao_rm,
        distancia_km,
        tempo_dirigido_min,
        velocidade_via_eventos_qtd,
        aceleracao_brusca_qtd,
        frenagem_brusca_qtd,
        curva_brusca_qtd,
        direcao_distraida_qtd,
        uso_celular_qtd,
        olhos_fechados_qtd,
        bocejo_qtd,
        fumo_qtd,
        distancia_insegura_qtd,
        eventos_risco_total,
        taxa_eventos_100km,
        elegivel_ranking
    from public.stg_mart_motoristas_seguranca
    where carga_id = p_carga_motoristas;

    get diagnostics
        v_inserido_seguranca = row_count;

    if v_inserido_seguranca <> v_esperado_seguranca then

        raise exception
            'Promocao seguranca divergente. Esperado: %. Inserido: %.',
            v_esperado_seguranca,
            v_inserido_seguranca;

    end if;

    delete from public.mart_motoristas_ranking_uso;

    insert into public.mart_motoristas_ranking_uso (
        posicao,
        nome_exibicao,
        coligada,
        secao_rm,
        distancia_km,
        viagens
    )
    select
        posicao,
        nome_exibicao,
        coligada,
        secao_rm,
        distancia_km,
        viagens
    from public.stg_mart_motoristas_ranking_uso
    where carga_id = p_carga_motoristas;

    get diagnostics
        v_inserido_ranking_uso = row_count;

    if v_inserido_ranking_uso <> v_esperado_ranking_uso then

        raise exception
            'Promocao ranking_uso divergente. Esperado: %. Inserido: %.',
            v_esperado_ranking_uso,
            v_inserido_ranking_uso;

    end if;

    delete from public.mart_motoristas_ranking_seguranca;

    insert into public.mart_motoristas_ranking_seguranca (
        posicao,
        ranking,
        nome_exibicao,
        coligada,
        secao_rm,
        distancia_km,
        eventos_risco_total,
        taxa_eventos_100km
    )
    select
        posicao,
        ranking,
        nome_exibicao,
        coligada,
        secao_rm,
        distancia_km,
        eventos_risco_total,
        taxa_eventos_100km
    from public.stg_mart_motoristas_ranking_seguranca
    where carga_id = p_carga_motoristas;

    get diagnostics
        v_inserido_ranking_seguranca = row_count;

    if v_inserido_ranking_seguranca <> v_esperado_ranking_seguranca then

        raise exception
            'Promocao ranking_seguranca divergente. Esperado: %. Inserido: %.',
            v_esperado_ranking_seguranca,
            v_inserido_ranking_seguranca;

    end if;


    return jsonb_build_object(
        'motoristas', v_inserido_motoristas,
        'resumo', v_inserido_resumo,
        'coligadas', v_inserido_coligadas,
        'viagens', v_inserido_viagens,
        'uso_setor', v_inserido_uso_setor,
        'pendencias_condutor', v_inserido_pendencias_condutor,
        'seguranca', v_inserido_seguranca,
        'ranking_uso', v_inserido_ranking_uso,
        'ranking_seguranca', v_inserido_ranking_seguranca
    );

end;

$$;


revoke all
on function public.promover_mart_motoristas(
    uuid,
    jsonb
)
from public, anon, authenticated;


grant execute
on function public.promover_mart_motoristas(
    uuid,
    jsonb
)
to service_role;


commit;
