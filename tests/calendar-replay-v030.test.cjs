'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('web/index.html'),android=read('app/src/main/assets/web/index.html');
assert.equal(html,android,'Web and Android interface must match');
for(const file of ['field-navigation.js','asbuilt-2.js','field-atlas.js','replay-card-v030.js','replay-card-v030.css']){
 assert.equal(read('web/'+file),read('app/src/main/assets/web/'+file),'Unmirrored '+file);
 if(file.includes('replay-card'))assert(html.includes('./'+file),'Missing replay-card asset import');
}
const nav=read('web/field-navigation.js'),abCode=read('web/asbuilt-2.js'),atlasCode=read('web/field-atlas.js'),
 insightsCode=read('web/field-insights.js'),inlineCode=read('web/replay-card-v030.js');
for(const src of [nav,abCode,atlasCode,insightsCode,inlineCode,html.split('<script>')[1].split('</script>')[0]])new Function(src);
assert(!nav.includes('class="bf-drawer-job"'),'Sidebar no longer duplicates current job');
assert(nav.includes('bfDrawerUniversalInput'),'Universal sidebar search is retained');
assert(!abCode.includes("'<div class=\"ab-global-search\">"),'Duplicate Calendar search panel removed');
assert(!abCode.includes('data-ab-view="replay"'),'Replay is not a standalone visible tab');
assert(abCode.includes('renderReplayCard?.(selected)'),'Selected day embeds Replay');
assert(atlasCode.includes('renderReplayCard?.(replayDay)'),'Selecting a dated map pin embeds Replay');
assert(html.includes('BoreLab Field · Records stay on this device'),'Version is updated');
assert(html.includes("const KEY='borelab-field-v0.1'"),'Offline records use the same storage key');
const date='2026-11-19';
const shot={id:'s1',name:'North bore',feet:175,status:'complete',lat:26.6,lon:-81.6,
 startedAt:'2026-11-19T08:15:00-05:00',completedAt:'2026-11-19T11:00:00-05:00'};
const pin={id:'p1',name:'Day-only coupling',kind:'coupling',occurredDay:date,lat:26.61,lon:-81.61};
const job={id:'j1',jobName:'South Glades',shots:[shot],fieldPins:[pin],crew:[]};
const state={activeJobId:'j1',jobs:[job],shots:job.shots,history:[],pipeMoves:[],mudLogs:[],mudStockMoves:[],fieldRecovery:[]};
const callbacks={};
const doc={addEventListener:(k,fn)=>(callbacks[k]??=[]).push(fn),querySelector:()=>null,hidden:false};
const bridge={state:()=>state,photos:()=>[],activeJob:()=>job,currentPage:()=> 'fieldhistory',render:()=>{},notify:()=>{}};
const win={BoreLabAssistantBridge:bridge,addEventListener:()=>{}};
const ab=new Function('window','document',abCode+';return window.BoreLabAsBuilt')(win,doc);
const insight=new Function('window','document','setInterval','clearInterval',insightsCode+';return window.BoreLabInsights')(win,doc,()=>1,()=>{});
new Function('window','document','setInterval','clearInterval',inlineCode)(win,doc,()=>1,()=>{});
const atlas=new Function('window','document',atlasCode+';return window.BoreLabAtlas')(win,doc);
ab.setDay(date);
const page=ab.renderCalendar();
assert(!page.includes('Find records by job, date')&&!page.includes('Search in')&&!page.includes('Search All Jobs'),'Calendar no longer has competing search UI');
assert(!page.includes('data-ab-view="replay"')&&page.includes('data-ab-view="insights"'),'Only Calendar, Atlas and Insights tabs remain');
assert(page.includes('data-bi-replay-card="'+date+'"'),'Date selection reveals Replay card');
const dayCard=insight.renderReplayCard(date);
assert(dayCard.includes('data-bi-card-play')&&dayCard.includes('data-bi-card-time'),'Playback and timeline are inline');
assert(dayCard.includes('North bore')&&dayCard.includes('Day-only coupling'),'Replay includes timed and untimed records');
assert.equal(insight.recordedMinute(ab.eventsOn(date).find(e=>e.record.id==='p1')),null,'Date-only pin never receives invented time');
const borePin=atlas.points().find(p=>p.record.id==='s1');
assert(borePin&&atlas.card(borePin).includes('data-bi-replay-card="'+date+'"'),'Map bore selection shows day replay card');
const undated={...borePin,events:[],dates:['Date not recorded']};
assert(!atlas.card(undated).includes('data-bi-replay-card'),'Undated pins do not invent a replay day');
console.log('v0.30 sidebar cleanup, Calendar date replay, Atlas bore replay, timestamp safety and mirrored APK sources PASS');
