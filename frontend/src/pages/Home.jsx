import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const FEATURES = [
  { icon:'🎸', title:'Chord Extraction',  desc:'Upload any audio or video file. Get a full chord timeline with key, BPM, and confidence scores in seconds.', to:'/extract', cta:'Try it', color:'var(--coral)' },
  { icon:'🔑', title:'Key Detection',     desc:'Automatic musical key identification using Krumhansl-Schmuckler profiles — major and minor modes.', to:'/extract', cta:'Detect Key', color:'var(--amber)' },
  { icon:'🤖', title:'AI Generation',     desc:'Generate chord progressions from any style and mood. AI-tuned to your musical preferences.', to:'/generate', cta:'Generate', color:'var(--cyan)' },
  { icon:'🎵', title:'Discover Music',    desc:'Powered by Spotify — search real songs, artists, albums and listen to 30-second previews.', to:'/search', cta:'Explore', color:'var(--red)' },
  { icon:'📂', title:'Personal Library',  desc:'Save tracks, create playlists, follow artists, and organise all your extractions and generations.', to:'/library', cta:'My Library', color:'var(--green)' },
  { icon:'📊', title:'Live Job Tracking', desc:'Background processing with real-time polling. Upload and go — results appear the moment they are ready.', to:'/extract', cta:'See live', color:'var(--coral)' },
]

const STATS = [
  { value:'50+',  label:'Audio formats',   icon:'🎼' },
  { value:'99%',  label:'Chord accuracy',  icon:'🎯' },
  { value:'<2s',  label:'Response time',   icon:'⚡' },
  { value:'Free', label:'Always free',     icon:'✨' },
]

