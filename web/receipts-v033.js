/* BoreLab Field Receipts — offline IndexedDB files + job metadata, backed up explicitly.
   Photos and PDFs are stored separately from bore evidence photos and native videos. */
(function(){
'use strict';
const b=()=>window.BoreLabAssistantBridge,a=()=>window.BoreLabLocalAccounts;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const active=()=>b()?.state?.()?.activeJobId||'';
const editable=()=>!!b()&&(!a()||a().pinTestMode?.()||['owner','foreman','supervisor'].includes(a().role?.()));
const maxImage=25*1024*1024,maxPdf=8*1024*1024,maxTotal=60*1024*1024;
let cache=[],pending=null,refreshing=null;
const notify=t=>b()?.notify?.(t);
function db(){return new Promise((resolve,reject)=>{
 if(typeof indexedDB==='undefined')return reject(new Error('Receipt storage is not available.'));
 const r=indexedDB.open('borelab-receipts-v1',1);
 r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('receipts'))r.result.createObjectStore('receipts',{keyPath:'id'})};
 r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Cannot open receipt storage'));
})}
async function operation(kind,arg){
 const database=await db();return new Promise((resolve,reject)=>{
 const tx=database.transaction('receipts',kind==='list'?'readonly':'readwrite'),store=tx.objectStore('receipts');
 let request;
 if(kind==='list')request=store.getAll();
 if(kind==='put')request=store.put(arg);
 if(kind==='delete')request=store.delete(arg);
 if(kind==='clear')request=store.clear();
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(request.error||new Error('Receipt database error'));
 tx.oncomplete=()=>database.close();
 tx.onerror=()=>reject(tx.error||new Error('Receipt write failed'));
 }) }
async function refresh(){
 if(refreshing)return refreshing;
 refreshing=operation('list').then(rows=>{cache=rows.sort((x,y)=>String(y.addedAt).localeCompare(String(x.addedAt)));return cache})
 .finally(()=>{refreshing=null});
 return refreshing;
}
const records=()=>cache.filter(x=>x.jobId===active());
const get=id=>cache.find(x=>x.id===id);
function valid(r){
 return r&&typeof r.id==='string'&&r.id.length<100&&typeof r.jobId==='string'&&r.jobId.length<120&&
 typeof r.dataUrl==='string'&&r.dataUrl.length<=12*1024*1024&&
 /^data:(?:application\/pdf|image\/jpeg|image\/png|image\/webp);base64,[a-zA-Z0-9+/=\s]+$/.test(r.dataUrl)&&
 ['application/pdf','image/jpeg','image/png','image/webp'].includes(r.mime)&&
 typeof r.addedAt==='string'&&r.addedAt.length<70&&
 String(r.vendor||'').length<=100&&String(r.notes||'').length<=1200;
}
async function exportRecords(){await refresh();return cache.slice()}
async function replaceAll(rows){
 if(!Array.isArray(rows)||rows.length>400||rows.some(r=>!valid(r)))throw new Error('Receipt backup contains invalid file data.');
 await operation('clear');
 for(const r of rows)await operation('put',r);
 await refresh();
}
async function clear(){await operation('clear');cache=[]}
const dataSize=x=>Math.ceil((String(x||'').length*3)/4);
const bytesTotal=()=>cache.reduce((n,r)=>n+dataSize(r.dataUrl),0);
function compress(file){
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{URL.revokeObjectURL(url);
   const scale=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');
   c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
   c.getContext('2d').drawImage(img,0,0,c.width,c.height);
   resolve({mime:'image/jpeg',dataUrl:c.toDataURL('image/jpeg',.79)});
  };
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Image cannot be decoded. Try JPG or PNG.'))};
  img.src=url;
 }) }
