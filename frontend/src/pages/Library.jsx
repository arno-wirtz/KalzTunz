import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { ChordSynth, fmtDur as fmtDurEngine, loadHistory, saveHistory, addHistoryEntry, HISTORY_ICONS } from '../utils/musicEngine'
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

const PLAYLIST_COLORS = ['var(--accent)','var(--accent-2)','var(--accent-3)','var(--red)','var(--green)','#8b5cf6','#f59e0b','#ec4899']
const PLAYLIST_ICONS  = ['📂','🎵','🔥','💜','🌙','⚡','🎧','🌊','🍂','☀️']

/* ── localStorage helpers ─────────────────────────────────────── */
const LS_KEY = 'kalztunz_library_data'

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
    { id:'pl1', name:'Morning Vibes',   description:'Slow build for the first coffee of the day', color:'var(--accent-2)', icon:'☀️', createdAt: mk(4),  tracks:[{id:'t2',title:'Solar Progression',artist:'Axon Beats',duration:204},{id:'t8',title:'Chord Cascade',artist:'Mara Vex',duration:195}] },
    { id:'pl2', name:'Late Night Jazz', description:'', color:'#8b5cf6', icon:'🌙', createdAt: mk(9),  tracks:[{id:'t3',title:'Jazz in the Rain',artist:'Cleo Vance',duration:312}] },
    { id:'pl3', name:'Focus Mode',      description:'Instrumental, low-distraction', color:'var(--accent-3)', icon:'🎧', createdAt: mk(14), tracks:[] },
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

// Seed history once — now writes through the shared app-history log
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

/* ── Generated-track chord player ────────────────────────────── */
function useGenPlayer() {
  const sRef = useRef(null)
  const [st, setSt] = useState({ playing:false, paused:false, progress:0, elapsed:0, curChord:0, id:null })
  const get = () => { if (!sRef.current) sRef.current = new ChordSynth(); return sRef.current }
  const play = useCallback((item) => {
    sRef.current?.stop()
    if (!item.progressions?.length) return
    const s = get()
    s.load(item.progressions[0], item.bpm || 120)
    setSt({ playing:false, paused:false, progress:0, elapsed:0, curChord:0, id:item.id })
    s.on('progress', ({elapsed:el,progress:pr}) => setSt(p=>({...p,elapsed:el,progress:pr})))
    s.on('chordIdx', i => setSt(p=>({...p,curChord:i})))
    s.on('end', () => setSt(p=>({...p,playing:false,paused:false,progress:0,elapsed:0,curChord:0,id:null})))
    s.play(); setSt(p=>({...p,playing:true,id:item.id}))
  },[])
  const toggle = useCallback((item) => {
    const s = get()
    if (st.id===item.id && st.playing)  { s.pause();  setSt(p=>({...p,playing:false,paused:true})) }
    else if (st.id===item.id && st.paused) { s.resume(); setSt(p=>({...p,playing:true,paused:false})) }
    else play(item)
  },[st,play])
  const stop = useCallback(()=>{ sRef.current?.stop(); setSt({playing:false,paused:false,progress:0,elapsed:0,curChord:0,id:null}) },[])
  useEffect(()=>()=>sRef.current?.stop(),[])
  return {...st, toggle, stop}
}

/* ── SVG icons ─────────────────────────────────────────────────── */
const IconSearch   = () => <svg width={14} height={14} viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const IconTrash    = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"/></svg>
const IconX        = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
const IconArrow    = () => <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
const IconClock    = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
const IconPlay     = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
const IconPause    = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
const IconShuffle  = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
const IconRepeat   = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
const IconEdit     = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>

/* ── ConfirmDialog ─────────────────────────────────────────────── */
function ConfirmDialog({ message, detail, onConfirm, onCancel, confirmLabel='Delete', danger=true }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem',animation:'fadeIn .15s ease' }} onClick={onCancel}>
      <div style={{ width:'100%',maxWidth:380,background:'var(--bg-1)',border:'1px solid var(--border-hi)',borderRadius:20,padding:'1.75rem',boxShadow:'0 24px 80px rgba(0,0,0,.55)',animation:'dropIn .22s cubic-bezier(.34,1.2,.64,1)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex',alignItems:'flex-start',gap:'.85rem',marginBottom:'1.1rem' }}>
          <div style={{ width:40,height:40,borderRadius:'50%',background:'rgba(255,95,107,.12)',border:'1.5px solid rgba(255,95,107,.28)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',flexShrink:0 }}>🗑</div>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:'1rem',marginBottom:'.3rem' }}>{message}</div>
            {detail && <div style={{ fontSize:'.82rem',color:'var(--text-2)',lineHeight:1.55 }}>{detail}</div>}
          </div>
        </div>
        <div style={{ display:'flex',gap:'.5rem',justifyContent:'flex-end' }}>
          <button className="btn btn--ghost btn--sm" onClick={onCancel}>Cancel</button>
          <button className={`btn btn--sm ${danger?'btn--danger':'btn--primary'}`}
            style={danger?{background:'rgba(255,95,107,.12)',border:'1.5px solid rgba(255,95,107,.35)',color:'var(--accent-err)'}:{}}
            onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

