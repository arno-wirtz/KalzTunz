#!/usr/bin/env python3
"""
Social API endpoints for KalzTunz
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from backend.social import social_service, InteractionType
from backend.auth import get_current_user
from backend.models import User
from backend.emailer_enhanced import email_service

# Fixed: replaced __import__("logging").getLogger() hack with standard import
logger = logging.getLogger(__name__)

# ==================== DATA MODELS ====================

class FollowRequest(BaseModel):
    user_id: str

class CommentRequest(BaseModel):
    track_id: str
    text: str

class LikeRequest(BaseModel):
    track_id: str

# ==================== ROUTER ====================

router = APIRouter(prefix="/api/social", tags=["Social"])

# ==================== FOLLOWERS ====================

@router.post("/follow")
async def follow_user(
    request: FollowRequest,
    current_user: User = Depends(get_current_user),
):
    success, message = social_service.follow_user(str(current_user.id), request.user_id)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"ok": True, "message": message}


@router.post("/unfollow")
async def unfollow_user(
    request: FollowRequest,
    current_user: User = Depends(get_current_user),
):
    success, message = social_service.unfollow_user(str(current_user.id), request.user_id)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"ok": True, "message": message}


@router.get("/followers/{user_id}")
async def get_followers(user_id: str):
    followers = social_service.get_followers(user_id)
    return {"user_id": user_id, "followers": followers, "count": len(followers)}


@router.get("/following/{user_id}")
async def get_following(user_id: str):
    following = social_service.get_following(user_id)
    return {"user_id": user_id, "following": following, "count": len(following)}


@router.get("/stats/{user_id}")
async def get_user_stats(user_id: str):
    stats = social_service.get_user_stats(user_id)
    return {"user_id": user_id, "stats": stats}

# ==================== LIKES ====================

@router.post("/like")
async def like_track(
    request: LikeRequest,
    current_user: User = Depends(get_current_user),
):
    success, message = social_service.like_track(str(current_user.id), request.track_id)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"ok": True, "message": message}


@router.post("/unlike")
async def unlike_track(
    request: LikeRequest,
    current_user: User = Depends(get_current_user),
):
    success, message = social_service.unlike_track(str(current_user.id), request.track_id)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"ok": True, "message": message}


@router.get("/liked-tracks")
async def get_liked_tracks(current_user: User = Depends(get_current_user)):
    liked = social_service.get_liked_tracks(str(current_user.id))
    return {"user_id": str(current_user.id), "liked_tracks": liked, "count": len(liked)}

# ==================== COMMENTS ====================

@router.post("/comment")
async def add_comment(
    request: CommentRequest,
    current_user: User = Depends(get_current_user),
):
    success, message, comment_id = social_service.add_comment(
        str(current_user.id),
        current_user.username,
        request.track_id,
        request.text,
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"ok": True, "message": message, "comment_id": comment_id}


@router.get("/comments/{track_id}")
async def get_comments(track_id: str):
    comments = social_service.get_comments(track_id)
    return {"track_id": track_id, "comments": comments, "count": len(comments)}


@router.delete("/comment/{comment_id}")
async def delete_comment(
    comment_id: str,
    current_user: User = Depends(get_current_user),
):
    success, message = social_service.delete_comment(comment_id, str(current_user.id))
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"ok": True, "message": message}

# ==================== ACTIVITY & RECOMMENDATIONS ====================

@router.get("/activity-feed")
async def get_activity_feed(
    current_user: User = Depends(get_current_user),
    limit: int = 20,
):
    feed = social_service.get_activity_feed(str(current_user.id), limit)
    return {"user_id": str(current_user.id), "feed": feed, "count": len(feed)}


@router.get("/recommendations")
async def get_recommendations(
    current_user: User = Depends(get_current_user),
    limit: int = 10,
):
    recommendations = social_service.get_recommendations(str(current_user.id), limit)
    return {"recommendations": recommendations, "count": len(recommendations)}