'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');
const html=read('web/index.html');
assert.equal(html,read('app/src/main/assets/web/index.html'),'Android and web HTML must match');
for(const file of ['map-calendar-v031.js','map-calendar-v031.css','jobsite-map.js','jobsite-map.css']){
 assert.equal(read('web/'+file),read('app/src/main/assets/web/'+file),'Android and web asset mismatch: '+file);
 assert(html.includes('./'+file),'Missing asset import: '+file);
}
const inline=html.split('<script>')[1].split('</script>')[0],
 mapSource=read('web/jobsite-map.js'),calendarSource=read('web/map-calendar-v031.js'),asBuiltSource=read('web/asbuilt-2.js'),css=read('web/map-calendar-v031.css');
for(const src of [inline,mapSource,calendarSource,asBuiltSource])new Function(src);
assert(html.includes('BoreLab Field · Records stay on this device'),'Updated build footer');
assert(html.includes("const KEY='borelab-field-v0.1'"),'Original local data structure preserved');
const day='2026-11-19';
const shots=[
 {id:'sh1',name:'Pending bore',feet:175,status:'planned',lat:26.62,lon:-81.62,startedAt:'2026-11-19T09:10:00-05:00'},
 {id:'sh2',name:'Complete bore',feet:90,status:'complete',lat:26.621,lon:-81.621,completedAt:'2026-11-18T15:30:00-05:00'},
 {id:'sh3',name:'Drilling bore',feet:155,status:'progress',lat:26.622,lon:-81.622,startedAt:'2026-11-19T10:00:00-05:00'}];
const job={id:'j1',jobName:'South Glades',shots,fieldPins:[],crew:[]};
const state={jobs:[job],activeJobId:'j1',shots,jobName:'South Glades',history:[],pipeMoves:[],mudLogs:[],mudStockMoves:[],fieldRecovery:[]};
const callbacks={},events={};
let count=0,printed='',openPage='';
const valid=r=>r&&r.lat!=null&&r.lon!=null&&r.lat!==''&&r.lon!==''&&Number.isFinite(+r.lat)&&Number.isFinite(+r.lon);
const bridge={state:()=>state,photos:()=>[],todayLocal:()=> '2026-11-20',currentPage:()=> 'jobmap',
 coordsValid:valid,render:()=>count++,save:()=>{},notify:()=>{},setPage:p=>{openPage=p},
 orderedShots:()=>({order:shots}),activeJob:()=>job};
const doc={addEventListener:(type,cb)=>(callbacks[type]??=[]).push(cb),querySelector:()=>null,querySelectorAll:()=>[],elementFromPoint:()=>null};
const w={BoreLabAssistantBridge:bridge,BoreLabFieldPins:{pins:()=>[],kindLabels:{}},BoreLabConduits:{summary:()=>''},
 BoreLabCommand:{weatherSnapshot:()=>null},addEventListener:()=>{}};
const ab=new Function('window','document',asBuiltSource+';return window.BoreLabAsBuilt')(w,doc);
const map=new Function('window','document','requestAnimationFrame',mapSource+';return window.BoreLabJobMap')(w,doc,undefined);
const cal=new Function('window','document',calendarSource+';return window.BoreLabMapCalendarV31')(w,doc);
assert(cal&&map&&ab,'Required modules load');
let screen=map.renderMap();
assert(screen.includes('Field Calendar')&&screen.includes('data-blcal-day="2026-11-19"'),'Full-width monthly Calendar integrated above map');
assert(screen.indexOf('Field Calendar')<screen.indexOf('Jobsite Locations'),'Calendar sits above jobsite pins');
for(const duplicate of ['▦ Change Job','⌁ Shot Planner','▤ As-Built PDF','Work date <input']){
 assert(!screen.includes(duplicate),'Removed redundant control: '+duplicate);
}
assert(screen.includes('data-blmap-filter="planned"')&&screen.includes('data-blmap-filter="complete"'));
assert(css.includes('.blmap-filter-planned.active')&&css.includes('.blmap-filter-progress.active')&&css.includes('.blmap-filter-complete.active'),
 'Amber pending, blue drilling and green complete filters have distinct styles');
assert(css.includes('.blmap-pin.is-planned')&&css.includes('.blmap-pin.is-progress')&&css.includes('.blmap-pin.is-complete'),
 'Status legend and physical GPS pins use consistent colors');
cal.select(day);
assert.equal(map.getDay(),day,'Calendar picks map work date');
assert.equal(ab.getDay(),day,'Selected workday opens same recorded history');
assert.equal(map.model().groups.all,2,'Date filter includes only two recorded bores');
assert.equal(map.model().groups.planned,1);
assert.equal(map.model().groups.progress,1);
assert.equal(map.model().groups.complete,0);
screen=map.renderMap();
assert(screen.includes('Export This Day PDF')&&screen.includes('Day details &amp; replay'),'Selected day has export and detail actions');
assert(!screen.includes('data-blcal-day="2026-11-19"'),'Calendar collapses after selecting date');
function click(attribute){
 const target={dataset:{},hasAttribute:x=>x===attribute,
  closest:q=>q.includes('['+attribute+']')?target:null};
 for(const cb of callbacks.click||[])cb({target,preventDefault(){}});
}
ab.exportAsBuilt=date=>{printed=date};
click('data-blcal-pdf');
assert.equal(printed,day,'PDF exports only the selected date');
click('data-blcal-details');
assert.equal(openPage,'fieldhistory','Day detail button opens Calendar, not a duplicate PDF page');
assert.equal(ab.getDay(),day);
cal.select('2026-11-16');
screen=map.renderMap();
assert(screen.includes('data-blcal-pdf disabled'),'No recorded work prevents empty-day export');
click('data-blcal-clear');
assert.equal(map.getDay(),'','All Dates clears date filter without deleting records');
assert.equal(map.model().groups.all,3);
assert(count>=3,'Calendar changes refresh existing map');
console.log('BoreLab v0.31 integrated Calendar, date-specific PDF, date filters and three high-contrast statuses PASS');
