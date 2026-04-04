import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

/* ────────────────────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────────────────────── */
const fmtDate = iso => {
  if (!iso) return ''
  const d = new Date(iso), now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60)     return 'just now'
  if (diff < 3600)   return `${Math.floor(diff/60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff/3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`
  return d.toLocaleDateString(undefined, { month:'short', day:'numeric' })
}
const fmtDateFull = iso => !iso ? '' : new Date(iso).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
const fmtDur  = s => { const m=Math.floor(s/60), sec=Math.floor(s%60); return `${m}:${String(sec).padStart(2,'0')}` }
const fmtNum  = n => n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1000?`${(n/1000).toFixed(1)}k`:String(n)
const coverGrad  = t => { const h=[200,240,260,180,30,300,150,20,340,160][(t?.charCodeAt(0)||65)%10]; return `linear-gradient(135deg,hsl(${h},55%,18%),hsl(${(h+50)%360},45%,28%))` }
const avatarGrad = n => { const h=[200,260,300,30,150,180][(n?.charCodeAt(0)||65)%6]; return `linear-gradient(135deg,hsl(${h},50%,22%),hsl(${(h+50)%360},45%,32%))` }

/* ── localStorage helpers ─────────────────────────────────────── */
const HISTORY_KEY = 'kalztunz_search_history'
const LS_KEY      = 'kalztunz_library_data'

function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]') } catch { return [] } }
function saveHistory(h) { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0,50))) }
function addToHistory(query) {
  const h = loadHistory()
  saveHistory([{ id:Date.now(), query, type:'search', timestamp:new Date().toISOString() }, ...h.filter(x=>x.query.toLowerCase()!==query.toLowerCase())])
}

/* ── Offline-persistent library store ────────────────────────── */
// All library data lives in localStorage so the page works fully offline.
// When the user signs in, their cloud data will eventually sync here.
function loadLibraryData() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}
function saveLibraryData(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch {}
}

/* ── Seed data (shown to guests + as defaults before cloud sync) ─ */
const mk = (daysAgo) => new Date(Date.now() - daysAgo * 86400e3).toISOString()

const DEFAULT_DATA = {
  saved: [
    { id:'t8',  title:'Chord Cascade',     artist:'Mara Vex',   style:'pop',        duration:195, key:'C major', bpm:118, preview:null, savedAt: mk(2) },
    { id:'t2',  title:'Solar Progression', artist:'Axon Beats', style:'electronic', duration:204, key:'F major', bpm:128, preview:null, savedAt: mk(5) },
    { id:'t4',  title:'Acoustic Sessions', artist:'Harlow',     style:'indie',      duration:243, key:'G major', bpm:95,  preview:null, savedAt: mk(8) },
    { id:'t1',  title:'Midnight Chords',   artist:'Luna Ray',   style:'ambient',    duration:187, key:'A minor', bpm:90,  preview:null, savedAt: mk(10) },
  ],
  liked: [
    { id:'t10', title:'Club Extraction',   artist:'Mara Vex',   style:'electronic', duration:210, key:'G minor', bpm:140, preview:null, likedAt: mk(1) },
    { id:'t3',  title:'Jazz in the Rain',  artist:'Cleo Vance', style:'jazz',       duration:312, key:'Bb major',bpm:72,  preview:null, likedAt: mk(3) },
    { id:'t11', title:'Rooftop Sessions',  artist:'Sam Dios',   style:'indie',      duration:225, key:'D minor', bpm:102, preview:null, likedAt: mk(6) },
  ],
  artists: [
    { id:'a1', username:'Luna Ray',   bio:'Ambient textures from Pacific NW', followers:312,  tracks:7  },
    { id:'a5', username:'Mara Vex',   bio:'Pop & electronic fusion',          followers:1230, tracks:12 },
    { id:'a2', username:'Axon Beats', bio:'Electronic producer, Berlin',      followers:890,  tracks:9  },
    { id:'a3', username:'Cleo Vance', bio:'Jazz pianist & composer',          followers:215,  tracks:5  },
  ],
  playlists: [
    { id:'pl1', name:'Morning Vibes',   createdAt: mk(4),  tracks:[{id:'t2',title:'Solar Progression',artist:'Axon Beats',duration:204},{id:'t8',title:'Chord Cascade',artist:'Mara Vex',duration:195}] },
    { id:'pl2', name:'Late Night Jazz', createdAt: mk(9),  tracks:[{id:'t3',title:'Jazz in the Rain',artist:'Cleo Vance',duration:312}] },
    { id:'pl3', name:'Focus Mode',      createdAt: mk(14), tracks:[] },
  ],
  extractions: [
    { id:'e1', title:'summer_jam.mp3',     key:'C major', bpm:120, totalChords:32, createdAt: mk(1) },
    { id:'e2', title:'blues_riff.wav',     key:'A minor', bpm:90,  totalChords:18, createdAt: mk(4) },
    { id:'e3', title:'jazz_standard.flac', key:'F major', bpm:72,  totalChords:48, createdAt: mk(9) },
  ],
  generations: [
    { id:'g1', title:'Pop Progression #1', style:'pop',     key:'C major',  bpm:118, status:'finished', createdAt: mk(2) },
    { id:'g2', title:'Jazz Exploration',   style:'jazz',    key:'Bb major', bpm:85,  status:'finished', createdAt: mk(6) },
    { id:'g3', title:'Ambient Texture',    style:'ambient', key:'D minor',  bpm:70,  status:'queued',   createdAt: mk(.5) },
  ],
}

// Seed history once
;(function() {
  if (!loadHistory().length) {
    saveHistory([
      { id:1, query:'Billie Eilish',      type:'artist', timestamp: mk(.5) },
      { id:2, query:'jazz piano',         type:'search', timestamp: mk(1) },
      { id:3, query:'A minor chords',     type:'search', timestamp: mk(2) },
      { id:4, query:'The Script',         type:'artist', timestamp: mk(3) },
      { id:5, query:'lo-fi hip hop',      type:'search', timestamp: mk(4) },
      { id:6, query:'Coldplay',           type:'artist', timestamp: mk(5) },
    ])
  }
})()

