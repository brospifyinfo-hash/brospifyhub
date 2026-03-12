"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { TutorialStep, UserTutorialProgress } from "@/types/database";

export function TutorialOverlay() {
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [show, setShow] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        setUserId(user.id);

        const { data: progress } = await supabase.from("user_tutorial_progress").select("*").eq("user_id", user.id).single<UserTutorialProgress>();
        if (progress?.is_completed || cancelled) return;

        const { data: tutorialSteps } = await supabase.from("tutorial_steps").select("*").eq("is_active", true).order("order_index").returns<TutorialStep[]>();
        if (!cancelled && tutorialSteps && tutorialSteps.length > 0) {
          setSteps(tutorialSteps);
          setShow(true);
        }
      } catch {
        // Tabellen können fehlen – Overlay nicht anzeigen, UI nicht blockieren
      }
    };

    init();
    const t = setTimeout(() => { cancelled = true; }, 5000);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  const completeTutorial = async () => {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("user_tutorial_progress").upsert({ user_id: userId, is_completed: true, completed_at: new Date().toISOString(), completed_steps: steps.map(s => s.id) }, { onConflict: "user_id" });
    setShow(false);
  };

  const skip = () => { completeTutorial(); };
  const next = () => { if (currentStep < steps.length - 1) setCurrentStep(c => c + 1); else completeTutorial(); };
  const prev = () => { if (currentStep > 0) setCurrentStep(c => c - 1); };

  if (!show || steps.length === 0) return null;
  const step = steps[currentStep];

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md"
        >
          <div className="glass rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-muted-foreground">Schritt {currentStep + 1} von {steps.length}</span>
              <button onClick={skip} className="p-1 hover:bg-accent rounded-lg transition-colors"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            
            <h2 className="text-xl font-bold text-foreground mb-2">{step.title}</h2>
            <p className="text-muted-foreground leading-relaxed">{step.description}</p>

            <div className="flex items-center justify-between mt-6">
              <Button variant="secondary" onClick={prev} disabled={currentStep === 0}>
                <ChevronLeft className="w-4 h-4 mr-1" />Zurück
              </Button>
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === currentStep ? "bg-primary" : "bg-muted"}`} />
                ))}
              </div>
              <Button onClick={next}>
                {currentStep === steps.length - 1 ? (<><Check className="w-4 h-4 mr-1" />Fertig</>) : (<>Weiter<ChevronRight className="w-4 h-4 ml-1" /></>)}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}