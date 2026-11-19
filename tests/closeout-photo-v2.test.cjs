'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('web/index.html','utf8');
const native=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const script=fs.readFileSync('web/closeout-photo-v2.js','utf8');
const css=fs.readFileSync('web/closeout-photo-v2.css','utf8');
assert.equal(html,native,'Android and web HTML must match');
assert.equal(script,fs.readFileSync('app/src/main/assets/web/closeout-photo-v2.js','utf8'));
assert.equal(css,fs.readFileSync('app/src/main/assets/web/closeout-photo-v2.css','utf8'));
new Function(script);new Function(html.split('<script>')[1].split('</script>')[0]);
for(const term of ['dayassistlegacy:renderDayAssistant','phototimeline2:()=>window.BoreLabCloseoutPhotoV2?.renderPhotoTimeline()',
 'dayassist:()=>window.BoreLabCloseoutPhotoV2?.renderEndDay()','jobRecordsForDay,jobDaySummary,jobDayIssues',
 'exportDailyPdf:(day)=>exportRealPdf','openCloseoutForDay:(day)=>','closeout-photo-v2.js','closeout-photo-v2.css',
 'data-page="phototimeline2"','data-page="dayassistlegacy"'])assert(html.includes(term),term);
assert(css.includes('.bf2-banner')&&css.includes('.bf2-photo-stages'));
assert(script.includes('Nothing is automatically completed'));
assert(!script.includes('autoDeletePhoto'));
const date='2026-11-19';
const stamp=t=>date+'T'+t+'-05:00';
const done={id:'s1',name:'Shot 01',status:'complete',feet:145,startedAt:stamp('07:00:00'),
 completedAt:stamp('11:30:00'),updatedAt:stamp('11:30:00'),address:'265 S Lindero',lat:'',lon:'',notes:'',pipeUsed:''};