/* ── SVG icons ─────────────────────────────────────────────────── */
const IconSearch   = () => <svg width={14} height={14} viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const IconTrash    = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"/></svg>
const IconX        = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
const IconArrow    = () => <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
const IconClock    = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
const IconPlay     = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
const IconPause    = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
const IconVolume   = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>

/* ── Mini audio player (uses Web Audio API for oscillator-based preview) ─ */
function useMiniPlayer() {
  const [playing,   setPlaying]   = useState(null) // { id, title, artist, key, bpm }
  const [progress,  setProgress]  = useState(0)
  const [elapsed,   setElapsed]   = useState(0)
  const audioRef  = useRef(null)
  const timerRef  = useRef(null)
  const ctxRef    = useRef(null)
  const oscRef    = useRef(null)
  const gainRef   = useRef(null)

  // Build an AudioContext-based chord preview from key+bpm
  const playTrack = useCallback((track) => {
    // Stop any existing
    stopAll()
    if (!track) return

    // If track has a real preview URL, use it
    if (track.preview) {
      const audio = new Audio(track.preview)
      audio.crossOrigin = 'anonymous'
      audioRef.current = audio
      audio.play().catch(() => {})
      audio.ontimeupdate = () => {
        if (audio.duration) {
          setProgress(audio.currentTime / audio.duration)
          setElapsed(audio.currentTime)
        }
      }
      audio.onended = () => { setPlaying(null); setProgress(0); setElapsed(0) }
      setPlaying(track)
      setProgress(0)
      setElapsed(0)
      return
    }

    // Otherwise generate a simple oscillator-based chord tone preview
    // Parse key → root frequency
    const KEY_FREQS = { C:261.63,'C#':277.18,D:293.66,'D#':311.13,E:329.63,F:349.23,'F#':369.99,G:392.00,'G#':415.30,A:440.00,'A#':466.16,B:493.88 }
    const rootNote = (track.key||'C major').split(' ')[0]
    const mode     = (track.key||'C major').split(' ')[1] || 'major'
    const root     = KEY_FREQS[rootNote] || 261.63
    // major triad: root, major3rd (+4 semitones), 5th (+7 semitones)
    const semitone  = (n) => root * Math.pow(2, n/12)
    const freqs     = mode === 'minor' ? [root, semitone(3), semitone(7)] : [root, semitone(4), semitone(7)]

    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)()
      ctxRef.current = ctx
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.18, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 28)
      gain.connect(ctx.destination)
      gainRef.current = gain

      freqs.forEach(f => {
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(f, ctx.currentTime)
        osc.connect(gain)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 28)
      })

      setPlaying(track)
      setProgress(0)
      setElapsed(0)

      let start = Date.now()
      const TOTAL = 28000 // 28 seconds
      timerRef.current = setInterval(() => {
        const el = (Date.now() - start) / 1000
        setElapsed(el)
        setProgress(Math.min(el / 28, 1))
        if (el >= 28) stopAll()
      }, 250)
    } catch(e) {
      console.warn('AudioContext not available:', e)
    }
  }, [])

  const stopAll = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null }
    if (ctxRef.current)   { try { ctxRef.current.close() } catch {} ctxRef.current = null }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setPlaying(null); setProgress(0); setElapsed(0)
  }, [])

  const toggleTrack = useCallback((track) => {
    if (playing?.id === track.id) { stopAll() } else { playTrack(track) }
  }, [playing, playTrack, stopAll])

  useEffect(() => () => stopAll(), [])

  return { playing, progress, elapsed, toggleTrack, stopAll }
}

/* ── Now Playing Bar ─────────────────────────────────────────── */
function NowPlayingBar({ playing, progress, elapsed, onStop }) {
  if (!playing) return null
  const total = playing.duration || 28
  return (
    <div className="now-playing-bar">
      <div className="np-cover" style={{ background: coverGrad(playing.title) }}>🎵</div>
      <div className="np-info">
        <div className="np-title">{playing.title}</div>
        <div className="np-artist">{playing.artist} · {playing.key}</div>
      </div>
      <div className="np-controls">
        <button className="np-btn np-play" onClick={onStop}><IconPause/></button>
      </div>
      <div className="np-progress-wrap">
        <span className="np-time">{fmtDur(elapsed)}</span>
        <div className="np-bar"><div className="np-bar-fill" style={{ width:`${progress*100}%` }}/></div>
        <span className="np-time">{fmtDur(total)}</span>
      </div>
      <div style={{ display:'flex',alignItems:'center',gap:'.38rem',marginLeft:'auto' }}>
        <span style={{ fontSize:'.68rem',color:'var(--text-3)' }}>{playing.bpm} BPM</span>
      </div>
      <button className="np-close" onClick={onStop} title="Stop"><IconX/></button>
    </div>
  )
}

