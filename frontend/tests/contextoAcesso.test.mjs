import assert from "node:assert/strict";
import test from "node:test";
import { carregarContextoAcesso } from "../src/lib/auth/carregarContextoAcesso.ts";
import { requirePermission } from "../src/lib/auth/requirePermission.ts";

const id = "00000000-0000-4000-8000-000000000001";
const agora = new Date("2026-10-29T15:00:00Z");
const contexto = () => ({ usuarioId: id, ativo: true, perfis: [{
  perfil: "equipe_tecnica", ativo: true,
  concessoes: [{ modulo: "motoristas", acoes: ["consultar"],
    abrangencia: { tipo: "restrita", unidades: [{ coligada: "A", secao_rm: "1" }] } }],
}] });
function cliente(dados = contexto()) {
  const chamadas = [];
  return {
    chamadas,
    auth: { async getUser() { chamadas.push("identidade"); return { data: { user: { id } }, error: null }; } },
    async rpc(...args) { chamadas.push(args); return { data: dados, error: null }; },
  };
}

test("o contexto e solicitado somente depois da identidade e sem user_id ou filtros", async () => {
  const c = cliente();
  const resultado = await carregarContextoAcesso(c);
  assert.equal(resultado.ok, true);
  assert.deepEqual(c.chamadas, ["identidade", ["obter_contexto_acesso_portal"]]);
});

test("sessao ausente ou rejeitada nao consulta permissoes", async () => {
  for (const resposta of [
    { data: { user: null }, error: null },
    { data: { user: { id } }, error: { message: "token invalido" } },
  ]) {
    const c = cliente();
    c.auth.getUser = async () => resposta;
    assert.deepEqual(await carregarContextoAcesso(c), { ok: false, status: 401, codigo: "NAO_AUTENTICADO" });
    assert.deepEqual(c.chamadas, []);
  }
});

test("resposta com identidade divergente nao e aproveitada", async () => {
  const dados = { ...contexto(), usuarioId: "00000000-0000-4000-8000-000000000002" };
  assert.deepEqual(await carregarContextoAcesso(cliente(dados)), {
    ok: false, status: 503, codigo: "AUTORIZACAO_INDISPONIVEL",
  });
});

test("falhas de banco e de transporte nao geram acesso nem expõem detalhes internos", async () => {
  const segredoFicticio = "DETALHE_INTERNO_NAO_DEVE_SAIR";
  for (const forma of ["retorno", "excecao", "autenticacao"]) {
    const c = cliente();
    if (forma === "retorno") c.rpc = async () => ({ data: contexto(), error: { message: segredoFicticio } });
    if (forma === "excecao") c.rpc = async () => { throw new Error(segredoFicticio); };
    if (forma === "autenticacao") c.auth.getUser = async () => { throw new Error(segredoFicticio); };
    const resultado = await requirePermission(c, "motoristas", "consultar", { agora });
    assert.deepEqual(resultado, { ok: false, status: 503, codigo: "AUTORIZACAO_INDISPONIVEL" });
    assert.equal(JSON.stringify(resultado).includes(segredoFicticio), false);
  }
});

test("payload incompleto ou abrangencia invalida causa indisponibilidade sem fallback", async () => {
  for (const dados of [null, [], {}, { ...contexto(), ativo: "true" }, {
    ...contexto(), perfis: [{ ...contexto().perfis[0], concessoes: [{
      modulo: "motoristas", acoes: ["consultar"], abrangencia: { tipo: "restrita", unidades: [] },
    }] }],
  }]) assert.deepEqual(await carregarContextoAcesso(cliente(dados)), {
    ok: false, status: 503, codigo: "AUTORIZACAO_INDISPONIVEL",
  });
});

test("usuario inativo e sem concessoes sao negacoes distintas", async () => {
  assert.deepEqual(await requirePermission(cliente({ ...contexto(), ativo: false }), "motoristas", "consultar"), {
    ok: false, status: 403, codigo: "USUARIO_INATIVO",
  });
  assert.deepEqual(await requirePermission(cliente({ ...contexto(), perfis: [] }), "motoristas", "consultar"), {
    ok: false, status: 403, codigo: "SEM_CONCESSAO",
  });
});

test("o helper entrega a abrangencia exata que a futura consulta deve aplicar", async () => {
  assert.deepEqual(await requirePermission(cliente(), "motoristas", "consultar", { agora }), {
    ok: true, usuarioId: id,
    abrangencia: { tipo: "restrita", unidades: [{ coligada: "A", secao_rm: "1" }] },
  });
});

test("revogacao e lida novamente na requisicao seguinte, sem reaproveitar contexto anterior", async () => {
  const dados = contexto();
  const c = cliente(dados);
  assert.equal((await requirePermission(c, "motoristas", "consultar", { agora })).ok, true);
  dados.perfis[0].concessoes = [];
  assert.deepEqual(await requirePermission(c, "motoristas", "consultar", { agora }), {
    ok: false, status: 403, codigo: "SEM_CONCESSAO",
  });
  assert.equal(c.chamadas.filter(Array.isArray).length, 2);
});

test("vigencia e gate operacional permanecem aplicados depois do carregamento", async () => {
  const dados = contexto();
  dados.perfis[0].fim = "2026-10-29T15:00:00Z";
  assert.deepEqual(await requirePermission(cliente(dados), "motoristas", "consultar", { agora }), {
    ok: false, status: 403, codigo: "SEM_CONCESSAO",
  });
  assert.deepEqual(await requirePermission(cliente(), "motoristas", "consultar", { agora, recursoHabilitado: false }), {
    ok: false, status: 404, codigo: "RECURSO_INDISPONIVEL",
  });
});
