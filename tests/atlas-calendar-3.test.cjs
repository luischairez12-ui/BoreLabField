'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('web/index.html','utf8');
const abjs=fs.readFileSync('web/asbuilt-2.js','utf8'),atlasjs=fs.readFileSync('web/field-atlas.js','utf8');
for(const name of ['index.html','asbuilt-2.js','asbuilt-2.css','field-atlas.js','field-atlas.css','field-pins.js']){
 const desktop=fs.readFileSync('web/'+name,'utf8'),android=fs.readFileSync('app/src/main/assets/web/'+name,'utf8');
 assert.equal(desktop,android,name+' differs across browser and Android assets');
 if(name!=='index.html')assert(html.includes('./'+name),name+' must be loaded');
}
new Function(abjs);new Function(atlasjs);
assert(html.includes('fieldhistory:()=>window.BoreLabAsBuilt?.renderCalendar()'));
assert(html.includes('data-ab-suggest'),'Photo detail includes review-first suggested linking');
const pdf=fs.readFileSync('app/src/main/java/com/borelab/field/FieldPdfExporter.java','utf8');
assert(pdf.includes('renderAsbuilt(report)')&&pdf.includes('GPS point plot - not a survey'));
const date='2026-11-19',started='2026-11-19T12:00:00Z';
const shot1={id:'sh-1',name:'Shot 01',feet:155,status:'complete',lat:'26.6123',lon:'-81.6123',startedAt:started,completedAt:'2026-11-19T18:00:00Z',asbuiltStart:{lat:26.6123,lon:-81.6123,accuracy:9},asbuiltEnd:{lat:26.6125,lon:-81.6128,accuracy:11}};
const shot2={id:'sh-2',name:'Future bore',status:'planned',feet:90,lat:'26.6129',lon:'-81.6143'};
const pin1={id:'pin-1',kind:'coupling',name:'Driveway Coupling',lat:'26.61233',lon:'-81.61230',occurredDay:date,size:'2 inch',material:'HDPE',gpsAccuracy:'8',gpsSource:'device'};
const box2={id:'pin-2',kind:'box',name:'Remote Handhole',lat:'26.67',lon:'-81.68',occurredDay:date,dimensions:'24x36'};
const job1={id:'job-1',jobName:'South Glades',shots:[shot1,shot2],fieldPins:[pin1],crew:[{id:'crew',name:'Juan',start:started,end:''}]};
const job2={id:'job-2',jobName:'Archived Glades',archived:true,shots:[],fieldPins:[box2],crew:[]};
const state={activeJobId:'job-1',jobName:'South Glades',jobs:[job1,job2],legacyJobId:'',pipeMoves:[],mudLogs:[],mudStockMoves:[],fieldRecovery:[]};
let photos=[
 {id:'ph-1',jobId:'job-1',addedAt:'2026-11-19T19:00:00Z',lat:26.61232,lon:-81.6123,accuracy:7,dataUrl:'data:image/png;base64,AA=='},
 {id:'ph-2',jobId:'job-2',addedAt:'2026-11-19T14:00:00Z',lat:26.67001,lon:-81.68001,accuracy:6,dataUrl:'data:image/png;base64,BB=='}
];
let saved=0,renders=0,notices=[],pdfPayload=null,modal='',openPage='';
const listeners={};
const doc={addEventListener:(event,cb)=>{(listeners[event]??=[]).push(cb)},querySelector:()=>null};
const bridge={
 state:()=>state,photos:()=>photos,activeJob:()=>state.jobs.find(x=>x.id===state.activeJobId),
 photoDB:async(op,p)=>{assert.equal(op,'put');photos=photos.map(x=>x.id===p.id?p:x)},
 refreshPhotos:async()=>{},save:()=>{saved++},render:()=>{renders++},notify:t=>notices.push(t),
 showModal:t=>{modal=t},closeModal:()=>{},setPage:p=>{openPage=p},photoDetail:()=>{},
 exportDailyPdf:()=>{},todayLocal:()=>date
};
const win={BoreLabAssistantBridge:bridge,BoreLabNative:{exportPdf:(name,data)=>{pdfPayload=JSON.parse(data)}},
 confirm:()=>true,addEventListener:()=>{}};
