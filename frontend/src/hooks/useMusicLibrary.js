/**
 * useMusicLibrary — React hook for the KalzTunz Discover page.
 *
 * Replaces the old useSpotify hook. There is no external service and no
 * API key involved — everything is served from the local seed catalog in
 * src/data/musicCatalog.js. The async/loading/error shape is kept so the
 * Search page's existing skeleton-loading UI keeps working unchanged; a
 * small artificial delay gives the loading state something to show.
 *
 * Usage:
 *   const { searchLibrary, getMoodTracks, getGenreTracks, getFeatured } = useMusicLibrary()
 */

import { useState, useCallback } from 'react'
import * as catalog from '../data/musicCatalog'

const SIMULATED_DELAY_MS = 120

function resolveAfterDelay(value) {
  return new Promise(resolve => setTimeout(() => resolve(value), SIMULATED_DELAY_MS))
}

export function useMusicLibrary() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const call = useCallback(async (fn) => {
    setLoading(true)
    setError(null)
    try {
      return await resolveAfterDelay(fn())
    } catch (err) {
      setError(err?.message || 'Something went wrong loading music.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const searchLibrary = useCallback((q, type = 'track,artist,album', limit = 20) =>
    call(() => catalog.searchCatalog(q, type, limit))
  , [call])

  const getFeatured = useCallback((limit = 20) =>
    call(() => ({ ok: true, tracks: catalog.getFeatured(limit) }))
  , [call])

  const getGenreTracks = useCallback((genreId, limit = 20) =>
    call(() => ({ ok: true, tracks: catalog.getGenreTracks(genreId, limit) }))
  , [call])

  const getMoodTracks = useCallback((mood, limit = 20) =>
    call(() => ({ ok: true, tracks: catalog.getMoodTracks(mood, limit) }))
  , [call])

  const getArtist = useCallback((id) =>
    call(() => ({ ok: true, artist: catalog.getArtist(id) }))
  , [call])

  const getArtistAlbums = useCallback((id) =>
    call(() => ({ ok: true, albums: catalog.getArtistAlbums(id) }))
  , [call])

  const getArtistTopTracks = useCallback((id) =>
    call(() => ({ ok: true, tracks: catalog.getArtistTopTracks(id) }))
  , [call])

  const getAlbum = useCallback((id) => {
    const album = catalog.getAlbum(id)
    return call(() => ({ ok: true, album, tracks: album?.tracks || [] }))
  }, [call])

  const getTrack = useCallback((id) =>
    call(() => ({ ok: true, track: catalog.getTrack(id) }))
  , [call])

  return {
    loading, error,
    searchLibrary, getFeatured, getGenreTracks, getMoodTracks,
    getArtist, getArtistAlbums, getArtistTopTracks, getAlbum, getTrack,
  }
}
