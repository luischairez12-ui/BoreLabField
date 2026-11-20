/* BoreLab Field — Crew Mode 1.0 local preview.
   This is a shared-device UI prototype, NOT authentication or access control.
   All record changes use existing local BoreLab job, time and photo stores. */
(function(){
'use strict';
const bridge=()=>window.BoreLabAssistantBridge;
const st=()=>bridge()?.state?.()||{};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(x,d=1)=>Number(x||0).toLocaleString(undefined,{maximumFractionDigits:d});
const dateLocal=d=>{if(!d)return'';const t=new Date(d);return Number.isFinite(+t)?t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'):''};
const today=()=>bridge()?.todayLocal?.()||dateLocal(Date.now());
const roster=()=>Array.isArray(st().roster)?st().roster:[];
const jobs=()=>Array.isArray(st().jobs)?st().jobs:[];
const assignments=()=>Array.isArray(st().crewAssignmentsV2)?st().crewAssignmentsV2:[];
const photos=()=>bridge()?.photos?.()||[];
const pinRole=()=>window.BoreLabLocalAccounts?.role?.()==='crew';
const person=()=>{
 if(pinRole())return roster().find(x=>x.id===window.BoreLabLocalAccounts.memberId())||null;
 return roster().find(x=>x.id===st().crewPreviewMemberId)||roster()[0]||null;
};
const matches=(entry,p)=>Boolean(p&&(entry.memberId?entry.memberId===p.id:String(entry.name||'').trim().toLowerCase()===String(p.name||'').trim().toLowerCase()));
const entries=p=>!p?[]:jobs().flatMap(j=>(j.crew||[]).filter(e=>matches(e,p)).map(e=>({...e,fromJobId:j.id,fromJobName:j.jobName}))).sort((a,b)=>String(b.start||'').localeCompare(String(a.start||'')));
const chosenAssignment=(p,d=today())=>p?assignments().find(a=>a.personId===p.id&&a.date===d&&jobs().some(j=>j.id===a.jobId&&!j.archived)):null;
const assignedJob=p=>{const a=chosenAssignment(p);return a?jobs().find(j=>j.id===a.jobId):jobs().find(j=>j.id===st().activeJobId)};
const activeEntry=p=>entries(p).find(e=>e.start&&!e.end);
const lastTime=e=>{const d=new Date(e);return Number.isFinite(+d)?d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'—'};
const shortDate=e=>{const d=new Date(e);return Number.isFinite(+d)?d.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}):'Unknown date'};
const hours=e=>{if(!e.end)return 0;const a=new Date(e.start).getTime(),b=new Date(e.end).getTime();return Number.isFinite(a)&&Number.isFinite(b)&&b>a?Math.max(0,(b-a)/3600000-Math.max(0,Number(e.lunch)||0)/60):0};
const summHours=arr=>arr.reduce((v,e)=>v+hours(e),0);
const pathButtons=['home','hours','photos','assignments'];
let tab='home',photoEditor=false,clockBusy=false,notice='';
function save(){bridge()?.save?.()}
function render(){bridge()?.render?.()}
function notify(t){notice=t;bridge()?.notify?.(t)}
function goCrew(t){if(pathButtons.includes(t)){tab=t;photoEditor=false;render()}}
function selectedJobName(j){return j?.jobName||'No job selected'}
function ownedPhotos(j){return !j?[]:photos().filter(p=>p.jobId===j.id).sort((a,b)=>String(b.addedAt||'').localeCompare(String(a.addedAt||'')))}
function pageTop(p,j){
 const name=(p?.name||'Crew member').split(/\s+/)[0]||'Crew';
 const hour=new Date().getHours(),greet=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
 const options=roster().map(x=>'<option value="'+esc(x.id)+'"'+(x.id===p?.id?' selected':'')+'>'+esc(x.name)+'</option>').join('');
 return '<div class="cm-hero"><div class="cm-hero-heading"><span>BORELAB FIELD · CREW MODE</span>'+
 '<button type="button" data-page="safetycontacts" class="cm-safety-link">✚ 811 / Safety</button>'+ 
 '<button data-cm-exit>'+(pinRole()?'🔒 Switch User':'Exit Preview ↗')+'</button></div><div class="cm-hero-main"><div><h1>'+greet+', '+esc(name)+'!</h1>'+
 '<p>Your workday at a glance</p></div><span class="cm-helmet" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M11 39c1-14 9-23 21-23s20 9 21 23M29 16V9h6v7M9 39h46v8H9zM17 47h30M21 53h22" /><path d="M22 21v18M42 21v18"/></svg></span></div>'+
 '<div class="cm-identity">'+(pinRole()?
 '<span class="cm-identity-pinned">Signed in as '+esc(p.name)+' · Crew</span>':
 '<label>Viewing local crew profile <select data-cm-person aria-label="Select local crew preview profile">'+options+'</select></label>')+
 '<small>'+(pinRole()?'Local PIN session · shared-device only':'Shared-device test preview · no secure login yet')+'</small></div></div>';
}
function jobCard(p,j){
 const a=chosenAssignment(p),todayShots=(j?.shots||[]).filter(s=>s.status!=='complete');
 const role=a?.role||p?.primaryRole||'No role assigned',sub=a?.notes||'No work notes saved for today';
 const address=j?.jobAddress||'Address not saved';
 const matching=Boolean(j&&j.id===st().activeJobId);
 return '<section class="cm-job"><div class="cm-between"><span class="cm-eyebrow">TODAY’S JOB</span>'+
 '<span class="cm-assigned">'+(a?'● Assigned':'Preview current job')+'</span></div>'+
 '<h2>'+esc(selectedJobName(j))+'</h2><p>'+esc(role)+' · '+todayShots.length+' unfinished bore'+(todayShots.length===1?'':'s')+'</p>'+
 '<div class="cm-job-location"><span>⌖</span><span>'+esc(address)+'</span></div>'+
 (a?.notes?'<div class="cm-job-note">'+esc(sub)+'</div>':'')+
 '<div class="cm-progress-row"><span>'+((j?.shots||[]).filter(s=>s.status==='complete').length)+' completed / '+(j?.shots||[]).length+' total bores</span>'+
 '<b>'+((j?.shots||[]).length?Math.round((j.shots.filter(s=>s.status==='complete').length/j.shots.length)*100):0)+'%</b></div>'+
 '<div class="cm-progress"><span style="width:'+((j?.shots||[]).length?Math.round((j.shots.filter(s=>s.status==='complete').length/j.shots.length)*100):0)+'%"></span></div>'+
 '<div class="cm-job-buttons"><button data-cm-tab="assignments">View Assignment ›</button>'+
 '<button data-cm-directions'+(!j||!j.jobAddress&&!bridge()?.coordsValid?.(j)?' disabled':'')+'>⌖ Directions</button></div>'+
 (!matching&&a?'<div class="cm-context-warning">This assignment is on a different job than the foreman’s active job. Photo upload and time clock require the correct active job.</div>':'')+'</section>';
}
function timeForJob(p,j){
 const e=activeEntry(p);return{entry:e,otherJob:!!(e&&e.fromJobId!==st().activeJobId),sameJob:!!(e&&e.fromJobId===st().activeJobId),j};
}
function attendanceCard(p,j){
 const v=timeForJob(p,j),e=v.entry,forJob=(j?.id===st().activeJobId);
 let status=e?'Clocked in':'Not clocked in',subtitle=e?'Started '+lastTime(e.start)+' · '+esc(e.fromJobName):'Ready for your shift';
 const canClock=forJob&&!v.otherJob&&!!p;
 const defaultLunch=st().autoLunchEnabled?Math.max(0,Math.min(300,Number(st().defaultLunchMinutes)||0)):0;
 return '<section class="cm-card"><div class="cm-section-head"><span class="cm-section-icon">◷</span>'+
 '<div><strong>My Time Clock</strong><small>'+subtitle+'</small></div>'+
 '<span class="cm-status '+(e?'on':'off')+'">'+(e?'● On shift':'Off clock')+'</span></div>'+
 (e?'<div class="cm-attendance-main"><strong>'+esc(lastTime(e.start))+'</strong><small>Clock-in time</small></div>'+
 '<div class="cm-attendance-foot">Elapsed time appears in your timesheet. Verify breaks before checkout.</div>':
 '<div class="cm-attendance-main"><strong>Ready when you are</strong><small>'+esc(j?.jobName||'Select a job in Foreman Mode')+'</small></div>')+
 (v.otherJob?'<p class="cm-warning">You are already clocked in on '+esc(e.fromJobName)+'. Open that job in Foreman Mode to check out correctly.</p>':'')+
 (!forJob?'<p class="cm-warning">The saved assignment is not the active job. Switch to that job in Foreman Mode before recording time.</p>':'')+
 (canClock?(e?'<form data-cm-checkout class="cm-checkout-form"><label>Unpaid lunch (minutes)<input name="lunch" type="number" inputmode="numeric" min="0" max="300" step="1" required value="'+defaultLunch+'"></label>'+
 '<button type="submit" class="cm-cta">✓ Confirm Clock Out</button></form>':
 '<button data-cm-checkin class="cm-cta">◷ Confirm Clock In</button>'):
 '<button type="button" class="cm-cta" disabled>Time Clock Unavailable</button>')+
 '<p class="cm-micro">'+(pinRole()?'Local PIN mode: no server-side payroll permissions or syncing.':'Local test mode: no login verification or remote payroll approval.')+'</p></section>';
}
function hourList(p,full=false){
 const arr=entries(p),n=full?20:3;
 const list=arr.slice(0,n).map(e=>'<div class="cm-hour-entry"><div><strong>'+esc(shortDate(e.start))+'</strong>'+
 '<small>'+esc(e.fromJobName)+' · In '+esc(lastTime(e.start))+(e.end?' / Out '+esc(lastTime(e.end)):' · Open shift')+'</small></div>'+
 '<b>'+(e.end?fmt(hours(e),2)+' hr':'In progress')+'</b></div>').join('');
 return list||'<div class="cm-empty">No saved time entries for this crew member yet.</div>';
}
function hoursCard(p,full=false){
 const arr=entries(p),complete=arr.filter(x=>!!x.end),open=arr.filter(x=>!x.end);
 return '<section class="cm-card"><div class="cm-section-head"><span class="cm-section-icon">▤</span>'+
 '<div><strong>My Hours</strong><small>Read-only personal time history</small></div>'+
 (full?'':'<button class="cm-text-link" data-cm-tab="hours">View All ›</button>')+'</div>'+
 '<div class="cm-hours-overview"><div><strong>'+fmt(summHours(complete),2)+'</strong><small>Completed hours</small></div>'+
 '<div><strong>'+complete.length+'</strong><small>Closed entries</small></div>'+
 '<div><strong>'+open.length+'</strong><small>Open shifts</small></div></div>'+
 hourList(p,full)+'<p class="cm-micro">Hours reflect existing saved time entries and unpaid lunches. Only a foreman can review or edit historical entries in this prototype.</p></section>';
}
function tasksCard(p,j){
 const a=chosenAssignment(p),pending=(j?.shots||[]).filter(s=>s.status!=='complete'),assignedEquipment=(st().equipment||[]).find(e=>e.id===a?.equipmentId);
 return '<section class="cm-card"><div class="cm-section-head"><span class="cm-section-icon">▦</span><div>'+
 '<strong>My Assignments</strong><small>'+esc(today())+' · '+esc(j?.jobName||'No job')+'</small></div></div>'+
 '<div class="cm-assignment-role"><span>'+(a?'Today’s Role':'Regular Role')+'</span><strong>'+esc(a?.role||p?.primaryRole||'Not assigned')+'</strong></div>'+
 (assignedEquipment?'<div class="cm-work-note"><strong>Assigned Equipment</strong><p>'+esc(assignedEquipment.name)+'</p></div>':'')+
 (a?.notes?'<div class="cm-work-note"><strong>Work instructions</strong><p>'+esc(a.notes)+'</p></div>':
 '<p class="cm-muted">No personal task notes saved yet. Ask the foreman for today’s responsibilities.</p>')+
 '<div class="cm-shot-heading"><strong>Upcoming Bores</strong><small>'+pending.length+' pending</small></div>'+
 (pending.length?pending.slice(0,5).map((s,i)=>'<div class="cm-shot"><span class="cm-shot-num">'+(i+1)+'</span><div><strong>'+esc(s.name||'Bore')+'</strong>'+
 '<small>'+fmt(s.feet,0)+' ft · '+(s.status==='progress'?'Drilling':'Pending')+'</small></div></div>').join(''):
 '<div class="cm-empty">No unfinished bores in this job.</div>')+
 '<p class="cm-micro">Assignments and shots are read-only here; a foreman manages work planning.</p></section>';
}
function photoCard(p,j,full=false){
 const list=ownedPhotos(j),matching=!!j&&j.id===st().activeJobId;
 return '<section class="cm-card"><div class="cm-section-head"><span class="cm-section-icon">▣</span>'+
 '<div><strong>Jobsite Photos</strong><small>'+list.length+' saved for '+esc(j?.jobName||'this job')+'</small></div>'+
 (!full?'<button class="cm-text-link" data-cm-tab="photos">See All ›</button>':'')+'</div>'+
 '<p class="cm-muted">Capture a photo and link it to a bore with a Before, During or After stage.</p>'+
 '<div class="cm-photo-grid">'+(list.length?list.slice(0,full?12:4).map(x=>'<div class="cm-photo-thumb"><img src="'+esc(x.dataUrl)+'" loading="lazy" alt="Saved jobsite photo">'+
 '<small>'+esc(x.stage||'Unclassified')+'</small></div>').join(''):
 '<div class="cm-empty">No jobsite photos recorded for this job yet.</div>')+'</div>'+
 (matching?'<button class="cm-cta" data-cm-photo-toggle>▣ '+(photoEditor?'Close Photo Picker':'Add Jobsite Photo')+'</button>':
 '<div class="cm-warning">Change to the assigned job in Foreman Mode before adding a photo.</div>')+
 (photoEditor&&matching?photoForm(j):'')+
 '<p class="cm-micro">Photo gallery is shared local job data; uploader identity and secure access will come with accounts.</p></section>';
}
function photoForm(j){
 const bores=j?.shots||[];
 return '<form class="cm-photo-form" data-cm-photo-form><label>Attach to bore<select name="shotId" required><option value="">Choose a bore</option>'+
 bores.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+fmt(s.feet,0)+' ft</option>').join('')+'</select></label>'+
 '<label>Photo stage<select name="stage"><option value="before">Before</option><option value="during">During</option><option value="after">After</option></select></label>'+
 '<div class="cm-photo-buttons"><button type="submit" name="kind" value="camera">Camera</button>'+
 '<button type="submit" name="kind" value="gallery">Gallery</button></div></form>';
}
function homeGrid(p,j){
 return '<div class="cm-quick-grid">'+
 '<button data-cm-tab="hours"><span>◷</span><strong>My Hours</strong><small>Personal time history</small></button>'+
 '<button data-cm-tab="photos"><span>▣</span><strong>Upload Photos</strong><small>Jobsite camera</small></button>'+
 '<button data-cm-tab="assignments"><span>▦</span><strong>My Assignments</strong><small>Today’s work</small></button>'+
 '<button data-cm-directions><span>⌖</span><strong>Job Location</strong><small>View directions</small></button></div>';
}
function crewNav(){
 return '<nav class="cm-navbar" aria-label="Crew preview navigation">'+[
 ['home','house','Home'],['hours','clock','My Hours'],['photos','camera','Photos'],['assignments','clipboard','Tasks']
 ].map(([k,ic,label])=>'<button data-cm-tab="'+k+'" class="'+(tab===k?'active':'')+'" aria-current="'+(tab===k?'page':'false')+'">'+
 '<span>'+({house:'⌂',clock:'◷',camera:'▣',clipboard:'▦'}[ic])+'</span><small>'+label+'</small></button>').join('')+'</nav>';
}
function renderCrew(){
 const p=person(),j=assignedJob(p);
 if(!p){
  return '<div class="page cm-page"><header class="cm-hero"><span>BORELAB FIELD · CREW PREVIEW</span><h1>Crew Mode</h1><p>Choose a saved worker to preview their dashboard.</p></header>'+
   '<section class="cm-card"><h2>No crew profiles available yet</h2><p>Add your crew in Crew Management first. Then return to try the preview.</p>'+
   '<button data-cm-open-roster class="cm-cta">Open Crew Management</button><button data-cm-exit>Return to Foreman Mode</button></section>'+
   '<p class="cm-privacy">This is a shared-device preview. It does not authenticate or restrict access to company information.</p></div>';
 }
 const content=tab==='hours'?hoursCard(p,true):
 tab==='photos'?photoCard(p,j,true):
 tab==='assignments'?tasksCard(p,j):
 jobCard(p,j)+homeGrid(p,j)+attendanceCard(p,j)+hoursCard(p);
 return '<div class="page cm-page">'+pageTop(p,j)+
 '<div class="cm-mode-heading"><div><strong>'+({home:'My Workday',hours:'My Hours',photos:'Jobsite Photos',assignments:'My Assignments'}[tab])+
 '</strong><small>'+esc(today())+'</small></div><span class="cm-local">'+(pinRole()?'PIN Account':'Local Preview')+'</span></div>'+
 content+'<div class="cm-footer"><button data-cm-exit>'+(pinRole()?'🔒 Lock & Switch User':'↖ Return to Foreman Mode')+'</button>'+
 '<p>'+(pinRole()?'Local PIN accounts do not encrypt field records or sync phones.':'No accounts, sync, or server permissions yet. Don’t use local profiles as secure employee access.')+'</p></div>'+
 crewNav()+'</div>';
}
function selectPerson(id){
 if(pinRole())return;
 if(!roster().some(p=>p.id===id))return;
 st().crewPreviewMemberId=id;save();tab='home';photoEditor=false;render();
}
function clockIn(){
 if(clockBusy)return;
 const p=person(),j=assignedJob(p),active=activeEntry(p);
 if(!p||!j||j.id!==st().activeJobId)return notify('Switch to the assigned job in Foreman Mode first.');
 if(active)return notify('This person already has an open shift; review it first.');
 if(!window.confirm?.('Clock in '+p.name+' now on '+j.jobName+' using this device’s current time?'))return;
 clockBusy=true;
 try{
  st().crew.push({id:bridge()?.uid?.()||String(Date.now()),jobId:st().activeJobId,memberId:p.id,name:p.name,
   start:new Date().toISOString(),end:'',lunch:0,notes:'Crew Mode local preview',kind:'checkin'});
  save();render();notify(p.name+' clocked in. Time recorded locally.');
 }finally{clockBusy=false}
}
function clockOut(form){
 if(clockBusy)return;
 const p=person(),j=assignedJob(p),current=activeEntry(p);
 if(!p||!j||!current||current.fromJobId!==st().activeJobId||j.id!==st().activeJobId){
  return notify('Open the correct active job to review this time entry.');
 }
 const raw=String(form.querySelector('[name="lunch"]')?.value??'').trim(),minutes=Number(raw);
 if(!raw||!Number.isInteger(minutes)||minutes<0||minutes>300)return notify('Enter unpaid lunch minutes between 0 and 300.');
 const start=new Date(current.start).getTime(),end=Date.now();
 if(!Number.isFinite(start)||end<=start)return notify('The shift start time is invalid. Ask your foreman to correct it.');
 if(minutes>(end-start)/60000)return notify('Lunch cannot exceed the recorded shift.');
 if(!window.confirm?.('Clock out '+p.name+' now? Confirm '+minutes+' unpaid lunch minutes. This cannot be edited from Crew Mode.'))return;
 const match=(st().crew||[]).find(e=>e.id===current.id&&matches(e,p)&&!e.end);
 if(!match)return notify('Open time entry was not found on the active job. No changes made.');
 clockBusy=true;
 try{match.end=new Date(end).toISOString();match.lunch=minutes;save();render();notify('Clock-out saved for '+p.name+'.');}
 finally{clockBusy=false}
}
function photoSubmit(e){
 const form=e.target,kind=e.submitter?.value||'';
 const p=person(),j=assignedJob(p);
 if(!p||!j||j.id!==st().activeJobId)return notify('Switch to the assigned job in Foreman Mode before adding photos.');
 const shotId=String(form.querySelector('[name="shotId"]')?.value||''),stage=String(form.querySelector('[name="stage"]')?.value||'');
 if(!(j.shots||[]).some(s=>s.id===shotId))return notify('Choose a saved shot from this job.');
 if(!['before','during','after'].includes(stage))return notify('Choose a valid photo stage.');
 if(!['camera','gallery'].includes(kind))return notify('Choose Camera or Gallery.');
 photoEditor=false;
 bridge()?.photoChoose?.(kind,shotId,stage);
}
function navigateJob(){
 const j=assignedJob(person());
 if(!j)return notify('No job available.');
 const s=(j.shots||[]).find(x=>bridge()?.coordsValid?.(x)||x.address);
 let url=s?bridge()?.mapsPinUrl?.(s):'';
 if(!url&&j.jobAddress)url='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(j.jobAddress);
 if(!url)return notify('No saved address or GPS to navigate to.');
 bridge()?.openMapUrl?.(url);
}
document.addEventListener('click',e=>{
 const t=e.target.closest?.('[data-cm-exit],[data-cm-tab],[data-cm-checkin],[data-cm-photo-toggle],[data-cm-directions],[data-cm-open-roster]');
 if(!t||bridge()?.currentPage?.()!=='crewpreview')return;
 if(t.hasAttribute('data-cm-exit')){tab='home';photoEditor=false;bridge()?.setPage?.('home');return}
 if(t.dataset.cmTab){goCrew(t.dataset.cmTab);return}
 if(t.hasAttribute('data-cm-checkin')){clockIn();return}
 if(t.hasAttribute('data-cm-photo-toggle')){photoEditor=!photoEditor;render();return}
 if(t.hasAttribute('data-cm-directions')){navigateJob();return}
 if(t.hasAttribute('data-cm-open-roster')){bridge()?.setPage?.('crewmanager2');return}
});
document.addEventListener('change',e=>{
 if(!e.target.matches?.('[data-cm-person]')||bridge()?.currentPage?.()!=='crewpreview')return;
 selectPerson(e.target.value);
});
document.addEventListener('submit',e=>{
 if(bridge()?.currentPage?.()!=='crewpreview')return;
 if(e.target.matches?.('[data-cm-checkout]')){e.preventDefault();clockOut(e.target);return}
 if(e.target.matches?.('[data-cm-photo-form]')){e.preventDefault();photoSubmit(e)}
});
window.BoreLabCrewMode={renderCrew,person,assignedJob,entries,activeEntry,hours,clockIn,clockOut,selectPerson,goCrew,
 getTab:()=>tab};
})();
