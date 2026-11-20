'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('web/index.html','utf8');
const app=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const workday=fs.readFileSync('web/workday.js','utf8'),apkWorkday=fs.readFileSync('app/src/main/assets/web/workday.js','utf8');
const scanner=fs.readFileSync('web/shot-sheet.js','utf8'),apkScanner=fs.readFileSync('app/src/main/assets/web/shot-sheet.js','utf8');
const conduitCode=fs.readFileSync('web/conduits.js','utf8');
assert.equal(html,app);assert.equal(workday,apkWorkday);assert.equal(scanner,apkScanner);
new Function(workday);new Function(scanner);new Function(html.split('<script>')[1].split('</script>')[0]);
assert(html.includes("shotboard:()=>window.BoreLabWorkday?.renderShotBoard()"));
assert(html.includes("case 'go-shotboard':setPage('shotboard')"));
assert(html.includes('data-page="shotboard"'));
assert(html.includes("window.BoreLabWorkday?.renderGpsPanel(plan)"));
assert(html.includes("window.BoreLabWorkday?.renderRouteTools()"));
assert(html.includes("window.BoreLabWorkday?.renderReelOptimizer()"));
assert(html.includes("window.BoreLabWorkday?.renderFinishBy()"));
assert(html.includes('<script src="./workday.js"></script>'));
assert(html.includes('BoreLab Field · v0.26.2'));
assert(!html.includes('Tap “Locate Saved Addresses” for missing pins.</div>'),'Old large GPS warning should be gone');
assert(workday.includes('window.confirm('),'Reopening a completed shot must be confirmed');
assert(workday.includes("if(jobId===state.activeJobId)"),'Keep active and non-active job snapshots consistent');
assert(workday.includes('returnMin'),'Time planner should include return-to-shop allowance');
assert(workday.includes('data-bl-origin="gps"'),'GPS proximity routing must be user-initiated');
assert(scanner.includes('function cropPhotoRegion(')&&scanner.includes('function rotateCropPhoto('));
assert(scanner.includes('data-bls-action="scan-crop"')&&scanner.includes('data-bls-action="scan-full"'));
assert(scanner.includes('root.addEventListener('+"'pointerdown'"),'Touch crop should be supported');
assert(scanner.includes('function parseHeaderFields('));
assert(scanner.includes("if(!root.querySelector('#bls-confirm')?.checked)"),'Review-before-import must remain');

const sane=x=>Number.isFinite(Number(x))?Number(x):0;
const section=(source,from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a+from.length);assert(a>=0&&b>a,from+' source missing');return source.slice(a,b)};
const material=new Function('sane',section(conduitCode,'function sizeKey(','function renderLine(')+'return {sizeKey,plan};')(sane);
const asNumber=(x,fallback=0)=>Number.isFinite(Number(x))?Number(x):fallback;
const simulate=new Function('window','asNumber',section(workday,'function simulateReels(','function renderReelOptimizer(')+'return simulateReels;')({BoreLabConduits:material},asNumber);
const shot={id:'shot-1',feet:175,status:'planned',conduits:[{size:'4 inch',quantity:2,perRunFeet:''},{size:'1.25 inch',quantity:1,perRunFeet:''}]};
const job={id:'job-1',jobName:'Glades',allowance:10,shots:[shot]};
const data={pipeReservations:[],allowance:10};
const pair=[{id:'r4',name:'4 inch primary',size:'4 inch',remaining:400,location:'truck'},
 {id:'r125',name:'1.25 secondary',size:'1.25 inch',remaining:200,location:'truck'}];
const result=simulate(data,'2026-11-18',[{job,shot}],pair);
assert.equal(result.allocations.length,3);
assert.equal(result.shortages.length,0);
assert.equal(result.reels.find(r=>r.id==='r4').remaining,30);
assert.equal(result.reels.find(r=>r.id==='r125').remaining,15);
assert.equal(pair[0].remaining,400,'What-if preview must not mutate physical reel stock');
const tooShort=simulate(data,'2026-11-18',[{job,shot}],
 [{id:'a',name:'Too short 4',size:'4 inch',remaining:180},{id:'b',name:'Only 2in',size:'2 inch',remaining:1000}]);
