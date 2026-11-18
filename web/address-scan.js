/* Address-only OCR for Add/Edit Bore Shot. Does not import shot records. */
(function(){
'use strict';
let active=false,target=null,overlay=null,photoInput=null,choiceInput=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function extractAddress(text){
 const raw=String(text||'').replace(/\r/g,''),lines=raw.split('\n').map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
 const loc=window.BoreLabLocations;
 const candidates=loc?.locationCandidates(raw)||[];
 // Prefer the explicit "Address" field over an incidental address in notes or header.
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(!/^(?:address|jobsite address|service address)\s*(?:[:#/-]|\s|$)/i.test(line))continue;
  const inline=line.replace(/^(?:jobsite |service )?address\s*[:#/-]?\s*/i,'').trim();
  const segment=[inline,...lines.slice(i+1,i+4)].filter(Boolean).join('\n');
  const picked=loc?.locationCandidates(segment)?.find(x=>x.kind==='street'||x.kind==='plus'||x.kind==='coords');
  if(picked)return picked.value;
  // Glades Electric often prints "265 S LINDERO" without a street suffix.
  const m=segment.match(/\b(\d{1,6}\s+[NSEW]\.?\s+[A-Za-z][A-Za-z'-]{2,}(?:\s+[A-Za-z][A-Za-z'-]{2,}){0,3})\b/i);
  if(m)return m[1].trim();
 }
 return candidates.find(x=>x.kind==='street')?.value||candidates.find(x=>x.kind==='plus'&&!x.needsLocality)?.value||candidates.find(x=>x.kind==='coords')?.value||'';
}
function open(targetInput){
 if(active)return;
 if(!targetInput)return;
 target=targetInput;active=true;
 overlay=document.createElement('div');overlay.id='bl-address-only';
 overlay.innerHTML='<div class="bl-addr-card" role="dialog" aria-modal="true" aria-labelledby="bl-addr-title">'+
 '<div class="bl-addr-head"><div><small>BORELAB FIELD / ADD BORE</small><h2 id="bl-addr-title">Scan Jobsite Address</h2></div><button type="button" data-addr-close aria-label="Close scanner">✕</button></div>'+
 '<p>Photograph the address on your paperwork or choose an existing photo. BoreLab will look for the address only—not bore footage, pipe quantities, or shot numbers.</p>'+
 '<div class="bl-addr-actions"><button type="button" data-addr-camera>📷 Take photo</button><button type="button" data-addr-gallery>▣ Choose photo</button></div>'+
 '<div class="bl-addr-status" aria-live="polite">No photo selected yet.</div>'+
 '<label class="bl-addr-field">Detected address — verify or correct<input id="bl-addr-result" type="text" autocomplete="off" placeholder="e.g. 265 S Lindero"></label>'+
 '<div class="bl-addr-actions"><button type="button" data-addr-close>Cancel</button><button type="button" data-addr-apply class="bl-addr-primary">Use Address</button></div>'+
 '<p class="bl-addr-note">If recognition misses it, you can type the address here. No shot is created or changed until you save the bore form.</p></div>';
 document.body.appendChild(overlay);
 photoInput=document.createElement('input');photoInput.type='file';photoInput.accept='image/*';photoInput.capture='environment';photoInput.hidden=true;
 choiceInput=document.createElement('input');choiceInput.type='file';choiceInput.accept='image/*';choiceInput.hidden=true;
 overlay.append(photoInput,choiceInput);
 photoInput.addEventListener('change',()=>readPhoto(photoInput.files?.[0]));
 choiceInput.addEventListener('change',()=>readPhoto(choiceInput.files?.[0]));
 overlay.addEventListener('click',e=>{
  if(e.target.closest('[data-addr-close]'))close();
  if(e.target.closest('[data-addr-camera]')){photoInput.value='';photoInput.click()}
  if(e.target.closest('[data-addr-gallery]')){choiceInput.value='';choiceInput.click()}
  if(e.target.closest('[data-addr-apply]'))apply();
 });
 overlay.querySelector('#bl-addr-result').value=target.value||'';
}
function close(){active=false;overlay?.remove();overlay=null;photoInput=null;choiceInput=null;target=null}
function status(msg){const el=overlay?.querySelector('.bl-addr-status');if(el)el.textContent=msg}
async function readPhoto(file){
 if(!file||!active)return;
 if(!file.type.startsWith('image/')){status('Choose a photo file.');return}
 if(!window.BoreLabNative?.scanShotSheet){status('Text recognition is available in the Android APK. You can still enter the address manually.');return}
 try{
  status('Reading address from photo…');
  const img=await createImageBitmap(file);
  const scale=Math.min(1,2200/Math.max(img.width,img.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);img.close?.();
  // For full-page paperwork the printed address is usually in the upper portion.
  // First scan the entire image; the user can retake a close-up if OCR misses the address.
  window.BoreLabNative.scanShotSheet(canvas.toDataURL('image/jpeg',.92));
 }catch(err){status('Unable to read this photo: '+String(err.message||err))}
}
function apply(){
 const value=overlay?.querySelector('#bl-addr-result')?.value?.trim();
 if(!value){status('Enter or scan an address before using it.');return}
 if(!target?.isConnected){status('Bore form is no longer open. Reopen the form and try again.');return}
 target.value=value;
 target.dispatchEvent(new Event('input',{bubbles:true}));
 target.dispatchEvent(new Event('change',{bubbles:true}));
 close();
}
const previous=window.borelabOnShotSheetScan;
window.borelabOnShotSheetScan=function(text,error,alternate){
 if(!active)return previous?.(text,error,alternate);
 if(error&&!text&&!alternate){status('Could not read photo: '+String(error));return}
 const main=extractAddress(text),second=extractAddress(alternate),value=main||second;
 if(value){
  overlay?.querySelector('#bl-addr-result')?.setAttribute('value',value);
  const input=overlay?.querySelector('#bl-addr-result');if(input)input.value=value;
  status('Address found. Check it against the paperwork, then tap Use Address.');
 }else status('No address recognized. Try a closer photo of the address box or enter it manually.');
};
document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-address-scan]');
 if(!btn)return;
 const form=btn.closest('form[data-form="shot"],form[data-form="guided-bore"]');
 open(form?.querySelector('input[name="address"]'));
});
const style=document.createElement('style');
style.textContent='#bl-address-only{position:fixed;inset:0;z-index:99999;background:rgba(7,20,29,.72);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}#bl-address-only .bl-addr-card{width:min(100%,560px);max-height:94vh;overflow:auto;border-radius:20px;padding:20px;background:var(--surface,#fff);color:var(--text,#1b2c35);box-shadow:0 15px 55px #0004}#bl-address-only .bl-addr-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}#bl-address-only h2{font-size:22px;margin:6px 0 12px}#bl-address-only small{font-size:11px;letter-spacing:1.5px}#bl-address-only p{font-size:14px;line-height:1.5}#bl-address-only button{border:1px solid #bdcbd3;border-radius:12px;padding:12px;background:#edf3f7;color:#193243;font-size:14px;font-weight:700}#bl-address-only .bl-addr-actions{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}#bl-address-only .bl-addr-primary{background:#e87700;color:white;border-color:#e87700}#bl-address-only .bl-addr-field{display:block;font-size:13px;font-weight:700;margin-top:12px}#bl-address-only .bl-addr-field input{display:block;width:100%;box-sizing:border-box;padding:13px;border:1px solid #bac9d2;border-radius:12px;margin-top:7px;font-size:16px;background:#fff;color:#193243}#bl-address-only .bl-addr-status{background:#edf3f7;color:#294455;border-radius:12px;padding:12px;font-size:13px}#bl-address-only .bl-addr-note{color:var(--muted,#657682)}';
document.head.appendChild(style);
window.BoreLabAddressScanner={extractAddress};
})();