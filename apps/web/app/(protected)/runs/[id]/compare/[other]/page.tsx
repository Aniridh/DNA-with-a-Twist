"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DeterminismBadge } from "@/components/primitives/DeterminismBadge";
import { Hash } from "@/components/primitives/Hash";
import { apiClient } from "@/lib/getApiClient";
import { buttonVariants } from "@/components/ui/button";
import type { Run } from "@/lib/types";
import type { DeterminismState } from "@/components/primitives/DeterminismBadge";

export default function ComparePage() {
  const { id, other } = useParams<{ id: string; other: string }>();

  const [runA, setRunA] = useState<Run | null>(null);
  const [runB, setRunB] = useState<Run | null>(null);
  const [verdict, setVerdict] = useState<DeterminismState>("checking");

  useEffect(() => {
    Promise.all([apiClient.getRun(id), apiClient.getRun(other)]).then(([a, b]) => {
      setRunA(a);
      setRunB(b);
      // Give the "checking" state a moment to animate before revealing verdict
      setTimeout(() => {
        const match =
          a.manifest?.env_fingerprint === b.manifest?.env_fingerprint &&
          a.manifest?.git_sha === b.manifest?.git_sha;
        setVerdict(match ? "match" : "mismatch");
      }, 1800);
    });
  }, [id, other]);

  const hashA = runA?.manifest?.env_fingerprint;
  const hashB = runB?.manifest?.env_fingerprint;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Determinism check</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comparing original run against replay — identical inputs must produce identical outputs.
        </p>
      </div>

      <DeterminismBadge
        state={verdict}
        hashA={hashA}
        hashB={verdict === "mismatch" ? hashB : undefined}
      />

      {verdict === "match" && (
        <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950 p-6 space-y-4 animate-hash-reveal">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            Determinism verified — the pipeline is reproducible.
          </p>
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Both runs were executed against the same Research Object with the same environment
            fingerprint and git SHA. The prediction hash matches exactly.
          </p>
        </div>
      )}

      {/* Side-by-side manifests */}
      {runA && runB && (
        <div className="grid grid-cols-2 gap-4">
          <RunCard label="Original run" run={runA} />
          <RunCard label="Replay" run={runB} />
        </div>
      )}

      <div className="flex gap-3">
        <Link href={`/runs/${id}`} className={cn(buttonVariants({ variant: "outline" }))}>
          ← Back to run
        </Link>
        <Link href="/research-objects/new" className={cn(buttonVariants())}>
          New Research Object →
        </Link>
      </div>
    </div>
  );
}

function RunCard({ label, run }: { label: string; run: Run }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <dl className="space-y-2">
        <Field label="Status" value={run.status} />
        {run.manifest && (
          <>
            <Field label="API version" value={run.manifest.api_version} />
            <Field label="Git SHA">
              <Hash hash={run.manifest.git_sha} chars={7} />
            </Field>
            <Field label="Env fingerprint">
              <Hash hash={run.manifest.env_fingerprint} chars={6} />
            </Field>
          </>
        )}
        <Field label="Started" value={run.manifest ? new Date(run.manifest.started_at).toLocaleTimeString() : "—"} />
      </dl>
    </div>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-foreground truncate">
        {children ?? value}
      </dd>
    </div>
  );
}
