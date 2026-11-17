'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const js=source.split('<script>')[1]?.split('</script>')[0];
assert(js,'Embedded BoreLab JavaScript must exist');
new Function(js);
const a=js.indexOf('function coordsValid(o){');
const b=js.indexOf('function mapPoint(o){',a);
assert(a>=0&&b>a,'Routing functions must be present');
const route=js.slice(a,b);
const compute=state=>new Function('state','const feet=s=>Math.max(0,Number(s.feet)||0);\n'+route+'\nreturn orderedShots();')(state);
const shots=[
  {id:'a',name:'Shot 01',feet:70,lat:'26.75',lon:'-81.45',status:'planned'},
  {id:'b',name:'Shot 02',feet:150,lat:'26.77',lon:'-81.50',status:'planned'},
  {id:'c',name:'Shot 03',feet:70,lat:'26.72',lon:'-81.48',status:'planned'}
];
const plan=(mode,home,ss=shots)=>compute({routeMode:mode,shots:ss,shopLat:home?'26.71':'',shopLon:home?'-81.41':''});
assert(!plan('toward',false).usable,'Toward shop must not claim optimization without shop GPS');
assert.match(plan('toward',false).message,/Shop GPS/);
assert.equal(plan('short',false).order.at(-1).id,'a','Shortest bore must move to end even without GPS');
assert.equal(plan('short_near',false).order.at(-1).id,'a');
assert.match(plan('short_near',false).message,/cannot choose.*nearest/i);
assert(plan('drive',false).usable,'Inter-shot distance mode should work even if the shop is missing');
assert.match(plan('drive',false).message,/Shop GPS is missing/);
assert.equal(plan('toward',true).order[0].id,'b','Farthest located shot should come first');
assert(plan('drive',true).allGeo);
assert(Number.isFinite(plan('drive',true).estimate));
const partial=shots.map((s,i)=>i===1?{...s,lat:'',lon:''}:s);
assert(!plan('drive',true,partial).allGeo);
assert.equal(plan('drive',true,partial).order.at(-1).id,'b','Missing GPS shots stay unoptimized');
assert(source.includes('Active plan: '),'UI must label selected mode');
console.log('BoreLab route planner checks passed.');
