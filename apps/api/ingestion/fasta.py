"""Layer 1 — FASTA parsing and validation."""
import io
from dataclasses import dataclass

from Bio import SeqIO  # type: ignore[import-untyped]
from fastapi import HTTPException

_ALLOWED = frozenset("ATGCNatgcn")
_MAX_SEQ_LEN = 1_000_000  # 1 Mb per ARCHITECTURE.md §7


@dataclass(frozen=True)
class FastaResult:
    sequence_count: int


def validate_fasta(data: bytes) -> FastaResult:
    """Parse FASTA bytes, validate alphabet {A,T,G,C,N}, reject duplicate headers."""
    text = io.StringIO(data.decode("utf-8", errors="replace"))
    seen: set[str] = set()
    count = 0
    try:
        for record in SeqIO.parse(text, "fasta"):
            if record.id in seen:
                raise HTTPException(
                    status_code=422,
                    detail={"code": "duplicate_header", "header": record.id},
                )
            seen.add(record.id)
            seq = str(record.seq)
            if len(seq) > _MAX_SEQ_LEN:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "sequence_too_long",
                        "header": record.id,
                        "length": len(seq),
                        "max": _MAX_SEQ_LEN,
                    },
                )
            bad = set(seq) - _ALLOWED
            if bad:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "invalid_alphabet",
                        "header": record.id,
                        "chars": sorted(bad),
                    },
                )
            count += 1
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "parse_error", "message": str(exc)},
        ) from exc

    if count == 0:
        raise HTTPException(status_code=422, detail={"code": "empty_file"})
    return FastaResult(sequence_count=count)
