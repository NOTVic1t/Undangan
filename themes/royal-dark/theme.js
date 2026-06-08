/**
 * OMEGA INVITATION - Theme: Royal Dark
 */
(function(){
  'use strict';
  function init(){
    document.body.classList.add('theme-royal-dark');
    document.querySelectorAll('.section-divider').forEach(el=>{
      el.innerHTML=`<div style="flex:1;max-width:100px;height:1px;background:linear-gradient(to right,transparent,rgba(212,175,55,0.5))"></div><span style="color:#D4AF37;font-size:14px;line-height:1;padding:0 8px">✦</span><div style="flex:1;max-width:100px;height:1px;background:linear-gradient(to left,transparent,rgba(212,175,55,0.5))"></div>`;
    });
    document.querySelectorAll('.section-title').forEach(el=>{el.style.letterSpacing='3px';el.style.textTransform='uppercase';});
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
