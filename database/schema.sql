-- ============================================================
-- OMEGA INVITATION PLATFORM - COMPLETE DATABASE SCHEMA
-- Supabase / PostgreSQL
-- Version: 1.0.0
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'vendor', 'reseller', 'customer');
CREATE TYPE invitation_status AS ENUM ('draft', 'published', 'unpublished', 'expired', 'archived');
CREATE TYPE rsvp_status AS ENUM ('pending', 'attending', 'not_attending', 'maybe');
CREATE TYPE attendance_status AS ENUM ('not_arrived', 'arrived', 'no_show');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'expired');
CREATE TYPE package_type AS ENUM ('basic', 'premium', 'exclusive', 'vendor', 'reseller');
CREATE TYPE guest_category AS ENUM ('vip', 'family', 'friends', 'office', 'custom');
CREATE TYPE notification_type AS ENUM ('rsvp', 'guestbook', 'attendance', 'payment', 'system');
CREATE TYPE media_type AS ENUM ('image', 'video', 'audio', 'document');
CREATE TYPE whatsapp_provider AS ENUM ('fonnte', 'wablas', 'whacenter', 'custom');
CREATE TYPE message_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');

-- ============================================================
-- TABLE: profiles (extends Supabase auth.users)
-- ============================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'customer',
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  avatar_url TEXT,
  company_name VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Indonesia',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  reseller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_reseller_id ON public.profiles(reseller_id);
