/* BoreLab Field v0.25 — unified photo/video vault.
   Existing photos remain in IndexedDB. New videos live in native app-private files. */
(function(){
'use strict';
const bridge=()=>window.BoreLabAssistantBridge;
const native=()=>window.BoreLabNative;
const state=()=>bridge()?.state?.()||{};
const job=()=>bridge()?.activeJob?.()||{};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const videos=()=>Array.isArray(state().mediaVideos)?state().mediaVideos:[];
const photos=()=>bridge()?.photos?.()||[];
const receipts=()=>window.BoreLabReceiptsV33?.records?.()||[];
function thumbnail(r){
 if(r.mediaType==='photo')return '<img loading="lazy" src="'+esc(r.dataUrl||'')+'" alt="Saved field photo">';
 if(r.mediaType==='receipt')return r.mime==='application/pdf'?'<div class="v25-receipt-tile"><strong>▤</strong><small>PDF RECEIPT</small></div>':'<img loading="lazy" src="'+esc(r.dataUrl||'')+'" alt="Saved purchase receipt">';
 return '<div class="v25-video-tile"><video preload="metadata" muted playsinline src="'+esc(r.uri||'')+'"></video><span class="v25-play">▶</span></div>';
}
const size=n=>Number(n)>=1048576?(Number(n)/1048576).toFixed(1)+' MB':(Number(n||0)/1024).toFixed(0)+' KB';
const day=x=>x?new Date(x).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Unknown date';
const unlocked=()=>!!bridge()&&(!window.BoreLabLocalAccounts||window.BoreLabLocalAccounts.isUnlocked?.());
const editable=()=>unlocked()&&(!window.BoreLabLocalAccounts||['owner','foreman','supervisor'].includes(window.BoreLabLocalAccounts.role?.()));
let filter='all',search='',pending=null;
const owns=x=>x.jobId===state().activeJobId||(!x.jobId&&x.legacyJobId===state().legacyJobId);
const jobVideos=()=>videos().filter(owns);
const jobPhotos=()=>photos().filter(p=>p.jobId===state().activeJobId||(!p.jobId&&state().legacyJobId===state().activeJobId));
function records(){
 const ps=jobPhotos().map(p=>({...p,mediaType:'photo',description:p.notes||p.caption||'',date:p.addedAt,sortKey:p.addedAt||''}));
 const vs=jobVideos().map(v=>({...v,mediaType:'video',description:v.notes||'',date:v.addedAt,sortKey:v.addedAt||''}));
 const rs=receipts().map(r=>({...r,mediaType:'receipt',description:[r.vendor,r.notes,r.receiptDate,r.amount,r.name].filter(Boolean).join(' '),date:r.receiptDate||r.addedAt,sortKey:r.addedAt||''}));
 return [...ps,...vs,...rs].filter(x=>{
  if(filter==='photos'&&x.mediaType!=='photo')return false;
  if(filter==='videos'&&x.mediaType!=='video')return false;
  if(filter==='receipts'&&x.mediaType!=='receipt')return false;
  if(filter==='unlinked'&&(x.shotId||x.fieldPinId))return false;
  const sh=(job().shots||[]).find(q=>q.id===x.shotId),pin=(job().fieldPins||[]).find(q=>q.id===x.fieldPinId);
  return !search||[x.description,x.mediaType,sh?.name,pin?.name,day(x.date)].join(' ').toLowerCase().includes(search.toLowerCase());
 }).sort((a,b)=>String(b.sortKey).localeCompare(String(a.sortKey)));
}
const titleFor=r=>(job().shots||[]).find(s=>s.id===r.shotId)?.name||
 (job().fieldPins||[]).find(p=>p.id===r.fieldPinId)?.name||'General jobsite media';
function render(){
 const all=records(),total=jobPhotos().length+jobVideos().length+receipts().length;
 return '<div class="page v25-vault"><span class="eyebrow">FIELD / MEDIA EVIDENCE</span><h1>Media Vault</h1>'+
 '<p class="smalltext muted">Job photos, videos and receipts in one searchable library. Saved files stay on this device until you export them.</p>'+
 '<div class="v25-actions"><button class="btn primary" data-action="choose-photo">▣ Take Photo</button>'+
 '<button class="btn ghost" data-action="choose-gallery">＋ Add Photo</button>'+ 
 (editable()?'<button type="button" class="btn ghost" data-b33-receipt-camera>▣ Scan Receipt</button><button type="button" class="btn ghost" data-b33-receipt-upload>＋ Upload Receipt</button>':'')+
 (editable()?'<button class="btn primary" data-v25-record>● Record Video</button><button class="btn ghost" data-v25-import>＋ Add Video</button>':'')+
 '<button class="btn ghost" data-page="phototimeline2">☷ Photo Timeline</button></div>'+
 '<div class="v25-summary"><strong>'+total+' media records</strong><small>'+jobPhotos().length+' photos · '+jobVideos().length+' videos · '+receipts().length+' receipts · Active job</small></div>'+
 '<div class="v25-filters"><label>Show<select data-v25-filter>'+[['all','All media'],['photos','Photos'],['videos','Videos'],['receipts','Receipts'],['unlinked','Unlinked']].map(([v,l])=>'<option value="'+v+'"'+(filter===v?' selected':'')+'>'+l+'</option>').join('')+'</select></label>'+
 '<label>Find<input type="search" data-v25-search value="'+esc(search)+'" placeholder="Shot, location or note"></label></div>'+
 '<div class="v25-media-grid">'+(all.length?all.slice(0,250).map(r=>
 '<button type="button" class="v25-media-card" data-v25-open="'+esc(r.id)+'" data-v25-type="'+r.mediaType+'">'+
 thumbnail(r)+
 '<span class="v25-media-info"><strong>'+esc(r.mediaType==='receipt'?(r.vendor||r.name||'Receipt'):titleFor(r))+'</strong><small>'+esc(r.mediaType==='receipt'?'RECEIPT':r.mediaType==='video'?'VIDEO · '+size(r.bytes):'PHOTO · '+String(r.stage||'Field'))+' · '+esc(r.mediaType==='receipt'?(r.receiptDate||'Unknown date'):day(r.date))+'</small></span></button>').join(''):
 '<p class="v25-empty">No media matches this view. Add a job photo, field video or receipt to start.</p>')+'</div>'+
 (all.length>250?'<p class="smalltext muted">Showing the latest 250 matches. Narrow your search to view more.</p>':'')+
 '<div class="v25-warning">Videos live in app-private files and are not included in JSON backups. Receipt photos and PDFs are included in new BoreLab JSON backups. Save important videos separately.</div>'+
 '<p class="tiny muted">Recording a utility concern does not replace notifications to the locator, superintendent, or required safety procedures.</p></div>';
}
function begin(kind,shotId='',fieldPinId=''){
 if(!editable())return bridge()?.notify?.('Only authorized field staff can add videos.');
 if(typeof native()?.importFieldVideo!=='function')return bridge()?.notify?.('Video import requires the installed Android BoreLab app.');
 pending={jobId:state().activeJobId,shotId,fieldPinId,kind};
 try{
  if(kind==='record'&&typeof native().recordFieldVideo==='function')native().recordFieldVideo();
  else native().importFieldVideo();
 }catch(err){pending=null;bridge()?.notify?.('Video picker unavailable: '+String(err.message||err))}
}
function onVideoImported(payload){
 const ctx=pending;pending=null;
 if(!ctx)return bridge()?.notify?.('Video transfer finished without an active job selection.');
 if(payload?.error)return bridge()?.notify?.('Video could not be saved: '+String(payload.error));
 if(!payload||!/^[-a-f0-9]{36}$/i.test(String(payload.id||''))||!String(payload.uri||'').startsWith('content://com.borelab.field.manuals/'))
  return bridge()?.notify?.('Video metadata was rejected.');
 if(!Array.isArray(state().mediaVideos))state().mediaVideos=[];
 if(videos().some(v=>v.id===payload.id))return;
 const record={id:payload.id,jobId:ctx.jobId,shotId:ctx.shotId,fieldPinId:ctx.fieldPinId,
  mime:String(payload.mime||'video/mp4').slice(0,70),uri:payload.uri,bytes:Number(payload.bytes)||0,
  addedAt:payload.addedAt||new Date().toISOString(),notes:'',source:ctx.kind};
 state().mediaVideos.push(record);
 bridge()?.save?.();
 // Location is best-effort: preserve the video even if GPS is denied or unavailable.
 Promise.resolve().then(()=>bridge()?.getPosition?.()).then(pos=>{
  if(!pos||!Number.isFinite(pos.lat)||!Number.isFinite(pos.lon))return;
  const stored=videos().find(x=>x.id===record.id);if(!stored)return;
  stored.lat=Number(pos.lat);stored.lon=Number(pos.lon);stored.gpsAccuracy=Number(pos.accuracy)||null;
  bridge()?.save?.();
 }).catch(()=>{});
 if(ctx.jobId===state().activeJobId)bridge()?.setPage?.('photos');
 bridge()?.notify?.('Field video saved offline and linked to '+(ctx.shotId?'bore':ctx.fieldPinId?'map marker':'job')+'.');
}
function view(id,type){
 if(type==='photo'){bridge()?.photoDetail?.(id);return}
 if(type==='receipt'){window.BoreLabReceiptsV33?.view?.(id);return}
 const r=jobVideos().find(x=>x.id===id);if(!r)return;
 bridge()?.showModal?.('<div class="modal-head"><h2>Field Video</h2><button class="icon-btn" data-action="close-modal">✕</button></div>'+
 '<video class="v25-video-player" src="'+esc(r.uri)+'" controls playsinline preload="metadata"></video>'+
 '<p class="smalltext"><strong>'+esc(titleFor(r))+'</strong> · '+esc(day(r.addedAt))+' · '+esc(size(r.bytes))+'</p>'+
 '<p class="smalltext">'+esc(r.notes||'No notes recorded')+'</p>'+ 
 (Number.isFinite(r.lat)&&Number.isFinite(r.lon)?'<p class="tiny muted">GPS: '+esc(r.lat.toFixed(6))+', '+esc(r.lon.toFixed(6))+(Number.isFinite(r.gpsAccuracy)?' · ±'+esc(Math.round(r.gpsAccuracy))+' m':'')+'</p>':'<p class="tiny muted">GPS not recorded</p>')+
 '<div class="action-row"><button type="button" class="btn ghost" data-v25-export="'+esc(id)+'">⇧ Export Video</button>'+
 (editable()?'<button type="button" class="btn primary" data-v25-edit="'+esc(id)+'">✎ Edit Details</button><button class="btn ghost danger" data-v25-delete="'+esc(id)+'">Delete</button>':'')+'</div>');
}
function edit(id){
 const r=jobVideos().find(x=>x.id===id);if(!r||!editable())return;
 const opts=(items,current,defaultLabel)=>'<option value="">'+defaultLabel+'</option>'+items.map(x=>
 '<option value="'+esc(x.id)+'"'+(x.id===current?' selected':'')+'>'+esc(x.name||'Untitled')+'</option>').join('');
 bridge()?.showModal?.('<div class="modal-head"><h2>Edit Video Details</h2><button class="icon-btn" data-action="close-modal">✕</button></div>'+
 '<form data-v25-video-form="'+esc(id)+'"><label class="field">Bore<select name="shotId">'+opts(job().shots||[],r.shotId,'General / no bore')+'</select></label>'+
 '<label class="field">Map marker<select name="fieldPinId">'+opts(job().fieldPins||[],r.fieldPinId,'No field marker')+'</select></label>'+
 '<label class="field">Notes<textarea name="notes" rows="4" maxlength="2000">'+esc(r.notes||'')+'</textarea></label>'+
 '<p class="tiny muted">Choose a bore or field marker (not both) to keep this evidence associated with the right record.</p>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">Save Video Details</button></div></form>');
}
function saveDetails(form){
 const r=jobVideos().find(x=>x.id===form.dataset.v25VideoForm);if(!r||!editable())return;
 const d=new FormData(form),shotId=String(d.get('shotId')||''),fieldPinId=String(d.get('fieldPinId')||'');
 if(shotId&&fieldPinId)return bridge()?.notify?.('Link the clip to either a bore or marker, not both.');
 if(shotId&&!(job().shots||[]).some(x=>x.id===shotId)||fieldPinId&&!(job().fieldPins||[]).some(x=>x.id===fieldPinId))
  return bridge()?.notify?.('Selected job record no longer exists.');
 r.shotId=shotId;r.fieldPinId=fieldPinId;r.notes=String(d.get('notes')||'').trim().slice(0,2000);
 r.updatedAt=new Date().toISOString();bridge()?.save?.();bridge()?.closeModal?.();bridge()?.render?.();
 bridge()?.notify?.('Video description and link saved.');
}
function remove(id){
 if(!editable())return;
 const r=jobVideos().find(x=>x.id===id);
 if(!r||!confirm('Permanently remove this video from this device? This cannot be undone.'))return;
 if(!native()?.deleteFieldVideo?.(r.id))return bridge()?.notify?.('Video file could not be deleted; its record was preserved.');
 state().mediaVideos=videos().filter(x=>x.id!==id);
 bridge()?.save?.();bridge()?.closeModal?.();bridge()?.render?.();bridge()?.notify?.('Video deleted.');
}
document.addEventListener('click',e=>{
 const el=e.target.closest?.('[data-v25-record],[data-v25-import],[data-v25-open],[data-v25-edit],[data-v25-delete],[data-v25-export],[data-v25-video-shot]');
 if(!el)return;
 if(el.hasAttribute('data-v25-record'))return begin('record');
 if(el.hasAttribute('data-v25-import'))return begin('import');
 if(el.dataset.v25VideoShot)return begin('record',el.dataset.v25VideoShot);
 if(el.dataset.v25Open)return view(el.dataset.v25Open,el.dataset.v25Type);
 if(el.dataset.v25Edit)return edit(el.dataset.v25Edit);
 if(el.dataset.v25Delete)return remove(el.dataset.v25Delete);
 if(el.dataset.v25Export){
  const r=jobVideos().find(v=>v.id===el.dataset.v25Export);if(r)native()?.shareFieldVideo?.(r.uri);
 }
});
document.addEventListener('change',e=>{if(e.target.matches?.('[data-v25-filter]')){filter=e.target.value;bridge()?.render?.()}});
document.addEventListener('input',e=>{if(e.target.matches?.('[data-v25-search]')){search=String(e.target.value||'').slice(0,100);
 const pos=e.target.selectionStart;bridge()?.render?.();const input=document.querySelector('[data-v25-search]');input?.focus?.();
 if(input&&pos!=null)try{input.setSelectionRange(pos,pos)}catch{}}});
document.addEventListener('submit',e=>{const f=e.target.closest?.('[data-v25-video-form]');if(!f)return;e.preventDefault();saveDetails(f)});
window.BoreLabMediaV25={render,begin,onVideoImported,records,jobVideos,saveDetails,view};
})();