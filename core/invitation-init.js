/**
 * OMEGA INVITATION PLATFORM
 * Invitation Initialization & Runtime
 * Handles: opening, music, countdown, RSVP, guestbook, gallery, particles
 */

(function () {
  'use strict';

  // ============================================================
  // STATE
  // ============================================================
  const State = {
    invitation: null,
    guestName: null,
    guestId: null,
    guestCode: null,
    musicPlaying: false,
    galleryIndex: 0,
    galleryItems: [],
    gbPage: 1,
    gbHasMore: true,
    rsvpSubmitted: false,
    countdownTimer: null,
    realtimeChannels: [],
  };

  // ============================================================
  // BOOT
  // ============================================================
  async function boot() {
    try {
      showLoading(true);

      const slug = resolveSlug();
      if (!slug) return showError('Undangan tidak ditemukan.');

      State.guestName = OMEGA.utils.getQueryParam('to') || '';
      State.guestCode = OMEGA.utils.getQueryParam('code') || '';

      const invitation = await OMEGA.invitation.getBySlug(slug);
      State.invitation = invitation;

      // Apply theme
      await OMEGA.themes.apply(invitation.themes?.slug || 'luxury-gold');

      // Load Google Fonts for theme
      loadThemeFonts(invitation.themes?.config);

      // Populate all sections
      populateMeta(invitation);
      populateOpening(invitation);
      populateHero(invitation);
      populateCountdown(invitation);
      populateEvent(invitation);
      populateStory(invitation);
      populateGallery(invitation);
      populateGift(invitation);
      populateFooter(invitation);

      // Initialize interactive modules
      initMusic(invitation);
      initRSVP(invitation);
      initGuestbook(invitation);
      initGalleryLightbox();
      initScrollAnimations();
      initParticles(invitation.themes?.config);

      // Load initial guestbook
      await loadGuestbook(invitation.id);
      await loadRSVPStats(invitation.id);

      // Realtime
      setupRealtime(invitation.id);

      // Analytics
      OMEGA.analytics.trackView(invitation.id);

      showLoading(false);
      showOpening();

    } catch (err) {
      console.error('Boot error:', err);
      showLoading(false);
      showError('Gagal memuat undangan. Silakan refresh halaman.');
    }
  }

  function resolveSlug() {
    // Support /i/slug, /?slug=, or just slug in path
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'i' && parts[1]) return parts[1];
    if (parts[0]) return parts[0];
    return OMEGA.utils.getQueryParam('slug') || OMEGA.utils.getQueryParam('s');
  }

  // ============================================================
  // LOADING
  // ============================================================
  function showLoading(show) {
    const el = document.getElementById('loading-screen');
    if (!el) return;
    if (show) {
      el.classList.remove('fade-out');
    } else {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 700);
    }
  }

  function showError(msg) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a0a0a;color:#fff;font-family:sans-serif;text-align:center;padding:24px;">
        <div>
          <div style="font-size:48px;margin-bottom:16px;">💌</div>
          <h2 style="color:#C9A84C;margin-bottom:12px;font-size:22px;">Undangan Tidak Tersedia</h2>
          <p style="opacity:0.6;font-size:14px;">${OMEGA.utils.sanitizeHTML(msg)}</p>
        </div>
      </div>`;
  }

  // ============================================================
  // OPENING
  // ============================================================
  function showOpening() {
    const opening = document.getElementById('opening-screen');
    if (!opening) return;
    opening.classList.remove('hidden');
    requestAnimationFrame(() => opening.classList.add('opening-reveal'));
  }

  OMEGA.invitation.openInvitation = function () {
    const opening = document.getElementById('opening-screen');
    const main = document.getElementById('invitation-main');

    if (State.invitation?.enable_music) {
      playMusic();
    }

    opening.classList.add('opening-exit');
    setTimeout(() => {
      opening.style.display = 'none';
      main.classList.remove('hidden');
      document.body.removeAttribute('data-scroll-locked');
      document.body.style.overflow = '';

      // Start scroll animations
      refreshAnimations();

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'instant' });
    }, 700);

    OMEGA.analytics.track(State.invitation.id, 'invitation_opened');
  };

  // ============================================================
  // META & SEO
  // ============================================================
  function populateMeta(inv) {
    const title = `Undangan Pernikahan ${inv.bride_name} & ${inv.groom_name}`;
    document.title = inv.meta_title || title;
    setMeta('meta-description', inv.meta_description || `Anda diundang ke pernikahan ${inv.bride_name} & ${inv.groom_name}`);
    setMeta('og-title', title);
    setMeta('og-description', inv.meta_description || `${inv.bride_name} & ${inv.groom_name} mengundang Anda`);
    if (inv.og_image_url || inv.cover_photo_url) {
      setMeta('og-image', inv.og_image_url || inv.cover_photo_url, 'content');
    }
  }

  function setMeta(id, value, attr = 'content') {
    const el = document.getElementById(id);
    if (el) el.setAttribute(attr, value);
  }

  // ============================================================
  // OPENING SECTION
  // ============================================================
  function populateOpening(inv) {
    setText('opening-couple-name', null); // will build manually

    // Bride name
    const brideEl = document.querySelector('.opening-bride');
    const groomEl = document.querySelector('.opening-groom');
    if (brideEl) brideEl.textContent = inv.bride_name;
    if (groomEl) groomEl.textContent = inv.groom_name;

    // Guest name
    const guestEl = document.getElementById('opening-guest-name');
    if (guestEl) {
      guestEl.textContent = State.guestName
        ? decodeURIComponent(State.guestName)
        : 'Bapak / Ibu / Saudara/i';
    }

    // Background
    if (inv.cover_photo_url) {
      const bg = document.getElementById('opening-bg');
      if (bg) {
        bg.style.backgroundImage = `url(${inv.cover_photo_url})`;
        bg.style.backgroundSize = 'cover';
        bg.style.backgroundPosition = 'center';
      }
    }
  }

  // ============================================================
  // HERO SECTION
  // ============================================================
  function populateHero(inv) {
    // Background
    if (inv.cover_photo_url || inv.couple_photo_url) {
      const bg = document.getElementById('hero-bg');
      if (bg) {
        bg.style.backgroundImage = `url(${inv.couple_photo_url || inv.cover_photo_url})`;
        bg.style.backgroundSize = 'cover';
        bg.style.backgroundPosition = 'center';
      }
    }

    // Bismillah - only for Islamic theme or if not explicitly disabled
    const bismillah = document.getElementById('hero-bismillah');
    if (bismillah && inv.themes?.slug && !inv.themes.slug.includes('chinese')) {
      bismillah.style.display = '';
    } else if (bismillah) {
      bismillah.style.display = 'none';
    }

    // Bride
    setText('hero-bride-name', inv.bride_name);
    setText('hero-bride-full', inv.bride_full_name || inv.bride_name);
    setText('hero-bride-parents', inv.bride_father && inv.bride_mother
      ? `Putri dari ${inv.bride_father} & ${inv.bride_mother}` : '');

    if (inv.bride_photo_url) setImage('bride-photo', inv.bride_photo_url, `Foto ${inv.bride_name}`);
    if (inv.bride_instagram) {
      const igEl = document.getElementById('bride-ig');
      if (igEl) {
        igEl.href = `https://instagram.com/${inv.bride_instagram.replace('@', '')}`;
        igEl.querySelector('svg').nextSibling.textContent = ` @${inv.bride_instagram.replace('@', '')}`;
      }
    } else {
      const igEl = document.getElementById('bride-ig');
      if (igEl) igEl.style.display = 'none';
    }

    // Groom
    setText('hero-groom-name', inv.groom_name);
    setText('hero-groom-full', inv.groom_full_name || inv.groom_name);
    setText('hero-groom-parents', inv.groom_father && inv.groom_mother
      ? `Putra dari ${inv.groom_father} & ${inv.groom_mother}` : '');

    if (inv.groom_photo_url) setImage('groom-photo', inv.groom_photo_url, `Foto ${inv.groom_name}`);
    if (inv.groom_instagram) {
      const igEl = document.getElementById('groom-ig');
      if (igEl) {
        igEl.href = `https://instagram.com/${inv.groom_instagram.replace('@', '')}`;
        igEl.querySelector('svg').nextSibling.textContent = ` @${inv.groom_instagram.replace('@', '')}`;
      }
    } else {
      const igEl = document.getElementById('groom-ig');
      if (igEl) igEl.style.display = 'none';
    }

    // Opening text / intro
    if (inv.opening_text) {
      setText('hero-intro', inv.opening_text);
    }
  }

  // ============================================================
  // COUNTDOWN
  // ============================================================
  function populateCountdown(inv) {
    if (!inv.enable_countdown) {
      document.getElementById('section-countdown')?.remove();
      return;
    }

    const targetDate = inv.reception_date || inv.akad_date;
    if (!targetDate) return;

    function tick() {
      const cd = OMEGA.utils.countdown(targetDate);
      if (cd.expired) {
        document.getElementById('countdown-wrapper')?.classList.add('hidden');
        document.getElementById('countdown-expired')?.classList.remove('hidden');
        clearInterval(State.countdownTimer);
        return;
      }

      updateCountdown('cd-days', String(cd.days).padStart(2, '0'));
      updateCountdown('cd-hours', String(cd.hours).padStart(2, '0'));
      updateCountdown('cd-minutes', String(cd.minutes).padStart(2, '0'));
      updateCountdown('cd-seconds', String(cd.seconds).padStart(2, '0'));
    }

    tick();
    State.countdownTimer = setInterval(tick, 1000);
  }

  function updateCountdown(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.textContent !== value) {
      el.classList.add('flip');
      el.textContent = value;
      setTimeout(() => el.classList.remove('flip'), 400);
    }
  }

  // ============================================================
  // EVENT SECTION
  // ============================================================
  function populateEvent(inv) {
    // Akad
    if (inv.akad_date) {
      setText('akad-date', OMEGA.utils.formatDate(inv.akad_date));
      setText('akad-time', new Date(inv.akad_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB');
      setText('akad-location', inv.akad_location || '');
      setText('akad-address', inv.akad_address || '');
      const akadBtn = document.getElementById('akad-map-btn');
      if (akadBtn && inv.akad_maps_url) {
        akadBtn.href = inv.akad_maps_url;
      } else if (akadBtn && inv.akad_address) {
        akadBtn.href = `https://maps.google.com?q=${encodeURIComponent(inv.akad_address)}`;
      }
    } else {
      document.getElementById('akad-card')?.remove();
    }

    // Reception
    if (inv.reception_date) {
      setText('reception-date', OMEGA.utils.formatDate(inv.reception_date));
      setText('reception-time', new Date(inv.reception_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB');
      setText('reception-location', inv.reception_location || '');
      setText('reception-address', inv.reception_address || '');
      const recBtn = document.getElementById('reception-map-btn');
      if (recBtn && inv.reception_maps_url) {
        recBtn.href = inv.reception_maps_url;
      } else if (recBtn && inv.reception_address) {
        recBtn.href = `https://maps.google.com?q=${encodeURIComponent(inv.reception_address)}`;
      }
    } else {
      document.getElementById('reception-card')?.remove();
    }

    // Maps embed
    const mapsEmbed = document.getElementById('maps-embed');
    const mapsWrapper = document.getElementById('maps-embed-wrapper');
    if (inv.reception_maps_embed && mapsEmbed) {
      // Extract src from embed code if full iframe given
      const srcMatch = inv.reception_maps_embed.match(/src="([^"]+)"/);
      mapsEmbed.src = srcMatch ? srcMatch[1] : inv.reception_maps_embed;
    } else if (mapsWrapper) {
      mapsWrapper.style.display = 'none';
    }

    // Calendar button
    const calBtn = document.getElementById('add-calendar-btn');
    if (calBtn && (inv.reception_date || inv.akad_date)) {
      calBtn.addEventListener('click', () => addToCalendar(inv));
    } else if (calBtn) {
      calBtn.style.display = 'none';
    }
  }

  function addToCalendar(inv) {
    const date = new Date(inv.reception_date || inv.akad_date);
    const end = new Date(date.getTime() + 3 * 60 * 60 * 1000); // +3 hours
    const title = `Pernikahan ${inv.bride_name} & ${inv.groom_name}`;
    const location = inv.reception_address || inv.reception_location || '';
    const details = `Anda diundang ke pernikahan ${inv.bride_name} & ${inv.groom_name}`;

    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(date)}/${fmt(end)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
    window.open(url, '_blank', 'noopener');
  }

  // ============================================================
  // LOVE STORY
  // ============================================================
  function populateStory(inv) {
    const section = document.getElementById('section-story');
    const timeline = document.getElementById('story-timeline');

    if (!inv.stories || inv.stories.length === 0) {
      section?.classList.add('hidden');
      return;
    }

    section?.classList.remove('hidden');

    const sorted = [...inv.stories].sort((a, b) => a.sort_order - b.sort_order);
    timeline.innerHTML = sorted.map((story, i) => `
      <div class="story-item" role="listitem" style="animation-delay:${i * 0.1}s">
        ${story.date ? `<div class="story-date">${formatStoryDate(story.date)}</div>` : ''}
        <div class="story-title">${OMEGA.utils.sanitizeHTML(story.title)}</div>
        ${story.content ? `<div class="story-content">${OMEGA.utils.sanitizeHTML(story.content)}</div>` : ''}
        ${story.image_url ? `<img class="story-image" src="${story.image_url}" alt="${OMEGA.utils.sanitizeHTML(story.title)}" loading="lazy" />` : ''}
      </div>
    `).join('');
  }

  function formatStoryDate(dateStr) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
    } catch { return dateStr; }
  }

  // ============================================================
  // GALLERY
  // ============================================================
  function populateGallery(inv) {
    const section = document.getElementById('section-gallery');
    const grid = document.getElementById('gallery-grid');

    if (!inv.gallery || inv.gallery.length === 0) {
      section?.classList.add('hidden');
      return;
    }

    section?.classList.remove('hidden');

    const sorted = [...inv.gallery].sort((a, b) => a.sort_order - b.sort_order);
    State.galleryItems = sorted;

    grid.innerHTML = sorted.map((item, i) => `
      <div class="gallery-item" role="listitem" tabindex="0" data-index="${i}" aria-label="Foto ${i + 1}">
        <img
          src="${item.thumbnail_url || item.url}"
          data-src="${item.url}"
          alt="${item.caption ? OMEGA.utils.sanitizeHTML(item.caption) : `Foto ${i + 1}`}"
          loading="lazy"
        />
        <div class="gallery-item-overlay">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </div>
      </div>
    `).join('');

    // Lazy load
    OMEGA.utils.lazyLoad();
  }

  function initGalleryLightbox() {
    const grid = document.getElementById('gallery-grid');
    const lightbox = document.getElementById('gallery-lightbox');
    const img = document.getElementById('lightbox-img');
    const caption = document.getElementById('lightbox-caption');

    if (!grid || !lightbox) return;

    function openLightbox(index) {
      State.galleryIndex = index;
      const item = State.galleryItems[index];
      if (!item) return;
      img.src = item.url;
      caption.textContent = item.caption || '';
      lightbox.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      lightbox.classList.add('hidden');
      document.body.style.overflow = '';
    }

    function navigate(dir) {
      const total = State.galleryItems.length;
      State.galleryIndex = (State.galleryIndex + dir + total) % total;
      const item = State.galleryItems[State.galleryIndex];
      img.style.opacity = '0';
      setTimeout(() => {
        img.src = item.url;
        caption.textContent = item.caption || '';
        img.style.opacity = '1';
      }, 150);
    }

    grid.addEventListener('click', (e) => {
      const item = e.target.closest('.gallery-item');
      if (item) openLightbox(parseInt(item.dataset.index));
    });

    grid.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const item = e.target.closest('.gallery-item');
        if (item) { e.preventDefault(); openLightbox(parseInt(item.dataset.index)); }
      }
    });

    document.getElementById('lightbox-close')?.addEventListener('click', closeLightbox);
    document.getElementById('lightbox-prev')?.addEventListener('click', () => navigate(-1));
    document.getElementById('lightbox-next')?.addEventListener('click', () => navigate(1));

    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

    document.addEventListener('keydown', (e) => {
      if (lightbox.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
    });

    // Touch swipe
    let touchStartX = 0;
    lightbox.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
    lightbox.addEventListener('touchend', (e) => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) navigate(diff > 0 ? 1 : -1);
    });
  }

  // ============================================================
  // GIFT
  // ============================================================
  function populateGift(inv) {
    const section = document.getElementById('section-gift');
    const container = document.getElementById('gift-accounts');

    const accounts = inv.gift_accounts;
    if (!inv.enable_gift || !accounts || accounts.length === 0) {
      section?.classList.add('hidden');
      return;
    }

    section?.classList.remove('hidden');

    container.innerHTML = accounts.map((acc) => `
      <div class="gift-account" role="listitem">
        <div class="gift-bank-info">
          <div class="gift-bank-name">${OMEGA.utils.sanitizeHTML(acc.bank || acc.type || 'Transfer')}</div>
          <div class="gift-account-number">${OMEGA.utils.sanitizeHTML(acc.number || acc.account_number || '')}</div>
          <div class="gift-account-name">${OMEGA.utils.sanitizeHTML(acc.name || acc.account_name || '')}</div>
        </div>
        <button class="gift-copy-btn" data-number="${OMEGA.utils.sanitizeHTML(acc.number || acc.account_number || '')}" aria-label="Salin nomor rekening">
          Salin
        </button>
      </div>
    `).join('');

    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('.gift-copy-btn');
      if (!btn) return;
      await OMEGA.utils.copyToClipboard(btn.dataset.number);
      btn.textContent = '✓ Tersalin';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Salin'; btn.classList.remove('copied'); }, 2000);
    });
  }

  // ============================================================
  // FOOTER
  // ============================================================
  function populateFooter(inv) {
    setText('footer-couple-name', `${inv.bride_name} & ${inv.groom_name}`);

    const branding = document.getElementById('footer-branding');
    if (inv.hide_branding) {
      branding?.remove();
    } else if (inv.custom_branding && branding) {
      branding.innerHTML = OMEGA.utils.sanitizeHTML(inv.custom_branding);
    }
  }

  // ============================================================
  // MUSIC
  // ============================================================
  function initMusic(inv) {
    const audio = document.getElementById('bg-music');
    const btn = document.getElementById('music-btn');
    const icon = document.getElementById('music-icon');
    const titleEl = document.getElementById('music-title-display');
    const controller = document.getElementById('music-controller');

    if (!inv.enable_music || !inv.background_music_url) {
      controller?.classList.add('hidden');
      return;
    }

    document.getElementById('music-source').src = inv.background_music_url;
    audio.load();

    if (inv.music_title) {
      titleEl.textContent = `♪ ${inv.music_title}`;
    }

    btn.addEventListener('click', () => {
      if (State.musicPlaying) {
        pauseMusic();
      } else {
        playMusic();
      }
    });
  }

  function playMusic() {
    const audio = document.getElementById('bg-music');
    const icon = document.getElementById('music-icon');
    if (!audio) return;
    audio.play().then(() => {
      State.musicPlaying = true;
      icon?.classList.remove('paused');
    }).catch(() => {
      // Autoplay blocked - user must interact
      State.musicPlaying = false;
    });
  }

  function pauseMusic() {
    const audio = document.getElementById('bg-music');
    const icon = document.getElementById('music-icon');
    if (!audio) return;
    audio.pause();
    State.musicPlaying = false;
    icon?.classList.add('paused');
  }

  // ============================================================
  // RSVP
  // ============================================================
  function initRSVP(inv) {
    const section = document.getElementById('section-rsvp');
    const form = document.getElementById('rsvp-form');

    if (!inv.enable_rsvp) {
      section?.remove();
      return;
    }

    // Pre-fill guest name
    if (State.guestName) {
      const nameInput = document.getElementById('rsvp-name');
      if (nameInput) nameInput.value = decodeURIComponent(State.guestName);
    }

    // Find guest record by code
    if (State.guestCode) {
      findGuestByCode(State.guestCode);
    }

    // Pax counter
    const paxInput = document.getElementById('rsvp-pax');
    document.getElementById('pax-decrease')?.addEventListener('click', () => {
      const val = parseInt(paxInput.value);
      if (val > 1) paxInput.value = val - 1;
    });
    document.getElementById('pax-increase')?.addEventListener('click', () => {
      const val = parseInt(paxInput.value);
      const max = parseInt(paxInput.max) || inv.guest_limit_per_rsvp || 10;
      if (val < max) paxInput.value = val + 1;
    });

    // Char counter
    const msgArea = document.getElementById('rsvp-message');
    msgArea?.addEventListener('input', () => {
      setText('msg-char-count', msgArea.value.length);
    });

    // Status change - hide pax if not attending
    document.querySelectorAll('[name="status"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const paxGroup = document.getElementById('pax-group');
        if (paxGroup) {
          paxGroup.style.display = radio.value === 'attending' ? '' : 'none';
        }
      });
    });

    // Form submit
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (State.rsvpSubmitted) return;

      const submitBtn = document.getElementById('rsvp-submit');
      const btnText = submitBtn.querySelector('.btn-text');
      const btnLoader = submitBtn.querySelector('.btn-loader');

      const name = document.getElementById('rsvp-name')?.value?.trim();
      const phone = document.getElementById('rsvp-phone')?.value?.trim();
      const status = document.querySelector('[name="status"]:checked')?.value;
      const pax = parseInt(paxInput?.value) || 1;
      const message = document.getElementById('rsvp-message')?.value?.trim();

      if (!name) { OMEGA.utils.showToast('Nama tidak boleh kosong', 'error'); return; }
      if (!status) { OMEGA.utils.showToast('Silakan pilih konfirmasi kehadiran', 'error'); return; }

      submitBtn.disabled = true;
      btnText.classList.add('hidden');
      btnLoader.classList.remove('hidden');

      try {
        await OMEGA.rsvp.submit(inv.id, { name, phone, status, pax_count: pax, message }, State.guestId);
        State.rsvpSubmitted = true;

        form.classList.add('hidden');
        document.getElementById('rsvp-success')?.classList.remove('hidden');

        await loadRSVPStats(inv.id);
        OMEGA.analytics.track(inv.id, 'rsvp_submitted', { status });
      } catch (err) {
        OMEGA.utils.showToast(err.message || 'Gagal mengirim. Coba lagi.', 'error');
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
      }
    });
  }

  async function findGuestByCode(code) {
    try {
      const sb = OMEGA.getSupabase();
      const { data } = await sb.from('guests').select('id, name').eq('unique_code', code).maybeSingle();
      if (data) {
        State.guestId = data.id;
        if (!State.guestName) {
          const nameInput = document.getElementById('rsvp-name');
          if (nameInput && !nameInput.value) nameInput.value = data.name;
        }
      }
    } catch (e) { /* non-critical */ }
  }

  async function loadRSVPStats(invId) {
    try {
      const summary = await OMEGA.rsvp.getSummary(invId);
      animateNumber('stat-attending', summary.attending || 0);
      animateNumber('stat-not-attending', summary.not_attending || 0);
      animateNumber('stat-pax', summary.total_pax || 0);
    } catch (e) { /* non-critical */ }
  }

  function animateNumber(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const duration = 600;
    const startTime = performance.now();
    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      el.textContent = Math.round(start + (target - start) * progress);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ============================================================
  // GUESTBOOK
  // ============================================================
  function initGuestbook(inv) {
    const section = document.getElementById('section-guestbook');
    const form = document.getElementById('guestbook-form');

    if (!inv.enable_guestbook) {
      section?.remove();
      return;
    }

    // Char counter
    const msgArea = document.getElementById('gb-message');
    msgArea?.addEventListener('input', () => {
      setText('gb-char-count', msgArea.value.length);
    });

    // Pre-fill name from guest
    if (State.guestName) {
      const nameInput = document.getElementById('gb-name');
      if (nameInput) nameInput.value = decodeURIComponent(State.guestName);
    }

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('gb-submit');
      const btnText = btn.querySelector('.btn-text');
      const btnLoader = btn.querySelector('.btn-loader');

      const name = document.getElementById('gb-name')?.value?.trim();
      const message = document.getElementById('gb-message')?.value?.trim();

      if (!name) { OMEGA.utils.showToast('Nama tidak boleh kosong', 'error'); return; }
      if (!message) { OMEGA.utils.showToast('Pesan tidak boleh kosong', 'error'); return; }

      btn.disabled = true;
      btnText.classList.add('hidden');
      btnLoader.classList.remove('hidden');

      try {
        const entry = await OMEGA.guestbook.post(inv.id, name, message, State.guestId);
        document.getElementById('gb-name').value = '';
        document.getElementById('gb-message').value = '';
        setText('gb-char-count', '0');
        prependGuestbookEntry(entry);
        OMEGA.utils.showToast('Ucapan berhasil dikirim! 💌', 'success');
        OMEGA.analytics.track(inv.id, 'guestbook_posted');
      } catch (err) {
        OMEGA.utils.showToast(err.message || 'Gagal mengirim ucapan', 'error');
      } finally {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
      }
    });

    // Load more
    document.getElementById('gb-load-more')?.addEventListener('click', async () => {
      State.gbPage++;
      await loadGuestbook(inv.id, State.gbPage, true);
    });
  }

  async function loadGuestbook(invId, page = 1, append = false) {
    try {
      const { data, totalPages } = await OMEGA.guestbook.list(invId, page);
      const container = document.getElementById('guestbook-messages');
      const loadMoreBtn = document.getElementById('gb-load-more');

      if (!container) return;

      if (!append) container.innerHTML = '';

      if (data.length === 0 && !append) {
        container.innerHTML = '<p style="text-align:center;opacity:0.4;font-size:14px;padding:32px;">Jadilah yang pertama memberikan ucapan 💌</p>';
        return;
      }

      data.forEach(entry => {
        if (!append || !document.querySelector(`[data-gb-id="${entry.id}"]`)) {
          container.appendChild(createGuestbookElement(entry));
        }
      });

      State.gbHasMore = page < totalPages;
      if (loadMoreBtn) {
        loadMoreBtn.classList.toggle('hidden', !State.gbHasMore);
      }
    } catch (e) {
      console.warn('Guestbook load error:', e);
    }
  }

  function prependGuestbookEntry(entry) {
    const container = document.getElementById('guestbook-messages');
    if (!container) return;
    const emptyMsg = container.querySelector('p');
    if (emptyMsg) emptyMsg.remove();
    const el = createGuestbookElement(entry);
    container.insertBefore(el, container.firstChild);
  }

  function createGuestbookElement(entry) {
    const div = document.createElement('div');
    div.className = `guestbook-message${entry.is_pinned ? ' pinned' : ''}`;
    div.setAttribute('data-gb-id', entry.id);
    div.setAttribute('role', 'article');

    const initial = (entry.name || 'A').charAt(0).toUpperCase();
    const timeAgo = formatTimeAgo(entry.created_at);

    div.innerHTML = `
      ${entry.is_pinned ? '<div class="message-pinned-badge">⭐ Pinned</div>' : ''}
      <div class="message-header">
        <div class="message-avatar" aria-hidden="true">${initial}</div>
        <div>
          <div class="message-name">${OMEGA.utils.sanitizeHTML(entry.name)}</div>
          <div class="message-time">${timeAgo}</div>
        </div>
      </div>
      <div class="message-text">${OMEGA.utils.sanitizeHTML(entry.message)}</div>
    `;
    return div;
  }

  function formatTimeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    if (days < 7) return `${days} hari lalu`;
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ============================================================
  // REALTIME
  // ============================================================
  function setupRealtime(invId) {
    // RSVP realtime
    const rsvpChannel = OMEGA.rsvp.subscribeRealtime(invId, () => {
      loadRSVPStats(invId);
    });
    State.realtimeChannels.push(rsvpChannel);

    // Guestbook realtime
    const gbChannel = OMEGA.guestbook.subscribeRealtime(invId, (payload) => {
      if (payload.new) {
        prependGuestbookEntry(payload.new);
      }
    });
    State.realtimeChannels.push(gbChannel);
  }

  // ============================================================
  // SCROLL ANIMATIONS
  // ============================================================
  function initScrollAnimations() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.animate-up').forEach(el => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

    document.querySelectorAll('.animate-up').forEach(el => observer.observe(el));
    window._omegaScrollObserver = observer;
  }

  function refreshAnimations() {
    if (window._omegaScrollObserver) {
      document.querySelectorAll('.animate-up:not(.visible)').forEach(el => {
        window._omegaScrollObserver.observe(el);
      });
    } else {
      initScrollAnimations();
    }
  }

  // ============================================================
  // PARTICLES
  // ============================================================
  function initParticles(themeConfig) {
    const type = themeConfig?.particles;
    if (!type || type === 'none') return;

    const containers = [
      document.getElementById('opening-particles'),
      document.getElementById('hero-particles'),
    ];

    containers.forEach(container => {
      if (!container) return;
      switch (type) {
        case 'gold_dust': createGoldDust(container); break;
        case 'petals': createPetals(container); break;
        case 'fireflies': createFireflies(container); break;
        case 'snow': createSnow(container); break;
        default: break;
      }
    });
  }

  function createGoldDust(container) {
    const count = 30;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = Math.random() * 4 + 2;
      p.style.cssText = `
        left:${Math.random() * 100}%;
        width:${size}px; height:${size}px;
        background:radial-gradient(circle, #E8C97A, #C9A84C);
        opacity:${Math.random() * 0.6 + 0.2};
        animation-duration:${Math.random() * 8 + 6}s;
        animation-delay:${Math.random() * 8}s;
        filter:blur(${Math.random() > 0.7 ? 1 : 0}px);
      `;
      container.appendChild(p);
    }
  }

  function createPetals(container) {
    const colors = ['#F9A8C0', '#F4728A', '#FCE4EC', '#F06292'];
    const count = 20;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'petal';
      const size = Math.random() * 14 + 8;
      const color = colors[Math.floor(Math.random() * colors.length)];
      p.style.cssText = `
        left:${Math.random() * 100}%;
        width:${size}px; height:${size * 0.7}px;
        background:${color};
        border-radius:50% 0 50% 0;
        opacity:${Math.random() * 0.7 + 0.3};
        animation-duration:${Math.random() * 6 + 8}s;
        animation-delay:${Math.random() * 10}s;
      `;
      container.appendChild(p);
    }
  }

  function createFireflies(container) {
    const count = 20;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = Math.random() * 5 + 3;
      p.style.cssText = `
        left:${Math.random() * 100}%;
        top:${Math.random() * 100}%;
        width:${size}px; height:${size}px;
        background:#FFFACD;
        box-shadow:0 0 ${size * 2}px #FFD700, 0 0 ${size * 4}px rgba(255,215,0,0.4);
        animation:fireflyFloat ${Math.random() * 6 + 4}s ease-in-out infinite;
        animation-delay:${Math.random() * 6}s;
        border-radius:50%;
      `;
      container.appendChild(p);
    }

    // Inject firefly keyframe if not present
    if (!document.getElementById('firefly-style')) {
      const style = document.createElement('style');
      style.id = 'firefly-style';
      style.textContent = `
        @keyframes fireflyFloat {
          0%,100% { transform:translate(0,0) scale(0.8); opacity:0.2; }
          25% { transform:translate(${rand(-30,30)}px,${rand(-30,30)}px) scale(1); opacity:0.9; }
          50% { transform:translate(${rand(-30,30)}px,${rand(-30,30)}px) scale(0.6); opacity:0.4; }
          75% { transform:translate(${rand(-30,30)}px,${rand(-30,30)}px) scale(1.1); opacity:0.8; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  function createSnow(container) {
    const count = 30;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = Math.random() * 6 + 3;
      p.style.cssText = `
        left:${Math.random() * 100}%;
        width:${size}px; height:${size}px;
        background:rgba(255,255,255,0.8);
        border-radius:50%;
        animation-duration:${Math.random() * 6 + 8}s;
        animation-delay:${Math.random() * 10}s;
        filter:blur(${Math.random() > 0.5 ? 0.5 : 0}px);
      `;
      container.appendChild(p);
    }
  }

  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  // ============================================================
  // FONT LOADING
  // ============================================================
  function loadThemeFonts(config) {
    if (!config) return;
    const fonts = [config.primaryFont, config.secondaryFont].filter(Boolean);
    if (fonts.length === 0) return;

    const existing = document.getElementById('theme-fonts');
    if (existing) existing.remove();

    const link = document.createElement('link');
    link.id = 'theme-fonts';
    link.rel = 'stylesheet';
    const query = fonts.map(f => `family=${encodeURIComponent(f)}:ital,wght@0,300;0,400;0,600;1,300;1,400`).join('&');
    link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
    document.head.appendChild(link);

    // Apply fonts to CSS vars
    const root = document.documentElement;
    if (config.primaryFont) root.style.setProperty('--font-display', `'${config.primaryFont}', Georgia, serif`);
    if (config.secondaryFont) root.style.setProperty('--font-body', `'${config.secondaryFont}', sans-serif`);
  }

  // ============================================================
  // HELPERS
  // ============================================================
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el && text !== null && text !== undefined) el.textContent = text;
  }

  function setImage(id, src, alt) {
    const el = document.getElementById(id);
    if (el) { el.src = src; if (alt) el.alt = alt; }
  }

  // ============================================================
  // CLEANUP
  // ============================================================
  window.addEventListener('beforeunload', () => {
    if (State.countdownTimer) clearInterval(State.countdownTimer);
    State.realtimeChannels.forEach(ch => {
      try { ch.unsubscribe(); } catch (e) { /* ignore */ }
    });
  });

  // ============================================================
  // INIT
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
