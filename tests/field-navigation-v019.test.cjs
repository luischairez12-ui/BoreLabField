'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('web/index.html'),android=read('app/src/main/assets/web/index.html');
assert.equal(html,android,'Browser and Android index must match byte-for-byte');
const script=read('web/field-navigation.js'),css=read('web/field-navigation.css'),home=read('web/home-dashboard.js');
for(const path of ['field-navigation.js','field-navigation.css','home-dashboard.js']){
 assert.equal(read('web/'+path),read('app/src/main/assets/web/'+path),'Web/Android parity: '+path);
 assert(html.includes('./'+path),'App must load '+path);
}
new Function(script);new Function(home);new Function(html.split('<script>')[1].split('</script>')[0]);
assert(html.indexOf('field-navigation.css')>html.indexOf('local-accounts.css'),'Unified field skin loads after older CSS');
assert(html.indexOf('field-navigation.js')>html.indexOf('local-accounts.js'),'Drawer loads after role guards');
assert(!html.includes('id="bfMenuButton"')&&html.includes('class="bf-edge-tab" data-bf-drawer')&&html.includes('aria-controls="bfRightDrawer"'),'Edge launcher replaces redundant top hamburger');
assert(html.includes('class="bf-edge-tab"'),'Right-thumb slide-out handle is present');
assert(html.includes('data-page="crew" aria-label="Crew and time"'),'Crew now has a bottom-nav shortcut');
assert(html.includes('data-page="planner"')&&html.includes('aria-label="Add a bore shot"'),'Existing Bore and Add shot shortcuts remain');
assert(html.includes('window.BoreLabNavigation?.close?.()'),'Navigation closes drawer when changing screens');
assert(html.includes('window.BoreLabNavigation?.isOpen?.()'),'Android Back closes drawer before leaving screen');
assert(html.includes('window.BoreLabNavigation?.syncPage?.(page)'),'Drawer tracks actual app page');
assert(html.includes("const mode='daylight';")&&html.includes("state.theme='daylight';"),'White and orange is a single current default');
assert(!html.includes('data-theme-select>'),'Unused night theme selector must not offer an inconsistent second skin');
assert(html.includes('BoreLab Field · v0.31.0'),'New design ships as v0.19');
assert(home.includes('bf-home-jobline')&&home.includes('data-bf-menu-action="quick"'),'Dashboard has job and thumb-friendly photo shortcut');
assert(home.includes('data-page="fieldhistory"'),'Home links to the existing Calendar | Atlas page');
assert(css.includes('.bf-right-drawer')&&css.includes('right:max(0px'),'Drawer slides from right');
assert(css.includes('.bf-quick-main')&&css.includes('.bf-quick-choices'),'Photo and installation actions are visible');
assert(css.includes('.bf-drawer-link.active')&&css.includes('min-height:59px'),'Drawer uses large tap targets and selected states');
assert(css.includes('html[data-theme="daylight"] .bh-hero'),'Dashboard hero follows white/orange design');
assert(css.includes('html[data-theme="daylight"] .atlas-frame'),'Atlas offline canvas follows design');
assert(css.includes('prefers-reduced-motion'),'Animation respects user accessibility settings');
assert(script.includes("if(!enabled())return"),'Right-side drawer requires owner or foreman PIN');
assert(script.includes("bridge()?.photoChoose?.('camera')"),'Camera quick action uses existing capture system');
for(const kind of ['coupling','box','tie-in'])assert(script.includes("data-bf-menu-action=\""+kind+"\""),kind+' installation quick action');
assert(script.includes("window.BoreLabFieldPins?.editPin?.('',kind)"),'Pin actions use existing installation record form');
assert(script.includes("page:'fieldhistory'")&&script.includes("page:'jobmap'")&&script.includes("page:'tools'"),'Menu uses registered pages rather than invented routes');
assert(script.includes("panel.inert=true")&&script.includes("aria-hidden"),'Closed drawer is inert and hidden from accessibility tree');
assert(script.includes("if(!open)show();if(open)toggleQuick()"),'Dashboard quick action opens drawer choices even when drawer starts closed');
const handlers={};
let currentRole='owner',unlocked=true;
const doc={readyState:'loading',documentElement:{dataset:{}},body:{style:{}},
 addEventListener:(type,cb)=>{(handlers[type]??=[]).push(cb)},
 querySelector:()=>null,querySelectorAll:()=>[]};
const win={BoreLabAssistantBridge:{currentPage:()=> 'home',state:()=>({jobName:'South Glades'})},
 BoreLabLocalAccounts:{role:()=>currentRole,isUnlocked:()=>unlocked},
 addEventListener:()=>{}};
const nav=new Function('window','document',script+'; return window.BoreLabNavigation;')(win,doc);
assert(nav&&typeof nav.close==='function'&&typeof nav.open==='function'&&typeof nav.syncPage==='function');
assert(!nav.isOpen(),'Drawer starts closed');
nav.syncPage('home');
assert.equal(doc.documentElement.dataset.bfNav,'ready','Owner can access navigation');
assert.equal(doc.documentElement.dataset.bfPage,'home');
currentRole='crew';nav.syncPage('crewpreview');
assert.equal(doc.documentElement.dataset.bfNav,'disabled','Crew must not see owner tools');
currentRole='supervisor';nav.syncPage('supervisorpreview');
assert.equal(doc.documentElement.dataset.bfNav,'disabled','Supervisor role keeps its restricted workspace');
currentRole='foreman';nav.syncPage('jobmap');
assert.equal(doc.documentElement.dataset.bfNav,'ready','Foreman can access navigation');
unlocked=false;nav.syncPage('home');
assert.equal(doc.documentElement.dataset.bfNav,'disabled','Drawer stays hidden behind PIN gate');
const pages=new Set(nav.shortcuts.map(x=>x.page));
assert(pages.size===nav.shortcuts.length,'Do not duplicate drawer routes');
for(const page of ['home','planner','shotboard','crew','fieldhistory','jobmap','photos','closeout','tools','search','settings'])assert(pages.has(page),'Missing drawer route '+page);
assert(!script.includes('localStorage.setItem'),'Navigation layer must not mutate local data');
console.log('BoreLab v0.19: consistent white/orange UI, right-side ergonomic drawer, thumb photo/pin actions, route integrity, role restrictions and Android mirroring PASS');
