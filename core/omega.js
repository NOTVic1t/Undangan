/**
 * OMEGA INVITATION PLATFORM
 * Core Utilities: Auth, Storage, Helpers
 */

window.OMEGA = window.OMEGA || {};

// ============================================================
// AUTH MODULE
// ============================================================

OMEGA.auth = {
  async signIn(email, password) {
    const sb = OMEGA.getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signUp(email, password, fullName) {
    const sb = OMEGA.getSupabase();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const sb = OMEGA.getSupabase();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const sb = OMEGA.getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    return session;
  },

  async getUser() {
    const sb = OMEGA.getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    return user;
  },

  async getProfile() {
    const user = await this.getUser();
    if (!user) return null;
    const sb = OMEGA.getSupabase();
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  },

  async requireAuth(redirectUrl = '/admin/login.html') {
    const session = await this.getSession();
    if (!session) {
      window.location.href = redirectUrl;
      return null;
    }
    return session;
  },

  async requireRole(allowedRoles, redirectUrl = '/admin/login.html') {
    const profile = await this.getProfile();
    if (!profile || !allowedRoles.includes(profile.role)) {
      window.location.href = redirectUrl;
      return null;
    }
    return profile;
  },

  onAuthChange(callback) {
    const sb = OMEGA.getSupabase();
    return sb.auth.onAuthStateChange(callback);
  },
};

// ============================================================
// STORAGE MODULE
// ============================================================

OMEGA.storage = {
  async upload(bucket, path, file, options = {}) {
    const sb = OMEGA.getSupabase();
    const { data, error } = await sb.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        ...options,
      });
    if (error) throw error;
    return data;
  },

  async uploadWithProgress(bucket, path, file, onProgress) {
    // Supabase doesn't natively support progress, simulate via XHR
    return new Promise((resolve, reject) => {
      const sb = OMEGA.getSupabase();
      const xhr = new XMLHttpRequest();
      const url = `${OMEGA.config.supabaseUrl}/storage/v1/object/${bucket}/${path}`;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const publicUrl = sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
          resolve({ path, publicUrl });
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      xhr.open('POST', url);

      const session = sb.auth.getSession();
      session.then(({ data: { session } }) => {
        if (session) xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.setRequestHeader('x-upsert', 'false');
        const formData = new FormData();
        formData.append('', file);
        xhr.send(formData);
      });
    });
  },

  getPublicUrl(bucket, path) {
    const sb = OMEGA.getSupabase();
    return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  },

  async delete(bucket, paths) {
    const sb = OMEGA.getSupabase();
    const { error } = await sb.storage.from(bucket).remove(Array.isArray(paths) ? paths : [paths]);
    if (error) throw error;
  },

  async list(bucket, folder = '', options = {}) {
    const sb = OMEGA.getSupabase();
    const { data, error } = await sb.storage.from(bucket).list(folder, options);
    if (error) throw error;
    return data;
  },

  generatePath(ownerId, type, filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${ownerId}/${type}/${timestamp}_${random}.${ext}`;
  },

  validateFile(file, allowedTypes, maxSizeMB = 10) {
    if (!allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} not allowed. Allowed: ${allowedTypes.join(', ')}`);
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
    }
    return true;
  },
};

// ============================================================
// INVITATION MODULE
// ============================================================

