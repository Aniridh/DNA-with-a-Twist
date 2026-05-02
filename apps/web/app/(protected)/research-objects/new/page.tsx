"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Hash } from "@/components/primitives/Hash";
import { apiClient } from "@/lib/getApiClient";
import type { ResearchObject } from "@schemas/ResearchObject";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

// ── BCL11A example sequence ──────────────────────────────────────────────────

const BCL11A_SEQUENCE = `>BCL11A_enhancer_plus58 chr2:60495978-60496378 hg38 | BCL11A +58 erythroid enhancer
GGATCCAGCTGCAGTGGGCAGAGACCTGTCCCCAGAGCCTGGGAATGTGGTGGGAGAACAGAGGAGAGC
AGGAGCCACAGATCCCAGCCATCCTGGAAGGAGGCAGAGCCACAGGATCCAGGGCAGCAGATCCTGGAAG
GCAGCCTGCAGGCAGAGACCTGTCCCCAGAGCCTGGGAATGTGGTGGGAGAACAGATGGAGAGCAGGAGC
CACAGATCCCAGCCATCCTGGAAGGAGGCAGCCTGCAGGCAGAGACCTGTCCCCAGAGCCTGGGAATGTG
GTGGGAGAACAGAGGAGAGCAGGAGCCACAGATCCCAGCCATCCTGGAAGGAGGCAGCCTGCAGGCAGAG
ACCTGTCCCCAGAGCCTGGGAATGTGGTGGGAGAACAGAGGAGAGCAGGAG`;

// ── SHA-256 via SubtleCrypto (requires secure context: localhost or HTTPS) ──

async function computeSequenceHash(seq: string): Promise<string> {
  const canonical = seq.replace(/^>.*$/gm, "").replace(/\s+/g, "").toUpperCase();
  const buf = new TextEncoder().encode(canonical);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Types ────────────────────────────────────────────────────────────────────

type Step = "input" | "review" | "creating" | "done";

const STEPS = ["Sequence", "Review", "Hash reveal"] as const;

// ── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const idx = current === "input" ? 0 : current === "review" ? 1 : 2;
  return (
    <ol className="flex items-center gap-0">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                i < idx && "border-primary bg-primary text-primary-foreground",
                i === idx && "border-primary bg-primary text-primary-foreground",
                i > idx && "border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {i < idx ? "✓" : i + 1}
            </span>
            <span className={cn("text-sm", i === idx ? "font-medium text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("mx-3 h-px w-8 shrink-0", i < idx ? "bg-primary" : "bg-muted-foreground/20")} />
          )}
        </li>
      ))}
    </ol>
  );
}

// ── Hash reveal ──────────────────────────────────────────────────────────────

