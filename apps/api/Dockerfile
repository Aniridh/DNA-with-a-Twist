FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

# Install system deps needed by Biopython (C extensions)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifest first (layer-cache friendly)
COPY pyproject.toml ./

# Install deps into the system Python (no venv needed in container)
RUN uv pip install --system -e "."

# Copy application source
COPY . .

# Fly injects PORT; uvicorn binds to it. Default 8000.
ENV PORT=8000

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
