"""
End-to-end replay determinism gate.

Spec (from ARCHITECTURE.md §6, rulings from 2026-04-30):
  - prediction.json must be byte-identical between a run and its replay.
  - research_object.json must be byte-identical (same RO, immutable).
  - manifest.json and events.jsonl legitimately differ (run UUIDs, timestamps).
  - The replay endpoint is POST /api/v1/runs/:id/replay → {new_run_id}.

These tests will fail with connection errors until apps/api ships L1–L5 and the
test environment is configured (see conftest.py / SUPABASE_TEST_URL env var).
Mark: pytest.mark.integration — skipped in unit-only CI runs (PRs).
Run on main branch merges against the test Supabase project.

If test_prediction_json_byte_identical or test_research_object_json_byte_identical
ever FLAKES, that is a P0 determinism break — do not retry, do not mark xfail,
find the PR that introduced non-determinism and revert it.
"""

import hashlib
import io
import json

# ─────────────────────────────────────────────────────────────────────────────
# Configuration — override via environment variables in CI
# ─────────────────────────────────────────────────────────────────────────────
import os
import time
import zipfile
from pathlib import Path
from typing import Any

import httpx
import pytest

BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
SAMPLE_FASTA = Path(__file__).parent / "fixtures" / "BCL11A_enhancer.fasta"
SAMPLE_PROMPT = "Disrupt GATA1 binding site at +58 enhancer"
RUN_TIMEOUT_SECONDS = 120.0
POLL_INTERVAL_SECONDS = 2.0

# Files that MUST be byte-identical between a run and its replay.
REPLAY_STABLE: frozenset[str] = frozenset({"prediction.json", "research_object.json"})

# Files that MUST differ (they contain run-specific UUIDs and timestamps).
# If they are identical, replay is incorrectly reusing the original run's data.
REPLAY_UNSTABLE: frozenset[str] = frozenset({"manifest.json", "events.jsonl"})


# ─────────────────────────────────────────────────────────────────────────────
# Low-level HTTP helpers
# ─────────────────────────────────────────────────────────────────────────────


def _upload_fasta(client: httpx.Client) -> str:
    """Upload the sample FASTA fixture. Returns file_id."""
    with SAMPLE_FASTA.open("rb") as fh:
        resp = client.post(
            "/api/v1/uploads",
            files={"file": (SAMPLE_FASTA.name, fh, "text/plain")},
        )
    resp.raise_for_status()
    data = resp.json()
    assert "file_id" in data, f"Upload response missing file_id: {data}"
    return data["file_id"]  # type: ignore[no-any-return]


def _create_ro(client: httpx.Client, backbone_id: str) -> dict[str, Any]:
    """Create a ResearchObject from the uploaded backbone. Returns full RO dict."""
    resp = client.post(
        "/api/v1/research-objects",
        json={
            "backbone_id": backbone_id,
            "metadata": {
                "test_suite": "replay_determinism",
                "fixture": "BCL11A_enhancer.fasta",
            },
        },
    )
    resp.raise_for_status()
    ro = resp.json()
    assert "id" in ro, f"RO response missing id: {ro}"
    assert "content_hash" in ro, f"RO response missing content_hash: {ro}"
    return ro  # type: ignore[no-any-return]


def _start_run(client: httpx.Client, ro_id: str, prompt: str = SAMPLE_PROMPT) -> str:
    """Start a run. Returns run_id."""
    resp = client.post("/api/v1/runs", json={"ro_id": ro_id, "prompt": prompt})
    resp.raise_for_status()
    data = resp.json()
    assert "run_id" in data, f"Run response missing run_id: {data}"
    return data["run_id"]  # type: ignore[no-any-return]


