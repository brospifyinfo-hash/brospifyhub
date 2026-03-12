-- =============================================
-- UMFASSENDES ROLLEN- UND BERECHTIGUNGSSYSTEM
-- =============================================

-- 1. ROLLEN-TABELLE
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

-- 2. BERECHTIGUNGEN-TABELLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ROLLEN-BERECHTIGUNGEN VERKNÜPFUNG
-- =============================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- 4. USER-ROLLEN VERKNÜPFUNG (User kann mehrere Rollen haben)
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(user_id, role_id)
);

-- 5. CHANNEL-SPEZIFISCHE ROLLEN-BERECHTIGUNGEN
-- =============================================
CREATE TABLE IF NOT EXISTS public.channel_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT true,
  can_send_messages BOOLEAN DEFAULT false,
  can_send_images BOOLEAN DEFAULT false,
  can_send_files BOOLEAN DEFAULT false,
  can_delete_messages BOOLEAN DEFAULT false,
  can_pin_messages BOOLEAN DEFAULT false,
  can_manage_channel BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, role_id)
);

-- 6. ERWEITERTE USER-PROFILE TABELLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  website TEXT,
  location TEXT,
  social_twitter TEXT,
  social_instagram TEXT,
  social_youtube TEXT,
  social_tiktok TEXT,
  notification_email BOOLEAN DEFAULT true,
  notification_push BOOLEAN DEFAULT true,
  notification_sound BOOLEAN DEFAULT true,
  theme_preference TEXT DEFAULT 'system',
  language TEXT DEFAULT 'de',
  privacy_show_online BOOLEAN DEFAULT true,
  privacy_show_activity BOOLEAN DEFAULT true,
  privacy_allow_dms BOOLEAN DEFAULT true,
  custom_status TEXT,
  custom_status_emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. USER-TABELLE ERWEITERN (Primary Role für schnellen Zugriff)
-- =============================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS primary_role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS badge_text TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS badge_color TEXT;

-- 8. INDEXES FÜR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_channel_role_perms_channel ON public.channel_role_permissions(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_role_perms_role ON public.channel_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_roles_hierarchy ON public.roles(hierarchy_level DESC);

-- 9. RLS AKTIVIEREN
-- =============================================
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 10. RLS POLICIES - ROLES
-- =============================================
CREATE POLICY "Everyone can view roles" ON public.roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/Owners manage roles" ON public.roles
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- 11. RLS POLICIES - PERMISSIONS
-- =============================================
CREATE POLICY "Everyone can view permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only owners manage permissions" ON public.permissions
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'owner'
    )
  );

-- 12. RLS POLICIES - ROLE PERMISSIONS
-- =============================================
CREATE POLICY "Everyone can view role permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/Owners manage role permissions" ON public.role_permissions
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- 13. RLS POLICIES - USER ROLES
-- =============================================
CREATE POLICY "Everyone can view user roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/Owners assign roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins/Owners remove roles" ON public.user_roles
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- 14. RLS POLICIES - CHANNEL ROLE PERMISSIONS
-- =============================================
CREATE POLICY "Everyone can view channel role perms" ON public.channel_role_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/Owners manage channel role perms" ON public.channel_role_permissions
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- 15. RLS POLICIES - USER PROFILES
-- =============================================
CREATE POLICY "Users view own profile" ON public.user_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users view public profiles" ON public.user_profiles
  FOR SELECT TO authenticated USING (privacy_show_activity = true);

CREATE POLICY "Users update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users create own profile" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all profiles" ON public.user_profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- 16. STANDARD-ROLLEN EINFÜGEN
-- =============================================
INSERT INTO public.roles (name, display_name, description, color, icon, hierarchy_level, is_system, is_assignable) VALUES
  ('owner', 'Inhaber', 'Vollständige Kontrolle über die gesamte Plattform', '#FFD700', 'crown', 100, true, false),
  ('admin', 'Administrator', 'Volle Verwaltungsrechte', '#FF4444', 'shield', 80, true, true),
  ('moderator', 'Moderator', 'Kann Inhalte und Channels moderieren', '#9B59B6', 'shield-check', 60, true, true),
  ('support', 'Support-Team', 'Kann Support-Tickets bearbeiten', '#3498DB', 'headphones', 50, true, true),
  ('vip', 'VIP-Mitglied', 'Premium-Mitglied mit erweiterten Rechten', '#F39C12', 'star', 40, true, true),
  ('member', 'Mitglied', 'Reguläres Community-Mitglied', '#95BF47', 'user', 20, true, true),
  ('guest', 'Gast', 'Eingeschränkte Leserechte', '#808080', 'eye', 10, true, true)
