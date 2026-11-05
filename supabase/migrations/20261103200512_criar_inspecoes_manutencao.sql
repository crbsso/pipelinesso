-- Portal SSO / CELEO
-- Inspecoes da Manutencao - HML
-- Estruturas independentes da mart_inspecoes existente.
-- Sem publicacao ou alteracao do pipeline atual.

CREATE TABLE public.stg_inspecoes_manutencao (
    carga_id uuid NOT NULL,
    id_inspecao bigint NOT NULL,
    ficha_id integer NOT NULL,
    aba_id integer NOT NULL,
    ativo_id integer,
    data_inspecao timestamp without time zone NOT NULL,
    concessao text,
    localizacao text,
    familia text NOT NULL,
    tipo text NOT NULL,
    periodicidade text,
    origem text NOT NULL DEFAULT 'SQL Server Intranet',
    recebido_em timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (
        carga_id, id_inspecao, ficha_id, aba_id
    ),

    CONSTRAINT chk_stg_manutencao_origem
        CHECK (origem = 'SQL Server Intranet'),

    CONSTRAINT chk_stg_manutencao_textos
        CHECK (
            btrim(familia) <> ''
            AND btrim(tipo) <> ''
        )
);

CREATE TABLE public.mart_inspecoes_manutencao (
    id_inspecao bigint NOT NULL,
    ficha_id integer NOT NULL,
    aba_id integer NOT NULL,
    ativo_id integer,
    data_inspecao timestamp without time zone NOT NULL,
    concessao text,
    localizacao text,
    familia text NOT NULL,
    tipo text NOT NULL,
    periodicidade text,
    origem text NOT NULL DEFAULT 'SQL Server Intranet',
    carga_id uuid NOT NULL,
    publicado_em timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (
        id_inspecao, ficha_id, aba_id
    ),

    CONSTRAINT chk_mart_manutencao_origem
        CHECK (origem = 'SQL Server Intranet'),

    CONSTRAINT chk_mart_manutencao_textos
        CHECK (
            btrim(familia) <> ''
            AND btrim(tipo) <> ''
        )
);

CREATE INDEX idx_manutencao_data
    ON public.mart_inspecoes_manutencao (
        data_inspecao
    );

CREATE INDEX idx_manutencao_familia_data
    ON public.mart_inspecoes_manutencao (
        familia,
        data_inspecao
    );

ALTER TABLE public.stg_inspecoes_manutencao
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.mart_inspecoes_manutencao
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL
    ON TABLE public.stg_inspecoes_manutencao
    FROM PUBLIC, anon, authenticated;

REVOKE ALL
    ON TABLE public.mart_inspecoes_manutencao
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, DELETE
    ON TABLE public.stg_inspecoes_manutencao
    TO service_role;

GRANT SELECT
    ON TABLE public.mart_inspecoes_manutencao
    TO service_role;

COMMENT ON TABLE public.stg_inspecoes_manutencao IS
    'Carga isolada de inspecoes da Intranet, por carga_id.';

COMMENT ON TABLE public.mart_inspecoes_manutencao IS
    'Inspecoes da manutencao, separadas do Prevsys.';