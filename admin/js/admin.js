/**
 * OMEGA INVITATION PLATFORM
 * Admin Panel - Complete Runtime
 * Handles: routing, dashboard, invitations, guests, RSVP,
 *          attendance, guestbook, themes, analytics, payments, settings
 */

(function () {
  'use strict';

  // ============================================================
  // STATE
  // ============================================================
  const AdminState = {
    profile: null,
    currentPage: 'dashboard',
    currentInvitationId: null,
    invitations: [],
    invPage: 1,
    guestPage: 1,
    selectedGuests: new Set(),
    importData: [],
    realtimeChannels: [],
    notifCount: 0,
  };

  // ============================================================
  // BOOT
  // ============================================================
  async function boot() {
    try {
      const sb = OMEGA.getSupabase();

      // Auth guard
      const session = await OMEGA.auth.getSession();
      if (!session) {
        window.location.href = '/admin/login.html';
        return;
      }

      // Load profile
      AdminState.profile = await OMEGA.auth.getProfile();
      if (!AdminState.profile) {
        window.location.href = '/admin/login.html';
        return;
      }

      // Populate UI with user info
      renderUserInfo(AdminState.profile);

      // Hide role-restricted nav items
      applyRoleVisibility(AdminState.profile.role);

      // Router - check URL hash
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      navigateTo(hash);

      // Setup nav listeners
      initNavigation();

      // Setup mobile sidebar
      initSidebar();

      // Setup notification bell
      initNotifications();

      // Load initial invitation list for selectors
      await loadInvitationSelectors();

    } catch (err) {
      console.error('Admin boot error:', err);
      showToast('Gagal memuat panel admin', 'error');
    }
  }

  // ============================================================
  // USER INFO
  // ============================================================
  function renderUserInfo(profile) {
    const initial = (profile.full_name || profile.email || 'A').charAt(0).toUpperCase();
    setText('user-name', profile.full_name || profile.email);
    setText('user-role', profile.role);
    setText('user-avatar', initial);
    setText('topbar-username', profile.full_name || profile.email);
    setText('topbar-avatar', initial);
  }

  function applyRoleVisibility(role) {
    const adminOnlyItems = document.querySelectorAll('[data-role]');
    adminOnlyItems.forEach(item => {
      const allowed = item.dataset.role.split(',').map(r => r.trim());
      if (!allowed.includes(role)) {
        item.style.display = 'none';
      }
    });
  }

  // ============================================================
  // NAVIGATION / ROUTER
  // ============================================================
  function initNavigation() {
    // Sidebar nav links
    document.querySelectorAll('.nav-item[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        navigateTo(page);
        closeSidebar();
      });
    });

    // Card action links
    document.querySelectorAll('[data-page]').forEach(el => {
      if (!el.classList.contains('nav-item')) {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          navigateTo(el.dataset.page);
        });
      }
    });

    // Quick action buttons
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (page) navigateTo(page);
      });
    });

    // Dashboard new invitation button
    document.getElementById('btn-new-invitation')?.addEventListener('click', () => {
      navigateTo('invitations');
      setTimeout(() => openInvitationModal(), 100);
    });

    // Logout
    document.getElementById('nav-logout')?.addEventListener('click', async () => {
      if (confirm('Yakin ingin keluar?')) {
        await OMEGA.auth.signOut();
        window.location.href = '/admin/login.html';
      }
    });

    // Hash change
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash !== AdminState.currentPage) navigateTo(hash, false);
    });
  }

  function navigateTo(page, updateHash = true) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
      p.classList.add('hidden');
    });

    // Show target page
    const target = document.getElementById(`page-${page}`);
    if (!target) { navigateTo('dashboard'); return; }

    target.classList.remove('hidden');
    target.classList.add('active');

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');

    // Update breadcrumb
    const breadcrumbs = {
      dashboard: 'Dashboard', invitations: 'Undangan', guests: 'Tamu',
      rsvp: 'RSVP', attendance: 'Absensi QR', guestbook: 'Buku Tamu',
      themes: 'Tema', media: 'Media', analytics: 'Analitik',
      payments: 'Pembayaran', resellers: 'Reseller', users: 'Pengguna', settings: 'Pengaturan',
    };
    setText('topbar-breadcrumb', breadcrumbs[page] || page);

    AdminState.currentPage = page;
    if (updateHash) window.location.hash = page;

    // Load page data
    loadPageData(page);
  }

  async function loadPageData(page) {
    switch (page) {
      case 'dashboard': await loadDashboard(); break;
      case 'invitations': await loadInvitations(); break;
      case 'themes': await loadThemes(); break;
      case 'payments': await loadPayments(); break;
      case 'settings': await loadSettings(); break;
      case 'analytics': initAnalyticsPage(); break;
    }
  }

  // ============================================================
  // SIDEBAR (MOBILE)
  // ============================================================
  function initSidebar() {
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const menuBtn = document.getElementById('topbar-menu-btn');
    const closeBtn = document.getElementById('sidebar-close');

    menuBtn?.addEventListener('click', () => {
      sidebar.classList.add('open');
      overlay.classList.remove('hidden');
      menuBtn.setAttribute('aria-expanded', 'true');
    });

    function close() {
      sidebar.classList.remove('open');
      overlay.classList.add('hidden');
      menuBtn?.setAttribute('aria-expanded', 'false');
    }

    closeBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', close);
    window.closeSidebar = close;
  }

  function closeSidebar() {
    if (window.closeSidebar) window.closeSidebar();
  }

  // ============================================================
  // NOTIFICATIONS
  // ============================================================
  function initNotifications() {
    loadNotificationCount();

    document.getElementById('topbar-notif-btn')?.addEventListener('click', async () => {
      const notifs = await OMEGA.notifications.list(10);
      await OMEGA.notifications.markAllRead();
      showNotifDropdown(notifs);
      setBadge(0);
    });

    // Realtime
    if (AdminState.profile) {
      const ch = OMEGA.notifications.subscribeRealtime(AdminState.profile.id, () => {
        AdminState.notifCount++;
        setBadge(AdminState.notifCount);
      });
      AdminState.realtimeChannels.push(ch);
    }
  }

  async function loadNotificationCount() {
    try {
      const notifs = await OMEGA.notifications.list(50);
      const unread = notifs.filter(n => !n.is_read).length;
      AdminState.notifCount = unread;
      setBadge(unread);
    } catch (e) { /* non-critical */ }
  }

  function setBadge(count) {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function showNotifDropdown(notifs) {
    const existing = document.getElementById('notif-dropdown');
    if (existing) { existing.remove(); return; }

    const dropdown = document.createElement('div');
    dropdown.id = 'notif-dropdown';
    dropdown.style.cssText = `
      position:fixed;top:64px;right:20px;width:320px;max-height:400px;
      background:var(--admin-surface);border:1px solid var(--admin-border);
      border-radius:12px;overflow-y:auto;z-index:300;box-shadow:0 16px 48px rgba(0,0,0,0.4);
    `;

    if (notifs.length === 0) {
      dropdown.innerHTML = '<div style="padding:24px;text-align:center;color:var(--admin-text-2);font-size:13px;">Tidak ada notifikasi</div>';
    } else {
      dropdown.innerHTML = notifs.map(n => `
        <div style="padding:12px 16px;border-bottom:1px solid var(--admin-border);cursor:pointer;transition:background 0.2s;"
          onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background=''">
          <div style="font-size:13px;font-weight:${n.is_read ? 400 : 600};color:var(--admin-text)">${sanitize(n.title)}</div>
          ${n.message ? `<div style="font-size:12px;color:var(--admin-text-2);margin-top:3px">${sanitize(n.message)}</div>` : ''}
          <div style="font-size:11px;color:var(--admin-text-2);margin-top:4px">${formatTimeAgo(n.created_at)}</div>
        </div>
      `).join('');
    }

    document.body.appendChild(dropdown);
    setTimeout(() => {
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) dropdown.remove();
      }, { once: true });
    }, 100);
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  async function loadDashboard() {
    try {
      const sb = OMEGA.getSupabase();
      const uid = AdminState.profile.id;
      const role = AdminState.profile.role;

      // Build queries based on role
      let invQuery = sb.from('invitations').select('id, status', { count: 'exact' });
      let guestQuery = sb.from('guests').select('id', { count: 'exact' }).eq('is_active', true);
      let rsvpQuery = sb.from('rsvp').select('id', { count: 'exact' });

      if (role === 'customer') {
        invQuery = invQuery.eq('owner_id', uid);
        // Filter guests/rsvp by owned invitations
      }

      const [invResult, guestResult, rsvpResult, recentInvitations] = await Promise.all([
        invQuery,
        guestQuery,
        rsvpQuery,
        sb.from('invitations')
          .select('id, bride_name, groom_name, status, view_count, akad_date, themes(name, slug)')
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      // Stats
      setText('dash-total-inv', (invResult.count || 0).toLocaleString('id-ID'));
      setText('dash-total-guests', (guestResult.count || 0).toLocaleString('id-ID'));
      setText('dash-total-rsvp', (rsvpResult.count || 0).toLocaleString('id-ID'));
      setText('dash-total-revenue', 'Rp 0');

      // Recent invitations table
      renderRecentInvitations(recentInvitations.data || []);

    } catch (err) {
      console.error('Dashboard error:', err);
      showToast('Gagal memuat dashboard', 'error');
    }
  }

  function renderRecentInvitations(invitations) {
    const tbody = document.getElementById('recent-invitations-body');
    if (!tbody) return;

    if (invitations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Belum ada undangan. Buat undangan pertama Anda!</td></tr>';
      return;
    }

    tbody.innerHTML = invitations.map(inv => `
      <tr>
        <td>
          <div style="font-weight:600">${sanitize(inv.bride_name)} & ${sanitize(inv.groom_name)}</div>
        </td>
        <td><span class="badge badge-${inv.status}">${statusLabel(inv.status)}</span></td>
        <td>${sanitize(inv.themes?.name || '-')}</td>
        <td>-</td>
        <td>-</td>
        <td>
          <div class="table-actions">
            <button class="action-btn action-btn-view" onclick="adminViewInvitation('${inv.id}')" title="Lihat" aria-label="Lihat undangan">👁️</button>
            <button class="action-btn action-btn-edit" onclick="adminEditInvitation('${inv.id}')" title="Edit" aria-label="Edit undangan">✏️</button>
            <button class="action-btn action-btn-copy" onclick="adminCopyLink('${inv.id}')" title="Salin link" aria-label="Salin link">🔗</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // ============================================================
  // INVITATIONS PAGE
  // ============================================================
  async function loadInvitations(page = 1) {
    AdminState.invPage = page;
    const search = document.getElementById('inv-search')?.value?.trim() || '';
    const status = document.getElementById('inv-status-filter')?.value || '';

    try {
      const result = await OMEGA.invitation.list({ search, status }, page, 15);
      AdminState.invitations = result.data;
      renderInvitationsTable(result.data);
      renderPagination('inv-pagination', result.page, result.totalPages, (p) => loadInvitations(p));
    } catch (err) {
      console.error('Load invitations error:', err);
      showToast('Gagal memuat undangan', 'error');
    }

    // Init form
    initInvitationForm();
  }

  function initInvitationForm() {
    const createBtn = document.getElementById('btn-create-invitation');
    if (createBtn && !createBtn._bound) {
      createBtn.addEventListener('click', () => openInvitationModal());
      createBtn._bound = true;
    }

    const filterBtn = document.getElementById('inv-filter-btn');
    if (filterBtn && !filterBtn._bound) {
      filterBtn.addEventListener('click', () => loadInvitations(1));
      filterBtn._bound = true;
    }

    const searchInput = document.getElementById('inv-search');
    if (searchInput && !searchInput._bound) {
      searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadInvitations(1); });
      searchInput._bound = true;
    }
  }

  function renderInvitationsTable(invitations) {
    const tbody = document.getElementById('invitations-body');
    if (!tbody) return;

    if (invitations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Belum ada undangan</td></tr>';
      return;
    }

    tbody.innerHTML = invitations.map(inv => `
      <tr>
        <td>
          <div style="font-weight:600">${sanitize(inv.bride_name)} & ${sanitize(inv.groom_name)}</div>
        </td>
        <td>
          <code style="font-size:11px;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px">${sanitize(inv.slug)}</code>
        </td>
        <td><span class="badge badge-${inv.status}">${statusLabel(inv.status)}</span></td>
        <td>${sanitize(inv.themes?.name || '-')}</td>
        <td>${(inv.view_count || 0).toLocaleString('id-ID')}</td>
        <td>${inv.akad_date ? formatDate(inv.akad_date) : '-'}</td>
        <td>
          <div class="table-actions">
            <button class="action-btn action-btn-view" onclick="adminViewInvitation('${inv.id}')" title="Buka undangan" aria-label="Buka undangan">👁️</button>
            <button class="action-btn action-btn-edit" onclick="adminEditInvitation('${inv.id}')" title="Edit" aria-label="Edit">✏️</button>
            <button class="action-btn action-btn-copy" onclick="adminCopyLink('${inv.id}')" title="Salin link" aria-label="Salin link">🔗</button>
            <button class="action-btn action-btn-edit" onclick="adminCloneInvitation('${inv.id}')" title="Clone" aria-label="Clone undangan" style="background:rgba(99,102,241,0.1);color:#6366f1">📋</button>
            <button class="action-btn action-btn-delete" onclick="adminDeleteInvitation('${inv.id}', '${sanitize(inv.bride_name)} & ${sanitize(inv.groom_name)}')" title="Hapus" aria-label="Hapus undangan">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // ============================================================
  // INVITATION MODAL (CREATE / EDIT)
  // ============================================================
  async function openInvitationModal(invId = null) {
    const modal = document.getElementById('modal-invitation');
    const title = document.getElementById('modal-inv-title');
    const form = document.getElementById('invitation-form');

    if (!modal) return;

    // Load themes into selector
    await loadThemeSelector();

    // Reset form
    form.reset();
    document.getElementById('inv-form-id').value = '';

    if (invId) {
      title.textContent = 'Edit Undangan';
      document.getElementById('inv-form-id').value = invId;
      await fillInvitationForm(invId);
    } else {
      title.textContent = 'Buat Undangan Baru';
    }

    modal.classList.remove('hidden');

    // Close
    document.getElementById('modal-inv-close').onclick = () => modal.classList.add('hidden');
    document.getElementById('modal-inv-backdrop').onclick = () => modal.classList.add('hidden');

    // Save draft
    document.getElementById('btn-inv-save-draft').onclick = async (e) => {
      e.preventDefault();
      await saveInvitation('draft');
    };

    // Save & publish
    if (!form._bound) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveInvitation('published');
      });
      form._bound = true;
    }
  }

  async function fillInvitationForm(invId) {
    const inv = await OMEGA.invitation.getById(invId);
    if (!inv) return;

    const fields = {
      'inv-bride-name': inv.bride_name,
      'inv-groom-name': inv.groom_name,
      'inv-bride-full': inv.bride_full_name,
      'inv-groom-full': inv.groom_full_name,
      'inv-bride-father': inv.bride_father,
      'inv-bride-mother': inv.bride_mother,
      'inv-groom-father': inv.groom_father,
      'inv-groom-mother': inv.groom_mother,
      'inv-akad-location': inv.akad_location,
      'inv-akad-address': inv.akad_address,
      'inv-akad-maps': inv.akad_maps_url,
      'inv-reception-location': inv.reception_location,
      'inv-reception-address': inv.reception_address,
      'inv-reception-maps': inv.reception_maps_url,
      'inv-maps-embed': inv.reception_maps_embed,
      'inv-opening-text': inv.opening_text,
      'inv-music-url': inv.background_music_url,
      'inv-music-title': inv.music_title,
      'inv-music-artist': inv.music_artist,
      'inv-youtube': inv.youtube_embed_id,
      'inv-custom-domain': inv.custom_domain,
      'inv-guest-limit': inv.guest_limit_per_rsvp,
    };

    Object.entries(fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val != null) el.value = val;
    });

    // Dates
    if (inv.akad_date) {
      const el = document.getElementById('inv-akad-date');
      if (el) el.value = inv.akad_date.slice(0, 16);
    }
    if (inv.reception_date) {
      const el = document.getElementById('inv-reception-date');
      if (el) el.value = inv.reception_date.slice(0, 16);
    }
    if (inv.rsvp_deadline) {
      const el = document.getElementById('inv-rsvp-deadline');
      if (el) el.value = inv.rsvp_deadline.slice(0, 16);
    }

    // Theme
    const themeEl = document.getElementById('inv-theme');
    if (themeEl && inv.theme_id) themeEl.value = inv.theme_id;

    // Toggles
    const toggles = {
      'inv-enable-rsvp': inv.enable_rsvp,
      'inv-enable-guestbook': inv.enable_guestbook,
      'inv-enable-gift': inv.enable_gift,
      'inv-enable-music': inv.enable_music,
      'inv-enable-countdown': inv.enable_countdown,
      'inv-enable-qr': inv.enable_qr_attendance,
    };
    Object.entries(toggles).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!val;
    });
  }

  async function saveInvitation(status = 'draft') {
    const invId = document.getElementById('inv-form-id')?.value;
    const saveBtn = document.getElementById('btn-inv-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan...'; }

    try {
      const data = {
        bride_name: getVal('inv-bride-name'),
        groom_name: getVal('inv-groom-name'),
        bride_full_name: getVal('inv-bride-full'),
        groom_full_name: getVal('inv-groom-full'),
        bride_father: getVal('inv-bride-father'),
        bride_mother: getVal('inv-bride-mother'),
        groom_father: getVal('inv-groom-father'),
        groom_mother: getVal('inv-groom-mother'),
        akad_date: getVal('inv-akad-date') || null,
        akad_location: getVal('inv-akad-location'),
        akad_address: getVal('inv-akad-address'),
        akad_maps_url: getVal('inv-akad-maps'),
        reception_date: getVal('inv-reception-date') || null,
        reception_location: getVal('inv-reception-location'),
        reception_address: getVal('inv-reception-address'),
        reception_maps_url: getVal('inv-reception-maps'),
        reception_maps_embed: getVal('inv-maps-embed'),
        opening_text: getVal('inv-opening-text'),
        background_music_url: getVal('inv-music-url'),
        music_title: getVal('inv-music-title'),
        music_artist: getVal('inv-music-artist'),
        youtube_embed_id: getVal('inv-youtube'),
        custom_domain: getVal('inv-custom-domain'),
        guest_limit_per_rsvp: parseInt(getVal('inv-guest-limit')) || 5,
        rsvp_deadline: getVal('inv-rsvp-deadline') || null,
        enable_rsvp: document.getElementById('inv-enable-rsvp')?.checked ?? true,
        enable_guestbook: document.getElementById('inv-enable-guestbook')?.checked ?? true,
        enable_gift: document.getElementById('inv-enable-gift')?.checked ?? true,
        enable_music: document.getElementById('inv-enable-music')?.checked ?? true,
        enable_countdown: document.getElementById('inv-enable-countdown')?.checked ?? true,
        enable_qr_attendance: document.getElementById('inv-enable-qr')?.checked ?? false,
        status,
      };

      // Validate required
      if (!data.bride_name) { showToast('Nama pengantin wanita wajib diisi', 'error'); return; }
      if (!data.groom_name) { showToast('Nama pengantin pria wajib diisi', 'error'); return; }

      // Theme
      const themeEl = document.getElementById('inv-theme');
      if (themeEl?.value) data.theme_id = themeEl.value;

      if (status === 'published') {
        data.published_at = new Date().toISOString();
      }

      let result;
      if (invId) {
        result = await OMEGA.invitation.update(invId, data);
        showToast('Undangan berhasil diperbarui ✓', 'success');
      } else {
        result = await OMEGA.invitation.create(data);
        showToast('Undangan berhasil dibuat ✓', 'success');
      }

      document.getElementById('modal-invitation')?.classList.add('hidden');
      await loadInvitations(AdminState.invPage);
      await loadInvitationSelectors();

    } catch (err) {
      showToast(err.message || 'Gagal menyimpan undangan', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Simpan & Publish';
      }
    }
  }

  async function loadThemeSelector() {
    const select = document.getElementById('inv-theme');
    if (!select || select._loaded) return;
    try {
      const themes = await OMEGA.themes.list();
      select.innerHTML = `<option value="">Pilih Tema...</option>` +
        themes.map(t => `<option value="${t.id}">${sanitize(t.name)}${t.is_premium ? ' ⭐' : ''}</option>`).join('');
      select._loaded = true;
    } catch (e) { /* non-critical */ }
  }

  // ============================================================
  // INVITATION ACTIONS (global window functions)
  // ============================================================
  window.adminViewInvitation = function (invId) {
    const inv = AdminState.invitations.find(i => i.id === invId);
    if (inv) window.open(`/i/${inv.slug}`, '_blank');
  };

  window.adminEditInvitation = function (invId) {
    navigateTo('invitations');
    setTimeout(() => openInvitationModal(invId), 100);
  };

  window.adminCopyLink = async function (invId) {
    const inv = AdminState.invitations.find(i => i.id === invId);
    if (inv) {
      await OMEGA.utils.copyToClipboard(`${window.location.origin}/i/${inv.slug}`);
      showToast('Link berhasil disalin ✓', 'success');
    }
  };

  window.adminCloneInvitation = async function (invId) {
    if (!confirm('Clone undangan ini?')) return;
    try {
      await OMEGA.invitation.clone(invId);
      showToast('Undangan berhasil di-clone ✓', 'success');
      await loadInvitations(AdminState.invPage);
      await loadInvitationSelectors();
    } catch (err) {
      showToast(err.message || 'Gagal clone undangan', 'error');
    }
  };

  window.adminDeleteInvitation = async function (invId, name) {
    if (!confirm(`Hapus undangan "${name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await OMEGA.invitation.delete(invId);
      showToast('Undangan berhasil dihapus', 'success');
      await loadInvitations(AdminState.invPage);
      await loadInvitationSelectors();
    } catch (err) {
      showToast(err.message || 'Gagal menghapus undangan', 'error');
    }
  };

  // ============================================================
  // INVITATION SELECTORS (for guests, RSVP, attendance, etc.)
  // ============================================================
  async function loadInvitationSelectors() {
    try {
      const result = await OMEGA.invitation.list({}, 1, 100);
      const invitations = result.data || [];

      const selectors = [
        'guest-inv-select', 'rsvp-inv-select', 'att-inv-select',
        'gb-inv-select', 'analytics-inv-select',
      ];

      selectors.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const currentVal = el.value;
        el.innerHTML = '<option value="">Pilih Undangan...</option>' +
          invitations.map(inv =>
            `<option value="${inv.id}">${sanitize(inv.bride_name)} & ${sanitize(inv.groom_name)} (${statusLabel(inv.status)})</option>`
          ).join('');
        if (currentVal) el.value = currentVal;
      });

      // Bind change events
      bindSelectorEvents();
    } catch (e) {
      console.warn('Failed to load invitation selectors:', e);
    }
  }

  function bindSelectorEvents() {
    bindOnce('guest-inv-select', 'change', (e) => {
      AdminState.currentInvitationId = e.target.value;
      if (e.target.value) loadGuests(e.target.value);
    });

    bindOnce('rsvp-inv-select', 'change', (e) => {
      if (e.target.value) loadRSVP(e.target.value);
    });

    bindOnce('att-inv-select', 'change', (e) => {
      if (e.target.value) loadAttendance(e.target.value);
    });

    bindOnce('gb-inv-select', 'change', (e) => {
      if (e.target.value) loadGuestbookAdmin(e.target.value);
    });

    bindOnce('analytics-inv-select', 'change', (e) => {
      if (e.target.value) loadAnalytics(e.target.value);
    });

    bindOnce('rsvp-status-filter', 'change', () => {
      const invId = document.getElementById('rsvp-inv-select')?.value;
      if (invId) loadRSVP(invId);
    });
  }

  // ============================================================
  // GUESTS PAGE
  // ============================================================
  async function loadGuests(invitationId, page = 1) {
    AdminState.guestPage = page;
    const search = document.getElementById('guest-search')?.value?.trim() || '';
    const category = document.getElementById('guest-category-filter')?.value || '';

    try {
      const guests = await OMEGA.guests.list(invitationId, { search, category });
      renderGuestsTable(guests, invitationId);
    } catch (err) {
      console.error('Load guests error:', err);
      showToast('Gagal memuat tamu', 'error');
    }

    initGuestForm(invitationId);
    initImportForm(invitationId);
    initGuestSearch(invitationId);
  }

  function renderGuestsTable(guests, invitationId) {
    const tbody = document.getElementById('guests-body');
    if (!tbody) return;

    if (guests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Belum ada tamu. Tambahkan tamu baru!</td></tr>';
      return;
    }

    tbody.innerHTML = guests.map(g => `
      <tr>
        <td><input type="checkbox" class="guest-checkbox" data-id="${g.id}" aria-label="Pilih tamu ${sanitize(g.name)}" /></td>
        <td>
          <div style="font-weight:600">${sanitize(g.name)}</div>
          ${g.notes ? `<div style="font-size:11px;color:var(--admin-text-2)">${sanitize(g.notes)}</div>` : ''}
        </td>
        <td><span class="badge badge-${g.category}">${categoryLabel(g.category)}</span></td>
        <td>${sanitize(g.phone || '-')}</td>
        <td>${g.max_pax || 1}</td>
        <td>
          ${g.whatsapp_sent
            ? '<span class="badge badge-paid">✓ Terkirim</span>'
            : '<span class="badge badge-draft">Belum</span>'}
        </td>
        <td>
          <div class="table-actions">
            <button class="action-btn action-btn-copy" onclick="adminCopyGuestLink('${g.unique_code}', '${invitationId}')" title="Salin link personal" aria-label="Salin link personal">🔗</button>
            <button class="action-btn action-btn-view" onclick="adminViewGuestQR('${g.unique_code}', '${sanitize(g.name)}')" title="Lihat QR" aria-label="Lihat QR code">📱</button>
            <button class="action-btn action-btn-wa" onclick="adminSendWA('${g.id}', '${invitationId}')" title="Kirim WA" aria-label="Kirim WhatsApp">💬</button>
            <button class="action-btn action-btn-edit" onclick="adminEditGuest('${g.id}')" title="Edit" aria-label="Edit tamu">✏️</button>
            <button class="action-btn action-btn-delete" onclick="adminDeleteGuest('${g.id}', '${sanitize(g.name)}')" title="Hapus" aria-label="Hapus tamu">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Checkbox events
    document.querySelectorAll('.guest-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) AdminState.selectedGuests.add(cb.dataset.id);
        else AdminState.selectedGuests.delete(cb.dataset.id);
        const bulkBtn = document.getElementById('btn-bulk-delete');
        if (bulkBtn) bulkBtn.classList.toggle('hidden', AdminState.selectedGuests.size === 0);
      });
    });

    // Select all
    const selectAll = document.getElementById('guest-select-all');
    if (selectAll) {
      selectAll.addEventListener('change', () => {
        document.querySelectorAll('.guest-checkbox').forEach(cb => {
          cb.checked = selectAll.checked;
          if (selectAll.checked) AdminState.selectedGuests.add(cb.dataset.id);
          else AdminState.selectedGuests.delete(cb.dataset.id);
        });
        const bulkBtn = document.getElementById('btn-bulk-delete');
        if (bulkBtn) bulkBtn.classList.toggle('hidden', AdminState.selectedGuests.size === 0);
      });
    }
  }

  function initGuestForm(invitationId) {
    const addBtn = document.getElementById('btn-add-guest');
    if (addBtn && !addBtn._bound) {
      addBtn.addEventListener('click', () => openGuestModal(invitationId));
      addBtn._bound = true;
    }

    const bulkDeleteBtn = document.getElementById('btn-bulk-delete');
    if (bulkDeleteBtn && !bulkDeleteBtn._bound) {
      bulkDeleteBtn.addEventListener('click', async () => {
        if (!confirm(`Hapus ${AdminState.selectedGuests.size} tamu yang dipilih?`)) return;
        try {
          await OMEGA.guests.bulkDelete([...AdminState.selectedGuests]);
          AdminState.selectedGuests.clear();
          bulkDeleteBtn.classList.add('hidden');
          showToast('Tamu berhasil dihapus', 'success');
          await loadGuests(invitationId);
        } catch (err) {
          showToast('Gagal menghapus tamu', 'error');
        }
      });
      bulkDeleteBtn._bound = true;
    }

    const form = document.getElementById('guest-form');
    if (form && !form._bound) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveGuest(invitationId);
      });
      form._bound = true;
    }

    document.getElementById('modal-guest-close')?.addEventListener('click', () => {
      document.getElementById('modal-guest')?.classList.add('hidden');
    });
    document.getElementById('modal-guest-backdrop')?.addEventListener('click', () => {
      document.getElementById('modal-guest')?.classList.add('hidden');
    });
  }

  function initGuestSearch(invitationId) {
    const searchInput = document.getElementById('guest-search');
    const categoryFilter = document.getElementById('guest-category-filter');

    if (searchInput && !searchInput._bound) {
      searchInput.addEventListener('input', OMEGA.utils.debounce(() => loadGuests(invitationId), 400));
      searchInput._bound = true;
    }

    if (categoryFilter && !categoryFilter._bound) {
      categoryFilter.addEventListener('change', () => loadGuests(invitationId));
      categoryFilter._bound = true;
    }
  }

  function openGuestModal(invitationId, guestData = null) {
    const modal = document.getElementById('modal-guest');
    const form = document.getElementById('guest-form');
    if (!modal) return;

    form.reset();
    document.getElementById('guest-form-inv-id').value = invitationId;
    document.getElementById('guest-form-id').value = '';
    document.getElementById('modal-guest-title').textContent = 'Tambah Tamu';

    if (guestData) {
      document.getElementById('modal-guest-title').textContent = 'Edit Tamu';
      document.getElementById('guest-form-id').value = guestData.id;
      document.getElementById('guest-name').value = guestData.name || '';
      document.getElementById('guest-phone').value = guestData.phone || '';
      document.getElementById('guest-email').value = guestData.email || '';
      document.getElementById('guest-category').value = guestData.category || 'friends';
      document.getElementById('guest-pax').value = guestData.max_pax || 1;
      document.getElementById('guest-notes').value = guestData.notes || '';
    }

    modal.classList.remove('hidden');
  }

  async function saveGuest(invitationId) {
    const guestId = document.getElementById('guest-form-id')?.value;
    const btn = document.getElementById('guest-form')?.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;

    try {
      const data = {
        name: getVal('guest-name'),
        phone: getVal('guest-phone'),
        email: getVal('guest-email'),
        category: getVal('guest-category') || 'friends',
        max_pax: parseInt(getVal('guest-pax')) || 1,
        notes: getVal('guest-notes'),
      };

      if (!data.name) { showToast('Nama tamu wajib diisi', 'error'); return; }

      if (guestId) {
        await OMEGA.guests.update(guestId, data);
        showToast('Data tamu berhasil diperbarui ✓', 'success');
      } else {
        await OMEGA.guests.add(invitationId, data);
        showToast('Tamu berhasil ditambahkan ✓', 'success');
      }

      document.getElementById('modal-guest')?.classList.add('hidden');
      await loadGuests(invitationId);
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan tamu', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  window.adminEditGuest = async function (guestId) {
    const sb = OMEGA.getSupabase();
    const { data } = await sb.from('guests').select('*').eq('id', guestId).single();
    if (data) openGuestModal(data.invitation_id, data);
  };

  window.adminDeleteGuest = async function (guestId, name) {
    if (!confirm(`Hapus tamu "${name}"?`)) return;
    try {
      await OMEGA.guests.delete(guestId);
      showToast('Tamu berhasil dihapus', 'success');
      const invId = document.getElementById('guest-inv-select')?.value;
      if (invId) await loadGuests(invId);
    } catch (err) {
      showToast('Gagal menghapus tamu', 'error');
    }
  };

  window.adminCopyGuestLink = async function (code, invitationId) {
    const sb = OMEGA.getSupabase();
    const { data: inv } = await sb.from('invitations').select('slug').eq('id', invitationId).single();
    const { data: guest } = await sb.from('guests').select('name').eq('unique_code', code).single();
    if (inv && guest) {
      const url = OMEGA.guests.getPersonalizedUrl(inv.slug, guest.name);
      await OMEGA.utils.copyToClipboard(url);
      showToast('Link personal berhasil disalin ✓', 'success');
    }
  };

  window.adminViewGuestQR = function (code, name) {
    const qrUrl = OMEGA.utils.generateQRSVG(OMEGA.attendance.scanQR ? `${window.location.origin}/scan?code=${code}` : code, 240);
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>QR - ${name}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px;background:#fff;}
      h2{font-size:20px;margin-bottom:8px;}p{color:#666;font-size:14px;margin-bottom:24px;}
      .code{font-family:monospace;font-size:18px;letter-spacing:4px;background:#f5f5f5;padding:8px 16px;border-radius:8px;}</style>
      </head><body>
      <h2>${name}</h2><p>Kode: <span class="code">${code}</span></p>
      <img src="${qrUrl}" width="240" height="240" alt="QR Code" />
      <p><button onclick="window.print()">🖨️ Print</button></p>
      </body></html>
    `);
  };

  window.adminSendWA = async function (guestId, invitationId) {
    showToast('Fitur pengiriman WA memerlukan konfigurasi API WhatsApp di Pengaturan', 'info');
  };

  // ============================================================
  // IMPORT CSV
  // ============================================================
  function initImportForm(invitationId) {
    const importBtn = document.getElementById('btn-import-guests');
    if (importBtn && !importBtn._bound) {
      importBtn.addEventListener('click', () => {
        document.getElementById('modal-import')?.classList.remove('hidden');
      });
      importBtn._bound = true;
    }

    document.getElementById('modal-import-close')?.addEventListener('click', () => {
      document.getElementById('modal-import')?.classList.add('hidden');
    });
    document.getElementById('modal-import-backdrop')?.addEventListener('click', () => {
      document.getElementById('modal-import')?.classList.add('hidden');
    });

    // Template download
    const templateBtn = document.getElementById('btn-download-template');
    if (templateBtn && !templateBtn._bound) {
      templateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const csv = 'name,phone,email,category,pax,notes\nBudi Santoso,081234567890,budi@email.com,friends,2,\nSari Dewi,081298765432,,family,1,VIP';
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'template-tamu.csv';
        a.click(); URL.revokeObjectURL(url);
      });
      templateBtn._bound = true;
    }

    // CSV file change
    const csvFile = document.getElementById('csv-file');
    if (csvFile && !csvFile._bound) {
      csvFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        previewCSV(text);
      });
      csvFile._bound = true;
    }

    // Confirm import
    const confirmBtn = document.getElementById('btn-confirm-import');
    if (confirmBtn && !confirmBtn._bound) {
      confirmBtn.addEventListener('click', async () => {
        if (AdminState.importData.length === 0) return;
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Mengimpor...';
        try {
          const result = await OMEGA.guests.bulkAdd(invitationId, AdminState.importData);
          showToast(`${result.length} tamu berhasil diimpor ✓`, 'success');
          document.getElementById('modal-import')?.classList.add('hidden');
          AdminState.importData = [];
          await loadGuests(invitationId);
        } catch (err) {
          showToast(err.message || 'Gagal mengimpor tamu', 'error');
        } finally {
          confirmBtn.disabled = false;
          confirmBtn.textContent = `Import ${AdminState.importData.length} Tamu`;
        }
      });
      confirmBtn._bound = true;
    }
  }

  function previewCSV(text) {
    try {
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const guests = [];
      const previewBody = document.getElementById('preview-body');
      if (previewBody) previewBody.innerHTML = '';

      for (let i = 1; i < Math.min(lines.length, 201); i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const guest = {};
        headers.forEach((h, idx) => { guest[h] = values[idx] || ''; });
        if (!guest.name) continue;

        const guestData = {
          name: guest.name,
          phone: guest.phone || guest.whatsapp || '',
          email: guest.email || '',
          category: guest.category || 'friends',
          max_pax: parseInt(guest.pax || guest.max_pax || 1),
          notes: guest.notes || '',
        };
        guests.push(guestData);

        if (previewBody && i <= 10) {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${sanitize(guestData.name)}</td>
            <td>${sanitize(guestData.phone)}</td>
            <td>${sanitize(guestData.category)}</td>
            <td>${guestData.max_pax}</td>
          `;
          previewBody.appendChild(tr);
        }
      }

      AdminState.importData = guests;
      setText('import-count', guests.length);
      setText('import-btn-count', guests.length);

      document.getElementById('import-preview')?.classList.remove('hidden');
      const confirmBtn = document.getElementById('btn-confirm-import');
      if (confirmBtn) confirmBtn.classList.remove('hidden');

    } catch (err) {
      showToast('Format CSV tidak valid', 'error');
    }
  }

  // ============================================================
  // RSVP PAGE
  // ============================================================
  async function loadRSVP(invitationId) {
    const status = document.getElementById('rsvp-status-filter')?.value || '';
    try {
      const [rsvpList, summary] = await Promise.all([
        OMEGA.rsvp.list(invitationId, status || null),
        OMEGA.rsvp.getSummary(invitationId),
      ]);

      // Stats
      setText('rsvp-stat-attending', summary.attending || 0);
      setText('rsvp-stat-not', summary.not_attending || 0);
      setText('rsvp-stat-pending', summary.pending || 0);
      setText('rsvp-stat-pax', summary.total_pax || 0);

      // Table
      renderRSVPTable(rsvpList);
    } catch (err) {
      showToast('Gagal memuat RSVP', 'error');
    }
  }

  function renderRSVPTable(rsvpList) {
    const tbody = document.getElementById('rsvp-body');
    if (!tbody) return;

    if (rsvpList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Belum ada RSVP</td></tr>';
      return;
    }

    tbody.innerHTML = rsvpList.map(r => `
      <tr>
        <td><div style="font-weight:600">${sanitize(r.name)}</div></td>
        <td><span class="badge badge-${r.status}">${rsvpStatusLabel(r.status)}</span></td>
        <td>${r.pax_count || 1}</td>
        <td>${sanitize(r.phone || '-')}</td>
        <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sanitize(r.message || '-')}</td>
        <td style="white-space:nowrap">${formatTimeAgo(r.submitted_at)}</td>
      </tr>
    `).join('');
  }

  // ============================================================
  // ATTENDANCE PAGE
  // ============================================================
  function loadAttendance(invitationId) {
    initQRScanner(invitationId);
    refreshAttendanceDashboard(invitationId);

    // Realtime subscription
    const ch = OMEGA.attendance.subscribeRealtime(invitationId, () => {
      refreshAttendanceDashboard(invitationId);
    });
    AdminState.realtimeChannels.push(ch);
  }

  function initQRScanner(invitationId) {
    const manualBtn = document.getElementById('btn-manual-scan');
    const manualInput = document.getElementById('manual-code');

    if (manualBtn && !manualBtn._bound) {
      manualBtn.addEventListener('click', () => doScan(manualInput?.value?.trim(), invitationId));
      manualBtn._bound = true;
    }

    if (manualInput && !manualInput._bound) {
      manualInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doScan(manualInput.value.trim(), invitationId);
        if (manualInput.value.length === 8) doScan(manualInput.value.trim(), invitationId);
      });
      manualInput._bound = true;
    }
  }

  async function doScan(code, invitationId) {
    if (!code) { showToast('Masukkan kode tamu', 'error'); return; }
    const resultEl = document.getElementById('scan-result');
    const iconEl = document.getElementById('scan-result-icon');
    const nameEl = document.getElementById('scan-result-name');
    const statusEl = document.getElementById('scan-result-status');
    const paxEl = document.getElementById('scan-result-pax');

    try {
      const result = await OMEGA.attendance.scanQR(code);
      resultEl?.classList.remove('hidden', 'error', 'warning');

      if (result.status === 'already_scanned') {
        resultEl?.classList.add('warning');
        if (iconEl) iconEl.textContent = '⚠️';
        if (nameEl) nameEl.textContent = result.guest.name;
        if (statusEl) statusEl.textContent = 'Sudah Scan Sebelumnya';
        if (paxEl) paxEl.textContent = `Pax: ${result.guest.max_pax || 1}`;
        showToast(`${result.guest.name} sudah scan sebelumnya`, 'warning');
      } else {
        resultEl?.classList.add('success');
        if (iconEl) iconEl.textContent = '✅';
        if (nameEl) nameEl.textContent = result.guest.name;
        if (statusEl) statusEl.textContent = 'Berhasil Check-in!';
        if (paxEl) paxEl.textContent = `Pax: ${result.guest.max_pax || 1}`;
        showToast(`✅ ${result.guest.name} berhasil check-in!`, 'success');
        addAttendanceLogItem(result.guest);
      }

      const input = document.getElementById('manual-code');
      if (input) { input.value = ''; input.focus(); }

      await refreshAttendanceDashboard(invitationId);

    } catch (err) {
      resultEl?.classList.remove('hidden', 'success', 'warning');
      resultEl?.classList.add('error');
      if (iconEl) iconEl.textContent = '❌';
      if (nameEl) nameEl.textContent = 'Tidak Ditemukan';
      if (statusEl) statusEl.textContent = err.message || 'Kode tidak valid';
      if (paxEl) paxEl.textContent = '';
      showToast(err.message || 'Kode tidak valid', 'error');
    }
  }

  async function refreshAttendanceDashboard(invitationId) {
    try {
      const dashboard = await OMEGA.attendance.getDashboard(invitationId);
      setText('att-stat-arrived', dashboard.arrived || 0);
      setText('att-stat-pax', dashboard.total_pax || 0);
    } catch (e) { /* non-critical */ }
  }

  function addAttendanceLogItem(guest) {
    const log = document.getElementById('attendance-log');
    if (!log) return;
    const item = document.createElement('div');
    item.className = 'attendance-log-item';
    item.innerHTML = `
      <div class="log-icon">✅</div>
      <div class="log-name">${sanitize(guest.name)}</div>
      <div class="log-pax">${guest.max_pax || 1} pax</div>
      <div class="log-time">${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
    `;
    log.insertBefore(item, log.firstChild);
  }

  // ============================================================
  // GUESTBOOK ADMIN
  // ============================================================
  async function loadGuestbookAdmin(invitationId) {
    try {
      const sb = OMEGA.getSupabase();
      const { data, error } = await sb
        .from('guestbook')
        .select('*')
        .eq('invitation_id', invitationId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      renderGuestbookAdminTable(data, invitationId);
    } catch (err) {
      showToast('Gagal memuat buku tamu', 'error');
    }
  }

  function renderGuestbookAdminTable(messages, invitationId) {
    const tbody = document.getElementById('gb-admin-body');
    if (!tbody) return;

    if (messages.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Belum ada ucapan</td></tr>';
      return;
    }

    tbody.innerHTML = messages.map(m => `
      <tr>
        <td><div style="font-weight:600">${sanitize(m.name)}</div></td>
        <td style="max-width:280px">
          <div style="font-size:13px;line-height:1.5">${sanitize(m.message)}</div>
        </td>
        <td>
          ${m.is_hidden ? '<span class="badge badge-expired">Disembunyikan</span>' :
            m.is_approved ? '<span class="badge badge-attending">Terlihat</span>' :
            '<span class="badge badge-pending">Pending</span>'}
          ${m.is_pinned ? '<span class="badge badge-vip">📌 Pin</span>' : ''}
        </td>
        <td style="white-space:nowrap">${formatTimeAgo(m.created_at)}</td>
        <td>
          <div class="table-actions">
            ${!m.is_pinned
              ? `<button class="action-btn" onclick="adminModerateGB('${m.id}','pin','${invitationId}')" title="Pin" style="background:rgba(201,168,76,0.1);color:#C9A84C">📌</button>`
              : `<button class="action-btn" onclick="adminModerateGB('${m.id}','unpin','${invitationId}')" title="Unpin" style="background:rgba(255,255,255,0.06);color:var(--admin-text-2)">📌</button>`
            }
            ${m.is_hidden
              ? `<button class="action-btn action-btn-view" onclick="adminModerateGB('${m.id}','approve','${invitationId}')" title="Tampilkan">👁️</button>`
              : `<button class="action-btn action-btn-delete" onclick="adminModerateGB('${m.id}','hide','${invitationId}')" title="Sembunyikan">🚫</button>`
            }
          </div>
        </td>
      </tr>
    `).join('');
  }

  window.adminModerateGB = async function (messageId, action, invitationId) {
    try {
      await OMEGA.guestbook.moderate(messageId, action);
      const labels = { pin: 'Pesan dipasang', unpin: 'Pin dilepas', approve: 'Pesan ditampilkan', hide: 'Pesan disembunyikan' };
      showToast(labels[action] || 'Berhasil', 'success');
      await loadGuestbookAdmin(invitationId);
    } catch (err) {
      showToast('Gagal moderasi pesan', 'error');
    }
  };

  // ============================================================
  // THEMES PAGE
  // ============================================================
  async function loadThemes() {
    const grid = document.getElementById('themes-grid');
    if (!grid) return;
    grid.innerHTML = '<div style="padding:40px;text-align:center;color:var(--admin-text-2)">Memuat tema...</div>';

    try {
      const themes = await OMEGA.themes.list();
      grid.innerHTML = themes.map(t => `
        <div class="theme-card" role="listitem" tabindex="0" aria-label="Tema ${sanitize(t.name)}">
          <div class="theme-preview" style="background:${t.css_variables?.['--theme-bg'] || '#1a1a1a'}">
            ${t.is_premium ? '<div class="theme-premium-badge">Premium</div>' : ''}
            <div class="theme-preview-content">
              <div class="theme-preview-couple" style="color:${t.css_variables?.['--theme-primary'] || '#C9A84C'}">
                Bride <span class="theme-preview-amp">&</span> Groom
              </div>
            </div>
          </div>
          <div class="theme-info">
            <div class="theme-name">${sanitize(t.name)}</div>
            <div class="theme-category">${sanitize(t.category || '')}</div>
            <div style="font-size:11px;color:var(--admin-text-2);margin-top:4px">
              ${(t.tags || []).slice(0, 3).map(tag => `<span style="background:rgba(255,255,255,0.06);padding:1px 6px;border-radius:4px;margin-right:3px">${sanitize(tag)}</span>`).join('')}
            </div>
          </div>
        </div>
      `).join('');
    } catch (err) {
      grid.innerHTML = '<div style="padding:40px;text-align:center;color:var(--admin-danger)">Gagal memuat tema</div>';
    }
  }

  // ============================================================
  // ANALYTICS
  // ============================================================
  function initAnalyticsPage() {
    // Already bound via selector change event
  }

  async function loadAnalytics(invitationId) {
    const period = parseInt(document.getElementById('analytics-period')?.value || 30);

    try {
      const [data, stats] = await Promise.all([
        OMEGA.analytics.getReport(invitationId, period),
        OMEGA.invitation.getStats(invitationId),
      ]);

      // Summary stats
      const analyticsStats = document.getElementById('analytics-stats');
      if (analyticsStats && stats) {
        analyticsStats.innerHTML = `
          <div class="analytics-stat-item">
            <div class="analytics-stat-number">${(stats.total_guests || 0).toLocaleString('id-ID')}</div>
            <div class="analytics-stat-label">Total Tamu</div>
          </div>
          <div class="analytics-stat-item">
            <div class="analytics-stat-number">${(stats.rsvp_attending || 0).toLocaleString('id-ID')}</div>
            <div class="analytics-stat-label">RSVP Hadir</div>
          </div>
          <div class="analytics-stat-item">
            <div class="analytics-stat-number">${(stats.attendance_arrived || 0).toLocaleString('id-ID')}</div>
            <div class="analytics-stat-label">Check-in</div>
          </div>
          <div class="analytics-stat-item">
            <div class="analytics-stat-number">${(stats.view_count || 0).toLocaleString('id-ID')}</div>
            <div class="analytics-stat-label">Views</div>
          </div>
          <div class="analytics-stat-item">
            <div class="analytics-stat-number">${(stats.guestbook_count || 0).toLocaleString('id-ID')}</div>
            <div class="analytics-stat-label">Ucapan</div>
          </div>
        `;
      }

      // Device chart
      const deviceCounts = {};
      data.forEach(d => { deviceCounts[d.device_type || 'unknown'] = (deviceCounts[d.device_type || 'unknown'] || 0) + 1; });
      renderBarChart('device-chart', deviceCounts);

      // Browser chart
      const browserCounts = {};
      data.forEach(d => { browserCounts[d.browser || 'unknown'] = (browserCounts[d.browser || 'unknown'] || 0) + 1; });
      renderBarChart('browser-chart', browserCounts);

    } catch (err) {
      showToast('Gagal memuat analitik', 'error');
    }
  }

  function renderBarChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);

    container.innerHTML = sorted.map(([label, count]) => `
      <div class="chart-bar-row">
        <div class="chart-bar-label">${sanitize(label)}</div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" style="width:${total ? (count / total * 100).toFixed(1) : 0}%"></div>
        </div>
        <div class="chart-bar-value">${count}</div>
      </div>
    `).join('');
  }

  // ============================================================
  // PAYMENTS
  // ============================================================
  async function loadPayments() {
    const sb = OMEGA.getSupabase();
    try {
      const { data, error } = await sb
        .from('payments')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      renderPaymentsTable(data || []);
    } catch (err) {
      showToast('Gagal memuat pembayaran', 'error');
    }
  }

  function renderPaymentsTable(payments) {
    const tbody = document.getElementById('payments-body');
    if (!tbody) return;

    if (payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Belum ada pembayaran</td></tr>';
      return;
    }

    tbody.innerHTML = payments.map(p => `
      <tr>
        <td>${sanitize(p.profiles?.full_name || p.profiles?.email || '-')}</td>
        <td>${sanitize(p.package_name)}</td>
        <td style="font-weight:600">${OMEGA.utils.formatCurrency(p.amount)}</td>
        <td><span class="badge badge-${p.status}">${p.status}</span></td>
        <td>${sanitize(p.payment_method || '-')}</td>
        <td>${formatDate(p.created_at)}</td>
      </tr>
    `).join('');
  }

  // ============================================================
  // SETTINGS
  // ============================================================
  async function loadSettings() {
    // Load platform settings
    try {
      const sb = OMEGA.getSupabase();
      const { data } = await sb.from('settings').select('key, value');
      const settings = {};
      (data || []).forEach(s => { settings[s.key] = s.value; });

      const fields = {
        'setting-platform-name': settings.platform_name,
        'setting-branding': settings.default_branding,
        'setting-branding-url': settings.branding_url,
        'setting-support-wa': settings.support_whatsapp,
        'setting-commission': settings.reseller_commission_rate,
      };

      Object.entries(fields).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el && val !== undefined) {
          el.value = typeof val === 'string' ? val.replace(/^"|"$/g, '') : val;
        }
      });
    } catch (e) { /* non-critical */ }

    // Load profile settings
    try {
      const profile = await OMEGA.auth.getProfile();
      if (profile) {
        setVal('profile-name', profile.full_name);
        setVal('profile-phone', profile.phone);
        setVal('profile-company', profile.company_name);
      }
    } catch (e) { /* non-critical */ }

    // Init settings form
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm && !settingsForm._bound) {
      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSettings();
      });
      settingsForm._bound = true;
    }

    const profileForm = document.getElementById('profile-form');
    if (profileForm && !profileForm._bound) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveProfile();
      });
      profileForm._bound = true;
    }
  }

  async function saveSettings() {
    const btn = document.getElementById('settings-form')?.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const sb = OMEGA.getSupabase();
      const updates = [
        { key: 'platform_name', value: JSON.stringify(getVal('setting-platform-name')) },
        { key: 'default_branding', value: JSON.stringify(getVal('setting-branding')) },
        { key: 'branding_url', value: JSON.stringify(getVal('setting-branding-url')) },
        { key: 'support_whatsapp', value: JSON.stringify(getVal('setting-support-wa')) },
        { key: 'reseller_commission_rate', value: getVal('setting-commission') },
      ];

      for (const update of updates) {
        await sb.from('settings').update({ value: update.value, updated_at: new Date().toISOString() }).eq('key', update.key);
      }

      showToast('Pengaturan berhasil disimpan ✓', 'success');
    } catch (err) {
      showToast('Gagal menyimpan pengaturan', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function saveProfile() {
    const btn = document.getElementById('profile-form')?.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const sb = OMEGA.getSupabase();
      const user = await OMEGA.auth.getUser();
      const password = getVal('profile-password');

      await sb.from('profiles').update({
        full_name: getVal('profile-name'),
        phone: getVal('profile-phone'),
        company_name: getVal('profile-company'),
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);

      if (password && password.length >= 6) {
        await sb.auth.updateUser({ password });
      }

      showToast('Profil berhasil disimpan ✓', 'success');
      renderUserInfo({ ...AdminState.profile, full_name: getVal('profile-name') });
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan profil', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ============================================================
  // PAGINATION
  // ============================================================
  function renderPagination(containerId, currentPage, totalPages, onNavigate) {
    const container = document.getElementById(containerId);
    if (!container || totalPages <= 1) { if (container) container.innerHTML = ''; return; }

    const pages = [];
    pages.push({ label: '←', page: currentPage - 1, disabled: currentPage <= 1 });

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
        pages.push({ label: String(i), page: i, active: i === currentPage });
      } else if (pages[pages.length - 1]?.label !== '...') {
        pages.push({ label: '...', page: null, disabled: true });
      }
    }

    pages.push({ label: '→', page: currentPage + 1, disabled: currentPage >= totalPages });

    container.innerHTML = pages.map(p => `
      <button
        class="pagination-btn${p.active ? ' active' : ''}"
        ${p.disabled || !p.page ? 'disabled' : ''}
        ${p.page ? `data-page="${p.page}"` : ''}
        aria-label="Halaman ${p.label}"
        ${p.active ? 'aria-current="page"' : ''}
      >${p.label}</button>
    `).join('');

    container.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => onNavigate(parseInt(btn.dataset.page)));
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text ?? '';
  }

  function getVal(id) {
    return document.getElementById(id)?.value?.trim() || '';
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el && value != null) el.value = value;
  }

  function sanitize(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function bindOnce(id, event, handler) {
    const el = document.getElementById(id);
    if (el && !el[`_${event}_bound`]) {
      el.addEventListener(event, handler);
      el[`_${event}_bound`] = true;
    }
  }

  function statusLabel(status) {
    const labels = { published: 'Published', draft: 'Draft', unpublished: 'Nonaktif', expired: 'Expired', archived: 'Arsip' };
    return labels[status] || status;
  }

  function rsvpStatusLabel(status) {
    const labels = { attending: 'Hadir', not_attending: 'Tidak Hadir', pending: 'Pending', maybe: 'Mungkin' };
    return labels[status] || status;
  }

  function categoryLabel(cat) {
    const labels = { vip: 'VIP', family: 'Keluarga', friends: 'Teman', office: 'Kantor', custom: 'Custom' };
    return labels[cat] || cat;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatTimeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins}m lalu`;
    if (hours < 24) return `${hours}j lalu`;
    if (days < 7) return `${days}h lalu`;
    return formatDate(dateStr);
  }

  function showToast(message, type = 'success') {
    OMEGA.utils.showToast(message, type);
  }

  // ============================================================
  // OPENINVITATIONMODAL exposed globally
  // ============================================================
  window.openInvitationModal = openInvitationModal;

  // ============================================================
  // CLEANUP
  // ============================================================
  window.addEventListener('beforeunload', () => {
    AdminState.realtimeChannels.forEach(ch => {
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