/* ── Full-featured audio player hook ──────────────────────────── */
// Supports: play, pause, resume, seek, a real shuffled/looping queue,
// and repeat modes (off → all → one). Fixed: the previous version
// referenced `togglePause` in its returned object without ever
// defining it, which threw a ReferenceError on every render of this
// hook — i.e. the Library page's player was completely broken.
function useMiniPlayer() {
  const [playing,   setPlaying]   = useState(null)
  const [paused,    setPaused]    = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [elapsed,   setElapsed]   = useState(0)
  const [queue,     setQueue]     = useState([])
  const [shuffle,   setShuffle]   = useState(false)
  const [loopMode,  setLoopMode]  = useState('off') // 'off' | 'all' | 'one'
  const [muted,     setMuted]     = useState(false)
  const [volume,    setVolume]    = useState(1)

  const audioRef     = useRef(null)
  const timerRef      = useRef(null)
  const ctxRef        = useRef(null)
  const gainRef       = useRef(null)
  const pausedAtRef   = useRef(0)   // elapsed seconds when paused
  const durationRef   = useRef(28)  // track duration
  const fullQueueRef  = useRef([])  // snapshot of the last full playlist, for loop-all replenishment
  const onEndRef      = useRef(() => {})

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current=null } }

  // ── Stop everything cleanly ──────────────────────────────────
  const stopAll = useCallback(() => {
    clearTimer()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current.onended = null
      audioRef.current = null
    }
    if (ctxRef.current) { try { ctxRef.current.close() } catch {} ctxRef.current=null }
    gainRef.current = null
    setPlaying(null); setPaused(false); setProgress(0); setElapsed(0)
    pausedAtRef.current = 0
  }, [])

  // ── Oscillator preview for tracks without a real URL ────────
  const startOscillator = useCallback((track, fromSeconds=0) => {
    if (ctxRef.current) { try { ctxRef.current.close() } catch {} ctxRef.current=null }
    clearTimer()
    const KEY_FREQS = {C:261.63,'C#':277.18,D:293.66,'D#':311.13,E:329.63,F:349.23,'F#':369.99,G:392,G8:415.3,'G#':415.3,A:440,'A#':466.16,B:493.88}
    const rootNote  = (track.key||'C major').split(' ')[0]
    const mode      = (track.key||'C major').split(' ')[1]||'major'
    const root      = KEY_FREQS[rootNote]||261.63
    const st        = n => root * Math.pow(2, n/12)
    const freqs     = mode==='minor'?[root,st(3),st(7)]:[root,st(4),st(7)]
    const totalSec  = track.duration || 28
    const remaining = totalSec - fromSeconds
    if (remaining <= 0) { onEndRef.current(); return }
    durationRef.current = totalSec
    try {
      const ctx  = new (window.AudioContext||window.webkitAudioContext)()
      ctxRef.current = ctx
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.18, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + remaining)
      gain.connect(ctx.destination)
      gainRef.current = gain
      freqs.forEach(f => {
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(f, ctx.currentTime)
        osc.connect(gain)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + remaining)
      })
      const startAt = Date.now() - fromSeconds * 1000
      timerRef.current = setInterval(() => {
        const el = Math.min((Date.now()-startAt)/1000, totalSec)
        setElapsed(el)
        setProgress(el/totalSec)
        if (el >= totalSec) { clearTimer(); onEndRef.current() }
      }, 100)
    } catch(e) { console.warn('AudioCtx unavailable:', e) }
  }, [])

  // ── Play a single track ──────────────────────────────────────
  const playTrack = useCallback((track, fromSeconds=0) => {
    stopAll()
    if (!track) return
    setPlaying(track); setPaused(false); setProgress(0); setElapsed(fromSeconds)
    pausedAtRef.current = fromSeconds
    durationRef.current = track.duration || 28

    if (track.preview) {
      const audio = new Audio(track.preview)
      audio.crossOrigin = 'anonymous'
      audioRef.current = audio
      audio.currentTime = fromSeconds
      audio.play().catch(()=>{})
      timerRef.current = setInterval(() => {
        if (!audio.paused) {
          const el = audio.currentTime
          setElapsed(el)
          if (audio.duration) setProgress(el/audio.duration)
        }
      }, 100)
      audio.onended = () => { clearTimer(); onEndRef.current() }
    } else {
      startOscillator(track, fromSeconds)
    }
  }, [stopAll, startOscillator])

  // ── Pause / Resume ───────────────────────────────────────────
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      clearTimer()
      pausedAtRef.current = audioRef.current.currentTime
    } else if (ctxRef.current) {
      // Oscillator can't be truly paused — store position and suspend the context
      clearTimer()
      pausedAtRef.current = elapsed
      try { ctxRef.current.suspend() } catch {}
    }
    setPaused(true)
  }, [elapsed])

  const resume = useCallback(() => {
    if (!playing) return
    if (audioRef.current) {
      audioRef.current.play().catch(()=>{})
      timerRef.current = setInterval(() => {
        if (audioRef.current && !audioRef.current.paused) {
          const el = audioRef.current.currentTime
          setElapsed(el)
          if (audioRef.current.duration) setProgress(el/audioRef.current.duration)
        }
      }, 100)
    } else {
      // Oscillator: restart from paused position
      startOscillator(playing, pausedAtRef.current)
    }
    setPaused(false)
  }, [playing, startOscillator])

  // FIX: this was referenced by the return object below but never
  // defined — the actual bug behind "play/pause failing".
  const togglePause = useCallback(() => {
    if (paused) resume(); else pause()
  }, [paused, pause, resume])

  // ── Queue management ─────────────────────────────────────────
  const playNext = useCallback(() => {
    setQueue(q => {
      let pool = q
      if (!pool.length) {
        if (loopMode === 'all' && fullQueueRef.current.length) {
          pool = fullQueueRef.current.slice()
        } else {
          stopAll()
          return q
        }
      }
      const idx  = shuffle ? Math.floor(Math.random() * pool.length) : 0
      const next = pool[idx]
      const rest = pool.filter((_, i) => i !== idx)
      playTrack(next)
      return rest
    })
  }, [stopAll, playTrack, loopMode, shuffle])

  // What happens when a track finishes naturally — checked fresh each
  // time via a ref so a mid-playback loop-mode change is respected.
  useEffect(() => {
    onEndRef.current = () => {
      if (loopMode === 'one' && playing) { playTrack(playing, 0); return }
      playNext()
    }
  }, [loopMode, playing, playTrack, playNext])

  const playPrev = useCallback(() => {
    // If > 3s into track, restart current. Otherwise just restart (no persistent back-history).
    if (playing) { playTrack(playing, 0); return }
  }, [playing, playTrack])

  const enqueue = useCallback((tracks) => {
    setQueue(q => [...q, ...(Array.isArray(tracks) ? tracks : [tracks])])
  }, [])

  const playNow = useCallback((track) => {
    fullQueueRef.current = []
    playTrack(track)
  }, [playTrack])

  const playPlaylist = useCallback((tracks) => {
    if (!tracks.length) return
    fullQueueRef.current = tracks
    playTrack(tracks[0])
    setQueue(tracks.slice(1))
  }, [playTrack])

  const clearQueue = useCallback(() => { fullQueueRef.current = []; setQueue([]) }, [])

  // ── Seek (drag progress bar) ─────────────────────────────────
  const seekTo = useCallback((fraction) => {
    const total = durationRef.current || 28
    const targetSec = Math.max(0, Math.min(fraction * total, total - 0.1))
    if (audioRef.current) {
      audioRef.current.currentTime = targetSec
      setElapsed(targetSec)
      setProgress(fraction)
      pausedAtRef.current = targetSec
    } else if (playing) {
      const wasPlaying = !paused
      startOscillator(playing, targetSec)
      if (!wasPlaying) {
        setTimeout(() => { try { ctxRef.current?.suspend() } catch {} }, 50)
        setPaused(true)
      }
      setElapsed(targetSec)
      setProgress(fraction)
      pausedAtRef.current = targetSec
    }
  }, [playing, paused, startOscillator])

  const toggleShuffle = useCallback(() => setShuffle(s => !s), [])
  const cycleLoop = useCallback(() => {
    setLoopMode(m => m === 'off' ? 'all' : m === 'all' ? 'one' : 'off')
  }, [])

  useEffect(() => () => stopAll(), [])

  return {
    playing, paused, progress, elapsed, queue,
    playNow, playPlaylist, enqueue, clearQueue,
    togglePause, pause, resume, seekTo,
    playNext, playPrev, stopAll,
    shuffle, toggleShuffle,
    loopMode, cycleLoop,
    muted, toggleMute: () => {
      setMuted(m => {
        const next = !m
        if (audioRef.current) audioRef.current.volume = next ? 0 : volume
        return next
      })
    },
    volume, setVolumeLevel: v => {
      setVolume(v)
      if (audioRef.current) audioRef.current.volume = muted ? 0 : v
    },
    reorderQueue: (newQ) => setQueue(newQ),
    removeFromQueue: (idx) => setQueue(q => q.filter((_,i)=>i!==idx)),
  }
}

