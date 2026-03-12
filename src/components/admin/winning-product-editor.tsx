"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Trophy, Save, Loader2, ExternalLink, FileText, DollarSign,
  Link as LinkIcon, Eye
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { Channel, WinningProductSettings } from "@/types/database";
import { cn } from "@/lib/utils";

export function WinningProductEditor() {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [settings, setSettings] = useState<WinningProductSettings>({
    posting_enabled: false,
    product_id: "wp-001",
    description: "",
    pdf_url: "",
    initial_price: 1.95,
    initial_checkout_url: "",
    upsell_price: 4.95,
    upsell_checkout_url: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const fetchChannel = async () => {
      const { data } = await supabase
        .from("channels")
        .select("*")
        .eq("type", "winning_product")
        .single<Channel>();

      if (data) {
        setChannel(data);
        if (data.settings && typeof data.settings === "object") {
          setSettings({
            ...settings,
            ...(data.settings as unknown as WinningProductSettings),
          });
        }
      }
    };

    fetchChannel();
  }, []);

  const handleSave = async () => {
    if (!channel) return;

    setIsSaving(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("channels")
      .update({ settings: settings as any })
      .eq("id", channel.id);

    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }

    setIsSaving(false);
  };

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Lade Winning Product...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <Trophy className="w-7 h-7 text-amber-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Winning Product</h1>
              <p className="text-muted-foreground">Konfiguriere dein Winning Product</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/channels/winning-product"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({
                  variant: "outline",
                  className: "inline-flex items-center",
                })
              )}
            >
              <Eye className="w-4 h-4 mr-2" />
              Vorschau
            </a>
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="btn-primary"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : saved ? (
                <span className="text-white">Gespeichert!</span>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Speichern
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Product Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="content-card space-y-6"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Produkt-Informationen</h2>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Produkt-ID
            </label>
            <Input
              value={settings.product_id}
              onChange={(e) => setSettings({ ...settings, product_id: e.target.value })}
              placeholder="wp-001"
              className="input-modern h-12"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Eindeutige ID für dieses Produkt (wird für Shopify Webhook benötigt)
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Beschreibung
            </label>
            <Textarea
              value={settings.description}
              onChange={(e) => setSettings({ ...settings, description: e.target.value })}
              placeholder="Beschreibe das Winning Product..."
              className="input-modern min-h-[150px] resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              PDF-Download URL (optional)
            </label>
            <Input
              value={settings.pdf_url || ""}
              onChange={(e) => setSettings({ ...settings, pdf_url: e.target.value })}
              placeholder="https://example.com/product-guide.pdf"
              className="input-modern h-12"
            />
          </div>
        </motion.div>

        {/* Initial Purchase */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="content-card space-y-6"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <DollarSign className="w-5 h-5 text-green-500" />
            <h2 className="font-semibold text-foreground">Erstkauf</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Preis (€)
              </label>
              <Input
                type="number"
                step="0.01"
                value={settings.initial_price}
                onChange={(e) => setSettings({ ...settings, initial_price: parseFloat(e.target.value) || 0 })}
                className="input-modern h-12"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Checkout URL
              </label>
              <Input
                value={settings.initial_checkout_url}
                onChange={(e) => setSettings({ ...settings, initial_checkout_url: e.target.value })}
                placeholder="https://shop.example.com/checkout/initial"
                className="input-modern h-12"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-700 dark:text-green-300">
              Button-Text: <span className="font-semibold">"Jetzt für {settings.initial_price.toFixed(2)}€ freischalten"</span>
            </p>
          </div>
        </motion.div>

        {/* Upsell */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="content-card space-y-6"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <LinkIcon className="w-5 h-5 text-purple-500" />
            <h2 className="font-semibold text-foreground">Upsell</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Upsell-Preis (€)
              </label>
              <Input
                type="number"
                step="0.01"
                value={settings.upsell_price}
                onChange={(e) => setSettings({ ...settings, upsell_price: parseFloat(e.target.value) || 0 })}
                className="input-modern h-12"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Upsell Checkout URL
              </label>
              <Input
                value={settings.upsell_checkout_url}
                onChange={(e) => setSettings({ ...settings, upsell_checkout_url: e.target.value })}
                placeholder="https://shop.example.com/checkout/upsell"
                className="input-modern h-12"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Button-Text: <span className="font-semibold">"Upsell sichern für {settings.upsell_price.toFixed(2)}€"</span>
            </p>
          </div>
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="content-card bg-blue-500/5 border-blue-500/20"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <ExternalLink className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Shopify Integration</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Die Checkout-URLs werden automatisch mit der User-ID und Produkt-ID ergänzt. 
                Stelle sicher, dass dein Shopify Webhook auf <code className="text-xs bg-secondary px-1 py-0.5 rounded">/api/webhooks/shopify</code> zeigt 
                und <code className="text-xs bg-secondary px-1 py-0.5 rounded">uid</code> sowie <code className="text-xs bg-secondary px-1 py-0.5 rounded">pid</code> aus den Note Attributes liest.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
