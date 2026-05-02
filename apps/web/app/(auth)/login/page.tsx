"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "idle" | "loading" | "sent" | "error";

const HASH_CHARS = "0123456789abcdef";
function randomHexChar() {
  return HASH_CHARS[Math.floor(Math.random() * HASH_CHARS.length)];
}

function LoadingHash() {
  const [chars, setChars] = useState<string[]>(Array(16).fill("0"));

  useEffect(() => {
    const interval = setInterval(() => {
      setChars((prev) => prev.map((c) => (Math.random() > 0.6 ? randomHexChar() : c)));
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="font-mono text-sm text-teal tracking-widest">
      {chars.join("")}…
    </span>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setPhase("loading");
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (authError) {
      setError(authError.message);
      setPhase("error");
      return;
    }
    setPhase("sent");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-[#222] relative overflow-hidden">
        {/* Grid bg */}
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
        {/* Radial glow */}
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 50% at 30% 60%, rgba(94,234,212,0.06) 0%, transparent 70%)" }} />

        <div className="relative">
          <span className="text-sm font-semibold text-foreground">DNA with a Twist</span>
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-5xl font-semibold leading-tight tracking-tight text-foreground mb-4">
              Provenance-first<br />gene simulation
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-sm">
              Every experiment hashed, versioned, and replayable. Verifiable by anyone. Forever.
            </p>
          </div>

          {/* Animated feature cards */}
          <div className="space-y-3">
            {[
              { label: "Content hash", value: "9f3ca4e2b87d1f60…" },
              { label: "Env fingerprint", value: "c3d4e5f6a1b2c3d4…" },
              { label: "Determinism", value: "verified ✓" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg border border-[#222] bg-surface px-4 py-2.5">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="font-mono text-xs text-teal">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-muted-foreground/40">MVP demo — backend in development</p>
      </div>

      {/* Right auth panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            <p className="text-lg font-semibold text-foreground">DNA with a Twist</p>
            <p className="text-sm text-muted-foreground">Provenance Lab</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">No password. Magic link sent to your email.</p>
          </div>

          <AnimatePresence mode="wait">
            {phase === "sent" ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-teal/30 bg-teal/5 p-6 space-y-3 text-center"
              >
                <div className="text-3xl">✉️</div>
                <p className="font-semibold text-foreground">Check your inbox</p>
                <p className="text-sm text-muted-foreground">
                  Magic link sent to <span className="text-teal">{email}</span>
                </p>
                <button
                  type="button"
                  onClick={() => { setPhase("idle"); setEmail(""); }}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground transition-colors"
                >
                  Use a different email
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-foreground">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@lab.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={phase === "loading"}
                    required
                    autoFocus
                    className="w-full h-11 rounded-lg border border-[#222] bg-surface px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-teal/50 focus:border-teal/50 transition-colors disabled:opacity-50"
                  />
                </div>

                {phase === "error" && error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-red-400 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5"
                  >
                    {error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={phase === "loading" || !email.trim()}
                  className="w-full h-11 rounded-lg bg-teal text-[#0a0a0a] text-sm font-medium hover:bg-teal-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {phase === "loading" ? (
                    <>
                      <LoadingHash />
                    </>
                  ) : (
                    "Send magic link"
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="text-center text-xs text-muted-foreground/40">
            Every session is cryptographically identified.
          </p>
        </div>
      </div>
    </div>
  );
}
