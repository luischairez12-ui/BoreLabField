/* BoreLab 0.23 — three offline field productivity tools under one white/orange workspace. */
(function(){
'use strict';
const api=()=>window.BoreLabAssistantBridge;
let tab='pickup';
const choices=['pickup','next','compare'];
const allowed=()=>window.BoreLabPickup?.allowed?.()===true;
function render(){
 return '<div class="page bp-workspace"><span class="eyebrow">BORELAB / FIELD PRODUCTIVITY</span>'+
 '<h1>Field Productivity</h1><p class="smalltext muted">Plan materials, review your next move and compare jobsite evidence.</p>'+
 '<div class="bp-tabs" role="group" aria-label="Field productivity tools">'+
 [['pickup','◈ Pickup'],['next','⌁ Next Move'],['compare','▣ Photos']].map(([id,name])=>
 '<button data-bp-feature="'+id+'" class="'+(tab===id?'active':'')+'" aria-pressed="'+(tab===id)+'">'+name+'</button>').join('')+'</div>'+
 (tab==='pickup'?window.BoreLabPickup?.render?.()||'':tab==='next'?window.BoreLabNextMove?.render?.()||'':window.BoreLabPhotoCompare?.render?.()||'')+
 '</div>';
}
function homeLinks(){
 return '<div class="bp-home-links" aria-label="Field productivity tools">'+
 '<button type="button" data-bp-feature="pickup"><span>◈</span><strong>Material Pickup</strong><small>Check pipe needs</small></button>'+
 '<button type="button" data-bp-feature="next"><span>⌁</span><strong>Next Move</strong><small>Review next bore</small></button>'+
 '<button type="button" data-bp-feature="compare"><span>▣</span><strong>Before & After</strong><small>Compare photos</small></button></div>';
}
function open(id){
 if(!allowed()||!choices.includes(id))return;
 tab=id;
 if(api()?.currentPage?.()==='fieldproductivity')api()?.render?.();
 else api()?.setPage?.('fieldproductivity');
}
document.addEventListener('click',e=>{
 const el=e.target.closest?.('[data-bp-feature]');if(el)open(el.dataset.bpFeature);
});
window.BoreLabProductivity={render,homeLinks,open,getTab:()=>tab};
})();