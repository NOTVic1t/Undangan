/**
 * OMEGA INVITATION - Theme: Islamic Elegant
 * Runtime JS
 */
(function () {
  'use strict';

  function initIslamicElegant() {
    document.body.classList.add('theme-islamic-elegant');
    enhanceDividers();
    ensureBismillah();
  }

  function enhanceDividers() {
    document.querySelectorAll('.section-divider').forEach(el => {
      el.innerHTML = `
        <div style="flex:1;max-width:80px;height:1px;background:linear-gradient(to right,transparent,#2C6E49)"></div>
        <span style="font-size:18px;color:#C9A84C;line-height:1">☽</span>
        <div style="flex:1;max-width:80px;height:1px;background:linear-gradient(to left,transparent,#2C6E49)"></div>
      `;
    });
  }

  function ensureBismillah() {
    const el = document.getElementById('hero-bismillah');
    if (el) el.style.display = '';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIslamicElegant);
  } else {
    initIslamicElegant();
  }
})();
