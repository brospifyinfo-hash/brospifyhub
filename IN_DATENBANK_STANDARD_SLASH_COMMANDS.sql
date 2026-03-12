-- =============================================
-- BROSPIFY HUB – STANDARD SLASH COMMANDS (ADMIN)
-- =============================================
-- Führt 20+ Standard-Befehle ein und ordnet sie automatisch der Admin-Rolle zu.
-- Voraussetzung: Tabellen `slash_commands` und `slash_command_roles` existieren (IN_DATENBANK_EINFUEGEN.sql).
-- =============================================

-- 1) Commands (ON CONFLICT = safe re-run)
INSERT INTO public.slash_commands (name, description, trigger, action_type, action_value, order_index) VALUES
  ('dashboard', 'Zum Dashboard', '/dashboard', 'route', '{"path": "/dashboard"}', 1),
  ('channels', 'Zu den Channels', '/channels', 'route', '{"path": "/channels"}', 2),
  ('tickets', 'Zu Tickets', '/tickets', 'route', '{"path": "/tickets"}', 3),
  ('support', 'Zum Support', '/support', 'route', '{"path": "/support"}', 4),
  ('favorites', 'Zu Favoriten', '/favorites', 'route', '{"path": "/favorites"}', 5),
  ('profile', 'Zum Profil', '/profile', 'route', '{"path": "/profile"}', 6),
  ('settings', 'Zu Einstellungen', '/settings', 'route', '{"path": "/settings"}', 7),

  ('admin', 'Admin Übersicht', '/admin', 'route', '{"path": "/admin"}', 20),
  ('admin-tickets', 'Admin: Tickets', '/admin/tickets', 'route', '{"path": "/admin/tickets"}', 21),
  ('admin-ticket-categories', 'Admin: Ticket-Kategorien', '/admin/ticket-categories', 'route', '{"path": "/admin/ticket-categories"}', 22),
  ('admin-slash', 'Admin: Slash-Befehle', '/admin/slash-commands', 'route', '{"path": "/admin/slash-commands"}', 23),
  ('admin-products', 'Admin: Produkte', '/admin/products', 'route', '{"path": "/admin/products"}', 24),
  ('admin-roles', 'Admin: Rollen', '/admin/roles', 'route', '{"path": "/admin/roles"}', 25),
  ('admin-user-roles', 'Admin: Benutzer & Rollen', '/admin/user-roles', 'route', '{"path": "/admin/user-roles"}', 26),
  ('admin-users', 'Admin: User-Zentrale', '/admin/users', 'route', '{"path": "/admin/users"}', 27),
  ('admin-devices', 'Admin: Geräte', '/admin/devices', 'route', '{"path": "/admin/devices"}', 28),
  ('admin-channels', 'Admin: Channels', '/admin/channels', 'route', '{"path": "/admin/channels"}', 29),
  ('admin-categories', 'Admin: Channel-Kategorien', '/admin/categories', 'route', '{"path": "/admin/categories"}', 30),
  ('admin-approval', 'Admin: Freigaben', '/admin/approval', 'route', '{"path": "/admin/approval"}', 31),
  ('admin-scheduler', 'Admin: Scheduler', '/admin/scheduler', 'route', '{"path": "/admin/scheduler"}', 32),
  ('admin-activity', 'Admin: Aktivitätslog', '/admin/activity', 'route', '{"path": "/admin/activity"}', 33),
  ('admin-settings', 'Admin: App-Einstellungen', '/admin/settings', 'route', '{"path": "/admin/settings"}', 34),
  ('admin-emojis', 'Admin: Emojis', '/admin/emojis', 'route', '{"path": "/admin/emojis"}', 35),
  ('admin-licenses', 'Admin: Lizenzen', '/admin/licenses', 'route', '{"path": "/admin/licenses"}', 36)
ON CONFLICT (trigger) DO NOTHING;

-- 2) Assign all of the above commands to the Admin role
DO $$
DECLARE
  admin_role_id UUID;
BEGIN
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'admin' LIMIT 1;
  IF admin_role_id IS NULL THEN
    RAISE NOTICE 'Admin role not found (roles.name = admin). Skipping slash_command_roles insert.';
    RETURN;
  END IF;

  INSERT INTO public.slash_command_roles (command_id, role_id)
  SELECT c.id, admin_role_id
  FROM public.slash_commands c
  WHERE c.trigger IN (
    '/dashboard','/channels','/tickets','/support','/favorites','/profile','/settings',
    '/admin','/admin/tickets','/admin/ticket-categories','/admin/slash-commands','/admin/products',
    '/admin/roles','/admin/user-roles','/admin/users','/admin/devices','/admin/channels',
    '/admin/categories','/admin/approval','/admin/scheduler','/admin/activity','/admin/settings',
    '/admin/emojis','/admin/licenses'
  )
  ON CONFLICT (command_id, role_id) DO NOTHING;
END $$;

