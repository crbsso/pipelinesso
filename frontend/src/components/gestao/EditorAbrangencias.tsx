"use client";
import type { Capacidade, Escopo } from "@/lib/gestao/contratos";
import { RECURSOS_GESTAO } from "@/lib/gestao/contratos";
import { campo, secundario } from "./GestaoUI";
export default function EditorAbrangencias({ capacidades, valor, alterar }: { capacidades: Capacidade[]; valor: Escopo[]; alterar: (v: Escopo[]) => void ;}) {
  function substituir(cap: Capacidade, novo: Escopo | null) {
    alterar([...valor.filter(e => e.modulo !== cap.modulo || e.acao !== cap.acao), ...(novo ? [novo] : [])]);
  }
  return <fieldset className="space-y-4">
    <legend className="mb-2 font-semibold">O que esta pessoa poderá acessar</legend>
    <p className="text-sm text-gray-500">Selecione as abas que esta pessoa poderá acessar. A consulta de cada aba inclui todos os dados da empresa.</p>
    {capacidades.filter(c => c.ativo !== false).map(cap => {
      const recurso = RECURSOS_GESTAO[cap.modulo], escopo = valor.find(e => e.modulo === cap.modulo && e.acao === cap.acao);
      const id = "abrangencia-" + cap.modulo;
      return <div key={cap.modulo} className="rounded-lg border border-gray-200 p-4">
        <label htmlFor={id} className="font-medium">{recurso.nome}</label>
        <select id={id} className={campo + " mt-2"} value={escopo?.tipo ?? ""} onChange={e => {
          const tipo = e.target.value;
          substituir(cap, tipo ? { modulo: cap.modulo, acao: cap.acao, tipo: tipo as Escopo["tipo"], unidades: tipo === "restrita" ? [{}] : [] } : null);
        }}>
          <option value="">Sem concessão</option>
          {escopo?.tipo === "restrita" && <option value="restrita">Restrição anterior (sem acesso à aba nesta versão)</option>}
          <option value="corporativa">{cap.acao === "gerenciar" ? "Gestão em toda a empresa" : "Consulta de toda a empresa"}</option>
        </select>
        {escopo?.tipo === "restrita" && <div className="mt-3 space-y-3">
          {escopo.unidades.map((unidade, indice) => <div key={indice} className="rounded border border-gray-200 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(recurso.campos).map(([nome, rotulo]) => <label key={nome} className="text-sm">{rotulo}
                <input className={campo + " mt-1"} value={unidade[nome] ?? ""} maxLength={200}
                  onChange={e => substituir(cap, { ...escopo, unidades: escopo.unidades.map((u, i) => i === indice ? { ...u, [nome]: e.target.value } : u) })} />
              </label>)}
            </div>
            <button type="button" className={secundario + " mt-3"} onClick={() => substituir(cap, { ...escopo, unidades: escopo.unidades.filter((_, i) => i !== indice) })}>Remover unidade {indice + 1}</button>
          </div>)}
          <button type="button" className={secundario} onClick={() => substituir(cap, { ...escopo, unidades: [...escopo.unidades, {}] })}>Adicionar unidade</button>
          {cap.modulo.startsWith("motoristas") && <p className="text-xs text-gray-500">Uma seção RM sempre deve vir acompanhada da coligada correspondente.</p>}
        </div>}
      </div>;
    })}
  </fieldset>;
}
