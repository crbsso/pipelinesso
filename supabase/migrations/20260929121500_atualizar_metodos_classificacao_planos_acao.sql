begin;

alter table public.mart_planos_acao
    drop constraint if exists chk_mart_planos_acao_metodo;

alter table public.mart_planos_acao
    add constraint chk_mart_planos_acao_metodo
    check (
        metodo_classificacao in (
            'NIVEL_ORGANIZACIONAL',
            'MAPA_GESTOR',
            'PADRAO',
            'MAPA_RM_EXATO',
            'MAPA_RM_ALIAS'
        )
    );

commit;
