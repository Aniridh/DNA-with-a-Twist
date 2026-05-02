"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/design-tokens";

const BCL11A_RAW = "GGATCCAGCTGCAGTGGGCAGAGACCTGTCCCCAGAGCCTGGGAATGTGGTGGGAGAACAGAGGAGAGCAGGAGCCACAGATCCCAGCCATCCTGGAAGG";

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function HashTyper({ hash }: { hash: string }) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    setRevealed(0);
    const interval = setInterval(() => {
      setRevealed((n) => {
        if (n >= hash.length) {
          clearInterval(interval);
          return n;
        }
        return n + 1;
      });
    }, 48);
    return () => clearInterval(interval);
  }, [hash]);

  return (
    <span className="font-mono text-teal text-lg sm:text-xl tracking-wider teal-glow">
      {hash.slice(0, revealed)}
      {revealed < hash.length && (
        <span className="animate-pulse opacity-70">_</span>
      )}
    </span>
  );
}

export function Hero() {
  const [hash, setHash] = useState<string | null>(null);
  const loopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const h = await sha256(BCL11A_RAW);
      if (cancelled) return;
      setHash(h);
      // re-trigger loop after 5s
      loopRef.current = setTimeout(() => {
        if (!cancelled) {
          setHash(null);
          setTimeout(() => {
            if (!cancelled) run();
          }, 200);
        }
      }, 5000);
    }
    run();
    return () => {
      cancelled = true;
      if (loopRef.current) clearTimeout(loopRef.current);
    };
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-grid">
      {/* Radial vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(94,234,212,0.04) 0%, transparent 70%), radial-gradient(ellipse 100% 100% at 50% 100%, #0a0a0a 60%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-32 pb-20 text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
          className="space-y-8"
        >
          {/* Eyebrow */}
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full border border-teal/20 bg-teal/5 px-4 py-1.5 text-xs font-mono text-teal tracking-widest uppercase">
              <span className="size-1.5 rounded-full bg-teal animate-pulse" />
              Open beta — mock data, real cryptography
            </span>
          </motion.div>

          {/* Display headline */}
          <motion.h1
            variants={fadeUp}
            className="text-display text-balance text-foreground"
          >
            The system of record{" "}
            <br className="hidden sm:block" />
            <span className="text-teal">for gene editing</span>
          </motion.h1>

          {/* Subhead */}
          <motion.p
            variants={fadeUp}
            className="mx-auto max-w-2xl text-xl text-muted-foreground leading-relaxed"
          >
            Hash, version, and replay every CRISPR experiment.
            <br className="hidden sm:block" />
            Verifiable by default.
          </motion.p>

          {/* Hash animation */}
          <motion.div
            variants={fadeUp}
            className="mx-auto max-w-xl rounded-xl border border-teal/20 bg-surface/60 px-6 py-5 text-left"
          >
            <p className="mb-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              SHA-256 · BCL11A +58 enhancer · canonical sequence
            </p>
            <div className="min-h-[28px]">
              {hash !== null ? <HashTyper hash={hash} /> : (
                <span className="font-mono text-teal/40 text-lg animate-pulse">computing…</span>
              )}
            </div>
          </motion.div>

          {/* CTAs */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center rounded-md bg-teal px-8 text-base font-medium text-[#0a0a0a] hover:bg-teal-dim transition-colors duration-150 shadow-lg shadow-teal/10"
            >
              Try the demo
            </Link>
            <a
              href="#pipeline"
              className="inline-flex h-12 items-center rounded-md border border-border px-8 text-base font-medium text-muted-foreground hover:text-foreground hover:border-muted transition-colors duration-150"
            >
              See how it works ↓
            </a>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom gradient */}
      <div className="pointer-events-none absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
    </section>
  );
}