OMEGA.invitation = {
  async getBySlug(slug) {
    const sb = OMEGA.getSupabase();
    const { data, error } = await sb
      .from('invitations')
      .select(`
        *,
        themes (slug, name, config, css_variables, features),
        gallery (id, url, thumbnail_url, caption, media_type, sort_order),
        stories (id, title, content, date, image_url, icon, sort_order)
      `)
      .eq('slug', slug)
      .eq('status', 'published')
      .single();
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const sb = OMEGA.getSupabase();
    const { data, error } = await sb
      .from('invitations')
      .select(`
        *,
        themes (slug, name, config, css_variables, features),
        gallery (id, url, thumbnail_url, caption, media_type, sort_order),
        stories (id, title, content, date, image_url, icon, sort_order)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async list(filters = {}, page = 1, perPage = 20) {
    const sb = OMEGA.getSupabase();
    const user = await OMEGA.auth.getUser();
    const profile = await OMEGA.auth.getProfile();

    let query = sb.from('invitations').select('*, themes(name, slug)', { count: 'exact' });

    if (profile.role === 'customer') {
      query = query.eq('owner_id', user.id);
    } else if (profile.role === 'vendor') {
      query = query.or(`owner_id.eq.${user.id},vendor_id.eq.${user.id}`);
    } else if (profile.role === 'reseller') {
      query = query.or(`owner_id.eq.${user.id},reseller_id.eq.${user.id}`);
    }

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.search) query = query.ilike('bride_name', `%${filters.search}%`).or(`groom_name.ilike.%${filters.search}%`);

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to).order('created_at', { ascending: false });

    const { data, error, count } = await query;
    if (error) throw error;
    return { data, count, page, perPage, totalPages: Math.ceil(count / perPage) };
  },

  async create(invitationData) {
    const sb = OMEGA.getSupabase();
    const user = await OMEGA.auth.getUser();

    const slug = await this.generateSlug(`${invitationData.bride_name}-${invitationData.groom_name}`);

    const { data, error } = await sb
      .from('invitations')
      .insert({ ...invitationData, owner_id: user.id, slug, status: 'draft' })
      .select()
      .single();
    if (error) throw error;

    await OMEGA.activity.log('create_invitation', 'invitations', data.id);
    return data;
  },

  async update(id, updates) {
    const sb = OMEGA.getSupabase();
    const { data, error } = await sb
      .from('invitations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await OMEGA.activity.log('update_invitation', 'invitations', id);
    return data;
  },

  async publish(id) {
    return this.update(id, { status: 'published', published_at: new Date().toISOString() });
  },

  async unpublish(id) {
    return this.update(id, { status: 'unpublished' });
  },

  async clone(id) {
    const original = await this.getById(id);
    const { id: _id, slug, created_at, updated_at, published_at, view_count, unique_visitor_count, ...cloneData } = original;
    const newSlug = await this.generateSlug(`${original.bride_name}-${original.groom_name}-copy`);
    return this.create({ ...cloneData, slug: newSlug, status: 'draft' });
  },

  async delete(id) {
    const sb = OMEGA.getSupabase();
    const { error } = await sb.from('invitations').delete().eq('id', id);
    if (error) throw error;
    await OMEGA.activity.log('delete_invitation', 'invitations', id);
  },

  async generateSlug(base) {
    const sb = OMEGA.getSupabase();
    let slug = base
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    let suffix = '';
    let attempts = 0;
    while (attempts < 10) {
      const testSlug = slug + suffix;
      const { data } = await sb.from('invitations').select('id').eq('slug', testSlug).maybeSingle();
      if (!data) return testSlug;
      suffix = `-${Math.random().toString(36).substring(2, 6)}`;
      attempts++;
    }
    return slug + '-' + Date.now();
  },

  async getStats(invitationId) {
    const sb = OMEGA.getSupabase();
    const { data, error } = await sb.rpc('get_invitation_stats', { inv_id: invitationId });
    if (error) throw error;
    return data;
  },
};

// ============================================================
// GUEST MODULE
// ============================================================

OMEGA.guests = {
  async list(invitationId, options = {}) {
    const sb = OMEGA.getSupabase();
    let query = sb
      .from('guests')
      .select('*, guest_groups(name, category, color)')
      .eq('invitation_id', invitationId)
      .eq('is_active', true);

    if (options.groupId) query = query.eq('group_id', options.groupId);
    if (options.search) query = query.ilike('name', `%${options.search}%`);
    if (options.category) query = query.eq('category', options.category);

    query = query.order('name');

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async add(invitationId, guestData) {
    const sb = OMEGA.getSupabase();
    const { data, error } = await sb
      .from('guests')
      .insert({ ...guestData, invitation_id: invitationId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async bulkAdd(invitationId, guestsArray) {
    const sb = OMEGA.getSupabase();
    const guests = guestsArray.map(g => ({ ...g, invitation_id: invitationId }));
    const { data, error } = await sb.from('guests').insert(guests).select();
    if (error) throw error;
    return data;
  },

  async update(guestId, updates) {
    const sb = OMEGA.getSupabase();
    const { data, error } = await sb.from('guests').update(updates).eq('id', guestId).select().single();
    if (error) throw error;
    return data;
  },

  async delete(guestId) {
    const sb = OMEGA.getSupabase();
    const { error } = await sb.from('guests').update({ is_active: false }).eq('id', guestId);
    if (error) throw error;
  },

  async bulkDelete(guestIds) {
    const sb = OMEGA.getSupabase();
    const { error } = await sb.from('guests').update({ is_active: false }).in('id', guestIds);
    if (error) throw error;
  },

  async importFromCSV(invitationId, csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const guests = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const guest = {};
      headers.forEach((h, idx) => { guest[h] = values[idx] || ''; });

      if (guest.name) {
        guests.push({
          name: guest.name,
          phone: guest.phone || guest.whatsapp || '',
          email: guest.email || '',
          category: guest.category || 'friends',
          max_pax: parseInt(guest.pax || guest.max_pax || 1),
          notes: guest.notes || '',
        });
      }
    }

    return this.bulkAdd(invitationId, guests);
  },

  getPersonalizedUrl(invitationSlug, guestName) {
    const encoded = encodeURIComponent(guestName);
    return `${window.location.origin}/i/${invitationSlug}?to=${encoded}`;
  },

  generateQRData(guestCode) {
    return `${window.location.origin}/scan?code=${guestCode}`;
  },
};

// ============================================================
// RSVP MODULE
// ============================================================

OMEGA.rsvp = {
  async submit(invitationId, rsvpData, guestId = null) {
    const sb = OMEGA.getSupabase();

    // Rate limiting check (client-side, server-side enforced via RLS + function)
    const rateLimitKey = `rsvp_${invitationId}`;
    const lastSubmit = localStorage.getItem(rateLimitKey);
    if (lastSubmit && Date.now() - parseInt(lastSubmit) < 60000) {
      throw new Error('Mohon tunggu sebentar sebelum mengirim ulang RSVP.');
    }

    const payload = {
      invitation_id: invitationId,
      guest_id: guestId,
      name: rsvpData.name,
      phone: rsvpData.phone || null,
      email: rsvpData.email || null,
      status: rsvpData.status,
      pax_count: parseInt(rsvpData.pax_count) || 1,
      message: rsvpData.message || null,
      will_attend_reception: rsvpData.will_attend_reception !== false,
      dietary_notes: rsvpData.dietary_notes || null,
    };

    const { data, error } = await sb.from('rsvp').insert(payload).select().single();
    if (error) throw error;

    localStorage.setItem(rateLimitKey, Date.now().toString());
    return data;
  },

  async list(invitationId, status = null) {
    const sb = OMEGA.getSupabase();
    let query = sb.from('rsvp').select('*, guests(name, phone, category)').eq('invitation_id', invitationId).order('submitted_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getSummary(invitationId) {
    const sb = OMEGA.getSupabase();
    const { data, error } = await sb
      .from('rsvp')
      .select('status, pax_count')
      .eq('invitation_id', invitationId);
    if (error) throw error;

    const summary = { attending: 0, not_attending: 0, pending: 0, total_pax: 0 };
    data.forEach(r => {
      summary[r.status] = (summary[r.status] || 0) + 1;
      if (r.status === 'attending') summary.total_pax += r.pax_count;
    });
    summary.total = data.length;
    return summary;
  },

  subscribeRealtime(invitationId, callback) {
    const sb = OMEGA.getSupabase();
    return sb
      .channel(`rsvp:${invitationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rsvp', filter: `invitation_id=eq.${invitationId}` }, callback)
      .subscribe();
  },
};

// ============================================================
// GUESTBOOK MODULE
// ============================================================

OMEGA.guestbook = {
  async post(invitationId, name, message, guestId = null) {
    const sb = OMEGA.getSupabase();

    const rateLimitKey = `guestbook_${invitationId}`;
    const lastPost = localStorage.getItem(rateLimitKey);
    if (lastPost && Date.now() - parseInt(lastPost) < 30000) {
      throw new Error('Mohon tunggu sebentar sebelum mengirim pesan lagi.');
    }

    if (!name || name.trim().length < 2) throw new Error('Nama minimal 2 karakter.');
    if (!message || message.trim().length < 3) throw new Error('Pesan terlalu pendek.');
    if (message.length > 500) throw new Error('Pesan maksimal 500 karakter.');

    const { data, error } = await sb
      .from('guestbook')
      .insert({ invitation_id: invitationId, guest_id: guestId, name: name.trim(), message: message.trim() })
      .select()
      .single();
    if (error) throw error;

    localStorage.setItem(rateLimitKey, Date.now().toString());
    return data;
  },

  async list(invitationId, page = 1, perPage = 20) {
    const sb = OMEGA.getSupabase();
    const from = (page - 1) * perPage;
    const { data, error, count } = await sb
      .from('guestbook')
      .select('*', { count: 'exact' })
      .eq('invitation_id', invitationId)
      .eq('is_approved', true)
      .eq('is_hidden', false)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + perPage - 1);
    if (error) throw error;
    return { data, count, page, totalPages: Math.ceil(count / perPage) };
  },

  subscribeRealtime(invitationId, callback) {
    const sb = OMEGA.getSupabase();
    return sb
      .channel(`guestbook:${invitationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guestbook', filter: `invitation_id=eq.${invitationId}` }, payload => {
        if (payload.new.is_approved) callback(payload);
      })
      .subscribe();
  },

  async moderate(messageId, action) {
    const sb = OMEGA.getSupabase();
    const updates = {};
    if (action === 'approve') updates.is_approved = true;
    if (action === 'hide') updates.is_hidden = true;
    if (action === 'pin') updates.is_pinned = true;
    if (action === 'unpin') updates.is_pinned = false;
    const { error } = await sb.from('guestbook').update(updates).eq('id', messageId);
    if (error) throw error;
  },
};

// ============================================================
// ATTENDANCE / QR MODULE
// ============================================================

OMEGA.attendance = {
  async scanQR(guestCode) {
    const sb = OMEGA.getSupabase();
    const user = await OMEGA.auth.getUser();

    const { data: guest, error: guestErr } = await sb
      .from('guests')
      .select('*, invitations(bride_name, groom_name)')
      .eq('unique_code', guestCode)
      .eq('is_active', true)
      .single();

    if (guestErr || !guest) throw new Error('Tamu tidak ditemukan atau kode tidak valid.');

    const { data: existing } = await sb
      .from('attendance')
      .select('*')
      .eq('guest_id', guest.id)
      .maybeSingle();

    if (existing && existing.status === 'arrived') {
      return { status: 'already_scanned', guest, attendance: existing };
    }

    const { data: attendance, error: attErr } = await sb
      .from('attendance')
      .upsert({
        invitation_id: guest.invitation_id,
        guest_id: guest.id,
        status: 'arrived',
        pax_arrived: guest.max_pax,
        scanned_by: user?.id,
        scanned_at: new Date().toISOString(),
      }, { onConflict: 'invitation_id,guest_id' })
      .select()
      .single();

    if (attErr) throw attErr;
    return { status: 'success', guest, attendance };
  },

  async getDashboard(invitationId) {
    const sb = OMEGA.getSupabase();
    const { data, error } = await sb
      .from('attendance')
      .select('*, guests(name, category, max_pax)')
      .eq('invitation_id', invitationId)
      .order('scanned_at', { ascending: false });
    if (error) throw error;

    const summary = {
      arrived: data.filter(a => a.status === 'arrived').length,
      total_pax: data.filter(a => a.status === 'arrived').reduce((sum, a) => sum + (a.pax_arrived || 0), 0),
      logs: data,
    };
    return summary;
  },

  subscribeRealtime(invitationId, callback) {
    const sb = OMEGA.getSupabase();
    return sb
      .channel(`attendance:${invitationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `invitation_id=eq.${invitationId}` }, callback)
      .subscribe();
  },
};

// ============================================================
// ANALYTICS MODULE
// ============================================================

OMEGA.analytics = {
  async track(invitationId, eventType, metadata = {}) {
    const sb = OMEGA.getSupabase();
    const sessionId = this.getSessionId();
    const deviceInfo = this.getDeviceInfo();

    await sb.from('analytics').insert({
      invitation_id: invitationId,
      event_type: eventType,
      session_id: sessionId,
      device_type: deviceInfo.type,
      browser: deviceInfo.browser,
      referrer: document.referrer || null,
      metadata,
    }).then(() => {});
  },

  async trackView(invitationId) {
    const viewKey = `viewed_${invitationId}`;
    const alreadyViewed = sessionStorage.getItem(viewKey);

    await this.track(invitationId, 'page_view');

    if (!alreadyViewed) {
      const sb = OMEGA.getSupabase();
      await sb.from('invitations').update({ view_count: OMEGA.getSupabase().rpc('increment', { x: 1 }) }).eq('id', invitationId);
      sessionStorage.setItem(viewKey, '1');
    }
  },

  getSessionId() {
    let sid = sessionStorage.getItem('omega_session');
    if (!sid) {
      sid = 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionStorage.setItem('omega_session', sid);
    }
    return sid;
  },

  getDeviceInfo() {
    const ua = navigator.userAgent;
    const isMobile = /Mobi|Android/i.test(ua);
    const isTablet = /Tablet|iPad/i.test(ua);
    const type = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

    let browser = 'unknown';
    if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) browser = 'chrome';
    else if (/Firefox/i.test(ua)) browser = 'firefox';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'safari';
    else if (/Edge/i.test(ua)) browser = 'edge';
    else if (/MSIE|Trident/i.test(ua)) browser = 'ie';

    return { type, browser };
  },

  async getReport(invitationId, days = 30) {
    const sb = OMEGA.getSupabase();
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await sb
      .from('analytics')
      .select('event_type, device_type, browser, country, created_at')
      .eq('invitation_id', invitationId)
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
};

// ============================================================
// ACTIVITY LOG MODULE
// ============================================================

OMEGA.activity = {
  async log(action, entityType = null, entityId = null, metadata = {}) {
    try {
      const sb = OMEGA.getSupabase();
      const user = await OMEGA.auth.getUser();
      await sb.from('activity_logs').insert({
        user_id: user?.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        new_value: metadata,
      });
    } catch (e) {
      // Non-critical, don't throw
      console.warn('Activity log failed:', e);
    }
  },
};

// ============================================================
// NOTIFICATION MODULE
// ============================================================

OMEGA.notifications = {
  async list(limit = 20) {
    const sb = OMEGA.getSupabase();
    const user = await OMEGA.auth.getUser();
    const { data, error } = await sb
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async markRead(notificationId) {
    const sb = OMEGA.getSupabase();
    const user = await OMEGA.auth.getUser();
    await sb.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', notificationId).eq('user_id', user.id);
  },

  async markAllRead() {
    const sb = OMEGA.getSupabase();
    const user = await OMEGA.auth.getUser();
    await sb.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', user.id).eq('is_read', false);
  },

  subscribeRealtime(userId, callback) {
    const sb = OMEGA.getSupabase();
    return sb
      .channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, callback)
      .subscribe();
  },
};

// ============================================================
// THEME ENGINE
// ============================================================

OMEGA.themes = {
  _cache: {},
  _current: null,

  async list() {
    const sb = OMEGA.getSupabase();
    const { data, error } = await sb.from('themes').select('*').eq('is_active', true).order('sort_order');
    if (error) throw error;
    return data;
  },

  async get(slug) {
    if (this._cache[slug]) return this._cache[slug];
    const sb = OMEGA.getSupabase();
    const { data, error } = await sb.from('themes').select('*').eq('slug', slug).eq('is_active', true).single();
    if (error) throw error;
    this._cache[slug] = data;
    return data;
  },

  async apply(slug) {
    const theme = await this.get(slug);
    if (!theme) throw new Error(`Theme "${slug}" not found`);

    // Apply CSS variables from theme config
    const root = document.documentElement;
    const cssVars = theme.css_variables || {};
    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Load theme CSS file
    this._loadCSS(`/themes/${slug}/theme.css`);

    // Load theme JS file
    await this._loadJS(`/themes/${slug}/theme.js`);

    // Apply body class
    document.body.className = document.body.className.replace(/theme-\S+/g, '');
    document.body.classList.add(`theme-${slug}`);

    this._current = theme;
    return theme;
  },

  _loadCSS(href) {
    const existing = document.getElementById('theme-css');
    if (existing) existing.remove();
    const link = document.createElement('link');
    link.id = 'theme-css';
    link.rel = 'stylesheet';
    link.href = href + '?v=' + Date.now();
    document.head.appendChild(link);
  },

  _loadJS(src) {
    return new Promise((resolve) => {
      const existing = document.getElementById('theme-js');
      if (existing) existing.remove();
      const script = document.createElement('script');
      script.id = 'theme-js';
      script.src = src + '?v=' + Date.now();
      script.onload = resolve;
      script.onerror = resolve; // Don't fail if theme JS missing
      document.body.appendChild(script);
    });
  },

  getCurrent() {
    return this._current;
  },
};

// ============================================================
// WHATSAPP MODULE
// ============================================================

OMEGA.whatsapp = {
  buildMessage(template, variables) {
    let message = template;
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return message;
  },

  getDefaultTemplate(type = 'invitation') {
    const templates = {
      invitation: `Assalamu'alaikum / Salam sejahtera 🌸

Kepada Yth. *{{guest_name}}*

Dengan penuh kebahagiaan, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di pernikahan kami:

👰🤵 *{{bride_name}}* & *{{groom_name}}*

📅 *{{event_date}}*
📍 *{{location}}*

Klik link undangan kami:
🔗 {{invitation_url}}

Konfirmasi kehadiran Anda sangat berarti bagi kami. 🙏

_Salam hangat,_
*{{bride_name}} & {{groom_name}}*`,

      reminder: `Pengingat Undangan 📩

*{{guest_name}}*, kami mengingatkan pernikahan kami akan berlangsung besok!

📅 *{{event_date}}*
📍 *{{location}}*

Lihat undangan: {{invitation_url}}

Sampai jumpa! 🥂`,
    };
    return templates[type] || templates.invitation;
  },

  async sendSingle(guestId, invitationId, message, provider = 'fonnte') {
    const sb = OMEGA.getSupabase();
    const { data: guest } = await sb.from('guests').select('name, phone').eq('id', guestId).single();

    if (!guest?.phone) throw new Error('Nomor HP tamu tidak tersedia.');

    const { data: msgRecord } = await sb.from('whatsapp_messages').insert({
      invitation_id: invitationId,
      guest_id: guestId,
      phone: guest.phone,
      message,
      provider,
      status: 'pending',
    }).select().single();

    // Actual sending would be via Edge Function to protect API keys
    // This triggers the serverless function
    const response = await fetch(`${OMEGA.config.supabaseUrl}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await sb.auth.getSession()).data.session?.access_token}`,
      },
      body: JSON.stringify({ messageId: msgRecord.id, provider }),
    });

    if (!response.ok) throw new Error('Gagal mengirim WhatsApp');
    return msgRecord;
  },
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

