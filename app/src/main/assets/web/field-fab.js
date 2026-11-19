/* BoreLab Field — Floating Quick Actions (v0.20)
   Lightweight interface only; all new field content is saved using existing offline job storage. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const api=()=>window.BoreLabAssistantBridge;
const account=()=>window.BoreLabLocalAccounts;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const actions=[
 {id:'bore',icon:'⌁',title:'New Bore',sub:'Plan the next shot'},
 {id:'photo',icon:'▣',title:'Quick Photo & Pin',sub:'Camera or installation photo'},
 {id:'gps',icon:'⌖',title:'GPS Pin',sub:'Save a field installation'},
 {id:'note',icon:'✎',title:'Quick Note',sub:'Record a jobsite observation'}
];
let opened=false,lastFocus=null;
const allowed=()=>{
 const a=account();
 return !!api()&&(!a||a.isUnlocked?.())&&(!a||['owner','foreman'].includes(a.role?.()));
};
function mount(){
 if($('#bfFabRoot'))return;
 const wrap=document.createElement('div');
 wrap.id='bfFabRoot';wrap.className='bf-fab-root';wrap.hidden=true;
 wrap.innerHTML='<div class="bf-fab-actions" id="bfFabActions" role="group" aria-label="Quick field actions" hidden>'+
 '<div class="bf-fab-heading"><span>QUICK ACTIONS</span><small>Current job</small></div>'+
 actions.map(a=>'<button type="button" class="bf-fab-action" data-bf-fab-action="'+a.id+'"><span class="bf-fab-icon" aria-hidden="true">'+a.icon+'</span><span><strong>'+a.title+'</strong><small>'+a.sub+'</small></span><span aria-hidden="true">›</span></button>').join('')+
 '</div><button type="button" class="bf-fab-trigger" id="bfFabTrigger" data-bf-fab-toggle aria-label="Open quick actions" aria-expanded="false" aria-controls="bfFabActions"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg></button>';
 document.body.appendChild(wrap);sync();
}
function sync(){
 const wrap=$('#bfFabRoot');
 if(!wrap)return;
 const page=api()?.currentPage?.()||'home';
 const excluded=['crewpreview','supervisorpreview','localaccounts'];
 const visible=allowed()&&!excluded.includes(page);
 wrap.hidden=!visible;
 document.documentElement.dataset.bfFab=visible?'ready':'hidden';
 if(!visible)close();
}
function show(){
 if(!allowed())return;
 mount();sync();
 if($('#bfFabRoot')?.hidden||$('#modalRoot .modal-backdrop')||window.BoreLabNavigation?.isOpen?.())return;
 if(opened)return close();
 lastFocus=document.activeElement;opened=true;
 const panel=$('#bfFabActions');if(!panel)return;
 panel.hidden=false;$('#bfFabTrigger')?.setAttribute('aria-expanded','true');
 document.documentElement.classList.add('bf-fab-open');
}
function close(){
 if(!opened)return false;
 opened=false;
 const panel=$('#bfFabActions');if(panel)panel.hidden=true;
 $('#bfFabTrigger')?.setAttribute('aria-expanded','false');
 document.documentElement.classList.remove('bf-fab-open');
 return true;
}
function openNote(){
 const b=api();if(!b?.activeJob?.())return b?.notify?.('Choose a job before saving a note.');
 b.showModal?.('<div class="modal-head"><h2>✎ Quick Field Note</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>'+
 '<p class="smalltext muted">Save a dated note to the current job. You can find it in Field Atlas & Calendar later.</p>'+
 '<form data-bf-note-form><label class="field spaced">Field note<textarea name="note" maxlength="1500" rows="4" placeholder="Installed a box by the north driveway; need to verify depth tomorrow…" required autofocus></textarea></label>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">Save Field Note</button></div></form>');
}
function handleAction(id){
 if(!allowed())return;
 close();
 if(id==='bore'){return api()?.newBore?.()}
 if(id==='photo'){const n=window.BoreLabNavigation;n?.open?.();if(n?.isOpen?.())n.toggleQuick?.();return}
 if(id==='gps'){return window.BoreLabFieldPins?.editPin?.('','tie-in')}
 if(id==='note'){return openNote()}
}
function saveNote(form){
 const b=api(),job=b?.activeJob?.();if(!job)return b?.notify?.('Select a job first.');
 const text=String(new FormData(form).get('note')||'').trim().slice(0,1500);
 if(!text)return b?.notify?.('Enter a field note to save.');
 const at=new Date().toISOString();
 const record={id:b.uid(),jobId:job.id,at,text};
 if(!Array.isArray(job.quickNotes))job.quickNotes=[];
 job.quickNotes.push(record);b.state().demo=false;
 b.save();b.closeModal?.();b.render?.();b.notify?.('Quick note saved to '+(job.jobName||'this job')+'.');
}
document.addEventListener('click',e=>{
 const trigger=e.target.closest?.('[data-bf-fab-toggle]');
 if(trigger){e.preventDefault();show();return}
 const action=e.target.closest?.('[data-bf-fab-action]');
 if(action){e.preventDefault();handleAction(action.dataset.bfFabAction);return}
 if(opened&&!e.target.closest?.('#bfFabRoot'))close();
});
document.addEventListener('submit',e=>{
 const form=e.target.closest?.('[data-bf-note-form]');
 if(!form)return;
 e.preventDefault();saveNote(form);
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&opened){e.preventDefault();e.stopImmediatePropagation?.();close()}
},{capture:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
window.BoreLabFab={mount,sync,open:show,close,isOpen:()=>opened,handleAction,openNote,saveNote,actions};
})();