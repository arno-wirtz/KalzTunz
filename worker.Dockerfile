# ==================== KalzTunz Worker Dockerfile ====================
# Runs the RQ background worker (tasks.py)

FROM python:3.11-slim

WORKDIR /app

# ---- Runtime OS packages (libpq5 not libpq-dev) ----
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# ---- Create non-root user BEFORE copying code ----
RUN useradd -m -u 1000 kalztunz && \
    mkdir -p /app/logs /app/uploads && \
    chown -R kalztunz:kalztunz /app

# ---- Python venv ----
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# ---- Install deps (PyTorch CPU via separate index) ----
COPY requirements.txt .
RUN pip install --no-cache-dir --timeout=1000 -r requirements.txt && \
    pip install --no-cache-dir --timeout=1000 \
        torch torchaudio \
        --index-url https://download.pytorch.org/whl/cpu

# ---- Copy application code with correct ownership ----
COPY --chown=kalztunz:kalztunz . .

# ---- Runtime env ----
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

USER kalztunz

CMD ["python", "worker.py"]
