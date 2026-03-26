#!/usr/bin/env python3
"""
Database configuration and session management for KalzTunz
"""

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

# Database URL - supports SQLite for dev, PostgreSQL for prod
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://kalztunz_user:secure_password@localhost:5432/kalztunz"
)

# Create engine — SQLite does not support pool_size/max_overflow
_is_sqlite = DATABASE_URL.startswith("sqlite")
_engine_kwargs: dict = {
    "pool_pre_ping": not _is_sqlite,
    "echo": os.getenv("SQL_ECHO", "false").lower() == "true",
}
if not _is_sqlite:
    _engine_kwargs["pool_size"]    = 10
    _engine_kwargs["max_overflow"] = 20
else:
    # SQLite: use StaticPool for in-memory or NullPool for file-based
    from sqlalchemy.pool import StaticPool
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
    _engine_kwargs["poolclass"]    = StaticPool

engine = create_engine(DATABASE_URL, **_engine_kwargs)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)

# Base class for all models
Base = declarative_base()

# Dependency for FastAPI
def get_db():
    """Get database session for dependency injection"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create tables
def init_db():
    """Initialize database with all tables"""
    Base.metadata.create_all(bind=engine)