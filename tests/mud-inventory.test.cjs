'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const js=src.split('<script>')[1]?.split('</script>')[0];
assert(js);new Function(js);
const pdf=fs.readFileSync('app/src/main/java/com/borelab/field/FieldPdfExporter.java','utf8');
assert(pdf.includes('section("Mud product stock movements")'));
assert(js.includes("mudStockMoves:[]")&&js.includes("if(!Array.isArray(state.mudStockMoves))state.mudStockMoves=[]"));
assert(js.includes("mudstock:renderMudInventory")&&js.includes("case 'go-mud-stock':setPage('mudstock')"));
assert(js.includes("form.dataset.form==='mud-stock'"));
assert(js.includes("mudStock:copy(r.mudStock)"),'Closeout snapshot must freeze inventory ledger');
assert(js.includes("mudStock:r.mudStock.map("),'PDF must include inventory ledger');
const state={mudProducts:[
 {id:'b',name:'Test Bentonite',unit:'lb',rate:25,perGallons:100,stockTracked:false},
 {id:'p',name:'Test Polymer',unit:'qt',rate:2,perGallons:500,stockTracked:false},
 {id:'unknown',name:'Untracked',unit:'lb',rate:1,perGallons:100,stockTracked:false}
 ],mudStockMoves:[],mudLogs:[],mudSelectedIds:['b','p'],
 mudTank:{capacity:'1000',currentGallons:'0',targetGallons:'500',levelChoice:'custom',mode:'fresh'},
 jobName:'Test HDD Job'};
const familyStart=js.indexOf('function mudUnitFamily('),stockForm=js.indexOf('function mudStockForm(',familyStart);
assert(familyStart>=0&&stockForm>familyStart);
const pure=new Function('state',js.slice(familyStart,stockForm)+
 'return {mudUnitFamily,convertMudQty,mudRound,mudPackageSizeInDoseUnit,mudAvailable,mudStockAssessment};')(state);
const {convertMudQty,mudAvailable,mudRound,mudStockAssessment}=pure;
assert.equal(convertMudQty(5,'gal','qt'),20);
assert.equal(convertMudQty(16,'oz (weight)','lb'),1);
assert.equal(convertMudQty(2,'bags','gal'),null);
assert.equal(convertMudQty(50,'lb','fl oz'),null);
const events=[],saves=[],fakeId=()=>String(events.length+saves.length+Date.now());
const stockStart=js.indexOf('function saveMudStock('),stockEnd=js.indexOf('function renderMudInventory(',stockStart);
assert(stockStart>0&&stockEnd>stockStart);
const saveMudStock=new Function('state','convertMudQty','mudAvailable','mudRound','uid','save','closeModal','render','notify','fmt',
 js.slice(stockStart,stockEnd)+'return saveMudStock;')
(state,convertMudQty,mudAvailable,mudRound,fakeId,()=>saves.push(1),()=>{},()=>{},msg=>events.push(msg),(n)=>Number(n).toFixed(3));
const stockFormFor=id=>({dataset:{id}});
saveMudStock(stockFormFor('b'),{packageSize:'50',packageUnit:'lb',packages:'8',mode:'set',note:'Eight bags'});
assert.equal(state.mudProducts[0].stockQty,400);
assert.equal(pure.mudPackageSizeInDoseUnit(state.mudProducts[0]),50);
saveMudStock(stockFormFor('p'),{packageSize:'5',packageUnit:'gal',packages:'2',mode:'set',note:'Two buckets'});
assert.equal(state.mudProducts[1].stockQty,40,'2×5 gal converted to 40 qt');
saveMudStock(stockFormFor('p'),{packageSize:'5',packageUnit:'gal',packages:'1',mode:'remove',note:'Missing bucket'});
assert.equal(state.mudProducts[1].stockQty,20);
saveMudStock(stockFormFor('p'),{packageSize:'5',packageUnit:'gal',packages:'6',mode:'remove'});
assert.equal(state.mudProducts[1].stockQty,20,'Cannot reduce inventory below zero');
const configStart=js.indexOf('function mudConfig('),nameStart=js.indexOf('function guessMudProductName(',configStart);
assert(configStart>=0&&nameStart>configStart);
const {mudConfig,mudLevelInputValues,calculateMud}=new Function('state','mudProductReady',js.slice(configStart,nameStart)+
 'return {mudConfig,mudLevelInputValues,calculateMud};')(state,p=>Number(p.rate)>0&&Number(p.perGallons)>0);
