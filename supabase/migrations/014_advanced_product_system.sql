-- =============================================
-- ERWEITERTES PRODUKT-SYSTEM
-- =============================================
-- Features:
-- - Mehrere Produkte mit eigenen Bereichen
-- - Dynamische Varianten (Nischen) pro Produkt
-- - Flexible Preisstufen (Initial, Upsell, etc.)
-- - Credits als Zahlungsmethode
-- - Externe Payment Links
-- - Vollständig anpassbare Buttons

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
CREATE POLICY "Everyone views active products" ON public.products
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admins manage products" ON public.products
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Variants - Everyone can view
CREATE POLICY "Everyone views variants" ON public.product_variants
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admins manage variants" ON public.product_variants
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Price Tiers
CREATE POLICY "Everyone views price tiers" ON public.product_price_tiers
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admins manage price tiers" ON public.product_price_tiers
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Variant Links
CREATE POLICY "Everyone views variant links" ON public.variant_price_links
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admins manage variant links" ON public.variant_price_links
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Payment Methods
CREATE POLICY "Everyone views payment methods" ON public.payment_methods
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admins manage payment methods" ON public.payment_methods
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Product Payment Methods
CREATE POLICY "Everyone views product payment methods" ON public.product_payment_methods
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admins manage product payment methods" ON public.product_payment_methods
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Product Content
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
    RETURN jsonb_build_object('success', false, 'error', 'Credits nicht erlaubt für diese Preisstufe');
  END IF;

  -- Get user credits
  SELECT credits INTO v_user_credits FROM public.users WHERE id = p_user_id;

  IF v_user_credits < v_credits_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nicht genügend Credits', 'required', v_credits_price, 'available', v_user_credits);
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
