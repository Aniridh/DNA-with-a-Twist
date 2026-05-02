"""DNA with a Twist — FastAPI application entry point."""
from fastapi import FastAPI

from routers import research_objects, runs, uploads

app = FastAPI(
    title="DNA with a Twist API",
    version="0.1.0",
    description="CRISPR experiment simulation with deterministic, verifiable provenance.",
)

app.include_router(uploads.router, prefix="/api/v1")
app.include_router(research_objects.router, prefix="/api/v1")
app.include_router(runs.router, prefix="/api/v1")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
