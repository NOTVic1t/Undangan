/**
 * OMEGA INVITATION - Theme: Modern Korean
 * Runtime JS: minimalist dividers
 */
(function () {
  'use strict';

  function initModernKorean() {
    document.body.classList.add('theme-modern-korean');
    enhanceDividers();
  }

  function enhanceDividers() {
    document.querySelectorAll('.section-divider').forEach(el => {
      el.innerHTML = `
        <div style="flex:1;max-width:60px;height:1px;background:#2C2C2C;opacity:0.2"></div>
        <div style="width:6px;height:6px;border-radius:50%;background:#A68A6A"></div>
        <div style="flex:1;max-width:60px;height:1px;background:#2C2C2C;opacity:0.2"></div>
      `;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModernKorean);
  } else {
    initModernKorean();
  }
})();