function HashReveal({ ro }: { ro: ResearchObject }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center animate-hash-reveal">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
        <CheckCircleIcon className="size-8 text-emerald-600 dark:text-emerald-400" />
      </div>

      <div className="space-y-1">
        <p className="text-lg font-semibold">Research Object created</p>
        <p className="text-sm text-muted-foreground">
          Your inputs are now permanently identified by this content hash.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Content hash
        </p>
        <div className="rounded-xl border bg-muted/40 px-6 py-4">
          <Hash hash={ro.content_hash} chars={12} className="text-base" />
        </div>
        <p className="text-xs text-muted-foreground max-w-xs">
          This hash covers your exact sequence, PAM, and metadata. Anyone with this hash
          can verify the exact inputs that produced any run.
        </p>
      </div>

      <div className="flex gap-3">
        <Link href={`/research-objects/${ro.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
          View Research Object
        </Link>
        <Link href={`/runs/new?ro=${ro.id}`} className={cn(buttonVariants())}>
          Start a Run →
        </Link>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewResearchObjectPage() {
  const [step, setStep] = useState<Step>("input");
  const [sequence, setSequence] = useState("");
  const [metadata, setMetadata] = useState([
    { key: "organism", value: "Homo sapiens" },
    { key: "gene", value: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [createdRO, setCreatedRO] = useState<ResearchObject | null>(null);

  const seqLength = sequence.replace(/^>.*$/gm, "").replace(/\s+/g, "").length;
  const canProceed = seqLength > 0;

  async function handleCreate() {
    setStep("creating");
    setError(null);
    try {
      const hash = await computeSequenceHash(sequence);
      const meta = Object.fromEntries(
        metadata.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value.trim()])
      );
      const ro = await apiClient.createResearchObject({
        backbone_upload_id: "demo",
        metadata: meta,
        _demo_content_hash: hash,
      });
      setCreatedRO(ro);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create Research Object");
      setStep("review");
    }
  }

  function updateMeta(i: number, field: "key" | "value", val: string) {
    setMetadata((m) => m.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Research Object</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste your DNA sequence to create a permanently identified, verifiable record.
        </p>
      </div>

      <StepIndicator current={step} />

      <div className="rounded-xl border bg-card p-6">
        {/* ── Step 1: Sequence input ── */}
        {step === "input" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">
                  DNA sequence
                  <span className="ml-1 text-destructive">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setSequence(BCL11A_SEQUENCE)}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground transition-colors"
                >
                  Use example: BCL11A enhancer
                </button>
              </div>
              <textarea
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
                placeholder=">sequence_id&#10;ATCGATCGATCG..."
                rows={8}
                className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              />
              {seqLength > 0 && (
                <p className="text-xs text-muted-foreground">{seqLength.toLocaleString()} bp</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Metadata</label>
              <div className="space-y-2">
                {metadata.map((pair, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="key"
                      value={pair.key}
                      onChange={(e) => updateMeta(i, "key", e.target.value)}
                      className="h-9 w-32 shrink-0 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <input
                      type="text"
                      placeholder="value"
                      value={pair.value}
                      onChange={(e) => updateMeta(i, "value", e.target.value)}
                      className="h-9 flex-1 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setMetadata((m) => m.filter((_, idx) => idx !== i))}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove field"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setMetadata((m) => [...m, { key: "", value: "" }])}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                + Add field
              </button>
            </div>

            {error && <ErrorBanner message={error} />}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!canProceed}
                onClick={() => setStep("review")}
                className={cn(buttonVariants(), !canProceed && "opacity-50 cursor-not-allowed")}
              >
                Review →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Review ── */}
        {step === "review" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sequence</h2>
              <div className="rounded-lg border bg-muted/20 px-4 py-3 font-mono text-xs text-muted-foreground leading-relaxed">
                <p className="truncate">{sequence.split("\n")[0]}</p>
                <p className="mt-0.5">{seqLength.toLocaleString()} bp</p>
              </div>
            </div>

            {metadata.some((p) => p.key.trim()) && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Metadata</h2>
                <dl className="divide-y rounded-lg border">
                  {metadata.filter((p) => p.key.trim()).map((p) => (
                    <div key={p.key} className="flex gap-4 px-4 py-2 text-sm">
                      <dt className="w-32 shrink-0 text-muted-foreground">{p.key}</dt>
                      <dd className="font-mono">{p.value || <span className="text-muted-foreground italic">empty</span>}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950">
              <p className="font-medium text-amber-800 dark:text-amber-200">Creating a Research Object is permanent.</p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                The content hash locks this exact sequence and metadata. You cannot edit them after creation.
              </p>
            </div>

            {error && <ErrorBanner message={error} />}

            <div className="flex justify-between">
              <button type="button" onClick={() => setStep("input")} className={cn(buttonVariants({ variant: "outline" }))}>
                ← Back
              </button>
              <button type="button" onClick={handleCreate} className={cn(buttonVariants())}>
                Create Research Object
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3a: Creating ── */}
        {step === "creating" && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <SpinnerIcon className="size-8 animate-spin text-muted-foreground" />
            <div>
              <p className="font-medium">Computing content hash…</p>
              <p className="mt-1 text-sm text-muted-foreground">Canonicalizing sequence and recording provenance</p>
            </div>
          </div>
        )}

        {/* ── Step 3b: Done ── */}
        {step === "done" && createdRO && <HashReveal ro={createdRO} />}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className={cn("size-5", className)} aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("size-8", className)} aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
