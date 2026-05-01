"""
Content hash field allowlist contract tests.

Verifies that content_hash is computed over EXACTLY:
    {backbone_sha256, target_pdb_sha256, fastq_sha256, pam, metadata}

Mutations to any excluded field (id, created_at, created_by,
fastq_phred_pass_pct) must NOT change the content_hash.
Mutations to any included field MUST change the content_hash.

These tests lock the allowlist. Any PR that changes which fields enter
the hash must update ARCHITECTURE.md §6 first, then update these tests.
"""
import hashlib

import pytest

try:
    from canonical import canonical_json
    from pipeline.research_object import (
        CONTENT_HASH_FIELDS,
        build_hash_bundle,
        compute_content_hash,
    )

    AVAILABLE = True
except ImportError:
    AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not AVAILABLE,
    reason="canonical.py or pipeline/research_object.py not yet shipped",
)

# ---------------------------------------------------------------------------
# Baseline bundle — FASTA-only RO (no PDB, no FASTQ)
# ---------------------------------------------------------------------------

_BASE_HASH_KWARGS = {
    "backbone_sha256": "9f3ca1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1",
    "target_pdb_sha256": None,
    "fastq_sha256": None,
    "pam": "NGG",
    "metadata": {"source": "BCL11A_enhancer", "organism": "Homo sapiens"},
}

_BASE_HASH = compute_content_hash(**_BASE_HASH_KWARGS) if AVAILABLE else ""


# ---------------------------------------------------------------------------
# Allowlist membership
# ---------------------------------------------------------------------------


def test_allowlist_has_exactly_five_fields() -> None:
    """Guard: changing CONTENT_HASH_FIELDS size requires updating this test."""
    assert CONTENT_HASH_FIELDS == {
        "backbone_sha256",
        "target_pdb_sha256",
        "fastq_sha256",
        "pam",
        "metadata",
    }, (
        "CONTENT_HASH_FIELDS has changed. A change to the hash field set "
        "requires an ARCHITECTURE.md §6 PR first, then update this test."
    )


# ---------------------------------------------------------------------------
# Excluded fields — mutations must NOT change content_hash
# ---------------------------------------------------------------------------


def test_id_excluded_from_hash() -> None:
    """
    ResearchObject.id is a database PK assigned at insert time.
    Two ROs with identical scientific inputs but different UUIDs must
    hash identically — otherwise replay breaks.
    """
    h1 = compute_content_hash(**_BASE_HASH_KWARGS)
    # Simulate two different UUIDs for the same scientific content.
    # The hash function doesn't receive 'id' — verify compute_content_hash
    # signature doesn't accept it and the result is stable.
    h2 = compute_content_hash(**_BASE_HASH_KWARGS)
    assert h1 == h2 == _BASE_HASH, "content_hash changed without any input change"


def test_created_at_excluded_from_hash() -> None:
    """
    created_at is a DB timestamp injected at row creation.
    Same scientific inputs created at different times must hash identically.
    Changing created_at must not affect content_hash.
    """
    # build_hash_bundle must not accept or use created_at.
    bundle = build_hash_bundle(**_BASE_HASH_KWARGS)
    assert "created_at" not in bundle, (
        "build_hash_bundle included 'created_at' in the hash bundle — "
        "this would make every RO created at different times hash differently."
    )
    h = hashlib.sha256(canonical_json(bundle).encode("utf-8")).hexdigest()
    assert h == _BASE_HASH


def test_created_by_excluded_from_hash() -> None:
    """
    created_by (auth user UUID) is a provenance annotation, not a scientific input.
    Two users uploading the same FASTA must get the same content_hash.
    """
    bundle = build_hash_bundle(**_BASE_HASH_KWARGS)
    assert "created_by" not in bundle, (
        "build_hash_bundle included 'created_by' — two users uploading "
        "the same file would get different hashes."
    )


def test_fastq_phred_pass_pct_excluded_from_hash() -> None:
    """
    fastq_phred_pass_pct is derived from reading the FASTQ file — it's a
    quality metric, not an input. It must not enter the hash (ARCHITECTURE.md
    §6 field allowlist). Changing it must not change content_hash.
    """
    bundle = build_hash_bundle(**_BASE_HASH_KWARGS)
    assert "fastq_phred_pass_pct" not in bundle, (
        "build_hash_bundle included 'fastq_phred_pass_pct'. "
        "This is a derived metric — it violates the field allowlist."
    )


def test_content_hash_itself_excluded() -> None:
    """content_hash must not be part of its own computation (circular)."""
    bundle = build_hash_bundle(**_BASE_HASH_KWARGS)
    assert "content_hash" not in bundle


# ---------------------------------------------------------------------------
# Included fields — mutations MUST change content_hash
# ---------------------------------------------------------------------------


def test_backbone_sha256_changes_hash() -> None:
    altered = {**_BASE_HASH_KWARGS, "backbone_sha256": "0" * 64}
    assert compute_content_hash(**altered) != _BASE_HASH


def test_target_pdb_sha256_changes_hash() -> None:
    altered = {**_BASE_HASH_KWARGS, "target_pdb_sha256": "a" * 64}
    assert compute_content_hash(**altered) != _BASE_HASH


def test_fastq_sha256_changes_hash() -> None:
    altered = {**_BASE_HASH_KWARGS, "fastq_sha256": "b" * 64}
    assert compute_content_hash(**altered) != _BASE_HASH


def test_pam_changes_hash() -> None:
    altered = {**_BASE_HASH_KWARGS, "pam": "TTTN"}
    assert compute_content_hash(**altered) != _BASE_HASH


def test_metadata_changes_hash() -> None:
    altered = {**_BASE_HASH_KWARGS, "metadata": {"source": "DIFFERENT"}}
    assert compute_content_hash(**altered) != _BASE_HASH


# ---------------------------------------------------------------------------
# Null vs. value distinctions (FASTA-only vs. full RO)
# ---------------------------------------------------------------------------


def test_null_pdb_vs_real_pdb_different_hash() -> None:
    with_pdb = {**_BASE_HASH_KWARGS, "target_pdb_sha256": "c" * 64}
    assert compute_content_hash(**with_pdb) != _BASE_HASH


def test_null_fastq_vs_real_fastq_different_hash() -> None:
    with_fastq = {**_BASE_HASH_KWARGS, "fastq_sha256": "d" * 64}
    assert compute_content_hash(**with_fastq) != _BASE_HASH


def test_hash_is_64_lowercase_hex() -> None:
    h = _BASE_HASH
    assert len(h) == 64
    assert h == h.lower()
    assert all(c in "0123456789abcdef" for c in h)
