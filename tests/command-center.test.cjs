'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('web/index.html','utf8'),android=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const js=fs.readFileSync('web/field-command.js','utf8');
assert.equal(html,android);assert.equal(js,fs.readFileSync('app/src/main/assets/web/field-command.js','utf8'));
new Function(js);new Function(html.split('<script>')[1].split('</script>')[0]);
for(const page of ['command','shotcards','reelplan','photosmart','recovery','scan3'])assert(html.includes(page),page);
for(const token of ['renderShotCards','renderCommand','renderReelPlan','renderPhotoOrganizer','renderRecovery','renderScannerHub','data-blc-feet','data-blc-time','data-blc-tag','data-blc-refresh','api.open-meteo.com/v1/forecast'])assert(js.includes(token),token);
assert(html.includes('<script src="./field-command.js"></script>'));

const shot={id:'s1',name:'Main Crossing',feet:175,status:'progress',progressFeet:95,rodCount:12,currentDepth:8.4,address:'225 N Mayoral St'};
const job={id:'j1',jobName:'Demo Construction',shots:[shot],crew:[{id:'t1',name:'Drill Operator',start:new Date(Date.now()-3600000).toISOString(),end:''}]};
const saved={jobs:[job],shots:[shot],activeJobId:'j1',jobName:job.jobName,crew:job.crew,allowance:10,finishBySettings:{target:'16:00',pace:70},reels:[{id:'r1',name:'Main Reel',size:'4 in',remaining:500,location:'truck'}]};
const mockWindow={
 BoreLabAssistantBridge:{state:()=>saved,todayLocal:()=>new Date().toISOString().slice(0,10),orderedShots:()=>({order:[shot]}),
  coordsValid:()=>false,shop:()=>({lat:'',lon:''}),photos:()=>[],getPosition:()=>Promise.reject(Error('Not available'))},
 BoreLabDailyReels:{activeIds:()=>[]},
 BoreLabWorkday:{simulateReels:()=>({allocations:[],shortages:[],untracked:[],reels:[]})}
};
const mockDocument={addEventListener:()=>{},createElement:()=>({textContent:''}),head:{appendChild:()=>{}}};
const controller=new Function('window','document','localStorage',js+';return window.BoreLabCommand;')(
 mockWindow,mockDocument,{getItem:()=>null,setItem:()=>{}});
const out=controller.renderCommand();
for(const visible of ['Live Workday','blc-work-hero','blc-work-hero-actions','blc-work-summary','Today at a Glance',
 'Estimated finish','Target departure','Next 3 Shots','Crew Status','Reel / Pipe','Photos / Notes',
 'Weather / Conditions','Close Out Day','data-blc-time','blc-work-footer','225 N Mayoral St','95 / 175 ft','12']){
 assert(out.includes(visible),'Missing live dashboard section: '+visible);
}
assert((out.match(/blc-work-tile-heading/g)||[]).length===4,'Must render four compact workday tiles');
assert(!out.includes('NaN'),'No invalid numeric readings');
assert(controller.renderShotCards().includes('Smart Shot Cards'),'Existing shot cards must still render');
assert(out.includes('blc-quicktabs')&&out.includes('aria-current="page"'),'Live Workday has an accessible quick-tab bar');
for(const [view,name] of [['renderShotCards','shotcards'],['renderReelPlan','reelplan'],['renderPhotoOrganizer','photosmart']])assert(controller[view]().includes('blc-quicktab')&&controller[view]().includes('data-page="'+name+'"'),view+' missing tab switcher');
console.log('BoreLab Field command center and polished Live Workday 2.0 render: PASS');

