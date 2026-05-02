"""
Scoring module unit tests.

These are structural/contract tests: determinism, range [0,1], interface
shape, and biological sanity checks. Reference-value tests against exact
Doench 2016 paper values belong in test_doench_rs2_reference.py (reviewer owns).
"""
import pytest

try:
    from scoring.pam import PamHit, scan  # type: ignore[import-untyped]
    from scoring.doench_rs2 import score, __version__ as rs2_version, weights_sha256  # type: ignore[import-untyped]
    from scoring.doench_rs2_weights import __weights_sha256__  # type: ignore[import-untyped]
    from scoring.cfd import cfd_score, scan_off_targets, OffTargetHit, __version__ as cfd_version  # type: ignore[import-untyped]
    _AVAILABLE = True
except ImportError:
    _AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not _AVAILABLE,
    reason="scoring modules not yet shipped",
)

# ── pam.py ───────────────────────────────────────────────────────────────────

_SIMPLE_BACKBONE = "ATGCATGCATGCATGCATGCATGCAGG"  # 24nt: 20nt guide + AGG PAM


def test_pam_plus_strand_hit() -> None:
    # Guide: first 20nt, PAM = AGG (is NGG ✓)
    hits = scan(_SIMPLE_BACKBONE)
    plus = [h for h in hits if h.strand == "+"]
    assert len(plus) >= 1
    hit = plus[0]
    assert len(hit.sequence) == 20
    assert len(hit.pam) == 3
    assert hit.pam[1:] == "GG"
    assert hit.strand == "+"


def test_pam_minus_strand_hit() -> None:
    # CCN on + strand → NGG on - strand
    backbone = "CCCATGCATGCATGCATGCATGCATGC"  # CCN + 20nt
    hits = scan(backbone)
    minus = [h for h in hits if h.strand == "-"]
    assert len(minus) >= 1
    hit = minus[0]
    assert len(hit.sequence) == 20
    assert hit.pam[1:] == "GG"


def test_pam_no_hits_no_ngg() -> None:
    hits = scan("ATCGATCGATCGATCGATCGATCGATC")  # no NGG
    assert hits == []


def test_pam_returns_pamhit_dataclass() -> None:
    hits = scan(_SIMPLE_BACKBONE)
    for h in hits:
        assert isinstance(h, PamHit)
        assert h.strand in ("+", "-")
        assert len(h.sequence) == 20
        assert len(h.pam) == 3


def test_pam_deterministic() -> None:
    backbone = "ATGCATGCATGCATGCATGCATGCAGG" * 3
    results = [scan(backbone) for _ in range(10)]
    assert all(r == results[0] for r in results)


# ── doench_rs2.py ─────────────────────────────────────────────────────────────

_GUIDE_20 = "ATGCATGCATGCATGCATGC"  # 50% GC, no poly-T


def test_rs2_score_range() -> None:
    s = score(_GUIDE_20)
    assert 0.0 <= s <= 1.0


def test_rs2_deterministic() -> None:
    scores = [score(_GUIDE_20) for _ in range(50)]
    assert len(set(scores)) == 1


def test_rs2_gc_polynomial_optimum_in_range() -> None:
    """GC quadratic term peaks between 40% and 75% (Doench 2016 Fig. 2b)."""
    from scoring.doench_rs2_weights import GC_COEFF_LINEAR, GC_COEFF_QUAD
    # Optimum of a*x + b*x² at x* = -a / (2b)
    x_opt = -GC_COEFF_LINEAR / (2.0 * GC_COEFF_QUAD)
    assert 0.40 <= x_opt <= 0.75

def test_rs2_zero_gc_scores_low() -> None:
    """0% GC guide (all A/T) scores below the 50% GC guide with same A:T ratio."""
    # Control sequence: same nucleotide order but more balanced
    all_at = "ATATATATATATATATATATATA"[:20]  # 0% GC
    balanced = _GUIDE_20                    # 50% GC
    # The 0% GC guide will be harshly penalised by both GC term and T position weights
    assert score(balanced) > score(all_at)


def test_rs2_poly_t_penalty() -> None:
    poly_t = "ATGCATTTTTGCATGCATGC"   # contains TTTT
    no_poly = "ATGCATCATGCATGCATGC" + "A"
    assert score(poly_t) < score(no_poly)


