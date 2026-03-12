"use client";
import { useState } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Plus, GripVertical, Edit2, Trash2, X, Eye, EyeOff, ArrowDown, ArrowUp, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { TutorialStep } from "@/types/database";

interface Props { steps: TutorialStep[]; }

const positions = [
  { value: "top", label: "Oben", icon: ArrowUp },
  { value: "bottom", label: "Unten", icon: ArrowDown },
  { value: "left", label: "Links", icon: ArrowLeft },
  { value: "right", label: "Rechts", icon: ArrowRight },
];

export function TutorialEditor({ steps: initial }: Props) {
  const [steps, setSteps] = useState(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [editStep, setEditStep] = useState<TutorialStep | null>(null);

  const deleteStep = async (id: string) => {
    if (!confirm("Schritt wirklich löschen?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("tutorial_steps").delete().eq("id", id);
    if (!error) setSteps(steps.filter(s => s.id !== id));
  };

  const toggleActive = async (step: TutorialStep) => {
    const supabase = createClient();
    const { error } = await supabase.from("tutorial_steps").update({ is_active: !step.is_active }).eq("id", step.id);
    if (!error) setSteps(steps.map(s => s.id === step.id ? { ...s, is_active: !s.is_active } : s));
  };

  const reorderSteps = async (newOrder: TutorialStep[]) => {
    setSteps(newOrder);
    const supabase = createClient();
    for (let i = 0; i < newOrder.length; i++) {
      await supabase.from("tutorial_steps").update({ order_index: i }).eq("id", newOrder[i].id);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tutorial-Editor</h1>
            <p className="text-muted-foreground">Anleitungen für neue User erstellen</p>
          </div>
          <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />Neuer Schritt</Button>
        </div>

        <Reorder.Group axis="y" values={steps} onReorder={reorderSteps} className="space-y-3">
          {steps.map((step) => (
            <Reorder.Item key={step.id} value={step}>
              <motion.div layout className={`glass rounded-2xl p-5 cursor-grab active:cursor-grabbing ${!step.is_active ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-4">
                  <GripVertical className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Schritt {step.order_index + 1}</span>
                      {step.target_element && <code className="text-xs text-muted-foreground">{step.target_element}</code>}
                    </div>
                    <h3 className="font-semibold text-foreground">{step.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{step.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => toggleActive(step)} className="p-2 rounded-lg hover:bg-accent">
                      {step.is_active ? <Eye className="w-4 h-4 text-green-500" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setEditStep(step)} className="p-2 rounded-lg hover:bg-accent">
                      <Edit2 className="w-4 h-4 text-muted-foreground" />
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => deleteStep(step.id)} className="p-2 rounded-lg hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        {steps.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-12 text-center">
            <p className="text-muted-foreground">Noch keine Tutorial-Schritte erstellt</p>
          </motion.div>
        )}

        <AnimatePresence>
          {(showCreate || editStep) && (
            <StepModal step={editStep} nextIndex={steps.length} onClose={() => { setShowCreate(false); setEditStep(null); }} onSave={(s) => {
              if (editStep) setSteps(steps.map(st => st.id === s.id ? s : st));
              else setSteps([...steps, s]);
              setShowCreate(false); setEditStep(null);
            }} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepModal({ step, nextIndex, onClose, onSave }: { step: TutorialStep | null; nextIndex: number; onClose: () => void; onSave: (s: TutorialStep) => void }) {
  const [form, setForm] = useState({
    title: step?.title || "",
    description: step?.description || "",
    target_element: step?.target_element || "",
    position: step?.position || "bottom",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const data = { title: form.title.trim(), description: form.description.trim(), target_element: form.target_element || null, position: form.position, order_index: step?.order_index ?? nextIndex, is_active: true };

    if (step) {
      const { data: updated, error } = await supabase.from("tutorial_steps").update(data).eq("id", step.id).select().single<TutorialStep>();
      if (!error && updated) onSave(updated);
    } else {
      const { data: created, error } = await supabase.from("tutorial_steps").insert(data).select().single<TutorialStep>();
      if (!error && created) onSave(created);
    }
    setSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()} className="glass rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">{step ? "Schritt bearbeiten" : "Neuer Schritt"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Titel</label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z.B. Willkommen!" className="glass border-0 rounded-xl h-12" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Beschreibung</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Erkläre hier den Schritt..." className="w-full h-24 p-3 glass border-0 rounded-xl resize-none text-foreground placeholder:text-muted-foreground" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Ziel-Element (CSS Selector)</label>
            <Input value={form.target_element} onChange={(e) => setForm({ ...form, target_element: e.target.value })} placeholder="z.B. #sidebar, .channel-list" className="glass border-0 rounded-xl h-12 font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Pfeil-Position</label>
            <div className="grid grid-cols-4 gap-2">
              {positions.map((p) => (
                <button key={p.value} onClick={() => setForm({ ...form, position: p.value })} className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors ${form.position === p.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
                  <p.icon className="w-4 h-4" /><span className="text-xs">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button onClick={save} disabled={saving || !form.title.trim() || !form.description.trim()}>{saving ? "Speichern..." : "Speichern"}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}