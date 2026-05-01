"""
Layer 2 — Research Object hash computation.

The content_hash field allowlist is exactly:
    {backbone_sha256, target_pdb_sha256, fastq_sha256, pam, metadata}

Any addition to this set REQUIRES a PR to ARCHITECTURE.md §6 first.
Excluded by design: id, content_hash itself, created_at, created_by,
fastq_phred_pass_pct (derived — computed from reads, not an input to the experiment).
"""
from typing import Any

from canonical import sha256_hex

# Exact field names that enter the content_hash. Frozen so callers can verify.
CONTENT_HASH_FIELDS: frozenset[str] = frozenset({
    "backbone_sha256",
    "target_pdb_sha256",
    "fastq_sha256",
    "pam",
    "metadata",
})


def build_hash_bundle(
    *,
    backbone_sha256: str,
    pam: str,
    metadata: dict[str, str],
    target_pdb_sha256: str | None = None,
    fastq_sha256: str | None = None,
) -> dict[str, Any]:
    """
    Construct the canonical bundle that gets hashed into content_hash.

    Always includes all five allowlist keys — even when None. This ensures
    that a FASTA-only RO (fastq_sha256=None) hashes differently from a
    hypothetical future RO that omits the field entirely.
    """
    return {
        "backbone_sha256": backbone_sha256,
        "fastq_sha256": fastq_sha256,
        "metadata": metadata,
        "pam": pam,
        "target_pdb_sha256": target_pdb_sha256,
    }


def compute_content_hash(
    *,
    backbone_sha256: str,
    pam: str,
    metadata: dict[str, str],
    target_pdb_sha256: str | None = None,
    fastq_sha256: str | None = None,
) -> str:
    """
    Compute content_hash for a ResearchObject.

    Returns SHA-256 hex (lowercase, 64 chars) of the canonical JSON of
    exactly {backbone_sha256, target_pdb_sha256, fastq_sha256, pam, metadata}.
    """
    bundle = build_hash_bundle(
        backbone_sha256=backbone_sha256,
        pam=pam,
        metadata=metadata,
        target_pdb_sha256=target_pdb_sha256,
        fastq_sha256=fastq_sha256,
    )
    return sha256_hex(bundle)
