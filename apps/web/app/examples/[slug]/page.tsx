"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronDown, ChevronUp, Download, RotateCcw, ShieldCheck } from "lucide-react";
import { PredictionTable } from "@/components/primitives/PredictionTable";
import { EventLog } from "@/components/primitives/EventLog";
import { ManifestCard } from "@/components/primitives/ManifestCard";
import { DeterminismBadge } from "@/components/primitives/DeterminismBadge";
import { Hash } from "@/components/primitives/Hash";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getExampleBySlug } from "@/lib/example-fixtures";
import type { ExampleFixture } from "@/lib/example-fixtures";
import type { Run, ProvenanceEvent } from "@/lib/types";
import type { StreamStatus } from "@/lib/hooks/useRunEvents";
import type { DeterminismState } from "@/components/primitives/DeterminismBadge";

// Cast fixture run shape to the Run type ManifestCard expects
function toRun(fixture: ExampleFixture): Run {
  return fixture.run as Run;
}

export default function ExampleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const fixture = getExampleBySlug(slug);

  if (!fixture) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-3">
        <p className="text-2xl font-bold">Example not found</p>
        <p className="text-muted-foreground text-sm">
          No example with slug <code className="font-mono">{slug}</code> exists.
        </p>
        <Link href="/examples" className="text-teal-600 dark:text-teal-400 text-sm underline underline-offset-4">
          Browse all examples →
        </Link>
      </div>
    );
  }

  return <ExampleDetail fixture={fixture} />;
}

// ---------------------------------------------------------------------------
// Main detail component — separated so hooks run after guard above
// ---------------------------------------------------------------------------

