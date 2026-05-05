"""
Layer 1 upload endpoint tests.

Mocks Supabase auth, storage, and DB so tests run without a live Supabase
instance. Each test covers either a happy path or a structured validation
failure — never raw 500s.
"""

import hashlib
import io
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

try:
    from main import app  # type: ignore[import-untyped]
    from routers.uploads import get_current_user_id  # type: ignore[import-untyped]

    _AVAILABLE = True
except ImportError:
    _AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not _AVAILABLE,
    reason="apps/api not yet importable — tests document the spec",
)

FIXTURES = Path(__file__).parent / "fixtures"
_FAKE_USER = "00000000-0000-0000-0000-000000000001"

# ─── helpers ────────────────────────────────────────────────────────────────


def _client() -> TestClient:
    """TestClient with auth dependency overridden to bypass Supabase JWT."""
    app.dependency_overrides[get_current_user_id] = lambda: _FAKE_USER
    return TestClient(app, raise_server_exceptions=False)


def _fasta_bytes(seq: str = "ATGCATGCATGCATGC", header: str = "seq1") -> bytes:
    return f">{header}\n{seq}\n".encode()


def _fastq_bytes(seq: str = "ATGCATGCATGCATGC", qual: str = "IIIIIIIIIIIIIIII") -> bytes:
    """Build minimal FASTQ record. 'I' = ASCII 73 → PHRED 40 (well above Q20)."""
    return f"@read1\n{seq}\n+\n{qual}\n".encode()


def _fastq_low_qual(seq: str = "ATGCATGCATGCATGC") -> bytes:
    """FASTQ where all bases are PHRED 10 (below Q20) → Q20 gate failure."""
    qual = "+" * len(seq)  # ASCII 43 → PHRED 10
    return f"@read1\n{seq}\n+\n{qual}\n".encode()


def _mock_upload(monkeypatch: Any) -> MagicMock:
    """Patch ingestion.storage.upload_bytes so no real Supabase call happens."""
    mock = MagicMock(
        return_value=(
            "aaaa-bbbb",
            MagicMock(bucket="inputs", path=f"{_FAKE_USER}/aaaa-bbbb/upload"),
        )
    )
    monkeypatch.setattr("routers.uploads.upload_bytes", mock)
    return mock


def _mock_db(monkeypatch: Any) -> MagicMock:
    """Patch _write_upload_record to skip DB insert."""
    mock = MagicMock()
    monkeypatch.setattr("routers.uploads._write_upload_record", mock)
    return mock


# ─── happy paths ─────────────────────────────────────────────────────────────


