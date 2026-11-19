/* BoreLab Field — Dated Bores search and physical installation pins.
   Data remains under each saved job; works offline with existing JSON backup. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kindLabels={'tie-in':'Tie-in',coupling:'Coupling',box:'Box'};
const kindLabel=x=>kindLabels[x]||'Field marker';
const currentJob=()=>api()?.activeJob?.();
const pins=()=>Array.isArray(currentJob()?.fieldPins)?currentJob().fieldPins:[];
const ensurePins=()=>{const j=currentJob();if(!j)return null;if(!Array.isArray(j.fieldPins))j.fieldPins=[];return j.fieldPins;};
const pad=x=>String(x).padStart(2,'0');
const localDay=x=>{if(!x)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(String(x)))return String(x);const d=new Date(x);return Number.isNaN(+d)?'':d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
const today=()=>localDay(new Date().toISOString());
const datesOf=r=>([r.occurredDay,r.occurredAt,r.completedAt,r.startedAt,r.createdAt,r.updatedAt]).filter(Boolean);
function dateTerms(r){
 const terms=new Set();
 datesOf(r).forEach(v=>{
  const day=localDay(v);if(!day)return;
  const [y,m,d]=day.split('-');const dt=new Date(Number(y),Number(m)-1,Number(d),12);
  [day,m+'/'+d+'/'+y,Number(m)+'/'+Number(d)+'/'+y,m+'/'+d,Number(m)+'/'+Number(d),m+'-'+d+'-'+y,dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),dt.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}),dt.toLocaleDateString('en-US',{month:'short',day:'numeric'})].forEach(s=>terms.add(s.toLowerCase()));
 });
 return Array.from(terms).join(' ');
}
function displayDate(r){
 const raw=r.occurredDay||r.occurredAt||r.completedAt||r.startedAt||r.createdAt||r.updatedAt;
 const day=localDay(raw);if(!day)return 'Date not recorded';
 const [y,m,d]=day.split('-');return new Date(Number(y),Number(m)-1,Number(d),12).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
const records=()=>[...(api()?.state?.()?.shots||[]).map(s=>({...s,recordType:'bore-shot'})),...pins().map(p=>({...p,recordType:'fieldPin'}))];
let query='',dayFilter='';
function matching(){
 const q=query.trim().toLowerCase();
 return records().filter(r=>{
  if(dayFilter&&!datesOf(r).some(d=>localDay(d)===dayFilter))return false;
  if(!q)return true;
  return [r.name,r.address,r.notes,r.feet,r.recordType==='fieldPin'?kindLabel(r.kind):'Bore shot',dateTerms(r)].some(v=>String(v??'').toLowerCase().includes(q));
 }).sort((a,b)=>String(b.occurredAt||b.completedAt||b.startedAt||b.updatedAt||b.createdAt||'').localeCompare(String(a.occurredAt||a.completedAt||a.startedAt||a.updatedAt||a.createdAt||'')));
}
function renderResults(){
 if(!query.trim()&&!dayFilter)return '<p class="tiny muted">Search a name, address, or date, or choose a day from the calendar. Results stay on this device.</p>';
 const result=matching();
 if(!result.length)return '<p class="smalltext muted">No saved bore or field markers match this search for this job.</p>';
 return '<p class="tiny muted">'+result.length+' saved record'+(result.length===1?'':'s')+' found</p>'+
 result.slice(0,80).map(r=>'<button type="button" class="fp-result" data-fp-open="'+esc(r.id)+'" data-fp-kind="'+(r.recordType==='fieldPin'?'pin':'shot')+'">'+
 '<span class="fp-result-icon '+(r.recordType==='fieldPin'?'fp-'+esc(r.kind):'fp-shot')+'">'+(r.recordType==='fieldPin'?'📍':'⌁')+'</span>'+
 '<span><strong>'+esc(r.name||kindLabel(r.kind))+'</strong><small>'+esc(r.recordType==='fieldPin'?kindLabel(r.kind):'Bore shot · '+Number(r.feet||0)+' ft')+' · '+esc(displayDate(r))+'</small></span>'+
 '<span aria-hidden="true">›</span></button>').join('')+
 (result.length>80?'<p class="tiny muted">Showing the first 80 matches. Narrow the search or date to find older entries.</p>':'');
}
function renderBoresTools(){
 return '<section class="card fp-bores-tools"><div class="between"><div><span class="eyebrow">FIELD RECORDS</span><h3>Find a Bore or Field Pin</h3></div><div class="fp-quick-nav"><button type="button" class="btn micro ghost" data-page="fieldhistory">📅 Calendar</button><button type="button" class="btn micro ghost" data-page="jobmap">📌 Map</button></div></div>'+
 '<label class="field spaced">Search shots, couplings, boxes, tie-ins or dates<input type="search" data-fp-query maxlength="100" autocomplete="off" placeholder="Shot 03, 11/19/2026, coupling..." value="'+esc(query)+'"></label>'+
 '<div class="fp-search-row"><label class="field">Work date<input type="date" data-fp-day value="'+esc(dayFilter)+'"></label><button type="button" class="btn micro ghost" data-fp-clear>Clear</button></div>'+
 '<div class="fp-results" data-fp-results>'+renderResults()+'</div>'+
 '<div class="fp-add-row"><button type="button" class="btn primary" data-fp-add="tie-in">＋ Tie-in</button><button type="button" class="btn ghost" data-fp-add="coupling">＋ Coupling</button><button type="button" class="btn ghost" data-fp-add="box">＋ Box</button></div>'+
 '<p class="tiny muted spaced">Saved locations get pins on the Jobsite Map. A date can be entered even for work recorded afterward.</p></section>';
}
function editPin(id='',initialKind='tie-in'){
 const current=pins().find(p=>p.id===id);
 const kind=kindLabels[current?.kind]?current.kind:(kindLabels[initialKind]?initialKind:'tie-in');
 const name=current?.name||'';
 const date=localDay(current?.occurredDay||current?.occurredAt)||today();
 api()?.showModal?.('<div class="modal-head"><h2>'+(current?'Edit':'Add')+' Field Pin</h2><button class="icon-btn" type="button" data-action="close-modal">✕</button></div>'+
 '<p class="smalltext muted">Log the actual installed location. GPS is required for a map pin, but the record can be saved without it and located later.</p>'+
 '<form data-fp-form data-fp-id="'+esc(id)+'"><label class="field">Type<select name="kind" data-fp-kind-select>'+Object.keys(kindLabels).map(k=>'<option value="'+k+'"'+(k===kind?' selected':'')+'>'+kindLabel(k)+'</option>').join('')+'</select></label>'+
 '<label class="field">Label<input name="name" maxlength="80" value="'+esc(name)+'" placeholder="e.g. Coupling at STA 3+50"></label>'+
 '<label class="field">Work date<input type="date" name="occurredDay" required value="'+esc(date)+'"></label>'+
 '<label class="field">Address / landmark (optional)<input name="address" maxlength="250" value="'+esc(current?.address||'')+'" placeholder="Nearest access point or street"></label>'+
  '<div class="fp-install-details"><p class="eyebrow">SMART INSTALLATION DETAILS</p><div class="form-grid"><label class="field">Station / reference<input name="station" maxlength="70" value="'+esc(current?.station||'')+'" placeholder="STA 3+50"></label><label class="field">Pipe / fitting size<input name="size" maxlength="70" value="'+esc(current?.size||'')+'" placeholder="2 in"></label><label class="field">Material<input name="material" maxlength="90" value="'+esc(current?.material||'')+'" placeholder="HDPE / PVC"></label><label class="field">Depth (ft)<input name="depth" type="number" min="0" max="200" step="any" value="'+esc(current?.depth??'')+'" placeholder="Optional"></label></div>'+ 
  '<label class="field" data-fp-only="tie-in"'+(kind==='tie-in'?'':' hidden')+'>Connection type<input name="connectionType" maxlength="100" value="'+esc(current?.connectionType||'')+'" placeholder="Service / main / reducer"></label>'+ 
  '<label class="field" data-fp-only="coupling"'+(kind==='coupling'?'':' hidden')+'>Coupling / fitting style<input name="fittingType" maxlength="100" value="'+esc(current?.fittingType||'')+'" placeholder="Fusion / mechanical / transition"></label>'+ 
  '<label class="field" data-fp-only="box"'+(kind==='box'?'':' hidden')+'>Box type / dimensions<input name="dimensions" maxlength="100" value="'+esc(current?.dimensions||'')+'" placeholder="Handhole, 24 x 36"></label></div>'+
 '<div class="form-grid"><label class="field">Latitude<input name="lat" type="number" step="any" value="'+esc(current?.lat??'')+'" placeholder="GPS latitude"></label>'+
 '<label class="field">Longitude<input name="lon" type="number" step="any" value="'+esc(current?.lon??'')+'" placeholder="GPS longitude"></label></div>'+
 '<input type="hidden" name="gpsAccuracy" value="'+esc(current?.gpsAccuracy??'')+'"><input type="hidden" name="gpsSource" value="'+esc(current?.gpsSource??'')+'">'+
  '<button type="button" class="btn ghost" data-fp-gps>◎ Use current GPS</button><p class="tiny muted" data-fp-accuracy>'+(current?.gpsAccuracy?'Saved GPS accuracy ±'+esc(current.gpsAccuracy)+' m':'GPS accuracy not yet recorded · manual points are unverified')+'</p>'+
 '<label class="field spaced">Notes (optional)<textarea name="notes" maxlength="1500" rows="3" placeholder="Size, depth, station, nearby landmarks...">'+esc(current?.notes||'')+'</textarea></label>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button type="submit" class="btn primary">Save Field Pin</button></div></form>'+
 (current?'<div class="lightline"><button type="button" class="btn micro danger" data-fp-delete="'+esc(id)+'">Delete Pin</button></div>':''));
}
async function useGps(){
 try{
  api()?.notify?.('Requesting GPS for this field marker…');
  const p=await api()?.getPosition?.();
  if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon))throw Error('GPS could not be captured.');
  const form=document.querySelector('[data-fp-form]');if(!form)return;
  form.elements.lat.value=Number(p.lat).toFixed(6);
  form.elements.lon.value=Number(p.lon).toFixed(6);
   if(form.elements.gpsAccuracy)form.elements.gpsAccuracy.value=Number.isFinite(+p.accuracy)?Math.round(p.accuracy):'';
   if(form.elements.gpsSource)form.elements.gpsSource.value='device';
   const accuracy=form.querySelector?.('[data-fp-accuracy]');if(accuracy)accuracy.textContent='Device GPS accuracy ±'+Math.round(p.accuracy||0)+' m'+(p.accuracy>25?' · check location before relying on pin':'');
  api()?.notify?.('GPS saved to form (±'+Math.round(p.accuracy||0)+' m). Tap Save Field Pin.');
 }catch(e){api()?.notify?.((e?.message||'GPS unavailable')+' Enter coordinates manually if needed.');}
}
function savePin(form){
 const list=ensurePins();if(!list)return api()?.notify?.('Choose a job before adding a field pin.');
 const data=new FormData(form),id=form.dataset.fpId||'',old=list.find(p=>p.id===id);
 const kind=String(data.get('kind')||'');if(!kindLabels[kind])return api().notify('Select a valid marker type.');
 const day=String(data.get('occurredDay')||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||localDay(day)!==day)return api().notify('Enter a valid work date.');
 const lat=String(data.get('lat')||'').trim(),lon=String(data.get('lon')||'').trim();
 if((lat&&!lon)||(!lat&&lon))return api().notify('Enter both GPS coordinates or leave both blank.');
 if(lat&&(!Number.isFinite(+lat)||!Number.isFinite(+lon)||+lat < -90||+lat > 90||+lon < -180||+lon > 180))return api().notify('Check latitude and longitude before saving.');
 const now=new Date().toISOString();
 const record={id:old?.id||api().uid(),recordType:'fieldPin',jobId:api().state().activeJobId,kind,
  name:String(data.get('name')||'').trim().slice(0,80)||kindLabel(kind),
  occurredDay:day,createdAt:old?.createdAt||now,updatedAt:now,
  lat,lon,address:String(data.get('address')||'').trim().slice(0,250),
  notes:String(data.get('notes')||'').trim().slice(0,1500),
   station:String(data.get('station')||'').trim().slice(0,70),size:String(data.get('size')||'').trim().slice(0,70),
   material:String(data.get('material')||'').trim().slice(0,90),depth:String(data.get('depth')||'').trim().slice(0,30),
   connectionType:String(data.get('connectionType')||'').trim().slice(0,100),
   fittingType:String(data.get('fittingType')||'').trim().slice(0,100),dimensions:String(data.get('dimensions')||'').trim().slice(0,100),
   gpsAccuracy:lat?String(data.get('gpsAccuracy')||old?.gpsAccuracy||'').slice(0,16):'',
   gpsSource:lat?String(data.get('gpsSource')||old?.gpsSource||'manual').slice(0,20):''};
 if(old)list.splice(list.indexOf(old),1,record);else list.push(record);
 api().state().demo=false;api().save();api().closeModal();
 api().render();api().notify(kindLabel(kind)+' pinned'+(lat?' on the map.':' as a record. Add GPS to map it.'));
 if(api().currentPage()==='jobmap'&&lat)requestAnimationFrame(()=>window.BoreLabJobMap?.reset?.());
}
function open(id,which){
 if(which==='shot'){api()?.shotDetail?.(id);return;}
 const p=pins().find(p=>p.id===id);if(!p)return;
 const url=api()?.mapsPinUrl?.(p);
 const linked=window.BoreLabAsBuilt?.pinPhotos?.(id)||[];
 const details=[p.station,p.size,p.material,p.depth?'Depth '+p.depth+' ft':'',p.connectionType,p.fittingType,p.dimensions].filter(Boolean);
 api()?.showModal?.('<div class="modal-head"><h2>📌 '+esc(p.name)+'</h2><button class="icon-btn" data-action="close-modal">✕</button></div>'+
 '<div class="card"><p><strong>'+esc(kindLabel(p.kind))+'</strong> · '+esc(displayDate(p))+'</p>'+
 '<p class="smalltext">'+esc(p.address||'No street address saved')+'</p>'+
 '<p class="smalltext muted">'+esc(details.join(' · ')||'No installation measurements yet')+'</p><p class="smalltext muted">'+esc(p.notes||'No extra notes')+'</p>'+
 '<p class="tiny muted">'+(p.lat&&p.lon?'GPS '+esc(p.lat)+', '+esc(p.lon)+(p.gpsAccuracy?' · ±'+esc(p.gpsAccuracy)+' m':''): 'GPS not yet saved')+'</p>'+
  (linked.length?'<div class="fp-pin-photos">'+linked.slice(0,6).map(photo=>'<button type="button" data-fp-photo-open="'+esc(photo.id)+'"><img src="'+esc(photo.dataUrl)+'" alt="Linked installation photo" loading="lazy"></button>').join('')+'</div>':'')+'</div>'+
 '<div class="action-row"><button class="btn primary" data-fp-edit="'+esc(p.id)+'">Edit Pin</button><button class="btn ghost" data-fp-photo="'+esc(p.id)+'">📸 Capture & Pin</button>'+
 (url?'<button class="btn ghost" data-fp-nav="'+esc(p.id)+'">⌖ Navigate</button>':'')+'</div>');
}
document.addEventListener('input',e=>{
 if(!e.target.matches?.('[data-fp-query]'))return;
 query=e.target.value.slice(0,100);
 const el=document.querySelector('[data-fp-results]');if(el)el.innerHTML=renderResults();
});
document.addEventListener('change',e=>{
 if(!e.target.matches?.('[data-fp-day]'))return;
 dayFilter=e.target.value;const el=document.querySelector('[data-fp-results]');if(el)el.innerHTML=renderResults();
});
document.addEventListener('click',e=>{
 const btn=e.target.closest?.('[data-fp-clear],[data-fp-add],[data-fp-open],[data-fp-gps],[data-fp-edit],[data-fp-delete],[data-fp-nav],[data-fp-photo],[data-fp-photo-open]');
 if(!btn)return;
 if(btn.hasAttribute('data-fp-clear')){query='';dayFilter='';api()?.render?.();return}
 if(btn.dataset.fpAdd){editPin('',btn.dataset.fpAdd);return}
 if(btn.hasAttribute('data-fp-open')){open(btn.dataset.fpOpen,btn.dataset.fpKind);return}
 if(btn.hasAttribute('data-fp-gps')){useGps();return}
 if(btn.dataset.fpEdit){editPin(btn.dataset.fpEdit);return}
  if(btn.dataset.fpPhoto){api()?.capturePinPhoto?.(btn.dataset.fpPhoto);return}
  if(btn.dataset.fpPhotoOpen){api()?.photoDetail?.(btn.dataset.fpPhotoOpen);return}
 if(btn.dataset.fpNav){const p=pins().find(x=>x.id===btn.dataset.fpNav);const url=p&&api()?.mapsPinUrl?.(p);if(url)api()?.openMapUrl?.(url);return}
 if(btn.dataset.fpDelete){
  const p=pins().find(x=>x.id===btn.dataset.fpDelete);
  if(!p||!confirm('Delete this '+kindLabel(p.kind)+' marker? This removes it from the map and saved records.'))return;
  const list=ensurePins();list.splice(list.indexOf(p),1);
  api().save();api().closeModal();api().render();api().notify('Field marker removed.');
 }
});
document.addEventListener('change',e=>{if(!e.target.matches?.('[data-fp-kind-select]'))return;const form=e.target.closest('form[data-fp-form]');form?.querySelectorAll?.('[data-fp-only]').forEach(el=>{el.hidden=el.getAttribute('data-fp-only')!==e.target.value});});
document.addEventListener('submit',e=>{
 const form=e.target.closest?.('form[data-fp-form]');if(!form)return;
 e.preventDefault();savePin(form);
});
window.BoreLabFieldPins={pins,kindLabel,dateTerms,displayDate,localDay,renderBoresTools,renderResults,matching,editPin,open,ensurePins};
})();