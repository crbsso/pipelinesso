-- Somente HML ckfsarzmudwdehiiltwi. Dados ficticios autorizados; aborta se ja existirem.
begin;
do $teste$ begin
 if exists(select 1 from public.solicitacoes_acesso where email_corporativo in ('hml-aprovacao-20261030@example.invalid','hml-rejeicao-20261030@example.invalid')) then
  raise exception 'Solicitacoes de teste ja existem; revisar antes de repetir';
 end if;
end $teste$;
insert into public.solicitacoes_acesso(nome_completo,email_corporativo,empresa,cargo_funcao,projeto_unidade,justificativa)
values
 ('HML Teste Aprovacao 30-10-2026','hml-aprovacao-20261030@example.invalid','HML Testes de Permissionamento','Pessoa ficticia','UNIDADE_FICTICIA_HML','Teste autorizado de aprovacao pela interface. Dados ficticios; nao provisionar conta.'),
 ('HML Teste Rejeicao 30-10-2026','hml-rejeicao-20261030@example.invalid','HML Testes de Permissionamento','Pessoa ficticia','UNIDADE_FICTICIA_HML','Teste autorizado de rejeicao pela interface. Dados ficticios; nao provisionar conta.')
returning id,nome_completo,email_corporativo,status;
commit;