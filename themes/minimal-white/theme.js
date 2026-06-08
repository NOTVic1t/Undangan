/**
 * OMEGA INVITATION - Theme: Minimal White
 */
(function(){
  'use strict';
  function init(){
    document.body.classList.add('theme-minimal-white');
    document.querySelectorAll('.section-divider').forEach(el=>{
      el.innerHTML=`<div style="flex:1;max-width:60px;height:1px;background:rgba(139,111,71,0.3)"></div><span style="color:#8B6F47;font-size:11px;letter-spacing:3px">— ✦ —</span><div style="flex:1;max-width:60px;height:1px;background:rgba(139,111,71,0.3)"></div>`;
    });
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
