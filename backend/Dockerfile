# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

# System deps for LightGBM (needs libgomp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy only requirements first for layer caching
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

LABEL org.opencontainers.image.title="PatientTriage.ai Backend"
LABEL org.opencontainers.image.description="FastAPI triage decision-support API"

# libgomp needed at runtime by LightGBM
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 1001 --create-home triage

# Install deps from builder
COPY --from=builder /install /usr/local

WORKDIR /app

# Copy application source
COPY app/ ./app/
COPY config/ ./config/
COPY model/ ./model/

# Data directory for SQLite volume mount
RUN mkdir -p /data && chown triage:triage /data

USER triage

# Environment defaults (override at runtime / k8s)
ENV DATABASE_URL="sqlite:////data/triage.db" \
    MODEL_PATH="/app/model/esi_triage_best_weight7.txt" \
    PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/')" || exit 1

ENTRYPOINT ["python", "-m", "uvicorn", "app.main:app", \
    "--host", "0.0.0.0", "--port", "8000", \
    "--workers", "1", "--log-level", "info"]
