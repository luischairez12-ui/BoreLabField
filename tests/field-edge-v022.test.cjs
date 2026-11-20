'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('web/index.html'),edge=read('web/field-edge-v022.js'),css=read('web/field-edge-v022.css');
const atlas=read('web/field-atlas.js'),ab=read('web/asbuilt-2.js'),fab=read('web/field-fab.js'),nav=read('web/field-navigation.js'),ops=read('web/field-ops.js');
assert.equal(html,read('app/src/main/assets/web/index.html'),'Web and Android UI match');
for(const path of ['field-edge-v022.js','field-edge-v022.css','field-fab.js','field-navigation.js','field-ops.js','home-dashboard.js','asbuilt-2.js','field-atlas.js'])
 assert.equal(read('web/'+path),read('app/src/main/assets/web/'+path),'Unmirrored '+path);
for(const path of ['field-edge-v022.js','field-edge-v022.css'])assert(html.includes('./'+path),'Asset missing '+path);
for(const code of [edge,fab,nav,ops,ab,atlas])new Function(code);
new Function(html.split('<script>')[1].split('</script>')[0]);
assert(html.includes("fieldhub:()=>window.BoreLabEdgeV22?.renderHub?.()"),'Field Hub route');
assert(html.includes("'localaccounts','fieldhub'"),'Field Hub is whitelisted');
assert(html.includes('BoreLab Field · v0.27.0'));
assert(html.includes('window.BoreLabEdgeV22?.isPeekOpen?.()'),'Back closes Peek');
assert(html.includes('Field Hub / Photo Inbox'),'Photo library links to inbox');
assert(css.includes('touch-action:none')&&css.includes('.be-peek')&&css.includes('.be-undo-toast'),'Edge dragging and Peek CSS');
assert(nav.includes("handleTabClick?.(e)")&&nav.includes("page:'fieldhub'"),'Right-hand drawer exposes Field Hub');
assert(fab.includes('window.BoreLabFieldCommand3?.fabActions?.(page)')&&fab.includes('window.BoreLabEdgeV22?.pageActions?.(page)||actions'),'Context-sensitive + actions and prior Edge fallback preserved');
assert(ops.includes("offerSaveNext?.(jobId,shotId,'completed')"),'Bore completion offers next shot');
assert(ops.includes('async function undo(id,quick=false)')&&ops.includes('recent?.id!==id'),'One-tap Undo preserves journal protections');
assert(ab.includes('for(const marker of job.fieldMarkers||[])')&&ab.includes('for(const arrival of job.arrivalLog||[])'),'New records are part of daily history');
assert(atlas.includes("p.type==='marker'")&&atlas.includes('markerForm?.(p.record.id)'),'Field marker details in Atlas');
assert(!edge.includes('localStorage.clear('),'No destructive storage reset');
const toDay=t=>{const d=new Date(t);return Number.isNaN(+d)?'':d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const stamp=new Date().toISOString(),today=toDay(stamp),storage=new Map(),listeners={},elements={};
const document={
 readyState:'loading',documentElement:{dataset:{},classList:{add(){},remove(){}}},hidden:false,
 addEventListener:(k,fn)=>{(listeners[k]??=[]).push(fn)},
 querySelector:s=>elements[s]||null,
 createElement:tag=>({tagName:tag,style:{},hidden:false,innerHTML:'',setAttribute(){},remove(){},click(){},select(){}}),
 body:{appendChild:el=>{elements['#'+el.id]=el}}
};
elements['.bf-edge-tab']={style:{}};
let id=0,saveCount=0,renderCount=0;const notices=[];
const job={id:'job1',jobName:'South Glades',shots:[
 {id:'sh1',name:'Bore 1',status:'complete',feet:175,completedAt:stamp},
 {id:'sh2',name:'Bore 2',status:'planned',feet:155}
],fieldPins:[{id:'p1',kind:'coupling',name:'Driveway coupling',lat:'26.62',lon:'-81.62'}],quickNotes:[],crew:[]};
const state={jobs:[job],shots:job.shots,activeJobId:'job1',demo:true,fieldRecovery:[]};
let photos=[{id:'photo1',jobId:'job1',addedAt:stamp,dataUrl:'data:image/png;base64,AA==',lat:26.613,lon:-81.616}];
const bridge={
 state:()=>state,activeJob:()=>job,uid:()=>String(++id),save:()=>saveCount++,render:()=>renderCount++,
 notify:x=>notices.push(x),photos:()=>photos,photoDB:async(op,photo)=>{const i=photos.findIndex(x=>x.id===photo.id);if(i>=0)photos[i]=photo},
 refreshPhotos:async()=>{},pipeOnTruck:()=>345,showModal:()=>{},closeModal:()=>{},photoChoose:()=>{},
 getPosition:async()=>({lat:26.61,lon:-81.61,accuracy:8}),setPage:()=>{},shotDetail:()=>{},switchActiveJob:()=>true
};
let scope='job';
const asBuilt={
 dayOf:toDay,valid:r=>r&&r.lat!=null&&r.lon!=null&&r.lat!==''&&r.lon!==''&&Number.isFinite(Number(r.lat))&&Number.isFinite(Number(r.lon)),
 getScope:()=>scope,setScope:x=>{scope=x},
 allEvents:()=>[
 {type:'shot',jobId:'job1',day:today,when:stamp,title:'Bore 1',extra:'Bore completed',record:job.shots[0]},
 ...photos.map(p=>({type:'photo',jobId:'job1',day:toDay(p.addedAt),when:p.addedAt,title:'Jobsite photo',extra:'Saved',record:p})),
 ...(job.fieldMarkers||[]).map(m=>({type:'marker',jobId:'job1',day:toDay(m.occurredAt),when:m.occurredAt,title:m.label,extra:m.kind,record:m}))],
 candidateRecords:p=>p.shotId||p.fieldPinId?[]:[{type:'shot',id:'sh1',label:'Bore 1',distance:23,sameDay:true}],
 exportAsBuilt:()=>{}
};
const window={innerHeight:730,BoreLabAssistantBridge:bridge,BoreLabAsBuilt:asBuilt,
 BoreLabLocalAccounts:{isUnlocked:()=>true,role:()=> 'owner'},
 BoreLabNavigation:{isOpen:()=>false,close:()=>{},open:()=>{}},BoreLabFab:{close:()=>{}},
 confirm:()=>true,addEventListener:()=>{}};
const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))};
const FormDataMock=class{constructor(form){this.fields=form.fields||{}}get(key){return this.fields[key]}entries(){return Object.entries(this.fields)}};
const edgeApi=new Function('window','document','localStorage','FormData','setTimeout','clearTimeout',edge+';return window.BoreLabEdgeV22;')(
 window,document,localStorage,FormDataMock,()=>7,()=>{});
