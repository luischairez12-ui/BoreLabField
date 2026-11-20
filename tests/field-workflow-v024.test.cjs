'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('web/index.html');
const scripts=['field-reel-command-v024.js','field-crossings-v024.js','field-companion-v024.js'];
for(const file of [...scripts,'field-workflow-v024.css','index.html','field-navigation.js','field-material-v023.js','field-next-v023.js','conduits.js']){
 assert.equal(read('web/'+file),read('app/src/main/assets/web/'+file),'Android assets match web: '+file);
}
for(const file of scripts) {
 assert(html.includes('./'+file),'Loaded script: '+file);
 new Function(read('web/'+file));
}
new Function(html.split('<script>')[1].split('</script>')[0]);
assert(html.includes('BoreLab Field · v0.29.0'),'Version v0.24 footer');
for(const page of ['reelcommand','crossings','companion'])assert(html.includes(page+':()=>window.BoreLab'),'Page route '+page);
assert(read('web/conduits.js').includes('shot?.allowanceOverride??allowance'),'Per-shot zero allowance honors imported actuals');
assert(html.includes('s.allowanceOverride??extra()'),'Per-shot override propagates to generic planner');
assert(html.includes('window.BoreLabCompanion?.publish?.()'),'Native snapshot on save');
assert(read('web/field-material-v023.js').includes('available?.(reel,[...pendingIds])'),'Pickup subtracts unrelated reservations');
assert(read('web/field-next-v023.js').includes('available?.(r,[shot.id])'),'Next Move checks available stock');
const manifest=read('app/src/main/AndroidManifest.xml'),java=read('app/src/main/java/com/borelab/field/BoreLabActivity.java'),provider=read('app/src/main/java/com/borelab/field/MiOsCompanionProvider.java');
assert(manifest.includes('.MiOsCompanionProvider')&&manifest.includes('com.luis.mios.daily.borelab'),'Two-way limited provider registration');
assert(java.includes('getLauncherLogs()')&&java.includes('publishMiOsSnapshot(String raw)'),'Native bridge methods');
assert(provider.includes('getPackagesForUid(Binder.getCallingUid())'),'Bridge checks Android caller UID');
assert(provider.includes('getBoolean("enabled",false)'),'Native export off by default');
const clone=x=>JSON.parse(JSON.stringify(x));
const job={id:'jobA',jobName:'Job Alpha',shots:[],fieldMarkers:[],allowance:10};
const s={activeJobId:job.id,jobs:[job],shots:job.shots,
 reels:[{id:'r1',name:'2-inch Reel',size:'2 inch',location:'truck',remaining:345,mustEmpty:true,archived:false}],
 pipeMoves:[],pipeReservations:[],demo:false,allowance:10};
const entry={id:'mi-001',date:'2026-11-19',address:'385 S Lindero St',
 updatedAt:123456,notes:'Pulled through crossing',
 rows:[{id:'pipe1',label:'2 inch',start:'2000',end:'1858'}]};
let modal='',saveCount=0,lastNotice='',published='',enabled=true,uidCount=1;
const bridge={state:()=>s,activeJob:()=>job,uid:()=>String(uidCount++),save:()=>saveCount++,
 notify:x=>lastNotice=x,closeModal:()=>{modal=''},render:()=>{},
 showModal:html=>modal=html,getPosition:async()=>({lat:26.0,lon:-81.0}),
 shop:()=>({lat:26.5,lon:-81.8})};
