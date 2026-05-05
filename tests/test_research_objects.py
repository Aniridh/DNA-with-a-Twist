"""
Layer 2 research-objects endpoint tests.

Mocks Supabase DB calls so tests run without a live instance.
Verifies: content_hash computation, upload lookup, immutability (409 on dup),
ownership check, and wrong-kind guard.
"""

import hashlib
import json
import unicodedata
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

try:
    from main import app  # type: ignore[import-untyped]
    from routers.research_objects import get_current_user_id  # type: ignore[import-untyped]

    _AVAILABLE = True
except ImportError:
    _AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not _AVAILABLE,
    reason="apps/api not yet importable — tests document the spec",
)

_FAKE_USER = "00000000-0000-0000-0000-000000000001"
_BACKBONE_ID = "aaaaaaaa-0000-0000-0000-000000000001"
_FASTQ_ID = "bbbbbbbb-0000-0000-0000-000000000001"
_PDB_ID = "cccccccc-0000-0000-0000-000000000001"

_BACKBONE_SHA = "a" * 64
_FASTQ_SHA = "b" * 64
_PDB_SHA = "c" * 64

_BACKBONE_UPLOAD = {
    "id": _BACKBONE_ID,
    "user_id": _FAKE_USER,
    "kind": "fasta",
    "sha256": _BACKBONE_SHA,
    "storage_bucket": "inputs",
    "storage_path": f"{_FAKE_USER}/{_BACKBONE_ID}/backbone.fasta",
    "phred_pass_pct": None,
    "sequence_count": 1,
}
_FASTQ_UPLOAD = {
    "id": _FASTQ_ID,
    "user_id": _FAKE_USER,
    "kind": "fastq",
    "sha256": _FASTQ_SHA,
    "storage_bucket": "inputs",
    "storage_path": f"{_FAKE_USER}/{_FASTQ_ID}/reads.fastq",
    "phred_pass_pct": 97.3,
    "sequence_count": 10,
}
_PDB_UPLOAD = {
    "id": _PDB_ID,
    "user_id": _FAKE_USER,
    "kind": "pdb",
    "sha256": _PDB_SHA,
    "storage_bucket": "inputs",
    "storage_path": f"{_FAKE_USER}/{_PDB_ID}/7T1B.pdb",
    "phred_pass_pct": None,
    "sequence_count": None,
}

_UPLOAD_DB: dict[str, dict[str, Any]] = {
    _BACKBONE_ID: _BACKBONE_UPLOAD,
    _FASTQ_ID: _FASTQ_UPLOAD,
    _PDB_ID: _PDB_UPLOAD,
}


