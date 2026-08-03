import { useRef, useState, useEffect, useCallback } from 'react'
import { IconPlay, IconPause, IconReplay, IconLoop, IconMusicDisc } from './Icons'

const fmt = (s) => {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

/**
 * MediaPlayer
 * props:
 *  - file: a File object (audio or video) — required for local preview
 *  - title: display name shown below the cover
 *  - subtitle: optional small text under the title (size, format, etc.)
 *  - coverSrc: optional explicit cover image URL (overrides the generated placeholder)
 */
export default function MediaPlayer({ file, title, subtitle, coverSrc }) {
  const isVideo = !!file && file.type.startsWith('video/')
  const mediaRef = useRef(null)
  const urlRef   = useRef(null)

  const [url,      setUrl]      = useState(null)
  const [playing,  setPlaying]  = useState(false)
  const [loop,     setLoop]     = useState(false)
  const [duration, setDuration] = useState(0)
  const [current,  setCurrent]  = useState(0)
  const [dragging, setDragging] = useState(false)
  const barRef = useRef(null)

  // Build/revoke object URL whenever the file changes
  useEffect(() => {
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
    setUrl(null); setPlaying(false); setDuration(0); setCurrent(0)
    if (!file) return
    const u = URL.createObjectURL(file)
    urlRef.current = u
    setUrl(u)
    return () => { if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null } }
  }, [file])

  useEffect(() => {
    const el = mediaRef.current
    if (!el) return
    el.loop = loop
  }, [loop, url])

  const onLoadedMeta = () => setDuration(mediaRef.current?.duration || 0)
  const onTimeUpdate = () => { if (!dragging) setCurrent(mediaRef.current?.currentTime || 0) }
  const onEnded = () => { if (!loop) setPlaying(false) }

  const toggle = useCallback(() => {
    const el = mediaRef.current
    if (!el) return
    if (el.paused) { el.play().catch(() => {}); setPlaying(true) }
    else { el.pause(); setPlaying(false) }
  }, [])

  const replay = useCallback(() => {
    const el = mediaRef.current
    if (!el) return
    el.currentTime = 0
    setCurrent(0)
    el.play().catch(() => {})
    setPlaying(true)
  }, [])

  const seekToFraction = useCallback((frac) => {
    const el = mediaRef.current
    if (!el || !duration) return
    const t = Math.max(0, Math.min(frac, 1)) * duration
    el.currentTime = t
    setCurrent(t)
  }, [duration])

  const fractionFromEvent = (e) => {
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    return Math.max(0, Math.min(x / rect.width, 1))
  }

  const onBarDown = (e) => {
    setDragging(true)
    seekToFraction(fractionFromEvent(e))
    const move = (ev) => setCurrent(fractionFromEvent(ev) * duration)
    const up   = (ev) => {
      seekToFraction(fractionFromEvent(ev))
      setDragging(false)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', up)
  }

  const progress = duration ? current / duration : 0
  const progressPct = `${progress * 100}%`

  if (!file) return null

  return (
    <div style={{
      background: 'linear-gradient(160deg,var(--bg-2),var(--bg-3))',
      border: '1px solid var(--border-hi)', borderRadius: 16,
      padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.85rem',
    }}>
      {/* Cover area */}
      <div style={{
        width: '100%', aspectRatio: isVideo ? '16/9' : '1', maxWidth: isVideo ? '100%' : 220,
        margin: isVideo ? 0 : '0 auto', borderRadius: 12, overflow: 'hidden', position: 'relative',
        background: 'linear-gradient(135deg,var(--accent),var(--accent-3))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isVideo ? (
          <video
            ref={mediaRef}
            src={url || undefined}
            preload="metadata"
            playsInline
            onLoadedMetadata={onLoadedMeta}
            onTimeUpdate={onTimeUpdate}
            onEnded={onEnded}
            onClick={toggle}
            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', background: '#000' }}
          />
        ) : (
          <>
            <audio
              ref={mediaRef}
              src={url || undefined}
              preload="metadata"
              onLoadedMetadata={onLoadedMeta}
              onTimeUpdate={onTimeUpdate}
              onEnded={onEnded}
              style={{ display: 'none' }}
            />
            {coverSrc
              ? <img src={coverSrc} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (
                <div style={{ color: 'rgba(255,255,255,.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.4rem' }}>
                  <IconMusicDisc size={44} style={{ animation: playing ? 'kt-spin 3.2s linear infinite' : 'none' }} />
                </div>
              )}
          </>
        )}
        {isVideo && !playing && (
          <button onClick={toggle} aria-label="Play" style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,.28)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}>
            <span style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconPlay size={22} />
            </span>
          </button>
        )}
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: '.72rem', color: 'var(--text-3)', marginTop: '.15rem' }}>{subtitle}</div>}
      </div>

      {/* Seek bar */}
      <div ref={barRef} onMouseDown={onBarDown} onTouchStart={onBarDown}
        style={{ height: 18, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-4)', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: progressPct, borderRadius: 2, background: 'var(--accent)' }} />
          <div style={{
            position: 'absolute', top: '50%', left: progressPct, transform: 'translate(-50%,-50%)',
            width: 13, height: 13, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,.4)',
          }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.66rem', color: 'var(--text-3)', fontFamily: "'JetBrains Mono',monospace", marginTop: '-.5rem' }}>
        <span>{fmt(current)}</span><span>{fmt(duration)}</span>
      </div>

      {/* Transport controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.6rem' }}>
        <button onClick={replay} aria-label="Replay from start" title="Replay"
          style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border-hi)', background: 'var(--bg-1)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <IconReplay size={16} />
        </button>
        <button onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}
          style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 14px rgba(56,189,248,.35)' }}>
          {playing ? <IconPause size={18} /> : <IconPlay size={18} />}
        </button>
        <button onClick={() => setLoop(l => !l)} aria-label="Toggle loop" title={loop ? 'Loop on' : 'Loop off'}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            border: `1px solid ${loop ? 'var(--accent)' : 'var(--border-hi)'}`,
            background: loop ? 'rgba(56,189,248,.14)' : 'var(--bg-1)',
            color: loop ? 'var(--accent)' : 'var(--text-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
          <IconLoop size={16} />
        </button>
      </div>

      <style>{`@keyframes kt-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