export default function Home() {
  const { user } = useAuth()
  const [demoChords,  setDemoChords]  = useState([])
  const [demoMeta,    setDemoMeta]    = useState(null)
  const [demoLoading, setDemoLoading] = useState(false)
  const COLORS = ['var(--coral)', 'var(--amber)', 'var(--cyan)', 'var(--red)']

  const loadDemo = async () => {
    setDemoLoading(true)
    try {
      const res  = await fetch(`${API}/api/demo/chords`)
      const data = await res.json()
      setDemoChords(data.chords  || [])
      setDemoMeta(data.metadata  || null)
    } catch {}
    finally { setDemoLoading(false) }
  }

  useEffect(() => { loadDemo() }, [])

  return (
    <div>
      {/* ── HERO ── */}
      <div className="hero">
        <div className="hero-badge fade-up">
          <span style={{display:'inline-flex',alignItems:'center',gap:3}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'var(--coral)',animation:'pulse 2s ease infinite'}}/>
          </span>
          AI Music Platform · Powered by Spotify
        </div>
        <h1 className="hero-title fade-up delay-1">
          Unlock the <em>chord DNA</em><br/>of any song
        </h1>
        <p className="hero-sub fade-up delay-2">
          Extract chords, detect keys, analyse tempo, and generate new music from any audio file — all powered by AI, in seconds.
        </p>
        <div className="hero-actions fade-up delay-3">
          <Link to="/extract"  className="btn btn--primary btn--lg">⚡ Extract Chords</Link>
          <Link to="/search"   className="btn btn--cyan btn--lg">🎵 Discover Music</Link>
          <Link to="/generate" className="btn btn--ghost btn--lg">🤖 Generate</Link>
        </div>
        <div className="hero-scroll-hint fade-up delay-4">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><path d="M12 16l-6-6h12z"/></svg>
          Scroll to explore
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="page" style={{paddingBottom:'2.5rem'}}>
        <div className="grid grid--4 fade-up delay-3">
          {STATS.map(({value,label,icon}) => (
            <div key={label} className="card" style={{textAlign:'center',padding:'1.4rem',borderRadius:20}}>
              <div style={{fontSize:'1.4rem',marginBottom:'.3rem'}}>{icon}</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.9rem',fontWeight:900,background:'linear-gradient(135deg,var(--coral),var(--amber))',-webkit-backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{value}</div>
              <div className="small muted" style={{marginTop:'.15rem'}}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── LIVE DEMO ── */}
      <div className="page" style={{paddingBottom:'3.5rem'}}>
        <div className="card card--glow fade-up" style={{padding:'1.85rem'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:'.75rem'}}>
            <div>
              <h2 style={{fontSize:'1.1rem',fontWeight:800,marginBottom:'.2rem',fontFamily:"'Playfair Display',serif"}}>Live Demo — Chord Extraction</h2>
              <p className="small muted">Real API output · No upload required</p>
            </div>
            {demoMeta && (
              <div style={{display:'flex',gap:'.45rem',flexWrap:'wrap'}}>
                <span className="badge badge--coral">Key: {demoMeta.key}</span>
                <span className="badge badge--yellow">BPM: {demoMeta.bpm}</span>
                <span className="badge badge--blue">{demoMeta.duration}s</span>
                <span className="badge badge--red-soft">{demoMeta.total_chords} chords</span>
              </div>
            )}
          </div>

          {demoLoading ? (
            <div className="flex-center gap-sm muted" style={{padding:'1.5rem 0'}}><span className="spinner"/> Analysing audio…</div>
          ) : (
            <div className="chord-grid">
              {demoChords.map((c, i) => (
                <div key={i} className="chord-pill fade-up" style={{animationDelay:`${i*.05}s`, borderColor: COLORS[i%4]+'55'}}>
                  <span className="chord-pill__name" style={{color:COLORS[i%4]}}>{c.name}</span>
                  <span className="chord-pill__time">{c.time.toFixed(1)}s</span>
                  <span className="chord-pill__conf">{(c.confidence*100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}

          <div style={{marginTop:'1.25rem',display:'flex',gap:'.75rem',flexWrap:'wrap'}}>
            <Link to="/extract" className="btn btn--primary btn--sm">Extract Your Own →</Link>
            <button className="btn btn--ghost btn--sm" onClick={loadDemo} disabled={demoLoading}>↺ Refresh Demo</button>
          </div>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div className="page" style={{paddingBottom:'4rem'}}>
        <div style={{textAlign:'center',marginBottom:'2.5rem'}}>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(1.5rem,3vw,2.2rem)',fontWeight:800,marginBottom:'.4rem'}}>
            Everything you need
          </h2>
          <p className="muted">From raw audio to polished chord sheets — in one platform</p>
        </div>
        <div className="grid grid--3">
          {FEATURES.map((f, i) => (
            <div key={f.title} className={`card card--hover fade-up delay-${(i%3)+1}`}
              style={{padding:'1.75rem',borderTop:`3px solid ${f.color}`,borderRadius:20,position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:0,right:0,width:80,height:80,borderRadius:'0 20px 0 80px',background:f.color,opacity:.07}}/>
              <div style={{fontSize:'2rem',marginBottom:'.85rem'}}>{f.icon}</div>
              <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:'1rem',fontWeight:800,marginBottom:'.4rem'}}>{f.title}</h3>
              <p className="small muted" style={{lineHeight:1.65,marginBottom:'1.1rem'}}>{f.desc}</p>
              <Link to={f.to} className="btn btn--secondary btn--sm" style={{borderColor:f.color+'44',color:f.color}}>{f.cta} →</Link>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      {!user && (
        <div className="page" style={{paddingBottom:'5rem'}}>
          <div className="card fade-up" style={{
            textAlign:'center',padding:'4rem 2rem',
            background:'linear-gradient(135deg,var(--bg-1),var(--bg-3))',
            borderColor:'var(--border-hi)',borderRadius:24,
            position:'relative',overflow:'hidden',
          }}>
            <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255,107,71,.06) 0%, transparent 70%)',pointerEvents:'none'}}/>
            <div style={{fontSize:'3rem',marginBottom:'1rem',position:'relative'}}>🎵</div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'clamp(1.5rem,3vw,2rem)',fontWeight:800,marginBottom:'.6rem',position:'relative'}}>
              Ready to start?
            </h2>
            <p className="muted" style={{maxWidth:420,margin:'0 auto 2rem',lineHeight:1.7,position:'relative'}}>
              Free forever. No credit card required. Sign up with Google or GitHub in under 10 seconds.
            </p>
            <div className="hero-actions" style={{position:'relative'}}>
              <Link to="/register" className="btn btn--primary btn--lg">Create Free Account</Link>
              <Link to="/login"    className="btn btn--ghost btn--lg">Sign In</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
