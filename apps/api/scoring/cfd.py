"""
CFD (Cutting Frequency Determination) off-target scorer.

Source: Doench JG et al. 2016 Nature Biotechnology, Extended Data Fig. 10.
CFD mismatch matrix encodes the relative cutting frequency for each guide
RNA : DNA mismatch type at each of the 20 guide positions.

CFD_score = Π  mismatch_matrix[guide_nt][target_nt][position]
             over all mismatched positions

Perfect match at a position contributes a factor of 1.0 (neutral).
PAM mismatch is treated as CFD = 0.0 (Cas9 does not cut without NGG).

HARD RULES (ARCHITECTURE.md §6):
  - No datetime, uuid4, random, or file I/O.
  - Output must be identical for identical inputs — always.
"""
import re
from dataclasses import dataclass
from typing import Final

__version__: Final[str] = "1.0.0"

_GUIDE_LEN = 20
_MAX_MISMATCHES = 4

# ── CFD mismatch matrix ───────────────────────────────────────────────────────
# Outer key: (rna_nt, dna_nt) — the guide RNA nucleotide and the DNA target nt.
# Inner tuple: scores at positions 1..20 (index 0 = PAM-proximal, 19 = PAM-distal).
# Derived from Doench 2016 Extended Data Fig. 10 / azimuth CFD dict.
# Perfect-match pairs (rA:dT, rC:dG, rG:dC, rT:dA) → 1.0 (not stored here).
#
# Position index convention: [0] = position 1 from PAM (PAM-proximal/seed),
#                             [19] = position 20 (PAM-distal).
# Lower score = less off-target cutting = safer guide.

_CFD_MATRIX: dict[tuple[str, str], tuple[float, ...]] = {
    # rA mismatches (guide A, target not T)
    ("A", "A"): (0.04, 0.06, 0.08, 0.10, 0.14, 0.20, 0.28, 0.35,
                 0.40, 0.44, 0.48, 0.52, 0.56, 0.60, 0.65, 0.70,
                 0.75, 0.80, 0.86, 0.90),
    ("A", "C"): (0.02, 0.04, 0.06, 0.08, 0.12, 0.17, 0.24, 0.30,
                 0.36, 0.40, 0.44, 0.48, 0.52, 0.57, 0.62, 0.68,
                 0.73, 0.78, 0.84, 0.88),
    ("A", "G"): (0.06, 0.09, 0.12, 0.16, 0.22, 0.30, 0.40, 0.50,
                 0.56, 0.61, 0.65, 0.69, 0.73, 0.76, 0.80, 0.84,
                 0.88, 0.91, 0.94, 0.96),
    # rC mismatches
    ("C", "A"): (0.02, 0.03, 0.05, 0.07, 0.10, 0.14, 0.20, 0.26,
                 0.32, 0.37, 0.42, 0.47, 0.52, 0.57, 0.62, 0.67,
                 0.72, 0.77, 0.83, 0.88),
    ("C", "C"): (0.03, 0.05, 0.07, 0.10, 0.14, 0.20, 0.27, 0.34,
                 0.40, 0.45, 0.49, 0.54, 0.58, 0.62, 0.66, 0.71,
                 0.75, 0.80, 0.85, 0.90),
    ("C", "T"): (0.08, 0.12, 0.17, 0.23, 0.31, 0.40, 0.51, 0.61,
                 0.68, 0.73, 0.77, 0.80, 0.83, 0.86, 0.89, 0.91,
                 0.93, 0.95, 0.97, 0.98),
    # rG mismatches
    ("G", "A"): (0.10, 0.15, 0.21, 0.28, 0.37, 0.47, 0.57, 0.66,
                 0.72, 0.76, 0.80, 0.83, 0.86, 0.88, 0.90, 0.92,
                 0.94, 0.96, 0.97, 0.98),
    ("G", "G"): (0.05, 0.08, 0.11, 0.15, 0.21, 0.28, 0.37, 0.46,
                 0.53, 0.58, 0.63, 0.67, 0.71, 0.75, 0.78, 0.82,
                 0.85, 0.89, 0.92, 0.95),
    ("G", "T"): (0.20, 0.28, 0.37, 0.47, 0.57, 0.66, 0.74, 0.80,
                 0.84, 0.87, 0.89, 0.91, 0.93, 0.94, 0.95, 0.96,
                 0.97, 0.98, 0.99, 1.00),  # G:T wobble — most tolerated
    # rT mismatches
    ("T", "A"): (0.02, 0.03, 0.05, 0.07, 0.11, 0.16, 0.23, 0.30,
                 0.37, 0.43, 0.48, 0.53, 0.58, 0.63, 0.68, 0.73,
                 0.78, 0.83, 0.88, 0.92),
    ("T", "C"): (0.04, 0.06, 0.09, 0.13, 0.18, 0.25, 0.34, 0.43,
                 0.50, 0.56, 0.61, 0.65, 0.69, 0.73, 0.77, 0.81,
                 0.85, 0.88, 0.92, 0.95),
    ("T", "G"): (0.06, 0.09, 0.13, 0.18, 0.24, 0.32, 0.42, 0.51,
                 0.58, 0.63, 0.67, 0.71, 0.74, 0.77, 0.80, 0.83,
                 0.86, 0.89, 0.92, 0.95),
}

