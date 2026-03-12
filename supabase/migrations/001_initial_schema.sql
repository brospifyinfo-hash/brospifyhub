-- =============================================
-- Initial Schema for Discord-Style Chat App
-- =============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  license_key TEXT UNIQUE,
  display_name TEXT,
  credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Channels table
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('support', 'winning_product', 'standard')),
  settings JSONB DEFAULT '{"posting_enabled": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes for Performance
-- =============================================
CREATE INDEX idx_messages_channel ON public.messages(channel_id);
CREATE INDEX idx_messages_created ON public.messages(created_at DESC);
CREATE INDEX idx_messages_user ON public.messages(user_id);
CREATE INDEX idx_channels_type ON public.channels(type);

-- =============================================
-- Enable Row Level Security
-- =============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies for Users
-- =============================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================
-- RLS Policies for Channels
-- =============================================

-- All authenticated users can view channels
CREATE POLICY "Authenticated users can view channels"
  ON public.channels FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can create channels
CREATE POLICY "Admins can create channels"
  ON public.channels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can update channels
CREATE POLICY "Admins can update channels"
  ON public.channels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can delete channels
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

-- All authenticated users can view messages
CREATE POLICY "Authenticated users can view messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (true);

-- Users can create messages if posting is enabled for the channel
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

-- Users can update their own messages
CREATE POLICY "Users can update own messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages, admins can delete any
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
  VALUES (NEW.id, 'user', 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Seed Data: Default Channels
-- =============================================
INSERT INTO public.channels (name, type, settings) VALUES
  ('General', 'standard', '{"posting_enabled": true}'),
  ('Support', 'support', '{"posting_enabled": true}'),
  ('Winning Products', 'winning_product', '{"posting_enabled": false}');
