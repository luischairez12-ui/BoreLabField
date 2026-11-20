/* BoreLab Field 0.24: one reel truth for planning, returns and burn-down.
   Physical balances only change via real pipe-move transactions, never by a what-if. */
(function(){
'use strict';
const bridge=()=>window.BoreLabAssistantBridge;
const state=()=>bridge()?.state?.()||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const num=x=>Math.max(0,Number(x)||0);
const fmt=x=>num(x).toLocaleString(undefined,{maximumFractionDigits:1});
const key=x=>window.BoreLabConduits?.sizeKey?.(x)||String(x||'').toLowerCase();
const selectedIds=()=>window.BoreLabDailyReels?.activeIds?.(state())||[];
const truck=()=>state().reels?.filter(r=>!r.archived&&r.location==='truck')||[];
const pending=()=>state().jobs?.flatMap(job=>(job.shots||[]).filter(shot=>shot.status!=='complete').map(shot=>({job,shot})))||[];
const safe=()=>!!bridge()&&(!window.BoreLabLocalAccounts||['owner','foreman'].includes(window.BoreLabLocalAccounts.role?.())&&window.BoreLabLocalAccounts.isUnlocked?.());
function available(reel,excludedShotIds=[]){
 const exclusions=new Set(excludedShotIds);
 const held=(state().pipeReservations||[]).filter(r=>r.reelId===reel.id&&!exclusions.has(r.shotId)).reduce((n,r)=>n+num(r.feet),0);
 return Math.max(0,num(reel.remaining)-held);
}
function balances(reel){
 const moves=(state().pipeMoves||[]).filter(m=>m.reelId===reel.id);
 const first=moves[0],start=Number.isFinite(+first?.before)?num(first.before):num(reel.remaining);
 const installed=moves.filter(x=>x.type==='installed').reduce((n,m)=>n+num(m.feet),0);
 const reserved=(state().pipeReservations||[]).filter(x=>x.reelId===reel.id).reduce((n,m)=>n+num(m.feet),0);
 return {reel,original:start,installed,physical:num(reel.remaining),reserved,
  available:Math.max(0,num(reel.remaining)-reserved),
  adjusted:moves.filter(x=>x.type!=='installed').length>0};
}
function candidates(){
 const ids=selectedIds(),reels=truck();
 return {dailySelected:ids.length>0,selected:ids.length?reels.filter(r=>ids.includes(r.id)):reels,all:reels};
}
function simulate(entries,reels){
 return window.BoreLabWorkday?.simulateReels?.(state(),new Date().toISOString().slice(0,10),entries,reels)||null;
}
function optimizedReturn(){
 const entries=pending().slice(0,6),more=Math.max(0,pending().length-entries.length),sel=candidates();
 if(!sel.selected.length||!entries.length)return {selection:sel,best:null,more};
 let best=null,seen=0;
 const evaluate=order=>{
  const result=simulate(order,sel.selected);if(!result)return;
  const flagged=result.reels.filter(r=>r.mustEmpty);
  const penalty=result.shortages.length*1e8+result.untracked.length*1e7+
   flagged.reduce((n,r)=>n+num(r.remaining),0)*1000+result.reels.reduce((n,r)=>n+num(r.remaining),0);
  if(!best||penalty<best.score)best={score:penalty,outcome:result,order:order.slice()};
  seen++;
 };
 const walk=(soFar,rest)=>{
  if(!rest.length){evaluate(soFar);return}
  for(let i=0;i<rest.length;i++)walk([...soFar,rest[i]],rest.filter((_,j)=>i!==j));
 };
 walk([],entries);
 return {selection:sel,best,more,permutations:seen};
}
function render(){
 const reels=truck(),totals=reels.map(balances),returnPlan=optimizedReturn();
 const leftover=returnPlan.best?.outcome?.reels||[];
 return '<div class="page br-page"><span class="eyebrow">FIELD / PIPE INVENTORY</span><h1>Reel Command Center</h1>'+
 '<p class="smalltext muted">Actual reel balances and return-friendly what-if planning. Simulations never deduct material.</p>'+
 '<div class="br-reels">'+(totals.length?totals.map(t=>{
 const base=Math.max(t.original,t.physical,1);
 return '<article class="br-card"><div class="between"><div><strong>'+esc(t.reel.name)+'</strong><small class="br-sub">'+esc(t.reel.size||'Size not recorded')+
 (t.reel.mustEmpty?' · Return priority':'')+'</small></div><span class="br-big">'+fmt(t.physical)+' ft</span></div>'+
 '<div class="br-meter"><div style="width:'+Math.max(0,Math.min(100,Math.round(100*t.physical/base)))+'%"></div></div>'+
 '<div class="br-stats"><span>Reference start <strong>'+fmt(t.original)+'</strong></span><span>Installed <strong>'+fmt(t.installed)+'</strong></span>'+
 '<span>Reserved <strong>'+fmt(t.reserved)+'</strong></span><span>Free <strong>'+fmt(t.available)+'</strong></span></div>'+
 (t.adjusted?'<p class="tiny muted">Reference starting footage may differ because this reel has adjustment transactions.</p>':'')+
 '<button class="btn micro ghost" type="button" data-br-reel="'+esc(t.reel.id)+'">Manage Reel ›</button></article>';
 }).join(''):'<p class="br-empty">No on-truck reels saved. Add reels under Pipe Inventory.</p>')+'</div>'+
 '<section class="br-card"><h2>Reel Return Mode</h2>'+
 '<p class="smalltext muted">Prioritizes reels already flagged “Must Empty” and evaluates up to six pending shots. Honors pipe size, continuous lengths and held stock from other work.</p>'+
 (returnPlan.selection.dailySelected?'<p class="br-hint">Using today’s chosen truck reels.</p>':
 '<p class="br-warning">No daily reels selected — preview is using all on-truck reels. Confirm which reels you actually have.</p>')+
 (returnPlan.best?'<div class="br-result"><strong>'+returnPlan.best.outcome.allocations.length+' conduit run(s) fit</strong> · '+
 returnPlan.best.outcome.shortages.length+' cannot fit</div>'+
 '<div class="br-order">'+returnPlan.best.order.map((e,i)=>'<div><span>'+(i+1)+'. '+esc(e.shot.name||'Shot')+'</span><small>'+esc(e.job.jobName||'Job')+' · '+fmt(e.shot.feet)+' ft</small></div>').join('')+'</div>'+
 '<h3>Estimated reel balance after plan</h3>'+
 leftover.map(r=>'<p class="br-reel-row"><span>'+esc(r.name)+(r.mustEmpty?' · return priority':'')+'</span><strong>'+fmt(r.remaining)+' ft</strong></p>').join('')+
 (returnPlan.best.outcome.shortages.length?'<p class="br-warning">⚠ Some runs do not fit: review Material Pickup before drilling.</p>':'')+
 (returnPlan.more?'<p class="br-hint">'+returnPlan.more+' additional unfinished shots were not included in this six-shot comparison.</p>':''):
 '<p class="br-empty">Add planned shots and on-truck reels to see a return combination.</p>')+
 '<div class="br-buttons"><button type="button" data-page="pipe">Manage Reels</button><button type="button" data-bp-feature="pickup">Material Pickup</button>'+
 '<button type="button" data-page="planner">Smart Reel Optimizer</button></div>'+
 '<p class="tiny muted">No inventory changes are made here. Reel Return is planning advice, not a guarantee of useable lengths or permission to return a reel.</p></section></div>';
}
document.addEventListener('click',e=>{
 const x=e.target.closest?.('[data-br-reel]');
 if(!x||!safe())return;
 const reel=state().reels?.find(r=>r.id===x.dataset.brReel);
 if(reel)bridge()?.reelForm?.(reel.id);
});
window.BoreLabReelCommand={render,available,balances,optimizedReturn,candidates,simulate};
})();