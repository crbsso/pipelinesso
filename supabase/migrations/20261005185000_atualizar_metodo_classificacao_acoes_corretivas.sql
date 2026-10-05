begin;


-- ============================================================
-- ACOES CORRETIVAS
-- ATUALIZACAO DO CONTRATO DE metodo_classificacao
--
-- Nova regra:
--   grupo_sso e classificado pela secao RM do responsavel
--   da propria Acao Corretiva.
--
-- Novos metodos:
--   SECAO_RM_RESPONSAVEL
--   CONFIG_RESPONSAVEL_SEM_RM
--
-- Valores anteriores sao mantidos no CHECK para
-- compatibilidade com registros existentes durante
-- a transicao.
-- ============================================================


alter table public.stg_mart_acoes_corretivas
    drop constraint if exists
    chk_stg_acoes_corretivas_metodo;


alter table public.stg_mart_acoes_corretivas
    add constraint chk_stg_acoes_corretivas_metodo
    check (
        metodo_classificacao in (
            'NIVEL_ORGANIZACIONAL',
            'MAPA_GESTOR',
            'PADRAO',
            'MAPA_RM_EXATO',
            'MAPA_RM_ALIAS',
            'SECAO_RM_RESPONSAVEL',
            'CONFIG_RESPONSAVEL_SEM_RM'
        )
    );


alter table public.mart_acoes_corretivas
    drop constraint if exists
    chk_mart_acoes_corretivas_metodo;


alter table public.mart_acoes_corretivas
    add constraint chk_mart_acoes_corretivas_metodo
    check (
        metodo_classificacao in (
            'NIVEL_ORGANIZACIONAL',
            'MAPA_GESTOR',
            'PADRAO',
            'MAPA_RM_EXATO',
            'MAPA_RM_ALIAS',
            'SECAO_RM_RESPONSAVEL',
            'CONFIG_RESPONSAVEL_SEM_RM'
        )
    );


commit;
