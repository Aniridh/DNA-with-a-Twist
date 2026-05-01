-- Layer 5: Results
-- One result row per run. Created by the backend pipeline when scoring
-- completes. Immutable after creation (no UPDATE in application code).
-- export_pack_ref and export_pack_sha256 are populated when L5 finishes.

CREATE TABLE IF NOT EXISTS results (
    run_id              UUID    PRIMARY KEY REFERENCES runs(id),
    prediction          JSONB   NOT NULL,       -- PredictionPayload (canonical JSON)
    export_pack_ref     JSONB,                  -- {bucket, path} of the zip
    export_pack_sha256  TEXT                    -- SHA-256 of the zip bytes
);

-- No separate index — run_id IS the primary key, so PK index covers all lookups.
