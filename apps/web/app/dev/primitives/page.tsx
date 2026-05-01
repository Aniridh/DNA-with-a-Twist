"use client";

import { useState } from "react";
import { Hash } from "@/components/primitives/Hash";
import { EventLog } from "@/components/primitives/EventLog";
import { PredictionTable } from "@/components/primitives/PredictionTable";
import { DeterminismBadge, type DeterminismState } from "@/components/primitives/DeterminismBadge";
import { ManifestCard } from "@/components/primitives/ManifestCard";
import { useRunEvents } from "@/lib/hooks/useRunEvents";
import type { GuideCandidate, Run } from "@/lib/types";

const SHA256 = "9f3ca4e2b87d1f605c3a29e4d81f9b0e3c5d7a2f1e8b4c6d9a0f3e7b2c5d8a1f4";
const SHA256_B = "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b";
const GIT_SHA = "a3f2c9d1e5b8f4c7d2a1e9b6f3c0d7a4e2b5f8c1d4a7e0b3f6c9d2a5e8b1f4c7d0";

// ── fixtures ────────────────────────────────────────────────────────────────

const baseRun: Run = {
  id: "run-001",
  ro_id: "ro-001",
  prompt: "Find optimal guides for BCL11A enhancer region",
  status: "done",
  manifest: {
    git_sha: GIT_SHA,
    api_version: "v1.4.2",
    scoring_versions: { azimuth: "2.1.0", cfd: "1.0.3" },
    started_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    env_fingerprint: SHA256,
  },
  created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  finished_at: new Date().toISOString(),
};

const guides: GuideCandidate[] = [
  {
    sequence: "GCAAACGGCAGATCGCAACG",
    pam: "NGG",
    position: 1234,
    strand: "+",
    on_target_score: 0.82,
    off_target_count: 2,
    off_target_top_hits: [
      { sequence: "GCAAACGGCAGATCGCAACG", position: 5678, mismatches: 2, cfd_score: 0.12 },
      { sequence: "GCAAACGGCAGATCGCAACT", position: 9012, mismatches: 3, cfd_score: 0.04 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "TGGCAATCGGCAGATCGCAA",
    pam: "NGG",
    position: 1456,
    strand: "-",
    on_target_score: 0.71,
    off_target_count: 5,
    off_target_top_hits: [
      { sequence: "TGGCAATCGGCAGATCGCAG", position: 2345, mismatches: 1, cfd_score: 0.45 },
    ],
    bystander_warnings: ["Editing window overlaps coding exon"],
  },
  {
    sequence: "AACGGCAGATCGCAACGTGG",
    pam: "NGG",
    position: 1678,
    strand: "+",
    on_target_score: 0.55,
    off_target_count: 12,
    off_target_top_hits: [],
    bystander_warnings: ["Potential bystander SNP rs12345678"],
  },
];

// ── section wrappers ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground border-b pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-mono">{label}</p>
      {children}
    </div>
  );
}

// ── live EventLog section ────────────────────────────────────────────────────

function LiveEventLogSection() {
  const { events, status, reconnectIn, disconnect } = useRunEvents("dev-run-mock");
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">Live stream (mock)</p>
        <button
          type="button"
          onClick={disconnect}
          className="rounded border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          force disconnect
        </button>
      </div>
      <EventLog
        events={events}
        status={status}
        reconnectIn={reconnectIn}
        maxHeightClass="max-h-64"
      />
    </div>
  );
}

// ── DeterminismBadge interactive section ─────────────────────────────────────

function BadgeSection() {
  const [badgeState, setBadgeState] = useState<DeterminismState>("checking");

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["checking", "match", "mismatch"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setBadgeState(s)}
            className="rounded border px-2 py-1 text-xs hover:bg-muted"
          >
            → {s}
          </button>
        ))}
      </div>
      <DeterminismBadge
        state={badgeState}
        hashA={SHA256}
        hashB={SHA256_B}
      />
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function PrimitivesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-12 px-4 py-12">
      <div>
        <h1 className="text-2xl font-bold">Primitives smoke test</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visual verification of all UI primitives. Every documented state is represented.
        </p>
      </div>

      {/* ── Hash ── */}
      <Section title="Hash">
        <Row label="short (no truncation)">
          <Hash hash="a1b2c3d4" />
        </Row>
        <Row label="64-char SHA-256, chars=6 (default)">
          <Hash hash={SHA256} />
        </Row>
        <Row label="64-char SHA-256, chars=4 (architecture doc style)">
          <Hash hash={SHA256} chars={4} />
        </Row>
        <Row label="with verify CTA">
          <Hash hash={SHA256} showVerify onVerify={() => alert("verify clicked")} />
        </Row>
        <Row label="composition: two hashes in a row">
          <div className="flex items-center gap-3">
            <Hash hash={SHA256} />
            <span className="text-xs text-muted-foreground">=</span>
            <Hash hash={SHA256} />
          </div>
        </Row>
      </Section>

      {/* ── EventLog ── */}
      <Section title="EventLog">
        <Row label="live — mock SSE stream">
          <LiveEventLogSection />
        </Row>
      </Section>

      {/* ── DeterminismBadge ── */}
      <Section title="DeterminismBadge">
        <Row label="interactive — click buttons to transition">
          <BadgeSection />
        </Row>
        <Row label="all three states side-by-side">
          <div className="space-y-2">
            <DeterminismBadge state="checking" />
            <DeterminismBadge state="match" hashA={SHA256} />
            <DeterminismBadge state="mismatch" hashA={SHA256} hashB={SHA256_B} />
          </div>
        </Row>
      </Section>

      {/* ── PredictionTable ── */}
      <Section title="PredictionTable">
        <Row label="empty">
          <PredictionTable guides={[]} />
        </Row>
        <Row label="single guide">
          <PredictionTable guides={[guides[0]]} />
        </Row>
        <Row label="3 guides, sortable — click headers to sort">
          <PredictionTable guides={guides} />
        </Row>
        <Row label="expanded rows — click a row to expand off-target hits">
          <PredictionTable guides={guides} />
        </Row>
      </Section>

      {/* ── ManifestCard ── */}
      <Section title="ManifestCard">
        <Row label="all fields — status: done">
          <ManifestCard run={baseRun} roHash={SHA256} />
        </Row>
        <Row label="null manifest (run just queued)">
          <ManifestCard run={{ ...baseRun, status: "queued", manifest: null }} />
        </Row>
        <Row label="status: running">
          <ManifestCard run={{ ...baseRun, status: "running", finished_at: null }} />
        </Row>
        <Row label="status: failed">
          <ManifestCard run={{ ...baseRun, status: "failed" }} />
        </Row>
      </Section>
    </div>
  );
}
