"use client";

import { motion } from "framer-motion";
import { fadeUp } from "@/lib/design-tokens";

const LAYERS = [
  {
    num: "L1",
    title: "Preflight",
    tagline: "Ingest. Validate. Hash.",
    body: "FASTA, FASTQ, and PDB files are validated, content-addressed with SHA-256, and stored immutably. The sequence never changes after this step.",
    preview: (
      <div className="font-mono text-xs text-teal/60 space-y-0.5">
        <div><span className="text-muted-foreground">sha256</span> a1b2c3d4…</div>
        <div><span className="text-muted-foreground">kind</span>   fasta</div>
        <div><span className="text-muted-foreground">bp</span>     400</div>
      </div>
    ),
  },
  {
    num: "L2",
    title: "Research Object",
    tagline: "The canonical bundle.",
    body: "Backbone + target + FASTQ + PAM + metadata → one content hash. This hash is the experiment's identity. Immutable. Replayable. Verifiable by anyone with the inputs.",
    preview: (
      <div className="font-mono text-xs space-y-0.5">
        <div className="text-teal text-sm">9f3ca4e2b87d1f60…</div>
        <div className="text-muted-foreground text-[10px] mt-1">content_hash · SHA-256</div>
      </div>
    ),
  },
  {
    num: "L3",
    title: "Run Manifest",
    tagline: "Environment as evidence.",
    body: "Every run records its git SHA, API version, scorer versions, and env fingerprint (sha256 of the lockfile). You can reconstruct the exact environment that produced any result.",
    preview: (
      <div className="font-mono text-xs text-muted-foreground space-y-0.5">
        <div><span className="text-teal/70">git_sha</span>       abc1234</div>
        <div><span className="text-teal/70">api_version</span>   v1</div>
        <div><span className="text-teal/70">env_fp</span>        c3d4e5…</div>
      </div>
    ),
  },
  {
    num: "L4",
    title: "Provenance",
    tagline: "Every step. On record.",
    body: "Preflight → feature extraction → simulation ticks → scoring → summary. Each event is timestamped and sequenced. The audit trail is the product.",
    preview: (
      <div className="font-mono text-[10px] text-muted-foreground space-y-0.5">
        {["preflight.ok", "extract.features", "simulate.tick ×3", "score.emit ×5", "summary.done"].map((e) => (
          <div key={e} className="flex items-center gap-2">
            <span className="size-1 rounded-full bg-teal/50 shrink-0" />
            <span>{e}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    num: "L5",
    title: "Export Pack",
    tagline: "A signed, portable proof.",
    body: "manifest.json + research_object.json + prediction.json + events.jsonl — all in one zip with a SHA-256 fingerprint. Send it to a collaborator. Publish it with your paper.",
    preview: (
      <div className="font-mono text-[10px] text-muted-foreground space-y-0.5">
        {["manifest.json", "research_object.json", "prediction.json", "events.jsonl"].map((f) => (
          <div key={f} className="flex items-center gap-2">
            <span className="text-teal/50">↗</span>
            <span>{f}</span>
          </div>
        ))}
      </div>
    ),
  },
];

export function Pipeline() {
  return (
    <section id="pipeline" className="py-16 sm:py-32 px-6 bg-surface/30">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="mb-10 sm:mb-20 text-center"
        >
          <p className="text-sm font-mono text-teal uppercase tracking-widest mb-4">Architecture</p>
          <h2 className="text-heading text-foreground">Five layers. Zero ambiguity.</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Every experiment moves through the same deterministic pipeline.
            Every step is logged. Every hash is permanent.
          </p>
        </motion.div>

        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-[calc(2.5rem+1px)] top-10 bottom-10 w-px bg-gradient-to-b from-teal/30 via-teal/10 to-transparent hidden md:block" />

          <div className="space-y-4">
            {LAYERS.map((layer, i) => (
              <motion.div
                key={layer.num}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0, 0, 0.2, 1] }}
                className="group flex gap-4 sm:gap-6 rounded-xl border border-[#222] bg-surface p-4 sm:p-6 hover:border-teal/20 transition-all duration-300 hover:shadow-lg hover:shadow-teal/5"
              >
                {/* Layer badge */}
                <div className="shrink-0 flex flex-col items-center gap-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-teal/30 bg-teal/5 font-mono text-xs font-semibold text-teal">
                    {layer.num}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-2">
                    <h3 className="text-base font-semibold text-foreground">{layer.title}</h3>
                    <span className="text-sm text-teal font-mono">{layer.tagline}</span>
                  </div>
                  <p className="text-[15px] text-muted-foreground leading-relaxed mb-4">{layer.body}</p>
                  <div className="rounded-lg border border-[#222] bg-[#0a0a0a] px-4 py-3 inline-block">
                    {layer.preview}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