def test_rs2_wrong_length_raises() -> None:
    with pytest.raises(ValueError):
        score("ATGC")  # too short


def test_rs2_invalid_char_raises() -> None:
    with pytest.raises(ValueError):
        score("ATGCATGCATGCATGCATXC")  # X not valid


def test_rs2_version_string() -> None:
    assert isinstance(rs2_version, str) and len(rs2_version) > 0


def test_rs2_weights_sha256_exposed() -> None:
    assert len(weights_sha256) == 64   # SHA-256 hex = 64 chars
    assert weights_sha256 == __weights_sha256__


# ── cfd.py ───────────────────────────────────────────────────────────────────

_GUIDE = "ATGCATGCATGCATGCATGC"
_PERFECT = _GUIDE  # target matches guide (Watson-Crick complement of guide on backbone)


def test_cfd_perfect_match() -> None:
    # Perfect complement — every position is a "match" from CFD perspective.
    # Build guide and its Watson-Crick complement as "target" (on-target).
    _wc = str.maketrans("ACGT", "TGCA")
    target = _GUIDE.translate(_wc)
    # All positions perfect match → CFD = 1.0
    assert cfd_score(_GUIDE, target) == pytest.approx(1.0)


def test_cfd_one_mismatch_lt_perfect() -> None:
    _wc = str.maketrans("ACGT", "TGCA")
    perfect_target = _GUIDE.translate(_wc)
    # Introduce one mismatch at position 0 (PAM-distal, least impactful)
    mismatch_target = "G" + perfect_target[1:]
    assert cfd_score(_GUIDE, mismatch_target) < 1.0


def test_cfd_pam_proximal_worse_than_distal() -> None:
    """Mismatch near PAM should score lower than mismatch far from PAM."""
    _wc = str.maketrans("ACGT", "TGCA")
    perfect = _GUIDE.translate(_wc)
    # Mismatch at position 19 (PAM-proximal, index 0 in 0-based from PAM-distal)
    prox = list(perfect)
    prox[19] = "G" if perfect[19] != "G" else "A"
    # Mismatch at position 0 (PAM-distal, least impactful)
    dist = list(perfect)
    dist[0] = "G" if perfect[0] != "G" else "A"
    assert cfd_score(_GUIDE, "".join(prox)) < cfd_score(_GUIDE, "".join(dist))


def test_cfd_score_range() -> None:
    _wc = str.maketrans("ACGT", "TGCA")
    target = _GUIDE.translate(_wc)
    for i in range(20):
        t = list(target)
        t[i] = "G" if target[i] != "G" else "A"
        s = cfd_score(_GUIDE, "".join(t))
        assert 0.0 <= s <= 1.0


def test_scan_off_targets_returns_top5() -> None:
    # Backbone that contains a near-match for the guide (3 mismatches)
    guide = "ATGCATGCATGCATGCATGC"
    # Off-target: 2 mismatches at positions 0 and 1
    off_target = "TTGCATGCATGCATGCATGCAGG"  # guide-like + NGG
    backbone = "AAAA" + off_target + "TTTT"
    hits = scan_off_targets(guide, backbone)
    assert len(hits) <= 5
    for h in hits:
        assert isinstance(h, OffTargetHit)
        assert 1 <= h.mismatches <= 4
        assert 0.0 <= h.cfd_score <= 1.0


def test_scan_off_targets_excludes_perfect_match() -> None:
    guide = "ATGCATGCATGCATGCATGC"
    # Backbone with exact guide (mismatches=0 → excluded from off-target scan)
    backbone = "XXXX" + guide + "AGGXXXX"
    hits = scan_off_targets(guide, backbone)
    assert all(h.mismatches > 0 for h in hits)


def test_scan_off_targets_sorted_by_cfd_desc() -> None:
    guide = "ATGCATGCATGCATGCATGC"
    backbone = "ATGCATGCATGCATGCATAC" + "AGG"  # 1 mismatch
    hits = scan_off_targets(guide, backbone * 3)
    scores = [h.cfd_score for h in hits]
    assert scores == sorted(scores, reverse=True)


def test_cfd_version_string() -> None:
    assert isinstance(cfd_version, str) and len(cfd_version) > 0
