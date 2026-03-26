# ==================== STAGE 1: Python Builder ====================
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
# Install all deps; handle PyTorch CPU separately (inline --index-url not allowed in -r)
RUN pip install --no-cache-dir --timeout=1000 --only-binary=scipy -r requirements.txt && \
    pip install --no-cache-dir --timeout=1000 \
        torch torchaudio \
        --index-url https://download.pytorch.org/whl/cpu

# ==================== STAGE 2: Frontend Builder ====================
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# ==================== STAGE 3: Runtime ====================
FROM python:3.11-slim

WORKDIR /app

# Runtime-only OS packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user BEFORE copying files
RUN useradd -m -u 1000 kalztunz && \
    mkdir -p /app/logs /app/uploads && \
    chown -R kalztunz:kalztunz /app

# Copy venv from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application (with correct ownership)
COPY --chown=kalztunz:kalztunz . .

# Copy built frontend
COPY --from=frontend-builder --chown=kalztunz:kalztunz /app/frontend/dist ./frontend/dist

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

USER kalztunz

CMD ["uvicorn", "app:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--loop", "uvloop", \
     "--log-level", "info"]
