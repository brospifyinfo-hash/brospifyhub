"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, FileText, Download, ExternalLink, Sparkles, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Channel, UserPurchase, WinningProductSettings } from "@/types/database";

interface Props { channelId: string; }

export function WinningProductShowcase({ channelId }: Props) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [purchases, setPurchases] = useState<UserPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const settings = channel?.settings as WinningProductSettings | null;
  const hasInitialPurchase = purchases.some(p => p.purchase_type === "initial");
  const hasUpsellPurchase = purchases.some(p => p.purchase_type === "upsell");

  useEffect(() => {
    const supabase = createClient();
    
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const [channelRes, purchasesRes] = await Promise.all([
        supabase.from("channels").select("*").eq("id", channelId).single<Channel>(),
        supabase.from("user_purchases").select("*").eq("user_id", user.id).returns<UserPurchase[]>()
      ]);

      if (channelRes.data) setChannel(channelRes.data);
      if (purchasesRes.data) setPurchases(purchasesRes.data);
      setLoading(false);
    };

    fetchData();

    // Realtime subscription for purchases
    const purchaseChannel = supabase.channel(`purchases:${channelId}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "user_purchases" },
      (payload) => {
        const newPurchase = payload.new as UserPurchase;
        if (newPurchase.user_id === userId) {
          setPurchases(prev => [...prev, newPurchase]);
        }
      }
    ).subscribe();

    return () => { supabase.removeChannel(purchaseChannel); };
  }, [channelId, userId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Lädt Produkt...</span>
        </motion.div>
      </div>
    );
  }

  if (!channel || !settings?.product_id) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">Produkt nicht konfiguriert</p>
        </motion.div>
      </div>
    );
  }

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.15 } } };
  const itemVariants = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const } } };

  return (
    <div className="flex-1 overflow-auto">
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="max-w-3xl mx-auto p-8 space-y-8">
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", bounce: 0.5 }} className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-orange-500/20 flex items-center justify-center">
            <Trophy className="w-10 h-10 text-yellow-500" />
          </motion.div>
          <h1 className="text-3xl font-bold text-foreground">{channel.name}</h1>
          <p className="text-muted-foreground mt-2">Exklusives Winning Product</p>
        </motion.div>

        {/* Description Card */}
        <motion.div variants={itemVariants} className="glass rounded-2xl p-6">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />Produktbeschreibung
          </h2>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{settings.description || "Keine Beschreibung verfügbar."}</p>
        </motion.div>

        {/* PDF Download */}
        {settings.pdf_url && (
          <motion.div variants={itemVariants}>
            <a href={settings.pdf_url} target="_blank" rel="noopener noreferrer" className="block">
              <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} className="glass rounded-2xl p-5 flex items-center gap-4 hover:shadow-lg transition-shadow cursor-pointer group">
                <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <FileText className="w-7 h-7 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">Produkt-PDF</h3>
                  <p className="text-sm text-muted-foreground">Detaillierte Analyse & Anleitung</p>
                </div>
                <Download className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </motion.div>
            </a>
          </motion.div>
        )}

        {/* Purchase Status & Button */}
        <motion.div variants={itemVariants} className="space-y-4">
          {/* Status Badges */}
          <div className="flex flex-wrap gap-2 justify-center">
            {hasInitialPurchase && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 text-green-500 text-sm font-medium">
                <CheckCircle className="w-4 h-4" />Basis freigeschaltet
              </motion.div>
            )}
            {hasUpsellPurchase && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <CheckCircle className="w-4 h-4" />Premium freigeschaltet
              </motion.div>
            )}
          </div>

          {/* Dynamic Purchase Button */}
          <DynamicPurchaseButton settings={settings} hasInitialPurchase={hasInitialPurchase} hasUpsellPurchase={hasUpsellPurchase} userId={userId} />
        </motion.div>
      </motion.div>
    </div>
  );
}

interface ButtonProps {
  settings: WinningProductSettings;
  hasInitialPurchase: boolean;
  hasUpsellPurchase: boolean;
  userId: string | null;
}

function DynamicPurchaseButton({ settings, hasInitialPurchase, hasUpsellPurchase, userId }: ButtonProps) {
  if (hasUpsellPurchase) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-6 text-center">
        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
        <h3 className="font-semibold text-foreground">Vollständig freigeschaltet!</h3>
        <p className="text-sm text-muted-foreground mt-1">Du hast alle Inhalte dieses Produkts.</p>
      </motion.div>
    );
  }

  if (hasInitialPurchase) {
    const checkoutUrl = userId ? `${settings.upsell_checkout_url}?uid=${userId}&pid=${settings.product_id}` : settings.upsell_checkout_url;
    return (
      <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button size="lg" className="w-full h-16 rounded-2xl text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25">
            <span className="flex items-center gap-3">
              <Sparkles className="w-6 h-6" />
              Upsell sichern für {settings.upsell_price.toFixed(2).replace(".", ",")}€
              <ExternalLink className="w-5 h-5" />
            </span>
          </Button>
        </motion.div>
      </a>
    );
  }

  const checkoutUrl = userId ? `${settings.initial_checkout_url}?uid=${userId}&pid=${settings.product_id}` : settings.initial_checkout_url;
  return (
    <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button size="lg" className="w-full h-16 rounded-2xl text-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/25">
          <span className="flex items-center gap-3">
            <Trophy className="w-6 h-6" />
            Jetzt für {settings.initial_price.toFixed(2).replace(".", ",")}€ freischalten
            <ExternalLink className="w-5 h-5" />
          </span>
        </Button>
      </motion.div>
    </a>
  );
}