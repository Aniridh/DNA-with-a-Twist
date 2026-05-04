"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/getApiClient";
import type { ResearchObject } from "@schemas/ResearchObject";
import Link from "next/link";

// ── Fixture ──────────────────────────────────────────────────────────────────

const BCL11A_SEQUENCE = `>BCL11A_enhancer_plus58 chr2:60495978-60496378 hg38 | BCL11A +58 erythroid enhancer
GGATCCAGCTGCAGTGGGCAGAGACCTGTCCCCAGAGCCTGGGAATGTGGTGGGAGAACAGAGGAGAGC
AGGAGCCACAGATCCCAGCCATCCTGGAAGGAGGCAGAGCCACAGGATCCAGGGCAGCAGATCCTGGAAG
GCAGCCTGCAGGCAGAGACCTGTCCCCAGAGCCTGGGAATGTGGTGGGAGAACAGATGGAGAGCAGGAGC
CACAGATCCCAGCCATCCTGGAAGGAGGCAGCCTGCAGGCAGAGACCTGTCCCCAGAGCCTGGGAATGTG
GTGGGAGAACAGAGGAGAGCAGGAGCCACAGATCCCAGCCATCCTGGAAGGAGGCAGCCTGCAGGCAGAG
ACCTGTCCCCAGAGCCTGGGAATGTGGTGGGAGAACAGAGGAGAGCAGGAG`;

// ── SHA-256 ───────────────────────────────────────────────────────────────────

async function computeHash(seq: string): Promise<string> {
  const canonical = seq.replace(/^>.*$/gm, "").replace(/\s+/g, "").toUpperCase();
  const buf = new TextEncoder().encode(canonical);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Sequence analysis ─────────────────────────────────────────────────────────

function analyzeSequence(raw: string) {
  const seq = raw.replace(/^>.*$/gm, "").replace(/\s+/g, "").toUpperCase();
  const len = seq.length;
  if (len === 0) return null;
  const gc = (seq.split("").filter((c) => c === "G" || c === "C").length / len) * 100;
  const valid = /^[ATCGN]*$/.test(seq);
  return { len, gc: gc.toFixed(1), valid };
}

// ── Typed hash reveal ─────────────────────────────────────────────────────────

function HashReveal({ hash }: { hash: string }) {
  const [revealed, setRevealed] = useState(0);

  useState(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setRevealed(i);
      if (i >= hash.length) clearInterval(interval);
    }, 28);
    return () => clearInterval(interval);
  });

  return (
    <span className="font-mono text-teal text-base sm:text-2xl tracking-wide sm:tracking-wider break-all teal-glow">
      {hash.slice(0, revealed)}
      {revealed < hash.length && <span className="animate-pulse opacity-60">_</span>}
    </span>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

type Step = "input" | "review" | "confirm" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "input", label: "Sequence" },
  { key: "review", label: "Review" },
  { key: "confirm", label: "Create" },
];

