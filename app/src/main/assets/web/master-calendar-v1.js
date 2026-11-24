/* BoreLab Field Master Calendar v1 */
(function(){const C=(function factory(){
'use strict';
const validDay=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const pad=n=>String(n).padStart(2,'0');
function day(x){if(validDay(x))return x;if(!x||!Number.isFinite(Date.parse(x)))return '';const d=new Date(x);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
const feet=x=>Math.max(0,Number(x)||0);
function events(s,jobId=''){
 const out=[],jobs=(s.jobs||[]).filter(j=>!jobId||j.id===jobId);
 const push=(j,type,d,r,extra={})=>{if(validDay(d))out.push({jobId:j.id,jobName:j.jobName||'Job',type,day:d,id:r.id,title:r.name||r.teamName||'Bore',...extra})};
 for(const j of jobs){
  for(const b of [...(j.shots||[]),...(j.connectDeferredShots||[])]){
   const deferred=['hold','cancelled'].includes(b.status),raw=b.connectBore||{};
   if(!j.archived&&!deferred&&['planned','progress'].includes(b.status))push(j,'planned',b.scheduledDay,b,{status:b.status,feet:feet(b.feet)});
   if(b.startedAt)push(j,'started',day(b.startedAt),b,{feet:feet(b.feet)});
   if(b.status==='complete'){
    const actual=day(b.completedAt||raw.activity?.completedAt);
    if(actual)push(j,'completed',actual,b,{feet:feet(b.feet)});
    else push(j,'unverified',b.scheduledDay,b,{feet:feet(b.feet)});
   }
   if(deferred){
    const hold=raw.hold||{};
    push(j,'deferred',day(hold.at),b,{status:b.status,reason:hold.reason||'',feet:feet(b.feet)});
    if(b.status==='hold'&&!j.archived)push(j,'review',hold.resumeDay,b,{status:b.status,reason:hold.reason||'',feet:feet(b.feet)});
   }
  }
  for(const d of (s.crewDispatchesV1||[]).filter(d=>d.jobId===j.id)){
   const gear=(d.equipmentIds||[]).map(id=>(s.equipment||[]).find(x=>x.id===id)?.name||'Unavailable equipment');
   const drift=(d.personnel||[]).some(p=>!(s.crewAssignmentsV2||[]).some(a=>a.teamDispatchId===d.id&&a.personId===p.id&&a.jobId===j.id&&a.date===d.date&&a.role===p.role));
   push(j,'dispatch',d.date,d,{members:(d.memberIds||[]).length,equipment:gear,truck:d.truckLabel||'',drift,teamId:d.teamId});
  }
  for(const a of (s.crewAssignmentsV2||[]).filter(a=>a.jobId===j.id)){
   const covered=(s.crewDispatchesV1||[]).some(d=>d.id===a.teamDispatchId&&d.jobId===j.id&&d.date===a.date&&(d.memberIds||[]).includes(a.personId));
   if(!covered)push(j,'individual',a.date,{id:a.id,name:(s.roster||[]).find(p=>p.id===a.personId)?.name||'Employee'},{role:a.role||''});
  }
 }
 return out.sort((a,b)=>a.day.localeCompare(b.day)||a.jobName.localeCompare(b.jobName)||a.type.localeCompare(b.type)||String(a.id).localeCompare(String(b.id)));
}
function overview(rows,d){const a=rows.filter(x=>x.day===d),type=t=>a.filter(x=>x.type===t);return {dispatch:type('dispatch').length,planned:type('planned').length,completed:type('completed').length,feet:type('completed').reduce((n,x)=>n+x.feet,0),reviews:type('review').length,unverified:type('unverified').length}}
function backlog(s,jobId=''){return (s.jobs||[]).filter(j=>!j.archived&&(!jobId||j.id===jobId)).flatMap(j=>[...(j.shots||[]).filter(b=>b.status==='planned'&&!validDay(b.scheduledDay)).map(b=>({jobId:j.id,jobName:j.jobName,id:b.id,title:b.name,kind:'unscheduled',feet:feet(b.feet)})),...(j.connectDeferredShots||[]).filter(b=>['hold','cancelled'].includes(b.status)).map(b=>({jobId:j.id,jobName:j.jobName,id:b.id,title:b.name,kind:b.status,reviewDay:b.connectBore?.hold?.resumeDay||'',feet:feet(b.feet)}))])}
function monthCells(month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Invalid month');const [y,m]=month.split('-').map(Number),first=new Date(y,m-1,1),out=Array(first.getDay()).fill('');for(let i=1;i<=new Date(y,m,0).getDate();i++)out.push(month+'-'+pad(i));return out}
function shiftMonth(month,delta){const [y,m]=month.split('-').map(Number),d=new Date(y,m-1+delta,1);return d.getFullYear()+'-'+pad(d.getMonth()+1)}
function schedule(j,id,d,now=new Date().toISOString()){if(!validDay(d)||j.archived)throw Error('Choose an active project and valid date');const b=(j.shots||[]).find(x=>x.id===id);if(!b||b.status!=='planned')throw Error('Only planned bores can be scheduled here');if(b.scheduledDay===d)return j.shots;const old=b.connectBore||{},history=[...(old.statusHistory||[]),{at:now,from:'planned',to:'planned',day:validDay(b.scheduledDay)?b.scheduledDay:'',nextDay:d,reason:'Scheduled in Master Calendar'}].slice(-200);return j.shots.map(x=>x.id===id?{...x,scheduledDay:d,updatedAt:now,connectBore:{...old,statusHistory:history}}:x)}
return {validDay,day,events,overview,backlog,monthCells,shiftMonth,schedule};
})();if(typeof module==='object'&&module.exports)module.exports=C;else (function install(C){
'use strict';
const api=()=>window.BoreLabAssistantBridge,allowed=()=>window.BoreLabLocalAccounts?.guardJobSwitch?.()===true,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),head=t=>'<div class="modal-head"><h2>'+esc(t)+'</h2><button class="icon-btn" data-action="close-modal">✕</button></div>';
let selected='',month='',jobId='',filter='all',editing=null;
const names={planned:'Scheduled',started:'Started (recorded)',completed:'Completed',unverified:'Completion date unverified',deferred:'Placed on hold / cancelled',review:'Hold review',dispatch:'Crew dispatch',individual:'Individual assignment'};
const colors={planned:'#c65f16',started:'#9a650e',completed:'#21794c',unverified:'#64748b',deferred:'#a44747',review:'#a3650d',dispatch:'#286ab3',individual:'#286ab3'};
const matches=e=>filter==='all'||(filter==='crew'?['dispatch','individual'].includes(e.type):filter==='work'?['started','completed','unverified'].includes(e.type):filter==='hold'?['deferred','review'].includes(e.type):e.type===filter);
function card(){if(!allowed())return '';return '<section class="card spaced"><div class="between"><div><strong>▦ Master Calendar</strong><p class="tiny muted">All jobs · Crews · Work dates</p></div><button class="btn micro primary" data-bmc="open">Calendar</button></div></section>'}
function row(e){const detail=[e.jobName,e.feet!=null?e.feet+' ft':'',e.status==='hold'?'On hold':e.status==='cancelled'?'Cancelled':e.status==='progress'?'In progress':'',e.members!=null?e.members+' employees':'',e.truck,(e.equipment||[]).join(', '),e.role,e.reason,e.drift?'Individual assignment changed — review':''].filter(Boolean).join(' · ');return '<div class="lightline"><strong style="color:'+colors[e.type]+'">'+esc(names[e.type])+'</strong><p><b>'+esc(e.title)+'</b></p><p class="tiny muted">'+esc(detail)+'</p><div class="actions">'+(e.type==='planned'&&e.status==='planned'?button('edit',e,'Reschedule'):'')+button('job',e,'Open job / date')+'</div></div>'}
function button(action,e,label){return '<button class="btn micro ghost" data-bmc="'+action+'" data-bmc-job="'+esc(e.jobId)+'" data-bmc-id="'+esc(e.id)+'">'+label+'</button>'}
function open(){if(!allowed())return;const a=api(),s=a.state();selected=selected||a.todayLocal();month=month||selected.slice(0,7);const jobs=s.jobs||[];if(jobId&&!jobs.some(j=>j.id===jobId))jobId='';const all=C.events(s,jobId),visible=all.filter(matches),o=C.overview(all,selected),counts=new Map();for(const e of visible)counts.set(e.day,(counts.get(e.day)||0)+1);
const grid=C.monthCells(month).map(d=>d?'<button type="button" data-bmc="select" data-bmc-date="'+d+'" aria-pressed="'+(d===selected)+'" aria-label="'+d+', '+(counts.get(d)||0)+' entries" style="border:1px solid var(--line,#d8dee4);border-radius:8px;min-height:42px;padding:3px;background:'+(selected===d?'#ed6809':'transparent')+';color:'+(selected===d?'#fff':'inherit')+'"><b>'+Number(d.slice(-2))+'</b>'+(counts.has(d)?'<small style="display:block">'+counts.get(d)+'</small>':'')+'</button>':'<span></span>').join('');
const pending=C.backlog(s,jobId);a.showModal(head('Master Calendar')+'<div class="card"><label class="field">Project<select id="bmc-project"><option value="">All projects</option>'+jobs.map(j=>'<option value="'+esc(j.id)+'" '+(jobId===j.id?'selected':'')+'>'+esc(j.jobName)+(j.archived?' (archived)':'')+'</option>').join('')+'</select></label><label class="field">Show<select id="bmc-filter">'+[['all','Everything'],['crew','Crew assignments'],['planned','Scheduled bores'],['work','Recorded work'],['hold','Back Burner']].map(([v,l])=>'<option value="'+v+'" '+(filter===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label><div class="between"><button class="btn micro ghost" data-bmc="prev" aria-label="Previous month">‹</button><strong>'+esc(new Date(month+'-01T12:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'}))+'</strong><button class="btn micro ghost" data-bmc="next" aria-label="Next month">›</button></div><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;text-align:center;margin-top:10px">'+['S','M','T','W','T','F','S'].map(x=>'<small>'+x+'</small>').join('')+grid+'</div><button class="btn ghost spaced" data-bmc="today">Today</button></div><div class="card spaced"><strong>'+esc(selected)+'</strong><div class="form-grid"><div><small>Crews dispatched</small><h2>'+o.dispatch+'</h2></div><div><small>Scheduled bores</small><h2>'+o.planned+'</h2></div><div><small>Completed bore length</small><h2>'+o.feet+' ft</h2></div><div><small>Hold reviews due</small><h2>'+o.reviews+'</h2></div></div><p class="tiny muted">Recorded completion dates only; '+o.unverified+' completion(s) without a confirmed timestamp on this scheduled date. Tile counts ignore the activity filter.</p>'+ (visible.filter(e=>e.day===selected).map(row).join('')||'<p>No matching calendar entries.</p>')+'<button class="btn ghost" data-bmc="dispatch">Manage crew dispatch</button></div><div class="card spaced"><strong>Unscheduled &amp; Back Burner ('+pending.length+')</strong>'+ (pending.map(e=>'<div class="lightline"><strong>'+esc(e.title||'Bore')+'</strong><p class="tiny muted">'+esc([e.jobName,e.feet+' ft',e.kind,e.reviewDay?'Review '+e.reviewDay:''].filter(Boolean).join(' · '))+'</p>'+button(e.kind==='unscheduled'?'edit':'backburner',e,e.kind==='unscheduled'?'Schedule':'Open Back Burner')+'</div>').join('')||'<p>No unscheduled or deferred bores.</p>')+'</div>')}
function edit(jid,id){const a=api(),j=a.state().jobs.find(j=>j.id===jid),b=j?.shots?.find(b=>b.id===id);if(!j||j.archived||b?.status!=='planned')throw Error('Only active planned bores can be moved');editing={jid,id};a.showModal(head('Schedule '+b.name)+'<div class="card"><p>'+esc(j.jobName)+' · '+esc(b.feet)+' ft</p><label class="field">Work date<input id="bmc-new-date" type="date" value="'+esc(b.scheduledDay||selected)+'"></label><p class="tiny muted">Only the scheduled date changes. Recorded drilling, actual pipe and crew assignments stay intact.</p><button class="btn primary" data-bmc="save">Save date</button><button class="btn ghost" data-bmc="open">Cancel</button></div>')}
function act(b){if(!allowed())throw Error('Owner or foreman access required');const a=api(),name=b.dataset.bmc,jid=b.dataset.bmcJob,id=b.dataset.bmcId;
if(name==='open')return open();if(name==='prev'||name==='next'){month=C.shiftMonth(month,name==='prev'?-1:1);return open()}if(name==='select'){selected=b.dataset.bmcDate;return open()}if(name==='today'){selected=a.todayLocal();month=selected.slice(0,7);return open()}if(name==='edit')return edit(jid,id);
if(name==='save'){const s=a.state(),j=s.jobs.find(j=>j.id===editing?.jid),d=document.getElementById('bmc-new-date')?.value;if(!j)throw Error('Project no longer exists');const rows=C.schedule(j,editing.id,d);j.shots=rows;if(s.activeJobId===j.id)s.shots=rows;a.save();selected=d;month=d.slice(0,7);a.render();open();a.notify('Bore scheduled; actual production unchanged.');return}
if(name==='dispatch'){a.closeModal();window.BoreLabCrewTeamsV1?.openForDate?.(selected);return}
if(name==='job'||name==='backburner'){const s=a.state(),j=s.jobs.find(x=>x.id===jid);if(!j)throw Error('Project no longer exists');if(s.activeJobId!==jid){a.switchActiveJob(jid);if(a.state().activeJobId!==jid)throw Error('Could not switch project');}a.closeModal();if(name==='backburner'){window.BoreLabCalendarConnect?.openBackBurner?.();return}a.setPage('jobmap');window.BoreLabMapCalendarV31?.select?.(selected);}}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-bmc]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();try{act(b)}catch(err){api()?.notify?.(err.message)}},true);
document.addEventListener('change',e=>{if(!allowed())return;if(e.target.id==='bmc-project'){jobId=e.target.value;open()}if(e.target.id==='bmc-filter'){filter=e.target.value;open()}});
window.BoreLabMasterCalendarV1={open,card,core:C};
})(C);})();
