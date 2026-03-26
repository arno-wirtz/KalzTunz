#!/usr/bin/env python3
"""
Advanced analytics and event tracking
Tracks user behavior, usage patterns, and performance metrics
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from enum import Enum
import logging

from prometheus_client import Counter, Histogram, Gauge, start_http_server
from sqlalchemy.orm import Session
import redis

logger = logging.getLogger(__name__)

# ==================== HELPERS ====================

def utcnow() -> datetime:
    """Return current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)

# ==================== METRICS ====================

class Metrics:
    """Prometheus metrics"""
    
    # Counters
    uploads_total = Counter(
        'kalztunz_uploads_total',
        'Total file uploads',
        ['file_type']
    )
    
    extractions_total = Counter(
        'kalztunz_extractions_total',
        'Total chord extractions',
        ['file_type']
    )
    
    generations_total = Counter(
        'kalztunz_generations_total',
        'Total music generations',
        ['style']
    )
    
    login_total = Counter(
        'kalztunz_logins_total',
        'Total user logins'
    )
    
    api_errors_total = Counter(
        'kalztunz_api_errors_total',
        'Total API errors',
        ['endpoint', 'status_code']
    )
    
    # Histograms
    processing_time = Histogram(
        'kalztunz_processing_seconds',
        'Processing time in seconds',
        ['job_type'],
        buckets=(1, 5, 10, 30, 60, 300, 600)
    )
    
    api_latency = Histogram(
        'kalztunz_api_latency_seconds',
        'API endpoint latency',
        ['endpoint'],
        buckets=(0.1, 0.5, 1, 2, 5, 10)
    )
    
    upload_size = Histogram(
        'kalztunz_upload_size_bytes',
        'Upload file size in bytes',
        buckets=(1024*1024, 5*1024*1024, 10*1024*1024, 50*1024*1024)
    )
    
    # Gauges
    active_jobs = Gauge(
        'kalztunz_active_jobs',
        'Number of active processing jobs'
    )
    
    active_users = Gauge(
        'kalztunz_active_users',
        'Number of active users'
    )
    
    database_connections = Gauge(
        'kalztunz_database_connections',
        'Number of database connections'
    )

# ==================== EVENTS ====================

class EventType(str, Enum):
    """Event types"""
    USER_SIGNUP = "user_signup"
    USER_LOGIN = "user_login"
    FILE_UPLOADED = "file_uploaded"
    EXTRACTION_STARTED = "extraction_started"
    EXTRACTION_COMPLETED = "extraction_completed"
    GENERATION_STARTED = "generation_started"
    GENERATION_COMPLETED = "generation_completed"
    TRACK_PLAYED = "track_played"
    TRACK_LIKED = "track_liked"
    USER_FOLLOWED = "user_followed"
    CONTENT_SHARED = "content_shared"

class AnalyticsService:
    """Track events and metrics"""
    
    def __init__(self, db: Session, redis_client: redis.Redis):
        self.db = db
        self.redis = redis_client
    
    def track_event(self, event_type: EventType, user_id: str = None, metadata: Dict = None):
        """Track user event"""
        try:
            event_data = {
                "event_type": event_type.value,
                "user_id": user_id,
                "timestamp": utcnow().isoformat(),
                "metadata": metadata or {},
            }
            
            # Store in Redis for real-time analytics
            key = f"events:{utcnow().strftime('%Y-%m-%d')}:{event_type.value}"
            self.redis.lpush(key, json.dumps(event_data))
            self.redis.expire(key, 86400 * 30)  # 30 days
            
            logger.info("Event tracked: %s", event_type.value)
        except Exception as e:
            logger.error("Event tracking error: %s", e)
    
    def get_usage_stats(self, days: int = 7) -> Dict[str, Any]:
        """Get usage statistics"""
        from backend.models import User, Extraction, Generation, Job
        
        cutoff = utcnow() - timedelta(days=days)
        
        stats = {
            "total_users": self.db.query(User).count(),
            "active_users": self.db.query(User).filter(User.last_login >= cutoff).count(),
            "new_users": self.db.query(User).filter(User.created_at >= cutoff).count(),
            "total_extractions": self.db.query(Extraction).filter(Extraction.created_at >= cutoff).count(),
            "total_generations": self.db.query(Generation).filter(Generation.created_at >= cutoff).count(),
            "failed_jobs": self.db.query(Job).filter(
                Job.status == "failed",
                Job.created_at >= cutoff
            ).count(),
        }
        
        return stats
    
    def get_top_tracks(self, limit: int = 10) -> List:
        """Get top tracks by engagement"""
        from backend.models import Track
        
        return self.db.query(Track)\
            .order_by(
                (Track.play_count + Track.like_count + Track.download_count).desc()
            )\
            .limit(limit)\
            .all()
    
    def get_user_cohort(self, user_id: str) -> Dict:
        """Get user cohort analytics"""
        from backend.models import User
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {}
        
        return {
            "user_id": str(user.id),
            "signup_date": user.created_at.isoformat(),
            "last_active": user.last_login.isoformat() if user.last_login else None,
            "lifetime_days": (utcnow() - user.created_at).days,
            # Fixed: was user.followers — correct relationship name is followers_rel
            "followers": len(user.followers_rel),
            "following": len(user.following_rel),
        }