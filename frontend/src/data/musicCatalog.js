/**
 * KalzTunz Music Catalog — local seed content.
 *
 * This replaces the old Spotify Web API proxy as the data source for the
 * Discover / Search page. Everything here is original, fictional seed
 * content (no real artists, no third-party service, no API key required)
 * so the Discover page always has something to show — genre tabs, mood
 * browsing, featured tracks, and artist profiles all work offline and
 * with zero configuration.
 *
 * Shape intentionally mirrors what the UI previously expected from the
 * Spotify proxy (title/artist/album/duration_ms/cover/etc.) so the page
 * components didn't need a rewrite — just a new data source underneath.
 */

const ARTISTS_RAW = [
  { id: 'a1',  name: 'Nova Rhodes',          genres: ['pop'],       followers: 128000, popularity: 82 },
  { id: 'a2',  name: 'Crimson Static',       genres: ['rock'],      followers: 94000,  popularity: 74 },
  { id: 'a3',  name: 'Elliot Vane',          genres: ['jazz'],      followers: 31000,  popularity: 61 },
  { id: 'a4',  name: 'Vector Pulse',         genres: ['electronic'],followers: 156000, popularity: 88 },
  { id: 'a5',  name: 'Kasper Lowe',          genres: ['hip-hop'],   followers: 210000, popularity: 90 },
  { id: 'a6',  name: 'Aria Wentworth',       genres: ['classical'], followers: 18000,  popularity: 55 },
  { id: 'a7',  name: 'Dusty Callahan',       genres: ['country'],   followers: 76000,  popularity: 68 },
  { id: 'a8',  name: 'Simone Ardor',         genres: ['rnb'],       followers: 143000, popularity: 79 },
  { id: 'a9',  name: 'Halcyon Drift',        genres: ['ambient'],   followers: 22000,  popularity: 47 },
  { id: 'a10', name: 'Marlowe & the Foxes',  genres: ['indie'],     followers: 58000,  popularity: 63 },
  { id: 'a11', name: 'Nadia Solheim',        genres: ['pop'],       followers: 99000,  popularity: 71 },
  { id: 'a12', name: 'The Ember Choir',      genres: ['classical'], followers: 40000,  popularity: 66 },
]

const ALBUMS_RAW = [
  { id: 'al1',  title: 'Golden Hour',          artistId: 'a1',  release: '2024-03-15' },
  { id: 'al2',  title: 'Wildflower Radio',     artistId: 'a11', release: '2023-08-02' },
  { id: 'al3',  title: 'Concrete Wings',       artistId: 'a2',  release: '2022-11-10' },
  { id: 'al4',  title: 'Blue Room Waltz',      artistId: 'a3',  release: '2021-05-20' },
  { id: 'al5',  title: 'Vector Field',         artistId: 'a4',  release: '2024-01-09' },
  { id: 'al6',  title: 'Low Gravity',          artistId: 'a5',  release: '2023-06-18' },
  { id: 'al7',  title: 'Prelude in Amber',     artistId: 'a6',  release: '2020-09-12' },
  { id: 'al8',  title: 'Two Lane Heart',       artistId: 'a7',  release: '2022-04-04' },
  { id: 'al9',  title: 'Velvet Hours',         artistId: 'a8',  release: '2023-10-27' },
  { id: 'al10', title: 'Drift Hour',           artistId: 'a9',  release: '2021-02-14' },
  { id: 'al11', title: 'Half-Lit Rooms',       artistId: 'a10', release: '2022-07-30' },
  { id: 'al12', title: 'Hollow Crown',         artistId: 'a12', release: '2024-05-01' },
]

