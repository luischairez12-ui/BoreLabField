'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('web/index.html'),home=read('web/home-dashboard.js'),nav=read('web/field-navigation.js');
const names=['index.html','home-dashboard.js','field-navigation.js','field-material-v023.js','field-next-v023.js',
 'field-photo-compare-v023.js','field-productivity-v023.js','home-collapse-v023.js','field-productivity-v023.css'];
for(const name of names)assert.equal(read('web/'+name),read('app/src/main/assets/web/'+name),'Android/web file mismatch: '+name);
for(const name of names.slice(3))assert(html.includes('./'+name),'Missing required asset '+name);
for(const name of names.filter(x=>x.endsWith('.js')))new Function(read('web/'+name));
new Function(html.split('<script>')[1].split('</script>')[0]);
assert(!html.includes('id="bfMenuButton"'),'Redundant top-right menu was removed');
assert(html.includes('class="bf-edge-tab" data-bf-drawer'),'The orange Edge Tab remains main menu');
assert(html.includes('id="topNavButton"'),'Back button remains for interior screens');
assert(html.includes("'fieldhub','fieldproductivity'"),'Productivity is a registered page');
assert(html.includes('fieldproductivity:()=>window.BoreLabProductivity?.render?.()'),'New page route works');
assert(nav.includes("page:'fieldproductivity'"),'Edge drawer offers Productivity');
assert(home.includes('window.BoreLabProductivity?.homeLinks?.()'),'Home has 3 productivity shortcuts');
assert(html.includes('window.BoreLabHomeCollapse?.sync?.()'),'Scroll mini-header sync runs after page render');
assert(html.includes('BoreLab Field · v0.27.0'),'Expected v0.23 version');
assert(read('web/field-productivity-v023.css').includes('.bp-sticky-job'),'Compact hero header CSS is present');
assert(read('web/home-collapse-v023.js').includes('getBoundingClientRect().bottom>top+8'),'Hero collapse responds to scroll visibility');
const job={id:'j1',jobName:'South Glades',allowance:10,shots:[
 {id:'s1',name:'Shot 01',feet:100,status:'planned',conduits:[{size:'4 inch',quantity:1}]},
 {id:'s2',name:'Shot 02',feet:175,status:'planned',conduits:[{size:'4 inch',quantity:2}]},
 {id:'s3',name:'Shot 03',feet:80,status:'planned',conduits:[{size:'2 inch',quantity:1}]},
 {id:'s4',name:'Completed',feet:500,status:'complete',conduits:[{size:'4 inch',quantity:1}]}
 ],fieldPins:[{id:'p1',name:'Box 1'}],fieldMarkers:[{id:'m1',status:'open',kind:'obstruction',notes:'Crossing'}]};
const state={activeJobId:'j1',jobs:[job],reels:[
 {id:'r1',location:'truck',size:'4 inch',remaining:250},
 {id:'r2',location:'truck',size:'4 inch',remaining:100},
 {id:'r3',location:'truck',size:'2 inch',remaining:70},
 {id:'r4',location:'yard',size:'4 inch',remaining:400}
 ],allowance:10};
const pictures=[
 {id:'before',jobId:'j1',shotId:'s1',stage:'before',dataUrl:'data:image/png;base64,AA==',addedAt:'2026-11-18T08:00:00'},
 {id:'after',jobId:'j1',shotId:'s1',stage:'after',dataUrl:'data:image/png;base64,AQ==',addedAt:'2026-11-18T17:00:00'},
 {id:'unlinked',jobId:'j1',dataUrl:'data:image/png;base64,Ag==',addedAt:'2026-11-18T09:00:00'},
 {id:'box',jobId:'j1',fieldPinId:'p1',dataUrl:'data:image/png;base64,Aw==',addedAt:'2026-11-18T10:00:00'}
];
let saved=0,renderCount=0,page='home',opened='',lastNotice='',lastPhoto='';
const route=[job.shots[1],job.shots[0],job.shots[2]];
const bridge={state:()=>state,activeJob:()=>job,orderedShots:()=>({order:route}),
 currentPage:()=>page,setPage:p=>{opened=p;page=p},render:()=>renderCount++,
 notify:x=>lastNotice=x,save:()=>saved++,photos:()=>pictures,
 coordsValid:shot=>shot.id==='s1',shotDetail:id=>opened=id,photoDetail:id=>lastPhoto=id,
 pipeOnTruck:()=>420};