CREATE INDEX idx_profiles_vendor_id ON public.profiles(vendor_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- ============================================================
-- TABLE: themes
-- ============================================================

CREATE TABLE public.themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  preview_image_url TEXT,
  thumbnail_url TEXT,
  category VARCHAR(100),
  tags TEXT[] DEFAULT '{}',
  config JSONB NOT NULL DEFAULT '{}',
  css_variables JSONB NOT NULL DEFAULT '{}',
  features TEXT[] DEFAULT '{}',
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_themes_slug ON public.themes(slug);
CREATE INDEX idx_themes_is_active ON public.themes(is_active);
CREATE INDEX idx_themes_is_premium ON public.themes(is_premium);

-- ============================================================
-- TABLE: packages
-- ============================================================

CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type package_type NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price BIGINT NOT NULL DEFAULT 0,
  original_price BIGINT,
  currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
  duration_days INTEGER NOT NULL DEFAULT 365,
  max_guests INTEGER,
  max_photos INTEGER,
  features JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: invitations
-- ============================================================

CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(255) NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reseller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  theme_id UUID REFERENCES public.themes(id) ON DELETE SET NULL,
  package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  status invitation_status NOT NULL DEFAULT 'draft',

  -- Couple Information
  bride_name VARCHAR(255) NOT NULL,
  bride_full_name VARCHAR(255),
  bride_father VARCHAR(255),
  bride_mother VARCHAR(255),
  bride_photo_url TEXT,
  bride_instagram VARCHAR(100),
  groom_name VARCHAR(255) NOT NULL,
  groom_full_name VARCHAR(255),
  groom_father VARCHAR(255),
  groom_mother VARCHAR(255),
  groom_photo_url TEXT,
  groom_instagram VARCHAR(100),

  -- Event Details
  akad_date TIMESTAMPTZ,
  akad_location VARCHAR(500),
  akad_address TEXT,
  akad_maps_url TEXT,
  reception_date TIMESTAMPTZ,
  reception_location VARCHAR(500),
  reception_address TEXT,
  reception_maps_url TEXT,
  reception_maps_embed TEXT,

  -- Content
  opening_text TEXT,
  love_story TEXT,
  closing_text TEXT,
  dress_code VARCHAR(255),
  dress_code_colors TEXT[],

  -- Media
  cover_photo_url TEXT,
  couple_photo_url TEXT,
  background_music_url TEXT,
  music_title VARCHAR(255),
  music_artist VARCHAR(255),
  video_url TEXT,
  youtube_embed_id VARCHAR(50),
  livestream_url TEXT,

  -- Settings
  custom_domain VARCHAR(255),
  enable_rsvp BOOLEAN DEFAULT TRUE,
  enable_guestbook BOOLEAN DEFAULT TRUE,
  enable_gift BOOLEAN DEFAULT TRUE,
  enable_music BOOLEAN DEFAULT TRUE,
  enable_countdown BOOLEAN DEFAULT TRUE,
  enable_qr_attendance BOOLEAN DEFAULT FALSE,
  enable_seat_management BOOLEAN DEFAULT FALSE,
  enable_live_streaming BOOLEAN DEFAULT FALSE,
  max_guests INTEGER,
  rsvp_deadline TIMESTAMPTZ,
  guest_limit_per_rsvp INTEGER DEFAULT 5,

  -- Gift Accounts
  gift_accounts JSONB DEFAULT '[]',

  -- Analytics
  view_count INTEGER DEFAULT 0,
  unique_visitor_count INTEGER DEFAULT 0,

  -- Expiry
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,
  og_image_url TEXT,

  -- Branding
  hide_branding BOOLEAN DEFAULT FALSE,
  custom_branding TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_slug ON public.invitations(slug);
CREATE INDEX idx_invitations_owner_id ON public.invitations(owner_id);
CREATE INDEX idx_invitations_vendor_id ON public.invitations(vendor_id);
CREATE INDEX idx_invitations_reseller_id ON public.invitations(reseller_id);
CREATE INDEX idx_invitations_status ON public.invitations(status);
CREATE INDEX idx_invitations_theme_id ON public.invitations(theme_id);
CREATE INDEX idx_invitations_created_at ON public.invitations(created_at DESC);

-- ============================================================
-- TABLE: guest_groups
-- ============================================================

CREATE TABLE public.guest_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category guest_category NOT NULL DEFAULT 'friends',
  color VARCHAR(7),
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guest_groups_invitation_id ON public.guest_groups(invitation_id);

-- ============================================================
-- TABLE: guests
-- ============================================================

CREATE TABLE public.guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.guest_groups(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  category guest_category DEFAULT 'friends',
  max_pax INTEGER DEFAULT 1,
  notes TEXT,
  unique_code VARCHAR(50) NOT NULL UNIQUE,
  qr_code_url TEXT,
  personalized_url TEXT,
  whatsapp_sent BOOLEAN DEFAULT FALSE,
  whatsapp_sent_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guests_invitation_id ON public.guests(invitation_id);
CREATE INDEX idx_guests_group_id ON public.guests(group_id);
CREATE INDEX idx_guests_unique_code ON public.guests(unique_code);
CREATE INDEX idx_guests_phone ON public.guests(phone);
CREATE INDEX idx_guests_name_trgm ON public.guests USING GIN (name gin_trgm_ops);

-- ============================================================
-- TABLE: rsvp
-- ============================================================

CREATE TABLE public.rsvp (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.guests(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  status rsvp_status NOT NULL DEFAULT 'pending',
  pax_count INTEGER NOT NULL DEFAULT 1,
  message TEXT,
  will_attend_akad BOOLEAN,
  will_attend_reception BOOLEAN DEFAULT TRUE,
  dietary_notes TEXT,
  ip_address INET,
  user_agent TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rsvp_invitation_id ON public.rsvp(invitation_id);
CREATE INDEX idx_rsvp_guest_id ON public.rsvp(guest_id);
CREATE INDEX idx_rsvp_status ON public.rsvp(status);
CREATE INDEX idx_rsvp_submitted_at ON public.rsvp(submitted_at DESC);

-- ============================================================
-- TABLE: attendance
-- ============================================================

CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'not_arrived',
  pax_arrived INTEGER DEFAULT 0,
  scanned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ,
  device_info TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(invitation_id, guest_id)
);

CREATE INDEX idx_attendance_invitation_id ON public.attendance(invitation_id);
CREATE INDEX idx_attendance_guest_id ON public.attendance(guest_id);
CREATE INDEX idx_attendance_status ON public.attendance(status);
CREATE INDEX idx_attendance_scanned_at ON public.attendance(scanned_at DESC);

-- ============================================================
-- TABLE: guestbook
-- ============================================================

CREATE TABLE public.guestbook (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT TRUE,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  likes_count INTEGER DEFAULT 0,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guestbook_invitation_id ON public.guestbook(invitation_id);
CREATE INDEX idx_guestbook_is_approved ON public.guestbook(is_approved);
CREATE INDEX idx_guestbook_created_at ON public.guestbook(created_at DESC);
CREATE INDEX idx_guestbook_message_trgm ON public.guestbook USING GIN (message gin_trgm_ops);

-- ============================================================
-- TABLE: gallery
-- ============================================================

CREATE TABLE public.gallery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  media_type media_type NOT NULL DEFAULT 'image',
  sort_order INTEGER DEFAULT 0,
  width INTEGER,
  height INTEGER,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gallery_invitation_id ON public.gallery(invitation_id);
CREATE INDEX idx_gallery_sort_order ON public.gallery(sort_order);

-- ============================================================
-- TABLE: stories (Love Story timeline)
-- ============================================================

CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  date DATE,
  image_url TEXT,
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stories_invitation_id ON public.stories(invitation_id);
CREATE INDEX idx_stories_sort_order ON public.stories(sort_order);

-- ============================================================
-- TABLE: payments
-- ============================================================

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID REFERENCES public.invitations(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reseller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  package_name VARCHAR(255) NOT NULL,
  amount BIGINT NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
  status payment_status NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(100),
  payment_channel VARCHAR(100),
  provider VARCHAR(50),
  provider_order_id VARCHAR(255),
  provider_transaction_id VARCHAR(255),
  provider_payment_url TEXT,
  provider_response JSONB,
  paid_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_invitation_id ON public.payments(invitation_id);
CREATE INDEX idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_provider_order_id ON public.payments(provider_order_id);
CREATE INDEX idx_payments_created_at ON public.payments(created_at DESC);

-- ============================================================
-- TABLE: transactions (reseller commissions)
-- ============================================================

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  reseller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount BIGINT NOT NULL,
  commission_rate NUMERIC(5,2) DEFAULT 0,
  commission_amount BIGINT DEFAULT 0,
  net_amount BIGINT,
  status VARCHAR(50) DEFAULT 'pending',
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_payment_id ON public.transactions(payment_id);
CREATE INDEX idx_transactions_reseller_id ON public.transactions(reseller_id);

-- ============================================================
-- TABLE: analytics
-- ============================================================

CREATE TABLE public.analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  device_type VARCHAR(50),
  browser VARCHAR(100),
  os VARCHAR(100),
  country VARCHAR(100),
  city VARCHAR(100),
  referrer TEXT,
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_invitation_id ON public.analytics(invitation_id);
CREATE INDEX idx_analytics_event_type ON public.analytics(event_type);
CREATE INDEX idx_analytics_created_at ON public.analytics(created_at DESC);
CREATE INDEX idx_analytics_session_id ON public.analytics(session_id);
CREATE INDEX idx_analytics_country ON public.analytics(country);

-- ============================================================
-- TABLE: media
-- ============================================================

CREATE TABLE public.media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitation_id UUID REFERENCES public.invitations(id) ON DELETE SET NULL,
  filename VARCHAR(500) NOT NULL,
  original_filename VARCHAR(500),
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  media_type media_type NOT NULL DEFAULT 'image',
  mime_type VARCHAR(100),
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  is_public BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_owner_id ON public.media(owner_id);
CREATE INDEX idx_media_invitation_id ON public.media(invitation_id);
CREATE INDEX idx_media_media_type ON public.media(media_type);

-- ============================================================
-- TABLE: notifications
-- ============================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitation_id UUID REFERENCES public.invitations(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- ============================================================
-- TABLE: whatsapp_messages
-- ============================================================

CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.guests(id) ON DELETE CASCADE,
  phone VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  provider whatsapp_provider NOT NULL DEFAULT 'fonnte',
  status message_status NOT NULL DEFAULT 'pending',
  provider_message_id VARCHAR(255),
  provider_response JSONB,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wa_messages_invitation_id ON public.whatsapp_messages(invitation_id);
CREATE INDEX idx_wa_messages_guest_id ON public.whatsapp_messages(guest_id);
CREATE INDEX idx_wa_messages_status ON public.whatsapp_messages(status);

-- ============================================================
-- TABLE: whatsapp_settings
-- ============================================================

CREATE TABLE public.whatsapp_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  provider whatsapp_provider NOT NULL DEFAULT 'fonnte',
  api_key TEXT,
  sender_number VARCHAR(50),
  is_active BOOLEAN DEFAULT FALSE,
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: settings (platform-wide settings)
-- ============================================================

CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(255) NOT NULL UNIQUE,
  value JSONB,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settings_key ON public.settings(key);

-- ============================================================
-- TABLE: activity_logs
-- ============================================================

CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity_type ON public.activity_logs(entity_type);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- ============================================================
-- TABLE: audit_logs
-- ============================================================

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  operation VARCHAR(20) NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX idx_audit_logs_changed_at ON public.audit_logs(changed_at DESC);

-- ============================================================
-- TABLE: seat_management
-- ============================================================

CREATE TABLE public.seat_management (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  table_number INTEGER,
  seat_number INTEGER,
  area VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seats_invitation_id ON public.seat_management(invitation_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_invitations BEFORE UPDATE ON public.invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_guests BEFORE UPDATE ON public.guests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_rsvp BEFORE UPDATE ON public.rsvp FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_attendance BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_guestbook BEFORE UPDATE ON public.guestbook FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_themes BEFORE UPDATE ON public.themes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_payments BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate unique guest code
CREATE OR REPLACE FUNCTION generate_guest_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unique_code IS NULL OR NEW.unique_code = '' THEN
    NEW.unique_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_guest_code BEFORE INSERT ON public.guests FOR EACH ROW EXECUTE FUNCTION generate_guest_code();

-- Increment view count
CREATE OR REPLACE FUNCTION increment_invitation_view(inv_id UUID, session VARCHAR, ip INET, ua TEXT, dev_type VARCHAR, ref TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.invitations SET view_count = view_count + 1 WHERE id = inv_id;
  INSERT INTO public.analytics (invitation_id, event_type, session_id, ip_address, user_agent, device_type, referrer)
  VALUES (inv_id, 'page_view', session, ip, ua, dev_type, ref);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get invitation stats
CREATE OR REPLACE FUNCTION get_invitation_stats(inv_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_guests', (SELECT COUNT(*) FROM public.guests WHERE invitation_id = inv_id AND is_active = TRUE),
    'rsvp_attending', (SELECT COUNT(*) FROM public.rsvp WHERE invitation_id = inv_id AND status = 'attending'),
    'rsvp_not_attending', (SELECT COUNT(*) FROM public.rsvp WHERE invitation_id = inv_id AND status = 'not_attending'),
    'rsvp_pending', (SELECT COUNT(*) FROM public.rsvp WHERE invitation_id = inv_id AND status = 'pending'),
    'total_rsvp_pax', (SELECT COALESCE(SUM(pax_count), 0) FROM public.rsvp WHERE invitation_id = inv_id AND status = 'attending'),
    'attendance_arrived', (SELECT COUNT(*) FROM public.attendance WHERE invitation_id = inv_id AND status = 'arrived'),
    'guestbook_count', (SELECT COUNT(*) FROM public.guestbook WHERE invitation_id = inv_id AND is_approved = TRUE),
    'view_count', (SELECT view_count FROM public.invitations WHERE id = inv_id),
    'wa_sent', (SELECT COUNT(*) FROM public.guests WHERE invitation_id = inv_id AND whatsapp_sent = TRUE)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guestbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_management ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION get_user_role(uid UUID)
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = uid;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function: is owner or admin
CREATE OR REPLACE FUNCTION is_admin_or_owner(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT role IN ('owner', 'admin') FROM public.profiles WHERE id = uid;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- PROFILES POLICIES
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (id = auth.uid() OR is_admin_or_owner(auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid() OR is_admin_or_owner(auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- INVITATIONS POLICIES
CREATE POLICY "invitations_select_public" ON public.invitations FOR SELECT USING (
  status = 'published' OR 
  owner_id = auth.uid() OR 
  vendor_id = auth.uid() OR 
  reseller_id = auth.uid() OR
  is_admin_or_owner(auth.uid())
);
CREATE POLICY "invitations_insert_own" ON public.invitations FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "invitations_update_own" ON public.invitations FOR UPDATE USING (
  owner_id = auth.uid() OR vendor_id = auth.uid() OR is_admin_or_owner(auth.uid())
);
CREATE POLICY "invitations_delete_own" ON public.invitations FOR DELETE USING (owner_id = auth.uid() OR is_admin_or_owner(auth.uid()));

-- GUESTS POLICIES
CREATE POLICY "guests_select_owner" ON public.guests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND (i.owner_id = auth.uid() OR i.vendor_id = auth.uid() OR is_admin_or_owner(auth.uid())))
);
CREATE POLICY "guests_insert_owner" ON public.guests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND (i.owner_id = auth.uid() OR is_admin_or_owner(auth.uid())))
);
CREATE POLICY "guests_update_owner" ON public.guests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND (i.owner_id = auth.uid() OR is_admin_or_owner(auth.uid())))
);
CREATE POLICY "guests_delete_owner" ON public.guests FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND (i.owner_id = auth.uid() OR is_admin_or_owner(auth.uid())))
);

-- RSVP POLICIES (public can insert for published invitations)
CREATE POLICY "rsvp_select_owner" ON public.rsvp FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND (i.owner_id = auth.uid() OR is_admin_or_owner(auth.uid())))
);
CREATE POLICY "rsvp_insert_public" ON public.rsvp FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND i.status = 'published' AND i.enable_rsvp = TRUE)
);

-- GUESTBOOK POLICIES (public can insert for published invitations)
CREATE POLICY "guestbook_select_approved" ON public.guestbook FOR SELECT USING (
  (is_approved = TRUE AND EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND i.status = 'published')) OR
  EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND (i.owner_id = auth.uid() OR is_admin_or_owner(auth.uid())))
);
CREATE POLICY "guestbook_insert_public" ON public.guestbook FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND i.status = 'published' AND i.enable_guestbook = TRUE)
);
CREATE POLICY "guestbook_update_owner" ON public.guestbook FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND (i.owner_id = auth.uid() OR is_admin_or_owner(auth.uid())))
);
CREATE POLICY "guestbook_delete_owner" ON public.guestbook FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND (i.owner_id = auth.uid() OR is_admin_or_owner(auth.uid())))
);

