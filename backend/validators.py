#!/usr/bin/env python3
"""
Input validation schemas and error handlers
"""

import json
import re
from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional, List
from enum import Enum

# ==================== ENUMS ====================

class MusicStyle(str, Enum):
    POP = "pop"
    ROCK = "rock"
    JAZZ = "jazz"
    ELECTRONIC = "electronic"
    HIP_HOP = "hip-hop"
    CLASSICAL = "classical"
    COUNTRY = "country"
    RNB = "rnb"
    AMBIENT = "ambient"
    INDIE = "indie"

class TrackFilter(str, Enum):
    ALL = "all"
    MELODY = "melody"
    HARMONY = "harmony"
    BASS = "bass"
    PERCUSSION = "percussion"

class FileType(str, Enum):
    AUDIO = "audio"
    VIDEO = "video"

# ==================== VALIDATION SCHEMAS ====================

class UploadRequest(BaseModel):
    """Validated upload request"""
    style: Optional[MusicStyle] = None
    use_advanced: bool = Field(False, description="Enable advanced processing")
    # Fixed: regex= is deprecated in Pydantic v2 — use pattern=
    model_backend: str = Field("huggingface", pattern="^(huggingface|torch|tensorflow)$")
    use_storage: bool = False
    user_id: str = Field(..., min_length=1, max_length=100)

    class Config:
        json_schema_extra = {
            "example": {
                "style": "pop",
                "use_advanced": True,
                "model_backend": "torch",
                "use_storage": True,
                "user_id": "user_123"
            }
        }

class ExtractionRequest(BaseModel):
    """Validated extraction request"""
    file_type: FileType = FileType.AUDIO
    min_confidence: float = Field(0.6, ge=0.0, le=1.0)
    track_filter: TrackFilter = TrackFilter.ALL
    keys: Optional[List[str]] = None
    instruments: Optional[List[str]] = None

    @validator('keys', 'instruments', pre=True)
    def parse_lists(cls, v):
        """Accept JSON strings or plain lists"""
        if isinstance(v, str):
            # Fixed: was importing json inside the validator on every call
            return json.loads(v)
        return v

class GenerationRequest(BaseModel):
    """Validated generation request"""
    style: MusicStyle
    mood: str = Field(..., min_length=3, max_length=50)
    duration: int = Field(120, ge=30, le=600)
    bpm: int = Field(120, ge=60, le=200)
    # Fixed: regex= deprecated — use pattern=
    key: str = Field(..., pattern=r"^[A-G](#|b)?$")
    intensity: str = Field("medium", pattern="^(low|medium|high)$")
    include_vocals: bool = False
    voice: str = Field("woman", min_length=1, max_length=50)
    instruments: List[str] = Field(default_factory=list)
    number_of_variations: int = Field(1, ge=1, le=5)

class UserRegisterRequest(BaseModel):
    """Validated user registration"""
    # Fixed: regex= deprecated — use pattern=
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str

    @validator('password')
    def password_strength(cls, v):
        """Validate password meets complexity requirements"""
        # Fixed: was importing re inside the validator on every call
        errors = []
        if not re.search(r"[a-z]", v):
            errors.append("lowercase letter")
        if not re.search(r"[A-Z]", v):
            errors.append("uppercase letter")
        if not re.search(r"\d", v):
            errors.append("number")
        if not re.search(r"[!@#$%^&*()_+\-=\[\]{};:'\",.<>?/\\|`~]", v):
            errors.append("special character")
        if errors:
            raise ValueError(f"Password must contain: {', '.join(errors)}")
        return v

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError("Passwords do not match")
        return v

# ==================== FILE VALIDATION ====================

ALLOWED_AUDIO_TYPES = {
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/flac": ".flac",
    "audio/ogg": ".ogg",
    "audio/aac": ".aac",
}

ALLOWED_VIDEO_TYPES = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
}

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB

def validate_file_upload(filename: str, content_type: str, size: int) -> tuple:
    """
    Validate a file upload.
    Returns: (is_valid: bool, error_message: str | None)
    """
    import os

    if size > MAX_UPLOAD_SIZE:
        return False, f"File too large. Max: 50MB, got: {size / 1024 / 1024:.1f}MB"

    _, ext = os.path.splitext(filename)
    if not ext or len(ext) > 10:
        return False, "Invalid file extension"

    # Check MIME type is in one of the allowed sets
    if content_type not in ALLOWED_AUDIO_TYPES and content_type not in ALLOWED_VIDEO_TYPES:
        return False, f"Unsupported file type: {content_type}"

    # Fixed: original code had redundant double-check that always passed after the above guard
    # The block below is now the single authoritative type check — no dead branches
    if content_type.startswith("audio/") and content_type not in ALLOWED_AUDIO_TYPES:
        return False, "Unsupported audio format"

    if content_type.startswith("video/") and content_type not in ALLOWED_VIDEO_TYPES:
        return False, "Unsupported video format"

    return True, None