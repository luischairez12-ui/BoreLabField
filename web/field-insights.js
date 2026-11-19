/* BoreLab Field · Replay and Production Insights 0.21. Records only; not rig telemetry. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const ab=()=>window.BoreLabAsBuilt;
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pad=value=>String(value).padStart(2,'0');
const dayOf=value=>ab()?.dayOf?.(value)||'';
const scopeEvents=()=>ab()?.allEvents?.()||[];
const dayEvents=day=>scopeEvents().filter(event=>event.day===day);
const dayLabel=day=>new Date(day+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const timeLabel=value=>{const hr=Math.floor(value/60)%24;return (hr%12||12)+':'+pad(value%60)+(hr>=12?' PM':' AM')};
const recordKey=event=>String(event.jobId)+'|'+String(event.record?.id||event.when||event.title);
const valid=record=>!!ab()?.valid?.(record);
let minute=420,timer=null,playing=false,compareDate='';
function recordedMinute(event){
 if(!event||!String(event.when||'').includes('T'))return null;
 if(event.type==='pin'&&!event.record?.occurredAt)return null;
 if(dayOf(event.when)!==event.day)return null;
 const date=new Date(event.when);
 return Number.isNaN(+date)?null:date.getHours()*60+date.getMinutes();
}
function replayEvents(){
 return (ab()?.eventsOn?.(ab()?.getDay?.())||[]).slice().sort((a,b)=>{
  const aTime=recordedMinute(a),bTime=recordedMinute(b);
  return (aTime===null?99999:aTime)-(bTime===null?99999:bTime);
 });
}
function timeBounds(){
 const times=replayEvents().map(recordedMinute).filter(value=>value!==null);
 return {start:Math.min(420,...times),end:Math.max(1080,...times)};
}
function visibleReplayEvents(){
 const day=ab()?.getDay?.();
 return (ab()?.atlasEvents?.()||[]).filter(event=>event.day===day&&recordedMinute(event)!==null&&recordedMinute(event)<=minute);
}
function replayMapPoints(){
 const day=ab()?.getDay?.();
 return (ab()?.atlasEvents?.()||[]).filter(event=>event.day===day&&valid(event.record)).map(event=>({lat:Number(event.record.lat),lon:Number(event.record.lon)}));
}
const iconFor=type=>({shot:'⌁',pin:'⌖',photo:'▣',crew:'♙',pipe:'◈',mud:'◉',journal:'✎',note:'✎',closeout:'✓'}[type]||'•');
function replayList(){
 const events=replayEvents();
 const reached=events.filter(event=>recordedMinute(event)!==null&&recordedMinute(event)<=minute);
 const untimed=events.filter(event=>recordedMinute(event)===null);
 let html='<div class="bi-replay-summary"><span>'+reached.length+' timed events</span><span>'+untimed.length+' with no exact event time</span></div>';
 if(!reached.length)html+='<p class="bi-empty">Move the slider or tap Play to reveal recorded activity.</p>';
 else html+='<ol class="bi-replay-list">'+reached.map(event=>
 '<li><time>'+esc(timeLabel(recordedMinute(event)))+'</time><b class="bi-event-icon">'+iconFor(event.type)+'</b><div><strong>'+esc(event.title)+'</strong><small>'+esc(event.jobName)+' · '+esc(event.extra||'Saved event')+(valid(event.record)?' · GPS saved':'')+'</small></div></li>'
 ).join('')+'</ol>';
 if(untimed.length)html+='<details class="bi-untimed"><summary>'+untimed.length+' date-only or unverified-time records</summary>'+
 untimed.map(event=>'<p><strong>'+iconFor(event.type)+' '+esc(event.title)+'</strong><small>'+esc(event.jobName)+' · '+esc(event.extra||'Time not recorded')+'</small></p>').join('')+
 '<p class="tiny muted">Date-only locations remain on the standard Atlas, but are not given a fictional replay time.</p></details>';
 return html;
}
function renderReplay(){
 const day=ab()?.getDay?.()||dayOf(new Date()),bounds=timeBounds(),events=replayEvents();
 minute=Math.max(bounds.start,Math.min(bounds.end,minute));
 return '<section class="bi-replay" aria-label="Daily Replay"><div class="bi-head"><div><span class="eyebrow">MAP TIME MACHINE</span><h2>Daily Replay</h2></div><span class="bi-pill">Offline timeline</span></div>'+
 '<p class="smalltext muted">Follow saved timestamps through a workday. This is not live drilling telemetry or a recorded travel route.</p>'+
 '<div class="bi-replay-clock"><strong>'+esc(dayLabel(day))+'</strong><output data-bi-clock>'+esc(timeLabel(minute))+'</output></div>'+
 '<div class="bi-replay-buttons"><button type="button" data-bi-play aria-pressed="'+playing+'">'+(playing?'Ⅱ Pause':'▶ Play')+'</button><button type="button" data-bi-start>↺ Start</button><span data-bi-located>'+visibleReplayEvents().filter(event=>valid(event.record)).length+' located events</span></div>'+
 '<label class="bi-slider-label" for="biTimeSlider">Replay time</label><input id="biTimeSlider" type="range" min="'+bounds.start+'" max="'+bounds.end+'" step="5" value="'+minute+'" data-bi-time aria-valuetext="'+esc(timeLabel(minute))+'">'+
 '<div class="bi-slider-ends"><span>'+esc(timeLabel(bounds.start))+'</span><span>'+esc(timeLabel(bounds.end))+'</span></div>'+
 '<div class="bi-map">'+(window.BoreLabAtlas?.renderAtlas?.()||'<p class="bi-empty">Map unavailable</p>')+'</div>'+
 '<p class="tiny muted">Pins appear once a real event time is reached. Records with a work date but no exact time stay listed separately.</p>'+
 '<div data-bi-replay-events>'+replayList()+'</div></section>';
}
function refreshReplay(){
 const clock=$('[data-bi-clock]'),slider=$('[data-bi-time]'),list=$('[data-bi-replay-events]'),count=$('[data-bi-located]');
 if(clock)clock.textContent=timeLabel(minute);
 if(slider){slider.value=String(minute);slider.setAttribute('aria-valuetext',timeLabel(minute))}
 if(list)list.innerHTML=replayList();
 if(count)count.textContent=visibleReplayEvents().filter(event=>valid(event.record)).length+' located events';
 window.BoreLabAtlas?.draw?.();
 const label=$('.bi-map .atlas-toolbar small');
 if(label)label.textContent=(window.BoreLabAtlas?.points?.()||[]).length+' points reached · '+timeLabel(minute);
}
function pause(){
 playing=false;
 if(timer!==null){clearInterval(timer);timer=null}
 const btn=$('[data-bi-play]');if(btn){btn.textContent='▶ Play';btn.setAttribute('aria-pressed','false')}
}
function seek(value){
 pause();
 const bounds=timeBounds(),candidate=Number(value);
 minute=Math.max(bounds.start,Math.min(bounds.end,Number.isFinite(candidate)?candidate:bounds.start));
 refreshReplay();
}
function start(){seek(timeBounds().start)}
function play(){
 if(playing){pause();return}
 if(ab()?.getView?.()!=='replay')return;
 const bounds=timeBounds();
 if(minute>=bounds.end)minute=bounds.start;
 playing=true;
 const btn=$('[data-bi-play]');if(btn){btn.textContent='Ⅱ Pause';btn.setAttribute('aria-pressed','true')}
 timer=setInterval(()=>{
  if(document.hidden||ab()?.getView?.()!=='replay'||api()?.currentPage?.()!=='fieldhistory'){pause();return}
  minute=Math.min(bounds.end,minute+10);refreshReplay();
  if(minute>=bounds.end)pause();
 },220);
}
function evidenceIssues(day){
 const events=dayEvents(day),photos=api()?.photos?.()||[],state=api()?.state?.()||[],issues=[];
 if(!events.length)return issues;
 const unique=type=>{
  const seen=new Set();
  return events.filter(event=>{
   const key=recordKey(event);
   if(event.type!==type||seen.has(key))return false;
   seen.add(key);return true;
  });
 };
 const completed=unique('shot').filter(event=>events.some(other=>other.type==='shot'&&other.extra==='Bore completed'&&recordKey(other)===recordKey(event)));
 for(const event of completed){
  const shot=event.record||{};
  const attached=photos.filter(photo=>(photo.jobId||state.legacyJobId||state.activeJobId)===event.jobId&&photo.shotId===shot.id);
  if(!attached.some(photo=>photo.stage==='after'))issues.push({day,label:(shot.name||'Bore')+' · missing After photo',type:'after'});
  if(!valid(shot)&&!valid(shot.asbuiltStart)&&!valid(shot.asbuiltEnd))issues.push({day,label:(shot.name||'Bore')+' · GPS missing',type:'gps'});
 }
 for(const event of unique('pin'))if(!valid(event.record))issues.push({day,label:(event.record?.name||'Installation')+' · missing GPS',type:'pin'});
 for(const event of unique('photo')){
  const photo=event.record||{};
  if(!valid(photo))issues.push({day,label:'Jobsite photo · GPS missing',type:'photo'});
  if(!photo.shotId&&!photo.fieldPinId)issues.push({day,label:'Jobsite photo · not linked to a bore or pin',type:'unlinked'});
 }
 return issues;
}
const dayHasMissing=day=>evidenceIssues(day).length>0;
function metric(day){
 const events=dayEvents(day),once=events=>{
  const keys=new Set();
  return events.filter(event=>{const key=recordKey(event);if(keys.has(key))return false;keys.add(key);return true});
 };
 const done=once(events.filter(event=>event.type==='shot'&&event.extra==='Bore completed'));
 return {day,bores:done.length,footage:done.reduce((n,event)=>n+Math.max(0,Number(event.record?.feet)||0),0),
  pins:once(events.filter(event=>event.type==='pin')).length,
  photos:once(events.filter(event=>event.type==='photo')).length,
  crew:once(events.filter(event=>event.type==='crew'&&event.extra==='Clocked in')).length,
  gps:once(events.filter(event=>valid(event.record))).length,
  events:events.length,missing:evidenceIssues(day).length};
}
function monthReport(month){
 const days=[...new Set(scopeEvents().filter(event=>event.day.slice(0,7)===month).map(event=>event.day))].sort();
 const perDay=days.map(metric),totals={bores:0,footage:0,pins:0,photos:0,crew:0,gps:0,events:0,missing:0};
 for(const day of perDay)for(const key of Object.keys(totals))totals[key]+=day[key];
 return {month,days,perDay,totals};
}
function chosenCompareDay(){
 const today=ab()?.getDay?.()||dayOf(new Date());
 if(compareDate&&compareDate!==today)return compareDate;
 const dates=[...new Set(scopeEvents().map(event=>event.day))].sort().filter(day=>day!==today);
 return dates.filter(day=>day<today).pop()||dates[0]||'';
}
const rows=[['bores','Bores completed'],['footage','Completed footage (ft)'],['pins','Installations'],['photos','Jobsite photos'],['crew','Crew check-ins'],['gps','Located records'],['missing','Evidence flags']];
function compareHTML(){
 const chosen=ab()?.getDay?.()||dayOf(new Date()),other=chosenCompareDay(),a=metric(chosen),b=other?metric(other):null;
 return '<section class="bi-panel"><div class="bi-panel-head"><h3>Compare Days</h3><span class="bi-pill">Recorded totals</span></div>'+
 '<p class="tiny muted">Bores count on their logged completion date. Compare records; do not treat these as machine measurements.</p>'+
 '<div class="bi-compare-controls"><strong>'+esc(dayLabel(chosen))+'</strong><label>Compare to<input type="date" data-bi-compare value="'+esc(other)+'"></label></div>'+
 (b?'<div class="bi-compare-grid"><div class="bi-compare-head"><span>Metric</span><b>'+esc(dayLabel(chosen))+'</b><b>'+esc(dayLabel(other))+'</b></div>'+
 rows.map(([key,label])=>'<div><span>'+label+'</span><strong>'+a[key].toLocaleString()+'</strong><strong>'+b[key].toLocaleString()+'</strong></div>').join('')+'</div>':
 '<p class="bi-empty">Another recorded workday is needed for a comparison.</p>')+'</section>';
}
function evidenceHTML(day){
 const flags=evidenceIssues(day);
 return '<section class="bi-inline-evidence"><div class="bi-panel-head"><strong>Evidence review</strong><span class="bi-pill">'+flags.length+' to check</span></div>'+
 (flags.length?flags.slice(0,12).map(item=>'<p>⚠ '+esc(item.label)+'</p>').join(''):'<p class="tiny muted">No missing evidence detected in saved records for this day.</p>')+
 '<p class="tiny muted">These checks are reminders only; verify actual field conditions yourself.</p></section>';
}
function renderMonthly(){
 const month=ab()?.getMonth?.()||String(ab()?.getDay?.()||dayOf(new Date())).slice(0,7);
 const report=monthReport(month),monthName=new Date(month+'-01T12:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'});
 const peak=Math.max(1,...report.perDay.map(day=>day.footage)),flagged=report.perDay.filter(day=>day.missing);
 const cards=[['Completed footage',report.totals.footage.toLocaleString()+' ft'],['Bores finished',report.totals.bores],['Installations',report.totals.pins],['Jobsite photos',report.totals.photos],['Workdays',report.days.length],['Crew check-ins',report.totals.crew]];
 return '<section class="bi-insights"><div class="bi-head"><div><span class="eyebrow">FIELD PRODUCTION</span><h2>Monthly Insights</h2></div><span class="bi-pill">Offline</span></div>'+
 '<div class="bi-month-switch"><button type="button" data-bi-month="-1" aria-label="Previous month">‹</button><strong>'+esc(monthName)+'</strong><button type="button" data-bi-month="1" aria-label="Next month">›</button></div>'+
 '<p class="tiny muted">Using '+(ab()?.getScope?.()==='all'?'all jobs, including archived':'the active job')+'. Search chips do not change monthly totals. Completed footage is counted once per recorded completion.</p>'+
 '<div class="bi-cards">'+cards.map(([name,value])=>'<div><small>'+name+'</small><strong>'+value+'</strong></div>').join('')+'</div>'+
 '<section class="bi-panel"><h3>Completed footage by workday</h3>'+
 (report.perDay.length?'<div class="bi-day-chart">'+report.perDay.map(day=>
 '<button type="button" data-bi-day="'+day.day+'" aria-label="'+esc(dayLabel(day.day)+': '+day.footage+' feet completed')+'">'+
 '<span>'+ (day.footage?day.footage.toLocaleString():'·')+'</span><i><em style="height:'+Math.max(3,Math.round(day.footage/peak*100))+'%"></em></i><small>'+Number(day.day.slice(-2))+'</small></button>').join('')+'</div>':
 '<p class="bi-empty">No dated work activity saved this month.</p>')+
 '<p class="tiny muted">Tap any workday to open its Calendar history. Zero footage can still include other field work.</p></section>'+
 compareHTML()+
 '<section class="bi-panel"><div class="bi-panel-head"><h3>Missing Evidence</h3><span class="bi-pill">'+flagged.length+' flagged day(s)</span></div>'+
 (flagged.length?'<div class="bi-evidence-days">'+flagged.map(day=>
 '<button type="button" data-bi-day="'+day.day+'"><span><strong>'+esc(dayLabel(day.day))+'</strong><small>'+day.events+' recorded entries</small></span><b>'+day.missing+' items ›</b></button>').join('')+'</div>':
 '<p class="bi-empty">No missing-evidence flags in this month’s saved work.</p>')+
 '<p class="tiny muted">Flags include missing GPS, missing After photos and unassigned photos. They are reminders, not a job certification.</p></section></section>';
}
document.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-bi-play],[data-bi-start],[data-bi-month],[data-bi-day]');
 if(!button)return;
 if(button.hasAttribute('data-bi-play')){play();return}
 if(button.hasAttribute('data-bi-start')){start();return}
 if(button.dataset.biMonth){
  const month=ab()?.getMonth?.()||String(ab()?.getDay?.()||dayOf(new Date())).slice(0,7);
  const [year,mon]=month.split('-').map(Number),date=new Date(year,mon-1+Number(button.dataset.biMonth),1);
  pause();ab()?.setMonth?.(date.getFullYear()+'-'+pad(date.getMonth()+1));api()?.render?.();return;
 }
 if(button.dataset.biDay){
  pause();ab()?.setDay?.(button.dataset.biDay);ab()?.setView?.('calendar');api()?.render?.();
 }
});
document.addEventListener('input',event=>{if(event.target.matches?.('[data-bi-time]'))seek(event.target.value)});
document.addEventListener('change',event=>{
 if(event.target.matches?.('[data-bi-compare]')){compareDate=/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)?event.target.value:'';api()?.render?.()}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
window.BoreLabInsights={renderReplay,renderMonthly,evidenceHTML,evidenceIssues,dayHasMissing,metric,monthReport,
 replayEvents,recordedMinute,timeBounds,visibleReplayEvents,replayMapPoints,refreshReplay,seek,play,pause,
 getMinute:()=>minute,compareDay:chosenCompareDay,setCompareDay:value=>{compareDate=value||''}};
})();