"""Layer 1 — Supabase Storage upload helper."""

import uuid
from dataclasses import dataclass

from fastapi import HTTPException

_BUCKET = "inputs"


@dataclass(frozen=True)
class StorageRef:
    bucket: str
    path: str

    def as_dict(self) -> dict[str, str]:
        return {"bucket": self.bucket, "path": self.path}


def upload_bytes(
    data: bytes,
    user_id: str,
    filename: str,
    content_type: str,
) -> tuple[str, StorageRef]:
    """Upload bytes to Supabase Storage. Returns (file_id, StorageRef)."""
    from models.db import service_client  # deferred to avoid import-time env check

    file_id = str(uuid.uuid4())
    path = f"{user_id}/{file_id}/{filename}"
    try:
        service_client().storage.from_(_BUCKET).upload(
            path=path,
            file=data,
            file_options={"content-type": content_type, "upsert": "false"},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "storage_error", "message": str(exc)},
        ) from exc
    return file_id, StorageRef(bucket=_BUCKET, path=path)
