/* BoreLab Field — Supervisor Mode 1.0
 * Read-only multi-job command center plus explicit local report review markers.
 * This is a shared-device preview; NOT authenticated access, payroll approval, or cloud sync.
 */
(function(){
'use strict';
const bridge=()=>window.BoreLabAssistantBridge;
const state=()=>bridge()?.state?.()||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,d=0)=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:d});
const today=()=>bridge()?.todayLocal?.()||new Date().toLocaleDateString('en-CA');
const jobs=()=>state().jobs||[];
const activeJobs=()=>jobs().filter(j=>!j.archived);
const issues=()=>Array.isArray(state().equipmentIssuesV2)?state().equipmentIssuesV2:[];
const devices=()=>state().equipment||[];
const crewRoster=()=>state().roster||[];
const assignments=()=>state().crewAssignmentsV2||[];
const savedReviews=()=>state().supervisorReviewsV1&&typeof state().supervisorReviewsV1==='object'?state().supervisorReviewsV1:{};
const availableTabs=['overview','jobs','crew','reports','equipment'];
let tab='overview',jobFilter='active',selectedJob='',reportDate='',reportFilter='all',teamDate='';
const day=()=>reportDate||today();
function hour(e){
 if(!e?.start||!e?.end)return 0;
 const a=new Date(e.start).getTime(),b=new Date(e.end).getTime();
 return Number.isFinite(a)&&Number.isFinite(b)&&b>a?Math.max(0,(b-a)/3600000-Math.max(0,Number(e.lunch)||0)/60):0;
}
function crews(){return jobs().flatMap(j=>(j.crew||[]).map(e=>({...e,jobId:j.id,jobTitle:j.jobName||'Unnamed job'})));}
function jobSummary(j,d=day()){
 return bridge()?.jobDaySummary?.(j,d)||{id:j.id,name:j.jobName,shots:0,completed:0,footage:0,crewHours:0,photos:0,pipe:0,warnings:[],hasWork:false};
}
function jobRecords(j,d=day()){return bridge()?.jobRecordsForDay?.(j,d)||{shots:[],crew:[],pipe:[],photos:[],mud:[],mudStock:[]}}
function jobWarnings(j,d=day()){return bridge()?.jobDayIssues?.(j,d)||[]}
function reviewKey(j,d=day()){return d+'::'+j.id}
function reviewFingerprint(j,d=day()){
 const r=jobRecords(j,d);
 const notes=JSON.stringify({
  shots:r.shots.map(x=>[x.id,x.status,x.feet,x.updatedAt,x.completedAt,x.notes,x.pipeUsed]),
  crew:r.crew.map(x=>[x.id,x.start,x.end,x.lunch,x.notes]),
  pipe:r.pipe.map(x=>[x.id,x.shotId,x.feet,x.type,x.at]),
  photos:r.photos.map(x=>[x.id,x.shotId,x.stage,x.addedAt]),
  mud:r.mud.map(x=>[x.id,x.at]),
  warnings:jobWarnings(j,d)
 });
 let hash=2166136261;for(let i=0;i<notes.length;i++)hash=Math.imul(hash^notes.charCodeAt(i),16777619);
 return String(hash>>>0);
}
function reviewRecord(j,d=day()){return savedReviews()[reviewKey(j,d)]||null}
function reviewed(j,d=day()){
 const record=reviewRecord(j,d);
 return record&&record.fingerprint===reviewFingerprint(j,d)?record:null;
}
function staleReview(j,d=day()){const record=reviewRecord(j,d);return !!(record&&!reviewed(j,d))}

