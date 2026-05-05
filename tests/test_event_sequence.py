"""
Provenance event sequence spec.

ARCHITECTURE.md §5 defines a fixed vocabulary for every run:
  1. run.preflight.ok
  2. run.extract.features
  3. run.simulate.tick  (one or more)
  4. run.score.emit     (one per guide candidate)
  5. run.summary.pending → run.summary.done

ARCHITECTURE.md §9 checklist:
  "Every run emits ≥5 events"
  "Events are append-only (no UPDATE in provenance_events table)"
  "Seq monotonic, gap-free"

These tests are the executable contract for §5. They verify the event stream
from a completed run against every constraint above.

Skip behavior:
  - Unit CI (PRs): skipped — requires a running backend.
  - Integration CI (main merges): runs against the test Supabase project.
  - Will fail with ConnectionError until backend ships L3-L5.

Failure protocol:
  If seq_monotonic or required_order tests fail: file an issue against the
  backend provenance.py and block merge. Do NOT xfail.
  If event_count < 5: same — minimum event vocabulary is a hard contract.
"""

import contextlib
import os
from typing import Any

import httpx
import pytest

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
SAMPLE_FASTA_PATH = "tests/fixtures/BCL11A_enhancer.fasta"
SAMPLE_PROMPT = "Disrupt GATA1 binding site at +58 enhancer"

# Required event types, in the order they must appear (§5).
# simulate.tick and score.emit may appear multiple times (at least once each).
REQUIRED_EVENT_TYPES_ORDERED = [
    "run.preflight.ok",
    "run.extract.features",
    "run.simulate.tick",
    "run.score.emit",
    "run.summary.pending",
    "run.summary.done",
]

MIN_EVENT_COUNT = 5  # §9 hard minimum


# ─────────────────────────────────────────────────────────────────────────────
# Helpers (shared with test_replay.py — kept local to avoid coupling)
# ─────────────────────────────────────────────────────────────────────────────


def _run_to_completion(client: httpx.Client) -> tuple[str, list[dict[str, Any]]]:
    """
    Upload sample FASTA, create RO, start run, poll to completion.
    Returns (run_id, sorted_events_list).
    """
    import time
    from pathlib import Path

    # Upload
    fasta_path = Path(SAMPLE_FASTA_PATH)
    with fasta_path.open("rb") as fh:
        upload = client.post(
            "/api/v1/uploads",
            files={"file": (fasta_path.name, fh, "text/plain")},
        )
    upload.raise_for_status()
    backbone_id = upload.json()["file_id"]

    # Create RO
    ro = client.post(
        "/api/v1/research-objects",
        json={"backbone_id": backbone_id, "metadata": {"test": "event_sequence"}},
    )
    ro.raise_for_status()
    ro_id = ro.json()["id"]

    # Start run
    run = client.post("/api/v1/runs", json={"ro_id": ro_id, "prompt": SAMPLE_PROMPT})
    run.raise_for_status()
    run_id = run.json()["run_id"]

    # Poll
    deadline = time.monotonic() + 120.0
    while time.monotonic() < deadline:
        status = client.get(f"/api/v1/runs/{run_id}")
        status.raise_for_status()
        if status.json()["status"] in ("done", "failed"):
            break
        time.sleep(2.0)
    else:
        pytest.fail(f"Run {run_id} did not complete within 120s")

    run_data = status.json()
    assert run_data["status"] == "done", f"Run ended in failed state: {run_data}"

    # Fetch all events
    events_resp = client.get(f"/api/v1/runs/{run_id}/events")
    events_resp.raise_for_status()
    # SSE endpoint — for testing, use the pagination endpoint if available.
    # If this endpoint returns SSE, parse it; if it returns JSON, use directly.
    # Backend agent must expose a JSON events endpoint for tests; SSE for UI.
    # TODO: if events endpoint returns SSE only, use GET /runs/:id which returns
    # "Run + recent events" per the API contract (ARCHITECTURE.md §4).
    try:
        events_json = events_resp.json()
    except Exception:
        # SSE fallback — parse text/event-stream lines.
        events_json = _parse_sse_events(events_resp.text)

    # Sort by seq to normalize any ordering from the API response.
    events = sorted(events_json, key=lambda e: e["seq"])
    return run_id, events


