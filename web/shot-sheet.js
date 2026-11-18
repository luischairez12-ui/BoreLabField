/* BoreLab Field v0.15 — scan handwritten or printed shot sheets into reviewed draft bores. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const conduits=()=>window.BoreLabConduits;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(x,n=250)=>String(x??'').trim().slice(0,n);
let pendingRows=[],ocrText='',sourceError='',sourceName='',scanning=false,scanPreview='',scannerSource='',cropStage=null,ocrFields=null;
const root=document.createElement('div');root.id='bl-shot-sheet';root.hidden=true;document.body.appendChild(root);
const css=document.createElement('style');
css.textContent='#bl-shot-sheet[hidden]{display:none!important}#bl-shot-sheet{position:fixed;inset:0;overflow:auto;overscroll-behavior:contain;z-index:10500;background:var(--bg,#09141f);color:var(--text,#f4f8fb);font-family:system-ui,sans-serif;padding:18px 14px 80px}#bl-shot-sheet *{box-sizing:border-box}#bl-shot-sheet .bls-wrap{max-width:760px;margin:auto}#bl-shot-sheet button{cursor:pointer}#bl-shot-sheet .bls-header{display:flex;gap:12px;align-items:center;margin-bottom:15px}#bl-shot-sheet h1{font-size:24px;margin:0}#bl-shot-sheet h2{font-size:17px}#bl-shot-sheet .bls-card{background:var(--surface2,#162839);border:1px solid var(--line,#294258);padding:14px;border-radius:16px;margin:12px 0}#bl-shot-sheet .bls-muted{font-size:12px;color:var(--muted,#95acbd);line-height:1.5}#bl-shot-sheet .bls-btn{border:1px solid var(--line,#294258);color:var(--text,#f4f8fb);background:var(--surface3,#203448);border-radius:11px;padding:11px 13px;font-weight:750}#bl-shot-sheet .bls-primary{border-color:transparent;background:var(--accent,#ff992c);color:#10202b}#bl-shot-sheet .bls-row{display:flex;gap:9px;flex-wrap:wrap;align-items:center}#bl-shot-sheet .bls-shot{border-bottom:1px solid var(--line,#294258);padding:13px 0}#bl-shot-sheet .bls-shot:last-child{border-bottom:0}#bl-shot-sheet .bls-fields{display:grid;grid-template-columns:minmax(110px,1fr) minmax(75px,.4fr);gap:9px}#bl-shot-sheet .bls-fields .bls-wide{grid-column:1/-1}#bl-shot-sheet label{font-size:12px;font-weight:750;display:block}#bl-shot-sheet input[type=text],#bl-shot-sheet input[type=number],#bl-shot-sheet textarea{display:block;width:100%;margin-top:5px;min-width:0;padding:11px;border:1px solid var(--line,#294258);border-radius:10px;background:var(--surface,#111f2d);color:var(--text)}#bl-shot-sheet input[type=checkbox]{width:17px;height:17px}#bl-shot-sheet .bls-status{margin:12px 0;font-size:13px}#bl-shot-sheet .bls-raw{max-height:160px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:11px}#bl-shot-sheet .bls-finish{position:sticky;bottom:0;background:var(--bg,#09141f);padding:9px 0;border-top:1px solid var(--line,#294258)}';

css.textContent+='#bl-shot-sheet .bls-crop-surface{position:relative;width:100%;max-height:440px;overflow:hidden;touch-action:none;border-radius:12px;border:1px solid var(--line,#294258);user-select:none;cursor:crosshair}#bl-shot-sheet .bls-crop-surface img{display:block;width:100%;height:auto;object-fit:contain;pointer-events:none;user-select:none}#bl-shot-sheet .bls-crop-region{position:absolute;border:3px solid var(--accent,#ff992c);background:rgba(255,160,40,.12);pointer-events:none;box-shadow:0 0 0 1000px rgba(0,0,0,.08)}#bl-shot-sheet .bls-card h2{margin:3px 0 9px}';
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

function parseHeaderFields(raw){
 const text=String(raw||''),lines=text.split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
 const workOrder=text.match(/\b(?:work\s*order|wo)\s*(?:#|no\.?|number)?\s*[:/\-]?\s*(\d{5,9})\b/i)||
  text.match(/\b(\d{5,9})\s*[-–]\s*(?:SOUTH|NORTH|EAST|WEST|CENTRAL)\b/i)||
  (/\bwork\s*order\b/i.test(text)?text.match(/\b\d{5,9}\b/):null);
 const district=text.match(/\b(?:district|division)\s*[:/#\-]?\s*(SOUTH|NORTH|EAST|WEST|CENTRAL)\b/i)||
  text.match(/\b\d{5,9}\s*[-–]\s*(SOUTH|NORTH|EAST|WEST|CENTRAL)\b/i)||
  (/\bwork\s*order\b/i.test(text)?text.match(/(?:^|\n)\s*(SOUTH|NORTH|EAST|WEST|CENTRAL)\s*(?:\n|$)/im):null);
 const numbers={s:(text.match(/\bS\s*#\s*(\d{1,6})\b/i)||[])[1]||'',e:(text.match(/\bE\s*#\s*(\d{1,6})\b/i)||[])[1]||''};
 const loc=(typeof window!=='undefined'?window.BoreLabLocations?.locationCandidates(text):null)||[];
 return{order:workOrder?.[1]||workOrder?.[0]?.match(/\d{5,9}/)?.[0]||'',
  district:district?.[1]||'',sMeter:numbers.s,eMeter:numbers.e,
  addresses:loc.filter(x=>x.kind==='street'||x.kind==='plus'||x.kind==='coords').map(x=>x.value)};
}
function loadImage(src){
 return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Photo cannot be opened.'));img.src=src});
}
async function rotateCropPhoto(){
 if(!cropStage)return;
 const image=await loadImage(cropStage.data);
 const canvas=document.createElement('canvas');canvas.width=image.naturalHeight;canvas.height=image.naturalWidth;
 const ctx=canvas.getContext('2d');ctx.translate(canvas.width,0);ctx.rotate(Math.PI/2);
 ctx.drawImage(image,0,0);
 cropStage.data=canvas.toDataURL('image/jpeg',.92);cropStage.rect=null;
 render();
}
function cropPhotoRegion(image,rect){
 const x=Math.max(0,Math.min(1,Number(rect.x)||0)),y=Math.max(0,Math.min(1,Number(rect.y)||0));
 const w=Math.min(1-x,Math.max(.01,Number(rect.w)||0)),h=Math.min(1-y,Math.max(.01,Number(rect.h)||0));
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(w*image.naturalWidth));canvas.height=Math.max(1,Math.round(h*image.naturalHeight));
 canvas.getContext('2d').drawImage(image,Math.round(x*image.naturalWidth),Math.round(y*image.naturalHeight),
  Math.max(1,Math.round(w*image.naturalWidth)),Math.max(1,Math.round(h*image.naturalHeight)),
  0,0,canvas.width,canvas.height);
 return canvas.toDataURL('image/jpeg',.94);
}
async function submitSelectedPhoto(crop){
 if(!cropStage||scanning)return;
 try{
  if(crop&&!cropStage.rect){sourceError='Touch the address area on the photo or drag a box around it first.';render();return}
  scanning=true;sourceError='';render();
  const image=await loadImage(cropStage.data);
  const data=crop?cropPhotoRegion(image,cropStage.rect):cropStage.data;
  scanPreview=data;
  if(!window.BoreLabNative?.scanShotSheet){
   scanning=false;sourceError='Automatic OCR requires the Android app. You can still add reviewed shots manually.';render();return;
  }
  window.BoreLabNative.scanShotSheet(data);
 }catch(err){scanning=false;sourceError=String(err.message||err);render()}
}
function cropUi(){
 if(!cropStage)return'';
 const region=cropStage.rect;
 const style=region?'left:'+(region.x*100)+'%;top:'+(region.y*100)+'%;width:'+(region.w*100)+'%;height:'+(region.h*100)+'%':'display:none';
 return'<div class="bls-card"><h2>Prepare photo for recognition</h2>'+
 '<p class="bls-muted">Tap the address on the photo to focus on it, or drag around a work-order box. Rotate if needed. Scan the selected area for a clearer reading, or the full sheet for multiple shots.</p>'+
 '<div class="bls-crop-surface" data-bls-crop-surface role="img" aria-label="Touch or drag on the paperwork image to select an OCR region">'+
 '<img draggable="false" src="'+esc(cropStage.data)+'" alt="Photo awaiting OCR, with optional selection crop"><div class="bls-crop-region" data-bls-crop-region style="'+style+'"></div></div>'+
 '<div class="bls-row" style="margin-top:10px"><button type="button" class="bls-btn" data-bls-action="rotate">↻ Rotate 90°</button>'+
 '<button type="button" class="bls-btn" data-bls-action="clear-crop">Clear crop</button>'+
 '<button type="button" class="bls-btn bls-primary" data-bls-action="scan-crop">Read selected area</button>'+
 '<button type="button" class="bls-btn" data-bls-action="scan-full">Read full page</button></div></div>';
}
function metadataUi(){
 if(!ocrFields)return'';
 const meta=ocrFields;
 const line=[meta.order?'Work order: '+meta.order:'',meta.district?'District: '+meta.district:'',meta.sMeter?'S#: '+meta.sMeter:'',meta.eMeter?'E#: '+meta.eMeter:''].filter(Boolean);
 return'<div class="bls-card"><h2>Recognized header details</h2>'+
 (line.length?'<p class="bls-muted">'+esc(line.join(' · '))+'</p>':'<p class="bls-muted">No reliable work-order or meter identifiers detected in this scan.</p>')+
 (meta.addresses.length?'<p class="bls-muted"><strong>Detected locations:</strong> '+esc(meta.addresses.join(' · '))+'</p>'+
 '<button class="bls-btn" type="button" data-bls-action="apply-header-address">Use first detected address for blank drafts</button>':'<p class="bls-muted">No address detected. Select a tighter crop or type the address below.</p>')+
 '<p class="bls-muted">Work-order and meter IDs are shown for checking and are never mistaken for bore lengths or saved without your review.</p></div>';
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
function openScanner(button){
 if(!api())return;
 scannerSource=button?.closest('form[data-form]')?.dataset.form||'';
 pendingRows=[];ocrText='';sourceError='';sourceName='';scanning=false;scanPreview='';cropStage=null;ocrFields=null;
 root.hidden=false;
 document.body.style.overflow='hidden';
 render();
 root.scrollTop=0;
}
function closeScanner(){root.hidden=true;root.innerHTML='';scanPreview='';cropStage=null;ocrFields=null;scannerSource='';document.body.style.overflow=''}
function render(){
 const job=api()?.state()?.jobName||'Active job';
 root.innerHTML='<div class="bls-wrap"><div class="bls-header"><button type="button" class="bls-btn" data-bls-action="back">‹ Back</button><div><small class="bls-muted">BORELAB FIELD / IMPORT</small><h1>Scan Shot Sheet</h1></div></div>'+
 '<div class="bls-card"><p>Scan printed or handwritten paperwork. BoreLab will suggest multiple shots, then you review and choose which ones to import into <strong>'+esc(job)+'</strong>.</p>'+
 '<div class="bls-row"><button type="button" class="bls-btn bls-primary" data-bls-action="camera">📷 Take photo</button><button type="button" class="bls-btn" data-bls-action="gallery">▣ Choose photo</button>'+
 '<button type="button" class="bls-btn" data-bls-action="manual">+ Add draft manually</button></div>'+
 '<p class="bls-muted">Camera tip: capture a close-up of the work-order header or folder tab first. For a long shot sheet, scan one readable page at a time. Original and high-contrast OCR can be reviewed below. Nothing is imported automatically.</p></div>'+
 (sourceName||sourceError?'<p class="bls-status">'+esc(sourceName||'')+(sourceError?' · '+esc(sourceError):'')+'</p>':'')+
 (cropStage?cropUi():'')+
 (scanning?'<div class="bls-card">Reading shot sheet…</div>':'')+
 (ocrFields?metadataUi():'')+
 (pendingRows.length?'<div class="bls-card"><h2>Review '+pendingRows.length+' proposed shot(s)</h2><p class="bls-muted">Correct every name, length, address and conduit before selecting Import. Any missing length must be entered manually.</p>'+
 '<div id="bls-rows">'+pendingRows.map(editorRow).join('')+'</div>'+
 '<label class="bls-row" style="margin-top:12px"><input type="checkbox" id="bls-confirm"> I reviewed the selected shots against the original sheet.</label></div>'+
 '<div class="bls-finish">'+(sourceError?'<p class="bls-muted">'+esc(sourceError)+'</p>':'')+
 '<button type="button" class="bls-btn bls-primary" data-bls-action="import">Import reviewed shots into '+esc(job)+'</button></div>':'')+
 (scanPreview?'<details class="bls-card"><summary>Review the photo you scanned</summary><img alt="Scanned shot-sheet photo" src="'+esc(scanPreview)+'" style="display:block;width:100%;max-height:390px;object-fit:contain;margin-top:9px;border-radius:9px"></details>':'')+
 (ocrText?'<details class="bls-card"><summary>Original and high-contrast OCR text · check accuracy</summary><pre class="bls-raw">'+esc(ocrText)+'</pre></details>':'')+
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
  // Nothing sent for OCR until the user selects full page or a focused region.
  pendingRows=[];ocrFields=null;ocrText='';scanPreview='';
  cropStage={data,rect:null};scanning=false;render();
 }catch(e){scanning=false;sourceError=String(e.message||e);render()}
}
for(const input of [fileCamera,fileGallery])input.addEventListener('change',e=>{const file=e.target.files?.[0];e.target.value='';if(file)scanFile(file)});
function pickBestPaperworkReadings(original,enhanced){
 const first=parseSheet(original||''),second=parseSheet(enhanced||'');
 const points=rows=>rows.reduce((n,r)=>n+(Number(r.feet)>0?5:0)+(r.address?3:0)+(r.conduitText?2:0),0);
 const winner=points(second)>points(first)?second:first;
 const backup=winner===first?second:first;
 if(winner.length===backup.length){
  for(let i=0;i<winner.length;i++){
   if(!winner[i].address&&backup[i].address)winner[i].address=backup[i].address;
   if(!winner[i].feet&&backup[i].feet)winner[i].feet=backup[i].feet;
   if(!winner[i].conduitText&&backup[i].conduitText)winner[i].conduitText=backup[i].conduitText;
  }
 }
 return winner;
}
window.borelabOnShotSheetScan=function(text,error,alternate){
 if(root.hidden)return;
 scanning=false;
 const original=String(text||'').slice(0,15000);
 const enhanced=String(alternate||'').slice(0,15000);
 ocrText=original+(enhanced&&enhanced!==original?'\n\n— High-contrast reading —\n'+enhanced:'');
 sourceError=error?'Text reading issue: '+String(error).slice(0,200):'';
 ocrFields=parseHeaderFields([original,enhanced].filter(Boolean).join('\n'));
 pendingRows=pickBestPaperworkReadings(original,enhanced);
 if(!pendingRows.length){
  sourceError+=(sourceError?' ':'')+'No confirmed shots found. Take a closer photo of the address section or add a reviewed draft manually.';
  pendingRows=[{name:'Shot 01',feet:'',address:'',conduitText:'',selected:false}];
 }
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
 api().save();const originatingForm=scannerSource;closeScanner();
 if(originatingForm==='guided-bore')api().clearGuidedDraft?.();
 if(originatingForm==='guided-bore'||originatingForm==='shot')api().closeModal?.();
 api().render();
 api().notify('Imported '+drafts.length+' reviewed shot(s).'+(duplicates.length?' Skipped '+duplicates.length+' duplicate(s).':''));
}
function renderStatusOnly(){
 let node=root.querySelector('#bls-import-error');
 if(!node){node=document.createElement('p');node.id='bls-import-error';node.className='bls-status';root.querySelector('.bls-finish')?.prepend(node)}
 if(node)node.textContent=sourceError;
}

let cropPointerStart=null;
root.addEventListener('pointerdown',event=>{
 const surface=event.target.closest('[data-bls-crop-surface]');
 if(!surface||!cropStage||scanning)return;
 const bounds=surface.getBoundingClientRect();
 if(!bounds.width||!bounds.height)return;
 const x=Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width));
 const y=Math.max(0,Math.min(1,(event.clientY-bounds.top)/bounds.height));
 cropPointerStart={x,y,id:event.pointerId,surface};
 surface.setPointerCapture?.(event.pointerId);
 event.preventDefault();
});
root.addEventListener('pointermove',event=>{
 const start=cropPointerStart;if(!start||start.id!==event.pointerId||!cropStage)return;
 const bounds=start.surface.getBoundingClientRect();
 const ex=Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width));
 const ey=Math.max(0,Math.min(1,(event.clientY-bounds.top)/bounds.height));
 const rect={x:Math.min(start.x,ex),y:Math.min(start.y,ey),w:Math.abs(ex-start.x),h:Math.abs(ey-start.y)};
 cropStage.rect=rect;
 const region=start.surface.querySelector('[data-bls-crop-region]');
 if(region){region.style.display='block';region.style.left=(rect.x*100)+'%';region.style.top=(rect.y*100)+'%';region.style.width=(rect.w*100)+'%';region.style.height=(rect.h*100)+'%'}
 event.preventDefault();
});
root.addEventListener('pointerup',event=>{
 const start=cropPointerStart;if(!start||start.id!==event.pointerId||!cropStage)return;
 const bounds=start.surface.getBoundingClientRect();
 const ex=Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width)),ey=Math.max(0,Math.min(1,(event.clientY-bounds.top)/bounds.height));
 let rect={x:Math.min(start.x,ex),y:Math.min(start.y,ey),w:Math.abs(ex-start.x),h:Math.abs(ey-start.y)};
 if(rect.w<.035||rect.h<.035){
  // A single tap focuses on the surrounding text rather than claiming one pixel can be OCR'd.
  rect={x:Math.max(0,Math.min(.35,ex-.32)),y:Math.max(0,Math.min(.80,ey-.10)),w:.65,h:.19};
 }
 cropStage.rect=rect;cropPointerStart=null;
 const region=start.surface.querySelector('[data-bls-crop-region]');
 if(region){region.style.display='block';region.style.left=(rect.x*100)+'%';region.style.top=(rect.y*100)+'%';region.style.width=(rect.w*100)+'%';region.style.height=(rect.h*100)+'%'}
 event.preventDefault();
});
root.addEventListener('pointercancel',()=>{cropPointerStart=null});

root.addEventListener('click',e=>{
 const btn=e.target.closest('[data-bls-action]');
 if(btn){
  if(btn.dataset.blsAction==='back')return closeScanner();
  if(btn.dataset.blsAction==='camera')return fileCamera.click();
  if(btn.dataset.blsAction==='rotate'){rotateCropPhoto().catch(err=>{sourceError=err.message;render()});return}
  if(btn.dataset.blsAction==='clear-crop'){if(cropStage)cropStage.rect=null;render();return}
  if(btn.dataset.blsAction==='scan-full'){submitSelectedPhoto(false);return}
  if(btn.dataset.blsAction==='scan-crop'){submitSelectedPhoto(true);return}
  if(btn.dataset.blsAction==='apply-header-address'){
   const address=ocrFields?.addresses?.[0];if(!address)return;
   let count=0;
   root.querySelectorAll('[data-bls-row]').forEach(row=>{const box=row.querySelector('[data-bls-address]');if(box&&!box.value.trim()){box.value=address;count++}});
   captureEditorDrafts();sourceError='Applied header address to '+count+' empty draft(s). Review before importing.';renderStatusOnly();return;
  }
  if(btn.dataset.blsAction==='gallery')return fileGallery.click();
  if(btn.dataset.blsAction==='manual'){captureEditorDrafts();pendingRows.push({name:'Shot '+String(pendingRows.length+1).padStart(2,'0'),feet:'',address:'',conduitText:'',selected:false});render();return}
  if(btn.dataset.blsAction==='import')return importReviewed();
 }
 const remove=e.target.closest('[data-bls-remove]');
 if(remove){remove.closest('[data-bls-row]')?.remove();captureEditorDrafts()}
});
document.addEventListener('click',e=>{const trigger=e.target.closest('[data-sheet-action="open"]');if(trigger)openScanner(trigger)});
root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closeScanner()}});
window.BoreLabShotSheet={parseSheet,parseConduitSpec,parseSizeSpecs,lineAddress,lengthOnLine,parseHeaderFields,cropPhotoRegion};
})();