-- ATTENDANCE POLICIES
CREATE POLICY "attendance_select_owner" ON public.attendance FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND (i.owner_id = auth.uid() OR is_admin_or_owner(auth.uid())))
  OR scanned_by = auth.uid()
);
CREATE POLICY "attendance_insert_staff" ON public.attendance FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "attendance_update_staff" ON public.attendance FOR UPDATE USING (auth.uid() IS NOT NULL);

-- GALLERY POLICIES
CREATE POLICY "gallery_select_public" ON public.gallery FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND (i.status = 'published' OR i.owner_id = auth.uid() OR is_admin_or_owner(auth.uid())))
);
CREATE POLICY "gallery_manage_owner" ON public.gallery FOR ALL USING (
  EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND (i.owner_id = auth.uid() OR is_admin_or_owner(auth.uid())))
);

-- MEDIA POLICIES
CREATE POLICY "media_select_own" ON public.media FOR SELECT USING (owner_id = auth.uid() OR is_admin_or_owner(auth.uid()));
CREATE POLICY "media_insert_own" ON public.media FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "media_delete_own" ON public.media FOR DELETE USING (owner_id = auth.uid() OR is_admin_or_owner(auth.uid()));

-- NOTIFICATIONS POLICIES
CREATE POLICY "notifications_own" ON public.notifications FOR ALL USING (user_id = auth.uid());

