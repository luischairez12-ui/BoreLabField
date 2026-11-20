/* BoreLab Field v0.25 — native interaction layer over the existing Jobsite Map.
   Stored coordinates are GPS/map references, NOT a surveyed underground trajectory. */
(function(){
'use strict';
const b=()=>window.BoreLabAssistantBridge;
const map=()=>window.BoreLabJobMap;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const allowed=()=>!!b()&&(!window.BoreLabLocalAccounts||window.BoreLabLocalAccounts.isUnlocked?.()&&['owner','foreman'].includes(window.BoreLabLocalAccounts.role?.()));
let hold=null,lastPoint=null;
const clear=()=>{if(hold?.timer)clearTimeout(hold.timer);hold=null};
function atPixel(element,x,y){
 const v=map()?.getView?.();
 if(!v?.center||!Number.isFinite(v.zoom))return null;
 const bounds=element.getBoundingClientRect();
 const cx=bounds.left+bounds.width/2,cy=bounds.top+bounds.height/2;
 const n=256*Math.pow(2,v.zoom),lat=Math.max(-85,Math.min(85,Number(v.center.lat)))*Math.PI/180;
 const pX=(Number(v.center.lon)+180)/360*n+(x-cx);
 const pY=(.5-Math.log((1+Math.sin(lat))/(1-Math.sin(lat)))/(4*Math.PI))*n+(y-cy);
 const lon=((pX/n*360)%360+360)%360-180;
 const latitude=Math.atan(Math.sinh(Math.PI*(1-2*pY/n)))*180/Math.PI;
 if(!Number.isFinite(latitude)||!Number.isFinite(lon))return null;
 return {lat:Number(latitude.toFixed(6)),lon:Number(lon.toFixed(6))};
}
function picker(position){
 if(!allowed()||!position)return;
 lastPoint=position;
 const items=Object.entries(window.BoreLabFieldPins?.kindLabels||{});
 b().showModal('<div class="modal-head"><h2>📍 Add Map Symbol</h2><button class="icon-btn" data-action="close-modal">✕</button></div>'+
 '<p class="smalltext muted">Map location '+esc(position.lat)+', '+esc(position.lon)+'. These are manually placed map coordinates; verify with device GPS for field records.</p>'+
 '<div class="v25-symbol-grid">'+items.map(([kind,label])=>
 '<button type="button" data-v25-symbol="'+esc(kind)+'"><b>'+esc(window.BoreLabFieldPins?.symbolFor?.({kind})||'📍')+'</b><span>'+esc(label)+'</span></button>').join('')+'</div>');
}
document.addEventListener('pointerdown',e=>{
 if(!allowed()||b()?.currentPage?.()!=='jobmap'||!e.isPrimary||e.button!==0)return;
 const surface=e.target.closest?.('[data-blmap-viewport]');
 if(!surface||e.target.closest?.('button,.blmap-sheet,[data-v25-boreline]'))return;
 clear();
 const startX=e.clientX,startY=e.clientY;
 hold={id:e.pointerId,x:startX,y:startY,surface,timer:setTimeout(()=>{
  if(!hold||hold.id!==e.pointerId)return;
  const pos=atPixel(surface,startX,startY);clear();picker(pos);
 },650)};
});
document.addEventListener('pointermove',e=>{
 if(hold&&e.pointerId===hold.id&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>10)clear();
});
for(const event of ['pointerup','pointercancel','pointerleave'])document.addEventListener(event,e=>{
 if(hold?.id===e.pointerId)clear();
});
document.addEventListener('click',e=>{
 const line=e.target.closest?.('[data-v25-boreline]');
 if(line&&allowed()&&b()?.currentPage?.()==='jobmap'){
  e.preventDefault();e.stopPropagation();b()?.shotDetail?.(line.dataset.v25Boreline);return;
 }
 const el=e.target.closest?.('[data-v25-select-bore],[data-v25-edit-endpoints],[data-v25-symbol]');
 if(!el||!allowed())return;
 if(el.dataset.v25Symbol){
  const kind=el.dataset.v25Symbol;
  if(!Object.prototype.hasOwnProperty.call(window.BoreLabFieldPins?.kindLabels||{},kind))return;
  b()?.closeModal?.();
  window.BoreLabFieldPins?.editPin?.('',kind,lastPoint);
  lastPoint=null;return;
 }
 const id=el.dataset.v25SelectBore||el.dataset.v25EditEndpoints;
 if(!id||!b()?.state?.()?.shots?.some(s=>s.id===id))return;
 b()?.closeModal?.();window.BoreLabAsBuilt?.pathEditor?.(id);
});
window.BoreLabMapToolsV25={atPixel,picker,clear};
})();