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
let selected=today(),month=selected.slice(0,7),scope='job',viewMode='calendar',atlasDayMode='all',searchQuery='',typeFilter='all';
const typeLabels={all:'All',shot:'Bores',pin:'Installations',photo:'Photos',crew:'Crew',pipe:'Pipe',mud:'Mud',journal:'Changes',closeout:'Closeouts'};
const eventText=e=>{const r=e.record||{},d=new Date(e.day+'T12:00:00');return [e.title,e.jobName,e.extra,e.day,d.toLocaleDateString('en-US'),d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),r.name,r.address,r.notes,r.kind,r.station,r.material,r.size,r.dimensions,r.connectionType,r.fittingType,r.feet].filter(x=>x!=null).join(' ').toLowerCase()};
const matches=e=>(typeFilter==='all'||e.type===typeFilter)&&(!searchQuery||eventText(e).includes(searchQuery.trim().toLowerCase()));
const matchingEvents=()=>allEvents().filter(matches);
const atlasEvents=()=>matchingEvents().filter(e=>atlasDayMode!=='selected'||e.day===selected);
const activityDays=()=>[...new Set(matchingEvents().map(x=>x.day))].sort();
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
 for(const m of s.mudStockMoves||[]){const job=filtered.find(j=>j.id===(m.jobId||s.legacyJobId||s.activeJobId));if(job&&m.at)push(job,'mud',m,m.at,'Mud product stock',m.at,[m.productName,m.kind].filter(Boolean).join(' · '));}
 for(const r of s.fieldRecovery||[]){const job=filtered.find(j=>j.id===r.jobId);if(job&&r.at&&!r.undone)push(job,'journal',r,r.at,r.kind||'Bore change',r.at,r.shotId?(job.shots||[]).find(x=>x.id===r.shotId)?.name||'Bore updated':'Field update');}
 for(const h of s.history||[]){if(!h.day||!h.createdAt||h.kind==='multi')continue;const job=filtered.find(j=>j.id===h.jobId);if(job)push(job,'closeout',h,h.day,'Daily closeout saved',h.createdAt,'Recorded closeout · '+(h.summary?.shots||0)+' bores');}
 return out.filter(e=>allowed.has(e.jobId));
}
function eventsOn(day=selected){return matchingEvents().filter(e=>e.day===day).sort((a,b)=>String(b.when).localeCompare(String(a.when)))}
function calendarHTML(){
 const [year,mo]=month.split('-').map(Number),first=new Date(year,mo-1,1),offset=first.getDay(),length=new Date(year,mo,0).getDate();
 const counts=new Map(),kindsByDay=new Map();for(const e of matchingEvents()){counts.set(e.day,(counts.get(e.day)||0)+1);if(!kindsByDay.has(e.day))kindsByDay.set(e.day,new Set());kindsByDay.get(e.day).add(e.type)}
 const cells=[];
 for(let x=0;x<offset;x++)cells.push('<span class="ab-calendar-blank"></span>');
 for(let d=1;d<=length;d++){const key=month+'-'+pad(d),n=counts.get(key)||0;
  const tags=[...(kindsByDay.get(key)||[])].slice(0,3).map(t=>'<em class="ab-tick ab-tick-'+esc(t)+'"></em>').join('');
  cells.push('<button type="button" class="ab-date'+(key===selected?' chosen':'')+(key===today()?' today':'')+'" data-ab-day="'+key+'" aria-label="'+esc(niceDay(key))+', '+n+' records" aria-pressed="'+(key===selected?'true':'false')+'"><b>'+d+'</b>'+(n?'<i>'+n+'</i>':'')+(tags?'<span class="ab-day-ticks" aria-hidden="true">'+tags+'</span>':'')+'</button>');
 }
 const name=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});
 return '<section class="card ab-calendar"><div class="between"><div><span class="eyebrow">MAP TIME MACHINE</span><h2>Field Calendar</h2></div><button class="btn micro ghost" data-ab-today>Today</button></div>'+
 '<p class="smalltext muted">Pick any day to see what happened, the photos, and the saved locations.</p>'+
 '<div class="ab-calendar-toolbar"><button data-ab-month="-1" aria-label="Previous month">‹</button><strong>'+esc(name)+'</strong><button data-ab-month="1" aria-label="Next month">›</button></div>'+
 '<div class="ab-calendar-days">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(s=>'<span>'+s+'</span>').join('')+cells.join('')+'</div>'+
 '<div class="ab-calendar-foot"><label class="field">Jump to date<input type="date" data-ab-picker value="'+esc(selected)+'"></label><button class="btn micro ghost" data-ab-prev>‹ Previous workday</button><button class="btn micro ghost" data-ab-next>Next workday ›</button></div></section>';
}
function dayHistory(){
 const events=eventsOn(),photos=events.filter(e=>e.type==='photo');
 const installed=events.filter(e=>e.type==='pin'),completed=events.filter(e=>e.type==='shot'&&e.extra==='Bore completed');
 const ft=completed.reduce((sum,e)=>sum+(Number(e.record.feet)||0),0);
 const coordsCount=events.filter(e=>valid(e.record)).length;
 return {events,photos,installed,completed,ft,coordsCount};
}
function gpsQuality(record){
 if(!valid(record))return 'Location missing';
 const accuracy=record.gpsAccuracy??record.accuracy,source=record.gpsSource||'';
 if(source==='manual')return 'Manual GPS · verify position in field';
 if(accuracy==null||accuracy==='')return 'GPS precision not saved';
 const n=Number(accuracy);if(!Number.isFinite(n))return 'GPS precision not saved';
 return 'GPS accuracy ±'+Math.round(n)+' m'+(n>25?' · Low accuracy — recapture recommended':n>10?' · Approximate':'');
}
function detailsHTML(){
 const {events,photos,installed,completed,ft,coordsCount}=dayHistory();
 const glyph={pin:'📌',shot:'⌁',photo:'▣',crew:'♙',pipe:'◈',mud:'◉',journal:'✎',closeout:'✓'};
 const dayLabel=esc(niceDay(selected));
 let html='<section class="ab-day"><div class="between"><div><span class="eyebrow">DAILY FIELD HISTORY</span><h2>'+dayLabel+'</h2></div><span class="ab-count">'+events.length+' activities</span></div>'+
 '<div class="ab-summary"><span>⌁ '+completed.length+' finished · '+Number(ft.toFixed(1))+' ft</span><span>📌 '+installed.length+' installations</span><span>▣ '+photos.length+' photos</span><span>⌖ '+coordsCount+' GPS records</span></div>'+
 '<div class="ab-day-actions"><button data-ab-pdf="day" class="btn primary">▤ Day As-Built PDF'+(scope==='all'?' (current job)':'')+'</button><button data-ab-visit-map class="btn ghost">⌖ View This Day on Atlas</button></div>';
 if(photos.length){
  html+='<div class="ab-day-gallery"><strong>Photos from this day</strong><div class="ab-day-gallery-strip">'+photos.map(e=>'<button type="button" data-ab-photo="'+esc(e.record.id)+'" aria-label="Open photo"><img alt="Photo recorded '+esc(selected)+'" loading="lazy" src="'+esc(e.record.dataUrl||'')+'"></button>').join('')+'</div></div>';
 }
 if(!events.length)return html+'<div class="empty spaced"><strong>No saved activity on this date</strong>Choose another date. We never invent dates for older records.</div></section>';
 html+='<div class="ab-event-list">'+events.map(e=>{
  const r=e.record,hasGps=valid(r),jobLine=scope==='all'?'<small>'+esc(e.jobName)+'</small>':'';
  const j=(st().jobs||[]).find(j=>j.id===e.jobId);
  const linked=e.type==='photo'?(r.fieldPinId?j?.fieldPins?.find(p=>p.id===r.fieldPinId):j?.shots?.find(s=>s.id===r.shotId)):null;
  const label=e.type==='photo'&&linked?linked.name||'Linked photo':e.title;
  return '<article class="ab-event"><div class="ab-event-top"><span class="ab-event-icon">'+(glyph[e.type]||'⌖')+'</span><div><strong>'+esc(label)+'</strong><small>'+esc(e.extra)+(e.when&&String(e.when).includes('T')?' · '+esc(timeOf(e.when)):'')+'</small>'+jobLine+'</div></div>'+
   (e.type==='photo'&&String(r.dataUrl||'').startsWith('data:image/')?'<button data-ab-photo="'+esc(r.id)+'" class="ab-photo-thumb" aria-label="Open saved photo"><img src="'+esc(r.dataUrl)+'" loading="lazy" alt="Photo recorded '+esc(selected)+'"></button>':'')+
   (hasGps?'<button class="ab-gps" data-ab-goto="'+esc(r.id)+'" data-ab-job="'+esc(e.jobId)+'" data-ab-type="'+esc(e.type)+'">⌖ '+esc(coords(r))+' <span>Atlas ›</span></button><small class="ab-quality">'+esc(gpsQuality(r))+'</small>':'<p class="tiny muted">GPS not recorded</p>')+
   (e.type==='pin'?'<p class="tiny muted">'+esc([r.station,r.size,r.material,r.depth?'Depth '+r.depth+' ft':''].filter(Boolean).join(' · '))+'</p>':'')+
   (e.type==='photo'?'<div class="ab-photo-actions"><button class="btn micro ghost" data-ab-photo="'+esc(r.id)+'">View Photo</button>'+(!r.fieldPinId&&!r.shotId?'<button class="btn micro ghost" data-ab-suggest="'+esc(r.id)+'">⌖ Suggest Nearby Records</button>':'')+'</div>':'')+
  '</article>';
 }).join('')+'</div></section>';
 return html;
}
function renderBody(){
 if(showChecklist)return renderChecklist();
 if(viewMode==='atlas')return '<div class="ab-atlas-date-filters"><strong>Show on map</strong><button data-ab-atlas-period="all" class="'+(atlasDayMode==='all'?'active':'')+'">All dates</button><button data-ab-atlas-period="selected" class="'+(atlasDayMode==='selected'?'active':'')+'">Selected day · '+esc(selected)+'</button></div>'+
   (window.BoreLabAtlas?.renderAtlas?.()||'<div class="card spaced">Atlas map unavailable.</div>');
 return calendarHTML()+detailsHTML();
}
function updateBody(){const box=document.querySelector('[data-ab-body]');if(box)box.innerHTML=renderBody();}
function renderCalendar(){
 const labels=Object.entries(typeLabels).map(([id,label])=>'<button data-ab-type="'+id+'" class="'+(typeFilter===id?'active':'')+'" aria-pressed="'+(typeFilter===id)+'">'+label+'</button>').join('');
 return '<div class="page ab-page"><div class="between"><div><span class="eyebrow">BORELAB / FIELD ATLAS</span><h1>Field Atlas & Calendar</h1></div><button class="btn micro ghost" data-ab-completion>✓ Job Checklist</button></div>'+
 '<p class="muted smalltext spaced">One field history, two views. Use Calendar for when, Atlas for where. Both read the same offline records.</p>'+
 '<div class="ab-view-toggle" role="group" aria-label="Field Atlas display mode"><button data-ab-view="calendar" class="'+(!showChecklist&&viewMode==='calendar'?'active':'')+'" aria-pressed="'+(!showChecklist&&viewMode==='calendar')+'">📅 Calendar</button><button data-ab-view="atlas" class="'+(!showChecklist&&viewMode==='atlas'?'active':'')+'" aria-pressed="'+(!showChecklist&&viewMode==='atlas')+'">📍 Atlas Map</button></div>'+
 '<div class="ab-global-search"><label class="field">Find records by job, date, address, station, material or type<input type="search" data-ab-search placeholder="11/19/2026, coupling, Shot 03..." value="'+esc(searchQuery)+'" maxlength="110" autocomplete="off"></label>'+
 '<div class="ab-scope-row"><label class="field">Search in<select data-ab-scope><option value="job"'+(scope==='job'?' selected':'')+'>Current job</option><option value="all"'+(scope==='all'?' selected':'')+'>All jobs (including archived)</option></select></label><button data-ab-all-jobs class="btn micro ghost">⌖ Search All Jobs</button></div>'+
 '<div class="ab-type-chips" role="group" aria-label="Filter field record type">'+labels+'</div></div>'+
 '<div data-ab-body>'+renderBody()+'</div>'+
 '<p class="tiny muted spaced">Recorded information only. Location estimates are not surveyed utility locates. The offline site plot works without map tiles; keep a current backup of photos and records.</p></div>';
}
function goToAtlas(event){
 if(!event||!valid(event.record))return api()?.notify?.('This entry does not have saved GPS coordinates.');
 showChecklist=false;viewMode='atlas';atlasDayMode='selected';selected=event.day||selected;month=selected.slice(0,7);
 window.BoreLabAtlas?.focusEvent?.(event);api()?.render?.();
}
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
  api()?.notify?.('Endpoint GPS captured (±'+Math.round(p.accuracy||0)+' m).'+(p.accuracy>25?' Weak accuracy: recapture or verify.':' Review before saving.'));
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

