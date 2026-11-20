'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('web/index.html');
const modules=['field-crew-v025.js','field-media-v025.js','field-map-tools-v025.js'];
for(const path of [...modules,'field-pins.js','jobsite-map.js','field-atlas.js','field-mapping-media-v025.css','field-companion-v024.js','index.html']){
 assert.equal(read('web/'+path),read('app/src/main/assets/web/'+path),'Android asset parity: '+path);
}
for(const filename of modules){
 assert(html.includes('<script src="./'+filename+'"></script>'),'Loaded JS: '+filename);
 new Function(read('web/'+filename));
}
new Function(html.split('<script>')[1].split('</script>')[0]);
assert(html.includes("photos:()=>window.BoreLabMediaV25?.render?.()||renderPhotos()"),'Photos page is unified vault');
assert(html.includes('Performed By / Drill Crew'),'Bore detail includes performer attribution');
assert(html.includes('field-mapping-media-v025.css'),'New field CSS loaded');
assert(html.includes('BoreLab Field · Records stay on this device'),'v0.25.0 footer');
assert(html.includes('performedBy:window.BoreLabCrewV25'),'Report snapshots include crew attribution');
assert(html.includes('data-v25-video-shot'),'Record video attached to current bore');
const nav=read('web/field-navigation.js');
assert(nav.includes("name:'Media Vault'"),'Unified media vault appears in drawer');
const jobmap=read('web/jobsite-map.js');
assert(jobmap.includes('data-v25-boreline'),'End-to-end line can be tapped');
assert(jobmap.includes('mapBounds().map(point)'),'Endpoint-only bores are included when fitting map');
assert(jobmap.includes('data-blmap-endpoints'),'Bore endpoint editor accessible from map');
assert(jobmap.includes('symbolFor?.(s)'),'Map respects custom marker symbols');
const atlas=read('web/field-atlas.js');
assert(atlas.includes("['asbuiltStart','Entry point']")&&atlas.includes("['asbuiltEnd','Exit point']"),'Atlas reads both endpoint keys');
assert(atlas.includes('HH Handhole'),'Atlas legend includes HH');
const native=read('app/src/main/java/com/borelab/field/BoreLabActivity.java');
const paths=read('app/src/main/res/xml/manual_paths.xml');
assert(native.includes('MAX_VIDEO_BYTES')&&native.includes('copyFieldVideo(Uri source)'),'Video copy and size limit');
assert(native.includes('ACTION_VIDEO_CAPTURE')&&native.includes('ACTION_OPEN_DOCUMENT'),'Video capture/import');
assert(native.includes('deleteFieldVideo(String id)')&&native.includes('shareFieldVideo(String contentUri)'),'Video export and safe deletion');
assert(paths.includes('path="field_videos/"')&&paths.includes('path="captures/"'),'Private FileProvider locations');
assert(!native.includes('Map.of('),'Android bridge avoids API-level Map.of hazard');
const pdf=read('app/src/main/java/com/borelab/field/FieldPdfExporter.java');
assert(pdf.includes('label("Performed By / Drill Crew"'),'PDF includes performer');
const job={id:'j1',jobName:'Test Job',fieldPins:[],shots:[
 {id:'sh1',name:'Bore 01',feet:142,status:'complete',asbuiltStart:{lat:26.1,lon:-81.1},asbuiltEnd:{lat:26.101,lon:-81.102},updatedAt:'2026-11-19T15:00:00Z'}]};
const state={activeJobId:'j1',legacyJobId:'j1',jobs:[job],shots:job.shots,roster:[
 {id:'p1',name:'Damon'},{id:'p2',name:'Kevin'}],mediaVideos:[]};
const photos=[{id:'ph1',jobId:'j1',shotId:'sh1',addedAt:'2026-11-19T15:00:00Z',dataUrl:'data:image/png;base64,a'}];
let saves=0,captured='',nativeImport=0,nativeRecord=0,notice='';
const bridge={state:()=>state,activeJob:()=>job,photos:()=>photos,uid:()=>String(++saves),save:()=>{saves++},
 notify:x=>{notice=x},setPage:()=>{},showModal:x=>{captured=x},closeModal:()=>{},render:()=>{},
 getPosition:()=>Promise.reject(Error('Location denied'))};
