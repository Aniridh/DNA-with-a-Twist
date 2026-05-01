/**
 * Provisional types — delete when packages/schemas/ResearchObject lands.
 * See ARCHITECTURE.md §3 and ruling 6.
 */

export type StorageRef = {
  bucket: string;
  path: string;
};

export type ResearchObject = {
  id: string;
  content_hash: string;
  backbone_ref: StorageRef;
  backbone_sha256: string;
  target_pdb_ref: StorageRef | null;
  target_pdb_sha256: string | null;
  fastq_ref: StorageRef | null;
  /** TODO(packages/schemas): brand as Sha256 when available */
  fastq_sha256: string | null;
  fastq_phred_pass_pct: number | null;
  pam: "NGG";
  metadata: Record<string, string>;
  created_at: string; // ISO-8601 UTC Z
  created_by: string; // supabase auth user id
};

export type RunStatus = "queued" | "running" | "done" | "failed";

export type RunManifest = {
  git_sha: string;
  api_version: string;
  scoring_versions: Record<string, string>;
  started_at: string;
  env_fingerprint: string;
};

export type Run = {
  id: string;
  ro_id: string;
  prompt: string;
  status: RunStatus;
  manifest: RunManifest | null;
  created_at: string;
  finished_at: string | null;
};

export type OffTargetHit = {
  sequence: string;
  position: number;
  mismatches: number;
  cfd_score: number;
};

export type GuideCandidate = {
  sequence: string;
  pam: string;
  position: number;
  strand: "+" | "-";
  on_target_score: number;
  off_target_count: number;
  off_target_top_hits: OffTargetHit[];
  bystander_warnings: string[];
};

export type PredictionPayload = {
  guides: GuideCandidate[];
  summary: Record<string, unknown>;
};

export type Result = {
  run_id: string;
  prediction: PredictionPayload;
  export_pack_ref: StorageRef | null;
  export_pack_sha256: string | null;
};

export type ProvenanceEventType =
  | "run.preflight.ok"
  | "run.extract.features"
  | "run.simulate.tick"
  | "run.score.emit"
  | "run.summary.pending"
  | "run.summary.done";

export type ProvenanceEvent = {
  id: string;
  run_id: string;
  seq: number;
  event_type: ProvenanceEventType;
  payload: Record<string, unknown>;
  emitted_at: string;
};

// API response shapes
export type UploadResponse = {
  file_id: string;
  sha256: string;
  kind: "fasta" | "fastq" | "pdb";
};

export type CreateRORequest = {
  backbone_id: string;
  fastq_id?: string;
  pdb_id?: string;
  metadata: Record<string, string>;
};

export type CreateRunRequest = {
  ro_id: string;
  prompt: string;
};

export type CreateRunResponse = {
  run_id: string;
  status_url: string;
};

export type ExportResponse = {
  url: string;
  expires_at: string;
  sha256: string;
};

export type ReplayResponse = {
  new_run_id: string;
};

