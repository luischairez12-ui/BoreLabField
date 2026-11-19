'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('web/index.html','utf8');
const nativeHtml=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const js=fs.readFileSync('web/field-pins.js','utf8');
const mapSource=fs.readFileSync('web/jobsite-map.js','utf8');
assert.equal(html,nativeHtml,'Android and browser HTML must stay synchronized');
assert.equal(js,fs.readFileSync('app/src/main/assets/web/field-pins.js','utf8'));
assert.equal(fs.readFileSync('web/field-pins.css','utf8'),fs.readFileSync('app/src/main/assets/web/field-pins.css','utf8'));
assert(html.includes('./field-pins.js')&&html.includes('./field-pins.css'));
assert(!html.includes('class="card planner-home-summary"'),'duplicated shop card is removed from Bores');
assert(html.includes('BoreLabFieldPins?.renderBoresTools()'),'Bores renders date search');
assert(html.includes('case \'field-pin-open\''),'universal search opens field pin details');
new Function(js);new Function(mapSource);
const current={id:'job-1',jobName:'South Glades',fieldPins:[]};
const shot={id:'shot-1',name:'Shot 04',feet:125,status:'complete',lat:'26.7123',lon:'-81.3456',completedAt:'2026-11-19T13:00:00',address:'South Glades'};
const state={jobs:[current],activeJobId:'job-1',jobName:'South Glades',shots:[shot],demo:false};
const listeners={};let saves=0,rerenders=0,closes=0;
const doc={
 addEventListener:(event,handler)=>{(listeners[event]??=[]).push(handler)},
 querySelector:()=>null,
 querySelectorAll:()=>[],
 elementFromPoint:()=>null
};
const bridge={
 activeJob:()=>current,state:()=>state,uid:()=> 'pin-1',
 notify:()=>{},save:()=>{saves++},render:()=>{rerenders++},closeModal:()=>{closes++},
 showModal:()=>{},currentPage:()=> 'planner',coordsValid:p=>p.lat!==''&&p.lon!==''&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lon),
 orderedShots:()=>({order:[shot]}),photos:()=>[],mapsPinUrl:()=>'',openMapUrl:()=>{},shotDetail:()=>{}
};
const win={BoreLabAssistantBridge:bridge,BoreLabCommand:{weatherSnapshot:()=>null},BoreLabConduits:{summary:()=> '1 × 2" conduit'},addEventListener:()=>{}};
class FakeFormData{
 constructor(form){this.form=form}
 get(name){return this.form.data[name]??''}
}
const fieldPinsModule=new Function('window','document','FormData','confirm','requestAnimationFrame',js+';return window.BoreLabFieldPins;')(win,doc,FakeFormData,()=>true,()=>{});
assert(module&&fieldPinsModule.renderBoresTools&&fieldPinsModule.pins);
assert(fieldPinsModule.renderBoresTools().includes('data-fp-day'),'Bores has calendar-based date search');
assert(fieldPinsModule.dateTerms(shot).includes('11/19/2026'),'bore timestamps indexed as US dates');
assert.equal(fieldPinsModule.displayDate(shot),'Nov 19, 2026');
const form={
 dataset:{fpId:''},
 data:{kind:'coupling',name:'Coupling near driveway',occurredDay:'2026-11-19',lat:'26.7125',lon:'-81.3458',address:'South Glades',notes:'Two-inch coupling'},
 closest:selector=>selector==='form[data-fp-form]'?form:null
};
assert.equal(listeners.submit.length,1);
listeners.submit[0]({target:form,preventDefault:()=>{}});
assert.equal(current.fieldPins.length,1,'coupling record saved to active job');
assert.equal(current.fieldPins[0].recordType,'fieldPin');
assert.equal(current.fieldPins[0].occurredDay,'2026-11-19');
assert.equal(current.fieldPins[0].lat,'26.7125');
assert(saves===1&&closes===1&&rerenders===1,'saving persists and refreshes');
assert(fieldPinsModule.dateTerms(current.fieldPins[0]).includes('11/19/2026'));
const queryEvent=val=>listeners.input[0]({target:{matches:selector=>selector==='[data-fp-query]',value:val}});
queryEvent('11/19/2026');
assert.equal(fieldPinsModule.matching().length,2,'search by date finds both bore and installed coupling');
queryEvent('coupling');
assert.equal(fieldPinsModule.matching().length,1,'search by type/name finds installed coupling');
queryEvent('unrelated');
assert.equal(fieldPinsModule.matching().length,0);
queryEvent('');
const map=new Function('window','document','requestAnimationFrame',mapSource+';return window.BoreLabJobMap;')(win,doc,undefined);
assert.equal(map.model().geocoded.length,2,'field pins share same jobsite map as saved bores');
assert.equal(map.model().records.length,2);
assert(map.markerHTML(current.fieldPins[0],130,140).includes('is-coupling'),'pin has distinctive map class');
assert(map.markerHTML(current.fieldPins[0],130,140).includes('Nov 19, 2026'),'pin displays date label');
map.renderMap(); // Initialize the current-job map before selecting a marker.
map.setSelected('pin-1');
const screen=map.renderMap();
assert(screen.includes('Coupling near driveway')&&screen.includes('Edit Pin'));
assert(screen.includes('Nov 19, 2026'),'map popup shows date');
assert(screen.includes('Bores')&&screen.includes('Tie-ins')&&screen.includes('Couplings')&&screen.includes('Boxes'));
map.setSelected(null);
map.setTypeFilter('coupling');
assert.equal(map.model().shown.length,1,'map type filters isolate installed coupling');
map.setTypeFilter('bores');
assert.equal(map.model().shown.length,1,'bores-only filter excludes installed coupling');
console.log('Dated Bores search, coupling save, pin card, type filters and offline job storage PASS');
