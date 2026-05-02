"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { Hash } from "@/components/primitives/Hash";
import { apiClient } from "@/lib/getApiClient";
import { buttonVariants } from "@/components/ui/button";

const EXAMPLE_PROMPTS = [
  "Disrupt GATA1 binding site at +58 enhancer",
  "Identify high-specificity guides for BCL11A exon 2",
  "Find PAM-proximal cut sites with minimal off-target risk",
];

function NewRunForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roId = searchParams.get("ro") ?? "";

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
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Run</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe your editing goal. The pipeline will scan for guide RNA candidates and score them.
        </p>
      </div>

      {roId && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">Research Object</p>
          <Hash hash={roId} chars={12} />
        </div>
      )}

      <div className="rounded-xl border bg-card p-6 space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Editing goal
            <span className="ml-1 text-destructive">*</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to achieve…"
            rows={4}
            disabled={submitting}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y disabled:opacity-50"
          />
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrompt(p)}
                className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!prompt.trim() || !roId || submitting}
            onClick={handleStart}
            className={cn(
              buttonVariants(),
              (!prompt.trim() || !roId || submitting) && "opacity-50 cursor-not-allowed"
            )}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <svg className="size-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Starting…
              </span>
            ) : "Start Run →"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewRunPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-muted-foreground">Loading…</div>}>
      <NewRunForm />
    </Suspense>
  );
}
