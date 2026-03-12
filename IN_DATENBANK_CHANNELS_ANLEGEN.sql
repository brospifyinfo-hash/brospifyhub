-- Channels anlegen (Tabellen existieren schon – nur Daten einfügen)
-- Einmal im Supabase SQL Editor ausführen. Kommentare nur mit -- (kein //).

-- 3 Standard-Channels nur einfügen, wenn die Tabelle leer ist
INSERT INTO public.channels (name, type, settings)
SELECT name, type, settings
FROM (VALUES
  ('General', 'standard', '{"posting_enabled": true}'::jsonb),
  ('Support', 'support', '{"posting_enabled": true}'::jsonb),
  ('Winning Products', 'winning_product', '{"posting_enabled": false}'::jsonb)
) AS v(name, type, settings)
WHERE (SELECT COUNT(*) FROM public.channels) = 0;
