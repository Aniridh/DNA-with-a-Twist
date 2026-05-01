"""
ProvenanceEvent — Pydantic source of truth.

APPEND-ONLY: Never updated or deleted after insertion.
DB trigger enforces this at the database layer (see migration 003).
See README.md for drift policy.
"""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

# Fixed vocabulary per ARCHITECTURE.md §5. Adding a type requires a PR to §5.
EventType = Literal[
    "run.preflight.ok",
    "run.extract.features",
    "run.simulate.tick",
    "run.score.emit",
    "run.summary.pending",
    "run.summary.done",
]


class ProvenanceEvent(BaseModel):
    """
    Single immutable event in a run's audit trail.
    seq is monotonic and gap-free per run_id (enforced by DB trigger).
    """

    model_config = ConfigDict(frozen=True)

    id: UUID
    run_id: UUID
    seq: int                # monotonic per run, starts at 1, gap-free
    event_type: EventType
    payload: dict           # type: ignore[type-arg]  # contents vary per event_type
    emitted_at: datetime    # UTC, ISO-8601 Z
