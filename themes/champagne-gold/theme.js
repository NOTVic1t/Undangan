/**
 * OMEGA INVITATION - Theme: Champagne Gold
 */
(function(){
  'use strict';
  function init(){
    document.body.classList.add('theme-champagne-gold');
    document.querySelectorAll('.section-divider').forEach(el=>{
      el.innerHTML=`<div style="flex:1;max-width:80px;height:1px;background:linear-gradient(to right,transparent,#C4922A)"></div><span style="font-size:14px;color:#C4922A;line-height:1">◇</span><div style="flex:1;max-width:80px;height:1px;background:linear-gradient(to left,transparent,#C4922A)"></div>`;
    });
    document.querySelectorAll('.countdown-number').forEach(el=>{el.style.background='linear-gradient(135deg,#C4922A,#E8B84B)';el.style.webkitBackgroundClip='text';el.style.webkitTextFillColor='transparent';el.style.backgroundClip='text';});
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
