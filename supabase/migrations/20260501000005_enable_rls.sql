-- Row-Level Security
-- All user-scoped tables are locked to auth.uid().
-- Backend writes use the service role key (bypasses RLS by design).
-- Frontend reads use the anon key + user JWT (subject to these policies).
--
-- Policy design:
--   research_objects  — SELECT + INSERT for owner; no UPDATE/DELETE (immutable)
--   runs              — SELECT + INSERT for owner; no UPDATE/DELETE (backend updates via service role)
--   provenance_events — SELECT for owner; no INSERT/UPDATE/DELETE (backend writes via service role)
--   results           — SELECT for owner; no INSERT/UPDATE/DELETE (backend writes via service role)
--
-- The append-only trigger on provenance_events is a separate, stronger
-- guarantee that applies even to service role for UPDATE/DELETE.

-- ── Enable RLS ────────────────────────────────────────────────────────────────

ALTER TABLE research_objects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE provenance_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE results              ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (belt-and-suspenders; doesn't affect service role).
ALTER TABLE research_objects     FORCE ROW LEVEL SECURITY;
ALTER TABLE runs                 FORCE ROW LEVEL SECURITY;
ALTER TABLE provenance_events    FORCE ROW LEVEL SECURITY;
ALTER TABLE results              FORCE ROW LEVEL SECURITY;

-- ── research_objects ──────────────────────────────────────────────────────────

CREATE POLICY "rls_ro_select" ON research_objects
    FOR SELECT
    USING (auth.uid() = created_by);

CREATE POLICY "rls_ro_insert" ON research_objects
    FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- No UPDATE or DELETE policies — research_objects are immutable after creation.

-- ── runs ──────────────────────────────────────────────────────────────────────
-- Users can create runs and read their own. Status updates are done by the
-- backend via service role (bypasses RLS) — no UPDATE policy needed here.

CREATE POLICY "rls_runs_select" ON runs
    FOR SELECT
    USING (
        ro_id IN (
            SELECT id FROM research_objects WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "rls_runs_insert" ON runs
    FOR INSERT
    WITH CHECK (
        ro_id IN (
            SELECT id FROM research_objects WHERE created_by = auth.uid()
        )
    );

-- ── provenance_events ─────────────────────────────────────────────────────────
-- Read-only for users. Backend inserts via service role.
-- No INSERT/UPDATE/DELETE policies — anon+JWT requests are silently rejected
-- for those operations (0 rows affected). The BEFORE UPDATE/DELETE trigger
-- adds an exception-raising layer for service role UPDATE/DELETE.

CREATE POLICY "rls_events_select" ON provenance_events
    FOR SELECT
    USING (
        run_id IN (
            SELECT r.id
            FROM runs r
            JOIN research_objects ro ON r.ro_id = ro.id
            WHERE ro.created_by = auth.uid()
        )
    );

-- ── results ───────────────────────────────────────────────────────────────────
-- Read-only for users. Backend inserts via service role.

CREATE POLICY "rls_results_select" ON results
    FOR SELECT
    USING (
        run_id IN (
            SELECT r.id
            FROM runs r
            JOIN research_objects ro ON r.ro_id = ro.id
            WHERE ro.created_by = auth.uid()
        )
    );
