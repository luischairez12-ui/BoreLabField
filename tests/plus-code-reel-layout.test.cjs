'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const locations=fs.readFileSync('web/locations-reels.js','utf8');
const html=fs.readFileSync('web/index.html','utf8');
const ops=fs.readFileSync('web/field-ops.js','utf8');
for(const file of ['locations-reels.js','index.html','field-ops.js','workday.js'])assert.equal(fs.readFileSync('web/'+file,'utf8'),fs.readFileSync('app/src/main/assets/web/'+file,'utf8'));
const snippet=locations.slice(locations.indexOf('function parseCoords('),locations.indexOf('function todayKey()'));
const api=new Function('supportedChars',snippet+'return {decodeFullPlusCode,recoverShortPlusCode,plusCodeLocality};')('23456789CFGHJMPQRVWX');
const short=api.recoverShortPlusCode('7XRX+RWP Big Cypress, Florida',{lat:26.3,lon:-81});
assert(short&&Math.abs(+short.lat-26.292092)<.001&&Math.abs(+short.lon+81.000171)<.001);
assert(api.decodeFullPlusCode('849VCWC8+R9'));
assert.equal(api.decodeFullPlusCode('7XRX+RWP'),null);
assert.equal(api.plusCodeLocality('7XRX+RWP Big Cypress, Florida'),'Big Cypress, Florida');
const section=locations.slice(locations.indexOf('function renderSection(){'),locations.indexOf("document.addEventListener('change',"));
function render(reels,slots){
 return new Function('bridge','selections','fmt','esc','reelOptions','currentDay',section+'return renderSection;')(
  ()=>({state:()=>({reels,dailyReelSelections:{}})}),()=>slots,n=>String(n),x=>String(x),()=>'','2026-11-18')();
}
for(const [reels,slots] of [[[],['','']],[[{id:'a',name:'4 inch reel',remaining:200,location:'truck'}],['a','']]]){
 const m=render(reels,slots);
 assert(m.startsWith('<section class="card spaced bl-daily-card">'));
 for(const label of ['data-bl-reel-slot="0"','data-bl-reel-slot="1"','Clear this date'])assert(m.includes(label));
}
assert(ops.includes('b.resolveShotAfterSave?.(shot.id)'));
assert(html.includes('decodeFullPlusCode?.(address)'));
assert(ops.includes('decodeFullPlusCode?.(address)'));
console.log('Plus Code GPS and two-reel responsive section regression tests passed.');
