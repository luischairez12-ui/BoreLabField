'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{webcrypto}=require('node:crypto');
const js=fs.readFileSync('web/local-accounts.js','utf8');
const css=fs.readFileSync('web/local-accounts.css','utf8');
const html=fs.readFileSync('web/index.html','utf8');
assert.equal(html,fs.readFileSync('app/src/main/assets/web/index.html','utf8'));
assert.equal(js,fs.readFileSync('app/src/main/assets/web/local-accounts.js','utf8'));
assert.equal(css,fs.readFileSync('app/src/main/assets/web/local-accounts.css','utf8'));
for(const token of [
 'data-local-auth="locked"','id="localAccountsGate"','local-accounts.css',
 '<script src="./local-accounts.js"></script>','localaccounts:()=>window.BoreLabLocalAccounts?.renderManage()',
 'guardNavigation(p)','isUnlocked()','data-la-lock',
 'window.BoreLabLocalAccounts?.guardJobSwitch?.()===false',
 'localaccounts'])assert(html.includes(token),'missing integration: '+token);
assert(js.includes('dataset.localRole'),'Account module sets the selected role');
assert(css.includes('html:not([data-local-auth="unlocked"]) .app-shell'));
assert(css.includes('html[data-local-role="crew"] .topbar #topNavButton'));
assert(css.includes('.la-account.selected')&&css.includes('.la-pin-keypad'));
const crew=fs.readFileSync('web/crew-mode.js','utf8'),supervisor=fs.readFileSync('web/supervisor-mode.js','utf8');
assert(crew.includes('if(pinRole())return roster().find'),'crew PIN must be pinned to member ID');
assert(crew.includes('if(pinRole())return;'),'crew cannot change identity with dropdown');
assert(supervisor.includes('if(supervisorPin()){selectedJob=t.dataset.smOpenJob;'),'Supervisor PIN cannot switch active foreman job');
assert(supervisor.includes('data-sm-lockhint'));
new Function(js);new Function(html.split('<script>')[1].split('</script>')[0]);
const storage=new Map();
const localStorage={
 getItem:k=>storage.has(k)?storage.get(k):null,
 setItem:(k,v)=>{storage.set(k,String(v))},
 removeItem:k=>storage.delete(k)
};
const gate={innerHTML:''},modal={innerHTML:''};
const events={},document={
 documentElement:{dataset:{}},
 querySelector:s=>s==='#localAccountsGate'?gate:s==='#modalRoot'?modal:null,
 addEventListener:(name,fn)=>{(events[name]??=[]).push(fn)},
 hidden:false
};
const appState={shots:[],jobs:[],roster:[{id:'person1',name:'Juan'},{id:'person2',name:'Miguel'}],crewPreviewMemberId:''};
let currentPage='home',saves=0,renders=0,pages=[],messages=[];
const bridge={
 state:()=>appState,save:()=>{saves++},
 currentPage:()=>currentPage,
 setPage:(page)=>{currentPage=page;pages.push(page);renders++},
 render:()=>{renders++},notify:x=>messages.push(x)
};
const window={BoreLabAssistantBridge:bridge,confirm:()=>true,addEventListener:()=>{}};
const api=new Function('window','document','localStorage','crypto','TextEncoder','setInterval',js+';return window.BoreLabLocalAccounts;')(
 window,document,localStorage,webcrypto,TextEncoder,()=>1);
