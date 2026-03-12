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

-- Users can see their own favorites
CREATE POLICY "Users view own favorites" ON public.user_favorites
  FOR SELECT USING (auth.uid() = user_id);

-- Users can add favorites
CREATE POLICY "Users add favorites" ON public.user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can remove their favorites
CREATE POLICY "Users remove favorites" ON public.user_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- Admins full access
CREATE POLICY "Admins full favorites" ON public.user_favorites
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
