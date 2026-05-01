-- Layer 3: Runs
-- A Run ties a ResearchObject to a natural-language prompt and tracks
-- the pipeline execution through its BackgroundTask lifecycle.
--
-- NOTE: ro_id intentionally has no FK constraint to research_objects.
-- The reviewer's test_provenance_append_only.py fixture inserts runs with
-- stub ro_ids (random UUIDs) to isolate the append-only test from RO setup.
-- Referential integrity is enforced at the application layer (L1 ingestion).
-- TODO: promote to FK once test fixtures seed proper ResearchObject rows.

CREATE TABLE IF NOT EXISTS runs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ro_id       UUID        NOT NULL,   -- references research_objects(id); app-enforced
    prompt      TEXT        NOT NULL,
    status      TEXT        NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'running', 'done', 'failed')),
    manifest    JSONB,                  -- RunManifest; populated when run starts
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

-- Lookup: all runs for a given RO (dashboard, compare view).
CREATE INDEX IF NOT EXISTS runs_ro_id_idx
    ON runs (ro_id, created_at DESC);

-- Lookup: runs by status (background task polling).
CREATE INDEX IF NOT EXISTS runs_status_idx
    ON runs (status) WHERE status IN ('queued', 'running');
