'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('web/index.html','utf8');
const app=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const mod=fs.readFileSync('web/field-ops.js','utf8');
const android=fs.readFileSync('app/src/main/assets/web/field-ops.js','utf8');
const address=fs.readFileSync('web/address-scan.js','utf8');
const phoneAddress=fs.readFileSync('app/src/main/assets/web/address-scan.js','utf8');
const workday=fs.readFileSync('web/workday.js','utf8');
const androidWorkday=fs.readFileSync('app/src/main/assets/web/workday.js','utf8');
assert.equal(html,app);assert.equal(mod,android);assert.equal(address,phoneAddress);assert.equal(workday,androidWorkday);
new Function(html.split('<script>')[1].split('</script>')[0]);
for(const script of [mod,address,workday])new Function(script);
for(const marker of ["window.BoreLabFieldOps?.renderTimeline(shot.id)",
 "window.BoreLabFieldOps?.renderReadiness(shot)","window.BoreLabFieldOps?.renderQuickActions()",
 "window.BoreLabFieldOps?.journal('Bore status updated'","window.BoreLabFieldOps.dayWarnings(job,day)",
 "kind:pendingPhotoKind,stage:pendingPhotoStage||''","data-photo-stage-update",
 "window.BoreLabFieldOps?.renderDayReview(activeJob(),date)"]){
 assert(html.includes(marker),'Missing core field upgrade: '+marker);
}
assert(mod.includes('data-form="quick-bore"')&&mod.includes('data-form="complete-bore"'),'New forms must be present in field module');
assert(mod.includes('fieldRecovery'),'Recovery journal must persist in saved state');
assert(address.includes('form[data-form="quick-bore"]'),'Working address-only scanner must support Quick Bore');
assert(workday.includes("window.BoreLabFieldOps.beginCompletion(jobId,shotId)"),'Board must use confirmed completion');
assert(html.includes("window.BoreLabFieldOps?.journal(type==='installed'"),'Manual reel changes need Undo');
assert(html.includes('BoreLab Field · v0.25.0'));
assert(!mod.includes('state=seed()'),'Do not reset existing saved field data');

const shot={id:'s1',name:'Shot 01',feet:175,status:'progress',startedAt:'2026-11-18T08:00:00Z',
 completedAt:null,pipeDiameter:'4 inch',address:'265 S Lindero',
 conduits:[{size:'4 inch',quantity:2,perRunFeet:''},{size:'1.25 inch',quantity:1,perRunFeet:''}]};
let state={
 activeJobId:'job1',allowance:10,shots:[structuredClone(shot)],
 jobs:[{id:'job1',jobName:'South',allowance:10,shots:[structuredClone(shot)],crew:[]}],
 reels:[{id:'r4',name:'4-in primary',size:'4 inch',location:'truck',remaining:400,archived:false},
        {id:'r125',name:'1.25-in second',size:'1.25 inch',location:'truck',remaining:200,archived:false}],
 pipeMoves:[],pipeReservations:[],fieldRecovery:[],shotReadiness:{}
};
let saved=0,rendered=0,closed=0,notice='',dialog='',confirmResult=true,serial=0;
let photos=[
 {id:'p1',shotId:'s1',jobId:'job1',stage:'before',addedAt:'2026-11-18T12:00:00Z',dataUrl:'data:image/jpeg;base64,TEST'},
 {id:'p2',shotId:'s1',jobId:'job1',kind:'camera',addedAt:'2026-11-18T13:00:00Z',dataUrl:'data:image/jpeg;base64,TEST'}
];
const api={state:()=>state,uid:()=>String(++serial),save:()=>{saved++},render:()=>{rendered++},
 closeModal:()=>{closed++},showModal:x=>{dialog=x},notify:x=>{notice=x},photos:()=>photos,
 photoDB:async()=>{},refreshPhotos:async()=>{},todayLocal:()=> '2026-11-18',
 coordsValid:x=>!!x.lat&&!!x.lon};
