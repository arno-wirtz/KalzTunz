#!/usr/bin/env python3
"""
Social Features for KalzTunz
Handles followers, likes, comments, and user interactions
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple
from enum import Enum

logger = logging.getLogger(__name__)

# ==================== HELPERS ====================

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

# ==================== DATA MODELS ====================

class InteractionType(str, Enum):
    FOLLOW = "follow"
    LIKE = "like"
    COMMENT = "comment"
    SHARE = "share"
    PLAYLIST_ADD = "playlist_add"


class Comment:
    def __init__(self, comment_id: str, user_id: str, username: str, text: str, created_at: datetime):
        self.comment_id = comment_id
        self.user_id = user_id
        self.username = username
        self.text = text
        self.created_at = created_at
        self.likes = 0


class Interaction:
    def __init__(
        self,
        interaction_id: str,
        from_user: str,
        to_user: str,
        interaction_type: InteractionType,
        metadata: Dict,
    ):
        self.interaction_id = interaction_id
        self.from_user = from_user
        self.to_user = to_user
        self.interaction_type = interaction_type
        self.metadata = metadata
        # Fixed: was datetime.utcnow() — deprecated in Python 3.12+
        self.created_at = utcnow()

# ==================== IN-MEMORY STORAGE ====================
# TODO: Replace with PostgreSQL persistence

def _empty_user() -> Dict:
    """Default structure for a new user social entry."""
    return {
        "followers": [],
        "following": [],
        "liked_tracks": [],
        "playlists": [],
        "comments": [],
        "verified": False,
        "bio": "",
    }

USERS_SOCIAL_DB: Dict[str, Dict] = {
    "demo": {**_empty_user(), "verified": True, "bio": "Demo user for testing"},
}

INTERACTIONS_DB: List[Interaction] = []
COMMENTS_DB: List[Dict] = []

# ==================== SOCIAL SERVICE ====================

class SocialService:
    """Handle all social interactions"""

    # ==================== HELPERS ====================

    @staticmethod
    def _ensure_user(user_id: str) -> None:
        """Initialise social record for user if not present."""
        if user_id not in USERS_SOCIAL_DB:
            USERS_SOCIAL_DB[user_id] = _empty_user()

    # ==================== FOLLOWERS ====================

    @staticmethod
    def follow_user(follower_id: str, following_id: str) -> Tuple[bool, str]:
        if follower_id == following_id:
            return False, "Cannot follow yourself"

        SocialService._ensure_user(follower_id)
        SocialService._ensure_user(following_id)

        if following_id in USERS_SOCIAL_DB[follower_id]["following"]:
            return False, "Already following this user"

        USERS_SOCIAL_DB[follower_id]["following"].append(following_id)
        USERS_SOCIAL_DB[following_id]["followers"].append(follower_id)

        INTERACTIONS_DB.append(Interaction(
            f"interaction_{follower_id}_{following_id}_{utcnow().timestamp()}",
            follower_id,
            following_id,
            InteractionType.FOLLOW,
            {},
        ))

        logger.info("User %s now follows %s", follower_id, following_id)
        return True, "Successfully followed user"

    @staticmethod
    def unfollow_user(follower_id: str, following_id: str) -> Tuple[bool, str]:
        if following_id not in USERS_SOCIAL_DB.get(follower_id, {}).get("following", []):
            return False, "Not following this user"

        USERS_SOCIAL_DB[follower_id]["following"].remove(following_id)

        # Guard: only remove from followers list if the entry exists (data integrity)
        followers = USERS_SOCIAL_DB.get(following_id, {}).get("followers", [])
        if follower_id in followers:
            followers.remove(follower_id)

        logger.info("User %s unfollowed %s", follower_id, following_id)
        return True, "Successfully unfollowed user"

    @staticmethod
    def get_followers(user_id: str) -> List[str]:
        return USERS_SOCIAL_DB.get(user_id, {}).get("followers", [])

    @staticmethod
    def get_following(user_id: str) -> List[str]:
        return USERS_SOCIAL_DB.get(user_id, {}).get("following", [])

    @staticmethod
    def get_followers_count(user_id: str) -> int:
        return len(SocialService.get_followers(user_id))

    # ==================== LIKES ====================

    @staticmethod
    def like_track(user_id: str, track_id: str) -> Tuple[bool, str]:
        SocialService._ensure_user(user_id)

        if track_id in USERS_SOCIAL_DB[user_id]["liked_tracks"]:
            return False, "Already liked this track"

        USERS_SOCIAL_DB[user_id]["liked_tracks"].append(track_id)

        INTERACTIONS_DB.append(Interaction(
            f"like_{user_id}_{track_id}_{utcnow().timestamp()}",
            user_id,
            track_id,
            InteractionType.LIKE,
            {"track_id": track_id},
        ))

        logger.info("User %s liked track %s", user_id, track_id)
        return True, "Successfully liked track"

    @staticmethod
    def unlike_track(user_id: str, track_id: str) -> Tuple[bool, str]:
        if track_id not in USERS_SOCIAL_DB.get(user_id, {}).get("liked_tracks", []):
            return False, "Track not in liked list"

        USERS_SOCIAL_DB[user_id]["liked_tracks"].remove(track_id)
        logger.info("User %s unliked track %s", user_id, track_id)
        return True, "Successfully unliked track"

    @staticmethod
    def get_liked_tracks(user_id: str) -> List[str]:
        return USERS_SOCIAL_DB.get(user_id, {}).get("liked_tracks", [])

    # ==================== COMMENTS ====================

    @staticmethod
    def add_comment(
        user_id: str,
        username: str,
        track_id: str,
        text: str,
    ) -> Tuple[bool, str, Optional[str]]:
        text = text.strip() if text else ""
        if not text or len(text) > 500:
            return False, "Comment must be 1-500 characters", None

        comment_id = f"comment_{uuid.uuid4().hex[:8]}"
        now = utcnow()

        COMMENTS_DB.append({
            "comment_id": comment_id,
            "track_id": track_id,
            "user_id": user_id,
            "username": username,
            "text": text,
            # Fixed: was datetime.utcnow() — deprecated in Python 3.12+
            "created_at": now.isoformat(),
            "likes": 0,
        })

        logger.info("User %s commented on track %s", username, track_id)
        return True, "Comment added successfully", comment_id

    @staticmethod
    def get_comments(track_id: str) -> List[Dict]:
        return [c for c in COMMENTS_DB if c["track_id"] == track_id]

    @staticmethod
    def delete_comment(comment_id: str, user_id: str) -> Tuple[bool, str]:
        comment = next((c for c in COMMENTS_DB if c["comment_id"] == comment_id), None)

        if not comment:
            return False, "Comment not found"

        if comment["user_id"] != user_id:
            return False, "Cannot delete another user's comment"

        COMMENTS_DB.remove(comment)
        logger.info("Comment %s deleted by user %s", comment_id, user_id)
        return True, "Comment deleted"

    # ==================== ACTIVITY FEED ====================

    @staticmethod
    def get_activity_feed(user_id: str, limit: int = 20) -> List[Dict]:
        following = set(SocialService.get_following(user_id))

        feed = []
        # Iterate in reverse (most recent first) without slicing the whole list
        for interaction in reversed(INTERACTIONS_DB):
            if interaction.from_user in following:
                feed.append({
                    "from_user": interaction.from_user,
                    "action": interaction.interaction_type,
                    "metadata": interaction.metadata,
                    "created_at": interaction.created_at.isoformat(),
                })
            if len(feed) >= limit:
                break

        return feed

    @staticmethod
    def get_user_stats(user_id: str) -> Dict:
        user_data = USERS_SOCIAL_DB.get(user_id, {})
        return {
            "followers": len(user_data.get("followers", [])),
            "following": len(user_data.get("following", [])),
            "liked_tracks": len(user_data.get("liked_tracks", [])),
            "comments": len([c for c in COMMENTS_DB if c["user_id"] == user_id]),
            "verified": user_data.get("verified", False),
        }

    # ==================== RECOMMENDATIONS ====================

    @staticmethod
    def get_recommendations(user_id: str, limit: int = 10) -> List[Dict]:
        """Recommend users followed by people you follow (friends-of-friends)."""
        following = set(SocialService.get_following(user_id))

        recommended: Dict[str, int] = {}
        for followed_user in following:
            for candidate in SocialService.get_following(followed_user):
                if candidate not in following and candidate != user_id:
                    recommended[candidate] = recommended.get(candidate, 0) + 1

        sorted_recs = sorted(recommended.items(), key=lambda x: x[1], reverse=True)

        return [
            {"user_id": uid, "mutual_connections": count}
            for uid, count in sorted_recs[:limit]
        ]


# Global instance
social_service = SocialService()