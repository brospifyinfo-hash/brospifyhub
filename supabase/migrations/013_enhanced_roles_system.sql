-- =============================================
-- ERWEITERTES ROLLEN- UND BERECHTIGUNGSSYSTEM V2
-- =============================================
-- Dieses Update erweitert das bestehende System mit:
-- - Activity Logging / Audit Trail
-- - Erweiterte Profil-Features (Achievements, Badges, Stats)
-- - Benutzer-Notizen für Admins
-- - Temporäre Mutes/Bans
-- - Online-Status Tracking
-- - Erweiterte Channel-Statistiken

-- =============================================
-- 1. USER ACTIVITY LOG (Audit Trail)
-- =============================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_category TEXT NOT NULL DEFAULT 'general',
  target_type TEXT,
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON public.activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_category ON public.activity_log(action_category);

-- =============================================
-- 2. USER ACHIEVEMENTS / BADGES
-- =============================================
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

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);

-- =============================================
-- 3. USER STATS (für Gamification)
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

CREATE INDEX IF NOT EXISTS idx_user_stats_user ON public.user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_level ON public.user_stats(level DESC);

-- =============================================
-- 4. ADMIN USER NOTES (Private Notizen über User)
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'info',
  is_important BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notes_user ON public.user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_author ON public.user_notes(author_id);

-- =============================================
-- 5. USER WARNINGS / MODERATION ACTIONS
-- =============================================
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

CREATE INDEX IF NOT EXISTS idx_user_warnings_user ON public.user_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_warnings_active ON public.user_warnings(is_active) WHERE is_active = true;

-- =============================================
-- 6. ERWEITERTE USERS TABELLE
-- =============================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_warnings INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES public.users(id);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS online_status TEXT DEFAULT 'offline';

-- =============================================
-- 7. ERWEITERTE USER_PROFILES TABELLE
-- =============================================
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS pronouns TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Berlin';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS social_discord TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS social_linkedin TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS social_github TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS social_website TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS about_me TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS interests TEXT[];
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS skills TEXT[];
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS show_birthday BOOLEAN DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS show_location BOOLEAN DEFAULT true;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS privacy_profile_visibility TEXT DEFAULT 'public';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS notification_mentions BOOLEAN DEFAULT true;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS notification_replies BOOLEAN DEFAULT true;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS notification_new_content BOOLEAN DEFAULT true;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#95BF47';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS profile_effect TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS featured_achievement_id UUID REFERENCES public.achievements(id);

-- =============================================
-- 8. ROLES TABELLE ERWEITERN
-- =============================================
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS permissions_summary TEXT;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS max_file_size_mb INTEGER DEFAULT 10;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS daily_message_limit INTEGER;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_use_custom_emojis BOOLEAN DEFAULT true;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_mention_everyone BOOLEAN DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS priority_support BOOLEAN DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS custom_badge_text TEXT;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS custom_badge_color TEXT;

-- =============================================
-- 9. ONLINE STATUS TRACKING
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'offline',
  custom_status TEXT,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  current_channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  is_typing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_presence_status ON public.user_presence(status);
CREATE INDEX IF NOT EXISTS idx_user_presence_heartbeat ON public.user_presence(last_heartbeat);

-- =============================================
-- 10. CHANNEL STATISTICS
-- =============================================
CREATE TABLE IF NOT EXISTS public.channel_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL UNIQUE REFERENCES public.channels(id) ON DELETE CASCADE,
  total_messages INTEGER DEFAULT 0,
  total_members INTEGER DEFAULT 0,
  active_today INTEGER DEFAULT 0,
  active_week INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  peak_concurrent_users INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_stats_channel ON public.channel_stats(channel_id);

