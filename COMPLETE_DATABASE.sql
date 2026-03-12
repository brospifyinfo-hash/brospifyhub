-- =============================================
-- BROSPIFY HUB - KOMPLETTE DATENBANK
-- =============================================
-- DIESE DATEI ENTHÄLT ALLES!
-- Kopiere den GESAMTEN Inhalt in Supabase SQL Editor
-- =============================================

-- =============================================
-- TEIL 1: CHANNELS ERWEITERN
-- =============================================
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS allow_user_text BOOLEAN DEFAULT false;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS allow_user_images BOOLEAN DEFAULT false;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS allow_user_files BOOLEAN DEFAULT false;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS show_download_button BOOLEAN DEFAULT true;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS show_copy_button BOOLEAN DEFAULT true;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.channels(id);

-- =============================================
-- TEIL 2: MESSAGES ERWEITERN
-- =============================================
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS cta_button_text TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS cta_button_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_bg_color TEXT;

-- =============================================
-- TEIL 3: USERS ERWEITERN
-- =============================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS primary_role_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS online_status TEXT DEFAULT 'offline';

-- =============================================
-- TEIL 4: INTERNAL KEYS
-- =============================================
CREATE TABLE IF NOT EXISTS public.internal_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_value TEXT NOT NULL UNIQUE,
  is_assigned BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  assigned_to UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.internal_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =============================================
-- TEIL 5: APP SETTINGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value) VALUES 
  ('fake_member_bonus', '0'),
  ('app_name', 'Brospify Hub')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- TEIL 6: CHANNEL CATEGORIES
-- =============================================
CREATE TABLE IF NOT EXISTS public.channel_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  is_collapsed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TEIL 7: CUSTOM EMOJIS
-- =============================================
CREATE TABLE IF NOT EXISTS public.custom_emojis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  image_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TEIL 8: USER PURCHASES
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id TEXT,
  purchase_type TEXT DEFAULT 'initial',
  amount_paid DECIMAL(10,2),
  shopify_order_id TEXT,
  purchased_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS variant_id UUID;
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS price_tier_id UUID;
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS credits_used INTEGER DEFAULT 0;
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- =============================================
-- TEIL 9: USER FAVORITES
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

-- =============================================
-- TEIL 10: TICKETS SYSTEM
-- =============================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TEIL 11: USER DEVICES
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  ip_address TEXT,
  city TEXT,
  country TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_fingerprint)
);

-- =============================================
-- TEIL 12: ROLLEN SYSTEM (VEREINFACHT)
-- =============================================
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#808080',
  icon TEXT DEFAULT 'user',
  hierarchy_level INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  is_assignable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spalten hinzufügen falls sie nicht existieren
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_send_messages BOOLEAN DEFAULT true;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_send_images BOOLEAN DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_send_files BOOLEAN DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_create_channels BOOLEAN DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_moderate BOOLEAN DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_manage_users BOOLEAN DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_access_admin BOOLEAN DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS max_file_size_mb INTEGER DEFAULT 10;

-- Standard Rollen einfügen
INSERT INTO public.roles (name, display_name, description, color, icon, hierarchy_level, is_system, is_assignable, can_send_messages, can_send_images, can_send_files, can_create_channels, can_moderate, can_manage_users, can_access_admin) VALUES
  ('owner', 'Inhaber', 'Vollständige Kontrolle über alles', '#FFD700', 'crown', 100, true, false, true, true, true, true, true, true, true),
  ('admin', 'Administrator', 'Volle Verwaltungsrechte', '#FF4444', 'shield', 80, true, true, true, true, true, true, true, true, true),
  ('moderator', 'Moderator', 'Kann Inhalte moderieren', '#9B59B6', 'shield-check', 60, true, true, true, true, true, false, true, false, true),
  ('support', 'Support-Team', 'Kann Support-Tickets bearbeiten', '#3498DB', 'headphones', 50, true, true, true, true, true, false, false, false, true),
  ('vip', 'VIP-Mitglied', 'Premium-Mitglied mit Extras', '#F39C12', 'star', 40, true, true, true, true, false, false, false, false, false),
  ('member', 'Mitglied', 'Reguläres Mitglied', '#95BF47', 'user', 20, true, true, true, false, false, false, false, false, false),
  ('guest', 'Gast', 'Nur Lesen erlaubt', '#808080', 'eye', 10, true, true, false, false, false, false, false, false, false)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  hierarchy_level = EXCLUDED.hierarchy_level,
  can_send_messages = EXCLUDED.can_send_messages,
  can_send_images = EXCLUDED.can_send_images,
  can_send_files = EXCLUDED.can_send_files,
  can_create_channels = EXCLUDED.can_create_channels,
  can_moderate = EXCLUDED.can_moderate,
  can_manage_users = EXCLUDED.can_manage_users,
  can_access_admin = EXCLUDED.can_access_admin;