const doc={addEventListener(){},querySelector(){return null},readyState:'loading'};
class FakeFormData{
 constructor(f){this.data=f.fields}
 get(name){return this.data[name]??null}
}
const W={BoreLabAssistantBridge:bridge,BoreLabLocalAccounts:{isUnlocked:()=>true,role:()=> 'owner'},
 BoreLabNative:{isMiOsEnabled:()=>enabled,setMiOsEnabled:v=>{enabled=v},getLauncherLogs:()=>JSON.stringify({version:1,entries:[entry]}),publishMiOsSnapshot:x=>{published=x}},
 BoreLabConduits:{sizeKey:v=>String(v).replace(/(inch|inches|in)\b/g,'').trim()+' in'},
 BoreLabFieldOps:{journal:()=>{}},BoreLabDailyReels:{activeIds:()=>[]},
 BoreLabWorkday:{simulateReels:(state,day,entries,reels)=>({reels:reels.map(r=>({...r,remaining:r.remaining-142})),allocations:[{shot:entries[0]?.shot}],shortages:[],untracked:[]})}
};
const load=file=>{new Function('window','document','FormData',read('web/'+file))(W,doc,FakeFormData)};
load('field-reel-command-v024.js');load('field-crossings-v024.js');load('field-companion-v024.js');
const companion=W.BoreLabCompanion,reel=W.BoreLabReelCommand,cross=W.BoreLabCrossings;
assert.equal(companion.diameter('2 inch'),'2 in');
assert.equal(companion.diameter('2"'),'2 in');
assert.equal(companion.diameter('3in'),'3 in');
assert.equal(companion.diameter('4 inch conduit'),'4 in');
assert.equal(companion.diameter('invalid'),'');
assert.equal(companion.rowsFor(entry)[0].feet,142,'Actual footage is exact: 2000 minus 1858');
assert.equal(companion.rowsFor({...entry,rows:[{id:'k',label:'2 inch',start:'0042',end:'0020'}]})[0].startRaw,'0042','Leading zero readings remain strings');
companion.loadLogs();assert.equal(companion.pending().length,1);
const checked=companion.validateImport(entry,'jobA',['r1']);
assert.equal(checked.runs.length,1);
companion.approve({dataset:{bcImport:'mi-001'},fields:{confirmed:'on',jobId:'jobA',name:'Shot 01',reel_0:'r1'}});
assert.equal(s.reels[0].remaining,203,'Physical reel was debited exactly 142 ft');
assert.equal(s.pipeMoves.length,1,'One installed movement logged');
assert.equal(s.pipeMoves[0].feet,142);
assert.equal(s.shots.length,1);
assert.equal(s.shots[0].allowanceOverride,0,'No additional allowance');
assert.equal(s.shots[0].notes,'Pulled through crossing');
assert.equal(s.launcherImportReceipts.length,1,'Import receipt stored');
assert.equal(companion.entryStatus(entry),'imported','Importer detects previous receipt');
companion.approve({dataset:{bcImport:'mi-001'},fields:{confirmed:'on',jobId:'jobA',name:'Shot 01',reel_0:'r1'}});
assert.equal(s.reels[0].remaining,203,'Repeated approval cannot deduct twice');
assert.equal(s.pipeMoves.length,1,'No duplicate movement');
assert.equal(companion.entryStatus({...entry,updatedAt:999}),'modified','Later edited logs are not re-imported automatically');
assert.equal(reel.balances(s.reels[0]).installed,142);
s.pipeReservations.push({reelId:'r1',shotId:'other-shot',feet:50});
assert.equal(reel.available(s.reels[0]),153,'Unrelated reservations removed from free footage');
assert.equal(reel.available(s.reels[0],['other-shot']),203,'Own planned reservation not subtracted twice');
assert.equal(reel.optimizedReturn().best,null,'No unfinished shots means no return simulation');
const prior=clone(s.reels);
cross.save({dataset:{bxId:''},fields:{label:'Water crossing',utilityType:'Water',station:'1+45',
 depthFt:'4.0',clearanceFt:'1.8',verification:'pothole',lat:'26.3',lon:'-81.7',notes:'Observed',photoId:''}});
assert.equal(job.fieldMarkers.length,1,'Crossing stored in existing Atlas field markers');
assert.equal(job.fieldMarkers[0].kind,'utility');
assert.equal(job.fieldMarkers[0].crossing.clearanceFt,'1.8');
assert.deepEqual(s.reels,prior,'Crossing edit does not modify pipe inventory');
companion.publish();
const snap=JSON.parse(published);
assert.equal(snap.version,1);
assert.equal(snap.points.length,0,'Map only exposes saved GPS pins; no fabricated coords');
assert(!published.includes('2000')&&!published.includes('Pulled through'),'Map snapshot does not leak pipe readings or private notes');
assert(saveCount>=2,'Writes use existing save');
console.log('BoreLab v0.24: signed-app scoped provider, exact-footage import, idempotent reel deductions, return preview, field crossings, map privacy and asset parity PASS');