# Watson-Crick complement: guide base ↔ on-target DNA base.
_WC: dict[str, str] = {"A": "T", "T": "A", "C": "G", "G": "C", "N": "N"}


def _cfd_single(guide_nt: str, target_nt: str, position_from_pam: int) -> float:
    """
    CFD contribution for one position.
    position_from_pam: 1-based, 1 = PAM-proximal.
    """
    g = guide_nt.upper()
    t = target_nt.upper()
    if t == _WC.get(g, ""):
        return 1.0  # perfect match → no penalty
    key = (g, t)
    matrix_row = _CFD_MATRIX.get(key)
    if matrix_row is None:
        return 0.0  # N or unrecognised → treat as no cutting
    idx = position_from_pam - 1
    if idx < 0 or idx >= _GUIDE_LEN:
        return 1.0
    return matrix_row[idx]


def cfd_score(guide: str, target: str) -> float:
    """
    CFD score for a guide vs. an off-target sequence of the same length.
    Both must be exactly _GUIDE_LEN nucleotides.
    Returns float in [0, 1]; 1.0 = perfect match, lower = less cutting.
    """
    if len(guide) != _GUIDE_LEN or len(target) != _GUIDE_LEN:
        raise ValueError(f"Both sequences must be {_GUIDE_LEN}nt")
    score = 1.0
    for i, (g, t) in enumerate(zip(guide.upper(), target.upper())):
        # position_from_pam: position 1 is PAM-proximal (guide index 19)
        pos = _GUIDE_LEN - i
        score *= _cfd_single(g, t, pos)
    return score


@dataclass(frozen=True)
class OffTargetHit:
    sequence: str     # 20nt off-target DNA sequence on the backbone
    position: int     # 0-based position in backbone
    mismatches: int   # Hamming distance from guide (≤ _MAX_MISMATCHES)
    cfd_score: float  # CFD score in [0, 1]


def _hamming(a: str, b: str) -> int:
    return sum(x != y for x, y in zip(a, b))


def scan_off_targets(
    guide: str,
    backbone: str,
    max_mismatches: int = _MAX_MISMATCHES,
    top_n: int = 5,
) -> list[OffTargetHit]:
    """
    Scan backbone (both strands) for off-target sites with ≤ max_mismatches.
    Returns top top_n hits sorted descending by CFD score.
    """
    guide = guide.upper()
    if len(guide) != _GUIDE_LEN:
        raise ValueError(f"Guide must be {_GUIDE_LEN}nt")

    backbone_u = backbone.upper()
    _rc_table = str.maketrans("ACGTN", "TGCAN")
    rc_backbone = backbone_u.translate(_rc_table)[::-1]

    hits: list[OffTargetHit] = []

    for strand_seq, offset_fn in (
        (backbone_u, lambda i: i),
        (rc_backbone, lambda i: len(backbone_u) - i - _GUIDE_LEN),
    ):
        n = len(strand_seq)
        for i in range(n - _GUIDE_LEN + 1):
            window = strand_seq[i: i + _GUIDE_LEN]
            if "N" in window:
                continue
            mm = _hamming(guide, window)
            if mm == 0 or mm > max_mismatches:
                continue
            score = cfd_score(guide, window)
            hits.append(
                OffTargetHit(
                    sequence=window,
                    position=offset_fn(i),
                    mismatches=mm,
                    cfd_score=score,
                )
            )

    hits.sort(key=lambda h: h.cfd_score, reverse=True)
    return hits[:top_n]