/* ── Draggable progress bar ────────────────────────────────────── */
function ProgressBar({ progress, onSeek, accentColor='var(--accent)' }) {
  const barRef  = useRef(null)
  const dragging = useRef(false)

  const getFraction = (e) => {
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  const onMouseDown = (e) => {
    dragging.current = true
    onSeek(getFraction(e))
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onMouseMove, {passive:false})
    window.addEventListener('touchend', onMouseUp)
  }
  const onMouseMove = (e) => { if (dragging.current) onSeek(getFraction(e)) }
  const onMouseUp   = ()  => {
    dragging.current = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('touchmove', onMouseMove)
    window.removeEventListener('touchend', onMouseUp)
  }

  return (
    <div ref={barRef} onMouseDown={onMouseDown} onTouchStart={onMouseDown}
      style={{ flex:1,height:16,display:'flex',alignItems:'center',cursor:'pointer',padding:'6px 0',margin:'0 2px' }}>
      <div style={{ flex:1,height:4,background:'rgba(255,255,255,.18)',borderRadius:2,position:'relative',overflow:'visible' }}>
        <div style={{ position:'absolute',left:0,top:0,height:'100%',width:`${progress*100}%`,background:accentColor,borderRadius:2,transition:dragging.current?'none':'width .1s linear' }}/>
        <div style={{ position:'absolute',top:'50%',left:`${progress*100}%`,transform:'translate(-50%,-50%)',width:13,height:13,borderRadius:'50%',background:'#fff',boxShadow:'0 2px 8px rgba(0,0,0,.4)',cursor:'grab',transition:dragging.current?'none':'left .1s linear' }}/>
      </div>
    </div>
  )
}

