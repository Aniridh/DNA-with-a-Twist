"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Hash } from "@/components/primitives/Hash";
import { apiClient } from "@/lib/getApiClient";
import { buttonVariants } from "@/components/ui/button";
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
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!ro) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        Research Object not found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Research Object</h1>
          <p className="mt-1 text-sm text-muted-foreground">Immutable — created {new Date(ro.created_at).toLocaleDateString()}</p>
        </div>
        <Link href={`/runs/new?ro=${ro.id}`} className={cn(buttonVariants())}>
          Start a Run →
        </Link>
      </div>

      {/* Content hash — the star of the show */}
      <div className="rounded-xl border bg-card p-6 text-center space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Content hash</p>
        <Hash hash={ro.content_hash} chars={16} className="text-base justify-center" />
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          SHA-256 of the canonical bundle. This hash is what runs cite for reproducibility.
        </p>
      </div>

      {/* File hashes */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">File hashes</h2>
        <dl className="space-y-2">
          <HashField label="Backbone" hash={ro.backbone_sha256} />
          {ro.target_pdb_sha256 && <HashField label="Target PDB" hash={ro.target_pdb_sha256} />}
          {ro.fastq_sha256 && <HashField label="FASTQ" hash={ro.fastq_sha256} />}
        </dl>
        <div className="pt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>PAM: <span className="font-mono text-foreground">{ro.pam}</span></span>
          {ro.fastq_phred_pass_pct != null && (
            <span>PHRED Q20 pass: <span className="font-mono text-foreground">{ro.fastq_phred_pass_pct.toFixed(1)}%</span></span>
          )}
        </div>
      </div>

      {/* Metadata */}
      {Object.keys(ro.metadata).length > 0 && (
        <div className="rounded-xl border bg-card p-6 space-y-3">
          <h2 className="text-sm font-semibold">Metadata</h2>
          <dl className="divide-y">
            {Object.entries(ro.metadata).map(([k, v]) => (
              <div key={k} className="flex gap-4 py-2 text-sm">
                <dt className="w-32 shrink-0 text-muted-foreground">{k}</dt>
                <dd className="font-mono">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Runs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Runs</h2>
          <Link href={`/runs/new?ro=${ro.id}`} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors">
            + New run
          </Link>
        </div>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No runs yet.</p>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <Link
                key={run.id}
                href={`/runs/${run.id}`}
                className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <StatusDot status={run.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{run.prompt}</p>
                  <p className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">→</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HashField({ label, hash }: { label: string; hash: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd><Hash hash={hash} chars={8} /></dd>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: "bg-slate-400",
    running: "bg-amber-400 animate-pulse",
    done: "bg-emerald-500",
    failed: "bg-red-500",
  };
  return (
    <span className={cn("size-2 shrink-0 rounded-full", colors[status] ?? "bg-slate-400")} aria-hidden="true" />
  );
}
