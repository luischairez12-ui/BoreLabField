/* BoreLab Field 0.23 — safe before/after viewing, never changes stored photo bytes. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
const st=()=>api()?.state?.()||{};
const job=()=>api()?.activeJob?.();
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let recordId='',firstId='',secondId='';
function groups(){
 const j=job(),s=st(),photos=(api()?.photos?.()||[]).filter(p=>(p.jobId||s.legacyJobId||s.activeJobId)===j?.id);
 const bores=(j?.shots||[]).map(shot=>({id:'shot:'+shot.id,label:shot.name||'Bore',photos:photos.filter(p=>p.shotId===shot.id)}));
 const pins=(j?.fieldPins||[]).map(pin=>({id:'pin:'+pin.id,label:pin.name||pin.kind||'Installation',photos:photos.filter(p=>p.fieldPinId===pin.id)}));
 return bores.concat(pins).filter(g=>g.photos.length);
}
function selection(){
 const all=groups();let group=all.find(g=>g.id===recordId);
 if(!group){group=all.find(g=>g.photos.length>=2)||all[0]||null;recordId=group?.id||'';firstId='';secondId=''}
 if(!group)return {groups:all,group:null,photos:[],first:null,second:null};
 const photos=group.photos.slice().sort((a,b)=>String(a.addedAt||'').localeCompare(String(b.addedAt||'')));
 const a=photos.find(x=>x.stage==='before')||photos[0];
 const z=photos.find(x=>x.stage==='after'&&x.id!==a.id)||photos.slice().reverse().find(x=>x.id!==a.id)||null;
 return {groups:all,group,photos,first:photos.find(x=>x.id===firstId)||a,second:photos.find(x=>x.id===secondId)||z};
}
function photoCard(photo,title,groupName){
 const label=photo?.stage==='before'?'Before':photo?.stage==='after'?'After':title+' · stage unverified';
 const date=photo?.addedAt?new Date(photo.addedAt).toLocaleDateString():'No image chosen';
 return '<article class="bp-photo-card"><div><strong>'+esc(label)+'</strong><small>'+esc(date)+'</small></div>'+
 (photo&&String(photo.dataUrl||'').startsWith('data:image/')?
 '<button data-bp-view-photo="'+esc(photo.id)+'" aria-label="Open original '+esc(title)+' photo"><img src="'+esc(photo.dataUrl)+'" loading="lazy" alt="'+esc(title+' for '+groupName)+'"></button>':
 '<p class="bp-empty">No photo selected</p>')+'</article>';
}
function render(){
 const {groups:all,group,photos,first,second}=selection();
 const opts=selected=>photos.map(p=>'<option value="'+esc(p.id)+'" '+(selected?.id===p.id?'selected':'')+'>'+
 esc((p.stage||'Unclassified')+' · '+new Date(p.addedAt||Date.now()).toLocaleString())+'</option>').join('');
 return '<section class="bp-panel"><div class="bp-head"><div><span class="eyebrow">PHOTOS / DOCUMENTATION</span><h2>Before & After Comparison</h2></div><span class="bp-pill">Read only</span></div>'+
 '<p class="smalltext muted">Choose two saved pictures linked to the same bore or installation. Original photos are never changed, cropped or deleted.</p>'+
 (group?'<label class="bp-select">Bore or Installation<select data-bp-record>'+
 all.map(g=>'<option value="'+esc(g.id)+'" '+(g.id===group.id?'selected':'')+'>'+esc(g.label)+' · '+g.photos.length+' photo(s)</option>').join('')+'</select></label>'+
 '<div class="bp-compare-controls"><label>Photo A<select data-bp-first>'+opts(first)+'</select></label>'+
 '<label>Photo B<select data-bp-second><option value="">Select another</option>'+opts(second)+'</select></label></div>'+
 '<div class="bp-photo-grid">'+photoCard(first,'Photo A',group.label)+photoCard(second,'Photo B',group.label)+'</div>'+
 (first&&second&&first.id===second.id?'<p class="bp-warning">Choose different photos for a valid comparison.</p>':'')+
 '<p class="tiny muted">Labels say Before or After only when that photo stage is recorded. Unclassified photos retain a neutral label.</p>':
 '<p class="bp-empty">No photos linked to a bore or installation yet. Capture photos, then assign them through Photo Inbox or the Photo Timeline.</p>')+
 '<div class="bp-actions"><button data-page="phototimeline2">Photo Timeline</button><button data-page="fieldhub">Photo Inbox</button></div></section>';
}
document.addEventListener('change',e=>{
 const t=e.target;if(!window.BoreLabPickup?.allowed?.())return;
 if(t.matches?.('[data-bp-record]')){recordId=t.value;firstId='';secondId='';api()?.render?.();return}
 if(t.matches?.('[data-bp-first]')){firstId=t.value;api()?.render?.();return}
 if(t.matches?.('[data-bp-second]')){secondId=t.value;api()?.render?.()}
});
document.addEventListener('click',e=>{
 const button=e.target.closest?.('[data-bp-view-photo]');
 if(button&&window.BoreLabPickup?.allowed?.())api()?.photoDetail?.(button.dataset.bpViewPhoto);
});
window.BoreLabPhotoCompare={groups,selection,render};
})();