const sizes={sizeKey:x=>String(x||'').trim().toLowerCase().replace(/"/g,' inch'),
 plan:(s,allowance)=> {
  const c=s.conduits||[];return c.map(x=>({size:x.size,quantity:x.quantity,
   perRun:x.perRunFeet||Number(s.feet)+Number(allowance),
   total:(x.perRunFeet||Number(s.feet)+Number(allowance))*x.quantity}));
 }};
const fakeWindow={BoreLabAssistantBridge:api,BoreLabConduits:sizes,
 BoreLabDailyReels:{activeIds:()=>['r4','r125']},
 BoreLabLocations:{locationKind:()=> 'street',parseCoords:()=>null},confirm:()=>confirmResult};
const fakeDoc={createElement:()=>({textContent:''}),head:{appendChild(){}},addEventListener(){}};
class MockFormData{
 constructor(form){this.form=form}
 entries(){return Object.entries(this.form.fields||{})[Symbol.iterator]()}
}
const ops=new Function('document','window','FormData',
 mod+'return window.BoreLabFieldOps;')(fakeDoc,fakeWindow,MockFormData);
assert(ops&&typeof ops.createQuickBore==='function');
const before=structuredClone(state);
ops.beginCompletion('job1','s1');
assert(dialog.includes('Record Pipe & Finish'),'Finishing must require explicit approval');
assert.equal(state.reels[0].remaining,400,'Opening wizard must not deduct pipe');
assert.equal(state.pipeMoves.length,0);
const form={dataset:{jobId:'job1',shotId:'s1'},fields:{
 'feet_0':'185','reel_0':'r4','feet_1':'185','reel_1':'r4','feet_2':'185','reel_2':'r125'}};
ops.completeBore(form,{submitter:{value:'record'}});
assert.equal(state.reels[0].remaining,30);
assert.equal(state.reels[1].remaining,15);
assert.equal(state.pipeMoves.length,3);
assert.equal(state.jobs[0].shots[0].status,'complete');
assert.equal(state.shots[0].status,'complete');
assert.equal(state.fieldRecovery.length,1);
const log=state.fieldRecovery[0];
(async()=>{
 await ops.undo(log.id);
 assert.equal(state.reels[0].remaining,400,'Undo must restore previous reel balance');
 assert.equal(state.reels[1].remaining,200);
 assert.equal(state.pipeMoves.length,0);
 assert.equal(state.jobs[0].shots[0].status,'progress');
 assert.equal(log.undone,true);
 ops.beginCompletion('job1','s1');
 ops.completeBore(form,{submitter:{value:'record'}});
 const second=state.fieldRecovery[state.fieldRecovery.length-1];
 state.reels[0].remaining=12;
 await ops.undo(second.id);
 assert.equal(state.reels[0].remaining,12,'Do not clobber a newer unrelated reel change');
 assert.equal(second.undone,false,'Conflicting undo should remain unconsumed');
 assert(notice.includes('updated again'),'Should explain why Undo is blocked');

 const review=ops.renderReadiness(state.jobs[0].shots[0]);
 assert(review.includes('811 status checked'));
 confirmResult=false;
 assert.equal(ops.warnBeforeStart('job1','s1'),false,'Unreviewed readiness should prompt before starting');
 confirmResult=true;
 assert.equal(ops.warnBeforeStart('job1','s1'),true);
 const timeline=ops.renderTimeline('s1');
 assert(timeline.includes('Before')&&timeline.includes('During')&&timeline.includes('After'));
 assert(timeline.includes('older / unclassified'));

 // Check adding Quick Bore is independent of current reel inventory.
 const reelTotal=state.reels.reduce((n,r)=>n+r.remaining,0);
 const quick={fields:{name:'Shot 02',feet:'90',size:'2 inch',quantity:'1',address:'265 S Lindero'}};
 ops.createQuickBore(quick);
 assert.equal(state.shots.length,2);
 assert.equal(state.shots[1].feet,90);
 assert.equal(state.shots[1].status,'planned');
 assert.equal(state.reels.reduce((n,r)=>n+r.remaining,0),reelTotal,'Quick Bore cannot deduct stock');
 assert.equal(state.quickBoreDefaults.size,'2 inch');

 // End-of-day analysis must flag missing staged after photo and missing actual footage on the new shot when complete.
 state.jobs[0].shots[0].status='complete';
 state.jobs[0].shots[0].completedAt=new Date('2026-11-18T12:00:00').toISOString();
 const warnings=ops.dayWarnings(state.jobs[0],'2026-11-18');
 assert(warnings.some(x=>x.includes('after photo')),'Completed shots without after photo should be flagged');
 assert(ops.renderDayReview(state.jobs[0],'2026-11-18').includes('Field Record Check'));
 assert(saved>=3&&rendered>=3,'Mutations should save and refresh');
 console.log('BoreLab v0.18 six field workflows: completion atomicity, reel size checks, undo guards, readiness, photo timeline, Quick Bore and daily reporting passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
