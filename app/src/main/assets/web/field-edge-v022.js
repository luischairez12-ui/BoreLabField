/* BoreLab Field 0.22 — right-hand Edge Control, Peek, field workflow.
   Offline-first UI; no server, no separate app, and no new global storage key for jobs. */
(function(){
'use strict';
const b=()=>window.BoreLabAssistantBridge;
const ab=()=>window.BoreLabAsBuilt;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayOf=v=>ab()?.dayOf?.(v)||'';
const now=()=>new Date().toISOString();
const day=()=>dayOf(now());
const fmt=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:1});
const todayTime=at=>{const d=new Date(at);return Number.isFinite(+d)?d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'Time unavailable'};
const safeLoad=(key,fallback)=>{try{const value=localStorage.getItem(key);return value===null?fallback:JSON.parse(value)}catch{return fallback}};
const safeWrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
const EDGE_POSITION='borelab-edge-position-v022',FAVORITES='borelab-edge-favorites-v022';
const valid=x=>!!ab()?.valid?.(x);
const roleOK=()=>!!b()&&(!window.BoreLabLocalAccounts||window.BoreLabLocalAccounts.isUnlocked?.())&&(!window.BoreLabLocalAccounts||['owner','foreman'].includes(window.BoreLabLocalAccounts.role?.()));
const active=()=>b()?.activeJob?.();
const allPhotos=()=>b()?.photos?.()||[];
const shots=()=>active()?.shots||b()?.state?.()?.shots||[];
const currentShot=()=>shots().find(x=>x.status==='progress')||shots().find(x=>x.status!=='complete')||null;
const pendingShot=except=>shots().find(x=>x.status!=='complete'&&x.id!==except)||null;
const pipeRemaining=()=>{const n=b()?.pipeOnTruck?.();return Number.isFinite(Number(n))?Number(n):null};
const markerKinds=[{id:'obstruction',label:'Obstruction',icon:'⚠'},{id:'utility',label:'Utility Crossing',icon:'⌖'},{id:'return',label:'Return Later',icon:'↶'},{id:'attention',label:'Needs Attention',icon:'!'}];
const markerKind=x=>markerKinds.find(k=>k.id===x)?.label||'Field marker';
const galleryId=id=>'photo:'+id;
const favDefaults=['home','planner','fieldhistory'];
const favoriteOptions=[{id:'home',title:'Home',icon:'⌂'},{id:'planner',title:'Bores',icon:'⌁'},{id:'fieldhistory',title:'Atlas',icon:'▦'},{id:'shotboard',title:'Shot Board',icon:'☷'},{id:'jobmap',title:'Job Map',icon:'⌖'},{id:'photos',title:'Photos',icon:'▣'},{id:'fieldhub',title:'Field Hub',icon:'⚡'},{id:'crew',title:'Crew',icon:'♙'}];
let favorites=safeLoad(FAVORITES,favDefaults).filter(id=>favoriteOptions.some(f=>f.id===id)).slice(0,3);
if(!favorites.length)favorites=favDefaults.slice();
let position=Math.max(18,Math.min(88,Number(safeLoad(EDGE_POSITION,56))||56));
let peek=false,peekMode='glance',customizing=false,hubTab='markers',storyDay=day();
let edgeGesture=null,suppressClickUntil=0,holdTimer=null,undoRecord=null,undoTimeout=null,toastTimer=null;
function lastArrival(job=active()){return (job?.arrivalLog||[]).slice().reverse().find(x=>dayOf(x.at)===day())||null}
function countUnassigned(){
 const j=active();if(!j)return 0;
 return allPhotos().filter(x=>(x.jobId||b()?.state?.()?.legacyJobId||b()?.state?.()?.activeJobId)===j.id&&!x.shotId&&!x.fieldPinId).length;
}
function arrivalCard(){
 const job=active(),shot=currentShot(),log=lastArrival(job),pipe=pipeRemaining();
 if(!job)return '<section class="be-arrival-card"><h3>Jobsite Arrival</h3><p class="muted smalltext">Select a job to begin your field day.</p><button type="button" data-page="jobs">Choose Job</button></section>';
 return '<section class="be-arrival-card"><div class="be-panel-head"><div><small>JOB ARRIVAL / MANUAL CHECK-IN</small><h3>'+esc(job.jobName||'Active Job')+'</h3></div><span class="be-orange-dot">⌖</span></div>'+
 '<div class="be-arrival-meta"><span><small>CURRENT BORE</small><strong>'+esc(shot?.name||'None pending')+'</strong></span><span><small>PIPE ON TRUCK</small><strong>'+esc(pipe===null?'Not recorded':fmt(pipe)+' ft')+'</strong></span></div>'+
 (log?'<div class="be-arrived">✓ Arrived today at '+esc(todayTime(log.at))+(valid(log)?' · GPS recorded':' · No GPS tracked')+'</div>':
 '<p class="tiny muted">Tap only when you arrive. BoreLab never tracks your arrival automatically.</p>')+
 '<div class="be-action-row"><button type="button" class="be-primary" data-be-arrive '+(log?'disabled':'')+'>'+(log?'✓ Arrival Logged':'⌖ I’m Here')+'</button>'+
 '<button type="button" class="be-outline" data-page="shotboard">Shot Board</button>'+
 '<button type="button" class="be-outline" data-be-photo>▣ Photo</button></div>'+
 (log&&!valid(log)?'<button type="button" class="be-link" data-be-arrival-gps>◎ Add GPS to this arrival (optional)</button>':'')+'</section>';
}
function homeArrival(){return '<div class="be-home-arrival">'+arrivalCard()+'</div>'}
function peekSummary(){
 const job=active(),shot=currentShot(),next=pendingShot(shot?.id),pipe=pipeRemaining();
 return '<div class="be-peek-summary">'+
 '<div><small>ACTIVE JOB</small><strong>'+esc(job?.jobName||'No job selected')+'</strong></div>'+
 '<div><small>CURRENT BORE</small><strong>'+esc(shot?.name||'No pending bore')+(shot?.feet?' · '+fmt(shot.feet)+' ft':'')+'</strong></div>'+
 '<div class="be-peek-split"><span><small>PIPE ON TRUCK</small><strong>'+esc(pipe===null?'Not recorded':fmt(pipe)+' ft')+'</strong></span>'+
 '<span><small>NEXT SHOT</small><strong>'+esc(next?.name||'None planned')+'</strong></span></div>'+
 (lastArrival()===null?'<button type="button" class="be-peek-arrival" data-be-arrive>⌖ I’m Here</button>':'<p class="be-peek-status">✓ Arrival marked today</p>')+'</div>'+
 '<div class="be-peek-shortcuts"><button data-be-photo>▣ Photo</button><button data-be-new-marker>⚠ Marker</button><button data-page="shotboard">☷ Shot Board</button></div>';
}
function favoriteHTML(){
 const activeFav=favorites.map(id=>favoriteOptions.find(x=>x.id===id)).filter(Boolean);
 return '<p class="tiny muted">Hold the edge tab to open your three most-used shortcuts.</p>'+
 '<div class="be-favorite-grid">'+activeFav.map(f=>'<button data-page="'+f.id+'"><span>'+f.icon+'</span><strong>'+esc(f.title)+'</strong></button>').join('')+'</div>'+
 '<button class="be-link" data-be-favorites-customize>'+(customizing?'Done customizing':'Customize favorites')+'</button>'+
 (customizing?'<div class="be-favorite-choices">'+favoriteOptions.map(f=>
 '<button type="button" data-be-favorite-pick="'+f.id+'" class="'+(favorites.includes(f.id)?'selected':'')+'">'+f.icon+' '+esc(f.title)+(favorites.includes(f.id)?' ✓':'')+'</button>').join('')+'</div>':'');
}
function renderPeek(){
 return '<div class="be-peek-heading"><div><small>BORELAB EDGE</small><h2>'+ (peekMode==='favorites'?'Favorite Shortcuts':'Quick Peek')+'</h2></div>'+
 '<button type="button" data-be-peek-close aria-label="Close Peek Mode">✕</button></div>'+
 (peekMode==='favorites'?favoriteHTML():peekSummary())+
 '<div class="be-peek-footer"><button data-be-full-menu>Full Field Menu ›</button><button data-page="fieldhub">Field Hub ›</button></div>';
}
function mount(){
 if($('#bePeek'))return;
 const box=document.createElement('aside');box.id='bePeek';box.className='be-peek';box.hidden=true;box.setAttribute('aria-label','BoreLab Edge Peek');
 document.body.appendChild(box);
 const backdrop=document.createElement('button');backdrop.id='bePeekBackdrop';backdrop.className='be-peek-backdrop';
 backdrop.hidden=true;backdrop.setAttribute('aria-label','Close peek mode');backdrop.setAttribute('data-be-peek-close','');
 document.body.appendChild(backdrop);
 const toast=document.createElement('div');toast.id='beUndoToast';toast.className='be-undo-toast';toast.hidden=true;toast.setAttribute('role','status');
 document.body.appendChild(toast);
 sync();
}
function sync(){
 if(!$('#bePeek'))return;
 const tab=$('.bf-edge-tab');
 if(tab)tab.style.top=position+'%';
 if(!roleOK()){closePeek();clearToast();return}
 if(peek){$('#bePeek').innerHTML=renderPeek()}
}
function openPeek(mode='glance'){
 if(!roleOK()||$('#modalRoot .modal-backdrop'))return;
 mount();window.BoreLabFab?.close?.();
 if(window.BoreLabNavigation?.isOpen?.())window.BoreLabNavigation.close();
 peekMode=mode;peek=true;const panel=$('#bePeek'),back=$('#bePeekBackdrop');
 panel.hidden=false;panel.innerHTML=renderPeek();back.hidden=false;
 document.documentElement.classList.add('be-peek-open');
}
function closePeek(){
 peek=false;const panel=$('#bePeek'),back=$('#bePeekBackdrop');
 if(panel)panel.hidden=true;
 if(back)back.hidden=true;
 document.documentElement.classList.remove('be-peek-open');
}
function handleTabClick(){
 if(Date.now()<suppressClickUntil)return true;
 if(peek){closePeek();return false}
 return false;
}
function releaseTimer(){if(holdTimer!==null){clearTimeout(holdTimer);holdTimer=null}}
function setEdgePosition(value){
 position=Math.max(18,Math.min(88,Number(value)||56));
 safeWrite(EDGE_POSITION,position);
 const tab=$('.bf-edge-tab');if(tab)tab.style.top=position+'%';
}
function actionAllowed(){return roleOK()}
function notify(text){b()?.notify?.(text)}
function jobMarkers(job=active()){return Array.isArray(job?.fieldMarkers)?job.fieldMarkers:[]}
function ensureMarkers(job=active()){if(!job)return null;if(!Array.isArray(job.fieldMarkers))job.fieldMarkers=[];return job.fieldMarkers}
function markerForm(id=''){
 if(!actionAllowed())return;
 const job=active(),old=jobMarkers(job).find(m=>m.id===id);
 if(!job)return notify('Choose a job before adding a field marker.');
 b()?.showModal?.('<div class="modal-head"><h2>'+(old?'Edit':'New')+' Field Marker</h2><button type="button" class="icon-btn" data-action="close-modal">✕</button></div>'+
 '<p class="smalltext muted">Safety/return markers are separate from installed couplings and boxes. Coordinates are optional; map pins require saved GPS.</p>'+
 '<form data-be-marker-form data-be-id="'+esc(id)+'"><label class="field">Marker type<select name="kind">'+markerKinds.map(k=>'<option value="'+k.id+'"'+((old?.kind||'obstruction')===k.id?' selected':'')+'>'+k.label+'</option>').join('')+'</select></label>'+
 '<label class="field">Label<input name="label" maxlength="100" placeholder="e.g. Exposed water main by driveway" value="'+esc(old?.label||'')+'"></label>'+
 '<label class="field">Details<textarea name="notes" rows="3" maxlength="1200" placeholder="What needs to happen next?">'+esc(old?.notes||'')+'</textarea></label>'+
 '<div class="form-grid"><label class="field">Latitude<input name="lat" type="number" step="any" value="'+esc(old?.lat??'')+'" placeholder="Optional GPS"></label>'+
 '<label class="field">Longitude<input name="lon" type="number" step="any" value="'+esc(old?.lon??'')+'" placeholder="Optional GPS"></label></div>'+
 '<input type="hidden" name="gpsAccuracy" value="'+esc(old?.gpsAccuracy??'')+'"><input type="hidden" name="gpsSource" value="'+esc(old?.gpsSource||'')+'">'+
 '<button type="button" class="btn ghost" data-be-marker-gps>◎ Use Current GPS (optional)</button><p class="tiny muted" data-be-marker-accuracy>'+(old?.gpsAccuracy?'Saved ±'+esc(old.gpsAccuracy)+' m':'GPS precision not recorded')+'</p>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">Save Marker</button></div></form>');
}
async function markerGps(){
 const form=$('[data-be-marker-form]');if(!form)return;
 try{
  const p=await b()?.getPosition?.();if(!p||!Number.isFinite(+p.lat)||!Number.isFinite(+p.lon))throw Error('No GPS fix available');
  form.elements.lat.value=Number(p.lat).toFixed(6);form.elements.lon.value=Number(p.lon).toFixed(6);
  form.elements.gpsAccuracy.value=Number.isFinite(+p.accuracy)?String(Math.round(p.accuracy)):'';
  form.elements.gpsSource.value='device';
  const label=form.querySelector('[data-be-marker-accuracy]');if(label)label.textContent='Device GPS ±'+Math.round(p.accuracy||0)+' m'+(p.accuracy>25?' · verify accuracy':'');
  notify('Marker location captured. Review it before saving.');
 }catch(e){notify('Unable to capture GPS: '+(e.message||'GPS unavailable'))}
}
function registerUndo(type,jobId,id,before,after,label,extra={}){
 undoRecord={type,jobId,id,before:before==null?null:JSON.parse(JSON.stringify(before)),
  after:after==null?null:JSON.parse(JSON.stringify(after)),label,at:Date.now(),...extra};
 showToast(label);
}
function showToast(label,canNext=false){
 mount();const el=$('#beUndoToast');if(!el)return;
 if(toastTimer)clearTimeout(toastTimer);
 el.hidden=false;el.innerHTML='<span>✓ '+esc(label)+'</span>'+
 (undoRecord?'<button type="button" data-be-undo>↶ Undo</button>':'')+
 (canNext?'<button type="button" data-be-open-next>Next Bore ›</button>':'')+
 '<button type="button" data-be-toast-dismiss aria-label="Dismiss notice">✕</button>';
 toastTimer=setTimeout(clearToast,12000);
}
function clearToast(){const el=$('#beUndoToast');if(el)el.hidden=true;if(toastTimer){clearTimeout(toastTimer);toastTimer=null}undoRecord=null;}
function saveMarker(form){
 if(!actionAllowed())return;const job=active(),list=ensureMarkers(job);if(!list)return notify('Select a job first.');
 const d=new FormData(form),id=String(form.dataset.beId||''),old=list.find(m=>m.id===id);
 const kind=String(d.get('kind')||''),lat=String(d.get('lat')||'').trim(),lon=String(d.get('lon')||'').trim();
 if(!markerKinds.some(k=>k.id===kind))return notify('Select a valid marker type.');
 if((lat&&!lon)||(!lat&&lon))return notify('Provide both coordinates or neither.');
 if(lat&&(!Number.isFinite(+lat)||!Number.isFinite(+lon)||+lat< -90||+lat>90||+lon< -180||+lon>180))return notify('GPS coordinates are outside valid ranges.');
 let accuracy=String(d.get('gpsAccuracy')||''),source=String(d.get('gpsSource')||'');
 if(!lat){accuracy='';source=''}
 else if(old&&(String(old.lat)!==lat||String(old.lon)!==lon)&&source==='device'){accuracy='';source='manual'}
 else if(source!=='device')source='manual';
 const time=now(),record={id:old?.id||b().uid(),recordType:'fieldMarker',jobId:job.id,kind,
  label:String(d.get('label')||'').trim().slice(0,100)||markerKind(kind),notes:String(d.get('notes')||'').trim().slice(0,1200),
  occurredAt:old?.occurredAt||time,createdAt:old?.createdAt||time,updatedAt:time,status:old?.status||'open',
  lat,lon,gpsAccuracy:accuracy.slice(0,16),gpsSource:source};
 if(old)list.splice(list.indexOf(old),1,record);else list.push(record);
 b().state().demo=false;b().save();b().closeModal?.();b().render?.();
 registerUndo('marker',job.id,record.id,old||null,record,old?'Marker updated':'Marker saved');
}
function toggleMarker(id){
 if(!actionAllowed())return;const job=active(),list=jobMarkers(job),old=list.find(m=>m.id===id);if(!old)return;
 const updated={...old,status:old.status==='resolved'?'open':'resolved',updatedAt:now()};
 list.splice(list.indexOf(old),1,updated);b().save();b().render();
 registerUndo('marker',job.id,id,old,updated,updated.status==='resolved'?'Marker resolved':'Marker reopened');
}
function deleteMarker(id){
 if(!actionAllowed())return;const job=active(),list=jobMarkers(job),old=list.find(x=>x.id===id);if(!old)return;
 if(!window.confirm?.('Delete this field marker? You can Undo immediately afterward.'))return;
 job.fieldMarkers=list.filter(m=>m.id!==id);b().save();b().render();
 registerUndo('marker',job.id,id,old,null,'Marker removed');
}
function markerCards(){
 const list=jobMarkers().slice().sort((a,z)=>String(z.updatedAt||z.occurredAt).localeCompare(String(a.updatedAt||a.occurredAt)));
 return '<section class="be-card"><div class="be-panel-head"><div><h3>Field Markers 2.0</h3><small>Obstructions, utility crossings and follow-up items</small></div><button type="button" class="be-primary" data-be-new-marker>＋ Marker</button></div>'+
 '<p class="tiny muted">These are work reminders, not installed asset records or surveyed utility locates. GPS-marked items also appear in Field Atlas.</p>'+
 (list.length?'<div class="be-markers">'+list.map(m=>'<article class="be-marker"><span class="be-marker-icon">'+(markerKinds.find(k=>k.id===m.kind)?.icon||'!')+'</span>'+
 '<div><strong>'+esc(m.label||markerKind(m.kind))+'</strong><small>'+esc(markerKind(m.kind))+' · '+(m.status==='resolved'?'✓ Resolved':'Open')+' · '+esc(dayOf(m.occurredAt))+(valid(m)?' · GPS saved':' · No GPS')+'</small>'+
 (m.notes?'<p>'+esc(m.notes)+'</p>':'')+'</div>'+
 '<div class="be-marker-actions"><button data-be-marker-edit="'+esc(m.id)+'">Edit</button><button data-be-marker-toggle="'+esc(m.id)+'">'+(m.status==='resolved'?'Reopen':'Resolve')+'</button><button data-be-marker-delete="'+esc(m.id)+'">Delete</button></div></article>').join('')+'</div>':
 '<p class="be-empty">No field markers yet. Create one when you need to flag an obstruction, crossing or return visit.</p>')+'</section>';
}
function unassignedPhotos(){
 const job=active(),state=b()?.state?.()||{};
 if(!job)return[];
 return allPhotos().filter(p=>(p.jobId||state.legacyJobId||state.activeJobId)===job.id&&!p.shotId&&!p.fieldPinId)
 .sort((a,z)=>String(z.addedAt||'').localeCompare(String(a.addedAt||'')));
}
function photoInbox(){
 const items=unassignedPhotos();
 return '<section class="be-card"><div class="be-panel-head"><div><h3>Photo Inbox</h3><small>'+items.length+' unassigned jobsite photo'+(items.length===1?'':'s')+'</small></div><button class="be-primary" data-be-photo>▣ Camera</button></div>'+
 '<p class="tiny muted">BoreLab suggests photos based on saved GPS (within 75 m) or same-day evidence without a GPS match. You approve every link; original photo data is untouched.</p>'+
 (items.length?'<div class="be-inbox">'+items.slice(0,45).map(photo=>{
  const choices=ab()?.candidateRecords?.(photo)||[];
  return '<article class="be-inbox-photo"><button type="button" data-be-photo-open="'+esc(photo.id)+'" aria-label="Review photo"><img src="'+esc(photo.dataUrl||'')+'" loading="lazy" alt="Unassigned field photo"></button>'+
  '<div><strong>'+esc(new Date(photo.addedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))+'</strong>'+
  '<small>'+((photo.lat!=null&&photo.lon!=null)?'⌖ GPS saved':'Location not recorded')+'</small>'+
  '<div class="be-link-choices">'+(choices.length?choices.slice(0,3).map(c=>
   '<button type="button" data-be-photo-link="'+esc(photo.id)+'" data-be-photo-target="'+esc(c.type+':'+c.id)+'" aria-label="Approve link to '+esc(c.label)+'">✓ Link '+esc(c.label)+(c.distance!=null?' · '+Math.round(c.distance)+' m':' · Same day')+'</button>').join(''):
   '<small>No nearby or same-day records found. Keep it unassigned until the correct record is known.</small>')+'</div></div></article>'
 }).join('')+'</div>':'<p class="be-empty">All current job photos are assigned. Nice work! New general photos will appear here.</p>')+'</section>';
}
async function linkInboxPhoto(photoId,target){
 if(!actionAllowed())return;const photo=allPhotos().find(p=>p.id===photoId);
 if(!photo||photo.shotId||photo.fieldPinId)return notify('Photo was already assigned. Refresh the inbox.');
 const candidate=ab()?.candidateRecords?.(photo)?.find(c=>c.type+':'+c.id===target);
 if(!candidate)return notify('This record is not a current suggestion. Refresh to verify the match.');
 const updated={...photo,shotId:candidate.type==='shot'?candidate.id:'',
  fieldPinId:candidate.type==='pin'?candidate.id:'',
  linkSource:'foreman-confirmed',linkedAt:now()};
 try{
  await b()?.photoDB?.('put',updated);await b()?.refreshPhotos?.();b()?.render?.();
  registerUndo('photo',photo.jobId||b().state().activeJobId,photo.id,photo,updated,'Photo linked to '+candidate.label);
 }catch(e){notify('Photo was not linked: '+(e.message||String(e)))}
}
async function undo(){
 if(!actionAllowed())return;
 const entry=undoRecord;if(!entry)return notify('No recent action to undo.');
 if(Date.now()-entry.at>12000){clearToast();return notify('Undo window ended. Review the record manually.')}
 if(entry.type==='bore'){
  const journal=(b()?.state?.()?.fieldRecovery||[]).find(x=>x.id===entry.id&&!x.undone);
  if(!journal)return clearToast();
  await window.BoreLabFieldOps?.undo?.(entry.id,true);
  clearToast();return;
 }
 const job=(b()?.state?.()?.jobs||[]).find(x=>x.id===entry.jobId);
 if(!job){clearToast();return notify('Job changed; undo is unavailable.')}
 if(entry.type==='photo'){
  const actual=allPhotos().find(p=>p.id===entry.id);
  if(!actual||JSON.stringify(actual)!==JSON.stringify(entry.after))return notify('Photo was updated again. Undo blocked.');
  try{await b().photoDB('put',entry.before);await b().refreshPhotos();b().render();clearToast();notify('Photo assignment restored.')}catch(e){notify('Could not undo: '+e.message)}
  return;
 }
 const name=entry.type==='marker'?'fieldMarkers':entry.type==='arrival'?'arrivalLog':entry.type==='note'?'quickNotes':null;
 if(!name)return;
 const list=Array.isArray(job[name])?job[name]:[],actual=list.find(x=>x.id===entry.id);
 if(JSON.stringify(actual||null)!==JSON.stringify(entry.after||null))return notify('This record was changed again. Undo blocked to protect newer work.');
 if(entry.before){
  if(actual)list.splice(list.indexOf(actual),1,entry.before);else list.push(entry.before);
 }else if(actual)list.splice(list.indexOf(actual),1);
 job[name]=list;b().save();b().render();clearToast();notify('Previous record restored.');
}
function offerSaveNext(jobId,shotId,kind='completed'){
 if(!actionAllowed())return;
 const job=(b()?.state?.()?.jobs||[]).find(j=>j.id===jobId),next=job?.shots?.find(x=>x.status!=='complete'&&x.id!==shotId);
 const journal=(b()?.state?.()?.fieldRecovery||[]).slice().reverse().find(x=>x.shotId===shotId&&x.jobId===jobId&&!x.undone);
 if(journal)undoRecord={type:'bore',jobId,shotId,id:journal.id,before:null,after:null,label:'Bore saved',at:Date.now()};
 else undoRecord=null;
 if(next)showToast((kind==='completed'?'Bore completed':'Bore saved')+' · Next: '+(next.name||'Bore'),true);
 else showToast((kind==='completed'?'Bore completed':'Bore saved')+' · no other pending bores',false);
}
function nextFromToast(){
 const entry=undoRecord,job=(b()?.state?.()?.jobs||[]).find(j=>j.id===entry?.jobId)||active();
 const next=job?.shots?.find(x=>x.status!=='complete'&&x.id!==entry?.shotId);
 clearToast();
 if(!next)return notify('No pending bore found.');
 if(job.id!==b()?.state?.()?.activeJobId&&b()?.switchActiveJob?.(job.id)===false)return;
 b()?.shotDetail?.(next.id);
}
function markArrival(){
 if(!actionAllowed())return;
 const job=active();if(!job)return notify('Choose a job before checking in at the site.');
 if(lastArrival(job))return notify('Arrival already recorded for this job today.');
 const record={id:b().uid(),jobId:job.id,at:now(),recordType:'jobArrival',method:'manual'};
 if(!Array.isArray(job.arrivalLog))job.arrivalLog=[];
 job.arrivalLog.push(record);b().state().demo=false;b().save();b().render();
 registerUndo('arrival',job.id,record.id,null,record,'Arrival marked at '+todayTime(record.at));
}
async function arrivalGps(){
 const job=active(),old=lastArrival(job);if(!old)return notify('Tap I’m Here before attaching an arrival GPS point.');
 try{
  const gps=await b().getPosition();if(!gps||!Number.isFinite(Number(gps.lat))||!Number.isFinite(Number(gps.lon)))throw Error('GPS unavailable');
  const updated={...old,lat:Number(gps.lat).toFixed(6),lon:Number(gps.lon).toFixed(6),gpsAccuracy:Number.isFinite(Number(gps.accuracy))?Math.round(gps.accuracy):'',gpsSource:'device'};
  const list=job.arrivalLog;list.splice(list.indexOf(old),1,updated);
  b().save();b().render();registerUndo('arrival',job.id,old.id,old,updated,'Arrival GPS saved'+(Number(gps.accuracy)>25?' · verify accuracy':''));
 }catch(e){notify('Arrival GPS not saved: '+(e.message||String(e)))}
}
function storyEvents(dayValue){
 const scope=ab()?.getScope?.()||'job';
 if(!ab()?.allEvents)return[];
 ab()?.setScope?.('all');
 let list=[];try{list=(ab()?.allEvents?.()||[]).filter(e=>e.day===dayValue&&e.jobId===active()?.id)}finally{ab()?.setScope?.(scope)}
 return list.sort((a,z)=>String(a.when||'').localeCompare(String(z.when||'')));
}
function storyData(dayValue=storyDay){
 const job=active(),events=storyEvents(dayValue);
 const ids=new Set(),completed=[];
 for(const e of events){
  if(e.type==='shot'&&e.extra==='Bore completed'&&!ids.has(e.record.id)){ids.add(e.record.id);completed.push(e.record)}
 }
 const feet=completed.reduce((n,s)=>n+Math.max(0,Number(s.feet)||0),0);
 const photos=events.filter(e=>e.type==='photo'),markers=events.filter(e=>e.type==='marker');
 return {job,day:dayValue,events,completed,feet,photos,markers};
}
function storyText(dayValue=storyDay){
 const s=storyData(dayValue);
 const header=['BORELAB FIELD · FIELD DAY STORY','Job: '+(s.job?.jobName||'Active Job'),'Date: '+s.day,
  'Bores completed: '+s.completed.length,'Completed footage: '+fmt(s.feet)+' ft',
  'Saved photos: '+s.photos.length,'Field markers: '+s.markers.length,''];
 const timeline=s.events.map(e=>
 (String(e.when||'').includes('T')?todayTime(e.when):'Time not recorded')+
 ' | '+e.title+' | '+(e.extra||e.type)+
 (e.type==='note'&&e.record?.text?' — '+e.record.text:'')+
 (e.type==='marker'&&e.record?.notes?' — '+e.record.notes:''));
 return header.concat('CHRONOLOGICAL FIELD RECORD',...(timeline.length?timeline:['No saved field activity recorded this day.']),
  '','Created from saved BoreLab records only. Not an engineered bore alignment, surveyed utility map, or regulatory sign-off.').join('\n');
}
function dayStory(){
 const s=storyData(),shots=s.completed.length;
 return '<section class="be-card"><div class="be-panel-head"><div><h3>Field Day Story</h3><small>A dated, shareable timeline of documented work</small></div><span class="be-tag">Offline</span></div>'+
 '<label class="field">Report date<input type="date" data-be-story-date value="'+esc(storyDay)+'"></label>'+
 '<div class="be-story-metrics"><div><small>Completed bores</small><strong>'+shots+'</strong></div><div><small>Completed footage</small><strong>'+fmt(s.feet)+' ft</strong></div><div><small>Photos</small><strong>'+s.photos.length+'</strong></div></div>'+
 '<p class="tiny muted">Preview before sharing. Only the current job is included. Image thumbnails stay inside BoreLab; export a day PDF for photo evidence.</p>'+
 '<div class="be-story-events">'+(s.events.length?s.events.slice(0,75).map(e=>'<div><time>'+esc(String(e.when||'').includes('T')?todayTime(e.when):'Date only')+'</time>'+
 '<span><strong>'+esc(e.title)+'</strong><small>'+esc(e.extra||e.type)+(e.type==='marker'?' · '+esc(e.record?.label||''):'')+'</small></span></div>').join(''):
 '<p class="be-empty">No recorded work for this date.</p>')+'</div>'+
 '<div class="be-action-row"><button type="button" class="be-primary" data-be-story-save>▤ Save Story TXT</button><button type="button" class="be-outline" data-be-story-copy>Copy Summary</button><button type="button" class="be-outline" data-be-story-pdf>Export Day PDF</button></div></section>';
}
function downloadStory(){
 if(!actionAllowed())return;
 const content=storyText(),name='BoreLab_Field_Story_'+storyDay+'.txt';
 try{
  const blob=new Blob([content],{type:'text/plain;charset=utf-8'});
  if(window.BoreLabNative?.saveBase64File){
   const reader=new FileReader();
   reader.onload=()=>{const base64=String(reader.result||'').split(',')[1];if(base64)window.BoreLabNative.saveBase64File(name,'text/plain',base64)};
   reader.readAsDataURL(blob);
  }else{
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  notify('Field Day Story prepared. Choose where to save it.');
 }catch(e){notify('Could not export story: '+(e.message||String(e)))}
}
async function copyStory(){
 if(!actionAllowed())return;
 try{
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(storyText());
  else{
   const area=document.createElement('textarea');area.value=storyText();area.style.position='fixed';area.style.left='-9999px';
   document.body.appendChild(area);area.select();
   if(!document.execCommand?.('copy'))throw Error('Clipboard unavailable on this device');
   area.remove();
  }
  notify('Story copied. Review before sharing.');
 }catch(e){notify('Copy unavailable. Use Save Story TXT instead.')}
}
function renderHub(){
 return '<div class="page be-hub"><div class="be-hub-title"><span class="eyebrow">BORELAB / ONE-HANDED FIELD CONTROL</span><h1>Field Hub</h1><p class="smalltext muted">Field markers, photo organization, a manual arrival check-in and shareable daily activity. All saved to the existing job.</p></div>'+
 '<div class="be-hub-tabs" role="group" aria-label="Field Hub sections">'+
 [['arrival','⌖ Arrival'],['markers','⚠ Markers'],['inbox','▣ Photo Inbox'],['story','▤ Day Story']].map(([key,label])=>
 '<button type="button" data-be-hub-tab="'+key+'" class="'+(hubTab===key?'selected':'')+'" aria-pressed="'+(hubTab===key)+'">'+label+(key==='inbox'&&countUnassigned()?' · '+countUnassigned():'')+'</button>').join('')+'</div>'+
 (hubTab==='arrival'?arrivalCard():hubTab==='markers'?markerCards():hubTab==='inbox'?photoInbox():dayStory())+
 '<p class="tiny muted">BoreLab keeps field data on this device. Back up your work regularly. GPS points and markers are not surveyed locations.</p></div>';
}
function navigateHub(tab){
 hubTab=['arrival','markers','inbox','story'].includes(tab)?tab:'markers';
 closePeek();b()?.setPage?.('fieldhub');
}
function pageActions(page){
 if(['fieldhistory','jobmap'].includes(page))return [
  {id:'gps',icon:'⌖',title:'GPS Installation Pin',sub:'Existing tie-in, coupling or box'},
  {id:'marker',icon:'⚠',title:'Field Marker',sub:'Obstruction or follow-up'},
  {id:'photo',icon:'▣',title:'Quick Photo & Pin',sub:'Camera and installation photo'},
  {id:'inbox',icon:'▤',title:'Photo Inbox',sub:countUnassigned()+' unassigned photos'}];
 if(['planner','shotboard','shotcards','job'].includes(page))return [
  {id:'bore',icon:'⌁',title:'New Bore',sub:'Plan next shot'},
  {id:'progress',icon:'☷',title:'Log Bore Progress',sub:'Open current bore'},
  {id:'finish',icon:'✓',title:'Complete Bore',sub:'Confirm log and pipe'},
  {id:'marker',icon:'⚠',title:'Add Field Marker',sub:'Obstruction or follow-up'}];
 if(['photos','phototimeline2','photosmart'].includes(page))return [
  {id:'photo',icon:'▣',title:'Take Photo',sub:'Camera and record link'},
  {id:'inbox',icon:'▤',title:'Photo Inbox',sub:countUnassigned()+' unassigned photos'},
  {id:'story',icon:'▤',title:'Field Day Story',sub:'Review daily photos and timeline'},
  {id:'note',icon:'✎',title:'Quick Note',sub:'Save an observation'}];
 return [{id:'bore',icon:'⌁',title:'New Bore',sub:'Plan next shot'},
  {id:'photo',icon:'▣',title:'Quick Photo & Pin',sub:'Camera and record link'},
  {id:'marker',icon:'⚠',title:'Field Marker',sub:'Obstruction or follow-up'},
  {id:'arrival',icon:'⌖',title:'Jobsite Arrival',sub:lastArrival()?'✓ Marked today':'Manual check-in'}];
}
function action(id){
 if(!actionAllowed())return;
 if(id==='marker')return markerForm();
 if(id==='inbox')return navigateHub('inbox');
 if(id==='story')return navigateHub('story');
 if(id==='arrival')return navigateHub('arrival');
 if(id==='progress'){const shot=currentShot();if(shot)return b()?.shotDetail?.(shot.id);return notify('No active or planned bore. Add a bore first.')}
 if(id==='finish'){const shot=currentShot(),job=active();if(!shot)return notify('No pending bore available for completion.');return window.BoreLabFieldOps?.beginCompletion?.(job.id,shot.id)}
}
document.addEventListener('pointerdown',event=>{
 const tab=event.target.closest?.('.bf-edge-tab');
 if(!tab||!roleOK()||$('#modalRoot .modal-backdrop'))return;
 edgeGesture={id:event.pointerId,x:event.clientX,y:event.clientY,
  at:Date.now(),moved:false,vertical:false,long:false};
 releaseTimer();
 holdTimer=setTimeout(()=>{
  if(!edgeGesture||edgeGesture.id!==event.pointerId||edgeGesture.moved)return;
  edgeGesture.long=true;suppressClickUntil=Date.now()+850;openPeek('favorites');
 },570);
},{passive:true});
document.addEventListener('pointermove',event=>{
 const g=edgeGesture;if(!g||event.pointerId!==g.id)return;
 const dx=event.clientX-g.x,dy=event.clientY-g.y;
 if(Math.abs(dx)>13||Math.abs(dy)>13){g.moved=true;releaseTimer()}
 if(Math.abs(dy)>23&&Math.abs(dy)>Math.abs(dx)+9){
  g.vertical=true;
  const h=window.innerHeight||700;setEdgePosition(Math.max(18,Math.min(88,event.clientY/h*100)));
 }
},{passive:true});
document.addEventListener('pointerup',event=>{
 const g=edgeGesture;if(!g||event.pointerId!==g.id)return;
 edgeGesture=null;releaseTimer();
 if(g.long||g.vertical){suppressClickUntil=Date.now()+850;return}
 const dx=g.x-event.clientX,dy=Math.abs(g.y-event.clientY);
 if(dx>=32&&dy<65){
  suppressClickUntil=Date.now()+850;
  if(dx>130){closePeek();window.BoreLabNavigation?.open?.()}
  else openPeek('glance');
 }
},{passive:true});
document.addEventListener('pointercancel',()=>{edgeGesture=null;releaseTimer()},{passive:true});
document.addEventListener('click',event=>{
 const x=event.target.closest?.('[data-be-peek-close],[data-be-full-menu],[data-be-favorites-customize],[data-be-favorite-pick],[data-be-undo],[data-be-open-next],[data-be-toast-dismiss],[data-be-arrive],[data-be-arrival-gps],[data-be-new-marker],[data-be-marker-edit],[data-be-marker-toggle],[data-be-marker-delete],[data-be-marker-gps],[data-be-hub-tab],[data-be-photo],[data-be-photo-open],[data-be-photo-link],[data-be-story-save],[data-be-story-copy],[data-be-story-pdf]');
 if(!x)return;
 if(x.hasAttribute('data-be-peek-close')){closePeek();return}
 if(x.hasAttribute('data-be-full-menu')){closePeek();window.BoreLabNavigation?.open?.();return}
 if(x.hasAttribute('data-be-favorites-customize')){customizing=!customizing;$('#bePeek').innerHTML=renderPeek();return}
 if(x.dataset.beFavoritePick){
  const id=x.dataset.beFavoritePick;if(!favoriteOptions.some(f=>f.id===id))return;
  if(favorites.includes(id))favorites=favorites.filter(x=>x!==id);
  else favorites=[...favorites.slice(-2),id];
  if(!favorites.length)favorites=favDefaults.slice();
  safeWrite(FAVORITES,favorites);$('#bePeek').innerHTML=renderPeek();return;
 }
 if(x.hasAttribute('data-be-undo')){undo();return}
 if(x.hasAttribute('data-be-open-next')){nextFromToast();return}
 if(x.hasAttribute('data-be-toast-dismiss')){clearToast();return}
 if(!actionAllowed())return;
 if(x.hasAttribute('data-be-arrive')){markArrival();return}
 if(x.hasAttribute('data-be-arrival-gps')){arrivalGps();return}
 if(x.hasAttribute('data-be-new-marker')){closePeek();markerForm();return}
 if(x.dataset.beMarkerEdit){markerForm(x.dataset.beMarkerEdit);return}
 if(x.dataset.beMarkerToggle){toggleMarker(x.dataset.beMarkerToggle);return}
 if(x.dataset.beMarkerDelete){deleteMarker(x.dataset.beMarkerDelete);return}
 if(x.hasAttribute('data-be-marker-gps')){markerGps();return}
 if(x.dataset.beHubTab){hubTab=x.dataset.beHubTab;b()?.render?.();return}
 if(x.hasAttribute('data-be-photo')){closePeek();b()?.photoChoose?.('camera');return}
 if(x.dataset.bePhotoOpen){b()?.photoDetail?.(x.dataset.bePhotoOpen);return}
 if(x.dataset.bePhotoLink){linkInboxPhoto(x.dataset.bePhotoLink,x.dataset.bePhotoTarget);return}
 if(x.hasAttribute('data-be-story-save')){downloadStory();return}
 if(x.hasAttribute('data-be-story-copy')){copyStory();return}
 if(x.hasAttribute('data-be-story-pdf')){ab()?.exportAsBuilt?.(storyDay);return}
});
document.addEventListener('submit',event=>{
 const form=event.target.closest?.('[data-be-marker-form]');
 if(!form)return;
 event.preventDefault();saveMarker(form);
});
document.addEventListener('change',event=>{
 if(event.target.matches?.('[data-be-story-date]')){
  storyDay=/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)?event.target.value:day();b()?.render?.();
 }
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&peek){event.preventDefault();event.stopImmediatePropagation?.();closePeek()}
},{capture:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
window.BoreLabEdgeV22={mount,sync,renderHub,homeArrival,arrivalCard,openPeek,closePeek,isPeekOpen:()=>peek,
 handleTabClick,setEdgePosition,getEdgePosition:()=>position,getFavorites:()=>favorites.slice(),pageActions,
 navigateHub,markerForm,saveMarker,jobMarkers,markerKind,markerKinds,markerGps,toggleMarker,deleteMarker,
 photoInbox,unassignedPhotos,linkInboxPhoto,markArrival,arrivalGps,lastArrival,
 storyData,storyEvents,storyText,dayStory,downloadStory,copyStory,offerSaveNext,registerUndo,undo,action,
 currentShot,pendingShot,countUnassigned,renderPeek,renderPeekContent:peekSummary,getHubTab:()=>hubTab};
})();