/* ── Now Playing Bar — full player ────────────────────────────── */
function NowPlayingBar({ playing, paused, progress, elapsed, queue,
  onTogglePause, onSeek, onNext, onPrev, onStop,
  shuffle, onShuffle, loopMode, onCycleLoop, muted, onMute, volume, onVolume, onRemoveQ }) {
  const [showQueue, setShowQueue] = useState(false)
  const [showVol,   setShowVol]   = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!showQueue && !showVol) return
    const close = e => { if (ref.current && !ref.current.contains(e.target)) { setShowQueue(false); setShowVol(false) } }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showQueue, showVol])

  if (!playing) return null
  const total   = playing.duration || 28
  const hasNext = queue.length > 0

  return (
    <div ref={ref}>
      {/* Queue panel */}
      {showQueue && (
        <div style={{ position:'fixed',bottom:72,left:0,right:0,maxWidth:480,margin:'0 auto',
          background:'rgba(10,10,22,.97)',border:'1px solid rgba(255,107,71,.22)',borderRadius:'18px 18px 0 0',
          boxShadow:'0 -12px 48px rgba(0,0,0,.7)',zIndex:399,padding:'1rem',backdropFilter:'blur(20px)' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.85rem' }}>
            <span style={{ fontWeight:800,fontSize:'.88rem',color:'var(--accent)' }}>▣ Queue ({queue.length})</span>
            <div style={{ display:'flex',gap:'.4rem',alignItems:'center' }}>
              <button onClick={onShuffle} style={{ display:'flex',alignItems:'center',gap:'.3rem',padding:'.22rem .6rem',borderRadius:999,border:`1.5px solid ${shuffle?'var(--accent)':'var(--border)'}`,background:shuffle?'rgba(255,107,71,.12)':'transparent',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.72rem',color:shuffle?'var(--accent)':'var(--text-3)',transition:'all .2s' }}><IconShuffle/> Shuffle {shuffle?'On':'Off'}</button>
              <button onClick={()=>setShowQueue(false)} style={{ background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:'.85rem',padding:'.2rem .4rem' }}>✕</button>
            </div>
          </div>
          <div style={{ maxHeight:240,overflowY:'auto' }}>
            {queue.length===0 && <p style={{ color:'var(--text-3)',fontSize:'.82rem',textAlign:'center',padding:'1rem 0' }}>Queue is empty — add tracks below</p>}
            {queue.map((t,i)=>(
              <div key={t.id||i} style={{ display:'flex',alignItems:'center',gap:'.65rem',padding:'.42rem .3rem',borderRadius:8,transition:'background .15s',cursor:'default' }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div style={{ width:7,height:7,borderRadius:'50%',background:'var(--accent)',flexShrink:0,opacity:.6+i*.05 }}/>
                <div style={{ width:34,height:34,borderRadius:8,background:coverGrad(t.title),flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.85rem' }}>🎵</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:'.78rem',fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{t.title}</div>
                  <div style={{ fontSize:'.66rem',color:'var(--text-3)' }}>{t.artist||t.key||''}{t.bpm?` · ${t.bpm}bpm`:''}</div>
                </div>
                <button onClick={()=>onRemoveQ?.(i)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',padding:'.15rem .3rem',borderRadius:4,transition:'all .15s',fontSize:'.8rem' }}
                  onMouseEnter={e=>{e.currentTarget.style.color='var(--red)';e.currentTarget.style.background='rgba(220,38,38,.1)'}}
                  onMouseLeave={e=>{e.currentTarget.style.color='var(--text-3)';e.currentTarget.style.background='transparent'}}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Volume panel */}
      {showVol && (
        <div style={{ position:'fixed',bottom:72,right:16,background:'rgba(10,10,22,.97)',border:'1px solid rgba(255,255,255,.12)',borderRadius:14,padding:'1rem .85rem',zIndex:399,backdropFilter:'blur(20px)',boxShadow:'0 -8px 32px rgba(0,0,0,.6)',minWidth:52 }}>
          <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:'.65rem' }}>
            <button onClick={onMute} title={muted?'Unmute':'Mute'} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',padding:'.18rem' }}>{muted?'🔇':'🔊'}</button>
            <input type="range" min={0} max={1} step={0.05} value={muted?0:volume} onChange={e=>onVolume?.(parseFloat(e.target.value))}
              style={{ writingMode:'vertical-lr',direction:'rtl',height:90,cursor:'pointer',accentColor:'var(--accent)' }}/>
            <span style={{ fontSize:'.65rem',color:'var(--text-3)',fontFamily:'monospace' }}>{Math.round((muted?0:volume)*100)}%</span>
          </div>
        </div>
      )}

      {/* Main bar */}
      <div className="now-playing-bar" style={{ padding:'.5rem 1rem',gap:'.5rem' }}>
        {/* Animated cover */}
        <div className="np-cover" style={{ background:coverGrad(playing.title),flexShrink:0,position:'relative',overflow:'hidden' }}>
          <span style={{ fontSize:'1rem' }}>🎵</span>
          {!paused && <div style={{ position:'absolute',inset:0,background:'linear-gradient(135deg,transparent,rgba(255,107,71,.18))',animation:'spin 4s linear infinite',borderRadius:'50%' }}/>}
        </div>

        {/* Info */}
        <div className="np-info" style={{ flexShrink:0,minWidth:0,maxWidth:160 }}>
          <div className="np-title" style={{ overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{playing.title}</div>
          <div className="np-artist" style={{ overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
            {playing.artist||playing.key||''}{playing.bpm?` · ${playing.bpm} BPM`:''}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display:'flex',alignItems:'center',gap:'.18rem',flexShrink:0 }}>
          <button className="np-btn" onClick={onPrev} title="Restart" style={{ opacity:.78 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          <button className="np-btn np-play" onClick={onTogglePause} title={paused?'Resume':'Pause'}>
            {paused ? <IconPlay/> : <IconPause/>}
          </button>
          <button className="np-btn" onClick={onNext} disabled={!hasNext && loopMode==='off'} style={{ opacity:(hasNext||loopMode!=='off')?1:.35 }} title={hasNext?`Next (${queue.length})`:'Queue empty'}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
        </div>

        {/* Progress */}
        <div className="np-progress-wrap" style={{ flex:1,display:'flex',alignItems:'center',gap:'.4rem',minWidth:0 }}>
          <span className="np-time" style={{ flexShrink:0 }}>{fmtDur(elapsed)}</span>
          <ProgressBar progress={progress} onSeek={onSeek}/>
          <span className="np-time" style={{ flexShrink:0 }}>{fmtDur(total)}</span>
        </div>

        {/* Right controls: shuffle, loop, queue, volume, close */}
        <div style={{ display:'flex',alignItems:'center',gap:'.28rem',flexShrink:0 }}>
          {/* Shuffle */}
          <button className="np-btn" onClick={onShuffle} title={shuffle?'Shuffle on':'Shuffle off'} style={{ color:shuffle?'var(--accent)':'var(--text-3)',background:shuffle?'rgba(255,107,71,.1)':'transparent',borderRadius:6 }}>
            <IconShuffle/>
          </button>
          {/* Loop */}
          <button className="np-btn" onClick={onCycleLoop} title={`Repeat: ${loopMode==='off'?'Off':loopMode==='all'?'All':'One'}`} style={{ position:'relative',color:loopMode!=='off'?'var(--accent)':'var(--text-3)',background:loopMode!=='off'?'rgba(255,107,71,.1)':'transparent',borderRadius:6 }}>
            <IconRepeat/>
            {loopMode==='one' && <span style={{ position:'absolute',bottom:-3,right:-3,fontSize:'.5rem',fontWeight:900,background:'var(--accent)',color:'#fff',borderRadius:'50%',width:11,height:11,display:'flex',alignItems:'center',justifyContent:'center' }}>1</span>}
          </button>
          {/* Queue */}
          <button className="np-btn" onClick={()=>{setShowQueue(q=>!q);setShowVol(false)}} title="Queue" style={{ position:'relative',color:showQueue?'var(--accent)':'var(--text-3)',background:showQueue?'rgba(255,107,71,.1)':'transparent',borderRadius:6 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg>
            {hasNext && <span style={{ position:'absolute',top:-4,right:-4,background:'var(--accent)',color:'#fff',borderRadius:'50%',width:14,height:14,fontSize:'.52rem',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900 }}>{queue.length}</span>}
          </button>
          {/* Volume */}
          <button className="np-btn" onClick={()=>{setShowVol(v=>!v);setShowQueue(false)}} title={muted?'Unmute':'Volume'} style={{ color:muted?'var(--text-3)':showVol?'var(--accent)':'var(--text-3)',background:showVol?'rgba(255,107,71,.1)':'transparent',borderRadius:6 }}>
            {muted
              ? <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
              : <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
            }
          </button>
          {/* Close */}
          <button className="np-close" onClick={onStop} title="Stop"><IconX/></button>
        </div>
      </div>
    </div>
  )
}

/* ── Track row ───────────────────────────────────────────────── */
function TrackRow({ track, dateLabel, date, onRemove, removeLabel, onToggle, playing }) {
  return (
    <div className="lib-row lib-row-anim" style={{ background:playing?'rgba(255,107,71,.06)':undefined, borderColor:playing?'var(--accent)':undefined }}>
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

/* ── Playlist create / edit modal ─────────────────────────────── */
function PlaylistFormModal({ initial, title, onClose, onSubmit }) {
  const [name,        setName]        = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [color,        setColor]       = useState(initial?.color || PLAYLIST_COLORS[0])
  const [icon,         setIcon]        = useState(initial?.icon || PLAYLIST_ICONS[0])
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])

  const submit = () => {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), description: description.trim(), color, icon })
    onClose()
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'var(--overlay)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem',animation:'fadeIn .18s ease' }} onClick={onClose}>
      <div style={{ background:'var(--bg-1)',border:'1px solid var(--border-hi)',borderRadius:20,padding:'1.75rem',width:'100%',maxWidth:420,boxShadow:'var(--shadow)',animation:'dropIn .22s ease' }} onClick={e=>e.stopPropagation()}>
        <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.1rem',fontWeight:800,marginBottom:'1.1rem' }}>{title}</h2>
        <div className="form">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input ref={ref} className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="My Playlist" maxLength={80}
              onKeyDown={e=>e.key==='Enter'&&submit()} />
          </div>
          <div className="form-group">
            <label className="form-label">Description <span style={{ color:'var(--text-3)',fontWeight:400,textTransform:'none' }}>(optional)</span></label>
            <input className="form-input" value={description} onChange={e=>setDescription(e.target.value)} placeholder="What's this playlist for?" maxLength={140} />
          </div>
          <div className="form-group">
            <label className="form-label">Icon</label>
            <div style={{ display:'flex',gap:'.35rem',flexWrap:'wrap' }}>
              {PLAYLIST_ICONS.map(ic => (
                <button key={ic} type="button" onClick={()=>setIcon(ic)}
                  style={{ width:34,height:34,borderRadius:9,border:`2px solid ${icon===ic?'var(--accent)':'var(--border)'}`,background:icon===ic?'rgba(255,107,71,.12)':'var(--bg-2)',fontSize:'1.1rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>{ic}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Accent Color</label>
            <div style={{ display:'flex',gap:'.5rem',flexWrap:'wrap' }}>
              {PLAYLIST_COLORS.map(c => (
                <button key={c} type="button" onClick={()=>setColor(c)}
                  style={{ width:26,height:26,borderRadius:'50%',border:color===c?'2px solid var(--text)':'2px solid transparent',background:c,cursor:'pointer',boxShadow:color===c?'0 0 0 2px var(--bg-1)':'none' }} />
              ))}
            </div>
          </div>
          <div style={{ display:'flex',gap:'.5rem',justifyContent:'flex-end' }}>
            <button className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button>
            <button className="btn btn--primary btn--sm" disabled={!name.trim()} onClick={submit}>{initial ? 'Save Changes' : 'Create'}</button>
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
  const reSearch = q => { addHistoryEntry('search', q); navigate(`/search?q=${encodeURIComponent(q)}`); onClose() }

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
            <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.1rem',fontWeight:800 }}>App History</h2>
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
                {items.map(item=>{
                  const canReSearch = item.type === 'search' || item.type === 'artist'
                  return (
                  <div key={item.id}
                    style={{ display:'flex',alignItems:'center',gap:'.55rem',padding:'.5rem 1rem',borderRadius:10,margin:'.15rem 0',background:selected.has(item.id)?'rgba(255,107,71,.07)':'transparent',border:`1px solid ${selected.has(item.id)?'rgba(255,107,71,.22)':'transparent'}`,transition:'background .12s',cursor:'pointer' }}
                    onClick={()=>toggleSel(item.id)}>
                    <div style={{ width:18,height:18,borderRadius:4,border:`1.5px solid ${selected.has(item.id)?'var(--accent)':'var(--border-hi)'}`,background:selected.has(item.id)?'var(--accent)':'transparent',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .14s' }}>
                      {selected.has(item.id)&&<svg width={10} height={10} viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                    </div>
                    <span style={{ fontSize:'.77rem',color:'var(--text-3)',flexShrink:0 }}>{HISTORY_ICONS[item.type] || '🕐'}</span>
                    <span style={{ flex:1,fontSize:'.875rem',fontWeight:600 }}>{item.query}</span>
                    <span style={{ fontSize:'.65rem',color:'var(--text-3)',flexShrink:0,textTransform:'capitalize' }}>{item.type}</span>
                    <span style={{ fontSize:'.67rem',color:'var(--text-3)',flexShrink:0 }}>{fmtDate(item.timestamp)}</span>
                    <div style={{ display:'flex',gap:'.2rem',flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                      {canReSearch && <button className="btn btn--icon btn--ghost btn--sm" title="Search again" onClick={()=>reSearch(item.query)} style={{ color:'var(--accent-3)',borderColor:'transparent',padding:'.2rem' }}><IconArrow/></button>}
                      <button className="btn btn--icon btn--ghost btn--sm" title="Delete" onClick={()=>delOne(item.id)} style={{ color:'var(--text-3)',borderColor:'transparent',padding:'.2rem' }}><IconX/></button>
                    </div>
                  </div>
                )})}
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
  const accent = playlist.color || 'var(--accent)'
  return (
    <div className="lib-playlist-card" onClick={()=>onOpen(playlist)} style={{ borderTop:`3px solid ${accent}` }}>
      <div className="lib-playlist-cover">
        {playlist.tracks.slice(0,4).map((t,i)=>(
          <div key={t.id} style={{ position:'absolute',width:'50%',height:'50%',top:i<2?0:'50%',left:i%2===0?0:'50%',background:coverGrad(t.title),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.75rem' }}>🎵</div>
        ))}
        {!playlist.tracks.length&&<div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2.4rem',color:'var(--text-3)' }}>{playlist.icon||'📂'}</div>}
        <div className="lib-playlist-play-overlay" style={{ background:'rgba(0,0,0,0)' }}>
          <div className="lib-playlist-play-btn" style={{ width:38,height:38,borderRadius:'50%',background:accent,display:'flex',alignItems:'center',justifyContent:'center',opacity:0,boxShadow:'0 4px 16px rgba(255,107,71,.4)' }}><IconPlay/></div>
        </div>
      </div>
      <div className="lib-playlist-body">
        <div className="lib-playlist-name" title={playlist.name}>{playlist.icon&&<span style={{ marginRight:'.3rem' }}>{playlist.icon}</span>}{playlist.name}</div>
        {playlist.description && <div style={{ fontSize:'.68rem',color:'var(--text-3)',marginBottom:'.15rem' }} className="truncate">{playlist.description}</div>}
        <div className="lib-playlist-meta">{playlist.tracks.length} tracks{dur>0&&` · ${fmtDur(dur)}`}</div>
        <div style={{ fontSize:'.67rem',color:'var(--text-3)',marginTop:'.1rem' }}>{fmtDate(playlist.createdAt)}</div>
      </div>
      <button className="btn btn--icon btn--ghost btn--sm lib-playlist-del" title="Delete" onClick={e=>{e.stopPropagation();onDelete(playlist.id, playlist.name)}}><IconTrash/></button>
    </div>
  )
}

function PlaylistDetail({ playlist, onBack, onEdit, onRemoveTrack, onMoveTrack, onToggle, playingId, onPlayAll }) {
  const dur = playlist.tracks.reduce((s,t)=>s+(t.duration||0),0)
  const accent = playlist.color || 'var(--accent)'
  return (
    <div>
      <button className="btn btn--ghost btn--sm" onClick={onBack} style={{ marginBottom:'1.1rem' }}>← Back</button>
      <div style={{ display:'flex',alignItems:'center',gap:'1rem',marginBottom:'1.4rem',flexWrap:'wrap' }}>
        <div style={{ width:72,height:72,borderRadius:14,position:'relative',overflow:'hidden',flexShrink:0,background:'var(--bg-3)',border:`2px solid ${accent}` }}>
          {playlist.tracks.slice(0,4).map((t,i)=>(
            <div key={t.id} style={{ position:'absolute',width:'50%',height:'50%',top:i<2?0:'50%',left:i%2===0?0:'50%',background:coverGrad(t.title),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.7rem' }}>🎵</div>
          ))}
          {!playlist.tracks.length&&<div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem' }}>{playlist.icon||'📂'}</div>}
        </div>
        <div style={{ flex:1,minWidth:200 }}>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.25rem',fontWeight:800,marginBottom:'.18rem' }}>{playlist.name}</h2>
          {playlist.description && <p style={{ fontSize:'.8rem',color:'var(--text-2)',marginBottom:'.2rem' }}>{playlist.description}</p>}
          <p style={{ fontSize:'.82rem',color:'var(--text-2)' }}>{playlist.tracks.length} tracks{dur>0&&` · ${fmtDur(dur)}`} · Created {fmtDateFull(playlist.createdAt)}</p>
        </div>
        <div style={{ display:'flex',gap:'.5rem',flexShrink:0 }}>
          <button className="btn btn--ghost btn--sm" onClick={()=>onEdit(playlist)}><IconEdit/> Edit</button>
          {playlist.tracks.length > 0 && onPlayAll && (
            <button className="btn btn--primary btn--sm" onClick={()=>onPlayAll(playlist.tracks, playlist.name)}>▶ Play All</button>
          )}
        </div>
      </div>
      {!playlist.tracks.length
        ? <div className="lib-empty"><div className="lib-empty__icon">🎵</div><p className="lib-empty__text">This playlist is empty</p><Link to="/search" className="btn btn--primary btn--sm">Add tracks from Discover</Link></div>
        : <div style={{ display:'flex',flexDirection:'column',gap:'.42rem' }}>
            {playlist.tracks.map((t,i)=>(
              <div key={t.id} className="lib-row lib-row-anim" style={{ background:playingId===t.id?'rgba(255,107,71,.06)':undefined, borderColor:playingId===t.id?'var(--accent)':undefined }}>
                <span style={{ width:18,textAlign:'center',fontSize:'.72rem',color:'var(--text-3)',fontFamily:'monospace',flexShrink:0 }}>{i+1}</span>
                <button onClick={()=>onToggle(t)} style={{ width:38,height:38,borderRadius:8,flexShrink:0,background:coverGrad(t.title),border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.85rem' }}>
                  {playingId===t.id?<span style={{color:'#fff',animation:'pulse 1s ease infinite'}}>⏸</span>:<span style={{color:'rgba(255,255,255,.55)'}}>▶</span>}
                </button>
                <div className="lib-row__info"><div className="lib-row__title">{t.title}</div><div className="lib-row__sub">{t.artist}</div></div>
                <div className="lib-row__meta">
                  <span style={{ fontSize:'.7rem',color:'var(--text-3)',fontFamily:'monospace' }}>{fmtDur(t.duration)}</span>
                  <div style={{ display:'flex',flexDirection:'column',gap:1 }}>
                    <button disabled={i===0} onClick={()=>onMoveTrack(i,i-1)} title="Move up" style={{ background:'none',border:'none',cursor:i===0?'default':'pointer',opacity:i===0?.25:.7,color:'var(--text-2)',lineHeight:1,padding:0,fontSize:'.6rem' }}>▲</button>
                    <button disabled={i===playlist.tracks.length-1} onClick={()=>onMoveTrack(i,i+1)} title="Move down" style={{ background:'none',border:'none',cursor:i===playlist.tracks.length-1?'default':'pointer',opacity:i===playlist.tracks.length-1?.25:.7,color:'var(--text-2)',lineHeight:1,padding:0,fontSize:'.6rem' }}>▼</button>
                  </div>
                  <button className="btn btn--icon btn--ghost btn--sm lib-row__del" onClick={()=>onRemoveTrack(playlist.id,t.id,t.title)}><IconX/></button>
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
        <div style={{ display:'flex',alignItems:'center',gap:'.45rem',fontWeight:700,fontSize:'.875rem' }}><IconClock/> Recent Activity</div>
        <button onClick={onOpenFull} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'.75rem',color:'var(--accent)',fontFamily:'inherit',fontWeight:700,display:'flex',alignItems:'center',gap:'.22rem' }}>View all <IconArrow/></button>
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:'.28rem' }}>
        {hist.map(item=>{
          const clickable = item.type === 'search' || item.type === 'artist'
          return (
          <div key={item.id}
            style={{ display:'flex',alignItems:'center',gap:'.5rem',padding:'.38rem .55rem',borderRadius:9,cursor:clickable?'pointer':'default',transition:'background .12s' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-2)'}
            onMouseLeave={e=>e.currentTarget.style.background=''}
            onClick={()=>{ if(!clickable) return; addHistoryEntry('search', item.query); navigate(`/search?q=${encodeURIComponent(item.query)}`) }}>
            <span style={{ color:'var(--text-3)',fontSize:'.77rem',flexShrink:0 }}>{HISTORY_ICONS[item.type] || '🕐'}</span>
            <span style={{ flex:1,fontSize:'.84rem',fontWeight:500 }}>{item.query}</span>
            <span style={{ fontSize:'.66rem',color:'var(--text-3)',flexShrink:0 }}>{fmtDate(item.timestamp)}</span>
            <button onClick={e=>remove(e,item.id)} className="history-del-btn" style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',padding:'.12rem',display:'flex' }}><IconX/></button>
          </div>
        )})}
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
  const [data, setData] = useState(() => loadLibraryData() || DEFAULT_DATA)

  // Re-read from localStorage when window gains focus — picks up saves from Generate/Extract
  useEffect(() => {
    const refresh = () => { const d = loadLibraryData(); if (d) setData(d) }
    refresh() // immediate on mount
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  const [activeSection,  setActiveSection]  = useState('overview')
  const [search,         setSearch]         = useState('')
  const [showCreate,     setShowCreate]     = useState(false)
  const [editPlaylist,   setEditPlaylist]   = useState(null)
  const [confirm,        setConfirm]        = useState(null) // {message,detail,onConfirm}
  const [openPlaylist,   setOpenPlaylist]   = useState(null)
  const [showHistory,    setShowHistory]    = useState(false)

  const askConfirm = useCallback((message, detail, onConfirm) => {
    setConfirm({ message, detail, onConfirm })
  }, [])

  const updateData = useCallback((patch) => {
    setData(prev => {
      const next = { ...prev, ...patch }
      saveLibraryData(next)
      return next
    })
  }, [])

  const { saved, liked, artists, playlists, extractions, generations } = data

  const { playing, paused, progress, elapsed, queue, playNow, playPlaylist, enqueue, clearQueue, togglePause, seekTo, playNext, playPrev, stopAll, shuffle, toggleShuffle, loopMode, cycleLoop, muted, toggleMute, volume, setVolumeLevel, removeFromQueue } = useMiniPlayer()
  const genPlayer = useGenPlayer()

  const toggleTrack = useCallback((track) => {
    if (playing?.id === track.id) { togglePause(); return }
    playNow(track)
    addHistoryEntry('play', track.title, { artist: track.artist })
  }, [playing, togglePause, playNow])

  const handlePlayPlaylist = useCallback((tracks, name) => {
    playPlaylist(tracks)
    addHistoryEntry('playlist', name)
  }, [playPlaylist])

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

  const rm = useCallback((key, id, label='item') => {
    const titles = { saved:'saved track', liked:'liked track', extractions:'extraction', generations:'generated track', artists:'artist' }
    askConfirm(
      `Remove this ${titles[key]||label}?`,
      'This removes it from your library. You can re-add it later.',
      () => updateData({ [key]: data[key].filter(x=>x.id!==id) })
    )
  }, [data, updateData, askConfirm])

  const createPlaylist = useCallback((patch) => {
    updateData({ playlists:[{ id:`pl${Date.now()}`, tracks:[], createdAt:new Date().toISOString(), ...patch },...playlists] })
  }, [playlists, updateData])

  const updatePlaylist = useCallback((id, patch) => {
    updateData({ playlists: playlists.map(p => p.id===id ? { ...p, ...patch } : p) })
    setOpenPlaylist(prev => prev?.id===id ? { ...prev, ...patch } : prev)
  }, [playlists, updateData])

  const movePlaylistTrack = useCallback((plId, fromIdx, toIdx) => {
    const pl = playlists.find(p=>p.id===plId)
    if (!pl || toIdx<0 || toIdx>=pl.tracks.length) return
    const tracks = [...pl.tracks]
    const [moved] = tracks.splice(fromIdx,1)
    tracks.splice(toIdx,0,moved)
    updatePlaylist(plId, { tracks })
  }, [playlists, updatePlaylist])

  const deletePlaylist = useCallback((id, name) => {
    askConfirm(
      `Delete playlist "${name||'this playlist'}"?`,
      'All tracks will be removed from the playlist. Your tracks are not deleted.',
      () => { updateData({ playlists:playlists.filter(p=>p.id!==id) }); if(openPlaylist?.id===id) setOpenPlaylist(null) }
    )
  }, [playlists, openPlaylist, updateData, askConfirm])

  const rmFromPlaylist = useCallback((plId, tId, trackTitle) => {
    askConfirm(
      `Remove "${trackTitle||'this track'}" from playlist?`,
      null,
      () => {
        const next = playlists.map(p=>p.id!==plId?p:{...p,tracks:p.tracks.filter(t=>t.id!==tId)})
        updateData({ playlists:next })
        setOpenPlaylist(prev=>prev?.id===plId?{...prev,tracks:prev.tracks.filter(t=>t.id!==tId)}:prev)
      }
    )
  }, [playlists, updateData, askConfirm])

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
          <div className="page-header__badge"><span className="lib-header-icon" style={{display:"inline-block"}}>📁</span> Library</div>
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
      <div className="lib-layout">

        {/* Sidebar nav */}
        <nav style={{ background:'var(--bg-1)',border:'1px solid var(--border)',borderRadius:18,padding:'.45rem',position:'sticky',top:80,boxShadow:'var(--shadow-card)' }}>
          {NAV.map(item => (
            <button key={item.key} className={`nav-item-anim lib-nav-item${activeSection===item.key?' active':''}`} onClick={()=>{setActiveSection(item.key);setSearch('');setOpenPlaylist(null)}}>
              <span style={{ display:'flex',alignItems:'center',gap:'.45rem' }}>
                <span style={{ fontSize:'.92rem',display:'inline-block',transition:'transform .25s' }} className={activeSection===item.key?'lib-header-icon':''}>{item.icon}</span>{item.label}
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
            <IconClock/> App history
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

          <div className="fade-up section-transition" key={activeSection}>

            {/* OVERVIEW */}
            {activeSection==='overview'&&(
              <div>
                <div className="lib-stat-grid">
                  {statCards.map(c=>(
                    <button key={c.key} className="stat-card-anim" onClick={()=>setActiveSection(c.key)}
                      style={{ background:'var(--bg-1)',border:'1px solid var(--border)',borderRadius:16,padding:'1.2rem',textAlign:'center',cursor:'pointer',transition:'all .22s cubic-bezier(.34,1.2,.64,1)',fontFamily:'inherit',position:'relative',overflow:'hidden' }}
                      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-6px) scale(1.03)';e.currentTarget.style.boxShadow='var(--shadow)';e.currentTarget.style.borderColor='transparent'}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';e.currentTarget.style.borderColor='var(--border)'}}>
                      <div style={{ position:'absolute',top:0,left:0,right:0,height:3,background:c.grad,borderRadius:'16px 16px 0 0' }}/>
                      <div style={{ fontSize:'1.5rem',marginBottom:'.3rem',transition:'transform .3s' }} className="lib-header-icon">{c.icon}</div>
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
                ?<div className="lib-playlist-grid">
                   {filterP(playlists).map(pl=><PlaylistCard key={pl.id} playlist={pl} onOpen={setOpenPlaylist} onDelete={deletePlaylist}/>)}
                 </div>
                :<LibEmpty icon="📂" text="No playlists yet" cta="Create your first" onClick={()=>setShowCreate(true)}/>
            )}
            {activeSection==='playlists'&&openPlaylist&&(
              <PlaylistDetail playlist={openPlaylist} onBack={()=>setOpenPlaylist(null)} onEdit={setEditPlaylist}
                onRemoveTrack={rmFromPlaylist} onMoveTrack={(from,to)=>movePlaylistTrack(openPlaylist.id,from,to)}
                onToggle={toggleTrack} playingId={playing?.id} onPlayAll={handlePlayPlaylist}/>
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
                       <button className="btn btn--danger btn--sm" onClick={()=>askConfirm(`Unfollow ${a.username}?`,'You can follow them again from Discover.',()=>updateData({artists:artists.filter(x=>x.id!==a.id)}))}>Unfollow</button>
                     </div>
                   ))}
                 </div>
                :<LibEmpty icon="👤" text="Not following anyone" cta="Discover artists" to="/search"/>
            )}

            {/* EXTRACTIONS */}
            {activeSection==='extractions'&&(
              filterI(extractions).length>0
                ?<ColList>{filterI(extractions).map(item=>(
                    <div key={item.id} className="lib-row lib-row-anim" style={{flexDirection:'column',alignItems:'stretch',gap:'.45rem',padding:'.9rem'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'.7rem'}}>
                        <div style={{width:40,height:40,borderRadius:12,flexShrink:0,background:'linear-gradient(135deg,var(--bg-3),var(--bg-4))',border:'1.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem'}}>🎸</div>
                        <div className="lib-row__info">
                          <div className="lib-row__title">{item.title}</div>
                          <div className="lib-row__sub">{item.totalChords} chords · {item.key} · {item.bpm} bpm{item.duration?` · ${fmtDurEngine(item.duration)}`:''}</div>
                        </div>
                        <div className="lib-row__meta">
                          <span style={{fontSize:'.67rem',color:'var(--text-3)'}}>{fmtDate(item.createdAt)}</span>
                          <Link to="/extract" className="btn btn--ghost btn--sm" style={{fontSize:'.7rem',padding:'.2rem .5rem'}}>Re-extract</Link>
                          <button className="btn btn--icon btn--ghost btn--sm lib-row__del" onClick={()=>rm('extractions',item.id)}><IconTrash/></button>
                        </div>
                      </div>
                      {item.progressions?.length>0&&(
                        <div style={{paddingLeft:52}}>
                          <div style={{fontSize:'.67rem',color:'var(--text-3)',marginBottom:'.25rem'}}>Suggested:</div>
                          <div style={{display:'flex',gap:'.45rem',flexWrap:'wrap'}}>
                            {item.progressions.slice(0,2).map((p,i)=><div key={i} style={{fontSize:'.68rem',fontFamily:"'Space Mono',monospace",color:i===0?'var(--accent)':'var(--text-2)',background:i===0?'rgba(255,107,71,.07)':'var(--bg-3)',padding:'.18rem .5rem',borderRadius:6,border:`1px solid ${i===0?'rgba(255,107,71,.22)':'var(--border)'}`}}>{p}</div>)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}</ColList>
                :<LibEmpty icon="🎸" text="No extractions yet" cta="Extract chords" to="/extract"/>
            )}

            {/* GENERATED */}
            {activeSection==='generated'&&(
              filterI(generations).length>0
                ?<ColList>{filterI(generations).map(item=>{
                    const isAct=genPlayer.id===item.id, hasP=!!item.progressions?.length
                    const chords=item.progressions?.[0]?.split(' — ').filter(Boolean)||[]
                    return(
                    <div key={item.id} className="lib-row lib-row-anim" style={{flexDirection:'column',alignItems:'stretch',gap:'.55rem',padding:'1rem',background:isAct?'rgba(255,107,71,.05)':undefined,borderColor:isAct?'var(--accent)':undefined}}>
                      <div style={{display:'flex',alignItems:'center',gap:'.7rem'}}>
                        <button onClick={()=>hasP&&genPlayer.toggle(item)}
                          style={{width:40,height:40,borderRadius:12,flexShrink:0,background:isAct?'linear-gradient(135deg,var(--accent),var(--accent-2))':'var(--bg-3)',border:`1.5px solid ${isAct?'var(--accent)':'var(--border)'}`,cursor:hasP?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',color:isAct?'#fff':'var(--text-2)',transition:'all .2s'}}>
                          {isAct&&genPlayer.playing?<svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>:<svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
                        </button>
                        <div className="lib-row__info">
                          <div className="lib-row__title">{item.title}</div>
                          <div className="lib-row__sub">{item.style} · {item.key} · {item.bpm} bpm{item.mood?` · ${item.mood}`:''}</div>
                        </div>
                        <div className="lib-row__meta">
                          <span className={`badge ${sc[item.status]||'badge--blue'}`}>{item.status}</span>
                          <span style={{fontSize:'.67rem',color:'var(--text-3)'}}>{fmtDate(item.createdAt)}</span>
                          <button className="btn btn--icon btn--ghost btn--sm lib-row__del" onClick={()=>rm('generations',item.id)}><IconTrash/></button>
                        </div>
                      </div>
                      {chords.length>0&&<div style={{display:'flex',gap:'.22rem',flexWrap:'wrap',paddingLeft:52}}>{chords.map((c,ci)=><div key={ci} style={{padding:'.1rem .38rem',borderRadius:5,fontSize:'.63rem',fontWeight:800,fontFamily:"'Space Mono',monospace",background:isAct&&genPlayer.playing&&genPlayer.curChord===ci?'var(--accent)':'var(--bg-3)',color:isAct&&genPlayer.playing&&genPlayer.curChord===ci?'#fff':'var(--text-2)',transition:'all .15s',border:'1px solid var(--border)'}}>{c}</div>)}</div>}
                      {isAct&&(genPlayer.playing||genPlayer.paused)&&<div style={{height:2,background:'var(--bg-3)',borderRadius:1,overflow:'hidden',marginLeft:52}}><div style={{height:'100%',width:`${genPlayer.progress*100}%`,background:'linear-gradient(90deg,var(--accent),var(--accent-2))',transition:'width .1s linear'}}/></div>}
                    </div>
                  )})}</ColList>
                :<LibEmpty icon="🤖" text="No generated tracks yet" cta="Generate music" to="/generate"/>
            )}

            {/* HISTORY */}
            {activeSection==='history'&&(
              <div>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem' }}>
                  <span style={{ fontWeight:700,fontSize:'.875rem' }}>App History</span>
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
      {playing && <NowPlayingBar playing={playing} paused={paused} progress={progress} elapsed={elapsed} queue={queue} onTogglePause={togglePause} onSeek={seekTo} onNext={playNext} onPrev={playPrev} onStop={stopAll} shuffle={shuffle} onShuffle={toggleShuffle} loopMode={loopMode} onCycleLoop={cycleLoop} muted={muted} onMute={toggleMute} volume={volume} onVolume={setVolumeLevel} onRemoveQ={removeFromQueue}/>}

      {/* Confirm dialog */}
      {confirm && <ConfirmDialog message={confirm.message} detail={confirm.detail} onConfirm={()=>{confirm.onConfirm();setConfirm(null)}} onCancel={()=>setConfirm(null)}/>}

      {/* Modals */}
      {showCreate    && <PlaylistFormModal title="New Playlist" onClose={()=>setShowCreate(false)} onSubmit={createPlaylist}/>}
      {editPlaylist  && <PlaylistFormModal title="Edit Playlist" initial={editPlaylist} onClose={()=>setEditPlaylist(null)} onSubmit={(patch)=>updatePlaylist(editPlaylist.id, patch)}/>}
      {showHistory   && <HistoryModal onClose={()=>setShowHistory(false)}/>}

      <style>{`
        .lib-layout { display:grid; grid-template-columns:210px 1fr; gap:1.4rem; align-items:start; }
        .lib-stat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:.7rem; margin-bottom:1.4rem; }
        .lib-playlist-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(172px,1fr)); gap:.85rem; }
        @media (max-width:760px) {
          .lib-layout { grid-template-columns:1fr; }
          .lib-layout nav[style*="position: sticky"] { position:static; display:flex; flex-wrap:wrap; gap:.2rem; }
          .lib-stat-grid { grid-template-columns:repeat(2,1fr); }
        }
        @media (max-width:420px) {
          .lib-stat-grid { grid-template-columns:1fr; }
          .lib-playlist-grid { grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); }
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
