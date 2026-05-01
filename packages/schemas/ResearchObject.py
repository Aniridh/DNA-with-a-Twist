"""
ResearchObject — Pydantic source of truth.

This file is the canonical definition. The TypeScript mirror in
ResearchObject.ts is hand-maintained. See README.md for drift policy.

IMMUTABILITY: model_config frozen=True enforces no mutation after creation.
The content_hash is computed once at creation time and never updated.
"""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class StorageRef(BaseModel):
    """Reference to a file in Supabase Storage."""

    model_config = ConfigDict(frozen=True)

    bucket: str
    path: str


class ResearchObject(BaseModel):
    """
    Immutable record representing a verified set of experimental inputs.

    content_hash = sha256(canonical_json({backbone_sha256, target_pdb_sha256,
                                          fastq_sha256, pam, metadata}))

    Fields excluded from the hash (ARCHITECTURE.md §6):
      id, content_hash itself, created_at, created_by, fastq_phred_pass_pct
    """

    model_config = ConfigDict(frozen=True)

    id: UUID
    content_hash: str  # SHA-256 hex, 64 lowercase chars
    backbone_ref: StorageRef
    backbone_sha256: str  # SHA-256 hex
    target_pdb_ref: StorageRef | None = None
    target_pdb_sha256: str | None = None  # SHA-256 hex
    fastq_ref: StorageRef | None = None
    fastq_sha256: str | None = None  # SHA-256 hex; None for FASTA-only ROs
    fastq_phred_pass_pct: float | None = None  # % bases >= Q20; derived, not hashed
    pam: Literal["NGG"] = "NGG"
    metadata: dict[str, str]
    created_at: datetime  # UTC, ISO-8601 Z
    created_by: UUID  # Supabase auth user id
