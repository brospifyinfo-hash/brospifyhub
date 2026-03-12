"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Upload, X, Smile, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { CustomEmoji } from "@/types/database";

interface Props { 
  emojis: CustomEmoji[]; 
}

export function EmojiManager({ emojis: initial }: Props) {
  const [emojis, setEmojis] = useState(initial);
  const [showUpload, setShowUpload] = useState(false);

  const deleteEmoji = async (id: string) => {
    if (!confirm("Emoji wirklich löschen?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("custom_emojis").delete().eq("id", id);
    if (!error) setEmojis(emojis.filter(e => e.id !== id));
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Custom Emojis</h1>
            <p className="text-muted-foreground">{emojis.length} Emojis hochgeladen</p>
          </div>
          <Button onClick={() => setShowUpload(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />Emoji hochladen
          </Button>
        </div>

        {/* Info Box */}
        <div className="content-card bg-blue-500/5 border-blue-500/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Storage-Bucket benötigt</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Erstelle einen öffentlichen Storage-Bucket namens <code className="text-xs bg-secondary px-1 py-0.5 rounded">emojis</code> in 
                deinem Supabase Dashboard unter Storage, um Emojis hochladen zu können.
              </p>
            </div>
          </div>
        </div>

        {emojis.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="content-card p-12 text-center"
          >
            <Smile className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">Noch keine Custom Emojis</p>
            <p className="text-sm text-muted-foreground mt-1">
              Lade dein erstes Emoji hoch!
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
            {emojis.map((emoji) => (
              <motion.div 
                key={emoji.id} 
                layout 
                initial={{ opacity: 0, scale: 0.8 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="group relative content-card p-3 flex flex-col items-center"
              >
                <img 
                  src={emoji.image_url} 
                  alt={emoji.name} 
                  className="w-12 h-12 object-contain" 
                />
                <p className="text-xs text-muted-foreground mt-2 truncate w-full text-center">
                  :{emoji.name}:
                </p>
                <motion.button 
                  whileHover={{ scale: 1.1 }} 
                  onClick={() => deleteEmoji(emoji.id)} 
                  className="absolute -top-2 -right-2 p-1.5 rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {showUpload && (
            <UploadModal 
              onClose={() => setShowUpload(false)} 
              onSave={(e) => { setEmojis([e, ...emojis]); setShowUpload(false); }} 
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function UploadModal({ onClose, onSave }: { 
  onClose: () => void; 
  onSave: (e: CustomEmoji) => void; 
}) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const save = async () => {
    if (!name.trim() || !file) return;
    setSaving(true);
    setError(null);
    
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Clean filename
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const fileExt = file.name.split(".").pop() || "png";
    const fileName = `${cleanName}_${Date.now()}.${fileExt}`;
    
    // Try to upload
    const { error: uploadError } = await supabase.storage
      .from("emojis")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });
    
    if (uploadError) {
      console.error("Upload error:", uploadError);
      setError(
        uploadError.message.includes("Bucket not found") 
          ? "Storage-Bucket 'emojis' existiert nicht. Erstelle ihn zuerst im Supabase Dashboard." 
          : `Upload-Fehler: ${uploadError.message}`
      );
      setSaving(false);
      return;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("emojis")
      .getPublicUrl(fileName);
    
    // Save to database
    const { data: created, error: dbError } = await supabase
      .from("custom_emojis")
      .insert({ 
        name: cleanName, 
        image_url: publicUrl, 
        uploaded_by: user?.id 
      })
      .select()
      .single<CustomEmoji>();
    
    if (dbError) {
      console.error("Database error:", dbError);
      setError(`Datenbankfehler: ${dbError.message}`);
      setSaving(false);
      return;
    }
    
    if (created) {
      onSave(created);
    }
    setSaving(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" 
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.95, opacity: 0 }} 
        onClick={(e) => e.stopPropagation()} 
        className="content-card w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">Emoji hochladen</h2>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* File Upload */}
          <div 
            onClick={() => inputRef.current?.click()} 
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            {preview ? (
              <img src={preview} alt="Preview" className="w-20 h-20 mx-auto object-contain" />
            ) : (
              <>
                <Upload className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Klicken zum Hochladen</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF oder WebP</p>
              </>
            )}
            <input 
              ref={inputRef} 
              type="file" 
              accept="image/png,image/jpeg,image/gif,image/webp" 
              className="hidden" 
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} 
            />
          </div>
          
          {/* Name Input */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Emoji-Name (ohne Doppelpunkte)
            </label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="z.B. thumbsup" 
              className="input-modern h-12" 
            />
            {name && (
              <p className="text-xs text-muted-foreground mt-1">
                Verwendung: <code className="bg-secondary px-1 py-0.5 rounded">:{name.toLowerCase().replace(/[^a-z0-9]/g, "_")}:</code>
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive"
            >
              {error}
            </motion.div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button 
            onClick={save} 
            disabled={saving || !name.trim() || !file} 
            className="btn-primary"
          >
            {saving ? "Hochladen..." : "Hochladen"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