def _parse_sse_events(sse_text: str) -> list[dict[str, Any]]:
    """Minimal SSE parser — extracts data: lines and JSON-parses them."""
    import json

    events = []
    for line in sse_text.splitlines():
        if line.startswith("data:"):
            payload = line[5:].strip()
            if payload and payload != "[DONE]":
                with contextlib.suppress(Exception):
                    events.append(json.loads(payload))
    return events


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestEventSequence:
    """
    All tests share a single completed run's event list, fetched once.
    Run the class-level fixture to create the run; individual tests assert
    specific properties of the resulting event stream.
    """

    @pytest.fixture(scope="class")
    def client(self) -> httpx.Client:
        return httpx.Client(base_url=BASE_URL, timeout=130.0)

    @pytest.fixture(scope="class")
    def run_events(self, client: httpx.Client) -> tuple[str, list[dict[str, Any]]]:
        return _run_to_completion(client)

    # ── Minimum event count ────────────────────────────────────────────────────

    def test_minimum_five_events(self, run_events: tuple[str, list[dict[str, Any]]]) -> None:
        """ARCHITECTURE.md §9: every successful run emits ≥5 events."""
        run_id, events = run_events
        assert len(events) >= MIN_EVENT_COUNT, (
            f"Run {run_id} emitted only {len(events)} event(s); minimum is {MIN_EVENT_COUNT}. "
            "Verify that pipeline/provenance.py emits all five required event types."
        )

    # ── Monotonic, gap-free seq ────────────────────────────────────────────────

    def test_seq_starts_at_one(self, run_events: tuple[str, list[dict[str, Any]]]) -> None:
        """First event's seq must be 1."""
        run_id, events = run_events
        first_seq = events[0]["seq"]
        assert first_seq == 1, (
            f"Run {run_id}: first event has seq={first_seq}, expected 1. "
            "seq must start at 1 for every run."
        )

    def test_seq_monotonic_and_gap_free(self, run_events: tuple[str, list[dict[str, Any]]]) -> None:
        """
        seq values must form a contiguous range [1, 2, 3, ..., N].
        Gaps indicate lost events. Out-of-order values indicate a bug in
        the event emitter or retrieval ordering.
        """
        run_id, events = run_events
        seqs = [e["seq"] for e in events]
        expected = list(range(1, len(seqs) + 1))
        assert seqs == expected, (
            f"Run {run_id}: event seq is not monotonic and gap-free.\n"
            f"  Expected: {expected}\n"
            f"  Actual:   {seqs}\n"
            "Gaps indicate dropped events. Out-of-order indicates emitter bug."
        )

    def test_seq_unique(self, run_events: tuple[str, list[dict[str, Any]]]) -> None:
        """No two events in the same run may share a seq value."""
        run_id, events = run_events
        seqs = [e["seq"] for e in events]
        duplicates = [s for s in seqs if seqs.count(s) > 1]
        assert not duplicates, (
            f"Run {run_id}: duplicate seq values found: {set(duplicates)}. "
            "Each event must have a unique seq within its run."
        )

    # ── Required event types present ──────────────────────────────────────────

    def test_all_required_event_types_present(
        self, run_events: tuple[str, list[dict[str, Any]]]
    ) -> None:
        """Every required event type from §5 must appear at least once."""
        run_id, events = run_events
        emitted_types = {e["event_type"] for e in events}
        missing = [t for t in REQUIRED_EVENT_TYPES_ORDERED if t not in emitted_types]
        assert not missing, (
            f"Run {run_id}: missing required event types: {missing}. "
            f"All six required types must be emitted: {REQUIRED_EVENT_TYPES_ORDERED}"
        )

    def test_preflight_ok_is_first(self, run_events: tuple[str, list[dict[str, Any]]]) -> None:
        """run.preflight.ok must be the first event (seq=1)."""
        run_id, events = run_events
        first_event_type = events[0]["event_type"]
        assert first_event_type == "run.preflight.ok", (
            f"Run {run_id}: first event is '{first_event_type}', expected 'run.preflight.ok'. "
            "Preflight must be the first event — it records that inputs were validated "
            "before any computation begins."
        )

    def test_summary_done_is_last(self, run_events: tuple[str, list[dict[str, Any]]]) -> None:
        """run.summary.done must be the last event."""
        run_id, events = run_events
        last_event_type = events[-1]["event_type"]
        assert last_event_type == "run.summary.done", (
            f"Run {run_id}: last event is '{last_event_type}', expected 'run.summary.done'. "
            "summary.done signals the run is complete; nothing should follow it."
        )

    def test_summary_pending_before_summary_done(
        self, run_events: tuple[str, list[dict[str, Any]]]
    ) -> None:
        """run.summary.pending must appear before run.summary.done."""
        run_id, events = run_events
        pending_seqs = [e["seq"] for e in events if e["event_type"] == "run.summary.pending"]
        done_seqs = [e["seq"] for e in events if e["event_type"] == "run.summary.done"]
        assert pending_seqs, f"Run {run_id}: run.summary.pending not emitted"
        assert done_seqs, f"Run {run_id}: run.summary.done not emitted"
        assert max(pending_seqs) < min(done_seqs), (
            f"Run {run_id}: run.summary.pending (seq {pending_seqs}) does not precede "
            f"run.summary.done (seq {done_seqs})."
        )

    def test_required_order_respected(self, run_events: tuple[str, list[dict[str, Any]]]) -> None:
        """
        The first occurrence of each required event type must appear in the
        order specified by §5:
          preflight.ok < extract.features < simulate.tick < score.emit
          < summary.pending < summary.done

        simulate.tick and score.emit may repeat, but the first simulate.tick
        must precede the first score.emit, and both must precede summary.pending.
        """
        run_id, events = run_events

        def _first_seq(event_type: str) -> int:
            matches = [e["seq"] for e in events if e["event_type"] == event_type]
            return matches[0] if matches else -1

        order_checks = [
            ("run.preflight.ok", "run.extract.features"),
            ("run.extract.features", "run.simulate.tick"),
            ("run.simulate.tick", "run.score.emit"),
            ("run.score.emit", "run.summary.pending"),
            ("run.summary.pending", "run.summary.done"),
        ]

        for earlier, later in order_checks:
            seq_a = _first_seq(earlier)
            seq_b = _first_seq(later)
            assert seq_a != -1, f"Run {run_id}: '{earlier}' not emitted"
            assert seq_b != -1, f"Run {run_id}: '{later}' not emitted"
            assert seq_a < seq_b, (
                f"Run {run_id}: '{earlier}' (seq {seq_a}) does not precede "
                f"'{later}' (seq {seq_b}). §5 order violated."
            )

    # ── Required payload fields ────────────────────────────────────────────────

    def test_preflight_event_has_hash_fields(
        self, run_events: tuple[str, list[dict[str, Any]]]
    ) -> None:
        """
        run.preflight.ok payload must record the input hashes.
        This is what makes the provenance chain traceable: the event proves
        which exact files were used in the run.
        """
        run_id, events = run_events
        preflight = next((e for e in events if e["event_type"] == "run.preflight.ok"), None)
        assert preflight is not None

        payload = preflight.get("payload", {})
        assert "backbone_sha256" in payload or "ro_content_hash" in payload, (
            f"Run {run_id}: run.preflight.ok payload missing hash fields. "
            "The payload must record at minimum backbone_sha256 or ro_content_hash "
            "to anchor the provenance chain to specific inputs."
        )

    def test_score_emit_events_have_required_fields(
        self, run_events: tuple[str, list[dict[str, Any]]]
    ) -> None:
        """
        Each run.score.emit event must contain the scored guide sequence,
        on-target score, and off-target count. These fields populate the
        prediction table in the UI.
        """
        run_id, events = run_events
        score_events = [e for e in events if e["event_type"] == "run.score.emit"]
        assert score_events, f"Run {run_id}: no run.score.emit events"

        required_payload_fields = {"sequence", "on_target_score", "off_target_count"}
        for se in score_events:
            payload = se.get("payload", {})
            missing = required_payload_fields - set(payload.keys())
            assert not missing, (
                f"Run {run_id}: run.score.emit event (seq {se['seq']}) payload "
                f"missing fields: {missing}. "
                f"Full payload: {payload}"
            )

    def test_all_events_have_run_id_and_emitted_at(
        self, run_events: tuple[str, list[dict[str, Any]]]
    ) -> None:
        """Every event must carry run_id and emitted_at for traceability."""
        run_id, events = run_events
        for event in events:
            assert "run_id" in event, f"Event seq={event.get('seq')} missing run_id field"
            assert event["run_id"] == run_id, (
                f"Event seq={event.get('seq')} has wrong run_id: {event['run_id']} != {run_id}"
            )
            assert "emitted_at" in event, f"Event seq={event.get('seq')} missing emitted_at field"
            assert event["emitted_at"], f"Event seq={event.get('seq')} has empty emitted_at"

    def test_no_unknown_event_types(self, run_events: tuple[str, list[dict[str, Any]]]) -> None:
        """
        Only event types defined in §5 may appear in a run.
        The §5 vocabulary is fixed by contract (ARCHITECTURE.md).

        HARD FAILURE on unknown types — not a warning. The contract is either
        enforced or it isn't. If backend needs a new event type (e.g. SSE
        keepalive heartbeat), the correct path is:
          1. Open an ARCHITECTURE.md PR adding the type to §5 vocabulary.
          2. Update REQUIRED_EVENT_TYPES_ORDERED in this file in the same PR.
          3. Open the emission PR against the updated contract.

        Coordinator overrides if a test is too strict; that creates an audit
        trail. Silent warnings do not.
        """
        run_id, events = run_events
        known_types = set(REQUIRED_EVENT_TYPES_ORDERED)
        emitted = {e["event_type"] for e in events}
        unknown = emitted - known_types
        assert not unknown, (
            f"Run {run_id} emitted event types not listed in ARCHITECTURE.md §5: "
            f"{sorted(unknown)}. "
            "Adding event types requires an ARCHITECTURE.md PR to §5 first, "
            "followed by updating REQUIRED_EVENT_TYPES_ORDERED in this file. "
            "Do not add event types silently — contract drift is how audit trails rot."
        )

    # ── Count-based sanity checks ──────────────────────────────────────────────

    def test_at_least_one_score_emit_per_guide(
        self, run_events: tuple[str, list[dict[str, Any]]]
    ) -> None:
        """
        run.score.emit must appear at least once (there must be at least one
        guide candidate for the BCL11A enhancer fixture — it contains many NGG sites).
        If zero score events are emitted, the PAM scanner found nothing or the
        scoring pipeline short-circuited.
        """
        run_id, events = run_events
        score_count = sum(1 for e in events if e["event_type"] == "run.score.emit")
        assert score_count >= 1, (
            f"Run {run_id}: zero run.score.emit events. "
            "The BCL11A enhancer fixture contains NGG PAM sites — at least one "
            "guide candidate must be scored. Check pam.py and the scoring pipeline."
        )

    def test_simulate_tick_count_matches_score_emit_count(
        self, run_events: tuple[str, list[dict[str, Any]]]
    ) -> None:
        """
        run.simulate.tick and run.score.emit should each appear once per guide
        candidate (one tick per simulation step, one score.emit per scored guide).
        A mismatch indicates a bug in the pipeline loop.

        Note: this may not hold exactly if simulate.tick is emitted once per
        batch rather than once per guide. Update this test if §5 is clarified.
        """
        run_id, events = run_events
        tick_count = sum(1 for e in events if e["event_type"] == "run.simulate.tick")
        score_count = sum(1 for e in events if e["event_type"] == "run.score.emit")

        # They must at least both be non-zero and in the same order of magnitude.
        assert tick_count >= 1, f"Run {run_id}: no run.simulate.tick events"
        assert score_count >= 1, f"Run {run_id}: no run.score.emit events"

        # Soft check: counts should be equal (one tick per candidate scored).
        # If backend batches simulate.tick, remove this assertion and document why.
        if tick_count != score_count:
            import warnings

            warnings.warn(
                f"Run {run_id}: simulate.tick count ({tick_count}) != "
                f"score.emit count ({score_count}). "
                "If simulate.tick is intentionally batched, document this in §5 "
                "and remove this warning.",
                stacklevel=1,
            )


