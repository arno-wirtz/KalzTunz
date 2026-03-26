#!/usr/bin/env python3
"""
KalzTunz Authentication
Supports: JWT (username/email + password), Google OAuth2, GitHub OAuth2
"""

import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field, validator
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Notification, User
from backend.password_strength import password_validator

logger = logging.getLogger(__name__)

# ==================== CONFIG ====================

SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    import warnings
    warnings.warn("SECRET_KEY not set — using insecure dev key. Set SECRET_KEY in production!")
    SECRET_KEY = "dev-insecure-key-change-in-production"

ALGORITHM                    = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES  = 15
REFRESH_TOKEN_EXPIRE_DAYS    = 30

# Google OAuth
GOOGLE_CLIENT_ID      = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET  = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI   = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")

# GitHub OAuth
GITHUB_CLIENT_ID      = os.environ.get("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET  = os.environ.get("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI   = os.environ.get("GITHUB_REDIRECT_URI", "http://localhost:8000/api/auth/github/callback")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# ==================== RATE LIMITER ====================

from collections import defaultdict
from time import time as _time

class _RateLimiter:
    """Sliding-window in-process rate limiter. Replace with Redis-backed in multi-worker setups."""
    def __init__(self, max_attempts: int = 5, window: int = 300):
        self._attempts: dict = defaultdict(list)
        self.max  = max_attempts
        self.win  = window

    def is_allowed(self, key: str) -> bool:
        now = _time()
        self._attempts[key] = [t for t in self._attempts[key] if now - t < self.win]
        if len(self._attempts[key]) >= self.max:
            return False
        self._attempts[key].append(now)
        return True

_limiter = _RateLimiter()

# ==================== HELPERS ====================

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: str, username: str) -> Tuple[str, int]:
    expire = utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id, "username": username, "type": "access",
        "exp": int(expire.timestamp()), "iat": int(utcnow().timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM), ACCESS_TOKEN_EXPIRE_MINUTES * 60

def create_refresh_token(user_id: str, username: str) -> str:
    expire = utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id, "username": username, "type": "refresh",
        "exp": int(expire.timestamp()), "iat": int(utcnow().timestamp()),
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def _token_response(user: User) -> dict:
    access_token, expires_in = create_access_token(str(user.id), user.username)
    refresh_token = create_refresh_token(str(user.id), user.username)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "user": {
            "id":          str(user.id),
            "username":    user.username,
            "email":       user.email,
            "profile_pic": user.profile_pic,
            "bio":         user.bio or "",
            "full_name":   user.full_name or "",
            "location":    user.location or "",
            "website":     user.website or "",
            "verified":    user.verified,
        },
    }

# ==================== CURRENT USER DEPENDENCY ====================

async def get_current_user(
    token: str   = Depends(oauth2_scheme),
    db: Session  = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_optional_user(
    token: str   = Depends(oauth2_scheme),
    db: Session  = Depends(get_db),
) -> Optional[User]:
    """Like get_current_user but returns None instead of 401 — used for public endpoints."""
    if not token:
        return None
    try:
        return await get_current_user(token=token, db=db)
    except HTTPException:
        return None

# ==================== REQUEST MODELS ====================

class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    confirm_password: str

    @validator("password")
    def validate_password_strength(cls, v):
        is_valid, errors, _ = password_validator.validate(v)
        if not is_valid:
            raise ValueError(errors[0])
        return v

    @validator("confirm_password")
    def passwords_match(cls, v, values):
        if "password" in values and v != values["password"]:
            raise ValueError("Passwords do not match")
        return v

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# ==================== ROUTER ====================

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# ---------- JWT: REGISTER ----------

@router.post("/register", summary="Register with username + password")
async def register(user_data: UserRegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=409, detail="Username already taken")
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        id=uuid.uuid4(),
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        verification_token=secrets.token_urlsafe(32),
        created_at=utcnow(),
    )
    db.add(user)
    db.flush()

    # Welcome notification
    db.add(Notification(
        user_id=user.id,
        type="system",
        title="Welcome to KalzTunz! 🎵",
        body="Start by uploading a track or exploring the chord extractor.",
    ))
    db.commit()
    db.refresh(user)

    logger.info("User registered: id=%s username=%s", user.id, user.username)
    return _token_response(user)

# ---------- JWT: LOGIN ----------

@router.post("/login", summary="Login with username/email + password")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    if not _limiter.is_allowed(f"login:{client_ip}"):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again in 5 minutes.")

    user = (
        db.query(User)
        .filter(
            (User.username == form_data.username) | (User.email == form_data.username),
            User.is_active == True,
        )
        .first()
    )

    if not user or not user.hashed_password or not verify_password(form_data.password, user.hashed_password):
        logger.warning("Failed login from ip=%s", client_ip)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user.last_login = utcnow()
    db.commit()

    logger.info("User logged in: id=%s", user.id)
    return _token_response(user)

# ---------- JWT: REFRESH ----------

