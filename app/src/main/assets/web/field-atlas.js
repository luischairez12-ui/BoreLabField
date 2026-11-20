/* BoreLab Field Atlas — read-only portfolio GPS map paired with Field Calendar. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const ab=()=>window.BoreLabAsBuilt;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=r=>!!ab()?.valid?.(r);
const zoomClamp=x=>Math.max(3,Math.min(18,x));
const point=r=>({lat:Number(r.lat),lon:Number(r.lon)});
const key=(job,type,id)=>String(job)+'|'+String(type)+'|'+String(id);
const proj=(lat,lon,z)=>{const n=256*2**z,a=Math.max(-85.05112878,Math.min(85.05112878,Number(lat)))*Math.PI/180;return{x:(Number(lon)+180)/360*n,y:(.5-Math.log((1+Math.sin(a))/(1-Math.sin(a)))/(4*Math.PI))*n}};
const unproj=(x,y,z)=>{const n=256*2**z;return{lat:Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI,lon:((x/n*360)%360+360)%360-180}};
const fit=(p,w=350,h=420)=>{if(!p.length)return null;const a=p.map(x=>proj(x.lat,x.lon,0));const minX=Math.min(...a.map(x=>x.x)),maxX=Math.max(...a.map(x=>x.x)),minY=Math.min(...a.map(x=>x.y)),maxY=Math.max(...a.map(x=>x.y)),dx=Math.max(.00001,maxX-minX),dy=Math.max(.00001,maxY-minY),z=p.length===1?17:zoomClamp(Math.floor(Math.log2(Math.min(Math.max(100,w-100)/dx,Math.max(120,h-145)/dy))));return{zoom:z,center:unproj((minX+maxX)*2**z/2,(minY+maxY)*2**z/2,z)}};
let view=null,viewSignature='',mode='street',selectedKey='',clusterKeys=[],gesture=null,down=null,clickQuiet=0,pendingFocus=null;
function points(){
 const events=(ab()?.getView?.()==='replay'?window.BoreLabInsights?.visibleReplayEvents?.():ab()?.atlasEvents?.())||[],indexed=new Map();
 for(const e of events){
  const r=e.record; if(!valid(r))continue;
  const id=key(e.jobId,e.type,r.id);
  if(!indexed.has(id))indexed.set(id,{key:id,jobId:e.jobId,jobName:e.jobName,type:e.type,record:r,
   title:e.type==='photo'?(r.fieldPinId?'Installation photo':r.shotId?'Bore photo':'Jobsite photo'):(r.name||e.title),
   dates:[],events:[],lat:+r.lat,lon:+r.lon});
  const m=indexed.get(id);m.events.push(e);if(!m.dates.includes(e.day))m.dates.push(e.day);
 }
 // Older planned bores may have no timestamps. Display their confirmed GPS in the all-dates Atlas
 // without assigning a fictional day to the Calendar.
 if(ab()?.getAtlasDayMode?.()!=='selected'){
  const s=api()?.state?.()||{},q=String(ab()?.getSearch?.()||'').trim().toLowerCase(),type=ab()?.getType?.()||'all';
  for(const job of s.jobs||[]){
   if(ab()?.getScope?.()==='job'&&job.id!==s.activeJobId)continue;
   for(const [kind,items] of [['shot',job.shots||[]],['pin',job.fieldPins||[]]]){
    if(type!=='all'&&type!==kind)continue;
    for(const r of items){
     if(!valid(r))continue;
     const id=key(job.id,kind,r.id);
     if(indexed.has(id))continue;
     const label=String(r.name||r.kind||kind);
     if(q&&![label,job.jobName,r.address,r.notes,r.station,r.size,r.material,r.occurredDay,r.status].filter(Boolean).join(' ').toLowerCase().includes(q))continue;
     indexed.set(id,{key:id,jobId:job.id,jobName:job.jobName||'Job',type:kind,record:r,
       title:label,dates:['Date not recorded'],events:[],lat:+r.lat,lon:+r.lon});
    }
   }
  }
 }
 // Full saved map: include endpoints even when the bore has no center GPS pin.
 if(ab()?.getAtlasDayMode?.()!=='selected'){
  const root=api()?.state?.()||{};
  for(const j of root.jobs||[]){
   if(ab()?.getScope?.()==='job'&&j.id!==root.activeJobId)continue;
   for(const shot of j.shots||[])for(const [field,label] of [['asbuiltStart','Entry point'],['asbuiltEnd','Exit point']]){
    const r=shot[field],id=key(j.id,field,shot.id);if(!valid(r)||indexed.has(id))continue;
    indexed.set(id,{key:id,jobId:j.id,jobName:j.jobName||'Job',type:field,record:r,shot,
     title:(shot.name||'Bore')+' · '+label,dates:['GPS reference'],events:[],lat:Number(r.lat),lon:Number(r.lon)});
   }
  }
 }
 // Actual bore entry and exit positions are recorded endpoints, not inferred points on the underground line.
 const existing=new Set(indexed.keys());
 for(const job of api()?.state?.()?.jobs||[]){
  if(ab()?.getScope?.()==='job'&&job.id!==api()?.state?.()?.activeJobId)continue;
  for(const shot of job.shots||[]){
   const event=events.find(e=>e.type==='shot'&&e.jobId===job.id&&e.record.id===shot.id);
   if(!event)continue;
   for(const [field,label] of [['asbuiltStart','Entry point'],['asbuiltEnd','Exit point']]){
    const r=shot[field];if(!valid(r))continue;
     if(ab()?.getView?.()==='replay'){
      if(!r.recordedAt||ab()?.dayOf?.(r.recordedAt)!==ab()?.getDay?.())continue;
      const recorded=new Date(r.recordedAt);if(!Number.isFinite(+recorded)||recorded.getHours()*60+recorded.getMinutes()>(window.BoreLabInsights?.getMinute?.()??-1))continue;
     }
    const id=key(job.id,field,shot.id);if(existing.has(id))continue;
    indexed.set(id,{key:id,jobId:job.id,jobName:job.jobName||'Job',type:field,record:r,shot,
     title:(shot.name||'Bore')+' · '+label,dates:[ab().dayOf(r.recordedAt||shot.completedAt||shot.startedAt)].filter(Boolean),
     events:[event],lat:+r.lat,lon:+r.lon});
   }
  }
 }
 return [...indexed.values()];
}
function signature(all){if(ab()?.getView?.()==='replay')return 'replay:'+(ab()?.getDay?.()||'')+':'+ab()?.getScope?.()+':'+(ab()?.getType?.()||'all')+':'+(ab()?.getSearch?.()||'')+':'+(api()?.state?.()?.activeJobId||'');return (ab()?.getAtlasDayMode?.()||'all')+':'+(ab()?.getDay?.()||'')+':'+ab()?.getScope?.()+':'+points().length+':'+(api()?.state?.()?.activeJobId||'')+':'+(ab()?.getSearch?.()||'')}
function ensure(all=points()){
 const sig=signature(all);
 if(sig!==viewSignature||!view){
  viewSignature=sig;const boundPoints=ab()?.getView?.()==='replay'?(window.BoreLabInsights?.replayMapPoints?.()||all):all;view=fit(boundPoints.map(point),document.querySelector('[data-atlas-view]')?.clientWidth||350,430)||{zoom:15,center:null};
 }
 if(pendingFocus){
  const focused=all.find(p=>p.key===pendingFocus);if(focused){selectedKey=focused.key;view={zoom:17,center:point(focused)};pendingFocus=null}
 }
}
function tiles(center,w,h,z){
 if(mode!=='street')return '';
 const tile=256,size=2**z,minX=Math.floor((center.x-w/2)/tile)-1,maxX=Math.floor((center.x+w/2)/tile)+1,minY=Math.floor((center.y-h/2)/tile)-1,maxY=Math.floor((center.y+h/2)/tile)+1;
 let html='',count=0;
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
  if(y<0||y>=size||++count>35)continue;
  const px=x*tile-center.x+w/2,py=y*tile-center.y+h/2;
  html+='<img class="atlas-tile" alt="" loading="lazy" decoding="async" draggable="false" src="https://tile.openstreetmap.org/'+z+'/'+((x%size+size)%size)+'/'+y+'.png" style="left:'+Math.round(px)+'px;top:'+Math.round(py)+'px">';
 }
 return html;
}
function groups(all,w,h,center){
 const groups=[],used=new Set(),px=36;
 for(const p of all){
  if(used.has(p.key))continue;
  const target=proj(p.lat,p.lon,view.zoom),x=target.x-center.x+w/2,y=target.y-center.y+h/2;
  if(x< -75||x>w+75||y< -75||y>h+75)continue;
  const items=[p];used.add(p.key);
  for(const other of all){
   if(used.has(other.key))continue;const q=proj(other.lat,other.lon,view.zoom);
   if(Math.hypot(q.x-target.x,q.y-target.y)<px){items.push(other);used.add(other.key)}
  }
  groups.push({key:p.key,x,y,items});
 }
 return groups;
}
function draw(){
 const el=document.querySelector('[data-atlas-view]'),scene=el?.querySelector('[data-atlas-scene]');
 if(!el||!scene)return;
 const all=points();ensure(all);
 if(!view.center){scene.innerHTML='';return}
 const w=el.clientWidth||350,h=el.clientHeight||430,c=proj(view.center.lat,view.center.lon,view.zoom),grouped=groups(all,w,h,c);
 const marks=grouped.map(g=>{
  const first=g.items[0],n=g.items.length,many=n>1,selected=g.items.some(x=>x.key===selectedKey);
  const icon=many?String(n):first.type==='photo'?'▣':first.type==='pin'?(window.BoreLabFieldPins?.symbolFor?.(first.record)||'📌'):first.type==='shot'?'⌁':first.type==='marker'?'⚠':first.type==='arrival'?'⌖':'◎';
  return '<button class="atlas-marker atlas-'+esc(first.type)+(selected?' selected':'')+(many?' grouped':'')+'" data-atlas-point="'+esc(g.key)+'" style="left:'+Math.round(g.x)+'px;top:'+Math.round(g.y)+'px" aria-label="'+esc(many?n+' field records':first.title)+'"><b>'+esc(icon)+'</b></button>';
 }).join('');
 const lines=(api()?.state?.()?.jobs||[]).filter(j=>ab()?.getScope?.()!=='job'||j.id===api()?.state?.()?.activeJobId).flatMap(j=>(j.shots||[]).filter(s=>valid(s.asbuiltStart)&&valid(s.asbuiltEnd)).map(s=>({record:s,jobId:j.id}))).filter(p=>all.some(x=>x.jobId===p.jobId&&(x.shot?.id===p.record.id||x.record?.id===p.record.id))).map(p=>{
  const a=proj(p.record.asbuiltStart.lat,p.record.asbuiltStart.lon,view.zoom),b=proj(p.record.asbuiltEnd.lat,p.record.asbuiltEnd.lon,view.zoom);
  return '<line x1="'+(a.x-c.x+w/2).toFixed(1)+'" y1="'+(a.y-c.y+h/2).toFixed(1)+'" x2="'+(b.x-c.x+w/2).toFixed(1)+'" y2="'+(b.y-c.y+h/2).toFixed(1)+'" stroke="#16ccbe" stroke-width="3" stroke-linecap="round"/>';
 }).join('');
 scene.innerHTML='<div class="atlas-tiles">'+tiles(c,w,h,view.zoom)+'</div>'+
 '<svg class="atlas-lines" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" aria-hidden="true">'+lines+'</svg>'+
 '<div class="atlas-markers">'+marks+'</div>';
}
function quality(record){
 if(!valid(record))return 'GPS missing';
 const n=record.gpsAccuracy??record.accuracy,source=record.gpsSource||'';
 if(source==='manual')return 'Manual coordinate · verify in field';
 if(n==null||n==='')return 'GPS accuracy not documented';
 const accuracy=Number(n);if(!Number.isFinite(accuracy))return 'GPS accuracy not documented';
 return 'GPS ±'+Math.round(accuracy)+' m'+(accuracy>25?' · Low accuracy — verify':accuracy>10?' · Approximate':'');
}
let selectedReplayDay='';
function card(p){
 const r=p.record,ph=api()?.photos?.()||[],attached=p.type==='pin'?ph.filter(x=>x.jobId===p.jobId&&x.fieldPinId===r.id):p.type==='shot'?ph.filter(x=>x.jobId===p.jobId&&x.shotId===r.id):[];
 const metadata=p.type==='pin'?[r.station,r.size,r.material,r.depth?'Depth '+r.depth+' ft':'',r.fittingType,r.connectionType,r.dimensions,r.notes].filter(Boolean).join(' · '):p.type==='shot'?[r.feet?r.feet+' ft':'',r.status,r.address].filter(Boolean).join(' · '):p.type==='photo'?[r.stage,quality(r)].filter(Boolean).join(' · '):p.type==='marker'?[r.label,window.BoreLabEdgeV22?.markerKind?.(r.kind),r.status,r.notes,quality(r)].filter(Boolean).join(' · '):p.type==='arrival'?['Manual arrival',quality(r)].join(' · '):'Endpoint reference · not underground alignment';
 const replayDays=[...new Set((p.events||[]).map(e=>e.day).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d))))].sort();
 const replayDay=replayDays.includes(selectedReplayDay)?selectedReplayDay:replayDays[replayDays.length-1];
 const replayCard=replayDay?
  '<div class="atlas-replay-region"><strong>Replay this workday</strong>'+
  (replayDays.length>1?'<div class="atlas-replay-days" role="group" aria-label="Choose workday">'+replayDays.map(d=>
  '<button type="button" data-atlas-replay-day="'+esc(d)+'" class="'+(d===replayDay?'active':'')+'" aria-pressed="'+(d===replayDay)+'">'+esc(d)+'</button>').join('')+'</div>':'')+
  (window.BoreLabInsights?.renderReplayCard?.(replayDay)||'')+'</div>':'';
 return '<section class="atlas-selected" aria-label="Atlas selected location"><div class="between"><div><span class="eyebrow">'+esc(p.jobName)+'</span><h3>'+esc(p.title)+'</h3><small>'+esc(p.dates.join(', '))+'</small></div><button class="atlas-x" data-atlas-close aria-label="Close pin card">✕</button></div>'+
 '<p class="smalltext">'+esc(metadata)+'</p><p class="atlas-coords">⌖ '+(+p.lat).toFixed(6)+', '+(+p.lon).toFixed(6)+'</p>'+
 '<p class="atlas-quality">'+esc(quality(r))+'</p>'+
 (attached.length?'<div class="atlas-images">'+attached.slice(0,4).map(x=>'<button data-atlas-photo="'+esc(x.id)+'" aria-label="View linked photo"><img src="'+esc(x.dataUrl)+'" loading="lazy" alt="Linked photo"></button>').join('')+'</div>':'')+
 '<div class="atlas-card-actions"><button data-atlas-nav="'+esc(p.key)+'">⌖ Navigate</button><button data-atlas-open="'+esc(p.key)+'">Open record ›</button></div>'+replayCard+'</section>';
}
function clusterCard(members){
 return '<section class="atlas-selected"><div class="between"><strong>📌 '+members.length+' records at this location</strong><button class="atlas-x" data-atlas-close>✕</button></div>'+
 '<div class="atlas-cluster-list">'+members.map(p=>'<button data-atlas-select="'+esc(p.key)+'"><strong>'+esc(p.title)+'</strong><small>'+esc(p.jobName)+' · '+esc(p.dates.join(', '))+'</small></button>').join('')+'</div></section>';
}
function renderAtlas(){
 const all=points();ensure(all);const selected=all.find(x=>x.key===selectedKey),members=clusterKeys.map(k=>all.find(p=>p.key===k)).filter(Boolean);
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(draw);
 return '<section class="atlas-area" aria-label="Interactive field atlas"><div class="atlas-toolbar"><div><strong>📍 Underground Atlas</strong><small>'+all.length+' located records'+(ab()?.getAtlasDayMode?.()==='selected'?' · '+esc(ab().getDay()):' · all dates')+'</small></div><div class="atlas-tool-actions"><button data-atlas-mode="street" class="'+(mode==='street'?'selected':'')+'">Streets</button><button data-atlas-mode="plot" class="'+(mode==='plot'?'selected':'')+'">Plot</button></div></div>'+
 '<div class="atlas-frame'+(mode==='plot'?' atlas-offline':'')+'" data-atlas-view role="region" aria-label="Read-only GPS atlas, drag to pan, use plus and minus to zoom">'+
 '<div class="atlas-placeholder">'+(all.length?'Tap a pin for its history. Street maps require internet; GPS records work offline.':'No saved GPS coordinates match these filters.')+'</div>'+
 '<div class="atlas-scene" data-atlas-scene></div>'+
 '<div class="atlas-controls"><button data-atlas-zoom="1" aria-label="Zoom in">＋</button><button data-atlas-zoom="-1" aria-label="Zoom out">−</button><button data-atlas-fit aria-label="Fit locations">⌖</button></div>'+
 '</div><p class="atlas-attribution">'+(mode==='street'?'© OpenStreetMap contributors · ':'')+'Offline plot keeps saved coordinates · no survey accuracy implied</p>'+
 (members.length?clusterCard(members):selected?card(selected):'')+
 '<div class="atlas-legend"><span>⌁ Bores</span><span>📌 Installations</span><span>▣ Photos</span><span>⚠ Field Markers</span><span>◎ Endpoints</span><span>HH Handhole</span><span>C Coupling</span><span>B Box</span><span>★ Custom</span></div>'+
 '<p class="tiny muted">This atlas is for viewing and revisiting recorded work. Entry-to-exit lines show straight GPS references, not the actual underground drill trajectory.</p></section>';
}
function findPoint(id){return points().find(p=>p.key===id)}
function focusEvent(event){
 if(!event)return;
 pendingFocus=key(event.jobId,event.type,event.record.id);
 clusterKeys=[];selectedKey='';
}
function openRecord(p){
 if(!p)return;
 const b=api();if(!b)return;
 if(p.type==='photo')return ab()?.openPhoto?.(p.record.id);
 if(p.type==='asbuiltStart'||p.type==='asbuiltEnd')return b.notify?.('These are recorded bore endpoints, not a surveyed drill trace.');
 if(p.jobId!==b.state().activeJobId){if(b.switchActiveJob?.(p.jobId)===false)return}
 if(p.type==='pin')window.BoreLabFieldPins?.open?.(p.record.id,'pin');
 else if(p.type==='marker')window.BoreLabEdgeV22?.markerForm?.(p.record.id);
 else if(p.type==='arrival')window.BoreLabEdgeV22?.navigateHub?.('arrival');
 else b.shotDetail?.(p.record.id);
}
function navigate(p){
 const b=api();if(!p)return;
 const url='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.lat.toFixed(6)+','+p.lon.toFixed(6));
 b?.openMapUrl?.(url);
}
document.addEventListener('click',e=>{
 const el=e.target.closest?.('[data-atlas-point],[data-atlas-select],[data-atlas-close],[data-atlas-mode],[data-atlas-zoom],[data-atlas-fit],[data-atlas-open],[data-atlas-nav],[data-atlas-photo],[data-atlas-replay-day]');
 if(!el||api()?.currentPage?.()!=='fieldhistory')return;
 if(el.dataset.atlasReplayDay){selectedReplayDay=el.dataset.atlasReplayDay;window.BoreLabInsights?.pauseCard?.();api()?.render?.();return}
 if(el.dataset.atlasPoint){
  if(Date.now()<clickQuiet)return;
  const all=points();ensure(all),canvas=document.querySelector('[data-atlas-view]'),w=canvas?.clientWidth||350,h=canvas?.clientHeight||430,c=proj(view.center.lat,view.center.lon,view.zoom),g=groups(all,w,h,c).find(x=>x.key===el.dataset.atlasPoint);
  if(!g)return;selectedReplayDay='';window.BoreLabInsights?.pauseCard?.();clusterKeys=g.items.length>1?g.items.map(x=>x.key):[];selectedKey=g.items.length===1?g.items[0].key:'';api()?.render?.();return;
 }
 if(el.dataset.atlasSelect){selectedReplayDay='';window.BoreLabInsights?.pauseCard?.();clusterKeys=[];selectedKey=el.dataset.atlasSelect;api()?.render?.();return}
 if(el.hasAttribute('data-atlas-close')){selectedKey='';clusterKeys=[];api()?.render?.();return}
 if(el.dataset.atlasMode){mode=el.dataset.atlasMode==='plot'?'plot':'street';api()?.render?.();return}
 if(el.dataset.atlasZoom){if(view?.center){view.zoom=zoomClamp(view.zoom+Number(el.dataset.atlasZoom));draw()}return}
 if(el.hasAttribute('data-atlas-fit')){viewSignature='';view=null;selectedKey='';clusterKeys=[];api()?.render?.();return}
 if(el.dataset.atlasOpen)return openRecord(findPoint(el.dataset.atlasOpen));
 if(el.dataset.atlasNav)return navigate(findPoint(el.dataset.atlasNav));
 if(el.dataset.atlasPhoto)return ab()?.openPhoto?.(el.dataset.atlasPhoto);
});
document.addEventListener('pointerdown',e=>{
 const canvas=e.target.closest?.('[data-atlas-view]');
 if(!canvas||!view?.center||api()?.currentPage?.()!=='fieldhistory'||e.target.closest?.('button'))return;
 down={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0,moved:false};
 try{canvas.setPointerCapture(e.pointerId)}catch{}
});
document.addEventListener('pointermove',e=>{
 if(!down||down.id!==e.pointerId||!view?.center)return;
 down.dx=e.clientX-down.x;down.dy=e.clientY-down.y;down.moved=Math.hypot(down.dx,down.dy)>5;
 if(!down.moved)return;e.preventDefault();
 const scene=document.querySelector('[data-atlas-scene]');if(scene)scene.style.transform='translate('+down.dx+'px,'+down.dy+'px)';
},{passive:false});
function finish(e){
 if(!down||down.id!==e.pointerId)return;
 const d=down;down=null;
 const scene=document.querySelector('[data-atlas-scene]');if(scene)scene.style.transform='';
 if(!d.moved||!view?.center)return;
 clickQuiet=Date.now()+350;const c=proj(view.center.lat,view.center.lon,view.zoom);
 view.center=unproj(c.x-d.dx,c.y-d.dy,view.zoom);draw();
}
document.addEventListener('pointerup',finish);
document.addEventListener('pointercancel',finish);
document.addEventListener('wheel',e=>{if(api()?.currentPage?.()!=='fieldhistory'||!e.target.closest?.('[data-atlas-view]')||!view?.center)return;e.preventDefault();view.zoom=zoomClamp(view.zoom+(e.deltaY<0?1:-1));draw()},{passive:false});
window.addEventListener?.('resize',()=>{if(api()?.currentPage?.()==='fieldhistory')draw()});
window.BoreLabAtlas={renderAtlas,points,fit,focusEvent,draw,card,quality,openRecord,navigate,getSelected:()=>selectedKey,getMode:()=>mode};
})();