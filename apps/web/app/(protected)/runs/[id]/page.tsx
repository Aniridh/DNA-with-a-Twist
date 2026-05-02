"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Hash } from "@/components/primitives/Hash";
import { ManifestCard } from "@/components/primitives/ManifestCard";
import { EventLog } from "@/components/primitives/EventLog";
import { PredictionTable } from "@/components/primitives/PredictionTable";
import { apiClient } from "@/lib/getApiClient";
import { useRunEvents } from "@/lib/hooks/useRunEvents";
import { buttonVariants } from "@/components/ui/button";
import type { Run, Result } from "@/lib/types";

export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [run, setRun] = useState<Run | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [exporting, setExporting] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [exportSha, setExportSha] = useState<string | null>(null);

  const { events, status: streamStatus } = useRunEvents(id);

  // Fetch initial run + re-fetch when stream completes
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
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Run</h1>
          {run && (
            <p className="mt-1 text-sm text-muted-foreground truncate max-w-lg">
              {run.prompt}
            </p>
          )}
        </div>
        {roId && (
          <Link href={`/research-objects/${roId}`} className="text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground transition-colors shrink-0">
            ← Research Object
          </Link>
        )}
      </div>

      {/* Panel 1: Status + Manifest */}
      {run && (
        <ManifestCard run={run} />
      )}

      {/* Panel 2: Event log */}
      <EventLog
        events={events}
        status={streamStatus}
        maxHeightClass="max-h-72"
      />

      {/* Panel 3: Results (when done) */}
      {isDone && result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Guide candidates</h2>
            <span className="text-xs text-muted-foreground">{result.prediction.guides.length} found</span>
          </div>
          <PredictionTable guides={result.prediction.guides} />
        </div>
      )}

      {/* Actions */}
      {isDone && (
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className={cn(buttonVariants({ variant: "outline" }), exporting && "opacity-50")}
          >
            {exporting ? "Generating…" : "Export pack"}
          </button>
          <button
            type="button"
            onClick={handleReplay}
            disabled={replaying}
            className={cn(buttonVariants(), replaying && "opacity-50")}
          >
            {replaying ? "Starting replay…" : "Replay → verify determinism"}
          </button>

          {exportSha && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Export SHA-256:</span>
              <Hash hash={exportSha} chars={8} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