const ab=new Function('window','document',abjs+';return window.BoreLabAsBuilt;')(win,doc);
const atlas=new Function('window','document',atlasjs+';return window.BoreLabAtlas;')(win,doc);
assert(ab.renderCalendar().includes('📅 Calendar')&&ab.renderCalendar().includes('📍 Atlas Map'));
assert(ab.renderCalendar().includes('Search All Jobs'));
ab.setDay(date);
assert.equal(ab.eventsOn(date).filter(e=>e.type==='pin').length,1,'calendar current job');
assert.equal(ab.eventsOn(date).filter(e=>e.type==='photo').length,1,'local photo shown');
assert(ab.detailsHTML().includes('Photos from this day'));
assert(ab.detailsHTML().includes('155 ft'),'completed footage summary');
assert(ab.calendarHTML().includes('data-ab-prev')&&ab.calendarHTML().includes('data-ab-next'));
ab.setScope('all');
assert.equal(ab.eventsOn(date).filter(e=>e.type==='pin').length,2,'archived job indexed in calendar');
ab.setQuery('remote handhole');
assert.equal(ab.matchingEvents().filter(e=>e.type==='pin').length,1,'across-job search by name');
ab.setQuery('11/19/2026');
assert(ab.matchingEvents().length>=4,'date search covers all jobs');
ab.setQuery('');
ab.setType('all');
ab.setView('atlas');
assert(ab.renderCalendar().includes('Underground Atlas'),'map shares same page');
const mapPoints=atlas.points();
assert(mapPoints.some(p=>p.jobId==='job-2'&&p.title==='Remote Handhole'),'Atlas map shows archived job pin');
assert(mapPoints.some(p=>p.record.id==='sh-2'&&p.dates.includes('Date not recorded')),'undated GPS shot is mapped without fictitious date');
assert(atlas.renderAtlas().includes('OpenStreetMap contributors'),'online tiles are attributed');
assert(ab.gpsQuality({...pin1,gpsAccuracy:'38'}).includes('Low accuracy'));
ab.setQuery('coupling');
assert(atlas.points().some(x=>x.record.id==='pin-1'),'map filters by installation label');
ab.setQuery('');
ab.setScope('job');
ab.setView('calendar');
const candidates=ab.candidateRecords(photos[0]);
assert(candidates.some(x=>x.id==='pin-1'),'GPS suggests nearby coupling');
assert(candidates.every(x=>x.distance===null||x.distance<=75),'suggestions stay near photo');
ab.suggestPhoto('ph-1');
assert(modal.includes('Smart Photo Linking')&&modal.includes('Driveway Coupling'),'suggested links require user choice');
(async()=>{
 await ab.linkPhoto('ph-1','pin:pin-1');
 assert.equal(photos[0].fieldPinId,'pin-1','confirmed link written to photo metadata');
 assert.equal(photos[0].linkSource,'foreman-confirmed','link reason recorded');
 assert(saved===0,'photo assignment changes indexedDB only, never overwrites shot data');
 const checks=ab.checklist(job1);
 assert.equal(checks.find(x=>x.id==='bores').ok,false,'incomplete bores block review');
 assert.equal(checks.find(x=>x.id==='crew').ok,false,'open crew clock blocks review');
 assert(ab.renderChecklist().includes('Job Completion Checklist'));
 ab.setReviewed('paperwork',true);
 assert(job1.asbuiltReview.checks.paperwork.checked&&saved>0,'manual review is persisted to job');
 await ab.exportAsBuilt();
 assert(pdfPayload&&pdfPayload.asbuilt.some(x=>x.name==='Driveway Coupling'),'PDF includes field marker details');
 assert(pdfPayload.photos.some(x=>x.shot==='Driveway Coupling'),'linked photo appears under installation in report');
 assert(!job1.asbuiltReview.checks.bores,'never auto-completes pending bore');
 console.log('Unified Atlas | Calendar, across-job search, GPS quality, photo linking, history, and closeout checklist PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
