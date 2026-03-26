#!/usr/bin/env python3
"""
Advanced caching layer with Redis and local memory cache
Implements cache warming, invalidation strategies, and TTL management
"""

import redis
import json
import hashlib
import time
from functools import wraps
from typing import Any, Optional, Callable
import logging

logger = logging.getLogger(__name__)

# NOTE: pickle has been intentionally removed.
# Deserializing pickle data from Redis is a critical RCE vulnerability
# if Redis is ever exposed or compromised. JSON-only is safe and sufficient.

class CacheManager:
    """Advanced Redis caching with fallback to in-memory cache"""
    
    def __init__(self, redis_url: str, ttl_default: int = 3600):
        try:
            self.redis = redis.from_url(redis_url, decode_responses=True)
            self.redis.ping()
            self.enabled = True
        except Exception as e:
            logger.warning("Redis cache disabled: %s", e)
            self.redis = None
            self.enabled = False
        
        self.ttl_default = ttl_default
        self.prefix = "kalztunz:"
        self.local_cache: dict = {}
    
    def _serialize(self, obj: Any) -> str:
        """Serialize object to JSON string for storage"""
        return json.dumps(obj, default=str)
    
    def _deserialize(self, data: str) -> Any:
        """Deserialize JSON string from storage"""
        return json.loads(data)
    
    def _is_local_entry_valid(self, key: str) -> bool:
        """Check if a local cache entry exists and has not expired"""
        entry = self.local_cache.get(key)
        if not entry:
            return False
        if time.time() >= entry["expires_at"]:
            del self.local_cache[key]
            return False
        return True

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        full_key = f"{self.prefix}{key}"
        
        # Try Redis first
        if self.enabled:
            try:
                value = self.redis.get(full_key)
                if value is not None:
                    logger.debug("Cache hit: %s (redis)", key)
                    return self._deserialize(value)
            except Exception as e:
                logger.warning("Redis get error: %s", e)
        
        # Fallback to local cache — check TTL before returning
        if self._is_local_entry_valid(key):
            logger.debug("Cache hit: %s (local)", key)
            return self.local_cache[key]["value"]
        
        logger.debug("Cache miss: %s", key)
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache"""
        full_key = f"{self.prefix}{key}"
        ttl = ttl or self.ttl_default
        
        serialized = self._serialize(value)
        
        # Set in Redis
        if self.enabled:
            try:
                self.redis.setex(full_key, ttl, serialized)
                logger.debug("Cache set: %s (redis, TTL=%ss)", key, ttl)
            except Exception as e:
                logger.warning("Redis set error: %s", e)
        
        # Also set in local cache with enforced expiry
        self.local_cache[key] = {
            "value": value,
            "expires_at": time.time() + ttl,
        }
        
        return True
    
    def delete(self, key: str) -> bool:
        """Delete from cache"""
        full_key = f"{self.prefix}{key}"
        
        if self.enabled:
            try:
                self.redis.delete(full_key)
            except Exception as e:
                logger.warning("Redis delete error: %s", e)
        
        self.local_cache.pop(key, None)
        return True
    
    def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching pattern.
        
        Uses SCAN instead of KEYS to avoid blocking Redis on large keyspaces.
        """
        count = 0
        
        if self.enabled:
            try:
                # SCAN is non-blocking unlike KEYS
                keys_to_delete = [
                    k for k in self.redis.scan_iter(f"{self.prefix}{pattern}*")
                ]
                if keys_to_delete:
                    count = self.redis.delete(*keys_to_delete)
                logger.info("Invalidated %d keys matching %s", count, pattern)
            except Exception as e:
                logger.warning("Pattern invalidation error: %s", e)
        
        # Invalidate matching local cache entries
        to_delete = [k for k in self.local_cache if pattern in k]
        for k in to_delete:
            del self.local_cache[k]
        
        return count + len(to_delete)
    
    def mget(self, keys: list) -> dict:
        """Get multiple values"""
        return {key: self.get(key) for key in keys}
    
    def mset(self, data: dict, ttl: Optional[int] = None) -> bool:
        """Set multiple values"""
        for key, value in data.items():
            self.set(key, value, ttl)
        return True