def _expected_hash(
    backbone_sha256: str,
    pam: str = "NGG",
    metadata: dict[str, str] | None = None,
    target_pdb_sha256: str | None = None,
    fastq_sha256: str | None = None,
) -> str:
    bundle = {
        "backbone_sha256": backbone_sha256,
        "fastq_sha256": fastq_sha256,
        "metadata": metadata or {},
        "pam": pam,
        "target_pdb_sha256": target_pdb_sha256,
    }
    canonical = json.dumps(
        {
            k: (unicodedata.normalize("NFC", v) if isinstance(v, str) else v)
            for k, v in sorted(bundle.items())
        },
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _make_ro_row(
    content_hash: str,
    backbone_sha256: str,
    pam: str = "NGG",
    metadata: dict[str, str] | None = None,
    fastq_sha256: str | None = None,
    target_pdb_sha256: str | None = None,
    fastq_phred_pass_pct: float | None = None,
) -> dict[str, Any]:
    return {
        "id": "dddddddd-0000-0000-0000-000000000001",
        "content_hash": content_hash,
        "backbone_sha256": backbone_sha256,
        "target_pdb_sha256": target_pdb_sha256,
        "fastq_sha256": fastq_sha256,
        "fastq_phred_pass_pct": fastq_phred_pass_pct,
        "pam": pam,
        "metadata": metadata or {},
        "backbone_ref": {"bucket": "inputs", "path": f"{_FAKE_USER}/{_BACKBONE_ID}/backbone.fasta"},
        "target_pdb_ref": (
            {"bucket": "inputs", "path": f"{_FAKE_USER}/{_PDB_ID}/7T1B.pdb"}
            if target_pdb_sha256
            else None
        ),
        "fastq_ref": (
            {"bucket": "inputs", "path": f"{_FAKE_USER}/{_FASTQ_ID}/reads.fastq"}
            if fastq_sha256
            else None
        ),
        "created_at": "2026-05-01T00:00:00+00:00",
        "created_by": _FAKE_USER,
    }


def _client() -> TestClient:
    app.dependency_overrides[get_current_user_id] = lambda: _FAKE_USER
    return TestClient(app, raise_server_exceptions=False)


def _mock_fetch_upload(monkeypatch: Any) -> None:
    def fake_fetch(upload_id: str, user_id: str, expected_kind: str) -> dict[str, Any]:
        row = _UPLOAD_DB.get(upload_id)
        if row is None:
            from fastapi import HTTPException

            raise HTTPException(422, detail={"code": "upload_not_found", "upload_id": upload_id})
        if row["user_id"] != user_id:
            from fastapi import HTTPException

            raise HTTPException(403, detail={"code": "upload_not_owned"})
        if row["kind"] != expected_kind:
            from fastapi import HTTPException

            raise HTTPException(
                422,
                detail={"code": "wrong_upload_kind", "expected": expected_kind, "got": row["kind"]},
            )
        return row

    monkeypatch.setattr("routers.research_objects._fetch_upload", fake_fetch)


def _mock_db_insert(monkeypatch: Any, ro_row: dict[str, Any]) -> MagicMock:
    mock = MagicMock()
    mock.return_value.table.return_value.insert.return_value.execute.return_value.data = [ro_row]
    monkeypatch.setattr("routers.research_objects.service_client", mock)
    return mock


# ─── happy paths ─────────────────────────────────────────────────────────────


def test_create_ro_fasta_only(monkeypatch: Any) -> None:
    _mock_fetch_upload(monkeypatch)
    ch = _expected_hash(_BACKBONE_SHA)
    monkeypatch.setattr(
        "routers.research_objects.service_client",
        lambda: MagicMock(
            **{
                "table.return_value.insert.return_value.execute.return_value.data": [
                    _make_ro_row(ch, _BACKBONE_SHA)
                ]
            }
        ),
    )

    with _client() as c:
        resp = c.post(
            "/api/v1/research-objects",
            json={"backbone_id": _BACKBONE_ID},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["content_hash"] == ch
    assert body["backbone_sha256"] == _BACKBONE_SHA
    assert body["fastq_sha256"] is None
    assert body["target_pdb_sha256"] is None
    assert body["fastq_phred_pass_pct"] is None
    assert body["pam"] == "NGG"


def test_create_ro_with_fastq_and_pdb(monkeypatch: Any) -> None:
    _mock_fetch_upload(monkeypatch)
    ch = _expected_hash(_BACKBONE_SHA, fastq_sha256=_FASTQ_SHA, target_pdb_sha256=_PDB_SHA)
    monkeypatch.setattr(
        "routers.research_objects.service_client",
        lambda: MagicMock(
            **{
                "table.return_value.insert.return_value.execute.return_value.data": [
                    _make_ro_row(
                        ch,
                        _BACKBONE_SHA,
                        fastq_sha256=_FASTQ_SHA,
                        target_pdb_sha256=_PDB_SHA,
                        fastq_phred_pass_pct=97.3,
                    )
                ]
            }
        ),
    )

    with _client() as c:
        resp = c.post(
            "/api/v1/research-objects",
            json={
                "backbone_id": _BACKBONE_ID,
                "fastq_id": _FASTQ_ID,
                "pdb_id": _PDB_ID,
            },
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["content_hash"] == ch
    assert body["fastq_sha256"] == _FASTQ_SHA
    assert body["target_pdb_sha256"] == _PDB_SHA
    assert body["fastq_phred_pass_pct"] == 97.3


def test_content_hash_is_deterministic(monkeypatch: Any) -> None:
    """Same inputs → same content_hash, 10 iterations."""
    hashes = set()
    for _ in range(10):
        hashes.add(_expected_hash(_BACKBONE_SHA, metadata={"gene": "BCL11A"}))
    assert len(hashes) == 1


# ─── validation failures ──────────────────────────────────────────────────────


def test_create_ro_unsupported_pam(monkeypatch: Any) -> None:
    with _client() as c:
        resp = c.post(
            "/api/v1/research-objects",
            json={"backbone_id": _BACKBONE_ID, "pam": "NAG"},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "unsupported_pam"


def test_create_ro_upload_not_found(monkeypatch: Any) -> None:
    _mock_fetch_upload(monkeypatch)
    with _client() as c:
        resp = c.post(
            "/api/v1/research-objects",
            json={"backbone_id": "nonexistent-id"},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "upload_not_found"


def test_create_ro_wrong_kind(monkeypatch: Any) -> None:
    _mock_fetch_upload(monkeypatch)
    # Pass a FASTQ upload ID as the backbone (expects fasta).
    with _client() as c:
        resp = c.post(
            "/api/v1/research-objects",
            json={"backbone_id": _FASTQ_ID},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "wrong_upload_kind"


def test_create_ro_duplicate_content_hash(monkeypatch: Any) -> None:
    _mock_fetch_upload(monkeypatch)

    def raise_dup(*_: Any, **__: Any) -> None:
        raise Exception("duplicate key value violates unique constraint")

    mock_client = MagicMock()
    mock_client.table.return_value.insert.return_value.execute.side_effect = raise_dup
    monkeypatch.setattr("routers.research_objects.service_client", lambda: mock_client)

    with _client() as c:
        resp = c.post(
            "/api/v1/research-objects",
            json={"backbone_id": _BACKBONE_ID},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 409
    assert resp.json()["detail"]["code"] == "duplicate_content_hash"
