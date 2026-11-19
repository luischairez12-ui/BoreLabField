'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('web/index.html','utf8');
const js=fs.readFileSync('web/connected-ops-3.js','utf8');
const css=fs.readFileSync('web/connected-ops-3.css','utf8');
assert.equal(html,fs.readFileSync('app/src/main/assets/web/index.html','utf8'));
assert.equal(js,fs.readFileSync('app/src/main/assets/web/connected-ops-3.js','utf8'));
assert.equal(css,fs.readFileSync('app/src/main/assets/web/connected-ops-3.css','utf8'));
new Function(js);new Function(html.split('<script>')[1].split('</script>')[0]);
for(const x of ['<script src="./connected-ops-3.js"></script>','connected-ops-3.css','crewmanager2','fieldintelligence3','equipmentmanager2','tomorrowplanner','openRosterForm:manageRoster','openEquipmentForm:equipmentForm','oilStatus,'])assert(html.includes(x),x);
for(const x of ['b3-head','b3-stats','b3-equipment-card','b3-plan-tick','b3-signal'])assert(css.includes(x),x);
const today='2026-11-19',next='2026-11-20';
const operator={id:'p1',name:'Juan'},locator={id:'p2',name:'Miguel'};
const shotA={id:'a1',name:'Shot 01',feet:145,status:'planned',lat:'',lon:'',pipeDiameter:'4 in'};
const shotB={id:'a2',name:'Shot 02',feet:155,status:'complete',completedAt:'2026-11-19T15:00:00.000Z'};
const entry={id:'t1',memberId:'p1',name:'Juan',start:'2026-11-19T12:00:00.000Z',end:'',lunch:0};
const entry2={id:'t2',memberId:'p2',name:'Miguel',start:'2026-11-18T12:00:00.000Z',end:'2026-11-18T21:00:00.000Z',lunch:60};
const job={id:'j1',jobName:'South Glades',allowance:10,shots:[shotA,shotB],crew:[entry,entry2]};
const other={id:'j2',jobName:'North Glades',shots:[],crew:[]};
const rig={id:'e1',name:'JT20 Drill',type:'Drill',serial:'JV-22'};
const truck={id:'e2',name:'Work Truck',type:'Truck',odometer:150000,oilIntervalMiles:5000};
const reel={id:'r1',name:'4 inch HDPE',size:'4 in',remaining:105,location:'truck'};
const st={jobs:[job,other],activeJobId:'j1',jobName:'South Glades',shots:job.shots,crew:job.crew,
 roster:[operator,locator],selectedCrewIds:['p1','p2'],equipment:[rig,truck],reels:[reel],allowance:10};
