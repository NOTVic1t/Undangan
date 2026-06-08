# OMEGA Invitation Platform
**Platform Undangan Digital Pernikahan Komersial**
*Built by Victor Rizki Valentiano*

---

## Daftar Isi

1. [Prasyarat](#prasyarat)
2. [Setup Supabase](#setup-supabase)
3. [Konfigurasi Platform](#konfigurasi-platform)
4. [Deploy ke GitHub Pages](#deploy-ke-github-pages)
5. [Konfigurasi DNS & Domain](#konfigurasi-dns--domain)
6. [Edge Functions](#edge-functions)
7. [Integrasi Pembayaran](#integrasi-pembayaran)
8. [WhatsApp Gateway](#whatsapp-gateway)
9. [Struktur URL](#struktur-url)
10. [Cara Membuat Undangan](#cara-membuat-undangan)
11. [Troubleshooting](#troubleshooting)

---

## Prasyarat

- Akun [Supabase](https://supabase.com) (gratis tersedia)
- Akun [GitHub](https://github.com) dengan repo publik/privat
- Browser modern
- (Opsional) Domain custom

---

## Setup Supabase

### 1. Buat Project Supabase

1. Login ke [app.supabase.com](https://app.supabase.com)
2. Klik **New Project**
3. Isi nama project: `omega-invitation`
4. Pilih region terdekat (Singapore untuk Indonesia)
5. Set password database yang kuat
6. Klik **Create new project**, tunggu ~2 menit

### 2. Jalankan Database Schema

1. Buka **SQL Editor** di Supabase Dashboard
2. Klik **+ New query**
3. Copy seluruh isi file `database/schema.sql`
4. Paste ke SQL Editor
5. Klik **Run** (Ctrl+Enter)
6. Tunggu hingga semua query selesai (~30 detik)
7. Verifikasi di **Table Editor** — seharusnya ada 20+ tabel

### 3. Setup Storage Buckets

Di SQL Editor, jalankan:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('media', 'media', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/ogg','video/mp4']),
  ('themes', 'themes', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('private', 'private', false, 10485760, NULL);

-- Storage policies
CREATE POLICY "media_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "media_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.uid() IS NOT NULL);
CREATE POLICY "media_owner_delete" ON storage.objects FOR DELETE USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "themes_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'themes');
```

### 4. Buat User Owner Pertama

Di SQL Editor:

```sql
-- Setelah mendaftar via /admin/login.html, jalankan ini untuk upgrade ke owner:
UPDATE public.profiles
SET role = 'owner'
WHERE email = 'your-email@domain.com';
```

### 5. Dapatkan Credentials

Di **Settings > API**:
- **Project URL**: `https://xxxxx.supabase.co`
- **anon public key**: `eyJhbGc...`

---

## Konfigurasi Platform

### Edit config/supabase.js

Buka file `config/supabase.js` dan ganti:

```javascript
const OMEGA_CONFIG = {
  supabaseUrl: 'https://YOUR_PROJECT_ID.supabase.co',  // ← Ganti ini
  supabaseAnonKey: 'YOUR_ANON_KEY',                     // ← Ganti ini
  platformName: 'OMEGA Invitation',
  defaultBranding: 'Created By Victor Rizki Valentiano',
  brandingUrl: 'https://omega-invite.com',
  version: '1.0.0',
};
```

---

## Deploy ke GitHub Pages

### 1. Buat Repository

```bash
git init
git add .
git commit -m "Initial commit - OMEGA Invitation Platform"
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git push -u origin main
```

### 2. Enable GitHub Pages

1. Buka repo di GitHub
2. **Settings > Pages**
3. Source: **Deploy from a branch**
4. Branch: `main` / `(root)`
5. Klik **Save**
6. URL akan menjadi: `https://USERNAME.github.io/REPO_NAME/`

### 3. Custom Domain (Opsional)

1. Di **Settings > Pages**, masukkan custom domain: `undangan.domain.com`
2. Di DNS provider, tambahkan CNAME:
   ```
   undangan.domain.com → USERNAME.github.io
   ```
3. Centang **Enforce HTTPS**

---

## Struktur URL

| URL | Keterangan |
|-----|-----------|
| `/` | Landing page / router |
| `/admin/` | Panel admin |
| `/admin/login.html` | Login admin |
| `/invitation.html?slug=SLUG` | Undangan spesifik |
| `/i/SLUG` | Shortlink undangan (via 404 redirect) |
| `/i/SLUG?to=Nama+Tamu` | Undangan personal |
| `/i/SLUG?code=XXXXXXXX` | Via kode QR |
| `/scan.html` | QR Scanner absensi |

### Contoh Link Undangan

```
https://omega-invite.com/i/budi-sari-2025
https://omega-invite.com/i/budi-sari-2025?to=Pak+Ahmad
https://omega-invite.com/i/budi-sari-2025?code=AB12CD34
```

---

## Edge Functions

### Deploy Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_ID

# Set secrets
supabase secrets set MIDTRANS_SERVER_KEY=your_key
supabase secrets set XENDIT_WEBHOOK_TOKEN=your_token
supabase secrets set TRIPAY_PRIVATE_KEY=your_key

# Deploy
supabase functions deploy send-whatsapp
supabase functions deploy payment-webhook
```

---

## Integrasi Pembayaran

### Midtrans

1. Daftar di [dashboard.midtrans.com](https://dashboard.midtrans.com)
2. Ambil **Server Key** dan **Client Key**
3. Set Notification URL: `https://PROJECT.supabase.co/functions/v1/payment-webhook?provider=midtrans`
4. Simpan Server Key sebagai Supabase secret: `supabase secrets set MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx`

### Xendit

1. Daftar di [dashboard.xendit.co](https://dashboard.xendit.co)
2. **Settings > Webhooks**, tambahkan URL: `https://PROJECT.supabase.co/functions/v1/payment-webhook?provider=xendit`
3. Copy Webhook Verification Token
4. `supabase secrets set XENDIT_WEBHOOK_TOKEN=your_token`

### Tripay

1. Daftar di [tripay.co.id](https://tripay.co.id)
2. API Key dan Private Key dari dashboard
3. Callback URL: `https://PROJECT.supabase.co/functions/v1/payment-webhook?provider=tripay`

---

## WhatsApp Gateway

### Konfigurasi di Admin Panel

1. Login ke `/admin/`
2. Pergi ke **Pengaturan**
3. Isi konfigurasi WhatsApp:
   - Provider: Fonnte / Wablas / Whacenter
   - API Key dari provider
   - Nomor pengirim

### Provider yang Didukung

| Provider | Website | Keterangan |
|----------|---------|-----------|
| **Fonnte** | fonnte.com | Recommended, murah |
| **Wablas** | wablas.com | Stabil, fitur lengkap |
| **Whacenter** | whacenter.com | Alternatif populer |

---

## Cara Membuat Undangan

### Via Admin Panel

1. Login ke `/admin/`
2. Klik **Undangan Baru** atau **Buat Undangan**
3. Isi data pengantin (nama, foto, orang tua)
4. Isi detail acara (tanggal, lokasi, Google Maps)
5. Pilih tema undangan
6. Aktifkan fitur yang diinginkan (RSVP, Buku Tamu, QR, dsb)
7. Klik **Simpan & Publish**

### Tambah Tamu

1. Pergi ke menu **Tamu**
2. Pilih undangan
3. **Tambah Manual**: klik **+ Tambah Tamu**, isi data
4. **Import Massal**: klik **Import CSV**, upload file dengan format:
   ```
   name,phone,email,category,pax,notes
   Budi Santoso,081234567890,budi@email.com,friends,2,
   ```
5. Setiap tamu otomatis mendapat kode unik dan link personal

### Kirim Undangan via WhatsApp

1. Pastikan konfigurasi WhatsApp sudah aktif
2. Di halaman **Tamu**, klik ikon 💬 di samping nama tamu
3. Atau gunakan bulk send dari menu tamu

### Scan QR Absensi

1. Buka `/scan.html` di device panitia
2. Login jika diminta
3. Pilih undangan
4. Ketik atau scan kode 8 karakter dari QR tamu
5. System otomatis mencatat kehadiran real-time

---

## Troubleshooting

### Undangan tidak muncul

- Pastikan status undangan adalah **Published** (bukan Draft)
- Cek Supabase URL dan anon key di `config/supabase.js`
- Buka browser DevTools → Console untuk melihat error

### RLS Error (permission denied)

- Pastikan sudah menjalankan seluruh `database/schema.sql`
- Cek apakah user memiliki role yang tepat di tabel `profiles`

### GitHub Pages 404

- Pastikan file `404.html` ada di root
- Tunggu 1-2 menit setelah push untuk GitHub Pages rebuild

### Tema tidak teraplikasi

- Pastikan file `themes/SLUG/theme.css` dan `theme.js` ada
- Cek nama slug di database (`themes` table) cocok dengan nama folder
- Buka Network tab di DevTools untuk melihat apakah file ter-load

### RSVP / Guestbook tidak tersimpan

- Cek RLS policy di Supabase untuk tabel `rsvp` dan `guestbook`
- Policy `rsvp_insert_public` dan `guestbook_insert_public` harus aktif
- Pastikan `enable_rsvp` / `enable_guestbook` = `true` di record undangan

---

## Struktur File

```
omega-invite/
├── index.html                 # Router utama
├── invitation.html            # Public invitation page
├── scan.html                  # QR attendance scanner
├── 404.html                   # GitHub Pages SPA redirect
├── _config.yml                # GitHub Pages config
├── config/
│   └── supabase.js            # ← EDIT INI: URL & anon key
├── core/
│   ├── omega.js               # Core platform utilities
│   ├── invitation.css         # Invitation styles
│   └── invitation-init.js     # Invitation runtime
├── admin/
│   ├── index.html             # Admin dashboard
│   ├── login.html             # Admin login
│   ├── css/admin.css          # Admin styles
│   └── js/admin.js            # Admin runtime
├── themes/
│   ├── luxury-gold/           # theme.css + theme.js + theme.json
│   ├── luxury-sakura/
│   ├── luxury-black/
│   ├── modern-korean/
│   ├── minimal-white/
│   ├── royal-dark/
│   ├── islamic-elegant/
│   ├── floral-pink/
│   ├── champagne-gold/
│   └── luxury-emerald/
├── database/
│   └── schema.sql             # Supabase PostgreSQL schema
├── supabase/
│   └── functions/
│       ├── send-whatsapp/     # WA edge function
│       └── payment-webhook/   # Payment edge function
└── assets/
    ├── images/
    ├── audio/
    └── video/
```

---

## Checklist Sebelum Go Live

- [ ] Supabase project dibuat dan schema dijalankan
- [ ] Storage buckets dibuat dengan policies yang benar
- [ ] `config/supabase.js` diisi dengan URL dan anon key yang benar
- [ ] User owner pertama dibuat dan di-upgrade rolenya
- [ ] GitHub Pages aktif dan URL bisa diakses
- [ ] Tema-tema bisa dimuat (test buka undangan)
- [ ] RSVP bisa dikirim (test submit form)
- [ ] Buku tamu bisa diposting
- [ ] Admin panel bisa login
- [ ] Undangan bisa dibuat dan dipublish
- [ ] Tamu bisa ditambah manual
- [ ] Import CSV berfungsi
- [ ] QR scanner berfungsi di `/scan.html`
- [ ] Edge Functions di-deploy (jika ingin WA & payment)
- [ ] Branding footer dikonfigurasi di Settings

---

*OMEGA Invitation Platform — Created by Victor Rizki Valentiano*
