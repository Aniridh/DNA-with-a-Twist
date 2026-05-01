"""Layer 2 — POST /api/v1/research-objects."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from ingestion.storage import StorageRef
from models.db import service_client
from pipeline.research_object import compute_content_hash

router = APIRouter(tags=["research-objects"])


class ResearchObjectRequest(BaseModel):
    backbone_upload_id: str
    fastq_upload_id: str | None = None
    pdb_upload_id: str | None = None
    pam: str = "NGG"
    metadata: dict[str, str] = {}


class StorageRefOut(BaseModel):
    bucket: str
    path: str


class ResearchObjectResponse(BaseModel):
    id: str
    content_hash: str
    backbone_sha256: str
    target_pdb_sha256: str | None
    fastq_sha256: str | None
    fastq_phred_pass_pct: float | None
    pam: str
    metadata: dict[str, str]
    backbone_ref: StorageRefOut
    target_pdb_ref: StorageRefOut | None
    fastq_ref: StorageRefOut | None
    created_at: str
    created_by: str


async def get_current_user_id(authorization: Annotated[str, Header()]) -> str:
    """Verify Supabase JWT, return user UUID string."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, detail={"code": "missing_token"})
    token = authorization.removeprefix("Bearer ")
    from models.db import anon_client

    try:
        resp = anon_client().auth.get_user(token)
    except Exception as exc:
        raise HTTPException(401, detail={"code": "invalid_token"}) from exc
    if resp.user is None:
        raise HTTPException(401, detail={"code": "invalid_token"})
    return str(resp.user.id)


def _fetch_upload(upload_id: str, user_id: str, expected_kind: str) -> dict[object, object]:
    """Look up upload record; verify ownership and kind."""
    try:
        result = (
            service_client()
            .table("uploads")
            .select("*")
            .eq("id", upload_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "db_error", "message": str(exc)},
        ) from exc

    row = result.data
    if row is None:
        raise HTTPException(
            status_code=422,
            detail={"code": "upload_not_found", "upload_id": upload_id},
        )
    if row["user_id"] != user_id:
        raise HTTPException(
            status_code=403,
            detail={"code": "upload_not_owned", "upload_id": upload_id},
        )
    if row["kind"] != expected_kind:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "wrong_upload_kind",
                "upload_id": upload_id,
                "expected": expected_kind,
                "got": row["kind"],
            },
        )
    return row  # type: ignore[return-value]


@router.post("/research-objects", response_model=ResearchObjectResponse, status_code=201)
async def create_research_object(
    body: ResearchObjectRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> ResearchObjectResponse:
    """
    Build a canonical ResearchObject from previously uploaded files.
    content_hash = sha256(canonical_json({backbone_sha256, target_pdb_sha256,
                                          fastq_sha256, pam, metadata})).
    Row is immutable after creation — no PATCH, no PUT.
    """
    if body.pam != "NGG":
        raise HTTPException(
            status_code=422,
            detail={"code": "unsupported_pam", "pam": body.pam, "supported": ["NGG"]},
        )

    # Resolve uploads → sha256 + storage refs (server-computed; never trust client).
    backbone = _fetch_upload(body.backbone_upload_id, user_id, "fasta")
    fastq_row = _fetch_upload(body.fastq_upload_id, user_id, "fastq") if body.fastq_upload_id else None
    pdb_row = _fetch_upload(body.pdb_upload_id, user_id, "pdb") if body.pdb_upload_id else None

    backbone_sha256: str = backbone["sha256"]  # type: ignore[assignment]
    fastq_sha256: str | None = fastq_row["sha256"] if fastq_row else None  # type: ignore[assignment]
    target_pdb_sha256: str | None = pdb_row["sha256"] if pdb_row else None  # type: ignore[assignment]
    fastq_phred_pass_pct: float | None = fastq_row["phred_pass_pct"] if fastq_row else None  # type: ignore[assignment]

    content_hash = compute_content_hash(
        backbone_sha256=backbone_sha256,
        pam=body.pam,
        metadata=body.metadata,
        target_pdb_sha256=target_pdb_sha256,
        fastq_sha256=fastq_sha256,
    )

    def _ref(row: dict[object, object]) -> dict[str, str]:
        return {"bucket": str(row["storage_bucket"]), "path": str(row["storage_path"])}

    row_data: dict[str, object] = {
        "content_hash": content_hash,
        "backbone_sha256": backbone_sha256,
        "target_pdb_sha256": target_pdb_sha256,
        "fastq_sha256": fastq_sha256,
        "fastq_phred_pass_pct": fastq_phred_pass_pct,
        "pam": body.pam,
        "metadata": body.metadata,
        "backbone_ref": _ref(backbone),
        "target_pdb_ref": _ref(pdb_row) if pdb_row else None,
        "fastq_ref": _ref(fastq_row) if fastq_row else None,
        "created_by": user_id,
    }

    try:
        result = service_client().table("research_objects").insert(row_data).execute()
    except Exception as exc:
        msg = str(exc)
        # Supabase surfaces duplicate content_hash as a unique violation.
        if "unique" in msg.lower() or "duplicate" in msg.lower():
            raise HTTPException(
                status_code=409,
                detail={"code": "duplicate_content_hash", "content_hash": content_hash},
            ) from exc
        raise HTTPException(status_code=502, detail={"code": "db_error", "message": msg}) from exc

    ro = result.data[0]
    return ResearchObjectResponse(
        id=ro["id"],
        content_hash=ro["content_hash"],
        backbone_sha256=ro["backbone_sha256"],
        target_pdb_sha256=ro["target_pdb_sha256"],
        fastq_sha256=ro["fastq_sha256"],
        fastq_phred_pass_pct=ro["fastq_phred_pass_pct"],
        pam=ro["pam"],
        metadata=ro["metadata"],
        backbone_ref=StorageRefOut(**ro["backbone_ref"]),
        target_pdb_ref=StorageRefOut(**ro["target_pdb_ref"]) if ro.get("target_pdb_ref") else None,
        fastq_ref=StorageRefOut(**ro["fastq_ref"]) if ro.get("fastq_ref") else None,
        created_at=str(ro["created_at"]),
        created_by=str(ro["created_by"]),
    )