-- PAYMENTS POLICIES
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT USING (customer_id = auth.uid() OR is_admin_or_owner(auth.uid()) OR reseller_id = auth.uid());
CREATE POLICY "payments_insert_own" ON public.payments FOR INSERT WITH CHECK (customer_id = auth.uid());

-- ANALYTICS POLICIES
CREATE POLICY "analytics_select_owner" ON public.analytics FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND (i.owner_id = auth.uid() OR is_admin_or_owner(auth.uid())))
);
CREATE POLICY "analytics_insert_public" ON public.analytics FOR INSERT WITH CHECK (TRUE);

-- THEMES POLICIES (themes are public read)
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "themes_select_active" ON public.themes FOR SELECT USING (is_active = TRUE OR is_admin_or_owner(auth.uid()));
CREATE POLICY "themes_manage_admin" ON public.themes FOR ALL USING (is_admin_or_owner(auth.uid()));

-- SETTINGS POLICIES
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select_public" ON public.settings FOR SELECT USING (is_public = TRUE OR is_admin_or_owner(auth.uid()));
CREATE POLICY "settings_manage_admin" ON public.settings FOR ALL USING (is_admin_or_owner(auth.uid()));

-- PACKAGES POLICIES
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packages_select_active" ON public.packages FOR SELECT USING (is_active = TRUE OR is_admin_or_owner(auth.uid()));
CREATE POLICY "packages_manage_admin" ON public.packages FOR ALL USING (is_admin_or_owner(auth.uid()));