-- =============================================
-- 11. ZUSÄTZLICHE PERMISSIONS EINFÜGEN
-- =============================================
INSERT INTO public.permissions (name, display_name, description, category) VALUES
  -- Erweiterte System-Permissions
  ('manage_achievements', 'Achievements verwalten', 'Kann Achievements erstellen und vergeben', 'system'),
  ('view_activity_log', 'Aktivitätslog ansehen', 'Kann das System-Aktivitätslog einsehen', 'system'),
  ('manage_user_notes', 'Benutzernotizen verwalten', 'Kann private Notizen über Benutzer erstellen', 'system'),
  ('impersonate_users', 'Als Benutzer ausgeben', 'Kann sich als anderer Benutzer einloggen (Ghost Mode)', 'system'),
  ('bypass_rate_limits', 'Rate-Limits umgehen', 'Ist von Rate-Limits ausgenommen', 'system'),
  ('export_data', 'Daten exportieren', 'Kann Benutzerdaten und Statistiken exportieren', 'system'),
  
  -- Erweiterte Moderation
  ('issue_warnings', 'Verwarnungen aussprechen', 'Kann Benutzern Verwarnungen erteilen', 'moderation'),
  ('revoke_warnings', 'Verwarnungen zurücknehmen', 'Kann Verwarnungen entfernen', 'moderation'),
  ('temporary_mute', 'Temporär stummschalten', 'Kann Benutzer zeitweise stummschalten', 'moderation'),
  ('view_user_history', 'Benutzerhistorie einsehen', 'Kann die komplette Historie eines Benutzers sehen', 'moderation'),
  
  -- Content Management
  ('feature_content', 'Inhalte hervorheben', 'Kann Inhalte als Featured markieren', 'content'),
  ('manage_announcements', 'Ankündigungen verwalten', 'Kann systemweite Ankündigungen erstellen', 'content'),
  
  -- Support Erweiterungen
  ('priority_ticket_access', 'Prioritäts-Tickets', 'Hat Zugang zu Prioritäts-Support', 'support'),
  ('view_ticket_history', 'Ticket-Historie einsehen', 'Kann gesamte Ticket-Historie sehen', 'support')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 12. ERWEITERTE ROLE-PERMISSION ZUWEISUNGEN
-- =============================================

-- Owner bekommt alle neuen Permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'owner' AND p.name IN (
  'manage_achievements', 'view_activity_log', 'manage_user_notes', 
  'impersonate_users', 'bypass_rate_limits', 'export_data',
  'issue_warnings', 'revoke_warnings', 'temporary_mute', 'view_user_history',
  'feature_content', 'manage_announcements', 'priority_ticket_access', 'view_ticket_history'
)
ON CONFLICT DO NOTHING;

-- Admin bekommt die meisten neuen Permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'admin' AND p.name IN (
  'manage_achievements', 'view_activity_log', 'manage_user_notes',
  'bypass_rate_limits', 'export_data',
  'issue_warnings', 'revoke_warnings', 'temporary_mute', 'view_user_history',
  'feature_content', 'manage_announcements', 'view_ticket_history'
)
ON CONFLICT DO NOTHING;

-- Moderator Permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'moderator' AND p.name IN (
  'view_activity_log', 'issue_warnings', 'temporary_mute', 
  'view_user_history', 'feature_content'
)
ON CONFLICT DO NOTHING;

-- Support Team
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'support' AND p.name IN ('view_ticket_history')
ON CONFLICT DO NOTHING;

-- VIP bekommt Priority Support
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'vip' AND p.name IN ('priority_ticket_access')
ON CONFLICT DO NOTHING;

-- =============================================
-- 13. STANDARD ACHIEVEMENTS ERSTELLEN
-- =============================================
INSERT INTO public.achievements (name, display_name, description, icon, color, category, points, is_secret, requirements) VALUES
  ('first_message', 'Erste Nachricht', 'Hat die erste Nachricht geschrieben', 'message-circle', '#95BF47', 'community', 10, false, '{"messages": 1}'),
  ('message_10', 'Aktives Mitglied', 'Hat 10 Nachrichten geschrieben', 'messages-square', '#3498DB', 'community', 25, false, '{"messages": 10}'),
  ('message_100', 'Stammgast', 'Hat 100 Nachrichten geschrieben', 'message-square-text', '#9B59B6', 'community', 50, false, '{"messages": 100}'),
  ('message_1000', 'Legende', 'Hat 1000 Nachrichten geschrieben', 'crown', '#FFD700', 'community', 200, false, '{"messages": 1000}'),
  ('streak_7', 'Woche dabei', '7 Tage am Stück aktiv', 'flame', '#FF6B35', 'engagement', 30, false, '{"streak": 7}'),
  ('streak_30', 'Monat dabei', '30 Tage am Stück aktiv', 'zap', '#F39C12', 'engagement', 100, false, '{"streak": 30}'),
  ('streak_100', 'Unaufhaltsam', '100 Tage am Stück aktiv', 'rocket', '#E74C3C', 'engagement', 500, true, '{"streak": 100}'),
  ('first_purchase', 'Supporter', 'Erster Kauf getätigt', 'shopping-bag', '#95BF47', 'premium', 50, false, '{"purchases": 1}'),
  ('vip_member', 'VIP Status', 'VIP-Mitgliedschaft erreicht', 'star', '#FFD700', 'premium', 100, false, '{"role": "vip"}'),
  ('helpful', 'Hilfreich', 'Wurde als hilfreich markiert', 'heart', '#E91E63', 'community', 25, false, '{"helpful_count": 5}'),
  ('early_adopter', 'Early Adopter', 'War von Anfang an dabei', 'award', '#8E44AD', 'special', 100, true, '{"join_date_before": "2026-06-01"}'),
  ('verified', 'Verifiziert', 'Account wurde verifiziert', 'badge-check', '#2196F3', 'special', 50, false, '{"verified": true}')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 14. RLS POLICIES FÜR NEUE TABELLEN
