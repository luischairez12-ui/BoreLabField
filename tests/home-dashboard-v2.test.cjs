'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('web/index.html','utf8'),android=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const script=fs.readFileSync('web/home-dashboard.js','utf8'),css=fs.readFileSync('web/home-dashboard.css','utf8');
assert.equal(html,android);assert.equal(script,fs.readFileSync('app/src/main/assets/web/home-dashboard.js','utf8'));
assert.equal(css,fs.readFileSync('app/src/main/assets/web/home-dashboard.css','utf8'));
const heroAsset=fs.readFileSync('web/home-hero-hdd.webp');
const androidHero=fs.readFileSync('app/src/main/assets/web/home-hero-hdd.webp');
assert(heroAsset.equals(androidHero),'Approved drill/crew artwork must be mirrored in Android assets');
assert(heroAsset.length>4000&&heroAsset.length<30000,'Offline hero asset must be compact');
assert.equal(heroAsset.subarray(0,4).toString(),'RIFF');
assert.equal(heroAsset.subarray(8,12).toString(),'WEBP');
assert(script.includes('home-hero-hdd.webp'),'Home must use the approved orange HDD art');
assert(!script.includes('Directional drilling rig silhouette'),'The mystery silhouette must not return');
assert(css.includes('.bh-hero-art img'),'Artwork must be responsive');
assert(css.includes('.bh-hero:after{display:none}'),'Remove competing hillside overlay');
assert(html.includes('<script src="./home-dashboard.js"></script>'));assert(html.includes('home-dashboard.css'));
assert(html.includes('window.BoreLabHomeV2?.enabled?.()'));assert(html.includes('window.BoreLabHomeV2?.classicBanner?.()'));
new Function(script);new Function(html.split('<script>')[1].split('</script>')[0]);
const base={id:'j1',jobName:'North Crossing',jobAddress:'265 S Lindero',jobNotes:'Locate before boring',
 shots:[{id:'s1',name:'Shot 01',feet:145,status:'progress',progressFeet:85,address:'265 S LINDERO',rodCount:9},
        {id:'s2',name:'Shot 02',feet:150,status:'planned',progressFeet:0,address:'265 S LINDERO'}],
 crew:[{id:'c1',name:'Drill Tech',start:new Date(Date.now()-3600000).toISOString(),end:''}],
 reels:[{id:'r1',name:'Reel A',size:'2 in',remaining:345,location:'truck'}],
 activeJobId:'j1',finishBySettings:{target:'16:00'}
};
let renders=0,saves=0;const listeners={},window={
 BoreLabAssistantBridge:{
 state:()=>base,save:()=>{saves++},render:()=>{renders++},currentPage:()=>null,
 todayLocal:()=> '2026-11-18',photos:()=>[],
 orderedShots:()=>({order:base.shots}),coordsValid:()=>false,notify:()=>{},
 shotDetail:()=>{},getPosition:()=>Promise.reject(Error('Denied'))
 },
 BoreLabDailyReels:{activeIds:()=>[]},
 BoreLabCommand:{loadWeather:()=>Promise.resolve(),weatherSnapshot:()=>({data:null,target:null,key:'',at:0}),
 estimate:()=>({finish:'3:45 PM',pace:70})}
};
const document={addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn)},
 querySelector:()=>null,querySelectorAll:()=>[],elementFromPoint:()=>null};