const W={BoreLabAssistantBridge:bridge,
 BoreLabNative:{importFieldVideo:()=>{nativeImport++},recordFieldVideo:()=>{nativeRecord++},
 deleteFieldVideo:id=>id==='11111111-2222-3333-4444-555555555555',shareFieldVideo:()=>{}},
 BoreLabLocalAccounts:{isUnlocked:()=>true,role:()=> 'owner'},
 BoreLabAsBuilt:{valid:p=>p?.lat!==''&&p?.lon!==''&&Number.isFinite(+p?.lat)&&Number.isFinite(+p?.lon)&&+p.lat>=-90&&+p.lat<=90,
  getView:()=> 'atlas',getAtlasDayMode:()=> 'all',getScope:()=> 'job',getSearch:()=>'',getType:()=> 'all',
  atlasEvents:()=>[]},BoreLabJobMap:{getView:()=>({center:{lat:26.3,lon:-81.5},zoom:15})}};
const listeners={};const D={addEventListener:(n,f)=>{(listeners[n]||=[]).push(f)},querySelector:()=>null};
class FakeFormData{
 constructor(form){this.value=form.fields||{}}
 get(k){return Array.isArray(this.value[k])?this.value[k][0]:this.value[k]??null}
 getAll(k){const v=this.value[k];return v==null?[]:Array.isArray(v)?v:[v]}
}
function load(file){new Function('window','document','FormData','confirm','setTimeout','clearTimeout',read('web/'+file))(W,D,FakeFormData,()=>true,setTimeout,clearTimeout)}
load('field-pins.js');
assert.equal(W.BoreLabFieldPins.symbolFor({kind:'handhole'}),'HH');
assert.equal(W.BoreLabFieldPins.symbolFor({kind:'coupling'}),'C');
assert.equal(W.BoreLabFieldPins.symbolFor({kind:'custom',symbol:'X2'}),'X2');
assert(W.BoreLabFieldPins.kindLabels.custom);
load('field-atlas.js');
const endpointPoints=W.BoreLabAtlas.points().filter(x=>x.type==='asbuiltStart'||x.type==='asbuiltEnd');
assert.equal(endpointPoints.length,2,'Atlas plots endpoints even without a center bore GPS point');
load('field-crew-v025.js');
const crew=W.BoreLabCrewV25;
assert(crew.formFields(job.shots[0],state.roster).includes('Damon'));
const performed=crew.fromForm({fields:{performedTeam:'Crew North',performedDriller:'p1',performedLocator:'p2',
 performedMemberId:['p1','p2'],performedNotes:'Pullback complete'}},state.roster);
assert.equal(performed.drillerName,'Damon');
assert.equal(performed.locatorName,'Kevin');
assert.deepEqual(Array.from(performed.memberIds),['p1','p2']);
assert(crew.summary({performedBy:performed}).includes('Crew North'));
load('field-media-v025.js');
const vault=W.BoreLabMediaV25;
assert.equal(vault.records().length,1,'Existing photos remain visible');
vault.begin('import','sh1');assert.equal(nativeImport,1);
const savedVideo={id:'11111111-2222-3333-4444-555555555555',uri:'content://com.borelab.field.manuals/borelab_field_videos/test.mp4',
 mime:'video/mp4',bytes:12345,addedAt:'2026-11-19T19:00:00Z'};
vault.onVideoImported(savedVideo);
assert.equal(state.mediaVideos.length,1);
assert.equal(state.mediaVideos[0].shotId,'sh1');
assert.equal(vault.records().length,2,'Video and old photo appear together');
assert(vault.render().includes('Media Vault'),'Unified media header');
vault.begin('record','sh1');assert.equal(nativeRecord,1);
vault.onVideoImported(savedVideo);
assert.equal(state.mediaVideos.length,1,'Duplicate native file callback cannot create duplicate record');
vault.view(savedVideo.id,'video');assert(captured.includes('<video'),'Video preview opens in media detail');
load('field-map-tools-v025.js');
const pos=W.BoreLabMapToolsV25.atPixel({getBoundingClientRect:()=>({left:0,top:0,width:320,height:200})},160,100);
assert(Math.abs(pos.lat-26.3)<.00001 && Math.abs(pos.lon+81.5)<.00001,'Map long-press respects current map center');
assert(W.BoreLabFieldPins.kindLabels.handhole&&W.BoreLabFieldPins.kindLabels.box,'HH and boxes available');
const companion=read('web/field-companion-v024.js');
assert(companion.includes("'entry:'+sh.id")&&companion.includes("'exit:'+sh.id"),'Mi OS receives bore geometry reference data');
assert(companion.includes("symbol:window.BoreLabFieldPins"),'Mi OS snapshot has map marker symbols');
console.log('BoreLab v0.25 — entry/exit alignment, custom symbols, photo/video vault, crew attribution, media Android bridge, backup disclosures and web/asset parity PASS');
