/* BoreLab Field — Intelligent End-of-Day Assistant 2.0 + Smart Photo Timeline 2.0.
   Local-only, review-first. Does not automatically complete bores, clock out people,
   change inventory, or reassign/delete photos. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const state=()=>api()?.state()||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,d=0)=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:d});
const dayOf=v=>{if(!v)return'';const d=new Date(v);return Number.isFinite(+d)?d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'):''};
const dayNow=()=>api()?.todayLocal?.()||dayOf(Date.now());
const stages=['before','during','after'];
const stageOf=p=>stages.includes(String(p.stage||'').toLowerCase())?String(p.stage).toLowerCase():'unclassified';
const belongs=p=>!p.jobId||p.jobId===state().activeJobId;
const allPhotos=()=>api()?.photos?.().filter(belongs)||[];
const job=()=>api()?.activeJob?.()||{id:state().activeJobId,jobName:state().jobName,shots:state().shots||[],crew:state().crew||[]};
const shots=()=>state().shots||[];
const photoId=id=>allPhotos().filter(p=>p.shotId===id);
const validCoords=x=>Boolean(api()?.coordsValid?.(x));
const unique=(values)=>[...new Set(values)];
let selectedDay='',stageFilter='all',selectedShot='all',expandedDate='',showSuggestions=false;
let pendingChanges={},saving=false,timelineNotice='',view='timeline';
const currentDay=()=>selectedDay||dayNow();
function details(){const d=currentDay();return api()?.jobRecordsForDay?.(job(),d)||{shots:[],crew:[],pipe:[],photos:[],mud:[],mudStock:[]}}
function dayShots(){return details().shots||[]}
function completedOnDay(){
 const date=currentDay();return shots().filter(s=>s.status==='complete'&&dayOf(s.completedAt)===date);
}
function missingAfter(){
 return completedOnDay().filter(s=>!photoId(s.id).some(p=>stageOf(p)==='after'));
}
function crewOpen(){
 const date=currentDay();
 return (state().crew||[]).filter(e=>e.start&&!e.end&&dayOf(e.start)<=date);
}
function crewHours(entries){
 return entries.reduce((total,e)=>{
  if(!e.end)return total;
  const start=new Date(e.start).getTime(),end=new Date(e.end).getTime();
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return total;
  return total+Math.max(0,(end-start)/3600000-Math.max(0,Number(e.lunch)||0)/60);
 },0);
}
function todaysIssues(){
 const r=details(),issues=[],finished=completedOnDay();
 for(const s of finished){
  if(!photoId(s.id).some(p=>stageOf(p)==='after'))
   issues.push({key:'after:'+s.id,type:'photo',title:s.name+': missing After photo',detail:'Add or tag an After photo to document completion.',shotId:s.id,action:'phototimeline2'});
  if(!validCoords(s))
   issues.push({key:'gps:'+s.id,type:'gps',title:s.name+': GPS not confirmed',detail:'Save an actual GPS point; an address alone is not a pin.',shotId:s.id,action:'jobmap'});
  if(!String(s.notes||'').trim())
   issues.push({key:'notes:'+s.id,type:'notes',title:s.name+': completion notes empty',detail:'Review the shot log and add any required notes.',shotId:s.id,action:'shot'});
  const pipeMoves=(r.pipe||[]).filter(m=>m.type==='installed'&&m.shotId===s.id);
  if(!pipeMoves.length&&(s.pipeUsed==null||s.pipeUsed===''))
   issues.push({key:'pipe:'+s.id,type:'reel',title:s.name+': pipe usage not recorded',detail:'Verify and record actual installed footage.',shotId:s.id,action:'pipe'});
 }
 const open=crewOpen();
 if(open.length)issues.push({key:'crew',type:'crew',title:open.length+' crew time entr'+(open.length===1?'y is':'ies are')+' still open',detail:'Review ongoing shifts before saving a report.',action:'crew'});
 const unlinked=allPhotos().filter(p=>dayOf(p.addedAt)===currentDay()&&!p.shotId);
 if(unlinked.length)issues.push({key:'unlinked',type:'photo',title:unlinked.length+' photo'+(unlinked.length===1?' is':'s are')+' not linked to a bore',detail:'Review and assign photos if they belong to a shot.',action:'phototimeline2'});
 return issues;
}
function summary(){
 const r=details(),completed=completedOnDay();
 return{date:currentDay(),jobName:state().jobName||'Current job',shotsUpdated:r.shots.length,completed:completed.length,
  completedFeet:completed.reduce((n,s)=>n+Number(s.feet||0),0),crewHours:crewHours(r.crew||[]),
  photos:(r.photos||[]).length,peopleOpen:crewOpen().length,pipe:(r.pipe||[]).filter(x=>x.type==='installed').reduce((n,x)=>n+Number(x.feet||0),0)};
}
const checks=[
 {key:'bore',title:'Bore records',description:'Footage and completion statuses reviewed'},
 {key:'photos',title:'Photos (Before / During / After)',description:'Missing stages and unlinked photos reviewed'},
 {key:'crew',title:'Crew time',description:'Start/end times and lunches reviewed'},
 {key:'gps',title:'GPS & locations',description:'Saved pins verified, not guessed'},
 {key:'materials',title:'Materials / pipe',description:'Actual pipe and reel movements verified'},
 {key:'paperwork',title:'Paperwork & notes',description:'Job documentation checked'}
];
function reviewStoreKey(){return String(state().activeJobId||'unknown')+':'+currentDay()}
function reviewState(){return state().endDayReviewV2?.[reviewStoreKey()]||{}}
function setReview(key,checked){
 if(!checks.some(x=>x.key===key))return;
 const s=state(),root=s.endDayReviewV2&&typeof s.endDayReviewV2==='object'?s.endDayReviewV2:{};
 root[reviewStoreKey()]={...(root[reviewStoreKey()]||{}),[key]:checked===true};
 s.endDayReviewV2=root;api()?.save?.();api()?.render?.();
}
function reviewAlerts(){
 const issues=todaysIssues();
 return checks.map(c=>{
  const kinds={bore:['notes','reel'],photos:['photo'],crew:['crew'],gps:['gps'],materials:['reel'],paperwork:['notes']};
  const count=issues.filter(x=>(kinds[c.key]||[]).includes(x.type)).length;
  return {...c,flagged:count,checked:reviewState()[c.key]===true};
 });
}
function stat(label,value,icon,sub=''){return '<div class="bf2-stat"><span class="bf2-stat-symbol">'+icon+'</span><strong>'+esc(value)+'</strong><small>'+esc(label)+'</small>'+(sub?'<em>'+esc(sub)+'</em>':'')+'</div>'}
function rigBanner(title,sub,label){
 return '<header class="bf2-banner"><div class="bf2-banner-content"><span class="bf2-kicker">BORELAB FIELD · '+esc(label)+'</span>'+
 '<h1>'+esc(title)+'</h1><p>'+esc(sub)+'</p></div><span class="bf2-rig" aria-hidden="true">⌁</span></header>';
}
function alertCard(issue){
 const icon={photo:'▣',gps:'⌖',notes:'▤',reel:'◈',crew:'♙'}[issue.type]||'⚠';
 return '<button class="bf2-alert-row" data-bf2-issue="'+esc(issue.key)+'"><span class="bf2-icon">'+icon+'</span>'+
 '<span><strong>'+esc(issue.title)+'</strong><small>'+esc(issue.detail)+'</small></span><b>›</b></button>';
}
function sectionHead(icon,title,sub=''){return '<div class="bf2-section-head"><span class="bf2-section-icon">'+icon+'</span><div><h2>'+esc(title)+'</h2>'+
 (sub?'<p>'+esc(sub)+'</p>':'')+'</div></div>'}
function timeLabel(day){const d=new Date(day+'T12:00:00');return Number.isFinite(+d)?d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}):day}
function renderEndDay(){
 const data=summary(),issues=todaysIssues(),alerts=reviewAlerts(),reviewed=alerts.filter(a=>a.checked).length;
 const shotRows=dayShots().filter(sh=>sh.status==='complete');
 const c=checks.length;
 return '<div class="page bf2-page bf2-closeout">'+
 rigBanner('End-of-Day Assistant','Review today’s field records before closeout.','INTELLIGENT CLOSEOUT')+
 '<div class="bf2-day-select"><label>Work date <input type="date" data-bf2-day value="'+esc(currentDay())+'"></label>'+
 '<span>'+esc(data.jobName)+'</span></div>'+
 '<section class="bf2-card">'+sectionHead('◎','Today’s Completion Summary',timeLabel(currentDay()))+
 '<div class="bf2-stats">'+stat('Bores updated',String(data.shotsUpdated),'⌁')+
 stat('Completed today',String(data.completed),'✓')+stat('Completed footage',fmt(data.completedFeet)+' ft','↔')+
 stat('Crew-hours logged',fmt(data.crewHours,1)+' hr','♙')+
 stat('Photos added today',String(data.photos),'▣')+'</div></section>'+
 '<div class="bf2-duo"><section class="bf2-card">'+sectionHead('⚠','Smart Alerts',issues.length+' items to review')+
 (issues.length?issues.slice(0,20).map(alertCard).join(''):'<p class="bf2-good">✓ No automatic issues detected for this date.</p>')+
 (issues.length>20?'<p class="bf2-muted">+'+(issues.length-20)+' more issues need review.</p>':'')+
 '</section><section class="bf2-card">'+sectionHead('▤','Closeout Checklist',reviewed+' of '+c+' manually reviewed')+
 '<p class="bf2-muted">Check each item after reviewing the underlying records. A check does not resolve an alert.</p>'+
 alerts.map(a=>'<label class="bf2-check-row"><input type="checkbox" data-bf2-review="'+a.key+'" '+(a.checked?'checked':'')+'>'+
 '<span><strong>'+esc(a.title)+'</strong><small>'+esc(a.description)+'</small></span>'+
 '<em class="'+(a.flagged?'bf2-flag':'bf2-review-label')+'">'+(a.flagged?a.flagged+' issue'+(a.flagged===1?'':'s'):a.checked?'Reviewed':'Review')+'</em></label>').join('')+
 '</section></div>'+
 '<div class="bf2-duo"><section class="bf2-card">'+sectionHead('✧','BoreLab Intelligence','Rule-based recommendations from saved field data')+
 (issues.length?issues.slice(0,4).map(i=>'<button class="bf2-recommend" data-bf2-issue="'+esc(i.key)+'">'+
 '<span class="bf2-icon">✧</span><span><strong>'+esc(i.title)+'</strong><small>'+esc(i.detail)+'</small></span></button>').join(''):
 '<p class="bf2-good">Your available records have no flagged items. Review the checklist before saving.</p>')+
 '</section><section class="bf2-card">'+sectionHead('▤','Daily Report Preview','A preview from saved records — not a signed report')+
 '<div class="bf2-report-row"><span>Job name</span><strong>'+esc(data.jobName)+'</strong></div>'+
 '<div class="bf2-report-row"><span>Date</span><strong>'+esc(currentDay())+'</strong></div>'+
 '<div class="bf2-report-row"><span>Completed bores</span><strong>'+data.completed+'</strong></div>'+
 '<div class="bf2-report-row"><span>Completed footage</span><strong>'+fmt(data.completedFeet)+' ft</strong></div>'+
 '<div class="bf2-report-row"><span>Crew-hours</span><strong>'+fmt(data.crewHours,2)+'</strong></div>'+
 '<div class="bf2-report-row"><span>Photos added</span><strong>'+data.photos+'</strong></div>'+
 '<div class="bf2-report-row"><span>Recorded installed pipe</span><strong>'+fmt(data.pipe)+' ft</strong></div>'+
 '<button class="bf2-quiet" data-bf2-pdf>▤ Export Daily PDF</button></section></div>'+
 '<div class="bf2-bottom-actions"><button data-bf2-reviewissues>⚠ Review Issues ('+issues.length+')</button>'+
 '<button data-bf2-pdf>▤ Generate PDF</button><button class="bf2-orange" data-bf2-close>✓ Review & Close Day</button></div>'+
 '<p class="bf2-disclaimer">Nothing is automatically completed, checked out, approved or deducted. PDF export and closeout use BoreLab’s existing report and confirmation workflow.</p>'+
 '</div>';
}
function photoList(){
 const p=allPhotos();
 return p.filter(x=>(stageFilter==='all'||stageOf(x)===stageFilter)&&(selectedShot==='all'||selectedShot==='unlinked'&&!x.shotId||x.shotId===selectedShot));
}
function sourcePhotoTime(p){return dayOf(p.addedAt)||'Unknown date'}
function sectionDateLabel(day){
 if(day==='Unknown date')return'Unknown date';
 if(day===dayNow())return'Today';
 const last=new Date(dayNow()+'T12:00:00');last.setDate(last.getDate()-1);
 if(day===dayOf(last))return'Yesterday';
 return timeLabel(day);
}
function stageCount(stage,p){return p.filter(x=>stageOf(x)===stage).length}
function classifyCoverage(s){
 const p=photoId(s.id);
 return{shot:s,photos:p,count:p.length,before:p.some(x=>stageOf(x)==='before'),during:p.some(x=>stageOf(x)==='during'),after:p.some(x=>stageOf(x)==='after')};
}
function timelineStats(){
 const p=allPhotos(),coverage=shots().map(classifyCoverage);
 return{photos:p.length,completeSets:coverage.filter(c=>c.before&&c.during&&c.after).length,
 missingAfter:coverage.filter(c=>c.shot.status==='complete'&&!c.after).length,
 today:p.filter(x=>sourcePhotoTime(x)===dayNow()).length,unlinked:p.filter(x=>!x.shotId).length,
 unclassified:p.filter(x=>stageOf(x)==='unclassified').length};
}
function photoCell(p,stage){
 if(!p)return '<div class="bf2-missing-thumbnail"><span>▣</span><small>'+stage+' photo missing</small></div>';
 return '<button class="bf2-thumbnail" data-action="photo-detail" data-id="'+esc(p.id)+'" title="Review photo"><img src="'+esc(p.dataUrl)+'" alt="'+esc(stage)+' jobsite photo" loading="lazy">'+
 '<small>'+esc(stage)+' · '+esc(new Date(p.addedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}))+'</small></button>';
}
function shotGroup(day,shotId,group){
 const shot=shots().find(s=>s.id===shotId);
 const title=shot?.name||'Unlinked / General Photos',count=group.length,hasBefore=group.some(p=>stageOf(p)==='before'),hasAfter=group.some(p=>stageOf(p)==='after');
 const missing=shot?.status==='complete'&&!hasAfter;
 const stageCols=stages.map(s=>photoCell(group.find(p=>stageOf(p)===s),s)).join('');
 return '<div class="bf2-timeline-row"><div class="bf2-timeline-shot"><span class="bf2-icon">⌖</span>'+
 '<div><strong>'+esc(title)+'</strong><small>'+count+' photo'+(count===1?'':'s')+' · '+(missing?'Missing After':hasBefore&&hasAfter?'Before and After present':'Review stages')+'</small></div>'+
 (shot?'<button data-bf2-shot="'+esc(shot.id)+'" aria-label="Open '+esc(title)+'">›</button>':'')+'</div>'+
 '<div class="bf2-photo-stages">'+stageCols+'</div>'+
 (group.filter(p=>stageOf(p)==='unclassified').length?
 '<div class="bf2-unclassified">+'+group.filter(p=>stageOf(p)==='unclassified').length+' unclassified photo(s) · Review below</div>':'')+
 '<div class="bf2-extra-photos">'+group.filter(p=>!stages.some(stage=>group.find(x=>stageOf(x)===stage)?.id===p.id)).map(p=>photoCell(p,stageOf(p))).join('')+'</div>'+
 '</div>';
}
function groupedTimeline(){
 const arr=photoList().slice().sort((a,b)=>String(b.addedAt||'').localeCompare(String(a.addedAt||'')));
 const byDate=new Map();
 for(const p of arr){const date=sourcePhotoTime(p);if(!byDate.has(date))byDate.set(date,[]);byDate.get(date).push(p)}
 if(!arr.length)return '<div class="bf2-empty">No saved photos match these filters. Try a different stage or shot.</div>';
 return [...byDate].map(([day,p])=>{
  const groups=new Map();for(const x of p){const id=x.shotId||'unlinked';if(!groups.has(id))groups.set(id,[]);groups.get(id).push(x)}
  return '<section class="bf2-card bf2-timeline-date">'+sectionHead('▦',sectionDateLabel(day),p.length+' photo'+(p.length===1?'':'s'))+
   [...groups].map(([id,group])=>shotGroup(day,id,group)).join('')+'</section>';
 }).join('');
}
function flaggedPhotos(){
 const coverage=shots().map(classifyCoverage),out=[];
 for(const c of coverage){
  if(c.shot.status==='complete'&&!c.after)out.push({kind:'stage',shot:c.shot,label:c.shot.name+': missing After photo',hint:'Capture a real After photo or review existing pictures.'});
  if(c.shot.status==='progress'&&!c.during)out.push({kind:'stage',shot:c.shot,label:c.shot.name+': no During photo',hint:'Consider documenting the active drilling stage.'});
 }
 if(timelineStats().unlinked)out.push({kind:'unlinked',label:timelineStats().unlinked+' photos are unlinked',hint:'Assign them to a bore only if they belong to it.'});
 if(timelineStats().unclassified)out.push({kind:'stage',label:timelineStats().unclassified+' photos have no stage',hint:'Review stage suggestions before changing metadata.'});
 return out;
}
function suggestions(){
 const all=allPhotos(),ss=shots();
 return all.filter(p=>!p.shotId||stageOf(p)==='unclassified').slice(0,30).map(p=>{
  let suggestions=[];
  if(!p.shotId&&ss.length){
   const dt=new Date(p.addedAt).getTime();
   const near=ss.map(shot=>{
    const anchor=new Date(shot.startedAt||shot.completedAt||shot.updatedAt||'').getTime();
    return{shot,distance:Number.isFinite(dt)&&Number.isFinite(anchor)?Math.abs(dt-anchor):Infinity};
   }).filter(x=>x.distance<=6*3600000).sort((a,b)=>a.distance-b.distance);
   suggestions=near.slice(0,2).map(x=>x.shot);
  }
  return{photo:p,suggestions};
 });
}
function pending(id){
 return pendingChanges[id]||{};
}
function suggestionRow(item){
 const p=item.photo,change=pending(p.id),shotId=change.shotId??p.shotId??'',stage=change.stage??stageOf(p);
 const shotOptions=shots().map(s=>'<option value="'+esc(s.id)+'"'+(s.id===shotId?' selected':'')+'>'+esc(s.name)+'</option>').join('');
 const dirty=change.shotId!==undefined||change.stage!==undefined;
 const suggestion=item.suggestions.length?'<small>Possible match by time: '+esc(item.suggestions.map(x=>x.name).join(', '))+' · verify manually</small>':
 '<small>No reliable shot match suggested; choose manually</small>';
 return '<div class="bf2-suggest-row"><img alt="Photo awaiting review" src="'+esc(p.dataUrl)+'" loading="lazy">'+
 '<div class="bf2-suggest-controls"><strong>'+esc(new Date(p.addedAt).toLocaleString())+'</strong>'+suggestion+
 '<label>Shot<select data-bf2-photo-shot="'+esc(p.id)+'"><option value="">Unlinked / General</option>'+shotOptions+'</select></label>'+
 '<label>Stage<select data-bf2-photo-stage="'+esc(p.id)+'">'+
 '<option value="unclassified"'+(stage==='unclassified'?' selected':'')+'>Not classified</option>'+
 stages.map(x=>'<option value="'+x+'"'+(stage===x?' selected':'')+'>'+x[0].toUpperCase()+x.slice(1)+'</option>').join('')+'</select></label>'+
 '<button data-bf2-savephoto="'+esc(p.id)+'" '+(dirty?'':'disabled')+'>✓ Save Reviewed Photo</button></div></div>';
}
function renderPhotoTimeline(){
 const stats=timelineStats(),all=allPhotos(),warnings=flaggedPhotos();
 const tabs=['all',...stages,'unclassified'];
 return '<div class="page bf2-page bf2-timeline">'+
 rigBanner('Smart Photo Timeline','Organize photos by shot, stage, and date.','PHOTO MANAGEMENT')+
 '<section class="bf2-card">'+sectionHead('▣','Photo Coverage Summary',esc(state().jobName||'Current Job'))+
 '<div class="bf2-stats">'+stat('Total photos',String(stats.photos),'▣')+
 stat('Full stage sets',String(stats.completeSets),'✓')+stat('Completed missing After',String(stats.missingAfter),'⚠')+
 stat('Added today',String(stats.today),'▤')+'</div></section>'+
 '<div class="bf2-filterbar">'+
 '<div class="bf2-stage-filters">'+tabs.map(x=>'<button data-bf2-stage="'+x+'" class="'+(stageFilter===x?'active':'')+'" aria-pressed="'+(stageFilter===x?'true':'false')+'">'+
 (x==='all'?'All':x[0].toUpperCase()+x.slice(1))+' ('+(x==='all'?all.length:x==='unclassified'?all.filter(p=>stageOf(p)==='unclassified').length:stageCount(x,all))+')</button>').join('')+'</div>'+
 '<label>Shot<select data-bf2-shotfilter><option value="all">All Shots</option><option value="unlinked"'+(selectedShot==='unlinked'?' selected':'')+'>Unlinked</option>'+
 shots().map(s=>'<option value="'+esc(s.id)+'"'+(selectedShot===s.id?' selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select></label></div>'+
 groupedTimeline()+
 '<div class="bf2-duo"><section class="bf2-card">'+sectionHead('⚠','Missing Photo Checks',warnings.length+' items to review')+
 (warnings.length?warnings.slice(0,8).map(w=>'<button class="bf2-alert-row" data-bf2-photoissue="'+esc(w.shot?.id||'unlinked')+'">'+
 '<span class="bf2-icon">▣</span><span><strong>'+esc(w.label)+'</strong><small>'+esc(w.hint)+'</small></span><b>›</b></button>').join(''):
 '<p class="bf2-good">✓ No missing photo stages flagged.</p>')+
 '</section><section class="bf2-card">'+sectionHead('✧','Timeline Intelligence','Review-first grouping suggestions')+
 '<p class="bf2-muted">Photos are grouped by their saved job, bore, timestamp, and stage. BoreLab never invents capture times or silently reassigns photos.</p>'+
 '<div class="bf2-report-row"><span>Unlinked photos</span><strong>'+stats.unlinked+'</strong></div>'+
 '<div class="bf2-report-row"><span>No stage recorded</span><strong>'+stats.unclassified+'</strong></div>'+
 '<button data-bf2-suggest class="bf2-quiet">'+(showSuggestions?'Hide Suggestions':'Review Organization Suggestions')+'</button></section></div>'+
 (showSuggestions?'<section class="bf2-card">'+sectionHead('✎','Review Photo Links','Save one photo at a time — originals stay unchanged')+
 (suggestions().length?suggestions().map(suggestionRow).join(''):
 '<p class="bf2-good">All photos have links and stages recorded. No suggestions needed.</p>')+
 '</section>':'')+
 '<div class="bf2-bottom-actions"><button data-bf2-reviewmissing>⚠ Review Missing ('+warnings.length+')</button>'+
 '<button data-bf2-suggest>▦ Review / Organize</button><button class="bf2-orange" data-bf2-addphotos>▣ Add Photos</button></div>'+
 '<p class="bf2-disclaimer">Photos remain in local storage. Changing the shot or stage updates metadata only after your confirmation. No photos are deleted automatically.</p>'+
 '</div>';
}
function goIssue(issue){
 if(!issue)return;
 if(issue.action==='shot'&&issue.shotId)return api()?.shotDetail?.(issue.shotId);
 if(issue.action==='phototimeline2'){api()?.setPage?.('phototimeline2');return}
 api()?.setPage?.(issue.action||'closeout');
}
function clickHandler(e){
 const el=e.target.closest?.('[data-bf2-issue],[data-bf2-reviewissues],[data-bf2-pdf],[data-bf2-close],[data-bf2-stage],[data-bf2-shot],[data-bf2-photoissue],[data-bf2-suggest],[data-bf2-savephoto],[data-bf2-addphotos],[data-bf2-reviewmissing]');
 if(!el||!api())return;
 const d=el.dataset||{};
 if(d.bf2Issue){goIssue(todaysIssues().find(x=>x.key===d.bf2Issue));return}
 if(el.hasAttribute('data-bf2-reviewissues')){
  const issues=todaysIssues();if(issues.length)goIssue(issues[0]);else api()?.notify?.('No automatic issues flagged. Review the checklist.');return;
 }
 if(el.hasAttribute('data-bf2-pdf')){api()?.exportDailyPdf?.(currentDay());return}
 if(el.hasAttribute('data-bf2-close')){api()?.openCloseoutForDay?.(currentDay());return}
 if(d.bf2Stage){stageFilter=d.bf2Stage;api()?.render?.();return}
 if(d.bf2Shot){api()?.shotDetail?.(d.bf2Shot);return}
 if(d.bf2Photoissue){
  if(d.bf2Photoissue==='unlinked'){selectedShot='unlinked';showSuggestions=true;api()?.render?.()}
  else{selectedShot=d.bf2Photoissue;showSuggestions=true;api()?.render?.()}
  return;
 }
 if(el.hasAttribute('data-bf2-suggest')){showSuggestions=!showSuggestions;api()?.render?.();return}
 if(d.bf2Savephoto){saveReviewedPhoto(d.bf2Savephoto);return}
 if(el.hasAttribute('data-bf2-addphotos')){api()?.photoChoose?.('camera');return}
 if(el.hasAttribute('data-bf2-reviewmissing')){
  const flagged=flaggedPhotos();if(!flagged.length)return api()?.notify?.('No missing photo checks flagged.');
  const item=flagged[0];if(item.shot){selectedShot=item.shot.id;api()?.render?.();}
  else{selectedShot='unlinked';showSuggestions=true;api()?.render?.()}
 }
}
async function saveReviewedPhoto(id){
 if(saving)return;
 const rec=allPhotos().find(p=>p.id===id),change=pending(id);
 if(!rec||(!('shotId'in change)&&!('stage'in change)))return;
 const selected=change.shotId??rec.shotId??'',stage=change.stage??stageOf(rec);
 if(selected&&!shots().some(s=>s.id===selected))return api()?.notify?.('Choose a valid bore from this job.');
 if(!['unclassified',...stages].includes(stage))return api()?.notify?.('Choose a valid photo stage.');
 if(!window.confirm?.('Save this photo’s reviewed shot and stage? The original picture will not be changed.'))return;
 saving=true;
 try{
  const modified={...rec,shotId:selected,stage:stage==='unclassified'?'':stage};
  await api().photoDB('put',modified);
  await api().refreshPhotos();
  delete pendingChanges[id];
  api().render();
  api().notify?.('Photo details saved. Original image preserved.');
 }catch(e){api()?.notify?.('Photo update failed: '+(e?.message||String(e)))}finally{saving=false}
}
document.addEventListener('click',clickHandler);
document.addEventListener('change',e=>{
 const el=e.target,d=el.dataset||{};
 if(el.hasAttribute?.('data-bf2-day')){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(el.value))return;
  selectedDay=el.value;api()?.render?.();return;
 }
 if(d.bf2Review){setReview(d.bf2Review,el.checked);return}
 if(el.hasAttribute?.('data-bf2-shotfilter')){selectedShot=el.value;api()?.render?.();return}
 if(d.bf2PhotoShot){pendingChanges[d.bf2PhotoShot]={...pending(d.bf2PhotoShot),shotId:el.value};el.closest?.('.bf2-suggest-row')?.querySelector?.('[data-bf2-savephoto]')?.removeAttribute?.('disabled');return}
 if(d.bf2PhotoStage){pendingChanges[d.bf2PhotoStage]={...pending(d.bf2PhotoStage),stage:el.value};el.closest?.('.bf2-suggest-row')?.querySelector?.('[data-bf2-savephoto]')?.removeAttribute?.('disabled');return}
});
window.BoreLabCloseoutPhotoV2={renderEndDay,renderPhotoTimeline,summary,todaysIssues,reviewAlerts,flaggedPhotos,timelineStats,stageOf,
 getPending:()=>({...pendingChanges}),resetUI:()=>{selectedDay='';stageFilter='all';selectedShot='all';expandedDate='';showSuggestions=false;pendingChanges={};}};
})();
