/* BoreLab v0.23 — keep the existing drill artwork and reveal a small sticky job header after scroll. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Math.max(0,Number(x)||0).toLocaleString(undefined,{maximumFractionDigits:1});
let lastJob='',lastShot='',lastPipe='',shown=false;
function mount(){
 if($('#bpStickyJob'))return;
 const el=document.createElement('div');
 el.id='bpStickyJob';el.className='bp-sticky-job';el.hidden=true;el.setAttribute('aria-label','Compact active job header');
 document.body.appendChild(el);
}
function visible(){
 const a=window.BoreLabLocalAccounts;
 return api()?.currentPage?.()==='home'&&(!a||a.isUnlocked?.())&&(!a||['owner','foreman'].includes(a.role?.()))&&
 !window.BoreLabNavigation?.isOpen?.()&&!window.BoreLabEdgeV22?.isPeekOpen?.();
}
function update(){
 mount();
 const mini=$('#bpStickyJob'),hero=$('#main .bh-hero'),header=$('.topbar');
 if(!mini)return;
 if(!visible()||!hero||!header){mini.hidden=true;shown=false;return}
 const top=Math.max(0,header.getBoundingClientRect().bottom);
 if(hero.getBoundingClientRect().bottom>top+8){mini.hidden=true;shown=false;return}
 const job=api()?.activeJob?.(),pending=job?.shots||api()?.state?.()?.shots||[];
 const shot=pending.find(x=>x.status==='progress')||pending.find(x=>x.status!=='complete');
 const pipe=api()?.pipeOnTruck?.(),name=job?.jobName||api()?.state?.()?.jobName||'Current Job';
 const line=shot?.name||'No pending bore',balance=Number.isFinite(Number(pipe))?fmt(pipe)+' ft pipe':'Pipe unrecorded';
 if(!shown||lastJob!==name||lastShot!==line||lastPipe!==balance){
  mini.innerHTML='<button type="button" data-bp-expand-home aria-label="Scroll back to full Home artwork">'+
   '<img src="./home-hero-hdd.webp" alt="" aria-hidden="true">'+
   '<span><strong>'+esc(name)+'</strong><small>'+esc(line)+' <b>·</b> '+esc(balance)+'</small></span><span class="bp-sticky-chevron">⌃</span></button>';
  lastJob=name;lastShot=line;lastPipe=balance;
 }
 const rect=$('#main')?.getBoundingClientRect();
 if(rect){mini.style.left=Math.max(0,rect.left)+'px';mini.style.width=Math.min(window.innerWidth,rect.width)+'px'}
 mini.style.top=top+'px';mini.hidden=false;shown=true;
}
function sync(){if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(update);else update()}
document.addEventListener('click',e=>{
 if(!e.target.closest?.('[data-bp-expand-home]'))return;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 window.scrollTo({top:0,behavior:reduced?'instant':'smooth'});
});
window.addEventListener('scroll',update,{passive:true});
window.addEventListener('resize',sync,{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
window.BoreLabHomeCollapse={mount,update,sync,isVisible:()=>shown};
})();