-- User-Rollen Verknüpfung
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, role_id)
);

-- Channel-Rollen-Überschreibungen (für spezielle Channel-Regeln)
CREATE TABLE IF NOT EXISTS public.channel_role_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT true,
  can_send_messages BOOLEAN,
  can_send_images BOOLEAN,
  can_send_files BOOLEAN,
  UNIQUE(channel_id, role_id)
);

-- =============================================
-- TEIL 13: USER PROFILES
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  about_me TEXT,
  website TEXT,
  location TEXT,
  birthday DATE,
  gender TEXT,
  pronouns TEXT,
  timezone TEXT DEFAULT 'Europe/Berlin',
  social_twitter TEXT,
  social_instagram TEXT,
  social_youtube TEXT,
  social_tiktok TEXT,
  social_discord TEXT,
  social_linkedin TEXT,
  social_github TEXT,
  notification_email BOOLEAN DEFAULT true,
  notification_push BOOLEAN DEFAULT true,
  notification_sound BOOLEAN DEFAULT true,
  notification_mentions BOOLEAN DEFAULT true,
  theme_preference TEXT DEFAULT 'system',
  language TEXT DEFAULT 'de',
  privacy_show_online BOOLEAN DEFAULT true,
  privacy_show_activity BOOLEAN DEFAULT true,
  privacy_allow_dms BOOLEAN DEFAULT true,
  privacy_profile_visibility TEXT DEFAULT 'public',
  show_birthday BOOLEAN DEFAULT false,
  show_location BOOLEAN DEFAULT true,
  accent_color TEXT DEFAULT '#95BF47',
  custom_status TEXT,
  custom_status_emoji TEXT,
  interests TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TEIL 14: PRODUKT SYSTEM
-- =============================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  image_url TEXT,
  badge_text TEXT,
  badge_color TEXT DEFAULT '#95BF47',
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  show_in_menu BOOLEAN DEFAULT true,
  show_variant_selector BOOLEAN DEFAULT true,
  show_price_comparison BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'package',
  color TEXT DEFAULT '#95BF47',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_price_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL,
  tier_order INTEGER NOT NULL DEFAULT 0,
  price_amount DECIMAL(10,2) NOT NULL,
  price_currency TEXT DEFAULT 'EUR',
  compare_price DECIMAL(10,2),
  credits_price INTEGER,
  allow_credits BOOLEAN DEFAULT false,
  button_text TEXT NOT NULL DEFAULT 'Jetzt kaufen',
  button_color TEXT DEFAULT '#95BF47',
  requires_previous_tier BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.variant_price_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  price_tier_id UUID NOT NULL REFERENCES public.product_price_tiers(id) ON DELETE CASCADE,
  checkout_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(variant_id, price_tier_id)
);

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'credit-card',
  color TEXT DEFAULT '#95BF47',
  method_type TEXT NOT NULL DEFAULT 'external_link',
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.payment_methods (name, display_name, description, icon, color, method_type, order_index) VALUES
  ('external_link', 'Externer Link', 'Weiterleitung zu externem Checkout', 'external-link', '#95BF47', 'external_link', 1),
  ('credits', 'Credits', 'Mit Hub-Credits bezahlen', 'coins', '#FFD700', 'credits', 2)
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- TEIL 15: STATS & GAMIFICATION
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  total_messages INTEGER DEFAULT 0,
  total_reactions_given INTEGER DEFAULT 0,
  total_reactions_received INTEGER DEFAULT 0,
  total_files_uploaded INTEGER DEFAULT 0,
  total_login_days INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  level INTEGER DEFAULT 1,
  experience_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'award',
  color TEXT DEFAULT '#95BF47',
  category TEXT DEFAULT 'general',
  points INTEGER DEFAULT 10,
  is_secret BOOLEAN DEFAULT false,
  requirements JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