-- ============================================================
-- SEED DATA: Default Platform Settings
-- ============================================================

INSERT INTO public.settings (key, value, description, is_public) VALUES
('platform_name', '"OMEGA Invitation"', 'Platform name', TRUE),
('platform_url', '"https://omega-invite.com"', 'Platform URL', TRUE),
('platform_logo', 'null', 'Platform logo URL', TRUE),
('default_branding', '"Created By Victor Rizki Valentiano"', 'Default invitation footer branding', TRUE),
('branding_url', '"https://omega-invite.com"', 'Branding URL', TRUE),
('default_theme', '"luxury-gold"', 'Default invitation theme', TRUE),
('max_file_size_mb', '10', 'Maximum file upload size in MB', FALSE),
('allowed_image_types', '["image/jpeg","image/png","image/webp","image/gif"]', 'Allowed image MIME types', FALSE),
('max_gallery_photos', '50', 'Maximum gallery photos per invitation', FALSE),
('rate_limit_rsvp', '5', 'Max RSVP submissions per IP per hour', FALSE),
('rate_limit_guestbook', '10', 'Max guestbook entries per IP per hour', FALSE),
('guestbook_auto_approve', 'true', 'Auto-approve guestbook entries', FALSE),
('analytics_retention_days', '365', 'Analytics data retention in days', FALSE),
('smtp_from_name', '"OMEGA Invitation"', 'SMTP sender name', FALSE),
('midtrans_environment', '"sandbox"', 'Midtrans environment', FALSE),
('xendit_environment', '"test"', 'Xendit environment', FALSE),
('reseller_commission_rate', '20', 'Default reseller commission percentage', FALSE),
('invitation_trial_days', '7', 'Free trial duration in days', FALSE),
('support_email', '"support@omega-invite.com"', 'Support email', TRUE),
('support_whatsapp', '"+6281234567890"', 'Support WhatsApp number', TRUE);

