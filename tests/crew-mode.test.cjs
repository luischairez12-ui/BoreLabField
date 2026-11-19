'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const js=fs.readFileSync('web/crew-mode.js','utf8');
const css=fs.readFileSync('web/crew-mode.css','utf8');
const html=fs.readFileSync('web/index.html','utf8');
assert.equal(html,fs.readFileSync('app/src/main/assets/web/index.html','utf8'));
assert.equal(js,fs.readFileSync('app/src/main/assets/web/crew-mode.js','utf8'));
assert.equal(css,fs.readFileSync('app/src/main/assets/web/crew-mode.css','utf8'));
for(const token of ['crew-mode.css','crew-mode.js','crewpreview','Crew Mode 1.0 · Preview','Preview Crew UI','data.crewPreview'])
 assert(html.includes(token),'missing integration '+token);
assert(css.includes('html[data-crew-preview="on"] .bottom-nav'));
new Function(js);
new Function(html.split('<script>')[1].split('</script>')[0]);
const worker={id:'p1',name:'Juan Perez'},other={id:'p2',name:'Miguel Ruiz'};
const shot={id:'s1',name:'Shot 01',status:'planned',feet:145,address:'265 S Lindero'};
const job={id:'j1',jobName:'South Glades',jobAddress:'265 S Lindero Florida',shots:[shot],crew:[]};
const otherJob={id:'j2',jobName:'North Glades',shots:[],crew:[
 {id:'other1',memberId:'p2',name:'Miguel Ruiz',start:'2026-11-19T09:00:00Z',end:'2026-11-19T17:00:00Z',lunch:30}
]};
const state={roster:[worker,other],activeJobId:'j1',crewPreviewMemberId:'p1',
 jobs:[job,otherJob],shots:job.shots,crew:job.crew,
 crewAssignmentsV2:[{personId:'p1',jobId:'j1',date:'2026-11-19',role:'Locator',notes:'Mark utilities'}],
 autoLunchEnabled:true,defaultLunchMinutes:30};
let current='crewpreview',allow=true,saves=0,renders=0,uploads=[],maps=[],pages=[],messages=[];
const listeners={};
const bridge={
 state:()=>state,currentPage:()=>current,todayLocal:()=> '2026-11-19',
 save:()=>{saves++;job.crew=state.crew;},render:()=>{renders++;},
 notify:x=>messages.push(x),setPage:p=>{pages.push(p);current=p;},
 uid:()=> 'clock1',photos:()=>[],coordsValid:()=>false,
 mapsPinUrl:o=>o.address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(o.address):'',
 openMapUrl:u=>maps.push(u),photoChoose:(kind,id,stage)=>uploads.push({kind,id,stage})
};
const window={BoreLabAssistantBridge:bridge,confirm:()=>allow};
const document={addEventListener:(event,fn)=>{(listeners[event]??=[]).push(fn)}};
const mode=new Function('window','document',js+';return window.BoreLabCrewMode;')(window,document);
assert.equal(mode.person().id,'p1');
let screen=mode.renderCrew();
for(const x of ['BORELAB FIELD · CREW MODE','Juan','South Glades','Locator',
 'Mark utilities','My Hours','Upload Photos','My Assignments','Confirm Clock In','Local Preview','no secure login yet'])
 assert(screen.toLowerCase().includes(x.toLowerCase()),'missing screen '+x);
assert.equal(saves,0,'render does not change data');
const click=(dataset,attribute)=>{
 const item={dataset:dataset||{},hasAttribute:n=>n===attribute};
 for(const fn of listeners.click||[])fn({target:{closest:()=>item}});
};
allow=false;mode.clockIn();assert.equal(state.crew.length,0);
allow=true;mode.clockIn();assert.equal(state.crew.length,1);
assert.equal(state.crew[0].memberId,'p1');
assert.equal(state.crew[0].jobId,'j1');
assert.equal(otherJob.crew.length,1);
mode.clockIn();assert.equal(state.crew.length,1,'duplicate clock-in blocked');
screen=mode.renderCrew();assert(screen.includes('Confirm Clock Out')&&screen.includes('value="30"'));
const lunch={querySelector:()=>({value:'30'})};
allow=false;mode.clockOut(lunch);assert.equal(state.crew[0].end,'');
allow=true;mode.clockOut(lunch);
assert(state.crew[0].end&&state.crew[0].lunch===30,'explicit checkout and lunch saved');
assert.equal(otherJob.crew[0].end,'2026-11-19T17:00:00Z','other employee remains unchanged');
mode.goCrew('hours');assert(mode.renderCrew().includes('Read-only personal time history'));
mode.goCrew('assignments');assert(mode.renderCrew().includes('Mark utilities'));
mode.goCrew('photos');
click({},'data-cm-photo-toggle');
screen=mode.renderCrew();
assert(screen.includes('data-cm-photo-form'));
const form={matches:s=>s==='[data-cm-photo-form]',
 querySelector:s=>({value:s.includes('shotId')?'s1':'before'})};
for(const fn of listeners.submit||[])fn({target:form,submitter:{value:'camera'},preventDefault:()=>{}});
assert.deepEqual(uploads,[{kind:'camera',id:'s1',stage:'before'}]);
click({},'data-cm-directions');
assert(maps.length===1&&maps[0].includes('265%20S%20Lindero'));
mode.selectPerson('p2');assert.equal(state.crewPreviewMemberId,'p2');
screen=mode.renderCrew();assert(screen.includes('Miguel')&&!screen.includes('Mark utilities'));
click({},'data-cm-exit');assert.equal(pages.at(-1),'home');
current='crewpreview';state.crewPreviewMemberId='p1';
state.crewAssignmentsV2[0].jobId='j2';
screen=mode.renderCrew();assert(screen.includes('different job'));
const count=state.crew.length;mode.clockIn();assert.equal(state.crew.length,count,'cannot clock into wrong job');
mode.goCrew('photos');assert(mode.renderCrew().includes('Change to the assigned job'));
state.roster=[];screen=mode.renderCrew();assert(screen.includes('No crew profiles available'));
assert(saves>=3&&renders>=3);
console.log('Crew Mode: profile preview, own time, confirmations, assignments, photo routing, job safety PASS');
