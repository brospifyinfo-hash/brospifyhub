-- =============================================
-- Initial Schema for Discord-Style Chat App
-- (IF NOT EXISTS / DROP IF EXISTS = laeuft auch bei bestehender DB)
-- =============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  license_key TEXT UNIQUE,
  display_name TEXT,
  credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Channels table
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('support', 'winning_product', 'standard')),
  settings JSONB DEFAULT '{"posting_enabled": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes for Performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON public.channels(type);

-- =============================================
-- Enable Row Level Security
-- =============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies for Users (DROP first so re-run works)
-- =============================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================
-- RLS Policies for Channels
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view channels" ON public.channels;
CREATE POLICY "Authenticated users can view channels"
  ON public.channels FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can create channels" ON public.channels;
CREATE POLICY "Admins can create channels"
  ON public.channels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update channels" ON public.channels;
CREATE POLICY "Admins can update channels"
  ON public.channels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete channels" ON public.channels;
CREATE POLICY "Admins can delete channels"
  ON public.channels FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- RLS Policies for Messages
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.messages;
CREATE POLICY "Authenticated users can view messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create messages" ON public.messages;
CREATE POLICY "Users can create messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.channels 
      WHERE id = channel_id 
      AND (settings->>'posting_enabled')::boolean = true
    )
  );

DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- Function to auto-create user profile on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, role, credits)
  VALUES (NEW.id, 'user', 0)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Seed Data: Default Channels (nur wenn noch nicht vorhanden)
-- =============================================
INSERT INTO public.channels (name, type, settings)
SELECT 'General', 'standard', '{"posting_enabled": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.channels WHERE name = 'General' LIMIT 1);
INSERT INTO public.channels (name, type, settings)
SELECT 'Support', 'support', '{"posting_enabled": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.channels WHERE name = 'Support' LIMIT 1);
INSERT INTO public.channels (name, type, settings)
SELECT 'Winning Products', 'winning_product', '{"posting_enabled": false}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.channels WHERE name = 'Winning Products' LIMIT 1);


-- ========== END 001_initial_schema.sql ==========

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


-- ========== END 002_ensure_users_schema.sql ==========

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


-- ========== END 003_add_display_name.sql ==========

-- Create attachments storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files (DROP first so re-run works)
DROP POLICY IF EXISTS "Allow uploads for authenticated users" ON storage.objects;
CREATE POLICY "Allow uploads for authenticated users" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to attachments
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
CREATE POLICY "Allow public read access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'attachments');

-- ========== END 004_create_attachments_bucket.sql ==========

-- User Purchases table for tracking product purchases
CREATE TABLE IF NOT EXISTS public.user_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  purchase_type TEXT NOT NULL CHECK (purchase_type IN ('initial', 'upsell')),
  shopify_order_id TEXT,
  amount_paid DECIMAL(10,2),
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id, purchase_type)
);

-- Enable RLS
ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own purchases" ON public.user_purchases;
CREATE POLICY "Users can view own purchases" ON public.user_purchases FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert purchases" ON public.user_purchases;
CREATE POLICY "Service role can insert purchases" ON public.user_purchases FOR INSERT WITH CHECK (true);

-- Enable realtime for purchases
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_purchases;

-- Index for faster lookups
CREATE INDEX idx_user_purchases_user_id ON public.user_purchases(user_id);
CREATE INDEX idx_user_purchases_product_id ON public.user_purchases(product_id);

-- ========== END 005_user_purchases.sql ==========

-- =============================================
-- Admin Features: Extended Schema
-- =============================================

-- 1. Extend users table for admin features
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- 2. User Channel Permissions (granular access control)
CREATE TABLE IF NOT EXISTS public.user_channel_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT TRUE,
  can_write BOOLEAN DEFAULT FALSE,
  can_upload_images BOOLEAN DEFAULT FALSE,
  can_upload_files BOOLEAN DEFAULT FALSE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES public.users(id),
  UNIQUE(user_id, channel_id)
);

-- 3. Extend channels table for advanced settings
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS show_history_from TIMESTAMPTZ;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS rate_limit_seconds INTEGER DEFAULT 0;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE;

-- 4. Message Approval Queue
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 5. Scheduled Posts
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachment_url TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  posted_at TIMESTAMPTZ,
  is_posted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Custom Emojis
CREATE TABLE IF NOT EXISTS public.custom_emojis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  image_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Quick Replies for Support
CREATE TABLE IF NOT EXISTS public.quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tutorial Steps
CREATE TABLE IF NOT EXISTS public.tutorial_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_element TEXT,
  position TEXT DEFAULT 'bottom',
  order_index INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. User Tutorial Progress
CREATE TABLE IF NOT EXISTS public.user_tutorial_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  completed_steps TEXT[] DEFAULT '{}',
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

-- RLS Policies
ALTER TABLE public.user_channel_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_emojis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorial_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tutorial_progress ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "Admins full access to permissions" ON public.user_channel_permissions;
CREATE POLICY "Admins full access to permissions" ON public.user_channel_permissions FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins full access to scheduled_posts" ON public.scheduled_posts;
CREATE POLICY "Admins full access to scheduled_posts" ON public.scheduled_posts FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins full access to emojis" ON public.custom_emojis;
CREATE POLICY "Admins full access to emojis" ON public.custom_emojis FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins full access to quick_replies" ON public.quick_replies;
CREATE POLICY "Admins full access to quick_replies" ON public.quick_replies FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins full access to tutorial_steps" ON public.tutorial_steps;
CREATE POLICY "Admins full access to tutorial_steps" ON public.tutorial_steps FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Users can read emojis" ON public.custom_emojis;
CREATE POLICY "Users can read emojis" ON public.custom_emojis FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can read tutorial_steps" ON public.tutorial_steps;
CREATE POLICY "Users can read tutorial_steps" ON public.tutorial_steps FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own tutorial progress" ON public.user_tutorial_progress;
CREATE POLICY "Users manage own tutorial progress" ON public.user_tutorial_progress FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own permissions" ON public.user_channel_permissions;
CREATE POLICY "Users can read own permissions" ON public.user_channel_permissions FOR SELECT USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_channel_permissions_user ON public.user_channel_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_permissions_channel ON public.user_channel_permissions(channel_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled ON public.scheduled_posts(scheduled_for) WHERE NOT is_posted;
CREATE INDEX IF NOT EXISTS idx_messages_approval ON public.messages(is_approved) WHERE NOT is_approved;

-- ========== END 006_admin_features.sql ==========

-- =============================================
-- Internal License Keys System
-- =============================================

CREATE TABLE IF NOT EXISTS public.internal_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_value TEXT NOT NULL UNIQUE,
  is_assigned BOOLEAN DEFAULT FALSE,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.internal_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage keys" ON public.internal_keys;
CREATE POLICY "Admins can manage keys" ON public.internal_keys FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Service role full access" ON public.internal_keys;
CREATE POLICY "Service role full access" ON public.internal_keys FOR ALL 
  USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_internal_keys_value ON public.internal_keys(key_value);
CREATE INDEX IF NOT EXISTS idx_internal_keys_assigned ON public.internal_keys(is_assigned);

-- ========== END 007_internal_keys.sql ==========

-- =============================================
-- Fix RLS for Users table - Allow service role full access
-- =============================================

-- The service_role key should bypass RLS by default in Supabase
-- But we need to ensure policies allow INSERT for new users

-- Drop existing policies if they conflict
DROP POLICY IF EXISTS "Service role can insert users" ON public.users;
DROP POLICY IF EXISTS "Service role can update users" ON public.users;

-- Allow INSERT for new users (needed for upsert operations)
CREATE POLICY "Service role can insert users" 
  ON public.users 
  FOR INSERT 
  WITH CHECK (true);

-- Allow UPDATE for service role operations  
CREATE POLICY "Service role can update users" 
  ON public.users 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);

-- Ensure the trigger function handles the user creation properly with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, role, credits)
  VALUES (NEW.id, 'user', 0)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger if needed
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== END 008_fix_users_rls.sql ==========

-- =============================================
-- Massive Update Migration
-- Support DM System, Channel Permissions, Key Deactivation, etc.
-- =============================================

-- =============================================
-- 1. Support DM System Tables
-- =============================================

-- Support Conversations (private DMs between user and admin)
CREATE TABLE IF NOT EXISTS public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  is_resolved BOOLEAN DEFAULT false,
  UNIQUE(user_id)
);

-- Support Messages
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support Helpers (users who can respond to support chats)
CREATE TABLE IF NOT EXISTS public.support_helpers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes for support system
CREATE INDEX IF NOT EXISTS idx_support_conversations_user ON public.support_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_support_conversations_last_message ON public.support_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_conversation ON public.support_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created ON public.support_messages(created_at DESC);

-- =============================================
-- 2. Extend Channels Table
-- =============================================

-- Add description column if not exists
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS description TEXT;

-- Add new permission columns to channels
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS allow_user_text BOOLEAN DEFAULT false;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS allow_user_images BOOLEAN DEFAULT false;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS allow_user_files BOOLEAN DEFAULT false;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS show_download_button BOOLEAN DEFAULT true;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS show_copy_button BOOLEAN DEFAULT true;

-- =============================================
-- 3. Extend Messages Table
-- =============================================

-- Add CTA button fields to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS cta_button_text TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS cta_button_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_type TEXT;

-- =============================================
-- 4. Extend Internal Keys Table
-- =============================================

-- Add is_active field for key deactivation
ALTER TABLE public.internal_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =============================================
-- 5. App Settings Table
-- =============================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.app_settings (key, value) VALUES 
  ('fake_member_bonus', '0'),
  ('app_name', 'Brospify Hub')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- 6. Create Emojis Storage Bucket
-- =============================================

-- Note: Storage bucket creation must be done via Supabase Dashboard or API
-- This is a placeholder comment for the SQL migration

-- =============================================
-- 7. Delete Welcome Channel, Create Winning Product Channel
-- =============================================

-- Delete the welcome channel
DELETE FROM public.channels WHERE name = 'Willkommen';

-- Create the Winning Product channel if it doesn't exist
INSERT INTO public.channels (name, type, description, settings, allow_user_text, allow_user_images, allow_user_files, show_download_button)
VALUES (
  'Winning Product',
  'winning_product',
  'Exklusives Winning Product fÃ¼r Premium-Mitglieder',
  '{
    "posting_enabled": false,
    "product_id": "wp-001",
    "description": "Hier erscheint dein Winning Product. Bearbeite es im Admin-Bereich.",
    "pdf_url": "",
    "initial_price": 1.95,
    "initial_checkout_url": "",
    "upsell_price": 4.95,
    "upsell_checkout_url": ""
  }'::jsonb,
  false,
  false,
  false,
  true
)
ON CONFLICT DO NOTHING;

-- =============================================
-- 8. RLS Policies
-- =============================================

