"""Layer 1 — POST /api/v1/uploads."""

import hashlib
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic import BaseModel

from auth import get_current_user_id
from ingestion.fasta import validate_fasta
from ingestion.fastq import validate_fastq
from ingestion.pdb import fetch_rcsb, validate_pdb
from ingestion.storage import upload_bytes

router = APIRouter(tags=["uploads"])

FileKind = Literal["fasta", "fastq", "pdb"]

_EXT_KIND: dict[str, FileKind] = {
    ".fa": "fasta",
    ".fasta": "fasta",
    ".fastq": "fastq",
    ".fq": "fastq",
    ".pdb": "pdb",
    ".cif": "pdb",
}

_SIZE_CAP: dict[FileKind, int] = {
    "fasta": 10 * 1024 * 1024,
    "fastq": 100 * 1024 * 1024,
    "pdb": 50 * 1024 * 1024,
}

_CONTENT_TYPE: dict[FileKind, str] = {
    "fasta": "text/plain",
    "fastq": "text/plain",
    "pdb": "chemical/x-pdb",
}


class StorageRefOut(BaseModel):
    bucket: str
    path: str


class UploadResponse(BaseModel):
    file_id: str
    sha256: str
    kind: FileKind
    storage_ref: StorageRefOut
    phred_pass_pct: float | None
    sequence_count: int | None


def _detect_kind(filename: str) -> FileKind:
    lower = filename.lower()
    for ext, kind in _EXT_KIND.items():
        if lower.endswith(ext):
            return kind
    raise HTTPException(
        status_code=422,
        detail={
            "code": "unsupported_extension",
            "filename": filename,
            "allowed": list(_EXT_KIND.keys()),
        },
    )


def _write_upload_record(
    db_row: dict[object, object],
) -> None:
    """Insert upload metadata row via service role (bypasses RLS)."""
    from models.db import service_client  # deferred

    try:
        service_client().table("uploads").insert(db_row).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "db_error", "message": str(exc)},
        ) from exc


@router.post("/uploads", response_model=UploadResponse, status_code=201)
async def upload_file(
    user_id: Annotated[str, Depends(get_current_user_id)],
    file: UploadFile | None = None,
    pdb_id: str | None = Form(None),
) -> UploadResponse:
    """
    Accept a FASTA, FASTQ, or PDB file (or a 4-char PDB ID for RCSB fetch).
    Validates, stores in Supabase Storage, records metadata, returns sha256.
    """
    if file is None and pdb_id is None:
        raise HTTPException(422, detail={"code": "no_input", "message": "Provide file or pdb_id"})
    if file is not None and pdb_id is not None:
        raise HTTPException(
            422, detail={"code": "ambiguous_input", "message": "Provide file or pdb_id, not both"}
        )

    phred_pass_pct: float | None = None
    sequence_count: int | None = None

    if pdb_id is not None:
        data = fetch_rcsb(pdb_id)
        validate_pdb(data)
        kind: FileKind = "pdb"
        filename = f"{pdb_id.upper()}.pdb"
    else:
        assert file is not None
        filename = file.filename or "upload"
        kind = _detect_kind(filename)

        data = await file.read()
        cap = _SIZE_CAP[kind]
        if len(data) > cap:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "file_too_large",
                    "size": len(data),
                    "max": cap,
                    "kind": kind,
                },
            )

        if kind == "fasta":
            result = validate_fasta(data)
            sequence_count = result.sequence_count
        elif kind == "fastq":
            fq_result = validate_fastq(data)
            sequence_count = fq_result.sequence_count
            phred_pass_pct = fq_result.phred_pass_pct
        else:
            validate_pdb(data)

    sha256 = hashlib.sha256(data).hexdigest()
    file_id, ref = upload_bytes(data, user_id, filename, _CONTENT_TYPE[kind])

    _write_upload_record(
        {
            "id": file_id,
            "user_id": user_id,
            "kind": kind,
            "sha256": sha256,
            "storage_bucket": ref.bucket,
            "storage_path": ref.path,
            "phred_pass_pct": phred_pass_pct,
            "sequence_count": sequence_count,
        }
    )

    return UploadResponse(
        file_id=file_id,
        sha256=sha256,
        kind=kind,
        storage_ref=StorageRefOut(bucket=ref.bucket, path=ref.path),
        phred_pass_pct=phred_pass_pct,
        sequence_count=sequence_count,
    )
