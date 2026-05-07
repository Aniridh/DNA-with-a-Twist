"""
Canonical JSON serializer — the single canonicalization point for all hashing.

Contract (ARCHITECTURE.md §6):
  - Keys sorted recursively at every nesting level
  - ISO-8601 datetime strings (timezone-aware only) normalized to UTC with Z suffix
  - NFC Unicode normalization on all string values
  - No structural whitespace (compact separators)
  - UTF-8 output

HARD RULES — do not violate:
  No datetime.now(), random, uuid4(), or any I/O in this module.
  This module must remain pure and side-effect-free.
"""

import hashlib
import json
import re
import unicodedata
from datetime import UTC, datetime
from typing import Any

# Matches timezone-aware ISO-8601 datetime strings only.
# Naive datetimes (no tz suffix) are intentionally NOT matched — they pass
# through as plain strings. Callers must supply timezone-aware timestamps.
_ISO8601_TZ_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}"
    r"(?:\.\d+)?"
    r"(?:Z|[+-]\d{2}:\d{2})$"
)


def _normalize(value: Any) -> Any:
    """Recursively normalize a value for canonical serialization."""
    if isinstance(value, str):
        if _ISO8601_TZ_RE.match(value):
            try:
                # Python 3.11 handles Z natively; .replace is safe on older builds too.
                dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
                dt_utc = dt.astimezone(UTC)
                ts = dt_utc.strftime("%Y-%m-%dT%H:%M:%S")
                if dt_utc.microsecond:
                    ts += f".{dt_utc.microsecond:06d}".rstrip("0")
                return ts + "Z"
            except ValueError:
                pass
        return unicodedata.normalize("NFC", value)
    if isinstance(value, dict):
        return {_normalize(k): _normalize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_normalize(item) for item in value]
    return value


def canonical_json(data: dict[str, Any]) -> str:
    """
    Return canonical JSON string for *data*.

    Guarantees:
      - Top-level and all nested dict keys sorted lexicographically
      - Datetime strings (tz-aware) converted to UTC Z form
      - All strings NFC-normalized
      - No structural whitespace
      - UTF-8 encodable
    """
    return json.dumps(
        _normalize(data),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def sha256_hex(data: dict[str, Any]) -> str:
    """SHA-256 hex digest of canonical_json(data) encoded as UTF-8. Lowercase."""
    return hashlib.sha256(canonical_json(data).encode("utf-8")).hexdigest()
