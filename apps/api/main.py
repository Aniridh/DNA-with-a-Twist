"""DNA with a Twist — FastAPI application entry point."""
from fastapi import FastAPI

from routers import uploads

app = FastAPI(
    title="DNA with a Twist API",
    version="0.1.0",
    description="CRISPR experiment simulation with deterministic, verifiable provenance.",
)

app.include_router(uploads.router, prefix="/api/v1")
