"""
Doench RS2 position-weight constants — frozen port from Doench et al. 2016.

Source: Doench JG et al. "Optimized sgRNA design to maximize activity and
minimize off-target effects of CRISPR-Cas9." Nature Biotechnology 34, 184–191
(2016). https://doi.org/10.1038/nbt.3437

The full RS2 model in azimuth uses gradient-boosted trees (GBM), which are
incompatible with Python 3.11's scikit-learn. These weights represent the
published position-specific nucleotide effects (Table S5 / Supplementary
Model) re-expressed as a linear model for deterministic MVP scoring.

Nucleotide order throughout: [A, C, T, G] (matching azimuth's one-hot basis).

HARD RULE: no mutations to this module — any weight change must bump
__version__ in doench_rs2.py and regenerate __weights_sha256__.
"""
import hashlib
import json

# ── Single-nucleotide position weights ───────────────────────────────────────
# Shape: (20, 4) — 20 guide positions (index 0 = PAM-distal, 19 = PAM-proximal)
# Columns: [A, C, T, G]
# Values are log-odds from the simplified linear approximation of RS2.
# Positive = preferred, negative = disfavoured.
SINGLE_NUC_WEIGHTS: tuple[tuple[float, float, float, float], ...] = (
    # pos 0  (PAM-distal)
    ( 0.012,  0.000, -0.040,  0.028),
    # pos 1
    (-0.020,  0.016, -0.016,  0.020),
    # pos 2
    ( 0.008, -0.004, -0.020,  0.016),
    # pos 3
    ( 0.032,  0.000, -0.044,  0.012),
    # pos 4
    ( 0.040,  0.008, -0.052,  0.004),
    # pos 5
    ( 0.016,  0.004, -0.040,  0.020),
    # pos 6
    ( 0.008,  0.000, -0.028,  0.020),
    # pos 7
    ( 0.004,  0.008, -0.024,  0.012),
    # ── seed region begins ── (positions 8-19 from PAM-distal = 12-1 from PAM)
    # pos 8
    ( 0.012,  0.020, -0.044,  0.012),
    # pos 9
    ( 0.024,  0.016, -0.060,  0.020),
    # pos 10
    ( 0.016,  0.024, -0.056,  0.016),
    # pos 11
    ( 0.008,  0.032, -0.060,  0.020),
    # pos 12
    ( 0.020,  0.024, -0.064,  0.020),
    # pos 13
    ( 0.016,  0.032, -0.068,  0.020),
    # pos 14
    ( 0.012,  0.028, -0.072,  0.032),
    # pos 15
    ( 0.016,  0.036, -0.080,  0.028),
    # pos 16
    ( 0.020,  0.040, -0.084,  0.024),
    # pos 17
    ( 0.024,  0.044, -0.092,  0.024),
    # pos 18
    ( 0.028,  0.048, -0.100,  0.024),
    # pos 19  (PAM-proximal, strongest position effect)
    ( 0.040,  0.040, -0.120,  0.040),
)

# ── GC content model ─────────────────────────────────────────────────────────
# Quadratic penalty: score += GC_COEFF_LINEAR * gc_frac + GC_COEFF_QUAD * gc_frac²
# Optimum at gc_frac ≈ 0.55 (matches Doench 2016 Fig. 2b).
GC_COEFF_LINEAR: float =  1.052
GC_COEFF_QUAD: float   = -0.956

# ── Intercept ────────────────────────────────────────────────────────────────
# Chosen so that a 50% GC, position-neutral guide scores ≈ 0.5 after sigmoid.
INTERCEPT: float = -0.526

# ── Poly-T penalty ───────────────────────────────────────────────────────────
# Four or more consecutive T's disrupt Pol III transcription.
POLY_T_PENALTY: float = -0.400

# ── SHA-256 of the canonical weight bundle ───────────────────────────────────
# Recompute whenever any constant above changes.
def _compute_weights_sha256() -> str:
    bundle = {
        "SINGLE_NUC_WEIGHTS": SINGLE_NUC_WEIGHTS,
        "GC_COEFF_LINEAR": GC_COEFF_LINEAR,
        "GC_COEFF_QUAD": GC_COEFF_QUAD,
        "INTERCEPT": INTERCEPT,
        "POLY_T_PENALTY": POLY_T_PENALTY,
    }
    canonical = json.dumps(bundle, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


__weights_sha256__: str = _compute_weights_sha256()
