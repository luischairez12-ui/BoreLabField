/* Field Command 3.0 — shared local data and customizable command deck */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const state=()=>api()?.state?.()||{};
const job=()=>api()?.activeJob?.()||null;
const jobs=()=>Array.isArray(state().jobs)?state().jobs:[];
const photos=()=>api()?.photos?.()||[];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=p=>p&&p.lat!==''&&p.lon!==''&&p.lat!=null&&p.lon!=null&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lon)&&+p.lat>=-90&&+p.lat<=90&&+p.lon>=-180&&+p.lon<=180;
const num=x=>Math.max(0,Number(x)||0);
const date=()=>api()?.todayLocal?.()||new Date().toISOString().slice(0,10);
const dayOf=x=>{const d=new Date(x);return x&&Number.isFinite(+d)?d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'):''};
const canEdit=()=>{const a=window.BoreLabLocalAccounts;return !a||a.isUnlocked?.()&&['owner','foreman'].includes(a.role?.())};
const preferences=()=>{const s=state();if(!s.fieldCommandV3||typeof s.fieldCommandV3!=='object')s.fieldCommandV3={};const p=s.fieldCommandV3;
 if(!p.commandOrder||typeof p.commandOrder!=='object')p.commandOrder={};if(!Array.isArray(p.commandHidden))p.commandHidden=[];return p};
const count=()=>{
 const j=job(),ps=photos().filter(p=>!p.jobId||p.jobId===j?.id),shots=j?.shots||[],complete=shots.filter(x=>x.status==='complete');
 return {pending:shots.filter(x=>x.status!=='complete').length,gps:shots.filter(x=>x.status!=='complete'&&!valid(x)&&!valid(x.asbuiltStart)).length,
 after:complete.filter(x=>!ps.some(p=>p.shotId===x.id&&String(p.stage).toLowerCase()==='after')).length,
 open:(j?.crew||[]).filter(x=>x.start&&!x.end).length,
 unlinked:ps.filter(x=>!x.shotId&&!x.fieldPinId).length,
 issue:(state().equipmentIssuesV2||[]).filter(x=>!x.closedAt).length};
};
const badgeText=id=>{const c=count();return ({command:c.pending&&c.pending+' pending',shotcards:c.pending&&c.pending+' pending',
 jobmap:c.gps&&c.gps+' GPS',crewmanager2:c.open&&c.open+' on shift',
 phototimeline2:c.after&&c.after+' After missing',photosmart:c.after&&c.after+' After missing',
 equipmentmanager2:c.issue&&c.issue+' issues',dayassist:c.after+c.open&&(c.after+c.open)+' to review'})[id]||''};
let edit=false,timer=null,suppressUntil=0,drag=null;
function items(group){
 const panel=document.getElementById('ux-command-panel-'+group);
 return panel?[...panel.querySelectorAll('.ux-command-card')].map(node=>({id:node.dataset.page||'lock',node})):[];
}
function order(group){
 const ids=items(group).map(x=>x.id),previous=preferences().commandOrder[group]||[];
 return previous.filter(id=>ids.includes(id)).concat(ids.filter(id=>!previous.includes(id)));
}
function changeOrder(group,id,offset){
 const ordered=order(group),at=ordered.indexOf(id),target=at+offset;
 if(at<0||target<0||target>=ordered.length)return;
 [ordered[at],ordered[target]]=[ordered[target],ordered[at]];
 preferences().commandOrder[group]=ordered;api()?.save?.();api()?.render?.();
}
function reorderTo(group,id,before){
 if(id===before)return;const values=order(group).filter(x=>x!==id),at=values.indexOf(before);
 if(at<0)return;values.splice(at,0,id);preferences().commandOrder[group]=values;api()?.save?.();api()?.render?.();
}
function toggleHidden(id){
 const hidden=new Set(preferences().commandHidden);hidden.has(id)?hidden.delete(id):hidden.add(id);
 preferences().commandHidden=[...hidden];api()?.save?.();api()?.render?.();
}
function enhanceTools(){
 const deck=document.querySelector('.ux-command-deck');if(!deck)return;
 const heading=deck.querySelector('.ux-command-heading');
 if(heading&&!heading.querySelector('[data-fc-customize]'))heading.insertAdjacentHTML('beforeend','<button type="button" class="fc-customize" data-fc-customize aria-pressed="'+edit+'">'+(edit?'✓ Done':'⚙ Customize')+'</button>');
 const c=count(),pulse=document.createElement('div');pulse.className='fc-command-pulse';pulse.innerHTML=
 '<span><b>'+c.pending+'</b> pending bores</span><span><b>'+c.gps+'</b> GPS checks</span><span><b>'+c.after+'</b> missing After photos</span>';
 deck.querySelector('.ux-command-tabs')?.insertAdjacentElement('beforebegin',pulse);
 for(const group of ['today','maps','team']){
  const panel=document.getElementById('ux-command-panel-'+group),grid=panel?.querySelector('.ux-command-grid');if(!grid)continue;
  const found=items(group),byId=new Map(found.map(x=>[x.id,x.node])),hidden=new Set(preferences().commandHidden);
  for(const id of order(group)){
   const card=byId.get(id);if(!card)continue;grid.appendChild(card);
   const isHidden=hidden.has(id);
   card.hidden=isHidden&&!edit;card.classList.toggle('fc-is-hidden',isHidden);card.draggable=edit;
   if(badgeText(id))card.insertAdjacentHTML('beforeend','<span class="fc-live-badge">'+esc(badgeText(id))+'</span>');
   if(edit)card.insertAdjacentHTML('beforeend','<span class="fc-card-controls"><span data-fc-step="-1">↑</span><span data-fc-step="1">↓</span><span data-fc-hide>'+(isHidden?'Show':'Hide')+'</span></span>');
  }
  const tab=document.getElementById('ux-command-tab-'+group);if(tab){
   const chip=document.createElement('span');chip.className='fc-tab-counter';chip.textContent=String(order(group).filter(id=>!hidden.has(id)).length);tab.appendChild(chip);
  }
 }
 const power=document.createElement('section');power.className='fc-power-tools';
 power.innerHTML='<h3>Field shortcuts</h3><p>Everything you need to manage this workday.</p><div class="fc-power-grid">'+
 [['dispatch3','♙','Dispatch Crew','Assign everyone'],['readiness3','☑','Bore Readiness','Review each shot'],['evidence3','▣','Evidence Review','What needs attention'],['find3','⌕','Find Anything','Search all jobs'],['savestatus3','◉','Save & Backup','Check local storage']]
 .map(x=>'<button data-page="'+x[0]+'">'+x[1]+'<strong>'+x[2]+'</strong><small>'+x[3]+'</small></button>').join('')+'</div>';
 deck.appendChild(power);
}
function fabActions(page){
 if(['crewmanager2','dispatch3'].includes(page))return[
  {id:'fc-dispatch',icon:'♙',title:'Dispatch Crew',sub:'Assign the team to a job'},
  {id:'note',icon:'✎',title:'Quick Note',sub:'Log an observation'}];
 if(['command','shotcards','job','readiness3'].includes(page))return[
  {id:'fc-current',icon:'◎',title:'Open Current Bore',sub:'Footage and notes'},
  {id:'fc-readiness',icon:'☑',title:'Readiness Review',sub:'Check before drilling'},
  {id:'photo',icon:'▣',title:'Quick Photo',sub:'Capture evidence'}];
 if(page==='jobmap')return[
  {id:'fc-box',icon:'▣',title:'Add Box / Handhole',sub:'Save installation GPS'},
  {id:'fc-coupling',icon:'◈',title:'Add Coupling',sub:'Save fitting GPS'},
  {id:'fc-tie',icon:'⌖',title:'Add Tie-In',sub:'Save tie-in GPS'}];
 if(['photosmart','photos','phototimeline2'].includes(page))return[
  {id:'photo',icon:'▣',title:'Quick Photo & Pin',sub:'Capture job media'},
  {id:'note',icon:'✎',title:'Quick Note',sub:'Record a field note'}];
 return null;
}
function handleFabAction(id){
 if(id==='fc-dispatch'){api()?.setPage?.('dispatch3');return true}
 if(id==='fc-readiness'){api()?.setPage?.('readiness3');return true}
 if(id==='fc-current'){const sh=(job()?.shots||[]).find(x=>x.status==='progress')||(job()?.shots||[]).find(x=>x.status!=='complete');if(sh)api()?.shotDetail?.(sh.id);else api()?.newBore?.();return true}
 if(['fc-box','fc-coupling','fc-tie'].includes(id)){window.BoreLabFieldPins?.editPin?.('',id==='fc-box'?'box':id==='fc-coupling'?'coupling':'tie-in');return true}
 return false;
}
document.addEventListener('click',e=>{
 const customize=e.target.closest?.('[data-fc-customize]'),control=e.target.closest?.('[data-fc-step],[data-fc-hide]');
 const card=e.target.closest?.('.ux-command-card');
 if(!customize&&!control&&!(edit&&card)&&!(card&&Date.now()<suppressUntil))return;
 e.preventDefault();e.stopImmediatePropagation?.();
 if(customize){edit=!edit;api()?.render?.();return}
 if(control){
  const parent=control.closest('.ux-command-card'),group=control.closest('.ux-command-panel')?.id?.replace('ux-command-panel-',''),id=parent?.dataset.page||'lock';
  if(!group)return;
  if(control.hasAttribute('data-fc-hide'))toggleHidden(id);else changeOrder(group,id,Number(control.dataset.fcStep)||0);
 }
},{capture:true});
document.addEventListener('pointerdown',e=>{
 const card=e.target.closest?.('.ux-command-card');if(!card||edit)return;
 clearTimeout(timer);timer=setTimeout(()=>{edit=true;suppressUntil=Date.now()+1000;api()?.render?.();api()?.notify?.('Edit mode: use arrows to move cards, or hide unused tools.');},600);
});
['pointerup','pointercancel','pointermove'].forEach(type=>document.addEventListener(type,e=>{if(type!=='pointermove'||Math.abs(e.movementX||0)+Math.abs(e.movementY||0)>12)clearTimeout(timer)}));
document.addEventListener('dragstart',e=>{const card=e.target.closest?.('.ux-command-card');if(edit&&card)drag={id:card.dataset.page||'lock',group:card.closest('.ux-command-panel')?.id?.replace('ux-command-panel-','')}});
document.addEventListener('dragover',e=>{if(drag&&e.target.closest?.('.ux-command-card'))e.preventDefault()});
document.addEventListener('drop',e=>{
 const card=e.target.closest?.('.ux-command-card'),group=card?.closest('.ux-command-panel')?.id?.replace('ux-command-panel-','');
 if(drag&&card&&drag.group===group){e.preventDefault();reorderTo(group,drag.id,card.dataset.page||'lock')}drag=null;
});
window.BoreLabFieldCommand3={api,state,job,jobs,photos,esc,valid,num,date,dayOf,canEdit,preferences,count,enhance:page=>{if(page==='tools')enhanceTools()},fabActions,handleFabAction};
})();