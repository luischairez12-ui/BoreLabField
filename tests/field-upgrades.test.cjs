'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('web/index.html','utf8');
const app=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const upgradeSource=fs.readFileSync('web/field-upgrades.js','utf8');
const bundled=fs.readFileSync('app/src/main/assets/web/field-upgrades.js','utf8');
const native=fs.readFileSync('app/src/main/java/com/borelab/field/BoreLabActivity.java','utf8');
const pdf=fs.readFileSync('app/src/main/java/com/borelab/field/FieldPdfExporter.java','utf8');
assert.equal(html,app,'Browser and APK must use same HTML');
assert.equal(upgradeSource,bundled,'Browser and APK must use same field upgrade upgradeSource');
new Function(upgradeSource);
new Function(html.split('<script>')[1].split('</script>')[0]);
assert(html.includes('<script src="./field-upgrades.js"></script>'));
assert(html.includes('name="pipeDiameter"'),'Edit bore form should save conduit size');
assert(html.includes('pipeDiameter:String(values.pipeDiameter'),'Bore size should persist');
assert(html.includes('pipeDiameter:String(guidedDraft.pipeDiameter'),'Guided bore size should persist');
assert(html.includes("Conduit / product size',esc(window.BoreLabConduits?.summary(shot)"),'Shot detail should show multi-conduit sizes');
assert(html.includes('pipeDiameter:sh.pipeDiameter'),'PDF report payload must carry size');
assert(pdf.includes('label("Conduit size", str(shot, "pipeDiameter"))'));
assert(native.includes('scanAddressPhoto(String dataUrl)'));
assert(native.includes('TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)'));
assert(native.includes('JSONObject.quote(text == null ? "" : text)'));
assert(native.includes('window.borelabOnAddressScan'));
assert(upgradeSource.includes('Nothing is saved automatically.'));
assert(upgradeSource.includes("scanContext.input.dispatchEvent(new Event('input'"));
assert(upgradeSource.includes("state.longestStartJobId=id"));
assert(upgradeSource.includes('api().switchActiveJob(job.id)'));
assert(upgradeSource.includes("data-field-upgrade"));
const a=upgradeSource.indexOf('function candidateAddress('),b=upgradeSource.indexOf('function scanNotice(',a);
assert(a>=0&&b>a);
const guess=new Function(upgradeSource.slice(a,b)+'return candidateAddress;')();
assert.equal(guess('NAME: JOB 35\n1234 S Main St\nLaBelle FL 33935'),'1234 S Main St, LaBelle FL 33935');
assert.equal(guess('CONDUIT 4 INCH\nBENTONITE 50 LB\nNOTE'),'', 'Must not invent an address from irrelevant text');
const start=upgradeSource.indexOf('function longestPlan('),end=upgradeSource.indexOf('function renderLongestPlan(',start);
assert(start>=0&&end>start);
const jobs=[
 {id:'a',jobName:'Glades',archived:false,shots:[{id:'1',name:'A',feet:80,status:'planned'},{id:'2',name:'B',feet:175,status:'planned'}]},
 {id:'b',jobName:'North',archived:false,shots:[{id:'3',name:'C',feet:110,status:'planned'},{id:'4',name:'D',feet:90,status:'complete'}]},
 {id:'c',jobName:'South',archived:false,shots:[{id:'5',name:'E',feet:155,status:'planned'}]}
];
const state={jobs,activeJobId:'a',longestStartJobId:'b'};
const longest=new Function('api','feet',upgradeSource.slice(start,end)+'return longestPlan;')(
 ()=>({state:()=>state}),s=>Math.max(0,Number(s.feet)||0));
assert.deepEqual(longest().ordered.map(x=>x.shot.id),['3','2','1','5'], 'Chosen starting job must be first and other jobs should be ordered by longest pending shot');
state.longestStartJobId='a';
assert.deepEqual(longest().ordered.map(x=>x.shot.id),['2','1','5','3']);
console.log('Pipe size editing, address OCR review and cross-job longest-first planner tests passed.');
