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
 'let manualFiles={};let state={manualLinks:[]};let manualStatusKnown=true;let selectedManualMachine="vermeer-d24x40";'+js.slice(beg,end)+
 'return {MANUAL_MACHINES,MANUAL_TYPES,manualSlot,isManualSlot,renderManualLibrary,manualAlternatives,openManualAlternative,manualLinkUrl,manualUserLinks,state};');
const data=f({BoreLabNative:{importManual:()=>{},listManuals:()=>{}}},String,()=>'',(x,r)=>x+r,()=>{},()=>{},'manuals');
assert.equal(data.MANUAL_MACHINES.length,8);
assert(data.MANUAL_MACHINES.some(x=>x.id==='vermeer-d24x40-series-ii'));
assert(data.isManualSlot('ditchwitch-jt20-operator'));
assert(!data.isManualSlot('../secrets'));
assert(data.MANUAL_MACHINES.every(x=>x.source.startsWith('https://')));
const view=data.renderManualLibrary();
assert(view.includes('○ Not saved'),'No PDF should be checked by default');
assert(view.includes('Import PDF'));
assert(js.includes('data-action="manual-add-link"'));
assert(js.includes('data-form="manual-link"'));
assert(js.includes("case 'manual-user-open':openManualUserLink(id)"));
assert(js.includes("case 'manual-more':manualExternalUrl(MANUAL_MORE_URL)"));
assert(js.includes('saveManualLink(values,form.dataset.id'));
assert(js.includes('eliteundergroundtools.com/machine-manuals/'));
assert(js.includes('www.manualsdir.com'));
assert(js.includes('https://www.manualsdir.com/manuals/735351/ditch-witch-jt20.html'));
assert(js.includes('https://partesyherramientas.us/Manuales/D24x40%20S3.pdf'));
assert(js.includes("manualLinks:[]"),'New state must contain manual links');
assert(js.includes('if(!Array.isArray(state.manualLinks))state.manualLinks=[]'), 'Old state needs migration');
assert.equal(data.manualLinkUrl('https://www.scribd.com/document/780730040/24x40-36x50-Vermeer-operators-manual-Series-II'),
 'https://www.scribd.com/document/780730040/24x40-36x50-Vermeer-operators-manual-Series-II');
assert.throws(()=>data.manualLinkUrl('javascript:alert(1)'),/HTTPS|complete/);
assert.throws(()=>data.manualLinkUrl('http://example.com/file.pdf'),/HTTPS/);
assert.throws(()=>data.manualLinkUrl('https://192.168.1.3/file.pdf'),/HTTPS/);
data.state.manualLinks.push({id:'custom-1',machineId:'vermeer-d24x40',type:'operator',label:'My Field Manual',url:'https://example.com/manual.pdf',note:'crew note'});
const customView=data.renderManualLibrary();
assert(customView.includes('My Field Manual'));
assert(customView.includes('manual-user-edit'));
assert(!customView.includes('✓ Saved offline'),'A custom URL must not imply a PDF is stored');

assert(data.MANUAL_MACHINES.every(m=>['operator','maintenance','parts'].some(type=>data.manualAlternatives(m.id,type).length)),
 'Every rig needs at least one located reference link');
const sent='https://www.scribd.com/document/780730040/24x40-36x50-Vermeer-operators-manual-Series-II';
assert.equal(data.manualAlternatives('vermeer-d24x40','operator')[0].url,sent);
assert.equal(data.manualAlternatives('vermeer-d24x40-series-ii','operator')[0].url,sent);
assert(js.includes('MANUAL_TYPES.some(([type])=>manualSlot(m.id,type)===slot)'), 'Must match longer Series II model exactly');
assert(!js.includes("MANUAL_MACHINES.find(m=>slot.startsWith(m.id+'-'))"),'Ambiguous rig prefix bug regression');
assert(js.includes('Open your Scribd manual'));
assert(js.includes('openManualLink(item.url)'));

assert(js.includes('MANUAL_ALTERNATES'));
assert(js.includes('manualAlternatives(machine.id,type).map'));
assert(js.includes("case 'manual-alternate':openManualAlternative(id,Number(btn.dataset.index))"));
assert(js.includes('2001–4000')&&js.includes('381+'), 'Series II links must show serial restrictions');
assert(js.includes('www.ditchwitchmidwest.com'));
assert(!js.includes('window.BoreLabNative.downloadManual'),'No in-app paywall bypass or auto-download');
const java=fs.readFileSync('app/src/main/java/com/borelab/field/BoreLabActivity.java','utf8');
const manifest=fs.readFileSync('app/src/main/AndroidManifest.xml','utf8');
const filepaths=fs.readFileSync('app/src/main/res/xml/manual_paths.xml','utf8');
for(const name of ['listManuals','importManual','openManual','removeManual'])
 assert(java.includes('void '+name+'(String slot)')||java.includes('void '+name+'()'),name+' missing native bridge');
assert(java.includes('private boolean isPdf(File pdf)'));
assert(java.includes('getFilesDir(), "manuals"'));
assert(java.includes('StandardCopyOption.REPLACE_EXISTING'));
assert(java.includes('FLAG_GRANT_READ_URI_PERMISSION'));
assert(java.includes('void openManualLink(String url)'));
assert(java.includes('CATEGORY_BROWSABLE'));
assert(java.includes('"www.scribd.com"'));
assert(manifest.includes('androidx.core.content.FileProvider'));
assert(filepaths.includes('path="manuals/"'));
console.log('BoreLab Manual Library: model catalog, UI actions, disk-based checkmarks and Android PDF storage bridge verified.');