// [id, title, artistId, albumId, genre, moods[], key, durationSeconds, popularity, trackNumber]
const TRACKS_RAW = [
  ['t1',  'Golden Hour',           'a1',  'al1',  'pop',        ['happy','uplifting'],    'G major',  198, 85, 1],
  ['t2',  'Neon Heartbeat',        'a1',  'al1',  'pop',        ['energetic','romantic'], 'A major',  187, 80, 2],
  ['t3',  'Paper Skies',           'a1',  'al1',  'pop',        ['romantic','calm'],      'D major',  204, 76, 3],

  ['t4',  'Wildflower Radio',      'a11', 'al2',  'pop',        ['happy','uplifting'],    'C major',  191, 74, 1],
  ['t5',  'Sundial',               'a11', 'al2',  'pop',        ['calm','romantic'],      'E major',  210, 69, 2],
  ['t6',  'Better With You',       'a11', 'al2',  'pop',        ['happy','romantic'],     'F major',  183, 72, 3],

  ['t7',  'Voltage',               'a2',  'al3',  'rock',       ['energetic','dark'],     'E minor',  221, 78, 1],
  ['t8',  'Concrete Wings',        'a2',  'al3',  'rock',       ['epic','energetic'],     'D minor',  245, 81, 2],
  ['t9',  'Static Bloom',          'a2',  'al3',  'rock',       ['dark','mysterious'],    'A minor',  198, 70, 3],

  ['t10', 'Midnight Exit',         'a3',  'al4',  'jazz',       ['mysterious','calm'],    'C# minor', 267, 60, 1],
  ['t11', 'Blue Room Waltz',       'a3',  'al4',  'jazz',       ['romantic','calm'],      'F# minor', 289, 64, 2],
  ['t12', 'Rainlight',             'a3',  'al4',  'jazz',       ['sad','mysterious'],     'G# minor', 255, 58, 3],

  ['t13', 'Synaptic',              'a4',  'al5',  'electronic', ['energetic','dark'],     'F# major', 214, 90, 1],
  ['t14', 'Afterglow Circuit',     'a4',  'al5',  'electronic', ['epic','mysterious'],    'B major',  232, 86, 2],
  ['t15', 'Vector Field',          'a4',  'al5',  'electronic', ['energetic','uplifting'],'D# major', 198, 88, 3],

  ['t16', 'Skyline Static',        'a5',  'al6',  'hip-hop',    ['energetic','dark'],     'A# minor', 176, 92, 1],
  ['t17', 'Corner Store Legend',   'a5',  'al6',  'hip-hop',    ['uplifting','energetic'],'G minor',  184, 89, 2],
  ['t18', 'Low Gravity',           'a5',  'al6',  'hip-hop',    ['dark','mysterious'],    'C minor',  201, 87, 3],

  ['t19', 'Prelude in Amber',      'a6',  'al7',  'classical',  ['romantic','calm'],      'D major',  312, 57, 1],
  ['t20', 'Winter Correspondence', 'a6',  'al7',  'classical',  ['sad','romantic'],       'A minor',  298, 54, 2],
  ['t21', 'The Long Return',       'a6',  'al7',  'classical',  ['epic','calm'],          'E minor',  340, 59, 3],

  ['t22', 'Gravel Road Home',      'a7',  'al8',  'country',    ['happy','romantic'],     'G major',  207, 71, 1],
  ['t23', 'Two Lane Heart',        'a7',  'al8',  'country',    ['romantic','happy'],     'C major',  195, 69, 2],
  ['t24', 'Porch Light',           'a7',  'al8',  'country',    ['sad','calm'],           'F major',  222, 66, 3],

  ['t25', 'Slow Static',           'a8',  'al9',  'rnb',        ['romantic','dark'],      'D# minor', 243, 82, 1],
  ['t26', 'Velvet Hours',          'a8',  'al9',  'rnb',        ['romantic','calm'],      'G# minor', 256, 80, 2],
  ['t27', 'Undertow',              'a8',  'al9',  'rnb',        ['sad','mysterious'],     'A# minor', 238, 77, 3],

  ['t28', 'Cloud Ledger',          'a9',  'al10', 'ambient',    ['calm','mysterious'],    'C major',  301, 48, 1],
  ['t29', 'Quiet Machinery',       'a9',  'al10', 'ambient',    ['dark','calm'],          'F minor',  329, 45, 2],
  ['t30', 'Drift Hour',            'a9',  'al10', 'ambient',    ['mysterious','calm'],    'B minor',  355, 50, 3],

  ['t31', 'Attic Weather',         'a10', 'al11', 'indie',      ['sad','mysterious'],     'E minor',  213, 65, 1],
  ['t32', 'Paper Boats',           'a10', 'al11', 'indie',      ['uplifting','sad'],      'D major',  198, 62, 2],
  ['t33', 'Half-Lit Rooms',        'a10', 'al11', 'indie',      ['mysterious','romantic'],'A major',  224, 64, 3],

  ['t34', 'Ember March',           'a12', 'al12', 'classical',  ['epic','energetic'],     'D minor',  276, 68, 1],
  ['t35', 'The Last Signal',       'a12', 'al12', 'classical',  ['epic','dark'],          'G minor',  298, 70, 2],
  ['t36', 'Hollow Crown',          'a12', 'al12', 'classical',  ['epic','mysterious'],    'C minor',  311, 66, 3],
]

