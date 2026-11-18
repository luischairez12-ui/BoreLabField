/* BoreLab Field v0.15 — separate product conduit footage from legacy shot-length baseline. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number(x||0).toLocaleString(undefined,{maximumFractionDigits:1});
const sane=x=>Number.isFinite(Number(x))?Number(x):0;
function sizeKey(input){
 const raw=String(input??'').trim().toLowerCase().replace(/[″”]/g,'"').replace(/\s+/g,' ');
 if(!raw)return'';
 const decimal=raw.replace(/(\d+)\s+(\d+)\/(\d+)/g,(_,a,b,c)=>String(Number(a)+Number(b)/Number(c)))
   .replace(/^(\d+)\/(\d+)/,(_,a,b)=>String(Number(a)/Number(b)));
 const clean=decimal.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches|[- ]inch)?\.?$/);
 if(clean)return String(Number(clean[1]))+' in';
 return raw;
}
function normalized(shot){
 if(Array.isArray(shot?.conduits)&&shot.conduits.length){
  return shot.conduits.map(c=>({
   size:String(c.size??'').trim().slice(0,40),
   quantity:Math.max(1,Math.min(50,Number.parseInt(c.quantity,10)||1)),
   perRunFeet:c.perRunFeet!==''&&c.perRunFeet!=null&&Number(c.perRunFeet)>0?Number(c.perRunFeet):''
  })).filter(x=>x.size);
 }
 const legacy=String(shot?.pipeDiameter||'').trim();
 return legacy?[{size:legacy,quantity:1,perRunFeet:''}]:[];
}
function plan(shot,allowance=10){
 const base=Math.max(0,sane(shot?.feet))+Math.max(0,sane(allowance));
 return normalized(shot).map(x=>({...x,perRun:x.perRunFeet!==''?Number(x.perRunFeet):base,total:(x.perRunFeet!==''?Number(x.perRunFeet):base)*x.quantity}));
}
function summary(shot){
 const parts=normalized(shot);
 return parts.length?parts.map(x=>x.quantity+'× '+x.size).join(' + '):'No conduit sizes saved';
}
function renderLine(data){
 const item=data||{size:'',quantity:1,perRunFeet:''};
 return '<div class="bl-conduit-row" data-bl-conduit-row>'+
  '<label class="field">Conduit size<input data-bl-size maxlength="40" list="bl-conduit-sizes" value="'+esc(item.size)+'" placeholder="4 inch or 1.25 inch"></label>'+
  '<label class="field">Qty<input data-bl-qty type="number" inputmode="numeric" min="1" max="50" step="1" value="'+esc(item.quantity)+'"></label>'+
  '<label class="field">Feet per conduit (optional)<input data-bl-feet type="number" inputmode="decimal" min="0.1" step="0.1" value="'+esc(item.perRunFeet)+'" placeholder="Bore + allowance"></label>'+
  '<button type="button" class="btn micro ghost" data-bl-remove>Remove</button></div>';
}
function renderEditor(shot){
 const rows=normalized(shot);
 if(!rows.length)rows.push({size:'',quantity:1,perRunFeet:''});
 return '<section class="bl-conduits"><div class="between"><h3>Conduits in This Pull</h3><span class="tiny muted">Size · quantity · footage</span></div>'+
  '<p class="tiny muted spaced">Each conduit uses bore length + the saved pipe allowance unless you enter its own planned footage. Reel consumption is recorded separately.</p>'+
  '<input type="hidden" name="pipeDiameter" value="'+esc(rows[0].size)+'">'+
  '<div data-bl-lines>'+rows.map(renderLine).join('')+'</div>'+
  '<datalist id="bl-conduit-sizes"><option value="1 inch"><option value="1.25 inch"><option value="2 inch"><option value="3 inch"><option value="4 inch"><option value="6 inch"><option value="8 inch"><option value="12 inch"></datalist>'+
  '<button type="button" class="btn micro ghost" data-bl-add>+ Add another conduit</button>'+
  '<p class="tiny muted" data-bl-total></p></section>';
}
function parseEditor(form){
 const container=form?.querySelector('.bl-conduits');
 if(!container)return null;
 const rows=[...container.querySelectorAll('[data-bl-conduit-row]')];
 if(rows.length>30)throw Error('Maximum 30 conduit lines per shot.');
 const out=[];
 for(const row of rows){
  const size=String(row.querySelector('[data-bl-size]')?.value||'').trim();
  const qtyRaw=String(row.querySelector('[data-bl-qty]')?.value??'').trim();
  const rawFeet=String(row.querySelector('[data-bl-feet]')?.value??'').trim();
  if(!size&&!rawFeet&&(!qtyRaw||qtyRaw==='1'))continue;
  if(!size)throw Error('Enter a size for every conduit line or remove the empty line.');
  const qty=Number(qtyRaw);
  if(!Number.isInteger(qty)||qty<1||qty>50)throw Error('Conduit quantity must be a whole number from 1 to 50.');
  const perRun=rawFeet===''?'':Number(rawFeet);
  if(rawFeet!==''&&(!Number.isFinite(perRun)||perRun<=0||perRun>100000))throw Error('Planned feet per conduit must be greater than zero.');
  out.push({size:size.slice(0,40),quantity:qty,perRunFeet:perRun});
 }
 if(out.length===0&&rows.length>1)throw Error('Enter a conduit size or remove blank extra lines.');
 return out;
}
function updateFormSummary(form){
 if(!form)return;
 const root=form.querySelector('.bl-conduits'),field=root?.querySelector('[name="pipeDiameter"]');
 if(!root)return;
 const first=root.querySelector('[data-bl-size]');
 if(field)field.value=first?.value.trim()||'';
 const label=root.querySelector('[data-bl-total]');
 try{
  const values=parseEditor(form)||[];
  const feet=Math.max(0,Number(form.querySelector('[name="feet"]')?.value)||0);
  const allowance=Number(form.dataset.blAllowance)||0;
  const rows=plan({feet,conduits:values},allowance);
  if(label)label.textContent=rows.length?rows.map(x=>x.quantity+' × '+fmt(x.perRun)+' ft '+x.size+' = '+fmt(x.total)+' ft').join(' • '):'No conduit size set. Add a size to calculate product footage.';
 }catch(e){if(label)label.textContent=e.message}
}
function inventory(){
 const state=api().state(),jobs=(state.jobs||[]).filter(j=>!j.archived);
 const needed=new Map(),found=new Map();
 let missing=0;
 for(const job of jobs)for(const shot of job.shots||[]){
  if(shot.status==='complete')continue;
  const lines=plan(shot,job.allowance??state.allowance??10);
  if(!lines.length){missing++;continue}
  for(const line of lines){
   const key=sizeKey(line.size);
   const record=needed.get(key)||{key,size:line.size,required:0,shots:0};
   record.required+=line.total;record.shots++;needed.set(key,record);
  }
 }
 let unknownReels=0;
 for(const reel of state.reels||[]){
  if(reel.archived||reel.location!=='truck')continue;
  const key=sizeKey(reel.size);
  if(!key){unknownReels++;continue}
  const rec=found.get(key)||{available:0,reels:0,largest:0};
  const n=Math.max(0,sane(reel.remaining));
  rec.available+=n;rec.reels++;rec.largest=Math.max(rec.largest,n);
  found.set(key,rec);
 }
 return {lines:[...needed.values()].map(n=>({...n,available:found.get(n.key)?.available??null,reels:found.get(n.key)?.reels||0,largest:found.get(n.key)?.largest||0})).sort((a,b)=>a.size.localeCompare(b.size)),missing,unknownReels,trackedReels:found.size};
}
function renderPlannerSummary(){
 const result=inventory();
 if(!result.lines.length&&!result.missing)return'';
 const lines=result.lines.map(r=>{
  const verdict=r.available==null?'Not tracked on truck':r.available<r.required?'Short '+fmt(r.required-r.available)+' ft':'Totals cover estimate';
  return '<div class="bl-size-line"><div><strong>'+esc(r.size)+'</strong><small>'+r.shots+' line(s) across active jobs</small></div>'+
    '<div class="bl-size-numbers"><strong>'+fmt(r.required)+' ft needed</strong><small>'+(r.available==null?'No matching-sized reel':fmt(r.available)+' ft on truck')+' · '+esc(verdict)+'</small></div></div>';
 }).join('');
 return '<div class="card spaced"><div class="between"><h3>Multi-Conduit Pipe by Size</h3><span class="tiny muted">All active jobs</span></div>'+
  '<p class="tiny muted">For each conduit: quantity × (bore length + allowance), unless you entered custom per-conduit footage. Different sizes are never interchangeable.</p>'+
  lines+(result.missing?'<p class="tiny muted spaced">⚠ '+result.missing+' unfinished shot(s) have no conduit details.</p>':'')+
  (result.unknownReels?'<p class="tiny muted spaced">⚠ '+result.unknownReels+' truck reel(s) have no saved size and are excluded from size comparisons.</p>':'')+
  '<p class="tiny muted spaced">These are estimated total feet, not confirmation of continuous usable footage on any one reel, material grade, or available reservations.</p></div>';
}
const sheet=document.createElement('style');
sheet.textContent='.bl-conduits{margin:14px 0}.bl-conduit-row{display:grid;grid-template-columns:minmax(0,2fr) minmax(65px,.65fr) minmax(90px,1.3fr) auto;align-items:end;gap:8px;padding:9px 0;border-bottom:1px solid var(--line)}.bl-conduit-row label{min-width:0}.bl-conduit-row .btn{margin-bottom:2px}.bl-size-line{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}.bl-size-line:last-of-type{border:0}.bl-size-line small{display:block;color:var(--muted);font-size:11px}.bl-size-numbers{text-align:right}.bl-size-numbers strong{font-size:13px}@media(max-width:650px){.bl-conduit-row{grid-template-columns:1fr 85px}.bl-conduit-row [data-bl-feet]{max-width:100%}.bl-conduit-row .btn{align-self:end}}';
document.head.appendChild(sheet);
document.addEventListener('click',e=>{
 const add=e.target.closest('[data-bl-add]');
 if(add){const form=add.closest('form');const lines=form?.querySelector('[data-bl-lines]');if(!lines)return;if(lines.children.length>=30)return;lines.insertAdjacentHTML('beforeend',renderLine());updateFormSummary(form);return}
 const remove=e.target.closest('[data-bl-remove]');
 if(remove){const form=remove.closest('form'),lines=form?.querySelector('[data-bl-lines]');remove.closest('[data-bl-conduit-row]')?.remove();if(lines&&!lines.children.length)lines.insertAdjacentHTML('beforeend',renderLine());updateFormSummary(form)}
});
document.addEventListener('input',e=>{if(e.target.closest('.bl-conduits')||e.target.matches('form[data-form="shot"] input[name="feet"]'))updateFormSummary(e.target.closest('form'))});
const modal=document.querySelector('#modalRoot');
if(modal)new MutationObserver(()=>{const form=modal.querySelector('form[data-form="shot"]');if(form&&!form.dataset.blReady){form.dataset.blReady='yes';form.dataset.blAllowance=String(api()?.state()?.allowance??10);updateFormSummary(form)}}).observe(modal,{childList:true});
window.BoreLabConduits={sizeKey,normalized,plan,summary,renderEditor,parseEditor,inventory,renderPlannerSummary};
})();
