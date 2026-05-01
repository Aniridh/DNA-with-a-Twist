/**
 * Run + RunManifest — TypeScript mirror of Run.py.
 * Pydantic is the source of truth. See README.md for drift policy.
 */

export type RunStatus = "queued" | "running" | "done" | "failed";

/** Captured at run start; records the exact environment for replay verification. */
export type RunManifest = {
  readonly git_sha: string;
  readonly api_version: string;
  readonly scoring_versions: Record<string, string>; // {"doench_rs2": "1.0", ...}
  readonly started_at: string; // ISO-8601 UTC Z
  readonly env_fingerprint: string; // sha256(uv.lock contents)
};

export type Run = {
  readonly id: string; // UUID
  readonly ro_id: string; // UUID — FK to ResearchObject
  readonly prompt: string;
  readonly status: RunStatus;
  readonly manifest: RunManifest | null; // null until run starts
  readonly created_at: string; // ISO-8601 UTC Z
  readonly finished_at: string | null;
};
