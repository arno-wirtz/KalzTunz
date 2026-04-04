import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useSpotify } from '../hooks/useSpotify'

/* ── localStorage history helpers (shared with Library) ── */
const HISTORY_KEY = 'kalztunz_search_history'
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}
function saveHistory(h) { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 50))) }
function addToHistory(query, type = 'search') {
  const history = loadHistory()
  const entry   = { id: Date.now(), query, type, timestamp: new Date().toISOString() }
  const deduped = history.filter(h => h.query.toLowerCase() !== query.toLowerCase())
  saveHistory([entry, ...deduped])
}

/* ── Trending searches by category ───────────────────────── */
const TRENDING = {
  'track,artist,album': [
    { query:'Taylor Swift',       type:'artist', icon:'🔥' },
    { query:'The Weeknd',         type:'artist', icon:'🔥' },
    { query:'Billie Eilish',      type:'artist', icon:'📈' },
    { query:'Ed Sheeran',         type:'artist', icon:'📈' },
    { query:'Kendrick Lamar',     type:'artist', icon:'🔥' },
    { query:'jazz piano 2024',    type:'search', icon:'🎹' },
    { query:'lo-fi chill beats',  type:'search', icon:'🎧' },
    { query:'classical guitar',   type:'search', icon:'🎸' },
  ],
  track: [
    { query:'Blinding Lights',    type:'search', icon:'🔥' },
    { query:'Levitating',         type:'search', icon:'📈' },
    { query:'As It Was',          type:'search', icon:'🔥' },
    { query:'Flowers',            type:'search', icon:'📈' },
    { query:'Cruel Summer',       type:'search', icon:'🔥' },
    { query:'Starboy',            type:'search', icon:'📈' },
  ],
  artist: [
    { query:'Drake',              type:'artist', icon:'🔥' },
    { query:'Bad Bunny',          type:'artist', icon:'🔥' },
    { query:'The Beatles',        type:'artist', icon:'🎸' },
    { query:'Ariana Grande',      type:'artist', icon:'📈' },
    { query:'Post Malone',        type:'artist', icon:'📈' },
    { query:'Adele',              type:'artist', icon:'🎤' },
  ],
  album: [
    { query:'Midnights Taylor Swift',  type:'search', icon:'🔥' },
    { query:'After Hours The Weeknd',  type:'search', icon:'📈' },
    { query:'Scorpion Drake',          type:'search', icon:'📈' },
    { query:'Renaissance Beyoncé',     type:'search', icon:'🔥' },
    { query:'Harry\'s House',          type:'search', icon:'📈' },
  ],
}

/* ── Moods ────────────────────────────────────────────────── */
const MOODS = [
  { key:'happy',     label:'Happy',     emoji:'😊', color:'#f59e0b', bg:'rgba(245,158,11,.12)' },
  { key:'sad',       label:'Sad',       emoji:'😢', color:'#7c5ce7', bg:'rgba(124,92,231,.12)' },
  { key:'energetic', label:'Energetic', emoji:'⚡', color:'#ef4444', bg:'rgba(239,68,68,.12)' },
  { key:'chill',     label:'Chill',     emoji:'😌', color:'#00d4aa', bg:'rgba(0,212,170,.12)' },
  { key:'romantic',  label:'Romantic',  emoji:'💕', color:'#ec4899', bg:'rgba(236,72,153,.12)' },
  { key:'focus',     label:'Focus',     emoji:'🎯', color:'#8b5cf6', bg:'rgba(139,92,246,.12)' },
  { key:'dark',      label:'Dark',      emoji:'🌑', color:'#64748b', bg:'rgba(100,116,139,.12)' },
  { key:'epic',      label:'Epic',      emoji:'🔥', color:'#dc2626', bg:'rgba(220,38,38,.12)' },
  { key:'morning',   label:'Morning',   emoji:'🌅', color:'#f97316', bg:'rgba(249,115,22,.12)' },
]

const GENRE_BROWSE = [
  { label:'Pop',        emoji:'🎤', color:'#f59e0b', query:'pop hits' },
  { label:'Hip-Hop',    emoji:'🎧', color:'#8b5cf6', query:'hip hop' },
  { label:'Rock',       emoji:'🎸', color:'#ef4444', query:'rock anthems' },
  { label:'Jazz',       emoji:'🎷', color:'#d4a017', query:'jazz piano' },
  { label:'R&B',        emoji:'💜', color:'#ec4899', query:'rnb soul' },
  { label:'Electronic', emoji:'🎛️', color:'#00d4aa', query:'electronic dance' },
  { label:'Classical',  emoji:'🎻', color:'#6366f1', query:'classical orchestra' },
  { label:'Indie',      emoji:'🌿', color:'#22c55e', query:'indie alternative' },
  { label:'Country',    emoji:'🤠', color:'#d97706', query:'country hits' },
  { label:'Afrobeats',  emoji:'🥁', color:'#f97316', query:'afrobeats' },
  { label:'Latin',      emoji:'💃', color:'#f43f5e', query:'latin reggaeton' },
  { label:'K-Pop',      emoji:'⭐', color:'#a855f7', query:'kpop' },
]

const SEARCH_TYPES = [
  { key:'track,artist,album', label:'🎵 All' },
  { key:'track',              label:'🎵 Tracks' },
  { key:'artist',             label:'👤 Artists' },
  { key:'album',              label:'💿 Albums' },
]