def test_upload_fasta_happy_path(monkeypatch: Any) -> None:
    _mock_upload(monkeypatch)
    _mock_db(monkeypatch)

    data = (FIXTURES / "BCL11A_enhancer.fasta").read_bytes()
    sha = hashlib.sha256(data).hexdigest()

    with _client() as c:
        resp = c.post(
            "/api/v1/uploads",
            files={"file": ("BCL11A_enhancer.fasta", io.BytesIO(data), "text/plain")},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["kind"] == "fasta"
    assert body["sha256"] == sha
    assert body["phred_pass_pct"] is None
    assert body["sequence_count"] is not None and body["sequence_count"] >= 1
    assert body["storage_ref"]["bucket"] == "inputs"


def test_upload_fastq_happy_path(monkeypatch: Any) -> None:
    _mock_upload(monkeypatch)
    _mock_db(monkeypatch)

    data = _fastq_bytes()
    sha = hashlib.sha256(data).hexdigest()

    with _client() as c:
        resp = c.post(
            "/api/v1/uploads",
            files={"file": ("sample.fastq", io.BytesIO(data), "text/plain")},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["kind"] == "fastq"
    assert body["sha256"] == sha
    assert body["phred_pass_pct"] is not None
    assert body["phred_pass_pct"] == 100.0
    assert body["sequence_count"] == 1


def test_upload_pdb_by_id(monkeypatch: Any) -> None:
    """PDB ID path: RCSB fetch is mocked to return a minimal valid PDB."""
    _mock_upload(monkeypatch)
    _mock_db(monkeypatch)

    minimal_pdb = (
        b"ATOM      1  CA  ALA A   1       1.000   1.000   1.000  1.00  0.00           C\nEND\n"
    )
    monkeypatch.setattr("routers.uploads.fetch_rcsb", lambda _id: minimal_pdb)
    monkeypatch.setattr("routers.uploads.validate_pdb", lambda _data: MagicMock())

    with _client() as c:
        resp = c.post(
            "/api/v1/uploads",
            data={"pdb_id": "7T1B"},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["kind"] == "pdb"
    assert body["phred_pass_pct"] is None
    assert body["sequence_count"] is None


# ─── validation failures ──────────────────────────────────────────────────────


def test_upload_no_input(monkeypatch: Any) -> None:
    with _client() as c:
        resp = c.post(
            "/api/v1/uploads",
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "no_input"


def test_upload_ambiguous_input(monkeypatch: Any) -> None:
    data = _fasta_bytes()
    with _client() as c:
        resp = c.post(
            "/api/v1/uploads",
            files={"file": ("seq.fasta", io.BytesIO(data), "text/plain")},
            data={"pdb_id": "7T1B"},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "ambiguous_input"


def test_upload_unsupported_extension(monkeypatch: Any) -> None:
    with _client() as c:
        resp = c.post(
            "/api/v1/uploads",
            files={"file": ("data.txt", io.BytesIO(b"hello"), "text/plain")},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "unsupported_extension"


def test_upload_fasta_too_large(monkeypatch: Any) -> None:
    big = _fasta_bytes(seq="A" * 1000)
    # Patch size cap to 10 bytes so the test doesn't need 10MB of memory
    monkeypatch.setattr("routers.uploads._SIZE_CAP", {"fasta": 10, "fastq": 100, "pdb": 50})

    with _client() as c:
        resp = c.post(
            "/api/v1/uploads",
            files={"file": ("big.fasta", io.BytesIO(big), "text/plain")},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "file_too_large"


def test_upload_fasta_invalid_alphabet(monkeypatch: Any) -> None:
    _mock_upload(monkeypatch)
    _mock_db(monkeypatch)
    data = _fasta_bytes(seq="ATGCXXX")

    with _client() as c:
        resp = c.post(
            "/api/v1/uploads",
            files={"file": ("bad.fasta", io.BytesIO(data), "text/plain")},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "invalid_alphabet"


def test_upload_fasta_duplicate_header(monkeypatch: Any) -> None:
    _mock_upload(monkeypatch)
    _mock_db(monkeypatch)
    data = b">seq1\nATGC\n>seq1\nATGC\n"

    with _client() as c:
        resp = c.post(
            "/api/v1/uploads",
            files={"file": ("dup.fasta", io.BytesIO(data), "text/plain")},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "duplicate_header"


def test_upload_fastq_q20_gate_fail(monkeypatch: Any) -> None:
    _mock_upload(monkeypatch)
    _mock_db(monkeypatch)
    data = _fastq_low_qual()

    with _client() as c:
        resp = c.post(
            "/api/v1/uploads",
            files={"file": ("bad.fastq", io.BytesIO(data), "text/plain")},
            headers={"Authorization": "Bearer fake"},
        )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "q20_gate_failed"
    detail = resp.json()["detail"]
    assert detail["phred_pass_pct"] < 50.0
    assert detail["minimum"] == 50.0


def test_upload_missing_auth() -> None:
    """No Authorization header → 422 from FastAPI (missing required header)."""
    app.dependency_overrides.clear()
    with TestClient(app, raise_server_exceptions=False) as c:
        resp = c.post(
            "/api/v1/uploads",
            files={"file": ("seq.fasta", io.BytesIO(b">s\nATGC\n"), "text/plain")},
        )
    assert resp.status_code in (401, 422)
