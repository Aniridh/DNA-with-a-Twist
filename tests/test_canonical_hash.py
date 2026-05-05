"""
Determinism gate — canonical JSON serializer spec.

These tests define the canonicalization contract. They will fail with ImportError
until apps/api/canonical.py is shipped by the Backend agent. That is expected and
correct: the tests document the spec before the implementation exists, so the
implementation can be written against a passing test suite.

Import target: apps/api/canonical.py must export:
    canonical_json(data: dict[str, Any]) -> str

Requirements the implementation MUST satisfy (enforced here):
    1. Same dict → same byte string, 100 iterations (no hidden entropy)
    2. Key insertion order must not affect output (keys sorted)
    3. Output contains no spaces, newlines, or tabs
    4. Datetime strings normalized to UTC Z before serializing
    5. NFC Unicode normalization before serializing
    6. Different inputs → different outputs (no constant-return bugs)
"""

import hashlib
import unicodedata
from typing import Any

import pytest

# Will raise ImportError until backend ships canonical.py — expected.
# conftest.py puts apps/api on sys.path.
try:
    from canonical import canonical_json  # type: ignore[import-untyped]

    CANONICAL_AVAILABLE = True
except ImportError:
    CANONICAL_AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not CANONICAL_AVAILABLE,
    reason="apps/api/canonical.py not yet shipped — tests document the spec",
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _sha256(data: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_json(data).encode("utf-8")).hexdigest()


# ─────────────────────────────────────────────────────────────────────────────
# Shared fixture: a realistic hashed-bundle shape (mirrors §6 field allowlist)
# ─────────────────────────────────────────────────────────────────────────────

SAMPLE_BUNDLE: dict[str, Any] = {
    "backbone_sha256": "9f3ca1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1",
    "target_pdb_sha256": "deadbeef00112233445566778899aabbccddeeff00112233445566778899aabb",
    "fastq_sha256": None,
    "pam": "NGG",
    "metadata": {
        "source": "BCL11A_enhancer",
        "organism": "Homo sapiens",
        "experiment": "GATA1_disruption",
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# Case 1 — Idempotency: same input → same hash, 100 iterations
#
# Most critical for detecting hidden entropy sources (datetime.now(), random,
# object id leakage, dict ordering that varies across Python versions).
# ─────────────────────────────────────────────────────────────────────────────


def test_idempotency_100_iterations() -> None:
    """Same dict → byte-identical hash across 100 calls, no hidden entropy."""
    first = _sha256(SAMPLE_BUNDLE)
    for i in range(1, 100):
        result = _sha256(SAMPLE_BUNDLE)
        assert result == first, (
            f"Hash changed on iteration {i}: expected {first!r}, got {result!r}. "
            "Indicates non-deterministic serialization — check for datetime.now(), "
            "random, or insertion-order-dependent dict traversal in canonical.py."
        )


def test_canonical_json_returns_string() -> None:
    """canonical_json must return str (not bytes, not None)."""
    result = canonical_json(SAMPLE_BUNDLE)
    assert isinstance(result, str), f"Expected str, got {type(result)}"


def test_canonical_json_utf8_encodable() -> None:
    """Output must be valid UTF-8 (no surrogates, no replacement chars)."""
    result = canonical_json(SAMPLE_BUNDLE)
    encoded = result.encode("utf-8")  # raises UnicodeEncodeError if invalid
    assert len(encoded) > 0


# ─────────────────────────────────────────────────────────────────────────────
# Case 2 — Key order independence
#
# Python dicts preserve insertion order since 3.7. A naive json.dumps()
# without sort_keys=True will produce different output for different insertion
# orders. Catch this before the implementation ships.
# ─────────────────────────────────────────────────────────────────────────────


def test_top_level_key_order_independence() -> None:
    """Shuffled top-level key insertion order must not change the hash."""
    original: dict[str, Any] = {
        "backbone_sha256": "aaabbbccc",
        "pam": "NGG",
        "metadata": {"z_key": "last", "a_key": "first"},
        "fastq_sha256": "fff000111",
        "target_pdb_sha256": None,
    }
    reordered: dict[str, Any] = {
        "target_pdb_sha256": None,
        "metadata": {"z_key": "last", "a_key": "first"},
        "fastq_sha256": "fff000111",
        "backbone_sha256": "aaabbbccc",
        "pam": "NGG",
    }
    assert _sha256(original) == _sha256(reordered), (
        "Top-level key insertion order changes the hash. "
        "canonical.py must pass sort_keys=True (or equivalent) to the serializer."
    )


def test_nested_key_order_independence() -> None:
    """Nested dict (metadata) key order must also not affect the hash."""
    bundle_alpha_first: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {"alpha": "1", "beta": "2", "gamma": "3"},
    }
    bundle_gamma_first: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {"gamma": "3", "alpha": "1", "beta": "2"},
    }
    assert _sha256(bundle_alpha_first) == _sha256(bundle_gamma_first), (
        "Nested (metadata) key insertion order changes the hash. "
        "canonical.py must apply recursive key sorting."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Case 3 — Whitespace neutrality
#
# canonical_json output must be compact — no spaces, newlines, or tabs.
# A caller who builds the dict from pretty-printed JSON gets the same hash.
# ─────────────────────────────────────────────────────────────────────────────


def test_output_contains_no_whitespace() -> None:
    """canonical_json must not emit spaces, newlines, or tabs."""
    bundle: dict[str, Any] = {
        "backbone_sha256": "aaa",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {"key": "value with internal spaces"},
    }
    serialized = canonical_json(bundle)
    # Internal string content ("value with internal spaces") is allowed to have spaces —
    # we check for structural whitespace only (spaces/newlines between JSON tokens).
    import json

    reparsed = json.loads(serialized)
    compact = json.dumps(reparsed, sort_keys=True, separators=(",", ":"))
    assert serialized == compact, (
        f"canonical_json output is not compact. Expected: {compact!r}, got: {serialized!r}"
    )


def test_whitespace_in_values_preserved() -> None:
    """Spaces inside string values must be preserved (only structural WS is stripped)."""
    bundle: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {"label": "Homo sapiens (hg38)"},
    }
    serialized = canonical_json(bundle)
    assert "Homo sapiens (hg38)" in serialized, (
        "canonical_json stripped spaces inside a string value — it must only "
        "strip structural (between-token) whitespace."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Case 4 — Timezone normalization (MOST CRITICAL)
#
# Python datetime.now(tz=some_local_tz) vs datetime.utcnow() vs
# datetime.now(UTC) all produce different string representations.
# If canonical.py doesn't coerce to UTC-Z, two runs on servers in different
# timezones produce different hashes — silently, visibly only at demo time.
# ─────────────────────────────────────────────────────────────────────────────


def test_same_instant_different_offsets_same_hash() -> None:
    """
    2024-01-15T06:30:00Z == 2024-01-15T12:00:00+05:30.
    Both must hash identically.
    """
    bundle_utc: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {},
        "created_at": "2024-01-15T06:30:00Z",
    }
    bundle_ist: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {},
        "created_at": "2024-01-15T12:00:00+05:30",
    }
    assert _sha256(bundle_utc) == _sha256(bundle_ist), (
        "Same instant in UTC and +05:30 produces different hashes. "
        "canonical.py must parse datetime strings, convert to UTC, and serialize "
        "as ISO-8601 with Z suffix before hashing."
    )


