"""
Result + prediction sub-models — Pydantic source of truth.

prediction.json in the export pack is the canonical serialization of
PredictionPayload. It must be timestamp-free so its hash is stable across
replays (ARCHITECTURE.md §6 rule 4).

See README.md for drift policy.
"""
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OffTargetHit(BaseModel):
    model_config = ConfigDict(frozen=True)

    sequence: str       # 20nt off-target sequence
    position: int       # 0-based position in backbone
    mismatches: int     # number of mismatches vs guide (≤4 for CFD scoring)
    cfd_score: float    # CFD score per Doench 2016 mismatch matrix, [0, 1]


class GuideCandidate(BaseModel):
    model_config = ConfigDict(frozen=True)

    sequence: str                           # 20nt protospacer
    pam: str                                # 3nt PAM (e.g. "AGG")
    position: int                           # 0-based start in backbone (+ strand)
    strand: Literal["+", "-"]
    on_target_score: float                  # Doench RS2, [0, 1]
    off_target_count: int                   # total ≤4-mismatch hits
    off_target_top_hits: list[OffTargetHit] # top-5 by CFD score
    bystander_warnings: list[str]           # adjacent C/A in editing window


class PredictionPayload(BaseModel):
    """
    Timestamp-free payload — its canonical JSON hash is replay-stable.
    Do NOT add datetime, uuid, or run_id fields here (ARCHITECTURE.md §6 rule 4).
    """

    model_config = ConfigDict(frozen=True)

    guides: list[GuideCandidate]
    summary: dict   # type: ignore[type-arg]  # top score, mean off-target, etc.


class Result(BaseModel):
    model_config = ConfigDict(frozen=True)

    run_id: UUID
    prediction: PredictionPayload
    # export_pack_ref is a StorageRef shape: {"bucket": str, "path": str}.
    # Typed as dict to avoid cross-schema import; validated at the app layer.
    export_pack_ref: dict[str, str] | None = None  # StorageRef shape
    export_pack_sha256: str | None = None           # SHA-256 hex of zip bytes