-- ============================================================
-- SEED DATA: Default Packages
-- ============================================================

INSERT INTO public.packages (type, name, description, price, original_price, duration_days, max_guests, max_photos, features, sort_order) VALUES
('basic', 'Basic', 'Perfect for intimate weddings', 99000, 199000, 180, 100, 20, 
  '["5 foto gallery","RSVP online","Guestbook","Countdown","Google Maps","Tanpa watermark tema"]', 1),
('premium', 'Premium', 'Most popular choice', 199000, 399000, 365, 500, 50,
  '["50 foto gallery","RSVP online","Guestbook","Countdown","Google Maps","Musik latar","QR Attendance","Tema premium","Live streaming embed","Manajemen tamu","Import Excel","Kirim WA"]', 2),
('exclusive', 'Exclusive', 'Full featured luxury experience', 349000, 599000, 365, -1, 100,
  '["Unlimited foto gallery","RSVP online","Guestbook","Countdown","Google Maps","Musik latar","QR Attendance","Semua tema","Live streaming","Manajemen tamu","Import Excel","Kirim WA bulk","Analytics detail","Custom domain","Manajemen kursi","Souvenir digital","Filter foto"]', 3),
('vendor', 'Vendor Package', 'For wedding organizers managing multiple clients', 999000, 1999000, 365, -1, -1,
  '["Unlimited undangan","Unlimited tamu","Semua fitur Exclusive","Multi client management","Analytics per klien","Branding custom","Priority support"]', 4),
