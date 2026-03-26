#!/usr/bin/env python3
"""
KalzTunz — Spotify API Proxy
Handles Client Credentials token management and exposes safe proxy endpoints
so the frontend never needs to hold the client secret.

Endpoints:
  GET /api/spotify/search          — search tracks, artists, albums
  GET /api/spotify/track/{id}      — single track detail
  GET /api/spotify/artist/{id}     — artist profile
  GET /api/spotify/artist/{id}/albums      — artist's albums
  GET /api/spotify/artist/{id}/top-tracks  — artist top tracks
  GET /api/spotify/album/{id}      — album with tracks
  GET /api/spotify/mood/{mood}     — curated playlist tracks for a mood
  GET /api/spotify/featured        — featured/trending tracks
  GET /api/spotify/genres          — available genre seeds
"""

import logging
import os
import time
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/spotify", tags=["Spotify"])

# ==================== CREDENTIALS ====================

SPOTIFY_CLIENT_ID     = os.environ.get("SPOTIFY_CLIENT_ID",     "")
SPOTIFY_CLIENT_SECRET = os.environ.get("SPOTIFY_CLIENT_SECRET", "")

SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE  = "https://api.spotify.com/v1"

# ==================== TOKEN CACHE ====================
# Client Credentials tokens are safe to cache server-side.
# They do NOT grant access to user data.

_token_cache: dict = {
    "access_token": None,
    "expires_at":   0.0,
}


async def _get_access_token() -> str:
    """
    Return a valid Client Credentials access token, refreshing if expired.
    Thread-safe enough for single-worker deployments; for multi-worker use
    a Redis-backed cache instead.
    """
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail=(
                "Spotify credentials not configured. "
                "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in your .env file. "
                "Get them free at https://developer.spotify.com/dashboard"
            ),
        )

    if _token_cache["access_token"] and time.time() < _token_cache["expires_at"] - 60:
        return _token_cache["access_token"]

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            SPOTIFY_TOKEN_URL,
            data={"grant_type": "client_credentials"},
            auth=(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET),
            timeout=10,
        )

    if resp.status_code != 200:
        logger.error("Spotify token error: %s %s", resp.status_code, resp.text)
        raise HTTPException(status_code=502, detail="Failed to authenticate with Spotify.")

    data = resp.json()
    _token_cache["access_token"] = data["access_token"]
    _token_cache["expires_at"]   = time.time() + data.get("expires_in", 3600)
    logger.info("Spotify token refreshed, expires in %ds", data.get("expires_in", 3600))
    return _token_cache["access_token"]


async def _spotify_get(path: str, params: Optional[dict] = None) -> dict:
    """Authenticated GET to Spotify Web API."""
    token = await _get_access_token()
    url   = f"{SPOTIFY_API_BASE}{path}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            params=params or {},
            timeout=12,
        )
    if resp.status_code == 429:
        raise HTTPException(status_code=429, detail="Spotify rate limit hit. Please try again shortly.")
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Not found on Spotify.")
    if resp.status_code != 200:
        logger.warning("Spotify API %s → %d: %s", path, resp.status_code, resp.text[:200])
        raise HTTPException(status_code=502, detail=f"Spotify API error ({resp.status_code}).")
    return resp.json()

# ==================== FORMATTERS ====================

