/* BoreLab Field v0.17: multi-job shot board, compact GPS, reel what-if planner,
   route from current GPS and finish-by-time field estimator. No external API required. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=0)=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:d});
const asNumber=(n,fallback=0)=>Number.isFinite(Number(n))?Number(n):fallback;
const today=()=>api()?.todayLocal?.()||new Date().toISOString().slice(0,10);
const isToday=stamp=>{if(!stamp)return false;const d=new Date(stamp);return Number.isFinite(d.getTime())&&(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))===today()};
const jobs=()=>{const s=api().state();return(s.jobs||[]).filter(j=>!j.archived)};
let gpsOrigin=null,gpsMessage='',boardFilter='all',routePanelOpen=false;
const opts={target:'16:00',pace:70,setup:20,move:15,returnMin:45,lunch:0,buffer:20};
function pref(){
 const stored=api().state().finishBySettings||{};
 return Object.fromEntries(Object.entries(opts).map(([key,v])=>[key,stored[key]??v]));
}
function shotEntries(){
 return jobs().flatMap(job=>(job.shots||[]).map(shot=>({job,shot})));
}
function renderShotBoard(){
 if(!api())return'<div class="page">Shot Board unavailable</div>';
 const all=shotEntries().filter(x=>x.shot.status!=='complete'||isToday(x.shot.completedAt));
 const groups=[
  {id:'progress',label:'Drilling',items:all.filter(x=>x.shot.status==='progress')},
  {id:'planned',label:'Pending',items:all.filter(x=>x.shot.status!=='progress'&&x.shot.status!=='complete')},
  {id:'complete',label:'Completed today',items:all.filter(x=>x.shot.status==='complete')}
 ];
 const count=groups.reduce((n,g)=>n+g.items.length,0),show=boardFilter==='all'?groups:groups.filter(x=>x.id===boardFilter);
 return '<div class="page bl-workday"><div class="between"><div><span class="eyebrow">FIELD / TODAY</span><h1>Today’s Shot Board</h1></div><button type="button" class="btn micro ghost" data-page="jobs">Jobs</button></div>'+
 '<p class="smalltext muted spaced">One board for all active jobs. Pending work remains visible across days; completed shots appear here if their finish date is today. Tap a shot to open its log.</p>'+
 '<div class="bl-board-stats">'+groups.map(g=>'<button type="button" class="bl-board-stat" data-bl-filter="'+g.id+'"><strong>'+g.items.length+'</strong><span>'+esc(g.label)+'</span></button>').join('')+'</div>'+
 '<div class="bl-filter-pills"><button class="btn micro ghost" data-bl-filter="all" aria-pressed="'+(boardFilter==='all')+'">All ('+count+')</button>'+groups.map(g=>'<button class="btn micro ghost" data-bl-filter="'+g.id+'" aria-pressed="'+(boardFilter===g.id)+'">'+esc(g.label)+'</button>').join('')+'</div>'+
 show.map(group=>'<section class="bl-board-group"><div class="between"><h2>'+esc(group.label)+'</h2><span class="hint">'+group.items.length+'</span></div>'+
 (group.items.length?group.items.map(({job,shot})=>{
  const next=shot.status==='complete'?'Reopen':shot.status==='progress'?'Mark complete':'Start drilling';
  return'<div class="card bl-board-shot"><button class="bl-board-shot-main" type="button" data-bl-shot-open="'+esc(shot.id)+'" data-job="'+esc(job.id)+'">'+
   '<strong>'+esc(shot.name)+' · '+fmt(shot.feet,1)+' ft</strong><small>'+esc(job.jobName)+' · '+esc(shot.address||'No saved address')+'</small>'+
   '<small>'+esc(window.BoreLabConduits?.summary(shot)||shot.pipeDiameter||'Conduit size missing')+'</small></button>'+
   '<div class="bl-board-shot-buttons"><button type="button" class="btn micro primary" data-bl-shot-status="'+esc(shot.id)+'" data-job="'+esc(job.id)+'">'+next+'</button>'+
   '<button type="button" class="btn micro ghost" data-bl-shot-open="'+esc(shot.id)+'" data-job="'+esc(job.id)+'">Details</button></div></div>';
 }).join(''):'<p class="smalltext muted">No shots in this category.</p>')+'</section>').join('')+
 '<div class="action-row spaced"><button class="btn primary" data-action="new-shot">+ Add Bore</button><button class="btn ghost" data-page="planner">Shot Planner</button></div></div>';
}
function transition(jobId,shotId){
 const b=api(),state=b.state(),job=(state.jobs||[]).find(j=>j.id===jobId&&!j.archived);
 if(!job)return b.notify('Job not found.');
 const shot=(job.shots||[]).find(x=>x.id===shotId);
 if(!shot)return b.notify('Shot not found.');
 if(shot.status==='complete'&&!window.confirm('Reopen '+shot.name+'? This changes its recorded completion status.'))return;
 const now=new Date().toISOString();
 const next=shot.status==='complete'?'planned':shot.status==='progress'?'complete':'progress';
 const change=x=>{
  x.status=next;
  if(next==='progress')x.startedAt=x.startedAt||now;
  if(next==='complete'){x.startedAt=x.startedAt||now;x.completedAt=now}
  if(next==='planned')x.completedAt=null;
  x.updatedAt=now;
 };
 change(shot);
 if(jobId===state.activeJobId){const active=state.shots.find(x=>x.id===shotId);if(active&&active!==shot)change(active)}
 b.save();b.render();b.notify(shot.name+' → '+(next==='planned'?'Pending':next==='progress'?'Drilling':'Completed')+'.');
}
function renderGpsPanel(plan){
 const state=api().state();
 const missing=(state.shots||[]).filter(s=>s.status!=='complete'&&!api().coordsValid(s));
 const noShop=!api().coordsValid(api().shop());
 if(!missing.length&&!noShop)return'<p class="tiny muted bl-gps-good">✓ All active job shot GPS pins and shop pin are saved.</p>';
 const total=missing.length+(noShop?1:0);
 return'<details class="bl-gps-details"><summary><strong>'+total+' location'+(total===1?' needs':'s need')+' GPS</strong> <span>· Fix pins</span></summary>'+
 '<p class="smalltext muted">BoreLab can route to saved street addresses or Plus Codes in Maps. Straight-line optimization still needs numeric GPS pins. These are separate.</p>'+
 (noShop?'<div class="bl-gps-line"><span>Home base has no GPS</span><button class="btn micro ghost" data-action="edit-homebase">Edit shop</button></div>':'')+
 missing.map(sh=>'<div class="bl-gps-line"><span><strong>'+esc(sh.name)+'</strong><small>'+esc(sh.address||'No location')+'</small></span><button class="btn micro ghost" data-action="edit-shot" data-id="'+esc(sh.id)+'">Edit GPS</button></div>').join('')+
 '</details>';
}
function orderFrom(origin,entries){
 const b=api();
 const located=entries.filter(x=>b.coordsValid(x.shot)),unknown=entries.filter(x=>!b.coordsValid(x.shot));
 let cursor=origin?{...origin}:null;
 let waiting=[...located],out=[];
 if(!cursor&&waiting.length){out.push(waiting.shift());cursor=out[0].shot}
 while(waiting.length){
  waiting.sort((a,b)=>api().hav(cursor,a.shot)-api().hav(cursor,b.shot)||String(a.shot.name).localeCompare(String(b.shot.name)));
  const next=waiting.shift();out.push(next);cursor=next.shot;
 }
 return{located:out,unknown};
}
function originPreview(){
 const b=api(),s=b.state(),entry=(s.shots||[]).filter(sh=>sh.status!=='complete').map(shot=>({job:{id:s.activeJobId,jobName:s.jobName},shot}));
 const origin=gpsOrigin&&b.coordsValid(gpsOrigin)?gpsOrigin:b.coordsValid(b.shop())?b.shop():null;
 if(!origin)return'<p class="tiny muted">Choose current GPS or save your shop coordinates to rank nearby shots.</p>';
 const result=orderFrom(origin,entry);
 return '<div class="bl-nearby">'+(result.located.length?result.located.slice(0,8).map((x,i)=>'<div class="bl-gps-line"><span>'+(i+1)+'. <strong>'+esc(x.shot.name)+'</strong></span><span>'+fmt(b.hav(origin,x.shot),1)+' mi</span></div>').join(''):'<p class="tiny muted">No pending shots have GPS to rank.</p>')+
 (result.unknown.length?'<p class="tiny muted">'+result.unknown.length+' unlocated shots excluded from distance ranking.</p>':'')+
 '</div>';
}
function renderRouteTools(){
 return'<details class="bl-route-extra card spaced" '+(routePanelOpen?'open':'')+'><summary><strong>Start from my GPS</strong> · Local proximity preview</summary>'+
 '<p class="tiny muted">This ranks active-job shots by straight-line distance from your current GPS or shop, not road travel time. It does not change the saved route mode.</p>'+
 '<div class="action-row"><button class="btn micro primary" data-bl-origin="gps">Use current GPS</button><button class="btn micro ghost" data-bl-origin="shop">Use shop</button></div>'+
 (gpsMessage?'<p class="tiny muted">'+esc(gpsMessage)+'</p>':'')+originPreview()+'</details>';
}
function candidateReels(state,day,allowAll=false){
 const pair=window.BoreLabDailyReels?.activeIds(state,day)||[];
 if(!pair.length&&!allowAll)return{chosen:[],incomplete:true,ids:pair};
 const candidates=(state.reels||[]).filter(r=>!r.archived&&r.location==='truck'&&(allowAll||pair.includes(r.id)));
 return{chosen:candidates,incomplete:pair.length!==2,ids:pair};
}
function simulateReels(state,day,shots,reels){
 const sizeKey=window.BoreLabConduits?.sizeKey||((s)=>String(s||'').toLowerCase());
 const plan=window.BoreLabConduits?.plan||(()=>[]);
 const snapshot=reels.map(r=>({id:r.id,name:r.name,size:r.size,key:sizeKey(r.size),available:Math.max(0,asNumber(r.remaining)),remaining:Math.max(0,asNumber(r.remaining)),mustEmpty:!!r.mustEmpty}));
 const pendingIds=new Set(shots.map(x=>x.shot.id));
 const reservations=state.pipeReservations||[];
 for(const reel of snapshot)reel.remaining=Math.max(0,reel.remaining-reservations.filter(x=>x.reelId===reel.id&&!pendingIds.has(x.shotId)).reduce((n,x)=>n+Math.max(0,asNumber(x.feet)),0));
 const allocations=[],shortages=[],untracked=[];
 for(const entry of shots){
  const lines=plan(entry.shot,entry.job.allowance??state.allowance??10);
  if(!lines.length){untracked.push(entry);continue}
  for(const line of lines){
   const required=Math.max(0,Number(line.perRun)||0);
   for(let count=0;count<line.quantity;count++){
    const candidates=snapshot.filter(r=>r.key===sizeKey(line.size)&&required>0&&r.remaining+1e-9>=required);
    candidates.sort((a,b)=>a.remaining-b.remaining||(b.mustEmpty?1:0)-(a.mustEmpty?1:0));
    if(!candidates.length){shortages.push({job:entry.job,shot:entry.shot,size:line.size,required});continue}
    const picked=candidates[0];picked.remaining=Math.max(0,picked.remaining-required);
    allocations.push({job:entry.job,shot:entry.shot,size:line.size,feet:required,reel:picked.name,reelId:picked.id});
   }
  }
 }
 return{reels:snapshot,allocations,shortages,untracked};
}
function renderReelOptimizer(){
 const b=api();if(!b)return'';
 const state=b.state(),day=today(),selection=candidateReels(state,day);
 const pending=shotEntries().filter(x=>x.shot.status!=='complete');
 const outcome=simulateReels(state,day,pending,selection.chosen);
 return'<details class="card spaced bl-optimizer"><summary><strong>Smart Reel Optimizer</strong> · Two-reel what-if plan</summary>'+
 '<p class="tiny muted">Uses the reels selected for today, grouped by matching conduit diameter. Each conduit needs one continuous run. No reel footage is deducted or reserved until you record a real pull.</p>'+
 (selection.incomplete?'<p class="tiny muted">⚠ Select two different on-truck reels in “Two Reels for the Day” above to create a complete loadout.</p>':'')+
 (selection.chosen.length?outcome.reels.map(r=>'<div class="bl-gps-line"><span><strong>'+esc(r.name)+'</strong><small>'+esc(r.size||'Size not recorded')+'</small></span><span>'+fmt(r.available,1)+' → '+fmt(r.remaining,1)+' ft</span></div>').join(''):'<p class="smalltext muted">No daily reels assigned. Open the Two Reels selector above.</p>')+
 '<div class="bl-opt-counts"><span>'+outcome.allocations.length+' conduit runs fitted</span><span>'+outcome.shortages.length+' not fitted</span></div>'+
 (outcome.allocations.length?'<details><summary>Suggested reel assignments ('+outcome.allocations.length+')</summary>'+
 outcome.allocations.slice(0,35).map(x=>'<div class="bl-gps-line"><span><strong>'+esc(x.shot.name)+'</strong><small>'+esc(x.job.jobName)+' · '+esc(x.size)+'</small></span><span>'+fmt(x.feet,1)+' ft → '+esc(x.reel)+'</span></div>').join('')+
 (outcome.allocations.length>35?'<p class="tiny muted">Showing the first 35 runs.</p>':'')+'</details>':'')+
 (outcome.shortages.length?'<p class="smalltext"><strong>Needs pipe / continuous length:</strong></p>'+
 outcome.shortages.slice(0,10).map(x=>'<p class="tiny muted">'+esc(x.shot.name)+' · '+esc(x.size)+' · '+fmt(x.required,1)+' ft continuous needed</p>').join(''):'')+
 (outcome.untracked.length?'<p class="tiny muted">⚠ '+outcome.untracked.length+' pending shot(s) have no recorded conduit size and are not allocated.</p>':'')+
 '<p class="tiny muted spaced">Estimated what-if only: reel length, pipe type, reservations, fittings and physical condition must be checked before installation.</p></details>';
}
function validTime(value){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))}
function minutesClock(value){return Number(value.slice(0,2))*60+Number(value.slice(3))}
function finishByEstimate(nowMinutes,settings,shots){
 const target=validTime(settings.target)?minutesClock(settings.target):960;
 const pace=Math.max(1,asNumber(settings.pace,70));
 const setup=Math.max(0,asNumber(settings.setup,20)),move=Math.max(0,asNumber(settings.move,15));
 const drive=Math.max(0,asNumber(settings.returnMin,45)),lunch=Math.max(0,asNumber(settings.lunch,0)),buffer=Math.max(0,asNumber(settings.buffer,20));
 const usable=target-nowMinutes-drive-lunch-buffer;
 let spent=0,count=0,last=null;
 const rows=[];
 for(const shot of shots){
  const drilling=Math.max(0,asNumber(shot.feet))/pace*60;
  const work=drilling+setup+(count?move:0);
  const fits=usable>=0&&spent+work<=usable+1e-9;
  rows.push({shot,drilling,work,fits,finish:nowMinutes+spent+work});
  if(fits){spent+=work;count++;last=shot}else break;
 }
 return{target,usable,spent,count,last,rows,remaining:usable-spent,drive,lunch,buffer};
}
function clockLabel(min){
 const value=Math.max(0,Math.round(min));
 return String(Math.floor(value/60)%24).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
}
function renderFinishBy(){
 const b=api();if(!b)return'';
 const state=b.state(),prefs=pref();
 const order=(b.orderedShots()?.order||[]).filter(x=>x.status!=='complete');
 const now=new Date(),minutes=now.getHours()*60+now.getMinutes();
 const forecast=finishByEstimate(minutes,prefs,order);
 const fields=[
  {key:'pace',label:'Drilling pace (ft/hour)',min:1,max:1500,step:5},
  {key:'setup',label:'Setup per shot (min)',min:0,max:240,step:5},
  {key:'move',label:'Move between shots (min)',min:0,max:240,step:5},
  {key:'returnMin',label:'Drive to shop (min)',min:0,max:480,step:5},
  {key:'lunch',label:'Remaining lunch (min)',min:0,max:120,step:5},
  {key:'buffer',label:'Cleanup / buffer (min)',min:0,max:240,step:5}
 ];
 return'<details class="card spaced bl-finish"><summary><strong>Can We Finish by '+esc(prefs.target)+'?</strong> · Time planner</summary>'+
 '<p class="tiny muted">Based on your phone’s current clock ('+clockLabel(minutes)+') and the current suggested shot order. Enter your actual crew pace and travel estimate. No live road traffic is assumed.</p>'+
 '<label class="field">Back at shop by <input type="time" data-bl-finish="target" value="'+esc(prefs.target)+'"></label>'+
 '<div class="bl-time-grid">'+fields.map(f=>'<label class="field">'+esc(f.label)+'<input type="number" inputmode="decimal" data-bl-finish="'+f.key+'" min="'+f.min+'" max="'+f.max+'" step="'+f.step+'" value="'+esc(prefs[f.key])+'"></label>').join('')+'</div>'+
 (order.length?'<div class="bl-time-result"><strong>'+forecast.count+' of '+order.length+' pending shots fit the estimate</strong>'+
 '<p class="smalltext">'+(forecast.last?'Last planned: '+esc(forecast.last.name)+'. ':'No shots fit yet. ')+
 (forecast.usable<0?'Your return deadline is too close or already passed.':'Estimated shop return if stopped here: '+clockLabel(minutes+forecast.spent+forecast.drive+forecast.lunch+forecast.buffer)+'.')+'</p>'+
 '<p class="tiny muted">'+(forecast.usable<0?'Time budget: negative':Math.max(0,Math.round(forecast.remaining))+' min still available before target')+' · Return drive '+fmt(forecast.drive)+' min · Cleanup '+fmt(forecast.buffer)+' min</p></div>':
 '<p class="tiny muted">Add unfinished shots to see a time estimate.</p>')+
 '<p class="tiny muted">These estimates include full shot lengths even for in-progress bores. Delays, weather, unexpected obstructions and road conditions can change the result.</p></details>';
}
function updateFinishField(el){
 const b=api(),key=el.dataset.blFinish;if(!(key in opts))return;
 const current=pref(),raw=el.value;
 if(key==='target'){if(!validTime(raw)){b.notify('Choose a valid finish time.');return}current.target=raw}
 else{
  const value=Number(raw),limit={pace:[1,1500],setup:[0,240],move:[0,240],returnMin:[0,480],lunch:[0,120],buffer:[0,240]}[key];
  if(!Number.isFinite(value)||value<limit[0]||value>limit[1]){b.notify('Please enter a '+key+' value between '+limit[0]+' and '+limit[1]+'.');return}
  current[key]=value;
 }
 b.state().finishBySettings=current;b.save();
 const parent=el.closest('.bl-finish'),wasOpen=parent?.open;
 // Replacing only the forecast avoids collapsing a form or losing keyboard focus.
 const holder=document.createElement('div');holder.innerHTML=renderFinishBy();
 const latest=holder.querySelector('.bl-time-result'),existing=parent?.querySelector('.bl-time-result');
 if(existing&&latest)existing.replaceWith(latest);
 if(parent){const title=parent.querySelector('summary strong');if(title)title.textContent='Can We Finish by '+current.target+'?'}
}
document.addEventListener('click',async e=>{
 const filter=e.target.closest('[data-bl-filter]');
 if(filter){boardFilter=filter.dataset.blFilter;api().render();return}
 const transitionButton=e.target.closest('[data-bl-shot-status]');
 if(transitionButton){transition(transitionButton.dataset.job,transitionButton.dataset.blShotStatus);return}
 const open=e.target.closest('[data-bl-shot-open]');
 if(open){
  const job=open.dataset.job;
  if(api().switchActiveJob(job))api().shotDetail(open.dataset.blShotOpen);
  return;
 }
 const origin=e.target.closest('[data-bl-origin]');
 if(origin){
  if(origin.dataset.blOrigin==='shop'){routePanelOpen=true;gpsOrigin=null;gpsMessage='Starting from saved shop GPS.';api().render();return}
  try{routePanelOpen=true;gpsMessage='Requesting your GPS location…';const pos=await api().getPosition();gpsOrigin=pos;gpsMessage='Using current GPS (accuracy ±'+Math.round(pos.accuracy||0)+' meters).';api().render()}
  catch(error){gpsMessage=String(error.message||'Location permission unavailable.');api().render()}
 }
});
document.addEventListener('change',e=>{
 const field=e.target.closest('[data-bl-finish]');
 if(field)updateFinishField(field);
});
const style=document.createElement('style');
style.textContent='.bl-workday{padding-bottom:28px}.bl-board-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:15px 0}.bl-board-stat{padding:13px;border:1px solid var(--line);border-radius:15px;background:var(--surface2);color:var(--text);text-align:left}.bl-board-stat strong{font-size:24px;display:block}.bl-board-stat span{font-size:11px;color:var(--muted)}.bl-filter-pills{display:flex;gap:7px;overflow:auto;padding:5px 0 12px}.bl-filter-pills button[aria-pressed="true"]{border-color:var(--accent);color:var(--accent)}.bl-board-group h2{font-size:18px;margin:14px 0}.bl-board-shot{display:flex;gap:9px;align-items:center;margin:9px 0}.bl-board-shot-main{color:var(--text);text-align:left;border:0;background:transparent;flex:1;min-width:0;padding:5px}.bl-board-shot-main strong,.bl-board-shot-main small{display:block;overflow-wrap:anywhere}.bl-board-shot-main small{font-size:12px;color:var(--muted);margin-top:4px}.bl-board-shot-buttons{display:flex;gap:5px;flex-direction:column}.bl-gps-details{margin:10px 0;border:1px solid var(--line);border-radius:12px;padding:11px;background:var(--surface2)}.bl-gps-details summary,.bl-route-extra summary,.bl-optimizer summary,.bl-finish summary{cursor:pointer}.bl-gps-details summary span{color:var(--muted)}.bl-gps-good{margin:12px 0}.bl-gps-line{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)}.bl-gps-line:last-child{border:0}.bl-gps-line small{font-size:11px;color:var(--muted);display:block;overflow-wrap:anywhere}.bl-gps-line>span{font-size:12px}.bl-optimizer>summary,.bl-finish>summary,.bl-route-extra>summary{padding:5px 0}.bl-opt-counts{display:flex;justify-content:space-between;gap:8px;margin:13px 0;font-size:12px;font-weight:800}.bl-time-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:11px 0}.bl-time-grid input,.bl-finish input[type=time]{width:100%;min-width:0}.bl-time-result{border:1px solid var(--line);border-radius:12px;padding:12px;margin:12px 0;background:var(--surface2)}@media(max-width:450px){.bl-board-shot{align-items:stretch;flex-direction:column}.bl-board-shot-buttons{flex-direction:row}.bl-time-grid{grid-template-columns:1fr}}';
document.head.appendChild(style);
window.BoreLabWorkday={renderShotBoard,renderGpsPanel,renderRouteTools,renderReelOptimizer,renderFinishBy,simulateReels,finishByEstimate,transition,orderFrom,renderCompactGps:renderGpsPanel};
})();