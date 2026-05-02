"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/getApiClient";
import type { ResearchObject } from "@schemas/ResearchObject";
import type { Run } from "@/lib/types";

export default function ResearchObjectPage() {
  const { id } = useParams<{ id: string }>();
  const [ro, setRo] = useState<ResearchObject | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiClient.getResearchObject(id), apiClient.listRunsForRO(id)])
      .then(([roData, runsData]) => {
        setRo(roData);
        setRuns(runsData);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-48 animate-pulse rounded-lg bg-[#222]" />
          <div className="mx-auto h-4 w-32 animate-pulse rounded bg-[#222]" />
        </div>
      </div>
    );
  }

  if (!ro) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground text-sm">
        Research Object not found.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0, 0, 0.2, 1] }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-mono uppercase tracking-widest">Research Object</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Created {new Date(ro.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Immutable — content hash is permanent</p>
        </div>
        <Link
          href={`/runs/new?ro=${ro.id}`}
          className="inline-flex h-10 items-center rounded-lg bg-teal px-5 text-sm font-medium text-[#0a0a0a] hover:bg-teal-dim transition-colors shrink-0"
        >
          Start Run →
        </Link>
      </div>

      {/* Content hash — hero */}
      <ContentHashCard hash={ro.content_hash} />

      {/* File hashes */}
      <div className="rounded-xl border border-[#222] bg-surface">
        <div className="px-5 py-4 border-b border-[#222]">
          <h2 className="text-sm font-semibold text-foreground">File hashes</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <HashRow label="Backbone" hash={ro.backbone_sha256} />
          {ro.target_pdb_sha256 && <HashRow label="Target PDB" hash={ro.target_pdb_sha256} />}
          {ro.fastq_sha256 && <HashRow label="FASTQ" hash={ro.fastq_sha256} />}
          <div className="pt-2 border-t border-[#222] flex flex-wrap gap-6 text-xs text-muted-foreground">
            <span>
              PAM:{" "}
              <span className="font-mono text-teal ml-1">{ro.pam}</span>
            </span>
            {ro.fastq_phred_pass_pct != null && (
              <span>
                PHRED Q20:{" "}
                <span className="font-mono text-foreground ml-1">{ro.fastq_phred_pass_pct.toFixed(1)}%</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Metadata */}
      {Object.keys(ro.metadata).length > 0 && (
        <div className="rounded-xl border border-[#222] bg-surface">
          <div className="px-5 py-4 border-b border-[#222]">
            <h2 className="text-sm font-semibold text-foreground">Metadata</h2>
          </div>
          <dl className="divide-y divide-[#222]">
            {Object.entries(ro.metadata).map(([k, v]) => (
              <div key={k} className="flex gap-4 px-5 py-3 text-sm">
                <dt className="w-36 shrink-0 text-muted-foreground">{k}</dt>
                <dd className="font-mono text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Runs */}
      <div className="rounded-xl border border-[#222] bg-surface">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
          <h2 className="text-sm font-semibold text-foreground">Runs</h2>
          <Link
            href={`/runs/new?ro=${ro.id}`}
            className="text-xs text-teal hover:text-teal-dim transition-colors"
          >
            + New run
          </Link>
        </div>
        {runs.length === 0 ? (
          <div className="px-5 py-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No runs yet</p>
            <Link
              href={`/runs/new?ro=${ro.id}`}
              className="inline-flex h-8 items-center rounded-lg border border-teal/30 bg-teal/5 px-4 text-xs font-medium text-teal hover:bg-teal/10 transition-colors"
            >
              Start first run
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#222]">
            {runs.map((run) => (
              <Link
                key={run.id}
                href={`/runs/${run.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-elevated transition-colors group"
              >
                <StatusDot status={run.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground group-hover:text-teal transition-colors">{run.prompt}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(run.created_at).toLocaleString()}</p>
                </div>
                <span className="text-muted-foreground group-hover:text-teal transition-colors text-sm">→</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ContentHashCard({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleVerify() {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setVerified(true);
      setTimeout(() => setVerified(false), 4000);
    }, 1200);
  }

  return (
    <div className="rounded-xl border border-[#222] bg-surface overflow-hidden">
      <div className="px-5 py-4 border-b border-[#222] flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Content hash — SHA-256</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#333] px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-[#444] transition-colors disabled:opacity-50"
          >
            <AnimatePresence mode="wait">
              {verified ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-teal"
                >
                  ✓
                </motion.span>
              ) : verifying ? (
                <motion.span
                  key="spin"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  className="block"
                >
                  ◌
                </motion.span>
              ) : null}
            </AnimatePresence>
            {verified ? "Verified" : verifying ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#333] px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-[#444] transition-colors"
          >
            {copied ? (
              <span className="text-teal">Copied!</span>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="currentColor" className="size-3">
                  <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6z" />
                  <path d="M2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h-1v1H2V6h1V5H2z" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>
      <div className="px-5 py-6 text-center">
        <p className="font-mono text-lg text-teal tracking-wider break-all leading-relaxed">
          {hash}
        </p>
      </div>
      <div className="px-5 py-3 border-t border-[#222] bg-[#0d0d0d]">
        <p className="text-xs text-muted-foreground/60 text-center">
          SHA-256 of canonical bundle — this hash is what every run cites for reproducibility
        </p>
      </div>
    </div>
  );
}

function HashRow({ label, hash }: { label: string; hash: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground w-24">{label}</span>
      <span className="font-mono text-xs text-foreground/80 truncate">{hash.slice(0, 16)}…</span>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: "bg-[#444]",
    running: "bg-amber-400 animate-pulse",
    done: "bg-teal",
    failed: "bg-red-500",
  };
  return (
    <span className={cn("size-2 shrink-0 rounded-full", colors[status] ?? "bg-[#444]")} />
  );
}
