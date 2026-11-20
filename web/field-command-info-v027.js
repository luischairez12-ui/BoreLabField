/* Field Command 3.0 — offline cross-job search and storage confidence */
(function(){
'use strict';
const core=()=>window.BoreLabFieldCommand3,b=()=>core()?.api?.(),s=()=>core()?.state?.()||{},jobs=()=>core()?.jobs?.()||[];
const esc=x=>core()?.esc?.(x)||'',dayOf=x=>core()?.dayOf?.(x)||'',photos=()=>core()?.photos?.()||[];
const key='borelab-field-command-health-v1';
let health={savedAt:'',saveError:'',photosRead:null,photoError:'',backupInitiated:''};
try{health={...health,...JSON.parse(localStorage.getItem(key)||'{}')}}catch{}
function persist(){try{localStorage.setItem(key,JSON.stringify(health))}catch{}}
function markSaved(){health.savedAt=new Date().toISOString();health.saveError='';persist()}
function markSaveError(msg){health.saveError=String(msg||'Local storage write failed.').slice(0,160);persist()}
function photoHealth(err){health.photosRead=!err;health.photoError=err?String(err.message||err).slice(0,160):'';persist()}
function backupInitiated(){health.backupInitiated=new Date().toISOString();persist()}
const time=v=>v?new Date(v).toLocaleString():'Not recorded';
const title=(label,kicker,desc)=>'<header class="fc-page-head"><span class="eyebrow">'+esc(kicker)+'</span><h1>'+esc(label)+'</h1><p>'+esc(desc)+'</p></header>';
const panel=html=>'<section class="fc-panel">'+html+'</section>';
const status=(kind,text)=>'<span class="fc-status '+kind+'">'+esc(text)+'</span>';
let query='';
function searchRecords(value){
 const q=String(value||'').trim().toLowerCase().slice(0,100),result=[];
 if(q.length<2)return result;
 const match=(...text)=>text.some(x=>{const value=String(x||'').toLowerCase();if(value.includes(q))return true;if(/^\d{4}-\d{2}-\d{2}/.test(value)){const d=new Date(value.length===10?value+'T12:00:00':value);return Number.isFinite(+d)&&d.toLocaleDateString('en-US').toLowerCase().includes(q)}return false});
 const push=(type,label,detail,jobId,id)=>result.push({type,label:String(label||'Unknown'),detail:String(detail||''),jobId:jobId||'',id:id||''});
 for(const j of jobs()){
  if(match(j.jobName,j.jobAddress,j.jobNotes,j.id))push('job',j.jobName,j.jobAddress||'Saved job',j.id,j.id);
  for(const sh of j.shots||[])if(match(sh.name,sh.address,sh.notes,sh.startedAt,sh.completedAt,sh.pipeDiameter,sh.feet))
   push('shot',sh.name,(j.jobName||'Job')+' · '+(sh.address||'No address')+' · '+(sh.feet||0)+' ft',j.id,sh.id);
  for(const pin of j.fieldPins||[])if(match(pin.name,pin.kind,pin.notes,pin.address,pin.occurredDay,pin.occurredAt))
   push('pin',pin.name||pin.kind,(j.jobName||'Job')+' · '+(pin.occurredDay||pin.kind||''),j.id,pin.id);
  for(const note of j.quickNotes||[])if(match(note.text,note.at))
   push('note',note.text,(j.jobName||'Job')+' · '+dayOf(note.at),j.id,note.id);
  for(const entry of j.crew||[])if(match(entry.name,entry.start,entry.notes))
   push('timesheet',entry.name||'Worker',(j.jobName||'Job')+' · '+dayOf(entry.start),j.id,entry.id);
  for(const pin of j.fieldPins||[])if(match(pin.lat,pin.lon))push('pin',pin.name||pin.kind,j.jobName,j.id,pin.id);
 }
 for(const member of s().roster||[])if(match(member.name,member.primaryRole))
  push('person',member.name,member.primaryRole||'Regular crew role','',member.id);
 for(const equip of s().equipment||[])if(match(equip.name,equip.type,equip.serial,equip.notes))
  push('equipment',equip.name,equip.type||'Equipment','',equip.id);
 for(const photo of photos())if(match(photo.notes,photo.stage,photo.kind,photo.addedAt,photo.lat,photo.lon))
  push('photo',photo.notes||'Jobsite photo',dayOf(photo.addedAt)+' · '+(photo.stage||'General'),photo.jobId,photo.id);
 return result.slice(0,70);
}
function resultsHTML(){
 if(query.trim().length<2)return '<p class="fc-empty">Enter at least 2 characters: part of an address, worker name, date, bore or equipment.</p>';
 const result=searchRecords(query);
 if(!result.length)return '<p class="fc-empty">No matching saved records found. Try a shorter search.</p>';
 return '<p class="fc-muted">'+result.length+' local results'+(result.length===70?' (limited to first 70)':'')+'</p>'+
 result.map(x=>'<button class="fc-search-hit" data-fc-hit="'+esc(x.type)+'" data-job="'+esc(x.jobId)+'" data-id="'+esc(x.id)+'">'+
 '<span class="fc-search-type">'+esc(x.type)+'</span><span><strong>'+esc(x.label)+'</strong><small>'+esc(x.detail)+'</small></span><b>›</b></button>').join('');
}
function renderFind(){
 return '<div class="page fc-page">'+title('Find Anything','FIELD / UNIVERSAL SEARCH','Search the saved jobs on this device, including personnel, equipment and field notes.')+
 '<label class="fc-field">Search local records<input type="search" maxlength="100" placeholder="Carlos, 11/20, 6-inch pipe, road name…" data-fc-search value="'+esc(query)+'" autocomplete="off"></label>'+
 panel('<div id="fcSearchResults" aria-live="polite">'+resultsHTML()+'</div>')+
 '<p class="fc-muted">This searches record metadata, not PDF text or the contents of photos. Search is offline; no records are sent to a server.</p></div>';
}
function openHit(type,id,jobId){
 const bridge=b();if(!bridge)return;
 if(jobId&&jobId!==s().activeJobId){if(bridge.switchActiveJob?.(jobId)!==true)return}
 if(type==='shot')return bridge.shotDetail?.(id);
 if(type==='photo')return bridge.photoDetail?.(id);
 if(type==='pin'){bridge.setPage?.('jobmap');window.BoreLabJobMap?.focusRecord?.(id);return}
 if(type==='equipment')return bridge.openEquipmentForm?.(id);
 if(type==='person'||type==='timesheet')return bridge.setPage?.('crewmanager2');
 if(type==='note')return bridge.setPage?.('fieldhistory');
 return bridge.setPage?.('job');
}
function renderSaveStatus(){
 const j=core()?.job?.(),count=photos().filter(p=>!p.jobId||p.jobId===j?.id).length;
 const localState=health.saveError?'warn':health.savedAt?'ok':'review';
 const photoState=health.photosRead===false?'warn':health.photosRead===true?'ok':'review';
 return '<div class="page fc-page">'+title('Save & Backup Health','FIELD / OFFLINE RECORDS','Understand what was saved locally, and which files still need an external backup.')+
 panel('<h2>Local job data</h2><div class="fc-health">'+status(localState,health.saveError?'Local write failed':'Last saved locally')+
 '<strong>'+esc(time(health.savedAt))+'</strong></div>'+
 (health.saveError?'<p class="fc-warning">'+esc(health.saveError)+'</p>':'')+
 '<p class="fc-muted">Jobs, bores, assignments and hours use on-device storage. No automatic cloud sync is configured.</p>')+
 panel('<h2>Photos</h2><div class="fc-health">'+status(photoState,health.photosRead===false?'Photo library read failed':health.photosRead===true?'Photo library opened':'Read not checked')+
 '<strong>'+count+' photos in the current job</strong></div>'+
 (health.photoError?'<p class="fc-warning">'+esc(health.photoError)+'</p>':'')+
 '<button data-fc-recheck>↻ Recheck Photo Library</button>')+
 panel('<h2>External backups</h2><p><strong>Last backup export initiated:</strong> '+esc(time(health.backupInitiated))+'</p>'+
 '<p class="fc-caution">Starting a download is not proof the backup is saved or readable. Check the downloaded file yourself. Private imported PDF plans and their saved redlines are not inside the JSON backup; export marked plans separately.</p>'+
 '<div class="fc-actions"><button class="fc-primary" data-action="export-backup">Export JSON Backup</button><button data-page="studio">Export PDF Plans</button></div>')+'</div>';
}
document.addEventListener('input',e=>{
 const t=e.target;if(!t.matches?.('[data-fc-search]'))return;
 query=String(t.value||'').slice(0,100);const container=document.getElementById('fcSearchResults');if(container)container.innerHTML=resultsHTML();
});
document.addEventListener('click',e=>{
 const hit=e.target.closest?.('[data-fc-hit]'),check=e.target.closest?.('[data-fc-recheck]');
 if(!hit&&!check)return;e.preventDefault();e.stopImmediatePropagation?.();
 if(hit)openHit(hit.dataset.fcHit,hit.dataset.id,hit.dataset.job);
 if(check)b()?.refreshPhotos?.().then(()=>b()?.render?.()).catch(err=>b()?.notify?.(err.message));
},{capture:true});
window.BoreLabFieldInfo3={renderFind,renderSaveStatus,searchRecords,openHit,markSaved,markSaveError,photoHealth,backupInitiated,health:()=>({...health})};
})();