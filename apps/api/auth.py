"""Shared auth dependency for all routers."""

from typing import Annotated

from fastapi import Header, HTTPException


async def get_current_user_id(authorization: Annotated[str, Header()]) -> str:
    """Verify Supabase JWT, return user UUID string."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, detail={"code": "missing_token"})
    token = authorization.removeprefix("Bearer ")
    from models.db import anon_client

    try:
        resp = anon_client().auth.get_user(token)
    except Exception as exc:
        raise HTTPException(401, detail={"code": "invalid_token"}) from exc
    if resp.user is None:
        raise HTTPException(401, detail={"code": "invalid_token"})
    return str(resp.user.id)
