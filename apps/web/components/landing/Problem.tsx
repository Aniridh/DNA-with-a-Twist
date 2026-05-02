"use client";

import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/design-tokens";

const PROBLEMS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
    title: "Files without provenance",
    body: "FASTA sequences emailed in Slack threads. FASTQ files named 'final_v3_ACTUAL.fastq'. PDB structures from unknown sources. No record of what went in, so no way to know what came out.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6">
        <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" />
        <path d="M12 8v4l3 3" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    ),
    title: "AI you can't audit",
    body: "CRISPR-GPT suggests edits. It doesn't prove them. No hash. No replay. No verification. When the result is wrong, you can't tell if it was the model, the environment, or the data.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: "Results that don't reproduce",
    body: "Over 70% of computational biology studies fail to reproduce. When there's no canonical hash, no environment fingerprint, no event log — there's no way to know why.",
  },
];

export function Problem() {
  return (
    <section className="py-32 px-6 bg-[#0a0a0a]">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="mb-20 text-center"
        >
          <p className="text-sm font-mono text-teal uppercase tracking-widest mb-4">The problem</p>
          <h2 className="text-heading text-foreground">Science runs on trust.<br />Trust runs on verification.</h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {PROBLEMS.map((p) => (
            <motion.div
              key={p.title}
              variants={fadeUp}
              className="group rounded-xl border border-[#222] bg-surface p-8 hover:border-[#2a2a2a] transition-colors duration-200"
            >
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                {p.icon}
              </div>
              <h3 className="mb-3 text-lg font-semibold text-foreground">{p.title}</h3>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{p.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