@router.post("/refresh", summary="Refresh an access token")
async def refresh_access_token(body: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(body.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return _token_response(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---------- ME ----------

@router.get("/me", summary="Get current user profile")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id":             str(current_user.id),
        "username":       current_user.username,
        "email":          current_user.email,
        "profile_pic":    current_user.profile_pic,
        "bio":            current_user.bio or "",
        "full_name":      current_user.full_name or "",
        "location":       current_user.location or "",
        "website":        current_user.website or "",
        "verified":       current_user.verified,
        "oauth_provider": current_user.oauth_provider,
        "created_at":     current_user.created_at.isoformat() if current_user.created_at else None,
        "last_login":     current_user.last_login.isoformat()  if current_user.last_login  else None,
    }

# ==================== GOOGLE OAUTH ====================

@router.get("/google", summary="Redirect to Google OAuth consent screen")
async def google_login():
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.")
    state = secrets.token_urlsafe(16)
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        f"&state={state}"
    )
    return RedirectResponse(url)


@router.get("/google/callback", summary="Google OAuth callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google OAuth not configured.")
    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        token_data = token_resp.json()
        if "error" in token_data:
            raise HTTPException(status_code=400, detail=f"Google error: {token_data['error']}")

        # Get user info
        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        google_user = user_resp.json()

    google_id = google_user.get("sub")
    email     = google_user.get("email", "")
    name      = google_user.get("name", email.split("@")[0])
    picture   = google_user.get("picture", "")

    # Find or create user
    user = db.query(User).filter(User.oauth_id == google_id, User.oauth_provider == "google").first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.oauth_provider = "google"
            user.oauth_id       = google_id
        else:
            # Generate unique username from name
            base_username = re.sub(r"[^a-zA-Z0-9_]", "", name.replace(" ", "_"))[:40] or "user"
            username = base_username
            suffix = 1
            while db.query(User).filter(User.username == username).first():
                username = f"{base_username}{suffix}"
                suffix += 1

            user = User(
                id=uuid.uuid4(),
                username=username,
                email=email,
                profile_pic=picture,
                full_name=name,
                oauth_provider="google",
                oauth_id=google_id,
                verified=True,
                created_at=utcnow(),
            )
            db.add(user)
            db.flush()
            db.add(Notification(user_id=user.id, type="system",
                                title="Welcome to KalzTunz! 🎵",
                                body="Your Google account is now connected."))
        db.commit()
        db.refresh(user)

    user.last_login = utcnow()
    db.commit()

    tokens = _token_response(user)
    # Redirect to frontend with tokens in query params (use short-lived code in prod)
    redirect_url = (
        f"{FRONTEND_URL}/auth/callback"
        f"?access_token={tokens['access_token']}"
        f"&refresh_token={tokens['refresh_token']}"
    )
    return RedirectResponse(redirect_url)


# ==================== GITHUB OAUTH ====================

@router.get("/github", summary="Redirect to GitHub OAuth consent screen")
async def github_login():
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=501, detail="GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.")
    state = secrets.token_urlsafe(16)
    url = (
        "https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={GITHUB_REDIRECT_URI}"
        "&scope=user:email"
        f"&state={state}"
    )
    return RedirectResponse(url)


@router.get("/github/callback", summary="GitHub OAuth callback")
async def github_callback(code: str, db: Session = Depends(get_db)):
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=501, detail="GitHub OAuth not configured.")
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_REDIRECT_URI,
            },
        )
        token_data = token_resp.json()
        if "error" in token_data:
            raise HTTPException(status_code=400, detail=f"GitHub error: {token_data['error']}")

        gh_access_token = token_data.get("access_token", "")
        headers = {"Authorization": f"Bearer {gh_access_token}", "Accept": "application/json"}

        user_resp  = await client.get("https://api.github.com/user",   headers=headers)
        email_resp = await client.get("https://api.github.com/user/emails", headers=headers)

        github_user = user_resp.json()
        emails_data = email_resp.json()

    github_id = str(github_user.get("id", ""))
    login     = github_user.get("login", "")
    name      = github_user.get("name", login)
    avatar    = github_user.get("avatar_url", "")

    # Pick primary verified email
    email = next(
        (e["email"] for e in emails_data if isinstance(e, dict) and e.get("primary") and e.get("verified")),
        f"{login}@github.noreply.com",
    )

    user = db.query(User).filter(User.oauth_id == github_id, User.oauth_provider == "github").first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.oauth_provider = "github"
            user.oauth_id       = github_id
        else:
            base_username = re.sub(r"[^a-zA-Z0-9_]", "", login)[:40] or "user"
            username = base_username
            suffix = 1
            while db.query(User).filter(User.username == username).first():
                username = f"{base_username}{suffix}"
                suffix += 1

            user = User(
                id=uuid.uuid4(),
                username=username,
                email=email,
                profile_pic=avatar,
                full_name=name or login,
                oauth_provider="github",
                oauth_id=github_id,
                verified=True,
                created_at=utcnow(),
            )
            db.add(user)
            db.flush()
            db.add(Notification(user_id=user.id, type="system",
                                title="Welcome to KalzTunz! 🎵",
                                body="Your GitHub account is now connected."))
        db.commit()
        db.refresh(user)

    user.last_login = utcnow()
    db.commit()

    tokens = _token_response(user)
    redirect_url = (
        f"{FRONTEND_URL}/auth/callback"
        f"?access_token={tokens['access_token']}"
        f"&refresh_token={tokens['refresh_token']}"
    )
    return RedirectResponse(redirect_url)


# ==================== LOGOUT ----------

@router.post("/logout", summary="Invalidate session (client should discard tokens)")
async def logout(current_user: User = Depends(get_current_user)):
    # Stateless JWT — real revocation needs a Redis blocklist (jti-based)
    logger.info("User logged out: id=%s", current_user.id)
    return {"ok": True, "message": "Logged out successfully"}

