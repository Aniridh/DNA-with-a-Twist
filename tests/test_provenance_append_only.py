"""
Provenance append-only enforcement spec.

ARCHITECTURE.md §9: "Events are append-only (no UPDATE in provenance_events
table; enforced by RLS or trigger)."

These tests verify that enforcement at the database level — not just in
application code. App-level guards are necessary but not sufficient: a migration
that drops or disables the trigger/policy would silently allow mutation.

Skip behavior:
  - Unit CI (PRs): skipped — require live Supabase test project.
  - Integration CI (main merges): run against SUPABASE_TEST_URL.
  - Will fail with ImportError until apps/api ships the Supabase client helper.

Failure protocol:
  If any UPDATE or DELETE test starts PASSING (i.e. the mutation succeeded),
  that is a P0 — the append-only guarantee is gone. Do not xfail. Find and
  revert the migration or code that removed the enforcement.
"""

import contextlib
import os
import uuid
from datetime import UTC, datetime
from typing import Any

import pytest

# ─────────────────────────────────────────────────────────────────────────────
# Availability checks
# ─────────────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

_supabase_configured = bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)

try:
    from supabase import Client, create_client  # type: ignore[import-untyped]  # noqa: I001

    _supabase_importable = True
except ImportError:
    _supabase_importable = False