# Global cache instance
cache_manager: Optional[CacheManager] = None

def init_cache(redis_url: str) -> CacheManager:
    """Initialize cache manager"""
    global cache_manager
    cache_manager = CacheManager(redis_url)
    return cache_manager

# ==================== DECORATORS ====================

def cached(ttl: int = 3600, key_prefix: str = ""):
    """Decorator for caching function results"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            # Guard: skip caching if cache_manager not initialised
            if cache_manager is None:
                return await func(*args, **kwargs)

            cache_key = f"{key_prefix}:{func.__name__}:{hashlib.md5(str(args + tuple(kwargs.values())).encode()).hexdigest()}"
            
            cached_value = cache_manager.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            result = await func(*args, **kwargs)
            cache_manager.set(cache_key, result, ttl)
            return result
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            # Guard: skip caching if cache_manager not initialised
            if cache_manager is None:
                return func(*args, **kwargs)

            cache_key = f"{key_prefix}:{func.__name__}:{hashlib.md5(str(args + tuple(kwargs.values())).encode()).hexdigest()}"
            
            cached_value = cache_manager.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            result = func(*args, **kwargs)
            cache_manager.set(cache_key, result, ttl)
            return result
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator

# ==================== CACHE WARMING ====================

class CacheWarmer:
    """Pre-load cache with hot data"""
    
    def __init__(self, db_session, cache: CacheManager):
        self.db = db_session
        self.cache = cache
    
    async def warm_trending(self):
        """Pre-load trending tracks"""
        from backend.models import Track
        
        trending = self.db.query(Track)\
            .order_by(Track.play_count.desc())\
            .limit(100)\
            .all()
        
        self.cache.set("trending_tracks", trending, ttl=3600)
        logger.info("Warmed cache: trending_tracks")
    
    async def warm_top_artists(self):
        """Pre-load top artists ordered by follower count (subquery)"""
        from backend.models import User, UserFollowers
        from sqlalchemy import func

        # Subquery: count followers per user
        follower_count = (
            self.db.query(
                UserFollowers.following_id,
                func.count(UserFollowers.follower_id).label("cnt"),
            )
            .group_by(UserFollowers.following_id)
            .subquery()
        )

        top_artists = (
            self.db.query(User)
            .outerjoin(follower_count, User.id == follower_count.c.following_id)
            .order_by(func.coalesce(follower_count.c.cnt, 0).desc())
            .limit(50)
            .all()
        )

        self.cache.set("top_artists", top_artists, ttl=3600)
        logger.info("Warmed cache: top_artists")
    
    async def warm_popular_extractions(self):
        """Pre-load popular extractions"""
        from backend.models import Extraction
        
        popular = self.db.query(Extraction)\
            .order_by(Extraction.created_at.desc())\
            .limit(50)\
            .all()
        
        self.cache.set("popular_extractions", popular, ttl=1800)
        logger.info("Warmed cache: popular_extractions")

# ==================== CACHE INVALIDATION STRATEGIES ====================

class CacheInvalidationStrategy:
    """Smart cache invalidation"""
    
    def __init__(self, cache: CacheManager):
        self.cache = cache
    
    def invalidate_user(self, user_id: str):
        """Invalidate all user-related caches"""
        self.cache.invalidate_pattern(f"user:{user_id}:")
        self.cache.delete("top_artists")
        logger.info("Invalidated user cache: %s", user_id)
    
    def invalidate_track(self, track_id: str):
        """Invalidate all track-related caches"""
        self.cache.invalidate_pattern(f"track:{track_id}:")
        self.cache.invalidate_pattern("trending_tracks")
        logger.info("Invalidated track cache: %s", track_id)
    
    def invalidate_extraction(self, extraction_id: str):
        """Invalidate extraction cache"""
        self.cache.invalidate_pattern(f"extraction:{extraction_id}:")
        self.cache.delete("popular_extractions")
        logger.info("Invalidated extraction cache: %s", extraction_id)