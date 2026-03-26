import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const STEPS = [
  {
    id: 'welcome',
    emoji: '🎵',
    title: 'Welcome to KalzTunz',
    subtitle: 'Your AI music platform',
    desc: 'KalzTunz combines AI-powered chord extraction, music generation, and a Spotify-connected discovery engine — all in one place.',
    action: null,
    color: 'var(--coral)',
    bg: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,107,71,.15) 0%, transparent 70%)',
    features: [
      { icon: '🎸', text: 'Extract chords from any audio or video' },
      { icon: '🔑', text: 'Detect musical keys automatically' },
      { icon: '🤖', text: 'Generate AI chord progressions' },
      { icon: '🎵', text: 'Discover music powered by Spotify' },
    ],
  },
  {
    id: 'extract',
    emoji: '🎸',
    title: 'Extract Chords',
    subtitle: 'From any audio or video file',
    desc: 'Upload an MP3, WAV, FLAC, or even a video file. KalzTunz analyses it in the background and returns a full chord timeline with key, BPM, and confidence scores.',
    action: { label: 'Try Extraction →', to: '/extract' },
    color: 'var(--amber)',
    bg: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,179,71,.14) 0%, transparent 70%)',
    steps: [
      { n: '1', text: 'Go to the Extract page' },
      { n: '2', text: 'Drop or select an audio file' },
      { n: '3', text: 'Adjust confidence threshold if needed' },
      { n: '4', text: 'Click Extract — results appear live' },
    ],
  },
  {
    id: 'discover',
    emoji: '🔍',
    title: 'Discover Music',
    subtitle: 'Powered by Spotify',
    desc: 'Search millions of real songs, artists, and albums. Browse by mood — happy, chill, epic, focus — and click any artist to see their full profile, albums, and top tracks.',
    action: { label: 'Explore Discover →', to: '/search' },
    color: 'var(--cyan)',
    bg: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,212,200,.12) 0%, transparent 70%)',
    steps: [
      { n: '🎭', text: 'Pick a mood to get curated tracks' },
      { n: '🔍', text: 'Search any song, artist, or album' },
      { n: '👤', text: 'Click an artist to view their profile' },
      { n: '💾', text: 'Save tracks to your library' },
    ],
  },
  {
    id: 'library',
    emoji: '📂',
    title: 'Your Library',
    subtitle: 'Save, organise, and create playlists',
    desc: 'Your personal music hub. Save tracks from Spotify, create playlists, follow artists, and keep all your chord extractions and AI generations in one place.',
    action: { label: 'Open Library →', to: '/library' },
    color: 'var(--red)',
    bg: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(167,139,250,.12) 0%, transparent 70%)',
    steps: [
      { n: '💾', text: 'Save any track from Discover' },
      { n: '📂', text: 'Create custom playlists' },
      { n: '👤', text: 'Follow your favourite artists' },
      { n: '🎸', text: 'Access all your extractions & generations' },
    ],
  },
  {
    id: 'ready',
    emoji: '🚀',
    title: "You're all set!",
    subtitle: 'Start making music',
    desc: "Your KalzTunz account is ready. You can always revisit this tour from Settings → Account, or just dive straight into the music.",
    action: { label: "Let's Go! →", to: '/' },
    color: 'var(--green)',
    bg: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(52,211,153,.12) 0%, transparent 70%)',
    cta_options: [
      { label: '⚡ Extract Chords', to: '/extract', style: 'primary' },
      { label: '🔍 Discover Music', to: '/search',  style: 'cyan' },
      { label: '🤖 Generate',       to: '/generate', style: 'secondary' },
    ],
  },
]

const STORAGE_KEY = 'kalztunz_tutorial_done'

export function useTutorial() {
  // Initialise from localStorage so login()-triggered tutorial works on next render
  const [show, setShow] = useState(() => !localStorage.getItem(STORAGE_KEY) && false)

  // Re-read localStorage whenever it changes (handles login() clearing the key)
  useEffect(() => {
    const check = () => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // Only auto-show if a 'pending_tutorial' flag was set by login
        if (localStorage.getItem('kalztunz_show_tutorial')) {
          localStorage.removeItem('kalztunz_show_tutorial')
          setShow(true)
        }
      }
    }
    check()
    window.addEventListener('storage', check)
    return () => window.removeEventListener('storage', check)
  }, [])

  const markDone  = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
  }, [])

  const startTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setShow(true)
  }, [])

  const triggerAfterSignup = useCallback(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setShow(true)
  }, [])

  return { show, markDone, startTour, triggerAfterSignup }
}

