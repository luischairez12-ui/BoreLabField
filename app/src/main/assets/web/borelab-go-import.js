/* Optional, user-confirmed GO -> BoreLab Field import. No remote sync. */
(function(){
'use strict';
const FORMAT='borelab-go-exchange/v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=(lat,lon)=>lat!==null&&lon!==null&&lat!==''&&lon!==''&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))&&Math.abs(Number(lat))<=90&&Math.abs(Number(lon))<=180;
let pending=null;
const api=()=>window.BoreLabAssistantBridge;
function receive(raw){
 if(typeof raw!=='string'||raw.length>300000)return;
 let data;
 try{data=JSON.parse(raw);}catch{return;}
 if(data?.format!==FORMAT||!Array.isArray(data.bores)||!Array.isArray(data.markers)||data.bores.length>300||data.markers.length>600)return;
 if(!api()?.state?.()||!api()?.activeJob?.())return;
 pending=data;
 const a=api(),job=a.activeJob(),bl=data.bores.length,ml=data.markers.length;
 a.showModal('<div class="modal-head"><h2>📍 Import BoreLab GO Plan</h2><button class="icon-btn" data-action="close-modal">✕</button></div>'+
 '<div class="card"><p><strong>'+bl+' bores</strong> and <strong>'+ml+' map markers</strong> from GO.</p>'+
 '<p class="smalltext">Destination: <strong>'+esc(job.jobName||'Current Job')+'</strong></p>'+
 '<p class="smalltext muted">This is a one-way import. Previously imported GO records will be skipped rather than overwritten, and existing Field records will not be removed.</p>'+
 '<p class="smalltext muted">Check the imported addresses, footage, and GPS before using them in the field.</p>'+
 '<div class="actions spaced"><button type="button" class="btn primary" data-go-import-confirm>Import into active job</button>'+
 '<button type="button" class="btn ghost" data-go-import-cancel>Cancel</button></div></div>');
}
function importPending(){
 if(!pending||!api()?.state?.()||!api()?.activeJob?.())return;
 const data=pending;pending=null;
 const bridge=api(),s=bridge.state(),job=bridge.activeJob();
 if(!Array.isArray(s.shots)||!job)return;
 if(!Array.isArray(job.fieldPins))job.fieldPins=[];
 const seenBores=new Set(s.shots.filter(x=>x?.goSourceId).map(x=>x.goSourceId));
 const seenPins=new Set(job.fieldPins.filter(x=>x?.goSourceId).map(x=>x.goSourceId));
 let countB=0,countP=0;
 for(const source of data.bores){
   if(!source||typeof source.id!=='string'||source.id.length>100||seenBores.has(source.id))continue;
   const feet=Number(source.feet);
   if(!Number.isFinite(feet)||feet<=0||feet>100000)continue;
   const shot={id:bridge.uid(),goSourceId:source.id,jobId:s.activeJobId,
     name:String(source.name||'GO Bore').slice(0,70),feet,
     address:String(source.address||'').slice(0,250),
     lat:valid(source.lat,source.lon)?Number(source.lat):'',
     lon:valid(source.lat,source.lon)?Number(source.lon):'',
     notes:String(source.notes||'').slice(0,1500),
     status:['planned','progress','complete'].includes(source.status)?source.status:'planned',
     createdAt:source.createdAt||new Date().toISOString(),
     updatedAt:source.updatedAt||new Date().toISOString(),
     occurredDay:/^\d{4}-\d{2}-\d{2}$/.test(source.occurredDay||'')?source.occurredDay:'',
     asbuiltStart:source.asbuiltStart&&valid(source.asbuiltStart.lat,source.asbuiltStart.lon)?{lat:Number(source.asbuiltStart.lat),lon:Number(source.asbuiltStart.lon)}:null,
     asbuiltEnd:source.asbuiltEnd&&valid(source.asbuiltEnd.lat,source.asbuiltEnd.lon)?{lat:Number(source.asbuiltEnd.lat),lon:Number(source.asbuiltEnd.lon)}:null};
   s.shots.push(shot);seenBores.add(source.id);countB++;
 }
 for(const source of data.markers){
   if(!source||typeof source.id!=='string'||source.id.length>100||seenPins.has(source.id))continue;
   if(!valid(source.lat,source.lon))continue;
   const allowed=['box','handhole','coupling','tie-in','custom'];
   const kind=allowed.includes(source.kind)?source.kind:'custom';
   const at=source.occurredAt||new Date().toISOString();
   const pin={id:bridge.uid(),recordType:'fieldPin',goSourceId:source.id,jobId:s.activeJobId,
     kind,name:String(source.name||kind).slice(0,80),symbol:'',
     lat:String(source.lat),lon:String(source.lon),address:'',
     notes:String(source.notes||'').slice(0,1500),
     occurredAt:at,occurredDay:String(at).slice(0,10),createdAt:at,updatedAt:at,
     gpsSource:'GO import'};
   job.fieldPins.push(pin);seenPins.add(source.id);countP++;
 }
 s.demo=false;
 bridge.save();bridge.closeModal();bridge.render();
 bridge.notify('Imported '+countB+' bores and '+countP+' pins from GO. Existing matches skipped.');
}
document.addEventListener('click',event=>{
 if(event.target.closest?.('[data-go-import-confirm]')){event.preventDefault();event.stopImmediatePropagation();importPending();}
 if(event.target.closest?.('[data-go-import-cancel]')){event.preventDefault();event.stopImmediatePropagation();pending=null;api()?.closeModal?.();}
},true);
window.BoreLabGOImport={receive};
})();