/* Photo-to-pin suggestions are always review-first; no automatic photo reassignment. */
const haversine=(a,b)=>{
 const rad=Math.PI/180,dLat=(+a.lat- +b.lat)*rad,dLon=(+a.lon- +b.lon)*rad,x=Math.sin(dLat/2)**2+Math.cos(+a.lat*rad)*Math.cos(+b.lat*rad)*Math.sin(dLon/2)**2;
 return 12742000*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));
};
function openPhoto(photoId){
 const p=api()?.photos?.().find(x=>x.id===photoId);if(!p)return;
 const job=(st().jobs||[]).find(j=>j.id===(p.jobId||st().legacyJobId||st().activeJobId));
 const pin=job?.fieldPins?.find(x=>x.id===p.fieldPinId),shot=job?.shots?.find(x=>x.id===p.shotId);
 const label=pin?.name||shot?.name||'General field photo';
 if(job?.id===st().activeJobId&&api()?.photoDetail)return api().photoDetail(p.id);
 api()?.showModal?.('<div class="modal-head"><h2>▣ Field Photo</h2><button class="icon-btn" data-action="close-modal">✕</button></div>'+
 '<p class="smalltext">'+esc(job?.jobName||'Saved job')+' · '+esc(label)+'</p>'+
 '<img class="photo-preview spaced" src="'+esc(p.dataUrl)+'" alt="Saved jobsite photo">'+
 '<div class="card spaced"><p class="smalltext">Recorded '+esc(new Date(p.addedAt).toLocaleString())+'</p>'+
 '<p class="smalltext">'+(valid(p)?'GPS '+esc(coords(p)):'GPS not recorded')+'</p>'+
 '<p class="ab-quality">'+esc(gpsQuality(p))+'</p></div>');
}
function candidateRecords(photo){
 if(!photo||photo.fieldPinId||photo.shotId)return[];
 const s=st(),id=photo.jobId||s.legacyJobId||s.activeJobId,job=(s.jobs||[]).find(j=>j.id===id);if(!job)return[];
 const candidates=[...(job.fieldPins||[]).map(p=>({id:p.id,type:'pin',label:p.name||kinds[p.kind]||'Field installation',record:p})),
  ...(job.shots||[]).map(x=>({id:x.id,type:'shot',label:x.name||'Bore',record:x}))];
 return candidates.map(c=>{
  const d=valid(photo)&&valid(c.record)?haversine(photo,c.record):null;
  const candidateDay=dayOf(c.record.occurredDay||c.record.completedAt||c.record.startedAt||c.record.createdAt);
  const sameDay=candidateDay===dayOf(photo.addedAt)&&!!candidateDay;
  return {...c,distance:d,sameDay,source:job.jobName||'Job'};
 }).filter(c=>(c.distance!=null&&c.distance<=75)||(c.sameDay&&c.distance==null))
 .sort((a,b)=>(a.distance??500)-(b.distance??500)||(a.sameDay===b.sameDay?0:a.sameDay?-1:1))
 .slice(0,6);
}
function suggestPhoto(photoId){
 const b=api(),photo=b?.photos?.().find(p=>p.id===photoId);if(!photo)return;
 if(photo.fieldPinId||photo.shotId){b?.notify?.('This photo is already linked. Open Photo Organizer to review its current assignment.');return;}
 const choices=candidateRecords(photo);
 const line='<p class="smalltext muted">Suggested from saved location and work date. Compare the picture with the actual installation before linking; proximity alone is not proof.</p>';
 const rows=choices.map(c=>'<button type="button" class="ab-link-option" data-ab-link="'+esc(photo.id)+'" data-ab-link-target="'+esc(c.type+':'+c.id)+'">'+
 '<span><strong>'+esc(c.label)+'</strong><small>'+esc(c.source)+' · '+(c.distance==null?'Same workday, GPS unavailable':Math.round(c.distance)+' m away')+(c.sameDay?' · same day':'')+'</small></span><b>Link ›</b></button>').join('');
 b.showModal?.('<div class="modal-head"><h2>⌖ Smart Photo Linking</h2><button class="icon-btn" type="button" data-action="close-modal">✕</button></div>'+line+
 (valid(photo)?'<p class="ab-quality">Photo: '+esc(coords(photo))+' · '+esc(gpsQuality(photo))+'</p>':'<p class="ab-quality">Photo has no GPS; suggestions can use the work date only.</p>')+
 '<div class="ab-link-choices">'+(rows||'<p class="note spaced">No reliable nearby match. This photo remains unassigned; nothing was changed.</p>')+'</div>'+
 '<div class="action-row"><button class="btn ghost" data-action="close-modal">Keep unassigned</button></div>');
}
async function linkPhoto(photoId,target){
 const b=api(),p=b?.photos?.().find(x=>x.id===photoId);if(!p||p.fieldPinId||p.shotId)return b?.notify?.('Photo is no longer available for linking.');
 const [type,...idParts]=String(target).split(':'),id=idParts.join(':'),s=st(),job=(s.jobs||[]).find(j=>j.id===(p.jobId||s.legacyJobId||s.activeJobId));
 const rec=type==='pin'?job?.fieldPins?.find(x=>x.id===id):type==='shot'?job?.shots?.find(x=>x.id===id):null;
 if(!rec)return b?.notify?.('The selected record is no longer available in this photo’s job.');
 if(window.confirm&&!window.confirm('Link this photo to '+(rec.name||'the selected field record')+'? Review the picture first.'))return;
 const revised={...p,fieldPinId:type==='pin'?id:'',shotId:type==='shot'?id:'',linkSource:'foreman-confirmed',linkedAt:new Date().toISOString()};
 try{await b.photoDB?.('put',revised);await b.refreshPhotos?.();b.closeModal?.();b.render?.();b.notify?.('Photo linked to '+(rec.name||'field record')+'. Original picture unchanged.')}
 catch(e){b.notify?.('Could not link photo: '+(e.message||String(e)))}
}
/* Completion checklist is an explicit review; it never modifies shots, time or invoices. */
let showChecklist=false;
const reviewSteps=[
 {id:'bores',title:'Review every bore',description:'Complete remaining planned/in-progress shots or document exclusions'},
 {id:'locations',title:'Verify location records',description:'Confirm GPS or entry/exit references for bores and installed markers'},
 {id:'photos',title:'Review after-work photos',description:'Completed bores should have an After photo'},
 {id:'install',title:'Check installation details',description:'Couplings, boxes and tie-ins need dimensions or size'},
 {id:'unlinked',title:'Review general photos',description:'Confirm that unassigned photos are intentionally general'},
 {id:'crew',title:'Close crew clocks',description:'Check all crew time entries are finished'},
 {id:'paperwork',title:'Review field notes and closeout',description:'Manually verify paperwork, site notes and dates'},
 {id:'asbuilt',title:'Review final Atlas and PDF',description:'Confirm as-built positions and report contents before submission'}
];
function checklist(job=api()?.activeJob?.()){
 if(!job)return[];
 const s=st(),shots=job.shots||[],pins=job.fieldPins||[],photos=(api()?.photos?.()||[]).filter(p=>(p.jobId||s.legacyJobId||s.activeJobId)===job.id);
 const openBores=shots.filter(sh=>sh.status!=='complete');
 const missingGps=[...shots.filter(sh=>sh.status==='complete'&&!valid(sh)&&!valid(sh.asbuiltStart)&&!valid(sh.asbuiltEnd)),...pins.filter(p=>!valid(p))];
 const lowGps=[...pins.filter(p=>valid(p)&&Number(p.gpsAccuracy)>25),...photos.filter(p=>valid(p)&&Number(p.accuracy)>25)];
 const withoutAfter=shots.filter(sh=>sh.status==='complete'&&!photos.some(p=>p.shotId===sh.id&&p.stage==='after'));
 const incompletePins=pins.filter(p=>p.kind==='box'?!String(p.dimensions||p.size||'').trim():!String(p.size||'').trim());
 const general=photos.filter(p=>!p.shotId&&!p.fieldPinId);
 const clocked=(job.crew||[]).filter(e=>e.start&&!e.end);
 const facts={
  bores:{issue:shots.length===0?'No bores recorded':openBores.length+' open / planned bores',ok:shots.length>0&&!openBores.length},
  locations:{issue:missingGps.length+' GPS locations missing'+(lowGps.length?' · '+lowGps.length+' low-accuracy positions':''),
   ok:!missingGps.length},
  photos:{issue:withoutAfter.length+' completed bores missing After photos',ok:!withoutAfter.length},
  install:{issue:incompletePins.length+' installations missing size/dimensions',ok:!incompletePins.length},
  unlinked:{issue:general.length+' unassigned/general photos to review',ok:true},
  crew:{issue:clocked.length+' crew clocks still open',ok:!clocked.length},
  paperwork:{issue:'Manual verification required',ok:true},
  asbuilt:{issue:'Manual verification required',ok:true}
 };
 return reviewSteps.map(step=>({...step,...facts[step.id],checked:!!job.asbuiltReview?.checks?.[step.id]?.checked,
  checkedAt:job.asbuiltReview?.checks?.[step.id]?.at||''}));
}
function renderChecklist(){
 const job=api()?.activeJob?.(),checks=checklist(job),done=checks.filter(c=>c.checked&&c.ok).length;
 if(!job)return '<div class="card spaced">Select a job to review its closeout.</div>';
 return '<section class="ab-completion"><div class="between"><div><span class="eyebrow">FIELD ATLAS / REVIEW</span><h2>Job Completion Checklist</h2><p class="smalltext muted">'+esc(job.jobName||'Job')+' · Manual foreman review</p></div><span class="ab-completion-count">'+done+'/'+checks.length+'</span></div>'+
 '<p class="smalltext muted spaced">This checks for missing field evidence. Reviewing an item never automatically completes bores, clock-outs or payroll.</p>'+
 '<div class="ab-completion-progress"><span style="width:'+(checks.length?Math.round(100*done/checks.length):0)+'%"></span></div>'+
 checks.map(c=>'<label class="ab-check'+(!c.ok?' issue':'')+'"><input type="checkbox" data-ab-review="'+esc(c.id)+'" '+(c.checked?'checked':'')+(c.ok?'':' disabled')+'>'+
 '<span><strong>'+esc(c.title)+'</strong><small>'+esc(c.description)+'</small>'+
 '<em>'+esc(c.issue)+(c.ok?(c.checked?' · Reviewed':' · Awaiting review'):' · Needs attention')+'</em></span></label>').join('')+
 '<div class="ab-check-footer"><strong>'+(checks.every(c=>c.checked&&c.ok)?'✓ All checklist items reviewed':'Review incomplete — correct missing records before sign-off')+'</strong>'+
 '<div class="action-row"><button class="btn ghost" data-ab-view="atlas">📍 Inspect Atlas</button><button class="btn primary" data-ab-pdf="job">▤ Generate As-Built PDF</button></div>'+
 '<p class="tiny muted">This is an internal checklist and not a professional survey, engineering approval, or regulatory certificate.</p></div></section>';
}
function setReviewed(id,checked){
 const job=api()?.activeJob?.(),item=checklist(job).find(x=>x.id===id);if(!job||!item)return;
 if(checked&&!item.ok)return api()?.notify?.('Resolve the missing records before marking this item reviewed.');
 if(!job.asbuiltReview||typeof job.asbuiltReview!=='object')job.asbuiltReview={checks:{}};
 if(!job.asbuiltReview.checks)job.asbuiltReview.checks={};
 job.asbuiltReview.checks[id]={checked:!!checked,at:checked?new Date().toISOString():''};
 api()?.save?.();api()?.render?.();api()?.notify?.(checked?'Checklist item reviewed.':'Checklist item reopened.');
}
document.addEventListener('click',e=>{
 const el=e.target.closest?.('[data-ab-month],[data-ab-day],[data-ab-today],[data-ab-goto],[data-ab-photo],[data-ab-pdf],[data-ab-path],[data-ab-gps],[data-ab-prev],[data-ab-next],[data-ab-visit-map],[data-ab-view],[data-ab-all-jobs],[data-ab-atlas-period],[data-ab-completion],[data-ab-type],[data-ab-suggest],[data-ab-link]');
 if(!el)return;
 if(el.hasAttribute('data-ab-month')){const [y,m]=month.split('-').map(Number),d=new Date(y,m-1+Number(el.dataset.abMonth),1);month=d.getFullYear()+'-'+pad(d.getMonth()+1);api()?.render?.();return}
 if(el.hasAttribute('data-ab-day')){selected=el.dataset.abDay;month=selected.slice(0,7);api()?.render?.();return}
 if(el.hasAttribute('data-ab-today')){selected=today();month=selected.slice(0,7);api()?.render?.();return}
 if(el.hasAttribute('data-ab-prev')||el.hasAttribute('data-ab-next')){
  const dates=activityDays(),target=el.hasAttribute('data-ab-prev')?[...dates].reverse().find(d=>d<selected):dates.find(d=>d>selected);
  if(!target)return api()?.notify?.('No other saved workday in this direction.');
  selected=target;month=target.slice(0,7);api()?.render?.();return;
 }
 if(el.hasAttribute('data-ab-visit-map')){atlasDayMode='selected';viewMode='atlas';showChecklist=false;api()?.render?.();return}
 if(el.dataset.abGoto){const found=eventsOn().find(x=>x.record.id===el.dataset.abGoto&&x.jobId===el.dataset.abJob&&x.type===el.dataset.abType);if(found)goToAtlas(found);return}
 if(el.dataset.abPhoto){openPhoto(el.dataset.abPhoto);return}
 if(el.dataset.abSuggest){suggestPhoto(el.dataset.abSuggest);return}
 if(el.dataset.abLink){linkPhoto(el.dataset.abLink,el.dataset.abLinkTarget);return}
 if(el.hasAttribute('data-ab-pdf')){exportAsBuilt(el.dataset.abPdf==='day'?selected:'');return}
 if(el.dataset.abPath){pathEditor(el.dataset.abPath);return}
 if(el.dataset.abGps){captureEndpoint(el.dataset.abGps);return}
 if(el.dataset.abView){viewMode=el.dataset.abView==='atlas'?'atlas':'calendar';showChecklist=false;api()?.render?.();return}
 if(el.hasAttribute('data-ab-all-jobs')){scope='all';showChecklist=false;api()?.render?.();return}
 if(el.dataset.abAtlasPeriod){atlasDayMode=el.dataset.abAtlasPeriod==='selected'?'selected':'all';api()?.render?.();return}
 if(el.hasAttribute('data-ab-completion')){showChecklist=!showChecklist;api()?.render?.();return}
 if(el.dataset.abType){typeFilter=Object.prototype.hasOwnProperty.call(typeLabels,el.dataset.abType)?el.dataset.abType:'all';api()?.render?.();return}
});
document.addEventListener('change',e=>{
 if(e.target.matches?.('[data-ab-picker]')&&/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){selected=e.target.value;month=selected.slice(0,7);api()?.render?.();return}
 if(e.target.matches?.('[data-ab-scope]')){scope=e.target.value==='all'?'all':'job';api()?.render?.();return}
 if(e.target.matches?.('[data-ab-review]')){setReviewed(e.target.dataset.abReview,e.target.checked);return}
});
document.addEventListener('input',e=>{
 if(e.target.matches?.('[data-ab-path-form] input[name="asbuiltStartLat"],[data-ab-path-form] input[name="asbuiltStartLon"],[data-ab-path-form] input[name="asbuiltEndLat"],[data-ab-path-form] input[name="asbuiltEndLon"]')){
  const form=e.target.closest?.('[data-ab-path-form]');if(!form)return;
  const endpoint=e.target.name.startsWith('asbuiltStart')?'asbuiltStart':'asbuiltEnd';
  if(form.elements?.[endpoint+'Accuracy'])form.elements[endpoint+'Accuracy'].value='';
  const hint=form.querySelector?.('[data-ab-accuracy-label="'+endpoint+'"]');if(hint)hint.textContent='Manual position — verify onsite';
  return;
 }
 if(!e.target.matches?.('[data-ab-search]'))return;
 searchQuery=String(e.target.value||'').slice(0,110);
 updateBody();
});
document.addEventListener('submit',e=>{const form=e.target.closest?.('[data-ab-path-form]');if(!form)return;e.preventDefault();savePath(form)});
window.BoreLabAsBuilt={renderCalendar,renderChecklist,checklist,eventsOn,allEvents,matchingEvents,atlasEvents,calendarHTML,detailsHTML,dayHistory,exportAsBuilt,pathEditor,pinPhotos,onPinPhotoSaved,dayOf,coords,valid,gpsQuality,goToMap,goToAtlas,openPhoto,candidateRecords,suggestPhoto,linkPhoto,setReviewed,
 setDay:x=>{if(/^\d{4}-\d{2}-\d{2}$/.test(String(x))){selected=x;month=x.slice(0,7)}},getDay:()=>selected,
 getScope:()=>scope,getSearch:()=>searchQuery,getType:()=>typeFilter,getView:()=>viewMode,getAtlasDayMode:()=>atlasDayMode,
 setScope:x=>{scope=x==='all'?'all':'job'},setView:x=>{viewMode=x==='atlas'?'atlas':'calendar';showChecklist=false},
 setAtlasPeriod:x=>{atlasDayMode=x==='selected'?'selected':'all'},setQuery:x=>{searchQuery=String(x||'').slice(0,110)},setType:x=>{typeFilter=typeLabels[x]?x:'all'}};
})();