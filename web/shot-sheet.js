/* BoreLab Field v0.15 — scan handwritten or printed shot sheets into reviewed draft bores. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const conduits=()=>window.BoreLabConduits;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(x,n=250)=>String(x??'').trim().slice(0,n);
let pendingRows=[],ocrText='',sourceError='',sourceName='',scanning=false;
const root=document.createElement('div');root.id='bl-shot-sheet';root.hidden=true;document.body.appendChild(root);
const css=document.createElement('style');
css.textContent='#bl-shot-sheet[hidden]{display:none!important}#bl-shot-sheet{position:fixed;inset:0;overflow:auto;overscroll-behavior:contain;z-index:10500;background:var(--bg,#09141f);color:var(--text,#f4f8fb);font-family:system-ui,sans-serif;padding:18px 14px 80px}#bl-shot-sheet *{box-sizing:border-box}#bl-shot-sheet .bls-wrap{max-width:760px;margin:auto}#bl-shot-sheet button{cursor:pointer}#bl-shot-sheet .bls-header{display:flex;gap:12px;align-items:center;margin-bottom:15px}#bl-shot-sheet h1{font-size:24px;margin:0}#bl-shot-sheet h2{font-size:17px}#bl-shot-sheet .bls-card{background:var(--surface2,#162839);border:1px solid var(--line,#294258);padding:14px;border-radius:16px;margin:12px 0}#bl-shot-sheet .bls-muted{font-size:12px;color:var(--muted,#95acbd);line-height:1.5}#bl-shot-sheet .bls-btn{border:1px solid var(--line,#294258);color:var(--text,#f4f8fb);background:var(--surface3,#203448);border-radius:11px;padding:11px 13px;font-weight:750}#bl-shot-sheet .bls-primary{border-color:transparent;background:var(--accent,#ff992c);color:#10202b}#bl-shot-sheet .bls-row{display:flex;gap:9px;flex-wrap:wrap;align-items:center}#bl-shot-sheet .bls-shot{border-bottom:1px solid var(--line,#294258);padding:13px 0}#bl-shot-sheet .bls-shot:last-child{border-bottom:0}#bl-shot-sheet .bls-fields{display:grid;grid-template-columns:minmax(110px,1fr) minmax(75px,.4fr);gap:9px}#bl-shot-sheet .bls-fields .bls-wide{grid-column:1/-1}#bl-shot-sheet label{font-size:12px;font-weight:750;display:block}#bl-shot-sheet input[type=text],#bl-shot-sheet input[type=number],#bl-shot-sheet textarea{display:block;width:100%;margin-top:5px;min-width:0;padding:11px;border:1px solid var(--line,#294258);border-radius:10px;background:var(--surface,#111f2d);color:var(--text)}#bl-shot-sheet input[type=checkbox]{width:17px;height:17px}#bl-shot-sheet .bls-status{margin:12px 0;font-size:13px}#bl-shot-sheet .bls-raw{max-height:160px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:11px}#bl-shot-sheet .bls-finish{position:sticky;bottom:0;background:var(--bg,#09141f);padding:9px 0;border-top:1px solid var(--line,#294258)}';
document.head.appendChild(css);
const fileCamera=document.createElement('input');fileCamera.type='file';fileCamera.accept='image/*';fileCamera.setAttribute('capture','environment');fileCamera.hidden=true;
const fileGallery=document.createElement('input');fileGallery.type='file';fileGallery.accept='image/*';fileGallery.hidden=true;
document.body.append(fileCamera,fileGallery);

function parseConduitSpec(value){
 const text=String(value||'').trim();
 if(!text)return[];
 const rows=[],terms=text.split(/[;,]+/).map(x=>x.trim()).filter(Boolean);
 for(const raw of terms){
  let m=raw.match(/^(\d{1,2})\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?$/i);
  if(m){rows.push({size:m[2]+' inch',quantity:Number(m[1]),perRunFeet:''});continue}
  m=raw.match(/^(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*(?:[x×]\s*(\d{1,2}))?$/i);
  if(m){rows.push({size:m[1]+' inch',quantity:Number(m[2]||1),perRunFeet:''});continue}
  m=raw.match(/^(\d+\s+\d+\/\d+|\d+\/\d+)\s*"\s*(?:[x×]\s*(\d{1,2}))?$/);
  if(m){rows.push({size:m[1]+' inch',quantity:Number(m[2]||1),perRunFeet:''});continue}
  throw Error('Cannot read conduit entry "'+raw+'". Use formats like 4 inch x2, 1.25 inch x1.');
 }
 if(rows.length>30||rows.some(x=>!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>50))throw Error('Use 1–50 conduits per line (30 sizes maximum).');
 return rows;
}
function specFromConduits(items){
 return (items||[]).map(x=>x.size+' x'+x.quantity).join(', ');
}
function parseSizeSpecs(text){
 const src=String(text||''),found=[];
 const clean=src.replace(/\b(?:shot|bore)\s*(?:#|no\.)?\s*\d{1,3}\b/ig,'');
 // Two ways a shot sheet writes a conduit: 2x4" and 4" x2.
 const re=/\b(?:(\d{1,2})\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(?:"|inches\b|inch\b|in\b)(?:\s*[x×]\s*(\d{1,2}))?/gi;
 for(const match of clean.matchAll(re)){
  const qty=Number(match[1]||match[3]||1),size=Number(match[2]);
  if(!Number.isFinite(size)||size<=0||size>48||!Number.isInteger(qty)||qty<1||qty>50)continue;
  found.push({size:size+' inch',quantity:qty,perRunFeet:''});
 }
 return found;
}
function lineAddress(line){
 const value=String(line||'');
 // Avoid capturing preceding shot length or conduit descriptions as part of an address.
 const match=value.match(/\b(\d{1,6}\s+[A-Za-z][A-Za-z0-9 .'-]{1,65}\s+(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Highway|Hwy|Circle|Cir|Trail|Trl)\b\.?(?:\s*,?\s*[A-Za-z .'-]+,?\s*[A-Z]{2}\s*\d{5})?)/i);
 const rural=value.match(/\b((?:County Road|State Road|CR|SR|US Highway|US Hwy|Highway|Hwy)\s*[-#]?\s*\d{1,5}[A-Za-z]?)\b/i);
 const plus=value.match(/\b([23456789CFGHJMPQRVWX]{2,8}\s*\+\s*[23456789CFGHJMPQRVWX]{2,3})(?:\s+([A-Za-z][A-Za-z ,.'-]{2,65}))?/i);
 const gps=value.match(/(-?\d{1,2}\.\d{4,})\s*[,;]\s*(-?\d{1,3}\.\d{4,})/);
 return (match?match[1]:rural?rural[1]:plus?(plus[1]+(plus[2]?' '+plus[2]:'')):gps?(gps[1]+','+gps[2]):'').trim().slice(0,250);
}
function lengthOnLine(line){
 const raw=String(line||''),match=raw.match(/(?:^|[^\d])(\d{1,5}(?:\.\d+)?)\s*(?:ft\b|feet\b|foot\b|['′](?=\s|$|[^\w]))/i);
 if(!match)return'';
 const n=Number(match[1]);
 return Number.isFinite(n)&&n>0&&n<=100000?n:'';
}
function parseSheet(text){
 const raw=String(text||'').slice(0,15000);
 const lines=raw.split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
 const locations=(typeof window!=='undefined'?window.BoreLabLocations?.locationCandidates(raw):null)||[];
 const defaultAddress=locations[0]?.value||lines.map(lineAddress).find(Boolean)||'';
 const orderLine=lines.findIndex(line=>/work\s*order\s*(?:#|number)?/i.test(line));
 const orderId=((orderLine>=0?lines.slice(orderLine,orderLine+3).join(' '):'').match(/\b\d{5,8}\b/)||[])[0]||'';
 const found=[];let current=null,serial=0;
 const shotHeading=/\b(?:shot|bore)\s*(?:#|no\.?\s*)?([0-9]{1,3}[a-z]?)\b/i;
 function finish(){if(!current)return;if(!current.address)current.address=defaultAddress;found.push(current);current=null}
 for(let i=0;i<lines.length&&found.length<70;i++){
  const line=lines[i],heading=line.match(shotHeading),distance=lengthOnLine(line);
  const shotStarts=!!heading||(distance!==''&&(!current||current.feet!==''));
  if(shotStarts){
   finish();serial++;
   current={name:heading?'Shot '+heading[1]:'Shot '+String(serial).padStart(2,'0'),feet:distance,address:'',conduits:[],selected:distance!==''};
  }else if(!current)continue;
  if(current.feet===''&&distance!==''){current.feet=distance;current.selected=true}
  const address=lineAddress(line);
  if(address&&!current.address)current.address=address;
  else if(!current.address&&/^(?:address|location)\s*[:\-]/i.test(line)){
   current.address=line.replace(/^(?:address|location)\s*[:\-]\s*/i,'').slice(0,250);
  }
  const extracted=parseSizeSpecs(line);
  if(extracted.length){
   const seen=new Set(current.conduits.map(x=>x.size+'#'+x.quantity));
   for(const entry of extracted)if(!seen.has(entry.size+'#'+entry.quantity)){current.conduits.push(entry);seen.add(entry.size+'#'+entry.quantity)}
  }
 }
 finish();
 if(!found.length&&defaultAddress)found.push({name:orderId?'Work Order '+orderId:'Shot 01',feet:'',address:defaultAddress,conduits:[],selected:false});
 return found.slice(0,70).map(x=>({...x,conduitText:specFromConduits(x.conduits)}));
}
function editorRow(x,i){
 return '<article class="bls-shot" data-bls-row><div class="bls-row"><label><input data-bls-selected type="checkbox" '+(x.selected?'checked':'')+'> Import this shot</label><strong>Draft '+(i+1)+'</strong><button type="button" class="bls-btn" data-bls-remove>Remove</button></div>'+
 '<div class="bls-fields"><label>Shot name<input data-bls-name type="text" maxlength="70" value="'+esc(x.name)+'" required></label>'+
 '<label>Length (ft)<input data-bls-feet type="number" inputmode="decimal" step="0.1" min="0.1" max="100000" value="'+esc(x.feet)+'"></label>'+
 '<label class="bls-wide">Address / location (verify)<input data-bls-address type="text" maxlength="250" placeholder="Optional — edit scanned address" value="'+esc(x.address)+'"></label>'+
 '<label class="bls-wide">Conduits (size and count)<input data-bls-conduits type="text" maxlength="250" placeholder="4 inch x2, 1.25 inch x1" value="'+esc(x.conduitText||'')+'"></label></div></article>';
}
function captureEditorDrafts(){
 const visible=[...root.querySelectorAll('[data-bls-row]')];
 if(!visible.length)return;
 pendingRows=visible.map(row=>({
  name:row.querySelector('[data-bls-name]')?.value||'',
  feet:row.querySelector('[data-bls-feet]')?.value||'',
  address:row.querySelector('[data-bls-address]')?.value||'',
  conduitText:row.querySelector('[data-bls-conduits]')?.value||'',
  selected:!!row.querySelector('[data-bls-selected]')?.checked
 }));
}
function openScanner(){
 if(!api())return;
 pendingRows=[];ocrText='';sourceError='';sourceName='';scanning=false;
 root.hidden=false;
 document.body.style.overflow='hidden';
 render();
 root.scrollTop=0;
}
function closeScanner(){root.hidden=true;root.innerHTML='';document.body.style.overflow=''}
function render(){
 const job=api()?.state()?.jobName||'Active job';
 root.innerHTML='<div class="bls-wrap"><div class="bls-header"><button type="button" class="bls-btn" data-bls-action="back">‹ Back</button><div><small class="bls-muted">BORELAB FIELD / IMPORT</small><h1>Scan Shot Sheet</h1></div></div>'+
 '<div class="bls-card"><p>Scan printed or handwritten paperwork. BoreLab will suggest multiple shots, then you review and choose which ones to import into <strong>'+esc(job)+'</strong>.</p>'+
 '<div class="bls-row"><button type="button" class="bls-btn bls-primary" data-bls-action="camera">📷 Take photo</button><button type="button" class="bls-btn" data-bls-action="gallery">▣ Choose photo</button>'+
 '<button type="button" class="bls-btn" data-bls-action="manual">+ Add draft manually</button></div>'+
 '<p class="bls-muted">Photo OCR runs on-device in the Android app. Writing and table columns may be imperfect. Nothing is imported automatically.</p></div>'+
 (sourceName||sourceError?'<p class="bls-status">'+esc(sourceName||'')+(sourceError?' · '+esc(sourceError):'')+'</p>':'')+
 (scanning?'<div class="bls-card">Reading shot sheet…</div>':'')+
 (pendingRows.length?'<div class="bls-card"><h2>Review '+pendingRows.length+' proposed shot(s)</h2><p class="bls-muted">Correct every name, length, address and conduit before selecting Import. Any missing length must be entered manually.</p>'+
 '<div id="bls-rows">'+pendingRows.map(editorRow).join('')+'</div>'+
 '<label class="bls-row" style="margin-top:12px"><input type="checkbox" id="bls-confirm"> I reviewed the selected shots against the original sheet.</label></div>'+
 '<div class="bls-finish">'+(sourceError?'<p class="bls-muted">'+esc(sourceError)+'</p>':'')+
 '<button type="button" class="bls-btn bls-primary" data-bls-action="import">Import reviewed shots into '+esc(job)+'</button></div>':'')+
 (ocrText?'<details class="bls-card"><summary>Original recognized text · check OCR accuracy</summary><pre class="bls-raw">'+esc(ocrText)+'</pre></details>':'')+
 '<p class="bls-muted">Footage must be verified. Addresses are not geocoded or treated as safety clearance. Please check 811 marks and drill plans before work.</p></div>';
}
async function resizeFile(file){
 if(!file?.type?.startsWith('image/'))throw Error('Choose a camera photo or image file.');
 if(file.size>25*1024*1024)throw Error('Maximum image size: 25 MB. Take a smaller or closer picture.');
 const url=URL.createObjectURL(file);
 try{
  const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Cannot open picture.'));image.src=url});
  const size=Math.min(1,2300/Math.max(img.naturalWidth,img.naturalHeight));
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*size));c.height=Math.max(1,Math.round(img.naturalHeight*size));
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',0.91);
 }finally{URL.revokeObjectURL(url)}
}
async function scanFile(file){
 if(!file||scanning)return;
 try{
  scanning=true;sourceError='';sourceName=file.name||'Camera capture';render();
  const data=await resizeFile(file);
  if(!window.BoreLabNative?.scanShotSheet){scanning=false;sourceError='Automatic text recognition requires the Android APK. Add entries manually in the preview.';render();return}
  window.BoreLabNative.scanShotSheet(data);
 }catch(e){scanning=false;sourceError=String(e.message||e);render()}
}
for(const input of [fileCamera,fileGallery])input.addEventListener('change',e=>{const file=e.target.files?.[0];e.target.value='';if(file)scanFile(file)});
window.borelabOnShotSheetScan=function(text,error){
 if(root.hidden)return;
 scanning=false;
 ocrText=String(text||'').slice(0,15000);
 sourceError=error?'Text reading issue: '+String(error).slice(0,200):'';
 pendingRows=parseSheet(ocrText);
 if(!pendingRows.length){sourceError+=' No clear shots detected. Try a closer photo or add entries manually.';pendingRows=[{name:'Shot 01',feet:'',address:'',conduitText:'',selected:false}]} 
 render();
};
function importReviewed(){
 const state=api().state();
 const rows=[...root.querySelectorAll('[data-bls-row]')].filter(r=>r.querySelector('[data-bls-selected]')?.checked);
 if(!root.querySelector('#bls-confirm')?.checked){sourceError='Check the confirmation after reviewing the original paperwork.';renderStatusOnly();return}
 if(!rows.length){sourceError='Select at least one reviewed shot.';renderStatusOnly();return}
 if(rows.length>70){sourceError='Maximum 70 shots per import.';renderStatusOnly();return}
 const existing=new Set((state.shots||[]).map(s=>[String(s.name).trim().toLowerCase(),Number(s.feet),String(s.address||'').trim().toLowerCase()].join('|')));
 const drafts=[],duplicates=[];
 try{
  for(const row of rows){
   const name=clamp(row.querySelector('[data-bls-name]')?.value,70),rawFeet=String(row.querySelector('[data-bls-feet]')?.value||'').trim();
   const feetNum=Number(rawFeet),address=clamp(row.querySelector('[data-bls-address]')?.value);
   const conduitText=String(row.querySelector('[data-bls-conduits]')?.value||'').trim();
   if(!name)throw Error('Every selected shot needs a name.');
   if(!rawFeet||!Number.isFinite(feetNum)||feetNum<=0||feetNum>100000)throw Error(name+': enter a confirmed bore length greater than 0.');
   if(address&&window.BoreLabLocations?.locationKind(address)==='plus'&&!window.BoreLabLocations.isUsablePlusCode(address))throw Error(name+': include a city or region after the short Plus Code.');
   const gps=window.BoreLabLocations?.parseCoords(address);
   const conduitList=parseConduitSpec(conduitText);
   const key=[name.toLowerCase(),feetNum,address.toLowerCase()].join('|');
   if(existing.has(key)){duplicates.push(name);continue}
   existing.add(key);
   drafts.push({id:api().uid(),jobId:state.activeJobId,name,feet:feetNum,address,lat:gps?.lat||'',lon:gps?.lon||'',conduits:conduitList,
    pipeDiameter:conduitList[0]?.size||'',notes:'Imported from reviewed shot-sheet scan; verify locates and dimensions.',
    status:'planned',pipeUsed:'',rodCount:'',entryDepth:'',exitDepth:'',equipmentIds:[],startedAt:null,completedAt:null,updatedAt:new Date().toISOString()});
  }
 }catch(e){sourceError=e.message;renderStatusOnly();return}
 if(!drafts.length){sourceError=duplicates.length?'All selected shots already exist. Nothing imported.':'No valid selected shots.';renderStatusOnly();return}
 state.shots.push(...drafts);
 state.demo=false;
 api().save();closeScanner();api().render();
 api().notify('Imported '+drafts.length+' reviewed shot(s).'+(duplicates.length?' Skipped '+duplicates.length+' duplicate(s).':''));
}
function renderStatusOnly(){
 let node=root.querySelector('#bls-import-error');
 if(!node){node=document.createElement('p');node.id='bls-import-error';node.className='bls-status';root.querySelector('.bls-finish')?.prepend(node)}
 if(node)node.textContent=sourceError;
}
root.addEventListener('click',e=>{
 const btn=e.target.closest('[data-bls-action]');
 if(btn){
  if(btn.dataset.blsAction==='back')return closeScanner();
  if(btn.dataset.blsAction==='camera')return fileCamera.click();
  if(btn.dataset.blsAction==='gallery')return fileGallery.click();
  if(btn.dataset.blsAction==='manual'){captureEditorDrafts();pendingRows.push({name:'Shot '+String(pendingRows.length+1).padStart(2,'0'),feet:'',address:'',conduitText:'',selected:false});render();return}
  if(btn.dataset.blsAction==='import')return importReviewed();
 }
 const remove=e.target.closest('[data-bls-remove]');
 if(remove){remove.closest('[data-bls-row]')?.remove();captureEditorDrafts()}
});
document.addEventListener('click',e=>{if(e.target.closest('[data-sheet-action="open"]'))openScanner()});
root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closeScanner()}});
window.BoreLabShotSheet={parseSheet,parseConduitSpec,parseSizeSpecs,lineAddress,lengthOnLine};
})();
