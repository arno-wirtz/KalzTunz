#!/usr/bin/env python3
"""
KalzTunz - FastAPI Backend
Advanced AI music creation and chord extraction platform
"""

import json
import logging
import logging.config
import os
import re
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import aiofiles
from dotenv import load_dotenv
from fastapi import (
    Depends, FastAPI, File, Form, HTTPException, Query,
    Request, UploadFile, status,
)
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest, start_http_server
from starlette.responses import Response
import redis
from rq import Queue
from rq.job import Job

load_dotenv()

# ==================== LOGGING (must be first) ====================

try:
    import backend.logging_config  # noqa: F401 — side-effect import
except Exception:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

logger = logging.getLogger(__name__)

# ==================== CONSTANTS ====================

BASE_DIR          = Path(__file__).parent
UPLOAD_DIR        = BASE_DIR / "uploads"
FRONTEND_DIST     = BASE_DIR / "frontend" / "dist"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

REDIS_URL         = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
ENVIRONMENT       = os.environ.get("ENVIRONMENT", "development")
METRICS_PORT      = int(os.environ.get("METRICS_PORT", "9091"))   # avoid clash with Prometheus
MAX_UPLOAD_BYTES  = 50 * 1024 * 1024  # 50 MB

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".aac", ".mp4", ".webm", ".mov"}
_JOB_ID_RE    = re.compile(r"^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$")
_SAFE_NAME_RE = re.compile(r"^[a-zA-Z0-9_\-\.]{1,128}$")

# ==================== REDIS + QUEUE ====================

def _init_redis() -> Optional[redis.Redis]:
    try:
        conn = redis.from_url(REDIS_URL, decode_responses=False)
        conn.ping()
        logger.info("Redis connected: %s", REDIS_URL)
        return conn
    except Exception as exc:
        logger.warning("Redis not available: %s — background jobs disabled", exc)
        return None

redis_conn = _init_redis()
task_queue = (
    Queue("kalztunz", connection=redis_conn, default_timeout=60 * 30)
    if redis_conn else None
)

# ==================== OPTIONAL MODULES ====================

try:
    import tasks as _tasks_module
except Exception as exc:
    logger.warning("Tasks module not available: %s", exc)
    _tasks_module = None

try:
    from backend.auth import router as auth_router
    from backend.models import User
except Exception as exc:
    logger.warning("Auth module not available: %s", exc)
    auth_router = None
    User = None

try:
    from backend.security import add_security_middleware
    _security_available = True
except Exception as exc:
    logger.warning("Security module not available: %s", exc)
    _security_available = False

try:
    from backend.validators import validate_file_upload
except Exception as exc:
    logger.warning("Validators module not available: %s", exc)
    validate_file_upload = None

try:
    from backend.analytics import Metrics
except Exception as exc:
    logger.warning("Analytics module not available: %s", exc)
    Metrics = None

# ==================== LIFESPAN ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("KalzTunz starting (env=%s)", ENVIRONMENT)
    try:
        start_http_server(METRICS_PORT)
        logger.info("Prometheus metrics on port %d", METRICS_PORT)
    except OSError as exc:
        logger.warning("Could not start Prometheus server: %s", exc)
    yield
    logger.info("KalzTunz shutting down")
    if redis_conn:
        try:
            redis_conn.close()
        except Exception:
            pass

# ==================== APP ====================

app = FastAPI(
    title="KalzTunz API",
    description="AI-powered music creation and chord extraction platform.",
    version="2.1.0",
    contact={"name": "KalzTunz", "url": "https://kalztunz.com"},
    docs_url    =None if ENVIRONMENT == "production" else "/docs",
    redoc_url   =None if ENVIRONMENT == "production" else "/redoc",
    openapi_url =None if ENVIRONMENT == "production" else "/openapi.json",
    lifespan    =lifespan,
)

# ==================== MIDDLEWARE ====================

if _security_available:
    add_security_middleware(app)
else:
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.middleware.trustedhost import TrustedHostMiddleware

    _origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID"],
    )
    _hosts = [h.strip() for h in os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=_hosts)


