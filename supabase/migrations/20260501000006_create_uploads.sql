-- Layer 1: Uploads
-- Stores metadata for every raw file uploaded via POST /api/v1/uploads.
-- L2 (research-objects) looks up upload records by ID to get server-computed
-- sha256 and phred_pass_pct — never trusting client-supplied values.

CREATE TABLE IF NOT EXISTS uploads (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL,
    kind            TEXT        NOT NULL CHECK (kind IN ('fasta', 'fastq', 'pdb')),
    sha256          TEXT        NOT NULL,        -- 64-char lowercase hex; server-computed
    storage_bucket  TEXT        NOT NULL DEFAULT 'inputs',
    storage_path    TEXT        NOT NULL,
    phred_pass_pct  FLOAT,                       -- null for fasta/pdb
    sequence_count  INT,                         -- null for pdb
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS uploads_user_id_idx
    ON uploads (user_id, created_at DESC);

-- RLS: users see only their own upload records.
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads FORCE ROW LEVEL SECURITY;

CREATE POLICY uploads_select_own ON uploads
    FOR SELECT USING (user_id = auth.uid());

-- INSERT is service-role only (backend writes after validating the file).
-- No UPDATE or DELETE — upload records are immutable audit trail.
