/* BoreLab Field v0.26 — As-Built & Closeout Studio. Offline, per-job drafts. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge, native=()=>window.BoreLabNative;
const S=()=>api()?.state?.()||{}, job=()=>api()?.activeJob?.();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const xml=esc;
const valid=p=>p&&p.lat!==''&&p.lon!==''&&p.lat!=null&&p.lon!=null&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lon)&&+p.lat>=-90&&+p.lat<=90&&+p.lon>=-180&&+p.lon<=180;
const num=n=>Math.max(0,Number(n)||0), money=n=>'$'+num(n).toFixed(2);
const safe=x=>String(x||'Job').replace(/[^a-z0-9_-]+/gi,'_').slice(0,45);
const today=()=>new Date().toISOString().slice(0,10);
const editable=()=>!window.BoreLabLocalAccounts||window.BoreLabLocalAccounts.isUnlocked?.()&&['owner','foreman'].includes(window.BoreLabLocalAccounts.role?.());
const data=()=>{const j=job();if(!j)return{};if(!j.closeoutStudio||typeof j.closeoutStudio!=='object')j.closeoutStudio={};return j.closeoutStudio;};
const bill=()=>{const d=data();if(!Array.isArray(d.items))d.items=[];return d.items;};
const notes=()=>String(data().notes||'').slice(0,3000);
const recordDate=r=>String(r.occurredDay||r.occurredAt||r.completedAt||r.startedAt||r.createdAt||'').slice(0,10);
const plans=()=>{try{return JSON.parse(native()?.listCloseoutPlans?.(S().activeJobId)||'[]')}catch{return[]}};
const folder=()=>{try{return native()?.closeoutFolderName?.()||''}catch{return''}};
function quantities(){
 const j=job()||{},shots=j.shots||[],pins=j.fieldPins||[];
 return {feet:shots.filter(s=>s.status==='complete').reduce((v,s)=>v+num(s.feet),0),
  bores:shots.filter(s=>s.status==='complete').length,handholes:pins.filter(p=>['box','handhole'].includes(p.kind)).length,
  couplings:pins.filter(p=>p.kind==='coupling').length,tieins:pins.filter(p=>p.kind==='tie-in').length};
}
function recommendedRows(){
 const q=quantities();
 return [{id:'installed-feet',description:'Completed bore footage (verify with contract)',qty:q.feet,unit:'ft',rate:0},
 {id:'handholes',description:'Installed handholes / boxes',qty:q.handholes,unit:'each',rate:0},
 {id:'couplings',description:'Installed couplings',qty:q.couplings,unit:'each',rate:0},
 {id:'tieins',description:'Completed tie-ins',qty:q.tieins,unit:'each',rate:0}];
}
function asBuiltMarks(){
 const j=job()||{},out=[];
 for(const p of j.fieldPins||[])out.push({name:p.name||p.kind||'Installation',kind:p.kind||'Installation',date:recordDate(p),lat:valid(p)?String(p.lat):'',lon:valid(p)?String(p.lon):'',accuracy:String(p.gpsAccuracy??''),station:p.station||'',size:p.size||'',material:p.material||'',depth:p.depth||'',details:[p.notes,p.connectionType,p.fittingType,p.dimensions].filter(Boolean).join(' · ')});
 for(const sh of j.shots||[])for(const [key,kind] of [['asbuiltStart','Bore entry'],['asbuiltEnd','Bore exit']]){
  const pt=sh[key];if(valid(pt))out.push({name:sh.name||'Bore',kind,date:recordDate(sh),lat:String(pt.lat),lon:String(pt.lon),accuracy:String(pt.accuracy??''),station:'',size:sh.pipeDiameter||'',material:'',depth:key==='asbuiltStart'?sh.entryDepth||'':sh.exitDepth||'',details:'Recorded bore endpoint; not a traced underground alignment'});
 }
 return out;
}
function kml(){
 const j=job()||{},mark=asBuiltMarks(),points=mark.filter(p=>valid(p));
 const start='<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>'+xml(j.jobName||'BoreLab Field')+'</name><description>Field GPS reference locations only. Not a utility survey. Bore lines are straight visual references between recorded endpoints.</description>';
 const placemarks=points.map(p=>'<Placemark><name>'+xml(p.name+' — '+p.kind)+'</name><description>'+xml([p.date,p.station,p.size,p.details].filter(Boolean).join(' | '))+'</description><Point><coordinates>'+Number(p.lon)+','+Number(p.lat)+',0</coordinates></Point></Placemark>').join('');
 const lines=(j.shots||[]).filter(sh=>valid(sh.asbuiltStart)&&valid(sh.asbuiltEnd)).map(sh=>{
  const a=sh.asbuiltStart,b=sh.asbuiltEnd;
  return '<Placemark><name>'+xml((sh.name||'Bore')+' — schematic endpoint line')+'</name><description>STRAIGHT ENDPOINT REFERENCE ONLY. Not actual drilled path, depth, or surveyed alignment.</description><Style><LineStyle><color>ff148cff</color><width>3</width></LineStyle></Style><LineString><tessellate>1</tessellate><coordinates>'+Number(a.lon)+','+Number(a.lat)+',0 '+Number(b.lon)+','+Number(b.lat)+',0</coordinates></LineString></Placemark>';
 }).join('');
 return start+placemarks+lines+'</Document></kml>';
}
function byteData(str){return new TextEncoder().encode(str)}
function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));return btoa(s)}
function crc32(bytes){let n=0xFFFFFFFF;for(let i=0;i<bytes.length;i++){n^=bytes[i];for(let k=0;k<8;k++)n=n&1?(n>>>1)^0xEDB88320:n>>>1;}return(n^0xFFFFFFFF)>>>0}
function kmz(kmlText){
 // Valid uncompressed ZIP (KMZ) with one doc.kml entry; independent of network libraries.
 const contents=byteData(kmlText),name=byteData('doc.kml'),crc=crc32(contents),localLength=30+name.length+contents.length,output=new Uint8Array(localLength+46+name.length+22);
 const view=new DataView(output.buffer);let p=0;
 const u16=n=>{view.setUint16(p,n,true);p+=2},u32=n=>{view.setUint32(p,n>>>0,true);p+=4},write=a=>{output.set(a,p);p+=a.length};
 u32(0x04034b50);u16(20);u16(0);u16(0);u16(0);u16(0);u32(crc);u32(contents.length);u32(contents.length);u16(name.length);u16(0);write(name);write(contents);
 const central=p;
 u32(0x02014b50);u16(20);u16(20);u16(0);u16(0);u16(0);u16(0);u32(crc);u32(contents.length);u32(contents.length);u16(name.length);u16(0);u16(0);u16(0);u16(0);u32(0);u32(0);write(name);
 const centralSize=p-central;
 u32(0x06054b50);u16(0);u16(0);u16(1);u16(1);u32(centralSize);u32(central);u16(0);
 return output;
}
function exportGeo(ext,intoFolder=false){
 const n=native();if(!n?.saveBase64File){api()?.notify?.('Install the BoreLab Android APK to export Google Earth files.');return}
 const raw=kml(),bytes=ext==='kmz'?kmz(raw):byteData(raw);
 const name='BoreLab_'+safe(job()?.jobName)+'_'+today()+'.'+ext,mime=ext==='kmz'?'application/vnd.google-earth.kmz':'application/vnd.google-earth.kml+xml';
 try{
  if(intoFolder&&folder()&&n.exportCloseoutFolder)n.exportCloseoutFolder(name,mime,b64(bytes));
  else n.saveBase64File(name,mime,b64(bytes));
  api()?.notify?.('Google Earth '+ext.toUpperCase()+' prepared. Saved positions only; bore lines are schematic.');
 }catch(err){api()?.notify?.('Export failed: '+String(err.message||err))}
}
function report(kind){
 const j=job()||{},s=S(),d=data(),q=quantities(),rows=bill().filter(r=>String(r.description||'').trim()&&num(r.qty)>0);
 const photos=(api()?.photos?.()||[]).filter(p=>p.jobId===j.id||(!p.jobId&&s.legacyJobId===j.id)).slice(0,35);
 const amounts=rows.map(r=>num(r.qty)*num(r.rate)),total=amounts.reduce((a,b)=>a+b,0);
 const title=kind==='billing'?'Billing Worksheet — REVIEW DRAFT':'Customer As-Built & Closeout Packet';
 return {title,job:j.jobName||'Job',period:'Job-to-date · '+today(),generatedAt:new Date().toLocaleString(),homeBase:j.jobAddress||s.shopAddress||'Not recorded',
 customer:String(d.customer||'').slice(0,120),contract:String(d.contract||'').slice(0,100),
 preparedBy:String(d.preparedBy||'').slice(0,100),
 summary:{shots:String((j.shots||[]).length),completedFeet:q.feet+' ft',photos:String(photos.length),plannedPipe:'',actualPipe:'',crewHours:'',mudBatches:'',mudStockMoves:''},
 shots:(j.shots||[]).map(sh=>({name:sh.name||'Bore',status:sh.status||'pending',feet:String(sh.feet??''),pipeDiameter:sh.pipeDiameter||'',conduitDetails:Array.isArray(sh.conduits)?sh.conduits.map(c=>[c.size,c.quantity].join(' x ')).join('; '):'',performedBy:sh.performedBy||'',address:sh.address||'',notes:sh.notes||'',entryDepth:String(sh.entryDepth||''),exitDepth:String(sh.exitDepth||''),startedAt:sh.startedAt||'',completedAt:sh.completedAt||'',equipment:sh.equipment||'',rodCount:sh.rodCount||'',plannedPipe:'',actualPipe:''})),
 asbuilt:asBuiltMarks(),
 documents:plans().map(p=>({name:p.name||'Plan',detail:String(p.redlineCount||0)+' saved redline stroke(s) · Flattened marked plan exported separately'})),
 billing:kind==='billing'?rows.map((r,i)=>({name:r.description,qty:String(num(r.qty)),unit:r.unit||'each',rate:money(r.rate),amount:money(amounts[i])})):[],
 billingTotal:kind==='billing'?money(total):'',billingStatus:kind==='billing'?'DRAFT — not approved for invoicing. Field quantities and rates require review.':'',
 photos:kind==='billing'?[]:photos.map(p=>({shot:((j.shots||[]).find(sh=>sh.id===p.shotId)||(j.fieldPins||[]).find(pin=>pin.id===p.fieldPinId))?.name||'Field photo',date:p.addedAt||'',location:valid(p)?p.lat+', '+p.lon:'GPS not recorded',dataUrl:p.dataUrl||''})),
 crew:[],pipe:[],mud:[],mudStock:[],
 closeoutNote:(kind==='billing'?'Draft billing worksheet; no prices inferred from field footage. ':'GPS locations are field references, not surveyed utility positions. Schematic bore lines are not actual underground paths. ')+notes()
 };
}
function exportPdf(kind,intoFolder=false){
 const n=native();if(!n?.exportPdf)return api()?.notify?.('Native PDF export requires the installed Android APK.');
 saveForm();
 const filename='BoreLab_'+(kind==='billing'?'BillingDraft_':'CustomerAsBuilt_')+safe(job()?.jobName)+'_'+today()+'.pdf',payload=JSON.stringify(report(kind));
 try{
  if(intoFolder&&folder()&&n.exportCloseoutPdfFolder)n.exportCloseoutPdfFolder(filename,payload);
  else n.exportPdf(filename,payload);
  api()?.notify?.('PDF prepared. Review quantities, GPS and pictures before sending.');
 }catch(err){api()?.notify?.('PDF export failed: '+String(err.message||err))}
}
function saveForm(){
 const form=document.querySelector('[data-studio-form]');if(!form||!job())return;
 const d=data();for(const key of ['customer','contract','preparedBy','notes'])d[key]=String(form.elements[key]?.value||'').slice(0,key==='notes'?3000:120);
 const rows=[...form.querySelectorAll('[data-studio-line]')];d.items=rows.map(row=>({
  id:row.dataset.studioLine,description:String(row.querySelector('[name="description"]')?.value||'').slice(0,160),
  qty:Math.min(1e9,num(row.querySelector('[name="qty"]')?.value)),unit:String(row.querySelector('[name="unit"]')?.value||'each').slice(0,24),
  rate:Math.min(1e7,num(row.querySelector('[name="rate"]')?.value))
 }));
 api()?.save?.();
}
function rowHtml(r,i){
 return '<div class="studio-line" data-studio-line="'+esc(r.id||String(i))+'"><div class="between"><strong>Item '+(i+1)+'</strong><button type="button" class="btn micro ghost" data-studio-remove="'+esc(r.id||String(i))+'">Remove</button></div>'+
 '<label class="field">Description<input name="description" maxlength="160" value="'+esc(r.description||'')+'" placeholder="Installed conduit"></label>'+
 '<div class="studio-line-grid"><label class="field">Qty<input name="qty" type="number" min="0" step=".01" value="'+esc(r.qty??0)+'"></label>'+
 '<label class="field">Unit<input name="unit" maxlength="24" value="'+esc(r.unit||'each')+'"></label>'+
 '<label class="field">Rate ($)<input name="rate" type="number" min="0" step=".01" value="'+esc(r.rate??0)+'"></label></div>'+
 '<p class="tiny muted studio-line-total">Amount: '+money(num(r.qty)*num(r.rate))+'</p></div>';
}
function render(){
 const j=job();if(!j)return '<div class="page">Select a job first.</div>';
 const d=data(),q=quantities(),p=plans(),connected=folder();
 const editableNote=editable()?'':'<p class="note">Only owner and foreman accounts can edit or export closeout files.</p>';
 return '<div class="page closeout-studio"><div class="studio-hero"><span class="eyebrow">BORELAB / BATCH 2</span><h1>As-Built & Closeout Studio</h1>'+
 '<p>Customer handoff, job plans, Google Earth files and draft billing — organized by active job.</p><strong>'+esc(j.jobName||'Job')+'</strong></div>'+
 '<div class="studio-stats"><div><b>'+q.feet+'</b><small>Completed ft</small></div><div><b>'+asBuiltMarks().filter(valid).length+'</b><small>Saved GPS</small></div><div><b>'+p.length+'</b><small>PDF plans</small></div></div>'+
 editableNote+
 '<section class="card spaced"><div class="between"><h2>① Google Earth mapping</h2><span class="tag">KML / KMZ</span></div>'+
 '<p class="smalltext muted">Export saved handholes, couplings, boxes, tie-ins and bore entry/exit points. Endpoint-to-endpoint lines are <strong>straight visual references</strong>, not actual drilled alignments.</p>'+
 '<div class="action-row"><button class="btn primary" data-studio-kml="kml">Export KML</button><button class="btn ghost" data-studio-kml="kmz">Export KMZ</button><button class="btn ghost" data-page="jobmap">Open Field Map</button></div></section>'+
 '<section class="card spaced"><h2>② PDF plans & digital redlines</h2>'+
 '<p class="smalltext muted">Import a plan from your phone or Drive, keep it available offline, mark each PDF page in red, and export a flattened marked-up PDF.</p>'+
 '<div class="action-row"><button class="btn primary" data-studio-import>＋ Import PDF Plan</button></div>'+
 '<div class="studio-plan-list">'+(p.length?p.map(x=>'<div class="studio-plan"><span><strong>'+esc(x.name)+'</strong><small>'+esc(String(x.redlineCount||0))+' redline strokes · '+esc(x.importedAt?.slice(0,10)||'')+'</small></span><div class="action-row"><button class="btn micro primary" data-studio-open="'+esc(x.id)+'">Open / Redline</button><button class="btn micro ghost" data-studio-delete="'+esc(x.id)+'">Delete</button></div></div>').join(''):'<p class="tiny muted">No plans imported for this job yet.</p>')+'</div></section>'+
 '<section class="card spaced"><h2>③ Optional Google Drive / folder handoff</h2>'+
 '<p class="smalltext muted">Connect a folder using Android’s document provider, or choose Google Drive in the Save picker for individual exports. Drive only appears for folder connection when the installed Drive provider supports selecting folders. No BoreLab server or account token.</p>'+
 '<p class="studio-connected">'+(connected?'Connected folder: '+esc(connected):'No folder connected yet')+'</p>'+
 '<div class="action-row"><button class="btn ghost" data-studio-folder>Connect Folder</button><button class="btn ghost" data-studio-folder-pdf>Save As-Built to Folder</button><button class="btn ghost" data-studio-folder-kmz>Save KMZ to Folder</button></div></section>'+
 '<form data-studio-form><section class="card spaced"><h2>④ Customer job details</h2>'+
 '<div class="studio-fields"><label class="field">Customer / prime<input name="customer" maxlength="120" value="'+esc(d.customer||'')+'" placeholder="Customer or utility"></label>'+
 '<label class="field">PO / job / contract #<input name="contract" maxlength="120" value="'+esc(d.contract||'')+'" placeholder="Optional"></label>'+
 '<label class="field">Prepared by<input name="preparedBy" maxlength="120" value="'+esc(d.preparedBy||'')+'" placeholder="Foreman / company"></label></div>'+
 '<label class="field">Closeout notes<textarea name="notes" maxlength="3000" rows="3">'+esc(notes())+'</textarea></label></section>'+
 '<section class="card spaced"><div class="between"><h2>⑤ Billing worksheet</h2><span class="tag">DRAFT</span></div>'+
 '<p class="smalltext muted">Field counts are a starting reference only. Confirm contract units, exclusions, footage and prices before invoicing. Nothing is auto-approved.</p>'+
 '<div class="studio-records">Recorded: '+q.feet+' completed ft · '+q.handholes+' boxes/HH · '+q.couplings+' couplings · '+q.tieins+' tie-ins</div>'+
 '<div class="studio-lines">'+bill().map(rowHtml).join('')+'</div>'+
 '<div class="action-row"><button class="btn ghost" type="button" data-studio-suggest>Load Suggested Quantities</button><button class="btn ghost" type="button" data-studio-add>＋ Billing Item</button></div>'+
 '<p class="studio-total" data-studio-total>Draft total: '+money(bill().reduce((n,r)=>n+num(r.qty)*num(r.rate),0))+'</p></section>'+
 '<section class="card spaced"><h2>⑥ Customer-ready deliverables</h2><p class="smalltext muted">As-built report contains the job’s bore log, recorded GPS installations, plan index and linked photos. Flattened redline plans export separately from the PDF viewer.</p>'+
 '<div class="studio-deliverables"><button type="button" class="btn primary" data-studio-pdf="customer">▤ Customer As-Built PDF</button><button type="button" class="btn ghost" data-studio-pdf="billing">▤ Billing Draft PDF</button></div>'+
 '<p class="tiny muted">Customer packets still require foreman review and any customer-specific signoffs; BoreLab cannot certify survey accuracy.</p></section>'+
 '<button type="submit" class="btn ghost full">Save Closeout Draft</button></form></div>';
}
function onNativeResult(payload){
 if(payload?.error)api()?.notify?.(String(payload.error));
 else if(payload?.message)api()?.notify?.(String(payload.message));
 if(api()?.currentPage?.()==='studio')api()?.render?.();
}
document.addEventListener('click',ev=>{
 if(api()?.currentPage?.()!=='studio')return;
 const el=ev.target.closest?.('button');if(!el)return;
 if(!editable()&&[...el.attributes].some(a=>a.name.startsWith('data-studio')))return api()?.notify?.('Foreman/owner access required.');
 const d=el.dataset;
 if(d.studioKml){exportGeo(d.studioKml);return}
 if(el.hasAttribute('data-studio-import')){native()?.importCloseoutPlan?.(S().activeJobId);if(!native()?.importCloseoutPlan)api()?.notify?.('Use the installed Android app to import plans.');return}
 if(el.hasAttribute('data-studio-folder')){native()?.connectCloseoutFolder?.();return}
 if(el.hasAttribute('data-studio-folder-pdf')){if(!folder())return api()?.notify?.('Connect a compatible folder first, or use the normal Save picker.');exportPdf('customer',true);return}
 if(el.hasAttribute('data-studio-folder-kmz')){if(!folder())return api()?.notify?.('Connect a compatible folder first.');exportGeo('kmz',true);return}
 if(d.studioOpen){native()?.openCloseoutPlan?.(d.studioOpen);return}
 if(d.studioDelete){if(!confirm('Delete this imported offline plan and its saved redlines?'))return;native()?.deleteCloseoutPlan?.(d.studioDelete);return}
 if(d.studioPdf){exportPdf(d.studioPdf);return}
 if(el.hasAttribute('data-studio-add')){saveForm();bill().push({id:'line-'+Date.now(),description:'',qty:0,unit:'each',rate:0});api()?.save?.();api()?.render?.();return}
 if(el.hasAttribute('data-studio-suggest')){if(bill().length&&!confirm('Replace your saved billing rows with suggested field quantities? Prices will reset to $0.'))return;data().items=recommendedRows();api()?.save?.();api()?.render?.();return}
 if(d.studioRemove){saveForm();data().items=bill().filter(r=>r.id!==d.studioRemove);api()?.save?.();api()?.render?.();return}
});
document.addEventListener('submit',e=>{if(e.target.matches?.('[data-studio-form]')){e.preventDefault();if(!editable())return;saveForm();api()?.notify?.('Closeout draft saved to this job.')}});
document.addEventListener('change',e=>{if(api()?.currentPage?.()==='studio'&&e.target.closest?.('[data-studio-form]')&&editable())saveForm()});
document.addEventListener('input',e=>{if(!e.target.closest?.('[data-studio-line]'))return;const row=e.target.closest('[data-studio-line]');row.querySelector('.studio-line-total').textContent='Amount: '+money(num(row.querySelector('[name="qty"]').value)*num(row.querySelector('[name="rate"]').value));const rows=[...document.querySelectorAll('[data-studio-line]')];const total=rows.reduce((n,r)=>n+num(r.querySelector('[name="qty"]').value)*num(r.querySelector('[name="rate"]').value),0);const el=document.querySelector('[data-studio-total]');if(el)el.textContent='Draft total: '+money(total);});
window.BoreLabCloseoutStudio={render,kml,kmz,asBuiltMarks,recommendedRows,quantities,report,exportPdf,exportGeo,onNativeResult,saveForm};
})();