assert(api);
assert.equal(api.isConfigured(),false);
assert.equal(api.isUnlocked(),false);
assert(gate.innerHTML.includes('Secure this device'),'first launch prompts Owner setup');
assert(!gate.innerHTML.includes('Unlock My Dashboard'));
async function run(){
 await api.firstSetup('Luis','123456','123456');
 assert.equal(api.isConfigured(),true);
 assert.equal(api.isUnlocked(),false);
 assert(gate.innerHTML.includes('Save your recovery code'));
 const recovery=(gate.innerHTML.match(/[0-9A-F]{4}(?:-[0-9A-F]{4}){5}/)||[])[0];
 assert(recovery&&recovery.length===29,'owner recovery code is 24 random hex characters');
 const local=storage.get('borelab-local-accounts-v1');
 assert(!local.includes('123456'),'plain PIN must not be saved');
 assert(!local.includes(recovery),'plain recovery code must not be saved');
 assert.equal(localStorage.getItem('borelab-field-v0.1'),null,'account storage must not rewrite job records');
 const dispatchClick=(dataset={},attrs=[])=>{
  const t={dataset,hasAttribute:n=>attrs.includes(n)};
  for(const fn of events.click||[])fn({target:{closest:()=>t}});
 };
 dispatchClick({},['data-la-finish-setup']);
 assert.equal(api.role(),'owner');
 assert.equal(api.isUnlocked(),true);
 assert.equal(currentPage,'home');
 assert.equal(document.documentElement.dataset.localAuth,'unlocked');
 assert(api.isAllowed('localaccounts'));
 assert(api.guardJobSwitch());
 assert(api.renderManage().includes('Saved Accounts'));
 const form=values=>({querySelector:selector=>{
  const key=(selector.match(/^\[name="([^"]+)"\]$/)||[])[1];
  return key?{value:values[key]??''}:null;
 }});
 await api.createAccount(form({role:'crew',memberId:'person1',pin:'246810',confirmPin:'246810',name:'Ignored'}));
 await api.createAccount(form({role:'supervisor',memberId:'',name:'Supervisor 1',pin:'354213',confirmPin:'354213'}));
 await api.createAccount(form({role:'foreman',memberId:'',name:'Foreman 1',pin:'908172',confirmPin:'908172'}));
 const accounts=api._test.getReview().users;
 assert.equal(accounts.length,4);
 const worker=accounts.find(a=>a.role==='crew'),sup=accounts.find(a=>a.role==='supervisor'),foreman=accounts.find(a=>a.role==='foreman');
 assert.equal(worker.memberId,'person1');
 assert.equal(worker.name,'Juan');
 assert(!storage.get('borelab-local-accounts-v1').includes('246810'));
 const oldCount=accounts.length;
 await api.createAccount(form({role:'crew',memberId:'person1',pin:'111111',confirmPin:'111111'}));
 assert.equal(accounts.length,oldCount,'duplicate crew member profile is blocked');
 api.lock();
 assert(!api.isUnlocked());
 assert.equal(document.documentElement.dataset.localAuth,'locked');
 assert(gate.innerHTML.includes('Who’s working today?'));
 assert(!api.guardNavigation('home'));
 api.chooseAccount(worker.id);
 await api.unlockAccount(worker.id,'000000');
 assert(!api.isUnlocked(),'incorrect PIN never unlocks');
 assert(worker.failed===1);
 await api.unlockAccount(worker.id,'246810');
 assert.equal(api.role(),'crew');
 assert.equal(currentPage,'crewpreview');
 assert.equal(appState.crewPreviewMemberId,'person1');
 assert(api.isAllowed('crewpreview'));
 assert.equal(api.isAllowed('home'),false);
 assert.equal(api.isAllowed('localaccounts'),false);
 assert.equal(api.guardJobSwitch(),false);
 assert.equal(api.guardNavigation('settings'),false);
 assert(!api.guardNavigation('home'),'crew Exit Preview locks rather than showing Foreman');
 assert.equal(api.role(),'locked');
 api.chooseAccount(sup.id);
 await api.unlockAccount(sup.id,'354213');
 assert.equal(api.role(),'supervisor');
 assert.equal(currentPage,'supervisorpreview');
 assert.equal(api.guardJobSwitch(),false);
 assert.equal(api.guardNavigation('crewmanager2'),false);
 assert.equal(api.isAllowed('supervisorpreview'),true);
 api.lock();
 api.chooseAccount(foreman.id);
 await api.unlockAccount(foreman.id,'908172');
 assert.equal(api.role(),'foreman');
 assert(api.isAllowed('home'));assert(api.isAllowed('planner'));
 assert.equal(api.isAllowed('localaccounts'),false);
 api.lock();
 api.chooseAccount(accounts.find(x=>x.role==='owner').id);
 await api.unlockAccount(accounts.find(x=>x.role==='owner').id,'123456');
 assert.equal(api.role(),'owner');
 api.toggleAccount(worker.id);
 assert.equal(worker.active,false);
 api.lock();
 await api.unlockAccount(worker.id,'246810');
 assert.equal(api.role(),'locked','disabled profile cannot unlock');
 api.chooseAccount(accounts.find(x=>x.role==='owner').id);
 await api.unlockAccount(accounts.find(x=>x.role==='owner').id,'123456');
 await api.resetPin(sup.id,'555555','555555');
 assert(!storage.get('borelab-local-accounts-v1').includes('555555'));
 api.lock();
 await api.unlockAccount(sup.id,'354213');
 assert.equal(api.role(),'locked','old reset PIN no longer works');
 await api.unlockAccount(sup.id,'555555');
 assert.equal(api.role(),'supervisor','newly reset PIN unlocks');
 api.lock();
 const owner=accounts.find(x=>x.role==='owner');
 await api.ownerRecovery(recovery,'789012','789012');
 assert.equal(api._test.state().stage,'recovery-created');
 const newCode=(gate.innerHTML.match(/[0-9A-F]{4}(?:-[0-9A-F]{4}){5}/)||[])[0];
 assert(newCode&&newCode!==recovery,'recovery code rotates');
 dispatchClick({},['data-la-finish-setup']);
 assert.equal(api.role(),'owner');
 assert(!storage.get('borelab-local-accounts-v1').includes('789012'),'new owner PIN remains hashed');
 api.lock();
 await api.unlockAccount(owner.id,'789012');
 assert.equal(api.role(),'owner');
 assert(saves>0&&renders>0&&pages.includes('crewpreview')&&pages.includes('supervisorpreview'));
 console.log('Local PIN Accounts: first-time setup, salted verifiers, owner recovery, profile management, role navigation, crew binding, lockout and offline storage PASS');
}
run().catch(e=>{console.error(e);process.exitCode=1});