@app.middleware("http")
async def request_timing_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", uuid.uuid4().hex)
    start      = time.perf_counter()
    response   = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"]    = request_id
    response.headers["X-Response-Time"] = f"{elapsed_ms:.1f}ms"
    if elapsed_ms > 2000:
        logger.warning(
            "Slow request: %s %s %.1fms (id=%s)",
            request.method, request.url.path, elapsed_ms, request_id,
        )
    return response

# ==================== STATIC FILES ====================

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
if FRONTEND_DIST.is_dir():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIST)), name="static")

# ==================== ROUTERS ====================

if auth_router:
    app.include_router(auth_router)

try:
    from backend.social_api import router as social_router
    app.include_router(social_router)
except Exception as exc:
    logger.warning("Social router not available: %s", exc)


try:
    from backend.spotify import router as spotify_router
    app.include_router(spotify_router)
except Exception as exc:
    logger.warning("Spotify router not available: %s", exc)
# ==================== DEPENDENCIES ====================

def require_queue() -> Optional[Queue]:
    """Return the RQ queue if available, or None for synchronous fallback."""
    return task_queue if (task_queue and _tasks_module) else None


def require_redis() -> redis.Redis:
    if not redis_conn:
        raise HTTPException(status_code=503, detail="Redis is unavailable.")
    return redis_conn


async def stream_save_upload(upload_file: UploadFile, destination: Path) -> int:
    """Stream upload to disk in 1 MB chunks, enforcing size limit."""
    total = 0
    try:
        async with aiofiles.open(destination, "wb") as fout:
            while True:
                chunk = await upload_file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    await fout.flush()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
                    )
                await fout.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        destination.unlink(missing_ok=True)
        logger.error("Error saving upload to %s: %s", destination, exc)
        raise HTTPException(status_code=500, detail="Failed to save uploaded file.")
    finally:
        await upload_file.close()
    return total


def _validate_upload(file: UploadFile) -> None:
    filename = file.filename or ""
    content_type = (file.content_type or "").split(";")[0].strip()
    ext = Path(filename).suffix.lower()
    if not ext or ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Extension '{ext}' not permitted. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    if validate_file_upload:
        ok, err = validate_file_upload(filename, content_type, size=0)
        if not ok and err and "large" not in err.lower():
            raise HTTPException(status_code=422, detail=err)


def _assert_valid_job_id(job_id: str) -> str:
    if not _JOB_ID_RE.match(job_id.lower()):
        raise HTTPException(status_code=422, detail="Invalid job ID format. Expected a UUID.")
    return job_id

# ==================== UPLOAD ENDPOINT ====================

@app.post(
    "/api/upload",
    tags=["Music Processing"],
    status_code=202,
    summary="Upload audio and enqueue the full processing pipeline",
)
async def upload_async(
    file: UploadFile         = File(..., description="MP3, WAV, FLAC, OGG, AAC, MP4, WEBM, MOV"),
    style: Optional[str]     = Form(None,          description="Style hint e.g. 'pop', 'jazz'"),
    use_advanced: bool        = Form(False,         description="Enable advanced AI processing"),
    model_backend: str        = Form("huggingface", description="huggingface | torch"),
    use_storage: bool         = Form(False,         description="Persist results to cloud storage"),
    user_id: str              = Form("anonymous"),
    q: Queue                  = Depends(require_queue),
):
    _validate_upload(file)

    # Fixed: was broken tuple assignment — compute ext and name separately
    ext        = Path(file.filename or "upload").suffix.lower() or ".wav"
    saved_name = f"{uuid.uuid4().hex}{ext}"
    dest_path  = UPLOAD_DIR / saved_name

    bytes_written = await stream_save_upload(file, dest_path)
    logger.info("Upload saved: file=%s size=%d user=%s", saved_name, bytes_written, user_id)

    job = q.enqueue(
        "tasks.process_pipeline",
        str(dest_path), style or "auto",
        use_advanced, model_backend, use_storage, user_id,
        job_timeout=1800,
    )

    if Metrics:
        Metrics.uploads_total.labels(file_type=ext.lstrip(".")).inc()

    logger.info("Pipeline job enqueued: job_id=%s user=%s", job.id, user_id)
    return {
        "ok": True,
        "job_id": job.id,
        "uploaded": saved_name,
        "bytes": bytes_written,
        "status": "queued",
    }

# ==================== CHORD GENERATION ENDPOINT ====================

