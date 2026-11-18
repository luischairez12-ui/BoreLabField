'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const preview=fs.readFileSync('web/index.html','utf8');
const java=fs.readFileSync('app/src/main/java/com/borelab/field/BoreLabActivity.java','utf8');
assert.equal(html,preview,'Browser preview and APK assets must remain identical');
const js=html.split('<script>')[1]?.split('</script>')[0];
assert(js);new Function(js);
assert(js.includes("const KEY='borelab-field-v0.1'"),'Existing job data key must be retained');
assert(js.includes("job:renderJobWorkspace")&&js.includes("search:renderSearch"));
assert(html.includes('class="ux-job-hit" data-action="open-job"'),'Whole active job card must open workspace');
assert(js.includes("case 'edit-job':if(page!=='job')setPage('job');editActiveJob();break;"),'Edit button must open active job details directly');
assert(js.includes("if(form.dataset.form==='job-details')"),'Job edit must have a save handler');
assert(js.includes("case 'shot-quick':quickBoreActions(id);break;"));
assert(js.includes("case 'open-search':setPage('search');break;"));
assert(js.includes('data-universal-search'),'Universal search input missing');
assert(js.includes("case 'manual-machine':if(MANUAL_MACHINES.some"),'Manual result action missing');
assert(js.includes('inputmode="decimal"'),'Bore input should show numeric keypad');
assert(js.includes('ux-number-unit'),'Measurement units should remain visible');
assert(java.includes('window.borelabHandleBack'),'Android Back must delegate to the current WebView screen history');
assert(java.includes('BoreLabActivity.super.onBackPressed()'),'Android Back must still be able to exit at root');
assert(java.includes('webView.evaluateJavascript('),'Native-to-JavaScript Back bridge missing');

// Test real previous-screen history (including modal-first behavior).
const navFrom=js.indexOf('function setPage(p,options={})');
const navTo=js.indexOf('const MANUAL_MACHINES=',navFrom);
assert(navFrom>0&&navTo>navFrom);
const navBuilder=new Function(
 "let page='home',modal='',screenStack=[],attemptedAutoAddressLookup=false;" +
 "const BORELAB_PAGES=new Set(['home','job','search','tools','settings','planner','manuals']);" +
 "const state={lastScreen:'home'},sessionStorage={setItem(){}};" +
 "const window={scrollTo(){}};" +
 "let saves=0;function save(){saves++}function closeModal(){modal=''}" +
 "function render(){}function refreshManualFiles(){}function resolveMissingAddresses(){}" +
 js.slice(navFrom,navTo) +
 "return {setPage,back:borelabGoBack,setModal:()=>{modal='dialog'},get:()=>({page,modal,stack:[...screenStack],lastScreen:state.lastScreen,saves})};");
const nav=navBuilder();
nav.setPage('job');nav.setPage('search');
assert.deepEqual(nav.get().stack,['home','job']);
nav.setModal();assert.equal(nav.back(),true);assert.equal(nav.get().page,'search');assert.equal(nav.get().modal,'');
assert.equal(nav.back(),true);assert.equal(nav.get().page,'job');
assert.equal(nav.back(),true);assert.equal(nav.get().page,'home');
assert.equal(nav.back(),false,'Back from root without history should allow OS exit');
nav.setPage('made-up-screen');assert.equal(nav.get().page,'home');
assert.equal(nav.get().lastScreen,'home');

