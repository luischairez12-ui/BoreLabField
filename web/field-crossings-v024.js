/* BoreLab Field 0.24 — Utility Crossing Log uses existing GPS Field Markers. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const state=()=>api()?.state?.()||{};
const job=()=>api()?.activeJob?.()||null;
const markers=()=>window.BoreLabEdgeV22?.jobMarkers?.(job())||[];
const current=()=>markers().filter(m=>m.kind==='utility');
const allowed=()=>!!api()&&(!window.BoreLabLocalAccounts||window.BoreLabLocalAccounts.isUnlocked?.()&&['owner','foreman'].includes(window.BoreLabLocalAccounts.role?.()));
const pictures=()=>{const s=state(),j=job();return (api()?.photos?.()||[]).filter(x=>(x.jobId||s.legacyJobId||s.activeJobId)===j?.id)};
function details(m){
 const c=m.crossing||{};
 return '<article class="bx-crossing"><div class="between"><div><strong>'+esc(m.label||'Utility Crossing')+'</strong>'+
 '<small>'+esc(c.utilityType||'Utility type not recorded')+(m.status==='resolved'?' · Follow-up closed':' · Open marker')+
 (m.lat!==''&&m.lon!==''?' · GPS saved':' · GPS not saved')+'</small></div>'+
 '<button type="button" class="btn micro ghost" data-bx-edit="'+esc(m.id)+'">Edit</button></div>'+
 '<div class="bx-metrics"><span>Station <b>'+esc(c.station||'—')+'</b></span>'+
 '<span>Utility depth <b>'+esc(c.depthFt!==''&&c.depthFt!=null?c.depthFt+' ft':'Unknown')+'</b></span>'+
 '<span>Measured clearance <b>'+esc(c.clearanceFt!==''&&c.clearanceFt!=null?c.clearanceFt+' ft':'Unknown')+'</b></span>'+
 '<span>Verification <b>'+esc(c.verification==='pothole'?'Pothole recorded':c.verification==='observed'?'Visual check recorded':'Unverified')+'</b></span></div>'+
 (m.notes?'<p class="tiny muted">'+esc(m.notes)+'</p>':'')+
 (c.photoId?'<button type="button" data-bx-photo="'+esc(c.photoId)+'">▣ Open crossing photo</button>':'')+
 '</article>';
}
function render(){
 return '<div class="page bx-page"><span class="eyebrow">FIELD / VERIFIED RECORDS</span><h1>Utility Crossing Log</h1>'+
 '<p class="smalltext muted">Record what was actually observed at a crossing. A saved check does not certify underground clearances or replace an 811 ticket, potholing, engineering, or site safety requirements.</p>'+
 '<button class="btn primary" data-bx-add>＋ Record Utility Crossing</button>'+
 '<div class="bx-list">'+(current().length?current().slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).map(details).join(''):
 '<p class="bx-empty">No utility crossings recorded for the active job.</p>')+'</div>'+
 '<div class="bx-actions"><button class="btn ghost" data-page="fieldhistory">View Atlas</button><button class="btn ghost" data-page="fieldhub">All Field Markers</button></div></div>';
}
function open(id=''){
 if(!allowed())return;
 const j=job();if(!j)return api()?.notify?.('Choose a job to record this crossing.');
 const old=current().find(x=>x.id===id),c=old?.crossing||{};
 const options=pictures().slice(0,60).map(p=>'<option value="'+esc(p.id)+'"'+(c.photoId===p.id?' selected':'')+'>'+esc(new Date(p.addedAt||Date.now()).toLocaleString()+' · '+(p.stage||'Jobsite photo'))+'</option>').join('');
 api().showModal('<div class="modal-head"><h2>'+esc(old?'Edit Utility Crossing':'New Utility Crossing')+'</h2><button class="icon-btn" data-action="close-modal">✕</button></div>'+
 '<p class="tiny muted">Capture measured facts only. Do not label a crossing “safe” based on this form.</p>'+
 '<form data-bx-form data-bx-id="'+esc(id)+'"><label class="field">Crossing / utility name<input name="label" maxlength="100" required value="'+esc(old?.label||'')+'" placeholder="Water main at driveway"></label>'+
 '<label class="field">Utility type<select name="utilityType">'+['Unknown','Water','Gas','Electric','Telecom','Sewer','Storm','Other'].map(v=>'<option '+(c.utilityType===v?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+
 '<div class="form-grid"><label class="field">Station or offset<input name="station" maxlength="80" value="'+esc(c.station||'')+'" placeholder="Sta. 1+40"></label>'+
 '<label class="field">Utility depth (ft, measured)<input name="depthFt" type="number" min="0" step="0.1" value="'+esc(c.depthFt??'')+'"></label>'+
 '<label class="field">Actual clearance (ft, measured)<input name="clearanceFt" type="number" min="0" step="0.1" value="'+esc(c.clearanceFt??'')+'"></label>'+
 '<label class="field">Verification<select name="verification">'+[['unverified','Not verified'],['observed','Visual observation recorded'],['pothole','Pothole measurement recorded']].map(([v,t])=>'<option value="'+v+'"'+((c.verification||'unverified')===v?' selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
 '<label class="field">Latitude (optional)<input name="lat" type="number" step="any" value="'+esc(old?.lat??'')+'"></label>'+
 '<label class="field">Longitude (optional)<input name="lon" type="number" step="any" value="'+esc(old?.lon??'')+'"></label></div>'+
 '<button class="btn ghost" type="button" data-bx-gps>◎ Read Device GPS (optional)</button>'+
 '<label class="field">Linked photo (optional)<select name="photoId"><option value="">No photo linked</option>'+options+'</select></label>'+
 '<label class="field">Field observations<input name="notes" maxlength="1000" value="'+esc(old?.notes||'')+'" placeholder="Exposure method, surface conditions, who observed"></label>'+
 '<div class="modal-footer"><button class="btn ghost" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save Crossing</button></div></form>');
}
function cleanMeters(v){return String(v||'').trim()}
async function gps(){
 const form=$('[data-bx-form]');if(!form)return;
 try{
  const p=await api().getPosition();
  if(!p||!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lon)))throw Error('GPS fix missing');
  form.elements.lat.value=Number(p.lat).toFixed(6);form.elements.lon.value=Number(p.lon).toFixed(6);
  api().notify('GPS entered; review recorded accuracy before saving.');
 }catch(err){api().notify('GPS unavailable: '+(err.message||String(err)))}
}
function save(form){
 if(!allowed())return;
 const d=new FormData(form),j=job(),id=form.dataset.bxId;
 if(!j)return;
 const raw=key=>String(d.get(key)||'').trim(),old=current().find(x=>x.id===id);
 const lat=raw('lat'),lon=raw('lon');
 if((lat&&!lon)||(!lat&&lon)||lat&&(!Number.isFinite(+lat)||!Number.isFinite(+lon)||+lat< -90||+lat>90||+lon< -180||+lon>180))
  return api().notify('Enter both valid GPS coordinates or leave both blank.');
 for(const field of ['depthFt','clearanceFt']){
  const v=raw(field);
  if(v!==''&&(!Number.isFinite(+v)||+v<0||+v>10000))return api().notify('Check measured '+field+' before saving.');
 }
 const verification=raw('verification');if(!['unverified','observed','pothole'].includes(verification))return;
 const photoId=raw('photoId');if(photoId&&!pictures().some(x=>x.id===photoId))return api().notify('Select a photo saved in this job.');
 const now=new Date().toISOString();
 const row={...old,id:old?.id||api().uid(),jobId:j.id,recordType:'fieldMarker',kind:'utility',
  label:raw('label').slice(0,100)||'Utility Crossing',notes:raw('notes').slice(0,1000),
  lat,lon,createdAt:old?.createdAt||now,occurredAt:old?.occurredAt||now,updatedAt:now,status:old?.status||'open',
  crossing:{utilityType:raw('utilityType'),station:raw('station'),depthFt:raw('depthFt'),
   clearanceFt:raw('clearanceFt'),verification,photoId,verifiedAt:verification==='unverified'?'':now}};
 if(!Array.isArray(j.fieldMarkers))j.fieldMarkers=[];
 if(old)j.fieldMarkers.splice(j.fieldMarkers.indexOf(old),1,row);else j.fieldMarkers.push(row);
 api().save();api().closeModal?.();api().render?.();
 window.BoreLabEdgeV22?.registerUndo?.('marker',j.id,row.id,old||null,row,old?'Utility crossing updated':'Utility crossing saved');
}
document.addEventListener('click',e=>{
 const el=e.target.closest?.('[data-bx-add],[data-bx-edit],[data-bx-gps],[data-bx-photo]');
 if(!el||!allowed())return;
 if(el.hasAttribute('data-bx-add'))return open();
 if(el.dataset.bxEdit)return open(el.dataset.bxEdit);
 if(el.hasAttribute('data-bx-gps'))return gps();
 if(el.dataset.bxPhoto)return api()?.photoDetail?.(el.dataset.bxPhoto);
});
document.addEventListener('submit',e=>{
 const f=e.target.closest?.('[data-bx-form]');if(!f)return;
 e.preventDefault();save(f);
});
window.BoreLabCrossings={render,open,save,current};
})();