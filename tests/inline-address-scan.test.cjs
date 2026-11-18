'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('web/index.html','utf8');
const apk=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const upgrade=fs.readFileSync('web/field-upgrades.js','utf8');
const apkUpgrade=fs.readFileSync('app/src/main/assets/web/field-upgrades.js','utf8');
const loc=fs.readFileSync('web/locations-reels.js','utf8');
const apkLoc=fs.readFileSync('app/src/main/assets/web/locations-reels.js','utf8');
const android=fs.readFileSync('app/src/main/java/com/borelab/field/BoreLabActivity.java','utf8');
assert.equal(html,apk,'Browser and APK markup must match');
assert.equal(upgrade,apkUpgrade,'Address UI scanner must match Android');
assert.equal(loc,apkLoc,'Location parser must match Android');
new Function(html.split('<script>')[1].split('</script>')[0]);
new Function(upgrade);new Function(loc);
assert(html.includes('form data-form="guided-bore"'));
assert(html.includes('name="address" placeholder="Street, crossing, or landmark"'));
assert(html.includes('id="shotAddress" name="address"'));
const install=upgrade.slice(upgrade.indexOf('function installScanButtons(){'),upgrade.indexOf('const camera=document.createElement'));
assert(install.includes('form[data-form="shot"]')&&install.includes('form[data-form="guided-bore"]'),
 'Both guided and full bore forms must expose camera beside the address');
assert(install.includes("address.replaceWith(inputRow)"));
assert(install.includes("shutter.dataset.fieldUpgrade='scan-camera'"));
assert(install.includes("inputRow.append(shutter)"),'Camera button should sit alongside address input');
assert(install.includes('Scan address from paperwork'),'Camera must be accessible');
assert(upgrade.includes('window.BoreLabNative.scanAddressPhoto(data)'),'Photo must use address-only OCR rather than batch importer');
assert(!upgrade.includes('scanShotSheet('),'Address workflow must not start shot-sheet scan');
assert(upgrade.includes('scanContext.input.value=proposed.slice(0,250)'),'Use Address fills input, not job list');
assert(!upgrade.includes('state.shots.push('),'Address scanner must never create a shot');
assert(upgrade.includes("oneButton('Use Address','apply-address')"),'Review should have clear Use Address action');
assert(upgrade.includes('Nothing is saved automatically.'),'OCR must not save without user confirming');
assert(upgrade.includes('Bore lengths, conduit quantities, and work orders are ignored.'));
assert(android.includes('scanAddressPhoto(String dataUrl)'));
assert(android.includes('recognizeAddressPhoto(dataUrl)'));
const locStart=loc.indexOf('function parseCoords('),locEnd=loc.indexOf('function todayKey()',locStart);
const tools=new Function(loc.slice(locStart,locEnd)+'return {findStreet,locationCandidates};')();
const fixtures=[
 ["Glades Electric Cooperative\nUnderground Form\nWork Order # / District\n872919\nSOUTH\nName\nJUAN CONTRERAS\nAddress\n265 S LINDERO\nPhone Number\n(786) 443-0333\n2.5 inch Roll Pipe Qty 122 ft",'265 S LINDERO'],
 ["Work Order 870980\nSOUTH\nAddress\n225 N MAYORAL ST\nPhone Number",'225 N MAYORAL ST'],
 ["Work Order 872919\nName JUAN CONTRERAS\nAddress 265 S LINDERO Phone Number",'265 S LINDERO'],
 ["Work Order 872919\nAddress\n265\nS\nLINDERO\nPhone Number",'265 S LINDERO'],
 ["2.5 inch Roll Pipe\nQty 122 ft\nPhone Number (786) 443-0333",'']
];
for(const [ocr,expected] of fixtures){
 assert.equal(tools.findStreet(ocr),expected);
 assert.equal(tools.locationCandidates(ocr).find(x=>x.kind==='street')?.value||'',expected);
}
const candidateSource=upgrade.slice(upgrade.indexOf('function candidateAddress('),upgrade.indexOf('function scanNotice(',upgrade.indexOf('function candidateAddress(')));
const candidate=new Function(candidateSource+'return candidateAddress;')();
assert.equal(candidate('Address\n265 S LINDERO'),'265 S LINDERO');
assert.equal(candidate('Address\n225 N Mayoral St'),'225 N Mayoral St');
assert.equal(candidate('CONDUIT 4 INCH\nQty 122 ft'),'','Conduit quantity must not be mistaken for an address');
console.log('BoreLab v0.17.1: inline guided/full bore address camera, address-only OCR, Glades form address extraction and review protections passed.');
