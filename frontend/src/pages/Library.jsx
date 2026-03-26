import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

/* ────────────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────────────── */
const fmtDate = iso => {
  if (!iso) return ''
  const d = new Date(iso), now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60)        return 'just now'
  if (diff < 3600)      return `${Math.floor(diff/60)}m ago`
  if (diff < 86400)     return `${Math.floor(diff/3600)}h ago`
  if (diff < 604800)    return `${Math.floor(diff/86400)}d ago`
  return d.toLocaleDateString(undefined, { month:'short', day:'numeric' })
}
const fmtDateFull = iso => !iso ? '' : new Date(iso).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
const fmtDur  = s => { const m=Math.floor(s/60), sec=Math.floor(s%60); return `${m}:${String(sec).padStart(2,'0')}` }
const fmtNum  = n => n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n)
const coverGrad = t => { const h=[200,240,260,180,30,300,150,20,340,160][(t?.charCodeAt(0)||65)%10]; return `linear-gradient(135deg,hsl(${h},55%,18%),hsl(${(h+50)%360},45%,28%))` }
const avatarGrad = n => { const h=[200,260,300,30,150,180][(n?.charCodeAt(0)||65)%6]; return `linear-gradient(135deg,hsl(${h},50%,22%),hsl(${(h+50)%360},45%,32%))` }

/* ── localStorage search history helpers ─────────────── */
const HISTORY_KEY = 'kalztunz_search_history'
const MAX_HISTORY  = 50

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}
function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}
function addToHistory(query, type = 'search') {
  const history = loadHistory()
  const entry   = { id: Date.now(), query, type, timestamp: new Date().toISOString() }
  const deduped = history.filter(h => h.query.toLowerCase() !== query.toLowerCase())
  saveHistory([entry, ...deduped])
}

/* ── Seed data ────────────────────────────────────────── */
const SEED_SAVED = [
  { id:'t8',  title:'Chord Cascade',     artist:'Mara Vex',   style:'pop',        duration:195, key:'C major', bpm:118, cover:null, savedAt: new Date(Date.now()-86400e3*2).toISOString() },
  { id:'t2',  title:'Solar Progression', artist:'Axon Beats', style:'electronic', duration:204, key:'F major', bpm:128, cover:null, savedAt: new Date(Date.now()-86400e3*5).toISOString() },
  { id:'t4',  title:'Acoustic Sessions', artist:'Harlow',     style:'indie',      duration:243, key:'G major', bpm:95,  cover:null, savedAt: new Date(Date.now()-86400e3*8).toISOString() },
  { id:'t1',  title:'Midnight Chords',   artist:'Luna Ray',   style:'ambient',    duration:187, key:'A minor', bpm:90,  cover:null, savedAt: new Date(Date.now()-86400e3*10).toISOString() },
]
const SEED_LIKED = [
  { id:'t10', title:'Club Extraction',   artist:'Mara Vex',   style:'electronic', duration:210, key:'G minor', bpm:140, cover:null, likedAt: new Date(Date.now()-86400e3*1).toISOString() },
  { id:'t3',  title:'Jazz in the Rain',  artist:'Cleo Vance', style:'jazz',       duration:312, key:'Bb major',bpm:72,  cover:null, likedAt: new Date(Date.now()-86400e3*3).toISOString() },
  { id:'t11', title:'Rooftop Sessions',  artist:'Sam Dios',   style:'indie',      duration:225, key:'D minor', bpm:102, cover:null, likedAt: new Date(Date.now()-86400e3*6).toISOString() },
]
const SEED_ARTISTS = [
  { id:'a1', username:'Luna Ray',   bio:'Ambient textures from Pacific NW', followers:312,  tracks:7  },
  { id:'a5', username:'Mara Vex',   bio:'Pop & electronic fusion',          followers:1230, tracks:12 },
  { id:'a2', username:'Axon Beats', bio:'Electronic producer, Berlin',      followers:890,  tracks:9  },
  { id:'a3', username:'Cleo Vance', bio:'Jazz pianist & composer',          followers:215,  tracks:5  },
]
const SEED_PLAYLISTS = [
  { id:'pl1', name:'Morning Vibes',   createdAt: new Date(Date.now()-86400e3*4).toISOString(),
    tracks:[{id:'t2',title:'Solar Progression',artist:'Axon Beats',duration:204},{id:'t8',title:'Chord Cascade',artist:'Mara Vex',duration:195},{id:'t4',title:'Acoustic Sessions',artist:'Harlow',duration:243}] },
  { id:'pl2', name:'Late Night Jazz', createdAt: new Date(Date.now()-86400e3*9).toISOString(),
    tracks:[{id:'t3',title:'Jazz in the Rain',artist:'Cleo Vance',duration:312}] },
  { id:'pl3', name:'Focus Mode',      createdAt: new Date(Date.now()-86400e3*14).toISOString(),
    tracks:[] },
]
const SEED_EXTRACTIONS = [
  { id:'e1', title:'summer_jam.mp3',     key:'C major', bpm:120, totalChords:32, createdAt: new Date(Date.now()-86400e3*1).toISOString() },
  { id:'e2', title:'blues_riff.wav',     key:'A minor', bpm:90,  totalChords:18, createdAt: new Date(Date.now()-86400e3*4).toISOString() },
  { id:'e3', title:'jazz_standard.flac', key:'F major', bpm:72,  totalChords:48, createdAt: new Date(Date.now()-86400e3*9).toISOString() },
]
const SEED_GENERATIONS = [
  { id:'g1', title:'Pop Progression #1', style:'pop',     key:'C major',  bpm:118, status:'finished', createdAt: new Date(Date.now()-86400e3*2).toISOString() },
  { id:'g2', title:'Jazz Exploration',   style:'jazz',    key:'Bb major', bpm:85,  status:'finished', createdAt: new Date(Date.now()-86400e3*6).toISOString() },
  { id:'g3', title:'Ambient Texture',    style:'ambient', key:'D minor',  bpm:70,  status:'queued',   createdAt: new Date(Date.now()-86400e3*.5).toISOString() },
]
// Seed the history if empty so demo looks populated
;(function seedHistory() {
  if (loadHistory().length === 0) {
    const seeds = [
      { query:'Billie Eilish', type:'artist' },
      { query:'jazz piano',    type:'search' },
      { query:'A minor chords',type:'search' },
      { query:'The Script',    type:'artist' },
      { query:'lo-fi hip hop', type:'search' },
      { query:'Coldplay',      type:'artist' },
      { query:'Am F C G progression', type:'search' },
      { query:'electronic ambient',   type:'search' },
    ]
    const history = seeds.map((s, i) => ({
      id: Date.now() - i * 3600000,
      query: s.query, type: s.type,
      timestamp: new Date(Date.now() - i * 3600000 * 12).toISOString(),
    }))
    saveHistory(history)
  }
})()

