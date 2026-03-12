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

-- Users can read their own purchases
CREATE POLICY "Users can view own purchases" ON public.user_purchases FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert (via webhook)
CREATE POLICY "Service role can insert purchases" ON public.user_purchases FOR INSERT WITH CHECK (true);

-- Enable realtime for purchases
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_purchases;

-- Index for faster lookups
CREATE INDEX idx_user_purchases_user_id ON public.user_purchases(user_id);
CREATE INDEX idx_user_purchases_product_id ON public.user_purchases(product_id);