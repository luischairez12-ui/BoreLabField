/* BoreLab Field v0.23 — offline material pickup, no stock movements. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const st=()=>api()?.state?.()||{};
const job=()=>api()?.activeJob?.();
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Math.max(0,Number(n)||0).toLocaleString(undefined,{maximumFractionDigits:1});
const n=x=>Math.max(0,Number(x)||0);
const key=x=>window.BoreLabConduits?.sizeKey?.(x)||String(x||'').trim().toLowerCase();
const allowed=()=>{const a=window.BoreLabLocalAccounts;return !!api()&&(!a||a.isUnlocked?.())&&(!a||['owner','foreman'].includes(a.role?.()))};
function trackedReels(){
 const state=st(),ids=window.BoreLabDailyReels?.activeIds?.(state)||[];
 return (state.reels||[]).filter(r=>!r.archived&&r.location==='truck'&&(!ids.length||ids.includes(r.id)));
}
function requirements(j=job()){
 const demands=new Map(),missing=[];
 for(const shot of j?.shots||[]){
  if(shot.status==='complete')continue;
  const lines=window.BoreLabConduits?.plan?.(shot,j.allowance??st().allowance??10)||[];
  if(!lines.length){missing.push(shot.name||'Unnamed bore');continue}
  for(const line of lines){
   const k=key(line.size);if(!k)continue;
   const rec=demands.get(k)||{key:k,size:line.size,needed:0,longest:0,runs:0,shots:new Set()};
   rec.needed+=n(line.total);rec.longest=Math.max(rec.longest,n(line.perRun));
   rec.runs+=n(line.quantity);rec.shots.add(shot.id);demands.set(k,rec);
  }
 }
 const stock=new Map(),known=(st().reels||[]).length>0;
 for(const reel of trackedReels()){
  const k=key(reel.size);if(!k)continue;
  const rec=stock.get(k)||{amount:0,longest:0};
  rec.amount+=n(reel.remaining);rec.longest=Math.max(rec.longest,n(reel.remaining));stock.set(k,rec);
 }
 return {known,missing,reelCount:trackedReels().length,
  todayOnly:!!(window.BoreLabDailyReels?.activeIds?.(st())||[]).length,
  lines:[...demands.values()].map(rec=>{
   const have=stock.get(rec.key),available=known?(have?.amount||0):null;
   return {...rec,shots:rec.shots.size,available,shortage:available===null?null:Math.max(0,rec.needed-available),
    longRisk:known&&rec.longest>(have?.longest||0)+.001,longestReel:have?.longest||0};
  }).sort((a,b)=>a.size.localeCompare(b.size))};
}
function checklistText(){
 const data=requirements(),out=['BORELAB FIELD — MATERIAL PICKUP','Job: '+(job()?.jobName||'Current Job'),
 'Printed: '+new Date().toLocaleString(),'Planning only — not an inventory transaction',''];
 for(const line of data.lines)
  out.push('[ ] '+line.size+' — '+fmt(line.needed)+' ft required; '+(line.shortage===null?'Stock by size unknown':line.shortage>0?fmt(line.shortage)+' ft additional needed':'Gross footage on truck sufficient')+
    (line.longRisk?' — VERIFY continuous reel length ('+fmt(line.longest)+' ft required)':''));
 for(const name of data.missing)out.push('[ ] Check missing conduit size: '+name);
 if(!data.lines.length)out.push('No unfinished shots with known conduit material.');
 out.push('','Verify physical reel stock, reservations, offcuts, safety and pull lengths before ordering.');
 return out.join('\n');
}
function render(){
 const data=requirements(),checks=job()?.materialPickupChecks||{};
 return '<section class="bp-panel"><div class="bp-head"><div><span class="eyebrow">FIELD / MATERIALS</span><h2>Material Pickup Assistant</h2></div><span class="bp-pill">Offline</span></div>'+
 '<p class="smalltext muted">Needs are calculated from unfinished bores, conduit quantities and saved pipe allowance. No pipe is automatically deducted or ordered.</p>'+
 '<div class="bp-metrics"><span><small>Conduit sizes</small><strong>'+data.lines.length+'</strong></span><span><small>Truck reels counted</small><strong>'+data.reelCount+'</strong></span></div>'+
 (!data.known?'<p class="bp-warning">Size-specific reel stock not recorded. Shortage quantities are unverified.</p>':
 '<p class="bp-note">Using '+(data.todayOnly?'today’s selected truck reels':'all non-archived reels marked Truck')+'. Verify what is physically available.</p>')+
 (data.lines.length?'<div class="bp-material-list">'+data.lines.map(line=>
 '<article class="bp-material"><div class="bp-material-title"><strong>'+esc(line.size)+'</strong>'+
 '<span class="'+(line.shortage!==null&&line.shortage>0?'bp-short':'')+'">'+esc(line.shortage===null?'Unknown stock':line.shortage>0?'Short '+fmt(line.shortage)+' ft':'Gross balance OK')+'</span></div>'+
 '<small>'+line.shots+' pending bore(s) · '+line.runs+' conduit run(s)</small>'+
 '<div class="bp-dual"><span>Required <b>'+fmt(line.needed)+' ft</b></span><span>Truck <b>'+(line.available===null?'Unknown':fmt(line.available)+' ft')+'</b></span></div>'+
 (line.longRisk?'<p class="bp-warning">⚠ Longest single run '+fmt(line.longest)+' ft; largest available matching reel '+fmt(line.longestReel)+' ft.</p>':'')+
 '<label class="bp-check"><input type="checkbox" data-bp-check="'+esc(line.key)+'" '+(checks[line.key]?.done?'checked':'')+'> Picked up / verified (manual only)</label></article>').join('')+'</div>':
 '<p class="bp-empty">No size-specific requirements yet. Add conduits to planned bores.</p>')+
 (data.missing.length?'<p class="bp-warning">Conduit sizes not recorded for: '+esc(data.missing.join(', '))+'.</p>':'')+
 '<div class="bp-actions"><button class="bp-primary" data-bp-copy-list>▤ Copy Pickup Checklist</button><button data-page="pipe">Pipe Inventory</button><button data-page="planner">Bores</button></div>'+
 '<p class="tiny muted">Totals may include reserved pipe; confirm reservations, reel continuity and field conditions before pickup.</p></section>';
}
function mark(keyValue,done){
 if(!allowed()||!requirements().lines.some(x=>x.key===keyValue))return;
 const j=job();if(!j)return;
 if(!j.materialPickupChecks||typeof j.materialPickupChecks!=='object')j.materialPickupChecks={};
 j.materialPickupChecks[keyValue]={done:!!done,at:new Date().toISOString()};
 st().demo=false;api()?.save?.();
 api()?.notify?.('Pickup checklist saved. Actual pipe inventory was not changed.');
}
async function copyList(){
 if(!allowed())return;
 const text=checklistText();
 try{
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);api()?.notify?.('Pickup list copied. Verify before ordering.');return}
  const el=document.createElement('textarea');el.value=text;el.style.position='fixed';el.style.left='-9999px';document.body.appendChild(el);
  el.select();const ok=document.execCommand?.('copy');el.remove();
  if(ok){api()?.notify?.('Pickup list copied.');return}
 }catch(e){}
 api()?.showModal?.('<div class="modal-head"><h2>Pickup Checklist</h2><button class="icon-btn" data-action="close-modal">✕</button></div>'+
  '<textarea readonly rows="12" class="bp-pickup-copy">'+esc(text)+'</textarea>');
}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-bp-copy-list]'))copyList()});
document.addEventListener('change',e=>{if(e.target.matches?.('[data-bp-check]'))mark(e.target.dataset.bpCheck,e.target.checked)});
window.BoreLabPickup={requirements,checklistText,render,mark,trackedReels,copyList,allowed};
})();