#!/usr/bin/env python3
"""
Security utilities and middleware for KalzTunz
"""

import os
import logging
from fastapi import FastAPI, Request
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger(__name__)

# One global limiter used everywhere (attached to app.state below).
limiter = Limiter(key_func=get_remote_address)


def add_security_middleware(app: FastAPI) -> Limiter:
    """
    Register all security middleware on the FastAPI app.

    Middleware is applied in reverse registration order by Starlette,
    so the order here matters:
      1. SecurityHeaders  — outermost, runs last on response
      2. CORS             — must run before TrustedHost rejects the request
      3. TrustedHost      — rejects bad Host headers early
      4. HTTPSRedirect    — only in production
    """

    # Rate limiting — attach the global limiter to app state
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # HTTPS redirect — production only
    if os.getenv("ENVIRONMENT") == "production":
        app.add_middleware(HTTPSRedirectMiddleware)

    # Trusted hosts — split and strip whitespace to tolerate "host1, host2" env values
    raw_hosts = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,*.onrender.com")
    allowed_hosts = [h.strip() for h in raw_hosts.split(",") if h.strip()]
    # Always allow the wildcard so Render / any reverse proxy works
    if "*" not in allowed_hosts and "*.onrender.com" not in allowed_hosts:
        allowed_hosts.append("*.onrender.com")
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

    # CORS
    raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    cors_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        # FIXED: PATCH was missing from this list. /api/auth/profile is a
        # PATCH endpoint (Settings.jsx "Save Changes" button). Same-origin
        # requests never trigger a CORS preflight, which is why this went
        # unnoticed in the unified single-service deployment — but any
        # cross-origin setup (frontend hosted on a separate domain from the
        # API) would have every profile save silently fail at the preflight.
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        # allow_headers=["*"] with allow_credentials=True is rejected by
        # browsers (CORS spec forbids wildcard + credentials). List explicitly.
        allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID"],
        max_age=3600,
    )

    # Security response headers
    app.add_middleware(SecurityHeadersMiddleware)

    logger.info("Security middleware registered (env=%s)", os.getenv("ENVIRONMENT", "development"))
    return limiter


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach security-related HTTP response headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # Only send HSTS over HTTPS — sending it over HTTP is ignored and wasteful
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; "
            "script-src 'self'; "
            "style-src 'self'; "
            "img-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'"
        )

        return response