const drilling={id:'s2',name:'Shot 02',status:'progress',feet:155,startedAt:stamp('12:00:00'),updatedAt:stamp('14:00:00'),notes:'Potholing'};
const completedCrew={id:'c1',name:'Operator',start:stamp('07:00:00'),end:stamp('15:30:00'),lunch:30};
const openCrew={id:'c2',name:'Locator',start:stamp('07:00:00'),end:''};
const job={id:'job1',jobName:'South Glades',shots:[done,drilling],crew:[completedCrew,openCrew]};
const records={jobs:[job],shots:job.shots,crew:job.crew,activeJobId:'job1',jobName:'South Glades',pipeMoves:[],reels:[],history:[]};
let photos=[
 {id:'p1',jobId:'job1',shotId:'s1',stage:'before',addedAt:stamp('07:25:00'),dataUrl:'data:image/png;base64,AAAA'},
 {id:'p2',jobId:'job1',shotId:'',stage:'',addedAt:stamp('11:34:00'),dataUrl:'data:image/png;base64,BBBB'},
 {id:'p3',jobId:'job1',shotId:'s2',stage:'during',addedAt:stamp('13:05:00'),dataUrl:'data:image/png;base64,CCCC'}
];
let pages=[],pdfDays=[],closeDays=[],opens=[],saves=0,writes=0,photoOpens=0,updates=0;
const bridge={
 state:()=>records,activeJob:()=>job,todayLocal:()=>date,
 jobRecordsForDay:(j,day)=>{
  const local=x=>x&&new Date(x).toISOString().slice(0,10)===day;
  return{shots:j.shots.filter(x=>local(x.updatedAt)||local(x.completedAt)),
   crew:j.crew.filter(x=>local(x.start)||local(x.end)),photos:photos.filter(x=>local(x.addedAt)),
   pipe:[],mud:[],mudStock:[]};
 },
 photos:()=>photos,coordsValid:x=>x&&x.lat!==''&&x.lon!==''&&x.lat!=null&&x.lon!=null,
 save:()=>{saves++},render:()=>{updates++},notify:()=>{},setPage:x=>pages.push(x),
 openCloseoutForDay:x=>closeDays.push(x),exportDailyPdf:x=>pdfDays.push(x),
 shotDetail:id=>opens.push(id),photoChoose:()=>{photoOpens++},
 photoDB:async(op,p)=>{assert.equal(op,'put');writes++;photos=photos.map(x=>x.id===p.id?p:x);return p},
 refreshPhotos:async()=>{}
};
const events={};
const document={addEventListener:(type,fn)=>{(events[type]??=[]).push(fn);}};
const window={BoreLabAssistantBridge:bridge,confirm:()=>true};
const api=new Function('window','document',script+';return window.BoreLabCloseoutPhotoV2')(window,document);
const summary=api.summary();
assert.equal(summary.completed,1);
assert.equal(summary.completedFeet,145);
assert.equal(summary.shotsUpdated,2);
assert.equal(summary.crewHours,8);
assert.equal(summary.photos,3);
assert.equal(summary.peopleOpen,1);
const issues=api.todaysIssues();
for(const prefix of ['after:s1','gps:s1','notes:s1','pipe:s1','crew','unlinked'])assert(issues.some(x=>x.key===prefix),'missing alert '+prefix);
let page=api.renderEndDay();
for(const token of ['End-of-Day Assistant 2.0','South Glades','Today’s Completion Summary','Smart Alerts','Closeout Checklist',
 'BoreLab Intelligence','Daily Report Preview','145 ft','8 hr','3','Generate PDF','Review & Close Day','data-bf2-review="crew"']){
 assert(page.includes(token),'missing end-day element '+token);
}
assert.equal(saves,0,'Viewing a page must not mutate data');
assert.equal(writes,0,'Viewing a page must not change photos');
const makeEl=(dataset={},attributes=[],value='',checked=false)=>{
 const btn={removeAttribute:name=>{if(name==='disabled')btn.disabled=false},disabled:true};
 return {dataset,value,checked,hasAttribute:key=>attributes.includes(key),closest:selector=>selector==='.bf2-suggest-row'?{querySelector:()=>btn}:null,_button:btn};
};
const click=(dataset={},attributes=[])=>{
 const el=makeEl(dataset,attributes);
 for(const fn of events.click||[])fn({target:{closest:()=>el}});
};
const change=el=>{for(const fn of events.change||[])fn({target:el})};
change(makeEl({bf2Review:'crew'},[], '',true));
assert.equal(records.endDayReviewV2['job1:'+date].crew,true);
assert.equal(job.crew[1].end,'','Checking a closeout box never clocks a crew member out');
assert.equal(done.status,'complete');
click({},['data-bf2-pdf']);assert.deepEqual(pdfDays,[date]);
click({},['data-bf2-close']);assert.deepEqual(closeDays,[date]);
click({bf2Issue:'crew'});assert.equal(pages.at(-1),'crew');
page=api.renderPhotoTimeline();
for(const token of ['Smart Photo Timeline 2.0','Photo Coverage Summary','Shot 01','Shot 02',
 'Missing Photo Checks','Timeline Intelligence','missing After photo','Before','During','After','Review / Organize']){
 assert(page.includes(token),'missing timeline feature '+token);
}
const stats=api.timelineStats();assert.equal(stats.photos,3);assert.equal(stats.missingAfter,1);assert.equal(stats.unlinked,1);
assert(api.flaggedPhotos().some(x=>x.label.includes('missing After')));
click({},['data-bf2-suggest']);
page=api.renderPhotoTimeline();
assert(page.includes('Review Photo Links')&&page.includes('data-bf2-savephoto="p2"'));
const shotSelect=makeEl({bf2PhotoShot:'p2'},[],'s1');
change(shotSelect);assert.equal(shotSelect._button.disabled,false,'changing assignment enables save');
const stageSelect=makeEl({bf2PhotoStage:'p2'},[],'after');
change(stageSelect);
assert.equal(writes,0,'Suggested photo changes cannot silently save');
(async()=>{
 click({bf2Savephoto:'p2'});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(writes,1,'Explicit confirmation saves exactly one photo');
 assert.equal(photos.find(p=>p.id==='p2').shotId,'s1');
 assert.equal(photos.find(p=>p.id==='p2').stage,'after');
 assert.equal(photos.find(p=>p.id==='p2').dataUrl,'data:image/png;base64,BBBB','Original image bytes preserved');
 assert.equal(api.timelineStats().missingAfter,0);
 assert(!api.todaysIssues().some(x=>x.key==='after:s1'),'After photo warning resolves when a verified photo is linked');
 assert(saves>=1);
 console.log('BoreLab End-of-Day Assistant 2.0 and Smart Photo Timeline 2.0: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
