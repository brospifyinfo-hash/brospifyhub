"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, ShoppingCart, Check, ChevronRight, Star, Sparkles, Zap,
  Award, Gift, Tag, Coins, ExternalLink, Download, Lock, Crown,
  ArrowRight, CheckCircle, Clock, Shield, Heart, TrendingUp, Video
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type {
  Product, ProductVariant, ProductPriceTier, VariantPriceLink,
  UserProductPurchase
} from "@/types/database";

const VARIANT_ICONS: Record<string, any> = {
  package: Package,
  star: Star,
  zap: Zap,
  award: Award,
  gift: Gift,
  tag: Tag,
};

interface ProductWithAll extends Product {
  variants: (ProductVariant & { links: VariantPriceLink[] })[];
  priceTiers: ProductPriceTier[];
}

interface Props {
  productSlug?: string;
  productId?: string;
  userId?: string;
}

export function ProductShowcase({ productSlug, productId, userId: userIdProp }: Props) {
  const [userId, setUserId] = useState<string | null>(userIdProp ?? null);
  const [product, setProduct] = useState<ProductWithAll | null>(null);
  const [userPurchases, setUserPurchases] = useState<UserProductPurchase[]>([]);
  const [userCredits, setUserCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  useEffect(() => {
    if (userIdProp) {
      setUserId(userIdProp);
      return;
    }
    let cancelled = false;
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session?.user?.id) setUserId(session.user.id);
      else if (!cancelled) setUserId("");
    });
    return () => { cancelled = true; };
  }, [userIdProp]);

  useEffect(() => {
    if (userId === null) return;
    fetchData();
  }, [productSlug, productId, userId]);

  const fetchData = async () => {
    const uid = userId ?? "";
    setLoading(true);
    const supabase = createClient();

    // Fetch product
    let productQuery = supabase.from("products").select("*");
    if (productSlug) {
      productQuery = productQuery.eq("slug", productSlug);
    } else if (productId) {
      productQuery = productQuery.eq("id", productId);
    }

    const { data: productData } = await productQuery.single();

    if (!productData) {
      setLoading(false);
      return;
    }

    // Fetch variants
    const { data: variantsData } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productData.id)
      .eq("is_active", true)
      .order("order_index");

    // Fetch price tiers
    const { data: tiersData } = await supabase
      .from("product_price_tiers")
      .select("*")
      .eq("product_id", productData.id)
      .eq("is_active", true)
      .order("tier_order");

    // Fetch variant links
    const variantIds = (variantsData || []).map((v: ProductVariant) => v.id);
    const { data: linksData } = await supabase
      .from("variant_price_links")
      .select("*")
      .in("variant_id", variantIds.length > 0 ? variantIds : ["none"])
      .eq("is_active", true);

    // Fetch user purchases
    const { data: purchasesData } = await supabase
      .from("user_purchases")
      .select("*")
      .eq("user_id", uid)
      .eq("product_id", productData.id);

    // Fetch user credits
    const { data: userData } = await supabase
      .from("users")
      .select("credits")
      .eq("id", uid)
      .single();

    // Combine data
    const variantsWithLinks = (variantsData || []).map((v: ProductVariant) => ({
      ...v,
      links: (linksData || []).filter((l: VariantPriceLink) => l.variant_id === v.id),
    }));

    setProduct({
      ...productData,
      variants: variantsWithLinks,
      priceTiers: tiersData || [],
    });
    setUserPurchases(purchasesData || []);
    setUserCredits(userData?.credits || 0);

    // Auto-select first variant
    if (variantsWithLinks.length > 0) {
      setSelectedVariant(variantsWithLinks[0].id);
    }

    setLoading(false);

    if (!uid) return;
    const channel = supabase
      .channel(`purchases-${uid}-${productData.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_purchases",
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          setUserPurchases((prev) => [...prev, payload.new as UserProductPurchase]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  // Get user's highest tier for selected variant
  const userHighestTier = useMemo(() => {
    if (!selectedVariant || !product) return null;

    const variantPurchases = userPurchases.filter(
      (p) => p.variant_id === selectedVariant && p.status === "completed"
    );

    if (variantPurchases.length === 0) return null;

    const purchasedTierIds = variantPurchases
      .map((p) => p.price_tier_id)
      .filter(Boolean);

    const purchasedTiers = product.priceTiers.filter((t) =>
      purchasedTierIds.includes(t.id)
    );

    if (purchasedTiers.length === 0) return null;

    return purchasedTiers.reduce((prev, curr) =>
      curr.tier_order > prev.tier_order ? curr : prev
    );
  }, [userPurchases, selectedVariant, product]);

  // Get available tiers for user
  const availableTiers = useMemo(() => {
    if (!product) return [];

    return product.priceTiers.map((tier) => {
      const purchased = userHighestTier && tier.tier_order <= userHighestTier.tier_order;
      const canPurchase =
        !purchased &&
        (!tier.requires_previous_tier ||
          (userHighestTier && tier.tier_order === userHighestTier.tier_order + 1) ||
          tier.tier_order === 0);

      return { ...tier, purchased, canPurchase };
    });
  }, [product, userHighestTier]);

  // Get checkout URL for selected variant and tier
  const getCheckoutUrl = (tierId: string) => {
    if (!selectedVariant || !product) return null;

    const variant = product.variants.find((v) => v.id === selectedVariant);
    if (!variant) return null;

    const link = variant.links.find((l) => l.price_tier_id === tierId);
    if (!link) return null;

    try {
      const url = new URL(link.checkout_url);
      url.searchParams.set("uid", userId);
      url.searchParams.set("vid", selectedVariant);
      url.searchParams.set("tid", tierId);
      return url.toString();
    } catch {
      return link.checkout_url;
    }
  };

  // Purchase with credits
  const purchaseWithCredits = async (tierId: string) => {
    if (!selectedVariant || !product) return;

    const tier = product.priceTiers.find((t) => t.id === tierId);
    if (!tier?.allow_credits || !tier.credits_price) return;

    if (userCredits < tier.credits_price) {
      alert("Nicht genügend Credits!");
      return;
    }

    setPurchasing(true);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("purchase_with_credits", {
      p_user_id: userId,
      p_product_id: product.id,
      p_variant_id: selectedVariant,
      p_price_tier_id: tierId,
    });

    if (error) {
      console.error("Purchase error:", error);
      alert("Fehler beim Kauf: " + error.message);
    } else if (data?.success) {
      setPurchaseSuccess(true);
      setUserCredits((prev) => prev - tier.credits_price!);
      setTimeout(() => setPurchaseSuccess(false), 3000);
      await fetchData();
    } else {
      alert(data?.error || "Unbekannter Fehler");
    }

    setPurchasing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Produkt nicht gefunden</h2>
        <p className="text-muted-foreground">Das angeforderte Produkt existiert nicht.</p>
      </div>
    );
  }

  const selectedVariantData = product.variants.find((v) => v.id === selectedVariant);
  const VariantIcon = selectedVariantData
    ? VARIANT_ICONS[selectedVariantData.icon] || Package
    : Package;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      {/* Success Toast */}
      <AnimatePresence>
        {purchaseSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-green-500 text-white shadow-lg flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Erfolgreich freigeschaltet!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        {/* Product Image or Icon */}
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-32 h-32 object-cover rounded-2xl mx-auto mb-6 shadow-lg"
          />
        ) : (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-24 h-24 mx-auto mb-6 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: product.badge_color + "20" }}
          >
            <Package className="w-12 h-12" style={{ color: product.badge_color }} />
          </motion.div>
        )}

        {/* Badge */}
        {product.badge_text && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block px-3 py-1 rounded-full text-sm font-medium text-white mb-4"
            style={{ backgroundColor: product.badge_color }}
          >
            {product.badge_text}
          </motion.span>
        )}

        <h1 className="text-3xl md:text-4xl font-bold text-foreground">{product.name}</h1>

        {product.short_description && (
          <p className="text-muted-foreground mt-2 text-lg">{product.short_description}</p>
        )}

        {/* User Credits */}
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
          <Coins className="w-4 h-4" />
          <span className="font-medium">{userCredits} Credits verfügbar</span>
        </div>
      </motion.div>

      {/* Description */}
      {product.description && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="content-card"
        >
          <div className="whitespace-pre-wrap text-foreground leading-relaxed">
            {product.description}
          </div>
        </motion.div>
      )}

      {/* Video & PDF Links */}
      {(product.video_url || product.pdf_url) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="content-card flex flex-wrap gap-3"
        >
          {product.video_url && (
            <a
              href={product.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
            >
              <Video className="w-5 h-5" />
              Video ansehen
            </a>
          )}
          {product.pdf_url && (
            <a
              href={product.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors font-medium"
            >
              <Download className="w-5 h-5" />
              PDF anzeigen
            </a>
          )}
        </motion.div>
      )}

      {/* Variant Selector */}
      {product.show_variant_selector && product.variants.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="content-card"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Wähle deine Nische
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {product.variants.map((variant) => {
              const Icon = VARIANT_ICONS[variant.icon] || Package;
              const isSelected = selectedVariant === variant.id;
              const hasPurchase = userPurchases.some(
                (p) => p.variant_id === variant.id && p.status === "completed"
              );

              return (
                <motion.button
                  key={variant.id}
                  onClick={() => setSelectedVariant(variant.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative p-4 rounded-xl text-center transition-all ${
                    isSelected
                      ? "ring-2 ring-primary bg-primary/5"
                      : "bg-muted/50 hover:bg-muted"
                  }`}
                >
                  {hasPurchase && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}

                  <div
                    className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center"
                    style={{ backgroundColor: variant.color + "20", color: variant.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-medium truncate">{variant.name}</p>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Price Tiers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          Preisstufen
        </h2>

        {availableTiers.map((tier, index) => {
          const checkoutUrl = getCheckoutUrl(tier.id);
          const isLocked = !tier.canPurchase && !tier.purchased;

          return (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + index * 0.1 }}
              className={`content-card relative overflow-hidden ${
                tier.purchased
                  ? "bg-green-500/5 border-green-500/20"
                  : tier.canPurchase
                  ? "bg-gradient-to-r from-primary/5 to-purple-500/5 border-primary/20"
                  : "opacity-60"
              }`}
            >
              {/* Locked Overlay */}
              {isLocked && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
                  <div className="text-center">
                    <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Kaufe erst die vorherige Stufe
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Tier Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="px-2 py-0.5 rounded-lg text-xs font-medium"
                      style={{ backgroundColor: tier.button_color + "20", color: tier.button_color }}
                    >
                      Stufe {tier.tier_order + 1}
                    </span>
                    <h3 className="font-semibold text-foreground">{tier.tier_name}</h3>
                    {tier.purchased && (
                      <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Freigeschaltet
                      </span>
                    )}
                  </div>

                  {/* Pricing */}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-2xl font-bold text-foreground">
                      {tier.price_amount.toFixed(2)} €
                    </span>
                    {tier.compare_price && product.show_price_comparison && (
                      <span className="text-lg text-muted-foreground line-through">
                        {tier.compare_price.toFixed(2)} €
                      </span>
                    )}
                    {tier.allow_credits && tier.credits_price && (
                      <span className="px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-sm flex items-center gap-1">
                        <Coins className="w-4 h-4" />
                        oder {tier.credits_price} Credits
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {!tier.purchased && tier.canPurchase && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* External Link Button */}
                    {checkoutUrl && (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          asChild
                          className="w-full sm:w-auto h-12 px-6 text-white"
                          style={{ backgroundColor: tier.button_color }}
                        >
                          <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                            {tier.button_text}
                            <ExternalLink className="w-4 h-4 ml-2" />
                          </a>
                        </Button>
                      </motion.div>
                    )}

                    {/* Credits Button */}
                    {tier.allow_credits && tier.credits_price && (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          onClick={() => purchaseWithCredits(tier.id)}
                          disabled={purchasing || userCredits < tier.credits_price}
                          variant="outline"
                          className="w-full sm:w-auto h-12 px-6 gap-2"
                        >
                          {purchasing ? (
                            <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                          ) : (
                            <>
                              <Coins className="w-4 h-4" />
                              {tier.credits_price} Credits
                            </>
                          )}
                        </Button>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Purchased State */}
                {tier.purchased && (
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle className="w-6 h-6" />
                    <span className="font-medium">Gekauft</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Benefits */}
      {!userHighestTier && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {[
            { icon: Clock, title: "Sofortiger Zugang", desc: "Nach Kauf direkt verfügbar" },
            { icon: Shield, title: "Sicher & Geschützt", desc: "Sichere Zahlungsabwicklung" },
            { icon: TrendingUp, title: "Updates inklusive", desc: "Neue Versionen kostenlos" },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="content-card text-center p-4"
            >
              <feature.icon className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="font-medium text-foreground">{feature.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Fully Unlocked State */}
      {userHighestTier && userHighestTier.tier_order === product.priceTiers.length - 1 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="content-card bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20 text-center py-8"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
            <Crown className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-2">Vollständig freigeschaltet!</h3>
          <p className="text-muted-foreground">
            Du hast vollen Zugriff auf alle Inhalte dieses Produkts.
          </p>
        </motion.div>
      )}
    </div>
  );
}
