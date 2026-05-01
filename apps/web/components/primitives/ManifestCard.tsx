"use client";

import { cn } from "@/lib/utils";
import type { Run, RunManifest, RunStatus } from "@/lib/types";
import { Hash } from "@/components/primitives/Hash";

interface ManifestCardProps {
  run: Run;
  roHash?: string;
  className?: string;
}

const STATUS_DOT: Record<RunStatus, { color: string; label: string }> = {
  queued: { color: "bg-slate-400", label: "Queued" },
  running: { color: "bg-amber-400 animate-pulse", label: "Running" },
  done: { color: "bg-emerald-500", label: "Done" },
  failed: { color: "bg-red-500", label: "Failed" },
};

export function ManifestCard({ run, roHash, className }: ManifestCardProps) {
  const { manifest } = run;

  return (
    <div className={cn("rounded-lg border bg-card p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Run Manifest</h3>
        <StatusDot status={run.status} />
      </div>

      {manifest == null ? (
        <p className="text-sm text-muted-foreground">Manifest not yet available</p>
      ) : (
        <dl className="space-y-1.5">
          <Field label="API version" value={manifest.api_version} />
          <Field label="Git SHA">
            <Hash hash={manifest.git_sha} chars={7} />
          </Field>
          <Field label="Env fingerprint">
            <Hash hash={manifest.env_fingerprint} chars={6} />
          </Field>
          {roHash && (
            <Field label="RO hash">
              <Hash hash={roHash} chars={6} showVerify />
            </Field>
          )}
          <Field label="Started" value={new Date(manifest.started_at).toLocaleString()} />
          {run.finished_at && (
            <Field label="Finished" value={new Date(run.finished_at).toLocaleString()} />
          )}
          {Object.entries(manifest.scoring_versions).map(([k, v]) => (
            <Field key={k} label={`scorer: ${k}`} value={v} />
          ))}
        </dl>
      )}
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
    <div className="flex items-center justify-between gap-4 text-xs">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-foreground truncate">
        {children ?? value}
      </dd>
    </div>
  );
}

function StatusDot({ status }: { status: RunStatus }) {
  const { color, label } = STATUS_DOT[status];
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("size-2 rounded-full", color)} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
