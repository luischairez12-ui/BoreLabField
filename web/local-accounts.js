/* BoreLab Field · Local PIN Accounts 1.0
   Shared-device lock and role-specific UI. Not a secure server-based permission system.
   PIN verifiers use PBKDF2-SHA256, unique random salts and local retry delays.
   Field data is NOT encrypted at rest by this feature.
*/
(function(){
'use strict';
const KEY='borelab-local-accounts-v1',PREF='borelab-local-pin-policy-v1',ROLE_PAGES={crew:'crewpreview',supervisor:'supervisorpreview'};
const ENC=new TextEncoder();
const $=s=>document.querySelector(s);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digits=s=>String(s??'').replace(/\D/g,'').slice(0,6);
const isPin=p=>/^\d{6}$/.test(p);
const hex=bytes=>Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('');
const rand=n=>{const b=new Uint8Array(n);crypto.getRandomValues(b);return b};
const stableId=()=>hex(rand(12));
const now=()=>Date.now();
const delay=failed=>Math.min(5*60*1000,failed>=3?15*1000*Math.pow(2,Math.min(6,failed-3)):0);
const normalizeCode=s=>String(s??'').replace(/[^0-9a-f]/gi,'').toUpperCase();
const roleLabel=r=>({owner:'Owner',foreman:'Foreman',crew:'Crew',supervisor:'Supervisor'}[r]||'Unknown');
const roleStart=r=>ROLE_PAGES[r]||'home';
const state=()=>window.BoreLabAssistantBridge?.state?.()||{};
const saveApp=()=>window.BoreLabAssistantBridge?.save?.();
const userById=id=>config?.users?.find(x=>x.id===id);
const safeLoad=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return{corrupted:true}}};
let config=safeLoad(),selectedId='',pin='',user=null,stage='unlock',busy=false,error='',recoveryMessage='',newRecovery='',idleAt=now(),timer=null,resetId='',isBooted=false;
const configured=()=>Boolean(config&&config.version===1&&Array.isArray(config.users)&&config.users.some(x=>x.role==='owner'));
const invalidConfig=()=>Boolean(config&&!configured());
const isOwner=()=>user?.role==='owner';
const isUnlocked=()=>!!user;
const current=()=>user?{id:user.id,role:user.role,memberId:user.memberId||'',name:user.name}:null;
const isRole=r=>user?.role===r;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(config));return true}catch(e){error='Unable to save local accounts. Check device storage.';return false}}
function bytes(hexText){if(!/^[0-9a-f]+$/i.test(hexText)||hexText.length%2)throw Error('Invalid PIN verifier');return Uint8Array.from(hexText.match(/../g),p=>parseInt(p,16))}
async function hashSecret(secret,saltHex,iterations=210000){
 if(!crypto?.subtle||!crypto?.getRandomValues)throw Error('Secure local PIN verification is not supported on this device.');
 const key=await crypto.subtle.importKey('raw',ENC.encode(secret),'PBKDF2',false,['deriveBits']);
 const derived=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes(saltHex),iterations},key,256);
 return hex(new Uint8Array(derived));
}
async function verifier(secret){
 const salt=hex(rand(16)),rounds=210000;
 return{salt,iterations:rounds,hash:await hashSecret(secret,salt,rounds)};
}
async function verify(secret,record){
 if(!record?.salt||!record?.hash||!record?.iterations)return false;
 const output=await hashSecret(secret,record.salt,record.iterations),target=record.hash.toLowerCase();
 if(output.length!==target.length)return false;
 let diff=0;for(let i=0;i<output.length;i++)diff|=output.charCodeAt(i)^target.charCodeAt(i);
 return diff===0;
}
function rememberActivity(){idleAt=now()}
function clearInput(){pin='';error=''}
function sessionRolePage(){return roleStart(user?.role)}
function setSession(account){
 user=account;pin='';error='';stage='unlock';selectedId=account.id;idleAt=now();
 document.documentElement.dataset.localAuth='unlocked';
 document.documentElement.dataset.localRole=account.role;
 const id=account.role==='crew'?account.memberId:null;
 if(id&&state().crewPreviewMemberId!==id){state().crewPreviewMemberId=id;saveApp()}
 if(window.BoreLabAssistantBridge?.setPage){
  window.BoreLabAssistantBridge.setPage(sessionRolePage(),{back:true});
 }else window.BoreLabAssistantBridge?.render?.();
 renderGate();
}
function lock(reason=''){
 if(!configured()||!user)return renderGate();
 user=null;pin='';error=reason||'';stage='unlock';busy=false;selectedId='';
 document.documentElement.dataset.localAuth='locked';document.documentElement.dataset.localRole='none';
 const root=$('#modalRoot');if(root)root.innerHTML='';
 renderGate();
}
function chooseAccount(id){
 if(!configured())return;
 if(!config.users.some(x=>x.id===id&&x.active!==false))return;
 selectedId=id;pin='';error='';stage='unlock';renderGate();
}
function afterMs(millis){return millis>0?Math.ceil(millis/1000)+' seconds':'now'}
function owner(){return config?.users?.find(x=>x.role==='owner')}
function message(msg){error=msg;renderGate()}
function recoveryCode(){return hex(rand(12)).toUpperCase().match(/.{1,4}/g).join('-')}
async function firstSetup(ownerName,entry,again){
 if(configured()||invalidConfig())return;
 if(!isPin(entry)||entry!==again)return message('Enter the same six-digit PIN twice.');
 if(!crypto?.subtle)return message('PIN setup needs WebCrypto support. This device cannot safely create accounts.');
 const name=String(ownerName||'Owner').trim().slice(0,50)||'Owner';
 busy=true;error='';renderGate();
 try{
  const code=recoveryCode();
  config={version:1,createdAt:new Date().toISOString(),users:[
   {id:stableId(),role:'owner',name,memberId:'',active:true,createdAt:new Date().toISOString(),
    failed:0,blockedUntil:0,...await verifier(entry)}
  ],recovery:await verifier(normalizeCode(code))};
  if(!persist()){config=null;return renderGate()}
  newRecovery=code;stage='recovery-created';selectedId=config.users[0].id;
 }catch(e){config=null;error='Unable to create local accounts: '+(e?.message||'Unknown error');stage='setup'}
 finally{busy=false;renderGate()}
}
async function finishSetup(){
 if(stage!=='recovery-created'||!configured())return;
 newRecovery='';setSession(owner());
}
async function unlockAccount(id,attempt){
 if(busy||!configured())return;
 const account=userById(id);if(!account||account.active===false)return message('This account is unavailable. Ask the owner to review it.');
 if(account.role==='crew'&&!state().roster?.some(p=>p.id===account.memberId))return message('This crew profile is missing from the roster. Ask the owner to reconnect the account.');
 if(now()<Number(account.blockedUntil||0))return message('Too many incorrect attempts. Try again in '+afterMs(account.blockedUntil-now())+'.');
 if(!isPin(attempt))return message('Enter a six-digit PIN.');
 busy=true;error='';renderGate();
 try{
  const correct=await verify(attempt,account);
  if(!correct){
   account.failed=Math.max(0,Number(account.failed)||0)+1;
   account.blockedUntil=now()+delay(account.failed);
   persist();pin='';
   error=account.blockedUntil>now()?'Incorrect PIN. Try again in '+afterMs(account.blockedUntil-now())+'.':'Incorrect PIN. Please try again.';
   return;
  }
  account.failed=0;account.blockedUntil=0;
  persist();
  setSession(account);
 }catch(e){error='PIN verification failed: '+(e?.message||'Try again.')}
 finally{busy=false;renderGate()}
}
function isAllowed(page){
 if(!configured()||!user)return false;
 if(page==='localaccounts')return isOwner();
 if(user.role==='owner'||user.role==='foreman')return true;
 return ROLE_PAGES[user.role]===page;
}
function guardNavigation(page){
 if(!configured())return false;
 if(!user){renderGate();return false}
 if(isAllowed(page))return true;
 if(page==='home'&&(user.role==='crew'||user.role==='supervisor')){
  lock();return false;
 }
 window.BoreLabAssistantBridge?.notify?.('This screen needs a foreman or owner PIN. Lock and choose that account to continue.');
 return false;
}
function guardJobSwitch(){
 if(!configured()||!user)return false;
 return user.role==='owner'||user.role==='foreman';
}
function pinEntry(){
 return '<div class="la-pin-dots" aria-label="'+pin.length+' of 6 PIN digits entered">'+
 Array.from({length:6},(_,i)=>'<span class="'+(i<pin.length?'filled':'')+'">'+(i<pin.length?'●':'○')+'</span>').join('')+'</div>'+
 '<div class="la-pin-keypad" aria-label="PIN keypad">'+
 [1,2,3,4,5,6,7,8,9,'','0','⌫'].map(n=>n===''?'<span></span>':
 '<button type="button" data-la-digit="'+escape(n)+'" '+(busy?'disabled':'')+' aria-label="'+(n==='⌫'?'Delete PIN digit':'Digit '+n)+'">'+n+'</button>').join('')+'</div>';
}
function accountSelector(){
 const users=config.users.filter(a=>a.active!==false);
 return '<div class="la-account-list">'+users.map(a=>
 '<button type="button" data-la-select="'+escape(a.id)+'" class="la-account '+(selectedId===a.id?'selected':'')+'">'+
 '<span class="la-avatar">'+(a.role==='owner'?'♛':a.role==='supervisor'?'▦':a.role==='foreman'?'⌁':'♙')+'</span>'+
 '<span><strong>'+escape(a.name)+'</strong><small>'+roleLabel(a.role)+'</small></span>'+
 (selectedId===a.id?'<span class="la-selected">✓</span>':'')+'</button>').join('')+'</div>';
}
function loginView(){
 const active=config.users.filter(a=>a.active!==false);
 const id=active.some(a=>a.id===selectedId)?selectedId:active[0]?.id||'';
 const a=userById(id);selectedId=id;
 const delayRemain=Math.max(0,Number(a?.blockedUntil||0)-now());
 return '<div class="la-card"><span class="la-eyebrow">BORELAB FIELD · LOCAL ACCOUNTS</span>'+
 '<h1>Who’s working today?</h1><p class="la-subtitle">Choose a saved profile and unlock with your six-digit PIN.</p>'+
 accountSelector()+
 '<div class="la-unlock-section"><h2>Enter '+escape(a?.name||'your')+' PIN</h2>'+
 '<p class="la-subtitle">Your session stays on this device. No internet required.</p>'+
 pinEntry()+
 (delayRemain?'<p class="la-error">Retry available in '+afterMs(delayRemain)+'.</p>':'')+
 (error?'<p class="la-error" role="alert">'+escape(error)+'</p>':'')+
 '<button class="la-primary" data-la-unlock '+(busy||delayRemain?'disabled':'')+'>'+(busy?'Checking PIN…':'Unlock My Dashboard')+'</button>'+
 '<button data-la-recover-start class="la-text-button">Forgot owner PIN? Use recovery code</button></div>'+
 '<p class="la-disclaimer">Local PINs are a shared-device convenience lock, not secure multi-user authorization or encrypted storage. Other phones do not sync automatically.</p></div>';
}
function setupView(){
 return '<div class="la-card"><span class="la-eyebrow">BORELAB FIELD · FIRST-TIME SETUP</span>'+
 '<h1>Secure this device</h1><p class="la-subtitle">Create your Owner PIN. Your existing BoreLab jobs, photos and timesheets are preserved.</p>'+
 '<form data-la-setup class="la-form"><label>Owner display name<input name="name" maxlength="50" value="Owner" autocomplete="off"></label>'+
 '<label>Choose a six-digit PIN<input name="pin" type="password" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required autocomplete="new-password"></label>'+
 '<label>Confirm PIN<input name="confirmPin" type="password" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required autocomplete="new-password"></label>'+
 (error?'<p class="la-error" role="alert">'+escape(error)+'</p>':'')+
 '<button type="submit" class="la-primary" '+(busy?'disabled':'')+'>'+(busy?'Creating account…':'Create Owner Account')+'</button></form>'+
 '<p class="la-disclaimer">The next screen shows a one-time recovery code. Save it outside your phone. PINs cannot synchronize between devices without a future sync system.</p></div>';
}
function recoveryCreated(){
 return '<div class="la-card"><span class="la-eyebrow">ACCOUNT RECOVERY</span><h1>Save your recovery code</h1>'+
 '<p class="la-subtitle">Write this down or store it in a password manager. You’ll need it to reset the Owner PIN if forgotten.</p>'+
 '<div class="la-recovery-code" aria-label="Recovery code">'+escape(newRecovery)+'</div>'+
 '<p class="la-warning">This code is displayed only once. It is not included in regular BoreLab job backups.</p>'+
 '<button class="la-primary" data-la-finish-setup>I Saved My Recovery Code</button></div>';
}
function recoveryReset(){
 return '<div class="la-card"><button class="la-back" data-la-recover-cancel>‹ Back to profiles</button>'+
 '<span class="la-eyebrow">LOCAL OWNER RECOVERY</span><h1>Reset Owner PIN</h1>'+
 '<p class="la-subtitle">Enter the recovery code saved during account setup. This will rotate the recovery code and reset your Owner PIN.</p>'+
 '<form data-la-recover class="la-form"><label>Recovery code<input name="code" autocomplete="off" autocapitalize="characters" required placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"></label>'+
 '<label>New six-digit Owner PIN<input name="pin" type="password" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required></label>'+
 '<label>Confirm new PIN<input name="confirmPin" type="password" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required></label>'+
 (error?'<p class="la-error">'+escape(error)+'</p>':'')+
 '<button class="la-primary" type="submit" '+(busy?'disabled':'')+'>Reset Owner PIN</button></form>'+
 '<p class="la-disclaimer">No BoreLab work records are changed by resetting the account PIN.</p></div>';
}
function corrupted(){
 return '<div class="la-card"><h1>Accounts need repair</h1>'+
 '<p class="la-error">The saved local account configuration cannot be read. Field data has not been erased.</p>'+
 '<p class="la-subtitle">Do not clear BoreLab app storage: that can also erase local work records. Restore the account configuration from a trusted device backup or contact the app maintainer.</p></div>';
}
function gateLogo(){
 return '<div class="la-brand"><span class="la-mark">B<span>↗</span></span>'+
 '<div><strong>BoreLab <em>Field</em></strong><small>HDD CREW OPERATIONS</small></div></div>';
}
function renderGate(){
 const root=$('#localAccountsGate');if(!root)return;
 if(user){root.innerHTML='';document.documentElement.dataset.localAuth='unlocked';return}
 document.documentElement.dataset.localAuth='locked';document.documentElement.dataset.localRole='none';
 let content;
 if(invalidConfig())content=corrupted();
 else if(stage==='recovery-created')content=recoveryCreated();
 else if(!configured())content=setupView();
 else if(stage==='recovery-reset')content=recoveryReset();
 else content=loginView();
 root.innerHTML='<main class="la-screen">'+gateLogo()+content+'</main>';
}
function accountFieldList(){
 return '<section class="la-manage-card"><div class="la-manage-heading"><h2>Add Local Account</h2><span>No monthly server fee</span></div>'+
 '<form data-la-create-account class="la-form">'+
 '<label>Account role<select name="role" data-la-newrole><option value="crew">Crew</option><option value="foreman">Foreman</option><option value="supervisor">Supervisor</option></select></label>'+
 '<label data-la-crew-row>Crew roster member<select name="memberId">'+(state().roster||[]).map(p=>
 '<option value="'+escape(p.id)+'">'+escape(p.name)+'</option>').join('')+'</select></label>'+
 '<label data-la-name-row hidden>Display name<input name="name" maxlength="50" placeholder="New account name"></label>'+
 '<label>Six-digit PIN<input type="password" name="pin" maxlength="6" inputmode="numeric" pattern="[0-9]{6}" required></label>'+
 '<label>Confirm PIN<input type="password" name="confirmPin" maxlength="6" inputmode="numeric" pattern="[0-9]{6}" required></label>'+
 '<button class="la-primary" type="submit">＋ Create Account</button></form>'+
 '<p class="la-muted">Add crew members in Crew Management first. Each Crew PIN is permanently linked to one saved roster ID until you reset it.</p></section>';
}
function accountRow(a){
 const isRoot=a.role==='owner',active=a.active!==false;
 return '<div class="la-manage-account"><span class="la-avatar">'+(isRoot?'♛':a.role==='crew'?'♙':a.role==='supervisor'?'▦':'⌁')+'</span>'+
 '<div><strong>'+escape(a.name)+'</strong><small>'+roleLabel(a.role)+' · '+(active?'Active':'Inactive')+'</small></div>'+
 '<button data-la-reset="'+escape(a.id)+'">Reset PIN</button>'+
 (!isRoot?'<button data-la-toggle="'+escape(a.id)+'">'+(active?'Disable':'Enable')+'</button>':'')+'</div>';
}
function manageView(){
 if(!isOwner())return '<div class="page"><h1>Owner access required</h1><p>Unlock with the Owner PIN to manage accounts.</p></div>';
 return '<div class="page la-manage"><header class="la-manage-hero"><span>BORELAB FIELD / OWNER SETTINGS</span>'+
 '<h1>Local PIN Accounts</h1><p>Control who opens Crew, Foreman and Supervisor Mode on this shared device.</p></header>'+
 '<div class="la-manage-notice"><strong>Local access — not a secure cloud login.</strong>'+
 '<p>PINs protect the app’s interface on a shared device. Field records are not encrypted by this feature; do not share sensitive company data on an untrusted device.</p></div>'+
 '<section class="la-manage-card"><div class="la-manage-heading"><h2>Saved Accounts</h2>'+
 '<span>'+config.users.filter(a=>a.active!==false).length+' active</span></div>'+
 config.users.map(accountRow).join('')+'</section>'+
 (resetId?'<section class="la-manage-card"><h2>Reset PIN</h2><p class="la-muted">New PIN for '+escape(userById(resetId)?.name||'account')+'</p>'+
 '<form class="la-form" data-la-admin-reset><input type="hidden" name="accountId" value="'+escape(resetId)+'">'+
 '<label>New six-digit PIN<input type="password" name="pin" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required></label>'+
 '<label>Confirm PIN<input type="password" name="confirmPin" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required></label>'+
 '<button class="la-primary" type="submit">Save New PIN</button><button type="button" class="la-back" data-la-cancel-reset>Cancel</button></form></section>':'')+
 accountFieldList()+
 '<section class="la-manage-card"><h2>Shared-Device Lock</h2>'+
 '<p class="la-muted">Automatically locks when BoreLab goes into the background or after inactivity. A PIN is required again when reopened.</p>'+
 '<label class="la-manage-idle">Inactivity lock <select data-la-idle>'+
 [2,5,10,15].map(n=>'<option value="'+n+'"'+(idleMinutes()===n?' selected':'')+'>'+n+' minutes</option>').join('')+'</select></label>'+
 '<button class="la-primary" data-la-lock>🔒 Lock BoreLab Now</button></section>'+
 '<p class="la-muted la-manage-footer">Account PINs and recovery verifiers are saved only on this device, separately from your field backups. Keep an independent backup of your work records.</p></div>';
}
function idleMinutes(){try{const x=Number(localStorage.getItem(PREF));return[2,5,10,15].includes(x)?x:5}catch{return 5}}
function setIdle(n){if([2,5,10,15].includes(n)){localStorage.setItem(PREF,String(n));rememberActivity()}}
async function createAccount(form){
 if(!isOwner()||busy)return;
 const role=String(form.querySelector('[name="role"]')?.value||''),memberId=String(form.querySelector('[name="memberId"]')?.value||'');
 const aPin=String(form.querySelector('[name="pin"]')?.value||''),bPin=String(form.querySelector('[name="confirmPin"]')?.value||'');
 if(!['crew','foreman','supervisor'].includes(role))return notifyOwner('Choose a valid role.');
 if(!isPin(aPin)||aPin!==bPin)return notifyOwner('PIN must be exactly six digits and match confirmation.');
 if(config.users.length>=50)return notifyOwner('This device supports up to 50 saved local accounts.');
 let name=String(form.querySelector('[name="name"]')?.value||'').trim().slice(0,50);
 if(role==='crew'){
  const p=state().roster?.find(x=>x.id===memberId);
  if(!p)return notifyOwner('Choose an existing crew member from the saved roster.');
  if(config.users.some(a=>a.role==='crew'&&a.memberId===memberId))return notifyOwner('This crew member already has a local account. Reset or re-enable it instead.');
  name=p.name;
 }else if(!name)return notifyOwner('Enter a display name.');
 busy=true;
 try{
  const a={id:stableId(),name,role,memberId:role==='crew'?memberId:'',active:true,createdAt:new Date().toISOString(),
   failed:0,blockedUntil:0,...await verifier(aPin)};
  config.users.push(a);if(!persist()){config.users.pop();return}
  resetId='';notifyOwner('Created '+name+' ('+roleLabel(role)+') local PIN account.');window.BoreLabAssistantBridge?.render?.();
 }catch(e){notifyOwner('Unable to create account: '+(e?.message||'Unknown error'))}
 finally{busy=false}
}
function notifyOwner(t){window.BoreLabAssistantBridge?.notify?.(t)}
async function resetPin(id,pinA,pinB){
 if(!isOwner()||busy||!isPin(pinA)||pinA!==pinB)return notifyOwner('Enter matching six-digit PINs.');
 const a=userById(id);if(!a)return;
 busy=true;
 try{
  const v=await verifier(pinA);Object.assign(a,v,{failed:0,blockedUntil:0});
  if(!persist())return;resetId='';notifyOwner('PIN reset for '+a.name+'.');window.BoreLabAssistantBridge?.render?.();
 }catch(e){notifyOwner('PIN reset failed: '+(e?.message||'Unknown error'))}
 finally{busy=false}
}
function toggleAccount(id){
 if(!isOwner())return;
 const a=userById(id);if(!a||a.role==='owner')return;
 if(!window.confirm?.((a.active!==false?'Deactivate':'Activate')+' local account for '+a.name+'?'))return;
 a.active=a.active===false;a.failed=0;a.blockedUntil=0;
 if(persist()){window.BoreLabAssistantBridge?.render?.();notifyOwner(a.active?'Account enabled.':'Account disabled.')}
}
async function ownerRecovery(code,pinA,pinB){
 if(busy||!configured()||!isPin(pinA)||pinA!==pinB)return message('Enter matching six-digit PINs.');
 const normal=normalizeCode(code);if(normal.length!==24)return message('Enter the complete recovery code.');
 busy=true;error='';renderGate();
 try{
  const okay=await verify(normal,config.recovery);
  if(!okay)return message('Recovery code does not match. Please try again.');
  const o=owner(),v=await verifier(pinA),newCode=recoveryCode(),recovery=await verifier(normalizeCode(newCode));
  Object.assign(o,v,{failed:0,blockedUntil:0});config.recovery=recovery;
  if(!persist())return;
  newRecovery=newCode;stage='recovery-created';selectedId=o.id;
 }catch(e){error='Recovery failed: '+(e?.message||'Unknown error')}
 finally{busy=false;renderGate()}
}
function appendDigit(d){
 if(!/^\d$/.test(d)||busy)return;
 if(pin.length<6)pin+=d;
 error='';renderGate();
}
function click(e){
 const b=e.target.closest?.('[data-la-select],[data-la-digit],[data-la-unlock],[data-la-recover-start],[data-la-recover-cancel],[data-la-finish-setup],[data-la-reset],[data-la-toggle],[data-la-cancel-reset],[data-la-lock]');
 if(!b)return;
 if(b.dataset.laSelect){chooseAccount(b.dataset.laSelect);return}
 if(b.dataset.laDigit){if(b.dataset.laDigit==='⌫')pin=pin.slice(0,-1);else appendDigit(b.dataset.laDigit);renderGate();return}
 if(b.hasAttribute('data-la-unlock')){unlockAccount(selectedId,pin);return}
 if(b.hasAttribute('data-la-recover-start')){stage='recovery-reset';error='';renderGate();return}
 if(b.hasAttribute('data-la-recover-cancel')){stage='unlock';error='';renderGate();return}
 if(b.hasAttribute('data-la-finish-setup')){finishSetup();return}
 if(b.dataset.laReset&&isOwner()){resetId=b.dataset.laReset;window.BoreLabAssistantBridge?.render?.();return}
 if(b.dataset.laToggle&&isOwner()){toggleAccount(b.dataset.laToggle);return}
 if(b.hasAttribute('data-la-cancel-reset')){resetId='';window.BoreLabAssistantBridge?.render?.();return}
 if(b.hasAttribute('data-la-lock')){lock();return}
}
function submit(e){
 const f=e.target;if(!f.matches?.('[data-la-setup],[data-la-recover],[data-la-create-account],[data-la-admin-reset]'))return;
 e.preventDefault();
 const field=n=>String(f.querySelector('[name="'+n+'"]')?.value||'');
 if(f.hasAttribute('data-la-setup')){firstSetup(field('name'),field('pin'),field('confirmPin'));return}
 if(f.hasAttribute('data-la-recover')){ownerRecovery(field('code'),field('pin'),field('confirmPin'));return}
 if(f.hasAttribute('data-la-create-account')){createAccount(f);return}
 if(f.hasAttribute('data-la-admin-reset')){resetPin(field('accountId'),field('pin'),field('confirmPin'));return}
}
function change(e){
 const t=e.target;
 if(t.matches?.('[data-la-newrole]')){
  const isCrew=t.value==='crew',form=t.closest('form');
  form?.querySelector('[data-la-crew-row]')?.toggleAttribute?.('hidden',!isCrew);
  form?.querySelector('[data-la-name-row]')?.toggleAttribute?.('hidden',isCrew);
  return;
 }
 if(t.matches?.('[data-la-idle]')){setIdle(Number(t.value));window.BoreLabAssistantBridge?.render?.()}
}
function boot(){
 if(isBooted)return;
 isBooted=true;
 if(!crypto?.subtle||!crypto?.getRandomValues){error='Cryptographic PIN verification is unavailable on this device.'}
 document.documentElement.dataset.localAuth='locked';
 document.documentElement.dataset.localRole='none';
 document.addEventListener('click',click);
 document.addEventListener('submit',submit);
 document.addEventListener('change',change);
 document.addEventListener('pointerdown',()=>{if(user)rememberActivity()},{passive:true});
 document.addEventListener('keydown',e=>{
  if(user)rememberActivity();
  if(!user&&configured()&&stage==='unlock'&&e.target?.tagName!=='INPUT'){
   if(/^\d$/.test(e.key)){e.preventDefault();appendDigit(e.key)}
   if(e.key==='Backspace'){e.preventDefault();pin=pin.slice(0,-1);renderGate()}
   if(e.key==='Enter'){e.preventDefault();unlockAccount(selectedId,pin)}
  }
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&user)lock()});
 window.addEventListener?.('pagehide',()=>{if(user)lock()});
 timer=setInterval(()=>{
  if(user&&now()-idleAt>=idleMinutes()*60000)lock('Session locked after inactivity.');
  if(!user&&configured()&&stage==='unlock'&&error.includes('seconds'))renderGate();
 },15000);
 renderGate();
}
window.BoreLabLocalAccounts={
 boot,isConfigured:configured,isUnlocked,current,isOwner,role:()=>user?.role||'locked',
 memberId:()=>user?.memberId||'',isAllowed,guardNavigation,guardJobSwitch,renderGate,renderManage:manageView,
 lock,lockForBackground:()=>{if(user)lock()},firstSetup,unlockAccount,chooseAccount,selectAccount:chooseAccount,
 hashSecret,verify,verifier,ownerRecovery,createAccount,resetPin,toggleAccount,
 _test:{state:()=>({config,selectedId,stage,locked:!user,role:user?.role||''}),forceConfig:x=>{config=x;user=null;stage='unlock';pin=''},setUser:x=>setSession(x),setPin:x=>{pin=x},getReview:()=>config}
};
boot();
})();
