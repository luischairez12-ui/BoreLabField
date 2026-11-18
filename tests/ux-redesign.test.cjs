'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
assert.equal(html,fs.readFileSync('web/index.html','utf8'),'Android/web preview sources must be mirrored');
const js=html.split('<script>')[1]?.split('</script>')[0];
assert(js);new Function(js);
assert(html.includes('data-page="tools"')&&html.includes('data-page="settings"'));
assert(html.includes('aria-label="Add a bore shot"'));
assert(js.includes('tools:renderTools'));
assert(js.includes("['home','planner','settings'].includes(page)?page:'tools'"));
assert(js.includes("const KEY='borelab-field-v0.1'"),'Must not reset existing offline data');
assert(js.includes("uxMode:'simple'"));
assert(js.includes('data-ux-mode')&&js.includes('data-field-mode')&&js.includes('data-large-text'));
assert(js.includes('data-ux-favorite'));
assert(js.includes('const openSettingsSections=new Set()'));
assert(js.includes('data-ux-section="work"')&&js.includes('data-ux-section="backup"'));
assert(js.includes('data-ux-section="help"'));
assert(js.includes('function showFirstRunTour()'));
assert(js.includes('data-form="guided-bore"'));
assert(js.includes("case 'new-shot':if(state.uxMode==='advanced')shotForm();else beginGuidedBore();break;"));
assert(js.includes("case 'guided-back'")&&js.includes("case 'guided-advanced'"));
assert(js.includes("if(form.dataset.form==='guided-bore')"));
assert(js.includes("case 'ux-reset-favorites'"));
assert(html.includes('html[data-field-mode="on"] .btn'));
assert(html.includes('html[data-large-text="on"] .ux-tile strong'));
assert(js.includes('if(!Array.isArray(state.manualLinks))state.manualLinks=[]'));
assert(html.includes('window.borelabOnManualSearch')&&html.includes('data-action="manual-import"'));

const start=js.indexOf('const UX_ACTIONS=');
const stop=js.indexOf('function coordsValid(o){',start);
assert(start>=0&&stop>start,'Home and tools UI block missing');
const example={uxMode:'simple',demo:false,jobName:'Training Job',uxFavorites:['new-shot','go-photos','go-mud','go-manuals','go-pipe','go-crew'],
 shots:[{id:'a',name:'Shot A',feet:175,status:'planned'},{id:'b',name:'Shot B',feet:90,status:'complete'}]};
const h=new Function('state','esc','footnote','fmt','extra','pipeNeed','totalFeet','doneFeet','totalNeed','pipeOnTruck','oilWarnings','shotRow',
 js.slice(start,stop)+'return {UX_ACTIONS,UX_DEFAULT_FAVORITES,favoriteActions,actionTile,renderHome,renderTools,nextHomeAction};');
const ui=h(example,x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),()=>'',n=>String(n),()=>10,x=>Number(x.feet)+10,
 ()=>265,()=>90,()=>285,()=>350,()=>'',x=>'<div>'+x.name+'</div>');
assert.equal(ui.UX_ACTIONS.length,12);
assert.equal(ui.favoriteActions().length,6);
const home=ui.renderHome();
assert(home.includes('Training Job')&&home.includes('What do you need to do?'));
for(const term of ['Plan a Bore','Record Work','Mix Drilling Mud','Find a Manual','Pipe Inventory','Crew'])assert(home.includes(term),term);
assert(home.includes('Today&#39;s Job Board')||home.includes("Today's Job Board"));
const tools=ui.renderTools();
for(const group of ['Planning','Daily work','Materials','Equipment'])assert(tools.includes(group));
for(const tool of ui.UX_ACTIONS)assert(js.includes("case '"+tool.id+"'"),'Missing action handler: '+tool.id);
example.uxFavorites=['go-manuals'];
assert.equal(ui.favoriteActions().length,1);
assert(ui.renderHome().includes('Find a Manual'));
assert(!ui.renderHome().includes('Mix Drilling Mud'),'Shortcuts must respect a personal selection');

const wizStart=js.indexOf('function beginGuidedBore(){');
const wizEnd=js.indexOf('function shotForm(id){',wizStart);
assert(wizStart>=0&&wizEnd>wizStart);
let screen='',saved=0,closed=0,rerender=0;
const wizardState={shots:[],demo:true};
const wizardFactory=new Function('state','uid','esc','fmt','extra','kv','modalHead','showModal','save','closeModal','render','notify','resolveShotAfterSave',
 'let guidedStep=1,guidedDraft=null;'+js.slice(wizStart,wizEnd)+
 'return {beginGuidedBore,saveGuidedBore,getDraft:()=>guidedDraft,showFirstRunTour};');
const wizard=wizardFactory(wizardState,()=> 'saved-bore-1',String,n=>String(n),()=>10,(k,v)=>'<p>'+k+': '+v+'</p>',s=>s,v=>{screen=v},()=>saved++,()=>closed++,()=>rerender++,()=>{},()=>{});
wizard.beginGuidedBore();
assert(screen.includes('How long is the bore?'));
wizard.getDraft().feet='175';wizard.getDraft().name='Test Bore';wizard.saveGuidedBore();
assert.equal(wizardState.shots.length,1);
assert.equal(wizardState.shots[0].feet,175);
assert.equal(wizardState.shots[0].status,'planned');
assert.equal(wizardState.demo,false);
assert.equal(saved,1);assert.equal(closed,1);assert.equal(rerender,1);
console.log('BoreLab 0.10 UX: navigation, personal shortcuts, guided bore saves, settings, offline compatibility passed.');
