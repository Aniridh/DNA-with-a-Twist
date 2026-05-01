"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { GuideCandidate, OffTargetHit } from "@/lib/types";

type SortKey = "on_target_score" | "off_target_count";
type SortDir = "asc" | "desc";

export function sortGuides(guides: GuideCandidate[], key: SortKey, dir: SortDir): GuideCandidate[] {
  return [...guides].sort((a, b) => {
    const delta = a[key] - b[key];
    return dir === "asc" ? delta : -delta;
  });
}

interface PredictionTableProps {
  guides: GuideCandidate[];
  className?: string;
}

export function PredictionTable({ guides, className }: PredictionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("on_target_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sorted = sortGuides(guides, sortKey, sortDir);
  const topScore = sorted.length > 0 ? Math.max(...guides.map((g) => g.on_target_score)) : 0;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function toggleExpand(seq: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(seq) ? next.delete(seq) : next.add(seq);
      return next;
    });
  }

  if (guides.length === 0) {
    return (
      <div className={cn("rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground", className)}>
        No guide candidates
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      <table className="w-full text-xs">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-8"></th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Sequence</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">PAM</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Strand</th>
            <SortHeader
              label="On-target"
              active={sortKey === "on_target_score"}
              dir={sortDir}
              onClick={() => toggleSort("on_target_score")}
            />
            <SortHeader
              label="Off-target"
              active={sortKey === "off_target_count"}
              dir={sortDir}
              onClick={() => toggleSort("off_target_count")}
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((guide) => {
            const seq = `${guide.sequence}:${guide.position}:${guide.strand}`;
            const isTop = guide.on_target_score === topScore;
            const isExpanded = expanded.has(seq);

            return (
              <>
                <tr
                  key={seq}
                  className={cn(
                    "cursor-pointer hover:bg-muted/40 transition-colors",
                    isTop && "bg-amber-50 dark:bg-amber-950/30"
                  )}
                  onClick={() => toggleExpand(seq)}
                >
                  <td className="px-4 py-2 text-center">
                    {isTop && <span title="Top guide" className="text-amber-500">★</span>}
                  </td>
                  <td className="px-4 py-2 font-mono tracking-tight">{guide.sequence}</td>
                  <td className="px-4 py-2 font-mono">{guide.pam}</td>
                  <td className="px-4 py-2">{guide.strand}</td>
                  <td className="px-4 py-2">
                    <ScoreBar score={guide.on_target_score} />
                  </td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">
                    {guide.off_target_count}
                    {guide.bystander_warnings.length > 0 && (
                      <span className="ml-1 text-amber-500" title={guide.bystander_warnings.join(", ")}>⚠</span>
                    )}
                  </td>
                </tr>
                {isExpanded && guide.off_target_top_hits.length > 0 && (
                  <tr key={`${seq}-expanded`}>
                    <td colSpan={6} className="bg-muted/20 px-8 py-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Top off-target hits</p>
                      <div className="space-y-1">
                        {guide.off_target_top_hits.map((hit, i) => (
                          <OffTargetRow key={i} hit={hit} />
                        ))}
                      </div>
                      {guide.bystander_warnings.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {guide.bystander_warnings.map((w, i) => (
                            <p key={i} className="text-xs text-amber-600 dark:text-amber-400">⚠ {w}</p>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        <span className="text-xs opacity-60">
          {active ? (dir === "desc" ? "↓" : "↑") : "↕"}
        </span>
      </button>
    </th>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

function OffTargetRow({ hit }: { hit: OffTargetHit }) {
  return (
    <div className="flex items-center gap-4 text-xs font-mono">
      <span className="text-muted-foreground">{hit.sequence}</span>
      <span className="text-muted-foreground">pos {hit.position}</span>
      <span className="text-amber-600 dark:text-amber-400">{hit.mismatches}mm</span>
      <span className="text-muted-foreground">CFD {hit.cfd_score.toFixed(3)}</span>
    </div>
  );
}
