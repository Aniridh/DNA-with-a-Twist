"use client";

import { motion } from "framer-motion";
import { fadeUp } from "@/lib/design-tokens";

const FEATURES = [
  "Canonical content hashing",
  "Determinism verification",
  "Verifiable replay",
  "Immutable audit log",
  "Off-target scoring",
  "Environment fingerprint",
  "Portable export pack",
  "Open-source pipeline",
];

type Mark = "yes" | "partial" | "no";

const COMPETITORS: { name: string; marks: Mark[] }[] = [
  {
    name: "Benchling",
    marks: ["no", "no", "no", "partial", "no", "no", "partial", "no"],
  },
  {
    name: "CRISPR-GPT",
    marks: ["no", "no", "no", "no", "partial", "no", "no", "no"],
  },
  {
    name: "Lab Notebooks",
    marks: ["no", "no", "no", "partial", "no", "no", "no", "no"],
  },
  {
    name: "CasAI",
    marks: ["yes", "yes", "yes", "yes", "yes", "yes", "yes", "yes"],
  },
];

function MarkCell({ mark, isUs }: { mark: Mark; isUs: boolean }) {
  if (mark === "yes") {
    return (
      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${isUs ? "bg-teal/20" : "bg-green-500/10"}`}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`size-3 ${isUs ? "text-teal" : "text-green-500"}`}>
          <path d="M2.5 8.5 6 12 13.5 4" />
        </svg>
      </span>
    );
  }
  if (mark === "partial") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10">
        <span className="text-amber-400 text-xs font-bold">~</span>
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1a1a1a]">
      <span className="text-[#444] text-sm">–</span>
    </span>
  );
}

export function WhyWeWin() {
  return (
    <section id="compare" className="py-16 sm:py-32 px-6 bg-surface/30">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="mb-10 sm:mb-16 text-center"
        >
          <p className="text-sm font-mono text-teal uppercase tracking-widest mb-4">Why us</p>
          <h2 className="text-heading text-foreground">The only tool built<br />for reproducibility-first</h2>
        </motion.div>

        {/* Mobile: stacked feature cards */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="sm:hidden space-y-3"
        >
          {FEATURES.map((feature, i) => (
            <div key={feature} className="rounded-xl border border-[#222] bg-surface p-4">
              <p className="text-sm font-medium text-foreground mb-3">{feature}</p>
              <div className="grid grid-cols-2 gap-2">
                {COMPETITORS.map((c) => {
                  const isUs = c.name === "CasAI";
                  return (
                    <div
                      key={c.name}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${isUs ? "bg-teal/5 border border-teal/20" : "bg-[#0a0a0a]"}`}
                    >
                      <MarkCell mark={c.marks[i]} isUs={isUs} />
                      <span className={`text-[11px] font-medium truncate ${isUs ? "text-teal" : "text-muted-foreground"}`}>
                        {isUs ? "Us" : c.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Desktop: comparison table */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="hidden sm:block overflow-x-auto rounded-xl border border-[#222]"
        >
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-[#222]">
                <th className="w-48 px-6 py-4 text-left text-sm text-muted-foreground font-medium">Feature</th>
                {COMPETITORS.map((c) => {
                  const isUs = c.name === "CasAI";
                  return (
                    <th
                      key={c.name}
                      className={`px-4 py-4 text-center text-sm font-semibold ${isUs ? "text-teal" : "text-muted-foreground"}`}
                    >
                      {isUs ? (
                        <span className="inline-flex flex-col items-center gap-1">
                          <span className="text-teal">{c.name}</span>
                          <span className="text-[10px] font-mono text-teal/50 uppercase tracking-wider">our pick</span>
                        </span>
                      ) : c.name}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {FEATURES.map((feature, i) => (
                <tr key={feature} className="hover:bg-[#111]/50 transition-colors">
                  <td className="px-6 py-3.5 text-sm text-muted-foreground">{feature}</td>
                  {COMPETITORS.map((c) => {
                    const isUs = c.name === "CasAI";
                    return (
                      <td
                        key={c.name}
                        className={`px-4 py-3.5 text-center ${isUs ? "bg-teal/[0.03] border-x border-teal/10" : ""}`}
                      >
                        <div className="flex justify-center">
                          <MarkCell mark={c.marks[i]} isUs={isUs} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