assert(tooShort.shortages.filter(s=>s.size==='4 inch').length===2,'Cannot combine unlike reels or splice a continuous run');
assert(tooShort.shortages.some(s=>s.size==='1.25 inch'),'Missing conduit size must be flagged');
const reserved=simulate({pipeReservations:[{reelId:'r4',shotId:'unplanned',feet:100}],allowance:10},
 '2026-11-18',[{job,shot}],pair);
assert(reserved.shortages.length>=1,'Reservations outside the plan reduce usable stock');
const legacy={id:'legacy',feet:90,pipeDiameter:'2 inch',status:'planned'};
assert.equal(material.plan(legacy,10)[0].total,100,'Legacy single-size bores still plan correctly');

const estimate=new Function('asNumber',section(workday,'function validTime(','function clockLabel(')+'return finishByEstimate;')(asNumber);
const settings={target:'16:00',pace:60,setup:15,move:20,returnMin:60,lunch:30,buffer:20};
const two=[{name:'Long',feet:175},{name:'Next',feet:155}];
const first=estimate(480,settings,two);
assert.equal(first.count,1,'Return deadline + setup + travel should prevent overbooking');
assert.equal(first.last.name,'Long');
assert.equal(first.usable,370);
assert.equal(estimate(480,{...settings,target:'16:30'},two).count,2);
assert.equal(estimate(980,settings,two).count,0,'No work can fit after finish deadline');

const apiState={activeJobId:'a',shots:[{id:'a1',status:'planned',startedAt:null,completedAt:null}],jobs:[
 {id:'a',archived:false,shots:[{id:'a1',status:'planned',startedAt:null,completedAt:null}]},
 {id:'b',archived:false,shots:[{id:'b1',status:'progress',startedAt:'2026-11-18T11:00:00Z',completedAt:null}]}]};
let saved=0,rendered=0;
const api=()=>({state:()=>apiState,save:()=>{saved++},render:()=>{rendered++},notify:()=>{}});
const transition=new Function('api','window',section(workday,'function transition(','function renderGpsPanel(')+'return transition;')(api,{confirm:()=>true});
transition('b','b1');
assert.equal(apiState.jobs[1].shots[0].status,'complete');
assert.equal(apiState.shots[0].status,'planned','Do not modify active job when changing a different job');
transition('a','a1');
assert.equal(apiState.shots[0].status,'progress','Active local shot must match snapshot');
assert.equal(apiState.jobs[0].shots[0].status,'progress');
assert(saved>=2&&rendered>=2);

const nearest=new Function('api',section(workday,'function orderFrom(','function originPreview(')+'return orderFrom;')(
 ()=>({coordsValid:p=>typeof p?.lat==='number',hav:(a,b)=>Math.abs(a.lat-b.lat)}));
const ranked=nearest({lat:0},[{shot:{id:'far',name:'Far',lat:10}},{shot:{id:'near',name:'Near',lat:1}},{shot:{id:'missing',name:'Unknown'}}]);
assert.equal(ranked.located[0].shot.name,'Near');
assert.equal(ranked.unknown.length,1);

const source=section(scanner,'function parseHeaderFields(','function loadImage(');
const fields=new Function('window',source+'return parseHeaderFields;')(
 {BoreLabLocations:{locationCandidates:()=>[{kind:'street',value:'225 N MAYORAL ST'}]}});
const glades='Work Order # / District\n870980\nSOUTH\nAddress\n225 N MAYORAL ST\nS# 348\nE# 174';
const parsed=fields(glades);
assert.equal(parsed.order,'870980');
assert.equal(parsed.district.toUpperCase(),'SOUTH');
assert.equal(parsed.sMeter,'348');
assert.equal(parsed.eMeter,'174');
assert.equal(parsed.addresses[0],'225 N MAYORAL ST');
assert(!/parseSheet\(.*348/.test(scanner),'Meter numbers must not be fabricated as shot footage');
console.log('BoreLab v0.17 workday batch: board status, GPS routing, continuous reel allocation, time estimate, scanner UI and header parsing passed.');