let role='owner',unlocked=true,heroBottom=450;
const elements={};
const doc={readyState:'loading',addEventListener:()=>{},querySelector:selector=>{
 if(selector==='#bpStickyJob')return elements.mini||null;
 if(selector==='#main .bh-hero')return {getBoundingClientRect:()=>({bottom:heroBottom})};
 if(selector==='.topbar')return {getBoundingClientRect:()=>({bottom:64})};
 if(selector==='#main')return {getBoundingClientRect:()=>({left:9,width:350})};
 return null;
},createElement:tag=>({tagName:tag,style:{},hidden:true,setAttribute:()=>{},innerHTML:''}),
 body:{appendChild:el=>{elements.mini=el}}};
const win={BoreLabAssistantBridge:bridge,BoreLabLocalAccounts:{isUnlocked:()=>unlocked,role:()=>role},
 BoreLabConduits:{sizeKey:x=>x==='4 inch'?'4 in':x==='2 inch'?'2 in':x,
 plan:(shot,allowance)=>shot.conduits.map(c=>({size:c.size,quantity:c.quantity,perRun:shot.feet+allowance,total:(shot.feet+allowance)*c.quantity}))},
 BoreLabDailyReels:{activeIds:()=>[]},addEventListener:()=>{},requestAnimationFrame:fn=>fn(),innerWidth:360,
 scrollTo:()=>{},matchMedia:()=>({matches:false})};
const load=name=>new Function('window','document',read('web/'+name)+';return window')(win,doc);
load('field-material-v023.js');load('field-next-v023.js');load('field-photo-compare-v023.js');load('field-productivity-v023.js');load('home-collapse-v023.js');
const material=win.BoreLabPickup,next=win.BoreLabNextMove,photos=win.BoreLabPhotoCompare,work=win.BoreLabProductivity,collapse=win.BoreLabHomeCollapse;
const d=material.requirements(),four=d.lines.find(x=>x.key==='4 in'),two=d.lines.find(x=>x.key==='2 in');
assert.equal(four.needed,480,'Conduit quantities and allowance counted across pending bores');
assert.equal(four.available,350,'Only physical truck reels counted, not the yard');
assert.equal(four.shortage,130);
assert.equal(two.needed,90);
assert.equal(two.shortage,20);
assert.equal(two.longRisk,true,'Single continuous-run length warning');
assert.equal(d.lines.length,2,'Completed bores not part of pickup requirements');
assert(material.render().includes('Short 130 ft'),'Shortage visible in Pickup UI');
assert(material.checklistText().includes('4 inch'));
material.mark('4 in',true);assert.equal(job.materialPickupChecks['4 in'].done,true);
assert.equal(saved,1,'Checklists persist through existing job save');
assert.equal(state.reels[0].remaining,250,'Checking pickup does not deduct reel footage');
assert.equal(next.plan().best.shot.id,'s1','Pipe-ready shot preferred over routes with insufficient material');
assert(next.render().includes('unresolved field marker'),'Hazards remain visible in next move');
assert(next.pipeStatus(job.shots[1]).state==='short');
assert.equal(photos.groups().length,2,'Unlinked photo excluded from comparison');
const pair=photos.selection();assert.equal(pair.first.id,'before');assert.equal(pair.second.id,'after');
assert(photos.render().includes('Before')&&photos.render().includes('After'));
assert(work.render().includes('Material Pickup Assistant')&&work.homeLinks().includes('Before & After'));
work.open('next');assert.equal(opened,'fieldproductivity');
assert(work.render().includes('Next Move'));
role='crew';work.open('compare');assert.equal(work.getTab(),'next','Role restriction applies to productivity tabs');
role='owner';page='home';collapse.update();assert(elements.mini?.hidden,'Expanded hero keeps compact header hidden');
heroBottom=50;collapse.update();assert.equal(elements.mini.hidden,false,'Scroll past hero shows compact job header');
assert(elements.mini.innerHTML.includes('South Glades')&&elements.mini.innerHTML.includes('420 ft pipe'));
page='planner';collapse.update();assert(elements.mini.hidden,'Compact bar hides outside Home');
unlocked=false;assert.equal(material.allowed(),false,'Account lock disables productivity edits');
console.log('BoreLab 0.23: Material Pickup, Next Move, Before/After Photos, sticky Home hero, role safety, no duplicate hamburger and Android asset parity PASS');