@app.post(
    "/api/generate",
    tags=["Chord Generation"],
    summary="Generate chord progressions from theory parameters",
)
async def generate_chords(
    root_note:      str  = Form("C",         description="Root note e.g. C, F#, Bb"),
    scale_mode:     str  = Form("major",     description="major | minor | dorian | mixolydian | pentatonic | blues"),
    mood:           str  = Form("happy",     description="happy | sad | energetic | calm | dark | romantic | epic | mysterious | uplifting"),
    style:          str  = Form("pop",       description="Musical style hint"),
    bpm:            int  = Form(120,         ge=60, le=220),
    duration:       int  = Form(120,         ge=30, le=600),
    instruments:    str  = Form("[]",        description="JSON array of instrument IDs"),
    num_variations: int  = Form(3,           ge=1,  le=6),
    user_id:        str  = Form("anonymous"),
    q: Optional[Queue]   = Depends(require_queue),
):
    """
    Generate harmonically correct chord progressions using music theory.
    - With Redis: runs as background job and returns a job_id to poll.
    - Without Redis: runs synchronously and returns the full result immediately.
    """
    if not _tasks_module:
        raise HTTPException(status_code=503, detail="Generation module unavailable.")

    # Parse instruments JSON
    try:
        instruments_list = json.loads(instruments) if isinstance(instruments, str) else instruments
        if not isinstance(instruments_list, list):
            instruments_list = []
    except (json.JSONDecodeError, ValueError):
        instruments_list = []

    params = dict(
        root_note=root_note,
        scale_mode=scale_mode,
        mood=mood,
        style=style,
        bpm=bpm,
        duration=duration,
        instruments=instruments_list,
        num_variations=num_variations,
    )

    if Metrics:
        try:
            Metrics.generations_total.labels(style=style).inc()
        except Exception:
            pass

    # ── Async path ─────────────────────────────────────────────
    if q:
        job = q.enqueue(
            "tasks.generate_chords",
            **params,
            job_timeout=120,
        )
        logger.info("Generation job enqueued: job_id=%s user=%s", job.id, user_id)
        return {"ok": True, "job_id": job.id, "status": "queued", "mode": "async"}

    # ── Sync path ──────────────────────────────────────────────
    logger.info("Sync generation: root=%s mode=%s mood=%s user=%s", root_note, scale_mode, mood, user_id)
    try:
        result = _tasks_module.generate_chords(**params)
    except Exception as exc:
        logger.error("Sync generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}")

    fake_job_id = uuid.uuid4().hex
    return {"ok": True, "job_id": fake_job_id, "status": "finished", "result": result, "mode": "sync"}

# ==================== CHORD EXTRACTION ENDPOINT ====================

@app.post(
    "/api/extract-chords",
    tags=["Chord Extraction"],
    summary="Extract chords from an audio or video file",
)
async def extract_chords(
    file: UploadFile               = File(...,     description="Audio or video file"),
    file_type: str                  = Form("audio", description="'audio' or 'video'"),
    min_confidence: float           = Form(0.6,     ge=0.0, le=1.0),
    track_filter: str               = Form("all",   description="all | melody | harmony | bass"),
    keys: Optional[str]             = Form(None,    description="JSON array of keys"),
    instruments: Optional[str]      = Form(None,    description="JSON array of instruments"),
    user_id: str                    = Form("anonymous"),
    q: Optional[Queue]              = Depends(require_queue),
):
    """
    Extract chords from an audio or video file.
    - With Redis: enqueues an RQ job (202 queued) and the client polls /api/jobs/{id}.
    - Without Redis: runs extraction synchronously (slower but works without a worker).
    """
    if not _tasks_module:
        raise HTTPException(status_code=503, detail="Audio processing library not available.")

    _validate_upload(file)

    ext        = Path(file.filename or "upload").suffix.lower() or ".wav"
    saved_name = f"{uuid.uuid4().hex}{ext}"
    dest_path  = UPLOAD_DIR / saved_name

    bytes_written = await stream_save_upload(file, dest_path)

    if Metrics:
        Metrics.extractions_total.labels(file_type=file_type).inc()

    # ── Async path (Redis available) ─────────────────────────
    if q:
        job = q.enqueue(
            "tasks.extract_chords_from_file",
            str(dest_path), file_type,
            min_confidence, track_filter,
            keys or "[]", instruments or "[]",
            job_timeout=900,
        )
        logger.info("Extraction job enqueued: job_id=%s user=%s", job.id, user_id)
        return {
            "ok":       True,
            "job_id":   job.id,
            "uploaded": saved_name,
            "bytes":    bytes_written,
            "status":   "queued",
            "mode":     "async",
        }

    # ── Sync path (no Redis — run directly, may take a few seconds) ──────────
    logger.info("Sync extraction (no Redis): file=%s user=%s", saved_name, user_id)
    try:
        result = _tasks_module.extract_chords_from_file(
            str(dest_path), file_type,
            min_confidence, track_filter,
            keys or "[]", instruments or "[]",
        )
    except Exception as exc:
        logger.error("Sync extraction failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {exc}")

    fake_job_id = uuid.uuid4().hex
    logger.info("Sync extraction complete: %d chords, job_id=%s", len(result.get("chords",[])), fake_job_id)
    return {
        "ok":       True,
        "job_id":   fake_job_id,
        "uploaded": saved_name,
        "bytes":    bytes_written,
        "status":   "finished",
        "result":   result,
        "mode":     "sync",
    }