function readPdf(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const raw=String(reader.result||'');const base64=raw.split(',')[1]||'';if(!base64)return reject(new Error('Empty PDF file'));resolve({mime:'application/pdf',dataUrl:'data:application/pdf;base64,'+base64})};reader.onerror=()=>reject(new Error('Could not read PDF'));reader.readAsDataURL(file)})}
async function pickFile(file){
 if(!editable())return notify('This action requires an authorized field account.');
 if(!file)return;
 const mime=String(file.type||'').toLowerCase(),isPdf=mime==='application/pdf'||/\.pdf$/i.test(file.name||''),isImage=mime.startsWith('image/');
 if(!isPdf&&!isImage)return notify('Choose a JPG, PNG, WebP or PDF receipt.');
 if(file.size>(isPdf?maxPdf:maxImage))return notify(isPdf?'PDF too large (8 MB max).':'Photo too large (25 MB max).');
 if(cache.length>=400)return notify('Receipt library limit reached. Export a backup and archive elsewhere.');
 try{
  const result=isPdf?await readPdf(file):await compress(file);
  if(result.dataUrl.length>12*1024*1024)return notify('Receipt exceeds offline storage limit. Choose a smaller file.');
  if(bytesTotal()+dataSize(result.dataUrl)>maxTotal)return notify('Receipt library near 60 MB. Export a backup and remove old files first.');
  if(!/^data:(?:application\/pdf|image\/jpeg);base64,[a-zA-Z0-9+/=]+$/.test(result.dataUrl))throw new Error('File encoding failed');
  pending={...result,name:String(file.name||'Receipt').slice(0,100),jobId:active(),bytes:file.size};
  showEditor();
 }catch(err){pending=null;notify('Receipt could not be prepared: '+String(err.message||err))}
}
const dateNow=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
function showEditor(id=''){
 if(!editable())return;
 const r=id?get(id):pending;if(!r)return;
 const j=b()?.state?.()?.jobs?.find(j=>j.id===r.jobId),jobName=j?.jobName||'Active job';
 const dateValue=/^\d{4}-\d{2}-\d{2}$/.test(r.receiptDate||'')?r.receiptDate:dateNow();
 b()?.showModal?.('<div class="modal-head"><h2>'+(id?'Edit':'Save')+' Receipt</h2><button type="button" class="icon-btn" data-action="close-modal">✕</button></div>'+
 '<p class="smalltext muted">Stored offline with '+esc(jobName)+'. JPG and PDF files are included in BoreLab JSON backups.</p>'+
 '<form data-b33-receipt-form data-id="'+esc(id)+'">'+
 '<label class="field">Vendor / Store<input name="vendor" maxlength="100" placeholder="Parts house, fuel station, supply yard" value="'+esc(r.vendor||'')+'"></label>'+
 '<div class="b33-receipt-fields"><label class="field">Receipt date<input name="receiptDate" type="date" required value="'+esc(dateValue)+'"></label>'+
 '<label class="field">Total ($, optional)<input name="amount" type="number" min="0" max="1000000" step="0.01" inputmode="decimal" value="'+esc(r.amount??'')+'" placeholder="0.00"></label></div>'+
 '<label class="field">Description / Notes<textarea name="notes" maxlength="1200" rows="3" placeholder="Fuel, mud supplies, tooling, repair…">'+esc(r.notes||'')+'</textarea></label>'+
 '<p class="smalltext muted">File: '+esc(r.name||'Receipt')+' · '+(r.mime==='application/pdf'?'PDF':'Photo')+'</p>'+
 '<div class="modal-footer"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button>'+
 '<button type="submit" class="btn primary">Save Receipt</button></div></form>');
}
async function saveForm(form){
 if(!editable())return {ok:false,error:'Account cannot edit receipts.'};
 const editId=form.dataset.id||'',old=editId?get(editId):null,base=old||pending;
 if(!base)return {ok:false,error:'Select a receipt file first.'};
 if(!editId&&base.jobId!==active())return {ok:false,error:'Active job changed. Choose the file again.'};
 const d=new FormData(form);
 const amountText=String(d.get('amount')||'').trim(),amount=amountText===''?null:Number(amountText);
 const receiptDate=String(d.get('receiptDate')||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)||!Number.isFinite(+new Date(receiptDate+'T12:00:00')))return {ok:false,error:'Choose a valid receipt date.'};
 if(amount!==null&&(!Number.isFinite(amount)||amount<0||amount>1000000))return {ok:false,error:'Amount must be between $0 and $1,000,000.'};
 const now=new Date().toISOString();
 const record={...base,id:base.id||b()?.uid?.()||String(Date.now()),vendor:String(d.get('vendor')||'').trim().slice(0,100),
  notes:String(d.get('notes')||'').trim().slice(0,1200),amount,receiptDate,addedAt:base.addedAt||now,updatedAt:now};
 if(!valid(record))return {ok:false,error:'Invalid receipt file data.'};
 try{await operation('put',record);await refresh();pending=null;b()?.closeModal?.();b()?.render?.();
  notify('Receipt saved offline to '+(b()?.state?.()?.jobName||'job')+'.');return {ok:true,id:record.id}}
 catch(err){return {ok:false,error:'Receipt storage failed: '+String(err.message||err)}}
}
function exportFile(id){
 const r=get(id);if(!r)return;
 try{
  const base64=r.dataUrl.split(',')[1],binary=atob(base64),arr=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)arr[i]=binary.charCodeAt(i);
  const ext=r.mime==='application/pdf'?'pdf':'jpg',label=String(r.vendor||'receipt').replace(/[^a-z0-9-_]+/gi,'_').slice(0,45)||'receipt';
  b()?.downloadBlob?.('BoreLab_Receipt_'+label+'_'+r.receiptDate+'.'+ext,arr,r.mime);
 }catch(err){notify('Receipt could not be exported: '+String(err.message||err))}
}
function view(id){
 const r=get(id);if(!r)return;
 b()?.showModal?.('<div class="modal-head"><h2>Receipt</h2><button type="button" class="icon-btn" data-action="close-modal">✕</button></div>'+
 (r.mime.startsWith('image/')?'<img src="'+esc(r.dataUrl)+'" style="display:block;max-width:100%;max-height:45vh;object-fit:contain;margin:auto" alt="Uploaded receipt">':
 '<div class="b33-pdf-preview">▤ PDF Receipt <small>Use Export Original to view in your phone’s PDF app.</small></div>')+
 '<div class="b33-receipt-details"><strong>'+esc(r.vendor||r.name||'Receipt')+'</strong>'+
 '<span>'+esc(r.receiptDate||'Unknown date')+(r.amount!=null?' · $'+Number(r.amount).toFixed(2):'')+'</span>'+
 (r.notes?'<p>'+esc(r.notes)+'</p>':'')+'</div>'+
 '<div class="action-row"><button type="button" class="btn primary" data-b33-receipt-export="'+esc(r.id)+'">⇧ Export Original</button>'+
 (editable()?'<button type="button" class="btn ghost" data-b33-receipt-edit="'+esc(r.id)+'">Edit Details</button>'+
 '<button type="button" class="btn ghost danger" data-b33-receipt-delete="'+esc(r.id)+'">Delete</button>':'')+'</div>');
}
async function remove(id){
 if(!editable())return;
 const r=get(id);if(!r||!window.confirm?.('Delete this receipt permanently from this device?'))return;
 try{await operation('delete',id);await refresh();b()?.closeModal?.();b()?.render?.();notify('Receipt deleted.')}catch(err){notify('Could not delete: '+String(err.message||err))}
}
function choose(kind){
 if(!editable())return notify('This account cannot upload receipts.');
 const input=document.querySelector(kind==='camera'?'#receiptCameraFile':'#receiptUploadFile');
 input?.click?.();
}
document.addEventListener('click',e=>{
 const target=e.target.closest?.('[data-b33-receipt-camera],[data-b33-receipt-upload],[data-b33-receipt-edit],[data-b33-receipt-export],[data-b33-receipt-delete]');
 if(!target)return;
 if(target.hasAttribute('data-b33-receipt-camera'))return choose('camera');
 if(target.hasAttribute('data-b33-receipt-upload'))return choose('upload');
 if(target.dataset.b33ReceiptEdit)return showEditor(target.dataset.b33ReceiptEdit);
 if(target.dataset.b33ReceiptExport)return exportFile(target.dataset.b33ReceiptExport);
 if(target.dataset.b33ReceiptDelete)return remove(target.dataset.b33ReceiptDelete);
});
document.addEventListener('change',e=>{
 const t=e.target;if(t?.id!=='receiptCameraFile'&&t?.id!=='receiptUploadFile')return;
 const file=t.files?.[0];t.value='';if(file)pickFile(file);
});
document.addEventListener('submit',e=>{
 const f=e.target.closest?.('[data-b33-receipt-form]');if(!f)return;e.preventDefault();
 saveForm(f).then(r=>{if(!r.ok)notify(r.error)});
});
window.BoreLabReceiptsV33={refresh,records,allRecords:()=>cache.slice(),get,choose,view,saveForm,pickFile,exportRecords,replaceAll,clear,valid};
refresh().then(()=>{if(b()?.currentPage?.()==='photos')b()?.render?.()}).catch(err=>{notify('Receipt storage unavailable: '+String(err.message||err))});
})();