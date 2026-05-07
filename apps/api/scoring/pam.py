"""
PAM scanner — find all NGG guide candidates on both strands.

Returns 20nt protospacers (the sequence Cas9 reads) with 0-based position
on the + strand and strand label. Backbone must contain only A/T/G/C/N.
"""

import re
from dataclasses import dataclass
from typing import Literal

__version__ = "1.0.0"

_GUIDE_LEN = 20

# + strand: 20nt protospacer immediately 5′ of NGG.
# Lookahead so overlapping sites are found.
_PLUS_RE = re.compile(r"(?=([ACGTN]{20}[ACGTN]GG))", re.IGNORECASE)

# - strand: CCN immediately 5′ of the 20nt reverse-complement protospacer
# on the + strand.
_MINUS_RE = re.compile(r"(?=(CC[ACGTN]([ACGTN]{20})))", re.IGNORECASE)

_RC: dict[str, str] = str.maketrans("ACGTNacgtn", "TGCANtgcan")


def _revcomp(seq: str) -> str:
    return seq.translate(_RC)[::-1]


@dataclass(frozen=True)
class PamHit:
    sequence: str  # 20nt protospacer (5′→3′, as Cas9 reads it)
    pam: str  # 3nt PAM
    position: int  # 0-based start of the 20nt on the + strand
    strand: Literal["+", "-"]


def scan(backbone: str) -> list[PamHit]:
    """
    Scan backbone for all NGG PAM sites on both strands.
    Returns one PamHit per site; no deduplication (overlaps allowed).
    """
    hits: list[PamHit] = []

    for m in _PLUS_RE.finditer(backbone):
        full = m.group(1).upper()  # 23nt: guide + PAM
        guide = full[:_GUIDE_LEN]
        pam = full[_GUIDE_LEN:]
        hits.append(PamHit(sequence=guide, pam=pam, position=m.start(), strand="+"))

    for m in _MINUS_RE.finditer(backbone):
        # m.group(2) is the 20nt on + strand; its revcomp is the guide.
        plus_region = m.group(2).upper()
        guide = _revcomp(plus_region)
        pam_on_plus = m.group(1).upper()[:3]  # CCN on + strand
        pam = _revcomp(pam_on_plus)  # NGG on - strand
        position = m.start() + 3  # 0-based start of 20nt on +
        hits.append(PamHit(sequence=guide, pam=pam, position=position, strand="-"))

    return hits
