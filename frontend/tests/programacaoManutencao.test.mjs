import assert from "node:assert/strict";
import test from "node:test";
import { construirMetas, consolidarCargas } from "../src/lib/inspecoes/programacao.ts";

const ordem = (id, mes="2026-10", concessao="A") => ({os_id:id,plano_id:197,concessao,localizacao:"SE 1",equipamento_id:null,data_prevista:mes+"-01",data_original:mes+"-01",data_final_real:null,estagio:"Finalizado"});
const atividade = (id, os, tipo, status=2) => ({atividade_os_id:id,os_id:os,atividade_id:tipo,status});
const programacao = ordens => ({inicio:"2026-10-01",fim_exclusivo:"2026-12-01",fim_realizacoes_exclusivo:"2026-12-01",ordens,vinculos:[]});

test("cada inspecao tem meta propria; estado da OS nao conclui automaticamente suas atividades",()=>{
 const metas=construirMetas(programacao([ordem(1),ordem(2)]),[atividade(1,1,7911),atividade(2,2,7911,1),atividade(3,1,7918,3)]);
 const epi=metas.find(m=>m.familia==="Inspeção de EPIs"),ext=metas.find(m=>m.familia==="Inspeção em Extintores de Incêndio");
 assert.equal(epi.quantidade,2);assert.equal(epi.realizadas,1);
 assert.equal(ext.quantidade,1);assert.equal(ext.realizadas,0);assert.equal(ext.outrosEstados,1);
 assert.equal(metas.find(m=>m.familia==="Inspeção em Veículos").quantidade,0);
});
test("metas preservam competencia, concessao e modalidade comprovada",()=>{
 const metas=construirMetas(programacao([ordem(1),ordem(2,"2026-11","B")]),[atividade(1,1,7911),atividade(2,2,7911)]);
 assert.equal(metas.filter(m=>m.mes==="2026-10"&&m.concessao==="A"&&m.tipo==="Cinto de segurança").reduce((s,m)=>s+m.quantidade,0),1);
 assert.equal(metas.filter(m=>m.mes==="2026-10"&&m.concessao==="B").length,0);
});
test("duplicacoes e atividades sem vinculo nao geram metas infladas",()=>{
 const p=programacao([ordem(1)]),a=atividade(1,1,7911);
 assert.throws(()=>construirMetas(p,[a,a]),/duplicada/);
 assert.throws(()=>construirMetas(p,[a,{...a,atividade_os_id:2}]),/obrigação/);
 assert.throws(()=>construirMetas(p,[{...a,os_id:999}]),/fora/);
 assert.throws(()=>construirMetas(programacao([ordem(1),ordem(1)]),[]),/duplicada/);
});
test("formulario repetido nao aumenta meta nem realizado da programacao",()=>{
 const carga={competencia:"2026-10-01",extraido_em:"2026-11-05T12:00:00Z",conteudo:{versao:1,origem:"SQL Server Intranet",dados:[{id_inspecao:1},{id_inspecao:2},{id_inspecao:3}],programacao:programacao([ordem(1)]),atividades:[atividade(1,1,7911)]}};
 const c=consolidarCargas([carga]),m=c.metasPorTipo.find(m=>m.tipo==="Cinto de segurança");
 assert.equal(c.dados.length,3);assert.equal(m.quantidade,1);assert.equal(m.realizadas,1);
 assert.throws(()=>consolidarCargas([carga,carga]),/duplicada/);
});
