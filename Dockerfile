FROM python:3.11-slim

WORKDIR /app

# System deps for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 curl build-essential nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --only-binary=scipy -r requirements.txt

# Build React frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Copy backend
COPY . .

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s \
  CMD curl -sf http://localhost:8000/health || exit 1

CMD ["gunicorn","-w","2","-k","uvicorn.workers.UvicornWorker","app:app","--bind","0.0.0.0:8000","--timeout","120"]
