"""
Run + RunManifest — Pydantic source of truth.
See README.md for drift policy.
"""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RunManifest(BaseModel):
    """Captured at run start. Records the exact environment for replay verification."""

    model_config = ConfigDict(frozen=True)

    git_sha: str                        # backend code git ref at run time
    api_version: str
    scoring_versions: dict[str, str]    # {"doench_rs2": "1.0", "cfd": "1.0"}
    started_at: datetime                # UTC, ISO-8601 Z
    env_fingerprint: str                # sha256(uv.lock contents)


RunStatus = Literal["queued", "running", "done", "failed"]


class Run(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: UUID
    ro_id: UUID                         # FK to research_objects
    prompt: str                         # natural-language intended edit
    status: RunStatus
    manifest: RunManifest | None = None  # None until run starts
    created_at: datetime                 # UTC, ISO-8601 Z
    finished_at: datetime | None = None