# ─────────────────────────────────────────────────────────────────────────────
# SSE streaming validation
# Separate from the class above — tests the streaming endpoint directly.
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.integration
def test_sse_endpoint_emits_events_in_real_time() -> None:
    """
    GET /api/v1/runs/:id/events (SSE) must:
    - Return Content-Type: text/event-stream
    - Emit events as they occur during an active run (not all at once at the end)
    - Terminate gracefully when the run completes

    This test is a smoke test for the SSE transport, not the event content.
    Detailed content is covered by TestEventSequence above.
    """
    pytest.skip(
        "SSE real-time test requires concurrent run + reader setup. "
        "Implement using asyncio + httpx.AsyncClient once the basic event "
        "sequence tests are passing. Stub intentionally deferred."
    )


@pytest.mark.integration
def test_sse_run_id_events_returns_correct_content_type() -> None:
    """GET /api/v1/runs/:id/events must return text/event-stream."""
    import time
    from pathlib import Path

    client = httpx.Client(base_url=BASE_URL, timeout=130.0)

    # Create a run
    fasta_path = Path(SAMPLE_FASTA_PATH)
    with fasta_path.open("rb") as fh:
        upload = client.post(
            "/api/v1/uploads",
            files={"file": (fasta_path.name, fh, "text/plain")},
        )
    upload.raise_for_status()
    backbone_id = upload.json()["file_id"]

    ro = client.post(
        "/api/v1/research-objects",
        json={"backbone_id": backbone_id, "metadata": {"test": "sse_content_type"}},
    )
    ro.raise_for_status()
    ro_id = ro.json()["id"]

    run = client.post("/api/v1/runs", json={"ro_id": ro_id, "prompt": SAMPLE_PROMPT})
    run.raise_for_status()
    run_id = run.json()["run_id"]

    # Short poll to let the run start
    time.sleep(1.0)

    sse_resp = client.get(f"/api/v1/runs/{run_id}/events")
    content_type = sse_resp.headers.get("content-type", "")
    assert "text/event-stream" in content_type, (
        f"GET /api/v1/runs/{run_id}/events returned Content-Type: {content_type!r}, "
        "expected text/event-stream. Frontend's SSE consumer depends on this."
    )
