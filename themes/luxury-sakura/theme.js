/**
 * OMEGA INVITATION - Theme: Luxury Sakura
 * Runtime JS: petal rain, bloom reveals
 */
(function () {
  'use strict';

  function initLuxurySakura() {
    document.body.classList.add('theme-luxury-sakura');
    enhanceDividers();
    enhanceCountdown();
  }

  function enhanceDividers() {
    document.querySelectorAll('.section-divider').forEach(el => {
      el.innerHTML = `
        <div style="flex:1;max-width:80px;height:1px;background:linear-gradient(to right,transparent,#C4637A)"></div>
        <span style="font-size:18px;color:#C4637A;line-height:1">✿</span>
        <div style="flex:1;max-width:80px;height:1px;background:linear-gradient(to left,transparent,#C4637A)"></div>
      `;
    });
  }

  function enhanceCountdown() {
    document.querySelectorAll('.countdown-number').forEach(el => {
      el.style.color = '#C4637A';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLuxurySakura);
  } else {
    initLuxurySakura();
  }
})();
