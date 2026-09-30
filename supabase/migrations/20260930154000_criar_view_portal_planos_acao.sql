begin;

create or replace view public.vw_portal_planos_acao as
select
    modulo_origem,
    cronograma_plano,
    nivel_organizacional,
    flag_ativo_fonte,
    dias_para_prazo,
    dias_em_atraso_calculado,
    situacao_prazo_calculada,
    situacao_gerencial,
    flag_vence_hoje,
    grupo_sso
from public.mart_planos_acao;

revoke all on public.vw_portal_planos_acao from public;
revoke all on public.vw_portal_planos_acao from anon;
revoke all on public.vw_portal_planos_acao from authenticated;

grant select on public.vw_portal_planos_acao to service_role;

commit;
