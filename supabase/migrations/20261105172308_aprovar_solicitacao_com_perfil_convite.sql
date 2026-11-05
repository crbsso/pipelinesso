-- Aprovação com perfil explícito; convite separado e observável, sem credenciais no cliente.
begin;
alter table public.solicitacoes_acesso
 add column usuario_liberado_id uuid references auth.users(id) on delete set null,
 add column perfil_liberado_id uuid references portal_acesso.perfis(id) on delete restrict,
 add column perfil_liberado_nome text,
 add column liberado_em timestamptz,
 add column convite_status text not null default 'NAO_ENVIADO'
   check (convite_status in ('NAO_ENVIADO','PROCESSANDO','ENVIADO','FALHOU','CONTA_EXISTENTE')),
 add column convite_tentativa_id uuid,
 add column convite_tentativa_em timestamptz,
 add column convite_enviado_em timestamptz;
create index idx_solicitacoes_usuario_liberado on public.solicitacoes_acesso(usuario_liberado_id);
create index idx_solicitacoes_perfil_liberado on public.solicitacoes_acesso(perfil_liberado_id);

-- Executada somente pelo despachante privado já existente, com suas verificações atuais.
create function portal_acesso.liberar_solicitacao(p_operacao text,p_dados jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $lib$
declare
 ator uuid:=auth.uid(); s public.solicitacoes_acesso%rowtype;
 conta auth.users%rowtype; p portal_acesso.perfis%rowtype;
 alvo uuid; fim timestamptz; cadastro boolean; vinculo portal_acesso.atribuicoes%rowtype;
 antes jsonb; dados_conta jsonb;
begin
 if ator is null or not portal_acesso.tem_gestao(ator,'solicitacoes_acesso')
   or not portal_acesso.tem_gestao(ator,'usuarios') or not portal_acesso.tem_gestao(ator,'permissoes') then
   raise exception using errcode='42501',message='A liberação exige gestão de solicitações, usuários e permissões.';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(1953751,1);
 if not portal_acesso.tem_gestao(ator,'solicitacoes_acesso') or not portal_acesso.tem_gestao(ator,'usuarios')
   or not portal_acesso.tem_gestao(ator,'permissoes') then
   raise exception using errcode='42501',message='A permissão mudou ou venceu. Atualize a tela.';
 end if;
 if p_operacao in ('preparar_aprovacao','analisar_solicitacao') then
   perform portal_acesso.validar_campos(p_dados,case when p_operacao='preparar_aprovacao'
     then array['id','acao','observacao','perfilId','fim','semVencimento','versao']
     else array['id','acao','observacao','perfilId','fim','semVencimento','versao','usuarioId'] end);
 else
   perform portal_acesso.validar_campos(p_dados,case when p_operacao='preparar_convite'
     then array['id'] else array['id','tentativaId','status'] end);
 end if;
 alvo:=nullif(p_dados->>'id','')::uuid;
 select * into s from public.solicitacoes_acesso where id=alvo for update;
 if not found then raise exception using errcode='PT404',message='Solicitação não encontrada.'; end if;
 antes:=to_jsonb(s);
 if p_operacao in ('preparar_aprovacao','analisar_solicitacao') then
   if p_dados->>'acao' is distinct from 'APROVAR' or s.status not in ('PENDENTE','APROVADO')
     or s.liberado_em is not null then
     raise exception using errcode='PT409',message='A solicitação já foi liberada ou não pode ser aprovada.';
   end if;
   if p_dados->>'versao' is distinct from antes->>'atualizado_em' then
     raise exception using errcode='PT409',message='A solicitação mudou. Atualize a tela.';
   end if;
   if length(coalesce(p_dados->>'observacao',''))>2000
      or jsonb_typeof(p_dados->'semVencimento') is distinct from 'boolean' then
     raise exception using errcode='PT400',message='Revise a observação e a validade do acesso.';
   end if;
   if p_dados->'semVencimento'='true'::jsonb then
     if p_dados->'fim' is distinct from 'null'::jsonb then
       raise exception using errcode='PT400',message='Sem vencimento exige data final vazia.';
     end if;
   else
     if coalesce(p_dados->>'fim','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$' then
       raise exception using errcode='PT400',message='Informe um vencimento válido ou selecione sem vencimento.';
     end if;
     fim:=(p_dados->>'fim')::timestamptz;
     if fim<=clock_timestamp() then raise exception using errcode='PT400',message='O vencimento deve estar no futuro.'; end if;
   end if;
   select * into p from portal_acesso.perfis where id=(p_dados->>'perfilId')::uuid and ativo for share;
   if not found then raise exception using errcode='PT400',message='Selecione um perfil ativo.'; end if;
   if not exists(select 1 from portal_acesso.permissoes_perfil where perfil_id=p.id and ativo) then
     raise exception using errcode='PT400',message='O perfil selecionado não possui permissões ativas.';
   end if;
   select * into conta from auth.users where lower(email)=lower(s.email_corporativo);
   if found then
     if conta.deleted_at is not null or coalesce(conta.is_anonymous,false)
       or conta.banned_until>clock_timestamp() then
       raise exception using errcode='PT409',message='A conta está indisponível ou bloqueada. Revise em Usuários.';
     end if;
     select ativo into cadastro from public.perfis_portal where user_id=conta.id;
     if found and not cadastro then
       raise exception using errcode='PT409',message='O cadastro está bloqueado. Revise em Usuários.';
     end if;
   end if;
   dados_conta:=case when conta.id is null then null else jsonb_build_object('id',conta.id,'confirmado',conta.email_confirmed_at is not null) end;
   if p_operacao='preparar_aprovacao' then
     return jsonb_build_object('solicitacao',jsonb_build_object('id',s.id,'email',s.email_corporativo,'nome',s.nome_completo),'conta',dados_conta);
   end if;
   if conta.id is null or conta.id is distinct from (p_dados->>'usuarioId')::uuid then
     raise exception using errcode='PT409',message='A conta não corresponde ao e-mail da solicitação.';
   end if;
   insert into public.perfis_portal(user_id,papel,ativo) values(conta.id,'USUARIO',true)
     on conflict(user_id) do nothing;
   select * into vinculo from portal_acesso.atribuicoes where user_id=conta.id and perfil_id=p.id;
   if found then
     -- Não reativa nem amplia silenciosamente um vínculo existente.
     if not vinculo.ativo or not vinculo.herdar_perfil or vinculo.inicio>clock_timestamp()
       or vinculo.fim<=clock_timestamp() then
       raise exception using errcode='PT409',message='O vínculo existente precisa ser revisado em Usuários.';
     end if;
   else
     insert into portal_acesso.atribuicoes(user_id,perfil_id,ativo,fim,herdar_perfil)
       values(conta.id,p.id,true,fim,true);
   end if;
   update public.solicitacoes_acesso set status='APROVADO',usuario_liberado_id=conta.id,
     perfil_liberado_id=p.id,perfil_liberado_nome=p.nome,liberado_em=clock_timestamp(),
     analisado_em=coalesce(analisado_em,clock_timestamp()),analisado_por=coalesce(analisado_por,ator),
     observacao_analise=nullif(btrim(p_dados->>'observacao'),''),atualizado_em=clock_timestamp()
     where id=s.id returning * into s;
 else
   if s.status<>'APROVADO' or s.liberado_em is null or s.usuario_liberado_id is null then
     raise exception using errcode='PT409',message='Conclua a liberação com um perfil antes de enviar o convite.';
   end if;
   select * into conta from auth.users where id=s.usuario_liberado_id and lower(email)=lower(s.email_corporativo)
     and deleted_at is null and not coalesce(is_anonymous,false)
     and (banned_until is null or banned_until<=clock_timestamp());
   if not found or not exists(select 1 from public.perfis_portal where user_id=conta.id and ativo)
     or not exists(select 1 from portal_acesso.atribuicoes a join portal_acesso.perfis perfil_atual on perfil_atual.id=a.perfil_id and perfil_atual.ativo
       where a.user_id=conta.id and a.perfil_id=s.perfil_liberado_id and a.ativo
       and (a.inicio is null or a.inicio<=clock_timestamp()) and (a.fim is null or a.fim>clock_timestamp())) then
     raise exception using errcode='PT409',message='O acesso está bloqueado, vencido ou sem perfil ativo. Revise em Usuários.';
   end if;
   if p_operacao='preparar_convite' then
     if s.convite_tentativa_em>clock_timestamp()-interval '60 seconds' then
       raise exception using errcode='PT409',message='Aguarde um minuto antes de reenviar o convite.';
     end if;
     update public.solicitacoes_acesso set convite_tentativa_id=gen_random_uuid(),convite_tentativa_em=clock_timestamp(),
       convite_status='PROCESSANDO',atualizado_em=clock_timestamp() where id=s.id returning * into s;
   elsif p_operacao='registrar_convite' then
     if s.convite_tentativa_id is distinct from (p_dados->>'tentativaId')::uuid
       or s.convite_status<>'PROCESSANDO' or p_dados->>'status' not in ('ENVIADO','FALHOU','CONTA_EXISTENTE')
       or p_dados->>'status' is null then
       raise exception using errcode='PT409',message='O envio mudou. Atualize a tela.';
     end if;
     update public.solicitacoes_acesso set convite_status=p_dados->>'status',
       convite_enviado_em=case when p_dados->>'status'='ENVIADO' then clock_timestamp() else convite_enviado_em end,
       atualizado_em=clock_timestamp() where id=s.id returning * into s;
   else raise exception using errcode='PT400',message='Operação desconhecida.'; end if;
 end if;
 insert into portal_acesso.auditoria(autor_id,sessao_banco,papel_sessao,entidade,operacao,antes,depois)
   values(ator,session_user,current_setting('role',true),'public.solicitacoes_acesso','UPDATE',antes,to_jsonb(s));
 return jsonb_build_object('ok',true,'solicitacao',to_jsonb(s),'conta',
   jsonb_build_object('id',conta.id,'confirmado',conta.email_confirmed_at is not null));
end;
$lib$;
revoke all on function portal_acesso.liberar_solicitacao(text,jsonb) from public,anon,authenticated,service_role;

create or replace function portal_acesso.executar_gestao(p_operacao text,p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 ator uuid:=auth.uid();
 v_modulo text;
 escrita boolean;
 alvo uuid;
 perfil uuid;
 existente jsonb;
 versao text;
 linha jsonb;
 item jsonb;
 cap jsonb;
 pagina integer;
 limite integer;
 busca text;
 status_filtro text;
 empresa_filtro text;
 v_inicio timestamptz;
 v_fim timestamptz;
 v_ativo boolean;
 v_herdar boolean;
 resultado jsonb;
begin
 if p_operacao in ('preparar_aprovacao','preparar_convite','registrar_convite')
    or (p_operacao='analisar_solicitacao' and p_dados->>'acao'='APROVAR') then
   return portal_acesso.liberar_solicitacao(p_operacao,p_dados);
 end if;
 v_modulo:=case
   when p_operacao in ('listar_usuarios','salvar_usuario','listar_atribuicoes','salvar_atribuicao','estado_atribuicao','catalogo_perfis') then 'usuarios'
   when p_operacao in ('listar_perfis','obter_perfil','salvar_perfil','excluir_perfil','listar_auditoria') then 'permissoes'
   when p_operacao in ('listar_solicitacoes','analisar_solicitacao') then 'solicitacoes_acesso'
   else null end;
 if v_modulo is null then raise exception using errcode='PT400',message='Operacao desconhecida.'; end if;
 escrita:=p_operacao in ('salvar_usuario','salvar_perfil','excluir_perfil','salvar_atribuicao','estado_atribuicao','analisar_solicitacao');
 -- Negar antes da trava evita enfileirar pedidos sem capacidade de gestao.
 if ator is null or not portal_acesso.tem_gestao(ator,v_modulo) then
   raise exception using errcode='42501',message='Permissao de gestao obrigatoria.';
 end if;
 if p_operacao in ('salvar_atribuicao','estado_atribuicao')
    and not portal_acesso.tem_gestao(ator,'permissoes') then
   raise exception using errcode='42501',message='Gestao de usuarios e permissoes obrigatorias para alterar concessoes.';
 end if;
 if escrita then
   perform pg_catalog.pg_advisory_xact_lock(1953751,1);
   -- Revalidar apos eventual espera: revogacao e expiracao nao podem ser ignoradas.
   if not portal_acesso.tem_gestao(ator,v_modulo)
      or (p_operacao in ('salvar_atribuicao','estado_atribuicao') and not portal_acesso.tem_gestao(ator,'permissoes')) then
     raise exception using errcode='42501',message='A permissao mudou ou venceu. Atualize a tela.';
   end if;
 end if;

 if p_operacao in ('obter_perfil','excluir_perfil') then
   perform portal_acesso.validar_campos(p_dados,case when escrita then array['id','versao'] else array['id'] end);
   alvo:=nullif(p_dados->>'id','')::uuid;
   select portal_acesso.perfil_json(p.id) into existente from portal_acesso.perfis p where p.id=alvo;
   if not found then raise exception using errcode='PT404',message='Perfil não encontrado.'; end if;
   if not escrita then return jsonb_build_object('perfil',existente); end if;
   perform 1 from portal_acesso.perfis p where p.id=alvo for update;
   if p_dados->>'versao' is distinct from existente->>'versao' then
     raise exception using errcode='PT409',message='O perfil mudou. Atualize a tela antes de excluir.';
   end if;
   -- Vínculos suspensos e vencidos também impedem exclusão.
   if exists(select 1 from portal_acesso.atribuicoes a where a.perfil_id=alvo) then
     raise exception using errcode='PT409',message='Este perfil possui usuários vinculados. Atribua outro perfil a esses usuários em Gestão de usuários antes de excluí-lo, inclusive nos vínculos suspensos ou vencidos.';
   end if;
   delete from portal_acesso.permissoes_perfil where perfil_id=alvo;
   delete from portal_acesso.perfis where id=alvo;
   return jsonb_build_object('ok',true);
 end if;

 if p_operacao in ('listar_usuarios','listar_perfis','catalogo_perfis','listar_auditoria','listar_solicitacoes') then
   perform portal_acesso.validar_campos(p_dados,array['busca','pagina','limite','status','empresa']);
   if (p_dados?'pagina' and (jsonb_typeof(p_dados->'pagina')<>'number' or p_dados->>'pagina' !~ '^[0-9]+$'))
      or (p_dados?'limite' and (jsonb_typeof(p_dados->'limite')<>'number' or p_dados->>'limite' !~ '^[0-9]+$'))
      or (p_dados?'busca' and jsonb_typeof(p_dados->'busca')<>'string') then
     raise exception using errcode='PT400',message='Filtros invalidos.';
   end if;
   pagina:=coalesce((p_dados->>'pagina')::integer,1);
   limite:=coalesce((p_dados->>'limite')::integer,25);
   busca:=btrim(coalesce(p_dados->>'busca',''));
   if pagina not between 1 and 100000 or limite not between 1 and 100 or length(busca)>254 then
     raise exception using errcode='PT400',message='Paginacao ou busca invalida.';
   end if;

   if p_operacao='listar_usuarios' then
     with lista as (
       select u.id usuario_id,u.email,(u.email_confirmed_at is not null) confirmado,
         coalesce(i.ativo,false) ativo,(i.user_id is not null) cadastrado,i.papel papel_legado,
         case when i.user_id is null then null else md5(to_jsonb(i)::text) end versao
       from auth.users u left join public.perfis_portal i on i.user_id=u.id
       where u.deleted_at is null and not coalesce(u.is_anonymous,false)
         and coalesce(u.email,'') ilike '%'||busca||'%'
     )
     select jsonb_build_object('total',(select count(*) from lista),'pagina',pagina,'limite',limite,
       'dados',coalesce((select jsonb_agg(to_jsonb(x) order by x.email,x.usuario_id)
          from (select * from lista order by email,usuario_id limit limite offset (pagina-1)*limite) x),'[]'::jsonb))
       into resultado;
   elsif p_operacao in ('listar_perfis','catalogo_perfis') then
     with lista as(select p.id,p.codigo from portal_acesso.perfis p
       where p.nome ilike '%'||busca||'%' or p.codigo ilike '%'||busca||'%')
     select jsonb_build_object('total',(select count(*) from lista),'pagina',pagina,'limite',limite,
       'dados',coalesce((select jsonb_agg(portal_acesso.perfil_json(x.id) order by x.codigo)
         from(select * from lista order by codigo limit limite offset (pagina-1)*limite) x),'[]'::jsonb))
       into resultado;
   elsif p_operacao='listar_auditoria' then
     select jsonb_build_object('total',(select count(*) from portal_acesso.auditoria),
       'pagina',pagina,'limite',limite,'dados',coalesce((select jsonb_agg(to_jsonb(x) order by x.ocorrido_em desc,x.id)
         from(select e.id,e.ocorrido_em,e.entidade,e.operacao,e.antes,e.depois,
           (select p.id from portal_acesso.perfis p where p.id::text=
             case when e.entidade='portal_acesso.perfis' then coalesce(e.depois->>'id',e.antes->>'id')
               else coalesce(e.depois->>'perfil_id',e.antes->>'perfil_id') end) perfil_atual_id,
           coalesce(u.email,'Manutencao administrativa') autor,
           (select u2.email from auth.users u2 where u2.id::text=coalesce(e.depois->>'user_id',e.antes->>'user_id',
             (select a2.user_id::text from portal_acesso.atribuicoes a2 where a2.id::text=coalesce(e.depois->>'atribuicao_id',e.antes->>'atribuicao_id')))) alvo
           from portal_acesso.auditoria e left join auth.users u on u.id=e.autor_id
           order by e.ocorrido_em desc,e.id limit limite offset (pagina-1)*limite) x),'[]'::jsonb))
       into resultado;
   else
     status_filtro:=coalesce(p_dados->>'status','TODOS');
     empresa_filtro:=coalesce(p_dados->>'empresa','TODAS');
     if status_filtro not in ('TODOS','PENDENTE','APROVADO','REJEITADO','CANCELADO') then
       raise exception using errcode='PT400',message='Status invalido.';
     end if;
     with lista as(select s.* from public.solicitacoes_acesso s
       where (status_filtro='TODOS' or s.status=status_filtro) and (empresa_filtro='TODAS' or s.empresa=empresa_filtro)
       and (s.email_corporativo ilike '%'||busca||'%' or s.nome_completo ilike '%'||busca||'%'
         or s.empresa ilike '%'||busca||'%' or s.cargo_funcao ilike '%'||busca||'%' or s.projeto_unidade ilike '%'||busca||'%'))
     select jsonb_build_object('total',(select count(*) from lista),'pagina',pagina,'limite',limite,
       'empresas',(select coalesce(jsonb_agg(e.empresa order by e.empresa),'[]'::jsonb) from(select distinct empresa from public.solicitacoes_acesso) e),
       'contagens',(select jsonb_build_object('pendentes',count(*) filter(where status='PENDENTE'),
         'aprovadas',count(*) filter(where status='APROVADO'),'rejeitadas',count(*) filter(where status='REJEITADO'),'total',count(*)) from public.solicitacoes_acesso),
       'dados',coalesce((select jsonb_agg(to_jsonb(x) order by x.criado_em desc,x.id)
         from(select * from lista order by criado_em desc,id limit limite offset (pagina-1)*limite) x),'[]'::jsonb))
       into resultado;
   end if;
   return resultado;
 end if;

 if p_operacao='listar_atribuicoes' then
   perform portal_acesso.validar_campos(p_dados,array['usuarioId']);
   alvo:=(p_dados->>'usuarioId')::uuid;
   if alvo is null then raise exception using errcode='PT400',message='Selecione uma conta.'; end if;
   return jsonb_build_object('dados',coalesce((select jsonb_agg(portal_acesso.atribuicao_json(a.id) order by a.id)
     from portal_acesso.atribuicoes a where a.user_id=alvo),'[]'::jsonb));
 end if;

 if p_operacao='salvar_usuario' then
   perform portal_acesso.validar_campos(p_dados,array['id','ativo','versao']);
   alvo:=(p_dados->>'id')::uuid;
   if alvo is null or jsonb_typeof(p_dados->'ativo') is distinct from 'boolean' then
     raise exception using errcode='PT400',message='Conta ou estado invalido.';
   end if;
   v_ativo:=(p_dados->>'ativo')::boolean;
   perform 1 from auth.users u where u.id=alvo and u.deleted_at is null
     and not coalesce(u.is_anonymous,false) and (not v_ativo or (u.email_confirmed_at is not null
       and not coalesce(u.banned_until>now(),false))) for share;
   if not found then raise exception using errcode='PT409',message='A conta deve existir, estar confirmada e apta para ativacao.'; end if;
   select md5(to_jsonb(i)::text) into versao from public.perfis_portal i where i.user_id=alvo for update;
   if found then
     if p_dados->>'versao' is distinct from versao then
       raise exception using errcode='PT409',message='O cadastro mudou. Atualize a tela antes de salvar.';
     end if;
     update public.perfis_portal set ativo=v_ativo,atualizado_em=clock_timestamp() where user_id=alvo;
   else
     if p_dados->>'versao' is not null then raise exception using errcode='PT409',message='O cadastro mudou. Atualize a tela.'; end if;
     insert into public.perfis_portal(user_id,papel,ativo) values(alvo,'USUARIO',v_ativo);
   end if;
   return jsonb_build_object('ok',true);
 elsif p_operacao='salvar_perfil' then
   perform portal_acesso.validar_campos(p_dados,array['id','codigo','nome','descricao','ativo','capacidades','versao']);
   alvo:=nullif(p_dados->>'id','')::uuid;
   if jsonb_typeof(p_dados->'ativo') is distinct from 'boolean'
      or jsonb_typeof(p_dados->'nome') is distinct from 'string'
      or length(btrim(p_dados->>'nome')) not between 1 and 150
      or length(coalesce(p_dados->>'descricao',''))>1000
      or jsonb_typeof(p_dados->'capacidades') is distinct from 'array'
      or jsonb_array_length(p_dados->'capacidades')>19 then
     raise exception using errcode='PT400',message='Revise o nome, estado e capacidades do perfil.';
   end if;
   for cap in select value from jsonb_array_elements(p_dados->'capacidades') loop
     perform portal_acesso.validar_campos(cap,array['modulo','acao']);
     if not portal_acesso.modulo_acao_valido(cap->>'modulo',cap->>'acao') then
       raise exception using errcode='PT400',message='Capacidade desconhecida.';
     end if;
   end loop;
   if (select count(distinct (x->>'modulo',x->>'acao')) from jsonb_array_elements(p_dados->'capacidades') x)
      <>jsonb_array_length(p_dados->'capacidades') then
     raise exception using errcode='PT400',message='Capacidades repetidas.';
   end if;
   if alvo is null then
     if jsonb_typeof(p_dados->'codigo') is distinct from 'string' or p_dados->>'codigo' !~ '^[a-z][a-z0-9_]{0,79}$'
        or p_dados->>'versao' is not null then
       raise exception using errcode='PT400',message='Codigo do perfil invalido.';
     end if;
     insert into portal_acesso.perfis(codigo,nome,descricao,ativo)
     values(p_dados->>'codigo',btrim(p_dados->>'nome'),coalesce(p_dados->>'descricao',''),(p_dados->>'ativo')::boolean)
     returning id into alvo;
   else
     select portal_acesso.perfil_json(p.id) into existente from portal_acesso.perfis p where p.id=alvo for update;
     if not found then raise exception using errcode='PT404',message='Perfil nao encontrado.'; end if;
     if p_dados->>'versao' is distinct from existente->>'versao'
        or p_dados->>'codigo' is distinct from existente->>'codigo' then
       raise exception using errcode='PT409',message='O perfil mudou. Atualize a tela antes de salvar.';
     end if;
     update portal_acesso.perfis set nome=btrim(p_dados->>'nome'),descricao=coalesce(p_dados->>'descricao',''),
       ativo=(p_dados->>'ativo')::boolean where id=alvo;
   end if;
   update portal_acesso.permissoes_perfil pp set ativo=false where pp.perfil_id=alvo and pp.ativo
     and not exists(select 1 from jsonb_array_elements(p_dados->'capacidades') c where c->>'modulo'=pp.modulo and c->>'acao'=pp.acao);
   for cap in select value from jsonb_array_elements(p_dados->'capacidades') loop
     insert into portal_acesso.permissoes_perfil as pp_nova(perfil_id,modulo,acao,ativo)
     values(alvo,cap->>'modulo',cap->>'acao',true)
     on conflict(perfil_id,modulo,acao) do update set ativo=true where not pp_nova.ativo;
   end loop;
   return jsonb_build_object('ok',true,'perfil',portal_acesso.perfil_json(alvo));
 elsif p_operacao in ('salvar_atribuicao','estado_atribuicao') then
   if p_operacao='estado_atribuicao' then
     perform portal_acesso.validar_campos(p_dados,array['id','ativo','versao']);
   else
     perform portal_acesso.validar_campos(p_dados,array['id','usuarioId','perfilId','ativo','inicio','fim','herdarPerfil','abrangencias','versao']);
   end if;
   if jsonb_typeof(p_dados->'ativo') is distinct from 'boolean' then
     raise exception using errcode='PT400',message='Estado invalido.';
   end if;
   v_ativo:=(p_dados->>'ativo')::boolean;
   alvo:=nullif(p_dados->>'id','')::uuid;
   if alvo is not null then
     select portal_acesso.atribuicao_json(a.id) into existente from portal_acesso.atribuicoes a where a.id=alvo for update;
     if not found then raise exception using errcode='PT404',message='Concessao nao encontrada.'; end if;
     if p_dados->>'versao' is distinct from existente->>'versao' then
       raise exception using errcode='PT409',message='A concessao mudou. Atualize a tela antes de salvar.';
     end if;
   elsif p_operacao='estado_atribuicao' or p_dados->>'versao' is not null then
     raise exception using errcode='PT400',message='Selecione a concessao.';
   end if;
   if p_operacao='estado_atribuicao' then
     update portal_acesso.atribuicoes set ativo=v_ativo where id=alvo;
     return jsonb_build_object('ok',true);
   end if;
   -- O novo fluxo delega integralmente as capacidades ao perfil.
   -- Chamadas legadas continuam restritas aos vinculos que ainda usam abrangencias.
   if p_dados ? 'herdarPerfil' and p_dados->'herdarPerfil' is distinct from 'true'::jsonb then
     raise exception using errcode='PT400',message='O vinculo deve herdar as permissoes do perfil.';
   end if;
   v_herdar:=coalesce(p_dados->'herdarPerfil'='true'::jsonb,false);
   if v_herdar and p_dados ? 'abrangencias' then
     raise exception using errcode='PT400',message='As permissoes sao definidas somente no perfil.';
   end if;
   if not v_herdar and existente->>'herdar_perfil'='true' then
     raise exception using errcode='PT409',message='Este vinculo herda o perfil. Atualize a tela.';
   end if;
   perfil:=(p_dados->>'perfilId')::uuid;
   if perfil is null or (p_dados->>'usuarioId')::uuid is null
      or (not v_herdar and (jsonb_typeof(p_dados->'abrangencias') is distinct from 'array'
      or jsonb_array_length(p_dados->'abrangencias') not between 1 and 19)) then
     raise exception using errcode='PT400',message='Selecione conta, perfil e abrangencias explicitas.';
   end if;
   if alvo is not null and existente->>'user_id' is distinct from p_dados->>'usuarioId' then
     raise exception using errcode='PT400',message='A conta de um vínculo existente não pode ser trocada.';
   end if;
   if alvo is not null and existente->>'perfil_id' is distinct from p_dados->>'perfilId' and not v_herdar then
     raise exception using errcode='PT400',message='A troca de perfil deve herdar as permissões do novo perfil.';
   end if;
   if exists(select 1 from portal_acesso.atribuicoes a where a.user_id=(p_dados->>'usuarioId')::uuid
      and a.perfil_id=perfil and (alvo is null or a.id<>alvo)) then
     raise exception using errcode='PT409',message='O usuário já possui um vínculo com o perfil selecionado. Escolha outro perfil.';
   end if;
   perform 1 from portal_acesso.perfis where id=perfil and portal_acesso.perfis.ativo for share;
   if not found then raise exception using errcode='PT409',message='O perfil deve estar ativo.'; end if;
   if exists(select 1 from (values('inicio'),('fim')) x(campo)
     where p_dados->x.campo is not null and p_dados->x.campo<>'null'::jsonb
     and (jsonb_typeof(p_dados->x.campo)<>'string'
       or p_dados->>x.campo !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$')) then
     raise exception using errcode='PT400',message='Informe datas UTC validas.';
   end if;
   v_inicio:=(p_dados->>'inicio')::timestamptz;
   v_fim:=(p_dados->>'fim')::timestamptz;
   if v_inicio is not null and v_fim is not null and v_inicio>=v_fim then
     raise exception using errcode='PT400',message='O vencimento deve ser posterior ao inicio.';
   end if;
   if alvo is null then
     insert into portal_acesso.atribuicoes(user_id,perfil_id,ativo,inicio,fim,herdar_perfil)
     values((p_dados->>'usuarioId')::uuid,perfil,v_ativo,v_inicio,v_fim,v_herdar) returning id into alvo;
   else
     -- Remover os escopos antes de trocar a chave composta do vínculo.
     delete from portal_acesso.abrangencias where atribuicao_id=alvo;
     update portal_acesso.atribuicoes set perfil_id=perfil,ativo=v_ativo,inicio=v_inicio,fim=v_fim,herdar_perfil=v_herdar where id=alvo;
   end if;
   if not v_herdar then
   for item in select value from jsonb_array_elements(p_dados->'abrangencias') loop
     perform portal_acesso.validar_campos(item,array['modulo','acao','tipo','unidades']);
     perform 1 from portal_acesso.permissoes_perfil pp where pp.perfil_id=perfil and pp.ativo
       and pp.modulo=item->>'modulo' and pp.acao=item->>'acao';
     if not found or not portal_acesso.abrangencia_valida(item->>'modulo',item->>'tipo',item->'unidades') then
       raise exception using errcode='PT400',message='Abrangencia vazia, invalida ou fora das capacidades ativas do perfil.';
     end if;
     insert into portal_acesso.abrangencias(atribuicao_id,perfil_id,modulo,acao,tipo,unidades)
     values(alvo,perfil,item->>'modulo',item->>'acao',item->>'tipo',item->'unidades');
   end loop;
   end if;
   return jsonb_build_object('ok',true,'atribuicao',portal_acesso.atribuicao_json(alvo));
 elsif p_operacao='analisar_solicitacao' then
   perform portal_acesso.validar_campos(p_dados,array['id','acao','observacao']);
   alvo:=(p_dados->>'id')::uuid;
   if alvo is null or p_dados->>'acao' not in ('APROVAR','REJEITAR')
      or p_dados->>'acao' is null or length(coalesce(p_dados->>'observacao',''))>2000 then
     raise exception using errcode='PT400',message='Acao ou observacao invalida.';
   end if;
   update public.solicitacoes_acesso set status=case p_dados->>'acao' when 'APROVAR' then 'APROVADO' else 'REJEITADO' end,
     analisado_em=clock_timestamp(),analisado_por=ator,observacao_analise=nullif(btrim(p_dados->>'observacao'),''),
     atualizado_em=clock_timestamp() where id=alvo and status='PENDENTE' returning to_jsonb(solicitacoes_acesso.*) into linha;
   if not found then raise exception using errcode='PT409',message='A solicitacao nao existe ou ja foi analisada.'; end if;
   insert into portal_acesso.auditoria(autor_id,sessao_banco,papel_sessao,entidade,operacao,antes,depois)
   values(ator,session_user,current_setting('role',true),'public.solicitacoes_acesso','UPDATE',
     jsonb_build_object('id',alvo,'status','PENDENTE'),
     jsonb_build_object('id',alvo,'status',linha->>'status','analisado_por',ator));
   return jsonb_build_object('ok',true,'solicitacao',linha);
 end if;
 raise exception using errcode='PT400',message='Operacao desconhecida.';
end;
$$;
commit;
