/**
 * OMEGA INVITATION - Theme: Floral Pink
 */
(function(){
  'use strict';
  function init(){
    document.body.classList.add('theme-floral-pink');
    document.querySelectorAll('.section-divider').forEach(el=>{
      el.innerHTML=`<div style="flex:1;max-width:80px;height:1px;background:linear-gradient(to right,transparent,#D4688E)"></div><span style="font-size:20px;color:#D4688E;line-height:1">✿</span><div style="flex:1;max-width:80px;height:1px;background:linear-gradient(to left,transparent,#D4688E)"></div>`;
    });
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
