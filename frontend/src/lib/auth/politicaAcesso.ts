/**
 * Regras puras de autorizacao. O contexto deve ser carregado pelo servidor
 * a partir da identidade autenticada e de concessoes administradas.
 * Este modulo nao autentica usuarios, consulta o banco ou libera rotas.
 */
const RECURSOS = {
  avcb: {
    nome: "AVCB",
    acoes: ["consultar"],
    dimensoes: ["projeto", "subestacao", "instalacao"],
  },
  inspecoes: {
    nome: "Inspeções",
    acoes: ["consultar"],
    dimensoes: ["area_organizacional", "local", "empresa_colaborador", "setor_colaborador"],
  },
  planos_acao: {
    nome: "Planos de Ação",
    acoes: ["consultar"],
    dimensoes: ["nivel_organizacional", "grupo_sso"],
  },
  acoes_corretivas: {
    nome: "Ações Corretivas",
    acoes: ["consultar"],
    dimensoes: ["nivel_organizacional", "grupo_sso"],
  },
  motoristas: {
    nome: "Motoristas",
    acoes: ["consultar"],
    dimensoes: ["coligada", "secao_rm"],
  },
  motoristas_historico: {
    nome: "Histórico de Motoristas",
    acoes: ["consultar"],
    dimensoes: ["coligada", "secao_rm"],
  },
  motoristas_direcao: {
    nome: "Direção",
    acoes: ["consultar"],
    dimensoes: ["coligada", "secao_rm"],
  },
  motoristas_velocidade: {
    nome: "Velocidade",
    acoes: ["consultar"],
    dimensoes: ["coligada", "secao_rm"],
  },
  solicitacoes_acesso: {
    nome: "Solicitações de acesso",
    acoes: ["gerenciar"],
    dimensoes: [],
  },
  usuarios: {
    nome: "Usuários",
    acoes: ["gerenciar"],
    dimensoes: [],
  },
  permissoes: {
    nome: "Permissões",
    acoes: ["gerenciar"],
    dimensoes: [],
  },
} as const;

export type ModuloPortal = keyof typeof RECURSOS;
export type AcaoPortal = "consultar" | "gerenciar";

/** Campos de uma mesma unidade sao combinados com E; unidades, com OU. */
export type UnidadeAutorizada = Readonly<Record<string, string>>;
export type Abrangencia =
  | { readonly tipo: "corporativa" }
  | { readonly tipo: "restrita"; readonly unidades: readonly UnidadeAutorizada[] };

export type Concessao = {
  readonly modulo: ModuloPortal;
  readonly acoes: readonly AcaoPortal[];
  readonly abrangencia: Abrangencia;
};

export type AtribuicaoPerfil = {
  /** Identificador administrado; o nome do perfil nao concede poderes. */
  readonly perfil: string;
  readonly ativo: boolean;
  readonly concessoes: readonly Concessao[];
  /** UTC ISO 8601: inicio inclusivo, fim exclusivo. */
  readonly inicio?: string;
  readonly fim?: string;
};

export type ContextoAutorizacao = {
  readonly usuarioId: string;
  readonly ativo: boolean;
  readonly perfis: readonly AtribuicaoPerfil[];
};

export type MotivoNegacao =
  | "CONTEXTO_INVALIDO"
  | "USUARIO_INATIVO"
  | "PEDIDO_INVALIDO"
  | "RECURSO_INDISPONIVEL"
  | "SEM_CONCESSAO"
  | "FORA_DA_ABRANGENCIA";

type Negado = { readonly permitido: false; readonly motivo: MotivoNegacao };
export type ResultadoAbrangencia =
  | Negado
  | { readonly permitido: true; readonly abrangencia: Abrangencia };
export type ResultadoAcesso = Negado | { readonly permitido: true };

function registro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

function moduloValido(valor: unknown): valor is ModuloPortal {
  return typeof valor === "string" && Object.hasOwn(RECURSOS, valor);
}

function acaoValida(modulo: ModuloPortal, acao: unknown): acao is AcaoPortal {
  const acoes: readonly string[] = RECURSOS[modulo].acoes;
  return typeof acao === "string" && acoes.includes(acao);
}

function instanteUtc(valor: unknown): number | null {
  if (typeof valor !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(valor)) return null;
  const instante = Date.parse(valor);
  if (!Number.isFinite(instante)) return null;
  const canonico = new Date(instante).toISOString();
  const esperado = valor.includes(".") ? valor : valor.replace("Z", ".000Z");
  return canonico === esperado ? instante : null;
}

