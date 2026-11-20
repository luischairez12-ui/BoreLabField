/* BoreLab Field 0.23 — transparent, read-only next-move suggestions. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const st=()=>api()?.state?.()||{};
const job=()=>api()?.activeJob?.();
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Math.max(0,Number(x)||0).toLocaleString(undefined,{maximumFractionDigits:1});
const key=x=>window.BoreLabConduits?.sizeKey?.(x)||String(x||'').trim().toLowerCase();
function pipeStatus(shot,j=job()){
 const lines=window.BoreLabConduits?.plan?.(shot,j?.allowance??st().allowance??10)||[];
 if(!lines.length)return {state:'unknown',text:'Conduit size not recorded'};
 if(!(st().reels||[]).length)return {state:'unknown',text:'Reel quantities by conduit size not recorded'};
 const stock=window.BoreLabPickup?.trackedReels?.()||[];
 for(const line of lines){
  const reels=stock.filter(r=>key(r.size)===key(line.size));
  const total=reels.reduce((n,r)=>n+(window.BoreLabReelCommand?.available?.(r,[shot.id])??Math.max(0,Number(r.remaining)||0)),0);
  if(Number(line.total)>total+.001)
   return {state:'short',text:line.size+': '+fmt(line.total)+' ft needed; '+fmt(total)+' ft recorded'};
  if(!reels.some(r=>(window.BoreLabReelCommand?.available?.(r,[shot.id])??Number(r.remaining))+.001>=Number(line.perRun)))
   return {state:'short',text:line.size+': no continuous '+fmt(line.perRun)+' ft reel'};
 }
 return {state:'ready',text:'Recorded footage and continuous reel lengths appear sufficient'};
}
function plan(){
 const j=job(),route=api()?.orderedShots?.()?.order||[];
 const rank=route.map(shot=>shot.id),markers=(j?.fieldMarkers||[]).filter(m=>m.status!=='resolved');
 const entries=(j?.shots||[]).filter(shot=>shot.status!=='complete').map((shot,i)=>{
  const stock=pipeStatus(shot,j),routeIndex=rank.indexOf(shot.id),located=!!api()?.coordsValid?.(shot);
  const linkedMarkers=markers.filter(m=>m.shotId===shot.id).length;
  const tier=shot.status==='progress'?0:stock.state==='ready'?1:stock.state==='unknown'?2:3;
  return {shot,stock,located,linkedMarkers,tier,order:routeIndex>=0?routeIndex:1000+i};
 }).sort((a,b)=>a.tier-b.tier||a.order-b.order);
 return {entries,best:entries[0]||null,openMarkers:markers.length};
}
function render(){
 const data=plan(),best=data.best;
 return '<section class="bp-panel"><div class="bp-head"><div><span class="eyebrow">BORE / PLANNING</span><h2>What’s My Next Move?</h2></div><span class="bp-pill">Advisory</span></div>'+
 '<p class="smalltext muted">Uses existing planned shot order, unfinished status, saved conduit requirements, truck reels and recorded GPS. It never starts work for you.</p>'+
 (best?'<div class="bp-recommend"><span class="bp-overline">FIRST SHOT TO REVIEW</span><h3>'+esc(best.shot.name||'Bore')+' · '+fmt(best.shot.feet)+' ft</h3>'+
 '<p>'+esc(best.shot.status==='progress'?'This bore is already in progress. Review it before switching.':
 best.stock.state==='ready'?'Fits the gross recorded pipe stock and is high in the preferred shot order.':
 best.stock.state==='short'?'Pipe shortage flagged. Review material before starting.':'Material is unverified. Confirm sizes and available pipe.')+'</p>'+
 '<div class="bp-chips"><span>'+esc(best.shot.status==='progress'?'Drilling':'Planned')+'</span>'+
 '<span class="'+(best.stock.state==='short'?'bp-short':'')+'">'+esc(best.stock.state==='ready'?'✓ Pipe check':best.stock.state==='short'?'⚠ Pipe short':'? Verify pipe')+'</span>'+
 '<span>'+esc(best.located?'GPS saved':'Location missing')+'</span></div>'+
 '<button class="bp-primary" data-bp-shot="'+esc(best.shot.id)+'">Open Bore ›</button></div>':
 '<p class="bp-empty">No unfinished bores are recorded. Use the floating + to add one.</p>')+
 (data.openMarkers?'<p class="bp-warning">⚠ '+data.openMarkers+' unresolved field marker(s). Review hazards and utility locates with your crew before proceeding.</p>':'')+
 '<div class="bp-next-list">'+data.entries.slice(0,8).map((row,i)=>'<button data-bp-shot="'+esc(row.shot.id)+'">'+
 '<span class="bp-rank">'+(i+1)+'</span><span><strong>'+esc(row.shot.name)+' · '+fmt(row.shot.feet)+' ft</strong>'+
 '<small>'+esc(row.stock.text)+'</small><small>'+esc(row.located?'GPS saved':'GPS missing')+
 (row.linkedMarkers?' · '+row.linkedMarkers+' linked marker(s)':'')+'</small></span><b>›</b></button>').join('')+'</div>'+
 '<div class="bp-actions"><button data-bp-feature="pickup">Material Pickup</button><button data-page="shotboard">Shot Board</button><button data-page="jobmap">Job Map</button></div>'+
 '<p class="tiny muted">No travel time or engineered drill alignment is inferred. Verify physical pipe, 811 locates, access, weather and safety before drilling.</p></section>';
}
document.addEventListener('click',e=>{
 const button=e.target.closest?.('[data-bp-shot]');if(!button)return;
 if(!window.BoreLabPickup?.allowed?.())return;
 api()?.shotDetail?.(button.dataset.bpShot);
});
window.BoreLabNextMove={pipeStatus,plan,render};
})();