const artistById = Object.fromEntries(ARTISTS_RAW.map(a => [a.id, a]))

export const TRACKS = TRACKS_RAW.map(
  ([id, title, artistId, albumId, genre, moods, key, durSec, popularity, trackNumber]) => {
    const artist = artistById[artistId]
    const album  = ALBUMS_RAW.find(al => al.id === albumId)
    return {
      id, title,
      artist: artist.name,
      artist_id: artistId,
      album: album.title,
      album_id: albumId,
      cover: null,
      duration_ms: durSec * 1000,
      duration: durSec,
      preview_url: null,   // no external audio — UI synthesizes a short chord preview from `key`
      external_url: null,
      popularity,
      explicit: false,
      release_date: album.release,
      track_number: trackNumber,
      genres: [genre],
      moods,
      key,
    }
  }
)

export const ARTISTS = ARTISTS_RAW.map(a => ({
  id: a.id,
  name: a.name,
  genres: a.genres,
  followers: a.followers,
  popularity: a.popularity,
  image: null,
  external_url: null,
}))

export const ALBUMS = ALBUMS_RAW.map(al => {
  const tracks = TRACKS.filter(t => t.album_id === al.id).sort((x, y) => x.track_number - y.track_number)
  return {
    id: al.id,
    title: al.title,
    artist: artistById[al.artistId].name,
    artist_id: al.artistId,
    cover: null,
    release_date: al.release,
    total_tracks: tracks.length,
    album_type: 'album',
    external_url: null,
  }
})

export const GENRES = ['pop','rock','jazz','electronic','hip-hop','classical','country','rnb','ambient','indie']
export const MOODS  = ['happy','sad','energetic','calm','dark','romantic','epic','mysterious','uplifting']

// ==================== QUERY FUNCTIONS ====================

export function searchCatalog(query, type = 'track,artist,album', limit = 20) {
  const q = (query || '').trim().toLowerCase()
  const types = type.split(',')
  const result = {}

  if (types.includes('track')) {
    const matches = !q ? TRACKS : TRACKS.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.album || '').toLowerCase().includes(q) ||
      t.genres.some(g => g.includes(q)) ||
      t.moods.some(m => m.includes(q))
    )
    result.tracks = matches.slice(0, limit)
    result.tracks_total = matches.length
  }
  if (types.includes('artist')) {
    const matches = !q ? ARTISTS : ARTISTS.filter(a =>
      a.name.toLowerCase().includes(q) || a.genres.some(g => g.includes(q))
    )
    result.artists = matches.slice(0, limit)
    result.artists_total = matches.length
  }
  if (types.includes('album')) {
    const matches = !q ? ALBUMS : ALBUMS.filter(al =>
      al.title.toLowerCase().includes(q) || al.artist.toLowerCase().includes(q)
    )
    result.albums = matches.slice(0, limit)
    result.albums_total = matches.length
  }
  return result
}

export function getFeatured(limit = 20) {
  return [...TRACKS].sort((a, b) => b.popularity - a.popularity).slice(0, limit)
}

export function getGenreTracks(genreId, limit = 20) {
  return TRACKS.filter(t => t.genres.includes(genreId))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit)
}

export function getMoodTracks(mood, limit = 20) {
  return TRACKS.filter(t => t.moods.includes(mood))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit)
}

export function getArtist(id) {
  return ARTISTS.find(a => a.id === id) || null
}

export function getArtistAlbums(id) {
  return ALBUMS.filter(al => al.artist_id === id)
}

export function getArtistTopTracks(id, limit = 10) {
  return TRACKS.filter(t => t.artist_id === id).sort((a, b) => b.popularity - a.popularity).slice(0, limit)
}

export function getAlbum(id) {
  const album = ALBUMS.find(al => al.id === id)
  if (!album) return null
  const tracks = TRACKS.filter(t => t.album_id === id).sort((a, b) => a.track_number - b.track_number)
  return { ...album, tracks }
}

export function getTrack(id) {
  return TRACKS.find(t => t.id === id) || null
}
