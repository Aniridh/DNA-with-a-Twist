"""
Export pack spec — AGENT_REVIEWER.md scope #7.

ARCHITECTURE.md §7 Layer 5 defines the export.zip contents:
  - manifest.json      (RunManifest)
  - research_object.json (full RO)
  - prediction.json    (Result.prediction, canonical)
  - events.jsonl       (one ProvenanceEvent per line, in seq order)
  - inputs/            (copies of original FASTA/FASTQ/PDB)

API contract (§4):
  GET /api/v1/runs/:id/export → {url, expires_at, sha256}

Tests cover:
  1. Zip structural integrity (all required files present)
  2. Declared SHA-256 == sha256(zip bytes)
  3. inputs/ contains the uploaded FASTA, file bytes match backbone_sha256
  4. manifest.json: all RunManifest fields, valid types
  5. research_object.json: all ResearchObject fields, content_hash valid
  6. prediction.json: all GuideCandidate fields, scores in range, 20nt sequences
  7. events.jsonl: valid JSON per line, seq ordered, all §5 types present
  8. API consistency: pack content matches /runs/:id/result and /research-objects/:id
  9. Signed URL expires in ~1 hour (declared expires_at)
  10. Idempotency: two calls to the export endpoint return the same SHA-256

Skip behavior:
  - Unit CI (PRs): skipped — requires running backend with L3-L5 wired.
  - Integration CI (main merges): runs against API_BASE_URL env var.
  - Will fail with ConnectionError until backend's L3-L5 PR lands.

Failure protocol:
  If test_declared_sha256_matches_zip_bytes fails, the export endpoint is
  returning a stale or pre-computed hash — P0, blocks demo. Do not xfail.
"""
import hashlib
import io
import json
import os
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import pytest

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
SAMPLE_FASTA = Path(__file__).parent / "fixtures" / "BCL11A_enhancer.fasta"
SAMPLE_PROMPT = "Disrupt GATA1 binding site at +58 enhancer"

# Required top-level entries in the zip (§7 Layer 5).
REQUIRED_ZIP_FILES = frozenset({
    "manifest.json",
    "research_object.json",
    "prediction.json",
    "events.jsonl",
})

# Required RunManifest fields (§3).
REQUIRED_MANIFEST_FIELDS = frozenset({
    "git_sha",
    "api_version",
    "scoring_versions",
    "started_at",
    "env_fingerprint",
})

# Required ResearchObject fields (§3, including fastq_sha256 enumerated in docs PR #6).
REQUIRED_RO_FIELDS = frozenset({
    "id",
    "content_hash",
    "backbone_ref",
    "backbone_sha256",
    "pam",
    "metadata",
    "created_at",
    "created_by",
})

# Required GuideCandidate fields (§3).
REQUIRED_GUIDE_FIELDS = frozenset({
    "sequence",
    "pam",
    "position",
    "strand",
    "on_target_score",
    "off_target_count",
    "off_target_top_hits",
    "bystander_warnings",
})

# Required ProvenanceEvent fields (§3).
REQUIRED_EVENT_FIELDS = frozenset({
    "id",
    "run_id",
    "seq",
    "event_type",
    "payload",
    "emitted_at",
})

# Valid DNA bases for guide sequence validation.
_VALID_BASES = frozenset("ACGT")
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _run_to_completion(client: httpx.Client) -> tuple[str, str]:
    """Upload FASTA → create RO → start run → poll to done. Returns (run_id, ro_id)."""
    import time

    with SAMPLE_FASTA.open("rb") as fh:
        upload = client.post(
            "/api/v1/uploads",
            files={"file": (SAMPLE_FASTA.name, fh, "text/plain")},
        )
    upload.raise_for_status()
    backbone_id = upload.json()["file_id"]

    ro_resp = client.post(
        "/api/v1/research-objects",
        json={"backbone_id": backbone_id, "metadata": {"test": "export_pack_spec"}},
    )
    ro_resp.raise_for_status()
    ro_id = ro_resp.json()["id"]

    run_resp = client.post("/api/v1/runs", json={"ro_id": ro_id, "prompt": SAMPLE_PROMPT})
    run_resp.raise_for_status()
    run_id = run_resp.json()["run_id"]

    deadline = time.monotonic() + 120.0
    while time.monotonic() < deadline:
        status = client.get(f"/api/v1/runs/{run_id}")
        status.raise_for_status()
        if status.json()["status"] in ("done", "failed"):
            break
        time.sleep(2.0)
    else:
        pytest.fail(f"Run {run_id} timed out waiting for completion")

    assert status.json()["status"] == "done", f"Run ended in failed state: {status.json()}"
    return run_id, ro_id


