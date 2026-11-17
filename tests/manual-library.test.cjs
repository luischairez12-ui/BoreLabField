'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
assert.equal(html,fs.readFileSync('web/index.html','utf8'),'Web demo and APK web sources must match');
const js=html.split('<script>')[1]?.split('</script>')[0];
assert(js);new Function(js);
assert(js.includes('manuals:renderManualLibrary'));
assert(js.includes("case 'go-manuals':setPage('manuals')"));
assert(js.includes('manualFiles[slot]===true'),'Status must be derived from scanned files');
assert(js.includes('window.borelabOnManuals=function borelabOnManuals'));
assert(js.includes('data-action="manual-import"')&&js.includes('data-action="manual-open"'));
assert(js.includes('refreshManualFiles()'));
const beg=js.indexOf('const MANUAL_MACHINES='),end=js.indexOf('function render(){',beg);
assert(beg>=0&&end>beg);
const f=new Function('window','esc','footnote','section','notify','render','page',
 'let manualFiles={};let manualStatusKnown=true;let selectedManualMachine="vermeer-d24x40";'+js.slice(beg,end)+
 'return {MANUAL_MACHINES,MANUAL_TYPES,manualSlot,isManualSlot,renderManualLibrary};');
const data=f({BoreLabNative:{importManual:()=>{},listManuals:()=>{}}},String,()=>'',(x,r)=>x+r,()=>{},()=>{},'manuals');
assert.equal(data.MANUAL_MACHINES.length,7);
assert(data.isManualSlot('ditchwitch-jt20-operator'));
assert(!data.isManualSlot('../secrets'));
assert(data.MANUAL_MACHINES.every(x=>x.source.startsWith('https://')));
const view=data.renderManualLibrary();
assert(view.includes('○ Not saved'),'No PDF should be checked by default');
assert(view.includes('Import PDF'));
const java=fs.readFileSync('app/src/main/java/com/borelab/field/BoreLabActivity.java','utf8');
const manifest=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
const filepaths=fs.readFileSync('app/src/main/res/xml/manual_paths.xml','utf8');
for(const name of ['listManuals','importManual','openManual','removeManual'])
 assert(java.includes('void '+name+'(String slot)')||java.includes('void '+name+'()'),name+' missing native bridge');
assert(java.includes('private boolean isPdf(File pdf)'));
assert(java.includes('getFilesDir(), "manuals"'));
assert(java.includes('StandardCopyOption.REPLACE_EXISTING'));
assert(java.includes('FLAG_GRANT_READ_URI_PERMISSION'));
assert(manifest.includes('androidx.core.content.FileProvider'));
assert(filepaths.includes('path="manuals/"'));
console.log('BoreLab Manual Library: model catalog, UI actions, disk-based checkmarks and Android PDF storage bridge verified.');