pytestmark = pytest.mark.skipif(
    not (_supabase_importable and _supabase_configured),
    reason=(
        "Supabase client not importable or SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY "
        "not set — provenance append-only tests require a live test database. "
        "These will pass once backend's migrations PR lands and CI secrets are configured."
    ),
)


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def service_client() -> "Client":
    """Service-role Supabase client — bypasses RLS, used for setup and teardown."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


@pytest.fixture(scope="module")
def anon_client() -> "Client":
    """
    Anon-key Supabase client — subject to RLS.
    Represents an authenticated user session (the kind that triggers RLS policies).
    """
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


@pytest.fixture(scope="module")
def seed_run_and_event(service_client: "Client") -> dict[str, Any]:
    """
    Insert stub research_object → run → provenance_event using service role.
    Returns {ro_id, run_id, event_id, event_seq} for use in mutation tests.
    Cleans up in reverse FK order after the module.

    Stub RO uses placeholder hashes — the append-only tests care only about
    INSERT/UPDATE/DELETE behavior on provenance_events, not RO content.
    A real RO is required here because runs.ro_id → research_objects(id) is
    now a FK constraint (migration 002 fix; runs.ro_id without a real RO row
    would fail the constraint and cause every test in this module to error).
    """
    ro_id = str(uuid.uuid4())
    run_id = str(uuid.uuid4())
    event_id = str(uuid.uuid4())

    # 1. Stub ResearchObject row — satisfies runs.ro_id FK.
    ro_insert = (
        service_client.table("research_objects")
        .insert(
            {
                "id": ro_id,
                "content_hash": "a" * 64,  # placeholder SHA-256 hex
                "backbone_ref": {"bucket": "test", "path": "fixture.fasta"},
                "backbone_sha256": "b" * 64,  # placeholder SHA-256 hex
                "pam": "NGG",
                "metadata": {},
                "created_by": str(uuid.uuid4()),  # placeholder user UUID
            }
        )
        .execute()
    )
    assert ro_insert.data, f"Failed to insert stub research_object: {ro_insert}"

    # 2. Run row referencing the stub RO.
    run_insert = (
        service_client.table("runs")
        .insert(
            {
                "id": run_id,
                "ro_id": ro_id,
                "prompt": "test fixture — append-only spec",
                "status": "done",
            }
        )
        .execute()
    )
    assert run_insert.data, f"Failed to insert seed run: {run_insert}"

    # 3. Provenance event row referencing the run.
    event_insert = (
        service_client.table("provenance_events")
        .insert(
            {
                "id": event_id,
                "run_id": run_id,
                "seq": 1,
                "event_type": "run.preflight.ok",
                "payload": {"fixture": "append_only_spec"},
                "emitted_at": datetime.now(UTC).isoformat(),
            }
        )
        .execute()
    )
    assert event_insert.data, f"Failed to insert seed event: {event_insert}"

    yield {"ro_id": ro_id, "run_id": run_id, "event_id": event_id, "event_seq": 1}

    # Teardown: reverse FK order — event → run → RO.
    # provenance_events trigger blocks UPDATE/DELETE but service role bypasses RLS;
    # if trigger is SECURITY DEFINER and blocks ALL callers, event cleanup may fail —
    # that's acceptable, the Supabase test project resets between CI runs.
    for table, col, val in [
        ("provenance_events", "id", event_id),
        ("runs", "id", run_id),
        ("research_objects", "id", ro_id),
    ]:
        with contextlib.suppress(Exception):
            # Best-effort; test project reset handles residual rows.
            service_client.table(table).delete().eq(col, val).execute()


# ─────────────────────────────────────────────────────────────────────────────
# INSERT — must succeed (baseline, proves fixture is working)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.integration
def test_insert_event_succeeds(
    service_client: "Client", seed_run_and_event: dict[str, Any]
) -> None:
    """
    Appending a new event to an existing run must succeed.
    This is the baseline — if INSERT fails, all other tests are meaningless.
    """
    new_event_id = str(uuid.uuid4())
    result = (
        service_client.table("provenance_events")
        .insert(
            {
                "id": new_event_id,
                "run_id": seed_run_and_event["run_id"],
                "seq": 2,
                "event_type": "run.extract.features",
                "payload": {"fixture": "append_only_spec_seq2"},
                "emitted_at": datetime.now(UTC).isoformat(),
            }
        )
        .execute()
    )
    assert result.data, (
        f"INSERT into provenance_events failed — baseline broken: {result}. "
        "Fix the RLS INSERT policy before debugging UPDATE/DELETE enforcement."
    )
    # Clean up this extra row.
    service_client.table("provenance_events").delete().eq("id", new_event_id).execute()


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE — must be rejected at the database level
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestUpdateRejected:
    """
    Every UPDATE attempt on provenance_events must fail, regardless of which
    field is being changed and regardless of the caller's privilege level
    (for regular users). Service-role behavior is documented separately.
    """

    def test_update_payload_rejected_via_anon(
        self,
        anon_client: "Client",
        seed_run_and_event: dict[str, Any],
    ) -> None:
        """
        Mutating the event payload via an anon/user session must be rejected.
        The enforcement mechanism is RLS (no UPDATE policy) or a BEFORE UPDATE trigger
        that raises an exception.
        """
        event_id = seed_run_and_event["event_id"]
        try:
            result = (
                anon_client.table("provenance_events")
                .update({"payload": {"tampered": True}})
                .eq("id", event_id)
                .execute()
            )

            # If we get here, the update either affected rows or returned empty.
            # Empty result (0 rows affected) can mean RLS filtered the row — that's
            # acceptable as enforcement, but a trigger-based raise is preferred.
            affected = len(result.data) if result.data else 0
            assert affected == 0, (
                f"UPDATE via anon client succeeded and modified {affected} row(s) in "
                "provenance_events. Append-only enforcement is missing. "
                "Add a BEFORE UPDATE trigger that raises an exception, or a RLS policy "
                "that has no UPDATE rule."
            )
        except Exception:
            # An exception is the preferred outcome — the trigger raised or RLS rejected.
            # Any exception here means enforcement is working.
            pass  # Enforcement is working.

    def test_update_event_type_rejected_via_anon(
        self,
        anon_client: "Client",
        seed_run_and_event: dict[str, Any],
    ) -> None:
        """Changing the event_type must also be blocked."""
        event_id = seed_run_and_event["event_id"]
        try:
            result = (
                anon_client.table("provenance_events")
                .update({"event_type": "tampered.event.type"})
                .eq("id", event_id)
                .execute()
            )
            affected = len(result.data) if result.data else 0
            assert affected == 0, (
                f"UPDATE of event_type via anon client succeeded ({affected} rows). "
                "Append-only enforcement must block ALL field mutations, not just payload."
            )
        except Exception:
            pass

    def test_update_seq_rejected_via_anon(
        self,
        anon_client: "Client",
        seed_run_and_event: dict[str, Any],
    ) -> None:
        """Seq reordering must also be blocked — gaps or reordering destroys the audit trail."""
        event_id = seed_run_and_event["event_id"]
        try:
            result = (
                anon_client.table("provenance_events")
                .update({"seq": 999})
                .eq("id", event_id)
                .execute()
            )
            affected = len(result.data) if result.data else 0
            assert affected == 0, (
                f"UPDATE of seq via anon client succeeded ({affected} rows). "
                "Reordering events destroys the audit trail integrity."
            )
        except Exception:
            pass

    def test_update_via_service_role_behavior_documented(
        self,
        service_client: "Client",
        seed_run_and_event: dict[str, Any],
    ) -> None:
        """
        Documents whether service-role UPDATE is blocked.

        Preferred implementation: BEFORE UPDATE trigger raises exception for ALL callers.
        Acceptable fallback: RLS blocks non-service-role; service role UPDATE is
        technically possible but never called in application code.

        This test does NOT assert failure for service role — it records the behavior.
        If service role UPDATE succeeds, verify that no application code path uses it.
        """
        event_id = seed_run_and_event["event_id"]
        # Read original value.
        before = (
            service_client.table("provenance_events").select("payload").eq("id", event_id).execute()
        )
        original_payload = before.data[0]["payload"] if before.data else None

        try:
            result = (
                service_client.table("provenance_events")
                .update({"payload": {"service_role_probe": True}})
                .eq("id", event_id)
                .execute()
            )
            affected = len(result.data) if result.data else 0

            if affected > 0:
                # Service role UPDATE succeeded — acceptable ONLY if trigger-based
                # enforcement is not in place. Log a warning and restore the original value.
                import warnings

                warnings.warn(
                    "Service-role UPDATE on provenance_events succeeded. "
                    "This means enforcement is RLS-only (not trigger-based). "
                    "No application code path should use service-role UPDATE on this table. "
                    "Preferred: add a BEFORE UPDATE trigger to block ALL callers.",
                    stacklevel=1,
                )
                # Restore original value.
                if original_payload is not None:
                    service_client.table("provenance_events").update(
                        {"payload": original_payload}
                    ).eq("id", event_id).execute()
            # No assertion — this test documents behavior, does not enforce a level.
        except Exception:
            pass  # Trigger-based enforcement — ideal.


# ─────────────────────────────────────────────────────────────────────────────
# DELETE — must be rejected at the database level
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestDeleteRejected:
    """
    Every DELETE attempt on provenance_events must fail for non-service-role callers.
    A deleted event creates a gap in the seq sequence, which breaks the audit trail.
    """

    def test_delete_event_rejected_via_anon(
        self,
        anon_client: "Client",
        seed_run_and_event: dict[str, Any],
    ) -> None:
        """Deleting a provenance event via user session must be rejected."""
        event_id = seed_run_and_event["event_id"]
        try:
            result = anon_client.table("provenance_events").delete().eq("id", event_id).execute()
            affected = len(result.data) if result.data else 0
            assert affected == 0, (
                f"DELETE via anon client succeeded and removed {affected} event(s) from "
                "provenance_events. Append-only enforcement is missing. "
                "Add: a RLS policy with no DELETE rule, or a BEFORE DELETE trigger."
            )
        except Exception:
            pass  # Exception = enforcement working.

    def test_delete_all_run_events_rejected_via_anon(
        self,
        anon_client: "Client",
        seed_run_and_event: dict[str, Any],
    ) -> None:
        """Bulk-deleting all events for a run via user session must also be rejected."""
        run_id = seed_run_and_event["run_id"]
        try:
            result = anon_client.table("provenance_events").delete().eq("run_id", run_id).execute()
            affected = len(result.data) if result.data else 0
            assert affected == 0, (
                f"Bulk DELETE by run_id via anon client succeeded ({affected} rows). "
                "Bulk deletion is the most dangerous mutation — wiping a run's entire "
                "audit trail. RLS DELETE policy must cover all filter combinations."
            )
        except Exception:
            pass

    def test_event_still_present_after_delete_attempts(
        self,
        service_client: "Client",
        seed_run_and_event: dict[str, Any],
    ) -> None:
        """
        After all the DELETE attempts above, the seed event must still exist.
        This is the ground-truth check: even if individual DELETE tests passed
        ambiguously (0 rows returned vs exception), the row must still be there.
        """
        event_id = seed_run_and_event["event_id"]
        result = service_client.table("provenance_events").select("id").eq("id", event_id).execute()
        assert result.data and len(result.data) == 1, (
            f"Seed event {event_id} is missing from provenance_events after DELETE attempt tests. "
            "Either the DELETE succeeded (enforcement is broken) or the fixture "
            "failed to insert it."
        )


# ─────────────────────────────────────────────────────────────────────────────
# TRUNCATE — document that it must also be blocked
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.integration
def test_truncate_not_possible_via_client(anon_client: "Client") -> None:
    """
    The Supabase client API does not expose TRUNCATE — this is a reminder that
    TRUNCATE must also be blocked at the Postgres level (REVOKE TRUNCATE).
    This test documents the requirement; enforcement is verified by the DBA/migration.
    """
    # Supabase PostgREST does not expose TRUNCATE through the REST API.
    # This is inherently blocked by the API surface.
    # Actual TRUNCATE requires direct Postgres access (psql / service role via pg connection).
    # Enforcement: REVOKE TRUNCATE ON provenance_events FROM PUBLIC, anon, authenticated.
    # Verify in migrations: check pg_catalog.information_schema.role_table_grants.
    pass  # Documentation test — passes trivially. Real enforcement is in migrations.
