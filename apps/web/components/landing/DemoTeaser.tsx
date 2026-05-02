"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp } from "@/lib/design-tokens";

const BCL11A_SEQUENCE = `>BCL11A_enhancer_plus58 chr2:60495978-60496378 hg38
GGATCCAGCTGCAGTGGGCAGAGACCTGTCCCCAGAGCCTGGGAATGTGGTGGGAGAACAGAGGAGAGC
AGGAGCCACAGATCCCAGCCATCCTGGAAGGAGGCAGAGCCACAGGATCCAGGGCAGCAGATCCTGGAAG
GCAGCCTGCAGGCAGAGACCTGTCCCCAGAGCCTGGGAATGTGGTGGGAGAACAGATGGAGAGCAGGAGC
CACAGATCCCAGCCATCCTGGAAGGAGGCAGCCTGCAGGCAGAGACCTGTCCCCAGAGCCTGGGAATGTG`;

async function sha256(text: string): Promise<string> {
  const canonical = text.replace(/^>.*$/gm, "").replace(/\s+/g, "").toUpperCase();
  const buf = new TextEncoder().encode(canonical);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const MOCK_EVENTS = [
  { type: "preflight.ok", color: "text-blue-400", msg: "Inputs validated, hashes recorded" },
  { type: "extract.features", color: "text-violet-400", msg: "Region chr2:60,716,108-60,728,612 · 47 candidates" },
  { type: "simulate.tick", color: "text-teal", msg: "tick 3 · 12 candidates remaining" },
  { type: "score.emit", color: "text-amber-400", msg: "GATAAGCTTAGCGTAACGTA · on-target 0.87" },
  { type: "score.emit", color: "text-amber-400", msg: "CTAGGCTTAAGCGTACGTAA · on-target 0.72" },
  { type: "summary.done", color: "text-green-400", msg: "5 guides scored · top score 0.87" },
];

const MOCK_GUIDES = [
  { seq: "GATAAGCTTAGCGTAACGTA", score: 0.87, off: 3 },
  { seq: "CTAGGCTTAAGCGTACGTAA", score: 0.72, off: 7 },
  { seq: "TTGACGAATCGGATAGCCAT", score: 0.65, off: 1 },
];

type Phase = "idle" | "hashing" | "streaming" | "done";

export function DemoTeaser() {
  const [sequence, setSequence] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [hash, setHash] = useState("");
  const [hashRevealed, setHashRevealed] = useState(0);
  const [visibleEvents, setVisibleEvents] = useState(0);
  const [visibleGuides, setVisibleGuides] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const seqLen = sequence.replace(/^>.*$/gm, "").replace(/\s+/g, "").length;

  function reset() {
    setPhase("idle");
    setHash("");
    setHashRevealed(0);
    setVisibleEvents(0);
    setVisibleGuides(0);
  }

  async function runDemo() {
    if (!sequence.trim()) return;
    reset();
    setPhase("hashing");

    const h = await sha256(sequence);
    setHash(h);

    // Reveal hash char by char
    let i = 0;
    const reveal = setInterval(() => {
      i++;
      setHashRevealed(i);
      if (i >= h.length) {
        clearInterval(reveal);
        setPhase("streaming");
        streamEvents();
      }
    }, 32);
  }

  function streamEvents() {
    let idx = 0;
    const next = () => {
      if (idx >= MOCK_EVENTS.length) {
        setTimeout(() => {
          setPhase("done");
          streamGuides();
        }, 400);
        return;
      }
      setVisibleEvents(idx + 1);
      idx++;
      timerRef.current = setTimeout(next, 700);
    };
    timerRef.current = setTimeout(next, 300);
  }

  function streamGuides() {
    let i = 0;
    const next = () => {
      if (i >= MOCK_GUIDES.length) return;
      setVisibleGuides(i + 1);
      i++;
      timerRef.current = setTimeout(next, 500);
    };
    next();
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <section className="py-32 px-6 bg-[#0a0a0a]">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="mb-16 text-center"
        >
          <p className="text-sm font-mono text-teal uppercase tracking-widest mb-4">Live demo</p>
          <h2 className="text-heading text-foreground">See it work in 30 seconds</h2>
          <p className="mt-4 text-lg text-muted-foreground">Paste a sequence, watch it hash, run, and score.</p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Input */}
          <div className="space-y-4">
            <div className="rounded-xl border border-[#222] bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">DNA sequence</label>
                <button
                  type="button"
                  onClick={() => { setSequence(BCL11A_SEQUENCE); reset(); }}
                  className="text-xs text-teal hover:text-teal-dim transition-colors"
                >
                  Use example: BCL11A enhancer
                </button>
              </div>
              <textarea
                value={sequence}
                onChange={(e) => { setSequence(e.target.value); reset(); }}
                placeholder=">sequence_id&#10;ATCGATCG..."
                rows={6}
                className="w-full rounded-lg border border-[#222] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-teal/50 resize-none"
              />
              {seqLen > 0 && (
                <p className="text-xs text-muted-foreground font-mono">{seqLen.toLocaleString()} bp</p>
              )}
              <button
                type="button"
                onClick={runDemo}
                disabled={!seqLen || phase === "hashing" || phase === "streaming"}
                className="w-full h-10 rounded-md bg-teal text-[#0a0a0a] text-sm font-medium hover:bg-teal-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {phase === "idle" || phase === "done" ? "Run demo" : "Running…"}
              </button>
            </div>
          </div>

          {/* Output */}
          <div className="rounded-xl border border-[#222] bg-surface p-5 space-y-5 min-h-64">
            <AnimatePresence mode="wait">
              {phase === "idle" && (
                <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-sm text-muted-foreground/50 text-center pt-12">
                  Output will appear here
                </motion.p>
              )}

              {(phase === "hashing" || phase === "streaming" || phase === "done") && (
                <motion.div key="output" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {/* Hash */}
                  <div>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">
                      content_hash · SHA-256
                    </p>
                    <p className="font-mono text-sm text-teal break-all leading-relaxed">
                      {hash.slice(0, hashRevealed)}
                      {hashRevealed < hash.length && phase === "hashing" && (
                        <span className="animate-pulse opacity-60">_</span>
                      )}
                    </p>
                  </div>

                  {/* Events */}
                  {visibleEvents > 0 && (
                    <div className="rounded-lg border border-[#222] bg-[#0a0a0a] p-3 space-y-1">
                      {MOCK_EVENTS.slice(0, visibleEvents).map((e, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex gap-2 text-[11px] font-mono"
                        >
                          <span className={`${e.color} shrink-0 w-24`}>{e.type}</span>
                          <span className="text-muted-foreground truncate">{e.msg}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Guides */}
                  {visibleGuides > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                        Top guide candidates
                      </p>
                      {MOCK_GUIDES.slice(0, visibleGuides).map((g, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-3 rounded-lg border border-[#222] bg-surface px-3 py-2"
                        >
                          <span className="font-mono text-xs text-foreground tracking-wide">{g.seq}</span>
                          <span className={`ml-auto text-xs font-mono shrink-0 ${g.score >= 0.8 ? "text-teal" : g.score >= 0.6 ? "text-amber-400" : "text-muted-foreground"}`}>
                            {g.score.toFixed(2)}
                          </span>
                          <span className={`text-xs shrink-0 ${g.off <= 3 ? "text-green-400" : g.off <= 7 ? "text-amber-400" : "text-red-400"}`}>
                            {g.off} off
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mt-10 text-center"
        >
          <Link
            href="/login"
            className="inline-flex h-12 items-center rounded-md bg-teal px-8 text-base font-medium text-[#0a0a0a] hover:bg-teal-dim transition-colors shadow-lg shadow-teal/10"
          >
            See the full demo →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
