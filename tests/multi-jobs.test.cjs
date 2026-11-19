'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const mirror=fs.readFileSync('web/index.html','utf8');
assert.equal(html,mirror,'Web preview must match Android HTML');
const js=html.split('<script>')[1]?.split('</script>')[0];
assert(js);new Function(js);
assert(js.includes("const KEY='borelab-field-v0.1'"),'Old app records must keep storage key');
assert(js.includes('initializeJobs();'),'Legacy install must be migrated into a first job');
assert(js.includes("jobs:renderJobs") && (js.includes("dayassist:renderDayAssistant") ||
 (js.includes("dayassistlegacy:renderDayAssistant") &&
  js.includes("dayassist:()=>window.BoreLabCloseoutPhotoV2?.renderEndDay()"))),
 'Keep legacy combined all-jobs review and the upgraded default assistant');
assert(js.includes("case 'switch-job':switchActiveJob(id);break;"));
assert(js.includes("case 'save-multi-closeout':saveMultiDayCloseout(false);break;"));
assert(js.includes("case 'export-multi-closeout':saveMultiDayCloseout(true);break;"));
assert(js.includes("if(form.dataset.form==='new-job')"),'Creating jobs needs a form submission');
assert(js.includes("if(!j||j.id===state.activeJobId)")||js.includes("if(!j||j.id===state.activeJobId)return"));
assert(js.includes('const title=snapshot?')&&js.includes("'Multi-Job Daily Report'"));
assert(js.includes('plannedAllowance'), 'Combined job report must respect job-specific pipe allowances');
assert(js.includes('function crewClockedElsewhere('),'Must not check in a worker already clocked into another job');
assert(js.includes('function overlappingCrewTime('),'Must prevent overlapping job time entries');
assert(js.includes("jobId:state.activeJobId"),'Job activity must be tagged by active job');
assert(js.includes("function activeJobPhotos()"),'Photos must be segregated by job');
assert(js.includes("photoDB('put',rec)"),'Photo capture must persist to IndexedDB');
assert(js.includes('jobId:pendingPhotoJobId||state.activeJobId'), 'Photo association should not change during capture');

// Actual single-job migration and selected-job mirror behavior.
const dataBegin=js.indexOf('const JOB_FIELDS='),dataEnd=js.indexOf('let page=',dataBegin);
assert(dataBegin>=0&&dataEnd>dataBegin);
const state={
 jobName:'Original South Glades',jobAddress:'Site A',jobNotes:'Old work',
 shots:[{id:'s1',name:'Original Bore',feet:175,status:'planned'}],
 crew:[{id:'e1',name:'Juan',start:'2026-11-17T07:00:00',end:'2026-11-17T15:00:00'}],
 allowance:10,routeMode:'toward',demo:false
};
const migrated=new Function('state','uid',
 js.slice(dataBegin,dataEnd)+
 'return {makeJobSnapshot,hydrateJob,syncActiveJob,activeJob,belongsToJob};'
)(state,()=> 'original-job-id');
assert.equal(state.jobs.length,1);
assert.equal(state.activeJobId,'original-job-id');
assert.equal(state.legacyJobId,'original-job-id');
assert.equal(state.jobs[0].shots[0].name,'Original Bore');
const north=migrated.makeJobSnapshot('new-job-id',{jobName:'North Glades',shots:[],crew:[],allowance:15,routeMode:'short',demo:false});
state.jobs.push(north);
migrated.syncActiveJob();
state.activeJobId=north.id;migrated.hydrateJob(north);
assert.equal(state.jobName,'North Glades');
assert.equal(state.shots.length,0);
state.shots.push({id:'s2',name:'New Bore',feet:90,status:'planned'});
migrated.syncActiveJob();
state.activeJobId='original-job-id';migrated.hydrateJob(state.jobs[0]);
assert.equal(state.shots.length,1,'Switching back must restore first job bores');
assert.equal(state.crew.length,1,'Switching back must restore first job hours');
assert.equal(state.jobs[1].shots[0].name,'New Bore','Other job must keep its own records');
assert(migrated.belongsToJob({id:'old-photo'},state.legacyJobId),'Old untagged photo assigned to legacy job');
assert(!migrated.belongsToJob({jobId:'new-job-id'},state.legacyJobId));

// Evaluate cross-job daily aggregation without relying on the UI.
const from=js.indexOf('function jobRecordsForDay(');
const stop=js.indexOf('function renderDayAssistant(){',from);
assert(from>0&&stop>from);
state.jobs[0].crew[0].end='2026-11-17T15:00:00';
state.jobs[0].shots[0].updatedAt='2026-11-17T13:00:00';
state.jobs[1].shots[0].updatedAt='2026-11-17T14:00:00';
state.jobs[1].crew=[{id:'e2',name:'Maria',start:'2026-11-17T09:00:00',end:'2026-11-17T15:00:00'}];
state.pipeMoves=[{id:'m1',jobId:'original-job-id',at:'2026-11-17T14:00:00',shotId:'s1',type:'installed',feet:185}];
state.mudLogs=[];state.mudStockMoves=[];state.reels=[];state.equipment=[];state.shopAddress='';
const photos=[{id:'p1',shotId:'s1',addedAt:'2026-11-17T13:00:00',dataUrl:'a'},
 {id:'p2',jobId:'new-job-id',shotId:'s2',addedAt:'2026-11-17T15:00:00',dataUrl:'b'}];
const daily=new Function('state','photos','uid','localDay','hours','fmt','belongsToJob',
 js.slice(from,stop)+'return {jobRecordsForDay,jobDaySummary,jobDayIssues,buildMultiDaySnapshot};'
)(state,photos,()=> 'combined-1',x=>String(x).slice(0,10),()=>7,x=>String(x),migrated.belongsToJob);
assert.equal(daily.jobRecordsForDay(state.jobs[0],'2026-11-17').photos.length,1);
assert.equal(daily.jobRecordsForDay(state.jobs[1],'2026-11-17').photos.length,1);
assert.equal(daily.jobRecordsForDay(state.jobs[1],'2026-11-17').pipe.length,0);
const combined=daily.buildMultiDaySnapshot('2026-11-17');
assert.equal(combined.kind,'multi');
assert.equal(combined.jobSummaries.length,2);
assert.equal(combined.shots.length,2);
assert(combined.shots.some(sh=>sh.name==='Original South Glades · Original Bore'));
assert(combined.shots.some(sh=>sh.name==='North Glades · New Bore'));
assert(combined.crew.some(e=>e.name==='North Glades · Maria'));
assert.equal(combined.shots.find(sh=>sh.id==='s2').plannedAllowance,15);
assert.equal(combined.photos.length,2);
assert.equal(combined.summary.crewHours,14);
assert.equal(state.jobs[1].shots[0].name,'New Bore','Daily summary must not rewrite bore names or statuses');
assert.equal(state.jobs[1].shots[0].status,'planned','Pending bores carry over unchanged');
console.log('Multi-job migration, independent jobs, dated cross-job reports and crew/pipe/photo attribution passed.');
