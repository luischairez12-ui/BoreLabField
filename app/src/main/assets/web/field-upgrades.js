/* BoreLab Field v0.14.0 — address-photo review and multi-job length planner. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const feet=s=>Math.max(0,Number(s?.feet)||0);
const fmt=n=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:1});
const oneButton=(text,action,attrs)=>'<button type="button" class="btn micro ghost" data-field-upgrade="'+action+'" '+(attrs||'')+'>'+escapeHtml(text)+'</button>';
const styles=document.createElement('style');
styles.textContent='.ba-multi-route{margin-top:20px}.ba-multi-route .ba-longest-row{display:flex;align-items:center;gap:11px;border-bottom:1px solid var(--line);padding:12px 0}.ba-longest-row:last-child{border:0}.ba-longest-row .ba-number{background:var(--accent);color:#151515;border-radius:50%;display:grid;place-items:center;width:31px;height:31px;font-weight:850;flex-shrink:0}.ba-longest-row .ba-info{min-width:0;flex:1}.ba-longest-row .ba-info strong{display:block}.ba-longest-row small{font-size:11px;color:var(--muted);display:block;overflow-wrap:anywhere}.ba-longest-row .ba-buttons{display:flex;flex-direction:column;gap:5px}.ba-scan-tools{display:flex;gap:8px;flex-wrap:wrap;margin:7px 0 12px}.ba-address-review{background:var(--surface2);border:1px solid var(--line);padding:12px;border-radius:12px;margin:10px 0}.ba-address-review pre{max-height:180px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:11px}.ba-address-review label{display:block;margin:9px 0}.ba-address-review input{width:100%;min-width:0}.ba-scan-status{font-size:12px;color:var(--muted);margin-top:5px}.ba-multi-route select{max-width:100%}';
document.head.appendChild(styles);
function longestPlan(){
 const state=api().state(),jobs=(state.jobs||[]).filter(j=>!j.archived);
 const start=jobs.find(j=>j.id===state.longestStartJobId)||jobs.find(j=>j.id===state.activeJobId)||jobs[0]||null;
 const pending=j=>(j.shots||[]).filter(s=>s.status!=='complete');
 const maxLen=j=>Math.max(0,...pending(j).map(feet));
 const remainder=jobs.filter(j=>j.id!==start?.id&&pending(j).length>0).sort((a,b)=>maxLen(b)-maxLen(a)||a.jobName.localeCompare(b.jobName));
 const ordered=[...(start?[start]:[]),...remainder].flatMap(job=>pending(job).sort((a,b)=>feet(b)-feet(a)||String(a.name).localeCompare(String(b.name))).map(shot=>({job,shot})));
 return{jobs,start,ordered};
}
function renderLongestPlan(container){
 if(!container||!api())return;
 const data=longestPlan(),state=api().state();
 container.innerHTML='<div class="section-title"><h2><span class="accentbar"></span>Start at a Job · Longest to Shortest</h2></div>'+
 '<div class="card"><p class="smalltext muted">Choose your first job. Work through its unfinished shots longest first, then the other jobs with their longest shots first. This is a suggested order, not a status change.</p>'+
 '<label class="field spaced">Start at job<select id="ba-longest-start">'+data.jobs.map(j=>'<option value="'+escapeHtml(j.id)+'" '+(data.start?.id===j.id?'selected':'')+'>'+escapeHtml(j.jobName)+'</option>').join('')+'</select></label>'+
 (data.ordered.length?data.ordered.map((x,i)=>{
  const location=x.shot.address||((api().coordsValid(x.shot))?Number(x.shot.lat).toFixed(5)+', '+Number(x.shot.lon).toFixed(5):(x.job.jobAddress||'No location saved'));
  return'<div class="ba-longest-row"><span class="ba-number">'+(i+1)+'</span><div class="ba-info"><strong>'+escapeHtml(x.shot.name)+' · '+fmt(feet(x.shot))+' ft</strong><small>'+escapeHtml(x.job.jobName)+' · '+escapeHtml(x.shot.pipeDiameter||'Conduit size not recorded')+'</small><small>'+escapeHtml(location)+'</small></div>'+
   '<div class="ba-buttons">'+oneButton('Details','view-shot','data-job="'+escapeHtml(x.job.id)+'" data-shot="'+escapeHtml(x.shot.id)+'"')+
   (location!=='No location saved'?oneButton('Navigate','navigate','data-job="'+escapeHtml(x.job.id)+'" data-shot="'+escapeHtml(x.shot.id)+'"'):'')+'</div></div>';
 }).join(''):'<div class="note spaced">There are no unfinished shots on your saved jobs.</div>')+
 '<p class="tiny muted spaced">The starting job is fixed first. Other jobs are ordered by their longest unfinished bore. Distance and access are not optimized; confirm locates and pipe before drilling.</p></div>';
}
function installPlanner(){
 const page=document.querySelector('#main .page');
 if(!page||!page.querySelector('.route-picker-toggle'))return;
 if(page.querySelector('.ba-multi-route'))return;
 const block=document.createElement('section');block.className='ba-multi-route';
 const inventory=Array.from(page.querySelectorAll('.section-title')).find(x=>x.textContent.includes('Pipe Inventory'));
 if(inventory)page.insertBefore(block,inventory);else page.appendChild(block);
 renderLongestPlan(block);
}
function installScanButtons(){
 const wrapper=document.querySelector('#modalRoot');
 if(!wrapper)return;
 const form=wrapper.querySelector('form[data-form="shot"],form[data-form="new-job"],form[data-form="job-details"],form[data-form="guided-bore"]');
 if(!form||form.querySelector('.ba-scan-tools'))return;
 const address=form.querySelector('input[name="address"]');
 if(!address)return;
 const buttons=document.createElement('div');buttons.className='ba-scan-tools';
 buttons.innerHTML=oneButton('📷 Scan folder / paper','scan-camera')+oneButton('▣ Choose address photo','scan-gallery');
 const label=address.closest('label');
 if(label)label.insertAdjacentElement('afterend',buttons);else form.insertBefore(buttons,form.firstChild);
}
const camera=document.createElement('input');camera.type='file';camera.accept='image/*';camera.setAttribute('capture','environment');camera.hidden=true;camera.id='borelabAddressCamera';
const gallery=document.createElement('input');gallery.type='file';gallery.accept='image/*';gallery.hidden=true;gallery.id='borelabAddressGallery';
document.body.append(camera,gallery);
let scanContext=null,scanBusy=false;
function candidateAddress(raw){
 const lines=String(raw||'').split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
 const street=/\b(?:[0-9]{1,6}\s+)?[A-Za-z0-9#.\- ]{3,90}\s+(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Highway|Hwy|Circle|Cir|Trail|Trl)\b\.?/i;
 const road=/\b(?:County Road|State Road|CR|SR|US Highway|US Hwy)\s*[-#]?\s*\d+[A-Za-z]?\b/i;
 let i=lines.findIndex(line=>street.test(line)||road.test(line));
 if(i<0)i=lines.findIndex(line=>/^address\s*[:#-]/i.test(line)&&line.length>12);
 if(i<0)return'';
 let address=lines[i].replace(/^\s*(?:job\s+)?address\s*[:#-]\s*/i,'').trim();
 const next=lines[i+1]||'';
 if(/^[A-Za-z][A-Za-z .'-]{2,55},?\s+[A-Z]{2}\s*\d{5}(?:-\d{4})?$/i.test(next))address+=', '+next;
 return address.slice(0,250);
}
function scanNotice(message){
 const form=scanContext?.form;
 if(!form||!form.isConnected)return;
 let notice=form.querySelector('.ba-scan-status');
 if(!notice){notice=document.createElement('p');notice.className='ba-scan-status';form.querySelector('.ba-scan-tools')?.appendChild(notice)}
 if(notice)notice.textContent=message;
}
async function resizeScan(file){
 if(!file.type.startsWith('image/'))throw Error('Choose a photo, not a document.');
 if(file.size>25*1024*1024)throw Error('Photo larger than 25 MB. Take a closer picture.');
 const url=URL.createObjectURL(file);
 try{
  const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Cannot read image.'));img.src=url});
  const scale=Math.min(1,1800/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.82);
 }finally{URL.revokeObjectURL(url)}
}
async function scanFile(file){
 if(!scanContext||scanBusy||!file)return;
 scanBusy=true;scanNotice('Reading photo on this device…');
 try{
  const data=await resizeScan(file);
  if(!api()||!window.BoreLabNative?.scanAddressPhoto){
   scanNotice('Address text recognition requires the Android app. You can still type the address.');
   scanBusy=false;return;
  }
  window.BoreLabNative.scanAddressPhoto(data);
 }catch(error){scanNotice(String(error.message||error));scanBusy=false}
}
for(const input of [camera,gallery])input.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)scanFile(f);e.target.value=''});
window.borelabOnAddressScan=function onAddressScan(raw,error){
 scanBusy=false;
 const form=scanContext?.form,address=scanContext?.input;
 if(!form||!form.isConnected||!address||!address.isConnected)return;
 const text=String(raw||'').slice(0,10000),guess=candidateAddress(text);
 const old=form.querySelector('.ba-address-review');if(old)old.remove();
 const card=document.createElement('div');card.className='ba-address-review';
 card.innerHTML='<strong>Review scanned address</strong><p class="smalltext muted">Check spelling and house number before applying. Nothing is saved automatically.</p>'+
 '<label class="field">Proposed address<input id="ba-proposed-address" maxlength="250" value="'+escapeHtml(guess)+'" placeholder="Type or correct the address"></label>'+
 (text?'<details><summary>Recognized text (tap to inspect)</summary><pre>'+escapeHtml(text)+'</pre></details>':'<p class="smalltext muted">No text recognized. Enter the address manually.</p>')+
 (error?'<p class="smalltext muted">OCR issue: '+escapeHtml(error)+'</p>':'')+
 oneButton('Use this address','apply-address');
 form.querySelector('.ba-scan-tools')?.insertAdjacentElement('afterend',card);
 scanNotice(guess?'Possible address found — verify before using.':'Could not confidently identify a street; review the text or type manually.');
};
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-field-upgrade]');if(!button)return;
 const what=button.dataset.fieldUpgrade;
 if(what==='scan-camera'||what==='scan-gallery'){
  const form=button.closest('form'),input=form?.querySelector('input[name="address"]');
  if(!form||!input)return;scanContext={form,input};scanBusy=false;
  (what==='scan-camera'?camera:gallery).click();return;
 }
 if(what==='apply-address'){
  const proposed=button.closest('.ba-address-review')?.querySelector('#ba-proposed-address')?.value.trim()||'';
  if(!scanContext?.input?.isConnected||!proposed)return;
  if(proposed!==scanContext.input.value){
   scanContext.input.value=proposed.slice(0,250);
   for(const id of ['shotLat','shotLon']){const field=scanContext.form.querySelector('#'+id);if(field)field.value='';}
   scanContext.input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  button.closest('.ba-address-review')?.remove();scanNotice('Address applied to the form. Tap Save to store it.');return;
 }
 if(what==='view-shot'||what==='navigate'){
  const state=api().state(),job=(state.jobs||[]).find(x=>x.id===button.dataset.job),shot=(job?.shots||[]).find(x=>x.id===button.dataset.shot);
  if(!job||!shot)return;
  if(what==='view-shot'){if(api().switchActiveJob(job.id))api().shotDetail(shot.id);return}
  const target=(api().coordsValid(shot)||shot.address)?shot:{address:job.jobAddress||''};
  api().openMapUrl(api().mapsPinUrl(target));return;
 }
});
document.addEventListener('change',event=>{
 if(event.target.id!=='ba-longest-start'||!api())return;
 const state=api().state(),id=event.target.value;
 if(!(state.jobs||[]).some(x=>x.id===id&&!x.archived))return;
 state.longestStartJobId=id;api().save();
 renderLongestPlan(event.target.closest('.ba-multi-route'));
});
const main=document.querySelector('#main'),modal=document.querySelector('#modalRoot');
if(main)new MutationObserver(installPlanner).observe(main,{childList:true});
if(modal)new MutationObserver(installScanButtons).observe(modal,{childList:true,subtree:true});
installPlanner();installScanButtons();
window.BoreLabFieldUpgrades={candidateAddress,longestPlan};
})();
