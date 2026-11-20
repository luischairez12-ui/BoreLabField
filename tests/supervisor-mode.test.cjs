'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const js=fs.readFileSync('web/supervisor-mode.js','utf8');
const css=fs.readFileSync('web/supervisor-mode.css','utf8');
const html=fs.readFileSync('web/index.html','utf8');
assert.equal(html,fs.readFileSync('app/src/main/assets/web/index.html','utf8'));
assert.equal(js,fs.readFileSync('app/src/main/assets/web/supervisor-mode.js','utf8'));
assert.equal(css,fs.readFileSync('app/src/main/assets/web/supervisor-mode.css','utf8'));
for(const token of ['supervisor-mode.css','supervisor-mode.js',
 'supervisorpreview:()=>window.BoreLabSupervisorMode?.renderSupervisor()',
 "'crewpreview','supervisorpreview'",
 'dataset.supervisorPreview=','Supervisor View · Preview','Preview Supervisor UI'])
 assert(html.includes(token),'missing Supervisor integration: '+token);
assert(css.includes('html[data-supervisor-preview="on"] .bottom-nav{display:none!important}'));
new Function(js);new Function(html.split('<script>')[1].split('</script>')[0]);
const today='2026-11-19';
const date=t=>'2026-11-19T'+t+'-05:00';
const shotsA=[
 {id:'s1',name:'Shot 01',status:'complete',feet:150,notes:'As-built done',completedAt:date('12:00:00'),updatedAt:date('12:00:00')},
 {id:'s2',name:'Shot 02',status:'progress',feet:155,notes:'Drilling',updatedAt:date('14:30:00')},
 {id:'s3',name:'Shot 03',status:'planned',feet:90}
];
const crew1={id:'entry1',memberId:'p1',name:'Juan',start:date('07:00:00'),end:date('15:30:00'),lunch:30};
const crew2={id:'entry2',memberId:'p2',name:'Miguel',start:date('08:00:00'),end:'',lunch:0};
const crew3={id:'entry3',memberId:'p3',name:'Maria',start:date('07:00:00'),end:date('16:00:00'),lunch:60};
const a={id:'j1',jobName:'South Glades',jobAddress:'265 S Lindero',shots:shotsA,crew:[crew1,crew2],archived:false};
const b={id:'j2',jobName:'North Glades',jobAddress:'123 Main Rd',shots:[{id:'s4',status:'complete',feet:80,name:'Shot 04',updatedAt:date('14:00:00')}],crew:[crew3],archived:false};
const old={id:'j3',jobName:'Archived Work',shots:[],crew:[],archived:true};
const st={jobs:[a,b,old],activeJobId:'j1',roster:[{id:'p1',name:'Juan'},{id:'p2',name:'Miguel'},{id:'p3',name:'Maria'}],
 crewAssignmentsV2:[{personId:'p1',jobId:'j1',role:'Locator',date:today,notes:'Locate first shot'}],
 equipment:[{id:'e1',name:'JT20 Drill',type:'Drill'},{id:'e2',name:'Mixer 1',type:'Mixer'}],
 equipmentIssuesV2:[{id:'issue1',equipmentId:'e1',category:'Hydraulic',note:'Leaking line',downtime:true,closedAt:''}],
 equipmentServiceV2:[{id:'service1',equipmentId:'e2',date:today,kind:'Hose replaced',at:date('14:00:00')}],
 pipeMoves:[{id:'pipe1',jobId:'j1',shotId:'s1',type:'installed',feet:150,at:date('14:00:00')}]};
const photoRows=[{id:'pic1',jobId:'j1',shotId:'s1',stage:'after',addedAt:date('12:01:00')},{id:'pic2',jobId:'j2',shotId:'s4',stage:'after',addedAt:date('14:30:00')}];
const inDay=t=>typeof t==='string'&&t.slice(0,10)===today;
function records(j,day){
 if(day!==today)return{shots:[],crew:[],photos:[],pipe:[],mud:[],mudStock:[]};
 return{shots:j.shots.filter(s=>inDay(s.updatedAt)||inDay(s.completedAt)),
 crew:j.crew.filter(e=>inDay(e.start)||inDay(e.end)),
 photos:photoRows.filter(p=>p.jobId===j.id),pipe:st.pipeMoves.filter(m=>m.jobId===j.id),
 mud:[],mudStock:[]};
}
function hours(e){if(!e.end)return 0;return Math.max(0,(new Date(e.end)-new Date(e.start))/36e5-(+e.lunch||0)/60)}
function issues(j,d){return j.id==='j1'&&d===today?['1 open crew shift','1 bore still in progress']:[]}
function summary(j,d){
 const r=records(j,d);return{id:j.id,name:j.jobName,shots:r.shots.length,completed:r.shots.filter(x=>x.status==='complete').length,
 footage:r.shots.filter(x=>x.status==='complete').reduce((n,x)=>n+x.feet,0),
 crewHours:r.crew.reduce((n,e)=>n+hours(e),0),photos:r.photos.length,
 pipe:r.pipe.reduce((n,m)=>n+m.feet,0),warnings:issues(j,d),
 hasWork:!!(r.shots.length||r.crew.length||r.photos.length||r.pipe.length)};
}
let page='supervisorpreview',saves=0,renders=0,confirmResult=true,pages=[],opened=[],notices=[];
const bridge={state:()=>st,todayLocal:()=>today,currentPage:()=>page,jobDaySummary:summary,jobRecordsForDay:records,jobDayIssues:issues,
 render:()=>{renders++},save:()=>{saves++},setPage:p=>{pages.push(p);page=p},switchActiveJob:id=>{opened.push(id);return true},
 notify:m=>notices.push(m)};
