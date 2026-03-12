"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Trophy, Download, ExternalLink, CheckCircle, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient, apiFetch } from "@/lib/supabase/client";
import type { Channel, WinningProductSettings } from "@/types/database";

interface Props {
  channel: Channel;
  userId?: string;
  hasPurchased?: boolean;
  hasUpsell?: boolean;
}

export function WinningProductView({ channel, userId: userIdProp, hasPurchased: initialPurchased, hasUpsell: initialUpsell }: Props) {
  const [userId, setUserId] = useState(userIdProp ?? "");
  const [hasPurchased, setHasPurchased] = useState(initialPurchased ?? false);
  const [hasUpsell, setHasUpsell] = useState(initialUpsell ?? false);
  const [loading, setLoading] = useState(!userIdProp);
  const router = useRouter();
  const settings = channel.settings as WinningProductSettings;

  useEffect(() => {
    if (userIdProp) return;
    let cancelled = false;
    (async () => {
      const res = await apiFetch("/api/channels/winning-product");
      if (cancelled) return;
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (data?.userId) {
        setUserId(data.userId);
        setHasPurchased(!!data.hasPurchased);
        setHasUpsell(!!data.hasUpsell);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userIdProp, router]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const subscription = supabase
      .channel(`purchases-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_purchases", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const purchase = payload.new as { purchase_type?: string };
            setHasPurchased(true);
            if (purchase.purchase_type === "upsell") {
              setHasUpsell(true);
            }
          }
        }
      )
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getCheckoutUrl = () => {
    if (hasUpsell) return null;
    const baseUrl = hasPurchased ? settings.upsell_checkout_url : settings.initial_checkout_url;
    if (!baseUrl) return null;
    try {
      const url = new URL(baseUrl);
      url.searchParams.set("uid", userId);
      url.searchParams.set("pid", settings.product_id);
      return url.toString();
    } catch {
      return baseUrl;
    }
  };

  const getButtonText = () => {
    if (hasUpsell) return "Bereits freigeschaltet";
    if (hasPurchased) return `Upsell sichern für ${settings.upsell_price?.toFixed(2) || "4.95"}€`;
    return `Jetzt für ${settings.initial_price?.toFixed(2) || "1.95"}€ freischalten`;
  };

  const checkoutUrl = getCheckoutUrl();

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-6 lg:p-8 space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            transition={{ delay: 0.2, type: "spring" }} 
            className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-amber-500/10 flex items-center justify-center"
          >
            <Trophy className="w-10 h-10 text-amber-500" />
          </motion.div>
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground">Winning Product</h1>
          <p className="text-muted-foreground mt-2">Exklusiv für Premium-Mitglieder</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.1 }} 
          className="content-card"
        >
          <div className="whitespace-pre-wrap text-foreground leading-relaxed">
            {settings.description || "Beschreibung wird im Admin-Bereich eingestellt."}
          </div>
          
          {settings.pdf_url && (
            <div className="mt-6 pt-6 border-t border-border">
              <a 
                href={settings.pdf_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Download className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Produkt-Guide herunterladen</p>
                  <p className="text-sm text-muted-foreground">PDF-Dokument</p>
                </div>
              </a>
            </div>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.2 }} 
          className={`content-card text-center ${
            hasUpsell 
              ? "bg-green-500/5 border-green-500/20" 
              : hasPurchased 
                ? "bg-purple-500/5 border-purple-500/20" 
                : "bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20"
          }`}
        >
          {hasUpsell ? (
            <div className="py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">Vollständig freigeschaltet!</h3>
              <p className="text-muted-foreground mt-2">Du hast vollen Zugriff auf alle Inhalte.</p>
            </div>
          ) : (
            <div className="py-4">
              <div className="flex items-center justify-center gap-2 mb-4">
                {hasPurchased ? (
                  <Star className="w-5 h-5 text-purple-500" />
                ) : (
                  <Sparkles className="w-5 h-5 text-primary" />
                )}
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {hasPurchased ? "Upgrade verfügbar" : "Exklusiv für dich"}
                </span>
              </div>
              
              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">
                  {hasPurchased 
                    ? `${settings.upsell_price?.toFixed(2) || "4.95"}€` 
                    : `${settings.initial_price?.toFixed(2) || "1.95"}€`
                  }
                </span>
              </div>
              
              {checkoutUrl ? (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    asChild 
                    className={`w-full max-w-sm h-14 text-lg ${
                      hasPurchased 
                        ? "bg-purple-500 hover:bg-purple-600" 
                        : "btn-primary"
                    }`}
                  >
                    <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                      {getButtonText()}
                      <ExternalLink className="w-5 h-5 ml-2" />
                    </a>
                  </Button>
                </motion.div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Checkout-URL wird im Admin-Bereich eingestellt.
                </p>
              )}
            </div>
          )}
        </motion.div>

        {!hasUpsell && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {[
              { title: "Sofortiger Zugang", desc: "Nach dem Kauf direkt verfügbar" },
              { title: "Exklusiv", desc: "Nur für Premium-Mitglieder" },
              { title: "Updates inklusive", desc: "Neue Versionen kostenlos" },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="content-card text-center p-4"
              >
                <p className="font-medium text-foreground">{feature.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