OMEGA.utils = {
  formatDate(dateString, locale = 'id-ID', options = {}) {
    if (!dateString) return '';
    const defaults = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(locale, { ...defaults, ...options });
  },

  formatDateTime(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },

  formatCurrency(amount, currency = 'IDR') {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
  },

  countdown(targetDate) {
    const now = new Date().getTime();
    const target = new Date(targetDate).getTime();
    const diff = target - now;

    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
      expired: false,
    };
  },

  debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  },

  throttle(fn, limit) {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  getQueryParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  },

  slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
  },

  generateQRSVG(data, size = 200) {
    // Generates a URL for QR API (qrserver.com - free, no key needed)
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&format=svg&color=1A1A1A&bgcolor=FFFFFF`;
  },

  copyToClipboard(text) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    });
  },

  showToast(message, type = 'success', duration = 3000) {
    const existing = document.getElementById('omega-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'omega-toast';
    toast.className = `omega-toast omega-toast--${type}`;
    toast.textContent = message;

    const colors = { success: '#2ECC71', error: '#E74C3C', warning: '#F39C12', info: '#3498DB' };
    toast.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);
      background:${colors[type] || colors.info};color:#fff;padding:12px 24px;
      border-radius:100px;font-size:14px;font-weight:600;z-index:99999;
      box-shadow:0 8px 32px rgba(0,0,0,0.2);transition:transform 0.3s ease;
      white-space:nowrap;max-width:90vw;text-align:center;
    `;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(80px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  lazyLoad() {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            if (el.dataset.src) {
              el.src = el.dataset.src;
              el.removeAttribute('data-src');
            }
            if (el.dataset.bg) {
              el.style.backgroundImage = `url(${el.dataset.bg})`;
              el.removeAttribute('data-bg');
            }
            el.classList.add('loaded');
            observer.unobserve(el);
          }
        });
      }, { rootMargin: '100px' });

      document.querySelectorAll('[data-src],[data-bg]').forEach(el => observer.observe(el));
    }
  },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  OMEGA.initSupabase();
  OMEGA.utils.lazyLoad();
});