let saves=0,renders=0,notices=[],rosterOpened=0,equipmentOpened=[];
const listeners={};
const bridge={
 state:()=>st,save:()=>{saves++},render:()=>{renders++},notify:s=>notices.push(s),
 todayLocal:()=>today,uid:()=> 'id-'+(saves+renders+notices.length+1),
 coordsValid:s=>Boolean(s?.lat&&s?.lon),
 orderedShots:()=>({order:[shotA]}),photos:()=>[],
 openRosterForm:()=>{rosterOpened++},openEquipmentForm:id=>equipmentOpened.push(id??null),
 oilStatus:e=>e.type==='Truck'?{kind:'soon',label:'Oil change coming up',details:'Verify interval and odometer'}:null
};
const window={BoreLabAssistantBridge:bridge,BoreLabCommand:{reelPlan:()=>({simulation:{shortages:[{shot:shotA}]}})},confirm:()=>true};
const document={addEventListener:(event,fn)=>{(listeners[event]??=[]).push(fn)}};
const ops=new Function('window','document',js+';return window.BoreLabConnectedOps3')(window,document);
const before=JSON.stringify({shots:job.shots,crew:job.crew,reels:st.reels,equipment:st.equipment});
for(const [method,contains] of [
 ['renderCrew','Crew Management 2.0'],['renderIntelligence','Field Intelligence 3.0'],
 ['renderEquipment','Smart Equipment Manager 2.0'],['renderTomorrow','Tomorrow’s Work Planner']]){
 const screen=ops[method]();
 assert(screen.includes(contains),method+' not rendered');
 assert(!screen.includes('NaN'),method+' contains invalid numbers');
}
assert.equal(saves,0,'Rendering has no side effects');
assert.equal(JSON.stringify({shots:job.shots,crew:job.crew,reels:st.reels,equipment:st.equipment}),before);
let signals=ops.signalData();
for(const part of ['open crew shift','without GPS','missing After photos','Recorded pipe footage may be short','continuous pipe run','truck oil-service reminder','Tomorrow’s work plan is not saved']){
 assert(signals.some(x=>x.title.includes(part)),'missing insight '+part);
}
const click=(dataset={},attributes=[])=>{
 const el={dataset,hasAttribute:n=>attributes.includes(n)};
 for(const fn of listeners.click||[])fn({target:{closest:()=>el}});
};
const form=(type,values={},ids={})=>({
 hasAttribute:n=>n===type,
 querySelector:selector=>{
  const m=selector.match(/^\[name="([^"]+)"\]$/);
  return m?{value:values[m[1]]??''}:null;
 },
 querySelectorAll:selector=>{
  const m=selector.match(/^\[data-b3-plan-([^]]+)\]:checked$/);
  return m?(ids[m[1]]||[]).map(value=>({value})):[];
 }
});
const submit=f=>{for(const fn of listeners.submit||[])fn({target:f,preventDefault:()=>{}})};
click({},['data-b3-roster']);assert.equal(rosterOpened,1);
click({},['data-b3-toggle-assignment']);
assert(ops.renderCrew().includes('data-b3-assignment'));
ops.setCrewDate(next);
submit(form('data-b3-assignment',{personId:'p1',jobId:'j1',role:'Locator',notes:'Lead locate'}));
assert.equal(st.crewAssignmentsV2.length,1);assert.equal(st.crewAssignmentsV2[0].role,'Locator');
assert.equal(entry.end,'','Saving assignments must not check out a crew member');
assert(ops.renderCrew().includes('Lead locate'));
click({b3Report:'e1'});
assert(ops.renderEquipment().includes('data-b3-issue'));
submit(form('data-b3-issue',{category:'Breakdown',priority:'urgent',downtime:'yes',note:'Hydraulic leak'}));
assert.equal(st.equipmentIssuesV2.length,1);assert(st.equipmentIssuesV2[0].downtime);
assert(ops.signalData().some(x=>x.title.includes('equipment downtime')));
assert(ops.renderEquipment().includes('Hydraulic leak'));
const issueId=st.equipmentIssuesV2[0].id;
click({b3Resolve:issueId});
assert(st.equipmentIssuesV2[0].closedAt);
click({b3LogService:'e1'});
submit(form('data-b3-service',{date:today,kind:'Hose replacement',note:'Tested pressure'}));
assert.equal(st.equipmentServiceV2.length,1);
assert(ops.renderEquipment().includes('Hose replacement'));
click({b3EditEquipment:'e2'});assert.deepEqual(equipmentOpened,['e2']);
click({},['data-b3-add-equipment']);assert.deepEqual(equipmentOpened,['e2',null]);
ops.setPlanDate(next);
const req=ops.pipeNeeded([shotA]);assert.equal(req,155);
const planScreen=ops.renderTomorrow();
assert(planScreen.includes('155 ft')&&planScreen.includes('105 ft'));
assert(planScreen.includes('data-b3-plan-shot')&&planScreen.includes('data-b3-plan-reel'));
submit(form('data-b3-plan',{startTime:'07:00',leaveTime:'16:30',notes:'Confirm locate marks'},
 {shot:['a1'],crew:['p1'],reel:['r1'],gear:['e1']}));
const saved=ops.selectedPlan();
assert(saved&&saved.jobId==='j1'&&saved.date===next);
assert.deepEqual(saved.shotIds,['a1']);assert.deepEqual(saved.crewIds,['p1']);
assert.deepEqual(saved.reelIds,['r1']);assert.deepEqual(saved.gearIds,['e1']);
assert.equal(saved.notes,'Confirm locate marks');
assert.equal(saved.leaveTime,'16:30');
assert.deepEqual(job.shots,[shotA,shotB],'Planning does not change shots');
assert.equal(job.crew[0].end,'','Planning cannot clock out crew');
assert.equal(st.reels[0].remaining,105,'Planning never deducts pipe');
assert.equal(st.equipment[0].archived,undefined,'Planning does not change equipment');
assert(saves>=4&&renders>=4);
assert(!ops.signalData().some(x=>x.title==='Tomorrow’s work plan is not saved'));
console.log('Connected Operations 3.0: Crew assignments, intelligence alerts, equipment issues/service, tomorrow plan and data safety PASS');