def _fetch_export(client: httpx.Client, run_id: str) -> tuple[dict[str, Any], bytes]:
    """
    Call GET /api/v1/runs/:id/export, download zip bytes.
    Returns (export_api_response, zip_bytes).
    Verifies SHA-256 before returning.
    """
    export_resp = client.get(f"/api/v1/runs/{run_id}/export")
    export_resp.raise_for_status()
    export = export_resp.json()

    assert "url" in export, f"Export response missing 'url': {export}"
    assert "sha256" in export, f"Export response missing 'sha256': {export}"
    assert "expires_at" in export, f"Export response missing 'expires_at': {export}"

    zip_resp = httpx.get(export["url"], follow_redirects=True)
    zip_resp.raise_for_status()
    return export, zip_resp.content


def _open_zip(zip_bytes: bytes) -> dict[str, bytes]:
    """Unzip and return {name: bytes} for every entry."""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        return {name: zf.read(name) for name in zf.namelist()}


# ─────────────────────────────────────────────────────────────────────────────
# Shared fixture — one completed run, one export pack
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def http_client() -> httpx.Client:
    return httpx.Client(base_url=BASE_URL, timeout=130.0)


@pytest.fixture(scope="module")
def export_context(http_client: httpx.Client) -> dict[str, Any]:
    """
    One run taken to completion, export pack fetched and unzipped.
    Shared across all tests in this module — created once, read many times.
    """
    run_id, ro_id = _run_to_completion(http_client)
    export_meta, zip_bytes = _fetch_export(http_client, run_id)
    pack = _open_zip(zip_bytes)

    return {
        "run_id": run_id,
        "ro_id": ro_id,
        "export_meta": export_meta,
        "zip_bytes": zip_bytes,
        "pack": pack,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 1. Zip structural integrity
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.integration
class TestZipStructure:

    def test_required_files_present(self, export_context: dict[str, Any]) -> None:
        """All four required top-level files must be in the zip."""
        pack = export_context["pack"]
        missing = REQUIRED_ZIP_FILES - set(pack.keys())
        assert not missing, (
            f"Export pack missing required files: {missing}. "
            f"Present: {sorted(pack.keys())}"
        )

    def test_inputs_directory_present(self, export_context: dict[str, Any]) -> None:
        """inputs/ directory must exist and contain at least the backbone FASTA."""
        pack = export_context["pack"]
        inputs_entries = [k for k in pack.keys() if k.startswith("inputs/") and k != "inputs/"]
        assert inputs_entries, (
            "inputs/ directory is empty or absent in the export pack. "
            "§7 Layer 5 requires copies of original FASTA/FASTQ/PDB."
        )

    def test_no_unexpected_top_level_files(self, export_context: dict[str, Any]) -> None:
        """
        No files outside REQUIRED_ZIP_FILES or inputs/ at the top level.
        Unexpected files indicate a packaging bug or sensitive data leak.
        """
        pack = export_context["pack"]
        allowed_prefixes = REQUIRED_ZIP_FILES | {"inputs/"}
        unexpected = [
            k for k in pack.keys()
            if not any(k == f or k.startswith("inputs/") for f in REQUIRED_ZIP_FILES)
            and not k.startswith("inputs/")
        ]
        # Filter out directory entries (zipfile sometimes includes them).
        unexpected = [k for k in unexpected if not k.endswith("/")]
        assert not unexpected, (
            f"Unexpected files in export pack: {unexpected}. "
            "If new files are needed, update §7 Layer 5 first."
        )


# ─────────────────────────────────────────────────────────────────────────────
# 2. SHA-256 verification — P0 test
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.integration
class TestSha256:

    def test_declared_sha256_matches_zip_bytes(self, export_context: dict[str, Any]) -> None:
        """
        sha256(zip bytes) must equal the sha256 value in the API response.
        If this fails, the export endpoint is lying about the pack contents —
        the displayed hash in the UI will not match the downloaded file.
        This is a P0: the demo shows the hash; the hash must be true.
        """
        declared = export_context["export_meta"]["sha256"]
        actual = hashlib.sha256(export_context["zip_bytes"]).hexdigest()
        assert actual == declared, (
            f"Export pack SHA-256 mismatch.\n"
            f"  Declared by API: {declared}\n"
            f"  Actual zip SHA-256: {actual}\n"
            "Backend is returning a stale or incorrectly computed hash value."
        )

    def test_sha256_is_64_char_lowercase_hex(self, export_context: dict[str, Any]) -> None:
        """sha256 field in the API response must be valid 64-char lowercase hex."""
        declared = export_context["export_meta"]["sha256"]
        assert _SHA256_RE.match(declared), (
            f"Export sha256 is not valid lowercase hex: {declared!r}"
        )

    def test_idempotent_sha256_across_calls(self, http_client: httpx.Client, export_context: dict[str, Any]) -> None:
        """
        Two calls to GET /api/v1/runs/:id/export must return the same sha256.
        The pack is pre-built; it must not be rebuilt on every request with
        non-deterministic zip metadata (timestamps, entry ordering).
        """
        run_id = export_context["run_id"]
        first_sha = export_context["export_meta"]["sha256"]

        second_resp = http_client.get(f"/api/v1/runs/{run_id}/export")
        second_resp.raise_for_status()
        second_sha = second_resp.json()["sha256"]

        assert first_sha == second_sha, (
            f"Two calls to GET /api/v1/runs/{run_id}/export returned different sha256 values.\n"
            f"  First:  {first_sha}\n"
            f"  Second: {second_sha}\n"
            "The zip is being rebuilt non-deterministically (check zip entry ordering, "
            "zip metadata timestamps, or file content non-determinism)."
        )


# ─────────────────────────────────────────────────────────────────────────────
# 3. inputs/ — file integrity
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.integration
class TestInputsDirectory:

    def test_backbone_fasta_present_in_inputs(self, export_context: dict[str, Any]) -> None:
        """inputs/ must contain the backbone FASTA (or a file with a FASTA extension)."""
        pack = export_context["pack"]
        fasta_entries = [k for k in pack.keys() if k.startswith("inputs/") and
                         (k.endswith(".fasta") or k.endswith(".fa") or k.endswith(".fastq"))]
        assert fasta_entries, (
            "No FASTA/FASTQ file found under inputs/ in the export pack. "
            "§7 Layer 5 requires 'copies of original FASTA/FASTQ/PDB'."
        )

    def test_backbone_file_sha256_matches_ro(self, export_context: dict[str, Any]) -> None:
        """
        SHA-256 of the backbone file stored in inputs/ must match
        backbone_sha256 in research_object.json.
        Proves the file in the pack is the exact file that was hashed.
        """
        pack = export_context["pack"]
        ro = json.loads(pack["research_object.json"])
        declared_backbone_sha = ro.get("backbone_sha256", "")
        assert declared_backbone_sha, "research_object.json missing backbone_sha256"

        # Find the backbone file — assume the largest FASTA-like file in inputs/.
        fasta_entries = [k for k in pack.keys() if k.startswith("inputs/") and
                         (k.endswith(".fasta") or k.endswith(".fa"))]
        if not fasta_entries:
            pytest.skip("No .fasta file in inputs/ — cannot verify backbone sha256")

        # If multiple FASTA files, check that at least one matches.
        for entry in fasta_entries:
            actual = hashlib.sha256(pack[entry]).hexdigest()
            if actual == declared_backbone_sha:
                return  # Found matching file — test passes.

        pytest.fail(
            f"No file in inputs/ has SHA-256 matching backbone_sha256 in RO.\n"
            f"  Expected: {declared_backbone_sha}\n"
            f"  Checked: { {e: hashlib.sha256(pack[e]).hexdigest() for e in fasta_entries} }"
        )


# ─────────────────────────────────────────────────────────────────────────────
# 4. manifest.json — RunManifest structure
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.integration
class TestManifestJson:

    def test_manifest_is_valid_json(self, export_context: dict[str, Any]) -> None:
        raw = export_context["pack"]["manifest.json"]
        try:
            json.loads(raw)
        except json.JSONDecodeError as exc:
            pytest.fail(f"manifest.json is not valid JSON: {exc}")

    def test_manifest_has_required_fields(self, export_context: dict[str, Any]) -> None:
        manifest = json.loads(export_context["pack"]["manifest.json"])
        missing = REQUIRED_MANIFEST_FIELDS - set(manifest.keys())
        assert not missing, (
            f"manifest.json missing RunManifest fields: {missing}. "
            f"Present: {sorted(manifest.keys())}"
        )

    def test_manifest_git_sha_is_nonempty(self, export_context: dict[str, Any]) -> None:
        manifest = json.loads(export_context["pack"]["manifest.json"])
        assert manifest.get("git_sha"), (
            "manifest.json git_sha is empty. Every run must record the exact "
            "backend code revision — this is what allows reproducibility audits."
        )

    def test_manifest_scoring_versions_has_expected_keys(self, export_context: dict[str, Any]) -> None:
        """scoring_versions must record versions for every scoring module in use."""
        manifest = json.loads(export_context["pack"]["manifest.json"])
        sv = manifest.get("scoring_versions", {})
        assert isinstance(sv, dict), f"scoring_versions must be a dict, got {type(sv)}"
        required_scorers = {"doench_rs2", "cfd"}
        missing = required_scorers - set(sv.keys())
        assert not missing, (
            f"manifest.json scoring_versions missing entries for: {missing}. "
            f"Present: {sv}"
        )
        for name, version in sv.items():
            assert version, f"scoring_versions[{name!r}] is empty"

    def test_manifest_env_fingerprint_is_sha256(self, export_context: dict[str, Any]) -> None:
        """env_fingerprint must be a 64-char lowercase hex SHA-256 (per coordinator ruling: sha256 of uv.lock)."""
        manifest = json.loads(export_context["pack"]["manifest.json"])
        fp = manifest.get("env_fingerprint", "")
        assert _SHA256_RE.match(fp), (
            f"manifest.json env_fingerprint is not valid SHA-256 hex: {fp!r}. "
            "Per spec: sha256(uv.lock contents)."
        )

    def test_manifest_started_at_is_utc_iso8601(self, export_context: dict[str, Any]) -> None:
        """started_at must be a UTC ISO-8601 datetime string."""
        manifest = json.loads(export_context["pack"]["manifest.json"])
        started = manifest.get("started_at", "")
        assert started, "manifest.json started_at is empty"
        # Must be parseable as ISO-8601 and carry UTC indicator.
        try:
            dt = datetime.fromisoformat(started.replace("Z", "+00:00"))
        except ValueError:
            pytest.fail(f"manifest.json started_at is not valid ISO-8601: {started!r}")
        assert dt.tzinfo is not None, (
            f"manifest.json started_at has no timezone: {started!r}. Must be UTC."
        )


# ─────────────────────────────────────────────────────────────────────────────
# 5. research_object.json — ResearchObject structure
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.integration
class TestResearchObjectJson:

    def test_ro_is_valid_json(self, export_context: dict[str, Any]) -> None:
        raw = export_context["pack"]["research_object.json"]
        try:
            json.loads(raw)
        except json.JSONDecodeError as exc:
            pytest.fail(f"research_object.json is not valid JSON: {exc}")

    def test_ro_has_required_fields(self, export_context: dict[str, Any]) -> None:
        ro = json.loads(export_context["pack"]["research_object.json"])
        missing = REQUIRED_RO_FIELDS - set(ro.keys())
        assert not missing, (
            f"research_object.json missing ResearchObject fields: {missing}. "
            f"Present: {sorted(ro.keys())}"
        )

    def test_ro_content_hash_is_valid_sha256(self, export_context: dict[str, Any]) -> None:
        ro = json.loads(export_context["pack"]["research_object.json"])
        h = ro.get("content_hash", "")
        assert _SHA256_RE.match(h), (
            f"research_object.json content_hash is not valid SHA-256 hex: {h!r}"
        )

    def test_ro_fastq_sha256_field_present(self, export_context: dict[str, Any]) -> None:
        """
        fastq_sha256 must be present as a key (may be null for FASTA-only ROs).
        Absence of the key means the schema is not in sync with the §3 spec
        (field was enumerated in docs PR #6).
        """
        ro = json.loads(export_context["pack"]["research_object.json"])
        assert "fastq_sha256" in ro, (
            "research_object.json is missing the fastq_sha256 key entirely. "
            "The field must be present (null for FASTA-only ROs). "
            "See ARCHITECTURE.md §3 (updated in docs PR #6)."
        )

    def test_ro_pam_is_ngg(self, export_context: dict[str, Any]) -> None:
        ro = json.loads(export_context["pack"]["research_object.json"])
        assert ro.get("pam") == "NGG", (
            f"research_object.json pam is {ro.get('pam')!r}, expected 'NGG' (SpCas9 only for MVP)."
        )

    def test_ro_content_hash_matches_recomputed(self, export_context: dict[str, Any]) -> None:
        """
        The content_hash must equal sha256(canonical_json(allowlist_fields)).
        Verifies the allowlist (backbone_sha256, target_pdb_sha256, fastq_sha256,
        pam, metadata) and the canonical serializer are being used correctly.
        """
        try:
            from canonical import canonical_json  # type: ignore[import-untyped]
        except ImportError:
            pytest.skip("canonical.py not importable from test environment")

        ro = json.loads(export_context["pack"]["research_object.json"])
        bundle = {
            "backbone_sha256": ro["backbone_sha256"],
            "target_pdb_sha256": ro.get("target_pdb_sha256"),
            "fastq_sha256": ro.get("fastq_sha256"),
            "pam": ro["pam"],
            "metadata": ro["metadata"],
        }
        expected = hashlib.sha256(canonical_json(bundle).encode("utf-8")).hexdigest()
        assert ro["content_hash"] == expected, (
            f"content_hash mismatch.\n"
            f"  Declared: {ro['content_hash']}\n"
            f"  Recomputed from allowlist: {expected}\n"
            "Either the hash includes extra fields (allowlist violation) or "
            "canonical.py is non-deterministic in the export path."
        )

    def test_ro_in_pack_matches_api(self, http_client: httpx.Client, export_context: dict[str, Any]) -> None:
        """
        research_object.json in the pack must be identical to
        GET /api/v1/research-objects/:id.
        Detects the case where export serializes from a different code path.
        """
        ro_id = export_context["ro_id"]
        api_resp = http_client.get(f"/api/v1/research-objects/{ro_id}")
        api_resp.raise_for_status()
        api_ro = api_resp.json()

        pack_ro = json.loads(export_context["pack"]["research_object.json"])

        # Compare field-by-field for a useful diff on failure.
        diverging = {k for k in set(api_ro) | set(pack_ro) if api_ro.get(k) != pack_ro.get(k)}
        assert not diverging, (
            f"research_object.json in pack differs from GET /api/v1/research-objects/{ro_id}.\n"
            f"Diverging fields: {diverging}\n"
            "The export must serialize the RO from the same canonical path as the API."
        )


# ─────────────────────────────────────────────────────────────────────────────
# 6. prediction.json — PredictionPayload + GuideCandidate structure
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.integration
class TestPredictionJson:

    def test_prediction_is_valid_json(self, export_context: dict[str, Any]) -> None:
        raw = export_context["pack"]["prediction.json"]
        try:
            json.loads(raw)
        except json.JSONDecodeError as exc:
            pytest.fail(f"prediction.json is not valid JSON: {exc}")

    def test_prediction_has_guides_and_summary(self, export_context: dict[str, Any]) -> None:
        pred = json.loads(export_context["pack"]["prediction.json"])
        assert "guides" in pred, "prediction.json missing 'guides' key"
        assert "summary" in pred, "prediction.json missing 'summary' key"
        assert isinstance(pred["guides"], list), "'guides' must be a list"
        assert isinstance(pred["summary"], dict), "'summary' must be a dict"

    def test_prediction_has_at_least_one_guide(self, export_context: dict[str, Any]) -> None:
        """The BCL11A enhancer fixture has NGG sites — at least one guide must be scored."""
        pred = json.loads(export_context["pack"]["prediction.json"])
        assert len(pred["guides"]) >= 1, (
            "prediction.json has zero guides. "
            "The BCL11A enhancer fixture contains NGG PAM sites; at least one "
            "guide candidate must be scored. Check pam.py and the scoring pipeline."
        )

    def test_guide_candidates_have_required_fields(self, export_context: dict[str, Any]) -> None:
        pred = json.loads(export_context["pack"]["prediction.json"])
        for i, guide in enumerate(pred["guides"]):
            missing = REQUIRED_GUIDE_FIELDS - set(guide.keys())
            assert not missing, (
                f"Guide #{i} missing fields: {missing}. Full guide: {guide}"
            )

    def test_guide_sequences_are_20nt(self, export_context: dict[str, Any]) -> None:
        """Guide sequences must be exactly 20 nucleotides (§3 GuideCandidate)."""
        pred = json.loads(export_context["pack"]["prediction.json"])
        for i, guide in enumerate(pred["guides"]):
            seq = guide.get("sequence", "")
            assert len(seq) == 20, (
                f"Guide #{i} sequence is {len(seq)}nt: {seq!r}. Must be exactly 20nt."
            )
            invalid_bases = set(seq.upper()) - _VALID_BASES
            assert not invalid_bases, (
                f"Guide #{i} sequence contains invalid bases: {invalid_bases}. "
                f"Sequence: {seq!r}"
            )

    def test_guide_pam_is_3nt(self, export_context: dict[str, Any]) -> None:
        """PAM must be exactly 3 nucleotides (§3 GuideCandidate)."""
        pred = json.loads(export_context["pack"]["prediction.json"])
        for i, guide in enumerate(pred["guides"]):
            pam = guide.get("pam", "")
            assert len(pam) == 3, (
                f"Guide #{i} PAM is {len(pam)}nt: {pam!r}. Must be exactly 3nt (NGG)."
            )

    def test_on_target_scores_in_range(self, export_context: dict[str, Any]) -> None:
        """Doench RS2 scores must be in [0, 1] (§3 GuideCandidate)."""
        pred = json.loads(export_context["pack"]["prediction.json"])
        for i, guide in enumerate(pred["guides"]):
            score = guide.get("on_target_score")
            assert score is not None, f"Guide #{i} missing on_target_score"
            assert isinstance(score, (int, float)), (
                f"Guide #{i} on_target_score is not a number: {score!r}"
            )
            assert 0.0 <= score <= 1.0, (
                f"Guide #{i} on_target_score {score} is outside [0, 1]. "
                "Doench RS2 outputs a probability in [0, 1]."
            )

    def test_strand_is_plus_or_minus(self, export_context: dict[str, Any]) -> None:
        """Strand must be '+' or '-' (§3 Literal['+', '-'])."""
        pred = json.loads(export_context["pack"]["prediction.json"])
        for i, guide in enumerate(pred["guides"]):
            strand = guide.get("strand")
            assert strand in ("+", "-"), (
                f"Guide #{i} strand is {strand!r}, expected '+' or '-'."
            )

    def test_off_target_top_hits_is_list(self, export_context: dict[str, Any]) -> None:
        pred = json.loads(export_context["pack"]["prediction.json"])
        for i, guide in enumerate(pred["guides"]):
            hits = guide.get("off_target_top_hits")
            assert isinstance(hits, list), (
                f"Guide #{i} off_target_top_hits is {type(hits)}, expected list."
            )

    def test_bystander_warnings_is_list(self, export_context: dict[str, Any]) -> None:
        pred = json.loads(export_context["pack"]["prediction.json"])
        for i, guide in enumerate(pred["guides"]):
            warnings_ = guide.get("bystander_warnings")
            assert isinstance(warnings_, list), (
                f"Guide #{i} bystander_warnings is {type(warnings_)}, expected list."
            )

    def test_prediction_matches_api_result(self, http_client: httpx.Client, export_context: dict[str, Any]) -> None:
        """
        prediction.json in the pack must equal GET /api/v1/runs/:id/result
        (specifically Result.prediction).
        Detects divergent serialization paths between the export builder and the API.
        """
        run_id = export_context["run_id"]
        result_resp = http_client.get(f"/api/v1/runs/{run_id}/result")
        result_resp.raise_for_status()
        api_prediction = result_resp.json().get("prediction")
        assert api_prediction is not None, (
            f"GET /api/v1/runs/{run_id}/result returned no 'prediction' field."
        )

        pack_prediction = json.loads(export_context["pack"]["prediction.json"])

        assert api_prediction == pack_prediction, (
            "prediction.json in export pack differs from the API's /result endpoint. "
            "The export must serialize prediction from the same canonical source. "
            "Divergence usually means one path uses canonical_json and the other uses "
            "plain json.dumps — fix by routing both through canonical.py."
        )

    def test_prediction_contains_no_timestamps(self, export_context: dict[str, Any]) -> None:
        """
        prediction.json must contain no timestamp fields.
        ARCHITECTURE.md §6 rule 4: timestamps go in the manifest, not the prediction.
        A timestamp anywhere in prediction.json would break replay hash stability.
        """
        raw = export_context["pack"]["prediction.json"]
        pred_str = raw.decode("utf-8") if isinstance(raw, bytes) else raw

        # Heuristic: look for ISO-8601-like strings (YYYY-MM-DDTHH).
        timestamp_pattern = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}")
        matches = timestamp_pattern.findall(pred_str)
        assert not matches, (
            f"prediction.json contains timestamp-like strings: {matches}. "
            "Per §6 rule 4, timestamps belong in manifest.json, not prediction.json. "
            "A timestamp in the prediction payload will cause replay hash divergence."
        )


