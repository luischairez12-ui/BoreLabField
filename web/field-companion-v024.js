/* BoreLab v0.24 / Mi OS Daily 0.2.1: owner-approved, idempotent local companion.
   Existing BoreLab remains the authority for jobs, reel balances and pipe-move history. */
(function(){
'use strict';
const a=()=>window.BoreLabAssistantBridge;
const native=()=>window.BoreLabNative;
const $=s=>document.querySelector(s);
const state=()=>a()?.state?.()||{};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const fmt=x=>Number(x||0).toLocaleString(undefined,{maximumFractionDigits:1});
const sizeKey=x=>window.BoreLabConduits?.sizeKey?.(x)||String(x||'').toLowerCase();
const owner=()=>!!a()&&(!window.BoreLabLocalAccounts||window.BoreLabLocalAccounts.isUnlocked?.()&&window.BoreLabLocalAccounts.role?.()==='owner');
const authorized=()=>owner()&&!!native()?.isMiOsEnabled?.();
const receipts=()=>Array.isArray(state().launcherImportReceipts)?state().launcherImportReceipts:[];
const dismissed=()=>Array.isArray(state().launcherImportDismissed)?state().launcherImportDismissed:[];
let cached=[],lastPrompt='',lastLoad=0,showSkipped=false,activeImportId='';
const statuses={ready:'Ready to review',incomplete:'Incomplete readings',modified:'Changed since import',imported:'Already imported',skipped:'Skipped'};
const normalize=x=>String(x||'').trim();
const asNumber=s=>{const t=normalize(s);return /^(?:\d+)(?:\.\d{1})?$/.test(t)?Number(t):NaN};
function diameter(label){
 const text=normalize(label).toLowerCase().replace(/[″”]/g,'"');
 const pattern=/^(\d+(?:\s+\d+\/\d+)?(?:\.\d+)?|\d+\/\d+)\s*(?:inches|inch|in\b|")(?=$|\s|[.,;])/;
 const match=text.match(pattern);
 if(!match)return '';
 const k=sizeKey(match[1]+' in');
 return /^\d+(?:\.\d+)? in$/.test(k)?k:'';
}
function rowsFor(entry){
 return (entry.rows||[]).map(row=>{
  const start=asNumber(row.start),end=asNumber(row.end),size=diameter(row.label),footage=Math.round(Math.abs(start-end)*10)/10;
  return {id:String(row.id||''),label:normalize(row.label),startRaw:normalize(row.start),endRaw:normalize(row.end),
   size,feet:footage,valid:!!size&&Number.isFinite(start)&&Number.isFinite(end)&&footage>0&&footage<=100000};
 });
}
function entryStatus(entry){
 const prev=receipts().find(r=>r.sourceId===entry.id);
 if(prev)return String(prev.updatedAt)===String(entry.updatedAt)?'imported':'modified';
 if(dismissed().includes(entry.id))return 'skipped';
 if(!normalize(entry.address)||!rowsFor(entry).length||rowsFor(entry).some(r=>!r.valid))return 'incomplete';
 return 'ready';
}
function loadLogs(){
 let payload={entries:[]};
 try{
  const raw=native()?.getLauncherLogs?.();
  if(raw&&raw.length<=2000000)payload=JSON.parse(raw);
 }catch(e){a()?.notify?.('Mi OS Daily log connection unavailable. Check both apps are enabled.')}
 cached=Array.isArray(payload.entries)?payload.entries.filter(x=>x&&typeof x.id==='string'&&x.id.length<=120).slice(0,250):[];
 lastLoad=Date.now();
 return cached;
}
function pending(){return cached.filter(x=>entryStatus(x)==='ready'||entryStatus(x)==='incomplete')}
function snapshot(){
 const s=state(),base=a()?.shop?.()||{},coordinates=(x)=>Number.isFinite(Number(x?.lat))&&Number.isFinite(Number(x?.lon))&&
 Number(x.lat)>=-90&&Number(x.lat)<=90&&Number(x.lon)>=-180&&Number(x.lon)<=180;
 const shop=coordinates(base)?{id:'shop',jobId:'',name:s.shopName||'Shop',address:s.shopAddress||'',lat:Number(base.lat),lon:Number(base.lon),feet:0,status:'shop'}:null;
 const points=[];
 for(const job of s.jobs||[]){
  for(const sh of job.shots||[]){
   if(!coordinates(sh))continue;
   points.push({id:sh.id,jobId:job.id,name:sh.name||'Bore',address:sh.address||'',lat:Number(sh.lat),lon:Number(sh.lon),feet:Number(sh.feet)||0,status:sh.status||'planned'});
   if(points.length>=100)break;
  }
  if(points.length>=100)break;
 }
 return {version:1,updatedAt:new Date().toISOString(),activeJobId:s.activeJobId||'',shop,points};
}
function publish(){
 if(!authorized())return;
 try{native()?.publishMiOsSnapshot?.(JSON.stringify(snapshot()))}catch{}
}
function sync(){
 if(!authorized())return;
 publish();
 const rows=loadLogs(),fresh=pending();
 if(!fresh.length)return;
 const sig=fresh.map(x=>x.id+':'+x.updatedAt).join(',');
 if(sig===lastPrompt)return;
 if($('#modalRoot .modal-backdrop'))return;
 lastPrompt=sig;
 a()?.showModal?.('<div class="modal-head"><h2>Mi OS Daily · New Logs</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>'+
 '<p class="smalltext">Found <strong>'+fresh.length+'</strong> launcher log'+(fresh.length===1?'':'s')+' to review. BoreLab will not change a reel until you approve each entry.</p>'+
 '<p class="tiny muted">Pipe sizes, addresses, exact measurements and notes will be preserved. Existing imports are never deducted twice.</p>'+
 '<div class="modal-footer"><button class="btn ghost" data-action="close-modal">Later</button><button class="btn primary" data-bc-open>Review Logs</button></div>');
}
function show(){
 if(!owner())return '<div class="page"><h2>Owner permissions required</h2></div>';
 const on=authorized();
 if(on&&!lastLoad)loadLogs();
 const all=cached.slice().sort((x,y)=>String(y.date||'').localeCompare(String(x.date||'')));
 return '<div class="page bc-page"><span class="eyebrow">OWNER / PRIVATE INTEGRATION</span><h1>Mi OS Daily Companion</h1>'+
 '<p class="smalltext muted">Optional, same-phone connection to your custom launcher. BoreLab remains the only app that can approve and deduct real pipe usage.</p>'+
 '<section class="bc-card"><div class="between"><div><h3>Private Launcher Connection</h3><small>Only your Mi OS Daily package can request the approved BoreLab map snapshot.</small></div><label class="bc-toggle"><input type="checkbox" data-bc-enabled '+(on?'checked':'')+'> Enabled</label></div>'+
 '<p class="tiny muted">Enable access in both BoreLab and Mi OS Daily. BoreLab shares only job map pins, not PINs, full job files or photos. Re-enable the BoreLab PIN gate before using on shared devices.</p>'+
 (on?'<button type="button" class="btn ghost" data-bc-refresh>↻ Refresh Launcher Logs</button>':'<p class="bc-empty">Disabled. Turn on to review Mi OS Daily logs or publish jobsite pins.</p>')+'</section>'+
 (on?'<section class="bc-card"><div class="between"><h3>Launcher Import Queue</h3><span class="tag">'+pending().length+' pending</span></div>'+
 (all.length?all.map(x=>{
 const status=entryStatus(x),data=rowsFor(x);
 if(status==='skipped'&&!showSkipped)return '';
 return '<div class="bc-entry"><div><strong>'+esc(x.address||'Address not recorded')+'</strong>'+
 '<small>'+esc(x.date||'Date missing')+' · '+esc(statuses[status])+' · '+data.length+' pipe row(s)</small></div>'+
 '<div class="bc-entry-right"><b>'+esc(data.length?data.map(r=>r.valid?fmt(r.feet)+' ft '+r.size:'Needs review').join(', '):'No pipe rows')+'</b>'+
 (status==='ready'?'<button class="btn micro primary" data-bc-review="'+esc(x.id)+'">Review</button>'+
 '<button class="btn micro ghost" data-bc-skip="'+esc(x.id)+'">Skip</button>':
 status==='incomplete'?'<button class="btn micro ghost" data-bc-review="'+esc(x.id)+'">Inspect</button>':'')+
 '</div></div>';
 }).join(''):'<p class="bc-empty">No launcher entries accessible yet. Connect Mi OS Daily and save a Daily Log.</p>')+
 '<button class="btn micro ghost" data-bc-show-skipped>'+ (showSkipped?'Hide skipped entries':'Show skipped entries') +'</button>'+
 '<p class="tiny muted">Changed entries already imported are flagged for manual review, not re-deducted.</p></section>':'')+'</div>';
}
function pick(entryId){
 if(!owner()||!authorized())return;
 const entry=cached.find(x=>x.id===entryId);
 if(!entry)return a()?.notify?.('Launcher log no longer available. Refresh.');
 if(receipts().some(r=>r.sourceId===entry.id))return a()?.notify?.('This launcher entry was already imported. No second pipe deduction allowed.');
 activeImportId=entryId;
 const rows=rowsFor(entry),valid=entryStatus(entry)==='ready';
 const jobs=state().jobs||[],j=jobs.find(x=>x.id===state().activeJobId)||jobs[0];
 const reelOptions=r=>'<option value="">Choose verified reel</option>'+
 (state().reels||[]).filter(q=>!q.archived&&q.location==='truck'&&sizeKey(q.size)===r.size).map(q=>
 '<option value="'+esc(q.id)+'">'+esc(q.name)+' · '+fmt(q.remaining)+' ft physical</option>').join('');
 a()?.showModal?.('<div class="modal-head"><h2>Review Mi OS Daily Log</h2><button class="icon-btn" data-action="close-modal">✕</button></div>'+
 '<p class="tiny muted">Source: '+esc(entry.date||'Unknown date')+' · '+esc(entry.address||'No address')+'</p>'+
 '<p class="smalltext">BoreLab will create <strong>one completed bore</strong> with '+rows.length+' conduit run(s) from this log. No extra 10 ft is added.</p>'+
 '<form data-bc-import="'+esc(entry.id)+'"><label class="field">Destination job<select name="jobId">'+jobs.map(x=>
 '<option value="'+esc(x.id)+'"'+(x.id===j?.id?' selected':'')+'>'+esc(x.jobName||'Job')+'</option>').join('')+'</select></label>'+
 '<label class="field">Bore label<input name="name" value="'+esc('Launcher · '+(entry.address||'Shot'))+'" maxlength="70"></label>'+
 (rows.length?rows.map((r,i)=>
 '<div class="bc-import-row"><strong>'+esc(r.label||'Pipe '+(i+1))+'</strong><small>Start '+esc(r.startRaw||'—')+' · End '+esc(r.endRaw||'—')+
 ' · '+esc(r.valid?fmt(r.feet)+' ft exact · '+r.size:'Incomplete or unrecognized readings')+'</small>'+
 (r.valid?'<label class="field">Confirm reel used<select name="reel_'+i+'" required>'+reelOptions(r)+'</select></label>':'')+'</div>').join(''):'<p class="bc-warning">No pipe rows.</p>')+
 (entry.notes?'<p class="bc-notes">Notes: '+esc(entry.notes)+'</p>':'')+
 (!valid?'<p class="bc-warning">This record needs a recognizable pipe size, both numeric readings and an address. Correct the launcher log and refresh before importing.</p>':'')+
 '<label class="bc-confirm"><input type="checkbox" name="confirmed" required> I confirm these are actual installed pipe pulls from the selected reels, not planned measurements.</label>'+
 '<div class="modal-footer"><button class="btn ghost" type="button" data-action="close-modal">Cancel</button>'+
 '<button class="btn primary" type="submit" '+(!valid?'disabled':'')+'>Approve Bore + Deduct Pipe</button></div></form>');
}
function validateImport(entry,jobId,selected){
 const s=state(),target=(s.jobs||[]).find(j=>j.id===jobId);
 if(!target)throw Error('Select a valid destination job.');
 if(!normalize(entry.address))throw Error('A job address is required.');
 if(receipts().some(r=>r.sourceId===entry.id))throw Error('This log was already imported.');
 const rows=rowsFor(entry);
 if(!rows.length||rows.some(r=>!r.valid))throw Error('Invalid pipe diameter or incomplete footage; edit this log in Mi OS first.');
 const reels=new Map((s.reels||[]).map(r=>[r.id,r])),left=new Map(),runs=[];
 for(let i=0;i<rows.length;i++){
  const line=rows[i],reel=reels.get(String(selected[i]||''));
  if(!reel||reel.archived||reel.location!=='truck')throw Error('Select a valid on-truck reel for pipe '+(i+1)+'.');
  if(sizeKey(reel.size)!==line.size)throw Error('Wrong pipe diameter for '+reel.name+'.');
  const held=(s.pipeReservations||[]).filter(x=>x.reelId===reel.id).reduce((n,x)=>n+Number(x.feet||0),0);
  const free=(left.has(reel.id)?left.get(reel.id):Number(reel.remaining))-held;
  if(line.feet>free+.00001)throw Error('Not enough unreserved continuous pipe on '+reel.name+'.');
  left.set(reel.id,(left.has(reel.id)?left.get(reel.id):Number(reel.remaining))-line.feet);
  runs.push({row:line,reel});
 }
 return {target,rows,runs,left};
}
function approve(form){
 if(!owner()||!authorized())return;
 const entry=cached.find(x=>x.id===form.dataset.bcImport);
 if(!entry)return a()?.notify?.('Launcher entry missing. Refresh before approving.');
 const data=new FormData(form);
 if(data.get('confirmed')!=='on')return a()?.notify?.('Confirm the pulls are actual installed pipe.');
 let checked;
 try{checked=validateImport(entry,String(data.get('jobId')),rowsFor(entry).map((_,i)=>data.get('reel_'+i)))}
 catch(err){return a()?.notify?.('Import blocked: '+(err.message||String(err)))}
 const s=state(),now=new Date().toISOString(),j=checked.target,shotId=a().uid();
 const shot={id:shotId,name:normalize(data.get('name')).slice(0,70)||'Launcher Bore',
  feet:Math.max(...checked.rows.map(x=>x.feet)),allowanceOverride:0,
  conduits:checked.rows.map(x=>({size:x.size,quantity:1,perRunFeet:x.feet})),
  pipeDiameter:checked.rows[0].size,address:normalize(entry.address).slice(0,250),
  notes:String(entry.notes||'').slice(0,4000),status:'complete',pipeUsed:checked.rows.reduce((n,x)=>n+x.feet,0),
  startedAt:entry.date?entry.date+'T08:00:00':now,completedAt:now,updatedAt:now,
  source:'mios-daily',sourceLogId:entry.id,sourceLogDate:entry.date,
  sourceReadings:checked.rows.map(x=>({id:x.id,label:x.label,start:x.startRaw,end:x.endRaw,feet:x.feet}))};
 const prevReels=[...new Set(checked.runs.map(x=>x.reel.id))].map(id=>({id,remaining:Number(s.reels.find(r=>r.id===id).remaining)}));
 const beforeReservations=JSON.parse(JSON.stringify(s.pipeReservations||[])),moveIds=[];
 // All validations above occur before the first state change. Apply one transaction and persist once.
 if(j.id===s.activeJobId)s.shots.push(shot);
 else {if(!Array.isArray(j.shots))j.shots=[];j.shots.push(shot)}
 for(const run of checked.runs){
  const reel=run.reel,old=Number(reel.remaining);
  reel.remaining=Math.round((old-run.row.feet)*10)/10;
  const move={id:a().uid(),jobId:j.id,reelId:reel.id,shotId,type:'installed',size:run.row.size,
   feet:run.row.feet,at:now,before:old,after:reel.remaining,
   note:'Mi OS Daily import '+entry.id+' · '+run.row.startRaw+' → '+run.row.endRaw};
  s.pipeMoves.push(move);moveIds.push(move.id);
 }
 if(!Array.isArray(s.launcherImportReceipts))s.launcherImportReceipts=[];
 s.launcherImportReceipts.push({source:'mios-daily',sourceId:entry.id,updatedAt:entry.updatedAt,
  shotId,jobId:j.id,moveIds,at:now,rows:checked.rows.map(x=>x.id)});
 s.demo=false;
 window.BoreLabFieldOps?.journal?.('Mi OS Daily: verified installed pipe',j.id,shotId,null,shot,{
  reelBefore:prevReels,reelAfter:prevReels.map(x=>({id:x.id,remaining:Number(s.reels.find(r=>r.id===x.id).remaining)})),
  moveIds,reservationsBefore:beforeReservations,reservationsAfter:JSON.parse(JSON.stringify(s.pipeReservations||[]))});
 a().save();a().closeModal?.();a().render?.();publish();
 lastPrompt='';
 a().notify('Imported '+checked.rows.length+' pipe run(s), '+fmt(shot.pipeUsed)+' ft total. Reels updated once.');
}
function skip(id){
 if(!owner())return;
 if(!Array.isArray(state().launcherImportDismissed))state().launcherImportDismissed=[];
 if(!state().launcherImportDismissed.includes(id))state().launcherImportDismissed.push(id);
 a().save();a().render();
}
function enable(on){
 if(!owner())return a()?.notify?.('Owner permission required to change companion access.');
 native()?.setMiOsEnabled?.(!!on);
 if(on){publish();loadLogs();lastPrompt=''}
 a()?.render?.();
}
document.addEventListener('click',e=>{
 const btn=e.target.closest?.('[data-bc-open],[data-bc-refresh],[data-bc-review],[data-bc-skip],[data-bc-show-skipped]');
 if(!btn)return;
 if(btn.hasAttribute('data-bc-open')){a()?.closeModal?.();a()?.setPage?.('companion');return}
 if(btn.hasAttribute('data-bc-refresh')){loadLogs();lastPrompt='';a()?.render?.();return}
 if(btn.dataset.bcReview){pick(btn.dataset.bcReview);return}
 if(btn.dataset.bcSkip){skip(btn.dataset.bcSkip);return}
 if(btn.hasAttribute('data-bc-show-skipped')){showSkipped=!showSkipped;a()?.render?.()}
});
document.addEventListener('change',e=>{
 if(e.target.matches?.('[data-bc-enabled]'))enable(e.target.checked);
});
document.addEventListener('submit',e=>{
 const form=e.target.closest?.('[data-bc-import]');if(!form)return;
 e.preventDefault();approve(form);
});
document.addEventListener('DOMContentLoaded',()=>setTimeout(sync,300),{once:true});
window.BoreLabCompanion={sync,publish,show,loadLogs,pending,rowsFor,diameter,entryStatus,pick,approve,validateImport,
 enable,snapshot,receipts,authorized};
})();