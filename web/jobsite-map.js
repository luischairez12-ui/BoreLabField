/* BoreLab Field — Interactive Jobsite Map.
   GPS pins are taken from saved shots. Street tiles require internet;
   site plot, status filtering and shot records work offline. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const st=()=>api()?.state()||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:1});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const status=s=>s.status==='complete'?'complete':s.status==='progress'?'progress':'planned';
const statusText=s=>s==='complete'?'Complete':s==='progress'?'Drilling':'Pending';
const shades={planned:'pending',progress:'drilling',complete:'complete'};
const activeShots=()=>st().shots||[];
const activePins=()=>window.BoreLabFieldPins?.pins?.()||[];
const activeRecords=()=>[...activeShots(),...activePins(),...(selectedPhoto?[selectedPhoto]:[])];
const isPhoto=s=>s?.recordType==='fieldPhoto';
const inMapDay=s=>!mapDay||(s.scheduledDay&&s.recordType!=='fieldPin'?[s.scheduledDay,s.startedAt,s.completedAt]:[s.occurredDay,s.addedAt,s.startedAt,s.completedAt,s.createdAt,s.updatedAt]).some(v=>window.BoreLabAsBuilt?.dayOf?.(v)===mapDay);
const isPin=s=>s?.recordType==='fieldPin';
const pinLabel=s=>window.BoreLabFieldPins?.kindLabel?.(s?.kind)||'Field marker';
const recordDate=s=>window.BoreLabFieldPins?.displayDate?.(s)||'Date not recorded';
const placed=()=>activeRecords().filter(s=>api()?.coordsValid?.(s));
const endpointValid=p=>p&&p.lat!==''&&p.lon!==''&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&Number(p.lat)>=-90&&Number(p.lat)<=90&&Number(p.lon)>=-180&&Number(p.lon)<=180;
const mapBounds=()=>[...placed(),...activeShots().flatMap(s=>[s.asbuiltStart,s.asbuiltEnd].filter(endpointValid))];
const missing=()=>activeRecords().filter(s=>!api()?.coordsValid?.(s));
const point=s=>({lat:Number(s.lat),lon:Number(s.lon)});
let currentJob=null,selected=null,selectedPhoto=null,mapDay='',filter='all',typeFilter='all',mode='street',showPath=true,view=null;
let pointerData=new Map(),gesture=null,suppressClick=0;
let attemptedTiles=false,tilesFailed=false,drawRequest=false;
function project(lat,lon,z){
 const size=256*2**z,angle=clamp(Number(lat),-85.05112878,85.05112878)*Math.PI/180;
 return{x:(Number(lon)+180)/360*size,y:(.5-Math.log((1+Math.sin(angle))/(1-Math.sin(angle)))/(4*Math.PI))*size};
}
function unproject(x,y,z){
 const size=256*2**z;
 const lat=Math.atan(Math.sinh(Math.PI*(1-2*y/size)))*180/Math.PI;
 let lon=x/size*360-180;
 lon=((lon+180)%360+360)%360-180;
 return {lat:clamp(lat,-85.05112878,85.05112878),lon};
}
function fit(points,w=340,h=430){
 if(!points.length)return null;
 const x=points.map(x=>project(x.lat,x.lon,0)),xs=x.map(p=>p.x),ys=x.map(p=>p.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const dx=Math.max(.00001,maxX-minX),dy=Math.max(.00001,maxY-minY);
 const z=points.length===1?16:clamp(Math.floor(Math.log2(Math.min(Math.max(80,w-100)/dx,Math.max(100,h-140)/dy))),3,18);
 return {zoom:z,center:unproject((minX+maxX)*2**z/2,(minY+maxY)*2**z/2,z)};
}
function model(){
 const shots=activeShots(),pins=activePins(),records=activeRecords(),geocoded=placed(),unknown=missing();
 const shown=geocoded.filter(s=>{
  if(!inMapDay(s))return false;
   if(isPhoto(s))return typeFilter==='all';
   if(typeFilter==='bores')return !isPin(s)&&(filter==='all'||status(s)===filter);
  if(typeFilter!=='all')return isPin(s)&&s.kind===typeFilter;
  return isPin(s)||filter==='all'||status(s)===filter;
 });
 const scopedShots=shots.filter(inMapDay),scopedRecords=records.filter(inMapDay),scopedPins=pins.filter(inMapDay);
 const groups={all:scopedShots.length,planned:0,progress:0,complete:0};
 scopedShots.forEach(s=>groups[status(s)]++);
 const types={all:scopedRecords.length,bores:scopedShots.length};for(const kind of Object.keys(window.BoreLabFieldPins?.kindLabels||{}))types[kind]=0;
 scopedPins.forEach(p=>{if(Object.prototype.hasOwnProperty.call(types,p.kind))types[p.kind]++});
 return {shots,pins,records,geocoded,unknown,shown,groups,types,jobId:st().activeJobId||'job',jobName:st().jobName||'Current job'};
}
function ensureView(data=model()){
 if(currentJob===data.jobId&&view){
  if(!view.center&&mapBounds().length){const recovered=fit(mapBounds().map(point));if(recovered)view=recovered;}
  return;
 }
 if(currentJob!==null&&currentJob!==data.jobId)mapDay='';
 currentJob=data.jobId;selected=null;selectedPhoto=null;pointerData.clear();gesture=null;
 const pos=fit(mapBounds().map(point));
 view=pos||{center:null,zoom:15};
 const pref=st().jobsiteMapPreferences;
 mode=pref?.mode==='plot'?'plot':'street';
 showPath=pref?.showPath!==false;
 filter=['all','planned','progress','complete'].includes(pref?.filter)?pref.filter:'all';
  typeFilter=['all','bores',...Object.keys(window.BoreLabFieldPins?.kindLabels||{})].includes(pref?.typeFilter)?pref.typeFilter:'all';
}
function saveSettings(){
 st().jobsiteMapPreferences={mode,showPath,filter,typeFilter};
 api()?.save?.();
}
function statusTabs(data){
 return [['all','All'],['planned','Pending'],['progress','Drilling'],['complete','Complete']].map(([key,label])=>
 '<button type="button" data-blmap-filter="'+key+'" aria-pressed="'+(filter===key?'true':'false')+'" class="blmap-filter-'+key+(filter===key?' active':'')+'">'+
 label+' <span>'+data.groups[key]+'</span></button>').join('');
}
function typeTabs(data){
 return [['all','All Pins'],['bores','Bores'],...Object.entries(window.BoreLabFieldPins?.kindLabels||{}).map(([key,label])=>[key,({'tie-in':'Tie-ins',coupling:'Couplings',box:'Boxes'}[key]||label)])].map(([key,label])=>
 '<button type="button" data-blmap-type="'+key+'" aria-pressed="'+(typeFilter===key?'true':'false')+'" class="'+(typeFilter===key?'active':'')+'">'+
 label+' <span>'+data.types[key]+'</span></button>').join('');
}
function weatherChip(){
 const snap=window.BoreLabCommand?.weatherSnapshot?.(),t=snap?.target,now=snap?.data?.current;
 const matched=t&&snap?.key===Number(t.lat).toFixed(3)+','+Number(t.lon).toFixed(3);
 return matched&&now&&Number.isFinite(Number(now.temperature_2m))?
 '<span class="blmap-weather">☁ '+Math.round(Number(now.temperature_2m))+'°F</span>':'';
}
function selectedPanel(data){
 const s=data.records.find(x=>x.id===selected);
 if(!s)return '';
 if(isPhoto(s))return '<section class="blmap-sheet" aria-label="Selected photo GPS"><div class="blmap-sheet-handle"></div><div class="blmap-sheet-top"><span class="blmap-sheet-emblem">▣</span><div><strong>Jobsite Photo</strong><small>'+esc(recordDate(s))+'</small></div><button data-blmap-close aria-label="Close photo">✕</button></div>'+(String(s.dataUrl||'').startsWith('data:image/')?'<img class="ab-sheet-photo" src="'+esc(s.dataUrl)+'" alt="Saved jobsite photo">':'')+'<p class="smalltext">GPS '+Number(s.lat).toFixed(6)+', '+Number(s.lon).toFixed(6)+'</p><div class="blmap-sheet-actions"><button class="blmap-orange" data-blmap-photo-detail="'+esc(s.photoId)+'">▣ View Photo</button><button data-blmap-navigate="'+esc(s.id)+'">⌖ Navigate</button></div></section>';
 if(isPin(s)){
  const photos=window.BoreLabAsBuilt?.pinPhotos?.(s.id)||[];
  const fields=[s.station,s.size,s.material,s.depth?'Depth '+s.depth+' ft':'',s.connectionType,s.fittingType,s.dimensions].filter(Boolean);
  return '<section class="blmap-sheet" aria-label="Selected field pin details"><div class="blmap-sheet-handle"></div>'+
  '<div class="blmap-sheet-top"><span class="blmap-sheet-emblem">📌</span><div><strong>'+esc(s.name||pinLabel(s))+'</strong>'+
  '<small>'+esc(pinLabel(s))+' · '+esc(recordDate(s))+'</small></div>'+
  '<button data-blmap-close aria-label="Close selected pin">✕</button></div>'+
  '<div class="blmap-shot-details"><div><small>Type</small><strong>'+esc(pinLabel(s))+'</strong></div>'+
  '<div><small>Installed / recorded</small><strong>'+esc(recordDate(s))+'</strong></div>'+
  '<div><small>Location</small><strong>GPS saved'+(s.gpsAccuracy?' · ±'+esc(s.gpsAccuracy)+' m':'')+'</strong></div></div>'+ 
   (fields.length?'<p class="smalltext">'+esc(fields.join(' · '))+'</p>':'')+
   (photos.length?'<div class="fp-pin-photos">'+photos.slice(0,4).map(p=>'<button data-blmap-photo-detail="'+esc(p.id)+'"><img loading="lazy" src="'+esc(p.dataUrl)+'" alt="Linked photo"></button>').join('')+'</div>':'')+
  (s.address?'<p class="smalltext">'+esc(s.address)+'</p>':'')+
  (s.notes?'<p class="smalltext">'+esc(s.notes)+'</p>':'')+
  '<div class="blmap-sheet-actions"><button class="blmap-orange" data-blmap-edit-pin="'+esc(s.id)+'">✎ Edit Pin</button><button data-blmap-pin-camera="'+esc(s.id)+'">▣ Pin Camera</button>'+
  '<button data-blmap-navigate="'+esc(s.id)+'">⌖ Navigate</button>'+
  '<button data-blmap-close>✕ Close</button></div></section>';
 }
 const p=(api()?.photos?.()||[]).filter(p=>p.shotId===s.id&&(!p.jobId||p.jobId===st().activeJobId));
 const len=Number(s.feet)||0,done=s.status==='complete'?len:Math.min(len,Math.max(0,Number(s.progressFeet)||0));
 const pct=len?Math.round(done/len*100):0;
 const detail=window.BoreLabConduits?.summary?.(s)||s.pipeDiameter||'No conduit saved';
 return '<section class="blmap-sheet" aria-label="Selected bore details"><div class="blmap-sheet-handle"></div>'+
 '<div class="blmap-sheet-top"><span class="blmap-sheet-emblem">⌁</span><div><strong>'+esc(s.name||'Unnamed bore')+'</strong>'+
 '<small>Bore shot · '+esc(recordDate(s))+' · '+esc(s.address||'GPS location saved')+'</small></div><span class="blmap-status is-'+status(s)+'">'+statusText(status(s))+'</span>'+
 '<button data-blmap-close aria-label="Close selected shot">✕</button></div>'+
 '<div class="blmap-sheet-progress"><div class="blmap-between"><strong>'+fmt(done)+' / '+fmt(len)+' ft</strong><b>'+pct+'%</b></div>'+
 '<div class="blmap-meter"><span style="width:'+pct+'%"></span></div></div>'+
 '<div class="blmap-shot-details"><div><small>⌖ Location</small><strong>GPS Saved</strong></div>'+
 '<div><small>◈ Conduit</small><strong>'+esc(detail)+'</strong></div>'+
 '<div><small>▣ Photos</small><strong>'+p.length+'</strong></div></div>'+
 '<div class="blmap-sheet-actions"><button class="blmap-orange" data-blmap-open="'+esc(s.id)+'">▤ Open Shot</button>'+
 '<button data-blmap-navigate="'+esc(s.id)+'">⌖ Navigate</button><button data-blmap-photo="'+esc(s.id)+'">▣ Add Photo</button><button data-ab-path="'+esc(s.id)+'">⌁ Endpoints</button></div></section>';
}
function unlocatedSection(data){
 if(!data.unknown.length)return '<div class="blmap-locations-ok">✓ All saved bores and field markers have GPS pins.</div>';
 return '<details class="blmap-unlocated"><summary><span>⚠ <strong>'+data.unknown.length+' unlocated record'+(data.unknown.length===1?'':'s')+'</strong></span>'+
 '<small>Saved addresses or missing GPS coordinates</small></summary>'+
 '<div class="blmap-unlocated-body"><p>Only confirmed GPS coordinates are pinned. Add GPS to missing field markers before using this map in the field.</p>'+
 data.unknown.map(s=>'<button '+(isPin(s)?'data-blmap-unlocated-pin':'data-blmap-unlocated')+'="'+esc(s.id)+'"><span><strong>'+esc(s.name||'Unnamed record')+'</strong>'+
 '<small>'+esc(isPin(s)?pinLabel(s):'Bore shot')+' · '+esc(s.address||'No address entered')+'</small></span><b>Edit ›</b></button>').join('')+
 '<button class="blmap-locate" data-blmap-locate>⌖ Locate Saved Bore Addresses</button></div></details>';
}
function renderMap(){
 // Date filters belong to the previous job; clear before calculating new job totals.
 if(currentJob!==null&&currentJob!==(st().activeJobId||'job'))mapDay='';
 const data=model();ensureView(data);
 const legend='<div class="blmap-legend"><span><i class="blmap-legend-dot drilling"></i>Drilling</span>'+
 '<span><i class="blmap-legend-dot complete"></i>Complete</span><span><i class="blmap-legend-dot pending"></i>Pending</span>'+ 
  '<span><i class="blmap-legend-dot tie-in"></i>Tie-in</span><span><i class="blmap-legend-dot coupling"></i>Coupling</span><span><i class="blmap-legend-dot box"></i>Box</span>'+ 
 Object.entries(window.BoreLabFieldPins?.kindLabels||{}).filter(([k])=>!['tie-in','coupling','box'].includes(k)&&data.pins.some(p=>p.kind===k)).map(([k,l])=>'<span><b>'+esc(window.BoreLabFieldPins.symbolFor({kind:k}))+'</b> '+esc(l)+'</span>').join('')+
 '<span><b>A—B</b> Straight GPS reference</span></div>';
 const mapAvail=mapBounds().length>0;
 const box='<section class="blmap-mapbox"><div class="blmap-maphead"><strong>Jobsite Locations</strong>'+
 '<span>'+data.geocoded.length+' mapped / '+data.records.length+' total</span></div>'+
 '<div class="blmap-toolbar"><div class="blmap-layer-tabs" role="group" aria-label="Map layers">'+
 '<button data-blmap-mode="street" class="'+(mode==='street'?'active':'')+'" aria-pressed="'+(mode==='street')+'">Streets</button>'+
 '<button data-blmap-mode="plot" class="'+(mode==='plot'?'active':'')+'" aria-pressed="'+(mode==='plot')+'">Site Plot</button>'+
 '<button data-blmap-satellite '+(!mapAvail?'disabled':'')+'>Satellite ↗</button></div>'+
 '<button data-blmap-route aria-pressed="'+showPath+'" class="blmap-route-toggle'+(showPath?' active':'')+'">'+(showPath?'✓ ':'')+'Order</button></div>'+
 '<div class="blmap-viewport'+(mode==='plot'?' blmap-plot':'')+'" data-blmap-viewport tabindex="0" role="group" aria-label="Jobsite map, drag to pan and use zoom controls">'+
 '<div class="blmap-placeholder">'+(mapAvail?'Bore and installation GPS · '+(mode==='street'?'street tiles require internet':'offline site plot'):
 'No confirmed GPS pins for this job')+'</div>'+
 '<div class="blmap-scene" data-blmap-scene></div>'+
 (mapAvail?'<div class="blmap-mapcontrols"><button data-blmap-zoom="1" aria-label="Zoom in">+</button>'+
 '<button data-blmap-zoom="-1" aria-label="Zoom out">−</button>'+
 '<button data-blmap-fit aria-label="Fit all jobsite pins">⌖</button></div>':'')+
 (selectedPanel(data))+
 '</div><p class="blmap-attribution">'+(mode==='street'?'© OpenStreetMap contributors · ':'')+
 (mode==='street'?'Street tiles online · ':'Site plot · ')+'Pins from saved GPS</p>'+
 legend+'<p class="blmap-route-info">'+(showPath?'Dotted lines show a suggested shot sequence, <strong>not roads or travel directions</strong>.':
 'Tap a GPS pin or bore line to see the record. Hold an empty area of the map to place a symbol.')+'</p></section>';
 const html='<div class="page blmap-page"><header class="blmap-header"><div>'+
 '<span class="eyebrow">BORELAB FIELD / GPS PLANNING</span><h1>Interactive Jobsite Map</h1>'+
 '<p>'+esc(data.jobName)+'</p></div>'+weatherChip()+'</header>'+
 box+
 '<div class="blmap-filters" role="group" aria-label="Filter bore shot status">'+statusTabs(data)+'</div>'+ 
  '<div class="blmap-type-filters" role="group" aria-label="Filter pin type">'+typeTabs(data)+'</div>'+
 unlocatedSection(data)+
 '<div class="blmap-bottom"><button data-page="shotcards">◎ Smart Shot Cards</button>'+
 '<button data-action="new-shot" class="blmap-orange">＋ Add Bore</button><button data-blmap-new-pin>📌 Add Field Pin</button><button data-blmap-endpoints>⌁ Entry / Exit</button></div>'+
 '<p class="ab-map-note">Cyan/orange endpoint lines are straight GPS references only, not surveyed underground bore alignment.</p><p class="blmap-disclaimer">Map tiles are online-only. Bore and installed-location pins, dated records and the site plot remain usable offline. Check the actual jobsite before digging.</p>'+
 (window.BoreLabMapCalendarV31?.render?.(mapDay)||'')+'</div>';
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(draw);
 return html;
}
function visibleModels(data){
 const filtered=data.shown,groups=[],used=new Set(),precision=26;
 const width=document.querySelector('[data-blmap-viewport]')?.clientWidth||340;
 const height=document.querySelector('[data-blmap-viewport]')?.clientHeight||420;
 const center=project(view.center.lat,view.center.lon,view.zoom);
 for(const s of filtered){
  if(used.has(s.id))continue;
  const at=project(s.lat,s.lon,view.zoom);
  const pos={x:at.x-center.x+width/2,y:at.y-center.y+height/2};
  const cluster=[s];used.add(s.id);
  for(const other of filtered){
   if(used.has(other.id))continue;
   const q=project(other.lat,other.lon,view.zoom);
   const dx=q.x-center.x+width/2-pos.x,dy=q.y-center.y+height/2-pos.y;
   if(Math.hypot(dx,dy)<precision){cluster.push(other);used.add(other.id)}
  }
  groups.push({shots:cluster,x:pos.x,y:pos.y});
 }
 return{groups,width,height,center};
}
function markerHTML(s,x,y,cluster=1){
 const selectedMarker=s.id===selected,field=isPin(s),photo=isPhoto(s),kind=photo?'fieldPhoto':field?s.kind:status(s);
 const name=String(s.name||(photo?'Photo':field?pinLabel(s):'Bore'));
 const detail=photo?'Photo · '+recordDate(s):field?pinLabel(s)+' · '+recordDate(s):fmt(s.feet)+' ft';
 return '<button type="button" class="blmap-pin is-'+esc(kind)+(selectedMarker?' selected':'')+(cluster>1?' is-cluster':'')+
 '" data-blmap-pin="'+esc(s.id)+'" style="left:'+Math.round(x)+'px;top:'+Math.round(y)+'px" aria-label="'+esc(name)+
 ', '+esc(detail)+'"><span class="blmap-pin-icon"><em>'+(cluster>1?cluster:photo?'▣':field?esc(window.BoreLabFieldPins?.symbolFor?.(s)||'📌'):status(s)==='complete'?'✓':status(s)==='progress'?'⌁':'⌖')+
 '</em></span><span class="blmap-pin-label"><b>'+esc(name)+'</b><small>'+esc(detail)+(cluster>1?' · '+cluster+' records':'')+'</small></span></button>';
}
function renderMarkers(groups,width,height){
 return groups.filter(g=>g.x>-90&&g.x<width+90&&g.y>-70&&g.y<height+70).map(g=>markerHTML(g.shots[0],g.x,g.y,g.shots.length)).join('');
}
function tiles(center,width,height,z){
 if(mode!=='street')return '';
 const tile=256,size=2**z,minX=Math.floor((center.x-width/2)/tile)-1,maxX=Math.floor((center.x+width/2)/tile)+1;
 const minY=Math.floor((center.y-height/2)/tile)-1,maxY=Math.floor((center.y+height/2)/tile)+1;
 let html='',count=0;
 for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++){
  if(ty<0||ty>=size||++count>35)continue;
  const tileX=(tx%size+size)%size,px=tx*tile-center.x+width/2,py=ty*tile-center.y+height/2;
  html+='<img class="blmap-tile" src="https://tile.openstreetmap.org/'+z+'/'+tileX+'/'+ty+'.png" '+
   'alt="" decoding="async" loading="lazy" draggable="false" style="left:'+Math.round(px)+
   'px;top:'+Math.round(py)+'px" />';
 }
 return html;
}
function routePath(data,geom){
 if(!showPath)return '';
 const ordered=(api()?.orderedShots?.()?.order||[]).filter(s=>s.status!=='complete'&&api()?.coordsValid?.(s));
 const ids=new Set(data.shown.map(s=>s.id));
 const within=ordered.filter(s=>ids.has(s.id));
 if(within.length<2)return '';
 const points=within.map(s=>{
  const pt=project(s.lat,s.lon,view.zoom);
  return (pt.x-geom.center.x+geom.width/2).toFixed(1)+','+(pt.y-geom.center.y+geom.height/2).toFixed(1);
 }).join(' ');
 return '<svg class="blmap-lines" width="'+geom.width+'" height="'+geom.height+'" viewBox="0 0 '+geom.width+' '+geom.height+
 '" aria-hidden="true"><polyline points="'+points+'" fill="none" stroke="#f5821f" stroke-width="4" stroke-dasharray="4 9" stroke-linecap="round" /></svg>';
}
const validEndpoint=x=>x&&x.lat!==''&&x.lon!==''&&Number.isFinite(+x.lat)&&Number.isFinite(+x.lon)&&+x.lat>=-90&&+x.lat<=90&&+x.lon>=-180&&+x.lon<=180;
function actualEndpointPath(data,geom){
 const paths=data.shots.filter(s=>validEndpoint(s.asbuiltStart)&&validEndpoint(s.asbuiltEnd)&&inMapDay(s));
 if(!paths.length)return '';
 const lines=paths.map(s=>{
  const a=project(s.asbuiltStart.lat,s.asbuiltStart.lon,view.zoom),b=project(s.asbuiltEnd.lat,s.asbuiltEnd.lon,view.zoom);
  const x1=a.x-geom.center.x+geom.width/2,y1=a.y-geom.center.y+geom.height/2,x2=b.x-geom.center.x+geom.width/2,y2=b.y-geom.center.y+geom.height/2,pt=v=>v.toFixed(2);
  return '<line data-v25-boreline="'+esc(s.id)+'" x1="'+pt(x1)+'" y1="'+pt(y1)+'" x2="'+pt(x2)+'" y2="'+pt(y2)+'" stroke="#20d4c6" stroke-width="7" stroke-opacity=".75" stroke-linecap="round" style="pointer-events:stroke;cursor:pointer"/>'+
   '<circle cx="'+pt(x1)+'" cy="'+pt(y1)+'" r="5" fill="#20d4c6" stroke="#fff" stroke-width="2"/>'+
   '<circle cx="'+pt(x2)+'" cy="'+pt(y2)+'" r="5" fill="#f8a33c" stroke="#fff" stroke-width="2"/>';
 }).join('');
 return '<svg class="blmap-lines ab-endpoint-lines" width="'+geom.width+'" height="'+geom.height+'" viewBox="0 0 '+geom.width+' '+geom.height+'" aria-hidden="true">'+lines+'</svg>';
}
function draw(){
 const canvas=document.querySelector('[data-blmap-viewport]'),scene=canvas?.querySelector('[data-blmap-scene]');
 if(!canvas||!scene)return;
 const data=model();ensureView(data);
 if(!data.geocoded.length||!view.center){scene.innerHTML='';return}
 const geom=visibleModels(data);
 scene.innerHTML='<div class="blmap-tiles">'+tiles(geom.center,geom.width,geom.height,view.zoom)+'</div>'+
 routePath(data,geom)+actualEndpointPath(data,geom)+'<div class="blmap-pins">'+renderMarkers(geom.groups,geom.width,geom.height)+'</div>';
}
function choose(id){
 const item=activeRecords().find(x=>x.id===id);if(!item)return;
 selected=selected===id?null:id;
 api()?.render?.();
}
function pan(dx,dy){
 if(!view?.center)return;
 const c=project(view.center.lat,view.center.lon,view.zoom);
 view.center=unproject(c.x-dx,c.y-dy,view.zoom);
 draw();
}
function zoom(amount){
 if(!view?.center)return;
 view.zoom=clamp(view.zoom+Number(amount),3,18);
 draw();
}
function reset(){
 const p=fit(mapBounds().map(point),
 document.querySelector('[data-blmap-viewport]')?.clientWidth||340,
 document.querySelector('[data-blmap-viewport]')?.clientHeight||420);
 if(p){view=p;draw()}
}
function focusRecord(id){
 const s=activeRecords().find(x=>x.id===id);if(!s)return false;
 ensureView(model());selected=s.id;typeFilter='all';filter='all';
 if(api()?.coordsValid?.(s))view={center:point(s),zoom:Math.max(17,view?.zoom||15)};
 api()?.render?.();return true;
}
function focusPhoto(photo){
 if(!photo||!api()?.coordsValid?.(photo))return false;
 selectedPhoto={...photo,id:'photo:'+photo.id,photoId:photo.id,name:'Jobsite Photo',recordType:'fieldPhoto',occurredDay:window.BoreLabAsBuilt?.dayOf?.(photo.addedAt)||''};
 return focusRecord(selectedPhoto.id);
}
function clusterList(group){
 api()?.showModal?.('<div class="modal-head"><h2>📌 '+esc(group.shots.length+' records near this point')+'</h2><button type="button" class="icon-btn" data-action="close-modal">✕</button></div>'+
 '<p class="smalltext muted">Choose an installation or bore to open its location card.</p><div class="ab-cluster-list spaced">'+
 group.shots.map(s=>'<button data-blmap-cluster-select="'+esc(s.id)+'"><strong>'+esc(s.name||pinLabel(s))+'</strong><small>'+esc(isPhoto(s)?'Photo':isPin(s)?pinLabel(s):'Bore shot')+' · '+esc(recordDate(s))+'</small></button>').join('')+'</div>');
}
function navigate(s){
 if(!s)return;
 const url=api()?.mapsPinUrl?.(s);
 if(url)api()?.openMapUrl?.(url);
 else api()?.notify?.('Add an address or GPS coordinates to navigate.');
}
function satellite(){
 if(!view?.center)return;
 const center=view.center,coords=encodeURIComponent(center.lat.toFixed(6)+','+center.lon.toFixed(6));
 const url='https://www.google.com/maps/@?api=1&map_action=map&center='+coords+'&zoom='+Math.min(20,view.zoom)+'&basemap=satellite';
 api()?.openMapUrl?.(url);
}
document.addEventListener('change',e=>{if(!e.target.matches?.('[data-blmap-day]')||api()?.currentPage?.()!=='jobmap')return;mapDay=e.target.value;selected=null;api()?.render?.()});
document.addEventListener('click',e=>{
 const btn=e.target.closest?.('[data-blmap-filter],[data-blmap-type],[data-blmap-mode],[data-blmap-route],[data-blmap-fit],[data-blmap-zoom],[data-blmap-pin],[data-blmap-open],[data-blmap-navigate],[data-blmap-photo],[data-blmap-close],[data-blmap-locate],[data-blmap-unlocated],[data-blmap-unlocated-pin],[data-blmap-satellite],[data-blmap-edit-pin],[data-blmap-new-pin],[data-blmap-pdf],[data-blmap-day-clear],[data-blmap-cluster-select],[data-blmap-pin-camera],[data-blmap-photo-detail],[data-blmap-endpoints]');
 if(!btn||!api()||api().currentPage?.()!=='jobmap')return;
 if(btn.dataset.blmapFilter){filter=btn.dataset.blmapFilter;selected=null;saveSettings();api().render();return}
  if(btn.dataset.blmapType){typeFilter=btn.dataset.blmapType;selected=null;saveSettings();api().render();return}
 if(btn.dataset.blmapMode){mode=btn.dataset.blmapMode;saveSettings();api().render();return}
 if(btn.hasAttribute('data-blmap-route')){showPath=!showPath;saveSettings();api().render();return}
 if(btn.hasAttribute('data-blmap-fit')){reset();return}
 if(btn.dataset.blmapZoom){zoom(Number(btn.dataset.blmapZoom));return}
 if(btn.dataset.blmapPin){
  if(Date.now()<suppressClick)return;
  const data=model(),geom=visibleModels(data),group=geom.groups.find(g=>g.shots[0]?.id===btn.dataset.blmapPin);
  // Grouped pins open an interactive selection list.
   if(group&&group.shots.length>1)clusterList(group);
   else choose(btn.dataset.blmapPin);
  return;
 }
 if(btn.hasAttribute('data-blmap-pdf')){window.BoreLabAsBuilt?.exportAsBuilt?.();return}
  if(btn.hasAttribute('data-blmap-day-clear')){mapDay='';selected=null;api().render();return}
  if(btn.dataset.blmapClusterSelect){api().closeModal?.();focusRecord(btn.dataset.blmapClusterSelect);return}
  if(btn.dataset.blmapPinCamera){api().capturePinPhoto?.(btn.dataset.blmapPinCamera);return}
  if(btn.dataset.blmapPhotoDetail){api().photoDetail?.(btn.dataset.blmapPhotoDetail);return}
  if(btn.hasAttribute('data-blmap-close')){selected=null;selectedPhoto=null;api().render();return}
 if(btn.dataset.blmapOpen){api().shotDetail?.(btn.dataset.blmapOpen);return}
 if(btn.dataset.blmapNavigate){navigate(activeRecords().find(x=>x.id===btn.dataset.blmapNavigate));return}
 if(btn.dataset.blmapPhoto){api().photoChoose?.('camera',btn.dataset.blmapPhoto);return}
 if(btn.dataset.blmapUnlocated){api().shotDetail?.(btn.dataset.blmapUnlocated);return}
  if(btn.dataset.blmapUnlocatedPin){window.BoreLabFieldPins?.editPin?.(btn.dataset.blmapUnlocatedPin);return}
  if(btn.dataset.blmapEditPin){window.BoreLabFieldPins?.editPin?.(btn.dataset.blmapEditPin);return}
  if(btn.hasAttribute('data-blmap-new-pin')){window.BoreLabFieldPins?.editPin?.();return}
 if(btn.hasAttribute('data-blmap-endpoints')){const shots=activeShots();if(!shots.length)return api().notify('Add a bore first.');api().showModal('<div class="modal-head"><h2>Choose Bore Alignment</h2><button data-action="close-modal" class="icon-btn">✕</button></div>'+shots.map(s=>'<button class="btn ghost" style="width:100%;margin:5px 0" data-v25-select-bore="'+esc(s.id)+'">'+esc(s.name||'Bore')+'</button>').join(''));return}
 if(btn.hasAttribute('data-blmap-locate')){Promise.resolve(api().resolveMissingAddresses?.(true)).then(()=>api().render()).catch(e=>api().notify?.(String(e.message||e)));return}
 if(btn.hasAttribute('data-blmap-satellite')){satellite();return}
});
document.addEventListener('pointerdown',e=>{
 const el=e.target.closest?.('[data-blmap-viewport]');
 if(!el||!view?.center||api()?.currentPage?.()!=='jobmap')return;
 if(e.target.closest?.('button,.blmap-sheet'))return;
 pointerData.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointerData.size===1)gesture={x:e.clientX,y:e.clientY,moved:false,panX:0,panY:0};
 else if(pointerData.size===2){
  const p=[...pointerData.values()],dist=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
  gesture={pinch:true,distance:dist,zoom:view.zoom,changed:false};
 }
 try{el.setPointerCapture(e.pointerId)}catch{}
});
document.addEventListener('pointermove',e=>{
 if(!pointerData.has(e.pointerId)||!gesture)return;
 pointerData.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(gesture.pinch&&pointerData.size===2){
  const p=[...pointerData.values()],dist=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
  if(gesture.distance>0){
   const delta=Math.log2(dist/gesture.distance),next=clamp(Math.round(gesture.zoom+delta),3,18);
   if(next!==view.zoom){view.zoom=next;gesture.changed=true;draw()}
  }
  return;
 }
 if(gesture.pinch||pointerData.size!==1)return;
 const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
 if(Math.hypot(dx,dy)>5)gesture.moved=true;
 if(!gesture.moved)return;
 e.preventDefault();
 gesture.panX=dx;gesture.panY=dy;
 const scene=document.querySelector('[data-blmap-scene]');if(scene)scene.style.transform='translate('+dx+'px,'+dy+'px)';
},{passive:false});
function endPointer(e){
 if(!pointerData.has(e.pointerId))return;
 pointerData.delete(e.pointerId);
 if(gesture?.pinch){
  if(!pointerData.size){gesture=null;draw()}return;
 }
 if(gesture?.moved&&pointerData.size===0){
  const dx=gesture.panX,dy=gesture.panY;
  const scene=document.querySelector('[data-blmap-scene]');if(scene)scene.style.transform='';
  suppressClick=Date.now()+300;gesture=null;pan(dx,dy);return;
 }
 if(pointerData.size===0)gesture=null;
}
document.addEventListener('pointerup',endPointer);
document.addEventListener('pointercancel',endPointer);
document.addEventListener('wheel',e=>{
 if(!e.target.closest?.('[data-blmap-viewport]')||e.target.closest?.('.blmap-sheet')||api()?.currentPage?.()!=='jobmap')return;
 e.preventDefault();zoom(e.deltaY<0?1:-1);
},{passive:false});
document.addEventListener('keydown',e=>{
 const inside=e.target.closest?.('[data-blmap-viewport]');
 if(!inside||e.target.closest?.('.blmap-sheet')||api()?.currentPage?.()!=='jobmap')return;
 if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1)}
 if(e.key==='-'){e.preventDefault();zoom(-1)}
 if(e.key==='ArrowLeft'){e.preventDefault();pan(60,0)}
 if(e.key==='ArrowRight'){e.preventDefault();pan(-60,0)}
 if(e.key==='ArrowUp'){e.preventDefault();pan(0,60)}
 if(e.key==='ArrowDown'){e.preventDefault();pan(0,-60)}
});
document.addEventListener('error',e=>{
 if(e.target?.classList?.contains('blmap-tile')){
  tilesFailed=true;
  const note=document.querySelector('.blmap-placeholder');
  if(note&&mode==='street')note.textContent='Street tiles unavailable — GPS pins still available';
 }
},true);
window.addEventListener?.('resize',()=>{if(api()?.currentPage?.()==='jobmap')draw()});
window.BoreLabJobMap={renderMap,project,unproject,fit,markerHTML,renderMarkers,model,draw,reset,focusRecord,focusPhoto,actualEndpointPath,
 setDay:x=>{mapDay=/^\d{4}-\d{2}-\d{2}$/.test(String(x))?x:''},
 getView:()=>({...view}),getDay:()=>mapDay,setFilter:x=>{filter=x;},setTypeFilter:x=>{typeFilter=x;},setMode:x=>{mode=x;},setSelected:id=>{selected=id}};
})();
