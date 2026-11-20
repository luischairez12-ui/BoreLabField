/* BoreLab Field — single Equipment / Mud workspaces and separate tool inventory.
   Offline shared-device records; no servers, no remote lookups and no reel deductions. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const st=()=>api()?.state?.()||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=v=>String(v??'').trim();
const n=v=>Number(v);
const fmt=v=>Number(v||0).toLocaleString('en-US',{maximumFractionDigits:0});
const cats=['Pulling Heads','Swivels','Reamers','Subs & Adapters','Drill Tooling','Locator Gear','Hand Tools','Safety Gear','Other'];
const conditions=['Good','Needs Service','Out of Service'];
const locations=['Truck','Shop','Jobsite','Service Shop','Other'];
const selected={equipment:'fleet',mud:'mixer'};
let category='All',editing='',checkout='',returning='';
try{const stored=JSON.parse(sessionStorage.getItem('borelab-workspaces-v1')||'{}');if(['fleet','manuals'].includes(stored.equipment))selected.equipment=stored.equipment;
 if(['mixer','stock'].includes(stored.mud))selected.mud=stored.mud;}catch{}
const keep=()=>{try{sessionStorage.setItem('borelab-workspaces-v1',JSON.stringify(selected))}catch{}};
function arrays(){const s=st();if(!Array.isArray(s.toolInventoryV1))s.toolInventoryV1=[];
 if(!Array.isArray(s.toolIssuesV1))s.toolIssuesV1=[];
 if(!Array.isArray(s.toolHistoryV1))s.toolHistoryV1=[];
 return s}
const all=()=>arrays().toolInventoryV1;
const active=()=>all().filter(x=>!x.archived);
const issues=()=>arrays().toolIssuesV1;
const outstanding=issue=>Math.max(0,n(issue.qty||0)-n(issue.returned||0));
const checkedOut=toolId=>issues().filter(x=>x.toolId===toolId).reduce((sum,x)=>sum+outstanding(x),0);
const available=tool=>Math.max(0,n(tool.qty||0)-checkedOut(tool.id));
const item=id=>all().find(t=>t.id===id);
const uid=()=>api()?.uid?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2);
const notice=s=>api()?.notify?.(s);
const save=()=>{api()?.save?.();api()?.render?.()};
const history=(kind,tool,qty=0,by='')=>{
 const s=arrays();s.toolHistoryV1.push({id:uid(),kind,toolId:tool.id,toolName:tool.name,qty,by,at:new Date().toISOString()});
 if(s.toolHistoryV1.length>1500)s.toolHistoryV1=s.toolHistoryV1.slice(-1500);
};
const validInt=(value,min=0,max=100000)=>Number.isSafeInteger(n(value))&&n(value)>=min&&n(value)<=max;
function addOrUpdateTool(data,id=''){
 const s=arrays(),old=id?item(id):null;
 if(id&&!old)return {ok:false,error:'Tool no longer exists.'};
 if(!id&&all().length>=2000)return {ok:false,error:'Tool inventory limit reached.'};
 const name=text(data.name).slice(0,100),cat=cats.includes(data.category)?data.category:'Other';
 const qty=n(data.qty),size=text(data.size).slice(0,65),location=locations.includes(data.location)?data.location:'Other';
 const condition=conditions.includes(data.condition)?data.condition:'Good';
 const serial=text(data.serial).slice(0,90),notes=text(data.notes).slice(0,800);
 if(!name)return {ok:false,error:'Enter a tool name.'};
 if(!validInt(data.qty,1,100000))return {ok:false,error:'Tool quantity must be a whole number from 1 to 100,000.'};
 if(old&&qty<checkedOut(old.id))return {ok:false,error:'Return outstanding tools before lowering total quantity.'};
 const record={id:old?.id||uid(),name,category:cat,qty,size,location,condition,serial,notes,
  archived:false,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(old)Object.assign(old,record);else s.toolInventoryV1.push(record);
 history(old?'edited':'added',record,qty);
 editing='';save();notice((old?'Updated ':'Added ')+name+'.');return {ok:true,id:record.id};
}
function checkoutTool(id,amount,to,jobId=''){
 const tool=item(id),qty=n(amount),person=text(to).slice(0,100);
 if(!tool||tool.archived)return {ok:false,error:'Tool is not available.'};
 if(tool.condition==='Out of Service')return {ok:false,error:'Tool is marked out of service.'};
 if(!validInt(amount,1,100000)||qty>available(tool))return {ok:false,error:'Enter a whole quantity no greater than available stock.'};
 if(!person)return {ok:false,error:'Enter the worker, truck or job receiving the tools.'};
 const s=arrays(),job=s.jobs?.find(j=>j.id===jobId)||null;
 s.toolIssuesV1.push({id:uid(),toolId:id,qty,returned:0,assignedTo:person,
  jobId:job?.id||'',jobName:job?.jobName||'',at:new Date().toISOString(),returnedAt:''});
 history('checked-out',tool,qty,person);
 checkout='';save();notice(qty+' '+tool.name+' checked out.');return {ok:true};
}
function returnTool(issueId,amount){
 const issue=issues().find(x=>x.id===issueId),tool=issue&&item(issue.toolId),qty=n(amount);
 if(!issue||!tool)return {ok:false,error:'Check-out record not found.'};
 if(!validInt(amount,1,100000)||qty>outstanding(issue))return {ok:false,error:'Return quantity exceeds the outstanding amount.'};
 issue.returned=n(issue.returned||0)+qty;
 if(outstanding(issue)===0)issue.returnedAt=new Date().toISOString();
 history('returned',tool,qty,issue.assignedTo);
 returning='';save();notice('Returned '+qty+' '+tool.name+'.');return {ok:true};
}
function archiveTool(id){
 const tool=item(id);if(!tool)return {ok:false,error:'Tool not found.'};
 if(checkedOut(id))return {ok:false,error:'Return outstanding tools before archiving.'};
 tool.archived=true;tool.updatedAt=new Date().toISOString();
 history('archived',tool,0);editing='';save();notice(tool.name+' archived.');return {ok:true};
}
const opt=(list,current)=>list.map(v=>'<option value="'+esc(v)+'"'+(v===current?' selected':'')+'>'+esc(v)+'</option>').join('');
const tabs=(name,values)=>'<div class="fw32-tabs" role="tablist" aria-label="'+name+' views">'+
 values.map(([id,label])=>'<button type="button" role="tab" data-fw32-tab="'+name+':'+id+'" aria-selected="'+(selected[name]===id)+'">'+label+'</button>').join('')+'</div>';
function selectTab(name,tab,rerender=true){
 if(name==='equipment'&&!['fleet','manuals'].includes(tab))return false;
 if(name==='mud'&&!['mixer','stock'].includes(tab))return false;
 selected[name]=tab;keep();
 if(name==='equipment'&&tab==='manuals')api()?.refreshManualFiles?.();
 if(rerender)api()?.render?.();
 return true;
}
function renderEquipment(ctx={}){
 const s=st(),units=(s.equipment||[]).filter(x=>!x.archived),rigs=units.filter(x=>x.type==='Drill').length,
 trucks=units.filter(x=>x.type==='Truck').length,issues=(s.equipmentIssuesV2||[]).filter(x=>!x.closedAt).length;
 const panel=selected.equipment==='manuals'?(ctx.manuals?.()||'<p>Manual library unavailable.</p>'):
  (window.BoreLabConnectedOps3?.renderEquipment?.()||ctx.fleet?.()||'<p>Fleet records unavailable.</p>');
 return '<main class="page fw32-workspace"><header class="fw32-head"><span class="eyebrow">FIELD / FLEET</span><h1>Equipment</h1>'+
 '<p>Drills, trucks, repairs, service and the correct manuals for each machine.</p></header>'+
 '<div class="fw32-quickstats"><span><strong>'+rigs+'</strong> drills</span><span><strong>'+trucks+'</strong> trucks</span><span><strong>'+issues+'</strong> open issues</span></div>'+
 tabs('equipment',[['fleet','Fleet & Maintenance'],['manuals','Drill Manuals']])+
 '<div class="fw32-embedded">'+panel+'</div></main>';
}
function renderMud(ctx={}){
 const stock=(st().mudProducts||[]).filter(x=>!x.archived).length;
 const panel=selected.mud==='stock'?(ctx.stock?.()||'<p>Mud product inventory unavailable.</p>'):
  (ctx.mixer?.()||'<p>Mud mixer unavailable.</p>');
 return '<main class="page fw32-workspace"><header class="fw32-head"><span class="eyebrow">FIELD / DRILLING FLUID</span><h1>Mud</h1>'+
 '<p>Mix water, top off the tank and track product bags or buckets without switching menus.</p></header>'+
 '<div class="fw32-quickstats"><span><strong>'+stock+'</strong> saved products</span><span><strong>Offline</strong> records</span></div>'+
 tabs('mud',[['mixer','Mud Mixer'],['stock','Mud Inventory']])+
 '<div class="fw32-embedded">'+panel+'</div></main>';
}
function formTool(){
 const tool=editing?item(editing):null;
 return '<section class="fw32-form-panel"><h2>'+(tool?'Edit Tool':'Add Tool')+'</h2>'+
 '<form data-fw32-tool-form data-tool-id="'+esc(tool?.id||'')+'">'+
 '<label>Tool / part name<input name="name" maxlength="100" required placeholder="6-inch pulling head, swivel, 12-inch reamer" value="'+esc(tool?.name||'')+'"></label>'+
 '<div class="fw32-form-grid">'+
 '<label>Category<select name="category">'+opt(cats,tool?.category||'Pulling Heads')+'</select></label>'+
 '<label>Total quantity<input name="qty" type="number" inputmode="numeric" min="1" max="100000" step="1" required value="'+esc(tool?.qty||1)+'"></label>'+
 '<label>Size / connection<input name="size" maxlength="65" placeholder="e.g. 6 in / 2.375 API" value="'+esc(tool?.size||'')+'"></label>'+
 '<label>Location<select name="location">'+opt(locations,tool?.location||'Truck')+'</select></label>'+
 '<label>Condition<select name="condition">'+opt(conditions,tool?.condition||'Good')+'</select></label>'+
 '<label>Serial / identifier<input name="serial" maxlength="90" placeholder="Optional" value="'+esc(tool?.serial||'')+'"></label></div>'+
 '<label>Notes<textarea name="notes" rows="2" maxlength="800" placeholder="Adapter size, thread type, fit or damage notes">'+esc(tool?.notes||'')+'</textarea></label>'+
 '<div class="fw32-form-buttons"><button type="submit" class="fw32-primary">Save Tool</button><button type="button" data-fw32-cancel>Cancel</button></div></form></section>';
}
function formCheckout(){
 const tool=checkout&&item(checkout);if(!tool)return '';
 const s=st(),jobs=(s.jobs||[]).filter(j=>!j.archived);
 return '<section class="fw32-form-panel"><h2>Check Out · '+esc(tool.name)+'</h2>'+
 '<p class="fw32-muted">'+available(tool)+' available · check-out does not remove total ownership.</p>'+
 '<form data-fw32-checkout-form data-tool-id="'+esc(tool.id)+'">'+
 '<label>Quantity<input name="qty" type="number" inputmode="numeric" step="1" min="1" max="'+available(tool)+'" required value="1"></label>'+
 '<label>Assigned to<input name="assignedTo" required maxlength="100" placeholder="Juan, Drill Truck 2, or job crew"></label>'+
 '<label>Job (optional)<select name="jobId"><option value="">No job assigned</option>'+jobs.map(j=>'<option value="'+esc(j.id)+'">'+esc(j.jobName)+'</option>').join('')+'</select></label>'+
 '<div class="fw32-form-buttons"><button type="submit" class="fw32-primary">Confirm Check Out</button><button type="button" data-fw32-cancel>Cancel</button></div></form></section>';
}
function formReturn(){
 const issue=issues().find(x=>x.id===returning),tool=issue&&item(issue.toolId);if(!tool)return '';
 return '<section class="fw32-form-panel"><h2>Return · '+esc(tool.name)+'</h2>'+
 '<p class="fw32-muted">Checked out to '+esc(issue.assignedTo)+' · '+outstanding(issue)+' still out</p>'+
 '<form data-fw32-return-form data-issue-id="'+esc(issue.id)+'">'+
 '<label>Quantity returned<input name="qty" type="number" min="1" max="'+outstanding(issue)+'" step="1" required value="'+outstanding(issue)+'"></label>'+
 '<div class="fw32-form-buttons"><button type="submit" class="fw32-primary">Record Return</button><button type="button" data-fw32-cancel>Cancel</button></div></form></section>';
}
function card(tool){
 const out=checkedOut(tool.id),left=available(tool),open=issues().filter(x=>x.toolId===tool.id&&outstanding(x)>0),bad=tool.condition!=='Good';
 return '<article class="fw32-tool-card"><div class="fw32-tool-heading"><div><strong>'+esc(tool.name)+'</strong>'+
 '<small>'+esc(tool.category)+' · '+esc(tool.size||'Size not recorded')+' · '+esc(tool.location)+'</small></div>'+
 '<span class="fw32-condition'+(bad?' attention':'')+'">'+esc(tool.condition)+'</span></div>'+
 '<div class="fw32-tool-counts"><span><strong>'+fmt(left)+'</strong> available</span><span><strong>'+fmt(out)+'</strong> checked out</span><span><strong>'+fmt(tool.qty)+'</strong> total</span></div>'+
 (tool.serial?'<p class="fw32-muted">ID: '+esc(tool.serial)+'</p>':'')+
 (tool.notes?'<p class="fw32-muted">'+esc(tool.notes)+'</p>':'')+
 (open.length?'<div class="fw32-issues"><strong>Currently checked out</strong>'+
 open.map(issue=>'<div><span>'+fmt(outstanding(issue))+' to '+esc(issue.assignedTo)+(issue.jobName?' · '+esc(issue.jobName):'')+'</span>'+
 '<button type="button" data-fw32-return="'+esc(issue.id)+'">Return</button></div>').join('')+'</div>':'')+
 '<div class="fw32-card-actions"><button type="button" data-fw32-checkout="'+esc(tool.id)+'"'+(left<=0||tool.condition==='Out of Service'?' disabled':'')+'>Check Out</button>'+
 '<button type="button" data-fw32-edit="'+esc(tool.id)+'">Edit</button><button type="button" data-fw32-archive="'+esc(tool.id)+'">Archive</button></div></article>';
}
function renderToolInventory(){
 const list=active().filter(t=>category==='All'||t.category===category).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
 const total=active(),checked=total.reduce((sum,t)=>sum+checkedOut(t.id),0),attention=total.filter(t=>t.condition!=='Good').length;
 return '<main class="page fw32-workspace fw32-inventory"><header class="fw32-head fw32-inventory-head"><div><span class="eyebrow">FIELD / GEAR</span>'+
 '<h1>Tool Inventory</h1><p>Pulling heads, swivels, reamers, subs and hand tools—separate from pipe reels.</p></div>'+
 '<button type="button" class="fw32-primary" data-fw32-new>＋ Tool</button></header>'+
 '<div class="fw32-quickstats"><span><strong>'+total.length+'</strong> tool entries</span><span><strong>'+checked+'</strong> checked out</span><span><strong>'+attention+'</strong> need attention</span></div>'+
 (editing!==''?formTool():checkout!==''?formCheckout():returning!==''?formReturn():'')+
 '<div class="fw32-filter-row"><label>Show category<select data-fw32-category><option value="All">All Categories</option>'+opt(cats,category)+'</select></label>'+
 '<button type="button" data-page="pipe">Pipe Reels ›</button></div>'+
 (list.length?'<div class="fw32-tool-list">'+list.map(card).join('')+'</div>':
 '<div class="fw32-empty"><strong>'+(total.length?'No tools in this category.':'Your tool inventory is empty.')+'</strong><p>Add the pulling heads, reamers and tools you actually have. BoreLab will not invent starting quantities.</p>'+
 '<button type="button" data-fw32-new class="fw32-primary">＋ Add First Tool</button></div>')+
 '<p class="fw32-disclaimer">Quantities and condition are manually entered. Confirm actual tooling, rated pull capacity and thread compatibility before using equipment. Reels are managed separately in Pipe Reels.</p></main>';
}
function resetEditor(){editing='';checkout='';returning=''}
function beginTool(id=''){resetEditor();editing=id||'new';api()?.render?.()}
function showCheckout(id){if(!item(id))return;resetEditor();checkout=id;api()?.render?.()}
function showReturn(id){if(!issues().some(x=>x.id===id&&outstanding(x)>0))return;resetEditor();returning=id;api()?.render?.()}
document.addEventListener('click',e=>{
 const target=e.target.closest?.('[data-fw32-tab],[data-fw32-new],[data-fw32-edit],[data-fw32-checkout],[data-fw32-return],[data-fw32-archive],[data-fw32-cancel]');
 if(!target)return;
 const p=api()?.currentPage?.();
 if(target.dataset.fw32Tab){
  if(!['equipment','mudhub'].includes(p))return;
  e.preventDefault();e.stopImmediatePropagation?.();
  const [name,tab]=target.dataset.fw32Tab.split(':');
  selectTab(name,tab);return;
 }
 if(p!=='toolinventory')return;
 e.preventDefault();e.stopImmediatePropagation?.();
 if(target.hasAttribute('data-fw32-new'))return beginTool();
 if(target.dataset.fw32Edit)return beginTool(target.dataset.fw32Edit);
 if(target.dataset.fw32Checkout)return showCheckout(target.dataset.fw32Checkout);
 if(target.dataset.fw32Return)return showReturn(target.dataset.fw32Return);
 if(target.hasAttribute('data-fw32-cancel')){resetEditor();api()?.render?.();return}
 if(target.dataset.fw32Archive){
  const tool=item(target.dataset.fw32Archive);
  if(!tool)return;
  if(!window.confirm?.('Archive '+tool.name+'? This keeps the history but hides it from active inventory.'))return;
  const res=archiveTool(tool.id);if(!res.ok)notice(res.error);
 }
},{capture:true});
document.addEventListener('change',e=>{
 if(api()?.currentPage?.()!=='toolinventory'||!e.target.matches?.('[data-fw32-category]'))return;
 category=e.target.value==='All'||cats.includes(e.target.value)?e.target.value:'All';
 api()?.render?.();
});
document.addEventListener('submit',e=>{
 const form=e.target;
 if(!form?.matches?.('[data-fw32-tool-form],[data-fw32-checkout-form],[data-fw32-return-form]'))return;
 e.preventDefault();e.stopImmediatePropagation?.();
 if(api()?.currentPage?.()!=='toolinventory')return;
 const d=Object.fromEntries(new FormData(form).entries());
 let result={ok:false,error:'Unknown tool action.'};
 if(form.matches('[data-fw32-tool-form]'))result=addOrUpdateTool(d,form.dataset.toolId||'');
 if(form.matches('[data-fw32-checkout-form]'))result=checkoutTool(form.dataset.toolId,d.qty,d.assignedTo,d.jobId);
 if(form.matches('[data-fw32-return-form]'))result=returnTool(form.dataset.issueId,d.qty);
 if(!result.ok)notice(result.error);
},{capture:true});
window.BoreLabWorkspacesV32={renderEquipment,renderMud,renderToolInventory,selectTab,tab:name=>selected[name],
 beginTool,addOrUpdateTool,checkoutTool,returnTool,archiveTool,available,checkedOut,outstanding,
 cats,conditions,locations};
})();