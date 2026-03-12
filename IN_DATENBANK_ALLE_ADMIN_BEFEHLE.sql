-- =============================================
-- BROSPIFY HUB – ALLE ADMIN-BEFEHLE (mit Kategorien)
-- =============================================
-- Jede erdenkliche Funktion/Info als Kurzbefehl. Einmal im Supabase SQL Editor ausführen.
-- Voraussetzung: slash_commands + slash_command_roles existieren (IN_DATENBANK_EINFUEGEN).
-- Kommentare nur mit -- (kein //).
-- =============================================

ALTER TABLE public.slash_commands ADD COLUMN IF NOT EXISTS category TEXT;

INSERT INTO public.slash_commands (name, description, trigger, action_type, action_value, category, order_index) VALUES
  ('dashboard', 'Zum Dashboard', '/dashboard', 'route', '{"path": "/dashboard"}', 'Navigation (App)', 1),
  ('channels', 'Zu den Channels', '/channels', 'route', '{"path": "/channels"}', 'Navigation (App)', 2),
  ('tickets', 'Zu meinen Tickets', '/tickets', 'route', '{"path": "/tickets"}', 'Navigation (App)', 3),
  ('support', 'Support & Hilfe', '/support', 'route', '{"path": "/support"}', 'Navigation (App)', 4),
  ('favorites', 'Favoriten', '/favorites', 'route', '{"path": "/favorites"}', 'Navigation (App)', 5),
  ('profile', 'Mein Profil', '/profile', 'route', '{"path": "/profile"}', 'Navigation (App)', 6),
  ('settings', 'Einstellungen', '/settings', 'route', '{"path": "/settings"}', 'Navigation (App)', 7),

  ('admin', 'Admin Übersicht', '/admin', 'route', '{"path": "/admin"}', 'Navigation (Admin)', 20),
  ('admin-users', 'User-Zentrale (alle Nutzer)', '/admin/users', 'route', '{"path": "/admin/users"}', 'User & Nutzer', 21),
  ('admin-user-roles', 'Benutzer & Rollen', '/admin/user-roles', 'route', '{"path": "/admin/user-roles"}', 'User & Nutzer', 22),
  ('admin-tickets', 'Support-Tickets', '/admin/tickets', 'route', '{"path": "/admin/tickets"}', 'Tickets', 23),
  ('admin-ticket-categories', 'Ticket-Kategorien', '/admin/ticket-categories', 'route', '{"path": "/admin/ticket-categories"}', 'Tickets', 24),
  ('admin-products', 'Produkt-Manager', '/admin/products', 'route', '{"path": "/admin/products"}', 'Produkte', 25),
  ('admin-winning-product', 'Winning Product', '/admin/winning-product', 'route', '{"path": "/admin/winning-product"}', 'Produkte', 26),
  ('admin-channels', 'Channel-Manager', '/admin/channels', 'route', '{"path": "/admin/channels"}', 'Channels', 27),
  ('admin-categories', 'Channel-Kategorien', '/admin/categories', 'route', '{"path": "/admin/categories"}', 'Channels', 28),
  ('admin-roles', 'Rollen-Manager', '/admin/roles', 'route', '{"path": "/admin/roles"}', 'Einstellungen', 29),
  ('admin-slash', 'Slash-Befehle verwalten', '/admin/slash-commands', 'route', '{"path": "/admin/slash-commands"}', 'Einstellungen', 30),
  ('admin-settings', 'App-Einstellungen', '/admin/settings', 'route', '{"path": "/admin/settings"}', 'Einstellungen', 31),
  ('admin-licenses', 'Lizenz-Management', '/admin/licenses', 'route', '{"path": "/admin/licenses"}', 'Lizenzen & Geräte', 32),
  ('admin-devices', 'Geräte-Manager', '/admin/devices', 'route', '{"path": "/admin/devices"}', 'Lizenzen & Geräte', 33),
  ('admin-approval', 'Freigabe-Warteschlange', '/admin/approval', 'route', '{"path": "/admin/approval"}', 'Inhalte', 34),
  ('admin-scheduler', 'Content-Scheduler', '/admin/scheduler', 'route', '{"path": "/admin/scheduler"}', 'Inhalte', 35),
  ('admin-activity', 'Aktivitätslog', '/admin/activity', 'route', '{"path": "/admin/activity"}', 'Info & Logs', 36),
  ('admin-emojis', 'Emoji-Verwaltung', '/admin/emojis', 'route', '{"path": "/admin/emojis"}', 'Inhalte', 37),
  ('admin-quick-replies', 'Schnellantworten', '/admin/quick-replies', 'route', '{"path": "/admin/quick-replies"}', 'Inhalte', 38),
  ('admin-tutorials', 'Tutorial-Schritte', '/admin/tutorials', 'route', '{"path": "/admin/tutorials"}', 'Inhalte', 39),
  ('admin-support', 'Support-Inbox', '/admin/support', 'route', '{"path": "/admin/support"}', 'Support & Hilfe', 40)
ON CONFLICT (trigger) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  order_index = EXCLUDED.order_index,
  updated_at = NOW();

DO $$
DECLARE
  admin_role_id UUID;
  r RECORD;
BEGIN
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'admin' LIMIT 1;
  IF admin_role_id IS NULL THEN
    RAISE NOTICE 'Admin-Rolle nicht gefunden. slash_command_roles werden nicht befüllt.';
    RETURN;
  END IF;
  FOR r IN SELECT id FROM public.slash_commands
  LOOP
    INSERT INTO public.slash_command_roles (command_id, role_id)
    VALUES (r.id, admin_role_id)
    ON CONFLICT (command_id, role_id) DO NOTHING;
  END LOOP;
END $$;