function status(j){
 const shots=j.shots||[],done=shots.filter(s=>s.status==='complete').length,progress=shots.filter(s=>s.status==='progress').length;
 return {shots:shots.length,complete:done,drilling:progress,pending:shots.length-done,
  percent:shots.length?Math.round(done/shots.length*100):0,remainingFeet:shots.filter(s=>s.status!=='complete').reduce((n,s)=>n+Math.max(0,Number(s.feet)||0),0)};
}
function portfolio(){
 const list=activeJobs(),total=list.reduce((n,j)=>n+(j.shots||[]).length,0),done=list.reduce((n,j)=>n+status(j).complete,0);
 const updated=list.map(j=>({job:j,summary:jobSummary(j)}));
 const withWork=updated.filter(x=>x.summary.hasWork);
 const hours=withWork.reduce((n,x)=>n+Number(x.summary.crewHours||0),0);
 const unresolved=withWork.filter(x=>jobWarnings(x.job).length>0).length;
 const openCrew=crews().filter(e=>e.start&&!e.end);
 const down=issues().filter(e=>!e.closedAt&&e.downtime);
 return{jobs:list,total,done,percent:total?Math.round(done/total*100):0,hours,unresolved,openCrew,down,work:withWork};
}
function metric(label,value,ico,sub=''){
 return '<div class="sm-metric"><span class="sm-metric-icon">'+ico+'</span><strong>'+esc(value)+'</strong><small>'+esc(label)+'</small>'+
 (sub?'<em>'+esc(sub)+'</em>':'')+'</div>';
}
function header(){
 const p=portfolio(),date=day(),d=new Date(date+'T12:00:00'),fmtDate=Number.isFinite(+d)?d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}):date;
 return '<header class="sm-hero"><div class="sm-hero-top"><span>BORELAB FIELD · SUPERVISOR COMMAND</span>'+
 '<button data-sm-exit>Exit Preview ↗</button></div><div class="sm-hero-body"><div><h1>Field operations,<br>at a glance.</h1>'+
 '<p>'+fmtDate+' · '+p.jobs.length+' active job'+(p.jobs.length===1?'':'s')+'</p></div>'+
 '<span class="sm-hero-art" aria-hidden="true">⌁</span></div>'+
 '<div class="sm-hero-chips"><span>◉ '+p.percent+'% bores complete</span><span>◷ '+p.openCrew.length+' open shifts</span></div></header>';
}
function nav(){
 return '<nav class="sm-nav" aria-label="Supervisor preview sections">'+
 [['overview','▦','Home'],['jobs','⌖','Jobs'],['crew','♙','Crew'],['reports','▤','Reports'],['equipment','◈','Fleet']].
 map(([key,icon,label])=>'<button data-sm-tab="'+key+'" class="'+(tab===key?'active':'')+'" aria-current="'+(tab===key?'page':'false')+'">'+
 '<span>'+icon+'</span><small>'+label+'</small></button>').join('')+'</nav>';
}
function subheading(title,caption='',right=''){
 return '<div class="sm-section-head"><div><h2>'+esc(title)+'</h2>'+(caption?'<p>'+esc(caption)+'</p>':'')+'</div>'+right+'</div>';
}
function jump(page,text){return '<button type="button" data-page="'+page+'" class="sm-link">'+text+'</button>'}
function pageFooter(){
 return '<footer class="sm-foot"><button data-sm-exit>↖ Return to Foreman Mode</button>'+
 '<p>This is a shared-device local preview. Review markers are not approvals or signatures. Real multi-user access requires accounts, server permissions and sync.</p></footer>';
}
function alertList(limit=5){
 const data=portfolio(),alerts=[];
 for(const j of data.jobs){
  const w=jobWarnings(j);for(const text of w.slice(0,4))alerts.push({id:j.id,label:j.jobName,body:text,kind:'warning'});
 }
 if(data.down.length)alerts.push({id:null,label:'Equipment downtime',body:data.down.length+' equipment issue(s) marked as downtime. Verify machine availability.',kind:'critical'});
 if(data.openCrew.length)alerts.push({id:null,label:'Open crew shifts',body:data.openCrew.length+' shift(s) are open across jobs. Check attendance before closeout.',kind:'warning'});
 return '<div class="sm-alert-list">'+(alerts.length?alerts.slice(0,limit).map(a=>
 '<button class="sm-alert '+a.kind+'" '+(a.id?'data-sm-inspect="'+esc(a.id)+'"':'data-sm-tab="'+(a.kind==='critical'?'equipment':'crew')+'"')+'>'+
 '<span class="sm-alert-icon">'+(a.kind==='critical'?'⚠':'◷')+'</span><span><strong>'+esc(a.label)+'</strong><small>'+esc(a.body)+'</small></span><b>›</b></button>').join(''):
 '<p class="sm-good">✓ No issues were flagged in the selected day’s available records. Continue verifying field conditions.</p>')+
 (alerts.length>limit?'<button class="sm-link" data-sm-tab="reports">Review all job reports ›</button>':'')+'</div>';
}
function jobCard(j,compact=false){
 const s=status(j),r=jobSummary(j),warnings=jobWarnings(j).length;
 return '<article class="sm-job-card"><div class="sm-job-heading"><span class="sm-job-symbol">⌁</span>'+
 '<div><strong>'+esc(j.jobName||'Unnamed job')+'</strong>'+
 '<small>'+esc(j.jobAddress||'Job address not saved')+'</small></div>'+
 '<span class="sm-job-percent">'+s.percent+'%</span></div>'+
 '<div class="sm-progress"><span style="width:'+s.percent+'%"></span></div>'+
 '<div class="sm-job-stats"><span><strong>'+s.complete+'</strong> complete</span><span><strong>'+s.drilling+'</strong> drilling</span>'+
 '<span><strong>'+s.pending+'</strong> unfinished</span></div>'+
 (compact?'':'<div class="sm-job-day"><small>'+fmt(r.crewHours,1)+' completed crew-hr today · '+r.photos+' photos logged</small>'+
 (warnings?'<span class="sm-warning-count">⚠ '+warnings+' warning'+(warnings===1?'':'s')+'</span>':'')+'</div>')+
 '<div class="sm-card-actions"><button data-sm-inspect="'+esc(j.id)+'">View Job Details ›</button>'+
 '<button data-sm-open-job="'+esc(j.id)+'">Open in Foreman</button></div></article>';
}
function overview(){
 const p=portfolio();
 return '<section class="sm-view">'+subheading('Supervisor Overview','Across all saved active jobs')+
 '<div class="sm-metrics">'+metric('Active jobs',String(p.jobs.length),'▦')+
 metric('Bores complete',p.done+' / '+p.total,'⌁')+
 metric('Crew-hours today',fmt(p.hours,1)+' hr','◷','Closed entries')+
 metric('Jobs with warnings',String(p.unresolved),'⚠')+'</div>'+
 '<section class="sm-panel">'+subheading('Live Job Portfolio','Completion based on saved bore statuses',jump('jobs','All Jobs ›'))+
 '<div class="sm-portfolio">'+(p.jobs.length?p.jobs.slice(0,4).map(j=>jobCard(j,true)).join(''):
 '<p class="sm-empty">No active jobs yet. Create one in Foreman Mode.</p>')+'</div>'+
 (p.jobs.length>4?'<button class="sm-link" data-sm-tab="jobs">See '+(p.jobs.length-4)+' more jobs ›</button>':'')+'</section>'+
 '<section class="sm-panel">'+subheading('Attention Needed','Open shifts, documentation and equipment', '<button class="sm-link" data-sm-tab="reports">Reports ›</button>')+
 alertList(5)+'</section>'+
 '<section class="sm-panel">'+subheading('Supervisor Shortcuts','Review saved operational data')+
 '<div class="sm-shortcuts"><button data-sm-tab="crew"><span>♙</span><strong>Crew Status</strong><small>Attendance across jobs</small></button>'+
 '<button data-sm-tab="reports"><span>▤</span><strong>Daily Reports</strong><small>Review work by date</small></button>'+
 '<button data-sm-tab="equipment"><span>◈</span><strong>Equipment</strong><small>Downtime and repairs</small></button>'+
 '<button data-page="dayassistlegacy"><span>✓</span><strong>All-Job Closeout</strong><small>Combined daily review</small></button></div></section></section>';
}
function jobsView(){
 const options=[['active','Active'],['attention','Need Review'],['archived','Archived'],['all','All']];
 const selected=jobs().filter(j=>jobFilter==='active'?!j.archived:
 jobFilter==='archived'?j.archived:jobFilter==='attention'?!j.archived&&jobWarnings(j).length>0:true);
 return '<section class="sm-view">'+subheading('Job Portfolio',jobs().length+' saved jobs · '+activeJobs().length+' active')+
 '<div class="sm-filterbar" role="group" aria-label="Filter supervisor jobs">'+options.map(([id,label])=>
 '<button data-sm-job-filter="'+id+'" class="'+(jobFilter===id?'active':'')+'">'+label+'</button>').join('')+'</div>'+
 '<div class="sm-job-grid">'+(selected.length?selected.map(j=>jobCard(j)).join(''):
 '<p class="sm-empty">No saved jobs match this filter.</p>')+'</div>'+
 '<div class="sm-bottom-actions">'+jump('jobs','Open Job Management ›')+
 '<button data-sm-tab="reports">▤ Daily Reports</button></div></section>';
}
function inspect(){
 const j=jobs().find(j=>j.id===selectedJob);if(!j)return'';
 const s=status(j),daySummary=jobSummary(j),dayRec=jobRecords(j),warnings=jobWarnings(j);
 const open=(j.crew||[]).filter(x=>x.start&&!x.end).length;
 return '<section class="sm-panel sm-inspect">'+subheading('Job Detail · '+j.jobName,'Saved data only',
 '<button data-sm-close-inspect aria-label="Close job details">✕</button>')+
 '<div class="sm-inspect-stats"><div><strong>'+s.percent+'%</strong><small>Overall complete</small></div>'+
 '<div><strong>'+fmt(s.remainingFeet)+' ft</strong><small>Remaining bore footage</small></div>'+
 '<div><strong>'+open+'</strong><small>Open crew entries</small></div></div>'+
 '<p class="sm-muted">Today: '+daySummary.shots+' shots updated · '+fmt(daySummary.crewHours,1)+' completed crew-hours · '+daySummary.photos+' photos</p>'+
 (warnings.length?'<div class="sm-inspect-warnings">'+warnings.map(x=>'<p>⚠ '+esc(x)+'</p>').join('')+'</div>':
 '<p class="sm-good">No automatic daily warnings flagged.</p>')+
 '<div class="sm-bottom-actions"><button data-sm-open-job="'+esc(j.id)+'" class="sm-primary">Open Job Workspace</button>'+
 '<button data-sm-report-job="'+esc(j.id)+'">Daily Report ›</button></div></section>';
}
function crewView(){
 const people=crewRoster(),all=crews(),open=all.filter(e=>e.start&&!e.end),date=teamDate||today();
 const dayOpen=all.filter(e=>e.start&&!e.end),done=all.filter(e=>!!e.end&&
 ([e.start,e.end].some(t=>{const d=new Date(t);return Number.isFinite(+d)&&
 d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')===date})));
 const completed=done.reduce((n,e)=>n+hour(e),0);
 const linkedName=e=>people.find(p=>e.memberId===p.id)?.name||e.name||'Crew member';
 const openRows=open.map(e=>'<div class="sm-crew-row"><span class="sm-crew-avatar">'+esc(linkedName(e)).slice(0,1)+'</span>'+
 '<div><strong>'+esc(linkedName(e))+'</strong><small>'+esc(e.jobTitle)+' · Clocked in '+esc(new Date(e.start).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}))+'</small></div>'+
 '<span class="sm-pill good">● On shift</span></div>').join('');
 const roles=assignments().filter(a=>a.date===date&&jobs().some(j=>j.id===a.jobId));
 return '<section class="sm-view">'+subheading('Crew Oversight','Read-only attendance and assignments across saved jobs')+
 '<label class="sm-date">Work date <input type="date" data-sm-team-date value="'+esc(date)+'"></label>'+
 '<div class="sm-metrics">'+metric('Saved people',String(people.length),'♙')+
 metric('Open shifts',String(open.length),'◷')+
 metric('Closed crew-hours',fmt(completed,1)+' hr','✓')+
 metric('Assignments',String(roles.length),'▦')+'</div>'+
 '<section class="sm-panel">'+subheading('Currently Clocked In',open.length+' open shifts across jobs')+
 (open.length?openRows:'<p class="sm-empty">No open crew entries in saved jobs.</p>')+'</section>'+
 '<section class="sm-panel">'+subheading('Assigned Roles','Crew assignments for '+date)+
 (roles.length?roles.map(a=>'<div class="sm-row"><div><strong>'+esc(people.find(p=>p.id===a.personId)?.name||'Unknown crew')+'</strong>'+
 '<small>'+esc(a.role||'Role not entered')+' · '+esc(jobs().find(j=>j.id===a.jobId)?.jobName||'Unknown job')+
 (a.notes?' · '+esc(a.notes):'')+'</small></div></div>').join(''):
 '<p class="sm-empty">No crew assignments saved for this date.</p>')+'</section>'+
 '<section class="sm-panel">'+subheading('Review Crew Time','Only Foreman Mode can modify saved crew entries')+
 '<p class="sm-muted">Open shifts are not counted in completed hours. Use Crew Management to inspect and correct timesheets.</p>'+
 jump('crewmanager2','Open Crew Management ›')+'</section></section>';
}
function reportRow(j){
 const r=jobSummary(j),warnings=jobWarnings(j),mark=reviewed(j),stale=staleReview(j),statusText=mark?'Locally reviewed':stale?'Needs re-review':'Not reviewed';
 return '<article class="sm-report"><div class="sm-report-top"><div><strong>'+esc(j.jobName)+'</strong>'+
 '<small>'+r.shots+' bores updated · '+fmt(r.footage)+' ft reported complete · '+fmt(r.crewHours,1)+' completed crew-hr</small></div>'+
 '<span class="sm-pill '+(mark?'good':stale?'warn':'neutral')+'">'+statusText+'</span></div>'+
 '<div class="sm-report-counts"><span>▣ '+r.photos+' photos</span><span>⌁ '+r.completed+' completed bores</span>'+
 '<span>◈ '+fmt(r.pipe)+' ft installed pipe</span></div>'+
 (warnings.length?'<div class="sm-report-warnings">'+warnings.slice(0,5).map(w=>'<p>⚠ '+esc(w)+'</p>').join('')+
 (warnings.length>5?'<small>+'+(warnings.length-5)+' additional warnings</small>':'')+'</div>':
 '<p class="sm-good">No automatic warnings flagged for this date.</p>')+
 (mark?'<p class="sm-review-note">Reviewed locally '+esc(new Date(mark.reviewedAt).toLocaleString())+'. Warnings remain open until corrected.</p>':
 stale?'<p class="sm-review-note sm-warning">Saved job records have changed since the last local review. Review again before relying on that mark.</p>':'')+
 '<div class="sm-bottom-actions"><button data-sm-report-job="'+esc(j.id)+'">Inspect Job Day ›</button>'+
 '<button class="'+(mark?'sm-secondary':'sm-primary')+'" data-sm-review="'+esc(j.id)+'">'+(mark?'Reopen Review':stale?'Review Updated Records':'Mark Reviewed Locally')+'</button></div></article>';
}
function reportsView(){
 const d=day(),work=jobs().filter(j=>jobSummary(j,d).hasWork),flagged=work.filter(j=>jobWarnings(j,d).length),filtered=reportFilter==='issues'?flagged:
 reportFilter==='reviewed'?work.filter(j=>!!reviewed(j,d)):
 reportFilter==='pending'?work.filter(j=>!reviewed(j,d)):work;
 return '<section class="sm-view">'+subheading('Daily Report Review','Review recorded work by job and date')+
 '<label class="sm-date">Report date <input type="date" data-sm-report-date value="'+esc(d)+'"></label>'+
 '<div class="sm-metrics">'+metric('Jobs with work',String(work.length),'▦')+
 metric('With warnings',String(flagged.length),'⚠')+
 metric('Reviewed locally',String(work.filter(j=>!!reviewed(j,d)).length),'✓')+
 metric('Total photos',String(work.reduce((n,j)=>n+Number(jobSummary(j,d).photos||0),0)),'▣')+'</div>'+
 '<div class="sm-filterbar">'+[['all','All'],['issues','Warnings'],['pending','Unreviewed'],['reviewed','Reviewed']].map(([id,label])=>
 '<button data-sm-report-filter="'+id+'" class="'+(reportFilter===id?'active':'')+'">'+label+'</button>').join('')+'</div>'+
 '<div class="sm-report-list">'+(filtered.length?filtered.map(reportRow).join(''):
 '<p class="sm-empty">No reports match this date and filter. A job appears when relevant work has been recorded.</p>')+'</div>'+
 '<div class="sm-bottom-actions">'+jump('dayassistlegacy','View All-Jobs Daily Review ›')+
 jump('history','Saved Report History ›')+'</div>'+
 '<p class="sm-muted">The Reviewed marker records a local manual acknowledgement only. It is not payroll approval, a signature, or confirmation that warnings are resolved.</p></section>';
}
function equipmentView(){
 const gear=devices(),open=issues().filter(x=>!x.closedAt),down=open.filter(x=>x.downtime),
 services=Array.isArray(state().equipmentServiceV2)?state().equipmentServiceV2:[];
 return '<section class="sm-view">'+subheading('Fleet & Equipment','Shared equipment status and service history')+
 '<div class="sm-metrics">'+metric('Active units',String(gear.filter(x=>!x.archived).length),'◈')+
 metric('Open issues',String(open.length),'⚠')+
 metric('Downtime flags',String(down.length),'◷')+
 metric('Service logs',String(services.length),'▤')+'</div>'+
 '<section class="sm-panel">'+subheading('Open Equipment Issues',open.length+' logged issue(s)')+
 (open.length?open.map(i=>'<div class="sm-issue"><span class="sm-issue-symbol">'+(i.downtime?'⚠':'◈')+'</span>'+
 '<div><strong>'+esc(gear.find(g=>g.id===i.equipmentId)?.name||'Unknown equipment')+
 '</strong><small>'+esc(i.category||'Issue')+' · '+esc(i.note||'No notes')+'</small></div>'+
 '<span class="sm-pill '+(i.downtime?'danger':'warn')+'">'+(i.downtime?'Downtime':'Open')+'</span></div>').join(''):
 '<p class="sm-good">✓ No unresolved equipment issues have been recorded.</p>')+'</section>'+
 '<section class="sm-panel">'+subheading('Equipment Manager','Review repairs and oil reminders')+
 '<p class="sm-muted">A lack of reported issues is not proof that machinery has been inspected or is safe to operate.</p>'+
 jump('equipmentmanager2','Open Equipment Manager 2.0 ›')+'</section></section>';
}
function renderSupervisor(){
 const p=portfolio();
 const page=tab==='jobs'?jobsView():tab==='crew'?crewView():tab==='reports'?reportsView():tab==='equipment'?equipmentView():overview();
 return '<div class="page sm-page">'+header()+
 '<div class="sm-heading"><div><strong>'+({overview:'Supervisor Dashboard',jobs:'All Jobs',crew:'Crew Oversight',reports:'Daily Reports',equipment:'Fleet Overview'}[tab])+
 '</strong><small>'+esc(today())+'</small></div><span class="sm-local">Local Preview</span></div>'+
 (selectedJob?inspect():'')+page+pageFooter()+nav()+'</div>';
}
function changeTab(next){if(!availableTabs.includes(next))return;tab=next;selectedJob='';bridge()?.render?.()}
function handleReview(id){
 const j=jobs().find(x=>x.id===id),s=state();if(!j)return;
 const key=reviewKey(j);
 const mark=reviewed(j),prior=reviewRecord(j),stale=staleReview(j);
 const warnings=jobWarnings(j);
 const q=mark?'Reopen the local review for '+j.jobName+' on '+day()+'?':
 stale?'Re-review updated records for '+j.jobName+' on '+day()+'? This replaces the previous local review marker and does not approve records.':
 'Mark '+j.jobName+' as locally reviewed for '+day()+'?'+(warnings.length?
 '\n\n'+warnings.length+' warning(s) remain unresolved. This is not approval or confirmation that issues are fixed.':'')+
 '\n\nThis records an acknowledgement on this device only.';
 if(!window.confirm?.(q))return;
 s.supervisorReviewsV1={...savedReviews()};
 if(mark)delete s.supervisorReviewsV1[key];
 else s.supervisorReviewsV1[key]={jobId:j.id,date:day(),reviewedAt:new Date().toISOString(),warningCount:warnings.length,
  fingerprint:reviewFingerprint(j)};
 bridge()?.save?.();bridge()?.render?.();
 bridge()?.notify?.(mark?'Local review reopened.':'Local review marker saved; existing records are unchanged.');
}
document.addEventListener('click',e=>{
 const t=e.target.closest?.('[data-sm-exit],[data-sm-tab],[data-sm-inspect],[data-sm-close-inspect],[data-sm-open-job],[data-sm-job-filter],[data-sm-report-filter],[data-sm-report-job],[data-sm-review]');
 if(!t||bridge()?.currentPage?.()!=='supervisorpreview')return;
 if(t.hasAttribute('data-sm-exit')){tab='overview';selectedJob='';bridge()?.setPage?.('home');return}
 if(t.dataset.smTab){changeTab(t.dataset.smTab);return}
 if(t.dataset.smInspect){selectedJob=t.dataset.smInspect;bridge()?.render?.();return}
 if(t.hasAttribute('data-sm-close-inspect')){selectedJob='';bridge()?.render?.();return}
 if(t.dataset.smOpenJob){bridge()?.switchActiveJob?.(t.dataset.smOpenJob);return}
 if(t.dataset.smJobFilter){jobFilter=t.dataset.smJobFilter;selectedJob='';bridge()?.render?.();return}
 if(t.dataset.smReportFilter){reportFilter=t.dataset.smReportFilter;bridge()?.render?.();return}
 if(t.dataset.smReportJob){selectedJob=t.dataset.smReportJob;tab='reports';bridge()?.render?.();return}
 if(t.dataset.smReview){handleReview(t.dataset.smReview);return}
});
document.addEventListener('change',e=>{
 if(bridge()?.currentPage?.()!=='supervisorpreview')return;
 const t=e.target;
 if(t.matches?.('[data-sm-report-date]')&&/^\d{4}-\d{2}-\d{2}$/.test(t.value)){
  reportDate=t.value;selectedJob='';bridge()?.render?.();return;
 }
 if(t.matches?.('[data-sm-team-date]')&&/^\d{4}-\d{2}-\d{2}$/.test(t.value)){
  teamDate=t.value;bridge()?.render?.();return;
 }
});
window.BoreLabSupervisorMode={renderSupervisor,portfolio,status,jobSummary,reviewed,handleReview,
 getTab:()=>tab,changeTab,setReportDate:d=>{reportDate=d},setJobFilter:v=>{jobFilter=v},setReportFilter:v=>{reportFilter=v},
 reviewFingerprint,staleReview};
})();
