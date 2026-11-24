/* BoreLab Field: Customizable Home Dashboard 2.0 */
(function(){
'use strict';
const bridge=()=>window.BoreLabAssistantBridge;
const state=()=>bridge()?.state()||{};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const value=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
const fmt=x=>value(x).toLocaleString(undefined,{maximumFractionDigits:1});
const today=()=>bridge()?.todayLocal?.()||new Date().toISOString().slice(0,10);
const sizes=['small','medium','large'];
const widgetSizes=id=>id==='active'?['compact',...sizes]:sizes;
const ids=['job','active','shots','weather','next','crew','reels','finish','photos','scanner','quick','notes','backup','map'];
const names={job:'Current Job',active:'Active Bore',shots:'Today’s Shots',weather:'Jobsite Weather',next:'Next 3 Shots',crew:'Crew Status',reels:'Reels on Truck',finish:'Estimated Finish',photos:'Photo Reminders',scanner:'Paperwork Scanner',quick:'Quick Actions',notes:'Job Notes',backup:'Backup & Recovery',map:'Jobsite Map'};
const symbols={job:'⌖',active:'◎',shots:'▦',weather:'☁',next:'☷',crew:'♙',reels:'◈',finish:'◷',photos:'▣',scanner:'▤',quick:'＋',notes:'✎',backup:'↶',map:'⌖'};
const presetNames={morning:'Morning Briefing',workday:'Active Workday',supervisor:'Supervisor Overview'};
const defaults={
 morning:[['map','medium'],['job','medium'],['weather','medium'],['shots','small'],['crew','small'],['next','medium'],['reels','medium'],['active','large'],['finish','small'],['photos','small'],['quick','medium'],['scanner','small'],['notes','small'],['backup','small']],
 workday:[['map','medium'],['active','large'],['shots','small'],['reels','small'],['weather','medium'],['next','medium'],['crew','small'],['finish','small'],['photos','medium'],['quick','medium'],['job','medium'],['scanner','small'],['notes','small'],['backup','small']],
 supervisor:[['map','medium'],['job','medium'],['shots','medium'],['crew','medium'],['next','medium'],['photos','medium'],['reels','medium'],['finish','small'],['weather','small'],['active','large'],['quick','medium'],['notes','small'],['scanner','small'],['backup','small']]
};
const initialShown={morning:['job','weather','shots','crew','next','reels','active','finish','quick','scanner'],workday:['active','shots','reels','weather','next','crew','finish','photos','quick','job'],supervisor:['job','shots','crew','next','photos','reels','finish','weather','active']};
function defaultLayout(p){return defaults[p].map(([id,size])=>({id,size,visible:initialShown[p].includes(id)}))}
function defaultConfig(){return{version:2,enabled:true,preset:'workday',auto:false,density:'comfortable',layouts:{morning:defaultLayout('morning'),workday:defaultLayout('workday'),supervisor:defaultLayout('supervisor')}}}
function cleanConfig(raw){
 const out=defaultConfig();if(!raw||typeof raw!=='object')return out;
 out.enabled=raw.enabled!==false;out.auto=raw.auto===true;out.density=raw.density==='compact'?'compact':'comfortable';
 if(presetNames[raw.preset])out.preset=raw.preset;
 for(const p of Object.keys(presetNames)){
  const arr=raw.layouts?.[p];if(!Array.isArray(arr))continue;
  const known=[],seen=new Set();
  for(const entry of arr){
   if(!entry||!ids.includes(entry.id)||seen.has(entry.id))continue;
   seen.add(entry.id);known.push({id:entry.id,size:widgetSizes(entry.id).includes(entry.size)?entry.size:'medium',visible:entry.visible!==false});
  }
  const baseline=defaultLayout(p);
  out.layouts[p]=known.concat(baseline.filter(x=>!seen.has(x.id)));
 }
 return out;
}
function cfg(){return cleanConfig(state().homeDashboard2)}
function saveConfig(c){state().homeDashboard2=cleanConfig(c);bridge()?.save?.()}
function isEnabled(){return cfg().enabled}
function classicBanner(){return '<div class="bh-classic-return"><strong>Custom Dashboard is turned off.</strong><button data-bh-enable>Try New Dashboard ›</button></div>'}
let editing=false,draft=null;
function workingConfig(){return editing&&draft?cleanConfig(draft):cfg()}
function stage(c){if(editing){draft=cleanConfig(c)}else saveConfig(c);render()}
function beginEdit(){editing=true;draft=cfg();render()}
function saveEdit(){if(draft)saveConfig(draft);draft=null;editing=false;render()}
function cancelEdit(){draft=null;editing=false;render()}
function preset(c){
 if(!c.auto)return c.preset;
 if((state().shots||[]).some(s=>s.status==='progress'))return'workday';
 return new Date().getHours()<10?'morning':'workday';
}
function visible(c){const p=preset(c);return c.layouts[p].filter(x=>x.visible)}
function updateWidget(id,patch){
 const c=workingConfig(),list=c.layouts[preset(c)],w=list.find(x=>x.id===id);
 if(!w)return;
 Object.assign(w,patch);stage(c);
}
function moveWidget(id,direction){
 const c=workingConfig(),list=c.layouts[preset(c)],from=list.findIndex(x=>x.id===id),to=from+direction;
 if(from<0||to<0||to>=list.length)return;
 const tmp=list[from];list[from]=list[to];list[to]=tmp;stage(c);
}
function rearrange(a,b){
 if(a===b||!ids.includes(a)||!ids.includes(b))return;
 const c=workingConfig(),list=c.layouts[preset(c)],from=list.findIndex(x=>x.id===a),to=list.findIndex(x=>x.id===b);
 if(from<0||to<0)return;
 list.splice(to,0,list.splice(from,1)[0]);stage(c);
}
function render(){bridge()?.render?.()}
function activeBore(){const a=state().shots||[];return a.find(x=>x.status==='progress')||a.find(x=>x.status!=='complete')||null}
function crew(){return(state().crew||[]).filter(x=>x.start&&!x.end)}
function countPhotos(shotId){return (bridge()?.photos?.()||[]).filter(p=>(!p.jobId||p.jobId===state().activeJobId)&&(!shotId||p.shotId===shotId)).length}
function widgetHead(id,link,sub){
 return '<div class="bh-widget-title"><span class="bh-widget-icon">'+symbols[id]+'</span><div><strong>'+names[id]+'</strong>'+
 (sub?'<small>'+esc(sub)+'</small>':'')+'</div>'+
 (link?'<button class="bh-widget-more" data-page="'+link+'" aria-label="Open '+names[id]+'">›</button>':'')+'</div>';
}
function widgetBody(id,size){
 const s=state(),all=s.shots||[],unfinished=all.filter(x=>x.status!=='complete'),shot=activeBore();
 if(id==='job'){
  const finished=all.filter(x=>x.status==='complete').length,done=all.filter(x=>x.status==='complete').reduce((sum,x)=>sum+value(x.feet),0);
  return widgetHead('job','job','Active project')+
   '<div class="bh-job-name">'+esc(s.jobName||'My HDD Job')+'</div><p class="bh-small">'+esc(s.jobAddress||'Add a job address in Job Details')+'</p>'+
   '<div class="bh-widget-foot"><span>'+finished+' of '+all.length+' completed</span><b>'+fmt(done)+' ft done</b></div>'+
   (size!=='small'?'<button class="bh-plain-action" data-page="jobs">Switch / View Jobs ›</button>':'');
 }
 if(id==='active'){
  if(!shot)return widgetHead('active','shotcards','Current bore')+'<div class="bh-blank">No active or pending bore yet.</div><button class="bh-plain-action" data-action="new-shot">+ Add First Bore</button>';
  const length=value(shot.feet),done=shot.status==='complete'?length:Math.min(length,value(shot.progressFeet)),pct=length?Math.round(done*100/length):0;
  const pipe=window.BoreLabConduits?.summary?.(shot)||shot.pipeDiameter||'Not set';
  if(size==='compact')return widgetHead('active','shotcards',shot.status==='progress'?'● Drilling':'Pending bore')+
   '<div class="bh-compact-bore"><strong>'+esc(shot.name||'Unnamed bore')+'</strong>'+
   '<span>'+fmt(done)+' / '+fmt(length)+' ft · '+pct+'%</span></div>'+
   '<div class="bh-progress" role="progressbar" aria-label="Manually logged drilling progress" aria-valuenow="'+pct+'" aria-valuemin="0" aria-valuemax="100"><span style="width:'+pct+'%"></span></div>'+
   '<button class="bh-compact-open" data-bh-shot="'+esc(shot.id)+'">Open Shot ›</button>';
  return widgetHead('active','shotcards',shot.status==='progress'?'● Drilling':'Pending bore')+
   '<div class="bh-active-row"><div><h3>'+esc(shot.name||'Unnamed bore')+'</h3>'+
    '<p class="bh-small">'+esc(shot.address||'Address not entered')+'</p></div>'+
    '<span class="bh-active-status '+(shot.status==='progress'?'is-drilling':'')+'">'+(shot.status==='progress'?'Drilling':'Pending')+'</span></div>'+
   '<div class="bh-between"><strong>'+fmt(done)+' / '+fmt(length)+' ft</strong><b>'+pct+'%</b></div>'+
   '<div class="bh-progress"><span style="width:'+pct+'%"></span></div>'+
   (size!=='small'?'<div class="bh-active-metrics">'+
     '<div><small>Pipe</small><strong>'+esc(pipe)+'</strong></div>'+
     '<div><small>Rods</small><strong>'+esc(shot.rodCount??'—')+'</strong></div>'+
     '<div><small>Photos</small><strong>'+countPhotos(shot.id)+'</strong></div></div>':'')+
   '<div class="bh-active-buttons"><button data-bh-shot="'+esc(shot.id)+'">Open Shot</button>'+
    '<button data-page="shotcards">Log Progress</button></div>';
 }
 if(id==='shots'){
  const done=all.filter(x=>x.status==='complete').length;
  return widgetHead('shots','shotboard','Bore status')+
   '<div class="bh-two-metrics"><div><strong>'+all.length+'</strong><small>Total bores</small></div>'+
    '<div><strong>'+done+'</strong><small>Completed</small></div></div>'+
   '<p class="bh-small">'+unfinished.length+' remaining · '+all.filter(x=>x.status==='progress').length+' drilling</p>';
 }
 if(id==='weather'){
  const info=window.BoreLabCommand?.weatherSnapshot?.();
  const target=info?.target,point=target?Number(target.lat).toFixed(3)+','+Number(target.lon).toFixed(3):'';
  const cache=info?.data&&info.key===point,stale=Date.now()-Number(info?.at||0)>45*60000;
  const w=cache?info.data.current:{},p=cache?info.data.hourly?.precipitation_probability:[];
  const temp=Number.isFinite(Number(w?.temperature_2m))?Math.round(Number(w.temperature_2m))+'°F':'—';
  const wind=Number.isFinite(Number(w?.wind_speed_10m))?Math.round(Number(w.wind_speed_10m))+' mph':'—';
  const rain=Array.isArray(p)&&p.length&&Number.isFinite(Number(p[0]))?Math.round(Number(p[0]))+'%':'—';
  return widgetHead('weather','command',target?target.label:'Set a jobsite pin')+
   '<div class="bh-weather-main"><strong>'+temp+'</strong><span>'+esc(cache?window.BoreLabCommand?.weatherLabel?.(w.weather_code)||'Weather conditions':'Forecast unavailable')+'</span></div>'+
   '<div class="bh-weather-details"><span>☂ Rain <b>'+rain+'</b></span><span>≋ Wind <b>'+wind+'</b></span></div>'+
   '<div class="bh-widget-foot"><small>'+(cache?(stale?'Cached forecast · not live':'Updated '+new Date(info.at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})):
   'Needs internet and saved GPS')+'</small><button data-bh-weather-refresh>↻</button></div>';
 }
 if(id==='next'){
  const order=(bridge()?.orderedShots?.()?.order||unfinished).filter(x=>x.status!=='complete').slice(0,size==='small'?2:3);
  return widgetHead('next','planner','Suggested shot order')+
   (order.length?order.map((x,i)=>'<button class="bh-item" data-bh-shot="'+esc(x.id)+'"><span class="bh-index">'+(i+1)+'</span>'+
    '<strong>'+esc(x.name)+'</strong><small>'+fmt(x.feet)+' ft</small></button>').join(''):'<p class="bh-blank">No pending shots.</p>');
 }
 if(id==='crew'){
  const people=crew();
  return widgetHead('crew','crew','Currently clocked in')+
   '<div class="bh-big-number">'+people.length+' <small>on shift</small></div>'+
   (people.length?people.slice(0,size==='small'?1:3).map(c=>'<div class="bh-crew-line"><span class="bh-crew-dot">●</span><strong>'+esc(c.name||'Crew member')+'</strong>'+
    '<small data-live-elapsed="'+esc(c.start)+'">On shift</small></div>').join(''):'<p class="bh-small">Crew is not clocked in.</p>')+
   (size==='large'?'<button class="bh-plain-action" data-page="crew">Crew Timesheets ›</button>':'');
 }
 if(id==='reels'){
  const all=(s.reels||[]).filter(r=>!r.archived&&r.location==='truck'),savedIds=window.BoreLabDailyReels?.activeIds?.(s,today())||[];
  const chosen=savedIds.length?all.filter(r=>savedIds.includes(r.id)):all;
  const total=chosen.reduce((sum,r)=>sum+value(r.remaining),0);
  return widgetHead('reels','reelplan',savedIds.length?'Daily loadout':'On-truck inventory')+
   '<div class="bh-big-number">'+fmt(total)+' <small>ft recorded</small></div>'+
   (chosen.length?chosen.slice(0,size==='small'?1:2).map(r=>'<div class="bh-reel-line"><strong>'+esc(r.name||'Reel')+'</strong>'+
    '<small>'+esc(r.size||'Size not entered')+' · '+fmt(r.remaining)+' ft</small></div>').join(''):
    '<p class="bh-small">No reels marked on truck.</p>');
 }
 if(id==='finish'){
  const estimate=window.BoreLabCommand?.estimate?.(),target=s.finishBySettings?.target||'16:00';
  return widgetHead('finish','command','Based on planned footage')+
   '<div class="bh-big-number">'+esc(estimate?.finish||'—')+'</div>'+
   '<p class="bh-small">Target leave: '+esc(target)+' · '+(estimate?'Estimate at '+fmt(estimate.pace)+' ft/hr':'No pending bores')+'</p>';
 }
 if(id==='photos'){
  const photos=bridge()?.photos?.()||[],mine=photos.filter(p=>!p.jobId||p.jobId===s.activeJobId);
  const missing=all.filter(x=>x.status==='complete'&&!mine.some(p=>p.shotId===x.id&&p.stage==='after'));
  return widgetHead('photos','phototimeline2','Jobsite gallery')+
   '<div class="bh-two-metrics"><div><strong>'+mine.length+'</strong><small>Saved photos</small></div>'+
   '<div><strong>'+missing.length+'</strong><small>After missing</small></div></div>'+
   (missing.length?'<p class="bh-widget-warn">⚠ '+esc(missing[0].name)+' needs an After photo</p>':
   '<p class="bh-small">Review photos before closeout.</p>');
 }
 if(id==='scanner')return widgetHead('scanner','scan3','Paperwork → shots')+
   '<p class="bh-small">Scan and review addresses, bore footage, and conduit details before importing.</p>'+
   '<button class="bh-plain-action" data-page="scan3">▤ Open Scanner ›</button>';
 if(id==='quick')return widgetHead('quick',null,'One-tap tools')+
   '<div class="bh-quick-grid"><button data-action="new-shot">＋<small>Add Shot</small></button>'+
   '<button data-page="phototimeline2">▣<small>Photos</small></button>'+
   '<button data-page="scan3">▤<small>Scan</small></button>'+
   '<button data-page="dayassist">✓<small>Close Day</small></button></div>';
 if(id==='notes')return widgetHead('notes','job','Saved job notes')+
   '<p class="bh-small">'+esc(s.jobNotes||'No job notes saved yet. Add access details and crew instructions in Job Details.')+'</p>';
 if(id==='map'){
  const loc=all.filter(x=>bridge()?.coordsValid?.(x)).length,missing=all.length-loc;
  return widgetHead('map','jobmap','Saved bore locations')+
   '<div class="bh-two-metrics"><div><strong>'+loc+'</strong><small>GPS pins</small></div>'+
   '<div><strong>'+missing+'</strong><small>Need GPS</small></div></div>'+
   '<button class="bh-plain-action" data-page="jobmap">⌖ Open Jobsite Map ›</button>';
 }
 if(id==='backup')return widgetHead('backup','recovery','Protect local records')+
   '<p class="bh-small">Export job data and photos to a safe backup file.</p>'+
   '<button class="bh-plain-action" data-page="recovery">Backup & Recovery ›</button>';
 return '';
}
function editorCard(c,p){
 const selected=c.layouts[p];
 return '<section class="bh-editor"><div class="bh-between"><div><strong>Customize '+presetNames[p]+'</strong>'+
 '<p>Preview your changes below. Save or discard when you’re happy with the layout.</p></div>'+
 '<button data-bh-cancel aria-label="Discard changes and close editor">✕</button></div>'+
 '<div class="bh-edit-preview-label">◉ LIVE PREVIEW · NOT SAVED</div>'+
 '<div class="bh-editor-options"><label><input type="checkbox" data-bh-auto '+(c.auto?'checked':'')+'> Auto-select Morning / Workday</label>'+
 '<label><input type="checkbox" data-bh-density '+(c.density==='compact'?'checked':'')+'> Compact card spacing</label>'+
 '<button data-bh-reset>Reset This Preset</button></div>'+
 '<div class="bh-editor-rows">'+selected.map((w,i)=>
 '<div class="bh-editor-row"><span class="bh-editor-symbol">'+symbols[w.id]+'</span><label class="bh-editor-check">'+
 '<input type="checkbox" data-bh-visible="'+w.id+'" '+(w.visible?'checked':'')+'><strong>'+names[w.id]+'</strong></label>'+
 '<select aria-label="Size of '+names[w.id]+'" data-bh-size="'+w.id+'">'+widgetSizes(w.id).map(sz=>
 '<option value="'+sz+'" '+(sz===w.size?'selected':'')+'>'+sz[0].toUpperCase()+sz.slice(1)+'</option>').join('')+'</select>'+
 '<button data-bh-move="'+w.id+'" data-direction="-1" aria-label="Move '+names[w.id]+' up" '+(i===0?'disabled':'')+'>↑</button>'+
 '<button data-bh-move="'+w.id+'" data-direction="1" aria-label="Move '+names[w.id]+' down" '+(i===selected.length-1?'disabled':'')+'>↓</button></div>').join('')+'</div>'+
 '<div class="bh-editor-footer"><button class="bh-editor-done" data-bh-save>✓ Save Layout</button>'+
 '<button data-bh-cancel>↶ Discard Changes</button></div></section>';
}
function heroWeather(){
 const snapshot=window.BoreLabCommand?.weatherSnapshot?.(),where=snapshot?.target;
 const key=where?Number(where.lat).toFixed(3)+','+Number(where.lon).toFixed(3):'';
 const reading=snapshot?.data?.current;
 const valid=Boolean(where&&snapshot?.key===key&&reading&&Number.isFinite(Number(reading.temperature_2m))&&snapshot.at);
 if(!valid)return '<button class="bh-hero-weather is-unavailable" data-page="command" aria-label="Open jobsite weather">☁ <strong>Weather</strong><small>Set GPS / forecast</small></button>';
 const cached=Date.now()-snapshot.at>45*60000;
 const conditions=window.BoreLabCommand?.weatherLabel?.(reading.weather_code)||'Conditions';
 return '<button class="bh-hero-weather" data-page="command" aria-label="'+(cached?'Cached':'Updated')+' weather: '+
  esc(Math.round(Number(reading.temperature_2m))+' degrees, '+conditions)+'">'+
  '<strong>☁ '+Math.round(Number(reading.temperature_2m))+'°F</strong><small>'+
  (cached?'Cached · ':'')+esc(conditions)+'</small></button>';
}
function renderHome(){
 const c=workingConfig(),p=preset(c),current=visible(c),hour=new Date().getHours();
 const greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
 // Approved Home Command artwork, isolated from the concept mockup so live text stays dynamic.
 const rig='<img src="./home-hero-hdd.webp" width="520" height="150" alt="" aria-hidden="true" decoding="async">';
 const subtitle=esc(state().jobName||'Your HDD workday');
 const hero='<div class="bh-hero"><div class="bh-hero-top"><span class="bh-hero-tag">BORELAB FIELD · HOME COMMAND</span>'+
  '<button data-bh-edit aria-label="Customize home dashboard">⚙ Customize</button></div>'+
  '<div class="bh-hero-main"><div class="bh-hero-copy"><h1>'+greeting+', crew.</h1><p>'+new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+
  ' · '+subtitle+'</p></div>'+heroWeather()+'</div><div class="bh-hero-art">'+rig+'</div></div>';
 const profile='<div class="bh-profile"><div class="bh-profile-heading"><strong>My Dashboard</strong><small>'+current.length+' widgets</small></div>'+
 '<div class="bh-presets" role="group" aria-label="Dashboard layout presets">'+Object.keys(presetNames).map(key=>
 '<button data-bh-preset="'+key+'" aria-pressed="'+(p===key?'true':'false')+'" class="'+(p===key?'active':'')+'">'+
 (key==='morning'?'☀':key==='workday'?'◉':'▦')+' '+presetNames[key]+'</button>').join('')+'</div></div>';
 const widgets='<div class="bh-widget-grid" aria-label="Custom home widgets">'+current.map(w=>
 '<article class="bh-widget bh-size-'+w.size+'" data-bh-widget="'+w.id+'">'+
 (editing?'<div class="bh-widget-controls"><span data-bh-grab="'+w.id+'" role="button" tabindex="0" aria-label="Drag '+names[w.id]+' to rearrange">⠿ Hold & Drag</span>'+
 '<button data-bh-hide="'+w.id+'" aria-label="Hide '+names[w.id]+'">✕</button></div>':'')+
 '<div class="bh-widget-content">'+widgetBody(w.id,w.size)+'</div></article>').join('')+'</div>';
 // Asking for weather is allowed only at saved job/opted-in GPS; never trigger a location permission prompt.
 Promise.resolve().then(()=>window.BoreLabCommand?.loadWeather?.()).catch(()=>{});
 const currentJob='<button class="bf-home-jobline" data-page="job" aria-label="Open current job"><span class="bf-home-pin" aria-hidden="true">⌖</span><span><small>ACTIVE JOB</small><strong>'+esc(state().jobName||'Current job')+'</strong></span><span class="bf-job-arrow" aria-hidden="true">›</span></button>';
 const fast='<div class="bf-home-fast" aria-label="Quick access"><button data-page="fieldhistory">▦ Atlas & Calendar</button><button data-bf-menu-action="quick">▣ Quick Photo & Pin</button></div>';
 return '<div class="page bh-home'+(c.density==='compact'?' bh-dense':'')+'">'+hero+currentJob+fast+(window.BoreLabCalendarConnect?.homeCard?.()||'')+(window.BoreLabCrewTeamsV1?.card?.()||'')+(window.BoreLabProductivity?.homeLinks?.()||'')+(window.BoreLabEdgeV22?.homeArrival?.()||'')+profile+
 (editing?editorCard(c,p):'<div class="bh-custom-tip"><span>Long-press a card to customize.</span><button data-bh-edit>Customize Widgets ›</button></div>')+
 widgets+
 '<div class="bh-footer"><button data-bh-edit>▦ Edit Dashboard</button><button data-bh-classic>Classic Home</button></div>'+
 '<p class="bh-disclaimer">Saved locally · Weather requires internet · Progress and forecasts are not drilling telemetry.</p></div>';
}
function refreshWeather(){
 const widget=document.querySelector('.bh-widget[data-bh-widget="weather"] .bh-widget-content');
 if(widget&&isEnabled())widget.innerHTML=widgetBody('weather',widget.closest('.bh-widget')?.classList.contains('bh-size-small')?'small':'medium');
 const chip=document.querySelector('.bh-hero-weather');
 if(chip&&isEnabled())chip.outerHTML=heroWeather();
}
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-bh-enable],[data-bh-classic],[data-bh-edit],[data-bh-save],[data-bh-cancel],[data-bh-preset],[data-bh-reset],[data-bh-move],[data-bh-hide],[data-bh-shot],[data-bh-weather-refresh]');
 if(!el||!bridge())return;
 if(el.hasAttribute('data-bh-enable')){const c=cfg();c.enabled=true;saveConfig(c);editing=false;render();return}
 if(el.hasAttribute('data-bh-classic')){cancelEdit();const c=cfg();c.enabled=false;saveConfig(c);render();return}
 if(el.hasAttribute('data-bh-edit')){beginEdit();return}
 if(el.hasAttribute('data-bh-save')){saveEdit();return}
 if(el.hasAttribute('data-bh-cancel')){cancelEdit();return}
 if(el.dataset.bhPreset){const c=workingConfig();c.preset=el.dataset.bhPreset;c.auto=false;stage(c);return}
 if(el.hasAttribute('data-bh-reset')){
  if(!confirm('Reset this dashboard preset to the default widget layout?'))return;
  const c=workingConfig();c.layouts[preset(c)]=defaultLayout(preset(c));stage(c);return;
 }
 if(el.dataset.bhMove){moveWidget(el.dataset.bhMove,Number(el.dataset.direction));return}
 if(el.dataset.bhHide){updateWidget(el.dataset.bhHide,{visible:false});return}
 if(el.dataset.bhShot){bridge().shotDetail(el.dataset.bhShot);return}
 if(el.hasAttribute('data-bh-weather-refresh')){window.BoreLabCommand?.loadWeather?.(true);return}
});
document.addEventListener('change',event=>{
 const e=event.target;
 if(e.dataset.bhVisible){updateWidget(e.dataset.bhVisible,{visible:e.checked});return}
 if(e.dataset.bhSize){updateWidget(e.dataset.bhSize,{size:widgetSizes(e.dataset.bhSize).includes(e.value)?e.value:'medium'});return}
 if(e.hasAttribute('data-bh-density')){const c=workingConfig();c.density=e.checked?'compact':'comfortable';stage(c);return}
 if(e.hasAttribute('data-bh-auto')){
  const c=workingConfig();c.auto=e.checked;stage(c);return;
 }
});
// Touch-first long-press drag handles and accessible arrow/button alternatives.
let gesture=null,hold=null;
const stopHold=()=>{if(hold!==null){clearTimeout(hold);hold=null}};
document.addEventListener('pointerdown',e=>{
 const card=e.target.closest?.('.bh-widget');
 if(!card||!isEnabled())return;
 const id=card.dataset.bhWidget;
 const handle=e.target.closest?.('[data-bh-grab]');
 if(!editing&&e.target.closest?.('button,input,select,a'))return;
 if(editing&&!handle)return;
 stopHold();gesture={id,x:e.clientX,y:e.clientY,ready:false,dragging:false,pointer:e.pointerId,handle:!!handle};
 hold=setTimeout(()=>{
  if(!gesture)return;
  gesture.ready=true;
  if(gesture.handle){gesture.dragging=true;card.classList.add('bh-dragging')}
  else{beginEdit();bridge()?.notify?.('Widget editing: drag handles or use arrows, then Save Layout.');}
 },480);
});
document.addEventListener('pointermove',e=>{
 if(!gesture||e.pointerId!==gesture.pointer)return;
 if(!gesture.ready){
  if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>12){stopHold();gesture=null}
  return;
 }
 if(!gesture.dragging)return;
 e.preventDefault();
 const target=document.elementFromPoint?.(e.clientX,e.clientY)?.closest?.('.bh-widget');
 document.querySelectorAll('.bh-drag-target').forEach(el=>el.classList.remove('bh-drag-target'));
 if(target&&target.dataset.bhWidget!==gesture.id)target.classList.add('bh-drag-target');
},{passive:false});
document.addEventListener('pointerup',e=>{
 if(!gesture||e.pointerId!==gesture.pointer)return;
 const g=gesture;stopHold();gesture=null;
 if(!g.dragging)return;
 const target=document.elementFromPoint?.(e.clientX,e.clientY)?.closest?.('.bh-widget');
 document.querySelectorAll('.bh-drag-target,.bh-dragging').forEach(el=>el.classList.remove('bh-drag-target','bh-dragging'));
 if(target&&target.dataset.bhWidget!==g.id)rearrange(g.id,target.dataset.bhWidget);
});
document.addEventListener('pointercancel',()=>{stopHold();gesture=null;document.querySelectorAll('.bh-drag-target,.bh-dragging').forEach(el=>el.classList.remove('bh-drag-target','bh-dragging'))});
document.addEventListener('keydown',e=>{
 if(!editing)return;
 const handle=e.target.closest?.('[data-bh-grab]');
 if(!handle)return;
 if(e.key==='ArrowUp'||e.key==='ArrowDown'){
  e.preventDefault();moveWidget(handle.dataset.bhGrab,e.key==='ArrowUp'?-1:1);
 }
});
window.BoreLabHomeV2={renderHome,enabled:isEnabled,classicBanner,refreshWeather,defaultConfig,cleanConfig,moveWidget,rearrange,widgetIds:ids,beginEdit,saveEdit,cancelEdit,workingConfig,heroWeather};
if(bridge()){
 const c=cfg();
 if(!state().homeDashboard2)saveConfig(c);
 if(bridge().currentPage?.()==='home')bridge().render?.();
}
})();
