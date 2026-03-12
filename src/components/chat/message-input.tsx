"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Plus, Image, File, X, Lock, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient, apiFetch } from "@/lib/supabase/client";
import type { User, Channel } from "@/types/database";

interface MessageInputProps {
  channelId: string;
}

export function MessageInput({ channelId }: MessageInputProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [canPost, setCanPost] = useState(false);
  const [canSendImages, setCanSendImages] = useState(false);
  const [canSendFiles, setCanSendFiles] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isPng, setIsPng] = useState(false);
  const [imageBgColor, setImageBgColor] = useState<string | null>(null);
  const [showCtaForm, setShowCtaForm] = useState(false);
  const [ctaButtonText, setCtaButtonText] = useState("");
  const [ctaButtonUrl, setCtaButtonUrl] = useState("");

  const bgColorOptions = [
    { value: null, label: "Transparent", color: "transparent" },
    { value: "#ffffff", label: "Weiß", color: "#ffffff" },
    { value: "#000000", label: "Schwarz", color: "#000000" },
    { value: "#1a1a1a", label: "Dunkelgrau", color: "#1a1a1a" },
    { value: "#f5f5f5", label: "Hellgrau", color: "#f5f5f5" },
    { value: "#95BF47", label: "Grün", color: "#95BF47" },
  ];
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkPermissions = async () => {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setCanPost(false);
        return;
      }

      // Get channel data
      const { data: channelData } = await supabase
        .from("channels")
        .select("*")
        .eq("id", channelId)
        .single<Channel>();

      setChannel(channelData);

      if (!channelData) {
        setCanPost(false);
        return;
      }

      // Check permissions via new system
      try {
        const { getUserPermissionData, canUserInChannel } = await import("@/lib/permissions-v2");
        const permData = await getUserPermissionData(user.id);
        
        const userIsAdmin = permData?.isAdmin || false;
        setIsAdmin(userIsAdmin);

        if (userIsAdmin) {
          setCanPost(true);
          setCanSendImages(true);
          setCanSendFiles(true);
          return;
        }

        const [canSend, canImg, canFile] = await Promise.all([
          canUserInChannel(user.id, channelId, "send_messages"),
          canUserInChannel(user.id, channelId, "send_images"),
          canUserInChannel(user.id, channelId, "send_files"),
        ]);
        setCanPost(canSend);
        setCanSendImages(canImg);
        setCanSendFiles(canFile);
      } catch (error) {
        try {
          const response = await apiFetch("/api/user/profile");
          if (response.ok) {
            const data = await response.json();
            const userIsAdmin = data.profile?.role === "admin";
            setIsAdmin(userIsAdmin);
            setCanPost(userIsAdmin || channelData.allow_user_text);
            setCanSendImages(userIsAdmin || channelData.allow_user_images);
            setCanSendFiles(userIsAdmin || channelData.allow_user_files);
          }
        } catch (e) {
          console.error("Error checking permissions:", e);
        }
      }
    };

    checkPermissions();
  }, [channelId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasText = message.trim().length > 0;
    const hasFile = !!selectedFile;
    const isImage = selectedFile?.type.startsWith("image/");
    const channelAllowsText = channel?.allow_user_text ?? false;
    const channelAllowsImages = channel?.allow_user_images ?? false;
    const channelAllowsFiles = channel?.allow_user_files ?? false;

    if (!hasText && !hasFile) return;
    if (hasText && (!channelAllowsText || !canPost)) return;
    if (hasFile && isImage && (!channelAllowsImages || !canSendImages) && !isAdmin) return;
    if (hasFile && !isImage && (!channelAllowsFiles || !canSendFiles) && !isAdmin) return;
    if (sending) return;

    setSending(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setSending(false);
      return;
    }

    let attachmentUrl = null;
    let attachmentType = null;
    const mayUpload = isAdmin || (isImage ? canSendImages : canSendFiles);
    if (selectedFile && mayUpload) {
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(fileName, selectedFile);

      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = supabase.storage.from("attachments").getPublicUrl(fileName);
        attachmentUrl = publicUrl;
        attachmentType = selectedFile.type.startsWith("image/") ? "image" : "file";
      }
    }

    const { data: inserted, error } = await supabase.from("messages").insert({
      channel_id: channelId,
      user_id: user.id,
      content: message.trim() || (attachmentType === "image" ? "📷 Bild" : "📎 Datei"),
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
      cta_button_text: ctaButtonText.trim() || null,
      cta_button_url: ctaButtonUrl.trim() || null,
      image_bg_color: isPng ? imageBgColor : null,
    }).select().single();

    if (!error && inserted) {
      try {
        const { data: userRow } = await supabase.from("users").select("role, display_name").eq("id", user.id).single();
        window.dispatchEvent(new CustomEvent("message-sent", {
          detail: {
            channelId,
            message: inserted,
            user: { id: user.id, role: userRow?.role, display_name: userRow?.display_name },
          },
        }));
      } catch (_) {}
      // Update user stats
      try {
        const { incrementStat } = await import("@/lib/stats");
        await incrementStat(user.id, attachmentUrl ? "files_uploaded" : "messages");
      } catch (e) {}
      setMessage("");
      setSelectedFile(null);
      setFilePreview(null);
      setIsPng(false);
      setImageBgColor(null);
      setCtaButtonText("");
      setCtaButtonUrl("");
      setShowCtaForm(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowAttachMenu(false);
      
      // Check if PNG
      const isPngFile = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
      setIsPng(isPngFile);
      setImageBgColor(null);
      
      // Create preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setIsPng(false);
    setImageBgColor(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  if (!canPost) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 border-t border-border"
      >
        <div className="content-card flex items-center justify-center gap-3 text-muted-foreground py-4">
          <Lock className="w-5 h-5" />
          <span className="text-sm font-medium">
            Keine Schreibrechte in diesem Channel
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 md:p-4 border-t border-border bg-card/50 backdrop-blur-sm"
    >
      {/* CTA Button Form (Admin only) */}
      <AnimatePresence>
        {showCtaForm && isAdmin && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className="content-card p-3 md:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">CTA-Button hinzufügen</span>
                </div>
                <button
                  onClick={() => setShowCtaForm(false)}
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-secondary rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  value={ctaButtonText}
                  onChange={(e) => setCtaButtonText(e.target.value)}
                  placeholder="Button-Text"
                  className="input-modern h-12 md:h-10 text-base md:text-sm"
                />
                <Input
                  value={ctaButtonUrl}
                  onChange={(e) => setCtaButtonUrl(e.target.value)}
                  placeholder="https://..."
                  className="input-modern h-12 md:h-10 text-base md:text-sm"
                />
              </div>
              {ctaButtonText && ctaButtonUrl && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground mb-2">Vorschau:</p>
                  <a 
                    href={ctaButtonUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-block btn-primary text-sm px-4 py-2"
                  >
                    {ctaButtonText}
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected File Preview */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className="content-card p-3">
              {/* Image Preview */}
              {filePreview && selectedFile.type.startsWith("image/") ? (
                <div className="relative">
                  <div 
                    className="rounded-lg p-2 inline-block mx-auto"
                    style={{ backgroundColor: imageBgColor || "transparent" }}
                  >
                    <img 
                      src={filePreview} 
                      alt="Vorschau" 
                      className="max-h-40 rounded object-contain"
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={clearFile}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-lg"
                  >
                    <X className="w-4 h-4 text-white" />
                  </motion.button>
                  
                  {/* PNG Background Color Selector */}
                  {isPng && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">Hintergrundfarbe (PNG):</p>
                      <div className="flex gap-2 flex-wrap">
                        {bgColorOptions.map((option) => (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => setImageBgColor(option.value)}
                            className={`w-8 h-8 rounded-lg border-2 transition-all ${
                              imageBgColor === option.value 
                                ? "border-primary scale-110" 
                                : "border-border hover:border-primary/50"
                            }`}
                            style={{ 
                              backgroundColor: option.color,
                              backgroundImage: option.value === null ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)" : undefined,
                              backgroundSize: option.value === null ? "8px 8px" : undefined,
                              backgroundPosition: option.value === null ? "0 0, 0 4px, 4px -4px, -4px 0px" : undefined,
                            }}
                            title={option.label}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-2 text-center">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                /* File Preview (non-image) */
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <File className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={clearFile}
                    className="p-1.5 hover:bg-destructive/10 rounded-lg"
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit}>
        <div className="flex items-end gap-2">
          {/* Attachment Button (Admin only) */}
          {isAdmin && (
            <>
              <div className="relative">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className="h-11 w-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </motion.button>

                <AnimatePresence>
                  {showAttachMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full mb-2 left-0 content-card p-2 shadow-xl min-w-[180px] z-50"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          imageInputRef.current?.click();
                          setShowAttachMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg text-sm hover:bg-secondary transition-colors"
                      >
                        <Image className="w-5 h-5 text-primary" />
                        Bild hochladen
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          fileInputRef.current?.click();
                          setShowAttachMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg text-sm hover:bg-secondary transition-colors"
                      >
                        <File className="w-5 h-5 text-primary" />
                        Datei hochladen
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Separate inputs for images and files */}
                <input
                  ref={imageInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, true)}
                  accept="image/*"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, false)}
                  accept=".pdf,.doc,.docx,.txt,.zip,.rar"
                />
              </div>

              {/* CTA Button - Separate prominent button for admins */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCtaForm(!showCtaForm)}
                className={`h-11 min-h-[44px] px-3 md:px-4 flex items-center justify-center gap-1.5 md:gap-2 rounded-xl transition-colors ${
                  showCtaForm || (ctaButtonText && ctaButtonUrl)
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">Link</span>
              </motion.button>
            </>
          )}

          {/* Text Input */}
          <div className="flex-1 bg-secondary/50 rounded-xl min-w-0 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={channel?.name ? `Nachricht an ${channel.name}` : "Nachricht schreiben…"}
              className="w-full bg-transparent border-0 outline-none resize-none text-foreground placeholder:text-muted-foreground py-3 px-3 md:px-4 max-h-[200px] text-base md:text-sm min-h-[44px]"
              rows={1}
              disabled={sending}
            />
          </div>

          {/* Send Button */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              type="submit"
              className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-xl btn-primary p-0"
              disabled={(!message.trim() && !selectedFile) || sending}
            >
              <Send className="w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </form>
    </motion.div>
  );
}
