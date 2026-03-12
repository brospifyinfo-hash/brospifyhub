-- =============================================
-- BROSPIFY HUB – USER IDs (3-stellig ab 550)
-- =============================================
-- Fügt eine öffentliche, numerische User-ID hinzu: users.user_number (unique).
-- Startet bei 550, wird automatisch vergeben, und bestehende User werden befüllt.
-- Danach kannst du im UI die Nummer als 3-stellig darstellen (z.B. 550, 551, ...).
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'users_public_number_seq') THEN
    CREATE SEQUENCE public.users_public_number_seq START 550;
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_number INTEGER;

ALTER TABLE public.users
  ALTER COLUMN user_number SET DEFAULT nextval('public.users_public_number_seq');

UPDATE public.users
SET user_number = nextval('public.users_public_number_seq')
WHERE user_number IS NULL;

SELECT setval(
  'public.users_public_number_seq',
  GREATEST(549, (SELECT COALESCE(MAX(user_number), 549) FROM public.users))
);

CREATE UNIQUE INDEX IF NOT EXISTS users_user_number_unique ON public.users(user_number);
