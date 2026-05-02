"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/getApiClient";

const EXAMPLE_PROMPTS = [
  "Disrupt GATA1 binding site at +58 enhancer",
  "Identify high-specificity guides for BCL11A exon 2",
  "Find PAM-proximal cut sites with minimal off-target risk",
];

function NewRunForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roId = searchParams.get("ro") ?? "ro-demo-bcl11a-enhancer";

  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!prompt.trim() || !roId) return;
    setSubmitting(true);
    setError(null);
    try {
      const { run_id } = await apiClient.createRun({ ro_id: roId, prompt: prompt.trim() });
      router.push(`/runs/${run_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start run");
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0, 0, 0.2, 1] }}
      className="flex min-h-[60vh] items-center justify-center"
    >
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">New Run</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            What edit do you want to simulate?
          </h1>
          <p className="text-sm text-muted-foreground">
            Describe your editing goal. The pipeline scans for guide RNA candidates and scores them.
          </p>
        </div>

        {/* RO badge */}
        {roId && (
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="text-muted-foreground">Research Object:</span>
            <span className="font-mono text-teal bg-teal/10 border border-teal/20 rounded px-2 py-0.5">
              {roId.slice(0, 8)}…
            </span>
          </div>
        )}

        {/* Card */}
        <div className="rounded-xl border border-[#222] bg-surface p-6 space-y-5">
          <div className="space-y-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleStart();
              }}
              placeholder="e.g. Disrupt GATA1 binding site at +58 enhancer…"
              rows={4}
              disabled={submitting}
              autoFocus
              className="w-full rounded-lg border border-[#333] bg-[#0d0d0d] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-teal/50 focus:border-teal/50 resize-none transition-colors disabled:opacity-50"
            />

            {/* Example chips */}
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrompt(p)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    prompt === p
                      ? "border-teal/40 bg-teal/10 text-teal"
                      : "border-[#333] text-muted-foreground hover:text-foreground hover:border-[#444]"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={!prompt.trim() || !roId || submitting}
            onClick={handleStart}
            className="w-full h-12 rounded-lg bg-teal text-[#0a0a0a] text-sm font-semibold hover:bg-teal-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  className="block size-4 rounded-full border-2 border-[#0a0a0a]/30 border-t-[#0a0a0a]"
                />
                Queuing run…
              </>
            ) : (
              <>
                Start Run
                <span className="opacity-60 text-xs">⌘↵</span>
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground/40">
          Runs are immutably logged with env fingerprint + git SHA
        </p>
      </div>
    </motion.div>
  );
}

export default function NewRunPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    }>
      <NewRunForm />
    </Suspense>
  );
}
