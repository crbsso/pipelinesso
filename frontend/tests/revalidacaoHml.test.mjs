import assert from "node:assert/strict";
import test from "node:test";
import { revalidarGestao } from "../../tools/permissionamento-hml/public/revalidacao.js";
import { carregarContextoAcesso } from "../src/lib/auth/carregarContextoAcesso.ts";
import { requirePermission } from "../src/lib/auth/requirePermission.ts";
const helpers = { carregar: carregarContextoAcesso, permissao: requirePermission };
function preparar() {
  const inicio = new Date(Date.now() - 1000).toISOString();
  const fim = new Date(new Date(inicio).getTime() + 86400000).toISOString();
  const referencia = { token: "token_ficticio_apenas_em_memoria", usuarioId: "pessoa_teste", inicio, fim };
  const estado = { ativo: false, token: referencia.token, rpc: 0, logins: 0, erro: false };
  const cliente = {
    auth: {
      getSession: async () => ({ data: { session: { access_token: estado.token } }, error: null }),
      getUser: async () => ({ data: { user: { id: referencia.usuarioId } }, error: null }),
      signInWithPassword: async () => { estado.logins++; throw new Error("Nao deve efetuar login"); },
    },
    rpc: async () => {
      estado.rpc++;
      return { error: estado.erro ? new Error("falha ficticia") : null, data: {
        usuarioId: referencia.usuarioId, ativo: true, perfis: [{
          perfil: "administracao_acessos_hml", ativo: estado.ativo, inicio, fim,
          concessoes: ["usuarios","permissoes","solicitacoes_acesso"].map(modulo => ({
            modulo, acoes: ["gerenciar"], abrangencia: { tipo: "corporativa" },
          })),
        }],
      }};
    },
  };
  return { referencia, estado, cliente };
}
test("suspensao e reativacao sao observadas na mesma sessao sem novo login", async () => {
  const { referencia, estado, cliente } = preparar();
  assert.equal((await revalidarGestao(cliente, referencia, false, helpers)).ok, true);
  estado.ativo = true;
  const reativado = await revalidarGestao(cliente, referencia, true, helpers);
  assert.equal(reativado.ok, true);
  assert.equal(estado.logins, 0);
  assert.equal(estado.rpc, 10);
  assert.equal(JSON.stringify(reativado).includes(referencia.token), false);
});
test("troca de token nao pode ser relatada como continuidade de sessao", async () => {
  const { referencia, estado, cliente } = preparar();
  estado.token = "outra_sessao_ficticia";
  assert.equal((await revalidarGestao(cliente, referencia, false, helpers)).ok, false);
  assert.equal(estado.rpc, 0);
});
test("falha de permissao nao conta como revogacao bem sucedida", async () => {
  const { referencia, estado, cliente } = preparar();
  estado.erro = true;
  assert.equal((await revalidarGestao(cliente, referencia, false, helpers)).ok, false);
});
test("revogacao nao pode prorrogar silenciosamente o vencimento", async () => {
  const { referencia, cliente } = preparar();
  referencia.fim = new Date(new Date(referencia.fim).getTime() + 1000).toISOString();
  assert.equal((await revalidarGestao(cliente, referencia, false, helpers)).ok, false);
});
test("identidade invalida interrompe a revalidacao antes de consultar concessoes", async () => {
  const { referencia, estado, cliente } = preparar();
  cliente.auth.getUser = async () => ({ data: { user: null }, error: new Error("erro ficticio") });
  assert.equal((await revalidarGestao(cliente, referencia, false, helpers)).ok, false);
  assert.equal(estado.rpc, 0);
});
