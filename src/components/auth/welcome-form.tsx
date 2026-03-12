"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveDisplayName } from "@/app/actions/auth";
import { createClient, apiFetch } from "@/lib/supabase/client";

export function WelcomeForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(saveDisplayName, null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard");
      router.refresh();
    }
  }, [state?.success, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await createClient().auth.getSession();
      if (cancelled) return;
      if (!session) {
        router.replace("/login");
        return;
      }
      const res = await apiFetch("/api/user/profile");
      if (cancelled) return;
      const data = await res.json();
      if (data?.profile?.display_name) {
        router.replace("/dashboard");
        return;
      }
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center"
          >
            <Sparkles className="w-10 h-10 text-primary" />
          </motion.div>
          <h1 className="text-3xl font-bold text-foreground">Fast geschafft!</h1>
          <p className="text-muted-foreground mt-2">Wie sollen wir dich nennen?</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-8"
        >
          <form action={formAction} className="space-y-6">
            <div>
              <label
                htmlFor="displayName"
                className="text-sm font-medium text-muted-foreground block mb-2"
              >
                Anzeigename
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="displayName"
                  name="displayName"
                  type="text"
                  placeholder="Max Mustermann"
                  className="pl-12 h-14 glass border-0 rounded-xl text-lg"
                  autoComplete="name"
                  autoFocus
                  disabled={isPending}
                />
              </div>
            </div>

            {state?.error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-destructive bg-destructive/10 p-3 rounded-xl text-center"
              >
                {state.error}
              </motion.p>
            )}

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                type="submit"
                className="w-full h-14 rounded-xl text-lg font-medium"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Wird gespeichert...
                  </>
                ) : (
                  "Weiter zum Dashboard"
                )}
              </Button>
            </motion.div>
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
}
