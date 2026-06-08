/**
 * OMEGA INVITATION - Theme: Luxury Black
 * Runtime JS: dramatic reveals, firefly enhancements
 */
(function () {
  'use strict';

  function initLuxuryBlack() {
    document.body.classList.add('theme-luxury-black');
    enhanceDividers();
    enhanceSectionTitles();
  }

  function enhanceDividers() {
    document.querySelectorAll('.section-divider').forEach(el => {
      el.innerHTML = `
        <div style="flex:1;max-width:100px;height:1px;background:linear-gradient(to right,transparent,rgba(201,168,76,0.6))"></div>
        <span style="font-size:10px;color:#C9A84C;letter-spacing:4px;text-transform:uppercase;padding:0 8px">◆</span>
        <div style="flex:1;max-width:100px;height:1px;background:linear-gradient(to left,transparent,rgba(201,168,76,0.6))"></div>
      `;
    });
  }

  function enhanceSectionTitles() {
    document.querySelectorAll('.section-title').forEach(el => {
      el.style.letterSpacing = '4px';
      el.style.textTransform = 'uppercase';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLuxuryBlack);
  } else {
    initLuxuryBlack();
  }
})();
