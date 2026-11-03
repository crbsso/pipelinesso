import assert from "node:assert/strict";
import test from "node:test";
import { avaliarAcesso, resolverAbrangencia } from "../src/lib/auth/politicaAcesso.ts";

const agora = new Date("2026-10-29T15:00:00.000Z");
const opcoes = { agora };
const unidadeA = { coligada: "A", secao_rm: "1" };
const unidadeB = { coligada: "B", secao_rm: "2" };
const corporativa = { tipo: "corporativa" };
const restrita = (...unidades) => ({ tipo: "restrita", unidades });
const concessao = (abrangencia, modulo = "motoristas", acoes = ["consultar"]) =>
  ({ modulo, acoes, abrangencia });
const perfil = (concessoes, extras = {}) =>
  ({ perfil: "equipe_tecnica", ativo: true, concessoes, ...extras });
const contexto = (...perfis) => ({ usuarioId: "usuario-de-teste", ativo: true, perfis });
const consultar = (usuario, atributos, ajustes = {}) =>
  avaliarAcesso(usuario, "motoristas", "consultar", atributos, { ...opcoes, ...ajustes });
const permitido = { permitido: true };
const negarPor = (motivo) => ({ permitido: false, motivo });

test("tecnico consulta somente as unidades atribuidas, sem cruzar coligadas e secoes", () => {
  const usuario = contexto(perfil([concessao(restrita(unidadeA, unidadeB))]));
  assert.deepEqual(consultar(usuario, unidadeA), permitido);
  assert.deepEqual(consultar(usuario, unidadeB), permitido);
  for (const registro of [
    { coligada: "A", secao_rm: "2" },
    { coligada: "B", secao_rm: "1" },
    { coligada: "C", secao_rm: "1" },
    { coligada: "A" },
    {},
    null,
  ]) assert.deepEqual(consultar(usuario, registro), negarPor("FORA_DA_ABRANGENCIA"));
});

test("perfis distintos somam somente as combinacoes expressamente atribuidas", () => {
  const usuario = contexto(
    perfil([concessao(restrita(unidadeA))]),
    perfil([concessao(restrita(unidadeB))], { perfil: "apoio_temporario" }),
  );
  assert.deepEqual(consultar(usuario, unidadeB), permitido);
  assert.deepEqual(consultar(usuario, { coligada: "A", secao_rm: "2" }), negarPor("FORA_DA_ABRANGENCIA"));
});

test("corporativo exige concessao explicita para aquele modulo e acao", () => {
  const usuario = contexto(perfil([concessao(corporativa)], { perfil: "gestao_sso" }));
  assert.deepEqual(consultar(usuario, { coligada: "C", secao_rm: "3" }), permitido);
  assert.deepEqual(avaliarAcesso(usuario, "avcb", "consultar", {}, opcoes), negarPor("SEM_CONCESSAO"));
  assert.deepEqual(avaliarAcesso(usuario, "permissoes", "gerenciar", {}, opcoes), negarPor("SEM_CONCESSAO"));
});

test("nome de cargo ou perfil administrativo nao concede poderes sozinho", () => {
  for (const nome of ["gestao_sso", "ADMIN_SSO", "admin", "terceiro"]) {
    const usuario = contexto(perfil([], { perfil: nome }));
    assert.deepEqual(consultar(usuario, unidadeA), negarPor("SEM_CONCESSAO"));
  }
});

test("gestao de acessos e consulta dos paineis sao capacidades independentes", () => {
  const usuario = contexto(perfil([concessao(corporativa, "usuarios", ["gerenciar"])]));
  assert.deepEqual(avaliarAcesso(usuario, "usuarios", "gerenciar", {}, opcoes), permitido);
  assert.deepEqual(avaliarAcesso(usuario, "permissoes", "gerenciar", {}, opcoes), negarPor("SEM_CONCESSAO"));
  assert.deepEqual(consultar(usuario, unidadeA), negarPor("SEM_CONCESSAO"));
});

