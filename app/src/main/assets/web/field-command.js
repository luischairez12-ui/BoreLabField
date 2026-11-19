/* BoreLab Field - Command Center. Additive screens on saved job data. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge, state=()=>api()?.state()||{};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number(x||0).toLocaleString(undefined,{maximumFractionDigits:1});
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const localDay=x=>{const d=new Date(x);return !isNaN(+d)?d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'):''};
const day=()=>api()?.todayLocal?.()||localDay(Date.now());
const entries=()=>state().jobs?.filter(j=>!j.archived).flatMap(j=>(j.shots||[]).map(shot=>({job:j,shot})))||[];
const shots=()=>state().shots||[];
const current=()=>shots().find(s=>s.status==='progress')||shots().find(s=>s.status!=='complete')||null;
const coords=s=>api()?.coordsValid?.(s);
const photos=()=>api()?.photos?.()||[];
const shotPhotos=id=>photos().filter(p=>p.shotId===id&&(!p.jobId||p.jobId===state().activeJobId));
let expanded='',filter='all',photoFilter='all',weather=null,weatherStamp=0,weatherKey='',weatherBusy=false,weatherError='',lastTry=0;
const cacheKey='borelab-weather-v1';
try{const c=JSON.parse(localStorage.getItem(cacheKey)||'null');if(c?.data){weather=c.data;weatherStamp=c.at||0;weatherKey=c.key||''}}catch{}
function metric(label,value,subtitle=''){return '<div class="blc-metric"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong>'+(subtitle?'<small>'+esc(subtitle)+'</small>':'')+'</div>'}
function navlinks(){return '<div class="blc-linkgrid"><button data-page="command">◷ Live Workday</button><button data-page="shotcards">◎ Smart Shots</button><button data-page="reelplan">◈ Reel Planner</button><button data-page="photosmart">▣ Photo Organizer</button></div>'}
function homeLinks(){return '<section class="blc-home"><strong>FIELD COMMAND CENTER</strong>'+navlinks()+'</section>'}
function pill(s){return s.status==='complete'?'Complete':s.status==='progress'?'Drilling':'Pending'}
function shotCard(s){
 const open=expanded===s.id,len=Math.max(0,num(s.feet)),done=Math.max(0,Math.min(len,num(s.progressFeet))),pct=len?Math.round(done/len*100):0;
 const conduit=window.BoreLabConduits?.summary?.(s)||s.pipeDiameter||'Not recorded';
 return '<article class="blc-shot"><button class="blc-shot-title" data-blc-expand="'+esc(s.id)+'"><strong>◎ '+esc(s.name)+'</strong><span>'+pill(s)+' '+(open?'⌃':'⌄')+'</span></button>'+
 '<div class="blc-triple">'+metric('Footage',fmt(len)+' ft')+metric('Pipe baseline',fmt(len+num(state().allowance??10))+' ft')+metric('Conduit',conduit)+'</div>'+
 '<div class="blc-location">⌖ '+esc(s.address||'No location saved')+'<small>'+ (coords(s)?'✓ GPS saved':'Map location only')+' · '+shotPhotos(s.id).length+' photos</small></div>'+
 (open?'<div class="blc-detail"><div class="between"><span>Logged progress</span><strong>'+fmt(s.status==='complete'?len:done)+' / '+fmt(len)+' ft</strong></div><div class="blc-bar"><span style="width:'+(s.status==='complete'?100:pct)+'%"></span></div>'+
 '<p class="smalltext muted">'+esc(s.notes||'No notes yet. Open this shot to add details and readiness checks.')+'</p>'+
 (s.status!=='complete'?'<label class="field">Feet drilled (manual entry)<input type="number" min="0" max="'+len+'" step="0.1" inputmode="decimal" data-blc-feet="'+esc(s.id)+'" value="'+esc(s.progressFeet??'')+'"></label>':'')+'</div>':'')+
 '<div class="blc-buttons"><button data-blc-map="'+esc(s.id)+'">⌖ Navigate</button><button class="blc-primary" data-blc-open="'+esc(s.id)+'">Open</button><button data-blc-photo="'+esc(s.id)+'">▣ Photo</button></div></article>';
}
function renderShotCards(){
 const all=shots(),pending=all.filter(s=>s.status!=='complete');
 const visible=all.filter(s=>filter==='all'||s.status===filter);
 return '<div class="page blc-page"><div class="blc-heading"><span class="eyebrow">BORELAB / SMART SHOTS</span><h1>Every shot. One card.</h1><p>Footage, pipe, GPS, photos and drilling notes for your active job.</p></div>'+
 '<div class="blc-grid">'+metric('Pending',String(pending.length))+metric('Total planned',fmt(all.reduce((n,s)=>n+num(s.feet),0))+' ft')+'</div>'+
 '<div class="between"><h2>Smart Shot Cards</h2><select data-blc-shotfilter><option value="all">All shots</option><option value="planned"'+(filter==='planned'?' selected':'')+'>Pending</option><option value="progress"'+(filter==='progress'?' selected':'')+'>Drilling</option><option value="complete"'+(filter==='complete'?' selected':'')+'>Complete</option></select></div>'+
 (visible.length?visible.map(shotCard).join(''):'<div class="card">No shots in this group.</div>')+
 '<div class="blc-buttons"><button data-action="new-shot" class="blc-primary">+ Add Bore</button><button data-page="shotboard">All Jobs Board</button></div></div>';
}
function crew(){
 const a=(state().jobs||[]).flatMap(j=>(j.crew||[]).filter(c=>c.start&&!c.end));
 const uniq=new Map();a.forEach(c=>uniq.set(c.memberId||c.id||c.name,c));
 return [...uniq.values()];
}
function elapsed(c){const v=(Date.now()-new Date(c.start).getTime())/3600000-num(c.lunch);return Number.isFinite(v)?Math.max(0,v):0}
function reelPlan(){
 const s=state(),ids=window.BoreLabDailyReels?.activeIds?.(s,day())||[],all=(s.reels||[]).filter(r=>!r.archived&&r.location==='truck');
 const chosen=ids.length?all.filter(r=>ids.includes(r.id)):all;
 const pending=entries().filter(x=>x.shot.status!=='complete');
 const simulation=window.BoreLabWorkday?.simulateReels?.(s,day(),pending,chosen);
 return {chosen,ids,pending,simulation};
}
function estimate(){
 const plan=(api()?.orderedShots?.()?.order||shots()).filter(s=>s.status!=='complete');
 if(!plan.length)return null;
 const pref=state().finishBySettings||{},pace=Math.max(1,num(pref.pace)||70);
 const setup=Math.max(0,num(pref.setup??20)),move=Math.max(0,num(pref.move??15)),returnMin=Math.max(0,num(pref.returnMin??45)),buffer=Math.max(0,num(pref.buffer??20));
 const mins=plan.reduce((total,s,i)=>total+Math.max(0,num(s.feet)-num(s.progressFeet))*60/pace+setup+(i?move:0),0)+returnMin+buffer;
 return {finish:new Date(Date.now()+mins*60000).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),pace};
}
function weatherTarget(){
 const s=state(),ref=s.weatherReference;
 if(coords(ref))return {lat:Number(ref.lat),lon:Number(ref.lon),label:'Selected GPS'};
 const sh=current();
 if(coords(sh))return{lat:Number(sh.lat),lon:Number(sh.lon),label:'Active bore'};
 if(coords(api()?.shop?.()))return{lat:Number(api().shop().lat),lon:Number(api().shop().lon),label:'Shop'};
 return null;
}
function weatherLabel(code){
 const c=Number(code);
 if(c===0)return'Clear';if(c<=3)return'Partly cloudy';if(c===45||c===48)return'Fog';
 if(c>=51&&c<=67)return'Rain / drizzle';if(c>=71&&c<=77)return'Snow';
 if(c>=80&&c<=82)return'Showers';if(c>=95)return'Thunderstorms';
 return'Forecast';
}
function weatherPanel(){
 const target=weatherTarget(),key=target?target.lat.toFixed(3)+','+target.lon.toFixed(3):'';
 const match=key&&weatherKey===key,stale=Date.now()-weatherStamp>45*60000;
 let inner='';
 if(!target)inner='<p class="tiny muted">Add GPS to a bore or shop, or use your current GPS for site weather.</p><button data-blc-gps>Use Current GPS</button>';
 else if(weather&&match){
  const w=weather.current||{},p=weather.hourly?.precipitation_probability;
  inner='<div class="blc-four">'+metric('Temperature',Number.isFinite(+w.temperature_2m)?Math.round(+w.temperature_2m)+'°F':'—',weatherLabel(w.weather_code))+
   metric('Wind',Number.isFinite(+w.wind_speed_10m)?Math.round(+w.wind_speed_10m)+' mph':'—')+
   metric('Humidity',Number.isFinite(+w.relative_humidity_2m)?Math.round(+w.relative_humidity_2m)+'%':'—')+
   metric('Rain chance',Array.isArray(p)&&p.length?Math.round(+p[0])+'%':'—','Forecast hour')+'</div>'+
   '<p class="tiny muted">'+esc(target.label)+' · '+(stale?'Cached, not live':'Updated')+' '+new Date(weatherStamp).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+'</p>'+
   (Number(w.weather_code)>=95?'<p class="blc-alert">⚠ Storm conditions forecast. Check local weather alerts.</p>':'');
 }else inner='<p class="tiny muted">'+(weatherBusy?'Loading weather for '+esc(target.label)+'…':'Weather not loaded for '+esc(target.label)+'.')+'</p>';
 return '<section class="blc-panel blc-weather"><div class="between"><h3>☁ Weather / Conditions</h3><button data-blc-refresh '+(weatherBusy?'disabled':'')+'>↻ Refresh</button></div>'+inner+
 (weatherError?'<p class="blc-alert">'+esc(weatherError)+'</p>':'')+
 '<p class="tiny muted">Open-Meteo forecast, not a safety clearance. Check actual site conditions and alerts before drilling.</p></section>';
}
async function loadWeather(force=false){
 const target=weatherTarget();if(!target||weatherBusy)return;
 const key=target.lat.toFixed(3)+','+target.lon.toFixed(3);
 if(!force&&weather&&weatherKey===key&&Date.now()-weatherStamp<20*60000)return;
 if(!force&&Date.now()-lastTry<30000)return;
 weatherBusy=true;weatherError='';lastTry=Date.now();
 const repaint=()=>{const el=document.querySelector('.blc-weather');if(el)el.outerHTML=weatherPanel()};
 repaint();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const url='https://api.open-meteo.com/v1/forecast?latitude='+target.lat+'&longitude='+target.lon+
   '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&hourly=precipitation_probability&forecast_hours=3&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto';
  const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error('Server responded '+r.status);
  const data=await r.json();if(!data.current||!Number.isFinite(+data.current.temperature_2m))throw Error('No current conditions returned');
  weather=data;weatherStamp=Date.now();weatherKey=key;
  try{localStorage.setItem(cacheKey,JSON.stringify({data,at:weatherStamp,key}))}catch{}
 }catch(e){weatherError='Weather unavailable ('+(e.name==='AbortError'?'timed out':String(e.message||'offline'))+').';}
 finally{clearTimeout(timer);weatherBusy=false;repaint()}
}
function renderCommand(){
 const s=state(),sh=current(),people=crew(),p=reelPlan(),target=estimate(),order=(api()?.orderedShots?.()?.order||shots()).filter(x=>x.status!=='complete');
 const length=num(sh?.feet),done=Math.min(length,num(sh?.progressFeet)),percent=length?Math.round(done/length*100):0;
 const feet=(s.reels||[]).filter(r=>!r.archived&&r.location==='truck').reduce((n,r)=>n+num(r.remaining),0);
 const doneToday=entries().filter(x=>x.shot.status==='complete'&&localDay(x.shot.completedAt)===day()).length;
 Promise.resolve().then(()=>loadWeather()).catch(()=>{});
 return '<div class="page blc-page"><div class="blc-heading"><span class="eyebrow">BORELAB / FOREMAN VIEW</span><h1>Live Workday Dashboard</h1><p>'+esc(s.jobName||'Active job')+' · '+new Date().toLocaleDateString()+'</p></div>'+
 (sh?'<section class="blc-panel blc-active"><div class="between"><h2>◎ '+esc(sh.name)+'</h2><strong>'+pill(sh)+'</strong></div>'+
 '<small>Manually logged footage (not a machine sensor)</small><div class="between"><span>Drilling progress</span><strong>'+fmt(done)+' / '+fmt(length)+' ft · '+percent+'%</strong></div>'+
 '<div class="blc-bar"><span style="width:'+percent+'%"></span></div>'+
 '<div class="blc-grid">'+metric('Rod count',sh.rodCount||'—')+metric('Logged depth',sh.currentDepth!==undefined&&sh.currentDepth!==''?fmt(sh.currentDepth)+' ft':'—')+'</div>'+
 '<div class="blc-buttons"><button class="blc-primary" data-blc-open="'+esc(sh.id)+'">Open Active Shot</button><button data-page="shotcards">Log Progress</button></div></section>':
 '<section class="blc-panel"><h3>No active bore</h3><button data-action="new-shot">Add Bore</button></section>')+
 '<h2>Today at a Glance</h2><div class="blc-four">'+metric('Pending',String(entries().filter(x=>x.shot.status!=='complete').length))+
 metric('Complete today',String(doneToday))+metric('Crew checked in',String(people.length))+metric('Pipe on truck',fmt(feet)+' ft')+'</div>'+
 '<div class="blc-grid">'+metric('Estimated finish',target?.finish||'—',target?'At '+fmt(target.pace)+' ft/hr':'No pending bores')+
 '<div class="blc-metric"><small>Target departure</small><input type="time" data-blc-time value="'+esc(s.finishBySettings?.target||'16:00')+'"><small>Tap to change</small></div></div>'+
 '<section class="blc-panel"><div class="between"><h3>⌖ Next 3 Shots</h3><button data-page="planner">Route ›</button></div>'+
 (order.slice(0,3).map((x,i)=>'<div class="blc-row"><strong>'+(i+1)+'. '+esc(x.name)+'</strong><span>'+fmt(x.feet)+' ft</span></div>').join('')||'<p class="tiny muted">No pending bores.</p>')+'</section>'+
 '<section class="blc-panel"><div class="between"><h3>♙ Crew Status</h3><button data-page="crew">Crew Time ›</button></div>'+
 (people.length?people.slice(0,6).map(c=>'<div class="blc-row"><strong>✓ '+esc(c.name)+'</strong><span>'+fmt(elapsed(c))+' hr</span></div>').join(''):'<p class="tiny muted">No crew members checked in.</p>')+'</section>'+
 '<section class="blc-panel"><div class="between"><h3>◈ Reel / Pipe Summary</h3><button data-page="reelplan">Full Plan ›</button></div>'+
 '<div class="blc-grid">'+metric('Loadout',fmt(p.chosen.reduce((n,r)=>n+num(r.remaining),0))+' ft',p.ids.length?'Selected reels':'All on-truck reels')+
 metric('Shortages',String(p.simulation?.shortages?.length||0),'Continuous runs')+'</div>'+
 (p.simulation?.shortages?.length?'<p class="blc-alert">⚠ Some planned conduit runs do not fit the current reels.</p>':'')+'</section>'+
 weatherPanel()+
 '<section class="blc-panel"><div class="between"><h3>▣ Photo & Note Reminders</h3><button data-page="photosmart">Photos ›</button></div><p class="tiny muted">Review missing Before/During/After photos before closing your workday.</p></section>'+
 '<div class="blc-buttons"><button data-page="crew">Crew Time</button><button data-page="photosmart">Add Photos</button><button class="blc-primary" data-action="open-closeout">Close Out Day</button></div></div>';
}
function renderReelPlan(){
 const p=reelPlan(),r=p.simulation;
 return '<div class="page blc-page"><div class="blc-heading"><span class="eyebrow">BORELAB / MATERIALS</span><h1>Intelligent Reel Manager</h1><p>Plan each continuous conduit run using real reel footage and pipe size.</p></div>'+
 (window.BoreLabDailyReels?.renderSection?.()||'')+
 '<section class="blc-panel"><h3>Material fit simulation</h3><small>What-if only: nothing is deducted or reserved by this preview.</small>'+
 (r?'<div class="blc-grid">'+metric('Runs fitted',String(r.allocations.length))+metric('Runs short',String(r.shortages.length))+'</div>'+
 r.reels.map(x=>'<div class="blc-row"><strong>'+esc(x.name||'Reel')+' · '+esc(x.size||'Size unknown')+'</strong><span>'+fmt(x.remaining)+' / '+fmt(x.available)+' ft</span></div>').join('')+
 r.shortages.slice(0,15).map(x=>'<div class="blc-row blc-alert"><strong>⚠ '+esc(x.shot.name)+' · '+esc(x.size)+'</strong><span>'+fmt(x.required)+' ft continuous</span></div>').join('')+
 (r.untracked.length?'<p class="blc-alert">'+r.untracked.length+' bores missing conduit specs.</p>':''):
 '<p class="tiny muted">Optimizer unavailable.</p>')+
 '<p class="tiny muted">Never combine two cut lengths as one continuous pull. Verify size, reservations and reel condition in the field.</p></section>'+
 '<button class="btn primary" data-page="pipe">Manage Reels</button></div>';
}
const categories=['all','before','during','after','equipment','damage','general'];
const category=p=>categories.includes(p.category)?p.category:categories.includes(p.stage)?p.stage:'general';
function renderPhotoOrganizer(){
 const all=photos().filter(p=>!p.jobId||p.jobId===state().activeJobId);
 const visible=all.filter(p=>photoFilter==='all'||category(p)===photoFilter);
 const missing=shots().filter(s=>s.status==='complete'&&!all.some(p=>p.shotId===s.id&&p.stage==='after'));
 return '<div class="page blc-page"><div class="blc-heading"><span class="eyebrow">BORELAB / MEDIA</span><h1>Smart Photo Organization</h1><p>Sort photos by job, shot and field category without altering originals.</p></div>'+
 '<div class="blc-grid">'+metric('Photos',String(all.length))+metric('Completed bores missing After',String(missing.length))+'</div>'+
 (missing.length?'<p class="blc-alert">⚠ After photo missing for '+esc(missing.slice(0,5).map(s=>s.name).join(', '))+'</p>':'')+
 '<div class="blc-buttons"><button class="blc-primary" data-action="choose-photo">▣ Camera</button><button data-action="choose-gallery">Add Gallery</button></div>'+
 '<label class="field">Category<select data-blc-photofilter>'+categories.map(c=>'<option value="'+c+'"'+(c===photoFilter?' selected':'')+'>'+esc(c==='all'?'All photos':c)+'</option>').join('')+'</select></label>'+
 '<div class="blc-photos">'+visible.map(p=>'<article><img src="'+esc(p.dataUrl)+'" loading="lazy" alt="Jobsite photo"><strong>'+esc(shots().find(s=>s.id===p.shotId)?.name||'General photo')+'</strong>'+
 '<small>'+esc(new Date(p.addedAt).toLocaleDateString())+'</small><label class="field">Group<select data-blc-tag="'+esc(p.id)+'">'+categories.slice(1).map(c=>'<option value="'+c+'"'+(c===category(p)?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select></label></article>').join('')+'</div>'+
 (visible.length?'':'<div class="card">No photos in this category.</div>')+
 '<p class="tiny muted">Photo grouping is editable. Timeline Before/During/After stages remain on the original shot log.</p></div>';
}
function renderRecovery(){
 const s=state();
 return '<div class="page blc-page"><div class="blc-heading"><span class="eyebrow">BORELAB / DATA</span><h1>Backup & Recovery</h1><p>Protect field data stored on this phone.</p></div>'+
 '<div class="blc-grid">'+metric('Jobs',String(s.jobs?.length||0))+metric('Photos',String(photos().length))+'</div>'+
 '<section class="blc-panel"><h3>Export full backup</h3><p>Includes jobs, shots, pipe, GPS, crew hours, notes and original saved photos.</p><button class="btn primary" data-action="export-backup">Save JSON Backup</button></section>'+
 '<section class="blc-panel"><h3>Restore records</h3><p>Restoring replaces current saved records. Export a backup first.</p><button class="btn ghost" data-action="import-backup">Choose Backup File</button></section>'+
 '<section class="blc-panel"><h3>Undo / history</h3><p>Review saved job changes.</p><button class="btn ghost" data-page="history">View History</button></section>'+
 '<p class="tiny muted">Automatic unattended backups are not enabled. Save exported files to separate storage.</p></div>';
}
function renderScannerHub(){
 return '<div class="page blc-page"><div class="blc-heading"><span class="eyebrow">BORELAB / PAPERWORK</span><h1>Paperwork Scanner 3.0</h1><p>Scan paperwork and review work orders, addresses, footage and conduit quantities before import.</p></div>'+
 '<section class="blc-panel"><h3>Scan → Review → Import</h3><p>The shot-sheet parser suggests records and leaves missing measurements blank for review.</p><button class="btn primary" data-sheet-action="open">▣ Scan Sheet</button></section>'+
 '<section class="blc-panel"><h3>Address only?</h3><p>Open Add Bore and use the address camera to scan only the jobsite location.</p><button class="btn ghost" data-action="new-shot">Add Bore</button></section></div>';
}
document.addEventListener('click',async e=>{
 const b=api(),t=e.target.closest('[data-blc-expand],[data-blc-open],[data-blc-photo],[data-blc-map],[data-blc-refresh],[data-blc-gps]');
 if(!b||!t)return;
 if(t.dataset.blcExpand){expanded=expanded===t.dataset.blcExpand?'':t.dataset.blcExpand;b.render();return}
 if(t.dataset.blcOpen){b.shotDetail(t.dataset.blcOpen);return}
 if(t.dataset.blcPhoto){b.photoChoose('camera',t.dataset.blcPhoto);return}
 if(t.dataset.blcMap){const sh=shots().find(s=>s.id===t.dataset.blcMap);if(sh)b.openMapUrl(b.mapsPinUrl(sh));return}
 if(t.hasAttribute('data-blc-refresh')){loadWeather(true);return}
 if(t.hasAttribute('data-blc-gps')){try{const pos=await b.getPosition();state().weatherReference={lat:pos.lat,lon:pos.lon};b.save();b.render()}catch(err){b.notify(String(err.message||'GPS unavailable'))}}
});
document.addEventListener('change',async e=>{
 const b=api(),t=e.target;if(!b)return;
 if(t.matches('[data-blc-shotfilter]')){filter=t.value;b.render();return}
 if(t.matches('[data-blc-photofilter]')){photoFilter=t.value;b.render();return}
 if(t.matches('[data-blc-time]')){
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.value))return b.notify('Choose a valid time.');
  state().finishBySettings={...(state().finishBySettings||{}),target:t.value};b.save();b.render();return;
 }
 if(t.matches('[data-blc-feet]')){
  const sh=shots().find(s=>s.id===t.dataset.blcFeet);if(!sh)return;
  const str=String(t.value||'').trim(),n=Number(str);
  if(str&&(!Number.isFinite(n)||n<0||n>num(sh.feet)))return b.notify('Feet must be between zero and the bore length.');
  sh.progressFeet=str?n:'';sh.updatedAt=new Date().toISOString();b.save();b.render();b.notify('Drill progress saved.');return;
 }
 if(t.matches('[data-blc-tag]')){
  const p=photos().find(p=>p.id===t.dataset.blcTag);
  if(!p||!categories.slice(1).includes(t.value))return;
  try{await b.photoDB('put',{...p,category:t.value});await b.refreshPhotos();b.render();b.notify('Photo category updated.')}
  catch(err){b.notify('Could not save photo category: '+err.message)}
 }
});
const css=document.createElement('style');
css.textContent='.blc-page{display:grid;gap:13px;padding-bottom:30px}.blc-heading h1{font-size:clamp(24px,6vw,31px);margin:6px 0}.blc-heading p{font-size:13px;color:var(--muted)}.blc-home{margin:12px 0;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:12px}.blc-home strong{font-size:12px}.blc-linkgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}.blc-linkgrid button,.blc-buttons button,.blc-panel button:not(.btn){border:1px solid var(--line);border-radius:11px;padding:11px;background:var(--surface2);color:var(--text);font-size:12px;font-weight:750;min-height:40px}.blc-linkgrid button{text-align:left}.blc-panel,.blc-shot{background:var(--surface);border:1px solid var(--line);border-radius:17px;padding:13px;display:grid;gap:11px;min-width:0}.blc-active,.blc-shot{border-left:4px solid var(--accent)}.blc-grid,.blc-four,.blc-triple{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.blc-four{grid-template-columns:repeat(4,minmax(0,1fr))}.blc-triple{grid-template-columns:repeat(3,minmax(0,1fr))}.blc-metric{min-width:0;overflow-wrap:anywhere;border:1px solid var(--line);background:var(--surface2);padding:9px;border-radius:12px;display:grid;gap:5px}.blc-metric strong{font-size:16px;color:var(--text)}.blc-metric small{font-size:10px;color:var(--muted)}.blc-buttons{display:flex;flex-wrap:wrap;gap:7px}.blc-buttons button{flex:1;min-width:90px}.blc-primary{background:var(--accent)!important;color:#122330!important;border-color:transparent!important}.blc-shot-title{background:transparent;border:0;color:var(--text);display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;font-size:15px}.blc-shot-title span{font-size:11px;color:var(--muted)}.blc-location{font-size:12px;border-top:1px solid var(--line);padding-top:9px;overflow-wrap:anywhere}.blc-location small{display:block;color:var(--muted);margin-top:4px}.blc-detail{display:grid;gap:8px}.blc-detail p{margin:0}.blc-bar{height:9px;border-radius:30px;background:var(--surface2);overflow:hidden}.blc-bar span{display:block;background:var(--accent);height:100%;border-radius:30px}.blc-panel h2{font-size:18px}.blc-panel h3{font-size:15px}.blc-panel p{font-size:12px;line-height:1.5}.blc-panel .between{gap:8px;flex-wrap:wrap}.blc-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line);font-size:12px}.blc-row strong{overflow-wrap:anywhere;min-width:0}.blc-row span{white-space:nowrap;color:var(--muted)}.blc-alert{color:#df8525;font-size:12px}.blc-photos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.blc-photos article{background:var(--surface);padding:8px;border:1px solid var(--line);border-radius:12px;min-width:0;display:grid;gap:6px}.blc-photos img{width:100%;height:130px;object-fit:cover;border-radius:8px}.blc-photos strong{font-size:12px}.blc-photos small{color:var(--muted);font-size:11px}.blc-photos select{width:100%;min-width:0}.blc-metric input[type=time]{width:100%;min-width:0;background:transparent;color:var(--text);font-weight:800;border:0;font-size:18px}@media(max-width:520px){.blc-four{grid-template-columns:repeat(2,minmax(0,1fr))}.blc-triple .blc-metric{padding:6px}.blc-triple .blc-metric strong{font-size:12px}}';
document.head.appendChild(css);
window.BoreLabCommand={renderCommand,renderShotCards,renderReelPlan,renderPhotoOrganizer,renderRecovery,renderScannerHub,homeLinks,loadWeather,weatherLabel,reelPlan,estimate};
})();
