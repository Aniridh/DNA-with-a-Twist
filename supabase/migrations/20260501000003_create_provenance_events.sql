-- Layer 4: Provenance Events
-- APPEND-ONLY. The append-only guarantee is the core of Provenance Lab's
-- credibility claim. Enforcement is at the database level via triggers —
-- not just in application code — so no migration or schema change can
-- accidentally enable mutation without removing these triggers explicitly.
--
-- Two triggers are installed:
--   1. provenance_events_append_only    — rejects ALL UPDATE and DELETE
--   2. provenance_events_seq_monotonic  — enforces seq = prev_max + 1 per run

CREATE TABLE IF NOT EXISTS provenance_events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      UUID        NOT NULL REFERENCES runs(id),
    seq         INTEGER     NOT NULL,   -- monotonic per run, gap-free, starts at 1
    event_type  TEXT        NOT NULL,   -- §5 vocabulary
    payload     JSONB       NOT NULL DEFAULT '{}',
    emitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT provenance_events_run_seq_unique UNIQUE (run_id, seq)
);

-- Lookup: all events for a run in order (event log UI, export pack).
CREATE INDEX IF NOT EXISTS provenance_events_run_id_seq_idx
    ON provenance_events (run_id, seq ASC);

-- ── Trigger 1: Append-only enforcement ───────────────────────────────────────
-- Fires BEFORE UPDATE or DELETE on any row. Raises an exception for ALL callers
-- including service role — the strongest possible enforcement.
-- The test_provenance_append_only.py teardown fixture catches this exception
-- gracefully (try/except with pass).

CREATE OR REPLACE FUNCTION provenance_events_deny_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'provenance_events is append-only: % is not permitted. run_id=%, seq=%',
        TG_OP, OLD.run_id, OLD.seq
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER provenance_events_append_only
    BEFORE UPDATE OR DELETE ON provenance_events
    FOR EACH ROW EXECUTE FUNCTION provenance_events_deny_mutation();

-- Also block TRUNCATE (PostgREST doesn't expose it, but belt-and-suspenders).
REVOKE TRUNCATE ON provenance_events FROM PUBLIC;

-- ── Trigger 2: Monotonic gap-free seq enforcement ────────────────────────────
-- Fires BEFORE INSERT. Verifies that NEW.seq = max(seq for this run) + 1.
-- SECURITY DEFINER so the SELECT can read all events for the run regardless
-- of the caller's RLS context (service role inserts bypass RLS, but trigger
-- runs in the security context of the function owner).
--
-- Race condition note: two concurrent INSERTs for the same run_id could both
-- read the same max(seq) and compute the same expected_seq, causing one to
-- fail with a unique constraint violation (run_id, seq). For MVP with
-- BackgroundTasks (single-threaded pipeline per run), this is not a concern.
-- If concurrency is added later, use SELECT ... FOR UPDATE on a per-run lock.

CREATE OR REPLACE FUNCTION provenance_events_enforce_seq()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    expected_seq INTEGER;
BEGIN
    SELECT COALESCE(MAX(seq), 0) + 1
    INTO expected_seq
    FROM provenance_events
    WHERE run_id = NEW.run_id;

    IF NEW.seq != expected_seq THEN
        RAISE EXCEPTION
            'provenance_events: seq must be monotonic and gap-free. '
            'Expected seq=% for run_id=%, got seq=%',
            expected_seq, NEW.run_id, NEW.seq
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER provenance_events_seq_monotonic
    BEFORE INSERT ON provenance_events
    FOR EACH ROW EXECUTE FUNCTION provenance_events_enforce_seq();
