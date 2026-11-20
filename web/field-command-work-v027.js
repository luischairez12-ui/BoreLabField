/* Field Command 3.0 — daily crew dispatch, bore review and evidence review */
(function(){
'use strict';
const core=()=>window.BoreLabFieldCommand3,api=()=>core()?.api?.(),state=()=>core()?.state?.()||{},job=()=>core()?.job?.();
const esc=x=>core()?.esc?.(x)||'',valid=x=>core()?.valid?.(x),num=x=>core()?.num?.(x)||0;
const date=()=>core()?.date?.(),dayOf=x=>core()?.dayOf?.(x),canEdit=()=>core()?.canEdit?.();
const notify=s=>api()?.notify?.(s),save=()=>api()?.save?.(),render=()=>api()?.render?.();
const roles=['Foreman','Driller','Locator','Mini Excavator Operator','Operator','Gas Technician','Laborer','Driver','Supervisor','Other'];
const heading=(title,kicker,sub)=>'<header class="fc-page-head"><span class="eyebrow">'+esc(kicker)+'</span><h1>'+esc(title)+'</h1><p>'+esc(sub)+'</p></header>';
const jobline=()=>'<div class="fc-jobline"><span>ACTIVE JOB</span><strong>'+esc(job()?.jobName||'Select a saved job')+'</strong><button data-page="jobs">Switch ›</button></div>';
const panel=(contents)=>'<section class="fc-panel">'+contents+'</section>';
const badge=(kind,text)=>'<span class="fc-status '+kind+'">'+esc(text)+'</span>';
const field=(label,input)=>'<label class="fc-field">'+esc(label)+input+'</label>';
let dispatchDate=date(),scope='today';
const allCrew=()=>Array.isArray(state().roster)?state().roster:[];
const assns=()=>Array.isArray(state().crewAssignmentsV2)?state().crewAssignmentsV2:[];
const equipment=()=>Array.isArray(state().equipment)?state().equipment.filter(x=>!x.archived):[];
function memberRow(p){
 const old=assns().find(a=>a.personId===p.id&&a.date===dispatchDate);
 const selected=Array.isArray(state().selectedCrewIds)?state().selectedCrewIds.includes(p.id):false;
 const role=old?.role||p.primaryRole||'';
 return '<div class="fc-dispatch-member"><div class="fc-dispatch-name"><label><input type="checkbox" data-fc-member="'+esc(p.id)+'" '+(selected?'checked':'')+'><span><strong>'+esc(p.name)+'</strong><small>Regular role: '+esc(p.primaryRole||'Not assigned')+'</small></span></label></div>'+
 '<div class="fc-dispatch-fields"><label>Today’s job role<select data-fc-role="'+esc(p.id)+'"><option value="">Choose role</option>'+roles.map(r=>'<option value="'+esc(r)+'"'+(role===r?' selected':'')+'>'+esc(r)+'</option>').join('')+'</select></label>'+
 '<label>Equipment (optional)<select data-fc-equip="'+esc(p.id)+'"><option value="">Not specified</option>'+
 equipment().map(e=>'<option value="'+esc(e.id)+'"'+(e.id===old?.equipmentId?' selected':'')+'>'+esc(e.name)+'</option>').join('')+'</select></label></div>'+
 field('Instructions (optional)','<input data-fc-note="'+esc(p.id)+'" maxlength="160" placeholder="Locate shots 1–3, operate mini…" value="'+esc(old?.notes||'')+'">')+
 (old?'<p class="fc-muted">Currently assigned for '+esc(dispatchDate)+': '+esc((state().jobs||[]).find(j=>j.id===old.jobId)?.jobName||'Unknown job')+'</p>':'')+'</div>';
}
function renderDispatch(){
 const people=allCrew();
 return '<div class="page fc-page">'+heading('One-Tap Crew Dispatch','FIELD / CREW','Assign multiple people, regular roles and equipment to the current job in one save.')+
 jobline()+'<p class="fc-caution">Dispatch is a planning record only. It will not clock people in, change completed hours, or certify their qualifications.</p>'+
 '<form data-fc-dispatch>'+panel('<div class="fc-between"><h2>Choose Your Crew</h2><button type="button" data-fc-select-all>Select All</button></div>'+
 field('Work date','<input type="date" data-fc-dispatch-date name="date" required value="'+esc(dispatchDate)+'">')+
 (people.length?people.map(memberRow).join(''):'<p class="fc-empty">No saved crew. Add workers in Crew Management first.</p>')+
 '<div class="fc-actions"><button class="fc-primary" type="submit" '+(!people.length||!job()||!canEdit()?'disabled':'')+'>✓ Save Selected Crew</button><button type="button" data-page="crewmanager2">Manage Roles</button></div>')+
 '</form></div>';
}
function submitDispatch(form){
 if(!canEdit())return notify('Foreman/owner access required.');
 const j=job(),d=form.querySelector('[name="date"]')?.value;
 if(!j||!/^\d{4}-\d{2}-\d{2}$/.test(d))return notify('Choose a valid job and work date.');
 const checked=[...form.querySelectorAll('[data-fc-member]:checked')];
 if(!checked.length)return notify('Select one or more workers first.');
 const rows=[];
 for(const box of checked){
  const id=box.dataset.fcMember,p=allCrew().find(x=>x.id===id);
  const scope=box.closest('.fc-dispatch-member');
  if(!p||!scope)return notify('Crew information changed; reopen dispatch.');
  const role=scope.querySelector('[data-fc-role]')?.value||'',gear=scope.querySelector('[data-fc-equip]')?.value||'';
  const notes=String(scope.querySelector('[data-fc-note]')?.value||'').trim().slice(0,160);
  if(!roles.includes(role))return notify('Choose a role for '+p.name+' before dispatch.');
  if(gear&&!equipment().some(e=>e.id===gear))return notify('Choose valid equipment for '+p.name+'.');
  rows.push({personId:id,jobId:j.id,date:d,role,equipmentId:gear,notes});
 }
 const conflicting=rows.filter(x=>assns().some(a=>a.personId===x.personId&&a.date===d&&a.jobId!==j.id));
 if(conflicting.length&&!window.confirm('Replace '+conflicting.length+' worker assignment(s) to a different job on '+d+'? Time entries will not change.'))return;
 const previous=assns(),selected=new Set(rows.map(x=>x.personId));
 const left=previous.filter(x=>!(selected.has(x.personId)&&x.date===d));
 const saved=rows.map(x=>({...x,id:previous.find(p=>p.personId===x.personId&&p.date===d)?.id||api()?.uid?.()||String(Date.now()),updatedAt:new Date().toISOString()}));
 state().crewAssignmentsV2=[...left,...saved];save();render();
 notify(saved.length+' crew member(s) assigned to '+j.jobName+' for '+d+'. No one was clocked in.');
}
const checks=[
 ['utilitiesReviewed','Utility markings / locate paperwork reviewed'],
 ['plansReviewed','Plan sheets, access and easements reviewed'],
 ['equipmentReviewed','Rig, tooling and work area checked']
];
function readinessRecord(sh){return job()?.fieldReadinessV3?.[sh.id]||{}}
function pipeStatus(sh){
 const j=job(),reels=(state().reels||[]).filter(r=>!r.archived&&r.location==='truck');
 const required=num(sh.feet)+num(sh.allowanceOverride??j?.allowance??state().allowance??10);
 if(!reels.length)return {kind:'warn',label:'No truck reels recorded'};
 const fit=reels.filter(r=>num(r.remaining)>=required);
 if(!fit.length)return {kind:'warn',label:'No listed reel has '+required+' ft continuously'};
 const size=String(sh.pipeDiameter||'').trim().toLowerCase(),match=fit.some(r=>size&&String(r.size||'').trim().toLowerCase()===size);
 return {kind:'review',label:match?'Possible continuous fit: '+required+' ft — verify reservations':'Length candidate: check pipe size and reservations'};
}
function flags(sh){
 const r=readinessRecord(sh);
 return {gps:valid(sh)||valid(sh.asbuiltStart),manual:checks.filter(([k])=>Boolean(r[k])).length,pipe:pipeStatus(sh),review:r};
}
function renderReadiness(){
 const shots=job()?.shots||[];
 return '<div class="page fc-page">'+heading('Bore Readiness','FIELD / PRE-DRILL','Quick review for each shot before the crew mobilizes.')+jobline()+
 '<p class="fc-caution">⚠ Manual review confirmations are records only. They do not replace utility clearance, inspections, required permits, engineering approval, or a site-specific safety assessment.</p>'+
 (shots.length?shots.map(sh=>{
  const x=flags(sh);return panel('<div class="fc-between"><div><h2>'+esc(sh.name||'Bore')+'</h2><small>'+num(sh.feet)+' ft · '+esc(sh.status||'Planned')+'</small></div>'+
 badge(x.manual===3&&x.gps?'review':'warn',x.manual+'/3 checks saved')+'</div>'+
 '<div class="fc-facts">'+badge(x.gps?'ok':'warn',x.gps?'GPS reference recorded':'GPS reference missing')+
 badge(x.pipe.kind,x.pipe.label)+'</div>'+
 '<div class="fc-checklist">'+checks.map(([key,label])=>'<label><input type="checkbox" data-fc-ready="'+esc(sh.id)+'" data-key="'+key+'" '+(x.review[key]?'checked':'')+' '+(!canEdit()?'disabled':'')+'><span>'+label+'</span></label>').join('')+'</div>'+
 '<div class="fc-actions"><button data-fc-open="shot" data-id="'+esc(sh.id)+'">Open Bore</button><button data-page="reelplan">Review Reels</button><button data-page="jobmap">Map</button></div>'+
 '<p class="fc-muted">Last checklist edit: '+esc(x.review.updatedAt?new Date(x.review.updatedAt).toLocaleString():'not recorded')+'</p>');
 }).join(''):'<p class="fc-empty">No bores have been added to this job yet.</p>')+'</div>';
}
function setCheck(shotId,key,value){
 if(!canEdit())return notify('Foreman/owner access required.');
 if(!checks.some(([k])=>k===key))return;
 const sh=(job()?.shots||[]).find(s=>s.id===shotId);if(!sh)return;
 const j=job();if(!j.fieldReadinessV3||typeof j.fieldReadinessV3!=='object')j.fieldReadinessV3={};
 j.fieldReadinessV3[sh.id]={...(j.fieldReadinessV3[sh.id]||{}),[key]:Boolean(value),updatedAt:new Date().toISOString()};
 save();render();notify('Manual checklist updated for '+sh.name+'.');
}
function evidenceList(){
 const j=job();if(!j)return[];
 const issues=[],ps=core()?.photos?.().filter(p=>!p.jobId||p.jobId===j.id)||[];
 const include=v=>scope==='job'||dayOf(v)===date();
 const add=(type,title,description,target,id)=>issues.push({type,title,description,target,id:id||''});
 for(const sh of j.shots||[]){
  if(sh.status==='complete'&&include(sh.completedAt||sh.updatedAt)){
   if(!ps.some(p=>p.shotId===sh.id&&String(p.stage).toLowerCase()==='after'))
    add('photo',sh.name+' · After photo missing','Review and attach a real After photo.','shot',sh.id);
   if(!valid(sh.asbuiltStart)||!valid(sh.asbuiltEnd))
    add('gps',sh.name+' · Entry/exit GPS incomplete','Verify both field as-built endpoint markers.','shot',sh.id);
   if(!String(sh.notes||'').trim())add('notes',sh.name+' · No bore notes','Add observations if needed by the customer.','shot',sh.id);
  }
  if(sh.status!=='complete'&&!valid(sh)&&!valid(sh.asbuiltStart))
   add('gps',sh.name+' · Reference GPS missing','Review the planned bore location.','shot',sh.id);
 }
 for(const p of ps)if(include(p.addedAt)&&!p.shotId&&!p.fieldPinId)
  add('photo','Unlinked field photo','Decide whether to attach this photo to a shot or installation.','photo',p.id);
 for(const x of j.crew||[])if(x.start&&!x.end)
  add('crew',(x.name||'Worker')+' · Open time entry','Confirm check-out and lunch before approving payroll.','crew',x.id);
 if((j.shots||[]).some(x=>x.status==='complete'&&include(x.completedAt||x.updatedAt))&&!(j.closeoutStudio?.items||[]).length)
  add('billing','No billing draft line items','Review billable quantities and contract units if invoicing is required.','billing','');
 return issues;
}
function renderEvidence(){
 const issues=evidenceList(),types=['gps','photo','notes','crew','billing'];
 return '<div class="page fc-page">'+heading('Missing Evidence Review','FIELD / CLOSEOUT','A list of records worth checking, based on the selected work period.')+jobline()+
 panel('<div class="fc-between"><h2>Review Period</h2><div class="fc-actions"><button data-fc-scope="today" aria-pressed="'+(scope==='today')+'">Today</button><button data-fc-scope="job" aria-pressed="'+(scope==='job')+'">Whole Job</button></div></div>'+
 '<div class="fc-metrics">'+types.map(type=>'<div><strong>'+issues.filter(x=>x.type===type).length+'</strong><small>'+esc(type)+'</small></div>').join('')+'</div>'+
 (issues.length?issues.map(x=>'<div class="fc-issue"><div><strong>'+esc(x.title)+'</strong><p>'+esc(x.description)+'</p></div><button data-fc-issue="'+esc(x.target)+'" data-id="'+esc(x.id)+'">Review ›</button></div>').join(''):
 '<p class="fc-good">No obvious missing evidence found in this period. Check the customer’s requirements and actual field conditions separately.</p>')+
 '<div class="fc-actions"><button data-page="dayassist">End-of-Day Assistant</button><button data-page="studio">As-Built Studio</button></div>')+
 '<p class="fc-muted">Nothing is automatically approved, clocked out, marked complete or billed.</p></div>';
}
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.matches?.('[data-fc-ready]'))return setCheck(t.dataset.fcReady,t.dataset.key,t.checked);
 if(t.matches?.('[data-fc-dispatch-date]')&&/^\d{4}-\d{2}-\d{2}$/.test(t.value)){dispatchDate=t.value;render();}
});
document.addEventListener('submit',e=>{
 const f=e.target.closest?.('[data-fc-dispatch]');if(!f)return;
 e.preventDefault();submitDispatch(f);
});
document.addEventListener('click',e=>{
 const t=e.target.closest?.('[data-fc-select-all],[data-fc-scope],[data-fc-issue],[data-fc-open]');
 if(!t)return;
 e.preventDefault();e.stopImmediatePropagation?.();
 if(t.hasAttribute('data-fc-select-all')){
  const boxes=[...t.closest('form').querySelectorAll('[data-fc-member]')],set=boxes.some(x=>!x.checked);
  boxes.forEach(x=>x.checked=set);t.textContent=set?'Clear All':'Select All';return;
 }
 if(t.dataset.fcScope){scope=t.dataset.fcScope==='job'?'job':'today';render();return}
 if(t.dataset.fcIssue){
  const type=t.dataset.fcIssue,id=t.dataset.id;
  if(type==='shot')return api()?.shotDetail?.(id);
  if(type==='photo')return api()?.photoDetail?.(id);
  return api()?.setPage?.(type==='crew'?'crew':type==='billing'?'studio':'dayassist');
 }
 if(t.dataset.fcOpen==='shot')return api()?.shotDetail?.(t.dataset.id);
});
window.BoreLabFieldWork3={renderDispatch,renderReadiness,renderEvidence,submitDispatch,setCheck,flags,evidenceList};
})();