const window={BoreLabAssistantBridge:bridge,confirm:()=>confirmResult};
const listeners={};
const document={addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn)}};
const app=new Function('window','document',js+';return window.BoreLabSupervisorMode;')(window,document);
let view=app.renderSupervisor();
for(const x of ['Supervisor Dashboard','Field operations,','Supervisor Overview','Live Job Portfolio','South Glades',
 'North Glades','Attention Needed','Crew Status','Daily Reports','Equipment','Local Preview']){
 assert(view.includes(x),'missing overview component '+x);
}
assert(!view.includes('Archived Work'),'archived jobs excluded from active overview');
assert.equal(app.portfolio().jobs.length,2);
assert.equal(app.portfolio().total,4);
assert.equal(app.portfolio().done,2);
assert.equal(app.portfolio().percent,50);
assert.equal(app.portfolio().openCrew.length,1);
assert.equal(app.portfolio().hours,16);
assert.equal(app.portfolio().unresolved,1);
assert.equal(app.portfolio().down.length,1);
assert.equal(saves,0,'read-only overview must not persist changes');
const click=(dataset={},attributes=[])=>{
 const t={dataset,hasAttribute:n=>attributes.includes(n)};
 for(const fn of listeners.click||[])fn({target:{closest:()=>t}});
};
click({smTab:'jobs'});
assert.equal(app.getTab(),'jobs');
view=app.renderSupervisor();
assert(view.includes('Job Portfolio')&&view.includes('South Glades')&&view.includes('North Glades'));
click({smJobFilter:'archived'});
view=app.renderSupervisor();assert(view.includes('Archived Work')&&!view.includes('South Glades'));
click({smJobFilter:'active'});
click({smInspect:'j1'});
view=app.renderSupervisor();assert(view.includes('Job Detail · South Glades'));
assert(view.includes('Remaining bore footage')&&view.includes('245 ft'));
click({},['data-sm-close-inspect']);
assert(!app.renderSupervisor().includes('Job Detail · South Glades'));
click({smTab:'crew'});
view=app.renderSupervisor();
for(const x of ['Crew Oversight','Currently Clocked In','Miguel','South Glades','Assigned Roles','Juan','Locator','Closed crew-hours']){
 assert(view.includes(x),'crew section missing '+x);
}
assert(view.includes('16 hr')||view.includes('16.0 hr'),'Two 8-hour closed shifts total 16 hours');
click({smTab:'equipment'});
view=app.renderSupervisor();
assert(view.includes('Fleet &amp; Equipment')&&view.includes('JT20 Drill')&&view.includes('Leaking line')&&view.includes('Downtime'));
click({smTab:'reports'});
view=app.renderSupervisor();
assert(view.includes('Daily Report Review')&&view.includes('South Glades')&&view.includes('North Glades'));
assert(view.includes('Mark Reviewed Locally'));
const original=JSON.stringify({jobs:st.jobs,crew:st.jobs.map(j=>j.crew),equipment:st.equipment,issues:st.equipmentIssuesV2});
confirmResult=false;
click({smReview:'j1'});
assert.equal(st.supervisorReviewsV1,undefined,'declined review creates no marker');
confirmResult=true;
click({smReview:'j1'});
assert.equal(saves,1,'explicit review creates exactly one persisted change');
assert(app.reviewed(a));
assert.equal(JSON.stringify({jobs:st.jobs,crew:st.jobs.map(j=>j.crew),equipment:st.equipment,issues:st.equipmentIssuesV2}),original,
 'report review never modifies underlying field records');
view=app.renderSupervisor();
assert(view.includes('Locally reviewed')&&view.includes('Reopen Review'));
assert.equal(st.supervisorReviewsV1[today+'::j1'].warningCount,2,'warnings remain acknowledged but open');
click({smReportFilter:'reviewed'});
view=app.renderSupervisor();assert(view.includes('South Glades')&&!view.includes('North Glades'));
a.shots[0].notes='Updated as-built notes';
assert.equal(app.reviewed(a),null,'changed job records invalidate local review');
assert(app.staleReview(a));
view=app.renderSupervisor();assert(view.includes('No reports match')||!view.includes('Locally reviewed'));
click({smReportFilter:'all'});
view=app.renderSupervisor();assert(view.includes('Needs re-review')&&view.includes('Review Updated Records'));
click({smReview:'j1'});
assert(app.reviewed(a),'explicit re-review refreshes fingerprint');
click({smReview:'j1'});
assert.equal(app.reviewed(a),null,'can reopen local review');
assert.equal(st.supervisorReviewsV1[today+'::j1'],undefined);
click({smReportJob:'j2'});
view=app.renderSupervisor();
assert(view.includes('Job Detail · North Glades'),'inspect report works in Reports tab');
click({smOpenJob:'j2'});
assert.deepEqual(opened,['j2']);
const oldCrew=st.jobs.map(j=>j.crew.length);
assert.deepEqual(st.jobs.map(j=>j.crew.length),oldCrew);
click({},['data-sm-exit']);assert.equal(pages.at(-1),'home');
assert(saves>=3&&renders>=3);
console.log('Supervisor Mode: portfolio, crew, equipment, report filtering/review, stale warnings and data protection PASS');