test("usuario inativo perde inclusive uma concessao corporativa administrativa", () => {
  const usuario = { ...contexto(perfil([concessao(corporativa, "permissoes", ["gerenciar"])])), ativo: false };
  assert.deepEqual(avaliarAcesso(usuario, "permissoes", "gerenciar", {}, opcoes), negarPor("USUARIO_INATIVO"));
});

test("perfil inativo nao libera a sua abrangencia", () => {
  const usuario = contexto(
    perfil([concessao(restrita(unidadeA))]),
    perfil([concessao(corporativa)], { ativo: false }),
  );
  assert.deepEqual(consultar(usuario, unidadeB), negarPor("FORA_DA_ABRANGENCIA"));
});

test("acesso temporario comeca no inicio e termina exatamente no vencimento", () => {
  const usuario = contexto(perfil([concessao(restrita(unidadeA))], {
    perfil: "externo",
    inicio: "2026-10-29T15:00:00Z",
    fim: "2026-10-30T15:00:00.000Z",
  }));
  assert.deepEqual(consultar(usuario, unidadeA), permitido);
  assert.deepEqual(consultar(usuario, unidadeA, { agora: new Date("2026-10-29T14:59:59.999Z") }), negarPor("SEM_CONCESSAO"));
  assert.deepEqual(consultar(usuario, unidadeA, { agora: new Date("2026-10-30T15:00:00.000Z") }), negarPor("SEM_CONCESSAO"));
});

test("a expiracao de um perfil nao remove outra concessao ainda valida", () => {
  const usuario = contexto(
    perfil([concessao(corporativa)], { fim: "2026-10-29T15:00:00Z" }),
    perfil([concessao(restrita(unidadeA))]),
  );
  assert.deepEqual(consultar(usuario, unidadeA), permitido);
  assert.deepEqual(consultar(usuario, unidadeB), negarPor("FORA_DA_ABRANGENCIA"));
});

test("permissao nao habilita recurso bloqueado operacionalmente", () => {
  const usuario = contexto(perfil([concessao(corporativa, "motoristas_velocidade")]));
  assert.deepEqual(avaliarAcesso(usuario, "motoristas_velocidade", "consultar", {}, {
    ...opcoes, recursoHabilitado: false,
  }), negarPor("RECURSO_INDISPONIVEL"));
});

test("permissao de Motoristas nao herda automaticamente Historico, Direcao ou Velocidade", () => {
  const usuario = contexto(perfil([concessao(corporativa)]));
  for (const modulo of ["motoristas_historico", "motoristas_direcao", "motoristas_velocidade"]) {
    assert.deepEqual(avaliarAcesso(usuario, modulo, "consultar", {}, opcoes), negarPor("SEM_CONCESSAO"));
  }
});

test("AVCB usa sua propria abrangencia de projeto e instalacao", () => {
  const usuario = contexto(perfil([concessao(restrita({ projeto: "P1", instalacao: "I1" }), "avcb")]));
  assert.deepEqual(avaliarAcesso(usuario, "avcb", "consultar", { projeto: "P1", instalacao: "I1" }, opcoes), permitido);
  assert.deepEqual(avaliarAcesso(usuario, "avcb", "consultar", { projeto: "P2", instalacao: "I1" }, opcoes), negarPor("FORA_DA_ABRANGENCIA"));
});

test("uma coligada inteira so e permitida quando a concessao e explicitamente dessa amplitude", () => {
  const usuario = contexto(perfil([concessao(restrita({ coligada: "A" }))]));
  assert.deepEqual(consultar(usuario, { coligada: "A", secao_rm: "99" }), permitido);
  assert.deepEqual(consultar(usuario, { coligada: "B", secao_rm: "99" }), negarPor("FORA_DA_ABRANGENCIA"));
});

test("lista sem concessao nunca representa acesso corporativo", () => {
  assert.deepEqual(consultar(contexto(), unidadeA), negarPor("SEM_CONCESSAO"));
  assert.deepEqual(consultar(contexto(perfil([])), unidadeA), negarPor("SEM_CONCESSAO"));
  assert.deepEqual(consultar(contexto(perfil([concessao(restrita())])), unidadeA), negarPor("CONTEXTO_INVALIDO"));
});