export default function Tutorial({ onDone }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [exiting, setExiting] = useState(false)

  const current = STEPS[step]
  const isLast  = step === STEPS.length - 1

  const advance = (to = null) => {
    setExiting(true)
    setTimeout(() => {
      if (to) { onDone(); navigate(to) }
      else if (isLast) onDone()
      else { setStep(s => s + 1); setExiting(false) }
    }, 250)
  }

  const skip = () => { onDone(); }

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') advance()
      if (e.key === 'ArrowLeft' && step > 0) { setStep(s => s - 1) }
      if (e.key === 'Escape') skip()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [step, isLast])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--overlay)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
      animation: 'fadeIn .25s ease',
    }}>
      <div style={{
        width: '100%', maxWidth: 560,
        background: 'var(--bg-1)',
        border: '1px solid var(--border-hi)',
        borderRadius: 28,
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,.55)',
        animation: 'tutorialIn .35s cubic-bezier(.34,1.2,.64,1)',
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'scale(.96) translateY(8px)' : 'scale(1) translateY(0)',
        transition: 'opacity .25s, transform .25s',
      }}>

        {/* Progress bar */}
        <div style={{height: 3, background: 'var(--bg-3)'}}>
          <div style={{
            height: '100%',
            background: `linear-gradient(90deg, ${current.color}, var(--amber))`,
            width: `${((step + 1) / STEPS.length) * 100}%`,
            transition: 'width .4s ease',
            borderRadius: '0 2px 2px 0',
          }}/>
        </div>

        {/* Step counter + skip */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.5rem .5rem',
        }}>
          <div style={{display:'flex',gap:'.4rem',alignItems:'center'}}>
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => setStep(i)} style={{
                width: i === step ? 20 : 6, height: 6, borderRadius: 3,
                background: i <= step ? current.color : 'var(--border-hi)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'all .25s ease',
              }}/>
            ))}
          </div>
          <button onClick={skip} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 999,
            padding: '.22rem .7rem', fontSize: '.72rem', color: 'var(--text-3)',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all .18s',
          }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--text-3)'; e.target.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-3)' }}
          >
            Skip tour
          </button>
        </div>

        {/* Hero area */}
        <div style={{
          position: 'relative', padding: '2rem 2rem 1.5rem',
          textAlign: 'center', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, background: current.bg, pointerEvents: 'none',
          }}/>
          <div style={{
            fontSize: '3.5rem', marginBottom: '.75rem', position: 'relative',
            animation: 'bounceIn .4s cubic-bezier(.34,1.4,.64,1)',
          }}>
            {current.emoji}
          </div>
          <div style={{
            fontSize: '.72rem', fontWeight: 700, letterSpacing: '.07em',
            textTransform: 'uppercase', color: current.color, marginBottom: '.35rem',
            position: 'relative',
          }}>
            {current.subtitle}
          </div>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(1.4rem, 4vw, 1.85rem)',
            fontWeight: 800, marginBottom: '.65rem', position: 'relative',
            letterSpacing: '-.02em',
          }}>
            {current.title}
          </h2>
          <p style={{
            color: 'var(--text-2)', fontSize: '.875rem',
            lineHeight: 1.7, maxWidth: 400, margin: '0 auto',
            position: 'relative',
          }}>
            {current.desc}
          </p>
        </div>

        {/* Feature list / steps */}
        <div style={{padding: '0 1.75rem 1.25rem'}}>
          {(current.features || current.steps) && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: current.cta_options ? '1fr' : 'repeat(2,1fr)',
              gap: '.5rem',
            }}>
              {(current.features || current.steps).map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '.6rem',
                  padding: '.55rem .75rem',
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 12,
                  animation: `fadeUp .35s ${i * .07}s both`,
                }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                    background: `linear-gradient(135deg, ${current.color}22, ${current.color}11)`,
                    border: `1.5px solid ${current.color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: item.n?.length === 1 && /\d/.test(item.n) ? '.75rem' : '.85rem',
                    fontWeight: 800, color: current.color,
                  }}>
                    {item.icon || item.n}
                  </span>
                  <span style={{fontSize: '.8rem', color: 'var(--text-2)'}}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Final step CTA options */}
          {current.cta_options && (
            <div style={{display:'flex',flexDirection:'column',gap:'.5rem',marginTop:'.75rem'}}>
              {current.cta_options.map(opt => (
                <button key={opt.to}
                  onClick={() => advance(opt.to)}
                  className={`btn btn--${opt.style}`}
                  style={{justifyContent:'center', borderRadius:14}}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.75rem 1.5rem',
          borderTop: '1px solid var(--border)',
        }}>
          <button
            onClick={() => step > 0 && setStep(s => s - 1)}
            disabled={step === 0}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 12,
              padding: '.42rem .9rem', fontSize: '.8rem', color: 'var(--text-2)',
              cursor: step === 0 ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: step === 0 ? .35 : 1, transition: 'all .18s',
            }}
          >
            ← Back
          </button>

          <span style={{fontSize:'.75rem',color:'var(--text-3)'}}>
            {step + 1} of {STEPS.length}
          </span>

          {!current.cta_options && (
            <button
              onClick={() => current.action ? advance(current.action.to) : advance()}
              style={{
                background: `linear-gradient(135deg, ${current.color}, var(--amber))`,
                border: 'none', borderRadius: 12,
                padding: '.52rem 1.2rem', fontSize: '.85rem', fontWeight: 700,
                color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: `0 4px 16px ${current.color}44`,
                transition: 'all .18s',
              }}
              onMouseEnter={e => { e.target.style.filter = 'brightness(1.1)' }}
              onMouseLeave={e => { e.target.style.filter = 'none' }}
            >
              {isLast ? 'Finish' : current.action ? current.action.label : 'Next →'}
            </button>
          )}
        </div>

      </div>

      <style>{`
        @keyframes tutorialIn { from{opacity:0;transform:scale(.88) translateY(24px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes bounceIn   { from{transform:scale(.5) rotate(-10deg);opacity:0} to{transform:scale(1) rotate(0);opacity:1} }
        @keyframes fadeUp     { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
