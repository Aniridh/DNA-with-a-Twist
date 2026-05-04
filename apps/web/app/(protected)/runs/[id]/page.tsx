"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/getApiClient";
import { useRunEvents } from "@/lib/hooks/useRunEvents";
import type { Run, Result, GuideCandidate } from "@/lib/types";

export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [run, setRun] = useState<Run | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [exporting, setExporting] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [exportSha, setExportSha] = useState<string | null>(null);

  const { events, status: streamStatus } = useRunEvents(id);

  const fetchRun = useCallback(() => {
    apiClient.getRun(id).then(setRun);
  }, [id]);

  useEffect(() => { fetchRun(); }, [fetchRun]);

  useEffect(() => {
    if (streamStatus === "done") {
      fetchRun();
      apiClient.getResult(id).then(setResult);
    }
  }, [streamStatus, id, fetchRun]);

  async function handleExport() {
    setExporting(true);
    try {
      const { url, sha256 } = await apiClient.getExport(id);
      setExportSha(sha256);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dnatwist_run_${id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleReplay() {
    setReplaying(true);
    try {
      const { new_run_id } = await apiClient.replayRun(id);
      router.push(`/runs/${id}/compare/${new_run_id}`);
    } finally {
      setReplaying(false);
    }
  }

  const isDone = streamStatus === "done";
  const roId = run?.ro_id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0, 0, 0.2, 1] }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Run</p>
          {run ? (
            <h1 className="text-lg font-semibold text-foreground truncate max-w-xl">{run.prompt}</h1>
          ) : (
            <div className="h-6 w-64 animate-pulse rounded bg-[#222]" />
          )}
        </div>
        {roId && (
          <Link
            href={`/research-objects/${roId}`}
            className="text-xs text-muted-foreground hover:text-teal transition-colors shrink-0"
          >
            ← Research Object
          </Link>
        )}
      </div>

      {/* Manifest strip */}
      {run?.manifest && (
        <div className="rounded-lg border border-[#222] bg-surface px-5 py-3 flex flex-wrap gap-x-8 gap-y-2 text-xs">
          <ManifestField label="API" value={run.manifest.api_version} />
          <ManifestField label="Git" value={run.manifest.git_sha.slice(0, 7)} mono />
          <ManifestField label="Env" value={run.manifest.env_fingerprint.slice(0, 8) + "…"} mono teal />
          <ManifestField label="Started" value={new Date(run.manifest.started_at).toLocaleTimeString()} />
          <StatusPill status={run.status} />
        </div>
      )}

      {/* Terminal event log */}
      <div className="rounded-xl border border-[#222] bg-[#0a0a0a] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1a1a1a] bg-[#0d0d0d]">
          <span className="size-2.5 rounded-full bg-red-500/60" />
          <span className="size-2.5 rounded-full bg-amber-400/60" />
          <span className="size-2.5 rounded-full bg-teal/60" />
          <span className="ml-2 text-xs text-muted-foreground/50 font-mono">pipeline.log</span>
          {streamStatus === "streaming" && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-amber-400">
              <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
              live
            </span>
          )}
          {streamStatus === "done" && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-teal">
              <span className="size-1.5 rounded-full bg-teal" />
              complete
            </span>
          )}
        </div>
        <div className="p-4 font-mono text-xs space-y-1 max-h-72 overflow-y-auto">
          {events.length === 0 && streamStatus !== "done" ? (
            <div className="flex items-center gap-2 text-muted-foreground/40">
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              >
                ▋
              </motion.span>
              <span>Waiting for pipeline…</span>
            </div>
          ) : (
            events.map((event, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex gap-3 text-muted-foreground/70"
              >
                <span className="hidden sm:inline shrink-0 text-muted-foreground/30">
                  {String(i + 1).padStart(3, "0")}
                </span>
                <span className="shrink-0 text-muted-foreground/50 sm:min-w-[10rem]">
                  [{event.event_type}]
                </span>
                <span className={cn(
                  "flex-1",
                  event.event_type === "run.score.emit" && "text-teal/80",
                  event.event_type === "run.summary.done" && "text-teal"
                )}>
                  {event.event_type === "run.score.emit"
                    ? formatScoreEvent(event.payload)
                    : formatPayload(event.payload)}
                </span>
              </motion.div>
            ))
          )}
          {streamStatus === "streaming" && events.length > 0 && (
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="text-teal/50"
            >
              ▋
            </motion.div>
          )}
        </div>
      </div>

      {/* Results */}
      <AnimatePresence>
        {isDone && result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-xl border border-[#222] bg-surface overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
              <h2 className="text-sm font-semibold text-foreground">Guide candidates</h2>
              <span className="text-xs text-muted-foreground">{result.prediction.guides.length} found</span>
            </div>
            {/* Mobile: stacked cards */}
            <div className="sm:hidden divide-y divide-[#1a1a1a]">
              {result.prediction.guides.map((guide, i) => (
                <GuideCard key={i} guide={guide} />
              ))}
            </div>
            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#222] text-muted-foreground">
                    <th className="text-left px-5 py-2.5 font-medium">Sequence + PAM</th>
                    <th className="text-left px-4 py-2.5 font-medium">Score</th>
                    <th className="text-left px-4 py-2.5 font-medium">Off-targets</th>
                    <th className="text-left px-4 py-2.5 font-medium">Strand / Pos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {result.prediction.guides.map((guide, i) => (
                    <GuideRow key={i} guide={guide} />
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <AnimatePresence>
        {isDone && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex flex-wrap items-center gap-3 pt-1"
          >
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#333] px-4 text-sm text-muted-foreground hover:text-foreground hover:border-[#444] transition-colors disabled:opacity-50"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
                <path d="M7.47 10.78a.75.75 0 0 0 1.06 0l3.75-3.75a.75.75 0 0 0-1.06-1.06L8.75 8.44V1.75a.75.75 0 0 0-1.5 0v6.69L4.78 5.97a.75.75 0 0 0-1.06 1.06l3.75 3.75ZM3.75 13a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z" />
              </svg>
              {exporting ? "Generating…" : "Export pack"}
            </button>

            <button
              type="button"
              onClick={handleReplay}
              disabled={replaying}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal px-4 text-sm font-medium text-[#0a0a0a] hover:bg-teal-dim transition-colors disabled:opacity-50"
            >
              {replaying ? (
                <>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                    className="block size-3.5 rounded-full border-2 border-[#0a0a0a]/30 border-t-[#0a0a0a]"
                  />
                  Starting replay…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
                    <path d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z" />
                    <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z" />
                  </svg>
                  Replay → verify determinism
                </>
              )}
            </button>

            {exportSha && (
              <p className="text-xs text-muted-foreground font-mono">
                Export SHA: <span className="text-teal">{exportSha.slice(0, 12)}…</span>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function formatScoreEvent(payload: Record<string, unknown>): string {
  const seq = payload.guide_seq as string ?? "";
  const score = payload.on_target as number ?? 0;
  const ot = payload.off_target_count as number ?? 0;
  return `${seq.slice(0, 20)} on_target=${score.toFixed(2)} off_targets=${ot}`;
}

function formatPayload(payload: Record<string, unknown>): string {
  return Object.entries(payload)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join("  ");
}

function GuideCard({ guide }: { guide: GuideCandidate }) {
  const offTargetColor = guide.off_target_count < 3
    ? "text-teal bg-teal/10 border-teal/20"
    : guide.off_target_count <= 7
    ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
    : "text-red-400 bg-red-400/10 border-red-400/20";

  const scoreWidth = `${Math.round(guide.on_target_score * 100)}%`;

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-1.5 font-mono text-xs">
        <span className="text-foreground/80 break-all">{guide.sequence}</span>
        <span className="text-teal shrink-0">{guide.pam}</span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1">
          <div className="h-1.5 w-20 rounded-full bg-[#222] overflow-hidden">
            <div className="h-full rounded-full bg-teal" style={{ width: scoreWidth }} />
          </div>
          <span className="font-mono text-foreground/70">{guide.on_target_score.toFixed(2)}</span>
        </div>
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0", offTargetColor)}>
          {guide.off_target_count} off-target
        </span>
        <span className="font-mono text-muted-foreground text-[10px] shrink-0">
          {guide.strand === "+" ? "+" : "−"}{guide.position}
        </span>
      </div>
    </div>
  );
}

function GuideRow({ guide }: { guide: GuideCandidate }) {
  const offTargetColor = guide.off_target_count < 3
    ? "text-teal bg-teal/10 border-teal/20"
    : guide.off_target_count <= 7
    ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
    : "text-red-400 bg-red-400/10 border-red-400/20";

  const scoreWidth = `${Math.round(guide.on_target_score * 100)}%`;

  return (
    <tr className="hover:bg-surface-elevated transition-colors">
      <td className="px-5 py-3">
        <span className="text-foreground/80">{guide.sequence}</span>
        <span className="text-teal ml-1">{guide.pam}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-[#222] overflow-hidden">
            <div
              className="h-full rounded-full bg-teal transition-all"
              style={{ width: scoreWidth }}
            />
          </div>
          <span className="text-foreground/70">{guide.on_target_score.toFixed(2)}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", offTargetColor)}>
          {guide.off_target_count}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {guide.strand === "+" ? "+" : "−"} pos {guide.position}
      </td>
    </tr>
  );
}

function ManifestField({
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
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn(
        mono ? "font-mono" : "",
        teal ? "text-teal" : "text-foreground"
      )}>
        {value}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: "text-[#888] border-[#333]",
    running: "text-amber-400 border-amber-400/30 bg-amber-400/5",
    done: "text-teal border-teal/30 bg-teal/5",
    failed: "text-red-400 border-red-400/30 bg-red-400/5",
  };
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest ml-auto",
      styles[status] ?? styles.queued
    )}>
      {status === "running" && (
        <span className="size-1.5 rounded-full bg-amber-400 animate-pulse mr-1.5" />
      )}
      {status}
    </span>
  );
}
