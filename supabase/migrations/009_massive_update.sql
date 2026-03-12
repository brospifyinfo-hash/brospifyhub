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
  'Exklusives Winning Product für Premium-Mitglieder',
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
CREATE POLICY "Users can view own conversations" ON public.support_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversations" ON public.support_conversations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.support_helpers WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create own conversation" ON public.support_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow all for support_conversations" ON public.support_conversations
  FOR ALL USING (true) WITH CHECK (true);

-- Support Messages Policies
CREATE POLICY "Users can view messages in own conversations" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_conversations 
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all messages" ON public.support_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.support_helpers WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can send messages" ON public.support_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Allow all for support_messages" ON public.support_messages
  FOR ALL USING (true) WITH CHECK (true);

-- Support Helpers Policies
CREATE POLICY "Admins can manage helpers" ON public.support_helpers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Helpers can view themselves" ON public.support_helpers
  FOR SELECT USING (user_id = auth.uid());

-- App Settings Policies
CREATE POLICY "Anyone can read app settings" ON public.app_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage app settings" ON public.app_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 9. Enable Realtime for new tables
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