test("contextos malformados falham de forma fechada, inclusive junto de concessao corporativa", () => {
  const invalidos = [null, {}, { ativo: true, perfis: [] }, { ...contexto(), ativo: "true" },
    contexto(perfil([concessao(restrita({}))])),
    contexto(perfil([concessao(restrita({ coligada: "" }))])),
    contexto(perfil([concessao(restrita({ projeto: "P1" }))])),
    contexto(perfil([concessao({ tipo: "corporativa", unidades: [unidadeA] })])),
    contexto(perfil([concessao(corporativa, "modulo_inexistente")])),
    contexto(perfil([concessao(corporativa, "motoristas", ["exportar"])])),
    contexto(perfil([concessao(corporativa)]), perfil([concessao(restrita({}))])),
  ];
  for (const usuario of invalidos) assert.deepEqual(consultar(usuario, unidadeA), negarPor("CONTEXTO_INVALIDO"));
});

test("vigencias invalidas ou datas normalizadas silenciosamente nao sao aceitas", () => {
  for (const extras of [
    { inicio: "2026-02-30T15:00:00Z" },
    { fim: "2026-10-29" },
    { inicio: "2026-10-30T15:00:00Z", fim: "2026-10-29T15:00:00Z" },
    { inicio: "2026-10-29T15:00:00Z", fim: "2026-10-29T15:00:00Z" },
    { fim: null },
  ]) assert.deepEqual(consultar(contexto(perfil([concessao(corporativa)], extras)), unidadeA), negarPor("CONTEXTO_INVALIDO"));
});

test("modulo ou acao desconhecido, relogio invalido e flag invalida nao liberam acesso", () => {
  const usuario = contexto(perfil([concessao(corporativa)]));
  for (const modulo of ["inexistente", "__proto__", "constructor", "toString", "", null]) {
    assert.deepEqual(resolverAbrangencia(usuario, modulo, "consultar", opcoes), negarPor("PEDIDO_INVALIDO"));
  }
  assert.deepEqual(resolverAbrangencia(usuario, "motoristas", "gerenciar", opcoes), negarPor("PEDIDO_INVALIDO"));
  assert.deepEqual(consultar(usuario, unidadeA, { agora: new Date("invalida") }), negarPor("PEDIDO_INVALIDO"));
  assert.deepEqual(consultar(usuario, unidadeA, { recursoHabilitado: "true" }), negarPor("PEDIDO_INVALIDO"));
});

test("a abrangencia retornada para consultas preserva tuplas e nao compartilha objetos do contexto", () => {
  const usuario = contexto(perfil([concessao(restrita(unidadeA, unidadeB))]));
  const resultado = resolverAbrangencia(usuario, "motoristas", "consultar", opcoes);
  assert.deepEqual(resultado, { permitido: true, abrangencia: restrita(unidadeA, unidadeB) });
  resultado.abrangencia.unidades[0].coligada = "C";
  assert.deepEqual(consultar(usuario, { coligada: "C", secao_rm: "1" }), negarPor("FORA_DA_ABRANGENCIA"));
});

test("secao sem coligada nao e uma abrangencia valida", () => {
  const usuario = contexto(perfil([concessao(restrita({ secao_rm: "1" }))]));
  assert.deepEqual(consultar(usuario, unidadeA), negarPor("CONTEXTO_INVALIDO"));
});

test("listas esparsas nao provocam erro nem sao interpretadas como concessoes validas", () => {
  const invalidos = [
    { ...contexto(), perfis: new Array(1) },
    contexto(perfil(new Array(1))),
    contexto(perfil([concessao({ tipo: "restrita", unidades: new Array(1) })])),
    contexto(perfil([concessao(corporativa, "motoristas", new Array(1))])),
  ];
  for (const usuario of invalidos) assert.deepEqual(consultar(usuario, unidadeA), negarPor("CONTEXTO_INVALIDO"));
  assert.deepEqual(consultar(contexto(), unidadeA, { agora: "2026-10-29" }), negarPor("PEDIDO_INVALIDO"));
});