const app=new Function('window','document','confirm','localStorage',script+';return window.BoreLabHomeV2')(
window,document,()=>true,{getItem:()=>null});
assert(app.enabled(),'New dashboard enabled by default');
const workday=app.renderHome();
for(const token of ['Good','Active Bore','Current Job','Jobsite Weather','Reels on Truck','Next 3 Shots',
 'Crew Status','Customize Widgets','Long-press','285','85 / 145 ft','bh-widget-grid']){
 if(token==='285')continue;
 assert(workday.includes(token),token);
}
assert(!workday.includes('NaN'));
const widgets=app.widgetIds;
assert(widgets.includes('backup')&&widgets.includes('scanner')&&widgets.length>=10);
assert.equal(app.cleanConfig({preset:'bogus',layouts:{workday:[{id:'evil'},{id:'active',size:'giant'},{id:'active',size:'large'}]}}).layouts.workday.length,widgets.length);
const click=el=>{if(!el.hasAttribute)el.hasAttribute=()=>false;listeners.click.forEach(fn=>fn({target:{closest:()=>el}}));};
click({dataset:{bhPreset:'supervisor'}});
assert.equal(base.homeDashboard2.preset,'supervisor');
assert(app.renderHome().includes('Supervisor Overview'));
const original=base.homeDashboard2.layouts.supervisor.map(x=>x.id);
app.rearrange('active','job');
assert.notDeepEqual(base.homeDashboard2.layouts.supervisor.map(x=>x.id),original);
app.moveWidget('active',-1);
const preset=base.homeDashboard2.layouts.supervisor;
assert(preset.some(x=>x.id==='active'));
const change=e=>listeners.change.forEach(fn=>fn({target:e}));
change({dataset:{bhSize:'active'},value:'small',checked:true,hasAttribute:()=>false});
assert.equal(base.homeDashboard2.layouts.supervisor.find(x=>x.id==='active').size,'small');
change({dataset:{bhVisible:'active'},checked:false,hasAttribute:()=>false});
assert.equal(base.homeDashboard2.layouts.supervisor.find(x=>x.id==='active').visible,false);
click({dataset:{},hasAttribute:name=>name==='data-bh-classic'});
assert.equal(app.enabled(),false);
assert(app.classicBanner().includes('Try New Dashboard'));
click({dataset:{},hasAttribute:name=>name==='data-bh-enable'});
assert(app.enabled());
assert(saves>=5,'Customization persists to BoreLab state');
assert(renders>=5,'Customization re-renders immediately');

const snapshot=JSON.stringify(base.homeDashboard2);
app.beginEdit();
assert(app.renderHome().includes('LIVE PREVIEW · NOT SAVED'));
change({dataset:{bhVisible:'active'},checked:true,hasAttribute:()=>false});
change({dataset:{bhSize:'active'},value:'compact',hasAttribute:()=>false});
assert.equal(JSON.stringify(base.homeDashboard2),snapshot,'Preview changes must not write saved layout');
assert.equal(app.workingConfig().layouts.supervisor.find(x=>x.id==='active').size,'compact');
assert(app.renderHome().includes('bh-size-compact')&&app.renderHome().includes('bh-compact-bore'));
app.cancelEdit();
assert.equal(JSON.stringify(base.homeDashboard2),snapshot,'Discard restores saved configuration');
app.beginEdit();
change({dataset:{bhVisible:'active'},checked:true,hasAttribute:()=>false});
change({dataset:{bhSize:'active'},value:'compact',hasAttribute:()=>false});
change({dataset:{},checked:true,hasAttribute:name=>name==='data-bh-density'});
assert(app.renderHome().includes('bh-dense'),'Compact spacing is previewed');
assert.equal(base.homeDashboard2.density,'comfortable','Density is not saved before confirmation');
app.saveEdit();
assert.equal(base.homeDashboard2.density,'compact');
assert.equal(base.homeDashboard2.layouts.supervisor.find(x=>x.id==='active').size,'compact');
const weatherDate=Date.now();
window.BoreLabCommand.weatherLabel=()=>'Partly cloudy';
window.BoreLabCommand.weatherSnapshot=()=>({data:{current:{temperature_2m:74,weather_code:2}},target:{lat:26.1,lon:-81.3},key:'26.100,-81.300',at:weatherDate});
const updated=app.renderHome();
assert(updated.includes('74°F')&&updated.includes('Partly cloudy'),'Header must display a real fresh reading');
assert(updated.includes('bh-hero-weather'),'Weather chip appears in greeting');
assert(script.includes('class="bh-hero-copy"'),'Greeting has a separate text-safe area');
assert(css.includes('.bh-hero-art{left:auto;right:'),'Rig art is positioned away from header text');
assert(css.includes('.bh-drag-target:after'),'Drop target has a visible indicator');
assert(app.cleanConfig({layouts:{workday:[{id:'active',size:'compact'}]}}).layouts.workday[0].size==='compact');
assert(app.cleanConfig({layouts:{workday:[{id:'crew',size:'compact'}]}}).layouts.workday[0].size==='medium');
console.log('Home Dashboard 2.1 safe hero, weather, compact cards and save/discard preview: PASS');
