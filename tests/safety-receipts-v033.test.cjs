'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8'),html=read('web/index.html'),inline=html.split('<script>')[1].split('</script>')[0];
assert.equal(html,read('app/src/main/assets/web/index.html'),'Android and browser HTML must be identical');
for(const file of ['safety-contacts-v033.js','receipts-v033.js','safety-receipts-v033.css','field-media-v025.js','local-accounts.js','field-navigation.js','streamlined-v029.js','crew-mode.js']){
 assert.equal(read('web/'+file),read('app/src/main/assets/web/'+file),'Android/browser mismatch: '+file);
 if(file.startsWith('safety-')||file.startsWith('receipts-'))assert(html.includes('./'+file),'Missing HTML asset: '+file);
}
for(const p of ['web/safety-contacts-v033.js','web/receipts-v033.js','web/field-media-v025.js','web/local-accounts.js','web/field-navigation.js'])new Function(read(p));
new Function(inline);
const allow=inline.match(/const BORELAB_PAGES=new Set\((\[[^;]+\])\);/);
assert(allow,'Allowed page list missing');assert(new Function('return '+allow[1])().includes('safetycontacts'),'Safety screen not registered');
assert(inline.includes('safetycontacts:()=>window.BoreLabSafetyContactsV33'),'Safety page not wired');
assert(inline.includes('const receipts=await(window.BoreLabReceiptsV33?.exportRecords?.()'),'Backups missing receipt bytes');
assert(inline.includes('receipts,drafts:'),'Receipt payload absent from JSON backup');
assert(inline.includes('replaceAll?.(receiptImport)'),'Receipt restore missing');
assert(inline.includes('replaceAll?.(previousReceipts)'),'Receipt rollback missing');
assert(inline.includes("await window.BoreLabReceiptsV33?.clear?.()"),'Reset must clear receipt data');
assert(inline.includes("const KEY='borelab-field-v0.1'"),'User storage key unexpectedly changed');
assert(read('web/local-accounts.js').includes("if(page==='safetycontacts')return true"),'Signed-in crew must read safety contacts');
assert(read('web/crew-mode.js').includes('data-page="safetycontacts"'),'Crew safety shortcut missing');
assert(read('web/field-navigation.js').includes("name:'811 & Safety'"),'Sidebar shortcut missing');
assert(read('web/streamlined-v029.js').includes("homeTile('safetycontacts'"),'Field Command safety card missing');
const listeners={};let renders=0,saved=0,modal='',role='owner',uid=0;
const state={activeJobId:'job1',jobName:'Main Line 22',jobs:[{id:'job1',jobName:'Main Line 22'}],safetyContactsV33:[]};
const bridge={state:()=>state,currentPage:()=> 'photos',uid:()=> 'receipt-'+(++uid),notify:()=>{},render:()=>renders++,save:()=>saved++,
 showModal:t=>modal=t,closeModal:()=>{}};
const windowObj={BoreLabAssistantBridge:bridge,BoreLabLocalAccounts:{pinTestMode:()=>false,role:()=>role,isUnlocked:()=>true},confirm:()=>true};
const doc={addEventListener:(event,cb)=>(listeners[event]??=[]).push(cb),querySelector:()=>null};
vm.runInNewContext(read('web/safety-contacts-v033.js'),{window:windowObj,document:doc,Date,FormData,console});
const safety=windowObj.BoreLabSafetyContactsV33;
assert(safety.render().includes('tel:811')&&safety.render().includes('tel:911'),'Both quick-dial numbers visible');
assert(!safety.validPhone('javascript:alert(1)'),'Invalid number accepted');
let c=safety.addContact({name:'Gas Utility Dispatch',phone:'(239) 555-0123',category:'Utility Emergency',notes:'Example number for testing'});
assert(c.ok,'Contact addition failed');assert.equal(state.safetyContactsV33.length,1);
assert(safety.render().includes('Gas Utility Dispatch')&&safety.render().includes('tel:2395550123'));
role='crew';assert(!safety.render().includes('data-b33-new'),'Crew cannot edit contacts');
assert.equal(safety.addContact({name:'Other',phone:'555-0102'}).ok,false,'Crew should be read-only');
role='owner';assert(safety.removeContact(c.id).ok,'Contact removal failed');
const database=new Map();
const fakeIndexedDB={open:()=>{const request={};queueMicrotask(()=>{
  const d={objectStoreNames:{contains:()=>true},
   transaction:()=>({objectStore:()=>({
    getAll:()=>operation('getAll'),put:v=>operation('put',v),
    clear:()=>operation('clear'),delete:id=>operation('delete',id)}),close:()=>{}}),close:()=>{}};
  request.result=d;request.onsuccess?.();});return request}};
