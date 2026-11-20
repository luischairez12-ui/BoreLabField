/* BoreLab Field v0.29 — streamlined, offline-first field presentation.
   UI only: existing jobs, shots, GPS, assignments, reels and closeouts remain in their current storage. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const state=()=>api()?.state?.()||{};
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=v=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:1});
const validTabs={bores:['planner','cards'],reels:['inventory','plan','command'],command:['today','dispatch','review']};
const prefKey='borelab-interface-v029';
let prefs={bores:'planner',reels:'inventory',command:'today',locations:{}},restorePending='';
try{const p=JSON.parse(sessionStorage.getItem(prefKey)||'{}');if(p&&typeof p==='object'){
 for(const key of Object.keys(validTabs))if(validTabs[key].includes(p[key]))prefs[key]=p[key];
 if(p.locations&&typeof p.locations==='object')prefs.locations=p.locations;
}}catch{}
function keep(){try{sessionStorage.setItem(prefKey,JSON.stringify(prefs))}catch{}}
function tab(kind){return prefs[kind]||validTabs[kind][0]}
function selectTab(kind,value,refresh=true){
 if(!validTabs[kind]?.includes(value))return false;
 prefs[kind]=value;keep();
 if(refresh)api()?.render?.();
 return true;
}
function remember(page){
 if(!page||page==='crewpreview'||page==='supervisorpreview')return;
 const y=Number(window.scrollY||0);
 if(y>=0&&Number.isFinite(y)){prefs.locations[page]=Math.round(y);keep()}
}
function restore(page){
 if(!page)return;
 const y=Number(prefs.locations[page]||0);
 if(y>0)requestAnimationFrame(()=>{if(api()?.currentPage?.()===page)window.scrollTo({top:y,behavior:'instant'})});
}
function icon(name){return ({home:'⌂',bores:'◎',command:'☷',crew:'♙',photos:'▣',closeout:'✓',reels:'◈',map:'⌖'})[name]||'◦'}
function current(){return api()?.activeJob?.()||null}
function currentShots(){const j=current();return Array.isArray(j?.shots)?j.shots:(state().shots||[])}
function pending(){return currentShots().filter(x=>x.status!=='complete')}
function stats(){
 const s=state(),shots=currentShots(),c=current();
 const activeCrew=(c?.crew||s.crew||[]).filter(x=>x.start&&!x.end).length;
 const reels=(s.reels||[]).filter(x=>!x.archived&&x.location==='truck');
 const pipe=reels.reduce((sum,x)=>sum+Math.max(0,Number(x.remaining)||0),0);
 const evidence=window.BoreLabFieldCommand3?.count?.()||{};
 return {pending:shots.filter(x=>x.status!=='complete').length,total:shots.length,activeCrew,pipe,reels:reels.length,
  evidence:Math.max(0,Number(evidence.after)||0)+Math.max(0,Number(evidence.unlinked)||0),gps:Number(evidence.gps)||0};
}
function homeTile(page,label,description,kind,wide=false){
 return '<button type="button" class="bl29-home-tile'+(wide?' bl29-wide':'')+'" data-page="'+page+'">'+
 '<span class="bl29-tile-icon">'+icon(kind)+'</span><span><strong>'+label+'</strong><small>'+description+'</small></span>'+
 '<b aria-hidden="true">›</b></button>';
}
function renderHome(){
 const s=state(),metrics=stats(),name=current()?.jobName||s.jobName||'No active job';
 return '<main class="page bl29-home"><section class="bl29-active-job">'+
 '<div><span class="bl29-kicker">CURRENT JOB</span><strong>'+safe(name)+'</strong><small>'+safe(current()?.jobAddress||s.jobAddress||'Tap to view job details')+'</small></div>'+
 '<button type="button" data-page="jobs">Switch ›</button></section>'+
 '<header class="bl29-home-title"><span class="bl29-kicker">FIELD DASHBOARD</span><h1>Ready for today</h1>'+
 '<p>Your work, without the extra menus.</p></header>'+
 '<div class="bl29-home-grid">'+
 homeTile('bores','Bores','Plan and track shots','bores')+
 homeTile('fieldcommand','Field Command','Dispatch and review','command')+
 homeTile('crew','Crew','Hours and check-ins','crew')+
 homeTile('photos','Photos','Capture field evidence','photos')+
 homeTile('closeout','Closeout','Finish work and reports','closeout',true)+
 '</div><section class="bl29-snapshot"><div class="bl29-snapshot-head"><h2>Daily snapshot</h2><button type="button" data-page="fieldcommand">Review ›</button></div>'+
 '<div class="bl29-snapshot-grid">'+
 '<div><strong>'+metrics.pending+'</strong><small>Pending bores</small></div>'+
 '<div><strong>'+format(metrics.pipe)+' ft</strong><small>Truck reel inventory</small></div>'+
 '<div><strong>'+metrics.activeCrew+'</strong><small>Crew on shift</small></div>'+
 '<div><strong>'+metrics.evidence+'</strong><small>Photo items to review</small></div>'+
 '</div><p>Reel total is not a per-size or continuous-run availability check.</p></section>'+
 '<div class="bl29-home-foot"><button type="button" data-bl29-action="search">⌕ Find a saved record</button>'+
 '<button type="button" data-page="jobmap">⌖ Open Job Map</button></div></main>';
}
const modes=[
 ['toward','Finish near shop','Farthest first'],
 ['short','Shortest shot last','Save the shortest'],
 ['longest_first','Longest → shortest','Biggest shot first'],
 ['shortest_first','Shortest → longest','Smallest shot first'],
 ['drive','Least straight-line travel','GPS needed'],
 ['short_near','Short shot near shop','Location based']
];
function modeButton(id,title,sub,currentMode){
 return '<button type="button" data-bl29-mode="'+id+'" class="bl29-mode'+(currentMode===id?' active':'')+'" aria-pressed="'+(currentMode===id?'true':'false')+'">'+
 '<strong>'+safe(title)+'</strong><small>'+safe(sub)+'</small></button>';
}
function shotsList(order,ctx){
 if(!order.length)return '<div class="bl29-empty">No pending bores. Add a bore to start your plan.</div>';
 return order.map((shot,i)=>'<button type="button" class="bl29-shot-item" data-bl29-shot="'+safe(shot.id)+'">'+
 '<span class="bl29-shot-num">'+(i+1)+'</span>'+
 '<span class="bl29-shot-details"><strong>'+safe(shot.name||'Bore')+'</strong><small>'+safe(shot.address||'GPS / address not saved')+'</small></span>'+
 '<span class="bl29-shot-feet">'+format(shot.feet)+' ft</span><b aria-hidden="true">›</b></button>').join('');
}
function renderBores(ctx){
 const s=state(),j=current(),tabName=tab('bores'),calc=ctx?.orderedShots?.()||{order:pending(),usable:false,message:'Route preview not ready'};
 const order=calc.order||[],gpsReady=!!calc.allGeo;
 const header='<div class="bl29-head"><div><span class="bl29-kicker">CURRENT JOB / BORES</span><h1>Bores</h1>'+
 '<p>'+safe(j?.jobName||s.jobName||'Choose a job')+' · '+pending().length+' pending</p></div>'+
 '<button type="button" data-bl29-action="add-shot" class="bl29-header-button">＋ Bore</button></div>'+
 '<div class="bl29-tabs" role="tablist" aria-label="Bores views">'+
 '<button type="button" role="tab" data-bl29-tab="bores:planner" aria-selected="'+(tabName==='planner')+'">Shot Planner</button>'+
 '<button type="button" role="tab" data-bl29-tab="bores:cards" aria-selected="'+(tabName==='cards')+'">Shot Cards</button>'+
 '<button type="button" data-page="jobmap" aria-label="Open interactive jobsite map">⌖ Map ↗</button></div>';
 if(tabName==='cards')return '<main class="page bl29-screen bl29-bores">'+header+
 '<section class="bl29-cards-wrap">'+(window.BoreLabCommand?.renderShotCards?.()||'<p>Shot Cards unavailable.</p>')+'</section>'+
 '<div class="bl29-footer-nav"><button type="button" data-bl29-tab="bores:planner">⌁ Back to Shot Planner</button></div></main>';
 const map=ctx?.routeMap?.(order)||'<p>Map not available.</p>';
 const rawMode=s.routeMode||'toward';
 const selected=modes.some(x=>x[0]===rawMode)?rawMode:'toward';
 const err=!calc.usable?'<p class="bl29-plan-notice">'+safe(calc.message||'Save GPS to improve route order.')+'</p>':
 '<p class="bl29-plan-note">'+safe(calc.message||'Shot order ready.')+'</p>';
 return '<main class="page bl29-screen bl29-bores">'+header+
 '<section class="bl29-map-card" aria-label="Shot planner route map"><div class="bl29-section-heading"><h2>Jobsite Map</h2><button type="button" data-page="jobmap">Open interactive map ↗</button></div>'+
 '<div class="bl29-map-preview">'+map+'</div><p>GPS schematic, not streets or driving directions.'+
 (gpsReady?'':' · Some GPS points may be missing.')+'</p></section>'+
 '<section class="bl29-route-options"><h2>Choose how you’d like to finish your day</h2>'+
 '<p>One preference controls your suggested shot order.</p>'+
 '<div class="bl29-route-grid">'+modes.map(x=>modeButton(x[0],x[1],x[2],selected)).join('')+'</div>'+err+'</section>'+
 '<section class="bl29-shot-plan"><div class="bl29-section-heading"><h2>Shot Planner</h2><span>'+order.length+' shots · '+format(order.reduce((sum,x)=>sum+Number(x.feet||0),0))+' ft</span></div>'+
 shotsList(order,ctx)+
 '<div class="bl29-shot-buttons"><button type="button" data-bl29-action="add-shot">＋ Add Bore</button>'+
 (typeof ctx.mapsLink==='function'&&ctx.mapsLink(order)?'<button type="button" data-action="open-full-route">↗ Open Google Maps Route</button>':'')+'</div></section>'+
 '<section class="bl29-reel-shortcut"><div><strong>Pipe readiness</strong>'+
 '<small>Verify reel size, usable length, allowances and reservations before each pull.</small></div>'+
 '<button type="button" data-page="pipe">Pipe Reels ›</button></section>'+
 '<section class="bl29-secondary-tools"><button type="button" data-bl29-action="pin">＋ Field Pin</button>'+
 '<button type="button" data-page="fieldhistory">▦ Calendar</button>'+
 '<button type="button" data-bl29-action="gps">⌖ Locate Missing Addresses</button></section></main>';
}
function tabButton(kind,id,name){
 return '<button type="button" role="tab" data-bl29-tab="'+kind+':'+id+'" aria-selected="'+(tab(kind)===id?'true':'false')+'">'+name+'</button>';
}
function renderReels(ctx){
 const view=tab('reels');
 let inner='';
 if(view==='inventory')inner=typeof ctx?.inventory==='function'?ctx.inventory():'<p>Inventory unavailable.</p>';
 if(view==='plan')inner=(window.BoreLabDailyReels?.renderSection?.()||'')+
  (window.BoreLabWorkday?.renderReelOptimizer?.()||'')+
  (window.BoreLabConduits?.renderPlannerSummary?.()||'');
 if(view==='command')inner=window.BoreLabReelCommand?.render?.()||'<p>Reel Command unavailable.</p>';
 const s=stats();
 return '<main class="page bl29-screen bl29-reels"><div class="bl29-head"><div><span class="bl29-kicker">MATERIALS</span><h1>Pipe Reels</h1>'+
 '<p>Inventory, allocations and reel movement in one place.</p></div><button type="button" class="bl29-header-button" data-bl29-action="reel-new">＋ Reel</button></div>'+
 '<div class="bl29-mini-stats"><span><strong>'+format(s.pipe)+' ft</strong> on truck</span><span><strong>'+s.reels+'</strong> active truck reels</span></div>'+
 '<div class="bl29-tabs" role="tablist" aria-label="Pipe Reels sections">'+
 tabButton('reels','inventory','Inventory')+tabButton('reels','plan','Reel Planning')+tabButton('reels','command','Reel Command')+
 '</div><section class="bl29-reel-content">'+inner+'</section>'+
 '<p class="bl29-tiny-note">Planning estimates do not guarantee a continuous reel fit. Verify size, actual footage and reel condition before a pull.</p></main>';
}
function renderFieldCommand(){
 const key=tab('command'),metrics=stats(),c=current(),people=state().roster||[];
 const title='<div class="bl29-head"><div><span class="bl29-kicker">FIELD OPERATIONS</span><h1>Field Command</h1>'+
 '<p>Dispatch, readiness and daily review.</p></div></div>';
 const tabs='<div class="bl29-tabs" role="tablist" aria-label="Field Command sections">'+
 tabButton('command','today','Today')+tabButton('command','dispatch','Dispatch')+tabButton('command','review','Review')+'</div>';
 let content='';
 if(key==='today')content='<section class="bl29-command-overview"><div class="bl29-brief"><strong>'+metrics.pending+'</strong><small>Pending bores</small></div>'+
 '<div class="bl29-brief"><strong>'+metrics.activeCrew+'</strong><small>On shift</small></div>'+
 '<div class="bl29-brief"><strong>'+metrics.gps+'</strong><small>GPS checks</small></div></section>'+
 '<div class="bl29-command-links">'+
 homeTile('dispatch3','Dispatch Crew','Assign workers, roles and equipment','crew')+
 homeTile('readiness3','Bore Readiness','Pre-drill manual checks','bores')+
 homeTile('evidence3','Evidence Review','Find missing field records','photos')+
 homeTile('dayassist','End-of-Day Review','Prepare the daily closeout','closeout')+
 '</div>'+
 '<details class="bl29-advanced"><summary>Advanced field tools</summary><div>'+
 '<button type="button" data-page="crossings">Utility Crossings</button>'+
 '<button type="button" data-page="equipmentmanager2">Equipment</button>'+
 '<button type="button" data-page="fieldintelligence3">Field Intelligence</button>'+
 '<button type="button" data-page="tools">More Tools</button>'+
 '</div></details>';
 if(key==='dispatch'){
  const assignments=(state().crewAssignmentsV2||[]).filter(x=>x.jobId===c?.id&&x.date===api()?.todayLocal?.());
  content='<section class="bl29-command-intro"><strong>'+assignments.length+' assigned today</strong><p>'+safe(c?.jobName||'Select a job')+'</p></section>'+
  '<div class="bl29-roster-list">'+(people.length?people.map(p=>
   '<div class="bl29-roster"><span>♙</span><div><strong>'+safe(p.name)+'</strong><small>'+safe(p.primaryRole||'Role not set')+'</small></div></div>').join(''):
   '<p class="bl29-empty">Add crew members to start assigning roles.</p>')+'</div>'+
  '<div class="bl29-command-actions"><button type="button" data-page="dispatch3">Assign crew to job ›</button>'+
  '<button type="button" data-page="crewmanager2">Manage crew & roles</button></div>';
 }
 if(key==='review'){
  const issues=window.BoreLabFieldWork3?.evidenceList?.()||[];
  content='<section class="bl29-command-intro"><strong>'+issues.length+' record items to review</strong>'+
  '<p>Checks are prompts for manual review, not automatic approvals.</p></section>'+
  '<div class="bl29-command-links">'+
  homeTile('readiness3','Pre-drill checks','Utility markings, plans and equipment','bores')+
  homeTile('evidence3','Missing evidence','Photo, GPS and note completeness','photos')+
  homeTile('dayassist','Workday review','Closeout checklist and time entries','command')+
  homeTile('studio','As-Built Studio','Customer closeout and documentation','closeout')+
  '</div><p class="bl29-tiny-note">This does not replace site safety reviews, utility clearances or required engineering checks.</p>';
 }
 return '<main class="page bl29-screen bl29-command">'+title+tabs+content+'</main>';
}
function openAction(action){
 const a=api();if(!a)return;
 if(action==='add-shot')return a.newBore?.();
 if(action==='pin')return window.BoreLabFieldPins?.editPin?.('','tie-in');
 if(action==='gps')return a.resolveMissingAddresses?.(true);
 if(action==='reel-new')return a.reelForm?.();
 if(action==='search')return window.BoreLabNavigation?.openSearch?.();
 if(action==='photo')return a.photoChoose?.('camera');
 if(action==='crew-add')return a.openRosterForm?.();
}
document.addEventListener('click',e=>{
 const tabEl=e.target.closest?.('[data-bl29-tab]');
 if(tabEl){
  e.preventDefault();e.stopImmediatePropagation?.();
  const parts=String(tabEl.dataset.bl29Tab||'').split(':');
  if(parts.length===2)selectTab(parts[0],parts[1]);
  return;
 }
 const mode=e.target.closest?.('[data-bl29-mode]');
 if(mode){
  e.preventDefault();e.stopImmediatePropagation?.();
  const m=mode.dataset.bl29Mode;
  if(!modes.some(x=>x[0]===m))return;
  state().routeMode=m;api()?.save?.();api()?.render?.();
  return;
 }
 const shot=e.target.closest?.('[data-bl29-shot]');
 if(shot){e.preventDefault();e.stopImmediatePropagation?.();api()?.shotDetail?.(shot.dataset.bl29Shot);return}
 const action=e.target.closest?.('[data-bl29-action]');
 if(action){e.preventDefault();e.stopImmediatePropagation?.();openAction(action.dataset.bl29Action)}
},{capture:true});
window.BoreLabStreamlineV29={renderHome,renderBores,renderReels,renderFieldCommand,
 tab,selectTab,remember,restore,stats,modes};
})();