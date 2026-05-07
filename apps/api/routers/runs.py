"""
Run endpoints — L3-L5 API surface.

POST   /runs                — create run, enqueue pipeline via BackgroundTasks
GET    /runs/{id}           — run state + last 20 events
GET    /runs/{id}/events    — SSE stream of provenance events + 15s ping
GET    /runs/{id}/result    — final PredictionPayload
GET    /runs/{id}/export    — signed download URL for export zip (1h TTL)
POST   /runs/{id}/replay    — create new run with same RO + prompt
"""

import asyncio
import json
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse, ServerSentEvent  # type: ignore[import-untyped]

from auth import get_current_user_id
from models.db import service_client
from pipeline import run as run_pipeline

router = APIRouter(tags=["runs"])

_SSE_PING_INTERVAL = 15.0  # seconds between SSE keepalive pings
_SSE_POLL_INTERVAL = 0.5  # seconds between DB polls for new events


# ── Ownership helpers ─────────────────────────────────────────────────────────


def _verify_run_ownership(run_id: str, user_id: str) -> dict[str, Any]:
    """Fetch run and verify it belongs to user via RO.created_by."""
    try:
        run_res = (
            service_client()
            .table("runs")
            .select("*, research_objects(created_by)")
            .eq("id", run_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(502, detail={"code": "db_error", "message": str(exc)}) from exc
    row = run_res.data
    if row is None:
        raise HTTPException(404, detail={"code": "run_not_found", "run_id": run_id})
    ro_created_by = (row.get("research_objects") or {}).get("created_by")
    if ro_created_by != user_id:
        raise HTTPException(403, detail={"code": "run_not_owned"})
    return row  # type: ignore[return-value]


# ── Request / Response models ─────────────────────────────────────────────────


class CreateRunRequest(BaseModel):
    ro_id: str
    prompt: str


class CreateRunResponse(BaseModel):
    run_id: str
    status: str
    status_url: str


class ScoringVersionsOut(BaseModel):
    pam: str
    doench_rs2: str
    cfd: str


class RunManifestOut(BaseModel):
    git_sha: str
    api_version: str
    scoring_versions: ScoringVersionsOut
    started_at: str
    env_fingerprint: str


class ProvenanceEventOut(BaseModel):
    id: str
    run_id: str
    seq: int
    event_type: str
    payload: dict[str, Any]
    created_at: str


class RunResponse(BaseModel):
    id: str
    ro_id: str
    prompt: str
    status: str
    manifest: RunManifestOut | None
    created_at: str
    finished_at: str | None
    recent_events: list[ProvenanceEventOut]


class OffTargetHitOut(BaseModel):
    sequence: str
    position: int
    mismatches: int
    cfd_score: float


class GuideCandidateOut(BaseModel):
    sequence: str
    pam: str
    position: int
    strand: str
    on_target_score: float
    off_target_count: int
    off_target_top_hits: list[OffTargetHitOut]
    bystander_warnings: list[str]


class PredictionSummary(BaseModel):
    guide_count: int
    top_on_target_score: float
    mean_off_target_count: float


class PredictionPayloadOut(BaseModel):
    guides: list[GuideCandidateOut]
    summary: PredictionSummary


class ResultResponse(BaseModel):
    run_id: str
    prediction: PredictionPayloadOut
    export_pack_ref: dict[str, str] | None
    export_pack_sha256: str | None


class ExportUrlResponse(BaseModel):
    url: str
    expires_at: str
    sha256: str


class ReplayResponse(BaseModel):
    new_run_id: str


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/runs", response_model=CreateRunResponse, status_code=201)
async def create_run(
    body: CreateRunRequest,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> CreateRunResponse:
    """Create a new run for an existing ResearchObject and enqueue the pipeline."""
    # Verify the RO exists and belongs to this user.
    try:
        ro_res = (
            service_client()
            .table("research_objects")
            .select("id, created_by")
            .eq("id", body.ro_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(502, detail={"code": "db_error", "message": str(exc)}) from exc
    ro = ro_res.data
    if ro is None:
        raise HTTPException(422, detail={"code": "ro_not_found", "ro_id": body.ro_id})
    if str(ro["created_by"]) != user_id:
        raise HTTPException(403, detail={"code": "ro_not_owned"})

    # Insert run row (status=queued).
    try:
        run_res = (
            service_client()
            .table("runs")
            .insert({"ro_id": body.ro_id, "prompt": body.prompt, "status": "queued"})
            .execute()
        )
    except Exception as exc:
        raise HTTPException(502, detail={"code": "db_error", "message": str(exc)}) from exc

    run_id = run_res.data[0]["id"]
    background_tasks.add_task(run_pipeline.execute, run_id)

    return CreateRunResponse(
        run_id=run_id,
        status="queued",
        status_url=f"/api/v1/runs/{run_id}",
    )


@router.get("/runs/{run_id}", response_model=RunResponse)
async def get_run(
    run_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> RunResponse:
    """Return run state + last 20 provenance events."""
    row = _verify_run_ownership(run_id, user_id)

    events_res = (
        service_client()
        .table("provenance_events")
        .select("*")
        .eq("run_id", run_id)
        .order("seq", desc=True)
        .limit(20)
        .execute()
    )
    events = list(reversed(events_res.data))

    return RunResponse(
        id=str(row["id"]),
        ro_id=str(row["ro_id"]),
        prompt=row["prompt"],
        status=row["status"],
        manifest=row.get("manifest"),
        created_at=str(row["created_at"]),
        finished_at=str(row["finished_at"]) if row.get("finished_at") else None,
        recent_events=events,
    )


@router.get("/runs/{run_id}/events")
async def stream_events(
    run_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> EventSourceResponse:
    """
    SSE stream of provenance events for the given run.
    Emits `: ping` comments every 15s to keep the connection alive.
    Closes when run reaches "done" or "failed".
    """
    _verify_run_ownership(run_id, user_id)

    async def generator() -> Any:
        db = service_client()
        last_seq = 0
        last_ping = asyncio.get_event_loop().time()

        while True:
            now = asyncio.get_event_loop().time()

            # Send keepalive ping every 15s (`: ping\n\n` in SSE wire format)
            if now - last_ping >= _SSE_PING_INTERVAL:
                yield ServerSentEvent(comment="ping")
                last_ping = now

            # Poll for new events since last_seq
            new_events = (
                db.table("provenance_events")
                .select("*")
                .eq("run_id", run_id)
                .gt("seq", last_seq)
                .order("seq")
                .execute()
                .data
            )
            for event in new_events:
                yield ServerSentEvent(
                    event=event["event_type"],
                    data=json.dumps(event, default=str),
                )
                last_seq = event["seq"]

            # Check run terminal state
            run_status = (
                db.table("runs").select("status").eq("id", run_id).single().execute().data["status"]
            )
            if run_status in ("done", "failed"):
                # Flush any remaining events before closing
                remaining = (
                    db.table("provenance_events")
                    .select("*")
                    .eq("run_id", run_id)
                    .gt("seq", last_seq)
                    .order("seq")
                    .execute()
                    .data
                )
                for event in remaining:
                    yield ServerSentEvent(
                        event=event["event_type"],
                        data=json.dumps(event, default=str),
                    )
                return

            await asyncio.sleep(_SSE_POLL_INTERVAL)

    return EventSourceResponse(generator())


@router.get("/runs/{run_id}/result", response_model=ResultResponse)
async def get_result(
    run_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> ResultResponse:
    """Return the final prediction for a completed run."""
    _verify_run_ownership(run_id, user_id)

    try:
        res = service_client().table("results").select("*").eq("run_id", run_id).single().execute()
    except Exception as exc:
        raise HTTPException(502, detail={"code": "db_error", "message": str(exc)}) from exc

    row = res.data
    if row is None:
        raise HTTPException(404, detail={"code": "result_not_found", "run_id": run_id})

    pred = row["prediction"]
    return ResultResponse(
        run_id=str(row["run_id"]),
        prediction=PredictionPayloadOut(
            guides=[GuideCandidateOut(**g) for g in pred["guides"]],
            summary=pred["summary"],
        ),
        export_pack_ref=row.get("export_pack_ref"),
        export_pack_sha256=row.get("export_pack_sha256"),
    )


@router.get("/runs/{run_id}/export", response_model=ExportUrlResponse)
async def get_export_url(
    run_id: str,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> ExportUrlResponse:
    """Return a 1-hour signed download URL for the export zip."""
    _verify_run_ownership(run_id, user_id)

    try:
        result_row = (
            service_client()
            .table("results")
            .select("export_pack_ref, export_pack_sha256")
            .eq("run_id", run_id)
            .single()
            .execute()
            .data
        )
    except Exception as exc:
        raise HTTPException(502, detail={"code": "db_error", "message": str(exc)}) from exc

    if result_row is None or not result_row.get("export_pack_ref"):
        raise HTTPException(404, detail={"code": "export_not_ready", "run_id": run_id})

    ref: dict[str, str] = result_row["export_pack_ref"]
    ttl_seconds = 3600

    try:
        signed = (
            service_client()
            .storage.from_(ref["bucket"])
            .create_signed_url(ref["path"], ttl_seconds)
        )
    except Exception as exc:
        raise HTTPException(502, detail={"code": "storage_error", "message": str(exc)}) from exc

    from datetime import UTC, datetime, timedelta

    expires_at = (datetime.now(UTC) + timedelta(seconds=ttl_seconds)).isoformat()
    return ExportUrlResponse(
        url=signed["signedURL"],
        expires_at=expires_at,
        sha256=result_row["export_pack_sha256"] or "",
    )


@router.post("/runs/{run_id}/replay", response_model=ReplayResponse, status_code=201)
async def replay_run(
    run_id: str,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> ReplayResponse:
    """
    Create a new run with the same RO and prompt as the given run.
    The reviewer's test_replay.py asserts byte-equality of prediction.json
    between the original and the replay — if it fails, there is non-determinism
    in the pipeline. Fix before merging.
    """
    original = _verify_run_ownership(run_id, user_id)

    if original["status"] != "done":
        raise HTTPException(
            422,
            detail={
                "code": "run_not_done",
                "status": original["status"],
                "message": "Can only replay a completed run",
            },
        )

    try:
        new_run_res = (
            service_client()
            .table("runs")
            .insert(
                {
                    "ro_id": original["ro_id"],
                    "prompt": original["prompt"],
                    "status": "queued",
                }
            )
            .execute()
        )
    except Exception as exc:
        raise HTTPException(502, detail={"code": "db_error", "message": str(exc)}) from exc

    new_run_id = new_run_res.data[0]["id"]
    background_tasks.add_task(run_pipeline.execute, new_run_id)

    return ReplayResponse(new_run_id=new_run_id)
