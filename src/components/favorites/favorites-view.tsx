"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Download, Trash2, FileText, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Message, User, Channel } from "@/types/database";

interface FavoriteWithMessage {
  id: string;
  message_id: string;
  created_at: string;
  message: Message & {
    users: Pick<User, "id" | "display_name" | "role">;
    channels: Pick<Channel, "id" | "name">;
  };
}

export function FavoritesView() {
  const [favorites, setFavorites] = useState<FavoriteWithMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { data } = await supabase
      .from("user_favorites")
      .select(`
        id,
        message_id,
        created_at,
        message:messages (
          *,
          users (id, display_name, role),
          channels (id, name)
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setFavorites(data as unknown as FavoriteWithMessage[]);
    }
    setLoading(false);
  };

  const removeFavorite = async (favoriteId: string) => {
    const supabase = createClient();
    await supabase.from("user_favorites").delete().eq("id", favoriteId);
    setFavorites(favorites.filter(f => f.id !== favoriteId));
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      window.open(url, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-secondary/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
          <Heart className="w-5 h-5 md:w-6 md:h-6 text-red-500 fill-current" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">Gespeicherte Inhalte</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {favorites.length} {favorites.length === 1 ? "Element" : "Elemente"} gespeichert
          </p>
        </div>
      </div>

      {/* Favorites List */}
      {favorites.length === 0 ? (
        <div className="content-card p-8 md:p-12 text-center">
          <Heart className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-base md:text-lg font-semibold text-foreground mb-2">Noch nichts gespeichert</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Klicke auf das Herz-Symbol bei Bildern und Dateien, um sie hier zu speichern.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {favorites.map((fav) => (
              <motion.div
                key={fav.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="content-card overflow-hidden group"
              >
                {/* Image/File Preview */}
                {fav.message.attachment_url && (
                  <div 
                    className="relative"
                    style={{ backgroundColor: fav.message.image_bg_color || "transparent" }}
                  >
                    {fav.message.attachment_type === "image" ? (
                      <img
                        src={fav.message.attachment_url}
                        alt="Gespeichertes Bild"
                        className="w-full h-40 md:h-48 object-contain cursor-pointer"
                        onClick={() => window.open(fav.message.attachment_url!, "_blank")}
                      />
                    ) : (
                      <div className="h-28 md:h-32 flex items-center justify-center bg-secondary">
                        <FileText className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Remove Button - Always visible on mobile */}
                    <button
                      onClick={() => removeFavorite(fav.id)}
                      className="absolute top-2 right-2 p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-black/50 text-white hover:bg-red-500 transition-colors md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Info */}
                <div className="p-3 md:p-4">
                  {/* Text content if any */}
                  {fav.message.content && fav.message.content !== "📷 Bild" && fav.message.content !== "📎 Datei" && (
                    <p className="text-sm text-foreground mb-2 md:mb-3 line-clamp-2">
                      {fav.message.content}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground mb-2 md:mb-3">
                    <span className="truncate max-w-[100px]">Von {fav.message.users?.display_name || "Unbekannt"}</span>
                    <span className="truncate max-w-[80px]">in #{fav.message.channels?.name}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {fav.message.attachment_url && (
                      <button
                        onClick={() => handleDownload(fav.message.attachment_url!, `download-${fav.message.id}`)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 py-2 min-h-[44px] rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs md:text-sm font-medium"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden xs:inline">Herunterladen</span>
                        <span className="xs:hidden">Download</span>
                      </button>
                    )}
                    
                    {fav.message.cta_button_url && (
                      <a
                        href={fav.message.cta_button_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-sm font-medium"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
