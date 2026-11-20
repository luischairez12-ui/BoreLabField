/* BoreLab Field v0.25 — Drill crew attribution on individual bore records. */
(function(){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const norm=x=>String(x??'').trim();
function rosterPeople(roster){return (Array.isArray(roster)?roster:[]).filter(p=>p&&typeof p.id==='string'&&norm(p.name));}
function formFields(shot,roster){
 const c=shot?.performedBy||{},people=rosterPeople(roster),teamOptions=[...new Set((window.BoreLabAssistantBridge?.state?.()?.jobs||[]).flatMap(j=>(j.shots||[]).map(s=>norm(s.performedBy?.teamName))).filter(Boolean))].slice(0,50);
 const select=(name,label,current)=>'<label class="field">'+label+'<select name="'+name+'"><option value="">Not recorded</option>'+people.map(p=>'<option value="'+esc(p.id)+'"'+(p.id===current?' selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label>';
 const chosen=new Set(c.memberIds||[]);
 return '<section class="v25-crew-box"><h4>👷 Performed By / Drill Crew</h4>'+
 '<p class="tiny muted">Record who actually performed this bore. Historical names are saved with the record, even if the roster changes later.</p>'+
 '<label class="field">Drill team / contractor<input name="performedTeam" list="v25-drill-teams" maxlength="90" value="'+esc(c.teamName||'')+'" placeholder="e.g. Crew A or 2nd drill crew"></label>'+
 '<datalist id="v25-drill-teams">'+teamOptions.map(x=>'<option value="'+esc(x)+'"></option>').join('')+'</datalist>'+
 '<div class="form-grid">'+select('performedDriller','Driller',c.drillerId)+select('performedLocator','Locator',c.locatorId)+'</div>'+
 (people.length?'<details><summary class="smalltext">Crew members on this bore ('+chosen.size+' selected)</summary>'+
 '<div class="equipment-checks">'+people.map(p=>'<label class="equipment-choice"><input type="checkbox" name="performedMemberId" value="'+esc(p.id)+'" '+(chosen.has(p.id)?'checked':'')+'><span><strong>'+esc(p.name)+'</strong></span></label>').join('')+'</div></details>':
 '<p class="tiny muted">No roster saved yet. You can still type the drill team name and add personnel later.</p>')+
 '<label class="field">Additional performer notes<textarea name="performedNotes" maxlength="700" rows="2">'+esc(c.notes||'')+'</textarea></label>'+
 '</section>';
}
function fromForm(form,roster){
 const data=new FormData(form),people=rosterPeople(roster),ids=new Set(people.map(p=>p.id));
 const drillerId=String(data.get('performedDriller')||''),locatorId=String(data.get('performedLocator')||'');
 const memberIds=[...new Set(data.getAll('performedMemberId').map(String).filter(id=>ids.has(id)))];
 const name=id=>people.find(p=>p.id===id)?.name||'';
 const c={teamName:norm(data.get('performedTeam')).slice(0,90),
  drillerId:ids.has(drillerId)?drillerId:'',locatorId:ids.has(locatorId)?locatorId:'',
  drillerName:ids.has(drillerId)?name(drillerId):'',locatorName:ids.has(locatorId)?name(locatorId):'',
  memberIds,memberNames:memberIds.map(name),notes:norm(data.get('performedNotes')).slice(0,700),
  recordedAt:new Date().toISOString()};
 return c;
}
function summary(shot){
 const c=shot?.performedBy||{};
 return [c.teamName,c.drillerName?'Driller: '+c.drillerName:'',c.locatorName?'Locator: '+c.locatorName:'',
 (c.memberNames||[]).length?'Crew: '+c.memberNames.join(', '):''].filter(Boolean).join(' · ')||'Not recorded';
}
window.BoreLabCrewV25={formFields,fromForm,summary,rosterPeople};
})();