let plan=calculateMud();
assert(plan.ok);
assert.equal(plan.added,500);
assert.equal(mudStockAssessment(plan).filter(x=>x.status==='enough').length,2);
const mixStart=js.indexOf('function saveMudPlan('),mixEnd=js.indexOf('function saveMudLevel(',mixStart);
assert(mixStart>=0&&mixEnd>mixStart);
const confirms=[];
const saveMudPlan=new Function('state','mudLevelInputValues','mudProductReady','calculateMud','mudStockAssessment','mudRound','fmt','confirm','uid','save','render','notify',
 js.slice(mixStart,mixEnd)+'return saveMudPlan;')
(state,mudLevelInputValues,p=>Number(p.rate)>0&&Number(p.perGallons)>0,calculateMud,mudStockAssessment,mudRound,
 n=>Number(n).toFixed(3),txt=>{confirms.push(txt);return true;},fakeId,()=>saves.push(1),()=>{},msg=>events.push(msg));
const form={querySelectorAll:()=>[{value:'b'},{value:'p'}]};
const inputs={capacity:'1000',currentGallons:'0',targetGallons:'500',levelChoice:'custom',mode:'fresh',soil:'sand',notes:'Test'};
saveMudPlan(form,inputs,false);
assert.equal(state.mudProducts[0].stockQty,400,'Preview cannot deduct stock');
assert.equal(state.mudLogs.length,0);
saveMudPlan(form,inputs,true);
assert.equal(state.mudLogs.length,1);
assert.equal(state.mudLogs[0].products[0].dose,125);
assert.equal(state.mudProducts[0].stockQty,275,'Bentonite deducted 125 lb');
assert.equal(state.mudProducts[1].stockQty,18,'Polymer deducted 2 qt');
assert.equal(state.mudStockMoves.filter(x=>x.kind==='mix').length,2);
assert.equal(state.mudTank.lastMixId,state.mudLogs[0].id);
assert.equal(state.mudTank.contentsStatus,'recorded');
assert.equal(state.mudTank.currentGallons,'500');
const oldCount=state.mudLogs.length;
state.mudProducts[0].stockQty=10;
saveMudPlan(form,{...inputs,currentGallons:'500',targetGallons:'1000',mode:'topoff'},true);
assert.equal(state.mudLogs.length,oldCount,'Insufficient tracked stock must block actual mix');
assert.equal(state.mudProducts[0].stockQty,10);
assert(events.some(x=>x.includes('Not enough tracked stock')));
const levelStart=js.indexOf('function saveMudLevel('),levelEnd=js.indexOf('function archiveMudProduct(',levelStart);
const saveMudLevel=new Function('state','mudConfig','mudLevelInputValues','save','closeModal','render','notify',
 js.slice(levelStart,levelEnd)+'return saveMudLevel;')
(state,mudConfig,mudLevelInputValues,()=>{},()=>{},()=>{},()=>{});
saveMudLevel({levelChoice:'quarter',currentGallons:'999'});
assert.equal(state.mudTank.currentGallons,'250');
assert.equal(state.mudTank.contentsStatus,'adjusted','Level-only changes must not imply known current chemistry');
assert.equal(state.mudStockMoves.filter(x=>x.kind==='mix').length,2,'Level change cannot deduct chemicals');
console.log('BoreLab MixLab Pro v0.8: package conversions, tracked stock, shortages, real-batch deductions, history and mixture status passed.');
