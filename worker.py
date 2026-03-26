#!/usr/bin/env python3
"""
RQ Worker for KalzTunz
Processes background jobs from the task queue
"""

import os
import sys
import logging
from urllib.parse import urlparse

from redis import Redis
from rq import Worker, Queue

# Use the same logging config as the rest of the backend
try:
    import backend.logging_config  # noqa: F401 — imported for side effects
except Exception:
    # Fallback if backend package is not on the path
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

logger = logging.getLogger(__name__)

# ==================== CONFIGURATION ====================

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Queue names must match those used in app.py (was "high"/"default"/"low" — wrong)
# Priority order: highest priority first
QUEUE_NAMES = os.environ.get("WORKER_QUEUES", "kalztunz").split(",")

# Allow burst mode via env so production supervisors can control it
# without code changes (e.g. WORKER_BURST=true for one-shot batch runs)
BURST_MODE = os.environ.get("WORKER_BURST", "false").lower() == "true"

# ==================== ENTRYPOINT ====================

if __name__ == "__main__":

    # ---- Connect to Redis ----
    redis_conn = Redis.from_url(REDIS_URL)

    # Redact password from URL before logging
    try:
        _parsed   = urlparse(REDIS_URL)
        _safe_url = _parsed._replace(netloc=_parsed.netloc.replace(
            f":{_parsed.password}@", ":***@"
        ) if _parsed.password else _parsed.netloc).geturl()
    except Exception:
        _safe_url = "redis://***"

    try:
        redis_conn.ping()
        logger.info("Redis connected: %s", _safe_url)
    except Exception as exc:
        logger.error("Cannot connect to Redis at %s: %s", _safe_url, exc)
        sys.exit(1)

    # ---- Build queues ----
    # Fixed: was "high"/"default"/"low" — app.py enqueues to "kalztunz"
    # Fixed: removed deprecated Connection() context manager (removed in RQ 1.16+)
    queues = [Queue(name.strip(), connection=redis_conn) for name in QUEUE_NAMES]

    logger.info(
        "Starting RQ worker (burst=%s) on queues: %s",
        BURST_MODE,
        ", ".join(q.name for q in queues),
    )

    # ---- Start worker ----
    # with_scheduler=True enables RQ's built-in periodic job scheduler.
    # Concurrency is controlled externally — run multiple worker processes
    # via a Procfile, systemd units, or a container replica set.
    worker = Worker(queues, connection=redis_conn)
    worker.work(with_scheduler=True, burst=BURST_MODE)