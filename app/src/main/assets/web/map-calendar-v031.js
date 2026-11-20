/* BoreLab Field v0.31 — one integrated map calendar, offline only.
   Date selection filters existing pins and exports only the chosen recorded day. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge,ab=()=>window.BoreLabAsBuilt,map=()=>window.BoreLabJobMap;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const validDay=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))&&Number.isFinite(+new Date(x+'T12:00:00'));
const nice=x=>new Date(x+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
let month='',expanded=true,lastDate='';
function events(){
 const state=api()?.state?.()||{};
 return (ab()?.allEvents?.()||[]).filter(e=>e.jobId===state.activeJobId&&validDay(e.day));
}
function render(date=''){
 const today=api()?.todayLocal?.()||ab()?.dayOf?.(new Date())||'';
 if(date!==lastDate){
  if(validDay(date))month=date.slice(0,7);
  lastDate=date;
 }
 if(!/^\d{4}-\d{2}$/.test(month))month=(validDay(date)?date:today).slice(0,7);
 if(!/^\d{4}-\d{2}$/.test(month))month='2026-01';
 const [y,m]=month.split('-').map(Number),first=new Date(y,m-1,1);
 const title=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});
 const all=events(),counts=new Map();for(const e of all)counts.set(e.day,(counts.get(e.day)||0)+1);
 let grid='';
 if(expanded){
  const cells=Array.from({length:first.getDay()},()=>'<span aria-hidden="true"></span>');
  for(let d=1;d<=new Date(y,m,0).getDate();d++){
   const key=month+'-'+pad(d),count=counts.get(key)||0;
   cells.push('<button type="button" data-blcal-day="'+key+'" class="blcal-date'+(date===key?' selected':'')+(today===key?' today':'')+'" aria-pressed="'+(date===key)+'" aria-label="'+esc(nice(key))+', '+count+' saved activities"><b>'+d+'</b>'+(count?'<small>'+count+'</small>':'')+'</button>');
  }
  grid='<div class="blcal-month"><button type="button" data-blcal-month="-1" aria-label="Previous month">‹</button><strong>'+esc(title)+'</strong><button type="button" data-blcal-month="1" aria-label="Next month">›</button></div>'+
  '<div class="blcal-days">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>'<span>'+d+'</span>').join('')+cells.join('')+'</div>';
 }
 const dayEvents=date?all.filter(e=>e.day===date):[];
 const unique=(type)=>new Set(dayEvents.filter(e=>e.type===type).map(e=>e.record?.id||e.title)).size;
 const selected=date?
  '<div class="blcal-selected"><div><strong>'+esc(nice(date))+'</strong><small>'+dayEvents.length+' activit'+(dayEvents.length===1?'y':'ies')+' · '+unique('shot')+' bores · '+unique('pin')+' installations · '+unique('photo')+' photos</small></div>'+
  '<button type="button" data-blcal-clear>All dates</button></div>'+
  '<div class="blcal-actions"><button type="button" data-blcal-pdf '+(!dayEvents.length?'disabled':'')+'>▤ Export This Day PDF</button>'+
  '<button type="button" data-blcal-details>Day details &amp; replay ›</button></div>':
  '<p class="blcal-help">Choose a date to filter saved work and export that day to PDF.</p>';
 return '<section class="blcal-panel" aria-label="Field Calendar">'+
  '<button type="button" class="blcal-heading" data-blcal-toggle aria-expanded="'+expanded+'" aria-controls="blcalGrid">'+
  '<span class="blcal-icon">▦</span><span><strong>Field Calendar</strong><small>'+(date?esc(nice(date)):'All recorded dates')+'</small></span><b aria-hidden="true">'+(expanded?'⌃':'⌄')+'</b></button>'+
  '<div id="blcalGrid"'+(expanded?'':' hidden')+'>'+grid+'</div>'+selected+'</section>';
}
function select(date){
 if(!validDay(date))return;
 lastDate=date;month=date.slice(0,7);expanded=false;
 map()?.setDay?.(date);map()?.setSelected?.(null);
 ab()?.setScope?.('job');ab()?.setDay?.(date);ab()?.setView?.('calendar');
 api()?.render?.();
}
document.addEventListener('click',e=>{
 const button=e.target.closest?.('[data-blcal-day],[data-blcal-month],[data-blcal-toggle],[data-blcal-clear],[data-blcal-pdf],[data-blcal-details]');
 if(!button||api()?.currentPage?.()!=='jobmap')return;
 e.preventDefault();
 if(button.dataset.blcalDay){select(button.dataset.blcalDay);return}
 if(button.hasAttribute('data-blcal-toggle')){expanded=!expanded;api()?.render?.();return}
 if(button.dataset.blcalMonth){
  const [y,m]=month.split('-').map(Number),dt=new Date(y,m-1+Number(button.dataset.blcalMonth),1);
  month=dt.getFullYear()+'-'+pad(dt.getMonth()+1);api()?.render?.();return;
 }
 if(button.hasAttribute('data-blcal-clear')){map()?.setDay?.('');map()?.setSelected?.(null);expanded=true;lastDate='';api()?.render?.();return}
 const day=map()?.getDay?.()||'';
 if(!validDay(day))return;
 if(button.hasAttribute('data-blcal-pdf')){
  if(events().some(e=>e.day===day))ab()?.exportAsBuilt?.(day);
  return;
 }
 if(button.hasAttribute('data-blcal-details')){
  ab()?.setScope?.('job');ab()?.setDay?.(day);ab()?.setView?.('calendar');api()?.setPage?.('fieldhistory');
 }
});
window.BoreLabMapCalendarV31={render,select,events,getMonth:()=>month,isExpanded:()=>expanded};
})();