('reseller', 'Reseller Package', 'Earn commission by reselling invitations', 499000, 999000, 365, -1, -1,
  '["Akses reseller panel","Komisi hingga 30%","Dashboard revenue","Manage customer","Laporan penjualan","Support prioritas"]', 5);

-- ============================================================
-- SEED DATA: Default Themes
-- ============================================================

INSERT INTO public.themes (slug, name, description, category, tags, is_premium, is_featured, sort_order, config, css_variables) VALUES
('luxury-gold', 'Luxury Gold', 'Elegan dan mewah dengan aksen emas', 'luxury', ARRAY['gold','elegant','luxury','modern'], FALSE, TRUE, 1,
  '{"primaryFont":"Cormorant Garamond","secondaryFont":"Lato","particles":"gold_dust","openingAnimation":"fade_reveal","sectionAnimation":"slide_up"}',
  '{"--theme-primary":"#C9A84C","--theme-secondary":"#F5E6C8","--theme-bg":"#1A1209","--theme-text":"#F5E6C8","--theme-accent":"#E8C97A","--theme-dark":"#0D0904"}'),
('luxury-sakura', 'Luxury Sakura', 'Romantis dengan kelopak bunga sakura', 'romantic', ARRAY['sakura','pink','romantic','floral'], FALSE, TRUE, 2,
  '{"primaryFont":"Playfair Display","secondaryFont":"Nunito","particles":"petals","openingAnimation":"petal_fall","sectionAnimation":"bloom"}',
  '{"--theme-primary":"#C4637A","--theme-secondary":"#F9EEF1","--theme-bg":"#FDF6F8","--theme-text":"#3D1A24","--theme-accent":"#E891A8","--theme-dark":"#2A0F17"}'),
('luxury-black', 'Luxury Black', 'Modern dan berani dengan tema gelap', 'modern', ARRAY['black','dark','modern','luxury'], TRUE, TRUE, 3,
  '{"primaryFont":"Cinzel","secondaryFont":"Raleway","particles":"fireflies","openingAnimation":"dramatic_reveal","sectionAnimation":"fade_up"}',
  '{"--theme-primary":"#C9A84C","--theme-secondary":"#1A1A1A","--theme-bg":"#0A0A0A","--theme-text":"#E8E8E8","--theme-accent":"#FFD700","--theme-dark":"#050505"}'),
('modern-korean', 'Modern Korean', 'Minimalis elegan gaya Korea', 'modern', ARRAY['korean','minimal','clean','modern'], FALSE, FALSE, 4,
  '{"primaryFont":"Noto Serif KR","secondaryFont":"Noto Sans KR","particles":"none","openingAnimation":"slide_reveal","sectionAnimation":"fade"}',
  '{"--theme-primary":"#2C2C2C","--theme-secondary":"#F8F8F8","--theme-bg":"#FFFFFF","--theme-text":"#1A1A1A","--theme-accent":"#A68A6A","--theme-dark":"#0D0D0D"}'),
('minimal-white', 'Minimal White', 'Bersih, sederhana, dan berkelas', 'minimal', ARRAY['white','minimal','clean','classic'], FALSE, FALSE, 5,
  '{"primaryFont":"Cormorant","secondaryFont":"Jost","particles":"none","openingAnimation":"clean_fade","sectionAnimation":"subtle_up"}',
  '{"--theme-primary":"#8B6F47","--theme-secondary":"#F5F5F0","--theme-bg":"#FAFAF8","--theme-text":"#2A2A2A","--theme-accent":"#C4A882","--theme-dark":"#1A1A1A"}'),