-- Enable RLS on new tables
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_helpers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Support Conversations Policies
DROP POLICY IF EXISTS "Users can view own conversations" ON public.support_conversations;
CREATE POLICY "Users can view own conversations" ON public.support_conversations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all conversations" ON public.support_conversations;
CREATE POLICY "Admins can view all conversations" ON public.support_conversations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.support_helpers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create own conversation" ON public.support_conversations;
CREATE POLICY "Users can create own conversation" ON public.support_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow all for support_conversations" ON public.support_conversations;
CREATE POLICY "Allow all for support_conversations" ON public.support_conversations
  FOR ALL USING (true) WITH CHECK (true);

-- Support Messages Policies
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.support_messages;
CREATE POLICY "Users can view messages in own conversations" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_conversations 
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all messages" ON public.support_messages;
CREATE POLICY "Admins can view all messages" ON public.support_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.support_helpers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can send messages" ON public.support_messages;
CREATE POLICY "Users can send messages" ON public.support_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Allow all for support_messages" ON public.support_messages;
CREATE POLICY "Allow all for support_messages" ON public.support_messages
  FOR ALL USING (true) WITH CHECK (true);

-- Support Helpers Policies
DROP POLICY IF EXISTS "Admins can manage helpers" ON public.support_helpers;
CREATE POLICY "Admins can manage helpers" ON public.support_helpers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Helpers can view themselves" ON public.support_helpers;
CREATE POLICY "Helpers can view themselves" ON public.support_helpers
  FOR SELECT USING (user_id = auth.uid());

-- App Settings Policies
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
CREATE POLICY "Anyone can read app settings" ON public.app_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage app settings" ON public.app_settings;
CREATE POLICY "Admins can manage app settings" ON public.app_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 9. Enable Realtime for new tables
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;


-- ========== END 009_massive_update.sql ==========

-- =============================================
-- Major Update Migration
-- Fix Messages RLS, Tickets, Categories, Device Tracking
-- =============================================

-- =============================================
-- 1. FIX: Messages RLS Policy
-- =============================================

-- Drop old policy that checks wrong field
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;

-- Create new policy that checks allow_user_text OR admin
CREATE POLICY "Users can insert messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.channels 
      WHERE id = channel_id 
      AND (
        allow_user_text = true 
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

-- Also allow admins to always insert
DROP POLICY IF EXISTS "Admins can insert any message" ON public.messages;
CREATE POLICY "Admins can insert any message" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Ensure admins can do everything with messages
DROP POLICY IF EXISTS "Admins full access messages" ON public.messages;
CREATE POLICY "Admins full access messages" ON public.messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 2. Ticket System Tables
-- =============================================

-- Tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number SERIAL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES public.users(id)
);

-- Ticket messages
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_internal BOOLEAN DEFAULT false
);

-- Indexes for tickets
CREATE INDEX IF NOT EXISTS idx_tickets_user ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON public.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created ON public.ticket_messages(created_at);

-- RLS for tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Users can see their own tickets
DROP POLICY IF EXISTS "Users view own tickets" ON public.tickets;
CREATE POLICY "Users view own tickets" ON public.tickets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all tickets" ON public.tickets;
CREATE POLICY "Admins view all tickets" ON public.tickets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users create tickets" ON public.tickets;
CREATE POLICY "Users create tickets" ON public.tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own tickets" ON public.tickets;
CREATE POLICY "Users update own tickets" ON public.tickets
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins update all tickets" ON public.tickets;
CREATE POLICY "Admins update all tickets" ON public.tickets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Ticket messages policies
DROP POLICY IF EXISTS "Users view own ticket messages" ON public.ticket_messages;
CREATE POLICY "Users view own ticket messages" ON public.ticket_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tickets WHERE id = ticket_id AND user_id = auth.uid())
    AND is_internal = false
  );

DROP POLICY IF EXISTS "Admins view all ticket messages" ON public.ticket_messages;
CREATE POLICY "Admins view all ticket messages" ON public.ticket_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users send ticket messages" ON public.ticket_messages;
CREATE POLICY "Users send ticket messages" ON public.ticket_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (SELECT 1 FROM public.tickets WHERE id = ticket_id AND user_id = auth.uid())
    AND is_internal = false
  );

DROP POLICY IF EXISTS "Admins full ticket messages" ON public.ticket_messages;
CREATE POLICY "Admins full ticket messages" ON public.ticket_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 3. Channel Categories
-- =============================================

CREATE TABLE IF NOT EXISTS public.channel_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  is_collapsed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add category reference to channels
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.channel_categories(id) ON DELETE SET NULL;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- RLS for categories
ALTER TABLE public.channel_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view categories" ON public.channel_categories;
CREATE POLICY "Anyone can view categories" ON public.channel_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage categories" ON public.channel_categories;
CREATE POLICY "Admins manage categories" ON public.channel_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Create a default category
INSERT INTO public.channel_categories (name, description, order_index)
VALUES ('Allgemein', 'Allgemeine Channels', 0)
ON CONFLICT DO NOTHING;

-- =============================================
-- 4. User Devices (Multi-Device + IP Tracking)
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  license_key TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  ip_address TEXT,
  city TEXT,
  country TEXT,
  user_agent TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_blocked BOOLEAN DEFAULT false,
  UNIQUE(user_id, device_fingerprint)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_devices_user ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_key ON public.user_devices(license_key);
CREATE INDEX IF NOT EXISTS idx_user_devices_blocked ON public.user_devices(is_blocked);

-- RLS for devices
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own devices" ON public.user_devices;
CREATE POLICY "Users view own devices" ON public.user_devices
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage all devices" ON public.user_devices;
CREATE POLICY "Admins manage all devices" ON public.user_devices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Service role full access devices" ON public.user_devices;
CREATE POLICY "Service role full access devices" ON public.user_devices
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 5. Enable Realtime for new tables
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;

-- =============================================
-- 6. Update existing channels to have allow_user_text = true for standard
-- =============================================

UPDATE public.channels 
SET allow_user_text = true 
WHERE type = 'standard' AND allow_user_text = false;


-- ========== END 010_major_update.sql ==========

-- =============================================
-- Favorites and Image Background Color
-- =============================================

-- Add background color to messages for PNG images
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_bg_color TEXT DEFAULT NULL;

-- Create favorites table
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON public.user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_message ON public.user_favorites(message_id);

-- RLS
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own favorites" ON public.user_favorites;
CREATE POLICY "Users view own favorites" ON public.user_favorites
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users add favorites" ON public.user_favorites;
CREATE POLICY "Users add favorites" ON public.user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users remove favorites" ON public.user_favorites;
CREATE POLICY "Users remove favorites" ON public.user_favorites
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins full favorites" ON public.user_favorites;
CREATE POLICY "Admins full favorites" ON public.user_favorites
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- ========== END 011_favorites_and_image_bg.sql ==========

-- =============================================
-- UMFASSENDES ROLLEN- UND BERECHTIGUNGSSYSTEM
-- =============================================

-- 1. ROLLEN-TABELLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#808080',
  icon TEXT DEFAULT 'user',
  hierarchy_level INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  is_assignable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BERECHTIGUNGEN-TABELLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ROLLEN-BERECHTIGUNGEN VERKNÃœPFUNG
-- =============================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- 4. USER-ROLLEN VERKNÃœPFUNG (User kann mehrere Rollen haben)
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(user_id, role_id)
);

-- 5. CHANNEL-SPEZIFISCHE ROLLEN-BERECHTIGUNGEN
-- =============================================
CREATE TABLE IF NOT EXISTS public.channel_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT true,
  can_send_messages BOOLEAN DEFAULT false,
  can_send_images BOOLEAN DEFAULT false,
  can_send_files BOOLEAN DEFAULT false,
  can_delete_messages BOOLEAN DEFAULT false,
  can_pin_messages BOOLEAN DEFAULT false,
  can_manage_channel BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, role_id)
);

-- 6. ERWEITERTE USER-PROFILE TABELLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  website TEXT,
  location TEXT,
  social_twitter TEXT,
  social_instagram TEXT,
  social_youtube TEXT,
  social_tiktok TEXT,
  notification_email BOOLEAN DEFAULT true,
  notification_push BOOLEAN DEFAULT true,
  notification_sound BOOLEAN DEFAULT true,
  theme_preference TEXT DEFAULT 'system',
  language TEXT DEFAULT 'de',
  privacy_show_online BOOLEAN DEFAULT true,
  privacy_show_activity BOOLEAN DEFAULT true,
  privacy_allow_dms BOOLEAN DEFAULT true,
  custom_status TEXT,
  custom_status_emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. USER-TABELLE ERWEITERN (Primary Role fÃ¼r schnellen Zugriff)
-- =============================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS primary_role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS badge_text TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS badge_color TEXT;

-- 8. INDEXES FÃœR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_channel_role_perms_channel ON public.channel_role_permissions(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_role_perms_role ON public.channel_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_roles_hierarchy ON public.roles(hierarchy_level DESC);

-- 9. RLS AKTIVIEREN
-- =============================================
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 10. RLS POLICIES - ROLES
-- =============================================
DROP POLICY IF EXISTS "Everyone can view roles" ON public.roles;
CREATE POLICY "Everyone can view roles" ON public.roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins/Owners manage roles" ON public.roles;
CREATE POLICY "Admins/Owners manage roles" ON public.roles
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- 11. RLS POLICIES - PERMISSIONS
-- =============================================
DROP POLICY IF EXISTS "Everyone can view permissions" ON public.permissions;
CREATE POLICY "Everyone can view permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Only owners manage permissions" ON public.permissions;
CREATE POLICY "Only owners manage permissions" ON public.permissions
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'owner'
    )
  );

-- 12. RLS POLICIES - ROLE PERMISSIONS
-- =============================================
DROP POLICY IF EXISTS "Everyone can view role permissions" ON public.role_permissions;
CREATE POLICY "Everyone can view role permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins/Owners manage role permissions" ON public.role_permissions;
CREATE POLICY "Admins/Owners manage role permissions" ON public.role_permissions
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- 13. RLS POLICIES - USER ROLES
-- =============================================
DROP POLICY IF EXISTS "Everyone can view user roles" ON public.user_roles;
CREATE POLICY "Everyone can view user roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins/Owners assign roles" ON public.user_roles;
CREATE POLICY "Admins/Owners assign roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins/Owners remove roles" ON public.user_roles;
CREATE POLICY "Admins/Owners remove roles" ON public.user_roles
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- 14. RLS POLICIES - CHANNEL ROLE PERMISSIONS
-- =============================================
DROP POLICY IF EXISTS "Everyone can view channel role perms" ON public.channel_role_permissions;
CREATE POLICY "Everyone can view channel role perms" ON public.channel_role_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins/Owners manage channel role perms" ON public.channel_role_permissions;
CREATE POLICY "Admins/Owners manage channel role perms" ON public.channel_role_permissions
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- 15. RLS POLICIES - USER PROFILES
-- =============================================
DROP POLICY IF EXISTS "Users view own profile" ON public.user_profiles;
CREATE POLICY "Users view own profile" ON public.user_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view public profiles" ON public.user_profiles;
CREATE POLICY "Users view public profiles" ON public.user_profiles
  FOR SELECT TO authenticated USING (privacy_show_activity = true);

DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
CREATE POLICY "Users update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users create own profile" ON public.user_profiles;
CREATE POLICY "Users create own profile" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all profiles" ON public.user_profiles;
CREATE POLICY "Admins view all profiles" ON public.user_profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- 16. STANDARD-ROLLEN EINFÃœGEN
-- =============================================
INSERT INTO public.roles (name, display_name, description, color, icon, hierarchy_level, is_system, is_assignable) VALUES
  ('owner', 'Inhaber', 'VollstÃ¤ndige Kontrolle Ã¼ber die gesamte Plattform', '#FFD700', 'crown', 100, true, false),
  ('admin', 'Administrator', 'Volle Verwaltungsrechte', '#FF4444', 'shield', 80, true, true),
  ('moderator', 'Moderator', 'Kann Inhalte und Channels moderieren', '#9B59B6', 'shield-check', 60, true, true),
  ('support', 'Support-Team', 'Kann Support-Tickets bearbeiten', '#3498DB', 'headphones', 50, true, true),
  ('vip', 'VIP-Mitglied', 'Premium-Mitglied mit erweiterten Rechten', '#F39C12', 'star', 40, true, true),
  ('member', 'Mitglied', 'RegulÃ¤res Community-Mitglied', '#95BF47', 'user', 20, true, true),
  ('guest', 'Gast', 'EingeschrÃ¤nkte Leserechte', '#808080', 'eye', 10, true, true)
ON CONFLICT (name) DO NOTHING;

-- 17. STANDARD-BERECHTIGUNGEN EINFÃœGEN
-- =============================================
INSERT INTO public.permissions (name, display_name, description, category) VALUES
  -- System
  ('manage_roles', 'Rollen verwalten', 'Kann Rollen erstellen, bearbeiten und lÃ¶schen', 'system'),
  ('assign_roles', 'Rollen zuweisen', 'Kann Benutzern Rollen zuweisen', 'system'),
  ('manage_users', 'Benutzer verwalten', 'Kann Benutzer bearbeiten, bannen und verwalten', 'system'),
  ('manage_licenses', 'Lizenzen verwalten', 'Kann LizenzschlÃ¼ssel verwalten', 'system'),
  ('manage_settings', 'Einstellungen verwalten', 'Kann App-Einstellungen Ã¤ndern', 'system'),
  ('view_analytics', 'Statistiken ansehen', 'Kann Dashboard-Statistiken sehen', 'system'),
  ('manage_emojis', 'Emojis verwalten', 'Kann Custom-Emojis hochladen und lÃ¶schen', 'system'),
  ('manage_scheduled_posts', 'Geplante Posts verwalten', 'Kann Posts planen und verwalten', 'system'),
  
  -- Channels
  ('create_channels', 'Channels erstellen', 'Kann neue Channels erstellen', 'channels'),
  ('edit_channels', 'Channels bearbeiten', 'Kann Channel-Einstellungen Ã¤ndern', 'channels'),
  ('delete_channels', 'Channels lÃ¶schen', 'Kann Channels lÃ¶schen', 'channels'),
  ('manage_categories', 'Kategorien verwalten', 'Kann Channel-Kategorien verwalten', 'channels'),
  
  -- Messages
  ('send_messages', 'Nachrichten senden', 'Kann Nachrichten in Channels senden', 'messages'),
  ('send_images', 'Bilder senden', 'Kann Bilder in Channels hochladen', 'messages'),
  ('send_files', 'Dateien senden', 'Kann Dateien in Channels hochladen', 'messages'),
  ('delete_any_message', 'Nachrichten lÃ¶schen', 'Kann beliebige Nachrichten lÃ¶schen', 'messages'),
  ('pin_messages', 'Nachrichten anpinnen', 'Kann Nachrichten anpinnen', 'messages'),
  ('edit_any_message', 'Nachrichten bearbeiten', 'Kann beliebige Nachrichten bearbeiten', 'messages'),
  
  -- Support
  ('view_all_tickets', 'Alle Tickets sehen', 'Kann alle Support-Tickets einsehen', 'support'),
  ('respond_tickets', 'Tickets beantworten', 'Kann auf Support-Tickets antworten', 'support'),
  ('close_tickets', 'Tickets schlieÃŸen', 'Kann Tickets schlieÃŸen', 'support'),
  ('assign_tickets', 'Tickets zuweisen', 'Kann Tickets anderen zuweisen', 'support'),
  
  -- Moderation
  ('mute_users', 'Benutzer stummschalten', 'Kann Benutzer temporÃ¤r stummschalten', 'moderation'),
  ('ban_users', 'Benutzer sperren', 'Kann Benutzer permanent sperren', 'moderation'),
  ('view_audit_log', 'Audit-Log sehen', 'Kann das AktivitÃ¤tsprotokoll einsehen', 'moderation'),
  
  -- Content
  ('approve_content', 'Inhalte freigeben', 'Kann eingereichte Inhalte freigeben', 'content'),
  ('manage_winning_product', 'Winning Product verwalten', 'Kann das Winning Product bearbeiten', 'content')
ON CONFLICT (name) DO NOTHING;

-- 18. STANDARD ROLLEN-BERECHTIGUNGEN ZUWEISEN
-- =============================================

-- Owner bekommt ALLE Berechtigungen
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'owner'
ON CONFLICT DO NOTHING;

-- Admin bekommt fast alle Berechtigungen (auÃŸer manage_roles, manage_settings)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'admin' AND p.name NOT IN ('manage_roles')
ON CONFLICT DO NOTHING;

-- Moderator Berechtigungen
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'moderator' AND p.name IN (
  'delete_any_message', 'pin_messages', 'mute_users', 'approve_content',
  'send_messages', 'send_images', 'send_files', 'view_analytics'
)
ON CONFLICT DO NOTHING;

-- Support-Team Berechtigungen
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'support' AND p.name IN (
  'view_all_tickets', 'respond_tickets', 'close_tickets', 'assign_tickets',
  'send_messages', 'send_images', 'send_files'
)
ON CONFLICT DO NOTHING;

-- VIP Berechtigungen
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'vip' AND p.name IN (
  'send_messages', 'send_images', 'send_files'
)
ON CONFLICT DO NOTHING;

-- Member Berechtigungen
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'member' AND p.name IN ('send_messages')
ON CONFLICT DO NOTHING;

-- Guest hat keine speziellen Berechtigungen (nur lesen)

-- 19. HELPER FUNCTION: Check if user has permission
-- =============================================
CREATE OR REPLACE FUNCTION public.user_has_permission(user_uuid UUID, permission_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = user_uuid 
      AND p.name = permission_name
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 20. HELPER FUNCTION: Get user's highest role
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_highest_role(user_uuid UUID)
RETURNS TABLE(role_name TEXT, hierarchy_level INTEGER, color TEXT, icon TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT r.name, r.hierarchy_level, r.color, r.icon
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  ORDER BY r.hierarchy_level DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 21. HELPER FUNCTION: Get all user permissions
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_uuid UUID)
RETURNS TABLE(permission_name TEXT, category TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.name, p.category
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON ur.role_id = rp.role_id
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = user_uuid
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 22. HELPER FUNCTION: Check channel permission for user
-- =============================================
CREATE OR REPLACE FUNCTION public.user_can_in_channel(user_uuid UUID, channel_uuid UUID, permission_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN := false;
BEGIN
  -- Check if user has any role with this permission in this channel
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.channel_role_permissions crp ON ur.role_id = crp.role_id
    WHERE ur.user_id = user_uuid 
      AND crp.channel_id = channel_uuid
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND (
        (permission_type = 'view' AND crp.can_view = true) OR
        (permission_type = 'send_messages' AND crp.can_send_messages = true) OR
        (permission_type = 'send_images' AND crp.can_send_images = true) OR
        (permission_type = 'send_files' AND crp.can_send_files = true) OR
        (permission_type = 'delete_messages' AND crp.can_delete_messages = true) OR
        (permission_type = 'pin_messages' AND crp.can_pin_messages = true) OR
        (permission_type = 'manage_channel' AND crp.can_manage_channel = true)
      )
  ) INTO has_permission;
  
  -- If no channel-specific permission, check global permissions
  IF NOT has_permission THEN
    IF permission_type = 'view' THEN
      has_permission := true; -- Everyone can view by default
    ELSIF permission_type IN ('send_messages', 'send_images', 'send_files') THEN
      has_permission := public.user_has_permission(user_uuid, permission_type);
    ELSIF permission_type = 'delete_messages' THEN
      has_permission := public.user_has_permission(user_uuid, 'delete_any_message');
    ELSIF permission_type = 'manage_channel' THEN
      has_permission := public.user_has_permission(user_uuid, 'edit_channels');
    END IF;
  END IF;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 23. TRIGGER: Auto-create user profile on user creation
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_profile ON public.users;
CREATE TRIGGER on_user_created_profile
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- 24. TRIGGER: Auto-assign member role to new users
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
DECLARE
  member_role_id UUID;
BEGIN
  SELECT id INTO member_role_id FROM public.roles WHERE name = 'member';
  IF member_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, member_role_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_role ON public.users;
CREATE TRIGGER on_user_created_role
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 25. Update existing users - add member role and create profiles
-- =============================================
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id 
FROM public.users u, public.roles r 
WHERE r.name = 'member'
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_profiles (user_id)
SELECT id FROM public.users
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.user_id = users.id)
ON CONFLICT DO NOTHING;

-- 26. Give owner role to existing admins
-- =============================================
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id 
FROM public.users u, public.roles r 
WHERE u.role = 'admin' AND r.name = 'owner'
ON CONFLICT DO NOTHING;

-- 27. Enable Realtime for new tables
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;


-- ========== END 012_roles_permissions_system.sql ==========

-- =============================================
-- ERWEITERTES ROLLEN- UND BERECHTIGUNGSSYSTEM V2
-- =============================================
-- Dieses Update erweitert das bestehende System mit:
-- - Activity Logging / Audit Trail
-- - Erweiterte Profil-Features (Achievements, Badges, Stats)
-- - Benutzer-Notizen fÃ¼r Admins
-- - TemporÃ¤re Mutes/Bans
-- - Online-Status Tracking
-- - Erweiterte Channel-Statistiken

-- =============================================
-- 1. USER ACTIVITY LOG (Audit Trail)
-- =============================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_category TEXT NOT NULL DEFAULT 'general',
  target_type TEXT,
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON public.activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_category ON public.activity_log(action_category);

-- =============================================
-- 2. USER ACHIEVEMENTS / BADGES
-- =============================================
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'award',
  color TEXT DEFAULT '#95BF47',
  category TEXT DEFAULT 'general',
  points INTEGER DEFAULT 10,
  is_secret BOOLEAN DEFAULT false,
  requirements JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);

