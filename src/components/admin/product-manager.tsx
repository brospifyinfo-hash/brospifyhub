// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronRight,
  DollarSign, CreditCard, ExternalLink, Coins, Tag, Image, Eye, EyeOff,
  Star, ShoppingCart, Layers, Link as LinkIcon, Copy, Check, Palette,
  FileText, Download, Video, Globe, Settings, Zap, Award, Gift
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type {
  Product,
  ProductVariant,
  ProductPriceTier,
  VariantPriceLink,
  PaymentMethod,
  ProductContent,
  Database,
} from "@/types/database";

const VARIANT_ICONS = [
  { value: "package", label: "Paket", icon: Package },
  { value: "star", label: "Stern", icon: Star },
  { value: "zap", label: "Blitz", icon: Zap },
  { value: "award", label: "Auszeichnung", icon: Award },
  { value: "gift", label: "Geschenk", icon: Gift },
  { value: "tag", label: "Tag", icon: Tag },
];

const PRESET_COLORS = [
  "#95BF47", "#3498DB", "#E91E63", "#9B59B6", "#F39C12",
  "#1ABC9C", "#E74C3C", "#2ECC71", "#00BCD4", "#FF5722",
];

interface ProductWithAll extends Product {
  variants: (ProductVariant & { links: VariantPriceLink[] })[];
  priceTiers: ProductPriceTier[];
}