ON CONFLICT (name) DO NOTHING;

-- 17. STANDARD-BERECHTIGUNGEN EINFÜGEN
-- =============================================
INSERT INTO public.permissions (name, display_name, description, category) VALUES
  -- System
  ('manage_roles', 'Rollen verwalten', 'Kann Rollen erstellen, bearbeiten und löschen', 'system'),
  ('assign_roles', 'Rollen zuweisen', 'Kann Benutzern Rollen zuweisen', 'system'),
  ('manage_users', 'Benutzer verwalten', 'Kann Benutzer bearbeiten, bannen und verwalten', 'system'),
  ('manage_licenses', 'Lizenzen verwalten', 'Kann Lizenzschlüssel verwalten', 'system'),
  ('manage_settings', 'Einstellungen verwalten', 'Kann App-Einstellungen ändern', 'system'),
  ('view_analytics', 'Statistiken ansehen', 'Kann Dashboard-Statistiken sehen', 'system'),
  ('manage_emojis', 'Emojis verwalten', 'Kann Custom-Emojis hochladen und löschen', 'system'),
  ('manage_scheduled_posts', 'Geplante Posts verwalten', 'Kann Posts planen und verwalten', 'system'),
  
  -- Channels
  ('create_channels', 'Channels erstellen', 'Kann neue Channels erstellen', 'channels'),
  ('edit_channels', 'Channels bearbeiten', 'Kann Channel-Einstellungen ändern', 'channels'),
  ('delete_channels', 'Channels löschen', 'Kann Channels löschen', 'channels'),
  ('manage_categories', 'Kategorien verwalten', 'Kann Channel-Kategorien verwalten', 'channels'),
  
  -- Messages
  ('send_messages', 'Nachrichten senden', 'Kann Nachrichten in Channels senden', 'messages'),
  ('send_images', 'Bilder senden', 'Kann Bilder in Channels hochladen', 'messages'),
  ('send_files', 'Dateien senden', 'Kann Dateien in Channels hochladen', 'messages'),
  ('delete_any_message', 'Nachrichten löschen', 'Kann beliebige Nachrichten löschen', 'messages'),
  ('pin_messages', 'Nachrichten anpinnen', 'Kann Nachrichten anpinnen', 'messages'),
  ('edit_any_message', 'Nachrichten bearbeiten', 'Kann beliebige Nachrichten bearbeiten', 'messages'),
  
  -- Support
  ('view_all_tickets', 'Alle Tickets sehen', 'Kann alle Support-Tickets einsehen', 'support'),
  ('respond_tickets', 'Tickets beantworten', 'Kann auf Support-Tickets antworten', 'support'),
  ('close_tickets', 'Tickets schließen', 'Kann Tickets schließen', 'support'),
  ('assign_tickets', 'Tickets zuweisen', 'Kann Tickets anderen zuweisen', 'support'),
  
  -- Moderation
  ('mute_users', 'Benutzer stummschalten', 'Kann Benutzer temporär stummschalten', 'moderation'),
  ('ban_users', 'Benutzer sperren', 'Kann Benutzer permanent sperren', 'moderation'),
  ('view_audit_log', 'Audit-Log sehen', 'Kann das Aktivitätsprotokoll einsehen', 'moderation'),
  
  -- Content
  ('approve_content', 'Inhalte freigeben', 'Kann eingereichte Inhalte freigeben', 'content'),
  ('manage_winning_product', 'Winning Product verwalten', 'Kann das Winning Product bearbeiten', 'content')
ON CONFLICT (name) DO NOTHING;

-- 18. STANDARD ROLLEN-BERECHTIGUNGEN ZUWEISEN
-- =============================================

-- Owner bekommt ALLE Berechtigungen
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'owner'
ON CONFLICT DO NOTHING;

-- Admin bekommt fast alle Berechtigungen (außer manage_roles, manage_settings)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'admin' AND p.name NOT IN ('manage_roles')
ON CONFLICT DO NOTHING;