function abrangenciaValida(valor: unknown, modulo: ModuloPortal): valor is Abrangencia {
  if (!registro(valor)) return false;
  if (valor.tipo === "corporativa") return Object.keys(valor).length === 1;
  if (valor.tipo !== "restrita" || !Array.isArray(valor.unidades) ||
      valor.unidades.length === 0 || valor.unidades.length > 1000 ||
      Object.keys(valor).length !== 2) return false;

  const dimensoes: readonly string[] = RECURSOS[modulo].dimensoes;
  return Array.from(valor.unidades).every((unidade: unknown) => {
    if (!registro(unidade)) return false;
    // A mesma secao pode existir em coligadas diferentes.
    if (Object.hasOwn(unidade, "secao_rm") && !Object.hasOwn(unidade, "coligada")) return false;
    const campos = Object.keys(unidade);
    return campos.length > 0 && campos.every((campo) =>
      dimensoes.includes(campo) && texto(unidade[campo]));
  });
}

function concessaoValida(valor: unknown): valor is Concessao {
  if (!registro(valor) || !moduloValido(valor.modulo) ||
      !Array.isArray(valor.acoes) || valor.acoes.length === 0) return false;
  const modulo = valor.modulo;
  return Array.from(valor.acoes).every((acao: unknown) => acaoValida(modulo, acao)) &&
    abrangenciaValida(valor.abrangencia, modulo);
}

function perfilValido(valor: unknown): valor is AtribuicaoPerfil {
  if (!registro(valor) || !texto(valor.perfil) || typeof valor.ativo !== "boolean" ||
      !Array.isArray(valor.concessoes) || valor.concessoes.length > 1000 ||
      !Array.from(valor.concessoes).every(concessaoValida)) return false;
  const inicio = valor.inicio === undefined ? -Infinity : instanteUtc(valor.inicio);
  const fim = valor.fim === undefined ? Infinity : instanteUtc(valor.fim);
  return inicio !== null && fim !== null && inicio < fim;
}

export function validarContextoAutorizacao(valor: unknown): valor is ContextoAutorizacao {
  return registro(valor) && texto(valor.usuarioId) && typeof valor.ativo === "boolean" &&
    Array.isArray(valor.perfis) && valor.perfis.length <= 1000 && Array.from(valor.perfis).every(perfilValido);
}

function negar(motivo: MotivoNegacao): Negado {
  return { permitido: false, motivo };
}

/**
 * Retorna a abrangencia para uma futura consulta protegida.
 * permitido=true NUNCA dispensa aplicar a abrangencia a todos os dados e agregados.
 * A versao de acesso por abas aceita somente abrangencia corporativa explicita.
 */
export function resolverAbrangencia(
  contexto: unknown,
  modulo: unknown,
  acao: unknown,
  opcoes: { agora?: Date; recursoHabilitado?: boolean } = {},
): ResultadoAbrangencia {
  const referencia = opcoes.agora ?? new Date();
  const agora = referencia instanceof Date ? referencia.getTime() : NaN;
  if (!Number.isFinite(agora) ||
      (opcoes.recursoHabilitado !== undefined && typeof opcoes.recursoHabilitado !== "boolean") ||
      !moduloValido(modulo) || !acaoValida(modulo, acao)) return negar("PEDIDO_INVALIDO");
  if (opcoes.recursoHabilitado === false) return negar("RECURSO_INDISPONIVEL");
  if (!validarContextoAutorizacao(contexto)) return negar("CONTEXTO_INVALIDO");
  if (!contexto.ativo) return negar("USUARIO_INATIVO");

  const unidades: UnidadeAutorizada[] = [];
  let corporativa = false;
  for (const perfil of contexto.perfis) {
    const inicio = perfil.inicio === undefined ? -Infinity : instanteUtc(perfil.inicio)!;
    const fim = perfil.fim === undefined ? Infinity : instanteUtc(perfil.fim)!;
    if (!perfil.ativo || agora < inicio || agora >= fim) continue;
    for (const concessao of perfil.concessoes) {
      if (concessao.modulo !== modulo || !concessao.acoes.includes(acao)) continue;
      if (concessao.abrangencia.tipo === "corporativa") corporativa = true;
      else unidades.push(...concessao.abrangencia.unidades.map((unidade) => ({ ...unidade })));
    }
  }
  if (corporativa) return { permitido: true, abrangencia: { tipo: "corporativa" } };
  if (unidades.length === 0) return negar("SEM_CONCESSAO");
  return { permitido: true, abrangencia: { tipo: "restrita", unidades } };
}

/** Avalia um registro; valores ausentes nao satisfazem uma restricao. */
export function avaliarAcesso(
  contexto: unknown,
  modulo: unknown,
  acao: unknown,
  atributos: unknown,
  opcoes: { agora?: Date; recursoHabilitado?: boolean } = {},
): ResultadoAcesso {
  const resultado = resolverAbrangencia(contexto, modulo, acao, opcoes);
  if (!resultado.permitido) return resultado;
  if (resultado.abrangencia.tipo === "corporativa") return { permitido: true };
  if (!registro(atributos)) return negar("FORA_DA_ABRANGENCIA");

  const corresponde = resultado.abrangencia.unidades.some((unidade) =>
    Object.entries(unidade).every(([campo, valor]) =>
      Object.hasOwn(atributos, campo) && atributos[campo] === valor));
  return corresponde ? { permitido: true } : negar("FORA_DA_ABRANGENCIA");
}
