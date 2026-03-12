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
CREATE POLICY "Admins full access to permissions" ON public.user_channel_permissions FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins full access to scheduled_posts" ON public.scheduled_posts FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins full access to emojis" ON public.custom_emojis FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins full access to quick_replies" ON public.quick_replies FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins full access to tutorial_steps" ON public.tutorial_steps FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Users can read emojis and tutorial steps
CREATE POLICY "Users can read emojis" ON public.custom_emojis FOR SELECT USING (true);
CREATE POLICY "Users can read tutorial_steps" ON public.tutorial_steps FOR SELECT USING (true);

-- Users can manage their own tutorial progress
CREATE POLICY "Users manage own tutorial progress" ON public.user_tutorial_progress FOR ALL USING (auth.uid() = user_id);

-- Users can read their own permissions
CREATE POLICY "Users can read own permissions" ON public.user_channel_permissions FOR SELECT USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_channel_permissions_user ON public.user_channel_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_permissions_channel ON public.user_channel_permissions(channel_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled ON public.scheduled_posts(scheduled_for) WHERE NOT is_posted;
CREATE INDEX IF NOT EXISTS idx_messages_approval ON public.messages(is_approved) WHERE NOT is_approved;