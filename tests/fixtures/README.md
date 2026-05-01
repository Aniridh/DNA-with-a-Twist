# Test Fixtures

Owned by the Review agent. Do not edit without a PR to `tests/**`.

| File | Purpose | Source |
|---|---|---|
| `BCL11A_enhancer.fasta` | 400bp synthetic BCL11A +58 enhancer region. Contains NGG PAM sites for PAM scanner tests. Used as the canonical demo input. | Synthetic, based on chr2:60495978-60496378 (hg38) |

## Adding fixtures

New fixtures must satisfy:
- FASTA: valid alphabet `{A,T,G,C,N}`, no duplicate headers, <1 MB
- FASTQ: synthetic reads with realistic PHRED scores, >50% Q20 pass rate
- PDB: use a PDB ID (e.g. `7T1B`) in tests that require structure — fetch at test time, don't commit large files

## NGG sites in BCL11A_enhancer.fasta (hand-verified)

Used to write expected-value tests in `test_scoring.py`. Re-verify if the fixture changes.

Run: `grep -ob 'GG' BCL11A_enhancer.fasta | awk -F: '{print $1-1}'` to find all NGG positions.
