'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('web/index.html'),android=read('app/src/main/assets/web/index.html');
assert.equal(html,android,'Web and Android HTML must stay byte-for-byte identical');
for(const suffix of ['streamlined-v029.js','streamlined-v029.css','field-fab.js','field-navigation.js']){
 assert.equal(read('web/'+suffix),read('app/src/main/assets/web/'+suffix),'Android and web copy mismatch: '+suffix);
 assert(html.includes('./'+suffix),'Missing linked script or stylesheet: '+suffix);
}
const inline=html.split('<script>')[1].split('</script>')[0];
new Function(inline);
new Function(read('web/streamlined-v029.js'));
new Function(read('web/field-navigation.js'));
new Function(read('web/field-fab.js'));
assert(html.includes('fieldcommand:()=>window.BoreLabStreamlineV29'),'Field Command has its own page');
assert(inline.includes("'fieldcommand','bores'"),'Field Command must be an allowed registered page');
assert(html.includes('window.BoreLabStreamlineV29.renderBores({orderedShots,routeMap,mapsLink,pipeNeed})'));
assert(html.includes('window.BoreLabStreamlineV29?.renderReels?.({inventory:pipeInventoryView})'));
assert(inline.includes("if(p==='reelplan'||p==='reelcommand')"),'Legacy reel links redirect to Pipe Reels');
assert(inline.includes("if(p==='planner'||p==='shotcards')"),'Legacy bore links still resolve');
assert(inline.includes("window.BoreLabStreamlineV29?.remember?.(page)"));
assert(inline.includes("window.BoreLabStreamlineV29?.restore?.(p)"));
assert(inline.includes("const KEY='borelab-field-v0.1'"),'Do not reset saved offline records');
const nav=read('web/field-navigation.js');
assert(nav.includes("page:'fieldcommand'"),'Sidebar has Field Command');
assert(nav.includes("'fieldcommand','crew','jobmap','photos','pipe'"),'Compact sidebar uses core destinations');
const fab=read('web/field-fab.js');
assert(fab.includes("if(page==='bores')")&&fab.includes("if(page==='pipe')")&&fab.includes("if(page==='fieldcommand')"));
const job={id:'j1',jobName:'HDD Test',jobAddress:'Route 80',shots:[
 {id:'A',name:'175',feet:175,status:'planned',address:'North'},
 {id:'B',name:'90',feet:90,status:'planned',address:'East'},
 {id:'C',name:'155',feet:155,status:'planned',address:'West'}],
 crew:[{name:'Juan',start:'2026-11-20T12:00:00Z',end:''}]};
const state={activeJobId:'j1',jobName:'HDD Test',shots:job.shots,routeMode:'longest_first',jobs:[job],
 reels:[{id:'r1',name:'2-inch',size:'2-inch',remaining:345,location:'truck'}],roster:[{id:'p1',name:'Juan',primaryRole:'Driller'}],crewAssignmentsV2:[]};
const bridge={state:()=>state,activeJob:()=>job,todayLocal:()=> '2026-11-20',photos:()=>[],render:()=>{},save:()=>{},shotDetail:()=>{},newBore:()=>{}};
const w={BoreLabAssistantBridge:bridge,BoreLabFieldCommand3:{count:()=>({pending:3,gps:1,after:2,unlinked:1})},
 BoreLabFieldWork3:{evidenceList:()=>[{type:'photo'}]},
 BoreLabCommand:{renderShotCards:()=>'<div>Existing Smart Shot Cards</div>'},
 BoreLabDailyReels:{renderSection:()=>'<div>Reel selection</div>'},
 BoreLabWorkday:{renderReelOptimizer:()=>'<div>Reel optimizer</div>'},
 BoreLabConduits:{renderPlannerSummary:()=>'<div>Mixed conduit sizes</div>'},
 BoreLabReelCommand:{render:()=>'<div>Reel Command</div>'}};
const listeners={};
const storage={getItem:()=>null,setItem:()=>{}};
vm.runInNewContext(read('web/streamlined-v029.js'),{
 window:w,document:{addEventListener:(k,cb)=>(listeners[k]??=[]).push(cb)},sessionStorage:storage,
 Date,Math,Number,Array,Object,String,JSON,Set,Map,console});
const ui=w.BoreLabStreamlineV29;
assert(ui&&ui.tab('bores')==='planner','Shot Planner opens by default');
assert(ui.renderHome().includes('Field Command')&&ui.renderHome().includes('Daily snapshot'));
const ctx={orderedShots:()=>({order:job.shots,usable:true,message:'Sorted'}),routeMap:()=>'<div>GPS map preview</div>',mapsLink:()=>''};
let bores=ui.renderBores(ctx);
assert(bores.includes('GPS map preview'),'Map is on top of Bores');
assert(bores.indexOf('GPS map preview')<bores.indexOf('Choose how you’d like to finish your day'),'Map comes before route choice');
assert(bores.indexOf('Choose how you’d like to finish your day')<bores.indexOf('Shot Planner</h2>'),'Route choice comes before shot list');
assert(bores.includes('longest_first')&&bores.includes('shortest_first'),'Unified route choice includes size ordering');
assert(!bores.includes('Reel optimizer'),'Reel optimizer is not cluttering Bores');
assert(bores.includes('data-page="pipe"'),'Reel details live in Pipe Reels');
ui.selectTab('bores','cards',false);
assert(ui.renderBores(ctx).includes('Existing Smart Shot Cards'),'Existing shot cards retained');
assert(ui.renderFieldCommand().includes('Dispatch Crew'),'Field Command is operational');
ui.selectTab('command','review',false);
assert(ui.renderFieldCommand().includes('Pre-drill checks'),'Safety review available');
assert(ui.renderReels({inventory:()=>'<div>Inventory page</div>'}).includes('Inventory page'));
ui.selectTab('reels','plan',false);
assert(ui.renderReels({inventory:()=>''}).includes('Reel optimizer'),'Planner has moved to dedicated Reels');
ui.selectTab('reels','command',false);
assert(ui.renderReels({inventory:()=>''}).includes('Reel Command'),'Reel Command remains available');
const start=inline.indexOf('function orderedShots(){'),end=inline.indexOf('function mapPoint(o){',start);
assert(start>=0&&end>start,'Route ordering implementation retained');
const ordered=new Function('state','coordsValid','feet','shop','hav','permutations',
 inline.slice(start,end)+'return orderedShots();');
const compute=mode=>{
 state.routeMode=mode;
 return ordered(state,()=>true,x=>Number(x.feet)||0,()=>({lat:26,lon:-81}),()=>1,x=>[x]).order.map(x=>x.id);
};
assert.deepEqual(compute('longest_first'),['A','C','B']);
assert.deepEqual(compute('shortest_first'),['B','C','A']);
console.log('BoreLab v0.29 streamlined dashboard, Field Command, Bores map/route, Pipe Reels, role routing and legacy storage PASS');