def _fmt_track(item: dict) -> dict:
    """Flatten a Spotify track object into a KalzTunz-friendly dict."""
    album   = item.get("album",   {})
    artists = item.get("artists", [])
    images  = album.get("images", [])
    return {
        "id":           item.get("id"),
        "title":        item.get("name"),
        "artist":       ", ".join(a["name"] for a in artists),
        "artist_id":    artists[0]["id"] if artists else None,
        "album":        album.get("name"),
        "album_id":     album.get("id"),
        "cover":        images[0]["url"] if images else None,
        "duration_ms":  item.get("duration_ms", 0),
        "duration":     (item.get("duration_ms", 0) // 1000),
        "preview_url":  item.get("preview_url"),   # 30-second MP3 — free to use
        "external_url": item.get("external_urls", {}).get("spotify"),
        "popularity":   item.get("popularity", 0),
        "explicit":     item.get("explicit", False),
        "release_date": album.get("release_date"),
        "track_number": item.get("track_number"),
    }


def _fmt_artist(item: dict) -> dict:
    images = item.get("images", [])
    return {
        "id":           item.get("id"),
        "name":         item.get("name"),
        "genres":       item.get("genres", []),
        "followers":    item.get("followers", {}).get("total", 0),
        "popularity":   item.get("popularity", 0),
        "image":        images[0]["url"] if images else None,
        "external_url": item.get("external_urls", {}).get("spotify"),
        "verified":     True,  # All Spotify artists are on the platform
    }


def _fmt_album(item: dict) -> dict:
    artists = item.get("artists", [])
    images  = item.get("images", [])
    return {
        "id":           item.get("id"),
        "title":        item.get("name"),
        "artist":       ", ".join(a["name"] for a in artists),
        "artist_id":    artists[0]["id"] if artists else None,
        "cover":        images[0]["url"] if images else None,
        "release_date": item.get("release_date"),
        "total_tracks": item.get("total_tracks", 0),
        "album_type":   item.get("album_type"),
        "external_url": item.get("external_urls", {}).get("spotify"),
    }

# ==================== MOOD → SPOTIFY MAPPING ====================
# Maps KalzTunz mood slugs to Spotify audio-feature target values
# used in the recommendations endpoint.

MOOD_PARAMS: dict = {
    "happy":      {"target_valence": 0.85, "target_energy": 0.75, "target_danceability": 0.70, "seed_genres": "pop,happy"},
    "sad":        {"target_valence": 0.15, "target_energy": 0.25, "target_acousticness": 0.70, "seed_genres": "sad,acoustic"},
    "energetic":  {"target_energy": 0.95,  "target_tempo": 140,   "target_danceability": 0.80, "seed_genres": "dance,electronic"},
    "chill":      {"target_energy": 0.30,  "target_valence": 0.55,"target_acousticness": 0.60, "seed_genres": "chill,ambient"},
    "romantic":   {"target_valence": 0.65, "target_acousticness": 0.50, "target_tempo": 90,   "seed_genres": "romance,soul"},
    "focus":      {"target_energy": 0.40,  "target_instrumentalness": 0.70, "target_tempo": 100, "seed_genres": "study,classical"},
    "dark":       {"target_valence": 0.10, "target_energy": 0.65, "target_mode": 0,            "seed_genres": "dark-trap,goth"},
    "epic":       {"target_energy": 0.95,  "target_instrumentalness": 0.40, "target_tempo": 155, "seed_genres": "epic,metal"},
    "morning":    {"target_valence": 0.75, "target_energy": 0.55, "target_acousticness": 0.50, "seed_genres": "morning,acoustic"},
}

# ==================== ENDPOINTS ====================

@router.get("/search", summary="Search Spotify for tracks, artists, or albums")
async def search_spotify(
    q:     str  = Query(..., min_length=1, description="Search query"),
    type:  str  = Query("track,artist,album", description="Comma-separated types"),
    limit: int  = Query(20, ge=1, le=50),
    offset:int  = Query(0,  ge=0),
    market:str  = Query("US"),
):
    """
    Proxy Spotify search. Returns tracks, artists, and/or albums.
    The 'type' param accepts any combination of: track, artist, album, playlist.
    """
    data = await _spotify_get("/search", {
        "q": q, "type": type, "limit": limit, "offset": offset, "market": market,
    })

    result: dict = {}

    if "tracks" in data:
        result["tracks"] = [_fmt_track(t) for t in data["tracks"]["items"] if t]
        result["tracks_total"] = data["tracks"].get("total", 0)

    if "artists" in data:
        result["artists"] = [_fmt_artist(a) for a in data["artists"]["items"] if a]
        result["artists_total"] = data["artists"].get("total", 0)

    if "albums" in data:
        result["albums"] = [_fmt_album(a) for a in data["albums"]["items"] if a]
        result["albums_total"] = data["albums"].get("total", 0)

    return {"ok": True, "query": q, **result}


@router.get("/track/{track_id}", summary="Get a single track")
async def get_track(track_id: str, market: str = Query("US")):
    data = await _spotify_get(f"/tracks/{track_id}", {"market": market})
    return {"ok": True, "track": _fmt_track(data)}


@router.get("/artist/{artist_id}", summary="Get artist profile")
async def get_artist(artist_id: str):
    data = await _spotify_get(f"/artists/{artist_id}")
    return {"ok": True, "artist": _fmt_artist(data)}


@router.get("/artist/{artist_id}/albums", summary="Get artist's albums")
async def get_artist_albums(
    artist_id:   str,
    limit:       int = Query(20, ge=1, le=50),
    include_groups: str = Query("album,single", description="album,single,appears_on,compilation"),
    market:      str = Query("US"),
):
    data = await _spotify_get(f"/artists/{artist_id}/albums", {
        "limit": limit, "include_groups": include_groups, "market": market,
    })
    albums = [_fmt_album(a) for a in data.get("items", []) if a]
    return {"ok": True, "artist_id": artist_id, "albums": albums, "total": data.get("total", 0)}


@router.get("/artist/{artist_id}/top-tracks", summary="Get artist top tracks")
async def get_artist_top_tracks(artist_id: str, market: str = Query("US")):
    data = await _spotify_get(f"/artists/{artist_id}/top-tracks", {"market": market})
    tracks = [_fmt_track(t) for t in data.get("tracks", []) if t]
    return {"ok": True, "artist_id": artist_id, "tracks": tracks}


@router.get("/album/{album_id}", summary="Get album with full track list")
async def get_album(album_id: str, market: str = Query("US")):
    data = await _spotify_get(f"/albums/{album_id}", {"market": market})

    # Fetch album tracks (may be paginated; return first 50)
    tracks_raw  = data.get("tracks", {}).get("items", [])
    album_cover = (data.get("images") or [{}])[0].get("url")
    album_name  = data.get("name")
    artists     = data.get("artists", [])

    tracks = []
    for t in tracks_raw:
        if not t:
            continue
        # Album tracks don't include album object — patch it in
        t["album"] = {
            "name":    album_name,
            "id":      album_id,
            "images":  data.get("images", []),
            "release_date": data.get("release_date", ""),
        }
        tracks.append(_fmt_track(t))

    return {
        "ok":    True,
        "album": _fmt_album(data),
        "tracks": tracks,
    }


@router.get("/mood/{mood}", summary="Get tracks for a mood using Spotify recommendations")
async def get_mood_tracks(
    mood:  str,
    limit: int = Query(20, ge=1, le=50),
    market:str = Query("US"),
):
    """
    Returns Spotify recommendations tuned to the given mood's audio features.
    Falls back to a genre-seed search if recommendations aren't available.
    """
    mood_lower = mood.lower()
    if mood_lower not in MOOD_PARAMS:
        raise HTTPException(status_code=400, detail=f"Unknown mood '{mood}'. Valid moods: {', '.join(MOOD_PARAMS)}")

    mp = MOOD_PARAMS[mood_lower].copy()
    seed_genres = mp.pop("seed_genres", "pop")

    try:
        data = await _spotify_get("/recommendations", {
            "seed_genres": seed_genres,
            "limit":       limit,
            "market":      market,
            **mp,
        })
        tracks = [_fmt_track(t) for t in data.get("tracks", []) if t]
    except HTTPException:
        # Recommendations endpoint needs OAuth scope on some accounts — fall back to search
        genre_query = seed_genres.replace(",", " OR ")
        search_data = await _spotify_get("/search", {
            "q": genre_query, "type": "track", "limit": limit, "market": market,
        })
        tracks = [_fmt_track(t) for t in search_data.get("tracks", {}).get("items", []) if t]

    return {"ok": True, "mood": mood, "tracks": tracks}


@router.get("/featured", summary="Get featured / trending tracks")
async def get_featured(
    limit:  int = Query(20, ge=1, le=50),
    market: str = Query("US"),
):
    """Returns current featured playlists' tracks as a flat list."""
    try:
        data = await _spotify_get("/browse/featured-playlists", {
            "limit": 1, "market": market,
        })
        playlists = data.get("playlists", {}).get("items", [])
        if not playlists:
            raise ValueError("No featured playlists")

        playlist_id = playlists[0]["id"]
        tracks_data = await _spotify_get(f"/playlists/{playlist_id}/tracks", {
            "limit": limit, "market": market,
        })
        tracks = [
            _fmt_track(item["track"])
            for item in tracks_data.get("items", [])
            if item and item.get("track")
        ]
        return {"ok": True, "tracks": tracks}

    except (HTTPException, ValueError, KeyError):
        # Fall back to "global top 50" playlist — always available
        try:
            tracks_data = await _spotify_get(
                "/playlists/37i9dQZEVXbMDoHDwVN2tF/tracks",
                {"limit": limit, "market": market},
            )
            tracks = [
                _fmt_track(item["track"])
                for item in tracks_data.get("items", [])
                if item and item.get("track")
            ]
            return {"ok": True, "tracks": tracks}
        except Exception as exc:
            logger.warning("Featured fallback failed: %s", exc)
            raise HTTPException(status_code=503, detail="Could not fetch featured tracks.")


@router.get("/genres", summary="Available genre seeds")
async def get_genres():
    data = await _spotify_get("/recommendations/available-genre-seeds")
    return {"ok": True, "genres": data.get("genres", [])}


@router.get("/status", summary="Check Spotify connectivity")
async def spotify_status():
    """Returns whether credentials are configured and the token is reachable."""
    configured = bool(SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET)
    if not configured:
        return {
            "ok": False,
            "configured": False,
            "message": "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env",
            "docs": "https://developer.spotify.com/dashboard",
        }
    try:
        await _get_access_token()
        return {"ok": True, "configured": True, "message": "Spotify connected"}
    except Exception as exc:
        return {"ok": False, "configured": True, "message": str(exc)}
