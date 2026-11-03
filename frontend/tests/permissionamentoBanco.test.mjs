import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { carregarContextoAcesso } from "../src/lib/auth/carregarContextoAcesso.ts";
import { requirePermission } from "../src/lib/auth/requirePermission.ts";
import { avaliarAcesso } from "../src/lib/auth/politicaAcesso.ts";

const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const C = "00000000-0000-4000-8000-000000000003";
const P1 = "10000000-0000-4000-8000-000000000001";
const P2 = "10000000-0000-4000-8000-000000000002";
const T1 = "20000000-0000-4000-8000-000000000001";
const T2 = "20000000-0000-4000-8000-000000000002";
const E1 = "30000000-0000-4000-8000-000000000001";
const agora = new Date("2026-10-29T15:00:00Z");

async function lerMigration(sufixo) {
  const pasta = new URL("../../supabase/migrations/", import.meta.url);
  const nomes = (await readdir(pasta)).filter((n) => n.endsWith(sufixo));
  assert.equal(nomes.length, 1, "Selecionar exclusivamente uma migration deste pacote");
  return readFile(new URL(nomes[0], pasta), "utf8");
}

test("SQL de permissionamento e carregamento integrados em PostgreSQL descartavel", async (t) => {
  const db = new PGlite(); // sem caminho: banco somente em memoria
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      grant usage on schema auth to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      create table public.mart_canario_permissionamento(id integer primary key);
      alter table public.mart_canario_permissionamento enable row level security;
      create policy canario_leitura on public.mart_canario_permissionamento for select to authenticated using(true);
    `);
    t.diagnostic("PostgreSQL local: " + (await db.query("show server_version")).rows[0].server_version);
    const antes = (await db.query(`select relacl::text, relrowsecurity from pg_class
      where oid = 'public.mart_canario_permissionamento'::regclass`)).rows;
    await db.query("insert into auth.users(id) values ($1),($2),($3)", [A, B, C]);
    const primeira = await lerMigration("_preparar_gestao_acesso_portal.sql");
    await db.exec(primeira);
    assert.equal((await db.query("select count(*)::int as n from public.perfis_portal")).rows[0].n, 0);
    await db.query("insert into public.perfis_portal(user_id,papel) values ($1,'ADMIN_SSO')", [A]);
    await db.exec(primeira); // base preexistente tambem deve ser preservada
    await db.exec(await lerMigration("_criar_permissionamento_portal.sql"));

    await t.test("schema preexistente interrompe a migration sem alterar objetos", async () => {
      await assert.rejects(db.exec(await lerMigration("_criar_permissionamento_portal.sql")),
        (error) => error.code === "42P06");
      await db.exec("rollback");
      assert.equal((await db.query("select count(*)::int as n from public.perfis_portal")).rows[0].n, 1);
      assert.equal((await db.query("select count(*)::int as n from portal_acesso.perfis")).rows[0].n, 0);
    });

    async function como(papel, uid, trabalho) {
      assert.ok(["anon", "authenticated", "service_role"].includes(papel));
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
      await db.exec(`set role ${papel}`);
      try { return await trabalho(); }
      finally {
        await db.exec("reset role");
        await db.query("select set_config('request.jwt.claim.sub', '', false)");
      }
    }
    function cliente(uid) {
      return {
        auth: { async getUser() { return { data: { user: { id: uid } }, error: null }; } },
        async rpc(...args) {
          assert.deepEqual(args, ["obter_contexto_acesso_portal"]);
          try {
            const r = await como("authenticated", uid, () => db.query("select public.obter_contexto_acesso_portal() as contexto"));
            return { data: r.rows[0].contexto, error: null };
          } catch (error) { return { data: null, error }; }
        },
      };
    }
    const negado = (error) => error.code === "42501";
    const violacaoCheck = (error) => error.code === "23514";

    await t.test("prepara a base sem escolher administrador ou conceder novos acessos", async () => {
      assert.deepEqual((await db.query("select user_id,papel,ativo from public.perfis_portal")).rows,
        [{ user_id: A, papel: "ADMIN_SSO", ativo: true }]);
      assert.equal((await db.query("select count(*)::int as n from portal_acesso.perfis")).rows[0].n, 0);
      assert.deepEqual(await requirePermission(cliente(A), "motoristas", "consultar", { agora }),
        { ok: false, status: 403, codigo: "SEM_CONCESSAO" });
      assert.deepEqual((await db.query(`select relacl::text, relrowsecurity from pg_class
        where oid = 'public.mart_canario_permissionamento'::regclass`)).rows, antes);
    });

    await t.test("tabelas novas e RPC nao ficam abertas pelas permissoes padrao do public", async () => {
      for (const papel of ["anon", "authenticated", "service_role"]) {
        for (const tabela of ["perfis", "permissoes_perfil", "atribuicoes", "abrangencias", "auditoria"]) {
          assert.equal((await db.query("select has_table_privilege($1,$2,'SELECT') as p", [papel, `portal_acesso.${tabela}`])).rows[0].p, false);
          assert.equal((await db.query("select has_table_privilege($1,$2,'TRUNCATE') as p", [papel, `portal_acesso.${tabela}`])).rows[0].p, false);
        }
      }
      for (const papel of ["anon", "service_role"]) {
        await assert.rejects(como(papel, A, () => db.query("select public.obter_contexto_acesso_portal()")), negado);
      }
      await assert.rejects(como("authenticated", A, () => db.query("select * from portal_acesso.perfis")), negado);
      await assert.rejects(como("authenticated", A, () => db.query("select * from public.perfis_portal")), negado);
      await assert.rejects(como("authenticated", A, () => db.query("select portal_acesso.abrangencia_valida('motoristas','corporativa','[]')")), negado);
    });

    await t.test("consulta exige identidade e nao possui parametro para escolher outra conta", async () => {
      await assert.rejects(como("authenticated", null, () => db.query("select public.obter_contexto_acesso_portal()")), negado);
      await assert.rejects(como("authenticated", A, () => db.query("select public.obter_contexto_acesso_portal($1::uuid)", [B])),
        (error) => error.code === "42883");
      assert.deepEqual(await carregarContextoAcesso(cliente(C)), { ok: false, status: 403, codigo: "USUARIO_INATIVO" });
    });

    await db.query("insert into public.perfis_portal(user_id,papel) values ($1,'USUARIO')", [B]);
    await db.query("insert into portal_acesso.perfis(id,codigo,nome) values ($1,'tecnica','Equipe tecnica'),($2,'outro','Outro perfil')", [P1,P2]);
    await db.query(`insert into portal_acesso.permissoes_perfil(perfil_id,modulo,acao)
      values ($1,'motoristas','consultar'),($2,'motoristas','consultar')`, [P1,P2]);
    await db.query(`insert into portal_acesso.atribuicoes(id,user_id,perfil_id,inicio,fim)
      values ($1,$2,$3,'2026-10-01T00:00:00Z','2026-11-01T00:00:00Z'),
      ($4,$5,$3,null,null)`, [T1,A,P1,T2,B]);
    await db.query(`insert into portal_acesso.abrangencias(id,atribuicao_id,perfil_id,modulo,acao,tipo,unidades)
      values ($1,$2,$3,'motoristas','consultar','restrita',$4::jsonb),
      (gen_random_uuid(),$5,$3,'motoristas','consultar','restrita',$6::jsonb)`,
      [E1,T1,P1,JSON.stringify([{coligada:"A",secao_rm:"1"},{coligada:"B",secao_rm:"2"}]),T2,JSON.stringify([{coligada:"B",secao_rm:"2"}])]);

    await t.test("banco e helper concordam sobre identidade, vigencia UTC e unidades de cada pessoa", async () => {
      const a = await carregarContextoAcesso(cliente(A));
      const b = await carregarContextoAcesso(cliente(B));
      assert.equal(a.ok, true);
      assert.equal(b.ok, true);
      assert.equal(a.contexto.usuarioId, A);
      assert.equal(b.contexto.usuarioId, B);
      assert.equal(a.contexto.perfis[0].inicio, "2026-10-01T00:00:00.000Z");
      assert.equal(a.contexto.perfis[0].fim, "2026-11-01T00:00:00.000Z");
      assert.equal(b.contexto.perfis[0].inicio, undefined);
      assert.equal(avaliarAcesso(a.contexto,"motoristas","consultar",{coligada:"A",secao_rm:"1"},{agora}).permitido,true);
      assert.equal(avaliarAcesso(a.contexto,"motoristas","consultar",{coligada:"A",secao_rm:"2"},{agora}).permitido,false);
      assert.equal(avaliarAcesso(b.contexto,"motoristas","consultar",{coligada:"A",secao_rm:"1"},{agora}).permitido,false);
      assert.equal((await requirePermission(cliente(A),"motoristas","consultar",{agora})).ok,true);
    });

    await t.test("SQL rejeita abrangencias vazias, sem coligada e com campos de outro modulo", async () => {
      for (const unidades of [[],[{}],[{secao_rm:"1"}],[{projeto:"P1"}],[{coligada:""}],[{coligada:1}]]) {
        await assert.rejects(db.query("update portal_acesso.abrangencias set unidades=$1::jsonb where id=$2",[JSON.stringify(unidades),E1]),violacaoCheck);
      }
      await assert.rejects(db.query("update portal_acesso.abrangencias set tipo='corporativa' where id=$1",[E1]),violacaoCheck);
      await assert.rejects(db.query("insert into portal_acesso.permissoes_perfil(perfil_id,modulo,acao) values($1,'motoristas','gerenciar')",[P1]),violacaoCheck);
    });

    await t.test("abrangencia nao pode ampliar o perfil ou associar-se a outro perfil", async () => {
      await assert.rejects(db.query("update portal_acesso.abrangencias set perfil_id=$1 where id=$2",[P2,E1]),(e)=>e.code==="23503");
      await assert.rejects(db.query(`insert into portal_acesso.abrangencias(atribuicao_id,perfil_id,modulo,acao,tipo)
        values($1,$2,'avcb','consultar','corporativa')`,[T1,P1]),(e)=>e.code==="23503");
    });

    await t.test("mudanca de abrangencia e revogacao sao observadas sem novo login", async () => {
      const c = cliente(A);
      assert.equal((await requirePermission(c,"motoristas","consultar",{agora})).ok,true);
      await db.query("update portal_acesso.permissoes_perfil set ativo=false where perfil_id=$1",[P1]);
      assert.deepEqual(await requirePermission(c,"motoristas","consultar",{agora}),{ok:false,status:403,codigo:"SEM_CONCESSAO"});
      await db.query("update portal_acesso.permissoes_perfil set ativo=true where perfil_id=$1",[P1]);
      await db.query("update portal_acesso.abrangencias set tipo='corporativa',unidades='[]'::jsonb where id=$1",[E1]);
      assert.deepEqual((await requirePermission(c,"motoristas","consultar",{agora})).abrangencia,{tipo:"corporativa"});
      await db.query("update portal_acesso.abrangencias set tipo='restrita',unidades=$1::jsonb where id=$2",[JSON.stringify([{coligada:"A",secao_rm:"1"}]),E1]);
    });

    await t.test("estado da identidade, do perfil e da atribuicao restringem acesso", async () => {
      for (const [tabela, coluna, valor] of [["public.perfis_portal","user_id",A],["portal_acesso.perfis","id",P1],["portal_acesso.atribuicoes","id",T1]]) {
        await db.query(`update ${tabela} set ativo=false where ${coluna}=$1`,[valor]);
        assert.equal((await requirePermission(cliente(A),"motoristas","consultar",{agora})).ok,false);
        await db.query(`update ${tabela} set ativo=true where ${coluna}=$1`,[valor]);
      }
      assert.deepEqual(await requirePermission(cliente(A),"motoristas","consultar",{agora:new Date("2026-11-01T00:00:00Z")}),{ok:false,status:403,codigo:"SEM_CONCESSAO"});
      await assert.rejects(db.query("update portal_acesso.atribuicoes set fim=inicio where id=$1",[T1]),violacaoCheck);
    });

    await t.test("auditoria registra a mudanca na mesma transacao e nao e gravavel pelo cliente", async () => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
      await db.query("update portal_acesso.perfis set nome='Nome ajustado' where id=$1",[P1]);
      const evento = (await db.query(`select autor_id,antes,depois from portal_acesso.auditoria
        where entidade='portal_acesso.perfis' and operacao='UPDATE' order by ocorrido_em desc limit 1`)).rows[0];
      assert.equal(evento.autor_id,A);
      assert.equal(evento.antes.nome,"Equipe tecnica");
      assert.equal(evento.depois.nome,"Nome ajustado");
      await db.query("select set_config('request.jwt.claim.sub','',false)");
      const n = (await db.query("select count(*)::int as n from portal_acesso.auditoria")).rows[0].n;
      await db.exec("begin");
      await db.query("update portal_acesso.perfis set nome='A desfazer' where id=$1",[P1]);
      await db.exec("rollback");
      assert.equal((await db.query("select count(*)::int as n from portal_acesso.auditoria")).rows[0].n,n);
      assert.equal((await db.query("select nome from portal_acesso.perfis where id=$1",[P1])).rows[0].nome,"Nome ajustado");
      await assert.rejects(como("authenticated", A, () => db.query("delete from portal_acesso.auditoria")),negado);
    });
  } finally { await db.close(); }
});
