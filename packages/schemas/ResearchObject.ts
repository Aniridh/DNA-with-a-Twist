/**
 * ResearchObject — TypeScript mirror of ResearchObject.py.
 *
 * Pydantic is the source of truth. This file is hand-maintained.
 * See README.md for drift policy.
 *
 * IMMUTABILITY: all fields are readonly — matches Pydantic frozen=True.
 * The content_hash is computed once at creation and never changes.
 */

/**
 * Opaque brand type for SHA-256 hex strings.
 * Catches hash-field confusion at compile time (e.g., assigning backbone_sha256
 * where content_hash is expected). Frontend-only — not mirrored to Pydantic.
 */
export type Sha256 = string & { readonly __brand: "Sha256" };

/** Reference to a file in Supabase Storage. */
export type StorageRef = {
  readonly bucket: string;
  readonly path: string;
};

/**
 * Immutable record representing a verified set of experimental inputs.
 *
 * content_hash covers exactly: backbone_sha256, target_pdb_sha256,
 * fastq_sha256, pam, metadata. All other fields are excluded from the hash.
 */
export type ResearchObject = {
  readonly id: string; // UUID
  readonly content_hash: Sha256; // SHA-256 of canonical bundle
  readonly backbone_ref: StorageRef;
  readonly backbone_sha256: Sha256;
  readonly target_pdb_ref: StorageRef | null;
  readonly target_pdb_sha256: Sha256 | null;
  readonly fastq_ref: StorageRef | null;
  readonly fastq_sha256: Sha256 | null; // null for FASTA-only ROs
  readonly fastq_phred_pass_pct: number | null; // % bases >= Q20; derived, not hashed
  readonly pam: "NGG";
  readonly metadata: Record<string, string>;
  readonly created_at: string; // ISO-8601 UTC Z
  readonly created_by: string; // Supabase auth user id (UUID)
};