// Test job workspace rendering, quick actions and offline search result grouping.
const uiStart=js.indexOf('function renderJobWorkspace(){');
const uiEnd=js.indexOf('function coordsValid(o){',uiStart);
assert(uiStart>0&&uiEnd>uiStart);
const state={
 jobName:'South Glades',jobAddress:'Access lane',jobNotes:'Marked crossings <script>unsafe</script>',
 shots:[{id:'s1',name:'Shot 01',feet:175,status:'planned',address:'West Road'},
        {id:'s2',name:'Shot 02',feet:25,status:'complete',address:''}],
 crew:[{start:'2026-11-17T07:00:00',end:'2026-11-17T15:00:00'}],
 equipment:[{id:'e1',name:'JT20 drill',type:'Drill',serial:'A12',notes:''}],
 manualLinks:[{id:'link1',label:'Series II Operators Manual',url:'https://example.com/pdf',note:''}],
 history:[{id:'hist1',jobName:'North Glades',day:'2026-11-16',notes:''}]
};
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uiBuilder=new Function('state','esc',
 "let lastModal='',universalQuery='';" +
 "const photos=[{shotId:'s1'},{shotId:'previous-job'}];" +
 "const MANUAL_MACHINES=[{id:'ditchwitch-jt20',make:'Ditch Witch',model:'JT20'},{id:'vermeer-d24x40',make:'Vermeer',model:'D24x40'}];" +
 "const UX_ACTIONS=[{id:'go-photos'},{id:'go-crew'},{id:'go-planner'},{id:'go-pipe'},{id:'open-equipment'},{id:'export-report'}];" +
 "const actionTile=t=>'<button data-action=\"'+t.id+'\"></button>';" +
 "const todayLocal=()=> '2026-11-17',localDay=()=> '2026-11-17',hours=()=>8;" +
 "const totalFeet=()=>200,doneFeet=()=>25,feet=s=>Number(s.feet||0),fmt=n=>String(n),footnote=()=>'';" +
 "const modalHead=s=>'<h2>'+s+'</h2>',showModal=s=>{lastModal=s},mapsPinUrl=()=> 'https://example.com/map';" +
 js.slice(uiStart,uiEnd) +
 "return {renderJobWorkspace,editActiveJob,quickBoreActions,universalSearchGroups,renderSearch,renderSearchResults,setQuery:x=>universalQuery=x,modal:()=>lastModal};");
const ui=uiBuilder(state,escape);
const workspace=ui.renderJobWorkspace();
assert(workspace.includes('SMART JOB WORKSPACE')&&workspace.includes('South Glades'));
assert(workspace.includes('Photos on bores')&&workspace.includes('Today&#39;s crew hours'));
assert(workspace.includes('shot-quick')&&workspace.includes('Edit Job'));
assert(!workspace.includes('<script>unsafe</script>'),'Job notes must be HTML-escaped');
ui.editActiveJob();
assert(ui.modal().includes('data-form="job-details"')&&ui.modal().includes('Save Job Changes'));
ui.quickBoreActions('s1');
assert(ui.modal().includes('Start Drilling')&&ui.modal().includes('Add Photo')&&ui.modal().includes('Open Map'));
const matches=ui.universalSearchGroups('jt20');
assert(matches.some(g=>g.name==='Equipment')&&matches.some(g=>g.name==='Manual Library'));
assert(ui.universalSearchGroups('glades').some(g=>g.name==='Active Job'));
assert(ui.universalSearchGroups('series ii').some(g=>g.name==='Saved Manual Links'));
assert(ui.universalSearchGroups('north glades').some(g=>g.name==='Job History'));
ui.setQuery('jt20');assert(ui.renderSearchResults().includes('Manual Library'));
assert(ui.renderSearch().includes('data-universal-search'));

// Test local draft snapshot/restore/clear without DOM or external services.
const draftStart=js.indexOf("const DRAFTS_KEY='");
const draftEnd=js.indexOf('function showModal(body){',draftStart);
assert(draftStart>0&&draftEnd>draftStart);
const entries=new Map();
const localStorage={getItem:k=>entries.has(k)?entries.get(k):null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
const draftBuilder=new Function('localStorage',
 "let guidedDraft=null,guidedStep=1;" +
 js.slice(draftStart,draftEnd) +
 "return {saveDraftForForm,clearFormDraft,restoreFormDraft,draftStore};");
const drafts=draftBuilder(localStorage);
const f1={dataset:{form:'shot',id:'s1'},isConnected:false,elements:[{name:'notes',type:'text',value:'Need to cross utility',checked:false}]};
drafts.saveDraftForForm(f1);
const f2={dataset:{form:'shot',id:'s1'},isConnected:false,elements:[{name:'notes',type:'text',value:'',checked:false}]};
drafts.restoreFormDraft(f2);
assert.equal(f2.elements[0].value,'Need to cross utility');
drafts.clearFormDraft(f2);
assert.equal(Object.keys(drafts.draftStore()).length,0,'Completed forms should clear draft');
assert(js.includes('clearFormDraft(form);save();closeModal();render();notify'), 'Committed records should clear only their own drafts');
assert(js.includes("localStorage.removeItem(DRAFTS_KEY)")&&js.includes("localStorage.removeItem(GUIDED_DRAFT_KEY)"),
 'Clear/restore should not leave stale prior-job drafts');
assert(js.includes("state.lastScreen='home'"), 'Restoring a backup should return safely to Home');

console.log('BoreLab v0.11 batch: workspace/editor, app+Android Back, quick actions, search, number UX, drafts and backups passed.');