/* ── Utils ───────────────────────────────────────────────── */
const fmtDur = ms => { const s=Math.floor((ms||0)/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` }
const fmtNum = n  => n>=1_000_000?`${(n/1_000_000).toFixed(1)}M`:n>=1000?`${(n/1000).toFixed(1)}k`:String(n)
const fmtDate = iso => {
  if (!iso) return ''
  const d=new Date(iso), now=new Date(), diff=Math.floor((now-d)/1000)
  if (diff<60) return 'just now'
  if (diff<3600) return `${Math.floor(diff/60)}m ago`
  if (diff<86400) return `${Math.floor(diff/3600)}h ago`
  if (diff<604800) return `${Math.floor(diff/86400)}d ago`
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})
}
const placeholderCover = name => {
  const hues=[200,240,260,180,30,300,150,20,340,160]
  const h=hues[(name?.charCodeAt(0)||65)%hues.length]
  return `linear-gradient(135deg,hsl(${h},55%,18%),hsl(${(h+50)%360},45%,28%))`
}

/* ── Cover ───────────────────────────────────────────────── */
function Cover({ src, alt, size=56, radius=8, style={} }) {
  const [err, setErr] = useState(false)
  if (!src||err) return <div style={{ width:size,height:size,borderRadius:radius,flexShrink:0,background:placeholderCover(alt||''),display:'flex',alignItems:'center',justifyContent:'center',fontSize:size>48?'1.4rem':'.9rem',...style }}>🎵</div>
  return <img src={src} alt={alt} onError={()=>setErr(true)} style={{ width:size,height:size,borderRadius:radius,objectFit:'cover',flexShrink:0,display:'block',...style }}/>
}

/* ── Now Playing Bar ─────────────────────────────────────── */
function NowPlayingBar({ track, onClose }) {
  const [playing, setPlaying] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const audioRef = useRef(null)
  const timerRef = useRef(null)
  const dur = track?.duration || Math.floor((track?.duration_ms||0)/1000) || 30

  useEffect(() => {
    setElapsed(0); setPlaying(true)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (track?.preview_url) {
      const audio = new Audio(track.preview_url)
      audio.play().catch(()=>{})
      audioRef.current = audio
      audio.onended = () => setPlaying(false)
    }
    return () => { audioRef.current?.pause(); clearInterval(timerRef.current) }
  }, [track?.id])

  useEffect(() => {
    clearInterval(timerRef.current)
    if (playing && track) {
      timerRef.current = setInterval(() => {
        setElapsed(e => { const n=e+1; if(n>=dur){clearInterval(timerRef.current);setPlaying(false)} return n })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [playing, track])

  if (!track) return null
  const pct = dur > 0 ? (elapsed/dur)*100 : 0

  return (
    <div className="now-playing-bar">
      <Cover src={track.cover} alt={track.title} size={40} radius={7} />
      <div className="np-info"><div className="np-title">{track.title}</div><div className="np-artist">{track.artist}</div></div>
      <div className="np-controls">
        <button className="np-btn np-play" onClick={() => {
          if (!audioRef.current) return
          if (playing) { audioRef.current.pause(); setPlaying(false) }
          else         { audioRef.current.play().catch(()=>{}); setPlaying(true) }
        }}>
          {playing
            ? <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            : <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
        </button>
      </div>
      <div className="np-progress-wrap">
        <span className="np-time">{fmtDur(elapsed*1000)}</span>
        <div className="np-bar" onClick={e=>{const pct=e.nativeEvent.offsetX/e.currentTarget.offsetWidth;setElapsed(Math.round(pct*dur))}}>
          <div className="np-bar-fill" style={{ width:`${pct}%` }}/>
        </div>
        <span className="np-time">{fmtDur(dur*1000)}</span>
      </div>
      {track.preview_url
        ? <span style={{ fontSize:'.65rem',color:'var(--cyan)',flexShrink:0 }}>▶ 30s preview</span>
        : <a href={track.external_url} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm" style={{ flexShrink:0,fontSize:'.72rem' }}>Open Spotify ↗</a>
      }
      <button className="np-close" onClick={onClose}>
        <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    </div>
  )
}

/* ── Album Row (inside ArtistModal) ─────────────────────── */
function AlbumRow({ al, albumTracks, loadingAlb, loadAlbumTracks, onPlay, TrackRow }) {
  const [open, setOpen] = useState(false)
  const toggle = () => { if (!open && !albumTracks[al.id]) loadAlbumTracks(al.id); setOpen(o => !o) }
  return (
    <div>
      <div style={{ display:'flex',alignItems:'center',gap:'.85rem',cursor:'pointer',padding:'.35rem .15rem' }} onClick={toggle}>
        <Cover src={al.cover} alt={al.title} size={52} radius={8}/>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontWeight:700,fontSize:'.9rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{al.title}</div>
          <div style={{ fontSize:'.72rem',color:'var(--text-3)',marginTop:'.1rem' }}>
            {al.album_type?.charAt(0).toUpperCase()+al.album_type?.slice(1)} · {al.release_date?.slice(0,4)} · {al.total_tracks} tracks
          </div>
        </div>
        <div style={{ display:'flex',gap:'.4rem',flexShrink:0 }}>
          <button className="btn btn--ghost btn--sm" onClick={e=>{e.stopPropagation();onPlay({id:al.id,title:al.title,artist:al.artist,cover:al.cover,preview_url:null,external_url:al.external_url})}}>▶ Play</button>
          <span style={{ color:'var(--text-3)',fontSize:'.8rem',display:'flex',alignItems:'center' }}>{open?'▲':'▼'}</span>
        </div>
      </div>
      {open && (
        <div style={{ paddingLeft:'3.85rem',marginTop:'.4rem' }}>
          {loadingAlb===al.id && <div style={{ padding:'.75rem',display:'flex',justifyContent:'center' }}><span className="spinner"/></div>}
          {(albumTracks[al.id]||[]).map((t,i) => <TrackRow key={t.id} t={t} i={i+1}/>)}
        </div>
      )}
    </div>
  )
}

/* ── Artist Profile Modal ────────────────────────────────── */
function ArtistModal({ artistId, onClose, onPlay, liked, onLike }) {
  const { getArtist, getArtistAlbums, getArtistTopTracks, getAlbum } = useSpotify()
  const [artist,     setArtist]     = useState(null)
  const [albums,     setAlbums]     = useState([])
  const [topTracks,  setTopTracks]  = useState([])
  const [albumTracks,setAlbumTracks]= useState({})
  const [modalTab,   setModalTab]   = useState('top')
  const [loadingAlb, setLoadingAlb] = useState(null)
  const [followed,   setFollowed]   = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getArtist(artistId), getArtistAlbums(artistId, 20), getArtistTopTracks(artistId)]).then(([aR, alR, tR]) => {
      if (cancelled) return
      if (aR)  setArtist(aR.artist)
      if (alR) setAlbums(alR.albums || [])
      if (tR)  setTopTracks(tR.tracks || [])
    })
    return () => { cancelled = true }
  }, [artistId])

  const loadAlbumTracks = useCallback(async id => {
    if (albumTracks[id]) return
    setLoadingAlb(id)
    const res = await getAlbum(id)
    if (res) setAlbumTracks(prev => ({ ...prev, [id]: res.tracks||[] }))
    setLoadingAlb(null)
  }, [albumTracks, getAlbum])

  if (!artist) return (
    <div className="artist-modal-backdrop" onClick={onClose}>
      <div className="artist-modal" onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:'4rem' }}>
          <span className="spinner spinner--lg"/>
        </div>
      </div>
    </div>
  )

  const bgGrad = placeholderCover(artist.name||'A')
  const TrackRow = ({ t, i }) => (
    <div style={{ display:'flex',alignItems:'center',gap:'.65rem',padding:'.5rem .55rem',borderRadius:8,cursor:'pointer',transition:'background .15s' }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--bg-2)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
      onClick={() => onPlay(t)}>
      <span style={{ width:18,textAlign:'center',fontSize:'.72rem',color:'var(--text-3)',fontFamily:'monospace',flexShrink:0 }}>{i}</span>
      <Cover src={t.cover} alt={t.title} size={36} radius={6}/>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontSize:'.84rem',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{t.title}</div>
        <div style={{ fontSize:'.7rem',color:'var(--text-3)' }}>{t.album}</div>
      </div>
      <div style={{ display:'flex',alignItems:'center',gap:'.45rem',flexShrink:0 }}>
        {t.popularity!==undefined && <span style={{ fontSize:'.65rem',color:'var(--text-3)' }}>♦ {t.popularity}</span>}
        <button onClick={e=>{e.stopPropagation();onLike(t.id)}} style={{ background:'none',border:'none',cursor:'pointer',color:liked.has(t.id)?'var(--accent-err)':'var(--text-3)',padding:'.2rem',display:'flex' }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill={liked.has(t.id)?'currentColor':'none'} stroke="currentColor" strokeWidth={2}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <span style={{ fontSize:'.7rem',color:'var(--text-3)',fontFamily:'monospace',minWidth:32,textAlign:'right' }}>{fmtDur(t.duration_ms||(t.duration||0)*1000)}</span>
      </div>
    </div>
  )

  return (
    <div className="artist-modal-backdrop" onClick={onClose}>
      <div className="artist-modal" onClick={e=>e.stopPropagation()}>
        <div className="artist-modal__header" style={{ backgroundImage:`url(${artist.image})`,backgroundSize:'cover',backgroundPosition:'center top' }}>
          <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.3) 100%)' }}/>
          <button className="artist-modal__close" onClick={onClose}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
          <div style={{ position:'relative',zIndex:1,display:'flex',alignItems:'flex-end',gap:'.85rem',width:'100%' }}>
            <div className="artist-modal__avatar" style={{ background:bgGrad }}>
              {artist.image ? <img src={artist.image} alt={artist.name} style={{ width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%' }}/> : artist.name?.charAt(0)}
            </div>
            <div className="artist-modal__info" style={{ flex:1,minWidth:0 }}>
              <div className="artist-modal__name">{artist.name}<span style={{ marginLeft:'.4rem',color:'#1DB954',fontSize:'.8rem' }}>✓ Spotify</span></div>
              <div className="artist-modal__stats">{fmtNum(artist.followers||0)} followers{artist.genres?.length>0&&` · ${artist.genres.slice(0,2).join(', ')}`}</div>
            </div>
            <div style={{ display:'flex',gap:'.5rem',flexShrink:0 }}>
              <button onClick={()=>setFollowed(f=>!f)} style={{ padding:'.38rem .9rem',borderRadius:20,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.8rem',transition:'all .2s',background:followed?'rgba(255,255,255,.15)':'#1DB954',color:'#fff' }}>
                {followed?'Following ✓':'+ Follow'}
              </button>
              {artist.external_url && <a href={artist.external_url} target="_blank" rel="noreferrer" style={{ display:'flex',alignItems:'center',gap:'.3rem',padding:'.38rem .7rem',borderRadius:20,background:'rgba(29,185,84,.15)',border:'1px solid rgba(29,185,84,.35)',color:'#1DB954',textDecoration:'none',fontSize:'.75rem',fontWeight:700 }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                Spotify
              </a>}
            </div>
          </div>
        </div>
        <div className="artist-modal__body">
          {artist.genres?.length>0 && <div style={{ display:'flex',flexWrap:'wrap',gap:'.35rem',marginBottom:'1rem' }}>{artist.genres.map(g=><span key={g} style={{ background:'var(--bg-3)',border:'1px solid var(--border)',borderRadius:999,padding:'.18rem .6rem',fontSize:'.7rem',color:'var(--text-2)',textTransform:'capitalize' }}>{g}</span>)}</div>}
          <div className="artist-modal__tabs">
            {[['top','🎵 Top Tracks'],['albums','💿 Albums']].map(([k,l])=>(
              <button key={k} className={`artist-modal__tab ${modalTab===k?'active':''}`} onClick={()=>setModalTab(k)}>{l}</button>
            ))}
          </div>
          {modalTab==='top' && (
            <div style={{ display:'flex',flexDirection:'column',gap:'.25rem' }}>
              {topTracks.length===0&&<div style={{ textAlign:'center',padding:'2rem' }}><span className="spinner"/></div>}
              {topTracks.map((t,i)=><TrackRow key={t.id} t={t} i={i+1}/>)}
            </div>
          )}
          {modalTab==='albums' && (
            <div style={{ display:'flex',flexDirection:'column',gap:'1.25rem' }}>
              {albums.length===0&&<div style={{ textAlign:'center',padding:'2rem' }}><span className="spinner"/></div>}
              {albums.map(al => (
                <AlbumRow key={al.id} al={al} albumTracks={albumTracks} loadingAlb={loadingAlb}
                  loadAlbumTracks={loadAlbumTracks} onPlay={onPlay} TrackRow={TrackRow} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Track Card ──────────────────────────────────────────── */
function TrackCard({ track, onPlay, onLike, liked, saved, onSave, onArtistClick }) {
  return (
    <div className="track-card">
      <div className="track-card__cover" onClick={()=>onPlay(track)} style={{ cursor:'pointer',position:'relative',overflow:'hidden' }}>
        {track.cover
          ? <img src={track.cover} alt={track.title} style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover' }} onError={()=>{}}/>
          : <div style={{ position:'absolute',inset:0,background:placeholderCover(track.title),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem' }}>🎵</div>
        }
        <div className="track-card__overlay">
          <button className="track-card__play" onClick={e=>{e.stopPropagation();onPlay(track)}}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
      </div>
      <div className="track-card__body">
        <div className="track-card__title" title={track.title}>{track.title}</div>
        <button onClick={()=>onArtistClick&&onArtistClick(track.artist_id,track.artist)} style={{ background:'none',border:'none',cursor:'pointer',padding:0,color:'var(--text-2)',fontSize:'.76rem',textAlign:'left',fontFamily:'inherit',transition:'color .15s',lineHeight:1.3 }} onMouseEnter={e=>e.currentTarget.style.color='var(--coral)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-2)'}>
          {track.artist}
        </button>
        <div className="track-card__meta" style={{ marginTop:'.45rem' }}>
          <span style={{ fontSize:'.65rem',color:'var(--text-3)',fontFamily:'monospace' }}>{fmtDur(track.duration_ms)}</span>
          {track.explicit&&<span style={{ fontSize:'.58rem',background:'var(--bg-3)',border:'1px solid var(--border)',borderRadius:3,padding:'0 .3rem',color:'var(--text-3)',fontWeight:700 }}>E</span>}
          <div className="track-card__actions">
            <button className="btn btn--icon btn--ghost btn--sm" style={{ color:liked?'var(--accent-err)':'var(--text-3)',borderColor:'transparent',padding:'.2rem .25rem' }} onClick={()=>onLike(track.id)}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill={liked?'currentColor':'none'} stroke="currentColor" strokeWidth={2}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
            <button className="btn btn--icon btn--ghost btn--sm" style={{ color:saved?'var(--coral)':'var(--text-3)',borderColor:'transparent',padding:'.2rem .25rem' }} onClick={()=>onSave(track.id)}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill={saved?'currentColor':'none'} stroke="currentColor" strokeWidth={2}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          </div>
        </div>
        {track.popularity!==undefined&&(
          <div style={{ marginTop:'.35rem' }}>
            <div style={{ height:2,borderRadius:1,background:'var(--bg-3)',overflow:'hidden' }}>
              <div style={{ height:'100%',background:'var(--coral)',width:`${track.popularity}%`,borderRadius:1 }}/>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Artist Card ──────────────────────────────────────────── */
function ArtistCard({ artist, onClick }) {
  return (
    <div className="artist-card" style={{ cursor:'pointer' }} onClick={onClick}>
      <div className="artist-card__avatar" style={{ overflow:'hidden' }}>
        {artist.image
          ? <img src={artist.image} alt={artist.name} style={{ width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%' }}/>
          : <span style={{ background:placeholderCover(artist.name),width:'100%',height:'100%',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.3rem',fontWeight:800,color:'#fff' }}>{artist.name?.charAt(0)}</span>
        }
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div className="artist-card__name">{artist.name} <span style={{ color:'#1DB954',fontSize:'.72rem' }}>✓</span></div>
        <div className="artist-card__meta">{fmtNum(artist.followers)} followers</div>
        {artist.genres?.length>0&&<div style={{ fontSize:'.7rem',color:'var(--text-3)',marginTop:'.15rem' }} className="truncate">{artist.genres.slice(0,3).join(' · ')}</div>}
      </div>
      <span style={{ fontSize:'.7rem',color:'var(--text-3)',flexShrink:0 }}>View →</span>
    </div>
  )
}

/* ── Album Card ───────────────────────────────────────────── */
function AlbumCard({ album, onClick }) {
  return (
    <div className="track-card" style={{ cursor:'pointer' }} onClick={onClick}>
      <div className="track-card__cover" style={{ position:'relative',overflow:'hidden' }}>
        {album.cover
          ? <img src={album.cover} alt={album.title} style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover' }}/>
          : <div style={{ position:'absolute',inset:0,background:placeholderCover(album.title),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem' }}>💿</div>
        }
      </div>
      <div className="track-card__body">
        <div className="track-card__title" title={album.title}>{album.title}</div>
        <div style={{ fontSize:'.76rem',color:'var(--text-2)' }}>{album.artist}</div>
        <div style={{ fontSize:'.68rem',color:'var(--text-3)',marginTop:'.35rem',display:'flex',gap:'.5rem' }}>
          <span>{album.release_date?.slice(0,4)}</span>
          <span>{album.total_tracks} tracks</span>
          <span style={{ textTransform:'capitalize' }}>{album.album_type}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Spotify not configured banner ───────────────────────── */
function SpotifyBanner() {
  return (
    <div style={{ background:'linear-gradient(135deg,rgba(29,185,84,.08),rgba(29,185,84,.04))',border:'1px solid rgba(29,185,84,.25)',borderRadius:14,padding:'1.5rem',marginBottom:'1.5rem' }}>
      <div style={{ display:'flex',gap:'1rem',alignItems:'flex-start',flexWrap:'wrap' }}>
        <svg width={36} height={36} viewBox="0 0 24 24" fill="#1DB954" style={{ flexShrink:0 }}><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800,fontSize:'.95rem',marginBottom:'.4rem',color:'#1DB954' }}>Connect Spotify to unlock real music data</div>
          <p style={{ fontSize:'.82rem',color:'var(--text-2)',lineHeight:1.6,marginBottom:'.85rem' }}>Add <code style={{ background:'var(--bg-3)',padding:'0 .3rem',borderRadius:4,fontSize:'.78rem' }}>SPOTIFY_CLIENT_ID</code> and <code style={{ background:'var(--bg-3)',padding:'0 .3rem',borderRadius:4,fontSize:'.78rem' }}>SPOTIFY_CLIENT_SECRET</code> to your .env</p>
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" className="btn btn--primary btn--sm" style={{ background:'#1DB954',borderColor:'#1DB954' }}>Get Free API Keys →</a>
        </div>
      </div>
    </div>
  )
}

/* ── Skeleton ────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="track-card">
      <div style={{ aspectRatio:1,background:'var(--bg-3)',animation:'pulse 1.5s ease infinite' }}/>
      <div style={{ padding:'.85rem 1rem' }}>
        <div style={{ height:12,background:'var(--bg-3)',borderRadius:4,marginBottom:8,width:'80%',animation:'pulse 1.5s ease infinite' }}/>
        <div style={{ height:10,background:'var(--bg-3)',borderRadius:4,width:'55%',animation:'pulse 1.5s ease infinite' }}/>
      </div>
    </div>
  )
}
function SkeletonRow() {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:'.85rem',padding:'.75rem 1rem',borderRadius:10,background:'var(--bg-1)',border:'1px solid var(--border)' }}>
      <div style={{ width:50,height:50,borderRadius:'50%',background:'var(--bg-3)',animation:'pulse 1.5s ease infinite',flexShrink:0 }}/>
      <div style={{ flex:1 }}>
        <div style={{ height:12,background:'var(--bg-3)',borderRadius:4,marginBottom:6,width:'60%',animation:'pulse 1.5s ease infinite' }}/>
        <div style={{ height:10,background:'var(--bg-3)',borderRadius:4,width:'40%',animation:'pulse 1.5s ease infinite' }}/>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   MAIN SEARCH PAGE
══════════════════════════════════════════════════════════ */
export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const spotify  = useSpotify()

  const [inputVal,   setInputVal]   = useState(searchParams.get('q') || '')
  const [query,      setQuery]      = useState(searchParams.get('q') || '')
  const [searchType, setSearchType] = useState('track,artist,album')
  const [mood,       setMood]       = useState(null)
  const [activeMood, setActiveMood] = useState(null)

  const [tracks,     setTracks]     = useState([])
  const [artists,    setArtists]    = useState([])
  const [albums,     setAlbums]     = useState([])
  const [tab,        setTab]        = useState('tracks')

  const [liked,      setLiked]      = useState(new Set())
  const [saved,      setSaved]      = useState(new Set())
  const [nowPlaying, setNowPlaying] = useState(null)
  const [artistModal,setArtistModal]= useState(null)
  const [configured, setConfigured] = useState(true)
  const [firstLoad,  setFirstLoad]  = useState(true)

  // Search dropdown state
  const [inputFocused, setInputFocused] = useState(false)
  const [typeDropdown, setTypeDropdown] = useState(false)
  const inputRef   = useRef(null)
  const typeRef    = useRef(null)
  const dropdownRef = useRef(null)

  // Local history state
  const [localHistory, setLocalHistory] = useState(() => loadHistory().slice(0, 6))

  // Close dropdowns on outside click
  useEffect(() => {
    const h = e => {
      if (typeRef.current && !typeRef.current.contains(e.target)) setTypeDropdown(false)
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setInputFocused(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    spotify.checkStatus().then(res => { if (res) setConfigured(res.ok) })
  }, [])

  useEffect(() => {
    if (!configured || !firstLoad || query) return
    setFirstLoad(false)
    spotify.getFeatured(20).then(res => { if (res?.tracks) { setTracks(res.tracks); setTab('tracks') } })
  }, [configured, firstLoad, query])

  useEffect(() => {
    if (!query || !configured) return
    setMood(null); setActiveMood(null)
    spotify.searchSpotify(query, searchType, 30).then(res => {
      if (!res) return
      if (res.tracks)  setTracks(res.tracks)
      if (res.artists) setArtists(res.artists)
      if (res.albums)  setAlbums(res.albums)
      if (searchType==='artist') setTab('artists')
      else if (searchType==='album') setTab('albums')
      else setTab('tracks')
    })
  }, [query, searchType, configured])

  useEffect(() => {
    const q = searchParams.get('q') || ''
    setQuery(q); setInputVal(q)
  }, [searchParams.get('q')])

  useEffect(() => {
    if (nowPlaying) document.body.classList.add('has-player')
    else document.body.classList.remove('has-player')
    return () => document.body.classList.remove('has-player')
  }, [!!nowPlaying])

  const executeSearch = useCallback((q, type = searchType) => {
    if (!q.trim()) return
    addToHistory(q.trim(), type.includes('artist') && !type.includes(',') ? 'artist' : 'search')
    setLocalHistory(loadHistory().slice(0, 6))
    setQuery(q.trim())
    setSearchParams({ q: q.trim() })
    setInputFocused(false)
    setTypeDropdown(false)
  }, [searchType])

  const handleSearchSubmit = e => {
    e.preventDefault()
    executeSearch(inputVal)
  }

  const clearSearch = () => {
    setInputVal(''); setQuery(''); setSearchParams({})
    setMood(null); setActiveMood(null); setFirstLoad(true)
    inputRef.current?.focus()
  }

  const handleMood = useCallback(async m => {
    if (activeMood === m.key) { setMood(null); setActiveMood(null); setFirstLoad(true); return }
    setActiveMood(m.key); setQuery(''); setInputVal(''); setSearchParams({})
    const res = await spotify.getMoodTracks(m.key, 24)
    if (res?.tracks) { setTracks(res.tracks); setTab('tracks') }
    setMood(m)
  }, [activeMood])

  const toggleLike = useCallback(id => { setLiked(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n }) }, [])
  const toggleSave = useCallback(id => { setSaved(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n }) }, [])
  const openArtist = useCallback((id, name) => { if (id) setArtistModal({ id, name }) }, [])

  const loading = spotify.loading

  // Items to show in input dropdown: history OR trending
  const showDropdown = inputFocused && !query
  const dropdownItems = useMemo(() => {
    const q = inputVal.trim().toLowerCase()
    if (q) {
      // Filter history by input
      return { type:'filtered', items: loadHistory().filter(h=>h.query.toLowerCase().includes(q)).slice(0,6) }
    }
    if (localHistory.length > 0) {
      return { type:'history', items: localHistory }
    }
    return { type:'trending', items: TRENDING[searchType] || TRENDING['track,artist,album'] }
  }, [inputFocused, inputVal, localHistory, searchType])

  const currentTypeDef = SEARCH_TYPES.find(t=>t.key===searchType) || SEARCH_TYPES[0]
  const trending = TRENDING[searchType] || TRENDING['track,artist,album']

  return (
    <div className="page-wrap page--search" style={{ paddingTop:'2rem' }}>

      {/* Header */}
      <div className="page-header" style={{ marginBottom:'1.25rem' }}>
        <div className="page-header__badge">🔍 Discover</div>
        <h1 className="page-header__title">Find Music & Artists</h1>
        <p className="page-header__sub">Powered by Spotify · Search tracks, artists & albums · Browse by mood</p>
      </div>

      {!configured && <SpotifyBanner />}

      {/* ── Search bar with dropdown ── */}
      <div style={{ position:'relative',marginBottom:'1.1rem' }} ref={dropdownRef}>
        <form onSubmit={handleSearchSubmit}>
          <div className="search-bar" style={{ borderRadius: showDropdown || (inputVal && dropdownItems.items.length>0) ? '16px 16px 0 0' : 16 }}>
            {/* Type selector */}
            <div ref={typeRef} style={{ position:'relative',flexShrink:0 }}>
              <button
                type="button"
                onClick={() => setTypeDropdown(o=>!o)}
                style={{
                  display:'flex',alignItems:'center',gap:'.3rem',padding:'.3rem .55rem',
                  background:'var(--bg-3)',border:'1px solid var(--border)',borderRadius:9,
                  cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.75rem',
                  color:'var(--text)',transition:'all .18s',whiteSpace:'nowrap',
                }}
              >
                {currentTypeDef.label}
                <svg width={9} height={9} viewBox="0 0 10 6" fill="currentColor" style={{ color:'var(--text-3)',transition:'transform .18s',transform:typeDropdown?'rotate(180deg)':'none' }}><path d="M0 0l5 6 5-6z"/></svg>
              </button>

              {/* Type dropdown with trending searches */}
              {typeDropdown && (
                <div style={{
                  position:'absolute',top:'calc(100% + 6px)',left:0,zIndex:300,
                  background:'var(--bg-1)',border:'1px solid var(--border-hi)',
                  borderRadius:14,padding:'.5rem',boxShadow:'var(--shadow)',
                  minWidth:280,animation:'dropIn .18s ease',
                }}>
                  {/* Type options */}
                  <div style={{ marginBottom:'.5rem' }}>
                    <div style={{ fontSize:'.68rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em',padding:'.2rem .55rem .35rem' }}>Search type</div>
                    {SEARCH_TYPES.map(t => (
                      <button key={t.key} onClick={() => { setSearchType(t.key); setTypeDropdown(false) }} style={{
                        display:'flex',alignItems:'center',gap:'.5rem',width:'100%',padding:'.42rem .6rem',
                        borderRadius:9,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:600,
                        fontSize:'.82rem',transition:'all .15s',textAlign:'left',
                        background:searchType===t.key?'rgba(255,107,71,.1)':'transparent',
                        color:searchType===t.key?'var(--coral)':'var(--text-2)',
                      }}>
                        {t.label}
                        {searchType===t.key&&<svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft:'auto',color:'var(--coral)' }}><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                      </button>
                    ))}
                  </div>

                  {/* Trending searches for this type */}
                  <div style={{ borderTop:'1px solid var(--border)',paddingTop:'.5rem' }}>
                    <div style={{ fontSize:'.68rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em',padding:'.2rem .55rem .35rem' }}>🔥 Trending — {currentTypeDef.label}</div>
                    {(TRENDING[searchType]||TRENDING['track,artist,album']).slice(0,6).map((item,i) => (
                      <button key={i} onClick={() => { setSearchType(searchType); setTypeDropdown(false); executeSearch(item.query, searchType) }} style={{
                        display:'flex',alignItems:'center',gap:'.5rem',width:'100%',padding:'.38rem .6rem',
                        borderRadius:9,border:'none',cursor:'pointer',fontFamily:'inherit',
                        fontSize:'.82rem',background:'transparent',color:'var(--text-2)',
                        transition:'background .15s',textAlign:'left',fontWeight:500,
                      }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--bg-2)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                      >
                        <span style={{ fontSize:'.8rem',flexShrink:0 }}>{item.icon}</span>
                        <span style={{ flex:1 }}>{item.query}</span>
                        <span style={{ fontSize:'.68rem',color:'var(--text-3)',flexShrink:0 }}>
                          {item.type==='artist'?'Artist':'Track'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <input
              ref={inputRef}
              type="search"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onFocus={() => setInputFocused(true)}
              placeholder="Search songs, artists, albums on Spotify…"
              autoFocus={!!searchParams.get('q')}
              style={{ fontSize:'1rem' }}
            />
            {inputVal && (
              <button type="button" style={{ background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',display:'flex',padding:'.2rem' }} onClick={clearSearch}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            )}
            <button type="submit" className="btn btn--primary btn--sm" style={{ flexShrink:0 }} disabled={loading}>
              {loading ? <span className="spinner" style={{ width:14,height:14,borderWidth:2 }}/> : 'Search'}
            </button>
          </div>
        </form>

        {/* ── Input dropdown: history or trending ── */}
        {showDropdown && (
          <div style={{
            position:'absolute',top:'100%',left:0,right:0,zIndex:200,
            background:'var(--bg-1)',border:'1px solid var(--border-hi)',borderTop:'none',
            borderRadius:'0 0 16px 16px',boxShadow:'0 12px 40px rgba(0,0,0,.3)',
            maxHeight:340,overflowY:'auto',
          }}>
            {/* Section header */}
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.6rem 1rem .3rem',borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:'.7rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em' }}>
                {dropdownItems.type === 'trending' ? '🔥 Trending' : dropdownItems.type === 'filtered' ? '🔍 Matches' : '🕐 Recent'}
              </span>
              {dropdownItems.type === 'history' && (
                <button onClick={() => navigate('/library?section=history')} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'.72rem',color:'var(--coral)',fontFamily:'inherit',fontWeight:700 }}>
                  View all history →
                </button>
              )}
            </div>

            {/* Items */}
            {dropdownItems.items.length === 0 ? (
              <div style={{ padding:'1rem',textAlign:'center',color:'var(--text-3)',fontSize:'.82rem' }}>No matches</div>
            ) : (
              dropdownItems.items.map((item, i) => {
                const query  = item.query || item.label || ''
                const isHist = dropdownItems.type !== 'trending'
                return (
                  <div key={item.id || i}
                    style={{ display:'flex',alignItems:'center',gap:'.6rem',padding:'.5rem 1rem',cursor:'pointer',transition:'background .15s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg-2)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    onClick={() => { setInputVal(query); executeSearch(query) }}
                  >
                    <span style={{ fontSize:'.82rem',flexShrink:0,color:'var(--text-3)' }}>
                      {isHist ? (item.type==='artist'?'👤':'🕐') : item.icon}
                    </span>
                    <span style={{ flex:1,fontSize:'.875rem',fontWeight:500 }}>{query}</span>
                    {isHist && item.timestamp && (
                      <span style={{ fontSize:'.67rem',color:'var(--text-3)',flexShrink:0 }}>{fmtDate(item.timestamp)}</span>
                    )}
                    {!isHist && (
                      <span style={{ fontSize:'.68rem',color:'var(--text-3)',flexShrink:0,textTransform:'capitalize' }}>{item.type}</span>
                    )}
                    {isHist && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          const h = loadHistory().filter(x=>x.id!==item.id)
                          saveHistory(h); setLocalHistory(h.slice(0,6))
                        }}
                        style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',padding:'.15rem',flexShrink:0,opacity:.6,display:'flex' }}
                      >
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                      </button>
                    )}
                  </div>
                )
              })
            )}

            {/* Trending section when showing history */}
            {dropdownItems.type === 'history' && (
              <div style={{ borderTop:'1px solid var(--border)',padding:'.35rem 0' }}>
                <div style={{ padding:'.3rem 1rem .2rem',fontSize:'.68rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em' }}>🔥 Trending Now</div>
                <div style={{ display:'flex',flexWrap:'wrap',gap:'.35rem',padding:'.2rem 1rem .6rem' }}>
                  {trending.slice(0,5).map((item,i) => (
                    <button key={i} onClick={() => { setInputVal(item.query); executeSearch(item.query) }} style={{
                      padding:'.25rem .65rem',borderRadius:999,border:'1px solid var(--border-hi)',
                      background:'var(--bg-2)',cursor:'pointer',fontFamily:'inherit',fontSize:'.75rem',
                      color:'var(--text-2)',transition:'all .15s',display:'flex',alignItems:'center',gap:'.3rem',
                    }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--coral)';e.currentTarget.style.color='var(--coral)'}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-hi)';e.currentTarget.style.color='var(--text-2)'}}
                    >
                      {item.icon} {item.query}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Mood + Genre browse ── */}
      {!query && (
        <div style={{ marginBottom:'1.5rem' }}>
          {/* Genre grid */}
          <div style={{ fontSize:'.7rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.6rem' }}>
            🎵 Browse by Genre
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))',gap:'.5rem',marginBottom:'1.25rem' }}>
            {GENRE_BROWSE.map(g => (
              <button key={g.label} onClick={() => { setInputVal(g.query); executeSearch(g.query) }}
                style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:'.3rem',padding:'.65rem .4rem',borderRadius:12,border:`1.5px solid ${g.color}33`,background:`${g.color}10`,cursor:'pointer',fontFamily:'inherit',transition:'all .2s',color:'var(--text)' }}
                onMouseEnter={e=>{ e.currentTarget.style.background=`${g.color}22`; e.currentTarget.style.borderColor=g.color; e.currentTarget.style.transform='translateY(-2px)' }}
                onMouseLeave={e=>{ e.currentTarget.style.background=`${g.color}10`; e.currentTarget.style.borderColor=`${g.color}33`; e.currentTarget.style.transform='none' }}>
                <span style={{ fontSize:'1.3rem' }}>{g.emoji}</span>
                <span style={{ fontSize:'.72rem',fontWeight:700,color:g.color }}>{g.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Mood strip ── */}
      <div style={{ marginBottom:'1.25rem' }}>
        <div style={{ fontSize:'.7rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.55rem' }}>🎭 Browse by Mood</div>
        <div style={{ display:'flex',gap:'.4rem',flexWrap:'wrap' }}>
          {MOODS.map(m => (
            <button key={m.key}
              onClick={() => handleMood(m)} disabled={loading}
              style={{
                display:'flex',alignItems:'center',gap:'.35rem',
                padding:'.35rem .8rem',borderRadius:999,
                border:`1.5px solid ${activeMood===m.key ? m.color : m.color+'44'}`,
                background: activeMood===m.key ? m.color : m.bg,
                color: activeMood===m.key ? '#fff' : m.color,
                fontFamily:'inherit',fontWeight:700,fontSize:'.78rem',
                cursor:'pointer',transition:'all .2s',
              }}
              onMouseEnter={e=>{ if(activeMood!==m.key){ e.currentTarget.style.background=m.bg; e.currentTarget.style.transform='translateY(-2px)' } }}
              onMouseLeave={e=>{ if(activeMood!==m.key){ e.currentTarget.style.transform='none' } }}>
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter row ── */}
      <div style={{ display:'flex',alignItems:'center',gap:'.6rem',flexWrap:'wrap',marginBottom:'1.25rem' }}>
        <div style={{ display:'flex',background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:12,padding:3,gap:2 }}>
          {[['tracks',`🎵 Tracks`,tracks.length],['artists',`👤 Artists`,artists.length],['albums',`💿 Albums`,albums.length]].map(([k,l,n])=>(
            <button key={k} onClick={()=>setTab(k)} style={{
              display:'flex',alignItems:'center',gap:'.4rem',
              padding:'.32rem .85rem',borderRadius:9,border:'none',cursor:'pointer',
              fontFamily:'inherit',fontWeight:700,fontSize:'.78rem',transition:'all .2s',
              background:tab===k?'var(--accent)':'transparent',
              color:tab===k?'#fff':'var(--text-2)',
            }}>
              {l}
              {n > 0 && <span style={{ background:tab===k?'rgba(255,255,255,.2)':'var(--bg-3)',borderRadius:999,padding:'0 .38rem',fontSize:'.65rem',fontWeight:800 }}>{n}</span>}
            </button>
          ))}
        </div>
        {(query || activeMood) && (
          <button onClick={clearSearch} style={{ background:'none',border:'1px solid var(--border)',borderRadius:999,padding:'.28rem .7rem',cursor:'pointer',fontSize:'.75rem',color:'var(--text-3)',fontFamily:'inherit',transition:'all .18s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-3)'}}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* Error */}
      {spotify.error && <div className="alert alert--error" style={{ marginBottom:'1rem' }}>⚠ {spotify.error}</div>}

      {/* Results header */}
      <div className="search-results-header" style={{ marginBottom:'1rem' }}>
        <h2 style={{ fontSize:'1rem',fontWeight:700 }}>
          {mood ? `${mood.emoji} ${mood.label} Vibes` : query ? `Results for "${query}"` : 'Trending Now'}
        </h2>
        {loading && <span className="spinner" style={{ width:14,height:14,borderWidth:2 }}/>}
        {!loading && <span className="search-results-count">{tab==='tracks'?`${tracks.length} tracks`:tab==='artists'?`${artists.length} artists`:`${albums.length} albums`}</span>}
      </div>

      {/* Results */}
      {tab==='tracks' && (loading ? <div className="card-grid">{Array(8).fill(0).map((_,i)=><SkeletonCard key={i}/>)}</div>
        : tracks.length>0
          ? <div className="card-grid fade-up">{tracks.map((t,i)=><div key={t.id} className="fade-up" style={{ animationDelay:`${Math.min(i,6)*.04}s` }}><TrackCard track={t} onPlay={setNowPlaying} onLike={toggleLike} liked={liked.has(t.id)} onSave={toggleSave} saved={saved.has(t.id)} onArtistClick={openArtist}/></div>)}</div>
          : <div className="lib-empty fade-up"><div className="lib-empty__icon">{mood?mood.emoji:'🎵'}</div><p className="lib-empty__text">{query?`No tracks for "${query}"`:'Search for tracks above'}</p></div>
      )}

      {tab==='artists' && (loading ? <div style={{ display:'flex',flexDirection:'column',gap:'.5rem' }}>{Array(5).fill(0).map((_,i)=><SkeletonRow key={i}/>)}</div>
        : artists.length>0
          ? <div style={{ display:'flex',flexDirection:'column',gap:'.5rem' }} className="fade-up">{artists.map((a,i)=><div key={a.id} className="fade-up" style={{ animationDelay:`${i*.05}s` }}><ArtistCard artist={a} onClick={()=>openArtist(a.id,a.name)}/></div>)}</div>
          : <div className="lib-empty fade-up"><div className="lib-empty__icon">👤</div><p className="lib-empty__text">{query?`No artists for "${query}"`:'Search for artists above'}</p></div>
      )}

      {tab==='albums' && (loading ? <div className="card-grid">{Array(6).fill(0).map((_,i)=><SkeletonCard key={i}/>)}</div>
        : albums.length>0
          ? <div className="card-grid fade-up">{albums.map((a,i)=><div key={a.id} className="fade-up" style={{ animationDelay:`${Math.min(i,6)*.04}s` }}><AlbumCard album={a} onClick={()=>a.artist_id&&openArtist(a.artist_id,a.artist)}/></div>)}</div>
          : <div className="lib-empty fade-up"><div className="lib-empty__icon">💿</div><p className="lib-empty__text">{query?`No albums for "${query}"`:'Search for albums above'}</p></div>
      )}

      {artistModal && <ArtistModal artistId={artistModal.id} onClose={()=>setArtistModal(null)} onPlay={t=>{setNowPlaying(t);setArtistModal(null)}} liked={liked} onLike={toggleLike}/>}
      {nowPlaying  && <NowPlayingBar track={nowPlaying} onClose={()=>setNowPlaying(null)}/>}
    </div>
  )
}
