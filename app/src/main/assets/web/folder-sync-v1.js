/* Field foreground folder sync */
(function install(){
'use strict';
const api=()=>window.BoreLabAssistantBridge,allowed=()=>window.BoreLabLocalAccounts?.guardJobSwitch?.()===true,N=()=>window.BoreLabSyncFolder,K='borelab-folder-sync-field-v1',LIMIT=2000000;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const load=()=>{try{return JSON.parse(localStorage.getItem(K)||'{}')}catch{return {}}};let cfg=load(),busy=false,last='Not connected',inbox=[];
const save=()=>localStorage.setItem(K,JSON.stringify(cfg));const id=()=>globalThis.crypto?.randomUUID?.().replace(/-/g,'')||String(Date.now())+Math.random().toString(36).slice(2);
async function hash(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(n=>n.toString(16).padStart(2,'0')).join('')}
const check=v=>{if(typeof v!=='string'||v.startsWith('ERROR:'))throw Error(v||'Folder unavailable');return v};
function folder(){return N()?.folder?.()||''}
function context(){if(!allowed())throw Error('Owner or foreman access required');const a=api(),s=a.state(),j=a.activeJob();if(!j||j.archived||j.demo)throw Error('Choose a real active project');return {a,s,j}}
function names(){return JSON.parse(check(N().list())).filter(n=>/^BLX_[a-z0-9]+_[a-f0-9]{24}_\d{13}_[a-z0-9]+\.json$/.test(n))}
function latest(rows){const m=new Map();for(const n of rows){const [,device,project,stamp]=n.split('_');if(device===cfg.device)continue;const k=device+'_'+project;if(!m.has(k)||m.get(k).localeCompare(n)<0)m.set(k,n)}return [...m.values()].sort((a,b)=>b.split('_')[3].localeCompare(a.split('_')[3]))}
async function tick(force=false){
 if(busy||!allowed()||document.hidden||!folder())return;busy=true;
 try{const grant=folder();inbox=latest(names());const c=context(),enabled=cfg.grant===grant&&cfg.project===c.j.id;
 if(!enabled&&!force){last=inbox.length+' incoming project file(s) · auto publish off';return}
 if(!enabled)throw Error('Enable publication for this project first');
 const core=window.BoreLabCalendarConnect?.core;if(!core)throw Error('Connect unavailable');
 if(!c.j.connectProjectId)throw Error('Link this project through Connect first');
 const v=core.snapshot({...c.j,connectTimeEntries:[]},[],c.s.pipeMoves||[],false);
 const p=v.project;p.bores=p.bores.map(({activity,...b})=>b);
 const content=JSON.stringify(p),digest=await hash(content),project= (await hash(p.id)).slice(0,24);
 if(!allowed()||document.hidden||folder()!==grant||api().activeJob()?.id!==c.j.id||cfg.grant!==grant||cfg.project!==c.j.id)throw Error('Sync context changed');
 if(cfg.digest!==digest){const n='BLX_'+cfg.device+'_'+project+'_'+String(Date.now()).padStart(13,'0')+'_'+id().slice(0,12)+'.json',body=JSON.stringify(v);if(new TextEncoder().encode(body).length>LIMIT)throw Error('Snapshot exceeds 2 MB');check(N().write(n,body));cfg.digest=digest;cfg.published=new Date().toISOString();save();}
 last='Checked '+new Date().toLocaleTimeString()+' · '+inbox.length+' incoming';
 }catch(e){last=e.message}finally{busy=false;const node=document.querySelector('#bsync-status');if(node)node.textContent=last}}
function open(){if(!allowed())return;const a=api(),s=a.state(),j=a.activeJob(),connected=!!folder(),enabled=cfg.grant===folder()&&cfg.project===j?.id&&connected;const head='<div class="modal-head"><h2>Folder Sync</h2><button class="icon-btn" data-action="close-modal">✕</button></div>';
 a.showModal(head+'<div class="card"><strong>'+esc(connected?'Folder connected':'Choose a dedicated shared folder')+'</strong><p id="bsync-status" class="smalltext muted">'+esc(last)+'</p><p class="tiny muted">Checks every 30 seconds while open and unlocked. Folder provider must sync files across devices separately. No cloud service is built in. Project records include GPS and notes; photos, crew time and crew activity are not published. Inventory exchanges remain manual.</p><div class="actions"><button class="btn ghost" data-bsync="choose">Choose folder</button><button class="btn ghost" data-bsync="disconnect">Disconnect</button></div><p>'+esc(j?.jobName||'No job')+' · '+(enabled?'Auto publish enabled':'Auto publish off')+'</p><button class="btn primary" data-bsync="'+(enabled?'disable':'enable')+'">'+(enabled?'Pause publication':'Enable for active project')+'</button><button class="btn ghost" data-bsync="refresh">Check now</button><p class="tiny muted">Last published: '+esc(cfg.published||'Never')+' · 500 file limit; archive older files manually. No automatic deletion.</p></div><div class="card spaced"><strong>Incoming snapshots — review required</strong>'+inbox.map(n=>'<div class="lightline"><small>'+esc(n)+'</small><button class="btn micro ghost" data-bsync="review" data-name="'+esc(n)+'">Review</button></div>').join('')+'</div>')}
async function act(b){if(!allowed())throw Error('Access denied');if(!N())throw Error('Folder sync requires the Android build');const name=b.dataset.bsync;
 if(name==='choose'){cfg.project='';cfg.grant='';cfg.digest='';save();N().choose();return}
 if(name==='disconnect'){cfg.project='';cfg.grant='';cfg.digest='';save();N().disconnect();inbox=[];return open()}
 if(name==='disable'){cfg.project='';save();return open()}
 if(name==='enable'){const {j}=context();if(!folder()||!j.connectProjectId)throw Error('Choose a folder and link the active project through Connect first');if(!confirm('Automatically publish this project’s GPS, notes and bore records into the chosen shared folder while Field is open? No photos or timesheets.'))return;cfg={...cfg,device:cfg.device||id(),grant:folder(),project:j.id,digest:''};save();await tick(true);return open()}
 if(name==='refresh'){await tick();return open()}
 if(name==='review'){const n=b.dataset.name;if(!inbox.includes(n))throw Error('Refresh inbox first');const v=window.BoreLabCalendarConnect.core.parse(check(N().read(n)));const {j}=context();if(j.connectProjectId&&j.connectProjectId!==v.project.id)throw Error('Switch to the matching Field job before review');window.BoreLabCalendarConnect.reviewIncoming(v)}
}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-bsync]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();Promise.resolve().then(()=>act(b)).catch(e=>api()?.notify?.(e.message))},true);
window.BoreLabFolderSync={open,card:()=>allowed()?'<section class="card spaced"><div class="between"><div><strong>⇄ Folder Sync</strong><p class="tiny muted">Automatic publishing · reviewed inbox</p></div><button class="btn micro primary" data-bsync="refresh">Open</button></div></section>':''};
setInterval(()=>tick(),30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
})();
