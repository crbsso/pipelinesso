import assert from "node:assert/strict";
import test from "node:test";
import {abasDoContexto, rotaPermitida, ROTAS_EM_PREPARACAO, ABAS_POR_ROTA, MODULOS_CONSULTA} from "../src/lib/auth/acessoAbas.ts";
const contexto = (modulos, extra={}) => ({usuarioId:"gestor",ativo:true,perfis:[{perfil:"nome_sem_privilegio",ativo:true,...extra,
 concessoes:modulos.map(modulo=>({modulo,acoes:[["usuarios","permissoes","solicitacoes_acesso"].includes(modulo)?"gerenciar":"consultar"],abrangencia:{tipo:"corporativa"}}))}]});
test("perfil com todas as abas ve todas as opcoes incluindo Em preparacao",()=>{
 const abas=abasDoContexto(contexto([...MODULOS_CONSULTA,"usuarios","permissoes","solicitacoes_acesso"]));
 assert.equal(Object.keys(abas).length,19);
 for(const rota of Object.keys(ABAS_POR_ROTA))assert.equal(rotaPermitida(rota,abas),true,rota);
 assert.equal(rotaPermitida("/rota-inexistente",abas),false);
});
test("nome administrador, permissao ausente, vinculo suspenso ou vencido nao liberam abas",()=>{
 for(const c of [contexto(["usuarios","permissoes","solicitacoes_acesso"]),contexto(["avcb"]),contexto([...MODULOS_CONSULTA],{ativo:false}),contexto([...MODULOS_CONSULTA],{fim:"2020-01-01T00:00:00.000Z"})]){
  c.perfis[0].perfil="Administrador";const abas=abasDoContexto(c);
  for(const rota of ROTAS_EM_PREPARACAO)assert.equal(rotaPermitida(rota,abas),false);
 }
 const abas=abasDoContexto(contexto(["sipat"]));
 assert.equal(rotaPermitida("/consultas/programas-sso/sipat",abas),true);
 assert.equal(rotaPermitida("/consultas/programas-sso/rota-segura",abas),false);
});
