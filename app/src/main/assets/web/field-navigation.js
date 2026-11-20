/* BoreLab Field — unified white/orange, right-hand drawer navigation.
   This module only controls the navigation shell. It does not modify field data. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const bridge=()=>window.BoreLabAssistantBridge;
const auth=()=>window.BoreLabLocalAccounts;
let open=false,quick=false,lastFocus=null,gesture=null;
const shortcuts=[
 {page:'home',icon:'⌂',name:'Home',detail:'Dashboard'},
 {page:'fieldhistory',icon:'▦',name:'Atlas & Calendar',detail:'Places and work history'},
 {page:'jobmap',icon:'⌖',name:'Job Map',detail:'GPS pins and bores'},
 {page:'fieldhub',icon:'⚡',name:'Field Hub',detail:'Arrival, Markers, Inbox & Day Story'},
 {page:'fieldproductivity',icon:'◈',name:'Field Productivity',detail:'Materials, Next Move & Photos'},
 {page:'reelcommand',icon:'◉',name:'Reel Command',detail:'Burn-down and return planning'},
 {page:'crossings',icon:'⚠',name:'Utility Crossings',detail:'Measured crossing records'},
 {page:'planner',icon:'⌁',name:'Bores',detail:'Shot planner'},
 {page:'shotboard',icon:'☷',name:'Today’s Shot Board',detail:'Daily work'},
 {page:'photos',icon:'▣',name:'Photos',detail:'Jobsite evidence'},
 {page:'crew',icon:'♙',name:'Crew',detail:'Hours and attendance'},
 {page:'pipe',icon:'◈',name:'Pipe Inventory',detail:'Reels and material'},
 {page:'closeout',icon:'✓',name:'Reports & Closeout',detail:'Review and export'},
 {page:'search',icon:'⌕',name:'Search',detail:'Find field records'},
 {page:'tools',icon:'▤',name:'All Field Tools',detail:'Browse every tool'},
 {page:'settings',icon:'⚙',name:'Settings',detail:'Preferences'}
];
const icons={camera:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h-4l-2 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4z"/><circle cx="12" cy="14" r="4"/></svg>',
pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>'};
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function enabled(){
 const a=auth(),role=a?.role?.();
 return !!bridge()&&(!a||a.isUnlocked?.())&&(!a||role==='owner'||role==='foreman');
}
function item(v){
 return '<button type="button" class="bf-drawer-link" data-page="'+v.page+'" data-bf-route="'+v.page+'"><span class="bf-drawer-icon" aria-hidden="true">'+v.icon+'</span>'+
 '<span class="bf-drawer-title"><strong>'+v.name+'</strong><small>'+v.detail+'</small></span><span class="bf-drawer-chevron" aria-hidden="true">›</span></button>';
}
function mount(){
 if($('#bfRightDrawer'))return;
 const html='<div class="bf-drawer-backdrop" id="bfDrawerBackdrop" data-bf-close hidden></div>'+
 '<aside id="bfRightDrawer" class="bf-right-drawer" role="dialog" aria-modal="true" aria-label="BoreLab quick navigation" aria-hidden="true" inert>'+
 '<div class="bf-drawer-head"><div class="bf-drawer-kicker">BORELAB FIELD</div><div class="bf-drawer-headline"><div><strong>Field Menu</strong><small>Go where the work is</small></div>'+
 '<button type="button" class="bf-drawer-close" data-bf-close aria-label="Close navigation menu">✕</button></div></div>'+
 '<button class="bf-drawer-job" data-page="jobs" aria-label="Manage and switch jobs"><span class="bf-job-pin">⌖</span><span><small>ACTIVE JOB</small><strong id="bfDrawerJob">Current job</strong></span><span>›</span></button>'+
 '<div class="bf-drawer-scroller"><div class="bf-drawer-section-title"><span>SHORTCUTS</span><small>Tap to open</small></div>'+
 '<div class="bf-drawer-links">'+shortcuts.map(item).join('')+'</div>'+
 '<div class="bf-drawer-bottom-spacer" aria-hidden="true"></div></div>'+
 '<div class="bf-drawer-quick"><button type="button" class="bf-quick-main" data-bf-menu-action="quick" aria-expanded="false" aria-controls="bfQuickChoices">'+icons.camera+
 '<span>Quick Photo & Pin</span><span class="bf-quick-arrow">⌄</span></button>'+
 '<div id="bfQuickChoices" class="bf-quick-choices" hidden>'+
 '<button type="button" data-bf-menu-action="camera">'+icons.camera+' <span><strong>Take jobsite photo</strong><small>Attach to a bore or save as general</small></span></button>'+
 '<button type="button" data-bf-menu-action="coupling">'+icons.pin+' <span><strong>New coupling pin</strong><small>Record details, then capture a linked photo</small></span></button>'+
 '<button type="button" data-bf-menu-action="box">'+icons.pin+' <span><strong>New box pin</strong><small>Save installation position and measurements</small></span></button>'+
 '<button type="button" data-bf-menu-action="tie-in">'+icons.pin+' <span><strong>New tie-in pin</strong><small>Save and photograph the connection</small></span></button>'+
 '<button type="button" data-page="jobmap">'+icons.pin+' <span><strong>Photo for existing pin</strong><small>Choose a saved pin from the job map</small></span></button>'+
 '</div></div></aside>';
 document.body.insertAdjacentHTML('beforeend',html);
 document.querySelectorAll('[data-bf-drawer]').forEach(el=>{
  el.setAttribute('aria-controls','bfRightDrawer');
  el.setAttribute('aria-expanded','false');
 });
 syncPage(bridge()?.currentPage?.()||'home');
}
function setExpanded(value){
 document.querySelectorAll('[data-bf-drawer]').forEach(el=>el.setAttribute('aria-expanded',String(!!value)));
}
function syncPage(page){
 document.documentElement.dataset.bfPage=page||'home';
 document.documentElement.dataset.bfNav=enabled()?'ready':'disabled';
 const job=$('#bfDrawerJob');
 if(job)job.textContent=bridge()?.state?.()?.jobName||'Choose a job';
 const links=document.querySelectorAll('.bf-drawer-link');
 links.forEach(el=>{
  const active=el.dataset.bfRoute===page;
  el.classList.toggle('active',active);
  if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');
 });
 if(!enabled())close();
 window.BoreLabEdgeV22?.sync?.();
}
function show(){
 mount();
 if(!enabled())return;
 if($('#modalRoot .modal-backdrop'))return;
 window.BoreLabEdgeV22?.closePeek?.();
 if(open){close();return}
 lastFocus=document.activeElement;open=true;quick=false;
 const panel=$('#bfRightDrawer'),back=$('#bfDrawerBackdrop');
 if(!panel||!back)return;
 back.hidden=false;panel.inert=false;panel.setAttribute('aria-hidden','false');
 $('#bfQuickChoices').hidden=true;
 $('[data-bf-menu-action="quick"]')?.setAttribute('aria-expanded','false');
 document.documentElement.classList.add('bf-drawer-open');
 document.body.style.overflow='hidden';setExpanded(true);
 syncPage(bridge()?.currentPage?.()||'home');
 requestAnimationFrame(()=>panel.querySelector('[data-bf-close]')?.focus({preventScroll:true}));
}
function close(){
 if(!open)return;
 open=false;quick=false;
 document.documentElement.classList.remove('bf-drawer-open');
 const panel=$('#bfRightDrawer'),back=$('#bfDrawerBackdrop');
 if(panel){panel.inert=true;panel.setAttribute('aria-hidden','true')}
 if(back)back.hidden=true;
 const choices=$('#bfQuickChoices');if(choices)choices.hidden=true;
 document.body.style.overflow=$('#modalRoot .modal-backdrop')?'hidden':'';
 setExpanded(false);
 if(lastFocus?.isConnected)lastFocus.focus?.({preventScroll:true});
}
function toggleQuick(){
 const box=$('#bfQuickChoices');if(!box)return;
 quick=!quick;box.hidden=!quick;
 $('[data-bf-menu-action="quick"]')?.setAttribute('aria-expanded',String(quick));
 if(quick)requestAnimationFrame(()=>box.scrollIntoView({block:'nearest',behavior:'smooth'}));
}
function act(kind){
 if(kind==='quick'){if(!enabled())return;if(!open)show();if(open)toggleQuick();return}
 if(!enabled())return;
 close();
 if(kind==='camera')return bridge()?.photoChoose?.('camera');
 if(['coupling','box','tie-in'].includes(kind))return window.BoreLabFieldPins?.editPin?.('',kind);
}
document.addEventListener('click',e=>{
 const toggler=e.target.closest?.('[data-bf-drawer]');
 if(toggler){e.preventDefault();if(toggler.classList?.contains('bf-edge-tab')&&window.BoreLabEdgeV22?.handleTabClick?.(e))return;show();return}
 if(e.target.closest?.('[data-bf-close]')){e.preventDefault();close();return}
 const action=e.target.closest?.('[data-bf-menu-action]');
 if(action){e.preventDefault();act(action.dataset.bfMenuAction);return}
});
document.addEventListener('keydown',e=>{
 if(!open)return;
 if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation?.();close();return}
 if(e.key!=='Tab')return;
 const focusable=[...($('#bfRightDrawer')?.querySelectorAll('button:not([disabled]):not([hidden])')||[])].filter(el=>el.getClientRects().length);
 if(!focusable.length)return;
 if(e.shiftKey&&document.activeElement===focusable[0]){e.preventDefault();focusable[focusable.length-1].focus()}
 else if(!e.shiftKey&&document.activeElement===focusable[focusable.length-1]){e.preventDefault();focusable[0].focus()}
},{capture:true});
document.addEventListener('pointerdown',e=>{
 if(open||!enabled()||e.pointerType!=='touch'||e.clientX<window.innerWidth-24||$('#modalRoot .modal-backdrop'))return;
 // Edge pull is only a navigation gesture when starting clear of controls.
 if(e.target.closest?.('button,input,select,textarea,[role="button"],.atlas-frame,.map-card,.route-map'))return;
 gesture={x:e.clientX,y:e.clientY,id:e.pointerId};
},{passive:true});
document.addEventListener('pointerup',e=>{
 if(!gesture||e.pointerId!==gesture.id)return;
 const g=gesture;gesture=null;
 if(g.x-e.clientX>65&&Math.abs(g.y-e.clientY)<55)show();
},{passive:true});
document.addEventListener('pointercancel',()=>{gesture=null},{passive:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
window.BoreLabNavigation={open:show,close,isOpen:()=>open,syncPage,toggleQuick,shortcuts};
})();