-- =============================================

-- Activity Log
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own activity" ON public.activity_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins view all activity" ON public.activity_log
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin', 'moderator')
    )
  );

CREATE POLICY "System can insert activity" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- Achievements
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view achievements" ON public.achievements
  FOR SELECT TO authenticated USING (is_secret = false OR EXISTS (
    SELECT 1 FROM public.user_achievements ua WHERE ua.achievement_id = achievements.id AND ua.user_id = auth.uid()
  ));

CREATE POLICY "Admins manage achievements" ON public.achievements
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Everyone can view earned achievements" ON public.user_achievements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "System grants achievements" ON public.user_achievements
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    ) OR user_id = auth.uid()
  );

-- User Stats
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view stats" ON public.user_stats
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "System updates stats" ON public.user_stats
  FOR ALL TO authenticated USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
  ));

-- User Notes
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notes" ON public.user_notes
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin', 'moderator', 'support')
    )
  );

-- User Warnings
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own warnings" ON public.user_warnings
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins manage warnings" ON public.user_warnings
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin', 'moderator')
    )
  );

-- User Presence
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view presence" ON public.user_presence
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users update own presence" ON public.user_presence
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Channel Stats
ALTER TABLE public.channel_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view channel stats" ON public.channel_stats
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "System updates channel stats" ON public.channel_stats
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- =============================================
-- 15. HELPER FUNCTIONS
-- =============================================

-- Log Activity Function
CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id UUID,
  p_action_type TEXT,
  p_action_category TEXT DEFAULT 'general',
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.activity_log (user_id, action_type, action_category, target_type, target_id, details)
  VALUES (p_user_id, p_action_type, p_action_category, p_target_type, p_target_id, p_details)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update User Stats Function