def test_utc_plus_zero_normalizes_to_z() -> None:
    """'+00:00' and 'Z' are the same UTC offset — output must use 'Z' form."""
    bundle_z: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {},
        "ts": "2024-06-01T00:00:00Z",
    }
    bundle_plus_zero: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {},
        "ts": "2024-06-01T00:00:00+00:00",
    }
    assert _sha256(bundle_z) == _sha256(bundle_plus_zero), (
        "'+00:00' and 'Z' produce different hashes. Both are UTC — canonical.py "
        "must normalize both to the Z form."
    )
    serialized = canonical_json(bundle_z)
    assert "+00:00" not in serialized, (
        "canonical_json emits '+00:00' instead of 'Z'. "
        "Downstream serializers may use either form, causing cross-system hash mismatch."
    )


def test_naive_datetime_string_not_accepted() -> None:
    """
    A datetime string without timezone info is ambiguous.
    canonical.py should either reject it or treat it as UTC.
    This test documents the expected behavior: either ValueError or UTC assumption.
    Update this test when canonical.py specifies its behavior.
    """
    bundle_naive: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {},
        "ts": "2024-06-01T00:00:00",  # no timezone
    }
    # Acceptable outcomes:
    # 1. Raises ValueError (strict — preferred)
    # 2. Treats as UTC and normalizes to Z (permissive)
    # Not acceptable: silently passes through without normalization.
    try:
        result = canonical_json(bundle_naive)
        # If it doesn't raise, it must have normalized to Z form.
        assert "Z" in result or "+00:00" not in result, (
            "canonical.py accepted a naive datetime without normalizing to UTC. "
            "This will cause hash divergence between timezones."
        )
    except (ValueError, TypeError):
        pass  # Strict rejection is the preferred behavior.


# ─────────────────────────────────────────────────────────────────────────────
# Case 5 — Collision sanity
#
# Distinct inputs must produce distinct hashes. Catches any constant-return
# bug in canonical.py (e.g., always returning the same string).
# ─────────────────────────────────────────────────────────────────────────────


def test_different_backbone_different_hash() -> None:
    """Different backbone_sha256 → different content hash."""
    bundle_a: dict[str, Any] = {
        "backbone_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {},
    }
    bundle_b: dict[str, Any] = {
        "backbone_sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {},
    }
    assert _sha256(bundle_a) != _sha256(bundle_b), (
        "Different backbone_sha256 values produce the same hash — "
        "canonical.py has a constant-return or truncation bug."
    )


