/* BoreLab Field v0.16 — verified street address / Plus Code / GPS locations,
   and two distinct per-day reel assignments. Neither feature fabricates a map position. */
(function(){
'use strict';
const bridge=()=>window.BoreLabAssistantBridge;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:1});
const supportedChars='23456789CFGHJMPQRVWX';
function parseCoords(raw){
 const s=String(raw||'').replace(/[−–]/g,'-');
 const re=/(-?\d{1,2}\.\d{4,})\s*[,; ]\s*(-?\d{1,3}\.\d{4,})/g;
 for(const match of s.matchAll(re)){
  const lat=Number(match[1]),lon=Number(match[2]);
  if(Math.abs(lat)<=90&&Math.abs(lon)<=180)
   return{lat:match[1],lon:match[2],value:lat.toFixed(6)+','+lon.toFixed(6)};
 }
 return null;
}
function findStreet(raw){
 const lines=String(raw||'').split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
 const street=/\b(\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Z][A-Z0-9.'-]*\s+){1,6}(?:ST(?:REET)?|RD|ROAD|AVE(?:NUE)?|BLVD|BOULEVARD|DR(?:IVE)?|LN|LANE|CT|COURT|CIR|CIRCLE|WAY|TR(?:AI)?L|HWY|HIGHWAY|PL|PLACE|PKWY|PARKWAY)\.?\b)/i;
 const rural=/\b((?:COUNTY ROAD|STATE ROAD|CR|SR|US HIGHWAY|US HWY|HIGHWAY|HWY)\s*[-#]?\s*\d{1,6}[A-Z]?)\b/i;
 let best=null;
 for(let i=0;i<lines.length;i++){
  // A printed work-order cell often appears as "225 N" / "MAYORAL" / "ST".
  // Rejoin adjacent OCR lines, but never infer a missing house number.
  for(let span=1;span<=Math.min(4,lines.length-i);span++){
   const combo=lines.slice(i,i+span).join(' ');
   const m=combo.match(street)||combo.match(rural);
   if(!m)continue;
   const address=m[1].replace(/\s+/g,' ').replace(/\s+\./g,'.').trim();
   let score=1;
   if(/\baddress\b/i.test(lines.slice(Math.max(0,i-3),i+1).join(' ')))score+=6;
   if(span===1)score+=2;
   score-=span-1;
   if((address.match(/\d{2,}/g)||[]).length>1)score-=5;
   if(address.length>95)score-=6;
   if(!best||score>best.score||score===best.score&&address.length<best.value.length)
     best={score,value:address.slice(0,250)};
  }
 }
 if(best)return best.value;
 // Glades-style Underground Forms sometimes omit the street suffix entirely:
 // "Address" / "265 S LINDERO" is a valid address label, not a bore length.
 const bareStreet=/\b(\d{1,6}\s+[NSEW]\.?\s+[A-Za-z][A-Za-z'-]{2,})\b/i;
 let found=null;
 for(let i=0;i<lines.length;i++){
  for(let span=1;span<=Math.min(3,lines.length-i);span++){
   const line=lines.slice(i,i+span).join(' ');
   const m=line.match(bareStreet);if(!m)continue;
   const nearLabel=/\baddress\b/i.test(lines.slice(Math.max(0,i-4),i+1).join(' '));
   const score=(nearLabel?10:0)+(span===1?2:0)-span;
   if(!found||score>found.score)found={score,value:m[1].replace(/\s+/g,' ').trim()};
  }
 }
 return found?.value.slice(0,250)||'';
}
function findPlusCode(raw){
 const lines=String(raw||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const regex=/\b([23456789CFGHJMPQRVWX]{2,8})\s*\+\s*([23456789CFGHJMPQRVWX]{2,3})\b/i;
 for(let i=0;i<lines.length;i++){
  const m=lines[i].match(regex);if(!m)continue;
  const code=(m[1]+'+'+m[2]).toUpperCase();
  if(![2,4,6,8].includes(m[1].length))continue;
  let locality=lines[i].slice(m.index+m[0].length).trim().replace(/^[,;:\s]+/,'');
  if(locality.length>90)locality='';
  if(!locality||/^(?:plus code|address|phone|longitude|latitude|coordinates|copy|share|open)\b/i.test(locality)){
   locality=(lines[i+1]||'').trim();
  }
  if(/[,;]\s*$/.test(locality)&&/^[A-Za-z][A-Za-z .'-]{1,30}$/.test((lines[i+1]||'').trim()))
   locality+=' '+(lines[i+1]||'').trim();
  locality=locality.replace(/^(?:location|near)\s*[:\-]\s*/i,'').trim().replace(/\s+/g,' ').slice(0,90);
  if(!/^[A-Za-z][A-Za-z ,.'-]*$/.test(locality))locality='';
  // A short local Plus Code requires its locality; never imply it is globally unique.
  return{code,value:(code+(locality?' '+locality:'' )).trim(),hasLocality:m[1].length===8||!!locality,short:m[1].length<8};
 }
 return null;
}
function locationCandidates(raw){
 const text=String(raw||''),result=[];
 const street=findStreet(text),plus=findPlusCode(text),coords=parseCoords(text);
 if(street)result.push({kind:'street',label:'Street address · verify',value:street});
 if(plus)result.push({kind:'plus',label:plus.hasLocality?'Google Plus Code':'Plus Code · add nearby city',value:plus.value,needsLocality:!plus.hasLocality});
 if(coords)result.push({kind:'coords',label:'GPS coordinates',value:coords.value,lat:coords.lat,lon:coords.lon});
 return result;
}
function locationKind(value){
 if(parseCoords(value))return'coords';
 return /\b[23456789CFGHJMPQRVWX]{2,8}\s*\+\s*[23456789CFGHJMPQRVWX]{2,3}\b/i.test(String(value||''))?'plus':'street';
}
function isUsablePlusCode(value){
 const m=findPlusCode(String(value||''));
 return !!(m&&m.hasLocality);
}
function isNonStreetLocation(value){
 const raw=String(value||'');
 return locationKind(raw)==='plus'||!!parseCoords(raw);
}
// Plus Code geometry: full codes decode offline; short codes require a named locality.

function decodeFullPlusCode(raw){
 const info=findPlusCode(raw),code=info?.code||String(raw||'').trim().toUpperCase();
 const match=code.match(/^([23456789CFGHJMPQRVWX]{8})\+([23456789CFGHJMPQRVWX]{2,7})$/);
 if(!match)return null;
 const chars=match[1]+match[2],pairSteps=[20,1,.05,.0025,.000125];
 let lat=-90,lon=-180,latStep=0,lonStep=0;
 for(let i=0;i<10;i+=2){
  const step=pairSteps[i/2],a=supportedChars.indexOf(chars[i]),b=supportedChars.indexOf(chars[i+1]);
  if(a<0||b<0)return null;
  lat+=a*step;lon+=b*step;latStep=step;lonStep=step;
 }
 for(let i=10;i<chars.length;i++){
  const digit=supportedChars.indexOf(chars[i]);if(digit<0)return null;
  latStep/=5;lonStep/=4;
  lat+=Math.floor(digit/4)*latStep;lon+=(digit%4)*lonStep;
 }
 return{lat:(lat+latStep/2).toFixed(6),lon:(lon+lonStep/2).toFixed(6)};
}
function plusCodeLocality(raw){
 const p=findPlusCode(raw);
 return p?.short&&p.hasLocality?p.value.slice(p.code.length).trim():'';
}
function referencePrefix(lat,lon,missing){
 let a=Math.max(0,Math.min(180-1e-9,Number(lat)+90));
 let b=((Number(lon)+180)%360+360)%360;
 let out='';
 for(const step of [20,1,.05,.0025]){
  const i=Math.min(19,Math.floor(a/step+1e-10)),j=Math.min(19,Math.floor(b/step+1e-10));
  out+=supportedChars[i]+supportedChars[j];a=Math.max(0,a-i*step);b=Math.max(0,b-j*step);
 }
 return out.slice(0,missing);
}
function recoverShortPlusCode(raw,reference){
 const p=findPlusCode(raw),lat=Number(reference?.lat),lon=Number(reference?.lon);
 if(!p?.short||!p.hasLocality||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
 const missing=8-p.code.indexOf('+');
 if(missing<2||missing>6||missing%2)return null;
 const full=referencePrefix(lat,lon,missing)+p.code,point=decodeFullPlusCode(full);
 if(!point)return null;
 const cell=Math.pow(20,2-missing/2),half=cell/2;
 let a=Number(point.lat),b=Number(point.lon);
 if(lat+half<a&&a-cell>=-90)a-=cell;
 else if(lat-half>a&&a+cell<=90)a+=cell;
 if(lon+half<b&&b-cell>=-180)b-=cell;
 else if(lon-half>b&&b+cell<=180)b+=cell;
 return{lat:a.toFixed(6),lon:b.toFixed(6)};
}
function todayKey(){
 if(bridge()?.todayLocal)return bridge().todayLocal();
 const day=new Date();
 return day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');
}
function selections(state,day=todayKey()){
 const value=state?.dailyReelSelections?.[day];
 if(!Array.isArray(value))return['',''];
 return[String(value[0]||''),String(value[1]||'')];
}
function activeIds(state,day=todayKey()){
 const slots=selections(state,day);
 return [...new Set(slots.filter(Boolean))];
}
let currentDay=todayKey();
function reelOptions(reels,selected){
 return'<option value="">Choose a reel</option>'+reels.map(r=>
  '<option value="'+esc(r.id)+'" '+(selected===r.id?'selected':'')+'>'+
  esc(r.name+' · '+(r.size||'size not entered')+' · '+fmt(r.remaining)+' ft · '+(r.location==='truck'?'on truck':'at yard'))+'</option>').join('');
}
function renderSection(){
 const b=bridge();if(!b)return'';
 const state=b.state(),stored=selections(state,currentDay),reels=(state.reels||[]).filter(r=>!r.archived);
 const selected=stored.map(id=>reels.find(r=>r.id===id));
 const total=selected.filter(Boolean).reduce((n,r)=>n+Math.max(0,Number(r.remaining)||0),0);
 const problems=[];
 if(!reels.length)problems.push('No reels saved yet. Add reels first.');
 if(stored[0]&&stored[0]===stored[1])problems.push('Select two different reels.');
 for(let i=0;i<selected.length;i++){
  if(stored[i]&&!selected[i])problems.push('Reel '+(i+1)+' is no longer available.');
  if(selected[i]&&selected[i].location!=='truck')problems.push(selected[i].name+' is marked at yard; edit reel location when it is loaded.');
 }
 return'<section class="card spaced bl-daily-card"><div class="between"><div><span class="eyebrow">FIELD / TODAY’S LOADOUT</span><h3>Two Reels for the Day</h3></div><button class="btn micro ghost" data-page="pipe">Manage reels</button></div>'+
 '<p class="tiny muted">Assign two distinct saved reels for this date. BoreLab checks material by these reels when assigned, not other reels. Selections do not physically move pipe or deduct footage.</p>'+
 '<label class="field">Work date<input type="date" data-bl-reel-date value="'+esc(currentDay)+'"></label>'+
 '<div class="bl-daily-reel-grid">'+[0,1].map(i=>
  '<label class="field"><strong>'+(i?'Reel 2 · Second':'Reel 1 · Primary')+'</strong><select data-bl-reel-slot="'+i+'">'+reelOptions(reels,stored[i])+'</select></label>').join('')+'</div>'+
 (selected.some(Boolean)?'<div class="bl-daily-picked">'+selected.map((r,i)=>'<div>'+(r?'<strong>'+esc(r.name)+'</strong><small>'+esc(r.size||'Size missing')+' · '+fmt(r.remaining)+' ft · '+esc(r.location==='truck'?'On truck':'At yard')+'</small>':'<strong>Reel '+(i+1)+' not chosen</strong><small>Choose a different saved reel</small>')+'</div>').join('')+'</div><p class="tiny muted">Selected reel totals: '+fmt(total)+' ft, split by the listed sizes. Check individual continuous lengths and reservations.</p>':'<div class="note spaced">No daily reels selected yet. Pipe checks still use your entire recorded on-truck reel inventory until you choose a daily loadout.</div>')+
 problems.map(p=>'<p class="tiny muted">⚠ '+esc(p)+'</p>').join('')+
 '<div class="action-row"><button class="btn micro primary" data-bl-add-reel>+ Add new reel</button><button class="btn micro ghost" data-bl-clear-reels>Clear this date</button></div></section>';
}
document.addEventListener('change',event=>{
 const el=event.target,bridgeApi=bridge();
 if(!bridgeApi)return;
 if(el.matches('[data-bl-reel-date]')){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(el.value))return;
  currentDay=el.value;bridgeApi.render();return;
 }
 if(el.matches('[data-bl-reel-slot]')){
  const state=bridgeApi.state(),slot=Number(el.dataset.blReelSlot),selected=selections(state,currentDay);
  if(![0,1].includes(slot))return;
  const id=String(el.value||'');
  if(id&&!(state.reels||[]).some(r=>r.id===id&&!r.archived)){
   bridgeApi.notify('Reel no longer exists. Choose another.');bridgeApi.render();return;
  }
  if(id&&selected[1-slot]===id){
   bridgeApi.notify('Choose two different reels for the day.');bridgeApi.render();return;
  }
  selected[slot]=id;
  if(!state.dailyReelSelections)state.dailyReelSelections={};
  state.dailyReelSelections[currentDay]=selected;
  bridgeApi.save();bridgeApi.render();return;
 }
});
document.addEventListener('click',event=>{
 if(event.target.closest('[data-bl-add-reel]')){bridge()?.reelForm?.();return}
 if(event.target.closest('[data-bl-clear-reels]')){
  const b=bridge();if(!b)return;
  const state=b.state();
  if(state.dailyReelSelections)delete state.dailyReelSelections[currentDay];
  b.save();b.render();
 }
});
const css=document.createElement('style');
css.textContent='.bl-daily-card{display:grid;gap:12px}.bl-daily-card .between{gap:10px;align-items:center;flex-wrap:wrap}.bl-daily-card .field{margin:0}.bl-daily-reel-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:0}.bl-daily-reel-grid label{min-width:0}.bl-daily-reel-grid select{width:100%;min-width:0}.bl-daily-picked{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.bl-daily-picked>div{padding:10px;border-radius:12px;border:1px solid var(--line);background:var(--surface2)}.bl-daily-picked small{display:block;font-size:11px;color:var(--muted)}.bl-daily-card h3{margin:3px 0 0}@media(max-width:430px){.bl-daily-reel-grid,.bl-daily-picked{grid-template-columns:1fr}}';
document.head.appendChild(css);
window.BoreLabLocations={parseCoords,findStreet,findPlusCode,locationCandidates,locationKind,isUsablePlusCode,isNonStreetLocation,decodeFullPlusCode,plusCodeLocality,recoverShortPlusCode};
window.BoreLabDailyReels={todayKey,selections,activeIds,renderSection};
// Recover the saved planner or reels page after the module loads.
if(document.querySelector('.bl-daily-card')===null&&document.querySelector('#main .page'))bridge()?.render?.();
})();
