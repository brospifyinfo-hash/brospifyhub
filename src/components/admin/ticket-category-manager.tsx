"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Tag, Plus, Pencil, Trash2, Save, X, Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { TicketCategory } from "@/types/database";

export function TicketCategoryManager() {
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("#95BF47");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState("#95BF47");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("ticket_categories")
      .select("*")
      .order("order_index", { ascending: true });

    if (data) setCategories(data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSaving(true);
    const supabase = createClient();

    const maxOrder = categories.reduce((max, c) => Math.max(max, c.order_index), -1);

    const { data, error } = await supabase
      .from("ticket_categories")
      .insert({
        name: newName.trim(),
        description: newDescription.trim() || null,
        color: newColor,
        order_index: maxOrder + 1,
      })
      .select()
      .single<TicketCategory>();

    if (data && !error) {
      setCategories([...categories, data]);
      setNewName("");
      setNewDescription("");
      setNewColor("#95BF47");
      setShowCreate(false);
    }

    setSaving(false);
  };

  const handleEdit = (category: TicketCategory) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditDescription(category.description || "");
    setEditColor(category.color);
  };

  const handleSave = async () => {
    if (!editingId || !editName.trim()) return;

    setSaving(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("ticket_categories")
      .update({
        name: editName.trim(),
        description: editDescription.trim() || null,
        color: editColor,
      })
      .eq("id", editingId)
      .select()
      .single<TicketCategory>();

    if (data && !error) {
      setCategories(categories.map(c => c.id === editingId ? data : c));
      setEditingId(null);
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Ticket-Kategorie wirklich löschen? Bestehende Tickets behalten die Kategorie als nicht mehr zugeordnet.")) return;

    const supabase = createClient();
    await supabase.from("ticket_categories").delete().eq("id", id);
    setCategories(categories.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Tag className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Ticket-Kategorien</h2>
            <p className="text-sm text-muted-foreground">
              Kategorien für Support-Tickets (z. B. Allgemein, Technisch, Abrechnung)
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Neue Kategorie
        </Button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="content-card p-6 space-y-4"
          >
            <h3 className="font-semibold text-foreground">Neue Kategorie erstellen</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Name</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="z. B. Technisch"
                  className="input-modern"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">Farbe</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-input cursor-pointer"
                  />
                  <Input
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="input-modern flex-1"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-foreground block mb-2">Beschreibung (optional)</label>
                <Input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Kurze Beschreibung..."
                  className="input-modern"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={!newName.trim() || saving} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Erstellen"}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-secondary/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="content-card p-8 text-center">
          <Tag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Noch keine Ticket-Kategorien</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="content-card p-4"
            >
              {editingId === category.id ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Name"
                      className="input-modern"
                    />
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-input cursor-pointer"
                      />
                      <Input
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="input-modern flex-1"
                      />
                    </div>
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Beschreibung"
                      className="input-modern md:col-span-2"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={!editName.trim() || saving}
                      className="btn-primary"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">{category.name}</h4>
                    {category.description && (
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(category)}
                      className="p-2 hover:bg-secondary rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