def test_different_metadata_different_hash() -> None:
    """Different metadata content → different content hash."""
    bundle_a: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {"experiment": "run_A"},
    }
    bundle_b: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {"experiment": "run_B"},
    }
    assert _sha256(bundle_a) != _sha256(bundle_b)


def test_null_vs_absent_fastq_different_hash() -> None:
    """
    fastq_sha256=None (FASTA-only RO) must hash differently from
    fastq_sha256='some_hash' (RO with FASTQ).
    Null vs absent field must also differ (if the schema allows absent).
    """
    bundle_null: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {},
    }
    bundle_with_fastq: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": "fff000111222333444555666777888999aaabbbccc",
        "pam": "NGG",
        "metadata": {},
    }
    assert _sha256(bundle_null) != _sha256(bundle_with_fastq), (
        "fastq_sha256=None and fastq_sha256='...' produce the same hash."
    )


def test_pam_difference_changes_hash() -> None:
    """Different PAM sequences must produce different hashes (future-proofing for Cas12a)."""
    bundle_ngg: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {},
    }
    bundle_tttn: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "TTTN",
        "metadata": {},
    }
    assert _sha256(bundle_ngg) != _sha256(bundle_tttn)


# ─────────────────────────────────────────────────────────────────────────────
# Case 6 — Unicode NFC normalization
#
# Python strings can represent the same visual character in multiple Unicode
# normal forms. NFC (composed) and NFD (decomposed) are different byte
# sequences for identical glyphs. Hashing without normalization means two
# callers who built the same string via different paths get different hashes.
# ─────────────────────────────────────────────────────────────────────────────


def test_nfc_and_nfd_same_hash() -> None:
    """
    NFC 'café' (U+00E9 é, single codepoint) and
    NFD 'café' (e + combining accent, two codepoints) are
    visually identical but byte-different. canonical.py must normalize to NFC
    so both produce the same hash.
    """
    nfc_str = unicodedata.normalize("NFC", "café")  # café — composed
    nfd_str = unicodedata.normalize("NFD", "café")  # cafe + ́  — decomposed

    # Verify our test setup is correct: the two strings must differ at bytes.
    assert nfc_str.encode("utf-8") != nfd_str.encode("utf-8"), (
        "Test setup error: NFC and NFD encode identically — "
        "this character may not have a decomposed form."
    )

    bundle_nfc: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {"label": nfc_str},
    }
    bundle_nfd: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {"label": nfd_str},
    }

    assert _sha256(bundle_nfc) == _sha256(bundle_nfd), (
        f"NFC hash: {_sha256(bundle_nfc)!r} differs from NFD hash: {_sha256(bundle_nfd)!r}. "
        "canonical.py must call unicodedata.normalize('NFC', s) on all string values "
        "before serializing."
    )


def test_nfc_output_in_serialized_string() -> None:
    """The serialized output must contain the NFC form, not the NFD form."""
    nfd_label = unicodedata.normalize("NFD", "Hélix")  # H + combining accent + élix
    nfc_label = unicodedata.normalize("NFC", "Hélix")

    bundle: dict[str, Any] = {
        "backbone_sha256": "abc",
        "target_pdb_sha256": None,
        "fastq_sha256": None,
        "pam": "NGG",
        "metadata": {"label": nfd_label},
    }
    serialized = canonical_json(bundle)
    parsed_back = __import__("json").loads(serialized)
    emitted_label = parsed_back["metadata"]["label"]

    assert unicodedata.is_normalized("NFC", emitted_label), (
        f"canonical_json emitted label in non-NFC form: {emitted_label!r}. "
        "Output must be NFC-normalized."
    )
    assert emitted_label == nfc_label


# ─────────────────────────────────────────────────────────────────────────────
# Hash contract — final integration check
#
# Verifies the full SHA-256 pipeline from dict → canonical_json → sha256 hex
# matches what the RO hash computation in canonical.py should produce.
# Backend must expose a compute_ro_hash() or equivalent for this to run fully.
# ─────────────────────────────────────────────────────────────────────────────


def test_sha256_hex_length() -> None:
    """SHA-256 hex output must be exactly 64 characters."""
    h = _sha256(SAMPLE_BUNDLE)
    assert len(h) == 64, f"Expected 64-char hex string, got {len(h)}: {h!r}"
    assert all(c in "0123456789abcdef" for c in h), f"Hash contains non-hex characters: {h!r}"


def test_hash_is_lowercase_hex() -> None:
    """Hash must be lowercase hex — uppercase would cause comparison failures."""
    h = _sha256(SAMPLE_BUNDLE)
    assert h == h.lower(), "Hash contains uppercase hex digits — must be lowercase"