-- =============================================
-- 3. USER STATS (fÃ¼r Gamification)
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  total_messages INTEGER DEFAULT 0,
  total_reactions_given INTEGER DEFAULT 0,
  total_reactions_received INTEGER DEFAULT 0,
  total_files_uploaded INTEGER DEFAULT 0,
  total_login_days INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  level INTEGER DEFAULT 1,
  experience_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_user ON public.user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_level ON public.user_stats(level DESC);

-- =============================================
-- 4. ADMIN USER NOTES (Private Notizen Ã¼ber User)
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'info',
  is_important BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notes_user ON public.user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_author ON public.user_notes(author_id);

-- =============================================
-- 5. USER WARNINGS / MODERATION ACTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  issued_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  warning_type TEXT NOT NULL DEFAULT 'warning',
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_warnings_user ON public.user_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_warnings_active ON public.user_warnings(is_active) WHERE is_active = true;

-- =============================================
-- 6. ERWEITERTE USERS TABELLE
-- =============================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_warnings INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES public.users(id);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS online_status TEXT DEFAULT 'offline';

-- =============================================
-- 7. ERWEITERTE USER_PROFILES TABELLE
-- =============================================
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS pronouns TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Berlin';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS social_discord TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS social_linkedin TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS social_github TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS social_website TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS about_me TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS interests TEXT[];
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS skills TEXT[];
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS show_birthday BOOLEAN DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS show_location BOOLEAN DEFAULT true;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS privacy_profile_visibility TEXT DEFAULT 'public';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS notification_mentions BOOLEAN DEFAULT true;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS notification_replies BOOLEAN DEFAULT true;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS notification_new_content BOOLEAN DEFAULT true;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#95BF47';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS profile_effect TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS featured_achievement_id UUID REFERENCES public.achievements(id);

-- =============================================
-- 8. ROLES TABELLE ERWEITERN
-- =============================================
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS permissions_summary TEXT;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS max_file_size_mb INTEGER DEFAULT 10;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS daily_message_limit INTEGER;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_use_custom_emojis BOOLEAN DEFAULT true;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_mention_everyone BOOLEAN DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS priority_support BOOLEAN DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS custom_badge_text TEXT;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS custom_badge_color TEXT;

-- =============================================
-- 9. ONLINE STATUS TRACKING
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'offline',
  custom_status TEXT,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  current_channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  is_typing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_presence_status ON public.user_presence(status);
CREATE INDEX IF NOT EXISTS idx_user_presence_heartbeat ON public.user_presence(last_heartbeat);

-- =============================================
-- 10. CHANNEL STATISTICS
-- =============================================
CREATE TABLE IF NOT EXISTS public.channel_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL UNIQUE REFERENCES public.channels(id) ON DELETE CASCADE,
  total_messages INTEGER DEFAULT 0,
  total_members INTEGER DEFAULT 0,
  active_today INTEGER DEFAULT 0,
  active_week INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  peak_concurrent_users INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_stats_channel ON public.channel_stats(channel_id);

-- =============================================
-- 11. ZUSÃ„TZLICHE PERMISSIONS EINFÃœGEN
-- =============================================
INSERT INTO public.permissions (name, display_name, description, category) VALUES
  -- Erweiterte System-Permissions
  ('manage_achievements', 'Achievements verwalten', 'Kann Achievements erstellen und vergeben', 'system'),
  ('view_activity_log', 'AktivitÃ¤tslog ansehen', 'Kann das System-AktivitÃ¤tslog einsehen', 'system'),
  ('manage_user_notes', 'Benutzernotizen verwalten', 'Kann private Notizen Ã¼ber Benutzer erstellen', 'system'),
  ('impersonate_users', 'Als Benutzer ausgeben', 'Kann sich als anderer Benutzer einloggen (Ghost Mode)', 'system'),
  ('bypass_rate_limits', 'Rate-Limits umgehen', 'Ist von Rate-Limits ausgenommen', 'system'),
  ('export_data', 'Daten exportieren', 'Kann Benutzerdaten und Statistiken exportieren', 'system'),
  
  -- Erweiterte Moderation
  ('issue_warnings', 'Verwarnungen aussprechen', 'Kann Benutzern Verwarnungen erteilen', 'moderation'),
  ('revoke_warnings', 'Verwarnungen zurÃ¼cknehmen', 'Kann Verwarnungen entfernen', 'moderation'),
  ('temporary_mute', 'TemporÃ¤r stummschalten', 'Kann Benutzer zeitweise stummschalten', 'moderation'),
  ('view_user_history', 'Benutzerhistorie einsehen', 'Kann die komplette Historie eines Benutzers sehen', 'moderation'),
  
  -- Content Management
  ('feature_content', 'Inhalte hervorheben', 'Kann Inhalte als Featured markieren', 'content'),
  ('manage_announcements', 'AnkÃ¼ndigungen verwalten', 'Kann systemweite AnkÃ¼ndigungen erstellen', 'content'),
  
  -- Support Erweiterungen
  ('priority_ticket_access', 'PrioritÃ¤ts-Tickets', 'Hat Zugang zu PrioritÃ¤ts-Support', 'support'),
  ('view_ticket_history', 'Ticket-Historie einsehen', 'Kann gesamte Ticket-Historie sehen', 'support')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 12. ERWEITERTE ROLE-PERMISSION ZUWEISUNGEN
-- =============================================

-- Owner bekommt alle neuen Permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'owner' AND p.name IN (
  'manage_achievements', 'view_activity_log', 'manage_user_notes', 
  'impersonate_users', 'bypass_rate_limits', 'export_data',
  'issue_warnings', 'revoke_warnings', 'temporary_mute', 'view_user_history',
  'feature_content', 'manage_announcements', 'priority_ticket_access', 'view_ticket_history'
)
ON CONFLICT DO NOTHING;

-- Admin bekommt die meisten neuen Permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'admin' AND p.name IN (
  'manage_achievements', 'view_activity_log', 'manage_user_notes',
  'bypass_rate_limits', 'export_data',
  'issue_warnings', 'revoke_warnings', 'temporary_mute', 'view_user_history',
  'feature_content', 'manage_announcements', 'view_ticket_history'
)
ON CONFLICT DO NOTHING;

-- Moderator Permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'moderator' AND p.name IN (
  'view_activity_log', 'issue_warnings', 'temporary_mute', 
  'view_user_history', 'feature_content'
)
ON CONFLICT DO NOTHING;

-- Support Team
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'support' AND p.name IN ('view_ticket_history')
ON CONFLICT DO NOTHING;

-- VIP bekommt Priority Support
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'vip' AND p.name IN ('priority_ticket_access')
ON CONFLICT DO NOTHING;

-- =============================================
-- 13. STANDARD ACHIEVEMENTS ERSTELLEN
-- =============================================
INSERT INTO public.achievements (name, display_name, description, icon, color, category, points, is_secret, requirements) VALUES
  ('first_message', 'Erste Nachricht', 'Hat die erste Nachricht geschrieben', 'message-circle', '#95BF47', 'community', 10, false, '{"messages": 1}'),
  ('message_10', 'Aktives Mitglied', 'Hat 10 Nachrichten geschrieben', 'messages-square', '#3498DB', 'community', 25, false, '{"messages": 10}'),
  ('message_100', 'Stammgast', 'Hat 100 Nachrichten geschrieben', 'message-square-text', '#9B59B6', 'community', 50, false, '{"messages": 100}'),
  ('message_1000', 'Legende', 'Hat 1000 Nachrichten geschrieben', 'crown', '#FFD700', 'community', 200, false, '{"messages": 1000}'),
  ('streak_7', 'Woche dabei', '7 Tage am StÃ¼ck aktiv', 'flame', '#FF6B35', 'engagement', 30, false, '{"streak": 7}'),
  ('streak_30', 'Monat dabei', '30 Tage am StÃ¼ck aktiv', 'zap', '#F39C12', 'engagement', 100, false, '{"streak": 30}'),
  ('streak_100', 'Unaufhaltsam', '100 Tage am StÃ¼ck aktiv', 'rocket', '#E74C3C', 'engagement', 500, true, '{"streak": 100}'),
  ('first_purchase', 'Supporter', 'Erster Kauf getÃ¤tigt', 'shopping-bag', '#95BF47', 'premium', 50, false, '{"purchases": 1}'),
  ('vip_member', 'VIP Status', 'VIP-Mitgliedschaft erreicht', 'star', '#FFD700', 'premium', 100, false, '{"role": "vip"}'),
  ('helpful', 'Hilfreich', 'Wurde als hilfreich markiert', 'heart', '#E91E63', 'community', 25, false, '{"helpful_count": 5}'),
  ('early_adopter', 'Early Adopter', 'War von Anfang an dabei', 'award', '#8E44AD', 'special', 100, true, '{"join_date_before": "2026-06-01"}'),
  ('verified', 'Verifiziert', 'Account wurde verifiziert', 'badge-check', '#2196F3', 'special', 50, false, '{"verified": true}')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- 14. RLS POLICIES FÃœR NEUE TABELLEN
-- =============================================

-- Activity Log
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own activity" ON public.activity_log;
CREATE POLICY "Users view own activity" ON public.activity_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all activity" ON public.activity_log;
CREATE POLICY "Admins view all activity" ON public.activity_log
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "System can insert activity" ON public.activity_log;
CREATE POLICY "System can insert activity" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- Achievements
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view achievements" ON public.achievements;
CREATE POLICY "Everyone can view achievements" ON public.achievements
  FOR SELECT TO authenticated USING (is_secret = false OR EXISTS (
    SELECT 1 FROM public.user_achievements ua WHERE ua.achievement_id = achievements.id AND ua.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins manage achievements" ON public.achievements;
CREATE POLICY "Admins manage achievements" ON public.achievements
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Everyone can view earned achievements" ON public.user_achievements;
CREATE POLICY "Everyone can view earned achievements" ON public.user_achievements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "System grants achievements" ON public.user_achievements;
CREATE POLICY "System grants achievements" ON public.user_achievements
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    ) OR user_id = auth.uid()
  );

-- User Stats
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view stats" ON public.user_stats;
CREATE POLICY "Everyone can view stats" ON public.user_stats
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "System updates stats" ON public.user_stats;
CREATE POLICY "System updates stats" ON public.user_stats
  FOR ALL TO authenticated USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
  ));

-- User Notes
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage notes" ON public.user_notes;
CREATE POLICY "Admins manage notes" ON public.user_notes
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin', 'moderator', 'support')
    )
  );

-- User Warnings
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own warnings" ON public.user_warnings;
CREATE POLICY "Users view own warnings" ON public.user_warnings
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage warnings" ON public.user_warnings;
CREATE POLICY "Admins manage warnings" ON public.user_warnings
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin', 'moderator')
    )
  );

