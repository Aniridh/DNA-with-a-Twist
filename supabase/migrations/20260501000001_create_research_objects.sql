-- Layer 2: Research Objects
-- Immutable after creation — no UPDATE or DELETE in application code.
-- content_hash is the primary user-facing artifact; UNIQUE enforces
-- that the same scientific inputs always map to one row.

CREATE TABLE IF NOT EXISTS research_objects (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    content_hash        TEXT        NOT NULL UNIQUE,      -- SHA-256 hex, 64 chars
    backbone_ref        JSONB       NOT NULL,             -- {bucket, path}
    backbone_sha256     TEXT        NOT NULL,
    target_pdb_ref      JSONB,
    target_pdb_sha256   TEXT,
    fastq_ref           JSONB,
    fastq_sha256        TEXT,                             -- in content_hash allowlist
    fastq_phred_pass_pct FLOAT8,                         -- % bases >= Q20; derived
    pam                 TEXT        NOT NULL DEFAULT 'NGG'
                            CHECK (pam IN ('NGG')),
    metadata            JSONB       NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID        NOT NULL              -- auth.users(id)
);

-- Index for the most common lookup pattern: all ROs for a user.
CREATE INDEX IF NOT EXISTS research_objects_created_by_idx
    ON research_objects (created_by, created_at DESC);

-- Index for hash-based lookups (verify button, replay deduplication).
CREATE INDEX IF NOT EXISTS research_objects_content_hash_idx
    ON research_objects (content_hash);
