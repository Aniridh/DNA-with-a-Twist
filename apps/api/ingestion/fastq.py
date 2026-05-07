"""Layer 1 — FASTQ parsing and PHRED Q20 gate."""

import io
from dataclasses import dataclass

from Bio import SeqIO  # type: ignore[import-untyped]
from fastapi import HTTPException

_Q20 = 20
_MIN_PASS_PCT = 50.0


@dataclass(frozen=True)
class FastqResult:
    sequence_count: int
    phred_pass_pct: float


def validate_fastq(data: bytes) -> FastqResult:
    """Parse FASTQ, compute PHRED Q20 pass rate, gate at ≥50%."""
    text = io.StringIO(data.decode("utf-8", errors="replace"))
    total = 0
    passing = 0
    count = 0
    try:
        for record in SeqIO.parse(text, "fastq"):
            quals: list[int] = record.letter_annotations["phred_quality"]
            total += len(quals)
            passing += sum(1 for q in quals if q >= _Q20)
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

    pass_pct = (passing / total * 100.0) if total > 0 else 0.0
    if pass_pct < _MIN_PASS_PCT:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "q20_gate_failed",
                "phred_pass_pct": round(pass_pct, 2),
                "minimum": _MIN_PASS_PCT,
            },
        )
    return FastqResult(sequence_count=count, phred_pass_pct=round(pass_pct, 2))
