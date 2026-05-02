"""
Doench RS2 on-target scorer — pure function, no I/O, no randomness.

Input:  20nt protospacer sequence (5′→3′, as Cas9 reads it).
Output: float in [0, 1] — higher = more efficient guide.

Model: simplified linear port of Doench et al. 2016 RS2 (see
doench_rs2_weights.py for weight provenance and SHA-256).

HARD RULES (ARCHITECTURE.md §6):
  - No datetime, uuid4, random, or file I/O in this module.
  - Output must be identical for identical input — always.
"""
import math
import re
from typing import Final

from scoring.doench_rs2_weights import (
    GC_COEFF_LINEAR,
    GC_COEFF_QUAD,
    INTERCEPT,
    POLY_T_PENALTY,
    SINGLE_NUC_WEIGHTS,
    __weights_sha256__,
)

__version__: Final[str] = "1.0.0"

# Re-export so callers can log the weight hash alongside __version__.
weights_sha256: Final[str] = __weights_sha256__

_NUC_IDX: dict[str, int] = {"A": 0, "C": 1, "T": 2, "G": 3, "N": -1}
_POLY_T_RE = re.compile(r"T{4,}", re.IGNORECASE)

_GUIDE_LEN = 20


def _sigmoid(x: float) -> float:
    # Numerically stable: clamp to avoid overflow in exp.
    x = max(-500.0, min(500.0, x))
    return 1.0 / (1.0 + math.exp(-x))


def score(sequence: str) -> float:
    """
    Compute RS2-inspired on-target efficiency score for a 20nt protospacer.

    Returns a float in [0, 1]. Raises ValueError for sequences that are not
    exactly 20nt or contain characters outside {A, C, T, G, N}.
    """
    seq = sequence.upper()
    if len(seq) != _GUIDE_LEN:
        raise ValueError(f"Sequence must be {_GUIDE_LEN}nt; got {len(seq)}")
    if not set(seq).issubset(_NUC_IDX):
        bad = set(seq) - set(_NUC_IDX)
        raise ValueError(f"Invalid characters: {bad!r}")

    raw = INTERCEPT

    # Single-nucleotide position weights.
    for pos, nt in enumerate(seq):
        idx = _NUC_IDX[nt]
        if idx >= 0:
            raw += SINGLE_NUC_WEIGHTS[pos][idx]

    # GC content (fraction over the 20nt guide).
    gc_count = sum(1 for nt in seq if nt in "GC")
    gc_frac = gc_count / _GUIDE_LEN
    raw += GC_COEFF_LINEAR * gc_frac + GC_COEFF_QUAD * gc_frac * gc_frac

    # Poly-T penalty.
    if _POLY_T_RE.search(seq):
        raw += POLY_T_PENALTY

    return _sigmoid(raw)
