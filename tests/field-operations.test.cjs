'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const js=src.split('<script>')[1]?.split('</script>')[0];
assert(js,'Missing BoreLab JS');
new Function(js);

const coordsValid=o=>o&&o.lat!==''&&o.lon!==''&&o.lat!=null&&o.lon!=null&&Number.isFinite(Number(o.lat))&&Number.isFinite(Number(o.lon))&&Math.abs(Number(o.lat))<=90&&Math.abs(Number(o.lon))<=180;
const mapFns=js.slice(js.indexOf('function mapPoint(o){'),js.indexOf('function routeMap(order){'));
assert(mapFns.includes('function mapsPinUrl(o)'), 'A shot pin needs a Maps link');
assert(mapFns.includes('function openMapUrl(url)'), 'Map navigation handler missing');
const getPinUrl=new Function('coordsValid',mapFns+'return mapsPinUrl;')(coordsValid);
assert.match(getPinUrl({lat:'26.75',lon:'-81.44',address:'Some Street'}),/google\.com\/maps\/search\/\?api=1&query=26\.75%2C-81\.44/);
assert.match(getPinUrl({lat:'',lon:'',address:'A Shop Street, Florida'}),/A%20Shop%20Street%2C%20Florida/);
assert.equal(getPinUrl({lat:'',lon:'',address:''}),'');
assert(src.includes('data-action="open-map-pin"'), 'Pins must be clickable');
assert(src.includes('data-action="open-full-route"'), 'Full route action missing');
assert(src.includes('data-action="open-map-pin" data-id='), 'Shot navigate button missing');
assert(src.includes("case 'open-full-route'"), 'Full route event missing');

const equipmentStart=js.indexOf('function equipmentSummary(');
const equipmentEnd=js.indexOf('function equipmentForm(',equipmentStart);
assert(equipmentStart>=0&&equipmentEnd>equipmentStart,'Equipment summary missing');
const equipFn=new Function('state',js.slice(equipmentStart,equipmentEnd)+'return equipmentSummary;')({equipment:[
{id:'drill',name:'JT20',type:'Drill'},
{id:'locator',name:'Falcon F5',type:'Locator'}]});
assert.match(equipFn({equipmentIds:['drill','locator']}),/JT20 \(Drill\), Falcon F5 \(Locator\)/);
assert.equal(equipFn({equipmentIds:[]}), 'None selected');
assert(src.includes("form.dataset.form==='equipment'"),'Equipment save handler missing');
assert(src.includes('name="equipmentId"'),'Shot equipment chooser missing');
assert(src.includes('name="pipeUsed"'),'Actual pipe input missing');
assert(src.includes('name="rodCount"'),'Rod count input missing');
assert(src.includes('name="entryDepth"')&&src.includes('name="exitDepth"'),'Depth inputs missing');
assert(src.includes("case 'gallery-for-shot'"),'Gallery attachments missing');
assert(src.includes('Linked Photos ('),'Shot photo list missing');
assert(src.includes('shot.updatedAt=now'),'Shot progress timestamps missing');
assert(src.includes('data-report-scope'),'Report filter missing');
assert(src.includes('Actual pipe footage logged:'),'Report actual pipe missing');
assert(src.includes('Crew Hours')&&src.includes('Jobsite Photos'),'Report data missing');
assert(src.includes("const KEY='borelab-field-v0.1'"),'Local data key must remain stable across upgrades');
console.log('BoreLab v0.4 maps, equipment, pipe, shot and report checks passed.');
