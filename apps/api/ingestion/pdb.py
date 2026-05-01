"""Layer 1 — PDB validation and RCSB fetch."""
import io
import re
from dataclasses import dataclass

import httpx
from fastapi import HTTPException

_PDB_ID_RE = re.compile(r"^[A-Za-z0-9]{4}$")
_RCSB_URL = "https://files.rcsb.org/download/{id}.pdb"


@dataclass(frozen=True)
class PdbResult:
    pass


def validate_pdb(data: bytes) -> PdbResult:
    """Structural check: confirm file begins with valid PDB ATOM/HEADER records."""
    try:
        # Lazy import — Bio.PDB is expensive; keep at function scope.
        from Bio.PDB import PDBParser  # type: ignore[import-untyped]

        parser = PDBParser(QUIET=True)
        parser.get_structure(
            "s", io.StringIO(data.decode("utf-8", errors="replace"))
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "parse_error", "message": str(exc)},
        ) from exc
    return PdbResult()


def fetch_rcsb(pdb_id: str) -> bytes:
    """Fetch PDB bytes from RCSB by 4-char ID."""
    if not _PDB_ID_RE.match(pdb_id):
        raise HTTPException(
            status_code=422,
            detail={"code": "invalid_pdb_id", "pdb_id": pdb_id},
        )
    url = _RCSB_URL.format(id=pdb_id.upper())
    try:
        resp = httpx.get(url, timeout=30.0, follow_redirects=True)
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "rcsb_timeout", "pdb_id": pdb_id},
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "rcsb_error", "message": str(exc)},
        ) from exc

    if resp.status_code == 404:
        raise HTTPException(
            status_code=422,
            detail={"code": "pdb_not_found", "pdb_id": pdb_id},
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail={"code": "rcsb_error", "http_status": resp.status_code},
        )
    return resp.content
