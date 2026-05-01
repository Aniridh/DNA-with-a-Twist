"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ProvenanceEvent, ProvenanceEventType } from "@/lib/types";
import type { StreamStatus } from "@/lib/hooks/useRunEvents";

const EVENT_COLORS: Record<ProvenanceEventType, string> = {
  "run.preflight.ok": "text-blue-600 dark:text-blue-400",
  "run.extract.features": "text-violet-600 dark:text-violet-400",
  "run.simulate.tick": "text-amber-600 dark:text-amber-400",
  "run.score.emit": "text-green-600 dark:text-green-400",
  "run.summary.pending": "text-slate-500 dark:text-slate-400",
  "run.summary.done": "text-emerald-600 dark:text-emerald-400",
};

const EVENT_LABEL: Record<ProvenanceEventType, string> = {
  "run.preflight.ok": "preflight",
  "run.extract.features": "extract",
  "run.simulate.tick": "simulate",
  "run.score.emit": "score",
  "run.summary.pending": "summary",
  "run.summary.done": "done",
};

interface EventLogProps {
  events: ProvenanceEvent[];
  status: StreamStatus;
  reconnectIn?: number | null;
  className?: string;
  maxHeightClass?: string;
}

export function EventLog({
  events,
  status,
  reconnectIn,
  className,
  maxHeightClass = "max-h-96",
}: EventLogProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Autoscroll unless user has scrolled up (sentinel not visible)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setIsPaused(!entry.isIntersecting),
      { root: listRef.current?.parentElement, threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!isPaused && sentinelRef.current) {
      sentinelRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, isPaused]);

  return (
    <div className={cn("flex flex-col rounded-lg border bg-card", className)}>
      <StatusBar status={status} reconnectIn={reconnectIn} isPaused={isPaused} />
      <div className={cn("overflow-y-auto", maxHeightClass)}>
        <ul ref={listRef} className="divide-y divide-border">
          {events.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              {status === "connecting" ? "Connecting…" : "No events yet"}
            </li>
          ) : (
            events.map((event) => <EventRow key={`${event.id}-${event.seq}`} event={event} />)
          )}
        </ul>
        <div ref={sentinelRef} aria-hidden="true" />
      </div>
    </div>
  );
}

function EventRow({ event }: { event: ProvenanceEvent }) {
  const color = EVENT_COLORS[event.event_type] ?? "text-foreground";
  const label = EVENT_LABEL[event.event_type] ?? event.event_type;
  const ts = new Date(event.emitted_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <li className="flex items-start gap-3 px-4 py-2 text-xs hover:bg-muted/40 transition-colors">
      <span className="shrink-0 tabular-nums text-muted-foreground">{ts}</span>
      <span className={cn("shrink-0 w-16 font-mono font-medium", color)}>{label}</span>
      <span className="min-w-0 break-all font-mono text-muted-foreground">
        {JSON.stringify(event.payload)}
      </span>
    </li>
  );
}

function StatusBar({
  status,
  reconnectIn,
  isPaused,
}: {
  status: StreamStatus;
  reconnectIn?: number | null;
  isPaused: boolean;
}) {
  return (
    <div className="flex items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
      {status === "streaming" && (
        <>
          <span className="size-1.5 rounded-full bg-emerald-500 animate-live-blink" aria-hidden="true" />
          <span>LIVE</span>
        </>
      )}
      {status === "connecting" && (
        <>
          <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
          <span>Connecting…</span>
        </>
      )}
      {status === "done" && (
        <>
          <span className="size-1.5 rounded-full bg-slate-400" aria-hidden="true" />
          <span>Complete</span>
        </>
      )}
      {status === "disconnected" && (
        <>
          <span className="size-1.5 rounded-full bg-red-400" aria-hidden="true" />
          <span>
            {reconnectIn != null ? `Reconnecting in ${reconnectIn}s…` : "Disconnected"}
          </span>
        </>
      )}
      {isPaused && status === "streaming" && (
        <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
          paused ↑
        </span>
      )}
    </div>
  );
}