async function run(){
 assert(edgeApi.renderHub().includes('Field Hub'));
 assert(edgeApi.homeArrival().includes('I’m Here'));
 assert(!job.arrivalLog,'No automatic arrival tracking');
 assert(edgeApi.renderPeek().includes('345 ft')&&edgeApi.renderPeek().includes('Bore 2'));
 edgeApi.openPeek('glance');assert(edgeApi.isPeekOpen());
 edgeApi.closePeek();assert(!edgeApi.isPeekOpen());
 edgeApi.setEdgePosition(70);assert.equal(edgeApi.getEdgePosition(),70);
 assert(storage.has('borelab-edge-position-v022'),'Position persists');
 assert.deepEqual(edgeApi.pageActions('jobmap').map(x=>x.id),['gps','marker','photo','inbox']);
 assert(edgeApi.pageActions('planner').some(x=>x.id==='finish'));
 edgeApi.markArrival();
 assert.equal(job.arrivalLog.length,1);assert.equal(job.arrivalLog[0].method,'manual');
 assert.equal(job.arrivalLog[0].lat,undefined,'No passive GPS');
 edgeApi.markArrival();assert.equal(job.arrivalLog.length,1,'Duplicate arrival blocked');
 await edgeApi.arrivalGps();assert.equal(job.arrivalLog[0].gpsSource,'device');
 await edgeApi.undo();assert.equal(job.arrivalLog[0].lat,undefined,'Undo arrival GPS');
 const form={dataset:{beId:''},fields:{kind:'obstruction',label:'Utility crossing',notes:'Mark and verify',lat:'26.62',lon:'-81.62',gpsAccuracy:'',gpsSource:'manual'}};
 edgeApi.saveMarker(form);assert.equal(job.fieldMarkers.length,1);
 assert.equal(job.fieldMarkers[0].recordType,'fieldMarker','Marker is not installed pin');
 assert(edgeApi.storyText(today).includes('Utility crossing'),'Story includes field marker');
 await edgeApi.undo();assert.equal(job.fieldMarkers.length,0,'Undo marker creation');
 edgeApi.saveMarker(form);const markerId=job.fieldMarkers[0].id;edgeApi.toggleMarker(markerId);
 assert.equal(job.fieldMarkers[0].status,'resolved');assert(!job.fieldPins.some(x=>x.id===markerId));
 assert.equal(edgeApi.countUnassigned(),1);
 assert(edgeApi.photoInbox().includes('Bore 1'),'Inbox proposes match');
 const image=photos[0].dataUrl;
 await edgeApi.linkInboxPhoto('photo1','shot:sh1');
 assert.equal(photos[0].shotId,'sh1');assert.equal(photos[0].dataUrl,image);
 assert.equal(edgeApi.countUnassigned(),0);
 await edgeApi.undo();assert.equal(photos[0].shotId,undefined,'Undo links without altering image');
 const story=edgeApi.storyText(today);
 assert(story.includes('BORELAB FIELD')&&story.includes('175 ft')&&story.includes('Bore 1'));
 assert(edgeApi.dayStory().includes('Save Story TXT'));
 assert(edgeApi.getFavorites().length===3);
 assert(saveCount>=4,'Saved data uses existing bridge');
 console.log('BoreLab v0.22 Edge Tab, Peek, Smart +, Field Markers, Photo Inbox, Save & Next, Undo, Arrival and Field Story tests PASS');
}
run().catch(e=>{console.error(e);process.exitCode=1});