# ==================== JOB TRACKING ====================

@app.get("/api/jobs/{job_id}", tags=["Job Tracking"], summary="Poll job status and results")
def get_job_status(job_id: str, conn: redis.Redis = Depends(require_redis)):
    _assert_valid_job_id(job_id)
    try:
        job     = Job.fetch(job_id, connection=conn)
        jstatus = str(job.get_status())
        result  = job.result if jstatus == "finished" else None
        error   = (str(job.exc_info) or "Job failed.") if jstatus == "failed" else None
        return {
            "job_id": job_id,
            "status": jstatus,
            "meta": job.meta or {},
            "result": result,
            "error": error,
            "enqueued_at": job.enqueued_at.isoformat() if job.enqueued_at else None,
            "started_at":  job.started_at.isoformat()  if job.started_at  else None,
            "ended_at":    job.ended_at.isoformat()     if job.ended_at    else None,
        }
    except Exception as exc:
        logger.error("Failed to fetch job %s: %s", job_id, exc)
        raise HTTPException(status_code=404, detail="Job not found or expired.")


@app.delete("/api/jobs/{job_id}", tags=["Job Tracking"], summary="Cancel a queued job")
def cancel_job(job_id: str, conn: redis.Redis = Depends(require_redis)):
    _assert_valid_job_id(job_id)
    try:
        Job.fetch(job_id, connection=conn).cancel()
        logger.info("Job cancelled: %s", job_id)
        return {"ok": True, "job_id": job_id, "status": "cancelled"}
    except Exception as exc:
        logger.error("Failed to cancel job %s: %s", job_id, exc)
        raise HTTPException(status_code=404, detail="Job not found.")

# ==================== MIDI RENDER ====================

@app.get("/api/render", tags=["Rendering"], summary="Render a MIDI file to audio")
async def render_midi(midi: str = Query(...), force: bool = Query(False)):
    if not _tasks_module:
        raise HTTPException(status_code=503, detail="Tasks module unavailable.")
    if not _SAFE_NAME_RE.match(midi):
        raise HTTPException(status_code=422, detail="Invalid midi parameter.")
    try:
        return JSONResponse(_tasks_module.render_midi(midi, force=force))
    except Exception as exc:
        logger.error("Render error for midi=%s: %s", midi, exc)
        raise HTTPException(status_code=500, detail="Render failed.")

# ==================== DEMO ENDPOINTS ====================

@app.get("/api/demo/chords", tags=["Demo"], summary="Sample chord extraction result (no upload needed)")
def demo_chords():
    """Returns a pre-computed demo result so the frontend works without Redis."""
    return {
        "ok": True,
        "demo": True,
        "chords": [
            {"name": "Am", "time": 0.0,  "end_time": 1.8, "confidence": 0.91, "key": "A minor"},
            {"name": "F",  "time": 1.8,  "end_time": 3.6, "confidence": 0.87, "key": "A minor"},
            {"name": "C",  "time": 3.6,  "end_time": 5.4, "confidence": 0.89, "key": "A minor"},
            {"name": "G",  "time": 5.4,  "end_time": 7.2, "confidence": 0.85, "key": "A minor"},
            {"name": "Am", "time": 7.2,  "end_time": 9.0, "confidence": 0.92, "key": "A minor"},
            {"name": "F",  "time": 9.0,  "end_time": 10.8,"confidence": 0.88, "key": "A minor"},
            {"name": "C",  "time": 10.8, "end_time": 12.6,"confidence": 0.90, "key": "A minor"},
            {"name": "E",  "time": 12.6, "end_time": 14.4,"confidence": 0.83, "key": "A minor"},
        ],
        "metadata": {
            "key": "A minor",
            "bpm": 120.0,
            "duration": 14.4,
            "time_signature": "4/4",
            "total_chords": 8,
        },
    }