/* ── Track row ───────────────────────────────────────────────── */
function TrackRow({ track, dateLabel, date, onRemove, removeLabel, onToggle, playing }) {
  return (
    <div className="lib-row" style={{ background:playing?'rgba(255,107,71,.06)':undefined, borderColor:playing?'var(--accent)':undefined }}>
      <button onClick={() => onToggle?.(track)}
        style={{ width:42,height:42,borderRadius:9,flexShrink:0,background:coverGrad(track.title),border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.95rem',transition:'transform .15s' }}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.08)'}
        onMouseLeave={e=>e.currentTarget.style.transform=''}>
        {playing
          ? <span style={{ color:'#fff',fontSize:'1.1rem',animation:'pulse 1s ease infinite' }}>⏸</span>
          : <span style={{ color:'rgba(255,255,255,.6)' }}>▶</span>
        }
      </button>
      <div className="lib-row__info">
        <div className="lib-row__title">{track.title}</div>
        <div className="lib-row__sub">{track.artist}</div>
      </div>
      <div className="lib-row__meta">
        <span className="badge badge--blue" style={{ fontSize:'.6rem' }}>{track.style}</span>
        <span style={{ fontSize:'.67rem',color:'var(--text-3)',fontFamily:'monospace' }}>{track.key}</span>
        <span style={{ fontSize:'.67rem',color:'var(--text-3)',fontFamily:'monospace' }}>{fmtDur(track.duration)}</span>
        {date && <span style={{ fontSize:'.67rem',color:'var(--text-3)',minWidth:60,textAlign:'right' }} title={fmtDateFull(date)}>{dateLabel} {fmtDate(date)}</span>}
        {onRemove && (
          <button className="btn btn--icon btn--ghost btn--sm lib-row__del" title={removeLabel} onClick={() => onRemove(track.id)}><IconX/></button>
        )}
      </div>
    </div>
  )
}

/* ── Guest banner ─────────────────────────────────────────────── */
function GuestBanner() {
  return (
    <div style={{ background:'linear-gradient(135deg,rgba(255,107,71,.08),rgba(255,179,71,.05))',border:'1px solid rgba(255,107,71,.22)',borderRadius:18,padding:'1.5rem',marginBottom:'1.5rem',display:'flex',alignItems:'center',gap:'1.25rem',flexWrap:'wrap' }}>
      <div style={{ fontSize:'2.5rem',flexShrink:0 }}>📁</div>
      <div style={{ flex:1,minWidth:200 }}>
        <div style={{ fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:'1rem',marginBottom:'.3rem' }}>
          You're viewing the demo library
        </div>
        <p style={{ fontSize:'.83rem',color:'var(--text-2)',lineHeight:1.6,margin:0 }}>
          This is a preview with sample data. Sign in to save your own extractions, liked tracks, playlists and history — all stored locally so it works offline too.
        </p>
      </div>
      <div style={{ display:'flex',gap:'.55rem',flexShrink:0,flexWrap:'wrap' }}>
        <Link to="/register" className="btn btn--primary btn--sm">Create Account</Link>
        <Link to="/login"    className="btn btn--ghost btn--sm">Sign In</Link>
      </div>
    </div>
  )
}

/* ── Create Playlist Modal ────────────────────────────────────── */
function CreatePlaylistModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div style={{ position:'fixed',inset:0,background:'var(--overlay)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem',animation:'fadeIn .18s ease' }} onClick={onClose}>
      <div style={{ background:'var(--bg-1)',border:'1px solid var(--border-hi)',borderRadius:20,padding:'1.75rem',width:'100%',maxWidth:400,boxShadow:'var(--shadow)',animation:'dropIn .22s ease' }} onClick={e=>e.stopPropagation()}>
        <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.1rem',fontWeight:800,marginBottom:'1.1rem' }}>New Playlist</h2>
        <div className="form">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input ref={ref} className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="My Playlist" maxLength={80}
              onKeyDown={e=>e.key==='Enter'&&name.trim()&&(onCreate(name.trim()),onClose())} />
          </div>
          <div style={{ display:'flex',gap:'.5rem',justifyContent:'flex-end' }}>
            <button className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button>
            <button className="btn btn--primary btn--sm" disabled={!name.trim()} onClick={()=>{onCreate(name.trim());onClose()}}>Create</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── History Modal ────────────────────────────────────────────── */
function HistoryModal({ onClose }) {
  const navigate = useNavigate()
  const [history,  setHistory]  = useState(loadHistory)
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState(new Set())
  const [sortBy,   setSortBy]   = useState('recent')

  const filtered = useMemo(() => {
    let h = history
    if (search.trim()) h = h.filter(i=>i.query.toLowerCase().includes(search.toLowerCase()))
    if (sortBy==='alpha') h=[...h].sort((a,b)=>a.query.localeCompare(b.query))
    return h
  }, [history,search,sortBy])

  const toggleSel = id => setSelected(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n })
  const delSelected = () => { const next=history.filter(h=>!selected.has(h.id)); setHistory(next); saveHistory(next); setSelected(new Set()) }
  const delOne = id => { const next=history.filter(h=>h.id!==id); setHistory(next); saveHistory(next); setSelected(p=>{const n=new Set(p);n.delete(id);return n}) }
  const clearAll = () => { setHistory([]); saveHistory([]); setSelected(new Set()) }
  const reSearch = q => { addToHistory(q); navigate(`/search?q=${encodeURIComponent(q)}`); onClose() }

  const grouped = useMemo(() => {
    const g={}, today=new Date(), yd=new Date(today); today.setHours(0,0,0,0); yd.setDate(today.getDate()-1)
    filtered.forEach(item=>{
      const d=new Date(item.timestamp)
      const label=d>=today?'Today':d>=yd?'Yesterday':fmtDateFull(item.timestamp)
      if(!g[label]) g[label]=[];g[label].push(item)
    }); return g
  }, [filtered])

  return (
    <div style={{ position:'fixed',inset:0,background:'var(--overlay)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem',animation:'fadeIn .18s ease' }} onClick={onClose}>
      <div style={{ width:'100%',maxWidth:600,maxHeight:'88vh',background:'var(--bg-1)',border:'1px solid var(--border-hi)',borderRadius:22,display:'flex',flexDirection:'column',boxShadow:'var(--shadow)',animation:'dropIn .22s ease' }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:'1.2rem 1.5rem .8rem',borderBottom:'1px solid var(--border)',flexShrink:0 }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.85rem' }}>
            <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.1rem',fontWeight:800 }}>Search History</h2>
            <button onClick={onClose} style={{ background:'none',border:'1px solid var(--border)',borderRadius:999,padding:'.2rem .55rem',cursor:'pointer',color:'var(--text-2)',fontSize:'.75rem',fontFamily:'inherit' }}>✕ Close</button>
          </div>
          <div className="search-bar" style={{ marginBottom:'.65rem' }}>
            <IconSearch/>
            <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter history…" style={{ fontSize:'.85rem' }}/>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:'.45rem',flexWrap:'wrap' }}>
            <div style={{ display:'flex',background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:9,padding:2,gap:2 }}>
              {[['recent','Recent'],['alpha','A–Z']].map(([v,l])=>(
                <button key={v} onClick={()=>setSortBy(v)} style={{ padding:'.22rem .55rem',borderRadius:7,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.72rem',background:sortBy===v?'var(--accent)':'transparent',color:sortBy===v?'#fff':'var(--text-2)',transition:'all .15s' }}>{l}</button>
              ))}
            </div>
            <span style={{ fontSize:'.72rem',color:'var(--text-3)' }}>{filtered.length} entries</span>
            {selected.size>0
              ? <><span style={{ fontSize:'.72rem',color:'var(--accent)' }}>{selected.size} selected</span>
                  <button className="btn btn--sm btn--danger" onClick={delSelected}>Delete</button>
                  <button className="btn btn--sm btn--ghost" onClick={()=>setSelected(new Set())}>Clear</button></>
              : <><button className="btn btn--sm btn--ghost" onClick={()=>setSelected(new Set(filtered.map(h=>h.id)))} style={{ marginLeft:'auto' }}>Select all</button>
                  <button className="btn btn--sm btn--danger" onClick={clearAll}>Clear all</button></>
            }
          </div>
        </div>
        <div style={{ flex:1,overflowY:'auto',padding:'0 .5rem' }}>
          {!filtered.length
            ? <div style={{ textAlign:'center',padding:'3rem',color:'var(--text-3)' }}><div style={{ fontSize:'2rem',marginBottom:'.5rem' }}>🔍</div><p>{search?`No match for "${search}"`:'No history yet'}</p></div>
            : Object.entries(grouped).map(([date,items])=>(
              <div key={date}>
                <div style={{ padding:'.6rem 1rem .3rem',fontSize:'.68rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em',position:'sticky',top:0,background:'var(--bg-1)',zIndex:1 }}>{date}</div>
                {items.map(item=>(
                  <div key={item.id}
                    style={{ display:'flex',alignItems:'center',gap:'.55rem',padding:'.5rem 1rem',borderRadius:10,margin:'.15rem 0',background:selected.has(item.id)?'rgba(255,107,71,.07)':'transparent',border:`1px solid ${selected.has(item.id)?'rgba(255,107,71,.22)':'transparent'}`,transition:'background .12s',cursor:'pointer' }}
                    onClick={()=>toggleSel(item.id)}>
                    <div style={{ width:18,height:18,borderRadius:4,border:`1.5px solid ${selected.has(item.id)?'var(--accent)':'var(--border-hi)'}`,background:selected.has(item.id)?'var(--accent)':'transparent',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .14s' }}>
                      {selected.has(item.id)&&<svg width={10} height={10} viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                    </div>
                    <span style={{ fontSize:'.77rem',color:'var(--text-3)',flexShrink:0 }}>{item.type==='artist'?'👤':'🔍'}</span>
                    <span style={{ flex:1,fontSize:'.875rem',fontWeight:600 }}>{item.query}</span>
                    <span style={{ fontSize:'.67rem',color:'var(--text-3)',flexShrink:0 }}>{fmtDate(item.timestamp)}</span>
                    <div style={{ display:'flex',gap:'.2rem',flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                      <button className="btn btn--icon btn--ghost btn--sm" title="Search again" onClick={()=>reSearch(item.query)} style={{ color:'var(--accent-3)',borderColor:'transparent',padding:'.2rem' }}><IconArrow/></button>
                      <button className="btn btn--icon btn--ghost btn--sm" title="Delete" onClick={()=>delOne(item.id)} style={{ color:'var(--text-3)',borderColor:'transparent',padding:'.2rem' }}><IconX/></button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

/* ── Playlist components ──────────────────────────────────────── */
function PlaylistCard({ playlist, onOpen, onDelete }) {
  const dur = playlist.tracks.reduce((s,t)=>s+(t.duration||0),0)
  return (
    <div className="lib-playlist-card" onClick={()=>onOpen(playlist)}>
      <div className="lib-playlist-cover">
        {playlist.tracks.slice(0,4).map((t,i)=>(
          <div key={t.id} style={{ position:'absolute',width:'50%',height:'50%',top:i<2?0:'50%',left:i%2===0?0:'50%',background:coverGrad(t.title),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.75rem' }}>🎵</div>
        ))}
        {!playlist.tracks.length&&<div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem',color:'var(--text-3)' }}>📂</div>}
        <div className="lib-playlist-play-overlay" style={{ background:'rgba(0,0,0,0)' }}>
          <div className="lib-playlist-play-btn" style={{ width:38,height:38,borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',opacity:0,boxShadow:'0 4px 16px rgba(255,107,71,.4)' }}><IconPlay/></div>
        </div>
      </div>
      <div className="lib-playlist-body">
        <div className="lib-playlist-name" title={playlist.name}>{playlist.name}</div>
        <div className="lib-playlist-meta">{playlist.tracks.length} tracks{dur>0&&` · ${fmtDur(dur)}`}</div>
        <div style={{ fontSize:'.67rem',color:'var(--text-3)',marginTop:'.1rem' }}>{fmtDate(playlist.createdAt)}</div>
      </div>
      <button className="btn btn--icon btn--ghost btn--sm lib-playlist-del" title="Delete" onClick={e=>{e.stopPropagation();onDelete(playlist.id)}}><IconTrash/></button>
    </div>
  )
}

function PlaylistDetail({ playlist, onBack, onRemoveTrack, onToggle, playingId }) {
  const dur = playlist.tracks.reduce((s,t)=>s+(t.duration||0),0)
  return (
    <div>
      <button className="btn btn--ghost btn--sm" onClick={onBack} style={{ marginBottom:'1.1rem' }}>← Back</button>
      <div style={{ display:'flex',alignItems:'center',gap:'1rem',marginBottom:'1.4rem',flexWrap:'wrap' }}>
        <div style={{ width:72,height:72,borderRadius:14,position:'relative',overflow:'hidden',flexShrink:0,background:'var(--bg-3)' }}>
          {playlist.tracks.slice(0,4).map((t,i)=>(
            <div key={t.id} style={{ position:'absolute',width:'50%',height:'50%',top:i<2?0:'50%',left:i%2===0?0:'50%',background:coverGrad(t.title),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.7rem' }}>🎵</div>
          ))}
          {!playlist.tracks.length&&<div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem' }}>📂</div>}
        </div>
        <div>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.25rem',fontWeight:800,marginBottom:'.18rem' }}>{playlist.name}</h2>
          <p style={{ fontSize:'.82rem',color:'var(--text-2)' }}>{playlist.tracks.length} tracks{dur>0&&` · ${fmtDur(dur)}`} · Created {fmtDateFull(playlist.createdAt)}</p>
        </div>
      </div>
      {!playlist.tracks.length
        ? <div className="lib-empty"><div className="lib-empty__icon">🎵</div><p className="lib-empty__text">This playlist is empty</p><Link to="/search" className="btn btn--primary btn--sm">Add tracks from Discover</Link></div>
        : <div style={{ display:'flex',flexDirection:'column',gap:'.42rem' }}>
            {playlist.tracks.map((t,i)=>(
              <div key={t.id} className="lib-row" style={{ background:playingId===t.id?'rgba(255,107,71,.06)':undefined, borderColor:playingId===t.id?'var(--accent)':undefined }}>
                <span style={{ width:18,textAlign:'center',fontSize:'.72rem',color:'var(--text-3)',fontFamily:'monospace',flexShrink:0 }}>{i+1}</span>
                <button onClick={()=>onToggle(t)} style={{ width:38,height:38,borderRadius:8,flexShrink:0,background:coverGrad(t.title),border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.85rem' }}>
                  {playingId===t.id?<span style={{color:'#fff',animation:'pulse 1s ease infinite'}}>⏸</span>:<span style={{color:'rgba(255,255,255,.55)'}}>▶</span>}
                </button>
                <div className="lib-row__info"><div className="lib-row__title">{t.title}</div><div className="lib-row__sub">{t.artist}</div></div>
                <div className="lib-row__meta">
                  <span style={{ fontSize:'.7rem',color:'var(--text-3)',fontFamily:'monospace' }}>{fmtDur(t.duration)}</span>
                  <button className="btn btn--icon btn--ghost btn--sm lib-row__del" onClick={()=>onRemoveTrack(playlist.id,t.id)}><IconX/></button>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

/* ── Recent history panel ─────────────────────────────────────── */
function RecentHistory({ onOpenFull }) {
  const navigate = useNavigate()
  const [hist, setHist] = useState(() => loadHistory().slice(0,6))
  const remove = (e,id) => { e.stopPropagation(); const next=loadHistory().filter(h=>h.id!==id); saveHistory(next); setHist(next.slice(0,6)) }
  if (!hist.length) return null
  return (
    <div className="card" style={{ padding:'1.25rem' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.8rem' }}>
        <div style={{ display:'flex',alignItems:'center',gap:'.45rem',fontWeight:700,fontSize:'.875rem' }}><IconClock/> Recent Searches</div>
        <button onClick={onOpenFull} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'.75rem',color:'var(--accent)',fontFamily:'inherit',fontWeight:700,display:'flex',alignItems:'center',gap:'.22rem' }}>View all <IconArrow/></button>
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:'.28rem' }}>
        {hist.map(item=>(
          <div key={item.id}
            style={{ display:'flex',alignItems:'center',gap:'.5rem',padding:'.38rem .55rem',borderRadius:9,cursor:'pointer',transition:'background .12s' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-2)'}
            onMouseLeave={e=>e.currentTarget.style.background=''}
            onClick={()=>{ addToHistory(item.query); navigate(`/search?q=${encodeURIComponent(item.query)}`) }}>
            <span style={{ color:'var(--text-3)',fontSize:'.77rem',flexShrink:0 }}>{item.type==='artist'?'👤':'🔍'}</span>
            <span style={{ flex:1,fontSize:'.84rem',fontWeight:500 }}>{item.query}</span>
            <span style={{ fontSize:'.66rem',color:'var(--text-3)',flexShrink:0 }}>{fmtDate(item.timestamp)}</span>
            <button onClick={e=>remove(e,item.id)} className="history-del-btn" style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',padding:'.12rem',display:'flex' }}><IconX/></button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   MAIN LIBRARY
══════════════════════════════════════════════════════════════════ */
export default function Library() {
  const { user } = useAuth()
  const isGuest  = !user

  // All data persists in localStorage — works offline
  const [data, setData] = useState(() => {
    const stored = loadLibraryData()
    return stored || DEFAULT_DATA
  })
  const updateData = useCallback((patch) => {
    setData(prev => {
      const next = { ...prev, ...patch }
      saveLibraryData(next)
      return next
    })
  }, [])

  const { saved, liked, artists, playlists, extractions, generations } = data

  const [activeSection,  setActiveSection]  = useState('overview')
  const [search,         setSearch]         = useState('')
  const [showCreate,     setShowCreate]     = useState(false)
  const [openPlaylist,   setOpenPlaylist]   = useState(null)
  const [showHistory,    setShowHistory]    = useState(false)

  const { playing, progress, elapsed, toggleTrack, stopAll } = useMiniPlayer()

  const counts = useMemo(() => ({
    playlists: playlists.length, saved: saved.length, liked: liked.length,
    artists: artists.length, extractions: extractions.length,
    generated: generations.length, history: loadHistory().length,
  }), [playlists, saved, liked, artists, extractions, generations])

  const q = search.toLowerCase()
  const filterT = arr => !q ? arr : arr.filter(t=>t.title?.toLowerCase().includes(q)||t.artist?.toLowerCase().includes(q))
  const filterA = arr => !q ? arr : arr.filter(a=>a.username?.toLowerCase().includes(q))
  const filterP = arr => !q ? arr : arr.filter(p=>p.name?.toLowerCase().includes(q))
  const filterI = arr => !q ? arr : arr.filter(i=>i.title?.toLowerCase().includes(q))

  const rm = (key, id) => updateData({ [key]: data[key].filter(x=>x.id!==id) })
  const createPlaylist = name => updateData({ playlists:[{ id:`pl${Date.now()}`,name,tracks:[],createdAt:new Date().toISOString() },...playlists] })
  const deletePlaylist = id  => { updateData({ playlists:playlists.filter(p=>p.id!==id) }); if(openPlaylist?.id===id) setOpenPlaylist(null) }
  const rmFromPlaylist = (plId,tId) => {
    const next = playlists.map(p=>p.id!==plId?p:{...p,tracks:p.tracks.filter(t=>t.id!==tId)})
    updateData({ playlists:next })
    setOpenPlaylist(prev=>prev?.id===plId?{...prev,tracks:prev.tracks.filter(t=>t.id!==tId)}:prev)
  }

  const NAV = [
    { key:'overview',    icon:'🏠', label:'Overview' },
    { key:'playlists',   icon:'📂', label:'Playlists' },
    { key:'saved',       icon:'💾', label:'Saved' },
    { key:'liked',       icon:'❤️',  label:'Liked' },
    { key:'artists',     icon:'👤', label:'Artists' },
    { key:'extractions', icon:'🎸', label:'Extractions' },
    { key:'generated',   icon:'🤖', label:'Generated' },
    { key:'history',     icon:'🕐', label:'History' },
  ]

  const statCards = [
    { key:'playlists',   icon:'📂', label:'Playlists',   count:counts.playlists,   grad:'linear-gradient(135deg,var(--accent),var(--accent-2))' },
    { key:'saved',       icon:'💾', label:'Saved',       count:counts.saved,       grad:'linear-gradient(135deg,var(--accent-2),var(--accent-3))' },
    { key:'liked',       icon:'❤️',  label:'Liked',       count:counts.liked,       grad:'linear-gradient(135deg,var(--red),var(--accent))' },
    { key:'artists',     icon:'👤', label:'Following',   count:counts.artists,     grad:'linear-gradient(135deg,var(--accent-3),var(--accent-2))' },
    { key:'extractions', icon:'🎸', label:'Extractions', count:counts.extractions, grad:'linear-gradient(135deg,#e87a30,var(--accent))' },
    { key:'generated',   icon:'🤖', label:'Generated',   count:counts.generated,   grad:'linear-gradient(135deg,#8b5cf6,var(--accent-3))' },
  ]

  const sc = { finished:'badge--green', queued:'badge--yellow', failed:'badge--red' }

  return (
    <div className="page-wrap page--library" style={{ paddingTop:'2rem' }}>

      {/* Header */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:'1rem',marginBottom:'1.5rem' }}>
        <div>
          <div className="page-header__badge">📁 Library</div>
          <h1 className="page-header__title">My Library</h1>
          <p className="page-header__sub">
            {isGuest ? 'Demo library — sign in to save your own content' : `${user.username}'s collection · ${Object.values(counts).reduce((a,b)=>a+b,0)} items`}
          </p>
        </div>
        <div style={{ display:'flex',gap:'.45rem',flexWrap:'wrap' }}>
          {activeSection==='playlists'&&!openPlaylist&&<button className="btn btn--primary btn--sm" onClick={()=>setShowCreate(true)}>+ New Playlist</button>}
          <Link to="/search"   className="btn btn--ghost btn--sm">+ Discover</Link>
          <Link to="/extract"  className="btn btn--ghost btn--sm">+ Extract</Link>
          <Link to="/generate" className="btn btn--ghost btn--sm">+ Generate</Link>
        </div>
      </div>

      {/* Guest banner */}
      {isGuest && <GuestBanner />}

      {/* Offline indicator */}
      {!navigator.onLine && (
        <div className="alert alert--info" style={{ marginBottom:'1rem',fontSize:'.82rem' }}>
          📴 You're offline — your library content is still available and playable from local storage.
        </div>
      )}

      {/* Two-col layout */}
      <div style={{ display:'grid',gridTemplateColumns:'210px 1fr',gap:'1.4rem',alignItems:'start' }}>

        {/* Sidebar nav */}
        <nav style={{ background:'var(--bg-1)',border:'1px solid var(--border)',borderRadius:18,padding:'.45rem',position:'sticky',top:80,boxShadow:'var(--shadow-card)' }}>
          {NAV.map(item => (
            <button key={item.key} onClick={()=>{setActiveSection(item.key);setSearch('');setOpenPlaylist(null)}}
              style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:'.45rem',padding:'.52rem .8rem',borderRadius:12,fontFamily:'inherit',fontSize:'.82rem',fontWeight:600,width:'100%',textAlign:'left',border:'none',cursor:'pointer',transition:'all .15s',background:activeSection===item.key?'linear-gradient(135deg,rgba(255,107,71,.14),rgba(255,179,71,.09))':'transparent',color:activeSection===item.key?'var(--accent)':'var(--text-2)' }}>
              <span style={{ display:'flex',alignItems:'center',gap:'.45rem' }}>
                <span style={{ fontSize:'.92rem' }}>{item.icon}</span>{item.label}
              </span>
              {counts[item.key]>0&&(
                <span style={{ background:activeSection===item.key?'rgba(255,107,71,.22)':'var(--bg-3)',color:activeSection===item.key?'var(--accent)':'var(--text-3)',borderRadius:999,padding:'0 .4rem',fontSize:'.6rem',fontWeight:800 }}>
                  {counts[item.key]}
                </span>
              )}
            </button>
          ))}
          <div style={{ height:1,background:'var(--border)',margin:'.35rem .5rem' }}/>
          <button onClick={()=>setShowHistory(true)} style={{ display:'flex',alignItems:'center',gap:'.45rem',padding:'.48rem .8rem',borderRadius:12,width:'100%',border:'none',cursor:'pointer',background:'transparent',color:'var(--text-3)',fontFamily:'inherit',fontSize:'.77rem',fontWeight:600,transition:'color .14s' }}
            onMouseEnter={e=>e.currentTarget.style.color='var(--text)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text-3)'}>
            <IconClock/> Search history
          </button>
        </nav>

        {/* Content */}
        <div style={{ minWidth:0 }}>
          {!['overview','history'].includes(activeSection)&&!openPlaylist&&(
            <div className="search-bar" style={{ marginBottom:'1rem' }}>
              <IconSearch/>
              <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Filter ${activeSection}…`} style={{ fontSize:'.875rem' }}/>
              {search&&<button onClick={()=>setSearch('')} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',display:'flex',padding:'.1rem' }}><IconX/></button>}
            </div>
          )}

          <div className="fade-up">

            {/* OVERVIEW */}
            {activeSection==='overview'&&(
              <div>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'.7rem',marginBottom:'1.4rem' }}>
                  {statCards.map(c=>(
                    <button key={c.key} onClick={()=>setActiveSection(c.key)}
                      style={{ background:'var(--bg-1)',border:'1px solid var(--border)',borderRadius:16,padding:'1.2rem',textAlign:'center',cursor:'pointer',transition:'all .22s cubic-bezier(.34,1.2,.64,1)',fontFamily:'inherit',position:'relative',overflow:'hidden' }}
                      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px) scale(1.02)';e.currentTarget.style.boxShadow='var(--shadow)'}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
                      <div style={{ position:'absolute',top:0,left:0,right:0,height:3,background:c.grad,borderRadius:'16px 16px 0 0' }}/>
                      <div style={{ fontSize:'1.5rem',marginBottom:'.3rem' }}>{c.icon}</div>
                      <div style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.6rem',fontWeight:900,backgroundImage:c.grad,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text' }}>{c.count}</div>
                      <div style={{ fontSize:'.68rem',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.04em',marginTop:'.12rem',fontWeight:700 }}>{c.label}</div>
                    </button>
                  ))}
                </div>
                <RecentHistory onOpenFull={()=>setShowHistory(true)}/>
                {saved.slice(0,3).length>0&&(
                  <div className="card" style={{ padding:'1.2rem',marginTop:'1rem' }}>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.75rem' }}>
                      <span style={{ fontWeight:700,fontSize:'.875rem' }}>💾 Recently Saved</span>
                      <button onClick={()=>setActiveSection('saved')} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'.75rem',color:'var(--accent)',fontFamily:'inherit',fontWeight:700,display:'flex',alignItems:'center',gap:'.2rem' }}>View all <IconArrow/></button>
                    </div>
                    <div style={{ display:'flex',flexDirection:'column',gap:'.38rem' }}>
                      {saved.slice(0,3).map(t=><TrackRow key={t.id} track={t} date={t.savedAt} dateLabel="saved" onRemove={id=>rm('saved',id)} removeLabel="Remove" playing={playing?.id===t.id} onToggle={toggleTrack}/>)}
                    </div>
                  </div>
                )}
                {liked.slice(0,3).length>0&&(
                  <div className="card" style={{ padding:'1.2rem',marginTop:'1rem' }}>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.75rem' }}>
                      <span style={{ fontWeight:700,fontSize:'.875rem' }}>❤️ Recently Liked</span>
                      <button onClick={()=>setActiveSection('liked')} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'.75rem',color:'var(--accent)',fontFamily:'inherit',fontWeight:700,display:'flex',alignItems:'center',gap:'.2rem' }}>View all <IconArrow/></button>
                    </div>
                    <div style={{ display:'flex',flexDirection:'column',gap:'.38rem' }}>
                      {liked.slice(0,3).map(t=><TrackRow key={t.id} track={t} date={t.likedAt} dateLabel="liked" onRemove={id=>rm('liked',id)} removeLabel="Unlike" playing={playing?.id===t.id} onToggle={toggleTrack}/>)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PLAYLISTS */}
            {activeSection==='playlists'&&!openPlaylist&&(
              filterP(playlists).length>0
                ?<div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(172px,1fr))',gap:'.85rem' }}>
                   {filterP(playlists).map(pl=><PlaylistCard key={pl.id} playlist={pl} onOpen={setOpenPlaylist} onDelete={deletePlaylist}/>)}
                 </div>
                :<LibEmpty icon="📂" text="No playlists yet" cta="Create your first" onClick={()=>setShowCreate(true)}/>
            )}
            {activeSection==='playlists'&&openPlaylist&&(
              <PlaylistDetail playlist={openPlaylist} onBack={()=>setOpenPlaylist(null)} onRemoveTrack={rmFromPlaylist} onToggle={toggleTrack} playingId={playing?.id}/>
            )}

            {/* SAVED */}
            {activeSection==='saved'&&(
              filterT(saved).length>0
                ?<ColList>{filterT(saved).map(t=><TrackRow key={t.id} track={t} date={t.savedAt} dateLabel="saved" onRemove={id=>rm('saved',id)} removeLabel="Remove" playing={playing?.id===t.id} onToggle={toggleTrack}/>)}</ColList>
                :<LibEmpty icon="💾" text="No saved tracks" cta="Discover music" to="/search"/>
            )}

            {/* LIKED */}
            {activeSection==='liked'&&(
              filterT(liked).length>0
                ?<ColList>{filterT(liked).map(t=><TrackRow key={t.id} track={t} date={t.likedAt} dateLabel="liked" onRemove={id=>rm('liked',id)} removeLabel="Unlike" playing={playing?.id===t.id} onToggle={toggleTrack}/>)}</ColList>
                :<LibEmpty icon="❤️" text="No liked tracks" cta="Find something to like" to="/search"/>
            )}

            {/* ARTISTS */}
            {activeSection==='artists'&&(
              filterA(artists).length>0
                ?<div style={{ display:'flex',flexDirection:'column',gap:'.48rem' }}>
                   {filterA(artists).map(a=>(
                     <div key={a.id} className="artist-card">
                       <div className="artist-card__avatar" style={{ background:avatarGrad(a.username) }}>{a.username.charAt(0)}</div>
                       <div style={{ flex:1,minWidth:0 }}>
                         <div className="artist-card__name">{a.username}</div>
                         <div className="artist-card__meta">{fmtNum(a.followers)} followers · {a.tracks} tracks</div>
                         {a.bio&&<div style={{ fontSize:'.71rem',color:'var(--text-3)',marginTop:'.12rem' }} className="truncate">{a.bio}</div>}
                       </div>
                       <button className="btn btn--danger btn--sm" onClick={()=>updateData({artists:artists.filter(x=>x.id!==a.id)})}>Unfollow</button>
                     </div>
                   ))}
                 </div>
                :<LibEmpty icon="👤" text="Not following anyone" cta="Discover artists" to="/search"/>
            )}

            {/* EXTRACTIONS */}
            {activeSection==='extractions'&&(
              filterI(extractions).length>0
                ?<ColList>{filterI(extractions).map(item=>(
                    <div key={item.id} className="lib-row">
                      <div className="lib-row__cover" style={{ background:'var(--bg-3)' }}>🎸</div>
                      <div className="lib-row__info">
                        <div className="lib-row__title">{item.title}</div>
                        <div className="lib-row__sub">{item.totalChords} chords · {item.key} · {item.bpm} bpm</div>
                      </div>
                      <div className="lib-row__meta">
                        <span style={{ fontSize:'.67rem',color:'var(--text-3)' }}>{fmtDate(item.createdAt)}</span>
                        <Link to="/extract" className="btn btn--ghost btn--sm">Re-extract</Link>
                        <button className="btn btn--icon btn--ghost btn--sm lib-row__del" onClick={()=>rm('extractions',item.id)}><IconTrash/></button>
                      </div>
                    </div>
                  ))}</ColList>
                :<LibEmpty icon="🎸" text="No extractions yet" cta="Extract chords" to="/extract"/>
            )}

            {/* GENERATED */}
            {activeSection==='generated'&&(
              filterI(generations).length>0
                ?<ColList>{filterI(generations).map(item=>(
                    <div key={item.id} className="lib-row">
                      <div className="lib-row__cover" style={{ background:'var(--bg-3)' }}>🤖</div>
                      <div className="lib-row__info">
                        <div className="lib-row__title">{item.title}</div>
                        <div className="lib-row__sub">{item.style} · {item.key} · {item.bpm} bpm</div>
                      </div>
                      <div className="lib-row__meta">
                        <span className={`badge ${sc[item.status]||'badge--blue'}`}>{item.status}</span>
                        <span style={{ fontSize:'.67rem',color:'var(--text-3)' }}>{fmtDate(item.createdAt)}</span>
                        <button className="btn btn--icon btn--ghost btn--sm lib-row__del" onClick={()=>rm('generations',item.id)}><IconTrash/></button>
                      </div>
                    </div>
                  ))}</ColList>
                :<LibEmpty icon="🤖" text="No generated tracks" cta="Generate music" to="/generate"/>
            )}

            {/* HISTORY */}
            {activeSection==='history'&&(
              <div>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem' }}>
                  <span style={{ fontWeight:700,fontSize:'.875rem' }}>Search History</span>
                  <button className="btn btn--primary btn--sm" onClick={()=>setShowHistory(true)}>Manage all</button>
                </div>
                <RecentHistory onOpenFull={()=>setShowHistory(true)}/>
                <p style={{ textAlign:'center',color:'var(--text-3)',fontSize:'.8rem',marginTop:'.75rem' }}>
                  Showing last 6 ·{' '}
                  <button onClick={()=>setShowHistory(true)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontFamily:'inherit',fontWeight:700,fontSize:'.8rem' }}>
                    View all {counts.history} →
                  </button>
                </p>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Now playing bar */}
      {playing && <NowPlayingBar playing={playing} progress={progress} elapsed={elapsed} onStop={stopAll}/>}

      {/* Modals */}
      {showCreate  && <CreatePlaylistModal onClose={()=>setShowCreate(false)} onCreate={createPlaylist}/>}
      {showHistory && <HistoryModal onClose={()=>setShowHistory(false)}/>}

      <style>{`
        @media (max-width:760px) {
          .page-wrap > div[style*="grid-template-columns: 210px"] { grid-template-columns:1fr !important; }
          nav[style*="position: sticky"] { position:static !important;display:flex;flex-wrap:wrap;gap:.2rem; }
        }
        .lib-row { display:flex;align-items:center;gap:.72rem;padding:.62rem .88rem;border-radius:12px;background:var(--bg-2);border:1px solid var(--border);transition:all .18s; }
        .lib-row:hover { border-color:var(--border-hi); }
        .lib-row__cover { width:42px;height:42px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.95rem; }
        .lib-row__info { flex:1;min-width:0; }
        .lib-row__title { font-size:.84rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .lib-row__sub { font-size:.71rem;color:var(--text-2);margin-top:.1rem; }
        .lib-row__meta { display:flex;align-items:center;gap:.42rem;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end; }
        .lib-row__del { color:var(--text-3)!important;border-color:transparent!important;opacity:.4; }
        .lib-row:hover .lib-row__del { opacity:1; }
        .lib-playlist-card { background:var(--bg-1);border:1px solid var(--border);border-radius:16px;overflow:hidden;cursor:pointer;transition:all .22s;position:relative;box-shadow:var(--shadow-card); }
        .lib-playlist-card:hover { border-color:var(--border-hi);transform:translateY(-3px);box-shadow:var(--shadow); }
        .lib-playlist-card:hover .lib-playlist-play-overlay { background:rgba(0,0,0,.35)!important; }
        .lib-playlist-card:hover .lib-playlist-play-btn { opacity:1!important; }
        .lib-playlist-cover { aspect-ratio:1;background:var(--bg-3);position:relative;overflow:hidden; }
        .lib-playlist-body { padding:.75rem .9rem .85rem; }
        .lib-playlist-name { font-size:.88rem;font-weight:700;margin-bottom:.18rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .lib-playlist-meta { font-size:.7rem;color:var(--text-2); }
        .lib-playlist-del { position:absolute;top:.45rem;right:.45rem;opacity:0;transition:opacity .18s;background:rgba(0,0,0,.5)!important;border-radius:50%!important;padding:.3rem!important; }
        .lib-playlist-card:hover .lib-playlist-del { opacity:1; }
        .history-del-btn { opacity:0!important; }
        div:hover > .history-del-btn { opacity:1!important; }
      `}</style>
    </div>
  )
}

function ColList({ children }) { return <div style={{ display:'flex',flexDirection:'column',gap:'.44rem' }}>{children}</div> }
function LibEmpty({ icon, text, cta, to, onClick }) {
  return (
    <div className="lib-empty">
      <div className="lib-empty__icon">{icon}</div>
      <p className="lib-empty__text">{text}</p>
      {to ? <Link to={to} className="btn btn--primary btn--sm">{cta}</Link>
           : <button className="btn btn--primary btn--sm" onClick={onClick}>{cta}</button>}
    </div>
  )
}
