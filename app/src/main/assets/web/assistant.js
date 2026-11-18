/* Ask BoreLab — offline field dispatcher */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ft=s=>Math.max(0,Number(s.feet)||0);
const fmt=(v)=>Number(v||0).toLocaleString('en-US',{maximumFractionDigits:1});
let opened=false,lastAnswer=null,question='';
const root=document.createElement('section');
root.id='borelab-ask';root.hidden=true;document.body.appendChild(root);
const css=document.createElement('style');
css.textContent='#borelab-ask[hidden]{display:none!important}#borelab-ask{position:fixed;inset:0;z-index:9999;overflow:auto;background:var(--bg,#09141f);color:var(--text,#f4f8fb);padding:20px 14px 65px;font-family:system-ui,sans-serif}#borelab-ask .ba-wrap{max-width:700px;margin:0 auto}#borelab-ask .ba-statgrid,#borelab-ask .ba-questions,#borelab-ask .ba-mud{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}#borelab-ask .ba-card{background:var(--surface2,#162839);border:1px solid var(--line,#294258);border-radius:15px;padding:14px;margin:10px 0}#borelab-ask .ba-stat strong{display:block;font-size:25px;font-weight:900;margin:4px 0}#borelab-ask small,#borelab-ask .ba-muted{color:var(--muted,#95acbd);font-size:12px}#borelab-ask h1{font-size:25px;margin:10px 0}#borelab-ask h2{font-size:18px}#borelab-ask button{border:1px solid var(--line,#294258);border-radius:12px;padding:11px;color:var(--text,#f4f8fb);background:var(--surface3,#203448);font:inherit;cursor:pointer}#borelab-ask .ba-questions button{text-align:left;min-height:55px;font-size:13px;font-weight:750}#borelab-ask select,#borelab-ask input{width:100%;min-width:0;padding:12px;background:var(--surface,#111f2d);color:var(--text);border:1px solid var(--line);border-radius:10px}#borelab-ask label{font-size:13px;font-weight:750;display:block;margin-bottom:7px}#borelab-ask .ba-input{display:flex;gap:7px}#borelab-ask .ba-input input{flex:1}#borelab-ask .ba-result{border-left:3px solid var(--accent,#ff992c)}#borelab-ask .ba-result p{font-size:14px;line-height:1.5}#borelab-ask .ba-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}#borelab-ask .ba-actions button{font-size:12px}#borelab-ask .ba-mud strong{display:block}';
document.head.appendChild(css);
function jobs(){const s=api().state();return(s.jobs||[]).filter(j=>!j.archived)}
function remaining(){return jobs().flatMap(j=>(j.shots||[]).filter(x=>x.status!=='complete').map(x=>({job:j,shot:x,needed:ft(x)+Math.max(0,Number(j.allowance)||0)})))}
function pipes(){const list=remaining(),need=list.reduce((n,x)=>n+x.needed,0),have=api().pipeOnTruck();return{list,need,have,left:have-need}}
function mud(){const s=api().state(),t=api().mudConfig(),c=Number(t.capacity),g=Number(t.currentGallons);return{t,c,g,pct:String(t.capacity||'').trim()&&c>0?Math.round(g/c*100):null,products:(s.mudProducts||[]).filter(x=>!x.archived)}}
function hours(){
 const s=api().state(),me=(s.roster||[]).find(x=>x.id===s.askMyCrewId),now=Date.now(),d=new Date();d.setHours(0,0,0,0);const mon=new Date(d);mon.setDate(d.getDate()-(d.getDay()+6)%7);
 const entries=jobs().flatMap(j=>j.crew||[]).filter(e=>!me||e.memberId===me.id||(!e.memberId&&String(e.name||'').trim().toLowerCase()===String(me.name||'').trim().toLowerCase()));
 const duration=(e,from)=>{const a=new Date(e.start).getTime(),b=e.end?new Date(e.end).getTime():now;if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)return 0;const ms=Math.max(0,Math.min(now,b)-Math.max(a,from));return Math.max(0,ms/3600000-(e.end?Math.max(0,Number(e.lunch)||0)/60*ms/(b-a):0))};
 return{me,today:entries.reduce((n,e)=>n+duration(e,d.getTime()),0),week:entries.reduce((n,e)=>n+duration(e,mon.getTime()),0),on:entries.filter(e=>!e.end).length}
}
function hm(h){const m=Math.max(0,Math.round(h*60));return Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m'}
function btn(name,command,props){return'<button type="button" data-ba="'+command+'" '+(props||'')+'>'+html(name)+'</button>'}
function reply(title,lines,actions){lastAnswer={title,lines,actions:actions||''};render()}
function render(){
 if(!opened)return;
 const s=api().state(),p=pipes(),m=mud(),h=hours(),tracked=m.products.filter(x=>x.stockTracked===true);
 const choices=[['Do I have enough pipe?','◈ Pipe check'],['What needs attention?','⚠ Needs attention'],["What's on the agenda?",'▦ Agenda'],['Quick glance at mud inventory','◉ Mud inventory'],["What's the closest shot to me?",'⌖ Closest shot'],['End with the shortest shot','⌁ Shortest last'],['End with the shot closest to shop','⌂ Finish near shop'],['Show me the next job site','↗ Next job'],['Start from a job, longest to shortest','↘ Start job · longest first']];
 root.innerHTML='<div class="ba-wrap">'+btn('‹ Back','back')+'<small style="margin-left:12px">BORELAB FIELD / ASSISTANT</small><h1>Morning Briefing</h1><p class="ba-muted">Live answers from saved field records. Job and inventory commands work offline.</p>'+
 '<div class="ba-statgrid"><div class="ba-card ba-stat"><small>'+(h.me?'My':'Crew')+' hours today</small><strong>'+hm(h.today)+'</strong><small>'+h.on+' open shifts</small></div><div class="ba-card ba-stat"><small>'+(h.me?'My':'Crew')+' weekly hours</small><strong>'+hm(h.week)+'</strong><small>Monday to today</small></div><div class="ba-card ba-stat"><small>Unfinished shots</small><strong>'+p.list.length+'</strong><small>'+fmt(p.need)+' ft incl. allowances</small></div><div class="ba-card ba-stat"><small>Pipe on truck</small><strong>'+fmt(p.have)+' ft</strong><small>'+(p.left<0?fmt(-p.left)+' ft short':fmt(p.left)+' ft estimated surplus')+'</small></div></div>'+
 '<div class="ba-card"><label for="ba-me">Whose hours?</label><select id="ba-me"><option value="">Entire crew (person-hours)</option>'+(s.roster||[]).map(x=>'<option value="'+html(x.id)+'" '+(s.askMyCrewId===x.id?'selected':'')+'>'+html(x.name)+'</option>').join('')+'</select><p class="ba-muted">Open shifts show elapsed time before unpaid lunch is recorded.</p></div>'+
 '<div class="ba-card"><h2>Quick mud glance</h2><div class="ba-mud"><div><strong>'+(m.pct===null?'Level unknown':m.pct+'% full')+'</strong><small>'+(m.pct===null?'Configure tank in MixLab':fmt(m.g)+' / '+fmt(m.c)+' gal')+'</small></div><div><strong>'+tracked.length+' tracked products</strong><small>'+html(tracked.slice(0,2).map(x=>x.name+': '+fmt(api().mudAvailable(x))+' '+(x.unit||'')).join(' · ')||(m.products.length?'Stock levels untracked':'No products saved'))+'</small></div></div><p class="ba-muted">Mixture status: '+html(m.t.contentsStatus||'not recorded')+'</p>'+btn('Open MixLab','mud')+'</div>'+
 '<div class="ba-card"><label for="ba-next">Next job site</label><select id="ba-next"><option value="">No next job selected</option>'+jobs().filter(j=>j.id!==s.activeJobId).map(j=>'<option value="'+html(j.id)+'" '+(s.askNextJobId===j.id?'selected':'')+'>'+html(j.jobName)+'</option>').join('')+'</select><p class="ba-muted">Choose an actual next job so BoreLab never guesses your schedule.</p></div>'+
 '<h2>Ask BoreLab</h2><div class="ba-questions">'+choices.map(x=>'<button data-ask="'+html(x[0])+'">'+html(x[1])+'</button>').join('')+'</div>'+
 '<form id="ba-form"><label for="ba-q">Type or say your question</label><div class="ba-input"><input id="ba-q" maxlength="250" value="'+html(question)+'" placeholder="Ask about shots, pipe, mud…" required>'+btn('🎙','voice')+'<button type="submit">Ask</button></div></form>'+
 (lastAnswer?'<div class="ba-card ba-result" role="status" aria-live="polite"><small>BORELAB SAYS</small><h2>'+html(lastAnswer.title)+'</h2>'+lastAnswer.lines.map(x=>'<p>'+html(x)+'</p>').join('')+'<div class="ba-actions">'+lastAnswer.actions+'</div></div>':'<p class="ba-card ba-muted">Try “What is my best move right now?” or “Finish by the shop.”</p>')+
 '<p class="ba-muted">Distances are straight-line, not driving times. Verify 811 utility locates, access and job safety before drilling.</p></div>';
}
function show(){if(!api())return;opened=true;root.hidden=false;lastAnswer=null;render();document.body.style.overflow='hidden';root.scrollTop=0}
function close(){opened=false;root.hidden=true;root.textContent='';document.body.style.overflow=''}
async function ask(input){
 question=String(input||'').trim().slice(0,250);if(!question)return reply('Enter a question',['Type or speak your question.']);
 const q=question.toLowerCase(),s=api().state(),p=pipes(),m=mud(),h=hours();
 if(/(closest|nearest)/.test(q)&&/(shot|bore)/.test(q)&&!/(shop|yard)/.test(q)){
  reply('Checking GPS',['Requesting location with permission…']);
  try{const pos=await api().getPosition(),list=p.list.filter(x=>api().coordsValid(x.shot)).map(x=>({...x,d:api().hav(pos,x.shot)})).sort((a,b)=>a.d-b.d);
   if(!list.length)return reply('Location data needed',['No unfinished shots have GPS coordinates. Save GPS in Shot Planner.'],btn('Open Planner','planner'));
   return reply('Closest unfinished shots',list.slice(0,5).map(x=>x.shot.name+' · '+x.job.jobName+' · '+fmt(x.d)+' mi straight-line · '+ft(x.shot)+' ft'),list.slice(0,3).map(x=>btn('Navigate '+x.shot.name,'nav','data-job="'+html(x.job.id)+'" data-shot="'+html(x.shot.id)+'"')).join(''));
  }catch(e){return reply('GPS unavailable',[e.message||'Location permission not available. No position was guessed.'])}
 }
 if(/(end|finish|last)/.test(q)&&/(shortest|short shot)/.test(q)){
  s.routeMode=/(shop|yard)/.test(q)?'short_near':'short';api().save();const plan=api().orderedShots(),end=plan.order.at(-1);
  return reply('Shot Planner updated',[end?'Last on active job: '+end.name+' ('+ft(end)+' ft).':'No unfinished shots on active job.',plan.message],btn('Review order','planner'));
 }
 if(/(end|finish|last)/.test(q)&&/(shop|yard)/.test(q)){
  s.routeMode='toward';api().save();const plan=api().orderedShots(),end=plan.usable?plan.order.at(-1):null;
  return reply('Finish near shop',[end?'Suggested final shot: '+end.name:'Cannot confirm nearest final shot until shop and shot GPS are saved.',plan.message],btn('Open Planner','planner'));
 }
 if(/longest/.test(q)&&/(shortest|first|start|job)/.test(q)){
  const options=jobs();
  const matched=options.filter(j=>j.jobName&&q.includes(j.jobName.toLowerCase()));
  if(matched.length===1){s.longestStartJobId=matched[0].id;api().save();}
  else if(!options.some(j=>j.id===s.longestStartJobId)){s.longestStartJobId=s.activeJobId;api().save();}
  const start=options.find(j=>j.id===s.longestStartJobId)||options.find(j=>j.id===s.activeJobId);
  return reply('Start job · longest to shortest',[
   'First job: '+(start?.jobName||'Not selected')+'.',
   'Shots at that job are listed longest to shortest. Other saved jobs follow, prioritized by their longest unfinished bore.',
   matched.length===1?'Starting job selected from your command.':'You can change the starting job from the dropdown in Shot Planner.',
   'This is a work-order suggestion, not verified travel routing or utility clearance.'
  ],btn('Open multi-job plan','planner'));
 }
 if(/(next job|next site|next location)/.test(q)){
  const j=jobs().find(x=>x.id===s.askNextJobId);if(!j)return reply('Next job not selected',['Choose a next job site from the selector above.']);
  const shots=j.shots.filter(x=>x.status!=='complete');
  return reply('Next site: '+j.jobName,['Address: '+(j.jobAddress||'No saved address'),shots.length+' remaining shots, '+shots.reduce((n,x)=>n+ft(x),0)+' ft'],btn('Open job','job','data-job="'+html(j.id)+'"')+btn('Navigate','nav','data-job="'+html(j.id)+'"'));
 }
 if(/(pipe|reel|conduit)/.test(q)){
  const multi=window.BoreLabConduits?.inventory();
  if(multi&&(multi.lines.length||multi.missing)){
   const shortage=multi.lines.some(line=>line.available!=null&&line.available<line.required);
   const bySize=multi.lines.map(line=>line.size+': '+fmt(line.required)+' ft needed; '+(line.available==null?'matching reel inventory not recorded':fmt(line.available)+' ft on truck'+(line.available<line.required?' — SHORT '+fmt(line.required-line.available)+' ft':'')));
   if(multi.missing)bySize.push(multi.missing+' unfinished shot(s) lack size information.');
   if(multi.unknownReels)bySize.push(multi.unknownReels+' reels have no size recorded.');
   bySize.push('Reel totals do not confirm continuous available lengths or matching material specifications.');
   return reply(shortage?'Conduit shortage by size':'Conduit pipe check',bySize,btn('Open Shot Planner','planner')+btn('Pipe reels','pipe'));
  }
  return reply(p.left<0?'Pipe shortage':'Pipe availability',[fmt(p.have)+' ft on truck; '+fmt(p.need)+' ft estimated for '+p.list.length+' remaining shots across jobs, including allowances.',p.left<0?'Short '+fmt(-p.left)+' ft.':fmt(p.left)+' ft estimated surplus.','Record conduit sizes to check supply by diameter. Check each reel and reservations before pulling.'],btn('Pipe inventory','pipe')+btn('Planner','planner'));
 }
 if(/(mud|tank|mix|bentonite)/.test(q))return reply('Mud inventory',[m.pct===null?'Tank level not configured.':'Tank '+m.pct+'% full · '+fmt(m.g)+' / '+fmt(m.c)+' gallons','Mixture: '+(m.t.contentsStatus||'not recorded'),m.products.length?m.products.slice(0,5).map(x=>x.name+': '+(x.stockTracked?fmt(api().mudAvailable(x))+' '+x.unit:'stock not tracked')).join('; '):'No products saved.'],btn('MixLab','mud')+btn('Inventory','stock'));
 if(/(attention|issue|problem|warning)/.test(q)){
  const list=[];if(p.left<0)list.push('Pipe shortage: '+fmt(-p.left)+' ft.');
  const missing=p.list.filter(x=>!api().coordsValid(x.shot)).length;if(missing)list.push(missing+' shots lack GPS for proximity searches.');
  if(!api().coordsValid(api().shop()))list.push('Shop GPS missing for shop-based routing.');
  if(h.on)list.push(h.on+' open crew time entries.');if(m.pct===null)list.push('Mud tank level not set.');
  if(!list.length)list.push('No missing-data or inventory warnings detected.');
  list.push('811 locates and jobsite safety are not verified by the app.');
  return reply('Needs attention',list,btn('Open Planner','planner'));
 }
 if(/(hour|clock|shift|worked)/.test(q))return reply(h.me?'My recorded hours':'Crew person-hours',['Today: '+hm(h.today),'This week: '+hm(h.week),h.on+' active shift(s), before any unrecorded lunch.'],btn('Crew hours','crew'));
 if(/(agenda|today|schedule|best move|what.*(next|do))/.test(q)){
  const lines=[p.list.length+' unfinished shots across '+jobs().length+' jobs.'];
  jobs().forEach(j=>{const shots=j.shots.filter(x=>x.status!=='complete');if(shots.length)lines.push(j.jobName+': '+shots.slice(0,4).map(x=>x.name+' '+ft(x)+' ft').join(', '))});
  if(p.left<0)lines.push('Pipe inventory will not cover every unfinished shot.');
  return reply('Field agenda',lines,btn('My Jobs','jobs')+btn('Shot Planner','planner'));
 }
 return reply('Available commands',['Ask about pipe, your hours, mud, attention items, agenda, closest shot, shortest final shot, finishing near shop, or next job. This offline version uses predefined field commands, not general AI.']);
}
document.addEventListener('click',e=>{const banner=e.target.closest('.ux-home .ux-welcome');if(banner&&!e.target.closest('button,a,input,select'))show()});
root.addEventListener('click',e=>{
 const prompt=e.target.closest('[data-ask]');if(prompt){ask(prompt.dataset.ask);return}
 const b=e.target.closest('[data-ba]');if(!b)return;
 const act=b.dataset.ba;if(act==='back'){close();return}if(act==='voice'){voice();return}
 if(act==='nav'){const j=jobs().find(x=>x.id===b.dataset.job),shot=j?.shots.find(x=>x.id===b.dataset.shot),target=shot||{address:j?.jobAddress||''};if(!target.address&&!api().coordsValid(target))reply('Address missing',['Save an address or GPS for this job first.']);else api().openMapUrl(api().mapsPinUrl(target));return}
 if(act==='job'){const id=b.dataset.job;close();api().switchActiveJob(id);return}
 const routes={planner:'planner',pipe:'pipe',mud:'mud',stock:'mudstock',crew:'crew',jobs:'jobs'};if(routes[act]){close();api().setPage(routes[act])}
});
root.addEventListener('submit',e=>{if(e.target.id==='ba-form'){e.preventDefault();ask(root.querySelector('#ba-q').value)}});
root.addEventListener('input',e=>{if(e.target.id==='ba-q')question=e.target.value});
root.addEventListener('change',e=>{const s=api().state();if(e.target.id==='ba-me')s.askMyCrewId=e.target.value;else if(e.target.id==='ba-next')s.askNextJobId=e.target.value;else return;api().save();render()});
root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close()}});
function voice(){
 if(window.BoreLabNative?.startVoiceCommand){window.BoreLabNative.startVoiceCommand();return}
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Speech)return reply('Voice unavailable',['Type your question instead.']);
 try{const r=new Speech();r.lang='en-US';r.onresult=e=>ask(e.results[0][0].transcript);r.onerror=e=>reply('Voice unavailable',[e.error]);r.start()}catch(e){reply('Voice unavailable',['Type instead.'])}
}
window.borelabVoiceResult=words=>words?ask(words):reply('No speech recognized',['Try again or type your question.']);
const back=window.borelabHandleBack;
window.borelabHandleBack=()=>{if(opened){close();return true}return typeof back==='function'?back():false};
})();