-- Public 3-digit user number (starting at 550)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'users_public_number_seq') THEN
    CREATE SEQUENCE public.users_public_number_seq START 550;
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_number INTEGER;

-- Ensure default uses the sequence
ALTER TABLE public.users
  ALTER COLUMN user_number SET DEFAULT nextval('public.users_public_number_seq');

-- Backfill existing users that don't have a number yet
UPDATE public.users
SET user_number = nextval('public.users_public_number_seq')
WHERE user_number IS NULL;

-- Keep sequence ahead of max(user_number)
SELECT setval(
  'public.users_public_number_seq',
  GREATEST(549, (SELECT COALESCE(MAX(user_number), 549) FROM public.users))
);

-- Uniqueness + fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS users_user_number_unique ON public.users(user_number);
