-- =============================================
-- Migration: Add display_name to users table
-- Run this if you already have the users table
-- =============================================

-- Add display_name column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'display_name'
  ) THEN
    ALTER TABLE public.users ADD COLUMN display_name TEXT;
  END IF;
END $$;

-- Create index on display_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_display_name ON public.users(display_name) WHERE display_name IS NOT NULL;