-- User Presence
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view presence" ON public.user_presence;
CREATE POLICY "Everyone can view presence" ON public.user_presence
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users update own presence" ON public.user_presence;
CREATE POLICY "Users update own presence" ON public.user_presence
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Channel Stats
ALTER TABLE public.channel_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view channel stats" ON public.channel_stats;
CREATE POLICY "Everyone can view channel stats" ON public.channel_stats
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "System updates channel stats" ON public.channel_stats;
CREATE POLICY "System updates channel stats" ON public.channel_stats
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- =============================================
-- 15. HELPER FUNCTIONS
-- =============================================

-- Log Activity Function
CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id UUID,
  p_action_type TEXT,
  p_action_category TEXT DEFAULT 'general',
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.activity_log (user_id, action_type, action_category, target_type, target_id, details)
  VALUES (p_user_id, p_action_type, p_action_category, p_target_type, p_target_id, p_details)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update User Stats Function
CREATE OR REPLACE FUNCTION public.update_user_stats(p_user_id UUID, p_stat_type TEXT, p_increment INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_stats (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  CASE p_stat_type
    WHEN 'messages' THEN
      UPDATE public.user_stats SET total_messages = total_messages + p_increment, updated_at = NOW() WHERE user_id = p_user_id;
    WHEN 'reactions_given' THEN
      UPDATE public.user_stats SET total_reactions_given = total_reactions_given + p_increment, updated_at = NOW() WHERE user_id = p_user_id;
    WHEN 'reactions_received' THEN
      UPDATE public.user_stats SET total_reactions_received = total_reactions_received + p_increment, updated_at = NOW() WHERE user_id = p_user_id;
    WHEN 'files' THEN
      UPDATE public.user_stats SET total_files_uploaded = total_files_uploaded + p_increment, updated_at = NOW() WHERE user_id = p_user_id;
    WHEN 'experience' THEN
      UPDATE public.user_stats SET experience_points = experience_points + p_increment, updated_at = NOW() WHERE user_id = p_user_id;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check and Grant Achievement Function
CREATE OR REPLACE FUNCTION public.check_achievements(p_user_id UUID)
RETURNS SETOF TEXT AS $$
DECLARE
  v_achievement RECORD;
  v_stats RECORD;
  v_granted TEXT;
BEGIN
  SELECT * INTO v_stats FROM public.user_stats WHERE user_id = p_user_id;
  
  FOR v_achievement IN SELECT * FROM public.achievements LOOP
    IF NOT EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = p_user_id AND achievement_id = v_achievement.id) THEN
      -- Check message achievements
      IF v_achievement.requirements->>'messages' IS NOT NULL AND 
         v_stats.total_messages >= (v_achievement.requirements->>'messages')::INTEGER THEN
        INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (p_user_id, v_achievement.id);
        v_granted := v_achievement.name;
        RETURN NEXT v_granted;
      END IF;
      
      -- Check streak achievements
      IF v_achievement.requirements->>'streak' IS NOT NULL AND 
         v_stats.current_streak >= (v_achievement.requirements->>'streak')::INTEGER THEN
        INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (p_user_id, v_achievement.id);
        v_granted := v_achievement.name;
        RETURN NEXT v_granted;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update User Level Function
CREATE OR REPLACE FUNCTION public.calculate_user_level(p_experience INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN FLOOR(SQRT(p_experience / 100)) + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update Online Status Function
CREATE OR REPLACE FUNCTION public.update_presence(p_user_id UUID, p_status TEXT DEFAULT 'online')
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_presence (user_id, status, last_heartbeat)
  VALUES (p_user_id, p_status, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET status = p_status, last_heartbeat = NOW();
  
  UPDATE public.users SET last_seen_at = NOW(), online_status = p_status WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get User Full Profile Function
CREATE OR REPLACE FUNCTION public.get_user_full_profile(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'user', row_to_json(u.*),
    'profile', row_to_json(up.*),
    'stats', row_to_json(us.*),
    'roles', (SELECT jsonb_agg(row_to_json(r.*)) FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = p_user_id),
    'achievements', (SELECT jsonb_agg(row_to_json(a.*)) FROM public.user_achievements ua JOIN public.achievements a ON ua.achievement_id = a.id WHERE ua.user_id = p_user_id),
    'highest_role', (SELECT row_to_json(r.*) FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id WHERE ur.user_id = p_user_id ORDER BY r.hierarchy_level DESC LIMIT 1)
  ) INTO v_result
  FROM public.users u
  LEFT JOIN public.user_profiles up ON u.id = up.user_id
  LEFT JOIN public.user_stats us ON u.id = us.user_id
  WHERE u.id = p_user_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 16. TRIGGERS
-- =============================================

-- Trigger: Create user stats on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO public.user_presence (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_stats ON public.users;
CREATE TRIGGER on_user_created_stats
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_stats();

-- Trigger: Update stats on message
CREATE OR REPLACE FUNCTION public.handle_new_message_stats()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.update_user_stats(NEW.user_id, 'messages', 1);
  PERFORM public.update_user_stats(NEW.user_id, 'experience', 5);
  
  -- Update channel stats
  INSERT INTO public.channel_stats (channel_id, total_messages, last_message_at)
  VALUES (NEW.channel_id, 1, NOW())
  ON CONFLICT (channel_id) 
  DO UPDATE SET total_messages = channel_stats.total_messages + 1, last_message_at = NOW(), updated_at = NOW();
  
  -- Check achievements
  PERFORM public.check_achievements(NEW.user_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_created_stats ON public.messages;
CREATE TRIGGER on_message_created_stats
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message_stats();

-- Trigger: Log user login
CREATE OR REPLACE FUNCTION public.handle_user_login_streak()
RETURNS TRIGGER AS $$
DECLARE
  v_last_date DATE;
  v_current_date DATE := CURRENT_DATE;
BEGIN
  SELECT last_active_date INTO v_last_date FROM public.user_stats WHERE user_id = NEW.id;
  
  IF v_last_date IS NULL THEN
    UPDATE public.user_stats SET 
      last_active_date = v_current_date,
      total_login_days = 1,
      current_streak = 1,
      longest_streak = 1
    WHERE user_id = NEW.id;
  ELSIF v_last_date = v_current_date - INTERVAL '1 day' THEN
    UPDATE public.user_stats SET 
      last_active_date = v_current_date,
      total_login_days = total_login_days + 1,
      current_streak = current_streak + 1,
      longest_streak = GREATEST(longest_streak, current_streak + 1)
    WHERE user_id = NEW.id;
  ELSIF v_last_date < v_current_date - INTERVAL '1 day' THEN
    UPDATE public.user_stats SET 
      last_active_date = v_current_date,
      total_login_days = total_login_days + 1,
      current_streak = 1
    WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 17. CREATE STATS FOR EXISTING USERS
-- =============================================
INSERT INTO public.user_stats (user_id)
SELECT id FROM public.users
WHERE NOT EXISTS (SELECT 1 FROM public.user_stats us WHERE us.user_id = users.id)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_presence (user_id)
SELECT id FROM public.users
WHERE NOT EXISTS (SELECT 1 FROM public.user_presence up WHERE up.user_id = users.id)
ON CONFLICT DO NOTHING;

-- =============================================
-- 18. CREATE CHANNEL STATS FOR EXISTING CHANNELS
-- =============================================
INSERT INTO public.channel_stats (channel_id, total_messages, last_message_at)
SELECT 
  c.id,
  (SELECT COUNT(*) FROM public.messages m WHERE m.channel_id = c.id),
  (SELECT MAX(created_at) FROM public.messages m WHERE m.channel_id = c.id)
FROM public.channels c
WHERE NOT EXISTS (SELECT 1 FROM public.channel_stats cs WHERE cs.channel_id = c.id)
ON CONFLICT DO NOTHING;

-- =============================================
-- 19. ENABLE REALTIME FOR NEW TABLES
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_achievements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;


-- ========== END 013_enhanced_roles_system.sql ==========

-- =============================================
-- ERWEITERTES PRODUKT-SYSTEM
-- =============================================
-- Features:
-- - Mehrere Produkte mit eigenen Bereichen
-- - Dynamische Varianten (Nischen) pro Produkt
-- - Flexible Preisstufen (Initial, Upsell, etc.)
-- - Credits als Zahlungsmethode
-- - Externe Payment Links
-- - VollstÃ¤ndig anpassbare Buttons

-- =============================================
-- 1. PRODUKTE TABELLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  image_url TEXT,
  badge_text TEXT,
  badge_color TEXT DEFAULT '#95BF47',
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  -- Display Settings
  show_in_menu BOOLEAN DEFAULT true,
  show_variant_selector BOOLEAN DEFAULT true,
  show_price_comparison BOOLEAN DEFAULT true,
  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active) WHERE is_active = true;

-- =============================================
-- 2. PRODUKT-VARIANTEN (Nischen)
-- =============================================
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'package',
  color TEXT DEFAULT '#95BF47',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);

-- =============================================
-- 3. PREISSTUFEN
-- =============================================
CREATE TABLE IF NOT EXISTS public.product_price_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL,
  tier_order INTEGER NOT NULL DEFAULT 0,
  -- Pricing
  price_amount DECIMAL(10,2) NOT NULL,
  price_currency TEXT DEFAULT 'EUR',
  compare_price DECIMAL(10,2),
  -- Credits Option
  credits_price INTEGER,
  allow_credits BOOLEAN DEFAULT false,
  -- Button Settings
  button_text TEXT NOT NULL,
  button_color TEXT DEFAULT '#95BF47',
  button_icon TEXT DEFAULT 'shopping-cart',
  -- Requirements
  requires_previous_tier BOOLEAN DEFAULT false,
  previous_tier_id UUID REFERENCES public.product_price_tiers(id),
  -- Meta
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_tiers_product ON public.product_price_tiers(product_id);

-- =============================================
-- 4. VARIANTEN-PREIS-LINKS (Jede Variante hat eigene Links pro Preisstufe)
-- =============================================
CREATE TABLE IF NOT EXISTS public.variant_price_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  price_tier_id UUID NOT NULL REFERENCES public.product_price_tiers(id) ON DELETE CASCADE,
  checkout_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(variant_id, price_tier_id)
);

CREATE INDEX IF NOT EXISTS idx_variant_links_variant ON public.variant_price_links(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_links_tier ON public.variant_price_links(price_tier_id);

-- =============================================
-- 5. ZAHLUNGSMETHODEN
-- =============================================
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'credit-card',
  color TEXT DEFAULT '#95BF47',
  -- Configuration
  method_type TEXT NOT NULL DEFAULT 'external_link',
  config JSONB DEFAULT '{}',
  -- Status
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. PRODUKT-ZAHLUNGSMETHODEN ZUORDNUNG
-- =============================================
CREATE TABLE IF NOT EXISTS public.product_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(product_id, payment_method_id)
);

-- =============================================
-- 7. ERWEITERTE USER PURCHASES
-- =============================================
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id);
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS price_tier_id UUID REFERENCES public.product_price_tiers(id);
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS credits_used INTEGER DEFAULT 0;
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- =============================================
-- 8. PRODUKT-INHALTE (Downloads, Resources)
-- =============================================
CREATE TABLE IF NOT EXISTS public.product_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  price_tier_id UUID REFERENCES public.product_price_tiers(id) ON DELETE SET NULL,
  -- Content
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL DEFAULT 'download',
  content_url TEXT,
  content_data JSONB DEFAULT '{}',
  -- Access Control
  requires_purchase BOOLEAN DEFAULT true,
  min_tier_order INTEGER DEFAULT 0,
  -- Display
  icon TEXT DEFAULT 'file',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_content_product ON public.product_content(product_id);
CREATE INDEX IF NOT EXISTS idx_product_content_variant ON public.product_content(variant_id);

-- =============================================
-- 9. RLS POLICIES
-- =============================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_price_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_content ENABLE ROW LEVEL SECURITY;

-- Products - Everyone can view active
DROP POLICY IF EXISTS "Everyone views active products" ON public.products;
CREATE POLICY "Everyone views active products" ON public.products
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products" ON public.products
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Variants - Everyone can view
DROP POLICY IF EXISTS "Everyone views variants" ON public.product_variants;
CREATE POLICY "Everyone views variants" ON public.product_variants
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage variants" ON public.product_variants;
CREATE POLICY "Admins manage variants" ON public.product_variants
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Price Tiers
DROP POLICY IF EXISTS "Everyone views price tiers" ON public.product_price_tiers;
CREATE POLICY "Everyone views price tiers" ON public.product_price_tiers
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage price tiers" ON public.product_price_tiers;
CREATE POLICY "Admins manage price tiers" ON public.product_price_tiers
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Variant Links
DROP POLICY IF EXISTS "Everyone views variant links" ON public.variant_price_links;
CREATE POLICY "Everyone views variant links" ON public.variant_price_links
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage variant links" ON public.variant_price_links;
CREATE POLICY "Admins manage variant links" ON public.variant_price_links
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Payment Methods
DROP POLICY IF EXISTS "Everyone views payment methods" ON public.payment_methods;
CREATE POLICY "Everyone views payment methods" ON public.payment_methods
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage payment methods" ON public.payment_methods;
CREATE POLICY "Admins manage payment methods" ON public.payment_methods
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Product Payment Methods
DROP POLICY IF EXISTS "Everyone views product payment methods" ON public.product_payment_methods;
CREATE POLICY "Everyone views product payment methods" ON public.product_payment_methods
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage product payment methods" ON public.product_payment_methods;
CREATE POLICY "Admins manage product payment methods" ON public.product_payment_methods
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Product Content
DROP POLICY IF EXISTS "Users view accessible content" ON public.product_content;
CREATE POLICY "Users view accessible content" ON public.product_content
  FOR SELECT TO authenticated USING (
    is_active = true AND (
      requires_purchase = false OR
      EXISTS (
        SELECT 1 FROM public.user_purchases up
        JOIN public.product_price_tiers ppt ON up.price_tier_id = ppt.id
        WHERE up.user_id = auth.uid()
          AND up.product_id = product_content.product_id
          AND (product_content.variant_id IS NULL OR up.variant_id = product_content.variant_id)
          AND ppt.tier_order >= product_content.min_tier_order
      ) OR
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins manage content" ON public.product_content;
CREATE POLICY "Admins manage content" ON public.product_content
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 10. HELPER FUNCTIONS
-- =============================================

-- Check if user has purchased a product tier
CREATE OR REPLACE FUNCTION public.user_has_product_tier(
  p_user_id UUID,
  p_product_id UUID,
  p_min_tier_order INTEGER DEFAULT 0,
  p_variant_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_purchases up
    JOIN public.product_price_tiers ppt ON up.price_tier_id = ppt.id
    WHERE up.user_id = p_user_id
      AND up.product_id = p_product_id
      AND ppt.tier_order >= p_min_tier_order
      AND (p_variant_id IS NULL OR up.variant_id = p_variant_id)
      AND up.status = 'completed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's highest tier for a product
CREATE OR REPLACE FUNCTION public.get_user_product_tier(
  p_user_id UUID,
  p_product_id UUID,
  p_variant_id UUID DEFAULT NULL
)
RETURNS TABLE(tier_id UUID, tier_name TEXT, tier_order INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT ppt.id, ppt.tier_name, ppt.tier_order
  FROM public.user_purchases up
  JOIN public.product_price_tiers ppt ON up.price_tier_id = ppt.id
  WHERE up.user_id = p_user_id
    AND up.product_id = p_product_id
    AND (p_variant_id IS NULL OR up.variant_id = p_variant_id)
    AND up.status = 'completed'
  ORDER BY ppt.tier_order DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Purchase with credits
CREATE OR REPLACE FUNCTION public.purchase_with_credits(
  p_user_id UUID,
  p_product_id UUID,
  p_variant_id UUID,
  p_price_tier_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_credits_price INTEGER;
  v_user_credits INTEGER;
  v_purchase_id UUID;
BEGIN
  -- Get credits price
  SELECT credits_price INTO v_credits_price
  FROM public.product_price_tiers
  WHERE id = p_price_tier_id AND allow_credits = true;

  IF v_credits_price IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credits nicht erlaubt fÃ¼r diese Preisstufe');
  END IF;

  -- Get user credits
  SELECT credits INTO v_user_credits FROM public.users WHERE id = p_user_id;

  IF v_user_credits < v_credits_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nicht genÃ¼gend Credits', 'required', v_credits_price, 'available', v_user_credits);
  END IF;

  -- Deduct credits
  UPDATE public.users SET credits = credits - v_credits_price WHERE id = p_user_id;

  -- Create purchase
  INSERT INTO public.user_purchases (user_id, product_id, variant_id, price_tier_id, payment_method, credits_used, purchase_type, status)
  VALUES (p_user_id, p_product_id, p_variant_id, p_price_tier_id, 'credits', v_credits_price, 'initial', 'completed')
  RETURNING id INTO v_purchase_id;

  RETURN jsonb_build_object('success', true, 'purchase_id', v_purchase_id, 'credits_used', v_credits_price);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 11. DEFAULT DATA
-- =============================================

-- Default Payment Methods
INSERT INTO public.payment_methods (name, display_name, description, icon, color, method_type, config, order_index) VALUES
  ('external_link', 'Externer Link', 'Weiterleitung zu externem Checkout', 'external-link', '#95BF47', 'external_link', '{}', 1),
  ('credits', 'Credits', 'Mit Hub-Credits bezahlen', 'coins', '#FFD700', 'credits', '{}', 2),
  ('stripe', 'Stripe', 'Kreditkarte via Stripe', 'credit-card', '#635BFF', 'stripe', '{}', 3),
  ('paypal', 'PayPal', 'PayPal Checkout', 'paypal', '#003087', 'paypal', '{}', 4)
ON CONFLICT DO NOTHING;

-- Migrate existing winning_product to new system
DO $$
DECLARE
  v_channel RECORD;
  v_product_id UUID;
  v_tier1_id UUID;
  v_tier2_id UUID;
  v_variant_id UUID;
  v_settings JSONB;
BEGIN
  -- Get existing winning product channel
  SELECT * INTO v_channel FROM public.channels WHERE type = 'winning_product' LIMIT 1;
  
  IF v_channel IS NOT NULL THEN
    v_settings := v_channel.settings::JSONB;
    
    -- Create product
    INSERT INTO public.products (name, slug, description, is_active, is_featured)
    VALUES (
      'Winning Product',
      'winning-product',
      COALESCE(v_settings->>'description', 'Exklusives Winning Product'),
      true,
      true
    )
    RETURNING id INTO v_product_id;

    -- Create price tiers
    INSERT INTO public.product_price_tiers (product_id, tier_name, tier_order, price_amount, button_text, button_color)
    VALUES (
      v_product_id,
      'Erstkauf',
      0,
      COALESCE((v_settings->>'initial_price')::DECIMAL, 1.95),
      'Jetzt freischalten',
      '#95BF47'
    )
    RETURNING id INTO v_tier1_id;

    INSERT INTO public.product_price_tiers (product_id, tier_name, tier_order, price_amount, button_text, button_color, requires_previous_tier, previous_tier_id)
    VALUES (
      v_product_id,
      'Upsell',
      1,
      COALESCE((v_settings->>'upsell_price')::DECIMAL, 4.95),
      'Upsell sichern',
      '#9B59B6',
      true,
      v_tier1_id
    )
    RETURNING id INTO v_tier2_id;

    -- Create default variant
    INSERT INTO public.product_variants (product_id, name, description, icon, color)
    VALUES (v_product_id, 'Standard', 'Standard Variante', 'package', '#95BF47')
    RETURNING id INTO v_variant_id;

    -- Create variant links if URLs exist
    IF v_settings->>'initial_checkout_url' IS NOT NULL AND v_settings->>'initial_checkout_url' != '' THEN
      INSERT INTO public.variant_price_links (variant_id, price_tier_id, checkout_url)
      VALUES (v_variant_id, v_tier1_id, v_settings->>'initial_checkout_url');
    END IF;

    IF v_settings->>'upsell_checkout_url' IS NOT NULL AND v_settings->>'upsell_checkout_url' != '' THEN
      INSERT INTO public.variant_price_links (variant_id, price_tier_id, checkout_url)
      VALUES (v_variant_id, v_tier2_id, v_settings->>'upsell_checkout_url');
    END IF;

    -- Link payment methods
    INSERT INTO public.product_payment_methods (product_id, payment_method_id)
    SELECT v_product_id, id FROM public.payment_methods WHERE name IN ('external_link', 'credits');
  END IF;
END $$;

-- =============================================
-- 12. MESSAGE REACTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON public.message_reactions(user_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone views reactions" ON public.message_reactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users manage own reactions" ON public.message_reactions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================
-- 13. REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_purchases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;


-- ========== END 014_advanced_product_system.sql ==========

-- =============================================
-- BROSPIFY HUB - KOMPLETTES DATENBANK-SYSTEM
-- =============================================
-- Diese Migration enthÃ¤lt ALLES was du brauchst:
-- 1. Rollen & Berechtigungen (vereinfacht & logisch)
-- 2. Produkt-System mit Varianten & Preisstufen
-- 3. Stats, Achievements & Gamification
-- 4. Chat-Verbesserungen (Reaktionen)
-- 5. Activity Logging

-- =============================================
-- TEIL 1: ROLLEN-SYSTEM (VEREINFACHT)
-- =============================================
-- Die Channel-Einstellungen (allow_user_text etc.) werden 
-- ERSETZT durch das Rollen-System. Eine einzige Quelle der Wahrheit!

-- Rollen-Tabelle (falls nicht existiert)
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#808080',
  icon TEXT DEFAULT 'user',
  hierarchy_level INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  is_assignable BOOLEAN DEFAULT true,
  -- Globale FÃ¤higkeiten dieser Rolle
  can_send_messages BOOLEAN DEFAULT true,
  can_send_images BOOLEAN DEFAULT false,
  can_send_files BOOLEAN DEFAULT false,
  can_create_channels BOOLEAN DEFAULT false,
  can_moderate BOOLEAN DEFAULT false,
  can_manage_users BOOLEAN DEFAULT false,
  can_access_admin BOOLEAN DEFAULT false,
  max_file_size_mb INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-Rollen VerknÃ¼pfung
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, role_id)
);

-- Channel-Rollen-Ãœberschreibungen (NUR wenn Channel spezielle Regeln hat)
-- Wenn hier KEIN Eintrag ist, gelten die globalen Rollen-Rechte
CREATE TABLE IF NOT EXISTS public.channel_role_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  -- NULL = Standard-Rollenrecht nutzen, true/false = Ã¼berschreiben
  can_view BOOLEAN DEFAULT true,
  can_send_messages BOOLEAN,
  can_send_images BOOLEAN,
  can_send_files BOOLEAN,
  UNIQUE(channel_id, role_id)
);

-- User-Profile erweitern
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  about_me TEXT,
  website TEXT,
  location TEXT,
  birthday DATE,
  gender TEXT,
  pronouns TEXT,
  timezone TEXT DEFAULT 'Europe/Berlin',
  -- Social Links
  social_twitter TEXT,
  social_instagram TEXT,
  social_youtube TEXT,
  social_tiktok TEXT,
  social_discord TEXT,
  social_linkedin TEXT,
  social_github TEXT,
  -- Settings
  notification_email BOOLEAN DEFAULT true,
  notification_push BOOLEAN DEFAULT true,
  notification_sound BOOLEAN DEFAULT true,
  notification_mentions BOOLEAN DEFAULT true,
  theme_preference TEXT DEFAULT 'system',
  language TEXT DEFAULT 'de',
  -- Privacy
  privacy_show_online BOOLEAN DEFAULT true,
  privacy_show_activity BOOLEAN DEFAULT true,
  privacy_allow_dms BOOLEAN DEFAULT true,
  privacy_profile_visibility TEXT DEFAULT 'public',
  show_birthday BOOLEAN DEFAULT false,
  show_location BOOLEAN DEFAULT true,
  -- Customization
  accent_color TEXT DEFAULT '#95BF47',
  custom_status TEXT,
  custom_status_emoji TEXT,
  interests TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TEIL 2: STANDARD-ROLLEN EINFÃœGEN
-- =============================================
INSERT INTO public.roles (name, display_name, description, color, icon, hierarchy_level, is_system, is_assignable, can_send_messages, can_send_images, can_send_files, can_create_channels, can_moderate, can_manage_users, can_access_admin) VALUES
  ('owner', 'Inhaber', 'VollstÃ¤ndige Kontrolle', '#FFD700', 'crown', 100, true, false, true, true, true, true, true, true, true),
  ('admin', 'Administrator', 'Volle Verwaltungsrechte', '#FF4444', 'shield', 80, true, true, true, true, true, true, true, true, true),
  ('moderator', 'Moderator', 'Kann Inhalte moderieren', '#9B59B6', 'shield-check', 60, true, true, true, true, true, false, true, false, true),
  ('support', 'Support-Team', 'Kann Support-Tickets bearbeiten', '#3498DB', 'headphones', 50, true, true, true, true, true, false, false, false, true),
  ('vip', 'VIP-Mitglied', 'Premium-Mitglied', '#F39C12', 'star', 40, true, true, true, true, false, false, false, false, false),
  ('member', 'Mitglied', 'RegulÃ¤res Mitglied', '#95BF47', 'user', 20, true, true, true, false, false, false, false, false, false),
  ('guest', 'Gast', 'EingeschrÃ¤nkte Rechte', '#808080', 'eye', 10, true, true, false, false, false, false, false, false, false)
ON CONFLICT (name) DO UPDATE SET
  can_send_messages = EXCLUDED.can_send_messages,
  can_send_images = EXCLUDED.can_send_images,
  can_send_files = EXCLUDED.can_send_files,
  can_create_channels = EXCLUDED.can_create_channels,
  can_moderate = EXCLUDED.can_moderate,
  can_manage_users = EXCLUDED.can_manage_users,
  can_access_admin = EXCLUDED.can_access_admin;

-- =============================================
-- TEIL 3: PRODUKT-SYSTEM
-- =============================================

-- Produkte
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  image_url TEXT,
  badge_text TEXT,
  badge_color TEXT DEFAULT '#95BF47',
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  show_in_menu BOOLEAN DEFAULT true,
  show_variant_selector BOOLEAN DEFAULT true,
  show_price_comparison BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Produkt-Varianten (Nischen)
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'package',
  color TEXT DEFAULT '#95BF47',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Preisstufen
CREATE TABLE IF NOT EXISTS public.product_price_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL,
  tier_order INTEGER NOT NULL DEFAULT 0,
  price_amount DECIMAL(10,2) NOT NULL,
  price_currency TEXT DEFAULT 'EUR',
  compare_price DECIMAL(10,2),
  credits_price INTEGER,
  allow_credits BOOLEAN DEFAULT false,
  button_text TEXT NOT NULL DEFAULT 'Jetzt kaufen',
  button_color TEXT DEFAULT '#95BF47',
  requires_previous_tier BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checkout-Links pro Variante & Preisstufe
CREATE TABLE IF NOT EXISTS public.variant_price_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  price_tier_id UUID NOT NULL REFERENCES public.product_price_tiers(id) ON DELETE CASCADE,
  checkout_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(variant_id, price_tier_id)
);

-- Zahlungsmethoden
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'credit-card',
  color TEXT DEFAULT '#95BF47',
  method_type TEXT NOT NULL DEFAULT 'external_link',
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Standard Zahlungsmethoden
INSERT INTO public.payment_methods (name, display_name, description, icon, color, method_type, order_index) VALUES
  ('external_link', 'Externer Link', 'Weiterleitung zu externem Checkout', 'external-link', '#95BF47', 'external_link', 1),
  ('credits', 'Credits', 'Mit Hub-Credits bezahlen', 'coins', '#FFD700', 'credits', 2)
ON CONFLICT (name) DO NOTHING;

-- User Purchases erweitern
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id);
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS price_tier_id UUID REFERENCES public.product_price_tiers(id);
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS credits_used INTEGER DEFAULT 0;
ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- =============================================
-- TEIL 4: STATS & GAMIFICATION
-- =============================================

-- User Stats
CREATE TABLE IF NOT EXISTS public.user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  total_messages INTEGER DEFAULT 0,
  total_reactions_given INTEGER DEFAULT 0,
  total_reactions_received INTEGER DEFAULT 0,
  total_files_uploaded INTEGER DEFAULT 0,
  total_login_days INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  level INTEGER DEFAULT 1,
  experience_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Achievements
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'award',
  color TEXT DEFAULT '#95BF47',
  category TEXT DEFAULT 'general',
  points INTEGER DEFAULT 10,
  is_secret BOOLEAN DEFAULT false,
  requirements JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Achievements
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Standard Achievements
INSERT INTO public.achievements (name, display_name, description, icon, color, category, points, requirements) VALUES
  ('first_message', 'Erste Nachricht', 'Hat die erste Nachricht geschrieben', 'message-circle', '#95BF47', 'community', 10, '{"messages": 1}'),
  ('message_10', 'Aktives Mitglied', 'Hat 10 Nachrichten geschrieben', 'messages-square', '#3498DB', 'community', 25, '{"messages": 10}'),
  ('message_100', 'Stammgast', 'Hat 100 Nachrichten geschrieben', 'message-square-text', '#9B59B6', 'community', 50, '{"messages": 100}'),
  ('streak_7', 'Woche dabei', '7 Tage am StÃ¼ck aktiv', 'flame', '#FF6B35', 'engagement', 30, '{"streak": 7}'),
  ('streak_30', 'Monat dabei', '30 Tage am StÃ¼ck aktiv', 'zap', '#F39C12', 'engagement', 100, '{"streak": 30}'),
  ('first_purchase', 'Supporter', 'Erster Kauf getÃ¤tigt', 'shopping-bag', '#95BF47', 'premium', 50, '{"purchases": 1}')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- TEIL 5: CHAT-VERBESSERUNGEN
-- =============================================

-- Message Reaktionen
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Activity Log
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_category TEXT NOT NULL DEFAULT 'general',
  target_type TEXT,
  target_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Notes (Admin-Notizen Ã¼ber User)
CREATE TABLE IF NOT EXISTS public.user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'info',
  is_important BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Warnings
CREATE TABLE IF NOT EXISTS public.user_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  issued_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  warning_type TEXT NOT NULL DEFAULT 'warning',
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TEIL 6: USERS TABELLE ERWEITERN
-- =============================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS primary_role_id UUID REFERENCES public.roles(id);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS online_status TEXT DEFAULT 'offline';

-- =============================================
-- TEIL 7: CHANNELS VEREINFACHEN
-- =============================================
-- Entferne die alten User-Berechtigungsfelder (werden durch Rollen ersetzt)
-- Die Spalten bleiben fÃ¼r KompatibilitÃ¤t, werden aber ignoriert
-- Neue Channels nutzen nur noch das Rollen-System

-- Channel-Settings aufrÃ¤umen: Diese Felder werden DEPRECATED
-- allow_user_text, allow_user_images, allow_user_files
-- Stattdessen: channel_role_overrides Tabelle nutzen

-- =============================================
-- TEIL 8: INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_channel_role_overrides_channel ON public.channel_role_overrides(channel_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_price_tiers_product ON public.product_price_tiers(product_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_user ON public.user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);

-- =============================================
-- TEIL 9: RLS POLICIES
-- =============================================

-- Roles
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can view roles" ON public.roles;
CREATE POLICY "Everyone can view roles" ON public.roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage roles" ON public.roles;
CREATE POLICY "Admins manage roles" ON public.roles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- User Roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can view user roles" ON public.user_roles;
CREATE POLICY "Everyone can view user roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage user roles" ON public.user_roles;
CREATE POLICY "Admins manage user roles" ON public.user_roles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Channel Role Overrides
ALTER TABLE public.channel_role_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can view channel overrides" ON public.channel_role_overrides;
CREATE POLICY "Everyone can view channel overrides" ON public.channel_role_overrides FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage channel overrides" ON public.channel_role_overrides;
CREATE POLICY "Admins manage channel overrides" ON public.channel_role_overrides FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- User Profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view profiles" ON public.user_profiles;
CREATE POLICY "Users view profiles" ON public.user_profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users manage own profile" ON public.user_profiles;
CREATE POLICY "Users manage own profile" ON public.user_profiles FOR ALL TO authenticated 
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins manage profiles" ON public.user_profiles;
CREATE POLICY "Admins manage profiles" ON public.user_profiles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone views products" ON public.products;
CREATE POLICY "Everyone views products" ON public.products FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products" ON public.products FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Product Variants
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone views variants" ON public.product_variants;
CREATE POLICY "Everyone views variants" ON public.product_variants FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage variants" ON public.product_variants;
CREATE POLICY "Admins manage variants" ON public.product_variants FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Price Tiers
ALTER TABLE public.product_price_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone views tiers" ON public.product_price_tiers;
CREATE POLICY "Everyone views tiers" ON public.product_price_tiers FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage tiers" ON public.product_price_tiers;
CREATE POLICY "Admins manage tiers" ON public.product_price_tiers FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Variant Links
ALTER TABLE public.variant_price_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone views links" ON public.variant_price_links;
CREATE POLICY "Everyone views links" ON public.variant_price_links FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage links" ON public.variant_price_links;
CREATE POLICY "Admins manage links" ON public.variant_price_links FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Payment Methods
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone views methods" ON public.payment_methods;
CREATE POLICY "Everyone views methods" ON public.payment_methods FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage methods" ON public.payment_methods;
CREATE POLICY "Admins manage methods" ON public.payment_methods FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- User Stats
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone views stats" ON public.user_stats;
CREATE POLICY "Everyone views stats" ON public.user_stats FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "System manages stats" ON public.user_stats;
CREATE POLICY "System manages stats" ON public.user_stats FOR ALL TO authenticated USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Achievements
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone views achievements" ON public.achievements;
CREATE POLICY "Everyone views achievements" ON public.achievements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage achievements" ON public.achievements;
CREATE POLICY "Admins manage achievements" ON public.achievements FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- User Achievements
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone views user achievements" ON public.user_achievements;
CREATE POLICY "Everyone views user achievements" ON public.user_achievements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "System grants achievements" ON public.user_achievements;
CREATE POLICY "System grants achievements" ON public.user_achievements FOR INSERT TO authenticated WITH CHECK (true);

-- Message Reactions
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone views reactions" ON public.message_reactions;
CREATE POLICY "Everyone views reactions" ON public.message_reactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users manage own reactions" ON public.message_reactions;
CREATE POLICY "Users manage own reactions" ON public.message_reactions FOR ALL TO authenticated 
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Activity Log
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view activity" ON public.activity_log;
CREATE POLICY "Admins view activity" ON public.activity_log FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "System inserts activity" ON public.activity_log;
CREATE POLICY "System inserts activity" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- User Notes
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage notes" ON public.user_notes;
CREATE POLICY "Admins manage notes" ON public.user_notes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- User Warnings
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own warnings" ON public.user_warnings;
CREATE POLICY "Users view own warnings" ON public.user_warnings FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins manage warnings" ON public.user_warnings;
CREATE POLICY "Admins manage warnings" ON public.user_warnings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- =============================================
-- TEIL 10: HELPER FUNCTIONS
-- =============================================

-- PrÃ¼ft ob User eine bestimmte Berechtigung in einem Channel hat
CREATE OR REPLACE FUNCTION public.user_can_in_channel(
  p_user_id UUID,
  p_channel_id UUID,
  p_permission TEXT -- 'send_messages', 'send_images', 'send_files'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_role TEXT;
  v_role RECORD;
  v_override RECORD;
  v_result BOOLEAN;
BEGIN
  -- Admins kÃ¶nnen immer alles
  SELECT role INTO v_user_role FROM public.users WHERE id = p_user_id;
  IF v_user_role = 'admin' THEN RETURN true; END IF;

  -- Hole die hÃ¶chste Rolle des Users
  SELECT r.* INTO v_role
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  ORDER BY r.hierarchy_level DESC
  LIMIT 1;

  -- Wenn keine Rolle, dann Member-Defaults
  IF v_role IS NULL THEN
    SELECT * INTO v_role FROM public.roles WHERE name = 'member';
  END IF;

  -- Hole Channel-Override (falls vorhanden)
  SELECT * INTO v_override
  FROM public.channel_role_overrides
  WHERE channel_id = p_channel_id AND role_id = v_role.id;

  -- Bestimme Ergebnis basierend auf Permission
  CASE p_permission
    WHEN 'send_messages' THEN
      v_result := COALESCE(v_override.can_send_messages, v_role.can_send_messages);
    WHEN 'send_images' THEN
      v_result := COALESCE(v_override.can_send_images, v_role.can_send_images);
    WHEN 'send_files' THEN
      v_result := COALESCE(v_override.can_send_files, v_role.can_send_files);
    ELSE
      v_result := false;
  END CASE;

  RETURN COALESCE(v_result, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Credits-Kauf
CREATE OR REPLACE FUNCTION public.purchase_with_credits(
  p_user_id UUID,
  p_product_id UUID,
  p_variant_id UUID,
  p_price_tier_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_credits_price INTEGER;
  v_user_credits INTEGER;
  v_purchase_id UUID;
BEGIN
  SELECT credits_price INTO v_credits_price
  FROM public.product_price_tiers
  WHERE id = p_price_tier_id AND allow_credits = true;

  IF v_credits_price IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credits nicht erlaubt');
  END IF;

  SELECT credits INTO v_user_credits FROM public.users WHERE id = p_user_id;

  IF v_user_credits < v_credits_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nicht genÃ¼gend Credits');
  END IF;

  UPDATE public.users SET credits = credits - v_credits_price WHERE id = p_user_id;

  INSERT INTO public.user_purchases (user_id, product_id, variant_id, price_tier_id, payment_method, credits_used, status)
  VALUES (p_user_id, p_product_id, p_variant_id, p_price_tier_id, 'credits', v_credits_price, 'completed')
  RETURNING id INTO v_purchase_id;

  RETURN jsonb_build_object('success', true, 'purchase_id', v_purchase_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TEIL 11: TRIGGERS
-- =============================================

-- Auto-create user stats
CREATE OR REPLACE FUNCTION public.handle_new_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_profiles (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  -- Assign default member role
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT NEW.id, id FROM public.roles WHERE name = 'member'
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_setup ON public.users;
CREATE TRIGGER on_user_created_setup
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_stats();

-- =============================================
-- TEIL 12: INIT DATA FOR EXISTING USERS
-- =============================================

-- Create stats for existing users
INSERT INTO public.user_stats (user_id)
SELECT id FROM public.users
WHERE NOT EXISTS (SELECT 1 FROM public.user_stats WHERE user_stats.user_id = users.id)
ON CONFLICT DO NOTHING;

-- Create profiles for existing users
INSERT INTO public.user_profiles (user_id)
SELECT id FROM public.users
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.user_id = users.id)
ON CONFLICT DO NOTHING;

-- Assign member role to users without roles
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM public.users u
CROSS JOIN public.roles r
WHERE r.name = 'member'
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
ON CONFLICT DO NOTHING;

-- Assign admin role to admin users
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM public.users u
CROSS JOIN public.roles r
WHERE u.role = 'admin' AND r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Also assign owner role to the admin
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM public.users u
CROSS JOIN public.roles r
WHERE u.role = 'admin' AND r.name = 'owner'
ON CONFLICT DO NOTHING;

-- =============================================
-- TEIL 13: REALTIME
-- =============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_stats;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ========== END 015_complete_system.sql ==========

-- =============================================
-- BROSPIFY HUB - MEGA UPDATE MIGRATION
-- =============================================
-- EnthÃ¤lt: Slash-Commands, Ticket-Kategorien, Archiv, App-Logo-Einstellungen

-- =============================================
-- 1. APP SETTINGS ERWEITERN
-- =============================================
INSERT INTO public.app_settings (key, value) VALUES
  ('app_logo_url', ''),
  ('app_favicon_url', ''),
  ('app_primary_color', '#95BF47'),
  ('app_secondary_color', ''),
  ('welcome_title', 'Willkommen zurÃ¼ck!'),
  ('welcome_text', 'SchÃ¶n, dass du da bist.'),
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

-- Beispiel-Befehle
INSERT INTO public.slash_commands (name, description, trigger, action_type, action_value, order_index) VALUES
  ('hilfe', 'Hilfe anzeigen', '/hilfe', 'route', '{"path": "/support"}', 1),
  ('dashboard', 'Zum Dashboard', '/dashboard', 'route', '{"path": "/dashboard"}', 2),
  ('tickets', 'Tickets Ã¶ffnen', '/tickets', 'route', '{"path": "/tickets"}', 3)
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

DROP POLICY IF EXISTS "Everyone views ticket categories" ON public.ticket_categories;
CREATE POLICY "Everyone views ticket categories" ON public.ticket_categories
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage ticket categories" ON public.ticket_categories;
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


-- ========== END 016_mega_update.sql ==========

-- Allow admins to upload to app/ and products/ (and any path); normal users only to their user-id folder
DROP POLICY IF EXISTS "Allow uploads for authenticated users" ON storage.objects;

CREATE POLICY "Allow uploads for authenticated users" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    )
  );


-- ========== END 017_storage_admin_uploads.sql ==========

-- Optional: Video-URL und PDF-URL pro Produkt
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pdf_url TEXT;

COMMENT ON COLUMN public.products.video_url IS 'Optionale Video-URL (z.B. Vorschau, ErklÃ¤rung)';
COMMENT ON COLUMN public.products.pdf_url IS 'Optionale PDF-URL (z.B. Anleitung, BroschÃ¼re)';


-- ========== END 018_products_video_pdf_url.sql ==========

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


-- ========== END 019_users_public_number.sql ==========

-- Kategorie fÃ¼r Gruppierung in der Admin-Konsole (Navigation, User, Tickets, â€¦)
ALTER TABLE public.slash_commands
  ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN public.slash_commands.category IS 'Gruppe fÃ¼r Anzeige: z.B. Navigation, User, Tickets, Einstellungen';


-- ========== END 020_slash_commands_category.sql ==========

-- =============================================
-- BROSPIFY HUB - LIZENZ-KEY ZUM TESTEN (User-Login)
-- =============================================
-- Mindestens einen Key eintragen, damit sich Nutzer mit Lizenz-Key einloggen koennen.
-- Weitere Keys kannst du im Admin unter "Lizenzen" anlegen.
INSERT INTO public.internal_keys (key_value, is_active) VALUES
  ('TEST-KEY-2025', true)
ON CONFLICT (key_value) DO NOTHING;

-- =============================================
-- ADMIN EINRICHTEN (nach dem ersten Lauf)
-- =============================================
-- 1. Im Supabase Dashboard: Authentication -> Users -> "Add user" (E-Mail + Passwort)
-- 2. Die User-UUID kopieren
-- 3. In einer NEUEN Abfrage ausfuehren (ersetzt UUID_HIER durch die echte UUID):
--    UPDATE public.users SET role = 'admin' WHERE id = 'UUID_HIER';
-- 4. Login in der App mit dem Admin-Master-Key (steht im Code, z.B. HAT-JONAS)

