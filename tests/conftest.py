"""
Pytest configuration for DNA with a Twist test suite.

Path setup: inserts apps/api onto sys.path so tests can import
backend modules directly (e.g. `from canonical import canonical_json`).
This mirrors the PYTHONPATH=apps/api env var set in CI.
"""
import sys
from pathlib import Path

# Allow `from canonical import ...`, `from pipeline.ingest import ...`, etc.
_API_ROOT = Path(__file__).parent.parent / "apps" / "api"
if _API_ROOT.exists() and str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

# Fixtures directory — tests that need sample data reference this.
FIXTURES_DIR = Path(__file__).parent / "fixtures"
