'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('web/index.html'),android=read('app/src/main/assets/web/index.html');
assert.equal(html,android,'Mirrored Android app and web preview must stay identical');
const code=['field-command-v027','field-command-work-v027','field-command-info-v027'];
for(const name of code){
 const js=read('web/'+name+'.js');
 assert.equal(js,read('app/src/main/assets/web/'+name+'.js'),'Android and web JS mismatch '+name);
 new Function(js);
 assert(html.includes('<script src="./'+name+'.js"></script>'),'Missing app integration '+name);
}
assert.equal(read('web/field-command-v027.css'),read('app/src/main/assets/web/field-command-v027.css'));
assert(html.includes('field-command-v027.css'));
for(const page of ['dispatch3','readiness3','evidence3','find3','savestatus3'])assert(html.includes(page+':()=>window.BoreLabField'),'Missing registered view: '+page);
assert(html.includes('window.BoreLabFieldCommand3?.enhance?.(page)'));
assert(html.includes('window.BoreLabFieldInfo3?.backupInitiated?.()'));
assert(html.includes('window.BoreLabFieldInfo3?.markSaveError?.('));
assert(html.includes("const KEY='borelab-field-v0.1'"),'Never reset BoreLab records');
const fab=read('web/field-fab.js');assert(fab.includes('BoreLabFieldCommand3?.fabActions'));assert(fab.includes('BoreLabFieldCommand3?.handleFabAction'));
const jobA={id:'jA',jobName:'South Glades',jobAddress:'Route 80',shots:[
 {id:'sA',name:'Bore 175',feet:175,status:'planned',address:'Pine Tree Road',lat:'',lon:'',pipeDiameter:'4 in'},
 {id:'sB',name:'Bore Complete',feet:90,status:'complete',completedAt:'2026-11-20T13:00:00-05:00',notes:''}],
 crew:[{id:'t1',memberId:'p1',name:'Juan',start:'2026-11-20T12:00:00Z',end:''}],
 fieldPins:[{id:'pin1',name:'Box',kind:'box',notes:'North side'}]};
const jobB={id:'jB',jobName:'North Glades',jobAddress:'Oak Street',shots:[{id:'sC',name:'Oak Bore',feet:120,address:'Oak Street',status:'planned'}],crew:[]};
const juan={id:'p1',name:'Juan',primaryRole:'Driller'},carlos={id:'p2',name:'Carlos',primaryRole:'Locator'};
const state={activeJobId:'jA',jobs:[jobA,jobB],shots:jobA.shots,roster:[juan,carlos],
 selectedCrewIds:['p1','p2'],crewAssignmentsV2:[],allowance:10,
 reels:[{id:'reel1',name:'4-in conduit',size:'4 in',location:'truck',remaining:400}],
 equipment:[{id:'e1',name:'Mini Excavator',type:'Other'}]};
let saves=0,renders=0,notices=[];
const bridge={state:()=>state,activeJob:()=>state.jobs.find(x=>x.id===state.activeJobId),
 photos:()=>[],todayLocal:()=> '2026-11-20',uid:()=> 'assigned-'+(++saves),
 save:()=>{saves++},render:()=>{renders++},notify:x=>notices.push(x),
 setPage:()=>{},shotDetail:()=>{},photoDetail:()=>{}};
const listeners={};
const storage=new Map();
const sandbox={window:{BoreLabAssistantBridge:bridge,BoreLabLocalAccounts:{isUnlocked:()=>true,role:()=> 'owner'},confirm:()=>true},
 document:{addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn),querySelector:()=>null,getElementById:()=>null},
 localStorage:{getItem:x=>storage.get(x)||null,setItem:(k,v)=>storage.set(k,v)},Date,Number,String,Math,Array,Set,Map,Boolean,
 JSON,console,clearTimeout:()=>{},setTimeout:()=>0};
for(const name of code)vm.runInNewContext(read('web/'+name+'.js'),sandbox);
const command=sandbox.window.BoreLabFieldCommand3,work=sandbox.window.BoreLabFieldWork3,info=sandbox.window.BoreLabFieldInfo3;
assert.equal(command.count().pending,1);
assert.equal(command.count().after,1);
assert.equal(command.count().open,1);
assert(command.fabActions('jobmap').some(x=>x.id==='fc-box'));
assert(command.fabActions('crewmanager2').some(x=>x.id==='fc-dispatch'));
assert(work.renderDispatch().includes('Juan')&&work.renderDispatch().includes('Carlos'));
assert(work.renderDispatch().includes('data-fc-select-all'));
const before=JSON.stringify({crew:jobA.crew,shots:jobA.shots,roster:state.roster});
function fieldEntry(person,role,gear,note){return{dataset:{fcMember:person},closest:()=>({querySelector:selector=>
 selector==='[data-fc-role]'?{value:role}:selector==='[data-fc-equip]'?{value:gear}:selector==='[data-fc-note]'?{value:note}:null})}}
const form={querySelector:selector=>selector==='[name="date"]'?{value:'2026-11-20'}:null,
 querySelectorAll:selector=>selector==='[data-fc-member]:checked'?[fieldEntry('p1','Driller','', 'Operate drill'),fieldEntry('p2','Locator','e1','Locate utilities')]:[]};
work.submitDispatch(form);
assert.equal(state.crewAssignmentsV2.length,2);
assert(state.crewAssignmentsV2.some(x=>x.personId==='p2'&&x.role==='Locator'&&x.equipmentId==='e1'));
assert.equal(JSON.stringify({crew:jobA.crew,shots:jobA.shots,roster:state.roster}),before,'Dispatch must not change timesheets, shots, or regular roles');
assert(work.renderReadiness().includes('Utility markings'));
work.setCheck('sA','utilitiesReviewed',true);
assert.equal(jobA.fieldReadinessV3.sA.utilitiesReviewed,true);
assert.equal(jobA.shots[0].status,'planned','Readiness cannot complete a bore');
assert(work.evidenceList().some(x=>x.type==='photo'));
assert(work.evidenceList().some(x=>x.type==='crew'));
assert(info.searchRecords('oak').some(x=>x.jobId==='jB'));
assert(info.searchRecords('locator').some(x=>x.type==='person'&&x.label==='Carlos'));
info.markSaved();assert(info.health().savedAt);
info.photoHealth(new Error('IDB blocked'));assert.equal(info.health().photosRead,false);
info.backupInitiated();assert(info.health().backupInitiated);
assert(info.renderSaveStatus().includes('Private imported PDF plans'));
assert(info.renderFind().includes('Find Anything'));
assert(saves>0&&renders>0);
console.log('Field Command 3.0: command counters, contextual FAB, dispatch, bore readiness, evidence, offline search and save health PASS');