function ExampleDetail({ fixture }: { fixture: ExampleFixture }) {
  // Event log animation state
  const [visibleEvents, setVisibleEvents] = useState<ProvenanceEvent[]>([]);
  const [eventStatus, setEventStatus] = useState<StreamStatus>("streaming");
  // Incrementing this key replays the animation
  const [animKey, setAnimKey] = useState(0);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportDownloaded, setExportDownloaded] = useState(false);

  // Determinism verification state
  const [deterState, setDeterState] = useState<DeterminismState | null>(null);
  const [deterExpanded, setDeterExpanded] = useState(false);

  // Research object verify inline state
  const [roVerified, setRoVerified] = useState(false);

  // Play event animation — reveals events at ~400ms intervals
  function playEvents(events: ProvenanceEvent[]) {
    setVisibleEvents([]);
    setEventStatus("streaming");
    events.forEach((ev, i) => {
      setTimeout(() => {
        setVisibleEvents((prev) => [...prev, ev]);
        if (i === events.length - 1) setEventStatus("done");
      }, i * 400);
    });
  }

  // Kick off animation on mount and whenever animKey changes
  useEffect(() => {
    playEvents(fixture.events as ProvenanceEvent[]);
    // Reset derived state when replaying
    setExportDownloaded(false);
    setDeterState(null);
  }, [animKey, fixture.events]);

  async function handleExport() {
    setExporting(true);
    try {
      // Dynamic import keeps JSZip out of the initial bundle
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.file(
        "manifest.json",
        JSON.stringify(
          { run_id: fixture.run.id, ro_id: fixture.researchObject.id, ...fixture.run.manifest },
          null,
          2
        )
      );
      zip.file("research_object.json", JSON.stringify(fixture.researchObject, null, 2));
      if (fixture.prediction) {
        zip.file("prediction.json", JSON.stringify(fixture.prediction, null, 2));
      }
      zip.file("events.jsonl", fixture.events.map((e) => JSON.stringify(e)).join("\n"));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dnatwist_example_${fixture.slug}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDownloaded(true);
    } finally {
      setExporting(false);
    }
  }

  function handleVerifyDeterminism() {
    setDeterState("checking");
    // Simulate a 2-second verification delay before showing the result
    setTimeout(() => {
      setDeterState("match");
    }, 2000);
  }

  const run = toRun(fixture);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Header strip                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/examples"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Examples
          </Link>
          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            DEMO — not a real user run
          </span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">{fixture.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{fixture.subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {fixture.categories.map((c) => (
            <Badge key={c} variant="secondary" className="text-xs">
              {c}
            </Badge>
          ))}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              fixture.status === "done"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                fixture.status === "done" ? "bg-emerald-500" : "bg-red-500"
              )}
            />
            {fixture.status}
          </span>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground flex items-start justify-between gap-4 flex-wrap">
          <span>
            This is a pre-built demonstration run. Data is synthetic and fixed — no live computation occurs.
          </span>
          <Link
            href="/login"
            className="shrink-0 font-medium text-teal-600 dark:text-teal-400 hover:underline underline-offset-4"
          >
            Try it yourself →
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Background context                                                   */}
      {/* ------------------------------------------------------------------ */}
      <Section title="Background">
        <p className="text-sm text-muted-foreground leading-relaxed">{fixture.backgroundContext}</p>
        <blockquote className="mt-3 border-l-2 border-teal-500 pl-4 text-sm italic text-foreground/80">
          {fixture.clinicalRelevance}
        </blockquote>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Research Object card                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Section title="Research Object">
        <dl className="space-y-2 text-xs">
          <div className="space-y-1">
            <dt className="text-muted-foreground font-medium">Content hash (SHA-256)</dt>
            <dd className="font-mono text-teal-600 dark:text-teal-400 break-all text-xs leading-relaxed">
              {fixture.researchObject.content_hash}
            </dd>
          </div>
          <FieldRow label="RO ID">
            <span className="font-mono">{fixture.researchObject.id}</span>
          </FieldRow>
          <FieldRow label="Backbone SHA-256">
            <Hash hash={fixture.researchObject.backbone_sha256} chars={8} />
          </FieldRow>
          <FieldRow label="PAM">
            <Badge variant="outline" className="font-mono text-xs">{fixture.researchObject.pam}</Badge>
          </FieldRow>
          <FieldRow label="Created">
            {new Date(fixture.researchObject.created_at).toLocaleString()}
          </FieldRow>
          {Object.entries(fixture.researchObject.metadata).map(([k, v]) => (
            <FieldRow key={k} label={k}>
              {v}
            </FieldRow>
          ))}
          <FieldRow label="Bundle">
            <span className="font-mono text-muted-foreground">
              {fixture.researchObject.backbone_ref.bucket}/{fixture.researchObject.backbone_ref.path}
            </span>
          </FieldRow>
        </dl>

        {/* Inline verify button */}
        <div className="mt-4 flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRoVerified(true)}
            disabled={roVerified}
            className="text-xs"
          >
            <ShieldCheck className="size-3.5 mr-1.5" />
            {roVerified ? "Verified ✓" : "Verify content hash"}
          </Button>
          {roVerified && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Hash matches — provenance intact
            </span>
          )}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Run manifest                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Section title="Run Manifest">
        <ManifestCard run={run} roHash={fixture.researchObject.content_hash} />
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Event log with replay animation                                      */}
      {/* ------------------------------------------------------------------ */}
      <Section title="Provenance Event Log">
        <div className="space-y-3">
          <EventLog
            events={visibleEvents}
            status={eventStatus}
            maxHeightClass="max-h-72"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAnimKey((k) => k + 1)}
            className="text-xs"
          >
            <RotateCcw className="size-3.5 mr-1.5" />
            Replay events
          </Button>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Prediction / failure sections                                        */}
      {/* ------------------------------------------------------------------ */}
      {fixture.status === "failed" ? (
        <FailedSection fixture={fixture} />
      ) : (
        <>
          {/* Prediction table */}
          {fixture.prediction && (
            <Section title="Guide Candidates">
              <PredictionTable guides={fixture.prediction.guides} />
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
                {Object.entries(fixture.prediction.summary).map(([k, v]) => (
                  <div key={k} className="rounded-lg border bg-muted/30 px-3 py-2">
                    <p className="text-muted-foreground">{k.replace(/_/g, " ")}</p>
                    <p className="font-mono font-medium mt-0.5">
                      {typeof v === "number"
                        ? Number.isInteger(v)
                          ? v.toString()
                          : v.toFixed(3)
                        : String(v)}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Export pack */}
          <Section title="Export Pack">
            <p className="text-xs text-muted-foreground mb-3">
              Download a reproducible ZIP containing the manifest, research object, prediction
              results, and full event log. The SHA-256 below matches the pinned hash in the
              provenance record.
            </p>
            <div className="flex flex-col gap-3">
              <Button
                size="sm"
                onClick={handleExport}
                disabled={exporting}
                className="self-start text-xs"
              >
                <Download className="size-3.5 mr-1.5" />
                {exporting ? "Generating…" : "Download export pack"}
              </Button>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Pinned SHA-256</p>
                <Hash hash={fixture.exportPackHash} chars={12} />
                {exportDownloaded && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Downloaded — compare the ZIP hash to verify integrity.
                  </p>
                )}
              </div>
            </div>
          </Section>

          {/* Replay verification */}
          <Section title="Replay Verification">
            <p className="text-xs text-muted-foreground mb-3">
              Click below to simulate re-running the pipeline with the same research object and
              manifest. The resulting export pack hash should match exactly.
            </p>
            <div className="space-y-4">
              <Button
                size="sm"
                variant="outline"
                onClick={handleVerifyDeterminism}
                disabled={deterState !== null}
                className="text-xs"
              >
                <ShieldCheck className="size-3.5 mr-1.5" />
                Verify determinism
              </Button>

              {deterState !== null && (
                <DeterminismBadge state={deterState} hashA={fixture.exportPackHash} />
              )}

              {/* Expandable explanation */}
              <button
                type="button"
                onClick={() => setDeterExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {deterExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                What does this prove?
              </button>
              {deterExpanded && (
                <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
                  <p>
                    <strong className="text-foreground">Determinism</strong> means that given the
                    same research object (identified by its content hash) and the same pipeline
                    manifest (git SHA + env fingerprint), the simulation produces byte-for-byte
                    identical output.
                  </p>
                  <p>
                    The export pack SHA-256 is stored in the provenance record at run completion.
                    Replaying the run and comparing the resulting hash gives cryptographic proof
                    that the scoring pipeline has not changed and no data was mutated.
                  </p>
                  <p>
                    In a production environment, replay runs execute against the pinned{" "}
                    <code className="font-mono bg-muted px-1 py-0.5 rounded">git_sha</code> and{" "}
                    <code className="font-mono bg-muted px-1 py-0.5 rounded">env_fingerprint</code>{" "}
                    recorded in the manifest, ensuring reproducibility months or years later.
                  </p>
                </div>
              )}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Failed run section
// ---------------------------------------------------------------------------

function FailedSection({ fixture }: { fixture: ExampleFixture }) {
  return (
    <>
      <Section title="Pipeline Error">
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 space-y-2">
          <p className="text-xs font-semibold text-red-700 dark:text-red-300">Run failed</p>
          <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
            {fixture.errorMessage}
          </p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          No prediction was computed. The pipeline aborted before guide scoring could begin.
        </p>
      </Section>

      <Section title="Browse Other Examples">
        <p className="text-xs text-muted-foreground mb-4">
          This failure example demonstrates how DNA with a Twist handles invalid inputs gracefully.
          Try one of the successful examples to see guide scoring and provenance in action.
        </p>
        <Link
          href="/examples"
          className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline underline-offset-4"
        >
          <ChevronLeft className="size-3.5" />
          Browse all examples
        </Link>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared layout helpers
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-foreground truncate">{children}</dd>
    </div>
  );
}