function operation(op,v){const request={};queueMicrotask(()=>{
 if(op==='getAll')request.result=[...database.values()];
 if(op==='put'){database.set(v.id,v);request.result=v.id}
 if(op==='clear'){database.clear();request.result=undefined}
 if(op==='delete'){database.delete(v);request.result=undefined}
 request.onsuccess?.();});return request}
class MockFileReader{
 readAsDataURL(file){this.result=file.dataURL;queueMicrotask(()=>this.onload?.())}
}
class MockFormData{
 constructor(form){this.fields=form.fields||{}}
 get(name){return this.fields[name]??''}
 entries(){return Object.entries(this.fields)[Symbol.iterator]()}
}
const PDF64='JVBERi0xLjQKJUVPRg==';
vm.runInNewContext(read('web/receipts-v033.js'),{window:windowObj,document:doc,indexedDB:fakeIndexedDB,
 queueMicrotask,Date,FileReader:MockFileReader,FormData:MockFormData,Number,String,Object,Array,JSON,Promise,
 console,URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},Image:class{},Uint8Array,atob,clearInterval,setInterval});
(async()=>{
 const receipt=windowObj.BoreLabReceiptsV33;
 await receipt.refresh();assert.equal(receipt.records().length,0);
 const file={type:'application/pdf',name:'diesel.pdf',size:1024,dataURL:'data:application/octet-stream;base64,'+PDF64};
 await receipt.pickFile(file);
 assert(modal.includes('Save Receipt')&&modal.includes('receipt-form'),'Receipt detail modal missing');
 const form={dataset:{id:''},fields:{vendor:'Fuel Station',receiptDate:'2026-11-20',amount:'82.45',notes:'Truck diesel'}};
 const result=await receipt.saveForm(form);assert(result.ok,'Receipt save failed: '+result.error);
 assert.equal(receipt.records().length,1,'Receipt not indexed');
 assert.equal(receipt.records()[0].mime,'application/pdf');
 assert(receipt.records()[0].dataUrl.startsWith('data:application/pdf;base64,'),'PDF MIME not normalized');
 assert.equal(receipt.records()[0].jobId,'job1','Receipt not linked to active job');
 assert(receipt.records()[0].receiptDate==='2026-11-20');
 const list=await receipt.exportRecords();assert.equal(list.length,1);
 assert(receipt.valid(list[0]),'Backup copy failed validation');
 await receipt.clear();assert.equal(receipt.records().length,0);
 await receipt.replaceAll(list);assert.equal(receipt.records().length,1);
 windowObj.BoreLabAssistantBridge.photos=()=>[];
 windowObj.BoreLabAssistantBridge.activeJob=()=>state.jobs[0];
 windowObj.BoreLabNative=null;
 vm.runInNewContext(read('web/field-media-v025.js'),{window:windowObj,document:doc,Number,String,Object,Array,Date,JSON,console});
 const media=windowObj.BoreLabMediaV25.render();
 assert(media.includes('Upload Receipt')&&media.includes('Scan Receipt'),'Receipt actions missing in Media Vault');
 assert(media.includes('Receipts')&&media.includes('Fuel Station'),'Saved receipt not visible in Vault');
 assert(!media.includes('<img loading="lazy" src="data:application/pdf'),'PDF was incorrectly rendered as an image');
 assert(media.includes('PDF RECEIPT'),'PDF card marker missing');
 assert(saved>=2,'Saved local data callbacks not used');
 console.log('BoreLab v0.33 811 contacts, crew read-only access, receipt PDF upload, backup restore and Media Vault PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
