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

-- Only admins can manage keys
CREATE POLICY "Admins can manage keys" ON public.internal_keys FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Service role can check and assign keys (for login)
CREATE POLICY "Service role full access" ON public.internal_keys FOR ALL 
  USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_internal_keys_value ON public.internal_keys(key_value);
CREATE INDEX IF NOT EXISTS idx_internal_keys_assigned ON public.internal_keys(is_assigned);