export function ProductManager() {
  const [products, setProducts] = useState<ProductWithAll[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithAll | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [editingTier, setEditingTier] = useState<ProductPriceTier | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "variants" | "pricing" | "content">("general");
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set());
  const [imageUploading, setImageUploading] = useState(false);
  const [imageDrag, setImageDrag] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

  // Product Form State
  const [productForm, setProductForm] = useState({
    name: "",
    slug: "",
    description: "",
    short_description: "",
    image_url: "",
    video_url: "",
    pdf_url: "",
    badge_text: "",
    badge_color: "#95BF47",
    is_active: true,
    is_featured: false,
    show_in_menu: true,
    show_variant_selector: true,
    show_price_comparison: true,
  });

  // Variant Form State
  const [variantForm, setVariantForm] = useState({
    name: "",
    description: "",
    icon: "package",
    color: "#95BF47",
    image_url: "",
  });

  // Tier Form State
  const [tierForm, setTierForm] = useState({
    tier_name: "",
    tier_order: 0,
    price_amount: 1.95,
    compare_price: null as number | null,
    credits_price: null as number | null,
    allow_credits: false,
    button_text: "Jetzt kaufen",
    button_color: "#95BF47",
    button_icon: "shopping-cart",
    requires_previous_tier: false,
    previous_tier_id: null as string | null,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();

    // Fetch products
    const { data: productsData } = await supabase
      .from("products")
      .select("*")
      .order("order_index");

    // Fetch variants
    const { data: variantsData } = await supabase
      .from("product_variants")
      .select("*")
      .order("order_index");

    // Fetch price tiers
    const { data: tiersData } = await supabase
      .from("product_price_tiers")
      .select("*")
      .order("tier_order");

    // Fetch variant links
    const { data: linksData } = await supabase
      .from("variant_price_links")
      .select("*");

    // Fetch payment methods
    const { data: methodsData } = await supabase
      .from("payment_methods")
      .select("*")
      .order("order_index");

    // Combine data
    const productsWithAll: ProductWithAll[] = (productsData || []).map((product: Product) => {
      const variants = (variantsData || [])
        .filter((v: ProductVariant) => v.product_id === product.id)
        .map((v: ProductVariant) => ({
          ...v,
          links: (linksData || []).filter((l: VariantPriceLink) => l.variant_id === v.id),
        }));

      const priceTiers = (tiersData || [])
        .filter((t: ProductPriceTier) => t.product_id === product.id);

      return { ...product, variants, priceTiers };
    });

    setProducts(productsWithAll);
    setPaymentMethods(methodsData || []);
    setLoading(false);
    return productsWithAll;
  };

  // Product CRUD
  const openProductModal = (product?: ProductWithAll) => {
    if (product) {
      setSelectedProduct(product);
      setProductForm({
        name: product.name,
        slug: product.slug,
        description: product.description || "",
        short_description: product.short_description || "",
        image_url: product.image_url || "",
        video_url: (product as Product).video_url ?? "",
        pdf_url: (product as Product).pdf_url ?? "",
        badge_text: product.badge_text || "",
        badge_color: product.badge_color,
        is_active: product.is_active,
        is_featured: product.is_featured,
        show_in_menu: product.show_in_menu,
        show_variant_selector: product.show_variant_selector,
        show_price_comparison: product.show_price_comparison,
      });
    } else {
      setSelectedProduct(null);
      setProductForm({
        name: "",
        slug: "",
        description: "",
        short_description: "",
        image_url: "",
        video_url: "",
        pdf_url: "",
        badge_text: "",
        badge_color: "#95BF47",
        is_active: true,
        is_featured: false,
        show_in_menu: true,
        show_variant_selector: true,
        show_price_comparison: true,
      });
    }
    setActiveTab("general");
    setShowProductModal(true);
    setProductError(null);
  };

  const saveProduct = async () => {
    setProductError(null);
    setSaving(true);
    const supabase = createClient();
    const slug = (productForm.slug || productForm.name.toLowerCase().replace(/\s+/g, "-")).trim();
    if (!slug) {
      setProductError("Slug darf nicht leer sein.");
      setSaving(false);
      return;
    }

    const { data: existingRow } = await supabase
      .from("products")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    const existing = existingRow as { id: string } | null;

    if (existing && existing.id !== selectedProduct?.id) {
      setProductError("Dieser Slug wird bereits von einem anderen Produkt verwendet.");
      setSaving(false);
      return;
    }

    if (selectedProduct && selectedProduct.variants.length === 0) {
      if (!confirm("Dieses Produkt hat noch keine Varianten. Trotzdem speichern? Später bitte mindestens eine Variante anlegen.")) {
        setSaving(false);
        return;
      }
    }

    const productData = {
      ...productForm,
      slug,
      video_url: productForm.video_url?.trim() || null,
      pdf_url: productForm.pdf_url?.trim() || null,
      updated_at: new Date().toISOString(),
    };

      if (selectedProduct) {
        const { error } = await (supabase as any)
          .from("products")
          .update(productData)
          .eq("id", selectedProduct.id);
      if (error) {
        setProductError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await (supabase as any).from("products").insert(productData);
      if (error) {
        setProductError(error.message);
        setSaving(false);
        return;
      }
    }

    await fetchData();
    setShowProductModal(false);
    setSaving(false);
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm("Produkt wirklich löschen? Alle Varianten und Preisstufen werden ebenfalls gelöscht.")) return;

    const supabase = createClient();
    await supabase.from("products").delete().eq("id", productId);
    await fetchData();
  };

  // Variant CRUD
  const openVariantModal = (variant?: ProductVariant) => {
    if (variant) {
      setEditingVariant(variant);
      setVariantForm({
        name: variant.name,
        description: variant.description || "",
        icon: variant.icon,
        color: variant.color,
        image_url: variant.image_url || "",
      });
    } else {
      setEditingVariant(null);
      setVariantForm({
        name: "",
        description: "",
        icon: "package",
        color: "#95BF47",
        image_url: "",
      });
    }
    setShowVariantModal(true);
  };

  const saveVariant = async () => {
    if (!selectedProduct) return;
    setSaving(true);
    const supabase = createClient();

    const variantData = {
      ...variantForm,
      product_id: selectedProduct.id,
    };

    if (editingVariant) {
      await supabase
        .from("product_variants")
        .update(variantData)
        .eq("id", editingVariant.id);
    } else {
      await supabase.from("product_variants").insert(variantData);
    }

    await fetchData();
    setShowVariantModal(false);
    setSaving(false);

    // Update selected product
    const updated = products.find((p) => p.id === selectedProduct.id);
    if (updated) setSelectedProduct(updated);
  };

  const deleteVariant = async (variantId: string) => {
    if (!confirm("Variante wirklich löschen?")) return;

    const supabase = createClient();
    await supabase.from("product_variants").delete().eq("id", variantId);
    await fetchData();
  };

  // Price Tier CRUD
  const openTierModal = (tier?: ProductPriceTier) => {
    if (tier) {
      setEditingTier(tier);
      setTierForm({
        tier_name: tier.tier_name,
        tier_order: tier.tier_order,
        price_amount: tier.price_amount,
        compare_price: tier.compare_price,
        credits_price: tier.credits_price,
        allow_credits: tier.allow_credits,
        button_text: tier.button_text,
        button_color: tier.button_color,
        button_icon: tier.button_icon,
        requires_previous_tier: tier.requires_previous_tier,
        previous_tier_id: tier.previous_tier_id,
      });
    } else {
      setEditingTier(null);
      const nextOrder = selectedProduct?.priceTiers.length || 0;
      setTierForm({
        tier_name: "",
        tier_order: nextOrder,
        price_amount: 1.95,
        compare_price: null,
        credits_price: null,
        allow_credits: false,
        button_text: "Jetzt kaufen",
        button_color: "#95BF47",
        button_icon: "shopping-cart",
        requires_previous_tier: nextOrder > 0,
        previous_tier_id: selectedProduct?.priceTiers[nextOrder - 1]?.id || null,
      });
    }
    setShowTierModal(true);
  };

  const saveTier = async () => {
    if (!selectedProduct) return;
    setSaving(true);
    const supabase = createClient();

    const tierData = {
      product_id: selectedProduct.id,
      tier_name: tierForm.tier_name.trim(),
      tier_order: tierForm.tier_order,
      price_amount: Number(tierForm.price_amount) || 0,
      compare_price: tierForm.compare_price ?? null,
      credits_price: tierForm.credits_price ?? null,
      allow_credits: tierForm.allow_credits ?? false,
      button_text: tierForm.button_text.trim() || "Jetzt kaufen",
      button_color: tierForm.button_color || "#95BF47",
      button_icon: tierForm.button_icon || "shopping-cart",
      requires_previous_tier: tierForm.requires_previous_tier ?? false,
      previous_tier_id: tierForm.previous_tier_id || null,
      is_active: true,
    };

    if (editingTier) {
      const { error } = await supabase
        .from("product_price_tiers")
        .update(tierData)
        .eq("id", editingTier.id);
      if (error) {
        console.error("Tier update error:", error);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("product_price_tiers").insert(tierData);
      if (error) {
        console.error("Tier insert error:", error);
        setSaving(false);
        return;
      }
    }

    const updated = await fetchData();
    if (selectedProduct && updated) {
      const next = updated.find((p) => p.id === selectedProduct.id);
      if (next) setSelectedProduct(next);
    }
    setShowTierModal(false);
    setSaving(false);
  };

  const deleteTier = async (tierId: string) => {
    if (!confirm("Preisstufe wirklich löschen?")) return;

    const supabase = createClient();
    await supabase.from("product_price_tiers").delete().eq("id", tierId);
    await fetchData();
  };

  // Update variant link
  const updateVariantLink = async (variantId: string, tierId: string, url: string) => {
    const supabase = createClient();

    if (url) {
      await supabase
        .from("variant_price_links")
        .upsert({
          variant_id: variantId,
          price_tier_id: tierId,
          checkout_url: url,
        }, { onConflict: "variant_id,price_tier_id" });
    } else {
      await supabase
        .from("variant_price_links")
        .delete()
        .eq("variant_id", variantId)
        .eq("price_tier_id", tierId);
    }

    await fetchData();
  };

  const uploadProductImage = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) return null;
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "png";
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("attachments").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleProductImageDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setImageDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setImageUploading(true);
    const url = await uploadProductImage(file);
    if (url) setProductForm((f) => ({ ...f, image_url: url }));
    setImageUploading(false);
  };

  const handleProductImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    const url = await uploadProductImage(file);
    if (url) setProductForm((f) => ({ ...f, image_url: url }));
    setImageUploading(false);
    e.target.value = "";
  };

  const toggleVariantExpand = (variantId: string) => {
    setExpandedVariants((prev) => {
      const next = new Set(prev);
      if (next.has(variantId)) {
        next.delete(variantId);
      } else {
        next.add(variantId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Produkt-Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verwalte Produkte, Varianten und Preisstufen
          </p>
        </div>

        <Button onClick={() => openProductModal()} className="btn-primary gap-2">
          <Plus className="w-4 h-4" />
          Neues Produkt
        </Button>
      </div>

      {/* Products List */}
      {products.length === 0 ? (
        <div className="content-card text-center py-12">
          <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Keine Produkte</h3>
          <p className="text-muted-foreground mb-4">
            Erstelle dein erstes Produkt, um loszulegen.
          </p>
          <Button onClick={() => openProductModal()} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Produkt erstellen
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="content-card group cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => openProductModal(product)}
            >
              {/* Product Image or Icon */}
              <div className="relative mb-4">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-32 object-cover rounded-xl"
                  />
                ) : (
                  <div
                    className="w-full h-32 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: product.badge_color + "20" }}
                  >
                    <Package className="w-12 h-12" style={{ color: product.badge_color }} />
                  </div>
                )}

                {/* Badge */}
                {product.badge_text && (
                  <span
                    className="absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-medium text-white"
                    style={{ backgroundColor: product.badge_color }}
                  >
                    {product.badge_text}
                  </span>
                )}

                {/* Status */}
                <span
                  className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-medium ${
                    product.is_active
                      ? "bg-green-500/10 text-green-500"
                      : "bg-red-500/10 text-red-500"
                  }`}
                >
                  {product.is_active ? "Aktiv" : "Inaktiv"}
                </span>
              </div>

              {/* Product Info */}
              <h3 className="font-semibold text-foreground mb-1">{product.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {product.short_description || product.description || "Keine Beschreibung"}
              </p>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers className="w-4 h-4" />
                  {product.variants.length} Varianten
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {product.priceTiers.length} Preise
                </span>
              </div>

              {/* Preview as user */}
              <a
                href={`/products/${product.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Als Nutzer ansehen
              </a>

              {/* Featured Badge */}
              {product.is_featured && (
                <div className="mt-3 flex items-center gap-1 text-yellow-500 text-sm">
                  <Star className="w-4 h-4 fill-current" />
                  Featured
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Product Modal */}
      <AnimatePresence>
        {showProductModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowProductModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-card rounded-2xl shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: productForm.badge_color + "20" }}
                  >
                    <Package className="w-5 h-5" style={{ color: productForm.badge_color }} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {selectedProduct ? "Produkt bearbeiten" : "Neues Produkt"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {productForm.name || "Unbenanntes Produkt"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedProduct && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        deleteProduct(selectedProduct.id);
                        setShowProductModal(false);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <button
                    onClick={() => setShowProductModal(false)}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border overflow-x-auto">
                {[
                  { id: "general", label: "Allgemein", icon: Settings },
                  { id: "variants", label: "Varianten (Nischen)", icon: Layers },
                  { id: "pricing", label: "Preisstufen", icon: DollarSign },
                  { id: "content", label: "Inhalte", icon: FileText },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    disabled={!selectedProduct && tab.id !== "general"}
                    className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 ${
                      activeTab === tab.id
                        ? "text-primary border-primary bg-primary/5"
                        : "text-muted-foreground hover:text-foreground border-transparent"
                    } ${!selectedProduct && tab.id !== "general" ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* General Tab */}
                {activeTab === "general" && (
                  <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium mb-2">Name *</label>
                        <Input
                          value={productForm.name}
                          onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                          placeholder="Winning Product"
                          className="input-modern"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Slug (URL)</label>
                        <Input
                          value={productForm.slug}
                          onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })}
                          placeholder="winning-product"
                          className="input-modern"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Kurzbeschreibung</label>
                      <Input
                        value={productForm.short_description}
                        onChange={(e) => setProductForm({ ...productForm, short_description: e.target.value })}
                        placeholder="Kurze Beschreibung für Vorschau"
                        className="input-modern"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Beschreibung</label>
                      <Textarea
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        placeholder="Ausführliche Beschreibung..."
                        rows={4}
                        className="input-modern resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Produktbild</label>
                      <div
                        onDragOver={(e) => { e.preventDefault(); setImageDrag(true); }}
                        onDragLeave={() => setImageDrag(false)}
                        onDrop={handleProductImageDrop}
                        onClick={() => document.getElementById("product-image-input")?.click()}
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors min-h-[140px] flex flex-col items-center justify-center gap-2 ${
                          imageDrag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                        } ${imageUploading ? "opacity-70 pointer-events-none" : ""}`}
                      >
                        <input
                          id="product-image-input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProductImageSelect}
                        />
                        {productForm.image_url ? (
                          <>
                            <img
                              src={productForm.image_url}
                              alt="Vorschau"
                              className="max-h-24 rounded-lg object-cover mx-auto"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <p className="text-xs text-muted-foreground">Klicken oder Bild hierher ziehen zum Ersetzen</p>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setProductForm({ ...productForm, image_url: "" }); }}
                              className="text-xs text-destructive hover:underline"
                            >
                              Bild entfernen
                            </button>
                          </>
                        ) : imageUploading ? (
                          <>
                            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                            <p className="text-sm text-muted-foreground">Wird hochgeladen...</p>
                          </>
                        ) : (
                          <>
                            <Image className="w-10 h-10 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Bild hierher ziehen oder klicken zum Hochladen</p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium mb-2">Video-URL (optional)</label>
                        <Input
                          value={productForm.video_url}
                          onChange={(e) => setProductForm({ ...productForm, video_url: e.target.value })}
                          placeholder="https://..."
                          className="input-modern"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">PDF-URL (optional)</label>
                        <Input
                          value={productForm.pdf_url}
                          onChange={(e) => setProductForm({ ...productForm, pdf_url: e.target.value })}
                          placeholder="https://..."
                          className="input-modern"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium mb-2">Badge-Text</label>
                        <Input
                          value={productForm.badge_text}
                          onChange={(e) => setProductForm({ ...productForm, badge_text: e.target.value })}
                          placeholder="z.B. NEU, HOT, SALE"
                          className="input-modern"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Badge-Farbe</label>
                        <div className="flex gap-2">
                          {PRESET_COLORS.slice(0, 6).map((color) => (
                            <button
                              key={color}
                              onClick={() => setProductForm({ ...productForm, badge_color: color })}
                              className={`w-8 h-8 rounded-lg ${
                                productForm.badge_color === color ? "ring-2 ring-offset-2 ring-primary" : ""
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                          <Input
                            type="color"
                            value={productForm.badge_color}
                            onChange={(e) => setProductForm({ ...productForm, badge_color: e.target.value })}
                            className="w-8 h-8 p-0 border-0 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="space-y-3">
                      {[
                        { key: "is_active", label: "Aktiv", description: "Produkt ist sichtbar" },
                        { key: "is_featured", label: "Featured", description: "Hervorgehobenes Produkt" },
                        { key: "show_in_menu", label: "Im Menü anzeigen", description: "In der Navigation anzeigen" },
                        { key: "show_variant_selector", label: "Varianten-Auswahl", description: "Nischen-Auswahl anzeigen" },
                        { key: "show_price_comparison", label: "Preisvergleich", description: "Streichpreise anzeigen" },
                      ].map((toggle) => (
                        <label
                          key={toggle.key}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                        >
                          <div>
                            <p className="font-medium text-sm">{toggle.label}</p>
                            <p className="text-xs text-muted-foreground">{toggle.description}</p>
                          </div>
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={(productForm as any)[toggle.key]}
                              onChange={(e) => setProductForm({ ...productForm, [toggle.key]: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-muted-foreground/30 peer-checked:bg-primary rounded-full transition-colors" />
                            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Variants Tab */}
                {activeTab === "variants" && selectedProduct && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {selectedProduct.variants.length} Varianten (Nischen)
                      </p>
                      <Button onClick={() => openVariantModal()} size="sm" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Neue Variante
                      </Button>
                    </div>

                    {selectedProduct.variants.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Noch keine Varianten erstellt</p>
                        <p className="text-sm">Varianten sind verschiedene Nischen oder Optionen deines Produkts</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedProduct.variants.map((variant) => {
                          const isExpanded = expandedVariants.has(variant.id);
                          return (
                            <div key={variant.id} className="border border-border rounded-xl overflow-hidden">
                              <div
                                className="p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => toggleVariantExpand(variant.id)}
                              >
                                <div
                                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                                  style={{ backgroundColor: variant.color + "20", color: variant.color }}
                                >
                                  {VARIANT_ICONS.find((i) => i.value === variant.icon)?.icon &&
                                    (() => {
                                      const IconComp = VARIANT_ICONS.find((i) => i.value === variant.icon)!.icon;
                                      return <IconComp className="w-5 h-5" />;
                                    })()}
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium">{variant.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {variant.links.length} Links konfiguriert
                                  </p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openVariantModal(variant);
                                  }}
                                  className="p-2 rounded-lg hover:bg-accent"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteVariant(variant.id);
                                  }}
                                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                {isExpanded ? (
                                  <ChevronDown className="w-5 h-5" />
                                ) : (
                                  <ChevronRight className="w-5 h-5" />
                                )}
                              </div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: "auto" }}
                                    exit={{ height: 0 }}
                                    className="overflow-hidden border-t border-border"
                                  >
                                    <div className="p-4 bg-muted/30 space-y-3">
                                      <p className="text-sm font-medium">Checkout-Links pro Preisstufe:</p>
                                      {selectedProduct.priceTiers.map((tier) => {
                                        const link = variant.links.find((l) => l.price_tier_id === tier.id);
                                        return (
                                          <div key={tier.id} className="flex items-center gap-3">
                                            <span
                                              className="px-2 py-1 rounded-lg text-xs font-medium"
                                              style={{ backgroundColor: tier.button_color + "20", color: tier.button_color }}
                                            >
                                              {tier.tier_name}
                                            </span>
                                            <Input
                                              value={link?.checkout_url || ""}
                                              onChange={(e) => updateVariantLink(variant.id, tier.id, e.target.value)}
                                              placeholder="https://checkout-link.com/..."
                                              className="input-modern flex-1"
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Pricing Tab */}
                {activeTab === "pricing" && selectedProduct && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {selectedProduct.priceTiers.length} Preisstufen
                      </p>
                      <Button onClick={() => openTierModal()} size="sm" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Neue Preisstufe
                      </Button>
                    </div>

                    {selectedProduct.priceTiers.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Noch keine Preisstufen erstellt</p>
                        <p className="text-sm">z.B. Erstkauf (1,95€) und Upsell (4,95€)</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedProduct.priceTiers
                          .sort((a, b) => a.tier_order - b.tier_order)
                          .map((tier) => (
                            <div
                              key={tier.id}
                              className="p-4 border border-border rounded-xl flex items-center gap-4"
                            >
                              <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
                                style={{ backgroundColor: tier.button_color }}
                              >
                                #{tier.tier_order + 1}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{tier.tier_name}</h4>
                                  {tier.requires_previous_tier && (
                                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-xs">
                                      Erfordert vorherige Stufe
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    {tier.price_amount.toFixed(2)} {tier.price_currency}
                                  </span>
                                  {tier.compare_price && (
                                    <span className="line-through">
                                      {tier.compare_price.toFixed(2)} €
                                    </span>
                                  )}
                                  {tier.allow_credits && tier.credits_price && (
                                    <span className="flex items-center gap-1 text-yellow-500">
                                      <Coins className="w-3 h-3" />
                                      {tier.credits_price} Credits
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Button: "{tier.button_text}"
                                </p>
                              </div>
                              <button
                                onClick={() => openTierModal(tier)}
                                className="p-2 rounded-lg hover:bg-accent"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteTier(tier.id)}
                                className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Content Tab - Placeholder */}
                {activeTab === "content" && selectedProduct && (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Inhalte-Verwaltung</p>
                    <p className="text-sm">Downloads, Videos und mehr (Coming Soon)</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-border flex flex-col gap-3">
                {productError && (
                  <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
                    {productError}
                  </div>
                )}
                <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowProductModal(false)}>
                  Abbrechen
                </Button>
                <Button
                  onClick={saveProduct}
                  disabled={saving || !productForm.name}
                  className="btn-primary"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Speichern...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Speichern
                    </>
                  )}
                </Button>
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Variant Modal */}
      <AnimatePresence>
        {showVariantModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setShowVariantModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card rounded-2xl shadow-2xl"
            >
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold">
                  {editingVariant ? "Variante bearbeiten" : "Neue Variante"}
                </h3>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name *</label>
                  <Input
                    value={variantForm.name}
                    onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                    placeholder="z.B. Fitness, Mode, Tech"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Beschreibung</label>
                  <Textarea
                    value={variantForm.description}
                    onChange={(e) => setVariantForm({ ...variantForm, description: e.target.value })}
                    placeholder="Optionale Beschreibung..."
                    rows={2}
                    className="input-modern resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Icon</label>
                    <div className="flex flex-wrap gap-2">
                      {VARIANT_ICONS.map(({ value, icon: IconComp }) => (
                        <button
                          key={value}
                          onClick={() => setVariantForm({ ...variantForm, icon: value })}
                          className={`p-2 rounded-lg ${
                            variantForm.icon === value
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-accent"
                          }`}
                        >
                          <IconComp className="w-5 h-5" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Farbe</label>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.slice(0, 5).map((color) => (
                        <button
                          key={color}
                          onClick={() => setVariantForm({ ...variantForm, color })}
                          className={`w-8 h-8 rounded-lg ${
                            variantForm.color === color ? "ring-2 ring-offset-2 ring-primary" : ""
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowVariantModal(false)}>
                  Abbrechen
                </Button>
                <Button onClick={saveVariant} disabled={saving || !variantForm.name}>
                  Speichern
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tier Modal */}
      <AnimatePresence>
        {showTierModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setShowTierModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-card rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold">
                  {editingTier ? "Preisstufe bearbeiten" : "Neue Preisstufe"}
                </h3>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Name *</label>
                    <Input
                      value={tierForm.tier_name}
                      onChange={(e) => setTierForm({ ...tierForm, tier_name: e.target.value })}
                      placeholder="z.B. Erstkauf, Upsell"
                      className="input-modern"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Reihenfolge</label>
                    <Input
                      type="number"
                      value={tierForm.tier_order}
                      onChange={(e) => setTierForm({ ...tierForm, tier_order: parseInt(e.target.value) || 0 })}
                      className="input-modern"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Preis (€) *</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={tierForm.price_amount}
                      onChange={(e) => setTierForm({ ...tierForm, price_amount: parseFloat(e.target.value) || 0 })}
                      className="input-modern"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Streichpreis (€)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={tierForm.compare_price || ""}
                      onChange={(e) => setTierForm({ ...tierForm, compare_price: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="Optional"
                      className="input-modern"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Button-Text *</label>
                  <Input
                    value={tierForm.button_text}
                    onChange={(e) => setTierForm({ ...tierForm, button_text: e.target.value })}
                    placeholder="Jetzt kaufen"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Button-Farbe</label>
                  <div className="flex gap-2">
                    {PRESET_COLORS.slice(0, 8).map((color) => (
                      <button
                        key={color}
                        onClick={() => setTierForm({ ...tierForm, button_color: color })}
                        className={`w-8 h-8 rounded-lg ${
                          tierForm.button_color === color ? "ring-2 ring-offset-2 ring-primary" : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Credits Option */}
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="font-medium text-sm flex items-center gap-2">
                        <Coins className="w-4 h-4 text-yellow-500" />
                        Mit Credits kaufbar
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Nutzer können mit Hub-Credits bezahlen
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={tierForm.allow_credits}
                      onChange={(e) => setTierForm({ ...tierForm, allow_credits: e.target.checked })}
                      className="rounded"
                    />
                  </label>

                  {tierForm.allow_credits && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium mb-2">Credits-Preis</label>
                      <Input
                        type="number"
                        value={tierForm.credits_price || ""}
                        onChange={(e) => setTierForm({ ...tierForm, credits_price: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="z.B. 100"
                        className="input-modern"
                      />
                    </div>
                  )}
                </div>

                {/* Requires Previous Tier */}
                <label className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tierForm.requires_previous_tier}
                    onChange={(e) => setTierForm({ ...tierForm, requires_previous_tier: e.target.checked })}
                    className="rounded"
                  />
                  <div>
                    <p className="font-medium text-sm">Erfordert vorherige Stufe</p>
                    <p className="text-xs text-muted-foreground">
                      Nutzer müssen erst die vorherige Preisstufe kaufen
                    </p>
                  </div>
                </label>
              </div>

              <div className="p-6 border-t border-border flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowTierModal(false)}>
                  Abbrechen
                </Button>
                <Button onClick={saveTier} disabled={saving || !tierForm.tier_name || !tierForm.button_text}>
                  Speichern
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