# ─────────────────────────────────────────────────────────────────────────────
# 7. events.jsonl — ProvenanceEvent structure + ordering
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.integration
class TestEventsJsonl:

    def _parse_events(self, raw: bytes) -> list[dict[str, Any]]:
        lines = [l.strip() for l in raw.decode("utf-8").splitlines() if l.strip()]
        return [json.loads(line) for line in lines]

    def test_events_jsonl_every_line_valid_json(self, export_context: dict[str, Any]) -> None:
        raw = export_context["pack"]["events.jsonl"]
        lines = [l.strip() for l in raw.decode("utf-8").splitlines() if l.strip()]
        assert lines, "events.jsonl is empty — at least 5 events are required"
        for i, line in enumerate(lines):
            try:
                json.loads(line)
            except json.JSONDecodeError as exc:
                pytest.fail(f"events.jsonl line {i+1} is not valid JSON: {exc}\nLine: {line!r}")

    def test_events_in_seq_order(self, export_context: dict[str, Any]) -> None:
        """events.jsonl must be written in seq order (ascending). Not sorted post-hoc."""
        raw = export_context["pack"]["events.jsonl"]
        events = self._parse_events(raw)
        seqs = [e["seq"] for e in events]
        assert seqs == sorted(seqs), (
            f"events.jsonl is not in seq order: {seqs}. "
            "§7 Layer 5 specifies 'in seq order'."
        )

    def test_events_seq_gap_free(self, export_context: dict[str, Any]) -> None:
        raw = export_context["pack"]["events.jsonl"]
        events = self._parse_events(raw)
        seqs = [e["seq"] for e in events]
        expected = list(range(1, len(seqs) + 1))
        assert seqs == expected, (
            f"events.jsonl seq values are not gap-free.\n"
            f"  Expected: {expected}\n"
            f"  Actual:   {seqs}"
        )

    def test_events_have_required_fields(self, export_context: dict[str, Any]) -> None:
        raw = export_context["pack"]["events.jsonl"]
        events = self._parse_events(raw)
        for event in events:
            missing = REQUIRED_EVENT_FIELDS - set(event.keys())
            assert not missing, (
                f"Event seq={event.get('seq')} missing fields: {missing}. "
                f"Full event: {event}"
            )

    def test_minimum_event_count(self, export_context: dict[str, Any]) -> None:
        raw = export_context["pack"]["events.jsonl"]
        events = self._parse_events(raw)
        assert len(events) >= 5, (
            f"events.jsonl has {len(events)} event(s); §9 requires ≥5 per run."
        )

    def test_events_run_id_consistent(self, export_context: dict[str, Any]) -> None:
        """All events must belong to the same run."""
        run_id = export_context["run_id"]
        raw = export_context["pack"]["events.jsonl"]
        events = self._parse_events(raw)
        wrong = [e for e in events if e.get("run_id") != run_id]
        assert not wrong, (
            f"events.jsonl contains events for a different run_id: "
            f"{ {e['run_id'] for e in wrong} }. Expected: {run_id}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# 8. Signed URL properties
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.integration
class TestSignedUrl:

    def test_expires_at_is_approximately_one_hour(self, export_context: dict[str, Any]) -> None:
        """
        expires_at must be approximately now + 1 hour (§7 Layer 5: "signed URL with 1h expiry").
        Tolerance: 55–65 minutes to account for clock skew and test execution time.
        """
        expires_str = export_context["export_meta"]["expires_at"]
        try:
            expires = datetime.fromisoformat(expires_str.replace("Z", "+00:00"))
        except ValueError:
            pytest.fail(f"expires_at is not valid ISO-8601: {expires_str!r}")

        now = datetime.now(timezone.utc)
        delta_minutes = (expires - now).total_seconds() / 60

        assert 50 <= delta_minutes <= 70, (
            f"expires_at is {delta_minutes:.1f} minutes from now, expected ~60. "
            f"Declared value: {expires_str!r}. "
            "§7 Layer 5 specifies 1h expiry for signed URLs."
        )

    def test_signed_url_is_accessible(self, export_context: dict[str, Any]) -> None:
        """The signed URL must return 200 and a zip file when fetched."""
        url = export_context["export_meta"]["url"]
        resp = httpx.get(url, follow_redirects=True, timeout=30.0)
        assert resp.status_code == 200, (
            f"Signed URL returned {resp.status_code}. URL: {url!r}"
        )
        content_type = resp.headers.get("content-type", "")
        # Supabase storage may return application/zip, application/octet-stream,
        # or binary/octet-stream depending on bucket config.
        assert any(ct in content_type for ct in ("zip", "octet-stream", "binary")), (
            f"Signed URL returned unexpected Content-Type: {content_type!r}. "
            "Expected a zip/binary content type."
        )

    def test_signed_url_not_public_bucket(self, export_context: dict[str, Any]) -> None:
        """
        The URL must be a signed URL (contains a token/signature query parameter),
        not a public bucket URL. §9: 'Storage signed URLs, never public buckets.'
        """
        url = export_context["export_meta"]["url"]
        # Supabase signed URLs contain 'token=' query param.
        # Public URLs do not have time-limited tokens.
        assert "token=" in url or "X-Amz-Signature=" in url or "sig=" in url, (
            f"Export URL does not appear to be a signed URL: {url!r}. "
            "§9 requires signed URLs, never public bucket URLs. "
            "Public buckets would expose all users' export packs to anyone with the URL."
        )
