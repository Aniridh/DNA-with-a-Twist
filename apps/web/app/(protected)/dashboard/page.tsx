"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/getApiClient";
import type { ResearchObject } from "@schemas/ResearchObject";
import type { Run } from "@/lib/types";

const DEMO_NAMES = ["Dr. Chen", "Dr. Patel", "Dr. Okafor", "Dr. Kim", "Dr. Reyes"];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const [name] = useState(() => DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)]);
  const [ros, setRos] = useState<ResearchObject[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.listResearchObjects(),
      apiClient.listRuns(),
    ]).then(([rosData, runsData]) => {
      setRos(rosData);
      setRuns(runsData);
    }).finally(() => setLoading(false));
  }, []);

  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {greeting()}, <span className="text-teal">{name}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{date}</p>
        </div>
        <Link
          href="/research-objects/new"
          className="inline-flex h-10 items-center rounded-lg bg-teal px-5 text-sm font-medium text-[#0a0a0a] hover:bg-teal-dim transition-colors"
        >
          + New Research Object
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Research Objects", value: loading ? "—" : String(ros.length) },
          { label: "Total Runs", value: loading ? "—" : String(runs.length) },
          {
            label: "Verifications",
            value: loading ? "—" : String(runs.filter((r) => r.id.startsWith("replay-")).length),
          },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-xl border border-[#222] bg-surface p-5"
          >
            <p className="text-xs text-muted-foreground mb-2">{stat.label}</p>
            <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Research Objects */}
        <div className="rounded-xl border border-[#222] bg-surface">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
            <h2 className="text-sm font-semibold text-foreground">Recent Research Objects</h2>
            <Link href="/research-objects/new" className="text-xs text-teal hover:text-teal-dim transition-colors">
              + New
            </Link>
          </div>
          {!loading && ros.length > 0 ? (
            <div className="divide-y divide-[#1a1a1a]">
              {ros.slice(0, 5).map((ro) => (
                <Link
                  key={ro.id}
                  href={`/research-objects/${ro.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-elevated transition-colors group"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal/10 border border-teal/20">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5 text-teal">
                      <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V6.414A2 2 0 0013.414 5L11 2.586A2 2 0 009.586 2H4zm5 6a1 1 0 10-2 0v.5H6.5a.5.5 0 000 1H7V10a1 1 0 102 0v-.5h.5a.5.5 0 000-1H9V8z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-teal/80 truncate">{ro.content_hash.slice(0, 16)}…</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ro.metadata?.gene ? `${ro.metadata.gene} · ` : ""}
                      {new Date(ro.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-muted-foreground group-hover:text-teal transition-colors text-sm shrink-0">→</span>
                </Link>
              ))}
            </div>
          ) : loading ? (
            <div className="px-5 py-8 space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-[#1a1a1a]" />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No research objects yet"
              body="Paste a sequence to create your first verifiable Research Object."
              cta={{ label: "Create Research Object", href: "/research-objects/new" }}
            />
          )}
        </div>

        {/* Runs */}
        <div className="rounded-xl border border-[#222] bg-surface">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
            <h2 className="text-sm font-semibold text-foreground">Recent Runs</h2>
            {runs.length > 0 && (
              <Link href="/runs/new" className="text-xs text-teal hover:text-teal-dim transition-colors">
                + New
              </Link>
            )}
          </div>
          {!loading && runs.length > 0 ? (
            <div className="divide-y divide-[#1a1a1a]">
              {runs.slice(0, 5).map((run) => (
                <Link
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-elevated transition-colors group"
                >
                  <StatusDot status={run.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate group-hover:text-teal transition-colors">
                      {run.prompt}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(run.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-muted-foreground group-hover:text-teal transition-colors text-sm shrink-0">→</span>
                </Link>
              ))}
            </div>
          ) : loading ? (
            <div className="px-5 py-8 space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-[#1a1a1a]" />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No runs yet"
              body="Create a Research Object first, then start a simulation run."
              cta={ros.length > 0 ? { label: "Start a Run", href: `/runs/new?ro=${ros[0].id}` } : null}
            />
          )}
        </div>
      </div>

      {process.env.NODE_ENV === "development" && (
        <div className="pt-4">
          <Link href="/dev/primitives" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            Dev: UI Primitives →
          </Link>
        </div>
      )}
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
  return <span className={cn("size-2 shrink-0 rounded-full", colors[status] ?? "bg-[#444]")} />;
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { label: string; href: string } | null;
}) {
  return (
    <div className="px-5 py-10 text-center space-y-3">
      <div className="mx-auto w-10 h-10 rounded-full border border-[#222] flex items-center justify-center text-muted-foreground/30">
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-flex h-8 items-center rounded-lg border border-teal/30 bg-teal/5 px-4 text-xs font-medium text-teal hover:bg-teal/10 transition-colors"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
