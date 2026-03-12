-- =============================================
-- NUR BLOCK 2: SLASH COMMANDS (falls Block 2 einzeln ausgeführt werden soll)
-- =============================================
-- SQL-Kommentare: nur -- (zwei Minus), kein //
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

DROP POLICY IF EXISTS "Everyone views active slash commands" ON public.slash_commands;
CREATE POLICY "Everyone views active slash commands" ON public.slash_commands
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage slash commands" ON public.slash_commands;
CREATE POLICY "Admins manage slash commands" ON public.slash_commands
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Everyone views command roles" ON public.slash_command_roles;
CREATE POLICY "Everyone views command roles" ON public.slash_command_roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage command roles" ON public.slash_command_roles;
CREATE POLICY "Admins manage command roles" ON public.slash_command_roles
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

INSERT INTO public.slash_commands (name, description, trigger, action_type, action_value, order_index) VALUES
  ('hilfe', 'Hilfe anzeigen', '/hilfe', 'route', '{"path": "/support"}', 1),
  ('dashboard', 'Zum Dashboard', '/dashboard', 'route', '{"path": "/dashboard"}', 2),
  ('tickets', 'Tickets öffnen', '/tickets', 'route', '{"path": "/tickets"}', 3)
ON CONFLICT (trigger) DO NOTHING;
