#!/usr/bin/env python3
"""
KalzTunz — main.py
===================
Standard Python entry-point alias.

The FastAPI application lives in app.py (named that way so
`uvicorn app:app` works without any extra flags).  This file
simply re-exports everything so that tools expecting main.py
(pytest imports, some IDE run configs, Gunicorn, etc.) work
without any changes.

Usage
-----
    # Dev server via main.py
    python main.py

    # Or directly via uvicorn (recommended)
    uvicorn app:app --reload --port 8000

    # Or via main module syntax
    python -m main
"""

from app import app  # noqa: F401 — re-export for tools that look for main:app

if __name__ == "__main__":
    import uvicorn
    import os

    uvicorn.run(
        "app:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("ENVIRONMENT", "development") == "development",
        log_level=os.getenv("LOG_LEVEL", "info"),
    )
