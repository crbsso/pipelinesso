import assert from 'node:assert/strict';
import test from 'node:test';
import { REGRAS_CICLOS,cicloDaRegra,validarPosicoesCiclo,resumirCiclo,paginarCiclo,coligadaDaConcessao,celulaCsvCiclo } from '../src/lib/inspecoes/ciclosManutencao.ts';
import { consolidarCargas } from '../src/lib/inspecoes/programacao.ts';
const regra=id=>REGRAS_CICLOS.find(r=>r.id===id);
const filtros=(extra={})=>({mes:'2026-11',regra:'veic',coligada:'',local:'',grupo:'',...extra});
const unidade=(chave,registros,concessao='CRTE',grupo='VU')=>({chave,nome:'Unidade '+chave,concessao,localizacao:'SE 1',grupo,registros,com_respostas:registros>0});
const posicao=(extra={})=>({regra_id:'veic',data_corte:'2026-11-16',inicio_ciclo:'2026-11-01',fim_ciclo:'2026-11-30',registros:3,unidades_no_recorte:3,unidades_com_registro:2,unidades_com_respostas:2,populacao:'provisoria',detalhe:'completo',unidades:[unidade('1',2),unidade('2',1,'SITE','VP'),unidade('3',0)],fonte:'SQL conferido',...extra});
test('ciclos de calendário, bimestre, trimestre e demanda respeitam as decisões',()=>{
 assert.deepEqual(cicloDaRegra(regra('carga-149'),'2026-11'),{inicio:'2026-11-01',fim:'2026-12-31'});
 assert.deepEqual(cicloDaRegra(regra('epi-468'),'2024-02'),{inicio:'2024-01-01',fim:'2024-02-29'});
 assert.deepEqual(cicloDaRegra(regra('inst'),'2026-10'),{inicio:'2026-10-01',fim:'2026-12-31'});
 assert.deepEqual(cicloDaRegra(regra('sso-153'),'2026-11'),{inicio:null,fim:null});
 assert.equal(cicloDaRegra(regra('inst'),'2026-13'),null);
 assert.equal(new Set(REGRAS_CICLOS.map(r=>r.ficha)).size,7);assert.ok(!REGRAS_CICLOS.some(r=>r.ficha===33));
});
test('população e registros individuais conciliam; duplicidade e cobertura impossível falham',()=>{
 assert.equal(validarPosicoesCiclo([posicao()],'2026-11-01').length,1);
 assert.throws(()=>validarPosicoesCiclo([posicao(),posicao()],'2026-11-01'),/duplicada/);
 assert.throws(()=>validarPosicoesCiclo([posicao({unidades_com_registro:4})],'2026-11-01'),/inconsistentes/);
 assert.throws(()=>validarPosicoesCiclo([posicao({registros:4})],'2026-11-01'),/concilia/);
 assert.throws(()=>validarPosicoesCiclo([posicao({unidades:[unidade('1',2),unidade('1',1),unidade('3',0)]})],'2026-11-01'),/duplicada/);
 assert.throws(()=>validarPosicoesCiclo([posicao({inicio_ciclo:'2026-10-01'})],'2026-11-01'),/divergente/);
 assert.throws(()=>validarPosicoesCiclo([posicao({data_corte:'2026-02-31'})],'2026-02-01'),/corte/);
});
test('coligada e grupo recalculam a mesma população; atividade repetida não multiplica cobertura',()=>{
 const p=posicao(),todos=resumirCiclo([], [p], [], filtros());
 assert.equal(todos.registros,3);assert.equal(todos.populacao,3);assert.equal(todos.comRegistro,2);assert.equal(todos.semRegistro,1);
 const crte=resumirCiclo([], [p], [], filtros({coligada:'24'}));
 assert.equal(crte.registros,2);assert.equal(crte.populacao,2);assert.equal(crte.comRegistro,1);assert.equal(crte.semRegistro,1);
 const vp=resumirCiclo([], [p], [], filtros({grupo:'VP'}));assert.equal(vp.registros,1);assert.equal(vp.populacao,1);
 assert.equal(coligadaDaConcessao('BMUDI'),'sem_correspondencia');
 const vazio=resumirCiclo([], [p], [], filtros({coligada:'1'}));assert.equal(vazio.populacao,0);assert.equal(vazio.registros,0);
});
test('lista parcial não permite inventar população de coligada; unidade comprovada pode ser selecionada',()=>{
 const p=posicao({regra_id:'ext',registros:46,unidades_no_recorte:64,unidades_com_registro:46,unidades_com_respostas:45,detalhe:'somente_sem_registro',unidades:Array.from({length:18},(_,i)=>unidade('aba:'+i,0,null,null))});
 validarPosicoesCiclo([p],'2026-11-01');
 const regional=resumirCiclo([], [p], [], filtros({regra:'ext',coligada:'14'}));assert.equal(regional.populacao,null);assert.equal(regional.registros,null);
 const local=resumirCiclo([], [p], [], filtros({regra:'ext',local:'aba:0'}));assert.equal(local.populacao,1);assert.equal(local.comRegistro,0);assert.equal(local.registros,0);
});
test('posição de novembro não pode ser reutilizada em outubro e recorte ausente não significa zero',()=>{
 assert.equal(resumirCiclo([], [posicao()], [], filtros({mes:'2026-10'})).registros,null);
 const meses=[{mes:'2026-11',data_corte:'2026-11-17',fichas:[1,11,13,15,16,17,18]}];
 assert.equal(resumirCiclo([], [], meses, filtros({grupo:'VP'})).registros,null);
 assert.equal(resumirCiclo([], [], meses, filtros({regra:'ferr-eat'})).registros,null);
 assert.equal(resumirCiclo([], [], meses, filtros({regra:'carga-148'})).registros,0);
 assert.equal(resumirCiclo([], [], [], filtros({regra:'carga-148'})).registros,null);
});
test('população com concessão desconhecida não cria zero confirmado para uma coligada',()=>{
 const p=posicao({unidades:[unidade('1',2,null),unidade('2',1,'SITE','VP'),unidade('3',0)]});
 const r=resumirCiclo([], [p], [], filtros({coligada:'24'}));
 assert.equal(r.populacao,null);assert.equal(r.registros,null);assert.equal(r.registrosMes,null);
 assert.match(r.motivo,/coligada/);
 const sem=resumirCiclo([], [p], [], filtros({coligada:'sem_correspondencia'}));assert.equal(sem.populacao,1);assert.equal(sem.registros,2);
});
test('IDs repetidos são deduplicados, retirada/devolução e registros posteriores ao corte são excluídos',()=>{
 const d={id_inspecao:1,ficha_id:11,aba_id:106,data_inspecao:'2026-11-02T08:00:00',concessao:'CRTE',localizacao:'SE 1',ativo_id:1,familia:'Veículos',tipo:'Mensal',periodicidade:'Mensal',publicado_em:''};
 const dados=[d,{...d},{...d,id_inspecao:2,aba_id:104},{...d,id_inspecao:3,aba_id:105},{...d,id_inspecao:4,data_inspecao:'2026-11-18T08:00:00'}];
 const meses=[{mes:'2026-11',data_corte:'2026-11-17',fichas:[11]}];
 const r=resumirCiclo(dados,[],meses,filtros());assert.equal(r.registros,1);assert.equal(r.registrosMes,1);assert.equal(r.populacao,null);
});
test('paginação mostra 10/10/9 unidades e limita a página depois de filtrar',()=>{
 const dados=Array.from({length:29},(_,i)=>i);
 assert.equal(paginarCiclo(dados,1).linhas.length,10);assert.equal(paginarCiclo(dados,2).linhas.length,10);assert.equal(paginarCiclo(dados,3).linhas.length,9);
 assert.equal(paginarCiclo(dados.slice(0,4),3).pagina,1);assert.deepEqual(paginarCiclo([],5).linhas,[]);
});
test('carga antiga continua aceita; posições opcionais e cortes de mês não quebram a programação',()=>{
 const carga={competencia:'2026-11-01',extraido_em:'2026-11-17T12:00:00Z',conteudo:{versao:1,origem:'SQL Server Intranet',dados:[],atividades:[],programacao:{inicio:'2026-11-01',fim_exclusivo:'2026-12-01',fim_realizacoes_exclusivo:'2026-12-01',ordens:[],vinculos:[]}}};
 assert.equal(consolidarCargas([carga]).mesesCarregados[0].data_corte,'2026-11-17');
 carga.conteudo.posicoes_ciclo=[posicao()];assert.equal(consolidarCargas([carga]).posicoesCiclo.length,1);
 carga.conteudo.posicoes_ciclo=[posicao({data_corte:'2026-11-18'})];assert.throws(()=>consolidarCargas([carga]),/posterior/);
});
test('CSV diferencia null de zero, preserva aspas e neutraliza fórmulas',()=>{
 assert.equal(celulaCsvCiclo(null),'""');assert.equal(celulaCsvCiclo(0),'"0"');assert.equal(celulaCsvCiclo('=1+1'),'"\'=1+1"');assert.equal(celulaCsvCiclo('A;"B"'),'"A;""B"""');
});
