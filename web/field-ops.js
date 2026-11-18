/* BoreLab Field v0.18 — additive field workflows; no login, no storage-key migration. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
const fmt=(x,d=1)=>Number(x||0).toLocaleString(undefined,{maximumFractionDigits:d});
const date=x=>{const d=new Date(x);return isNaN(+d)?'Unknown date':d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})};
const cur=()=>api()?.state();
const getJob=id=>(cur()?.jobs||[]).find(j=>j.id===id);
const currentJob=()=>getJob(cur()?.activeJobId);
const shotIn=(job,id)=>(job?.shots||[]).find(sh=>sh.id===id);
const getStage=p=>['before','during','after'].includes(p?.stage)?p.stage:'unclassified';
const sizeKey=value=>window.BoreLabConduits?.sizeKey?.(value)||String(value||'').trim().toLowerCase();
const plans=(job,shot)=>window.BoreLabConduits?.plan?.(shot,job?.allowance??cur()?.allowance??10)||[];
const stages=[{id:'before',title:'Before',desc:'Before drilling'},{id:'during',title:'During',desc:'While drilling'},{id:'after',title:'After',desc:'Finished bore'}];
const checks=[['locates','Utility markings / 811 status checked'],['access','Jobsite access confirmed'],['path','Bore path and obstructions reviewed'],['equipment','Machine and tooling checked'],['materials','Correct pipe and reels checked'],['hazards','Known site hazards discussed']];
let completionJobId='',completionShotId='';
function captureShot(jobId,shotId){return clone(shotIn(getJob(jobId),shotId)||null)}
function journal(kind,jobId,shotId,before,after,extra={}){
 const state=cur();if(!state)return;
 if(!Array.isArray(state.fieldRecovery))state.fieldRecovery=[];
 const entry={id:api().uid(),kind,jobId,shotId,before:clone(before),after:clone(after),
  at:new Date().toISOString(),undone:false,...clone(extra)};
 state.fieldRecovery.push(entry);
 if(state.fieldRecovery.length>30)state.fieldRecovery.splice(0,state.fieldRecovery.length-30);
}
function setShot(jobId,shot){
 const state=cur(),job=getJob(jobId);if(!job)return false;
 const idx=job.shots.findIndex(s=>s.id===shot.id);
 if(idx<0)job.shots.push(clone(shot));else job.shots[idx]=clone(shot);
 if(jobId===state.activeJobId){
  const activeIndex=state.shots.findIndex(s=>s.id===shot.id);
  if(activeIndex<0)state.shots.push(clone(shot));else state.shots[activeIndex]=clone(shot);
 }
 return true;
}
function removeShot(jobId,shotId){
 const state=cur(),job=getJob(jobId);if(!job)return;
 job.shots=job.shots.filter(s=>s.id!==shotId);
 if(jobId===state.activeJobId)state.shots=state.shots.filter(s=>s.id!==shotId);
}
function quickBore(){
 const state=cur();if(!state)return;
 const prev=[...(state.shots||[])].reverse().find(s=>s.status!=='complete')||[...(state.shots||[])].reverse()[0];
 const last=state.quickBoreDefaults||{};
 const size=last.size||prev?.conduits?.[0]?.size||prev?.pipeDiameter||'';
 const quantity=last.quantity||prev?.conduits?.[0]?.quantity||1;
 let n=(state.shots||[]).length+1;while((state.shots||[]).some(sh=>sh.name==='Shot '+String(n).padStart(2,'0')))n++;
 const name='Shot '+String(n).padStart(2,'0');
 api().showModal('<div class="modal-head"><h2>Quick Bore</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>'+
 '<p class="smalltext muted">Create a planned shot using the last conduit size. You can complete detailed bore logs afterward.</p>'+
 '<form data-form="quick-bore" class="bl-quick-form"><label class="field">Bore footage<input type="number" name="feet" min="0.1" max="100000" step="0.1" inputmode="decimal" required placeholder="175" autofocus></label>'+
 '<label class="field">Shot name<input name="name" maxlength="70" required value="'+esc(name)+'"></label>'+
 '<div class="bl-row-2"><label class="field">Conduit size<input name="size" maxlength="40" placeholder="4 inch" value="'+esc(size)+'"></label>'+
 '<label class="field">Conduit quantity<input name="quantity" type="number" min="1" max="50" step="1" value="'+esc(quantity)+'"></label></div>'+
 '<label class="field">Jobsite address<input name="address" placeholder="Type or scan from your work order" maxlength="250" value="'+esc(last.address||prev?.address||'')+'">'+
 '<button type="button" class="btn micro ghost" data-address-scan>▣ Scan address from paper</button></label>'+
 '<p class="tiny muted">Status starts as Pending. No reel footage is deducted when you add a bore.</p>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button>'+
 '<button type="submit" class="btn primary">Save Quick Bore</button></div></form>');
}
function createQuickBore(form){
 const b=api(),state=b.state(),v=Object.fromEntries(new FormData(form).entries());
 const feet=Number(v.feet),quantity=Number(v.quantity),name=String(v.name||'').trim(),
  size=String(v.size||'').trim(),address=String(v.address||'').trim();
 if(!(feet>0&&feet<=100000&&Number.isFinite(feet)))return b.notify('Enter bore footage greater than zero.');
 if(!name)return b.notify('Give the shot a name.');
 if(!Number.isInteger(quantity)||quantity<1||quantity>50)return b.notify('Conduit quantity must be between 1 and 50.');
 if(address&&window.BoreLabLocations?.locationKind(address)==='plus'&&!window.BoreLabLocations?.isUsablePlusCode(address))
  return b.notify('Short Plus Code needs a nearby town or region.');
 const gps=window.BoreLabLocations?.parseCoords(address);
 const shot={id:b.uid(),jobId:state.activeJobId,name:name.slice(0,70),feet,
  conduits:size?[{size:size.slice(0,40),quantity,perRunFeet:''}]:[],pipeDiameter:size.slice(0,40),
  address:address.slice(0,250),lat:gps?.lat||'',lon:gps?.lon||'',notes:'',status:'planned',
  startedAt:null,completedAt:null,pipeUsed:'',rodCount:'',entryDepth:'',exitDepth:'',
  equipmentIds:(state.quickBoreDefaults?.equipmentIds||state.shots[state.shots.length-1]?.equipmentIds||[]).filter(id=>(state.equipment||[]).some(x=>x.id===id&&!x.archived)),updatedAt:new Date().toISOString()};
 state.shots.push(shot);state.quickBoreDefaults={size:size.slice(0,40),quantity,address:address.slice(0,250),equipmentIds:shot.equipmentIds};
 state.demo=false;
 journal('Quick Bore created',state.activeJobId,shot.id,null,shot);
 b.save();b.closeModal();b.render();b.notify('Quick Bore saved. Tap its name to add photos, depths or readiness.');
}
function renderTimeline(shotId){
 const b=api();if(!b)return'';
 const records=(b.photos()?.filter(p=>p.shotId===shotId&&(!p.jobId||p.jobId===cur().activeJobId))||[]).slice().sort((a,z)=>String(a.addedAt).localeCompare(String(z.addedAt)));
 const groups=stages.map(stage=>{
  const matched=records.filter(p=>getStage(p)===stage.id);
  return'<div class="bl-photo-stage"><div class="between"><div><strong>'+stage.title+'</strong><small>'+stage.desc+' · '+matched.length+' photo(s)</small></div>'+
   '<span class="bl-stage-buttons"><button class="btn micro ghost" type="button" data-field-photo="'+stage.id+'" data-id="'+esc(shotId)+'">+ Camera</button><button class="btn micro ghost" type="button" data-field-photo-gallery="'+stage.id+'" data-id="'+esc(shotId)+'">Gallery</button></span></div>'+
   (matched.length?'<div class="bl-photo-strip">'+matched.map(p=>'<button class="bl-photo-preview" data-action="photo-detail" data-id="'+esc(p.id)+'">'+
    '<img src="'+p.dataUrl+'" loading="lazy" alt="'+esc(stage.title)+' shot photo"><small>'+esc(date(p.addedAt))+'</small></button>').join('')+'</div>':
    '<p class="tiny muted">No '+stage.title.toLowerCase()+' photos recorded.</p>')+'</div>';
 }).join('');
 const old=records.filter(p=>getStage(p)==='unclassified');
 return'<div class="card spaced bl-photo-timeline"><h3>Shot Photo Timeline</h3>'+
 '<p class="tiny muted">Before, During and After photos stay attached to this bore. New photos save timestamps and GPS when available.</p>'+
 groups+(old.length?'<details><summary>'+old.length+' older / unclassified photo(s)</summary><div class="bl-photo-strip">'+
  old.map(p=>'<button class="bl-photo-preview" data-action="photo-detail" data-id="'+esc(p.id)+'"><img src="'+p.dataUrl+'" loading="lazy" alt="Previously saved shot photo"><small>'+esc(date(p.addedAt))+'</small></button>').join('')+'</div></details>':'')+'</div>';
}
function readiness(shotId){
 const state=cur();if(!state.shotReadiness)state.shotReadiness={};
 return state.shotReadiness[shotId]||{checks:{},notes:'',at:''};
}
function warnBeforeStart(jobId,shotId){
 const shot=shotIn(getJob(jobId),shotId);
 if(!shot)return false;
 const r=readiness(shotId),unchecked=checks.filter(([key])=>!r.checks?.[key]);
 if(!unchecked.length)return true;
 return window.confirm(unchecked.length+' readiness checks have not been marked reviewed for '+shot.name+'.\n\n'+
  'Confirm utility markings, site conditions and safety requirements independently before drilling.\n\nStart drilling anyway?');
}
function renderReadiness(shot){
 const data=readiness(shot.id),done=checks.filter(([key])=>data.checks?.[key]).length;
 return'<details class="card spaced bl-ready"><summary><strong>Job Readiness · '+done+'/'+checks.length+' reviewed</strong></summary>'+
 '<p class="tiny muted">Manual field checklist only. Checking boxes does not certify utility clearance or replace 811 requirements, permits, or site verification.</p>'+
 checks.map(([key,label])=>'<label class="bl-ready-row"><input type="checkbox" data-ready="'+key+'" data-shot="'+esc(shot.id)+'" '+(data.checks?.[key]?'checked':'')+'><span>'+esc(label)+'</span></label>').join('')+
 '<label class="field">Readiness notes<textarea rows="2" maxlength="1500" data-ready-notes="'+esc(shot.id)+'" placeholder="Locate ticket, hazards, access, crew briefing...">'+esc(data.notes||'')+'</textarea></label>'+
 '<p class="tiny muted">'+(data.at?'Last reviewed '+esc(date(data.at)):'Nothing reviewed yet.')+' · A foreman must verify conditions at the jobsite.</p></details>';
}
function renderQuickActions(){
 return'<div class="bl-field-quick-actions"><button type="button" class="btn primary" data-field-quick>+ Quick Bore</button>'+
 '<button type="button" class="btn ghost" data-field-recovery>↶ Recent Changes</button></div>';
}
function normalizeReel(reel){return{...reel,remaining:Number(reel.remaining)||0}}
function rowsForCompletion(job,shot){
 const plan=plans(job,shot);
 const rows=[];
 for(const item of plan){
  for(let i=0;i<Number(item.quantity)&&rows.length<60;i++){
   rows.push({size:item.size,feet:Number(item.perRun)||0});
  }
 }
 return {rows,tooMany:plan.reduce((n,x)=>n+Number(x.quantity),0)>60};
}
function suggestedReel(row,reels,remaining){
 const size=sizeKey(row.size);
 return reels.find(r=>sizeKey(r.size)===size&&(remaining[r.id]??Number(r.remaining))>=row.feet);
}
function beginCompletion(jobId,shotId){
 const b=api(),job=getJob(jobId),shot=shotIn(job,shotId);
 if(!shot)return b?.notify('Bore shot not found.');
 if(shot.status==='complete')return b.notify('This shot is already complete.');
 completionJobId=jobId;completionShotId=shotId;
 const {rows,tooMany}=rowsForCompletion(job,shot);
 const ids=window.BoreLabDailyReels?.activeIds(cur())||[];
 const all=(cur().reels||[]).filter(r=>!r.archived&&r.location==='truck');
 const preferred=ids.length?all.filter(r=>ids.includes(r.id)):all;
 const reservations=cur().pipeReservations||[];
 const balance=Object.fromEntries(preferred.map(r=>[r.id,Math.max(0,Number(r.remaining)-reservations.filter(h=>h.reelId===r.id&&h.shotId!==shotId).reduce((n,h)=>n+Number(h.feet||0),0))]));
 const assignments=rows.map(row=>{const pick=suggestedReel(row,preferred,balance);if(pick)balance[pick.id]-=row.feet;return {...row,reelId:pick?.id||''}});
 const previously=(cur().pipeMoves||[]).filter(m=>m.type==='installed'&&m.shotId===shotId).reduce((n,x)=>n+Number(x.feet||0),0);
 b.showModal('<div class="modal-head"><h2>Finish · '+esc(shot.name)+'</h2><button class="icon-btn" data-action="close-modal">✕</button></div>'+
 '<p class="smalltext muted">Confirm actual pipe pulled before completing the shot. Suggestions are estimates and have not been deducted.</p>'+
 (previously?'<p class="note">Already logged: '+fmt(previously)+' ft on this shot. Do not log the same pull twice.</p>':'')+
 (tooMany?'<p class="note">This pull has more than 60 conduit runs. Log the reel usage in Pipe Reels, then complete the shot without new deductions.</p>':'')+
 '<form data-form="complete-bore" data-job-id="'+esc(jobId)+'" data-shot-id="'+esc(shotId)+'">'+
 (!tooMany&&rows.length?'<div class="bl-complete-scroll">'+assignments.map((row,i)=>'<div class="bl-complete-row" data-run data-size="'+esc(row.size)+'">'+
 '<strong>'+esc(row.size)+' · Run '+(i+1)+'</strong>'+
 '<label class="field">Actual feet pulled<input type="number" name="feet_'+i+'" min="0.1" step="0.1" value="'+esc(row.feet)+'"></label>'+
 '<label class="field">Reel<select name="reel_'+i+'"><option value="">Select matching reel</option>'+
 preferred.filter(r=>sizeKey(r.size)===sizeKey(row.size)).map(r=>'<option value="'+esc(r.id)+'" '+(r.id===row.reelId?'selected':'')+'>'+esc(r.name)+' · '+fmt(r.remaining)+' ft on truck</option>').join('')+'</select></label></div>').join('')+'</div>':
 '<p class="tiny muted">No conduit runs recorded for automatic allocation. You may still finish the bore and log pipe manually.</p>')+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button>'+
 '<button type="submit" class="btn primary" name="completeMode" value="record" '+(!rows.length||tooMany||previously>0?'disabled':'')+'>Record Pipe & Finish</button>'+
 '<button type="submit" class="btn ghost" name="completeMode" value="skip">Finish Without Pipe Log</button></div></form>');
}
function validateCompletion(shot,job,values,mode,form,state){
 if(mode==='skip')return{runs:[],reels:new Map()};
 if((state.pipeMoves||[]).some(m=>m.shotId===shot.id&&m.type==='installed'))throw Error('Pipe was already logged on this shot. Finish without an additional deduction, or record extra usage manually.');
 const rows=rowsForCompletion(job,shot);
 if(!rows.rows.length||rows.tooMany)throw Error('No safe automatic allocation. Use manual pipe logging.');
 const reservations=state.pipeReservations||[],reels=new Map((state.reels||[]).map(r=>[r.id,r]));
 const sums=new Map(),runs=[];
 for(let i=0;i<rows.rows.length;i++){
  const ref=rows.rows[i],raw=String(values['feet_'+i]||'').trim(),amount=Number(raw),id=String(values['reel_'+i]||'');
  if(!raw||!Number.isFinite(amount)||amount<=0||amount>100000||Math.abs(Math.round(amount*10)-amount*10)>.0001)
   throw Error('Enter positive actual footage in tenths for every conduit run.');
  const reel=reels.get(id);
  if(!reel||reel.archived||reel.location!=='truck')throw Error('Choose an on-truck reel for '+ref.size+'.');
  if(sizeKey(reel.size)!==sizeKey(ref.size))throw Error('Wrong conduit size on '+reel.name+'.');
  runs.push({id,feet:Math.round(amount*10)/10,size:ref.size});
  sums.set(id,(sums.get(id)||0)+Math.round(amount*10)/10);
 }
 const daily=window.BoreLabDailyReels?.activeIds(state)||[];
 if(daily.length&&runs.some(r=>!daily.includes(r.id)))throw Error('Select from the reels assigned for today.');
 for(const [id,needed]of sums){
  const reel=reels.get(id);
  const other=reservations.filter(r=>r.reelId===id&&r.shotId!==shot.id).reduce((n,r)=>n+Number(r.feet||0),0);
  if(needed>Number(reel.remaining)-other+.00001)throw Error('Not enough continuous footage on '+reel.name+' after other reservations.');
 }
 // A single run must fit continuously on its assigned reel.
 return{runs,reels};
}
function completeBore(form,event){
 const b=api(),state=b.state(),jobId=form.dataset.jobId,shotId=form.dataset.shotId,job=getJob(jobId),
  shot=shotIn(job,shotId);
 if(!job||!shot)return b.notify('Shot no longer exists. Nothing changed.');
 const mode=event.submitter?.value==='skip'?'skip':'record';
 if(mode==='skip'&&!window.confirm('Complete without recording pipe? The report will flag missing reel usage.'))return;
 const values=Object.fromEntries(new FormData(form).entries());
 let checked;try{checked=validateCompletion(shot,job,values,mode,form,state)}catch(err){b.notify(err.message);return}
 const now=new Date().toISOString(),before=clone(shot);
 const prevReels=checked.runs.map(r=>r.id).filter((v,i,a)=>a.indexOf(v)===i).map(id=>({id,remaining:Number(checked.reels.get(id).remaining)}));
 const prevReservations=clone(state.pipeReservations||[]),moveIds=[];
 // Validation is complete: update all data as a single in-memory operation, then save once.
 for(const run of checked.runs){
  const reel=checked.reels.get(run.id),beforeFeet=Number(reel.remaining);
  reel.remaining=Math.round((beforeFeet-run.feet)*10)/10;
  const move={id:b.uid(),jobId,reelId:reel.id,shotId,type:'installed',size:run.size,feet:run.feet,
   at:now,before:beforeFeet,after:reel.remaining,note:'Confirmed during Finish Bore'};
  state.pipeMoves.push(move);moveIds.push(move.id);
  let release=run.feet;
  for(const reservation of state.pipeReservations.filter(x=>x.reelId===reel.id&&x.shotId===shotId)){
   const taken=Math.min(release,Number(reservation.feet));reservation.feet=Math.round((Number(reservation.feet)-taken)*10)/10;release-=taken;
   if(release<=0)break;
  }
  state.pipeReservations=state.pipeReservations.filter(x=>Number(x.feet)>0);
 }
 const updated={...clone(shot),status:'complete',startedAt:shot.startedAt||now,completedAt:now,updatedAt:now};
 setShot(jobId,updated);
 journal('Bore completed'+(checked.runs.length?' + reel usage':''),jobId,shotId,before,updated,
  {reelBefore:prevReels,reelAfter:prevReels.map(x=>({id:x.id,remaining:Number(checked.reels.get(x.id).remaining)})),
   moveIds,reservationsBefore:prevReservations,reservationsAfter:clone(state.pipeReservations||[])});
 b.save();b.closeModal();b.render();
 b.notify('Shot completed'+(checked.runs.length?' · '+fmt(checked.runs.reduce((n,r)=>n+r.feet,0))+' ft logged on reels':' · Pipe log still needed')+'.');
}
function dayWarnings(job,day){
 if(!job)return[];
 const state=cur(),photos=api()?.photos?.()||[];
 const local=x=>{if(!x)return'';const d=new Date(x);return Number.isFinite(+d)?d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'):''};
 const finished=(job.shots||[]).filter(sh=>sh.status==='complete'&&local(sh.completedAt)===day);
 const issues=[];
 for(const shot of finished){
  const linked=photos.filter(p=>(p.jobId||state.legacyJobId)===job.id&&p.shotId===shot.id);
  if(!linked.some(p=>getStage(p)==='after'))issues.push(shot.name+': after photo not recorded');
  if(!shot.address&&!api().coordsValid(shot))issues.push(shot.name+': location missing');
  if(!plans(job,shot).length)issues.push(shot.name+': conduit size missing');
  const pulls=(state.pipeMoves||[]).filter(m=>m.type==='installed'&&m.shotId===shot.id);
  if(!pulls.length&&(shot.pipeUsed==null||shot.pipeUsed===''))issues.push(shot.name+': actual pipe not recorded');
 }
 if((job.crew||[]).some(e=>e.start&&local(e.start)<=day&&!e.end))issues.push('Crew time entries still clocked in');
 return issues;
}
function renderDayReview(job,day){
 const issues=dayWarnings(job,day);
 return'<div class="card spaced bl-day-review"><h3>Field Record Check</h3><p class="tiny muted">These are reminders, not automatic closeout approvals. Review each job before exporting.</p>'+
 (issues.length?issues.slice(0,15).map(x=>'<p class="tiny muted">⚠ '+esc(x)+'</p>').join('')+
 (issues.length>15?'<p class="tiny muted">+'+(issues.length-15)+' more items</p>':''):
 '<p class="smalltext">✓ No missing photo/pipe/location flags detected by these checks.</p>')+'</div>';
}
function renderRecovery(){
 const records=(cur().fieldRecovery||[]).filter(r=>!r.undone).slice().reverse().slice(0,20);
 return'<div class="card spaced bl-recovery"><div class="between"><h3>Recent Changes / Undo</h3><button class="btn micro ghost" data-field-recovery>Open</button></div>'+
 '<p class="tiny muted">Stores recent bore changes on this phone. Undo restores a specific shot or its recorded pipe usage only if nothing conflicting changed afterward. Photos are not deleted.</p>'+
 (records.length?records.slice(0,5).map(r=>'<div class="bl-recovery-row"><span>'+esc(r.kind)+'<small>'+esc(date(r.at))+'</small></span>'+
 '<button type="button" class="btn micro ghost" data-field-undo="'+esc(r.id)+'">Undo</button></div>').join(''):'<p class="tiny muted">No recent reversible changes.</p>')+'</div>';
}
function openRecovery(){
 const b=api();
 b.showModal('<div class="modal-head"><h2>Undo & Recovery</h2><button class="icon-btn" data-action="close-modal">✕</button></div>'+
 renderRecovery()+'<p class="tiny muted">This local history is limited to the latest 30 supported shot operations. It is not a substitute for exporting your BoreLab backup.</p>');
}
async function undo(id){
 const b=api(),state=b.state(),entry=(state.fieldRecovery||[]).find(x=>x.id===id&&!x.undone);
 if(!entry)return b.notify('That recovery entry is no longer available.');
 const job=getJob(entry.jobId),current=shotIn(job,entry.shotId);
 if(!job)return b.notify('Original job is missing. Cannot restore safely.');
 if(entry.after&&JSON.stringify(current)!==JSON.stringify(entry.after)){
  return b.notify('Shot changed again after this action. Undo is blocked to protect newer work.');
 }
 if(!entry.after&&current)return b.notify('Shot ID was reused. Cannot restore safely.');
 if(entry.moveIds?.length){
  const byId=new Map((state.reels||[]).map(r=>[r.id,r]));
  for(const value of entry.reelAfter||[]){
   if(Math.abs(Number(byId.get(value.id)?.remaining)-Number(value.remaining))>.001)
    return b.notify('A reel was updated again; undo is blocked to protect later pipe records.');
  }
  if(entry.moveIds.some(moveId=>!state.pipeMoves.some(m=>m.id===moveId)))
   return b.notify('Recorded pipe movements changed; undo is blocked.');
  if(entry.reservationsAfter&&JSON.stringify(state.pipeReservations||[])!==JSON.stringify(entry.reservationsAfter))
   return b.notify('Pipe reservations changed afterward; undo is blocked to protect newer work.');
 }
 if(!window.confirm('Undo "'+entry.kind+'"? This restores the previous shot and any pipe usage from that action.'))return;
 if(entry.moveIds?.length){
  const map=new Map((state.reels||[]).map(r=>[r.id,r]));
  for(const v of entry.reelBefore||[]){const reel=map.get(v.id);if(reel)reel.remaining=v.remaining}
  state.pipeMoves=state.pipeMoves.filter(m=>!entry.moveIds.includes(m.id));
  state.pipeReservations=clone(entry.reservationsBefore||[]);
 }
 if(entry.before)setShot(entry.jobId,entry.before);else if(entry.after)removeShot(entry.jobId,entry.shotId);
 if(entry.photoIds?.length){
  const all=b.photos?.()||[];
  for(const photoId of entry.photoIds){const photo=all.find(p=>p.id===photoId);
   if(photo&&!photo.shotId){await b.photoDB?.('put',{...photo,shotId:entry.shotId,jobId:entry.jobId});}}
  await b.refreshPhotos?.();
 }
 entry.undone=true;entry.undoneAt=new Date().toISOString();
 b.save();b.closeModal();b.render();b.notify('Previous bore record restored. Check affected photos and reports.');
}
document.addEventListener('click',e=>{
 if(e.target.closest('[data-field-quick]')){quickBore();return}
 if(e.target.closest('[data-field-recovery]')){openRecovery();return}
 const undoButton=e.target.closest('[data-field-undo]');if(undoButton){undo(undoButton.dataset.fieldUndo);return}
 const stageButton=e.target.closest('[data-field-photo]');
 if(stageButton){api()?.photoChoose?.('camera',stageButton.dataset.id,stageButton.dataset.fieldPhoto);return}
 const gallery=e.target.closest('[data-field-photo-gallery]');
 if(gallery){api()?.photoChoose?.('gallery',gallery.dataset.id,gallery.dataset.fieldPhotoGallery);return}
});
document.addEventListener('change',async event=>{
 const selector=event.target.closest('[data-photo-stage-update]');
 if(!selector)return;
 const b=api(),photo=b?.photos?.().find(p=>p.id===selector.dataset.photoStageUpdate);
 if(!photo)return;
 const stage=selector.value;
 if(!stages.some(s=>s.id===stage)){b.notify('Choose a valid photo stage.');return}
 try{
  await b.photoDB('put',{...photo,stage});await b.refreshPhotos();
  b.closeModal();b.render();b.notify('Photo categorized as '+stage+'.');
 }catch(err){b.notify('Could not update photo: '+err.message)}
});
document.addEventListener('change',e=>{
 const box=e.target.closest('[data-ready]');
 if(box){
  const data=readiness(box.dataset.shot),shotId=box.dataset.shot;
  data.checks={...(data.checks||{}),[box.dataset.ready]:!!box.checked};
  data.at=new Date().toISOString();cur().shotReadiness[shotId]=data;api().save();return;
 }
 const notes=e.target.closest('[data-ready-notes]');
 if(notes){const data=readiness(notes.dataset.readyNotes);data.notes=notes.value.trim().slice(0,1500);data.at=new Date().toISOString();cur().shotReadiness[notes.dataset.readyNotes]=data;api().save()}
});
const style=document.createElement('style');
style.textContent='.bl-field-quick-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.bl-quick-form{display:grid;gap:13px}.bl-row-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.bl-photo-stage{padding:12px 0;border-bottom:1px solid var(--line)}.bl-photo-stage small{color:var(--muted);display:block;font-size:11px}.bl-stage-buttons{display:flex;gap:5px;flex-wrap:wrap}.bl-photo-strip{display:flex;overflow-x:auto;gap:8px;margin-top:8px}.bl-photo-preview{min-width:116px;width:116px;background:var(--surface2);border:1px solid var(--line);border-radius:10px;padding:5px;color:var(--text)}.bl-photo-preview img{height:84px;width:100%;object-fit:cover;border-radius:7px}.bl-photo-preview small{display:block;font-size:10px}.bl-ready-row{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--line);font-size:13px}.bl-ready-row input{width:18px;height:18px}.bl-complete-scroll{max-height:46vh;overflow-y:auto}.bl-complete-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr) minmax(0,2fr);gap:7px;align-items:end;padding:12px 0;border-bottom:1px solid var(--line)}.bl-complete-row select,.bl-complete-row input{width:100%;min-width:0}.bl-recovery-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}.bl-recovery-row small{display:block;color:var(--muted);font-size:11px}.bl-day-review p{margin:6px 0}@media(max-width:560px){.bl-complete-row{grid-template-columns:1fr 1fr}.bl-complete-row strong{grid-column:1/-1}.bl-quick-form .bl-row-2{grid-template-columns:1fr}}';
document.head.appendChild(style);
window.BoreLabFieldOps={quickBore,createQuickBore,renderTimeline,renderReadiness,renderQuickActions,warnBeforeStart,beginCompletion,completeBore,
 dayWarnings,renderDayReview,renderRecovery,openRecovery,journal,undo,captureShot,setShot,plans,rowsForCompletion,validateCompletion};
})();
