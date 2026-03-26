"""Initial schema — all KalzTunz tables

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users ────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id",                 postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("username",           sa.String(100),  nullable=False, unique=True),
        sa.Column("email",              sa.String(255),  nullable=False, unique=True),
        sa.Column("hashed_password",    sa.String(255),  nullable=True),
        sa.Column("oauth_provider",     sa.String(50),   nullable=True),
        sa.Column("oauth_id",           sa.String(255),  nullable=True),
        sa.Column("profile_pic",        sa.String(500),  nullable=True),
        sa.Column("bio",                sa.Text,         nullable=True),
        sa.Column("full_name",          sa.String(255),  nullable=True),
        sa.Column("location",           sa.String(255),  nullable=True),
        sa.Column("website",            sa.String(500),  nullable=True),
        sa.Column("verified",           sa.Boolean,      default=False),
        sa.Column("is_active",          sa.Boolean,      default=True),
        sa.Column("language",           sa.String(10),   default="en"),
        sa.Column("theme",              sa.String(20),   default="dark"),
        sa.Column("email_notifications",sa.Boolean,      default=True),
        sa.Column("verification_token", sa.String(255),  nullable=True),
        sa.Column("created_at",         sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at",         sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login",         sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_users_email",    "users", ["email"])
    op.create_index("idx_users_username", "users", ["username"])
    op.create_index("idx_users_created",  "users", ["created_at"])

    # ── user_followers ──────────────────────────────────────
    op.create_table(
        "user_followers",
        sa.Column("follower_id",  postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("following_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("follower_id", "following_id", name="unique_follow"),
    )
    op.create_index("idx_followers_follower",  "user_followers", ["follower_id"])
    op.create_index("idx_followers_following", "user_followers", ["following_id"])

    # ── notifications ───────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id",         postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id",    postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type",       sa.String(50),  nullable=False),
        sa.Column("title",      sa.String(255), nullable=False),
        sa.Column("body",       sa.Text,        nullable=True),
        sa.Column("is_read",    sa.Boolean,     default=False),
        sa.Column("action_url", sa.String(500), nullable=True),
        sa.Column("meta",       sa.JSON,        nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_notifications_user",   "notifications", ["user_id"])
    op.create_index("idx_notifications_unread", "notifications", ["is_read"])

    # ── tracks ──────────────────────────────────────────────
    op.create_table(
        "tracks",
        sa.Column("id",            postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id",       postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title",         sa.String(255), nullable=False),
        sa.Column("description",   sa.Text,        nullable=True),
        sa.Column("style",         sa.String(50),  nullable=True),
        sa.Column("audio_url",     sa.String(500), nullable=True),
        sa.Column("cover_url",     sa.String(500), nullable=True),
        sa.Column("duration",      sa.Integer,     default=0),
        sa.Column("bpm",           sa.Integer,     nullable=True),
        sa.Column("key",           sa.String(20),  nullable=True),
        sa.Column("play_count",    sa.Integer,     default=0),
        sa.Column("like_count",    sa.Integer,     default=0),
        sa.Column("download_count",sa.Integer,     default=0),
        sa.Column("is_public",     sa.Boolean,     default=True),
        sa.Column("meta",          sa.JSON,        nullable=True),
        sa.Column("created_at",    sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at",    sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_tracks_user",       "tracks", ["user_id"])
    op.create_index("idx_tracks_created",    "tracks", ["created_at"])
    op.create_index("idx_tracks_play_count", "tracks", ["play_count"])

    # ── extractions ─────────────────────────────────────────
    op.create_table(
        "extractions",
        sa.Column("id",                postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id",           postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title",             sa.String(255), nullable=False),
        sa.Column("file_type",         sa.String(20),  nullable=True),
        sa.Column("original_filename", sa.String(500), nullable=True),
        sa.Column("chords",            sa.JSON,        nullable=True),
        sa.Column("metadata",          sa.JSON,        nullable=True),
        sa.Column("filters",           sa.JSON,        nullable=True),
        sa.Column("file_url",          sa.String(500), nullable=True),
        sa.Column("chord_sheet_url",   sa.String(500), nullable=True),
        sa.Column("created_at",        sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at",        sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_extractions_user",    "extractions", ["user_id"])
    op.create_index("idx_extractions_created", "extractions", ["created_at"])

    # ── generations ─────────────────────────────────────────
    op.create_table(
        "generations",
        sa.Column("id",             postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id",        postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title",          sa.String(255), nullable=False),
        sa.Column("style",          sa.String(50),  nullable=True),
        sa.Column("mood",           sa.String(50),  nullable=True),
        sa.Column("duration",       sa.Integer,     nullable=True),
        sa.Column("bpm",            sa.Integer,     nullable=True),
        sa.Column("key",            sa.String(10),  nullable=True),
        sa.Column("instruments",    sa.JSON,        nullable=True),
        sa.Column("voice",          sa.String(50),  nullable=True),
        sa.Column("metadata",       sa.JSON,        nullable=True),
        sa.Column("audio_url",      sa.String(500), nullable=True),
        sa.Column("chord_sheet_url",sa.String(500), nullable=True),
        sa.Column("chords",         sa.JSON,        nullable=True),
        sa.Column("job_id",         sa.String(100), unique=True, nullable=True),
        sa.Column("job_status",     sa.String(20),  nullable=True),
        sa.Column("created_at",     sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at",     sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at",   sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_generations_user",    "generations", ["user_id"])
    op.create_index("idx_generations_created", "generations", ["created_at"])

    # ── library_items ────────────────────────────────────────
    op.create_table(
        "library_items",
        sa.Column("id",        postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id",   postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_type", sa.String(20),  nullable=True),
        sa.Column("item_id",   sa.String(100), nullable=True),
        sa.Column("title",     sa.String(255), nullable=True),
        sa.Column("metadata",  sa.JSON,        nullable=True),
        sa.Column("created_at",sa.DateTime(timezone=True), nullable=True),
        sa.Column("added_at",  sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_library_user", "library_items", ["user_id"])
    op.create_index("idx_library_type", "library_items", ["item_type"])

    # ── jobs ─────────────────────────────────────────────────
    op.create_table(
        "jobs",
        sa.Column("id",           sa.String(100), primary_key=True),
        sa.Column("user_id",      postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("job_type",     sa.String(50),  nullable=True),
        sa.Column("status",       sa.String(20),  nullable=True),
        sa.Column("progress",     sa.Float,       default=0.0),
        sa.Column("meta",         sa.JSON,        nullable=True),
        sa.Column("result",       sa.JSON,        nullable=True),
        sa.Column("error",        sa.Text,        nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at",   sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_jobs_user",   "jobs", ["user_id"])
    op.create_index("idx_jobs_status", "jobs", ["status"])


def downgrade() -> None:
    op.drop_table("jobs")
    op.drop_table("library_items")
    op.drop_table("generations")
    op.drop_table("extractions")
    op.drop_table("tracks")
    op.drop_table("notifications")
    op.drop_table("user_followers")
    op.drop_table("users")
