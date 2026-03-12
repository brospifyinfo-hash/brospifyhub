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
CREATE POLICY "Users view own tickets" ON public.tickets
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can see all tickets
CREATE POLICY "Admins view all tickets" ON public.tickets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can create tickets
CREATE POLICY "Users create tickets" ON public.tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users and admins can update tickets
CREATE POLICY "Users update own tickets" ON public.tickets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins update all tickets" ON public.tickets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Ticket messages policies
CREATE POLICY "Users view own ticket messages" ON public.ticket_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tickets WHERE id = ticket_id AND user_id = auth.uid())
    AND is_internal = false
  );

CREATE POLICY "Admins view all ticket messages" ON public.ticket_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users send ticket messages" ON public.ticket_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (SELECT 1 FROM public.tickets WHERE id = ticket_id AND user_id = auth.uid())
    AND is_internal = false
  );

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

CREATE POLICY "Anyone can view categories" ON public.channel_categories
  FOR SELECT USING (true);

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

CREATE POLICY "Users view own devices" ON public.user_devices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all devices" ON public.user_devices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role needs full access for login flow
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
