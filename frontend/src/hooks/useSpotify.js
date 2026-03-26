/**
 * useSpotify — React hook for the KalzTunz Spotify proxy API.
 *
 * All calls go through our FastAPI backend (/api/spotify/…) so the
 * Spotify client secret never touches the browser.
 *
 * Usage:
 *   const { searchSpotify, getMoodTracks, getArtist, getFeatured } = useSpotify()
 */

import { useState, useCallback, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── tiny fetch wrapper ────────────────────────────────
async function spotifyFetch(path, params = {}) {
  const url = new URL(`${API}/api/spotify${path}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  })
  const res = await fetch(url.toString())
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || `Spotify API error (${res.status})`)
  return data
}

export function useSpotify() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const abortRef = useRef(null)

  const call = useCallback(async (fn) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn()
      return result
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Search ──────────────────────────────────────────
  const searchSpotify = useCallback((q, type = 'track,artist,album', limit = 20) =>
    call(() => spotifyFetch('/search', { q, type, limit }))
  , [call])

  // ── Featured / trending ────────────────────────────
  const getFeatured = useCallback((limit = 20) =>
    call(() => spotifyFetch('/featured', { limit }))
  , [call])

  // ── Mood tracks ────────────────────────────────────
  const getMoodTracks = useCallback((mood, limit = 20) =>
    call(() => spotifyFetch(`/mood/${mood}`, { limit }))
  , [call])

  // ── Artist ─────────────────────────────────────────
  const getArtist = useCallback((id) =>
    call(() => spotifyFetch(`/artist/${id}`))
  , [call])

  const getArtistAlbums = useCallback((id, limit = 20) =>
    call(() => spotifyFetch(`/artist/${id}/albums`, { limit }))
  , [call])

  const getArtistTopTracks = useCallback((id) =>
    call(() => spotifyFetch(`/artist/${id}/top-tracks`))
  , [call])

  // ── Album ──────────────────────────────────────────
  const getAlbum = useCallback((id) =>
    call(() => spotifyFetch(`/album/${id}`))
  , [call])

  // ── Single track ───────────────────────────────────
  const getTrack = useCallback((id) =>
    call(() => spotifyFetch(`/track/${id}`))
  , [call])

  // ── Status check ───────────────────────────────────
  const checkStatus = useCallback(() =>
    call(() => spotifyFetch('/status'))
  , [call])

  return {
    loading, error,
    searchSpotify, getFeatured, getMoodTracks,
    getArtist, getArtistAlbums, getArtistTopTracks,
    getAlbum, getTrack, checkStatus,
  }
}
