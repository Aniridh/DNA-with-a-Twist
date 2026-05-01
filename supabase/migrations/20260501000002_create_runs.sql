-- Layer 3: Runs
-- A Run ties a ResearchObject to a natural-language prompt and tracks
-- the pipeline execution through its BackgroundTask lifecycle.
--
-- ro_id is a hard FK to research_objects. An orphan run (no RO) cannot be
-- replayed, exported, or verified — it has no provenance. The FK enforces
-- this invariant at the DB layer. The reviewer's append-only test fixture
-- inserts a stub research_objects row before inserting the run.

CREATE TABLE IF NOT EXISTS runs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ro_id       UUID        NOT NULL REFERENCES research_objects(id),
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
