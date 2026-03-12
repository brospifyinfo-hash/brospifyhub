-- Kategorie für Gruppierung in der Admin-Konsole (Navigation, User, Tickets, …)
ALTER TABLE public.slash_commands
  ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN public.slash_commands.category IS 'Gruppe für Anzeige: z.B. Navigation, User, Tickets, Einstellungen';