-- Moderator Berechtigungen
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'moderator' AND p.name IN (
  'delete_any_message', 'pin_messages', 'mute_users', 'approve_content',
  'send_messages', 'send_images', 'send_files', 'view_analytics'
)
ON CONFLICT DO NOTHING;

-- Support-Team Berechtigungen
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'support' AND p.name IN (
  'view_all_tickets', 'respond_tickets', 'close_tickets', 'assign_tickets',
  'send_messages', 'send_images', 'send_files'
)
ON CONFLICT DO NOTHING;

-- VIP Berechtigungen
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'vip' AND p.name IN (
  'send_messages', 'send_images', 'send_files'
)
ON CONFLICT DO NOTHING;

-- Member Berechtigungen
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'member' AND p.name IN ('send_messages')
ON CONFLICT DO NOTHING;

-- Guest hat keine speziellen Berechtigungen (nur lesen)

-- 19. HELPER FUNCTION: Check if user has permission
-- =============================================
CREATE OR REPLACE FUNCTION public.user_has_permission(user_uuid UUID, permission_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = user_uuid 
      AND p.name = permission_name
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 20. HELPER FUNCTION: Get user's highest role
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_highest_role(user_uuid UUID)
RETURNS TABLE(role_name TEXT, hierarchy_level INTEGER, color TEXT, icon TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT r.name, r.hierarchy_level, r.color, r.icon
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  ORDER BY r.hierarchy_level DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 21. HELPER FUNCTION: Get all user permissions
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_uuid UUID)
RETURNS TABLE(permission_name TEXT, category TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.name, p.category
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON ur.role_id = rp.role_id
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = user_uuid
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 22. HELPER FUNCTION: Check channel permission for user
-- =============================================
CREATE OR REPLACE FUNCTION public.user_can_in_channel(user_uuid UUID, channel_uuid UUID, permission_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN := false;
BEGIN
  -- Check if user has any role with this permission in this channel
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.channel_role_permissions crp ON ur.role_id = crp.role_id
    WHERE ur.user_id = user_uuid 
      AND crp.channel_id = channel_uuid
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND (
        (permission_type = 'view' AND crp.can_view = true) OR
        (permission_type = 'send_messages' AND crp.can_send_messages = true) OR
        (permission_type = 'send_images' AND crp.can_send_images = true) OR
        (permission_type = 'send_files' AND crp.can_send_files = true) OR
        (permission_type = 'delete_messages' AND crp.can_delete_messages = true) OR
        (permission_type = 'pin_messages' AND crp.can_pin_messages = true) OR
        (permission_type = 'manage_channel' AND crp.can_manage_channel = true)
      )
  ) INTO has_permission;
  
  -- If no channel-specific permission, check global permissions
  IF NOT has_permission THEN
    IF permission_type = 'view' THEN
      has_permission := true; -- Everyone can view by default
    ELSIF permission_type IN ('send_messages', 'send_images', 'send_files') THEN
      has_permission := public.user_has_permission(user_uuid, permission_type);
    ELSIF permission_type = 'delete_messages' THEN
      has_permission := public.user_has_permission(user_uuid, 'delete_any_message');
    ELSIF permission_type = 'manage_channel' THEN
      has_permission := public.user_has_permission(user_uuid, 'edit_channels');
    END IF;
  END IF;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 23. TRIGGER: Auto-create user profile on user creation
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_profile ON public.users;
CREATE TRIGGER on_user_created_profile
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- 24. TRIGGER: Auto-assign member role to new users
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
DECLARE
  member_role_id UUID;
BEGIN
  SELECT id INTO member_role_id FROM public.roles WHERE name = 'member';
  IF member_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, member_role_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_role ON public.users;
CREATE TRIGGER on_user_created_role
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 25. Update existing users - add member role and create profiles
-- =============================================
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id 
FROM public.users u, public.roles r 
WHERE r.name = 'member'
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_profiles (user_id)
SELECT id FROM public.users
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.user_id = users.id)
ON CONFLICT DO NOTHING;

-- 26. Give owner role to existing admins
-- =============================================
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id 
FROM public.users u, public.roles r 
WHERE u.role = 'admin' AND r.name = 'owner'
ON CONFLICT DO NOTHING;

-- 27. Enable Realtime for new tables
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