INSERT INTO public.achievements (name, display_name, description, icon, color, category, points, requirements) VALUES
  ('first_message', 'Erste Nachricht', 'Hat die erste Nachricht geschrieben', 'message-circle', '#95BF47', 'community', 10, '{"messages": 1}'),
  ('message_10', 'Aktives Mitglied', 'Hat 10 Nachrichten geschrieben', 'messages-square', '#3498DB', 'community', 25, '{"messages": 10}'),
  ('message_100', 'Stammgast', 'Hat 100 Nachrichten geschrieben', 'message-square-text', '#9B59B6', 'community', 50, '{"messages": 100}'),
  ('message_1000', 'Legende', 'Hat 1000 Nachrichten geschrieben', 'crown', '#FFD700', 'community', 200, '{"messages": 1000}'),
  ('streak_7', 'Woche dabei', '7 Tage am Stück aktiv', 'flame', '#FF6B35', 'engagement', 30, '{"streak": 7}'),
  ('streak_30', 'Monat dabei', '30 Tage am Stück aktiv', 'zap', '#F39C12', 'engagement', 100, '{"streak": 30}'),
  ('streak_100', 'Unaufhaltsam', '100 Tage am Stück aktiv', 'rocket', '#E74C3C', 'engagement', 500, '{"streak": 100}'),
  ('first_purchase', 'Supporter', 'Erster Kauf getätigt', 'shopping-bag', '#95BF47', 'premium', 50, '{"purchases": 1}')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- TEIL 16: MESSAGE REACTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- =============================================
