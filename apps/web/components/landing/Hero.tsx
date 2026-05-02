"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

// ── Constants ────────────────────────────────────────────────────────────────

const BCL11A_RAW =
  "GGATCCAGCTGCAGTGGGCAGAGACCTGTCCCCAGAGCCTGGGAATGTGGTGGGAGAACAGAGGAGAGCAGGAGCCACAGATCCCAGCCATCCTGGAAGG";

const FALLBACK_HASH = "9f3ca4e2b87d1f605c3a29e4d81f9b0e3c5d7a2f1e8b4c6d9a0f3e7b2c5d8a1f4";

const WORDS: { text: string; teal: boolean }[] = [
  { text: "The", teal: false },
  { text: "system", teal: false },
  { text: "of", teal: false },
  { text: "record", teal: false },
  { text: "for", teal: true },
  { text: "gene", teal: true },
  { text: "editing", teal: true },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ── Border draw: 4 segments, clockwise, 100ms each ──────────────────────────

function DrawBorder({ active }: { active: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
      {/* top */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-px bg-teal/25 origin-left"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: active ? 1 : 0 }}
        transition={{ duration: 0.1, delay: 0, ease: "easeOut" }}
      />
      {/* right */}
      <motion.div
        className="absolute top-0 right-0 bottom-0 w-px bg-teal/25 origin-top"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: active ? 1 : 0 }}
        transition={{ duration: 0.1, delay: 0.1, ease: "easeOut" }}
      />
      {/* bottom */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px bg-teal/25 origin-right"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: active ? 1 : 0 }}
        transition={{ duration: 0.1, delay: 0.2, ease: "easeOut" }}
      />
      {/* left */}
      <motion.div
        className="absolute top-0 left-0 bottom-0 w-px bg-teal/25 origin-bottom"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: active ? 1 : 0 }}
        transition={{ duration: 0.1, delay: 0.3, ease: "easeOut" }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Hero() {
  // Compute hash once
  const [hashValue, setHashValue] = useState<string | null>(null);
  const hashRef = useRef<string | null>(null);
  useEffect(() => {
    sha256(BCL11A_RAW).then((h) => {
      setHashValue(h);
      hashRef.current = h;
    });
  }, []);

  // Determine if we should animate (once per session, skip if reduced motion)
  const [shouldAnimate] = useState<boolean>(() => false); // server-safe default
  const [animEnabled, setAnimEnabled] = useState(false);

  // Animation visibility states — default to final (shown) state
  const [gridAnim, setGridAnim] = useState<"hidden" | "visible" | "loop">("visible");
  const [glowAnim, setGlowAnim] = useState<"hidden" | "visible" | "loop">("visible");
  const [eyebrow, setEyebrow] = useState(true);
  const [wordCount, setWordCount] = useState(WORDS.length);
  const [subtitle, setSubtitle] = useState(true);
  const [hashCard, setHashCard] = useState(true);
  const [hashChars, setHashChars] = useState(64);
  const [cta, setCta] = useState(true);
  const [introDone, setIntroDone] = useState(true);
  const [flickerSet, setFlickerSet] = useState<Set<number>>(new Set());

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const typingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(true);

  // Finalize everything instantly (scroll-skip or reduced-motion path)
  const finalize = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (typingInterval.current) clearInterval(typingInterval.current);
    setGridAnim("loop");
    setGlowAnim("loop");
    setEyebrow(true);
    setWordCount(WORDS.length);
    setSubtitle(true);
    setHashCard(true);
    setHashChars(hashRef.current?.length ?? 64);
    setCta(true);
    setIntroDone(true);
    doneRef.current = true;
  }, []);

  // Bootstrap: decide whether to animate (client-only)
  useEffect(() => {
    const reduced = prefersReducedMotion();
    const played = sessionStorage.getItem("hero_intro_played");

    if (reduced || played) {
      // Already in final state — just switch to looping ambience
      setGridAnim("loop");
      setGlowAnim("loop");
      return;
    }

    // First visit, motion OK — reset to hidden and play intro
    sessionStorage.setItem("hero_intro_played", "1");
    setGridAnim("hidden");
    setGlowAnim("hidden");
    setEyebrow(false);
    setWordCount(0);
    setSubtitle(false);
    setHashCard(false);
    setHashChars(0);
    setCta(false);
    setIntroDone(false);
    doneRef.current = false;
    setAnimEnabled(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Orchestration (only when animEnabled flips to true)
  useEffect(() => {
    if (!animEnabled) return;

    const t = (ms: number, fn: () => void) => {
      const id = setTimeout(fn, ms);
      timers.current.push(id);
      return id;
    };

    // T=100ms: grid + glow appear
    t(100, () => setGridAnim("visible"));
    t(100, () => setGlowAnim("visible"));

    // T=300ms: eyebrow pill
    t(300, () => setEyebrow(true));

    // T=600ms: words, 300ms stagger
    WORDS.forEach((_, i) => t(600 + i * 300, () => setWordCount(i + 1)));

    // T=2000ms: subtitle
    t(2000, () => setSubtitle(true));

    // T=2400ms: hash card materialises
    t(2400, () => setHashCard(true));

    // T=2800ms: CTAs
    t(2800, () => setCta(true));

    // T=3200ms: orchestration complete, start ambient loops
    t(3200, () => {
      setGridAnim("loop");
      setGlowAnim("loop");
      setIntroDone(true);
      doneRef.current = true;
    });

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [animEnabled]);

  // Hash typing: starts when card is visible + hash is ready
  useEffect(() => {
    if (!hashCard) return;
    const target = hashRef.current?.length ?? 64;
    if (hashChars >= target) return;

    const start = setTimeout(() => {
      typingInterval.current = setInterval(() => {
        setHashChars((n) => {
          const max = hashRef.current?.length ?? 64;
          if (n >= max) {
            clearInterval(typingInterval.current!);
            return n;
          }
          return n + 1;
        });
      }, 30);
    }, 80);

    return () => {
      clearTimeout(start);
      if (typingInterval.current) clearInterval(typingInterval.current);
    };
  }, [hashCard]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll-to-skip
  useEffect(() => {
    if (!animEnabled) return;
    const handler = () => { if (!doneRef.current) finalize(); };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [animEnabled, finalize]);

  // Ambient hash flicker (after intro done)
  useEffect(() => {
    if (!introDone || prefersReducedMotion()) return;
    const h = hashRef.current ?? FALLBACK_HASH;
    const tick = () => {
      const count = 3 + Math.floor(Math.random() * 3);
      const indices = new Set<number>();
      while (indices.size < count) indices.add(Math.floor(Math.random() * h.length));
      setFlickerSet(indices);
      setTimeout(() => setFlickerSet(new Set()), 600);
    };
    const id = setInterval(tick, 12000);
    return () => clearInterval(id);
  }, [introDone]);

  // Derived display state
  const displayHash = hashValue ?? FALLBACK_HASH;
  const typedChars = displayHash.slice(0, Math.min(hashChars, displayHash.length));
  const cursorBlinks = hashChars >= displayHash.length;
  const isLoop = introDone && !prefersReducedMotion();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">

      {/* Grid */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-grid"
        animate={
          gridAnim === "loop"
            ? { opacity: [0.10, 0.12, 0.10] }
            : gridAnim === "visible"
            ? { opacity: 0.10 }
            : { opacity: 0 }
        }
        transition={
          gridAnim === "loop"
            ? { duration: 8, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.4, ease: "easeOut" }
        }
      />

      {/* Ambient glow */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(94,234,212,0.055) 0%, transparent 70%)",
        }}
        animate={
          glowAnim === "loop"
            ? { opacity: [0.7, 1, 0.7] }
            : glowAnim === "visible"
            ? { opacity: 1 }
            : { opacity: 0 }
        }
        transition={
          glowAnim === "loop"
            ? { duration: 6, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.6, ease: "easeOut" }
        }
      />

      {/* Bottom fade */}
      <div className="pointer-events-none absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6 pt-32 pb-20 text-center">
        <div className="space-y-8">

          {/* Eyebrow pill */}
          <motion.div
            animate={{ opacity: eyebrow ? 1 : 0, y: eyebrow ? 0 : 8 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-teal/20 bg-teal/5 px-4 py-1.5 text-xs font-mono text-teal tracking-widest uppercase">
              <span className="size-1.5 rounded-full bg-teal animate-pulse" />
              Open beta — mock data, real cryptography
            </span>
          </motion.div>

          {/* Headline — word by word */}
          <h1 className="text-display text-balance leading-[1.1]">
            {WORDS.map((word, i) => {
              const visible = wordCount > i;
              const isLastTeal = word.teal && i === WORDS.length - 1;
              return (
                <motion.span
                  key={i}
                  animate={{
                    opacity: visible ? 1 : 0,
                    y: visible ? 0 : 12,
                    color: isLastTeal && visible
                      ? "#5eead4"
                      : word.teal
                      ? "rgba(94,234,212,0.85)"
                      : "var(--foreground)",
                  }}
                  transition={{
                    opacity: { duration: 0.3, ease: "easeOut" },
                    y: { duration: 0.3, ease: "easeOut" },
                    color: { duration: 0.4, ease: "easeOut" },
                  }}
                  style={{ display: "inline-block", marginRight: "0.28em" }}
                >
                  {word.text}
                </motion.span>
              );
            })}
          </h1>

          {/* Subtitle */}
          <motion.p
            animate={{ opacity: subtitle ? 1 : 0, y: subtitle ? 0 : 8 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mx-auto max-w-2xl text-xl text-muted-foreground leading-relaxed"
          >
            Hash, version, and replay every CRISPR experiment.
            <br className="hidden sm:block" />
            Verifiable by default.
          </motion.p>

          {/* Hash terminal card */}
          <motion.div
            animate={{ opacity: hashCard ? 1 : 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative mx-auto max-w-xl"
          >
            <div className="relative rounded-xl bg-surface/60 px-6 py-5 text-left">
              {/* Clockwise border draw */}
              <DrawBorder active={hashCard} />

              <p className="mb-3 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                SHA-256 · BCL11A +58 enhancer · canonical sequence
              </p>

              <div className="min-h-[2rem] flex items-center">
                <span className="font-mono text-base sm:text-lg leading-relaxed tracking-wide break-all">
                  {typedChars.split("").map((char, i) => (
                    <span
                      key={i}
                      className="text-teal"
                      style={{
                        opacity: flickerSet.has(i) ? 1 : 0.9,
                        filter: flickerSet.has(i)
                          ? "brightness(1.6) drop-shadow(0 0 4px #5eead4)"
                          : "none",
                        transition: "filter 0.15s ease-out, opacity 0.15s ease-out",
                      }}
                    >
                      {char}
                    </span>
                  ))}
                  <span
                    className={cursorBlinks ? "text-teal animate-pulse" : "text-teal"}
                    style={{ opacity: hashCard ? 0.8 : 0 }}
                  >
                    _
                  </span>
                </span>
              </div>
            </div>
          </motion.div>

          {/* CTAs */}
          <motion.div
            animate={{ opacity: cta ? 1 : 0, y: cta ? 0 : 8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <motion.div
              animate={isLoop ? { scale: [1, 1.02, 1] } : {}}
              transition={{
                duration: 0.8,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 2.2,
              }}
            >
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center rounded-md bg-teal px-8 text-base font-medium text-[#0a0a0a] hover:bg-teal-dim transition-colors duration-150 shadow-lg shadow-teal/10"
              >
                Try the demo
              </Link>
            </motion.div>

            <a
              href="#pipeline"
              className="inline-flex h-12 items-center rounded-md border border-[#333] px-8 text-base font-medium text-muted-foreground hover:text-foreground hover:border-[#444] transition-colors duration-150"
            >
              See how it works ↓
            </a>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
