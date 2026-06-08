/**
 * OMEGA INVITATION - Theme: Luxury Emerald
 */
(function(){
  'use strict';
  function init(){
    document.body.classList.add('theme-luxury-emerald');
    document.querySelectorAll('.section-divider').forEach(el=>{
      el.innerHTML=`<div style="flex:1;max-width:80px;height:1px;background:linear-gradient(to right,transparent,#1A6B4A)"></div><span style="font-size:14px;color:#2ECC71;line-height:1">◈</span><div style="flex:1;max-width:80px;height:1px;background:linear-gradient(to left,transparent,#1A6B4A)"></div>`;
    });
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
