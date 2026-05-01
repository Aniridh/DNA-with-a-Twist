"""
Supabase client singleton.

Two clients are provided:
  service_client() — uses SERVICE_ROLE_KEY; bypasses RLS; server-only.
                     Used by background pipeline tasks for DB writes.
  anon_client()    — uses ANON_KEY + user JWT; subject to RLS.
                     Not used server-side in MVP; reserved for reference.

SECURITY: SERVICE_ROLE_KEY must never appear in logs, responses, or errors.
Load from environment only; never hardcode or commit.

Usage:
    from models.db import service_client
    db = service_client()
    result = db.table("runs").select("*").eq("id", run_id).execute()
"""
import os
from functools import lru_cache

from supabase import Client, create_client  # type: ignore[import-untyped]


def _require_env(key: str) -> str:
    value = os.environ.get(key, "")
    if not value:
        raise RuntimeError(
            f"Required environment variable '{key}' is not set. "
            "Check your .env file or deployment secrets."
        )
    return value


@lru_cache(maxsize=1)
def service_client() -> Client:
    """
    Singleton Supabase client using the service role key.
    Bypasses RLS — use only in server-side pipeline code, never in
    any path that handles user-controlled input without validation.
    """
    url = _require_env("SUPABASE_URL")
    key = _require_env("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


@lru_cache(maxsize=1)
def anon_client() -> Client:
    """Singleton Supabase client using the anon (public) key."""
    url = _require_env("SUPABASE_URL")
    key = _require_env("SUPABASE_ANON_KEY")
    return create_client(url, key)
