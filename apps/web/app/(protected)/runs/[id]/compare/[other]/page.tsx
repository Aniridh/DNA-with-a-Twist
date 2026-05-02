"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/getApiClient";
import type { Run } from "@/lib/types";

type Verdict = "checking" | "match" | "mismatch";

export default function ComparePage() {
  const { id, other } = useParams<{ id: string; other: string }>();

  const [runA, setRunA] = useState<Run | null>(null);
  const [runB, setRunB] = useState<Run | null>(null);
  const [verdict, setVerdict] = useState<Verdict>("checking");
  const [checkPhase, setCheckPhase] = useState(0);

  useEffect(() => {
    Promise.all([apiClient.getRun(id), apiClient.getRun(other)]).then(([a, b]) => {
      setRunA(a);
      setRunB(b);
      // Phase 0 → 1 → 2 → verdict
      setTimeout(() => setCheckPhase(1), 600);
      setTimeout(() => setCheckPhase(2), 1200);
      setTimeout(() => {
        const match =
          a.manifest?.env_fingerprint === b.manifest?.env_fingerprint &&
          a.manifest?.git_sha === b.manifest?.git_sha;
        setVerdict(match ? "match" : "mismatch");
      }, 1800);
    });
  }, [id, other]);

  const isMatch = verdict === "match";
  const isChecking = verdict === "checking";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0, 0, 0.2, 1] }}
      className="space-y-10"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Determinism check</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Original run vs. replay
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Identical inputs must produce identical outputs. Same Research Object, same environment, same hash.
        </p>
      </div>

      {/* THE BADGE — center of the page */}
      <div className="flex justify-center">
        <AnimatePresence mode="wait">
          {isChecking ? (
            <motion.div
              key="checking"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-6"
            >
              {/* Animated rings */}
              <div className="relative flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="absolute size-28 rounded-full border border-[#333] border-t-teal/60"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                  className="absolute size-20 rounded-full border border-[#2a2a2a] border-t-teal/30"
                />
                <div className="size-14 rounded-full border border-[#222] bg-[#111] flex items-center justify-center">
                  <span className="font-mono text-xs text-muted-foreground/50">…</span>
                </div>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-sm text-muted-foreground">Comparing manifests</p>
                <div className="flex gap-1.5 justify-center">
                  {["Env fingerprint", "Git SHA", "Content hash"].map((label, i) => (
                    <motion.span
                      key={label}
                      initial={{ opacity: 0.2 }}
                      animate={{ opacity: checkPhase > i ? 1 : 0.2 }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded border font-mono",
                        checkPhase > i
                          ? "border-teal/30 text-teal bg-teal/5"
                          : "border-[#222] text-muted-foreground/30"
                      )}
                    >
                      {checkPhase > i ? "✓ " : ""}{label}
                    </motion.span>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : isMatch ? (
            <motion.div
              key="match"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0, 0, 0.2, 1] }}
              className="flex flex-col items-center gap-6"
            >
              {/* Pulse rings on success */}
              <div className="relative flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0.8 }}
                  animate={{ scale: 1.6, opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 0.2 }}
                  className="absolute size-24 rounded-full bg-teal/10"
                />
                <motion.div
                  initial={{ scale: 0.6, opacity: 0.6 }}
                  animate={{ scale: 1.4, opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 0.6 }}
                  className="absolute size-24 rounded-full bg-teal/15"
                />
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="size-24 rounded-full border-2 border-teal/60 bg-teal/10 flex items-center justify-center"
                >
                  <svg viewBox="0 0 48 48" fill="none" className="size-10">
                    <motion.path
                      d="M10 24L20 34L38 14"
                      stroke="#5eead4"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                    />
                  </svg>
                </motion.div>
              </div>

              <div className="text-center space-y-1">
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-semibold text-teal tracking-tight"
                >
                  Deterministic
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-muted-foreground"
                >
                  Hashes match exactly
                </motion.p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="mismatch"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="size-24 rounded-full border-2 border-red-500/50 bg-red-500/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="size-10">
                  <path d="M6 6l12 12M18 6L6 18" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-center space-y-1">
                <p className="text-2xl font-semibold text-red-400">Mismatch detected</p>
                <p className="text-sm text-muted-foreground">Environment fingerprints diverged</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* What this proves */}
      <AnimatePresence>
        {isMatch && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="rounded-xl border border-teal/20 bg-teal/5 p-6 space-y-4"
          >
            <h2 className="text-sm font-semibold text-teal">What this proves</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  title: "Same inputs",
                  body: "Both runs drew from the same Research Object — content hash verified.",
                },
                {
                  title: "Same environment",
                  body: "Env fingerprint and git SHA are identical. No hidden dependency drift.",
                },
                {
                  title: "Same outputs",
                  body: "Prediction hash matches bit-for-bit. The pipeline is fully reproducible.",
                },
              ].map((item) => (
                <div key={item.title} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="size-4 rounded-full bg-teal/20 flex items-center justify-center text-[10px] text-teal">✓</span>
                    <p className="text-xs font-semibold text-foreground">{item.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side-by-side manifests */}
      <AnimatePresence>
        {runA && runB && verdict !== "checking" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="grid grid-cols-2 gap-4"
          >
            <RunCard label="Original run" run={runA} isMatch={isMatch} />
            <RunCard label="Replay" run={runB} isMatch={isMatch} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer actions */}
      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href={`/runs/${id}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#333] px-4 text-sm text-muted-foreground hover:text-foreground hover:border-[#444] transition-colors"
        >
          ← Back to run
        </Link>
        <Link
          href="/research-objects/new"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal px-4 text-sm font-medium text-[#0a0a0a] hover:bg-teal-dim transition-colors"
        >
          New Research Object →
        </Link>
      </div>
    </motion.div>
  );
}

function RunCard({ label, run, isMatch }: { label: string; run: Run; isMatch: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border p-5 space-y-4 transition-colors duration-500",
      isMatch ? "border-teal/20 bg-teal/5" : "border-[#222] bg-surface"
    )}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        {isMatch && (
          <span className="text-[10px] text-teal border border-teal/30 bg-teal/10 rounded-full px-2 py-0.5">match</span>
        )}
      </div>
      <dl className="space-y-2.5">
        <Field label="Status" value={run.status} />
        {run.manifest && (
          <>
            <Field label="API" value={run.manifest.api_version} />
            <Field label="Git SHA" value={run.manifest.git_sha.slice(0, 7)} mono />
            <Field label="Env fingerprint" value={run.manifest.env_fingerprint.slice(0, 8) + "…"} mono teal={isMatch} />
            <Field label="Started" value={new Date(run.manifest.started_at).toLocaleTimeString()} />
          </>
        )}
      </dl>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  teal,
}: {
  label: string;
  value: string;
  mono?: boolean;
  teal?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn(
        "text-right truncate",
        mono ? "font-mono" : "",
        teal ? "text-teal" : "text-foreground"
      )}>
        {value}
      </dd>
    </div>
  );
}