('royal-dark', 'Royal Dark', 'Kemewahan kerajaan dengan nuansa gelap', 'luxury', ARRAY['royal','dark','luxury','elegant'], TRUE, FALSE, 6,
  '{"primaryFont":"Cinzel Decorative","secondaryFont":"Crimson Pro","particles":"gold_dust","openingAnimation":"royal_reveal","sectionAnimation":"majestic"}',
  '{"--theme-primary":"#8B6914","--theme-secondary":"#1C1208","--theme-bg":"#100A04","--theme-text":"#F0D080","--theme-accent":"#D4AF37","--theme-dark":"#080503"}'),
('islamic-elegant', 'Islamic Elegant', 'Islami dengan ornamen arabesque', 'islamic', ARRAY['islamic','arabic','elegant','ornament'], FALSE, TRUE, 7,
  '{"primaryFont":"Amiri","secondaryFont":"Noto Sans Arabic","particles":"none","openingAnimation":"arabesque","sectionAnimation":"reveal"}',
  '{"--theme-primary":"#2C6E49","--theme-secondary":"#F0EAD6","--theme-bg":"#FDFAF4","--theme-text":"#1A2E1A","--theme-accent":"#C9A84C","--theme-dark":"#0D1A0D"}'),
('floral-pink', 'Floral Pink', 'Penuh bunga dengan warna pink lembut', 'romantic', ARRAY['floral','pink','romantic','feminine'], FALSE, FALSE, 8,
  '{"primaryFont":"Great Vibes","secondaryFont":"Lato","particles":"petals","openingAnimation":"bloom","sectionAnimation":"petal_reveal"}',
  '{"--theme-primary":"#D4688E","--theme-secondary":"#FCF0F4","--theme-bg":"#FEF8FA","--theme-text":"#3D1A2A","--theme-accent":"#F09DB8","--theme-dark":"#200A13"}'),
('champagne-gold', 'Champagne Gold', 'Hangat dan mewah seperti champagne', 'luxury', ARRAY['champagne','gold','warm','luxury'], TRUE, FALSE, 9,
  '{"primaryFont":"Bodoni Moda","secondaryFont":"Didact Gothic","particles":"gold_dust","openingAnimation":"sparkle","sectionAnimation":"golden_reveal"}',
  '{"--theme-primary":"#C4922A","--theme-secondary":"#FBF4E8","--theme-bg":"#FAF0D7","--theme-text":"#2A1800","--theme-accent":"#E8B84B","--theme-dark":"#150C00"}'),
('luxury-emerald', 'Luxury Emerald', 'Kemewahan hijau zamrud yang memukau', 'luxury', ARRAY['emerald','green','luxury','jewel'], TRUE, FALSE, 10,
  '{"primaryFont":"Cormorant Garamond","secondaryFont":"Montserrat","particles":"fireflies","openingAnimation":"jewel_reveal","sectionAnimation":"emerald_fade"}',
  '{"--theme-primary":"#1A6B4A","--theme-secondary":"#EBF5EE","--theme-bg":"#F5FAF7","--theme-text":"#0A2E1A","--theme-accent":"#2ECC71","--theme-dark":"#041A0D"}');

-- ============================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.rsvp;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guestbook;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================================
-- STORAGE BUCKETS (run via Supabase dashboard or API)
-- ============================================================
-- Run these via Supabase Storage API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('themes', 'themes', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('private', 'private', false);

COMMENT ON TABLE public.profiles IS 'Extended user profiles - linked to Supabase auth.users';
COMMENT ON TABLE public.invitations IS 'Core invitation records - one per wedding event';
COMMENT ON TABLE public.guests IS 'Guest list per invitation with unique QR codes';
COMMENT ON TABLE public.rsvp IS 'RSVP responses submitted by guests';
COMMENT ON TABLE public.attendance IS 'QR attendance tracking records';
COMMENT ON TABLE public.guestbook IS 'Wedding wishes/messages from guests';
COMMENT ON TABLE public.analytics IS 'Invitation view and interaction tracking';
COMMENT ON TABLE public.whatsapp_messages IS 'WhatsApp message send log';
COMMENT ON TABLE public.payments IS 'Platform payment transactions';