function Stepper({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  const safeIdx = idx < 0 ? STEPS.length - 1 : idx;
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const done = i < safeIdx;
        const active = i === safeIdx;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold border transition-all",
                  done && "bg-teal border-teal text-[#0a0a0a]",
                  active && "border-teal text-teal bg-teal/10",
                  !done && !active && "border-[#333] text-muted-foreground"
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={cn("text-[11px] sm:text-sm", active ? "text-foreground font-medium" : "text-muted-foreground")}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("mx-2 sm:mx-4 h-px w-6 sm:w-8 shrink-0", done ? "bg-teal/50" : "bg-[#222]")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewROPage() {
  const [step, setStep] = useState<Step>("input");
  const [sequence, setSequence] = useState("");
  const [metadata, setMetadata] = useState([
    { key: "organism", value: "Homo sapiens" },
    { key: "gene", value: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [createdRO, setCreatedRO] = useState<ResearchObject | null>(null);
  const [creating, setCreating] = useState(false);
  const [hash, setHash] = useState<string | null>(null);

  const analysis = analyzeSequence(sequence);

  async function handleCreate() {
    if (!analysis) return;
    setCreating(true);
    setError(null);
    try {
      const h = await computeHash(sequence);
      setHash(h);
      const meta = Object.fromEntries(
        metadata.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value.trim()])
      );
      const ro = await apiClient.createResearchObject({
        backbone_upload_id: "demo",
        metadata: meta,
        _demo_content_hash: h,
      });
      setCreatedRO(ro);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setCreating(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-0">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">New Research Object</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently hash and identify your experimental inputs.
        </p>
      </div>

      <Stepper current={step} />

      <AnimatePresence mode="wait">
        {/* ── Step 1 ── */}
        {step === "input" && (
          <motion.div key="input" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="rounded-xl border border-[#222] bg-surface p-6 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">DNA sequence</label>
                <button type="button" onClick={() => setSequence(BCL11A_SEQUENCE)}
                  className="text-xs text-teal hover:text-teal-dim transition-colors">
                  Use example: BCL11A enhancer
                </button>
              </div>
              <textarea
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
                placeholder={">sequence_id\nATCGATCGATCG..."}
                rows={8}
                className="w-full rounded-lg border border-[#222] bg-[#0a0a0a] px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-teal/40 resize-y"
              />
              {analysis && (
                <div className="flex gap-4 text-xs font-mono">
                  <span className="text-muted-foreground">{analysis.len.toLocaleString()} bp</span>
                  <span className={analysis.gc && parseFloat(analysis.gc) >= 40 && parseFloat(analysis.gc) <= 60 ? "text-teal" : "text-amber-400"}>
                    GC {analysis.gc}%
                  </span>
                  {!analysis.valid && <span className="text-red-400">invalid chars</span>}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">Metadata</label>
              {metadata.map((pair, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" placeholder="key" value={pair.key}
                    onChange={(e) => setMetadata((m) => m.map((p, idx) => idx === i ? { ...p, key: e.target.value } : p))}
                    className="h-9 w-28 shrink-0 rounded-lg border border-[#222] bg-[#0a0a0a] px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-teal/40" />
                  <input type="text" placeholder="value" value={pair.value}
                    onChange={(e) => setMetadata((m) => m.map((p, idx) => idx === i ? { ...p, value: e.target.value } : p))}
                    className="h-9 flex-1 rounded-lg border border-[#222] bg-[#0a0a0a] px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-teal/40" />
                  <button type="button" onClick={() => setMetadata((m) => m.filter((_, idx) => idx !== i))}
                    className="h-9 w-9 shrink-0 rounded-lg border border-[#222] text-muted-foreground hover:text-red-400 transition-colors flex items-center justify-center">
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setMetadata((m) => [...m, { key: "", value: "" }])}
                className="text-xs text-muted-foreground hover:text-teal transition-colors">
                + Add field
              </button>
            </div>

            <div className="flex justify-end">
              <button type="button" disabled={!analysis?.valid || analysis.len === 0}
                onClick={() => setStep("review")}
                className="h-10 rounded-lg bg-teal px-6 text-sm font-medium text-[#0a0a0a] hover:bg-teal-dim transition-colors disabled:opacity-30">
                Review →
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 2 ── */}
        {step === "review" && (
          <motion.div key="review" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="rounded-xl border border-[#222] bg-surface p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="rounded-lg border border-[#222] bg-[#0a0a0a] p-3 sm:p-4 text-center">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Length</p>
                <p className="font-mono text-base sm:text-lg text-foreground">{analysis?.len.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">bp</p>
              </div>
              <div className="rounded-lg border border-[#222] bg-[#0a0a0a] p-3 sm:p-4 text-center">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">GC%</p>
                <p className={`font-mono text-base sm:text-lg ${parseFloat(analysis?.gc ?? "0") >= 40 ? "text-teal" : "text-amber-400"}`}>{analysis?.gc}%</p>
              </div>
              <div className="rounded-lg border border-[#222] bg-[#0a0a0a] p-3 sm:p-4 text-center">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Valid</p>
                <p className="font-mono text-base sm:text-lg text-teal">✓</p>
              </div>
            </div>

            <div className="rounded-lg border border-[#222] bg-[#0a0a0a] px-4 py-3 font-mono text-xs text-muted-foreground leading-relaxed max-h-24 overflow-hidden">
              {sequence.split("\n").slice(0, 3).join("\n")}
              {sequence.split("\n").length > 3 && "\n…"}
            </div>

            {metadata.some((p) => p.key.trim()) && (
              <div className="divide-y divide-[#222] rounded-lg border border-[#222]">
                {metadata.filter((p) => p.key.trim()).map((p) => (
                  <div key={p.key} className="flex gap-4 px-4 py-2.5 text-sm">
                    <dt className="w-28 shrink-0 text-muted-foreground">{p.key}</dt>
                    <dd className="font-mono text-foreground">{p.value || <span className="italic opacity-40">empty</span>}</dd>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm">
              <p className="font-medium text-amber-400">Creating a Research Object is permanent.</p>
              <p className="mt-0.5 text-amber-400/70 text-xs">The content hash locks these exact inputs. This record cannot be edited.</p>
            </div>

            <div className="flex justify-between">
              <button type="button" onClick={() => setStep("input")}
                className="h-10 rounded-lg border border-[#222] px-5 text-sm text-muted-foreground hover:text-foreground hover:border-[#333] transition-colors">
                ← Back
              </button>
              <button type="button" onClick={() => setStep("confirm")}
                className="h-10 rounded-lg bg-teal px-6 text-sm font-medium text-[#0a0a0a] hover:bg-teal-dim transition-colors">
                Confirm →
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 3: Confirm / creating ── */}
        {(step === "confirm" || creating) && !createdRO && (
          <motion.div key="confirm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl border border-[#222] bg-surface p-8 space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold text-foreground">Your Research Object</h2>
              <p className="text-sm text-muted-foreground">Creating this record is permanent and cryptographically sealed.</p>
            </div>

            <div className="rounded-xl border border-teal/20 bg-teal/5 p-6 text-center space-y-3">
              <p className="text-xs font-mono text-teal/60 uppercase tracking-widest">SHA-256 content hash</p>
              {hash ? (
                <HashReveal hash={hash} />
              ) : (
                <p className="font-mono text-teal/40 text-xl animate-pulse">Computing…</p>
              )}
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Covers backbone sequence, PAM, and all metadata. Anyone with this hash can verify your inputs.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">Bundle contents</p>
              <div className="space-y-1.5">
                {[
                  { label: "Backbone sequence", value: `${analysis?.len.toLocaleString()} bp · GC ${analysis?.gc}%` },
                  { label: "PAM", value: "NGG" },
                  ...metadata.filter((p) => p.key.trim()).map((p) => ({ label: p.key, value: p.value || "—" })),
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-mono text-foreground text-xs">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5">{error}</p>
            )}

            <div className="flex justify-between">
              <button type="button" onClick={() => setStep("review")} disabled={creating}
                className="h-10 rounded-lg border border-[#222] px-5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30">
                ← Back
              </button>
              <button type="button" onClick={handleCreate} disabled={creating}
                className="h-10 rounded-lg bg-teal px-6 text-sm font-medium text-[#0a0a0a] hover:bg-teal-dim transition-colors disabled:opacity-50 flex items-center gap-2">
                {creating ? (
                  <>
                    <svg className="size-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating…
                  </>
                ) : "Create Research Object"}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Done ── */}
        {step === "done" && createdRO && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-teal/30 bg-teal/5 p-8 text-center space-y-6">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-teal/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-8 text-teal">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">Research Object created</p>
              <p className="text-sm text-muted-foreground mt-1">Your inputs are permanently hashed.</p>
            </div>
            <div className="rounded-xl border border-teal/20 bg-[#0a0a0a] px-6 py-5 inline-block mx-auto">
              <p className="text-[10px] font-mono text-teal/50 uppercase tracking-widest mb-2">content hash</p>
              <p className="font-mono text-teal text-lg break-all">{createdRO.content_hash}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Link href={`/research-objects/${createdRO.id}`}
                className="h-10 rounded-lg border border-[#222] px-5 text-sm text-muted-foreground hover:text-foreground hover:border-[#333] transition-colors flex items-center">
                View Research Object
              </Link>
              <Link href={`/runs/new?ro=${createdRO.id}`}
                className="h-10 rounded-lg bg-teal px-5 text-sm font-medium text-[#0a0a0a] hover:bg-teal-dim transition-colors flex items-center">
                Start a Run →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