-- TEIL 17: ACTIVITY LOG
-- =============================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_category TEXT NOT NULL DEFAULT 'general',
  target_type TEXT,
  target_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TEIL 18: USER NOTES & WARNINGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'info',
  is_important BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  issued_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  warning_type TEXT NOT NULL DEFAULT 'warning',
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TEIL 19: SCHEDULED POSTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachment_url TEXT,
  attachment_type TEXT,
  cta_button_text TEXT,
  cta_button_url TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TEIL 20: INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_channel_role_overrides_channel ON public.channel_role_overrides(channel_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_price_tiers_product ON public.product_price_tiers(product_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_user ON public.user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_user ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON public.user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled ON public.scheduled_posts(scheduled_for) WHERE is_published = false;

-- =============================================
-- TEIL 21: RLS AKTIVIEREN
-- =============================================
ALTER TABLE public.internal_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_emojis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_role_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_price_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TEIL 22: RLS POLICIES
-- =============================================

-- Internal Keys
DROP POLICY IF EXISTS "Admins manage keys" ON public.internal_keys;
CREATE POLICY "Admins manage keys" ON public.internal_keys FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- App Settings
DROP POLICY IF EXISTS "Anyone reads settings" ON public.app_settings;
CREATE POLICY "Anyone reads settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage settings" ON public.app_settings;
CREATE POLICY "Admins manage settings" ON public.app_settings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Channel Categories
DROP POLICY IF EXISTS "Anyone views categories" ON public.channel_categories;
CREATE POLICY "Anyone views categories" ON public.channel_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage categories" ON public.channel_categories;
CREATE POLICY "Admins manage categories" ON public.channel_categories FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Custom Emojis
DROP POLICY IF EXISTS "Anyone views emojis" ON public.custom_emojis;
CREATE POLICY "Anyone views emojis" ON public.custom_emojis FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage emojis" ON public.custom_emojis;
CREATE POLICY "Admins manage emojis" ON public.custom_emojis FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- User Purchases
DROP POLICY IF EXISTS "Users view own purchases" ON public.user_purchases;
CREATE POLICY "Users view own purchases" ON public.user_purchases FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins view all purchases" ON public.user_purchases;
CREATE POLICY "Admins view all purchases" ON public.user_purchases FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "System inserts purchases" ON public.user_purchases;
CREATE POLICY "System inserts purchases" ON public.user_purchases FOR INSERT TO authenticated WITH CHECK (true);

-- User Favorites
DROP POLICY IF EXISTS "Users manage own favorites" ON public.user_favorites;
CREATE POLICY "Users manage own favorites" ON public.user_favorites FOR ALL TO authenticated 
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Tickets
DROP POLICY IF EXISTS "Users view own tickets" ON public.tickets;
CREATE POLICY "Users view own tickets" ON public.tickets FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins view all tickets" ON public.tickets;
CREATE POLICY "Admins view all tickets" ON public.tickets FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Users create tickets" ON public.tickets;
CREATE POLICY "Users create tickets" ON public.tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins manage tickets" ON public.tickets;
CREATE POLICY "Admins manage tickets" ON public.tickets FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Ticket Messages
DROP POLICY IF EXISTS "Users view ticket messages" ON public.ticket_messages;
CREATE POLICY "Users view ticket messages" ON public.ticket_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tickets WHERE id = ticket_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Users send ticket messages" ON public.ticket_messages;
CREATE POLICY "Users send ticket messages" ON public.ticket_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

-- User Devices
DROP POLICY IF EXISTS "Users view own devices" ON public.user_devices;
CREATE POLICY "Users view own devices" ON public.user_devices FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins manage devices" ON public.user_devices;
CREATE POLICY "Admins manage devices" ON public.user_devices FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "System manages devices" ON public.user_devices;
CREATE POLICY "System manages devices" ON public.user_devices FOR ALL TO authenticated 
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Roles
DROP POLICY IF EXISTS "Everyone views roles" ON public.roles;
CREATE POLICY "Everyone views roles" ON public.roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage roles" ON public.roles;
CREATE POLICY "Admins manage roles" ON public.roles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- User Roles
DROP POLICY IF EXISTS "Everyone views user roles" ON public.user_roles;
CREATE POLICY "Everyone views user roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage user roles" ON public.user_roles;
CREATE POLICY "Admins manage user roles" ON public.user_roles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Channel Role Overrides
DROP POLICY IF EXISTS "Everyone views overrides" ON public.channel_role_overrides;
CREATE POLICY "Everyone views overrides" ON public.channel_role_overrides FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage overrides" ON public.channel_role_overrides;
CREATE POLICY "Admins manage overrides" ON public.channel_role_overrides FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- User Profiles
DROP POLICY IF EXISTS "Everyone views profiles" ON public.user_profiles;
CREATE POLICY "Everyone views profiles" ON public.user_profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users manage own profile" ON public.user_profiles;
CREATE POLICY "Users manage own profile" ON public.user_profiles FOR ALL TO authenticated 
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins manage profiles" ON public.user_profiles;
CREATE POLICY "Admins manage profiles" ON public.user_profiles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Products
DROP POLICY IF EXISTS "Everyone views products" ON public.products;
CREATE POLICY "Everyone views products" ON public.products FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products" ON public.products FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Product Variants
DROP POLICY IF EXISTS "Everyone views variants" ON public.product_variants;
CREATE POLICY "Everyone views variants" ON public.product_variants FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage variants" ON public.product_variants;
CREATE POLICY "Admins manage variants" ON public.product_variants FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Price Tiers
DROP POLICY IF EXISTS "Everyone views tiers" ON public.product_price_tiers;
CREATE POLICY "Everyone views tiers" ON public.product_price_tiers FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage tiers" ON public.product_price_tiers;
CREATE POLICY "Admins manage tiers" ON public.product_price_tiers FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Variant Links
DROP POLICY IF EXISTS "Everyone views links" ON public.variant_price_links;
CREATE POLICY "Everyone views links" ON public.variant_price_links FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage links" ON public.variant_price_links;
CREATE POLICY "Admins manage links" ON public.variant_price_links FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Payment Methods
DROP POLICY IF EXISTS "Everyone views methods" ON public.payment_methods;
CREATE POLICY "Everyone views methods" ON public.payment_methods FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage methods" ON public.payment_methods;
CREATE POLICY "Admins manage methods" ON public.payment_methods FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- User Stats
DROP POLICY IF EXISTS "Everyone views stats" ON public.user_stats;
CREATE POLICY "Everyone views stats" ON public.user_stats FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "System manages stats" ON public.user_stats;
CREATE POLICY "System manages stats" ON public.user_stats FOR ALL TO authenticated USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Achievements
DROP POLICY IF EXISTS "Everyone views achievements" ON public.achievements;
CREATE POLICY "Everyone views achievements" ON public.achievements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage achievements" ON public.achievements;
CREATE POLICY "Admins manage achievements" ON public.achievements FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- User Achievements
DROP POLICY IF EXISTS "Everyone views user achievements" ON public.user_achievements;
CREATE POLICY "Everyone views user achievements" ON public.user_achievements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "System grants achievements" ON public.user_achievements;
CREATE POLICY "System grants achievements" ON public.user_achievements FOR INSERT TO authenticated WITH CHECK (true);

-- Message Reactions
DROP POLICY IF EXISTS "Everyone views reactions" ON public.message_reactions;
CREATE POLICY "Everyone views reactions" ON public.message_reactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users manage own reactions" ON public.message_reactions;
CREATE POLICY "Users manage own reactions" ON public.message_reactions FOR ALL TO authenticated 
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Activity Log
DROP POLICY IF EXISTS "Users view own activity" ON public.activity_log;
CREATE POLICY "Users view own activity" ON public.activity_log FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "System inserts activity" ON public.activity_log;
CREATE POLICY "System inserts activity" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- User Notes
DROP POLICY IF EXISTS "Admins manage notes" ON public.user_notes;
CREATE POLICY "Admins manage notes" ON public.user_notes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- User Warnings
DROP POLICY IF EXISTS "Users view own warnings" ON public.user_warnings;
CREATE POLICY "Users view own warnings" ON public.user_warnings FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins manage warnings" ON public.user_warnings;
CREATE POLICY "Admins manage warnings" ON public.user_warnings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Scheduled Posts
DROP POLICY IF EXISTS "Admins manage scheduled posts" ON public.scheduled_posts;
CREATE POLICY "Admins manage scheduled posts" ON public.scheduled_posts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- =============================================
-- TEIL 23: HELPER FUNCTIONS
-- =============================================

-- Prüft ob User eine bestimmte Berechtigung in einem Channel hat
CREATE OR REPLACE FUNCTION public.user_can_in_channel(
  p_user_id UUID,
  p_channel_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_role TEXT;
  v_role RECORD;
  v_override RECORD;
  v_result BOOLEAN;
BEGIN
  SELECT role INTO v_user_role FROM public.users WHERE id = p_user_id;
  IF v_user_role = 'admin' THEN RETURN true; END IF;

  SELECT r.* INTO v_role
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  ORDER BY r.hierarchy_level DESC
  LIMIT 1;

  IF v_role IS NULL THEN
    SELECT * INTO v_role FROM public.roles WHERE name = 'member';
  END IF;

  SELECT * INTO v_override
  FROM public.channel_role_overrides
  WHERE channel_id = p_channel_id AND role_id = v_role.id;

  CASE p_permission
    WHEN 'send_messages' THEN
      v_result := COALESCE(v_override.can_send_messages, v_role.can_send_messages);
    WHEN 'send_images' THEN
      v_result := COALESCE(v_override.can_send_images, v_role.can_send_images);
    WHEN 'send_files' THEN
      v_result := COALESCE(v_override.can_send_files, v_role.can_send_files);
    ELSE
      v_result := false;
  END CASE;

  RETURN COALESCE(v_result, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Credits-Kauf Funktion
CREATE OR REPLACE FUNCTION public.purchase_with_credits(
  p_user_id UUID,
  p_product_id UUID,
  p_variant_id UUID,
  p_price_tier_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_credits_price INTEGER;
  v_user_credits INTEGER;
  v_purchase_id UUID;
BEGIN
  SELECT credits_price INTO v_credits_price
  FROM public.product_price_tiers
  WHERE id = p_price_tier_id AND allow_credits = true;

  IF v_credits_price IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credits nicht erlaubt');
  END IF;

  SELECT credits INTO v_user_credits FROM public.users WHERE id = p_user_id;

  IF v_user_credits < v_credits_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nicht genügend Credits');
  END IF;

  UPDATE public.users SET credits = credits - v_credits_price WHERE id = p_user_id;

  INSERT INTO public.user_purchases (user_id, product_id, variant_id, price_tier_id, payment_method, credits_used, status)
  VALUES (p_user_id, p_product_id, p_variant_id, p_price_tier_id, 'credits', v_credits_price, 'completed')
  RETURNING id INTO v_purchase_id;

  RETURN jsonb_build_object('success', true, 'purchase_id', v_purchase_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TEIL 24: TRIGGERS
-- =============================================

-- Auto-Setup für neue User
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_profiles (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT NEW.id, id FROM public.roles WHERE name = 'member'
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_setup ON public.users;
CREATE TRIGGER on_user_created_setup
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_setup();

-- =============================================
-- TEIL 25: INIT DATA FÜR EXISTIERENDE USER
-- =============================================

-- Stats für existierende User
INSERT INTO public.user_stats (user_id)
SELECT id FROM public.users
WHERE NOT EXISTS (SELECT 1 FROM public.user_stats WHERE user_stats.user_id = users.id)
ON CONFLICT DO NOTHING;

-- Profiles für existierende User
INSERT INTO public.user_profiles (user_id)
SELECT id FROM public.users
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.user_id = users.id)
ON CONFLICT DO NOTHING;

-- Member-Rolle für User ohne Rollen
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM public.users u
CROSS JOIN public.roles r
WHERE r.name = 'member'
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
ON CONFLICT DO NOTHING;

-- Admin + Owner Rolle für Admin-User
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM public.users u
CROSS JOIN public.roles r
WHERE u.role = 'admin' AND r.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM public.users u
CROSS JOIN public.roles r
WHERE u.role = 'admin' AND r.name = 'owner'
ON CONFLICT DO NOTHING;

-- =============================================
-- TEIL 26: REALTIME AKTIVIEREN
-- =============================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.products; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_stats; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_achievements; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- FERTIG! 
-- =============================================
