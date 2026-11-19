'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('web/index.html','utf8');
const js=fs.readFileSync('web/jobsite-map.js','utf8');
const css=fs.readFileSync('web/jobsite-map.css','utf8');
const native=fs.readFileSync('app/src/main/java/com/borelab/field/BoreLabActivity.java','utf8');
assert.equal(html,fs.readFileSync('app/src/main/assets/web/index.html','utf8'),'web and Android HTML must match');
assert.equal(js,fs.readFileSync('app/src/main/assets/web/jobsite-map.js','utf8'));
assert.equal(css,fs.readFileSync('app/src/main/assets/web/jobsite-map.css','utf8'));
assert(html.includes('<script src="./jobsite-map.js"></script>')&&html.includes('jobsite-map.css'));
assert(html.includes("'jobmap'")&&html.includes('jobmap:()=>window.BoreLabJobMap?.renderMap()'));
assert(html.includes('resolveMissingAddresses,resolveShotAfterSave'));
assert(html.includes('data-page="jobmap"'));
assert(native.includes('BoreLabField/0.18'),'tile requests identify the Android app');
assert(!js.includes('referrerpolicy="no-referrer"'),'OSM tile requests must not strip referrer');
assert(js.includes('© OpenStreetMap contributors'));
assert(js.includes('button,.blmap-sheet'),'Shot sheet must not pan map');
assert(css.includes('.blmap-attribution{position:static'),'Attribution remains visible outside panel');
assert(js.includes('tile.openstreetmap.org/'));
assert(js.includes('Map tiles are online-only'));
assert(js.includes('not roads or travel directions'));
assert(!js.includes('prefetch')&&!js.includes('offline tile download'));
new Function(js);new Function(html.split('<script>')[1].split('</script>')[0]);
const complete={id:'s3',name:'Already Finished',status:'complete',feet:60,lat:'',lon:'',address:'Unresolved Street'};
const one={id:'s1',name:'Shot 01',status:'planned',feet:145,lat:'26.6330',lon:'-81.6580',address:'265 S Lindero'};
const two={id:'s2',name:'Shot 02',status:'progress',progressFeet:85,feet:155,lat:'26.6345',lon:'-81.6560',address:'268 S Lindero',rodCount:9};
const job={id:'j1',jobName:'South Glades',shots:[one,two,complete]};
const storage={jobs:[job],shots:job.shots,activeJobId:'j1',jobName:'South Glades'};
const isGeo=x=>x&&x.lat!==''&&x.lon!==''&&x.lat!=null&&x.lon!=null&&Number.isFinite(+x.lat)&&Number.isFinite(+x.lon);
let opened='',navigated='',changed=0,saved=0,photos=0,located=0;
const bridge={
 state:()=>storage,currentPage:()=> 'jobmap',
 coordsValid:isGeo,orderedShots:()=>({order:[one,two]}),
 photos:()=>[{shotId:'s2',jobId:'j1',stage:'before',dataUrl:'data:image/png;base64,a'}],
 todayLocal:()=> '2026-11-19',render:()=>{changed++},save:()=>{saved++},
 notify:()=>{},shotDetail:id=>{opened=id},mapsPinUrl:s=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(s.name),
 openMapUrl:url=>{navigated=url},photoChoose:()=>{photos++},
 resolveMissingAddresses:()=>{located++;return Promise.resolve({found:0})}
};
const listeners={};
const document={
 addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn)},
 querySelector:()=>null,
 querySelectorAll:()=>[],
 elementFromPoint:()=>null
};
const window={
 BoreLabAssistantBridge:bridge,
 BoreLabCommand:{weatherSnapshot:()=>null},
 BoreLabConduits:{summary:s=>'1 × 2" conduit'},
 addEventListener:()=>{}
};
const map=new Function('window','document','requestAnimationFrame',js+';return window.BoreLabJobMap;')(window,document,undefined);
assert(map,'map module exports correctly');
const m=map.model();
assert.equal(m.geocoded.length,2);
assert.equal(m.unknown.length,1);
assert.equal(m.groups.all,3);
assert.equal(m.groups.progress,1);
assert.equal(m.groups.complete,1);
assert.equal(m.groups.planned,1);
const v=map.project(26.633,-81.658,15),reverse=map.unproject(v.x,v.y,15);
assert(Math.abs(reverse.lat-26.633)<1e-6&&Math.abs(reverse.lon+81.658)<1e-6,'Mercator projection roundtrip');
const fit=map.fit([one,two].map(s=>({lat:+s.lat,lon:+s.lon})),330,430);
assert(fit&&fit.zoom>=3&&fit.zoom<=18&&fit.center.lat>26&&fit.center.lon<0);
assert.equal(map.fit([]),null);
assert.equal(map.renderMarkers([{shots:[two],x:150,y:150}],300,350).includes('Shot 02'),true);
assert(!map.renderMarkers([{shots:[complete],x:-1000,y:-1000}],300,350).includes('Already Finished'));
let screen=map.renderMap();
for(const token of ['Interactive Jobsite Map','South Glades','Streets','Site Plot','Satellite','Pending','Drilling',
 'Complete','2 mapped / 3 total','1 unlocated shot','Locate Saved Pending Addresses','Street tiles online','© OpenStreetMap contributors']){
 assert(screen.includes(token),'map screen missing '+token);
}
map.setMode('plot');
screen=map.renderMap();
assert(screen.includes('blmap-plot'),'plot mode is offline-ready');
map.setSelected('s2');
screen=map.renderMap();
for(const token of ['Shot 02','85 / 155 ft','Add Photo','Open Shot','Navigate','GPS Saved','1 × 2']){
 assert(screen.includes(token),'shot detail panel missing '+token);
}
map.setSelected(null);
const click=(dataset,attributes=[])=>{
 const t={dataset,hasAttribute:x=>attributes.includes(x)};
 for(const fn of listeners.click||[])fn({target:{closest:()=>t}});
};
click({blmapFilter:'progress'});
assert.equal(map.model().shown.length,1,'status filtering only selects drilling pins');
click({blmapFilter:'all'});
assert.equal(map.model().shown.length,2);
click({blmapOpen:'s2'});assert.equal(opened,'s2');
click({blmapPhoto:'s2'});assert.equal(photos,1);
click({blmapNavigate:'s2'});assert(navigated.includes('www.google.com/maps'));
click({},['data-blmap-satellite']);assert(navigated.includes('basemap=satellite'));
click({},['data-blmap-route']);assert(saved>=3,'filter, layer and path preferences persist');
assert(changed>=3,'controls rerender with state changes');
const home=fs.readFileSync('web/home-dashboard.js','utf8');
assert(home.includes("map:'Jobsite Map'")&&home.includes("data-page=\"jobmap\""));
// A newly geocoded address should center the map without switching jobs.
storage.activeJobId='j2';storage.jobName='Location Recovery';
storage.shots=[{id:'fresh',name:'New Scanned Shot',feet:120,status:'planned',lat:'',lon:'',address:'Scanned Address'}];
map.renderMap();
assert.equal(map.getView().center,null,'No saved GPS must not invent a map center');
storage.shots[0].lat='26.6500';storage.shots[0].lon='-81.6700';
map.renderMap();
const recovered=map.getView();
assert(recovered.center&&Math.abs(recovered.center.lat-26.65)<.0001,'New GPS pin should recenter map');
console.log('Jobsite Map: real pins, statuses, projection, map modes, offline plot, navigation, GPS recovery and Android wiring PASS');