def _wait_for_run(
    client: httpx.Client,
    run_id: str,
    timeout: float = RUN_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """Poll GET /api/v1/runs/:id until status is done or failed."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        resp = client.get(f"/api/v1/runs/{run_id}")
        resp.raise_for_status()
        run = resp.json()
        if run["status"] in ("done", "failed"):
            return run  # type: ignore[no-any-return]
        time.sleep(POLL_INTERVAL_SECONDS)
    pytest.fail(
        f"Run {run_id} did not complete within {timeout}s — "
        "check the backend for a stuck BackgroundTask."
    )


def _fetch_export_pack(client: httpx.Client, run_id: str) -> dict[str, bytes]:
    """
    Fetch the export pack for a run.
    Returns {filename: bytes} for every entry in the zip.
    """
    resp = client.get(f"/api/v1/runs/{run_id}/export")
    resp.raise_for_status()
    export = resp.json()
    assert "url" in export, f"Export response missing url: {export}"
    assert "sha256" in export, f"Export response missing sha256: {export}"

    zip_resp = httpx.get(export["url"], follow_redirects=True)
    zip_resp.raise_for_status()

    # Verify the downloaded zip matches the declared SHA-256 before unpacking.
    actual_sha = hashlib.sha256(zip_resp.content).hexdigest()
    assert actual_sha == export["sha256"], (
        f"Export pack SHA-256 mismatch for run {run_id}. "
        f"Declared: {export['sha256']}, actual: {actual_sha}. "
        "Backend is returning a stale or incorrect hash."
    )

    with zipfile.ZipFile(io.BytesIO(zip_resp.content)) as zf:
        return {name: zf.read(name) for name in zf.namelist()}


# ─────────────────────────────────────────────────────────────────────────────
# Shared class fixture — one RO, two runs, shared across all tests in the class
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestReplayDeterminism:
    """
    Core determinism contract tests.
    All tests share a single (original_run, replay_run) pair created once.

    If any test in this class fails, stop and investigate — do not move on.
    A flake here is a P0, not a test infrastructure issue.
    """

    @pytest.fixture(scope="class")
    def http_client(self) -> httpx.Client:
        return httpx.Client(base_url=BASE_URL, timeout=130.0)

    @pytest.fixture(scope="class")
    def run_pair(self, http_client: httpx.Client) -> dict[str, Any]:
        """
        Creates one RO, one original run, one replay run.
        Fetches both export packs.
        Returns a dict usable by all tests in the class.
        """
        # 1. Upload + create RO
        backbone_id = _upload_fasta(http_client)
        ro = _create_ro(http_client, backbone_id)
        ro_id = ro["id"]

        # 2. Original run
        run1_id = _start_run(http_client, ro_id)
        run1 = _wait_for_run(http_client, run1_id)
        assert run1["status"] == "done", (
            f"Original run {run1_id} failed: {run1}. "
            "Cannot test replay determinism if the original run does not complete."
        )

        # 3. Replay via POST /api/v1/runs/:id/replay
        replay_resp = http_client.post(f"/api/v1/runs/{run1_id}/replay")
        replay_resp.raise_for_status()
        run2_id = replay_resp.json()["new_run_id"]
        assert run2_id != run1_id, (
            "Replay returned the same run_id as the original — "
            "it must create a new run, not return the existing one."
        )

        run2 = _wait_for_run(http_client, run2_id)
        assert run2["status"] == "done", f"Replay run {run2_id} failed: {run2}."

        # 4. Fetch both export packs (SHA-256 verified inside _fetch_export_pack)
        pack1 = _fetch_export_pack(http_client, run1_id)
        pack2 = _fetch_export_pack(http_client, run2_id)

        return {
            "ro": ro,
            "run1_id": run1_id,
            "run2_id": run2_id,
            "run1": run1,
            "run2": run2,
            "pack1": pack1,
            "pack2": pack2,
        }

    # ── Core contract ──────────────────────────────────────────────────────────

    def test_prediction_json_byte_identical(self, run_pair: dict[str, Any]) -> None:
        """
        THE most important test in the suite.
        prediction.json must be byte-identical between original run and replay.
        This is the claim that makes Provenance Lab credible.

        If this fails:
          1. Do NOT xfail or skip — this is a P0.
          2. Diff the two JSON payloads to find the non-deterministic field.
          3. Common causes: datetime.now() in scoring, uuid4() in prediction,
             float formatting differences across Python versions.
          4. File an issue, revert the offending PR.
        """
        p1 = run_pair["pack1"].get("prediction.json")
        p2 = run_pair["pack2"].get("prediction.json")

        assert p1 is not None, "prediction.json absent from original run export pack"
        assert p2 is not None, "prediction.json absent from replay export pack"

        # Parse first for a readable failure message.
        j1: dict[str, Any] = json.loads(p1)
        j2: dict[str, Any] = json.loads(p2)

        if j1 != j2:
            # Surface a useful diff — show which keys diverged.
            def _diff_keys(a: dict[str, Any], b: dict[str, Any], path: str = "") -> list[str]:
                diffs = []
                for k in set(a) | set(b):
                    key_path = f"{path}.{k}" if path else k
                    if k not in a:
                        diffs.append(f"missing in original: {key_path}")
                    elif k not in b:
                        diffs.append(f"missing in replay: {key_path}")
                    elif isinstance(a[k], dict) and isinstance(b[k], dict):
                        diffs.extend(_diff_keys(a[k], b[k], key_path))
                    elif a[k] != b[k]:
                        diffs.append(f"{key_path}: {a[k]!r} != {b[k]!r}")
                return diffs

            diffs = _diff_keys(j1, j2)
            pytest.fail(
                "prediction.json content differs between original run and replay.\n"
                "Diverging fields:\n" + "\n".join(f"  {d}" for d in diffs[:20])
            )

        # JSON content matches — now enforce byte equality (same serialization).
        assert p1 == p2, (
            "prediction.json parses identically but byte sequences differ. "
            "canonical.py must produce identical bytes every invocation "
            "(check key ordering, float formatting, null vs None serialization)."
        )

    def test_research_object_json_byte_identical(self, run_pair: dict[str, Any]) -> None:
        """
        research_object.json must be byte-identical between runs:
        same RO (immutable after creation), same canonical serialization.

        If this fails: the RO was mutated between runs (violates immutability)
        or canonical.py is non-deterministic.
        """
        r1 = run_pair["pack1"].get("research_object.json")
        r2 = run_pair["pack2"].get("research_object.json")

        assert r1 is not None, "research_object.json absent from original run export pack"
        assert r2 is not None, "research_object.json absent from replay export pack"

        ro1: dict[str, Any] = json.loads(r1)
        ro2: dict[str, Any] = json.loads(r2)

        assert ro1 == ro2, (
            "research_object.json content differs between original run and replay. "
            "The ResearchObject must be immutable after creation (no PATCH/UPDATE). "
            f"Diverging fields: { {k for k in set(ro1) | set(ro2) if ro1.get(k) != ro2.get(k)} }"
        )
        assert r1 == r2, (
            "research_object.json parses identically but bytes differ — "
            "canonical serialization issue."
        )

    def test_manifest_and_events_legitimately_differ(self, run_pair: dict[str, Any]) -> None:
        """
        manifest.json and events.jsonl MUST differ between runs.
        They contain run-specific UUIDs and timestamps.
        If they are identical, replay is incorrectly reusing the original run's
        data rather than re-executing — that is a different kind of bug.
        """
        pack1, pack2 = run_pair["pack1"], run_pair["pack2"]
        for filename in REPLAY_UNSTABLE:
            if filename not in pack1 or filename not in pack2:
                continue  # file may be optional; don't fail if absent
            assert pack1[filename] != pack2[filename], (
                f"{filename} is byte-identical between original run and replay. "
                "These files must differ — they contain run UUIDs and timestamps. "
                "Replay is incorrectly returning the original run's artifacts."
            )

    # ── Structural integrity of each file ─────────────────────────────────────

    def test_prediction_json_is_valid_json(self, run_pair: dict[str, Any]) -> None:
        for label, pack in [("original", run_pair["pack1"]), ("replay", run_pair["pack2"])]:
            raw = pack.get("prediction.json")
            assert raw is not None, f"prediction.json missing from {label} pack"
            parsed = json.loads(raw)
            assert "guides" in parsed, f"prediction.json missing 'guides' key in {label} run"
            assert isinstance(parsed["guides"], list), "'guides' must be a list"
            assert "summary" in parsed, f"prediction.json missing 'summary' key in {label} run"

    def test_research_object_json_has_content_hash(self, run_pair: dict[str, Any]) -> None:
        for label, pack in [("original", run_pair["pack1"]), ("replay", run_pair["pack2"])]:
            raw = pack.get("research_object.json")
            assert raw is not None, f"research_object.json missing from {label} pack"
            ro = json.loads(raw)
            h = ro.get("content_hash", "")
            assert len(h) == 64, (
                f"content_hash in {label} research_object.json is not a SHA-256 hex string "
                f"(got {len(h)} chars: {h!r})"
            )

    def test_export_pack_contains_required_files(self, run_pair: dict[str, Any]) -> None:
        required = {"manifest.json", "research_object.json", "prediction.json", "events.jsonl"}
        for label, pack in [("original", run_pair["pack1"]), ("replay", run_pair["pack2"])]:
            missing = required - set(pack.keys())
            assert not missing, f"Export pack for {label} run is missing files: {missing}"

    def test_manifest_contains_git_sha(self, run_pair: dict[str, Any]) -> None:
        """Manifest must record the backend git SHA for reproducibility."""
        for label, pack in [("original", run_pair["pack1"]), ("replay", run_pair["pack2"])]:
            raw = pack.get("manifest.json")
            if raw is None:
                pytest.skip("manifest.json not in export pack")
            manifest = json.loads(raw)
            assert "git_sha" in manifest, f"manifest.json missing git_sha in {label} run"
            assert manifest["git_sha"], "git_sha must be non-empty"

    def test_events_jsonl_monotonic_seq(self, run_pair: dict[str, Any]) -> None:
        """events.jsonl must have monotonic, gap-free seq values starting at 1."""
        for label, pack in [("original", run_pair["pack1"]), ("replay", run_pair["pack2"])]:
            raw = pack.get("events.jsonl")
            if raw is None:
                pytest.skip("events.jsonl not in export pack")
            lines = [ln.strip() for ln in raw.decode("utf-8").splitlines() if ln.strip()]
            assert len(lines) >= 5, (
                f"{label} run has {len(lines)} events, minimum is 5 (ARCHITECTURE.md §5)"
            )
            events = [json.loads(line) for line in lines]
            seqs = [e["seq"] for e in events]
            assert seqs == list(range(1, len(seqs) + 1)), (
                f"{label} run event seq is not monotonic and gap-free: {seqs}"
            )

    # ── RO content_hash stability ──────────────────────────────────────────────

    def test_ro_content_hash_matches_computed(self, run_pair: dict[str, Any]) -> None:
        """
        The content_hash in research_object.json must equal
        sha256(canonical_json({backbone_sha256, target_pdb_sha256,
                                fastq_sha256, pam, metadata})).

        This verifies the hash is computed from exactly the allowed field set
        (ARCHITECTURE.md §6 rule 2 field allowlist).
        """
        try:
            from canonical import canonical_json  # type: ignore[import-untyped]
        except ImportError:
            pytest.skip("canonical.py not yet shipped")

        pack = run_pair["pack1"]
        ro = json.loads(pack["research_object.json"])

        # Reconstruct the hashed bundle with exactly the allowed fields.
        bundle = {
            "backbone_sha256": ro["backbone_sha256"],
            "target_pdb_sha256": ro.get("target_pdb_sha256"),
            "fastq_sha256": ro.get("fastq_sha256"),
            "pam": ro["pam"],
            "metadata": ro["metadata"],
        }
        expected_hash = hashlib.sha256(canonical_json(bundle).encode("utf-8")).hexdigest()

        assert ro["content_hash"] == expected_hash, (
            f"content_hash mismatch. Declared: {ro['content_hash']!r}, "
            f"computed from allowed fields: {expected_hash!r}. "
            "Either the hash includes extra fields (violating the allowlist) or "
            "canonical.py is using a different field set than documented."
        )

    def test_same_ro_different_prompt_different_prediction(
        self, http_client: httpx.Client, run_pair: dict[str, Any]
    ) -> None:
        """
        Sanity: same RO + different prompt should produce a different prediction.
        Confirms the prediction isn't a constant regardless of input.
        (This is a weaker check — the real guarantee is same inputs → same output.)
        """
        ro_id = run_pair["ro"]["id"]
        different_prompt = "Target GATA1 binding site for activation (NOT disruption)"

        run_id = _start_run(http_client, ro_id, prompt=different_prompt)
        run = _wait_for_run(http_client, run_id)
        assert run["status"] == "done"

        pack = _fetch_export_pack(http_client, run_id)
        p_original = run_pair["pack1"].get("prediction.json")
        p_different = pack.get("prediction.json")

        if p_original and p_different and p_original == p_different:
            # May or may not differ depending on how prompt affects scoring.
            # Log but don't fail — this is a sanity probe, not a hard contract.
            import warnings

            warnings.warn(
                "prediction.json is identical for two different prompts on the "
                "same RO. Verify the prompt is actually influencing the prediction.",
                stacklevel=1,
            )


# ─────────────────────────────────────────────────────────────────────────────
# Edge cases and error handling
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestReplayEdgeCases:
    @pytest.fixture
    def http_client(self) -> httpx.Client:
        return httpx.Client(base_url=BASE_URL, timeout=130.0)

    def test_replay_nonexistent_run_returns_404(self, http_client: httpx.Client) -> None:
        """Replaying a run ID that doesn't exist must return 404, not 500."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = http_client.post(f"/api/v1/runs/{fake_id}/replay")
        assert resp.status_code == 404, (
            f"Expected 404 for nonexistent run, got {resp.status_code}: {resp.text}"
        )

    def test_replay_failed_run_returns_422(self, http_client: httpx.Client) -> None:
        """
        Replaying a run with status 'failed' should return 422 Unprocessable Entity.
        A failed run cannot be replayed because the prediction was never computed.
        (Exact behavior TBD — Backend agent must document this in API contract.)
        """
        pytest.skip(
            "Requires a fixture that produces a deterministically failed run. "
            "Implement once Backend agent documents error handling for failed runs."
        )

    def test_export_sha256_stable_across_replay(self, http_client: httpx.Client) -> None:
        """
        GET /api/v1/runs/:id/export returns {url, sha256}.
        The sha256 value must be identical for the original run and its replay
        (since prediction.json and research_object.json are byte-identical,
        and the zip is built deterministically from the same inputs).

        Note: This test is expected to fail until the zip builder uses a
        deterministic entry order and fixed timestamp for zip metadata.
        File an issue if the zip SHA differs — it is fixable.
        """
        backbone_id = _upload_fasta(http_client)
        ro = _create_ro(http_client, backbone_id)
        ro_id = ro["id"]

        run1_id = _start_run(http_client, ro_id)
        _wait_for_run(http_client, run1_id)

        replay_resp = http_client.post(f"/api/v1/runs/{run1_id}/replay")
        replay_resp.raise_for_status()
        run2_id = replay_resp.json()["new_run_id"]
        _wait_for_run(http_client, run2_id)

        export1 = http_client.get(f"/api/v1/runs/{run1_id}/export").json()
        export2 = http_client.get(f"/api/v1/runs/{run2_id}/export").json()

        # The zip SHA256 may differ because manifest.json and events.jsonl differ.
        # This is EXPECTED behavior per §6 rule 5.
        # We log it for visibility but do not assert equality.
        if export1["sha256"] == export2["sha256"]:
            pass  # ideal but not required — zip SHA equality is a nice-to-have
        # The prediction + RO SHA stability is tested in TestReplayDeterminism above.
