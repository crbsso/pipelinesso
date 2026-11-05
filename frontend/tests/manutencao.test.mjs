import assert from 'node:assert/strict';
import test from 'node:test';
import {periodoAno,periodoMes,formatarDataManutencao,filtrarManutencao,resumirManutencao,FILTROS_VAZIOS,filtrarPeriodoManutencao,serieMensalManutencao,seriePorVisaoManutencao} from '../src/lib/inspecoes/manutencao.ts';
test('manutencao: janela mensal e exclusiva e dezembro passa para o proximo ano',()=>{
 assert.deepEqual(periodoMes('2026-12'),{inicio:'2026-12-01',fim:'2027-01-01'});
 assert.deepEqual(periodoMes('2028-02'),{inicio:'2028-02-01',fim:'2028-03-01'});
 for(const mes of ['2026-13','2026-00','2026-1','9999-12','0000-01','2026-10-01',''])assert.equal(periodoMes(mes),null);
});
test('manutencao: horario SQL permanece em Brasilia sem conversao do navegador',()=>{
 assert.equal(formatarDataManutencao('2026-10-01T00:07:22.613'),'01/10/2026 00:07');
 assert.equal(formatarDataManutencao('2026-10-31 23:59:59.000'),'31/10/2026 23:59');
 assert.equal(formatarDataManutencao('invalido'),'—');
});
test('manutencao: filtros se combinam e todos os indicadores usam o conjunto filtrado',()=>{
 const base={id_inspecao:1,ficha_id:1,aba_id:1,ativo_id:10,data_inspecao:'2026-10-01T07:00:00',concessao:'A',localizacao:'SE 1',familia:'EPIs',tipo:'Cinto',periodicidade:'Mensal',publicado_em:'2026-11-04T12:00:00Z'};
 const dados=[base,{...base,id_inspecao:2},{...base,id_inspecao:3,concessao:'B',ativo_id:20},{...base,id_inspecao:4,familia:'Extintores',tipo:'SE 1',ativo_id:null}];
 const filtrados=filtrarManutencao(dados,{...FILTROS_VAZIOS,familia:'EPIs',concessao:'A'});
 assert.equal(filtrados.length,2);assert.deepEqual(resumirManutencao(filtrados),{total:2,ativos:1,tipos:1,familias:[{familia:'EPIs',total:2}]});
 assert.equal(resumirManutencao(dados).ativos,2);assert.equal(filtrarManutencao(dados,{...FILTROS_VAZIOS,localizacao:'inexistente'}).length,0);
 assert.deepEqual(resumirManutencao([]),{total:0,ativos:0,tipos:0,familias:[]});
});

test('manutencao: consulta anual aceita somente ano completo e usa fim exclusivo',()=>{
 assert.deepEqual(periodoAno('2026'),{inicio:'2026-01-01',fim:'2027-01-01'});
 assert.deepEqual(periodoAno('9998'),{inicio:'9998-01-01',fim:'9999-01-01'});
 for(const ano of ['','2026-10','26','20260','1899','9999','2026 '])assert.equal(periodoAno(ano),null);
});

const registro=(id,data,familia='EPIs')=>({id_inspecao:id,ficha_id:1,aba_id:1,ativo_id:null,data_inspecao:data,concessao:'A',localizacao:'SE 1',familia,tipo:'Tipo',periodicidade:'Mensal',publicado_em:'2026-11-04T15:00:00Z'});

test('manutencao: recortes mensal trimestral e anual respeitam o horario local nas fronteiras',()=>{
 const dados=[registro(1,'2025-12-31T23:59:59'),registro(2,'2026-01-01T00:00:00'),registro(3,'2026-09-30T23:59:59'),registro(4,'2026-10-01T00:00:00'),registro(5,'2026-12-31T23:59:59'),registro(6,'2027-01-01T00:00:00')];
 const ids=(visao,mes)=>filtrarPeriodoManutencao(dados,'2026',visao,mes).map(item=>item.id_inspecao);
 assert.deepEqual(ids('mensal',9),[4]);assert.deepEqual(ids('trimestral',9),[4,5]);assert.deepEqual(ids('trimestral',8),[3]);assert.deepEqual(ids('anual',9),[2,3,4,5]);
});

test('manutencao: ausencia de publicacao difere de zero no filtro e nao usa registros de outro ano',()=>{
 const publicados=[registro(1,'2026-10-01T00:00:00'),registro(2,'2026-10-31T23:59:59','Veículos'),registro(3,'2025-01-02T10:00:00')];
 const filtrados=filtrarManutencao(publicados,{...FILTROS_VAZIOS,familia:'inexistente'});
 const meses=serieMensalManutencao(filtrados,publicados,'2026');
 assert.equal(meses.length,12);assert.equal(meses[9].total,0);assert.equal(meses[9].mesesComDados,1);assert.equal(meses[0].total,null);assert.equal(meses[0].mesesComDados,0);
 assert.equal(serieMensalManutencao(publicados,publicados,'2026')[9].total,2);
});

test('manutencao: trimestre parcial e acumulado nao preenchem lacunas com zero',()=>{
 const dados=[registro(1,'2026-10-01T08:00:00'),registro(2,'2026-12-01T08:00:00'),registro(3,'2026-12-02T08:00:00')];
 const meses=serieMensalManutencao(dados,dados,'2026'),antes=structuredClone(meses);
 const trimestres=seriePorVisaoManutencao(meses,'trimestral');
 assert.deepEqual(trimestres[3],{rotulo:'4º tri',total:3,mesesComDados:2,mesesEsperados:3});assert.equal(trimestres[0].total,null);
 const acumulado=seriePorVisaoManutencao(meses,'anual');
 assert.equal(acumulado[0].total,null);assert.equal(acumulado[9].total,1);assert.equal(acumulado[10].total,null);assert.equal(acumulado[11].total,3);assert.equal(acumulado[11].mesesComDados,2);
 assert.deepEqual(meses,antes);
});

test('manutencao: somente os projetos de homologacao e producao aprovados habilitam a aba',async()=>{
 const {ambienteManutencaoDisponivel,HML_MANUTENCAO_URL,PROD_MANUTENCAO_URL}=await import('../src/lib/inspecoes/manutencao.ts');
 assert.equal(ambienteManutencaoDisponivel(HML_MANUTENCAO_URL),true);
 assert.equal(ambienteManutencaoDisponivel(PROD_MANUTENCAO_URL),true);
 for(const url of [undefined,'','http://lkhidajhsqgebjltyicb.supabase.co','https://outro.supabase.co',PROD_MANUTENCAO_URL+'.atacante.test']) assert.equal(ambienteManutencaoDisponivel(url),false);
});