"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EXAMPLE_FIXTURES } from "@/lib/example-fixtures";
import type { ExampleFixture, ExampleCategory } from "@/lib/example-fixtures";

const CATEGORIES: Array<"All" | ExampleCategory> = [
  "All",
  "Therapeutic",
  "Knockout",
  "Base editing",
  "Failed runs",
];

export default function ExamplesPage() {
  const [filter, setFilter] = useState<"All" | ExampleCategory>("All");

  const filtered =
    filter === "All"
      ? EXAMPLE_FIXTURES
      : EXAMPLE_FIXTURES.filter((f) => f.categories.includes(filter as ExampleCategory));

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-teal-100 dark:bg-teal-900/40 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
            DEMO
          </span>
          <h1 className="text-3xl font-bold tracking-tight">Pre-built demonstration runs</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Explore real CRISPR scenarios with full provenance traces — manifest, event log, scored
          guide candidates, verifiable export packs, and determinism proofs. No setup required.
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              filter === cat
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Card grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((ex) => (
          <ExampleCard key={ex.slug} ex={ex} />
        ))}
      </div>
    </div>
  );
}

function ExampleCard({ ex }: { ex: ExampleFixture }) {
  return (
    <Link
      href={`/examples/${ex.slug}`}
      className="group block rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg hover:border-teal-500/40 hover:shadow-teal-500/5"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-foreground truncate">{ex.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ex.subtitle}</p>
          </div>
          <span
            className={cn(
              "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              ex.status === "done"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                ex.status === "done" ? "bg-emerald-500" : "bg-red-500"
              )}
            />
            {ex.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {ex.categories.map((c) => (
            <Badge key={c} variant="secondary" className="text-xs">
              {c}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs">
          {ex.topScore != null ? (
            <span className="font-mono font-medium text-teal-600 dark:text-teal-400">
              Top score: {ex.topScore.toFixed(2)}
            </span>
          ) : (
            <span className="text-muted-foreground">No prediction</span>
          )}
          {ex.guideCount != null && (
            <span className="text-muted-foreground">{ex.guideCount} guides</span>
          )}
        </div>
      </div>
    </Link>
  );
}