/* ── SVG icons ─────────────────────────────────────────── */
const IconSearch   = () => <svg width={14} height={14} viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const IconTrash    = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"/></svg>
const IconX        = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
const IconArrow    = () => <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
const IconClock    = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
const IconPlay     = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
const IconExternal = () => <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>

/* ── Track row ─────────────────────────────────────────── */
function TrackRow({ track, dateLabel, date, onRemove, removeLabel, onPlay, playing }) {
  return (
    <div className="lib-row" style={{ background: playing ? 'rgba(255,107,71,.06)' : undefined, borderColor: playing ? 'var(--coral)' : undefined }}>
      <button
        onClick={() => onPlay?.(track)}
        style={{ width:40, height:40, borderRadius:8, flexShrink:0, background:coverGrad(track.title), border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.9rem', position:'relative', overflow:'hidden' }}
      >
        {playing
          ? <span style={{ color:'var(--coral)', fontSize:'1.1rem', animation:'pulse 1s ease infinite' }}>♪</span>
          : <span>🎵</span>
        }
      </button>
      <div className="lib-row__info">
        <div className="lib-row__title">{track.title}</div>
        <div className="lib-row__sub">{track.artist}</div>
      </div>
      <div className="lib-row__meta">
        <span className="badge badge--blue" style={{ fontSize:'.6rem' }}>{track.style}</span>
        <span style={{ fontSize:'.68rem', color:'var(--text-3)', fontFamily:'monospace' }}>{track.key}</span>
        <span style={{ fontSize:'.68rem', color:'var(--text-3)', fontFamily:'monospace' }}>{fmtDur(track.duration)}</span>
        {date && (
          <span style={{ fontSize:'.68rem', color:'var(--text-3)', minWidth:64, textAlign:'right' }} title={fmtDateFull(date)}>
            {dateLabel} {fmtDate(date)}
          </span>
        )}
        <button className="btn btn--icon btn--ghost btn--sm lib-row__del" title={removeLabel} onClick={() => onRemove(track.id)}>
          <IconX/>
        </button>
      </div>
    </div>
  )
}

/* ── Create Playlist Modal ─────────────────────────────── */
function CreatePlaylistModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div style={{ position:'fixed',inset:0,background:'var(--overlay)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem',animation:'fadeIn .18s ease' }} onClick={onClose}>
      <div style={{ background:'var(--bg-1)',border:'1px solid var(--border-hi)',borderRadius:20,padding:'1.75rem',width:'100%',maxWidth:420,boxShadow:'var(--shadow)',animation:'dropIn .22s ease' }} onClick={e=>e.stopPropagation()}>
        <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.15rem',fontWeight:800,marginBottom:'1.25rem' }}>New Playlist</h2>
        <div className="form">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input ref={ref} className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="My Playlist" maxLength={80}
              onKeyDown={e=>e.key==='Enter'&&name.trim()&&(onCreate(name.trim(),desc.trim()),onClose())} />
          </div>
          <div className="form-group">
            <label className="form-label">Description <span style={{color:'var(--text-3)',fontWeight:400}}>(optional)</span></label>
            <textarea className="form-textarea" value={desc} onChange={e=>setDesc(e.target.value)} rows={2} placeholder="What's this playlist about?" />
          </div>
          <div style={{ display:'flex',gap:'.6rem',justifyContent:'flex-end' }}>
            <button className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button>
            <button className="btn btn--primary btn--sm" disabled={!name.trim()} onClick={() => { onCreate(name.trim(),desc.trim()); onClose() }}>
              Create Playlist
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Full History Modal ────────────────────────────────── */
function HistoryModal({ onClose }) {
  const navigate = useNavigate()
  const [history,   setHistory]   = useState(loadHistory)
  const [search,    setSearch]    = useState('')
  const [selected,  setSelected]  = useState(new Set())
  const [sortBy,    setSortBy]    = useState('recent')

  const filtered = useMemo(() => {
    let h = history
    if (search.trim()) h = h.filter(i => i.query.toLowerCase().includes(search.toLowerCase()))
    if (sortBy === 'alpha') h = [...h].sort((a,b) => a.query.localeCompare(b.query))
    return h
  }, [history, search, sortBy])

  const toggleSelect = id => setSelected(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n })
  const selectAll  = () => setSelected(new Set(filtered.map(h=>h.id)))
  const clearSel   = () => setSelected(new Set())

  const deleteSelected = () => {
    const next = history.filter(h => !selected.has(h.id))
    setHistory(next); saveHistory(next); setSelected(new Set())
  }
  const deleteOne = id => {
    const next = history.filter(h => h.id !== id)
    setHistory(next); saveHistory(next)
    setSelected(p => { const n=new Set(p); n.delete(id); return n })
  }
  const clearAll = () => { setHistory([]); saveHistory([]); setSelected(new Set()) }

  const reSearch = query => { addToHistory(query); navigate(`/search?q=${encodeURIComponent(query)}`); onClose() }

  const grouped = useMemo(() => {
    const groups = {}
    filtered.forEach(item => {
      const d = new Date(item.timestamp)
      const today = new Date(); today.setHours(0,0,0,0)
      const yesterday = new Date(today); yesterday.setDate(today.getDate()-1)
      let label = d >= today ? 'Today' : d >= yesterday ? 'Yesterday' : fmtDateFull(item.timestamp)
      if (!groups[label]) groups[label] = []
      groups[label].push(item)
    })
    return groups
  }, [filtered])

  return (
    <div style={{ position:'fixed',inset:0,background:'var(--overlay)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem',animation:'fadeIn .18s ease' }} onClick={onClose}>
      <div style={{ width:'100%',maxWidth:620,maxHeight:'88vh',background:'var(--bg-1)',border:'1px solid var(--border-hi)',borderRadius:22,display:'flex',flexDirection:'column',boxShadow:'var(--shadow)',animation:'dropIn .22s ease' }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'1.25rem 1.5rem .85rem',borderBottom:'1px solid var(--border)',flexShrink:0 }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.9rem' }}>
            <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.15rem',fontWeight:800 }}>Full Search History</h2>
            <button onClick={onClose} style={{ background:'none',border:'1px solid var(--border)',borderRadius:999,padding:'.22rem .55rem',cursor:'pointer',color:'var(--text-2)',fontSize:'.78rem',fontFamily:'inherit' }}>✕ Close</button>
          </div>

          {/* Search bar */}
          <div className="search-bar" style={{ marginBottom:'.75rem' }}>
            <IconSearch/>
            <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter history…" style={{ fontSize:'.85rem' }} />
          </div>

          {/* Toolbar */}
          <div style={{ display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap' }}>
            <div style={{ display:'flex',background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:9,padding:2,gap:2 }}>
              {[['recent','Recent'],['alpha','A–Z']].map(([v,l]) => (
                <button key={v} onClick={()=>setSortBy(v)} style={{ padding:'.25rem .6rem',borderRadius:7,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.72rem',background:sortBy===v?'var(--coral)':'transparent',color:sortBy===v?'#fff':'var(--text-2)',transition:'all .15s' }}>{l}</button>
              ))}
            </div>
            <span style={{ fontSize:'.72rem',color:'var(--text-3)' }}>{filtered.length} entries</span>
            {selected.size > 0 ? (
              <>
                <span style={{ fontSize:'.72rem',color:'var(--coral)' }}>{selected.size} selected</span>
                <button className="btn btn--sm btn--danger" onClick={deleteSelected}>Delete selected</button>
                <button className="btn btn--sm btn--ghost" onClick={clearSel}>Clear selection</button>
              </>
            ) : (
              <>
                <button className="btn btn--sm btn--ghost" onClick={selectAll} style={{ marginLeft:'auto' }}>Select all</button>
                <button className="btn btn--sm btn--danger" onClick={clearAll}>Clear all</button>
              </>
            )}
          </div>
        </div>

        {/* List */}
        <div style={{ flex:1,overflowY:'auto',padding:'0 .5rem' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign:'center',padding:'3rem',color:'var(--text-3)' }}>
              <div style={{ fontSize:'2.5rem',marginBottom:'.75rem' }}>🔍</div>
              <p>{search ? `No history matching "${search}"` : 'No search history yet'}</p>
            </div>
          ) : (
            Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <div style={{ padding:'.65rem 1rem .35rem',fontSize:'.7rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em',position:'sticky',top:0,background:'var(--bg-1)',zIndex:1 }}>
                  {date}
                </div>
                {items.map(item => (
                  <div key={item.id}
                    style={{ display:'flex',alignItems:'center',gap:'.6rem',padding:'.55rem 1rem',borderRadius:10,margin:'.2rem 0',background:selected.has(item.id)?'rgba(255,107,71,.07)':'transparent',border:`1px solid ${selected.has(item.id)?'rgba(255,107,71,.22)':'transparent'}`,transition:'all .15s',cursor:'pointer' }}
                    onClick={() => toggleSelect(item.id)}
                  >
                    <div style={{ width:20,height:20,borderRadius:4,border:`1.5px solid ${selected.has(item.id)?'var(--coral)':'var(--border-hi)'}`,background:selected.has(item.id)?'var(--coral)':'transparent',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s' }}>
                      {selected.has(item.id) && <svg width={11} height={11} viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                    </div>
                    <span style={{ fontSize:'.78rem',color:'var(--text-3)',flexShrink:0 }}>
                      {item.type === 'artist' ? '👤' : '🔍'}
                    </span>
                    <span style={{ flex:1,fontSize:'.875rem',fontWeight:600 }}>{item.query}</span>
                    <span style={{ fontSize:'.68rem',color:'var(--text-3)',flexShrink:0 }}>{fmtDate(item.timestamp)}</span>
                    <div style={{ display:'flex',gap:'.2rem',flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                      <button
                        className="btn btn--icon btn--ghost btn--sm"
                        title="Search again"
                        onClick={() => reSearch(item.query)}
                        style={{ color:'var(--cyan)',borderColor:'transparent',padding:'.22rem' }}
                      >
                        <IconArrow/>
                      </button>
                      <button
                        className="btn btn--icon btn--ghost btn--sm"
                        title="Delete"
                        onClick={() => deleteOne(item.id)}
                        style={{ color:'var(--text-3)',borderColor:'transparent',padding:'.22rem' }}
                      >
                        <IconX/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Playlist card ─────────────────────────────────────── */
function PlaylistCard({ playlist, onOpen, onDelete }) {
  const dur = playlist.tracks.reduce((s,t)=>s+(t.duration||0),0)
  return (
    <div className="lib-playlist-card" onClick={() => onOpen(playlist)}>
      <div className="lib-playlist-cover">
        {playlist.tracks.slice(0,4).map((t,i) => (
          <div key={t.id} style={{ position:'absolute',width:'50%',height:'50%',top:i<2?0:'50%',left:i%2===0?0:'50%',background:coverGrad(t.title),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.75rem' }}>🎵</div>
        ))}
        {playlist.tracks.length === 0 && <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem',color:'var(--text-3)' }}>📂</div>}
        <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0)',transition:'background .2s',display:'flex',alignItems:'center',justifyContent:'center' }} className="lib-playlist-play-overlay">
          <div style={{ width:38,height:38,borderRadius:'50%',background:'var(--coral)',display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity .2s',boxShadow:'0 4px 16px rgba(255,107,71,.4)' }} className="lib-playlist-play-btn">
            <IconPlay/>
          </div>
        </div>
      </div>
      <div className="lib-playlist-body">
        <div className="lib-playlist-name" title={playlist.name}>{playlist.name}</div>
        <div className="lib-playlist-meta">
          {playlist.tracks.length} tracks{dur > 0 && ` · ${fmtDur(dur)}`}
        </div>
        <div style={{ fontSize:'.67rem',color:'var(--text-3)',marginTop:'.12rem' }}>{fmtDate(playlist.createdAt)}</div>
      </div>
      <button className="btn btn--icon btn--ghost btn--sm lib-playlist-del" title="Delete playlist"
        onClick={e=>{e.stopPropagation();onDelete(playlist.id)}}>
        <IconTrash/>
      </button>
    </div>
  )
}

/* ── Playlist detail ───────────────────────────────────── */
function PlaylistDetail({ playlist, onBack, onRemoveTrack }) {
  const dur = playlist.tracks.reduce((s,t)=>s+(t.duration||0),0)
  return (
    <div>
      <button className="btn btn--ghost btn--sm" onClick={onBack} style={{ marginBottom:'1.25rem' }}>← Back to playlists</button>
      <div style={{ display:'flex',alignItems:'center',gap:'1rem',marginBottom:'1.5rem',flexWrap:'wrap' }}>
        <div style={{ width:76,height:76,borderRadius:14,position:'relative',overflow:'hidden',flexShrink:0,background:'var(--bg-3)' }}>
          {playlist.tracks.slice(0,4).map((t,i) => (
            <div key={t.id} style={{ position:'absolute',width:'50%',height:'50%',top:i<2?0:'50%',left:i%2===0?0:'50%',background:coverGrad(t.title),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.7rem' }}>🎵</div>
          ))}
          {!playlist.tracks.length && <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem' }}>📂</div>}
        </div>
        <div>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.3rem',fontWeight:800,marginBottom:'.2rem' }}>{playlist.name}</h2>
          <p style={{ fontSize:'.82rem',color:'var(--text-2)' }}>{playlist.tracks.length} tracks{dur>0&&` · ${fmtDur(dur)}`} · Created {fmtDateFull(playlist.createdAt)}</p>
        </div>
        {playlist.tracks.length > 0 && (
          <button className="btn btn--primary btn--sm" style={{ marginLeft:'auto' }}>▶ Play All</button>
        )}
      </div>
      {playlist.tracks.length === 0
        ? <div className="lib-empty"><div className="lib-empty__icon">🎵</div><p className="lib-empty__text">This playlist is empty</p><Link to="/search" className="btn btn--primary btn--sm">Add tracks from Discover</Link></div>
        : <div style={{ display:'flex',flexDirection:'column',gap:'.4rem' }}>
            {playlist.tracks.map((t,i) => (
              <div key={t.id} className="lib-row">
                <span style={{ width:18,textAlign:'center',fontSize:'.72rem',color:'var(--text-3)',fontFamily:'monospace',flexShrink:0 }}>{i+1}</span>
                <div className="lib-row__cover" style={{ background:coverGrad(t.title) }}>🎵</div>
                <div className="lib-row__info"><div className="lib-row__title">{t.title}</div><div className="lib-row__sub">{t.artist}</div></div>
                <div className="lib-row__meta">
                  <span style={{ fontSize:'.7rem',color:'var(--text-3)',fontFamily:'monospace' }}>{fmtDur(t.duration)}</span>
                  <button className="btn btn--icon btn--ghost btn--sm lib-row__del" onClick={() => onRemoveTrack(playlist.id,t.id)}><IconX/></button>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

/* ── Recent search history panel ──────────────────────── */
function RecentHistoryPanel({ onOpenFull }) {
  const navigate  = useNavigate()
  const [history, setHistory] = useState(loadHistory)

  const recent = history.slice(0, 6)

  const removeOne = (e, id) => {
    e.stopPropagation()
    const next = history.filter(h => h.id !== id)
    setHistory(next); saveHistory(next)
  }

  const reSearch = query => { addToHistory(query); navigate(`/search?q=${encodeURIComponent(query)}`) }

  if (recent.length === 0) return null

  return (
    <div className="card" style={{ padding:'1.25rem' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.85rem' }}>
        <div style={{ display:'flex',alignItems:'center',gap:'.5rem' }}>
          <IconClock/>
          <span style={{ fontWeight:700,fontSize:'.875rem' }}>Recent Searches</span>
        </div>
        <button
          onClick={onOpenFull}
          style={{ background:'none',border:'none',cursor:'pointer',fontSize:'.75rem',color:'var(--coral)',fontFamily:'inherit',fontWeight:700,display:'flex',alignItems:'center',gap:'.25rem' }}
        >
          View all <IconArrow/>
        </button>
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:'.3rem' }}>
        {recent.map(item => (
          <div key={item.id}
            style={{ display:'flex',alignItems:'center',gap:'.55rem',padding:'.4rem .6rem',borderRadius:9,cursor:'pointer',transition:'background .15s',background:'transparent' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-2)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}
            onClick={() => reSearch(item.query)}
          >
            <span style={{ color:'var(--text-3)',fontSize:'.78rem',flexShrink:0 }}>
              {item.type === 'artist' ? '👤' : '🔍'}
            </span>
            <span style={{ flex:1,fontSize:'.84rem',fontWeight:500 }}>{item.query}</span>
            <span style={{ fontSize:'.67rem',color:'var(--text-3)',flexShrink:0 }}>{fmtDate(item.timestamp)}</span>
            <button
              onClick={e => removeOne(e, item.id)}
              style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',padding:'.15rem',opacity:0,transition:'opacity .15s',display:'flex',alignItems:'center',flexShrink:0 }}
              className="history-del-btn"
              title="Remove"
            >
              <IconX/>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   MAIN LIBRARY
══════════════════════════════════════════════════════ */
export default function Library() {
  const { user } = useAuth()

  const NAV_ITEMS = [
    { key:'overview',    icon:'🏠', label:'Overview' },
    { key:'playlists',   icon:'📂', label:'Playlists' },
    { key:'saved',       icon:'💾', label:'Saved' },
    { key:'liked',       icon:'❤️',  label:'Liked' },
    { key:'artists',     icon:'👤', label:'Artists' },
    { key:'extractions', icon:'🎸', label:'Extractions' },
    { key:'generated',   icon:'🤖', label:'Generated' },
    { key:'history',     icon:'🕐', label:'History' },
  ]

  const [activeSection, setActiveSection] = useState('overview')
  const [search,      setSearch]      = useState('')
  const [saved,       setSaved]       = useState(SEED_SAVED)
  const [liked,       setLiked]       = useState(SEED_LIKED)
  const [artists,     setArtists]     = useState(SEED_ARTISTS)
  const [playlists,   setPlaylists]   = useState(SEED_PLAYLISTS)
  const [extractions, setExtractions] = useState(SEED_EXTRACTIONS)
  const [generations, setGenerations] = useState(SEED_GENERATIONS)
  const [showCreate,  setShowCreate]  = useState(false)
  const [openPlaylist,setOpenPlaylist]= useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [playingId,   setPlayingId]   = useState(null)

  // stats for overview
  const counts = useMemo(() => ({
    playlists: playlists.length, saved: saved.length, liked: liked.length,
    artists: artists.length, extractions: extractions.length, generated: generations.length,
    history: loadHistory().length,
  }), [playlists, saved, liked, artists, extractions, generations])

  const totalItems = Object.values(counts).reduce((a,b)=>a+b,0)

  const q = search.toLowerCase()
  const filterT = arr => !q ? arr : arr.filter(t => t.title.toLowerCase().includes(q) || t.artist?.toLowerCase().includes(q))
  const filterA = arr => !q ? arr : arr.filter(a => a.username.toLowerCase().includes(q))
  const filterP = arr => !q ? arr : arr.filter(p => p.name.toLowerCase().includes(q))
  const filterI = arr => !q ? arr : arr.filter(i => i.title.toLowerCase().includes(q))

  const rmFrom = setter => id => setter(p => p.filter(x => x.id !== id))
  const createPlaylist = useCallback((name, desc) => {
    setPlaylists(p => [{ id:`pl${Date.now()}`,name,desc,count:0,cover:null,tracks:[],createdAt:new Date().toISOString() },...p])
  }, [])
  const deletePlaylist = useCallback(id => {
    setPlaylists(p=>p.filter(pl=>pl.id!==id))
    if (openPlaylist?.id===id) setOpenPlaylist(null)
  }, [openPlaylist])
  const removeTrackFromPlaylist = useCallback((plId, tId) => {
    setPlaylists(p=>p.map(pl=>pl.id!==plId?pl:{...pl,tracks:pl.tracks.filter(t=>t.id!==tId)}))
    setOpenPlaylist(prev=>prev?.id===plId?{...prev,tracks:prev.tracks.filter(t=>t.id!==tId)}:prev)
  }, [])

  // Overview cards config
  const overviewCards = [
    { key:'playlists',   icon:'📂', label:'Playlists',   count:counts.playlists,   color:'var(--coral)' },
    { key:'saved',       icon:'💾', label:'Saved',       count:counts.saved,       color:'var(--amber)' },
    { key:'liked',       icon:'❤️',  label:'Liked',       count:counts.liked,       color:'var(--red)' },
    { key:'artists',     icon:'👤', label:'Following',   count:counts.artists,     color:'var(--cyan)' },
    { key:'extractions', icon:'🎸', label:'Extractions', count:counts.extractions, color:'#e87a30' },
    { key:'generated',   icon:'🤖', label:'Generated',   count:counts.generated,   color:'#8b5cf6' },
  ]

  const sc = { finished:'badge--green', queued:'badge--yellow', failed:'badge--red' }

  return (
    <div className="page-wrap" style={{ paddingTop:'2rem' }}>

      {/* ── Top header ── */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:'1rem',marginBottom:'1.75rem' }}>
        <div>
          <div className="page-header__badge">📁 Library</div>
          <h1 className="page-header__title">My Library</h1>
          <p className="page-header__sub">{user?.username || 'Your'} collection · {totalItems} items</p>
        </div>
        <div style={{ display:'flex',gap:'.5rem',flexWrap:'wrap' }}>
          {activeSection === 'playlists' && !openPlaylist && (
            <button className="btn btn--primary btn--sm" onClick={()=>setShowCreate(true)}>+ New Playlist</button>
          )}
          <Link to="/search"   className="btn btn--ghost btn--sm">+ Discover</Link>
          <Link to="/extract"  className="btn btn--ghost btn--sm">+ Extract</Link>
          <Link to="/generate" className="btn btn--ghost btn--sm">+ Generate</Link>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display:'grid',gridTemplateColumns:'210px 1fr',gap:'1.5rem',alignItems:'start' }}>

        {/* ── Sidebar nav ── */}
        <nav style={{ background:'var(--bg-1)',border:'1px solid var(--border)',borderRadius:18,padding:'.5rem',position:'sticky',top:80,boxShadow:'var(--shadow-card)' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => { setActiveSection(item.key); setSearch(''); setOpenPlaylist(null) }}
              style={{
                display:'flex',alignItems:'center',justifyContent:'space-between',gap:'.5rem',
                padding:'.55rem .85rem',borderRadius:12,
                fontFamily:'inherit',fontSize:'.83rem',fontWeight:600,
                width:'100%',textAlign:'left',border:'none',cursor:'pointer',
                transition:'all .15s',
                background: activeSection===item.key ? 'linear-gradient(135deg,rgba(255,107,71,.14),rgba(255,179,71,.09))' : 'transparent',
                color: activeSection===item.key ? 'var(--coral)' : 'var(--text-2)',
              }}
            >
              <span style={{ display:'flex',alignItems:'center',gap:'.5rem' }}>
                <span style={{ fontSize:'.95rem' }}>{item.icon}</span>
                {item.label}
              </span>
              {counts[item.key] > 0 && (
                <span style={{
                  background: activeSection===item.key ? 'rgba(255,107,71,.2)' : 'var(--bg-3)',
                  color: activeSection===item.key ? 'var(--coral)' : 'var(--text-3)',
                  borderRadius:999,padding:'0 .42rem',fontSize:'.62rem',fontWeight:800,minWidth:18,textAlign:'center',
                }}>
                  {counts[item.key]}
                </span>
              )}
            </button>
          ))}

          <div style={{ height:1,background:'var(--border)',margin:'.4rem .5rem' }}/>

          <button onClick={() => setShowHistory(true)} style={{ display:'flex',alignItems:'center',gap:'.5rem',padding:'.5rem .85rem',borderRadius:12,width:'100%',border:'none',cursor:'pointer',background:'transparent',color:'var(--text-3)',fontFamily:'inherit',fontSize:'.78rem',fontWeight:600,transition:'all .15s' }}
            onMouseEnter={e=>e.currentTarget.style.color='var(--text)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text-3)'}
          >
            <IconClock/> Full search history
          </button>
        </nav>

        {/* ── Main content ── */}
        <div style={{ minWidth:0 }}>

          {/* Library-wide search (not on overview/history) */}
          {!['overview','history'].includes(activeSection) && !openPlaylist && (
            <div className="search-bar" style={{ marginBottom:'1.1rem' }}>
              <IconSearch/>
              <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
                placeholder={`Filter ${activeSection}…`} style={{ fontSize:'.875rem' }} />
              {search && <button onClick={()=>setSearch('')} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',display:'flex',padding:'.1rem' }}><IconX/></button>}
            </div>
          )}

          <div className="fade-up">

            {/* ────── OVERVIEW ────── */}
            {activeSection === 'overview' && (
              <div>
                {/* Stats grid */}
                <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'.75rem',marginBottom:'1.5rem' }}>
                  {overviewCards.map(card => (
                    <button key={card.key}
                      onClick={() => setActiveSection(card.key)}
                      style={{
                        background:'var(--bg-1)',border:`1px solid var(--border)`,borderRadius:16,
                        padding:'1.1rem',textAlign:'center',cursor:'pointer',
                        transition:'all .2s',fontFamily:'inherit',
                        borderTop:`3px solid ${card.color}`,
                      }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=card.color;e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow-sm)'}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none'}}
                    >
                      <div style={{ fontSize:'1.4rem',marginBottom:'.3rem' }}>{card.icon}</div>
                      <div style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.5rem',fontWeight:900,color:card.color }}>{card.count}</div>
                      <div style={{ fontSize:'.7rem',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.04em',marginTop:'.1rem' }}>{card.label}</div>
                    </button>
                  ))}
                </div>

                {/* Recent searches */}
                <RecentHistoryPanel onOpenFull={() => setShowHistory(true)} />

                {/* Recently saved */}
                {saved.length > 0 && (
                  <div className="card" style={{ padding:'1.25rem',marginTop:'1rem' }}>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.85rem' }}>
                      <span style={{ fontWeight:700,fontSize:'.875rem' }}>💾 Recently Saved</span>
                      <button onClick={()=>setActiveSection('saved')} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'.75rem',color:'var(--coral)',fontFamily:'inherit',fontWeight:700,display:'flex',alignItems:'center',gap:'.2rem' }}>
                        View all <IconArrow/>
                      </button>
                    </div>
                    <div style={{ display:'flex',flexDirection:'column',gap:'.4rem' }}>
                      {saved.slice(0,3).map(t => (
                        <TrackRow key={t.id} track={t} date={t.savedAt} dateLabel="saved"
                          onRemove={rmFrom(setSaved)} removeLabel="Remove" playingId={playingId}
                          playing={playingId===t.id} onPlay={t => setPlayingId(id => id===t.id?null:t.id)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Recently liked */}
                {liked.length > 0 && (
                  <div className="card" style={{ padding:'1.25rem',marginTop:'1rem' }}>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.85rem' }}>
                      <span style={{ fontWeight:700,fontSize:'.875rem' }}>❤️ Recently Liked</span>
                      <button onClick={()=>setActiveSection('liked')} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'.75rem',color:'var(--coral)',fontFamily:'inherit',fontWeight:700,display:'flex',alignItems:'center',gap:'.2rem' }}>
                        View all <IconArrow/>
                      </button>
                    </div>
                    <div style={{ display:'flex',flexDirection:'column',gap:'.4rem' }}>
                      {liked.slice(0,3).map(t => (
                        <TrackRow key={t.id} track={t} date={t.likedAt} dateLabel="liked"
                          onRemove={rmFrom(setLiked)} removeLabel="Unlike"
                          playing={playingId===t.id} onPlay={t => setPlayingId(id => id===t.id?null:t.id)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ────── PLAYLISTS ────── */}
            {activeSection === 'playlists' && !openPlaylist && (
              filterP(playlists).length > 0
                ? <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))',gap:'.85rem' }}>
                    {filterP(playlists).map(pl => (
                      <PlaylistCard key={pl.id} playlist={pl} onOpen={setOpenPlaylist} onDelete={deletePlaylist} />
                    ))}
                  </div>
                : <LibEmpty icon="📂" text="No playlists yet" cta="Create your first" onClick={()=>setShowCreate(true)} />
            )}
            {activeSection === 'playlists' && openPlaylist && (
              <PlaylistDetail playlist={openPlaylist} onBack={()=>setOpenPlaylist(null)} onRemoveTrack={removeTrackFromPlaylist} />
            )}

            {/* ────── SAVED ────── */}
            {activeSection === 'saved' && (
              filterT(saved).length > 0
                ? <ColList>{filterT(saved).map(t => <TrackRow key={t.id} track={t} date={t.savedAt} dateLabel="saved" onRemove={rmFrom(setSaved)} removeLabel="Remove" playing={playingId===t.id} onPlay={t=>setPlayingId(id=>id===t.id?null:t.id)} />)}</ColList>
                : <LibEmpty icon="💾" text="No saved tracks" cta="Discover music" to="/search" />
            )}

            {/* ────── LIKED ────── */}
            {activeSection === 'liked' && (
              filterT(liked).length > 0
                ? <ColList>{filterT(liked).map(t => <TrackRow key={t.id} track={t} date={t.likedAt} dateLabel="liked" onRemove={rmFrom(setLiked)} removeLabel="Unlike" playing={playingId===t.id} onPlay={t=>setPlayingId(id=>id===t.id?null:t.id)} />)}</ColList>
                : <LibEmpty icon="❤️" text="No liked tracks" cta="Find something to like" to="/search" />
            )}

            {/* ────── ARTISTS ────── */}
            {activeSection === 'artists' && (
              filterA(artists).length > 0
                ? <div style={{ display:'flex',flexDirection:'column',gap:'.5rem' }}>
                    {filterA(artists).map(a => (
                      <div key={a.id} className="artist-card">
                        <div className="artist-card__avatar" style={{ background:avatarGrad(a.username) }}>{a.username.charAt(0)}</div>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div className="artist-card__name">{a.username}</div>
                          <div className="artist-card__meta">{fmtNum(a.followers)} followers · {a.tracks} tracks</div>
                          {a.bio && <div style={{ fontSize:'.72rem',color:'var(--text-3)',marginTop:'.15rem' }} className="truncate">{a.bio}</div>}
                        </div>
                        <button className="btn btn--danger btn--sm" onClick={()=>setArtists(p=>p.filter(x=>x.id!==a.id))}>Unfollow</button>
                      </div>
                    ))}
                  </div>
                : <LibEmpty icon="👤" text="Not following anyone" cta="Discover artists" to="/search" />
            )}

            {/* ────── EXTRACTIONS ────── */}
            {activeSection === 'extractions' && (
              filterI(extractions).length > 0
                ? <ColList>{filterI(extractions).map(item => (
                    <div key={item.id} className="lib-row">
                      <div className="lib-row__cover" style={{ background:'var(--bg-3)' }}>🎸</div>
                      <div className="lib-row__info">
                        <div className="lib-row__title">{item.title}</div>
                        <div className="lib-row__sub">{item.totalChords} chords · {item.key} · {item.bpm} bpm</div>
                      </div>
                      <div className="lib-row__meta">
                        <span style={{ fontSize:'.68rem',color:'var(--text-3)' }} title={fmtDateFull(item.createdAt)}>{fmtDate(item.createdAt)}</span>
                        <Link to="/extract" className="btn btn--ghost btn--sm">Re-extract</Link>
                        <button className="btn btn--icon btn--ghost btn--sm lib-row__del" onClick={()=>setExtractions(p=>p.filter(x=>x.id!==item.id))}><IconTrash/></button>
                      </div>
                    </div>
                  ))}</ColList>
                : <LibEmpty icon="🎸" text="No extractions yet" cta="Extract chords" to="/extract" />
            )}

            {/* ────── GENERATED ────── */}
            {activeSection === 'generated' && (
              filterI(generations).length > 0
                ? <ColList>{filterI(generations).map(item => (
                    <div key={item.id} className="lib-row">
                      <div className="lib-row__cover" style={{ background:'var(--bg-3)' }}>🤖</div>
                      <div className="lib-row__info">
                        <div className="lib-row__title">{item.title}</div>
                        <div className="lib-row__sub">{item.style} · {item.key} · {item.bpm} bpm</div>
                      </div>
                      <div className="lib-row__meta">
                        <span className={`badge ${sc[item.status]||'badge--blue'}`}>{item.status}</span>
                        <span style={{ fontSize:'.68rem',color:'var(--text-3)' }} title={fmtDateFull(item.createdAt)}>{fmtDate(item.createdAt)}</span>
                        <button className="btn btn--icon btn--ghost btn--sm lib-row__del" onClick={()=>setGenerations(p=>p.filter(x=>x.id!==item.id))}><IconTrash/></button>
                      </div>
                    </div>
                  ))}</ColList>
                : <LibEmpty icon="🤖" text="No generated tracks" cta="Generate music" to="/generate" />
            )}

            {/* ────── HISTORY (quick panel) ────── */}
            {activeSection === 'history' && (
              <div>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem' }}>
                  <span style={{ fontWeight:700,fontSize:'.875rem' }}>Search History</span>
                  <button className="btn btn--primary btn--sm" onClick={()=>setShowHistory(true)}>
                    Manage Full History
                  </button>
                </div>
                <RecentHistoryPanel onOpenFull={()=>setShowHistory(true)} />
                <p style={{ textAlign:'center',color:'var(--text-3)',fontSize:'.8rem',marginTop:'.75rem' }}>
                  Showing last 6 searches · <button onClick={()=>setShowHistory(true)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--coral)',fontFamily:'inherit',fontWeight:700,fontSize:'.8rem' }}>View & manage all {counts.history} →</button>
                </p>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreate  && <CreatePlaylistModal onClose={()=>setShowCreate(false)} onCreate={createPlaylist} />}
      {showHistory && <HistoryModal onClose={()=>setShowHistory(false)} />}

      <style>{`
        @media (max-width: 760px) {
          .page-wrap > div[style*="grid-template-columns: 210px"] { grid-template-columns: 1fr !important; }
          nav[style*="position: sticky"] { position: static !important; display: flex; flex-wrap: wrap; gap: .25rem; }
        }
        .lib-row { display:flex;align-items:center;gap:.75rem;padding:.65rem .9rem;border-radius:12px;background:var(--bg-2);border:1px solid var(--border);transition:all .18s; }
        .lib-row:hover { border-color:var(--border-hi); }
        .lib-row__cover { width:42px;height:42px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.95rem; }
        .lib-row__info { flex:1;min-width:0; }
        .lib-row__title { font-size:.84rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .lib-row__sub { font-size:.72rem;color:var(--text-2);margin-top:.1rem; }
        .lib-row__meta { display:flex;align-items:center;gap:.45rem;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end; }
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
        .history-del-btn { opacity: 0 !important; }
        div:hover > .history-del-btn { opacity: 1 !important; }
      `}</style>
    </div>
  )
}

function ColList({ children }) { return <div style={{ display:'flex',flexDirection:'column',gap:'.45rem' }}>{children}</div> }
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