@app.get("/api/demo/generate", tags=["Demo"], summary="Sample generation result (no processing needed)")
def demo_generate():
    return {
        "ok": True,
        "demo": True,
        "generation": {
            "style": "pop",
            "key": "A minor",
            "bpm": 120,
            "suggested_progressions": ["Am - F - C - G", "Am - F - C - E"],
        },
    }

# ==================== SYSTEM ENDPOINTS ====================

@app.get("/metrics", tags=["System"], include_in_schema=ENVIRONMENT != "production")
def prometheus_metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/health", tags=["System"], summary="Liveness and readiness health check")
def health_check():
    redis_ok = False
    if redis_conn:
        try:
            redis_conn.ping()
            redis_ok = True
        except Exception:
            pass

    # Always return 200 so the frontend checkStatus() call doesn't throw.
    # The subsystems block tells callers which services are actually up.
    # Use 503 only when the API process itself cannot serve requests.
    return JSONResponse(
        status_code=200,
        content={
            "ok": True,
            "environment": ENVIRONMENT,
            "subsystems": {
                "redis":  "connected"   if redis_ok      else "disconnected",
                "queue":  "available"   if task_queue    else "unavailable",
                "tasks":  "loaded"      if _tasks_module else "not loaded",
                "auth":   "loaded"      if auth_router   else "not loaded",
            },
        },
    )


# ==================== SPA CATCH-ALL ====================

@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    """Serve the React SPA for any unmatched route."""
    index = FRONTEND_DIST / "index.html"
    if index.is_file():
        return FileResponse(str(index), media_type="text/html")
    # Fallback landing page when frontend is not built yet
    return HTMLResponse(_fallback_html())


def _fallback_html() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>KalzTunz API</title>
    <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:2rem}
        .container{max-width:900px;margin:0 auto}
        h1{font-size:2rem;color:#818cf8;margin-bottom:.4rem}
        .tagline{color:#94a3b8;margin-bottom:2rem}
        .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.25rem}
        .card{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:1.4rem}
        .card h2{font-size:1rem;color:#818cf8;margin-bottom:.75rem}
        ul{list-style:none}li{margin:.4rem 0}
        a{color:#818cf8;text-decoration:none}a:hover{text-decoration:underline}
        .badge{background:#22c55e22;color:#22c55e;border-radius:999px;padding:.1rem .6rem;font-size:.75rem;font-weight:600;margin-left:.4rem}
        footer{margin-top:3rem;color:#475569;font-size:.8rem;text-align:center}
    </style>
</head>
<body><div class="container">
    <h1>🎵 KalzTunz API</h1>
    <p class="tagline">AI-powered music creation &amp; chord extraction — v2.1.0</p>
    <div class="grid">
        <div class="card"><h2>📚 Docs</h2><ul>
            <li><a href="/docs">Swagger UI</a><span class="badge">interactive</span></li>
            <li><a href="/redoc">ReDoc</a></li>
        </ul></div>
        <div class="card"><h2>🚀 Endpoints</h2><ul>
            <li>POST /api/upload</li>
            <li>POST /api/extract-chords</li>
            <li>GET  /api/jobs/{job_id}</li>
            <li>GET  /api/demo/chords</li>
        </ul></div>
        <div class="card"><h2>💚 System</h2><ul>
            <li><a href="/health">Health Check</a></li>
            <li><a href="/metrics">Metrics</a></li>
        </ul></div>
    </div>
    <footer>© 2025 KalzTunz</footer>
</div></body></html>"""


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8000")),
        reload=ENVIRONMENT == "development",
        log_level="info",
    )
