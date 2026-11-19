/* BoreLab Field: Smart Shot Cards & Reel Manager visual layer */
(function(){
'use strict';
const base=window.BoreLabCommand,api=()=>window.BoreLabAssistantBridge;
if(!base)return;
const st=()=>api()?.state()||{},shots=()=>st().shots||[],allPhotos=()=>api()?.photos?.()||[];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
const fmt=x=>n(x).toLocaleString(undefined,{maximumFractionDigits:1});
const photos=id=>allPhotos().filter(p=>p.shotId===id&&(!p.jobId||p.jobId===st().activeJobId));
let expanded='',filter='all',search='',reelTab='today';
const selection=()=>shots().filter(s=>(filter==='all'||s.status===filter)&&(!search||[s.name,s.address,s.notes,s.pipeDiameter].some(x=>String(x||'').toLowerCase().includes(search.toLowerCase()))));
const status=s=>s.status==='complete'?'Complete':s.status==='progress'?'Drilling':'Pending';
function card(s){
 const open=expanded===s.id,len=n(s.feet),done=s.status==='complete'?len:Math.min(len,n(s.progressFeet));
 const percent=len?Math.round(done*100/len):0,ph=photos(s.id),pipe=window.BoreLabConduits?.summary?.(s)||s.pipeDiameter||'Not recorded';
 const rod=s.rodCount!==''&&s.rodCount!=null?fmt(s.rodCount):'—';
 const depth=s.currentDepth!==''&&s.currentDepth!=null?fmt(s.currentDepth)+' ft':
 s.entryDepth!==''&&s.entryDepth!=null?fmt(s.entryDepth)+' ft entry':'—';
 return '<article class="blv-shot blv-'+esc(s.status||'planned')+(open?' expanded':'')+'">'+
 '<button class="blv-shot-head" data-blv-expand="'+esc(s.id)+'" aria-expanded="'+open+'"><span class="blv-icon">⌁</span>'+
 '<span class="blv-shot-name"><strong>'+esc(s.name||'Unnamed bore')+'</strong><small>'+fmt(done)+' / '+fmt(len)+' ft</small></span>'+
 '<span class="blv-badge">'+status(s)+'</span><b>'+(open?'⌃':'⌄')+'</b></button>'+
 '<div class="blv-bar-row"><div class="blv-bar"><span style="width:'+percent+'%"></span></div><small>'+percent+'%</small></div>'+
 (open?'<div class="blv-shot-details"><div class="blv-address"><span>⌖</span><div><strong>'+esc(s.address||'No address saved')+'</strong>'+
 '<small>'+(api()?.coordsValid?.(s)?'✓ GPS saved':'GPS pin not yet saved')+'</small></div>'+
 '<button data-blv-map="'+esc(s.id)+'" aria-label="Navigate to bore">↗</button></div>'+
 '<div class="blv-specs"><div><small>◈ Pipe / Conduit</small><strong>'+esc(pipe)+'</strong></div>'+
 '<div><small>▤ Rods</small><strong>'+rod+'</strong></div><div><small>↧ Depth</small><strong>'+depth+'</strong></div></div>'+
 '<div class="blv-between"><strong>▣ Photos · '+ph.length+'</strong><small>Before / During / After</small></div>'+
 '<div class="blv-photos">'+(ph.length?ph.slice(0,3).map(p=>'<img src="'+esc(p.dataUrl)+'" alt="Jobsite photo" loading="lazy">').join(''):
 '<p>No linked photos yet.</p>')+(ph.length>3?'<span>+'+(ph.length-3)+'</span>':'')+'</div>'+
 '<div class="blv-notes"><strong>▤ Notes / Readiness</strong><p>'+esc(s.notes||'Open this shot to review field notes and readiness checks.')+'</p></div>'+
 (s.status==='complete'?'':'<label class="field">Feet drilled so far · manual entry<input type="number" min="0" max="'+len+'" step="0.1" inputmode="decimal" data-blv-feet="'+esc(s.id)+'" value="'+esc(s.progressFeet??'')+'" placeholder="Enter feet"></label>')+
 '<div class="blv-actions"><button data-blv-open="'+esc(s.id)+'">↗ Open</button>'+
 '<button data-blv-map="'+esc(s.id)+'">⌖ Navigate</button><button data-blv-photo="'+esc(s.id)+'">▣ Add Photo</button>'+
 (s.status==='complete'?'<button data-blv-open="'+esc(s.id)+'" class="blv-primary">✓ View Log</button>':
 '<button data-blv-log="'+esc(s.id)+'" class="blv-primary">＋ Log Progress</button>')+'</div></div>':'')+'</article>';
}
function renderShotCards(){
 const all=shots(),tabs=[['all','All',all.length],['progress','Drilling',all.filter(s=>s.status==='progress').length],
 ['planned','Pending',all.filter(s=>s.status==='planned').length],['complete','Complete',all.filter(s=>s.status==='complete').length]];
 return '<div class="page blv-page blc-page"><header class="blv-header"><span class="eyebrow">FIELD / BORES</span><h1>Smart Shot Cards</h1>'+
 '<p>Every bore from plan to completion, with GPS and photos.</p></header>'+
 '<div class="blv-summary"><div><small>Unfinished bores</small><strong>'+all.filter(s=>s.status!=='complete').length+'</strong></div>'+
 '<div><small>Planned footage</small><strong>'+fmt(all.reduce((sum,s)=>sum+n(s.feet),0))+' ft</strong></div></div>'+
 '<label class="blv-search"><span>⌕</span><input data-blv-search aria-label="Search bores" type="search" maxlength="100" value="'+esc(search)+'" placeholder="Search shots or addresses…"></label>'+
 '<div class="blv-filters" role="group" aria-label="Filter shot status">'+tabs.map(([key,label,count])=>
 '<button data-blv-filter="'+key+'" aria-pressed="'+(key===filter?'true':'false')+'" class="'+(key===filter?'active':'')+'">'+label+' <span>'+count+'</span></button>').join('')+'</div>'+
 '<div class="blv-count">'+selection().length+' matching bores</div><div id="blv-list" class="blv-list">'+
 (selection().length?selection().map(card).join(''):'<div class="blv-empty">No matching shots.</div>')+'</div>'+
 '<div class="blv-bottom"><button class="btn primary" data-action="new-shot">+ Add Bore</button>'+
 '<button class="btn ghost" data-page="shotboard">Shot Board</button></div></div>';
}
function reelData(){
 const p=base.reelPlan?.()||{},sim=p.simulation||{reels:[],allocations:[],shortages:[],untracked:[]};
 return{chosen:p.chosen||[],ids:p.ids||[],pending:p.pending||[],all:(st().reels||[]).filter(r=>!r.archived),sim};
}
function reelCard(r,sim){
 const real=n(r.remaining),forecast=sim.reels.find(x=>x.id===r.id);
 const remainder=forecast?n(forecast.remaining):null,used=remainder===null?null:Math.max(0,real-remainder);
 const pct=real&&used!==null?Math.min(100,Math.round(used*100/real)):0;
 const pulls=sim.allocations.filter(x=>x.reelId===r.id);
 const key=window.BoreLabConduits?.sizeKey||((x)=>String(x||'').toLowerCase());
 const shortage=sim.shortages.some(x=>key(x.size)===key(r.size));
 return '<article class="blv-reel'+(shortage?' short':'')+'"><div class="blv-reel-head"><span class="blv-reel-icon">◉</span>'+
 '<div><strong>'+esc(r.name||'Unnamed reel')+'</strong><small>'+esc(r.size||'Size missing')+' · '+esc(r.material||'HDPE')+'</small></div>'+
 '<span class="blv-ontruck">✓ On Truck</span></div><div class="blv-reel-foot"><small>Recorded remaining</small><strong>'+fmt(real)+' ft</strong></div>'+
 '<div class="blv-reel-bar"><span style="width:'+pct+'%"></span></div>'+
 '<div class="blv-between"><small>'+(used===null?'Simulation unavailable':fmt(used)+' ft planned to use')+'</small>'+
 '<small>'+(remainder===null?'':fmt(remainder)+' ft projected left')+'</small></div>'+
 '<div class="blv-between blv-reel-plan"><strong>◎ '+pulls.length+' planned run(s)</strong><small>'+
 esc([...new Set(pulls.map(x=>x.shot.name))].join(' · ')||'No planned pulls on this reel')+'</small></div>'+
 (shortage?'<p class="blv-warning">⚠ This pipe size has a continuous-length shortage.</p>':'')+'</article>';
}
function pullRow(x,i){
 return '<div class="blv-pull"><span class="blv-index">'+(i+1)+'</span><div><strong>'+esc(x.shot.name)+'</strong>'+
 '<small>'+esc(x.job.jobName||'Job')+' · '+esc(x.size||'Size not recorded')+'</small></div>'+
 '<span>'+fmt(x.feet)+' ft<br><b>'+esc(x.reel)+'</b></span><em>✓</em></div>';
}
function renderReelPlan(){
 const p=reelData(),sim=p.sim,selected=p.ids.length===2;
 const fitted=sim.allocations.reduce((x,a)=>x+n(a.feet),0),missing=sim.shortages.reduce((x,a)=>x+n(a.required),0);
 const tabs=[['today','Today’s Plan'],['inventory','Inventory'],['shots','Shots']];
 const top='<div class="page blv-page blc-page"><header class="blv-header"><span class="eyebrow">FIELD / MATERIALS</span>'+
 '<h1>Intelligent Reel Manager</h1><p>Plan continuous conduit pulls with the pipe you have.</p></header>'+
 '<div class="blv-job"><div><small>ACTIVE JOB</small><strong>'+esc(st().jobName||'Current job')+'</strong></div><small>'+
 esc(api()?.todayLocal?.()||'Today')+'</small></div>'+
 '<div class="blv-tabs" role="group" aria-label="Reel manager views">'+tabs.map(([key,label])=>
 '<button data-blv-tab="'+key+'" aria-pressed="'+(reelTab===key?'true':'false')+'" class="'+(reelTab===key?'active':'')+'">'+label+'</button>').join('')+'</div>';
 const todays='<section class="blv-loadout"><div class="blv-section-head"><h2>Today’s Reel Loadout</h2><span>'+p.ids.length+' Selected</span></div>'+
 '<p>'+(selected?'Your selected on-truck reels':'Showing all on-truck reels until a daily pair is selected')+'.</p>'+
 (p.chosen.length?p.chosen.map(r=>reelCard(r,sim)).join(''):'<div class="blv-empty">No on-truck reels saved yet.</div>')+'</section>'+
 '<details class="blv-choose"'+(selected?'':' open')+'><summary>▤ Choose Two Reels for Today</summary>'+
 (window.BoreLabDailyReels?.renderSection?.()||'<p>Reel selector unavailable.</p>')+'</details>'+
 (selected?'':'<p class="blv-warning">⚠ Select two different on-truck reels to confirm your daily loadout.</p>')+
 '<section class="blv-block"><div class="blv-section-head"><h2>⚠ Continuous-Length Shortages</h2><span>'+sim.shortages.length+'</span></div>'+
 (sim.shortages.length?sim.shortages.slice(0,16).map(x=>'<div class="blv-shortage"><div><strong>'+esc(x.shot.name)+'</strong>'+
 '<small>'+esc(x.size||'Size missing')+'</small></div><b>'+fmt(x.required)+' ft run</b></div>').join(''):
 '<p class="blv-success">✓ No shortages for the recorded conduit runs.</p>')+
 (sim.untracked.length?'<p class="blv-warning">'+sim.untracked.length+' bores missing conduit specifications.</p>':'')+'</section>'+
 '<section class="blv-block"><div class="blv-section-head"><h2>Recommended Pull Plan</h2><span>What-if preview</span></div>'+
 '<p>Whole continuous runs matched to available reels. This does not reserve or deduct pipe.</p>'+
 (sim.allocations.length?sim.allocations.slice(0,30).map(pullRow).join(''):'<div class="blv-empty">No complete conduit runs allocated.</div>')+'</section>'+
 '<div class="blv-coverage"><div class="blv-good"><small>✓ Fitted Planned Runs</small><strong>'+fmt(fitted)+' ft</strong><span>'+sim.allocations.length+' run(s)</span></div>'+
 '<div class="blv-bad"><small>⚠ Needs More Pipe</small><strong>'+fmt(missing)+' ft</strong><span>'+sim.shortages.length+' run(s)</span></div></div>';
 const inventory='<section class="blv-block"><div class="blv-section-head"><h2>Recorded Reel Inventory</h2><span>'+p.all.length+' reels</span></div>'+
 '<p>Manage actual footage through inventory history, not the simulation.</p>'+
 (p.all.length?p.all.map(r=>{
 const reserved=(st().pipeReservations||[]).filter(x=>x.reelId===r.id).reduce((sum,x)=>sum+n(x.feet),0);
 return '<div class="blv-inventory"><span class="blv-reel-icon">◉</span><div><strong>'+esc(r.name||'Reel')+'</strong>'+
 '<small>'+esc(r.size||'Size missing')+' · '+(r.location==='truck'?'On truck':'At yard')+'</small>'+
 '<small>'+fmt(reserved)+' ft reserved</small></div><b>'+fmt(r.remaining)+' ft</b></div>';
 }).join(''):'<div class="blv-empty">No reels recorded.</div>')+'</section>';
 const coverage='<section class="blv-block"><div class="blv-section-head"><h2>Shot Coverage</h2><span>'+p.pending.length+' pending</span></div>'+
 '<p>Tap a shot to open its saved record.</p>'+
 (p.pending.length?p.pending.slice(0,50).map(entry=>{
 const matched=sim.allocations.filter(x=>x.job.id===entry.job.id&&x.shot.id===entry.shot.id);
 const lacks=sim.shortages.some(x=>x.job.id===entry.job.id&&x.shot.id===entry.shot.id);
 const unknown=sim.untracked.some(x=>x.job.id===entry.job.id&&x.shot.id===entry.shot.id);
 return '<button class="blv-shotcoverage" data-blv-shot="'+esc(entry.shot.id)+'" data-job="'+esc(entry.job.id)+'"><div>'+
 '<strong>'+esc(entry.shot.name)+'</strong><small>'+esc(entry.job.jobName)+' · '+fmt(entry.shot.feet)+' ft</small></div>'+
 '<span class="'+(lacks||unknown?'warn':'good')+'">'+(unknown?'Missing specs':lacks?'Needs pipe':matched.length?'Covered':'Not allocated')+'</span><b>›</b></button>';
 }).join(''):'<div class="blv-empty">No pending bores.</div>')+'</section>';
 return top+(reelTab==='today'?todays:reelTab==='inventory'?inventory:coverage)+
 '<div class="blv-bottom"><button data-page="pipe" class="btn primary">⚙ Manage Reels</button><button data-page="planner" class="btn ghost">◎ Shot Planner</button></div>'+
 '<p class="tiny muted">Planning only. Verify pipe size, reel condition and continuous length before any pull.</p></div>';
}
document.addEventListener('click',e=>{
 const t=e.target.closest('[data-blv-expand],[data-blv-filter],[data-blv-open],[data-blv-map],[data-blv-photo],[data-blv-log],[data-blv-tab],[data-blv-shot]');
 if(!t||!api())return;
 if(t.dataset.blvExpand){expanded=expanded===t.dataset.blvExpand?'':t.dataset.blvExpand;api().render();return}
 if(t.dataset.blvFilter){filter=t.dataset.blvFilter;api().render();return}
 if(t.dataset.blvTab){reelTab=t.dataset.blvTab;api().render();return}
 if(t.dataset.blvShot){
  if(t.dataset.job&&t.dataset.job!==st().activeJobId&&!api().switchActiveJob(t.dataset.job))return;
  api().shotDetail(t.dataset.blvShot);return;
 }
 if(t.dataset.blvOpen){api().shotDetail(t.dataset.blvOpen);return}
 if(t.dataset.blvPhoto){api().photoChoose('camera',t.dataset.blvPhoto);return}
 if(t.dataset.blvMap){const x=shots().find(s=>s.id===t.dataset.blvMap);if(x)api().openMapUrl(api().mapsPinUrl(x));return}
 if(t.dataset.blvLog){expanded=t.dataset.blvLog;api().render();document.querySelector('[data-blv-feet]')?.focus();return}
});
document.addEventListener('input',e=>{
 const t=e.target;if(!t.matches('[data-blv-search]'))return;
 search=String(t.value||'').slice(0,100);
 const el=document.querySelector('#blv-list');
 if(el)el.innerHTML=selection().length?selection().map(card).join(''):'<div class="blv-empty">No matching shots.</div>';
 const count=document.querySelector('.blv-count');if(count)count.textContent=selection().length+' matching bores';
});
document.addEventListener('change',e=>{
 const t=e.target;if(!t.matches('[data-blv-feet]')||!api())return;
 const shot=shots().find(x=>x.id===t.dataset.blvFeet);if(!shot)return;
 const raw=String(t.value||'').trim(),feet=Number(raw);
 if(raw&&(!Number.isFinite(feet)||feet<0||feet>n(shot.feet)))return api().notify('Enter footage between 0 and the saved bore length.');
 shot.progressFeet=raw?feet:'';shot.updatedAt=new Date().toISOString();api().save();api().render();api().notify('Manual drilling progress saved.');
});
base.renderShotCards=renderShotCards;
base.renderReelPlan=renderReelPlan;
window.BoreLabVisualPolish={renderShotCards,renderReelPlan};
})();
