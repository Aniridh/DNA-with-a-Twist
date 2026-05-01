/**
 * Result + prediction sub-models — TypeScript mirror of Result.py.
 * Pydantic is the source of truth. See README.md for drift policy.
 *
 * prediction.json must be timestamp-free (ARCHITECTURE.md §6 rule 4).
 * Do NOT add Date, run_id, or any non-deterministic fields to PredictionPayload.
 */

import type { Sha256, StorageRef } from "./ResearchObject";

export type OffTargetHit = {
  readonly sequence: string; // 20nt
  readonly position: number; // 0-based in backbone
  readonly mismatches: number; // ≤4
  readonly cfd_score: number; // [0, 1]
};

export type GuideCandidate = {
  readonly sequence: string; // 20nt protospacer
  readonly pam: string; // 3nt PAM
  readonly position: number; // 0-based start (+ strand)
  readonly strand: "+" | "-";
  readonly on_target_score: number; // Doench RS2, [0, 1]
  readonly off_target_count: number;
  readonly off_target_top_hits: readonly OffTargetHit[]; // top-5 by CFD score
  readonly bystander_warnings: readonly string[];
};

/**
 * Timestamp-free payload. Its canonical JSON hash is replay-stable.
 * Never add Date, UUID, or run_id fields here.
 */
export type PredictionPayload = {
  readonly guides: readonly GuideCandidate[];
  readonly summary: Record<string, unknown>; // top score, mean off-target, etc.
};

export type Result = {
  readonly run_id: string; // UUID
  readonly prediction: PredictionPayload;
  readonly export_pack_ref: StorageRef | null; // populated when L5 finishes
  readonly export_pack_sha256: Sha256 | null; // SHA-256 of zip bytes
};
