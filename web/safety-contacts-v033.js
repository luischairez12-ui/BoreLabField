/* BoreLab Field Safety Contacts — private, offline address book; not an 811 ticketing service. */
(function(){
'use strict';
const bridge=()=>window.BoreLabAssistantBridge;
const auth=()=>window.BoreLabLocalAccounts;
const state=()=>bridge()?.state?.()||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').trim();
const categories=['Utility Emergency','Gas / Pipeline','Electric','Water / Sewer','Locator / 811 Center','Supervisor / Foreman','Emergency Contact','Other'];
const editorAllowed=()=>!auth()||auth().pinTestMode?.()||['owner','foreman'].includes(auth().role?.());
const recordList=()=>Array.isArray(state().safetyContactsV33)?state().safetyContactsV33:(state().safetyContactsV33=[]);
const validPhone=p=>/^\+?[0-9()\-\s.]{3,26}$/.test(p)&&p.replace(/\D/g,'').length>=3&&p.replace(/\D/g,'').length<=16;
const tel=p=>'tel:'+p.replace(/[^0-9+]/g,'');
let editing='';
const notify=t=>bridge()?.notify?.(t);
const save=()=>{bridge()?.save?.();bridge()?.render?.()};
const byId=id=>recordList().find(c=>c.id===id);
function addContact(data,id=''){
 if(!editorAllowed())return {ok:false,error:'An owner or foreman PIN is required to edit contacts.'};
 const old=id?byId(id):null;
 if(id&&!old)return {ok:false,error:'Contact not found.'};
 if(!old&&recordList().length>=100)return {ok:false,error:'Contact book is full.'};
 const name=clean(data.name).slice(0,80),phone=clean(data.phone).slice(0,32),
   category=categories.includes(data.category)?data.category:'Other',notes=clean(data.notes).slice(0,400);
 if(!name)return {ok:false,error:'Enter a contact name.'};
 if(!validPhone(phone))return {ok:false,error:'Enter a valid phone number.'};
 const entry={id:old?.id||bridge()?.uid?.()||String(Date.now()),name,phone,category,notes,
   updatedAt:new Date().toISOString(),createdAt:old?.createdAt||new Date().toISOString()};
 if(old)Object.assign(old,entry);else recordList().push(entry);
 editing='';save();notify('Contact saved to this device.');return {ok:true,id:entry.id};
}
function removeContact(id){
 if(!editorAllowed())return {ok:false,error:'An owner or foreman PIN is required.'};
 const c=byId(id);if(!c)return {ok:false,error:'Contact not found.'};
 state().safetyContactsV33=recordList().filter(x=>x.id!==id);
 editing='';save();notify('Contact removed.');return {ok:true};
}
const row=(name,number,desc,cls='')=>
 '<div class="b33-hotline '+cls+'"><div><strong>'+esc(name)+'</strong><small>'+esc(desc)+'</small></div>'+
 '<a class="b33-call" href="tel:'+number+'" aria-label="Call '+esc(name)+' at '+esc(number)+'">Call '+esc(number)+'</a></div>';
const categoriesOptions=current=>categories.map(c=>'<option value="'+esc(c)+'"'+(current===c?' selected':'')+'>'+esc(c)+'</option>').join('');
function renderForm(){
 const c=editing&&editing!=='new'?byId(editing):null;
 return '<section class="b33-contact-form"><h2>'+(c?'Edit':'Add')+' Contact</h2>'+
 '<form data-b33-contact-form data-id="'+esc(c?.id||'')+'">'+
 '<label>Name<input name="name" maxlength="80" required value="'+esc(c?.name||'')+'" placeholder="Gas utility emergency, superintendent…"></label>'+
 '<label>Phone number<input name="phone" type="tel" inputmode="tel" maxlength="32" required value="'+esc(c?.phone||'')+'" placeholder="Number from your utility or company"></label>'+
 '<label>Contact type<select name="category">'+categoriesOptions(c?.category||'Utility Emergency')+'</select></label>'+
 '<label>Notes<textarea name="notes" rows="2" maxlength="400" placeholder="24-hour line, assigned region, reference…">'+esc(c?.notes||'')+'</textarea></label>'+
 '<div class="b33-buttons"><button type="submit" class="b33-primary">Save Contact</button><button type="button" data-b33-cancel>Cancel</button></div></form></section>';
}
function render(){
 const contacts=recordList().slice().sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name));
 return '<main class="page b33-safety"><div class="b33-safety-header"><span class="eyebrow">FIELD COMMAND / CONTACTS</span><h1>811 & Safety Contacts</h1>'+
 '<p>Numbers for the people you need on a jobsite, saved offline on this device.</p></div>'+
 '<section class="b33-safety-card"><h2>Quick dial</h2>'+
 row('811 — Before You Dig','811','Request utility locates before excavation. Not an emergency number.','b33-811')+
 row('911 — Emergency','911','For immediate danger, injuries or a suspected hazardous leak, move to safety first.','b33-911')+
 '<p class="b33-note">Calling 811 starts the locate-notification process; storing a number here does not submit a request or confirm utility clearance.</p></section>'+
 '<section class="b33-safety-card"><div class="b33-safety-head"><div><h2>Saved Emergency & Utility Contacts</h2><p>'+contacts.length+' local contact'+(contacts.length===1?'':'s')+'</p></div>'+
 (editorAllowed()?'<button type="button" data-b33-new class="b33-primary">＋ Contact</button>':'')+'</div>'+
 (editing&&editorAllowed()?renderForm():'')+
 (contacts.length?'<div class="b33-contact-list">'+contacts.map(c=>
 '<article class="b33-contact"><div><span class="b33-contact-type">'+esc(c.category)+'</span><strong>'+esc(c.name)+'</strong>'+
 (c.notes?'<small>'+esc(c.notes)+'</small>':'')+'</div><div class="b33-contact-actions">'+
 '<a href="tel:'+esc(tel(c.phone).slice(4))+'" class="b33-call" aria-label="Call '+esc(c.name)+'">Call '+esc(c.phone)+'</a>'+
 (editorAllowed()?'<button type="button" data-b33-edit="'+esc(c.id)+'">Edit</button>'+
 '<button type="button" data-b33-delete="'+esc(c.id)+'">Remove</button>':'')+'</div></article>').join('')+'</div>':
 '<p class="b33-empty">No company or utility contacts saved yet. Add verified local numbers from your supervisor and utility providers.</p>')+
 '</section><p class="b33-footer">This is a contact list—not a ticket tracker, locate clearance, emergency dispatch system or substitute for site safety procedures. Verify saved numbers before relying on them.</p></main>';
}
document.addEventListener('click',e=>{
 const t=e.target.closest?.('[data-b33-new],[data-b33-edit],[data-b33-delete],[data-b33-cancel]');
 if(!t||bridge()?.currentPage?.()!=='safetycontacts')return;
 e.preventDefault();
 if(!editorAllowed())return notify('Only a foreman or owner can edit contacts.');
 if(t.hasAttribute('data-b33-new')){editing='new';bridge()?.render?.();return}
 if(t.dataset.b33Edit){editing=t.dataset.b33Edit;bridge()?.render?.();return}
 if(t.hasAttribute('data-b33-cancel')){editing='';bridge()?.render?.();return}
 if(t.dataset.b33Delete){const c=byId(t.dataset.b33Delete);if(c&&window.confirm?.('Remove '+c.name+' from the saved contact list?'))removeContact(c.id)}
});
document.addEventListener('submit',e=>{
 const f=e.target.closest?.('[data-b33-contact-form]');if(!f)return;
 e.preventDefault();
 if(bridge()?.currentPage?.()!=='safetycontacts')return;
 const data=Object.fromEntries(new FormData(f).entries()),result=addContact(data,f.dataset.id||'');
 if(!result.ok)notify(result.error);
});
window.BoreLabSafetyContactsV33={render,addContact,removeContact,contacts:recordList,validPhone};
// Repaint a restored Safety screen once this externally loaded module is ready.
if(bridge()?.currentPage?.()==='safetycontacts')Promise.resolve().then(()=>bridge()?.render?.());
})();