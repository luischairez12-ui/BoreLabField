'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const js=source.split('<script>')[1]?.split('</script>')[0];
assert(js,'Embedded web app missing');
new Function(js);
const native=fs.readFileSync('app/src/main/java/com/borelab/field/FieldPdfExporter.java','utf8');
const bridge=fs.readFileSync('app/src/main/java/com/borelab/field/BoreLabActivity.java','utf8');
assert(native.includes('PdfDocument')&&native.includes('BitmapFactory')&&native.includes('document.writeTo(buffer)'),'Native PDF must contain text and photos');
assert(bridge.includes('exportPdf(String name, String reportJson)'),'Android PDF export bridge missing');
assert(bridge.includes('application/pdf')&&bridge.includes('Intent.ACTION_CREATE_DOCUMENT'),'PDF save picker missing');
assert(js.includes("window.BoreLabNative?.exportPdf"),'Report must call native bridge');
assert(js.includes("case 'history-pdf':await exportRealPdf(id)"),'History PDF action missing');
assert(js.includes("case 'export-report':await exportRealPdf()"),'Current report PDF action missing');
assert(js.includes("case 'open-closeout'"),'Closeout navigation missing');
assert(js.includes("case 'open-history'"),'History navigation missing');
assert(js.includes("form.dataset.form==='closeout'"),'Closeout form saving missing');
assert(js.includes("data-closeout-day"),'Date chooser missing');
assert(js.includes("case 'archive-job-snapshot'"),'Single-job history snapshot missing');
assert(js.includes("if(!Array.isArray(state.history))state.history=[]"),'Backward-compatible history migration missing');
assert(js.includes("history:[]"),'Seed history missing');
assert(!js.includes("state.activeJobId="),'No multiple job-switching should be added');
const begin=js.indexOf('function dailyRecords('),end=js.indexOf('function renderCloseout(',begin);
assert(begin>=0&&end>begin);
const state={
 jobName:'South Glades',shopAddress:'Shop Rd',
 shots:[{id:'a',name:'Shot A',feet:175,status:'complete',completedAt:'2026-11-17T13:30:00.000Z',pipeUsed:185},
        {id:'b',name:'Shot B',feet:90,status:'planned',updatedAt:'2026-11-16T13:30:00.000Z'}],
 crew:[{id:'c',name:'Juan',start:'2026-11-17T12:00:00.000Z',end:'2026-11-17T20:00:00.000Z',lunch:60}],
 pipeMoves:[{id:'m',reelId:'r',shotId:'a',type:'installed',feet:185,at:'2026-11-17T13:30:00.000Z'}],
 reels:[],equipment:[],mudLogs:[],mudStockMoves:[],allowance:10
};
const localDay=iso=>String(iso).slice(0,10);
const pure=new Function('state','photos','localDay','uid','coordsText','shop','extra','pipeOnTruck','feet','hours',
 js.slice(begin,end)+'return {dailyRecords,snapshotWork,reviewIssues};')
(state,[{id:'p',shotId:'a',addedAt:'2026-11-17T14:00:00.000Z',lat:26,lon:-81}],
 localDay,()=>'snap1',()=>'',()=>({}),()=>10,()=>345,s=>Number(s.feet||0),e=>7);
const current=pure.dailyRecords('2026-11-17');
assert.equal(current.shots.length,1);
assert.equal(current.crew.length,1);
assert.equal(current.pipe.length,1);
assert.equal(current.photos.length,1);
const frozen=pure.snapshotWork('daily','2026-11-17','No problems',[{label:'Hours reviewed',checked:true}]);
assert.equal(frozen.summary.completedFeet,175);
assert.equal(frozen.summary.crewHours,7);
assert.equal(frozen.summary.installedPipe,185);
assert.equal(frozen.photos[0].id,'p');
state.shots[0].feet=999;
state.crew[0].lunch=0;
assert.equal(frozen.shots[0].feet,175,'Historical bore record must be frozen');
assert.equal(frozen.crew[0].lunch,60,'Historical crew time must be frozen');
const job=pure.snapshotWork('job','2026-11-17');
assert.equal(job.shots.length,2,'Saved job snapshot includes all work');
const payload=js.slice(js.indexOf('function buildPdfPayload('),js.indexOf('function exportReport(){'));
assert(payload.includes('snapshot?.equipment||state.equipment'),'Historical PDF should use equipment snapshot');
assert(payload.includes('snapshot?.reels||state.reels'),'Historical PDF should use reel snapshot');
assert(payload.includes("requestedDay?'daily'"),'Explicit daily export must not produce whole-job report');
console.log('BoreLab v0.6 native-PDF wiring, daily closeout and frozen history checks passed.');
