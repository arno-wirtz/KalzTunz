#!/usr/bin/env python3
"""
SQLAlchemy models for KalzTunz
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Index, Integer, JSON, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from backend.database import Base


# ==================== HELPERS ====================

def utcnow() -> datetime:
    """Timezone-aware UTC now. Pass as callable default to Column()."""
    return datetime.now(timezone.utc)


# ==================== ENUMS ====================

class JobStatus(str, enum.Enum):
    QUEUED   = "queued"
    STARTED  = "started"
    FINISHED = "finished"
    FAILED   = "failed"
    STOPPED  = "stopped"


class ExtractionType(str, enum.Enum):
    AUDIO = "audio"
    VIDEO = "video"


# ==================== USERS ====================

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("idx_users_email",    "email"),
        Index("idx_users_username", "username"),
        Index("idx_users_created",  "created_at"),
    )

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username         = Column(String(100),  unique=True, nullable=False, index=True)
    email            = Column(String(255),  unique=True, nullable=False, index=True)
    hashed_password  = Column(String(255),  nullable=True)

    # OAuth providers — store provider + provider user ID for SSO
    oauth_provider   = Column(String(50),   nullable=True)   # "google" | "github" | None
    oauth_id         = Column(String(255),  nullable=True)

    # Profile
    profile_pic      = Column(String(500),  default="https://api.dicebear.com/7.x/avataaars/svg")
    bio              = Column(Text,         default="")
    full_name        = Column(String(255),  default="")
    location         = Column(String(255),  default="")
    website          = Column(String(500),  default="")

    # Account
    verified             = Column(Boolean, default=False)
    is_active            = Column(Boolean, default=True)
    language             = Column(String(10),  default="en")
    theme                = Column(String(20),  default="dark")
    email_notifications  = Column(Boolean, default=True)
    verification_token   = Column(String(255), nullable=True)

    # Relationships
    extractions   = relationship("Extraction",   back_populates="owner",  cascade="all, delete-orphan")
    generations   = relationship("Generation",   back_populates="owner",  cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user",   cascade="all, delete-orphan")
    tracks        = relationship("Track",        back_populates="owner",  cascade="all, delete-orphan")

    # followers_rel  = users who follow THIS user
    # following_rel  = auto backref: users THIS user follows
    followers_rel = relationship(
        "User",
        secondary="user_followers",
        primaryjoin="User.id == UserFollowers.following_id",
        secondaryjoin="User.id == UserFollowers.follower_id",
        backref="following_rel",
    )

    created_at = Column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    last_login = Column(DateTime(timezone=True), nullable=True)


# ==================== FOLLOWERS ====================

class UserFollowers(Base):
    __tablename__ = "user_followers"
    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="unique_follow"),
        Index("idx_followers_follower",  "follower_id"),
        Index("idx_followers_following", "following_id"),
    )

    follower_id  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    following_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at   = Column(DateTime(timezone=True), default=utcnow)


# ==================== NOTIFICATIONS ====================

class Notification(Base):
    """In-app notifications (follow, like, comment, system alerts)."""
    __tablename__ = "notifications"
    __table_args__ = (
        Index("idx_notifications_user",   "user_id"),
        Index("idx_notifications_unread", "is_read"),
    )

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type        = Column(String(50),  nullable=False)   # "follow" | "like" | "comment" | "system"
    title       = Column(String(255), nullable=False)
    body        = Column(Text,        default="")
    is_read     = Column(Boolean,     default=False)
    action_url  = Column(String(500), nullable=True)
    meta        = Column(JSON,        default=dict)

    created_at  = Column(DateTime(timezone=True), default=utcnow, index=True)

    user = relationship("User", back_populates="notifications")


# ==================== TRACKS ====================

class Track(Base):
    """Public tracks — generated or uploaded by users."""
    __tablename__ = "tracks"
    __table_args__ = (
        Index("idx_tracks_user",       "user_id"),
        Index("idx_tracks_created",    "created_at"),
        Index("idx_tracks_play_count", "play_count"),
    )

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    title        = Column(String(255), nullable=False)
    description  = Column(Text,        default="")
    style        = Column(String(50),  nullable=True)
    audio_url    = Column(String(500), nullable=True)
    cover_url    = Column(String(500), nullable=True)
    duration     = Column(Integer,     default=0)     # seconds
    bpm          = Column(Integer,     nullable=True)
    key          = Column(String(20),  nullable=True)

    play_count      = Column(Integer, default=0)
    like_count      = Column(Integer, default=0)
    download_count  = Column(Integer, default=0)

    is_public    = Column(Boolean, default=True)
    meta         = Column(JSON,    default=dict)

    created_at   = Column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at   = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    owner = relationship("User", back_populates="tracks")


# ==================== EXTRACTIONS ====================

class Extraction(Base):
    __tablename__ = "extractions"
    __table_args__ = (
        Index("idx_extractions_user",    "user_id"),
        Index("idx_extractions_created", "created_at"),
    )

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id           = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    title             = Column(String(255), nullable=False)
    file_type         = Column(String(20),  default=ExtractionType.AUDIO.value)
    original_filename = Column(String(500))

    chords            = Column(JSON, default=list)
    extra_data        = Column(JSON, default=dict)  # renamed from metadata (reserved by SQLAlchemy Declarative API)
    filters           = Column(JSON, default=dict)

    file_url          = Column(String(500), nullable=True)
    chord_sheet_url   = Column(String(500), nullable=True)

    created_at        = Column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at        = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    owner = relationship("User", back_populates="extractions")


# ==================== GENERATIONS ====================

class Generation(Base):
    __tablename__ = "generations"
    __table_args__ = (
        Index("idx_generations_user",    "user_id"),
        Index("idx_generations_created", "created_at"),
    )

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    title         = Column(String(255), nullable=False)
    style         = Column(String(50))
    mood          = Column(String(50))
    duration      = Column(Integer)
    bpm           = Column(Integer)
    key           = Column(String(10))
    instruments   = Column(JSON, default=list)
    voice         = Column(String(50))

    extra_data    = Column(JSON, default=dict)  # renamed from metadata
    audio_url     = Column(String(500), nullable=True)
    chord_sheet_url = Column(String(500), nullable=True)
    chords        = Column(JSON, default=list)

    job_id        = Column(String(100), unique=True)
    job_status    = Column(String(20),  default=JobStatus.QUEUED.value)

    created_at    = Column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at    = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    completed_at  = Column(DateTime(timezone=True), nullable=True)

    owner = relationship("User", back_populates="generations")


# ==================== LIBRARY ====================

class LibraryItem(Base):
    __tablename__ = "library_items"
    __table_args__ = (
        Index("idx_library_user", "user_id"),
        Index("idx_library_type", "item_type"),
    )

    id        = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    item_type = Column(String(20))
    item_id   = Column(String(100))
    title     = Column(String(255))
    extra_data = Column(JSON, default=dict)  # renamed from metadata

    created_at = Column(DateTime(timezone=True), default=utcnow, index=True)
    added_at   = Column(DateTime(timezone=True), default=utcnow)


# ==================== JOBS ====================

class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        Index("idx_jobs_user",   "user_id"),
        Index("idx_jobs_status", "status"),
    )

    id       = Column(String(100), primary_key=True)
    user_id  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)

    job_type = Column(String(50))
    status   = Column(String(20),  default=JobStatus.QUEUED.value)

    progress = Column(Float,  default=0.0)
    meta     = Column(JSON,   default=dict)
    result   = Column(JSON,   default=dict)
    error    = Column(Text,   nullable=True)

    created_at   = Column(DateTime(timezone=True), default=utcnow, index=True)
    started_at   = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
