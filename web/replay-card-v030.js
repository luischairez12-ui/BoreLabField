/* BoreLab Field v0.30 — date-scoped Daily Replay card.
   Reuses existing saved field events; no new persistent records or telemetry. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge,ab=()=>window.BoreLabAsBuilt,insights=()=>window.BoreLabInsights;
const $=q=>document.querySelector(q);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const label=day=>new Date(day+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const time=m=>(Math.floor(m/60)%12||12)+':'+pad(m%60)+(Math.floor(m/60)%24>=12?' PM':' AM');
const symbol=t=>({shot:'⌁',pin:'⌖',photo:'▣',crew:'♙',pipe:'◈',mud:'◉',journal:'✎',note:'✎',closeout:'✓',marker:'⚠'}[t]||'•');
let day='',minute=1080,playing=false,timer=null;
function eventsFor(d){
 return (ab()?.allEvents?.()||[]).filter(e=>e.day===d).sort((a,b)=>{
  const x=insights()?.recordedMinute?.(a),y=insights()?.recordedMinute?.(b);
  return (x===null?99999:x)-(y===null?99999:y);
 });
}
function bounds(d){
 const times=eventsFor(d).map(e=>insights()?.recordedMinute?.(e)).filter(n=>Number.isFinite(n));
 return {min:Math.min(420,...times),max:Math.max(1080,...times),count:times.length};
}
function items(d){
 const list=eventsFor(d),timed=list.filter(e=>insights()?.recordedMinute?.(e)!==null&&insights().recordedMinute(e)<=minute);
 const dateOnly=list.filter(e=>insights()?.recordedMinute?.(e)===null);
 return '<div class="bi-replay-summary"><span>'+timed.length+' timed activities</span><span>'+dateOnly.length+' without exact time</span></div>'+
 (timed.length?'<ol class="bi-replay-list">'+timed.map(e=>'<li><time>'+time(insights().recordedMinute(e))+'</time><b class="bi-event-icon">'+symbol(e.type)+'</b><div><strong>'+esc(e.title)+'</strong><small>'+esc(e.jobName)+' · '+esc(e.extra||'Recorded field event')+'</small></div></li>').join('')+'</ol>':
 '<p class="bi-empty">No timed events at this point. Move the slider or tap Play.</p>')+
 (dateOnly.length?'<details class="bi-untimed"><summary>'+dateOnly.length+' date-only / unverified-time entries</summary>'+
 dateOnly.map(e=>'<p><strong>'+symbol(e.type)+' '+esc(e.title)+'</strong><small>'+esc(e.jobName)+' · '+esc(e.extra||'Exact time unavailable')+'</small></p>').join('')+
 '<p class="tiny muted">BoreLab does not invent timestamps for date-only records.</p></details>':'');
}
function pauseCard(){
 playing=false;
 if(timer!==null){clearInterval(timer);timer=null}
 const el=$('[data-bi-card-play]');if(el){el.textContent='▶ Play Day';el.setAttribute('aria-pressed','false')}
}
function renderReplayCard(d){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d)))return '';
 if(d!==day){pauseCard();day=d;minute=bounds(d).max}
 const b=bounds(d),count=eventsFor(d).length;
 return '<section class="bi-inline-replay" data-bi-replay-card="'+esc(d)+'" aria-label="Daily Replay for '+esc(label(d))+'">'+
 '<div class="bi-inline-head"><div><span class="eyebrow">THIS WORKDAY</span><h3>▶ Daily Replay</h3><small>'+esc(label(d))+' · '+count+' saved activities</small></div><span class="bi-inline-status">Offline</span></div>'+
 '<p class="bi-inline-description">Revisit recorded events in order. This is not rig telemetry, a surveyed bore path or a recorded drive.</p>'+
 (count?'<div class="bi-inline-controls"><div class="bi-replay-clock"><strong>Replay time</strong><output data-bi-card-clock>'+esc(time(minute))+'</output></div>'+
 '<div class="bi-replay-buttons"><button type="button" data-bi-card-play aria-pressed="'+playing+'" '+(!b.count?'disabled':'')+'>'+(playing?'Ⅱ Pause':'▶ Play Day')+'</button><button type="button" data-bi-card-start '+(!b.count?'disabled':'')+'>↺ Restart</button></div>'+
 '<label class="bi-slider-label" for="biCardTimeSlider">Time of day</label><input id="biCardTimeSlider" data-bi-card-time type="range" min="'+b.min+'" max="'+b.max+'" step="5" value="'+minute+'" '+(!b.count?'disabled':'')+' aria-valuetext="'+esc(time(minute))+'">'+
 '<div class="bi-slider-ends"><span>'+esc(time(b.min))+'</span><span>'+esc(time(b.max))+'</span></div></div>'+
 '<div data-bi-card-events aria-live="polite">'+items(d)+'</div>':
 '<p class="bi-empty">No recorded activity on this date.</p>')+'</section>';
}
function refresh(){
 const root=$('[data-bi-replay-card]');if(!root||root.getAttribute('data-bi-replay-card')!==day)return;
 const clock=root.querySelector?.('[data-bi-card-clock]'),slider=root.querySelector?.('[data-bi-card-time]'),list=root.querySelector?.('[data-bi-card-events]');
 if(clock)clock.textContent=time(minute);
 if(slider){slider.value=String(minute);slider.setAttribute('aria-valuetext',time(minute))}
 if(list)list.innerHTML=items(day);
}
function seekCard(value){
 pauseCard();
 const b=bounds(day),n=Number(value);
 minute=Math.max(b.min,Math.min(b.max,Number.isFinite(n)?n:b.min));
 refresh();
}
function playCard(){
 if(playing){pauseCard();return}
 if(!day||api()?.currentPage?.()!=='fieldhistory'||!$('[data-bi-replay-card]'))return;
 const b=bounds(day);if(!b.count)return;
 if(minute>=b.max)minute=b.min;
 playing=true;refresh();
 const btn=$('[data-bi-card-play]');if(btn){btn.textContent='Ⅱ Pause';btn.setAttribute('aria-pressed','true')}
 timer=setInterval(()=>{
  if(document.hidden||api()?.currentPage?.()!=='fieldhistory'||!$('[data-bi-replay-card]')){pauseCard();return}
  minute=Math.min(b.max,minute+10);refresh();
  if(minute>=b.max)pauseCard();
 },220);
}
document.addEventListener('click',e=>{
 const target=e.target.closest?.('[data-bi-card-play],[data-bi-card-start]');
 if(!target)return;
 e.preventDefault();
 if(target.hasAttribute('data-bi-card-play'))playCard();
 else seekCard(bounds(day).min);
});
document.addEventListener('input',e=>{if(e.target.matches?.('[data-bi-card-time]'))seekCard(e.target.value)});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseCard()});
if(insights())Object.assign(insights(),{renderReplayCard,pauseCard,seekCard,playCard});
window.BoreLabReplayCardV30={renderReplayCard,pauseCard,seekCard,playCard,eventsFor,bounds};
})();