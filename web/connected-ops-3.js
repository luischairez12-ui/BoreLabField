/* BoreLab Field — Connected Operations 3.0 (crew, intelligence, equipment, tomorrow).
   Local-only, review-first; never clocks workers in/out, completes shots, or deducts reels automatically. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const st=()=>api()?.state?.()||{};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
const fmt=x=>num(x).toLocaleString(undefined,{maximumFractionDigits:1});
const key=d=>{const v=new Date(d);return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0')};
const today=()=>api()?.todayLocal?.()||key(new Date());
const tomorrow=()=>{const d=new Date(today()+'T12:00:00');d.setDate(d.getDate()+1);return key(d)};
const jobs=()=>st().jobs||[];
const job=()=>jobs().find(j=>j.id===st().activeJobId)||{id:st().activeJobId||'active',jobName:st().jobName||'Active Job',shots:st().shots||[],crew:st().crew||[]};
const roster=()=>st().roster||[];
const equipment=()=>st().equipment||[];
const issues=()=>Array.isArray(st().equipmentIssuesV2)?st().equipmentIssuesV2:[];
const services=()=>Array.isArray(st().equipmentServiceV2)?st().equipmentServiceV2:[];
const assns=()=>Array.isArray(st().crewAssignmentsV2)?st().crewAssignmentsV2:[];
const plans=()=>st().tomorrowPlansV2&&typeof st().tomorrowPlansV2==='object'?st().tomorrowPlansV2:{};
const openIssues=()=>issues().filter(x=>!x.closedAt);
const openCrew=()=>jobs().flatMap(j=>(j.crew||[]).filter(x=>x.start&&!x.end).map(x=>({...x,fromJob:j.jobName,fromJobId:j.id})));
const hour=e=>{const start=new Date(e.start).getTime(),end=new Date(e.end).getTime();return Number.isFinite(start)&&Number.isFinite(end)&&end>start?Math.max(0,(end-start)/3600000-num(e.lunch)/60):0};
const person=id=>roster().find(x=>x.id===id)?.name||'Unknown crew member';
const jobName=id=>jobs().find(x=>x.id===id)?.jobName||'Unknown job';
const clock=()=>new Date().toISOString();
const uid=()=>api()?.uid?.()||String(Date.now())+Math.random().toString(36).slice(2);
const save=()=>api()?.save?.();
const redraw=()=>api()?.render?.();
const notice=s=>api()?.notify?.(s);
const roles=['Foreman','Driller','Locator','Mini Excavator Operator','Operator','Gas Technician','Laborer','Driver','Supervisor','Other'];
const regularRole=p=>roles.includes(p?.primaryRole)?p.primaryRole:'Role not assigned';
const roleChoices=selected=>'<option value="">Not assigned</option>'+roles.map(r=>'<option value="'+esc(r)+'"'+(r===selected?' selected':'')+'>'+esc(r)+'</option>').join('');
const issueKinds=['Breakdown','Repair Needed','Inspection','Hydraulic','Electrical','Fuel / Engine','Other'];
let crewDate=today(),planDate=tomorrow(),editAssignment=false,roleEditor='',assignPerson='',equipEditor='',equipKind='',equipFilter='active',insightFilter='all';
const heading=(eyebrow,title,caption)=>'<header class="b3-head"><span class="eyebrow">'+esc(eyebrow)+'</span><h1>'+esc(title)+'</h1><p>'+esc(caption)+'</p></header>';
const panel=(title,body,action='')=>'<section class="b3-panel"><div class="b3-panel-head"><h2>'+esc(title)+'</h2>'+action+'</div>'+body+'</section>';
const stat=(title,n,icon)=>'<div class="b3-stat"><span>'+icon+'</span><strong>'+esc(n)+'</strong><small>'+esc(title)+'</small></div>';
const stats=(items)=>'<div class="b3-stats">'+items.join('')+'</div>';
const empty=t=>'<p class="b3-empty">'+esc(t)+'</p>';
const action=(page,label)=>'<button type="button" class="b3-link" data-page="'+page+'">'+label+'</button>';
function historyFor(p){return jobs().flatMap(j=>(j.crew||[]).filter(x=>x.memberId===p.id||(!x.memberId&&String(x.name).toLowerCase()===String(p.name).toLowerCase())))}
function activeFor(p){return historyFor(p).filter(x=>!x.end)}
function renderCrew(){
 const people=roster(),active=openCrew(),assigned=assns().filter(a=>a.date===crewDate);
 const duplicate=people.filter(p=>activeFor(p).length>1);
 const cards=people.map(p=>{
  const act=activeFor(p),a=assigned.find(x=>x.personId===p.id),entries=historyFor(p),defaultRole=regularRole(p);
  const roleForm=roleEditor===p.id?'<form class="b3-form b3-role-editor" data-b3-person-role>'+
   '<strong>Regular role for '+esc(p.name)+'</strong><input type="hidden" name="personId" value="'+esc(p.id)+'">'+
   '<label>Job title / primary role<select name="role">'+roleChoices(p.primaryRole)+'</select></label>'+
   '<p class="b3-muted">Saved on this person’s crew profile. Daily job assignments may override the role for one date.</p>'+
   '<div class="b3-actions"><button type="submit" class="b3-primary">✓ Save Regular Role</button><button type="button" data-b3-cancel-role>Cancel</button></div></form>':'';
  const quickForm=assignPerson===p.id?'<form class="b3-form b3-role-editor" data-b3-assignment>'+
   '<strong>Assign '+esc(p.name)+' to a job</strong><input type="hidden" name="personId" value="'+esc(p.id)+'">'+
   '<label>Work date<input type="date" name="date" value="'+esc(crewDate)+'" required></label>'+
   '<label>Job<select name="jobId" required>'+jobs().filter(j=>!j.archived).map(j=>'<option value="'+esc(j.id)+'"'+((a?.jobId||st().activeJobId)===j.id?' selected':'')+'>'+esc(j.jobName)+'</option>').join('')+'</select></label>'+
   '<label>Role for this job/day<select name="role">'+roleChoices(a?.role||p.primaryRole)+'</select></label>'+
   '<label>Instructions (optional)<input name="notes" maxlength="160" value="'+esc(a?.notes||'')+'" placeholder="Locate shot 01, operate mini..."></label>'+
   '<div class="b3-actions"><button type="submit" class="b3-primary">✓ Save Job Assignment</button><button type="button" data-b3-cancel-assignment>Cancel</button></div>'+
   '<p class="b3-muted">A job assignment does not clock anyone in or change recorded hours.</p></form>':'';
  return '<div class="b3-person"><div class="b3-avatar">'+esc(p.name).slice(0,1).toUpperCase()+'</div><div class="b3-person-body">'+
   '<div class="b3-between"><strong>'+esc(p.name)+'</strong><span class="b3-pill '+(act.length?'good':'neutral')+'">'+(act.length?'● Clocked in':'Off clock')+'</span></div>'+
   '<small><b>'+esc(defaultRole)+'</b> · Regular role'+(a&&a.role!==p.primaryRole?' · Today: '+esc(a.role):'')+'</small>'+
   '<small>'+esc(a?'Assigned: '+jobName(a.jobId):'No job assignment for '+crewDate)+'</small>'+
   '<small>'+fmt(entries.reduce((n,e)=>n+hour(e),0))+' completed hours across jobs</small>'+
   '<div class="b3-person-actions"><button type="button" data-b3-edit-role="'+esc(p.id)+'">✎ Set Role</button><button type="button" data-b3-assign-person="'+esc(p.id)+'">▦ Assign Job</button></div>'+
   '</div></div>'+roleForm+quickForm;
 }).join('');
 const form=editAssignment?'<form class="b3-form" data-b3-assignment>'+
  '<label>Person<select name="personId" required><option value="">Choose crew member</option>'+people.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')+'</select></label>'+
  '<label>Job<select name="jobId" required>'+jobs().filter(j=>!j.archived).map(j=>'<option value="'+esc(j.id)+'">'+esc(j.jobName)+'</option>').join('')+'</select></label>'+
  '<label>Role<select name="role">'+roleChoices('')+'</select></label>'+
  '<label>Assignment note<input name="notes" maxlength="160" placeholder="e.g. Locate shots 01–03"></label>'+
  '<button class="b3-primary" type="submit">✓ Save Assignment</button></form>':'';
 return '<div class="page b3-page">'+heading('FIELD / TEAM','Crew Management','Assignments, active shifts, and verified hours across jobs.')+
 stats([stat('Saved crew',String(people.length),'♙'),stat('On shift',String(active.length),'◷'),stat('Completed hours',fmt(jobs().reduce((n,j)=>n+(j.crew||[]).reduce((v,e)=>v+hour(e),0),0))+' hr','✓')])+
 '<div class="b3-actions"><button data-page="crewpreview" class="b3-primary">♙ Preview Crew Mode</button>'+
 '<button data-page="supervisorpreview">▦ Supervisor Overview</button></div>'+
 panel('Crew & Attendance',(cards||empty('No saved crew yet. Add names using Crew Hours.'))+
 '<div class="b3-actions"><button data-b3-roster>＋ Manage People</button>'+action('crew','◷ Timesheets / Check In')+'</div>')+
 (duplicate.length?panel('⚠ Time Review',duplicate.map(p=>'<p class="b3-warn">'+esc(p.name)+' has multiple open shifts. Verify timesheets before payroll.</p>').join('')):'')+
 panel('Job Assignments','<div class="b3-actions"><button class="b3-primary" data-page="dispatch3">♙ Assign Whole Crew ›</button><button data-page="readiness3">☑ Bore Readiness ›</button></div><label class="b3-date">Date <input type="date" data-b3-crew-date value="'+crewDate+'"></label>'+
 '<p class="b3-muted">Assignments are planning notes; they do not check anyone in or change recorded hours.</p>'+
 (assigned.length?assigned.map(a=>'<div class="b3-row"><div><strong>'+esc(person(a.personId))+'</strong>'+
 '<small>'+esc(a.role)+' · '+esc(jobName(a.jobId))+(a.notes?' · '+esc(a.notes):'')+'</small></div>'+
 '<button data-b3-remove-assignment="'+esc(a.id)+'" aria-label="Remove assignment">✕</button></div>').join(''):empty('No assignments recorded for this date.'))+
 '<button data-b3-toggle-assignment class="b3-primary">＋ '+(editAssignment?'Hide':'Add')+' Assignment</button>'+form+
 action('tomorrowplanner','Tomorrow’s Crew Plan ›'))+
 '<p class="b3-disclaimer">Employee logins and live syncing are future features. These records stay in BoreLab on this device.</p></div>';
}
function signalData(){
 const s=st(),j=job(),waiting=(j.shots||[]).filter(x=>x.status!=='complete'),out=[];
 const add=(level,title,detail,to)=>out.push({level,title,detail,to});
 const shifts=openCrew();
 if(shifts.length)add('review',shifts.length+' open crew shift'+(shifts.length===1?'':'s'),'Review start/end times and lunch before payroll.','crewmanager2');
 const duplicates=new Map();
 shifts.forEach(e=>{const id=e.memberId||String(e.name).toLowerCase();duplicates.set(id,(duplicates.get(id)||0)+1)});
 if([...duplicates.values()].some(x=>x>1))add('critical','Potential duplicate open time entries','A crew member appears clocked in more than once across jobs.','crewmanager2');
 const missingGps=waiting.filter(x=>!api()?.coordsValid?.(x)).length;
 if(missingGps)add('review',missingGps+' pending bore'+(missingGps===1?'':'s')+' without GPS','Confirm the shot pins before route planning.','jobmap');
 const linked=api()?.photos?.()||[];
 const after=(j.shots||[]).filter(x=>x.status==='complete'&&!linked.some(p=>p.shotId===x.id&&(!p.jobId||p.jobId===j.id)&&p.stage==='after')).length;
 if(after)add('review',after+' completed bore'+(after===1?'':'s')+' missing After photos','Review photographic documentation before closeout.','phototimeline2');
 const reels=(s.reels||[]).filter(x=>!x.archived&&x.location==='truck'),stock=reels.reduce((v,r)=>v+num(r.remaining),0);
 const allowance=num(j.allowance??s.allowance??10);
 const needed=waiting.reduce((v,sh)=>v+num(sh.feet)+allowance,0);
 if(waiting.length&&!reels.length)add('review','No reels marked on truck','Confirm today’s material loadout and reel availability.','reelplan');
 else if(waiting.length&&needed>stock)add('critical','Recorded pipe footage may be short','Pending shots require '+fmt(needed)+' ft including allowance; on-truck reels show '+fmt(stock)+' ft total. Size and continuous runs also matter.','reelplan');
 const shortages=window.BoreLabCommand?.reelPlan?.()?.simulation?.shortages||[];
 if(shortages.length)add('critical',shortages.length+' continuous pipe run'+(shortages.length===1?'':'s')+' not fitted','Check conduit size and uninterrupted pull length.','reelplan');
 const down=openIssues().filter(x=>x.downtime);
 if(down.length)add('critical',down.length+' equipment downtime flag'+(down.length===1?'':'s'),'Check machine condition and field alternatives.','equipmentmanager2');
 const oil=equipment().filter(x=>x.type==='Truck'&&!x.archived).map(x=>api()?.oilStatus?.(x)).filter(x=>x&&['due','soon'].includes(x.kind));
 if(oil.length)add('review',oil.length+' truck oil-service reminder'+(oil.length===1?'':'s'),'Check manufacturer/fleet interval and current readings.','equipmentmanager2');
 if(!plans()[tomorrow()+'::'+j.id]&&waiting.length)add('info','Tomorrow’s work plan is not saved','Choose shot order, crew, reels, equipment and target time.','tomorrowplanner');
 if(!assns().some(x=>x.date===tomorrow()&&x.jobId===j.id)&&roster().length)add('info','Tomorrow has no saved crew roles','Assign crew responsibilities before dispatch.','crewmanager2');
 return out;
}
function renderIntelligence(){
 const all=signalData(),shown=all.filter(x=>insightFilter==='all'||x.level===insightFilter);
 return '<div class="page b3-page">'+heading('FIELD / INSIGHTS','Field Intelligence','Connected, rule-based alerts from your saved BoreLab records.')+
 '<section class="b3-hero"><small>ACTIVE JOB</small><h2>'+esc(job().jobName)+'</h2><p>'+
 today()+' · '+all.length+' item(s) to consider</p></section>'+
 stats([stat('Critical',String(all.filter(x=>x.level==='critical').length),'⚠'),stat('Review',String(all.filter(x=>x.level==='review').length),'◷'),stat('Planning',String(all.filter(x=>x.level==='info').length),'✧')])+
 '<div class="b3-tabs">'+['all','critical','review','info'].map(x=>'<button data-b3-signal="'+x+'" class="'+(insightFilter===x?'active':'')+'">'+
 (x==='all'?'All':x==='info'?'Tips':x==='review'?'Review':'Critical')+'</button>').join('')+'</div>'+
 panel('Field Intelligence Alerts','<div class="b3-alertlist">'+(shown.length?shown.map(x=>'<button data-page="'+esc(x.to)+'" class="b3-signal '+x.level+'">'+
 '<span>'+ (x.level==='critical'?'⚠':x.level==='review'?'◷':'✧')+'</span><div><strong>'+esc(x.title)+'</strong><small>'+esc(x.detail)+'</small></div><b>›</b></button>').join(''):empty('No alerts in this category from the saved records.'))+'</div>')+
 panel('Quick Decisions','<div class="b3-shortcuts">'+
 action('crewmanager2','♙ Verify Crew')+action('equipmentmanager2','◈ Equipment')+
 action('tomorrowplanner','▤ Plan Tomorrow')+action('dayassist','✓ End of Day')+'</div>')+
 '<p class="b3-disclaimer">No AI prediction or real-time telemetry is claimed. Alerts are rule-based checks, not safety clearance; verify actual field conditions.</p></div>';
}

function renderEquipmentLog(){
 const e=equipment().find(x=>x.id===equipEditor);
 if(!e)return '';
 const header='<div class="b3-panel-head"><h2>'+esc(equipKind==='issue'?'Report an Equipment Issue':'Record Equipment Service')+'</h2>'+
 '<button data-b3-close-editor aria-label="Close editor">✕</button></div><p class="b3-muted">'+esc(e.name)+'</p>';
 return '<section class="b3-panel b3-edit">'+header+
 (equipKind==='issue'?'<form data-b3-issue class="b3-form">'+
 '<label>Issue category<select name="category">'+issueKinds.map(x=>'<option>'+esc(x)+'</option>').join('')+'</select></label>'+
 '<label>Priority<select name="priority"><option value="normal">Normal</option><option value="urgent">Urgent</option></select></label>'+
 '<label>Equipment availability<select name="downtime"><option value="no">Still usable — verify in field</option><option value="yes">Unavailable / downtime</option></select></label>'+
 '<label>What happened?<textarea name="note" required rows="3" maxlength="600" placeholder="Describe the fault, delay, or safety concern"></textarea></label>'+
 '<button type="submit" class="b3-primary">✓ Save Issue</button></form>':
 '<form data-b3-service class="b3-form">'+
 '<label>Service date<input type="date" name="date" required value="'+today()+'"></label>'+
 '<label>Service performed<input name="kind" required maxlength="100" placeholder="e.g. Replaced hydraulic hose"></label>'+
 '<label>Service notes<textarea name="note" maxlength="600" rows="3" placeholder="Parts, labor, vendor, readings"></textarea></label>'+
 '<p class="b3-muted">This general log does not reset existing oil-service reminders. For oil changes, update the truck service details in Settings.</p>'+
 '<button type="submit" class="b3-primary">✓ Save Service</button></form>')+'</section>';
}
function equipmentCard(e){
 const open=openIssues().filter(x=>x.equipmentId===e.id),down=open.some(x=>x.downtime),oil=e.type==='Truck'?api()?.oilStatus?.(e):null;
 const recent=services().filter(x=>x.equipmentId===e.id).sort((a,b)=>String(b.at).localeCompare(String(a.at)))[0];
 return '<article class="b3-equipment-card"><div class="b3-equip-heading"><span class="b3-equip-icon">'+
 (e.type==='Drill'?'⌁':e.type==='Truck'?'▣':e.type==='Mixer'?'◉':'◈')+'</span>'+
 '<div><strong>'+esc(e.name)+'</strong><small>'+esc(e.type||'Equipment')+(e.serial?' · '+esc(e.serial):'')+'</small></div>'+
 '<span class="b3-pill '+(down?'danger':open.length?'warn':'good')+'">'+(down?'Downtime':open.length?open.length+' open issue(s)':'Not flagged')+'</span></div>'+
 (oil?'<p class="b3-service-status '+(oil.kind==='due'?'urgent':oil.kind==='soon'?'warn':'')+'">'+esc(oil.label)+
 ' · '+esc(oil.details)+'</p>':'')+
 (recent?'<p class="b3-muted">Last service: '+esc(recent.kind)+' · '+esc(recent.date)+'</p>':'')+
 open.slice(0,4).map(x=>'<div class="b3-issue-row"><span>'+esc(x.category)+': '+esc(x.note)+'</span>'+
 '<button data-b3-resolve="'+esc(x.id)+'">Resolve</button></div>').join('')+
 '<div class="b3-actions"><button data-b3-report="'+esc(e.id)+'">⚠ Report Issue</button>'+
 '<button data-b3-log-service="'+esc(e.id)+'">▤ Service</button><button data-b3-edit-equipment="'+esc(e.id)+'">Edit ›</button></div></article>';
}
function renderEquipment(){
 const shown=equipment().filter(x=>equipFilter==='archived'?x.archived:!x.archived);
 const down=openIssues().filter(x=>x.downtime).length;
 return '<div class="page b3-page">'+heading('FIELD / EQUIPMENT','Equipment Manager',
 'Existing rigs, mixers, trucks, and trailers — with manually saved issues, repairs and service.')+
 stats([stat('Active units',String(equipment().filter(x=>!x.archived).length),'▣'),
 stat('Open issues',String(openIssues().length),'⚠'),stat('Downtime flags',String(down),'◷')])+
 '<div class="b3-tabs"><button data-b3-equip-tab="active" class="'+(equipFilter==='active'?'active':'')+'">Active Equipment</button>'+
 '<button data-b3-equip-tab="archived" class="'+(equipFilter==='archived'?'active':'')+'">Archived</button></div>'+
 (equipEditor?renderEquipmentLog():'')+
 (shown.length?shown.map(equipmentCard).join(''):'<section class="b3-panel">'+empty('No equipment found in this category.')+'</section>')+
 '<div class="b3-actions"><button data-b3-add-equipment class="b3-primary">＋ Add Equipment</button>'+action('settings','Fleet Settings / Oil Service ›')+'</div>'+
 panel('Maintenance & Repair History','<p class="b3-muted">'+services().length+' new service logs</p>'+
 (services().length?services().slice().sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,30).map(x=>
 '<div class="b3-row"><div><strong>'+esc(equipment().find(e=>e.id===x.equipmentId)?.name||'Previously saved equipment')+'</strong>'+
 '<small>'+esc(x.date)+' · '+esc(x.kind)+(x.note?' · '+esc(x.note):'')+'</small></div><span>✓</span></div>').join(''):
 empty('No additional repair or service records yet. Existing truck oil logs remain under Settings.'))+
 '<p class="b3-muted">'+issues().filter(x=>x.closedAt).length+' equipment issue(s) marked resolved.</p>')+
 '<p class="b3-disclaimer">Availability is based on manually recorded issues only, not an inspection or safety approval.</p></div>';
}
function planKey(date=planDate,id=job().id){return date+'::'+id}
function selectedPlan(){return plans()[planKey()]||null}
function pendingShots(){
 const records=(job().shots||[]).filter(x=>x.status!=='complete');
 const ordered=api()?.orderedShots?.()?.order||records;
 const allowed=new Set(records.map(x=>x.id));
 return [...ordered.filter(x=>allowed.has(x.id)),...records.filter(x=>!ordered.some(y=>y.id===x.id))];
}
function pipeNeeded(shots){
 const extra=num(job().allowance??st().allowance??10);
 return shots.reduce((n,x)=>n+num(x.feet)+extra,0);
}
function truckReels(){return(st().reels||[]).filter(x=>!x.archived&&x.location==='truck')}
function plannedShots(){
 const p=selectedPlan(),ids=new Set(p?.shotIds||pendingShots().map(x=>x.id));
 return pendingShots().filter(x=>ids.has(x.id));
}
function planTick(name,id,primary,secondary,checked){
 return '<label class="b3-plan-tick"><input type="checkbox" data-b3-plan-'+name+' value="'+esc(id)+'" '+(checked?'checked':'')+'>'+
 '<span><strong>'+esc(primary)+'</strong><small>'+esc(secondary)+'</small></span></label>';
}
function renderTomorrow(){
 const p=selectedPlan(),pending=pendingShots(),chosen=plannedShots(),need=pipeNeeded(chosen);
 const allCrew=roster(),reels=truckReels(),gear=equipment().filter(x=>!x.archived);
 const shotIds=new Set(p?.shotIds||pending.map(x=>x.id));
 const crewIds=new Set(p?.crewIds||st().selectedCrewIds||[]);
 const reelIds=new Set(p?.reelIds||window.BoreLabDailyReels?.activeIds?.(st(),planDate)||[]);
 const gearIds=new Set(p?.gearIds||[]);
 const capacity=reels.reduce((n,x)=>n+num(x.remaining),0);
 const assigned=assns().filter(x=>x.date===planDate&&x.jobId===job().id);
 const warnings=[];
 if(!chosen.length)warnings.push('No pending shots selected.');
 if(!crewIds.size)warnings.push('No crew selected for this shift.');
 if(!reelIds.size)warnings.push('No reels selected; material coverage is unconfirmed.');
 if(chosen.length&&capacity<need)warnings.push('Planned shots need about '+fmt(need)+' ft with allowance. All recorded truck reels total '+fmt(capacity)+' ft.');
 if(chosen.some(x=>!api()?.coordsValid?.(x)))warnings.push('One or more selected shots have no saved GPS.');
 if(gear.some(x=>gearIds.has(x.id)&&openIssues().some(y=>y.equipmentId===x.id&&y.downtime)))warnings.push('One or more selected machines have a downtime flag.');
 const seen=p?.updatedAt?'Saved '+new Date(p.updatedAt).toLocaleString():'Not saved yet';
 return '<div class="page b3-page">'+heading('FIELD / NEXT SHIFT','Tomorrow’s Work Planner',
 'Review and save the next shift using existing bores, crew, reels and equipment.')+
 '<section class="b3-hero"><small>NEXT SHIFT</small><h2>'+esc(job().jobName)+'</h2><p>'+esc(planDate)+' · '+esc(seen)+'</p></section>'+
 '<label class="b3-date b3-plan-date">Work date <input type="date" min="'+esc(today())+'" data-b3-plan-date value="'+esc(planDate)+'"></label>'+
 '<form data-b3-plan class="b3-form-layout">'+
 panel('Shots & Order','<p class="b3-muted">Follows current Shot Planner order, but this selection does not complete bores.</p>'+
 (pending.length?pending.map((x,i)=>planTick('shot',x.id,(i+1)+'. '+x.name,fmt(x.feet)+' ft · '+(api()?.coordsValid?.(x)?'GPS saved':'GPS missing'),shotIds.has(x.id))).join(''):
 empty('No unfinished shots. Add shots before creating a plan.'))+
 action('planner','Open Shot Planner ›'))+
 panel('Crew & Roles','<p class="b3-muted">Select crew for the plan; assignments never start a time entry.</p>'+
 (allCrew.length?allCrew.map(x=>planTick('crew',x.id,x.name,assigned.find(a=>a.personId===x.id)?.role||regularRole(x),crewIds.has(x.id))).join(''):
 empty('No saved crew yet.'))+action('crewmanager2','Manage Crew Assignments ›'))+
 panel('Reels & Pipe','<div class="b3-summary-strip"><div><small>Selected shots need</small><strong>'+fmt(need)+' ft</strong></div>'+
 '<div><small>Recorded truck pipe</small><strong>'+fmt(capacity)+' ft</strong></div></div>'+
 '<p class="b3-muted">Totals are indicative only. Conduit sizes, uninterrupted length and reservations require separate verification.</p>'+
 (reels.length?reels.map(x=>planTick('reel',x.id,x.name,(x.size||'Size unknown')+' · '+fmt(x.remaining)+' ft',reelIds.has(x.id))).join(''):
 empty('No truck reels saved.'))+action('reelplan','Intelligent Reel Manager ›'))+
 panel('Equipment Readiness',(gear.length?gear.map(x=>planTick('gear',x.id,x.name,(x.type||'Equipment')+
 (openIssues().some(y=>y.equipmentId===x.id&&y.downtime)?' · ⚠ Downtime flagged':''),gearIds.has(x.id))).join(''):
 empty('No equipment saved.'))+action('equipmentmanager2','Equipment Manager ›'))+
 panel('Schedule & Notes','<div class="b3-two-inputs"><label>Start time<input type="time" name="startTime" value="'+esc(p?.startTime||'07:00')+'"></label>'+
 '<label>Target leave<input type="time" name="leaveTime" value="'+esc(p?.leaveTime||st().finishBySettings?.target||'16:00')+'"></label></div>'+
 '<label>Preparation notes<textarea name="notes" maxlength="1200" rows="3" placeholder="Access, supplies, rig prep, safety items">'+esc(p?.notes||'')+'</textarea></label>'+
 '<p class="b3-muted">Tomorrow’s forecast is not inferred from current conditions. Check the actual weather forecast before dispatch.</p>')+
 panel('Readiness Review',warnings.length?warnings.map(x=>'<p class="b3-warn">⚠ '+esc(x)+'</p>').join(''):
 '<p class="b3-success">✓ No obvious gaps in selected data. Verify the field plan manually.</p>')+
 '<div class="b3-actions"><button type="submit" class="b3-primary">✓ Save Next-Shift Plan</button>'+
 '<button type="button" data-page="fieldintelligence3">✧ Field Intelligence</button></div></form>'+
 '<p class="b3-disclaimer">This saves a draft plan per job and date. It does not reserve pipe, clock anyone in, or alter existing bore or equipment records.</p></div>';
}

function formValue(f,n){return String(f.querySelector?.('[name="'+n+'"]')?.value||'')}
function checked(f,name){return [...(f.querySelectorAll?.('[data-b3-plan-'+name+']:checked')||[])].map(x=>String(x.value))}
function submitRegularRole(form){
 const personId=formValue(form,'personId'),role=formValue(form,'role');
 const member=roster().find(p=>p.id===personId);
 if(!member){notice('Crew member not found.');return}
 if(role&&!roles.includes(role)){notice('Choose a valid regular role.');return}
 member.primaryRole=role;member.roleUpdatedAt=clock();roleEditor='';
 save();redraw();notice(member.name+' regular role saved as '+(role||'Not assigned')+'.');
}
function submitAssignment(form){
 const personId=formValue(form,'personId'),jobId=formValue(form,'jobId'),role=formValue(form,'role');
 const date=formValue(form,'date')||crewDate;
 if(!roster().some(x=>x.id===personId)||!jobs().some(x=>x.id===jobId&&!x.archived)){notice('Select a saved person and active job.');return}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){notice('Choose a valid assignment date.');return}
 if(role&&!roles.includes(role)){notice('Choose a valid assignment role.');return}
 const member=roster().find(p=>p.id===personId),dayRole=role||member.primaryRole||'';
 if(!dayRole){notice('Choose a role for this assignment first.');return}
 const existing=assns().find(x=>x.personId===personId&&x.date===date);
 const revised=assns().filter(x=>!(x.personId===personId&&x.date===date));
 revised.push({id:existing?.id||uid(),personId,jobId,date,role:dayRole,
  notes:formValue(form,'notes').trim().slice(0,160),updatedAt:clock()});
 st().crewAssignmentsV2=revised;editAssignment=false;assignPerson='';save();redraw();
 notice('Crew assignment saved for '+date+'. Recorded time and regular role are unchanged.');
}
function submitIssue(f){
 if(!equipment().some(x=>x.id===equipEditor))return;
 const note=formValue(f,'note').trim().slice(0,600);
 if(!note){notice('Describe the issue before saving.');return}
 const category=formValue(f,'category'),priority=formValue(f,'priority');
 st().equipmentIssuesV2=[...issues(),{id:uid(),equipmentId:equipEditor,jobId:job().id,
  category:issueKinds.includes(category)?category:'Other',priority:priority==='urgent'?'urgent':'normal',
  downtime:formValue(f,'downtime')==='yes',note,openedAt:clock(),closedAt:''}];
 equipEditor='';equipKind='';save();redraw();notice('Equipment issue saved. Check the machine in the field.');
}
function submitService(f){
 if(!equipment().some(x=>x.id===equipEditor))return;
 const date=formValue(f,'date'),kind=formValue(f,'kind').trim().slice(0,100);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!kind){notice('Enter a date and service description.');return}
 st().equipmentServiceV2=[...services(),{id:uid(),equipmentId:equipEditor,date,kind,
  note:formValue(f,'note').trim().slice(0,600),at:clock()}];
 equipEditor='';equipKind='';save();redraw();notice('Service recorded. Existing oil schedule was not reset.');
}
function submitPlan(f){
 const validShots=new Set(pendingShots().map(x=>x.id)),people=new Set(roster().map(x=>x.id));
 const reels=new Set(truckReels().map(x=>x.id)),gear=new Set(equipment().filter(x=>!x.archived).map(x=>x.id));
 const startTime=formValue(f,'startTime'),leaveTime=formValue(f,'leaveTime');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(leaveTime)){
  notice('Choose valid 24-hour start and departure times.');return;
 }
 const old=selectedPlan();
 st().tomorrowPlansV2={...plans(),[planKey()]:{
  id:old?.id||uid(),date:planDate,jobId:job().id,
  shotIds:checked(f,'shot').filter(x=>validShots.has(x)),
  crewIds:checked(f,'crew').filter(x=>people.has(x)),
  reelIds:checked(f,'reel').filter(x=>reels.has(x)),
  gearIds:checked(f,'gear').filter(x=>gear.has(x)),
  startTime,leaveTime,notes:formValue(f,'notes').trim().slice(0,1200),updatedAt:clock()
 }};
 save();redraw();notice('Next-shift plan saved. Crew, shots and pipe inventory were not changed.');
}
document.addEventListener('click',e=>{
 const t=e.target.closest?.('[data-b3-roster],[data-b3-edit-role],[data-b3-assign-person],[data-b3-cancel-role],[data-b3-cancel-assignment],[data-b3-toggle-assignment],[data-b3-remove-assignment],[data-b3-report],[data-b3-log-service],[data-b3-close-editor],[data-b3-edit-equipment],[data-b3-add-equipment],[data-b3-resolve],[data-b3-equip-tab],[data-b3-signal]');
 if(!t||!api())return;
 if(t.hasAttribute('data-b3-roster')){api().openRosterForm?.();return}
 if(t.dataset.b3EditRole){roleEditor=roleEditor===t.dataset.b3EditRole?'':t.dataset.b3EditRole;assignPerson='';redraw();return}
 if(t.dataset.b3AssignPerson){assignPerson=assignPerson===t.dataset.b3AssignPerson?'':t.dataset.b3AssignPerson;roleEditor='';redraw();return}
 if(t.hasAttribute('data-b3-cancel-role')){roleEditor='';redraw();return}
 if(t.hasAttribute('data-b3-cancel-assignment')){assignPerson='';redraw();return}
 if(t.hasAttribute('data-b3-toggle-assignment')){editAssignment=!editAssignment;redraw();return}
 if(t.dataset.b3RemoveAssignment){
  if(!window.confirm?.('Remove this planned assignment? Recorded hours are not affected.'))return;
  st().crewAssignmentsV2=assns().filter(x=>x.id!==t.dataset.b3RemoveAssignment);save();redraw();return;
 }
 if(t.dataset.b3Report){equipEditor=t.dataset.b3Report;equipKind='issue';redraw();return}
 if(t.dataset.b3LogService){equipEditor=t.dataset.b3LogService;equipKind='service';redraw();return}
 if(t.hasAttribute('data-b3-close-editor')){equipEditor='';equipKind='';redraw();return}
 if(t.dataset.b3EditEquipment){api().openEquipmentForm?.(t.dataset.b3EditEquipment);return}
 if(t.hasAttribute('data-b3-add-equipment')){api().openEquipmentForm?.();return}
 if(t.dataset.b3Resolve){
  const item=issues().find(x=>x.id===t.dataset.b3Resolve);if(!item||item.closedAt)return;
  if(!window.confirm?.('Mark this issue resolved after verifying the equipment?'))return;
  item.closedAt=clock();save();redraw();notice('Issue marked resolved.');return;
 }
 if(t.dataset.b3EquipTab){equipFilter=t.dataset.b3EquipTab;redraw();return}
 if(t.dataset.b3Signal){insightFilter=t.dataset.b3Signal;redraw();return}
});
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.hasAttribute?.('data-b3-crew-date')&&/^\d{4}-\d{2}-\d{2}$/.test(t.value)){crewDate=t.value;redraw();return}
 if(t.hasAttribute?.('data-b3-plan-date')&&/^\d{4}-\d{2}-\d{2}$/.test(t.value)){planDate=t.value;redraw();return}
});
document.addEventListener('submit',e=>{
 const f=e.target;
 const kind=f.hasAttribute?.('data-b3-person-role')?'person-role':
 f.hasAttribute?.('data-b3-assignment')?'assignment':
 f.hasAttribute?.('data-b3-issue')?'issue':
 f.hasAttribute?.('data-b3-service')?'service':
 f.hasAttribute?.('data-b3-plan')?'plan':'';
 if(!kind||!api())return;
 e.preventDefault();
 try{
  if(kind==='person-role')submitRegularRole(f);
  if(kind==='assignment')submitAssignment(f);
  if(kind==='issue')submitIssue(f);
  if(kind==='service')submitService(f);
  if(kind==='plan')submitPlan(f);
 }catch(err){notice('Could not save: '+(err?.message||String(err)))}
});
window.BoreLabConnectedOps3={renderCrew,renderIntelligence,renderEquipment,renderTomorrow,signalData,
 planKey,selectedPlan,pipeNeeded,historyFor,activeFor,assignments:assns,issues,services,
 setCrewDate:d=>{crewDate=d},setPlanDate:d=>{planDate=d},regularRole,roleOptions:()=>[...roles],beginRoleEdit:id=>{if(roster().some(p=>p.id===id)){roleEditor=id;assignPerson='';redraw()}}};
})();
