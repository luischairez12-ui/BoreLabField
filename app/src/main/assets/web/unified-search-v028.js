/* BoreLab Field v0.28: one offline metadata search for all saved jobs. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge,info=()=>window.BoreLabFieldInfo3;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const match=(query,...parts)=>norm(query).split(/\s+/).every(part=>norm(parts.join(' ')).includes(part));
const categories={job:'Jobs',shot:'Bores',pin:'Field Pins',person:'People',timesheet:'Crew Time',equipment:'Equipment',reel:'Pipe Reels',photo:'Photos',note:'Field Notes',history:'Saved History',manual:'Manuals'};
function search(query){
 const q=String(query||'').trim().slice(0,100);
 if(q.length<2)return [];
 const s=api()?.state?.()||{},all=[],seen=new Set();
 const add=r=>{const key=[r.type,r.jobId||'',r.id||''].join('|');if(!seen.has(key)){seen.add(key);all.push(r)}};
 for(const row of info()?.searchRecords?.(q)||[])add(row);
 for(const reel of s.reels||[])if(match(q,reel.name,reel.size,reel.material,reel.location,reel.notes,reel.remaining))
  add({type:'reel',id:reel.id,label:reel.name||'Reel',detail:[reel.size,reel.remaining!=null?reel.remaining+' ft':''].filter(Boolean).join(' · ')});
 for(const report of s.history||[])if(match(q,report.jobName,report.day,report.notes,report.kind))
  add({type:'history',id:report.id,label:report.jobName||'Saved report',detail:report.day||'Job history'});
 for(const manual of s.manualLinks||[])if(match(q,manual.label,manual.url,manual.note))
  add({type:'manual',id:manual.id,label:manual.label||'Saved manual',detail:manual.note||'Manual Library'});
 return all.slice(0,120);
}
function render(query){
 const q=String(query||'').trim();
 if(q.length<2)return '<div class="bf-search-empty">Type at least 2 characters. Try an address, bore, date or worker.</div>';
 const found=search(q);
 if(!found.length)return '<div class="bf-search-empty">No saved records match. Try a shorter name or address.</div>';
 return '<p class="bf-search-total">'+found.length+' results · On this device</p>'+
 Object.keys(categories).filter(t=>found.some(x=>x.type===t)).map(type=>
 '<section class="bf-search-section"><h3>'+categories[type]+'</h3>'+
 found.filter(x=>x.type===type).map(x=>
 '<button class="bf-search-result" type="button" data-bf-search-hit="'+esc(x.type)+'" data-id="'+esc(x.id)+'" data-job="'+esc(x.jobId)+'">'+
 '<span><strong>'+esc(x.label)+'</strong><small>'+esc(x.detail)+'</small></span><b aria-hidden="true">›</b></button>').join('')+'</section>').join('')+
 '<p class="bf-search-note">Searches saved record details; not text inside PDFs or pictures.</p>';
}
function openHit(type,id,jobId){
 const bridge=api();if(!bridge)return;
 if(type==='reel'){bridge.setPage?.('pipe');return bridge.reelForm?.(id)}
 if(type==='manual')return bridge.setPage?.('manuals');
 if(type==='history')return bridge.setPage?.('history');
 return info()?.openHit?.(type,id,jobId);
}
window.BoreLabUnifiedSearchV28={search,render,openHit};
})();