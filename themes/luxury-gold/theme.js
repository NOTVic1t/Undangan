/**
 * OMEGA INVITATION - Theme: Luxury Gold
 * Runtime JS: gold dust particles, shimmer reveals
 */
(function () {
  'use strict';

  function initLuxuryGold() {
    document.body.classList.add('theme-luxury-gold');
    enhanceSectionDividers();
    enhanceCountdownBlocks();
  }

  function enhanceSectionDividers() {
    document.querySelectorAll('.section-divider').forEach(el => {
      if (!el.querySelector('.divider-ornament')) {
        el.innerHTML = `
          <div style="flex:1;max-width:80px;height:1px;background:linear-gradient(to right,transparent,#C9A84C)"></div>
          <svg width="32" height="16" viewBox="0 0 32 16" fill="none" aria-hidden="true">
            <path d="M16 2L18.5 7H28L20 11L22.5 16L16 12.5L9.5 16L12 11L4 7H13.5Z" fill="#C9A84C" opacity="0.7"/>
          </svg>
          <div style="flex:1;max-width:80px;height:1px;background:linear-gradient(to left,transparent,#C9A84C)"></div>
        `;
      }
    });
  }

  function enhanceCountdownBlocks() {
    document.querySelectorAll('.countdown-number').forEach(el => {
      el.style.background = 'linear-gradient(135deg, #C9A84C, #E8C97A, #C9A84C)';
      el.style.webkitBackgroundClip = 'text';
      el.style.webkitTextFillColor = 'transparent';
      el.style.backgroundClip = 'text';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLuxuryGold);
  } else {
    initLuxuryGold();
  }
})();
