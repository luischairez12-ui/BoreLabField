'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('web/index.html','utf8'),android=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const js=fs.readFileSync('web/visual-polish.js','utf8'),css=fs.readFileSync('web/visual-polish.css','utf8');
assert.equal(html,android);assert.equal(js,fs.readFileSync('app/src/main/assets/web/visual-polish.js','utf8'));
assert.equal(css,fs.readFileSync('app/src/main/assets/web/visual-polish.css','utf8'));
assert(html.includes('<script src="./visual-polish.js"></script>'));
assert(html.includes('<link rel="stylesheet" href="./visual-polish.css">'));
new Function(js);new Function(html.split('<script>')[1].split('</script>')[0]);
assert(css.includes('.blv-reel-card')===false||css.length>2000);
const shot={id:'s1',name:'Shot 101',feet:175,progressFeet:85,status:'progress',
 address:'225 N Mayoral St',pipeDiameter:'4 in',rodCount:9,notes:'Document pipe returns'};
const job={id:'j1',jobName:'South Glades',shots:[shot],crew:[]};
const records={shots:[shot],jobs:[job],jobName:'South Glades',activeJobId:'j1',
 reels:[{id:'r1',name:'Reel A',size:'4 in',material:'HDPE',location:'truck',remaining:365}],
 pipeReservations:[]};
const allocation={reelId:'r1',shot,job,size:'4 in',feet:185,reel:'Reel A'};
const sim={allocations:[allocation],shortages:[],untracked:[],reels:[{id:'r1',remaining:180,available:365}]};
let click;
const doc={addEventListener:(event,fn)=>{if(event==='click')click=fn},querySelector:()=>null};
const win={
 BoreLabCommand:{reelPlan:()=>({chosen:records.reels,ids:['r1'],pending:[{job,shot}],simulation:sim})},
 BoreLabAssistantBridge:{state:()=>records,photos:()=>[],todayLocal:()=> '2026-11-18',
 coordsValid:()=>false,render:()=>{},save:()=>{},notify:()=>{}},
 BoreLabConduits:{summary:()=> '4 in HDPE',sizeKey:x=>String(x||'').toLowerCase()},
 BoreLabDailyReels:{renderSection:()=>'<div data-bl-reel-slot="0">Select</div>'}
};
const ui=new Function('window','document',js+';return window.BoreLabVisualPolish')(win,doc);
const before=ui.renderShotCards();
assert(before.includes('Smart Shot Cards')&&before.includes('Shot 101'));
assert(before.includes('data-blv-search')&&before.includes('data-blv-filter'));
click({target:{closest:()=>({dataset:{blvExpand:'s1'}})}});
const after=ui.renderShotCards();
for(const token of ['225 N Mayoral St','Document pipe returns','data-blv-feet','data-blv-map','data-blv-photo','Log Progress','Photos · 0','4 in HDPE'])assert(after.includes(token),token);
const reels=ui.renderReelPlan();
for(const token of ['Intelligent Reel Manager','Today’s Reel Loadout','Reel A','365 ft','185 ft planned','Recommended Pull Plan','Continuous-Length Shortages','Fitted Planned Runs','Choose Two Reels','data-blv-tab'])assert(reels.includes(token),token);
assert(!reels.includes('NaN'));
console.log('BoreLab Smart Shot Cards and Intelligent Reel Manager V2: PASS');
