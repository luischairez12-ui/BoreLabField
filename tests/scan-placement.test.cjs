'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('web/index.html','utf8');
const android=fs.readFileSync('app/src/main/assets/web/index.html','utf8');
const scan=fs.readFileSync('web/shot-sheet.js','utf8');
const appScan=fs.readFileSync('app/src/main/assets/web/shot-sheet.js','utf8');
assert.equal(html,android,'Web and Android index must match');
assert.equal(scan,appScan,'Importer must match Android asset');
new Function(html.split('<script>')[1].split('</script>')[0]);
new Function(scan);
assert.equal((html.match(/data-sheet-action="open"/g)||[]).length,2,
  'Scan button should appear only in the guided and full new bore forms');
assert(html.includes("step===1?'<div class=\"card spaced ux-shot-scan-option\""),
  'Guided Add Bore first step has paperwork option');
assert(html.includes("!exists?'<div class=\"card spaced ux-shot-scan-option\""),
  'Advanced New Bore has paperwork option');
const jobsStart=html.indexOf('function renderJobs(){');
const jobs=html.slice(jobsStart,html.indexOf('function jobRecordsForDay(',jobsStart));
const plannerStart=html.indexOf('function renderPlanner(){');
const planner=html.slice(plannerStart,html.indexOf('\nfunction ',plannerStart+30));
assert(!jobs.includes('data-sheet-action="open"'),'Remove scan from My Jobs');
assert(!planner.includes('data-sheet-action="open"'),'Remove scan from route planning');
assert(html.includes('closeModal,clearGuidedDraft'),'Importer bridge can clean up Add Bore');
assert(scan.includes("scannerSource=button?.closest('form[data-form]')?.dataset.form||''"),
  'Importer remembers originating Add Bore form');
assert(scan.includes("if(originatingForm==='guided-bore')api().clearGuidedDraft?.()"),
  'Guided scan import clears abandoned guided draft');
assert(scan.includes("if(originatingForm==='guided-bore'||originatingForm==='shot')api().closeModal?.()"),
  'After import close Add Bore form');
assert(scan.includes("if(btn.dataset.blsAction==='back')return closeScanner()"),
  'Cancel returns to Add Bore');
assert(scan.includes("if(!root.querySelector('#bls-confirm')?.checked)"),
  'Import must require review');
assert(html.includes('BoreLab Field · v0.22.0'));
assert(html.includes('data-page="shotboard"'),'Today’s Shot Board should be available from Home');
console.log('Scan placement regression checks passed.');
