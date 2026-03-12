-- =============================================
-- BROSPIFY HUB - MEGA UPDATE MIGRATION
-- =============================================
-- Enthält: Slash-Commands, Ticket-Kategorien, Archiv, App-Logo-Einstellungen

-- =============================================
-- 1. APP SETTINGS ERWEITERN
-- =============================================
INSERT INTO public.app_settings (key, value) VALUES
  ('app_logo_url', ''),
  ('app_favicon_url', ''),
  ('app_primary_color', '#95BF47'),
  ('app_secondary_color', ''),
  ('welcome_title', 'Willkommen zurück!'),
  ('welcome_text', 'Schön, dass du da bist.'),
  ('meta_title_suffix', ' - Brospify Hub'),
  ('default_language', 'de'),
  ('max_upload_size_mb', '10')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- 2. SLASH COMMANDS
-- =============================================
CREATE TABLE IF NOT EXISTS public.slash_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  trigger TEXT NOT NULL UNIQUE,
  action_type TEXT NOT NULL CHECK (action_type IN ('url', 'route', 'text', 'modal')),
  action_value JSONB NOT NULL DEFAULT '{}',
  icon TEXT DEFAULT 'slash',
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.slash_command_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id UUID NOT NULL REFERENCES public.slash_commands(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  UNIQUE(command_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_slash_commands_trigger ON public.slash_commands(trigger);
CREATE INDEX IF NOT EXISTS idx_slash_command_roles_command ON public.slash_command_roles(command_id);

ALTER TABLE public.slash_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slash_command_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone views active slash commands" ON public.slash_commands
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admins manage slash commands" ON public.slash_commands
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Everyone views command roles" ON public.slash_command_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage command roles" ON public.slash_command_roles
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Beispiel-Befehle
INSERT INTO public.slash_commands (name, description, trigger, action_type, action_value, order_index) VALUES
  ('hilfe', 'Hilfe anzeigen', '/hilfe', 'route', '{"path": "/support"}', 1),
  ('dashboard', 'Zum Dashboard', '/dashboard', 'route', '{"path": "/dashboard"}', 2),
  ('tickets', 'Tickets öffnen', '/tickets', 'route', '{"path": "/tickets"}', 3)
ON CONFLICT (trigger) DO NOTHING;

-- =============================================
-- 3. TICKET KATEGORIEN
-- =============================================
CREATE TABLE IF NOT EXISTS public.ticket_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#95BF47',
  icon TEXT DEFAULT 'tag',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.ticket_categories(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_category ON public.tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_archived ON public.tickets(archived_at);

ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone views ticket categories" ON public.ticket_categories
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admins manage ticket categories" ON public.ticket_categories
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Standard-Kategorien
INSERT INTO public.ticket_categories (name, description, color, order_index) VALUES
  ('Allgemein', 'Allgemeine Anfragen', '#95BF47', 0),
  ('Technisch', 'Technische Probleme', '#3498DB', 1),
  ('Abrechnung', 'Fragen zu Zahlung & Abo', '#F39C12', 2),
  ('Sonstiges', 'Sonstige Anfragen', '#9B59B6', 3)
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 4. ROLES: Slash-Command-Berechtigung
-- =============================================
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_use_slash_commands BOOLEAN DEFAULT false;

UPDATE public.roles SET can_use_slash_commands = true WHERE name IN ('owner', 'admin', 'moderator', 'support', 'member', 'vip');

-- =============================================
-- 5. REALTIME
-- =============================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.slash_commands; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