CREATE OR REPLACE FUNCTION public.update_user_stats(p_user_id UUID, p_stat_type TEXT, p_increment INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_stats (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  CASE p_stat_type
    WHEN 'messages' THEN
      UPDATE public.user_stats SET total_messages = total_messages + p_increment, updated_at = NOW() WHERE user_id = p_user_id;
    WHEN 'reactions_given' THEN
      UPDATE public.user_stats SET total_reactions_given = total_reactions_given + p_increment, updated_at = NOW() WHERE user_id = p_user_id;
    WHEN 'reactions_received' THEN
      UPDATE public.user_stats SET total_reactions_received = total_reactions_received + p_increment, updated_at = NOW() WHERE user_id = p_user_id;
    WHEN 'files' THEN
      UPDATE public.user_stats SET total_files_uploaded = total_files_uploaded + p_increment, updated_at = NOW() WHERE user_id = p_user_id;
    WHEN 'experience' THEN
      UPDATE public.user_stats SET experience_points = experience_points + p_increment, updated_at = NOW() WHERE user_id = p_user_id;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check and Grant Achievement Function
CREATE OR REPLACE FUNCTION public.check_achievements(p_user_id UUID)
RETURNS SETOF TEXT AS $$
DECLARE
  v_achievement RECORD;
  v_stats RECORD;
  v_granted TEXT;
BEGIN
  SELECT * INTO v_stats FROM public.user_stats WHERE user_id = p_user_id;
  
  FOR v_achievement IN SELECT * FROM public.achievements LOOP
    IF NOT EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = p_user_id AND achievement_id = v_achievement.id) THEN
      -- Check message achievements
      IF v_achievement.requirements->>'messages' IS NOT NULL AND 
         v_stats.total_messages >= (v_achievement.requirements->>'messages')::INTEGER THEN
        INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (p_user_id, v_achievement.id);
        v_granted := v_achievement.name;
        RETURN NEXT v_granted;
      END IF;
      
      -- Check streak achievements
      IF v_achievement.requirements->>'streak' IS NOT NULL AND 
         v_stats.current_streak >= (v_achievement.requirements->>'streak')::INTEGER THEN
        INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (p_user_id, v_achievement.id);
        v_granted := v_achievement.name;
        RETURN NEXT v_granted;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update User Level Function
CREATE OR REPLACE FUNCTION public.calculate_user_level(p_experience INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN FLOOR(SQRT(p_experience / 100)) + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update Online Status Function
CREATE OR REPLACE FUNCTION public.update_presence(p_user_id UUID, p_status TEXT DEFAULT 'online')
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_presence (user_id, status, last_heartbeat)
  VALUES (p_user_id, p_status, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET status = p_status, last_heartbeat = NOW();
  
  UPDATE public.users SET last_seen_at = NOW(), online_status = p_status WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get User Full Profile Function
CREATE OR REPLACE FUNCTION public.get_user_full_profile(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'user', row_to_json(u.*),
    'profile', row_to_json(up.*),
    'stats', row_to_json(us.*),
    'roles', (SELECT jsonb_agg(row_to_json(r.*)) FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = p_user_id),
    'achievements', (SELECT jsonb_agg(row_to_json(a.*)) FROM public.user_achievements ua JOIN public.achievements a ON ua.achievement_id = a.id WHERE ua.user_id = p_user_id),
    'highest_role', (SELECT row_to_json(r.*) FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = p_user_id ORDER BY r.hierarchy_level DESC LIMIT 1)
  ) INTO v_result
  FROM public.users u
  LEFT JOIN public.user_profiles up ON u.id = up.user_id
  LEFT JOIN public.user_stats us ON u.id = us.user_id
  WHERE u.id = p_user_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 16. TRIGGERS
-- =============================================

-- Trigger: Create user stats on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO public.user_presence (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_stats ON public.users;
CREATE TRIGGER on_user_created_stats
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_stats();

-- Trigger: Update stats on message
CREATE OR REPLACE FUNCTION public.handle_new_message_stats()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.update_user_stats(NEW.user_id, 'messages', 1);
  PERFORM public.update_user_stats(NEW.user_id, 'experience', 5);
  
  -- Update channel stats
  INSERT INTO public.channel_stats (channel_id, total_messages, last_message_at)
  VALUES (NEW.channel_id, 1, NOW())
  ON CONFLICT (channel_id) 
  DO UPDATE SET total_messages = channel_stats.total_messages + 1, last_message_at = NOW(), updated_at = NOW();
  
  -- Check achievements
  PERFORM public.check_achievements(NEW.user_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_created_stats ON public.messages;
CREATE TRIGGER on_message_created_stats
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message_stats();

-- Trigger: Log user login
CREATE OR REPLACE FUNCTION public.handle_user_login_streak()
RETURNS TRIGGER AS $$
DECLARE
  v_last_date DATE;
  v_current_date DATE := CURRENT_DATE;
BEGIN
  SELECT last_active_date INTO v_last_date FROM public.user_stats WHERE user_id = NEW.id;
  
  IF v_last_date IS NULL THEN
    UPDATE public.user_stats SET 
      last_active_date = v_current_date,
      total_login_days = 1,
      current_streak = 1,
      longest_streak = 1
    WHERE user_id = NEW.id;
  ELSIF v_last_date = v_current_date - INTERVAL '1 day' THEN
    UPDATE public.user_stats SET 
      last_active_date = v_current_date,
      total_login_days = total_login_days + 1,
      current_streak = current_streak + 1,
      longest_streak = GREATEST(longest_streak, current_streak + 1)
    WHERE user_id = NEW.id;
  ELSIF v_last_date < v_current_date - INTERVAL '1 day' THEN
    UPDATE public.user_stats SET 
      last_active_date = v_current_date,
      total_login_days = total_login_days + 1,
      current_streak = 1
    WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 17. CREATE STATS FOR EXISTING USERS
-- =============================================
INSERT INTO public.user_stats (user_id)
SELECT id FROM public.users
WHERE NOT EXISTS (SELECT 1 FROM public.user_stats us WHERE us.user_id = users.id)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_presence (user_id)
SELECT id FROM public.users
WHERE NOT EXISTS (SELECT 1 FROM public.user_presence up WHERE up.user_id = users.id)
ON CONFLICT DO NOTHING;

-- =============================================
-- 18. CREATE CHANNEL STATS FOR EXISTING CHANNELS
-- =============================================
INSERT INTO public.channel_stats (channel_id, total_messages, last_message_at)
SELECT 
  c.id,
  (SELECT COUNT(*) FROM public.messages m WHERE m.channel_id = c.id),
  (SELECT MAX(created_at) FROM public.messages m WHERE m.channel_id = c.id)
FROM public.channels c
WHERE NOT EXISTS (SELECT 1 FROM public.channel_stats cs WHERE cs.channel_id = c.id)
ON CONFLICT DO NOTHING;

-- =============================================
-- 19. ENABLE REALTIME FOR NEW TABLES
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_achievements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
