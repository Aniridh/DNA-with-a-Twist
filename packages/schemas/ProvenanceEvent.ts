/**
 * ProvenanceEvent — TypeScript mirror of ProvenanceEvent.py.
 * Pydantic is the source of truth. See README.md for drift policy.
 *
 * APPEND-ONLY: never mutated after insertion. DB trigger enforces this.
 */

/** Fixed event vocabulary per ARCHITECTURE.md §5. */
export type EventType =
  | "run.preflight.ok"
  | "run.extract.features"
  | "run.simulate.tick"
  | "run.score.emit"
  | "run.summary.pending"
  | "run.summary.done";

export type ProvenanceEvent = {
  readonly id: string; // UUID
  readonly run_id: string; // UUID
  readonly seq: number; // monotonic per run, starts at 1, gap-free
  readonly event_type: EventType;
  readonly payload: Record<string, unknown>; // contents vary per event_type
  readonly emitted_at: string; // ISO-8601 UTC Z
};
