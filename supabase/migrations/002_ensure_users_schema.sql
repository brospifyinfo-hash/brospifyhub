-- =============================================
-- Migration: Ensure Users Table Schema
-- This migration ensures the users table has the correct structure
-- Run this if you need to modify an existing users table
-- =============================================

-- Add license_key column if it doesn't exist (with UNIQUE constraint)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'license_key'
  ) THEN
    ALTER TABLE public.users ADD COLUMN license_key TEXT UNIQUE;
  END IF;
END $$;

-- Ensure UNIQUE constraint exists on license_key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_license_key_key' 
    AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_license_key_key UNIQUE (license_key);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Constraint already exists, ignore
END $$;

-- Add credits column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'credits'
  ) THEN
    ALTER TABLE public.users ADD COLUMN credits INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add role column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'role'
  ) THEN
    ALTER TABLE public.users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user'));
  END IF;
END $$;

-- Create index on license_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_license_key ON public.users(license_key) WHERE license_key IS NOT NULL;

-- =============================================
-- Verify Schema (for debugging)
-- =============================================
-- Run this query to verify the schema:
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'users';
