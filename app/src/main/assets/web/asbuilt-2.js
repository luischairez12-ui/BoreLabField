/* BoreLab Field — As-Built 2.0 / Field Calendar / photo evidence / PDF. Offline-first. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const dayOf=x=>{if(!x)return'';if(/^\d{4}-\d{2}-\d{2}$/.test(String(x)))return String(x);const d=new Date(x);return Number.isFinite(+d)?d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()):''};
const today=()=>dayOf(new Date());
const timeOf=x=>{const d=new Date(x);return Number.isFinite(+d)?d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):''};
const niceDay=d=>new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
const valid=x=>x&&x.lat!==''&&x.lon!==''&&x.lat!=null&&x.lon!=null&&Number.isFinite(+x.lat)&&Number.isFinite(+x.lon)&&+x.lat>=-90&&+x.lat<=90&&+x.lon>=-180&&+x.lon<=180;
const coords=x=>valid(x)?Number(x.lat).toFixed(6)+', '+Number(x.lon).toFixed(6):'';
const kinds={'tie-in':'Tie-in',coupling:'Coupling',box:'Box'};
const st=()=>api()?.state?.()||{};
const active=()=>st().activeJobId;
let selected=today(),month=selected.slice(0,7),scope='job';
function allEvents(){
 const s=st(),jobs=(s.jobs||[]),out=[],photos=api()?.photos?.()||[];
 const filtered=scope==='all'?jobs:jobs.filter(j=>j.id===s.activeJobId);
 const allowed=new Set(filtered.map(j=>j.id));
 const push=(job,type,record,date,title,time='',extra='')=>{
  const d=dayOf(date);if(d)out.push({jobId:job.id,jobName:job.jobName||'Job',type,record,day:d,when:time||date||'',title,extra});
 };
 for(const job of filtered){
  for(const sh of job.shots||[]){
   if(sh.startedAt)push(job,'shot',sh,sh.startedAt,sh.name||'Bore shot',sh.startedAt,'Drilling started');
   if(sh.completedAt)push(job,'shot',sh,sh.completedAt,sh.name||'Bore shot',sh.completedAt,'Bore completed');
   if(!sh.startedAt&&!sh.completedAt&&(sh.createdAt||sh.updatedAt))push(job,'shot',sh,sh.createdAt||sh.updatedAt,sh.name||'Bore shot',sh.createdAt||sh.updatedAt,'Bore record');
  }
  for(const pin of job.fieldPins||[])push(job,'pin',pin,pin.occurredDay||pin.occurredAt||pin.createdAt,pin.name||kinds[pin.kind]||'Installation',pin.occurredAt||pin.createdAt,'Installed '+(kinds[pin.kind]||'field marker'));
  for(const member of job.crew||[]){
   if(member.start)push(job,'crew',member,member.start,member.name||'Crew member',member.start,'Clocked in');
   if(member.end)push(job,'crew',member,member.end,member.name||'Crew member',member.end,'Clocked out');
  }
 }
 for(const p of photos){
  const job=filtered.find(j=>j.id===(p.jobId||s.legacyJobId||s.activeJobId));
  if(job)push(job,'photo',p,p.addedAt,'Jobsite photo',p.addedAt,p.fieldPinId?'Installation photo':p.shotId?'Bore photo':'General photo');
 }
 for(const m of s.pipeMoves||[]){
  const job=filtered.find(j=>j.id===(m.jobId||s.legacyJobId||s.activeJobId));if(job&&m.at)push(job,'pipe',m,m.at,'Pipe '+(m.type||'movement'),m.at,(m.feet||0)+' ft');
 }
 for(const m of s.mudLogs||[]){
  const job=filtered.find(j=>j.id===(m.jobId||s.legacyJobId||s.activeJobId));if(job&&m.at)push(job,'mud',m,m.at,'Drilling mud mixed',m.at,(m.added||0)+' gallons');
 }
 return out.filter(e=>allowed.has(e.jobId));
}
function eventsOn(day=selected){return allEvents().filter(e=>e.day===day).sort((a,b)=>String(b.when).localeCompare(String(a.when)))}
function calendarHTML(){
 const [year,mo]=month.split('-').map(Number),first=new Date(year,mo-1,1),offset=first.getDay(),length=new Date(year,mo,0).getDate();
 const counts=new Map();for(const e of allEvents()){counts.set(e.day,(counts.get(e.day)||0)+1)}
 const cells=[];
 for(let x=0;x<offset;x++)cells.push('<span class="ab-calendar-blank"></span>');
 for(let d=1;d<=length;d++){const key=month+'-'+pad(d),n=counts.get(key)||0;
  cells.push('<button type="button" class="ab-date'+(key===selected?' chosen':'')+(key===today()?' today':'')+'" data-ab-day="'+key+'" aria-label="'+esc(niceDay(key))+', '+n+' records" aria-pressed="'+(key===selected?'true':'false')+'"><b>'+d+'</b>'+(n?'<i>'+n+'</i>':'')+'</button>');
 }
 const name=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});
 return '<section class="card ab-calendar"><div class="between"><div><span class="eyebrow">MAP TIME MACHINE</span><h2>Field Calendar</h2></div><button class="btn micro ghost" data-ab-today>Today</button></div>'+
 '<p class="smalltext muted">Pick any day to see what happened, the photos, and the saved locations.</p>'+
 '<div class="ab-calendar-toolbar"><button data-ab-month="-1" aria-label="Previous month">‹</button><strong>'+esc(name)+'</strong><button data-ab-month="1" aria-label="Next month">›</button></div>'+
 '<div class="ab-calendar-days">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(s=>'<span>'+s+'</span>').join('')+cells.join('')+'</div>'+
 '<div class="ab-calendar-foot"><label class="field">Jump to date<input type="date" data-ab-picker value="'+esc(selected)+'"></label><label class="field">Jobs<select data-ab-scope><option value="job"'+(scope==='job'?' selected':'')+'>Current job</option><option value="all"'+(scope==='all'?' selected':'')+'>All saved jobs</option></select></label></div></section>';
}
function detailsHTML(){
 const events=eventsOn(),photos=events.filter(e=>e.type==='photo'),positions=events.filter(e=>valid(e.record)).length;
 const glyph={pin:'📌',shot:'⌁',photo:'▣',crew:'♙',pipe:'◈',mud:'◉'};
 let html='<section class="ab-day"><div class="between"><div><span class="eyebrow">FIELD HISTORY</span><h2>'+esc(niceDay(selected))+'</h2></div><span class="ab-count">'+events.length+' activities</span></div>'+
 '<div class="ab-summary"><span>▣ '+photos.length+' photos</span><span>⌖ '+positions+' GPS locations</span><span>⌁ '+events.filter(x=>x.type==='shot').length+' bore events</span></div>'+
 '<div class="ab-day-actions"><button data-ab-pdf="day" class="btn primary">▤ As-Built PDF for Day</button><button data-page="jobmap" class="btn ghost">⌖ Open Map</button></div>';
 if(!events.length)return html+'<div class="empty spaced"><strong>No saved activity on this date</strong>Try another day. Older records without timestamps cannot be assigned a date.</div></section>';
 html+='<div class="ab-event-list">'+events.map(e=>{
  const r=e.record,hasGps=valid(r),jobLine=scope==='all'?'<small>'+esc(e.jobName)+'</small>':'';
  const linked= e.type==='photo'?(r.fieldPinId?(st().jobs||[]).find(j=>j.id===e.jobId)?.fieldPins?.find(p=>p.id===r.fieldPinId):(st().jobs||[]).find(j=>j.id===e.jobId)?.shots?.find(s=>s.id===r.shotId)):null;
  const label=e.type==='photo'&&linked?linked.name||'Linked record':e.title;
  return '<article class="ab-event"><div class="ab-event-top"><span class="ab-event-icon">'+glyph[e.type]+'</span><div><strong>'+esc(label)+'</strong><small>'+esc(e.extra)+(e.when&&e.when.includes('T')?' · '+esc(timeOf(e.when)):'')+'</small>'+jobLine+'</div></div>'+
   (e.type==='photo'&&String(r.dataUrl||'').startsWith('data:image/')?'<button data-ab-photo="'+esc(r.id)+'" class="ab-photo-thumb" aria-label="Open saved photo"><img loading="lazy" src="'+esc(r.dataUrl)+'" alt="Photo saved on '+esc(selected)+'"></button>':'')+
   (hasGps?'<button class="ab-gps" data-ab-goto="'+esc(r.id)+'" data-ab-job="'+esc(e.jobId)+'" data-ab-type="'+esc(e.type)+'">⌖ '+esc(coords(r))+' <span>View on map ›</span></button>':'<p class="tiny muted">GPS not recorded</p>')+
   (e.type==='pin'?'<p class="tiny muted">'+esc([r.station,r.size,r.material,r.depth?'Depth '+r.depth+' ft':''].filter(Boolean).join(' · '))+'</p>':'')+
   (e.type==='photo'?'<button class="btn micro ghost" data-ab-photo="'+esc(r.id)+'">View photo</button>':'')+
  '</article>';
 }).join('')+'</div></section>';
 return html;
}
function renderCalendar(){return '<div class="page ab-page"><div class="between"><div><span class="eyebrow">BORELAB / AS-BUILT 2.0</span><h1>Field History</h1></div><button class="btn micro ghost" data-page="jobmap">⌖ Map</button></div>'+
 '<p class="muted smalltext spaced">Your local, day-by-day record of bore shots, field installations, crew activity and GPS photos.</p>'+
 calendarHTML()+detailsHTML()+'<p class="tiny muted spaced">Times and coordinates come from recorded device data. Saved photos remain on this device; back them up before replacing or resetting the app.</p></div>';}
function goToMap(event){
 const b=api();if(!b||!event)return;
 if(event.jobId!==st().activeJobId){if(b.switchActiveJob?.(event.jobId)===false)return;}
 window.BoreLabJobMap?.setDay?.(event.day);
 b.setPage?.('jobmap');
 if(event.type==='photo')window.BoreLabJobMap?.focusPhoto?.(event.record);
 else window.BoreLabJobMap?.focusRecord?.(event.record.id);
}
function pathEditor(shotId){
 const b=api(),shot=st().shots?.find(x=>x.id===shotId);if(!shot)return;
 const fields=(key,label)=>{const p=shot[key]||{};return '<fieldset class="ab-path-fields" data-ab-endpoint="'+key+'"><legend>'+label+'</legend><div class="form-grid"><label class="field">Latitude<input name="'+key+'Lat" type="number" min="-90" max="90" step="any" value="'+esc(p.lat??'')+'"></label><label class="field">Longitude<input name="'+key+'Lon" type="number" min="-180" max="180" step="any" value="'+esc(p.lon??'')+'"></label></div><button type="button" class="btn micro ghost" data-ab-gps="'+key+'">◎ Capture current GPS</button><small>Accuracy: <span data-ab-accuracy-label="'+key+'">'+(Number.isFinite(+p.accuracy)&&p.accuracy!==''?'±'+Math.round(+p.accuracy)+' m':'not recorded')+'</span></small><input type="hidden" name="'+key+'Accuracy" value="'+esc(p.accuracy??'')+'"></fieldset>'};
 b.showModal?.('<div class="modal-head"><h2>⌁ Bore As-Built Endpoints</h2><button type="button" class="icon-btn" data-action="close-modal">✕</button></div>'+
 '<p class="smalltext muted">Record the actual entry and exit locations. The map draws a straight endpoint reference, not the surveyed underground bore path.</p>'+
 '<form data-ab-path-form data-ab-shot="'+esc(shotId)+'">'+fields('asbuiltStart','Entry point')+fields('asbuiltEnd','Exit point')+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">Save Endpoints</button></div></form>');
}
async function captureEndpoint(key){
 try{
  const p=await api()?.getPosition?.();if(!p||!valid(p))throw Error('GPS not available.');
  const form=document.querySelector('[data-ab-path-form]');if(!form)return;
  form.elements[key+'Lat'].value=Number(p.lat).toFixed(6);
  form.elements[key+'Lon'].value=Number(p.lon).toFixed(6);
  form.elements[key+'Accuracy'].value=Number.isFinite(+p.accuracy)?Math.round(+p.accuracy):'';
  const text=form.querySelector('[data-ab-accuracy-label="'+key+'"]');if(text)text.textContent='±'+Math.round(p.accuracy||0)+' m';
  api()?.notify?.('Endpoint GPS captured. Review accuracy before saving.');
 }catch(e){api()?.notify?.(e.message||'GPS unavailable');}
}
function savePath(form){
 const shot=st().shots?.find(x=>x.id===form.dataset.abShot);if(!shot)return;
 const out={};
 for(const key of ['asbuiltStart','asbuiltEnd']){
  const lat=String(form.elements[key+'Lat'].value).trim(),lon=String(form.elements[key+'Lon'].value).trim();
  if((lat&&!lon)||(!lat&&lon)){api()?.notify?.('Enter both coordinates for each endpoint.');return}
  if(lat&&(!valid({lat,lon}))){api()?.notify?.('Check the endpoint latitude and longitude.');return}
  out[key]=lat?{lat,lon,accuracy:String(form.elements[key+'Accuracy'].value||''),recordedAt:new Date().toISOString()}:null;
 }
 shot.asbuiltStart=out.asbuiltStart;shot.asbuiltEnd=out.asbuiltEnd;shot.updatedAt=new Date().toISOString();
 st().demo=false;api()?.save?.();api()?.closeModal?.();api()?.render?.();api()?.notify?.('Saved confirmed bore endpoints to the As-Built Map.');
}
function pinPhotos(pinId,jobId=active()){return (api()?.photos?.()||[]).filter(p=>p.fieldPinId===pinId&&p.jobId===jobId)}
function onPinPhotoSaved(photo){
 if(!photo.fieldPinId||!valid(photo))return;
 const job=(st().jobs||[]).find(j=>j.id===photo.jobId);
 const pin=job?.fieldPins?.find(p=>p.id===photo.fieldPinId);
 if(pin&&!valid(pin)){pin.lat=Number(photo.lat).toFixed(6);pin.lon=Number(photo.lon).toFixed(6);pin.gpsAccuracy=photo.accuracy??'';pin.gpsSource='camera';pin.updatedAt=new Date().toISOString();api()?.save?.();}
}
async function exportAsBuilt(day=''){
 const b=api(),s=st(),job=(s.jobs||[]).find(j=>j.id===s.activeJobId);if(!job)return b?.notify?.('Select a job first.');
 const wanted=(x)=>!day||dayOf(x)===day;
 const shots=(job.shots||[]).filter(x=>!day||[x.startedAt,x.completedAt,x.createdAt,x.updatedAt].some(wanted));
 const pins=(job.fieldPins||[]).filter(x=>wanted(x.occurredDay||x.createdAt));
 const photoRows=(b.photos?.()||[]).filter(p=>(p.jobId||s.legacyJobId||s.activeJobId)===job.id&&wanted(p.addedAt)).slice(0,75);
 const asbuilt=pins.map(p=>({name:p.name||kinds[p.kind]||'Marker',kind:kinds[p.kind]||'Field marker',date:dayOf(p.occurredDay||p.createdAt),lat:valid(p)?String(p.lat):'',lon:valid(p)?String(p.lon):'',accuracy:String(p.gpsAccuracy??''),station:p.station||'',size:p.size||'',material:p.material||'',depth:p.depth||'',details:[p.connectionType,p.fittingType,p.dimensions,p.notes].filter(Boolean).join(' · ')}));
 for(const shot of shots)for(const [key,kind] of [['asbuiltStart','Bore entry'],['asbuiltEnd','Bore exit']]){
  const pt=shot[key];if(valid(pt))asbuilt.push({name:shot.name||'Bore',kind,date:dayOf(pt.recordedAt||shot.completedAt||shot.startedAt),lat:String(pt.lat),lon:String(pt.lon),accuracy:String(pt.accuracy??''),details:'Actual recorded endpoint (not underground alignment)'});
 }
 const payload={title:'As-Built Location & Photo Report',job:job.jobName||'Job',period:day||'Entire saved job',homeBase:s.shopAddress||'Not recorded',generatedAt:new Date().toLocaleString(),
 summary:{shots:String(shots.length),completedFeet:shots.filter(x=>x.status==='complete').reduce((n,x)=>n+(+x.feet||0),0)+' ft',photos:String(photoRows.length),plannedPipe:'',actualPipe:'',crewHours:'',mudBatches:'',mudStockMoves:''},
 shots:shots.map(x=>({name:x.name||'Bore',status:x.status||'',feet:String(x.feet||''),plannedPipe:'',actualPipe:'',notes:x.notes||'',address:x.address||(valid(x)?coords(x):''),startedAt:x.startedAt||'',completedAt:x.completedAt||'',pipeDiameter:x.pipeDiameter||'',conduitDetails:'',equipment:'',rodCount:x.rodCount||'',entryDepth:x.entryDepth||'',exitDepth:x.exitDepth||''})),
 asbuilt,photos:photoRows.map(p=>{const parent=p.fieldPinId?(job.fieldPins||[]).find(x=>x.id===p.fieldPinId):(job.shots||[]).find(x=>x.id===p.shotId);return {shot:parent?.name||'General site photo',date:new Date(p.addedAt).toLocaleString(),location:coords(p)||'No photo GPS recorded',dataUrl:p.dataUrl||''}}),
 crew:[],pipe:[],mud:[],mudStock:[],
 closeoutNote:'Location plot is a GPS point schematic, not a survey or engineered bore alignment. Verify locations, accuracy and field entries before submitting.'};
 const filename='BoreLab_AsBuilt_'+String(job.jobName||'Job').replace(/[^a-z0-9_-]+/gi,'_').slice(0,40)+'_'+(day||today())+'.pdf';
 if(window.BoreLabNative?.exportPdf){
  try{window.BoreLabNative.exportPdf(filename,JSON.stringify(payload));b.notify('As-built PDF prepared. Choose where to save it.');}
  catch(e){b.notify('Could not create PDF: '+String(e.message||e));}return;
 }
 const html='<!doctype html><html><head><meta charset="utf-8"><title>As-Built '+esc(job.jobName)+'</title><style>body{font:14px system-ui;color:#233;margin:30px}h1{color:#c65d09}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbc;padding:7px;text-align:left}img{height:120px;max-width:190px;object-fit:contain;margin:7px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button><h1>As-Built Field Report</h1><p>'+esc(job.jobName)+' · '+esc(payload.period)+'</p><h2>GPS installation schedule</h2><table><tr><th>Record</th><th>Type</th><th>Date</th><th>GPS</th><th>Size / station</th></tr>'+asbuilt.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(x.kind)+'</td><td>'+esc(x.date)+'</td><td>'+esc(x.lat+', '+x.lon)+'</td><td>'+esc(x.size+' '+x.station)+'</td></tr>').join('')+'</table><h2>Bores</h2>'+shots.map(x=>'<p>'+esc(x.name)+' · '+esc(x.feet)+' ft · '+esc(x.status)+'</p>').join('')+'<h2>Linked photos</h2>'+payload.photos.map(p=>'<figure><img src="'+esc(p.dataUrl)+'"><figcaption>'+esc(p.shot+' — '+p.date+' — '+p.location)+'</figcaption></figure>').join('')+'<p>'+esc(payload.closeoutNote)+'</p></body></html>';
 const blob=new Blob([html],{type:'text/html'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename.replace(/\.pdf$/,'.html');document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
 b.notify('Browser preview saved printable HTML. Open and Print → Save as PDF; Android creates PDF directly.');
}
document.addEventListener('click',e=>{
 const el=e.target.closest?.('[data-ab-month],[data-ab-day],[data-ab-today],[data-ab-goto],[data-ab-photo],[data-ab-pdf],[data-ab-path],[data-ab-gps]');
 if(!el)return;
 if(el.hasAttribute('data-ab-month')){const [y,m]=month.split('-').map(Number),d=new Date(y,m-1+Number(el.dataset.abMonth),1);month=d.getFullYear()+'-'+pad(d.getMonth()+1);api()?.render?.();return}
 if(el.hasAttribute('data-ab-day')){selected=el.dataset.abDay;month=selected.slice(0,7);api()?.render?.();return}
 if(el.hasAttribute('data-ab-today')){selected=today();month=selected.slice(0,7);api()?.render?.();return}
 if(el.dataset.abGoto){const found=eventsOn().find(x=>x.record.id===el.dataset.abGoto&&x.jobId===el.dataset.abJob&&x.type===el.dataset.abType);if(found)goToMap(found);return}
 if(el.dataset.abPhoto){api()?.photoDetail?.(el.dataset.abPhoto);return}
 if(el.hasAttribute('data-ab-pdf')){exportAsBuilt(el.dataset.abPdf==='day'?selected:'');return}
 if(el.dataset.abPath){pathEditor(el.dataset.abPath);return}
 if(el.dataset.abGps){captureEndpoint(el.dataset.abGps);return}
});
document.addEventListener('change',e=>{
 if(e.target.matches?.('[data-ab-picker]')&&/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){selected=e.target.value;month=selected.slice(0,7);api()?.render?.();}
 if(e.target.matches?.('[data-ab-scope]')){scope=e.target.value==='all'?'all':'job';api()?.render?.();}
});
document.addEventListener('submit',e=>{const form=e.target.closest?.('[data-ab-path-form]');if(!form)return;e.preventDefault();savePath(form)});
window.BoreLabAsBuilt={renderCalendar,eventsOn,allEvents,calendarHTML,detailsHTML,exportAsBuilt,pathEditor,pinPhotos,onPinPhotoSaved,dayOf,coords,valid,goToMap,
 setDay:x=>{if(/^\d{4}-\d{2}-\d{2}$/.test(String(x))){selected=x;month=x.slice(0,7)}},getDay:()=>selected};
})();