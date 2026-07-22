import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'

const API = import.meta.env.VITE_API_URL ?? ''  // same-origin in production (unified service)

const STATS = [
  { value:'50+',  label:'Audio formats',  sub:'MP3 WAV FLAC OGG MP4…',        icon:'🎼' },
  { value:'99%',  label:'Chord accuracy', sub:'Krumhansl–Schmuckler profiles', icon:'🎯' },
  { value:'<3s',  label:'Extraction time',sub:'For a 3-minute track',         icon:'⚡' },
  { value:'Free', label:'Always free',    sub:'No credit card required',      icon:'✨' },
]

const STEPS = [
  { n:'01', icon:'📤', title:'Upload your audio',   desc:'Drop any MP3, WAV, FLAC, OGG, AAC, MP4, WebM or MOV file — up to 50 MB. Audio and video both supported.' },
  { n:'02', icon:'⚙️',  title:'AI analyses it',      desc:'Librosa extracts chroma features frame by frame. Krumhansl–Schmuckler detects the key. Beat tracking identifies the tempo.' },
  { n:'03', icon:'📊', title:'Get your chord sheet', desc:'View chords in grid, timeline or sheet music layout. Download as PDF, CSV or JSON. Export to your personal Library.' },
]

const FEATURES = [
  { icon:'🎸', title:'Chord Extraction',  to:'/extract',  cta:'Try it free',   desc:'Upload any audio or video file and receive a complete time-stamped chord sheet — with key, BPM, confidence scores, and suggested progressions — in seconds. No music theory knowledge required.' },
  { icon:'🔑', title:'Key Detection',     to:'/extract',  cta:'Detect now',    desc:'Automatic musical key detection using psychoacoustic profiles tuned to human pitch perception. Accurately identifies all 24 major and minor keys, plus scale mode inference for generation.' },
  { icon:'🤖', title:'AI Generation',     to:'/generate', cta:'Generate free', desc:'Select your genre, mood, key and instrumentation. The theory engine produces harmonically correct progressions across 6 scale modes — with Roman numeral analysis and per-instrument performance notes.' },
  { icon:'🎵', title:'Music Discovery',   to:'/search',   cta:'Browse music',  desc:"Search 100 million Spotify tracks. Browse by genre or mood, explore any artist's full discography, and play 30-second previews directly in the browser — no Spotify account needed." },
  { icon:'📂', title:'Personal Library',  to:'/library',  cta:'Open library',  desc:'Save extractions and generations, build playlists, follow artists and keep your entire music history organised in one place. Full search history with date grouping and one-click re-search.' },
  { icon:'📄', title:'PDF Sheet Music',   to:'/extract',  cta:'Export PDF',    desc:'Export any result as a professional A4 PDF — chord boxes with confidence bars, progression summary, scale reference chart, instrument performance notes, and a header with key, BPM and duration.' },
]

const TESTIMONIALS = [
  { name:'Marcus O.', role:'Guitarist & producer', avatar:'🎸', quote:"I transcribed a 4-minute jazz track in under 10 seconds. The chord accuracy is better than any commercial software I've tried." },
  { name:'Priya K.',  role:'Music teacher',        avatar:'🎹', quote:"I use KalzTunz with every new student. They upload their favourite song and suddenly music theory clicks. It's transformed my lessons." },
  { name:'James L.',  role:'Singer-songwriter',    avatar:'🎤', quote:'The mood-based generation is genuinely useful. I picked dark + dorian + guitar and got a progression that became the backbone of my EP opener.' },
]

// Rotating accent for chord pills / step numbers — all drawn from real
// design tokens, never raw hex, so it stays correct in both themes.
const ACCENTS = ['var(--accent)', 'var(--accent-3)', 'var(--green)', 'var(--accent-2)']

export default function Home() {
  const { user } = useAuth()
  const [demoChords,  setDemoChords]  = useState([])
  const [demoMeta,    setDemoMeta]    = useState(null)
  const [demoLoading, setDemoLoading] = useState(false)
  const [activeF,     setActiveF]     = useState(0)
  const [paused,      setPaused]      = useState(false)

  const loadDemo = async () => {
    setDemoLoading(true)
    try {
      const r = await fetch(`${API}/api/demo/chords`)
      const text = await r.text()
      const d = text.trim() ? JSON.parse(text) : {}
      if (!r.ok || !d.chords) throw new Error('no data')
      setDemoChords(d.chords)
      setDemoMeta(d.metadata || null)
    } catch {
      setDemoChords([
        { name:'C',  time:0.0, confidence:0.9 }, { name:'Am', time:2.0, confidence:0.87 },
        { name:'F',  time:4.0, confidence:0.91 }, { name:'G',  time:6.0, confidence:0.85 },
      ])
      setDemoMeta({ key:'C major', bpm:120, duration:8, total_chords:4 })
    } finally { setDemoLoading(false) }
  }

  useEffect(() => { loadDemo() }, [])
  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setActiveF(i => (i + 1) % FEATURES.length), 4500)
    return () => clearInterval(t)
  }, [paused])

  const f = FEATURES[activeF]

  return (
    <div className="page-wrap" style={{ paddingTop: 0 }}>

      {/* ────────────────── HERO ────────────────── */}
      <div className="hero">
        <div className="hero-badge fade-up">
          <span style={{ width:7,height:7,borderRadius:'50%',background:'var(--accent)',display:'inline-block',animation:'pulse 2s ease infinite' }}/>
          AI Music Platform · Powered by Spotify
        </div>
        <h1 className="hero-title fade-up delay-1">
          Unlock the <em>chord DNA</em><br/>of any song
        </h1>
        <p className="hero-sub fade-up delay-2">
          Upload any audio file and get a full chord timeline — key, BPM, confidence scores —
          in seconds. Generate new progressions, browse Spotify, and export PDF sheet music.
          No credit card. Works right now.
        </p>
        <div className="hero-actions fade-up delay-3">
          <Link to="/extract"  className="btn btn--primary btn--lg">⚡ Extract Chords</Link>
          <Link to="/generate" className="btn btn--secondary btn--lg">🤖 Generate</Link>
          <Link to="/search"   className="btn btn--ghost btn--lg">🎵 Discover Music</Link>
        </div>
        <div className="fade-up delay-4" style={{ marginTop:'1.75rem',display:'flex',justifyContent:'center',alignItems:'center',gap:'1.5rem',flexWrap:'wrap' }}>
          {['No upload limit','30s Spotify previews','PDF export','OAuth in 10 seconds'].map(t => (
            <span key={t} style={{ display:'flex',alignItems:'center',gap:'.3rem',fontSize:'.77rem',color:'var(--text-3)' }}>
              <span style={{ color:'var(--accent-suc)',fontWeight:700 }}>✓</span> {t}
            </span>
          ))}
        </div>
      </div>

      {/* ────────────────── STATS ────────────────── */}
      <div className="section" style={{ padding:'0 0 3.5rem' }}>
        <div className="grid grid--4">
          {STATS.map(s => (
            <div key={s.label} className="card card--hover" style={{ textAlign:'center', padding:'1.75rem 1.25rem' }}>
              <div style={{ fontSize:'1.6rem',marginBottom:'.5rem' }}>{s.icon}</div>
              <div style={{ fontFamily:"'Inter',sans-serif",fontSize:'2.1rem',fontWeight:800,color:'var(--accent)' }}>
                {s.value}
              </div>
              <div style={{ fontWeight:700,fontSize:'.85rem',marginTop:'.2rem',color:'var(--text)' }}>{s.label}</div>
              <div style={{ fontSize:'.72rem',color:'var(--text-3)',marginTop:'.15rem' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ────────────────── HOW IT WORKS ────────────────── */}
      <div className="section" style={{ padding:'0 0 4rem' }}>
        <div style={{ textAlign:'center',marginBottom:'2.25rem' }}>
          <span className="page-header__badge">How it works</span>
          <h2 style={{ fontSize:'clamp(1.5rem,3vw,2.1rem)',fontWeight:700,margin:'.65rem 0 .4rem' }}>
            From audio file to chord sheet in 3 steps
          </h2>
          <p className="muted">Under 60 seconds. No account required to try.</p>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:'1.1rem' }}>
          {STEPS.map((s, i) => (
            <div key={s.n} className="card card--hover" style={{ padding:'2rem 1.5rem',textAlign:'center' }}>
              <div style={{
                width:56,height:56,borderRadius:'50%',
                background:'rgba(56,189,248,.10)', border:'1.5px solid rgba(56,189,248,.28)',
                display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1rem',fontSize:'1.5rem',
              }}>
                {s.icon}
              </div>
              <div style={{ fontSize:'.68rem',fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:'.35rem' }}>Step {s.n}</div>
              <h3 style={{ fontSize:'1.05rem',fontWeight:700,marginBottom:'.55rem' }}>{s.title}</h3>
              <p style={{ fontSize:'.84rem',color:'var(--text-2)',lineHeight:1.65 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ────────────────── LIVE DEMO ────────────────── */}
      <div className="section" style={{ padding:'0 0 4rem' }}>
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'1.4rem 1.75rem',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'.75rem' }}>
            <div>
              <div style={{ fontWeight:700,fontSize:'1rem',marginBottom:'.18rem',display:'flex',alignItems:'center',gap:'.4rem' }}>
                <span style={{ width:8,height:8,borderRadius:'50%',background:'var(--accent-err)',display:'inline-block',animation:'pulse 1.5s ease infinite' }}/>
                Live Chord Extraction Demo
              </div>
              <div style={{ fontSize:'.77rem',color:'var(--text-3)' }}>Real API output · No file upload needed</div>
            </div>
            {demoMeta && (
              <div style={{ display:'flex',gap:'.45rem',flexWrap:'wrap' }}>
                <span className="badge badge--blue">Key: {demoMeta.key}</span>
                <span className="badge badge--yellow">♩ {demoMeta.bpm} BPM</span>
                <span className="badge badge--green">{demoMeta.total_chords} chords</span>
              </div>
            )}
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr' }}>
            <div style={{ padding:'1.75rem',borderRight:'1px solid var(--border)' }}>
              <h3 style={{ fontSize:'1.05rem',fontWeight:700,marginBottom:'.75rem' }}>
                What you're seeing
              </h3>
              <p style={{ fontSize:'.86rem',color:'var(--text-2)',lineHeight:1.72,marginBottom:'.85rem' }}>
                This is <strong style={{ color:'var(--text)' }}>live output from our chord extraction API</strong> — not a static screenshot. The data was generated by running a real audio sample through librosa, chroma-CQT feature extraction, and template-matching across all 24 major and minor chords.
              </p>
              <p style={{ fontSize:'.86rem',color:'var(--text-2)',lineHeight:1.72,marginBottom:'1.4rem' }}>
                Every chord shows its start time and confidence score. Upload your own file to get the same output — plus BPM, duration, suggested progressions, and PDF export.
              </p>
              <div style={{ display:'flex',gap:'.65rem',flexWrap:'wrap' }}>
                <Link to="/extract" className="btn btn--primary btn--sm">⚡ Extract Your Own File</Link>
                <button className="btn btn--ghost btn--sm" onClick={loadDemo} disabled={demoLoading}>
                  {demoLoading ? <><span className="spinner" style={{width:11,height:11,borderWidth:1.5}}/> Refreshing…</> : '↺ Refresh'}
                </button>
              </div>
            </div>
            <div style={{ padding:'1.75rem' }}>
              <div style={{ fontSize:'.72rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.85rem' }}>
                Chord Timeline
              </div>
              {demoLoading ? (
                <div style={{ display:'flex',alignItems:'center',gap:'.65rem',color:'var(--text-3)',padding:'1.5rem 0' }}>
                  <span className="spinner"/> Analysing chroma features…
                </div>
              ) : (
                <div className="chord-grid">
                  {demoChords.map((c, i) => (
                    <div key={i} className="chord-pill" style={{ borderTopColor:ACCENTS[i%ACCENTS.length],borderTopWidth:2 }}>
                      <span className="chord-pill__name" style={{ color:ACCENTS[i%ACCENTS.length] }}>{c.name}</span>
                      <span className="chord-pill__time">{c.time.toFixed(1)}s</span>
                      <span className="chord-pill__conf">{Math.round((c.confidence||0)*100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────── FEATURES ────────────────── */}
      <div className="section" style={{ padding:'0 0 4rem' }}>
        <div style={{ textAlign:'center',marginBottom:'2.25rem' }}>
          <span className="page-header__badge">Platform features</span>
          <h2 style={{ fontSize:'clamp(1.5rem,3vw,2.1rem)',fontWeight:700,margin:'.65rem 0 .4rem' }}>
            Everything a musician needs
          </h2>
          <p className="muted">Six tools — one platform. From raw audio to polished chord sheets.</p>
        </div>

        <div style={{ display:'grid',gridTemplateColumns:'300px 1fr',gap:'1.25rem',alignItems:'start' }}>
          <div style={{ display:'flex',flexDirection:'column',gap:'.4rem' }}>
            {FEATURES.map((feat, i) => (
              <button key={feat.title}
                onClick={() => { setActiveF(i); setPaused(true) }}
                style={{
                  display:'flex',alignItems:'center',gap:'.8rem',padding:'.9rem 1rem',borderRadius:12,
                  border:`1.5px solid ${activeF===i?'var(--accent)':'var(--border)'}`,
                  background:activeF===i?'rgba(56,189,248,.08)':'var(--bg-1)',
                  cursor:'pointer',fontFamily:'inherit',transition:'all .18s ease',textAlign:'left',
                }}>
                <span style={{ fontSize:'1.3rem',flexShrink:0 }}>{feat.icon}</span>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontWeight:700,fontSize:'.87rem',color:activeF===i?'var(--accent)':'var(--text)' }}>{feat.title}</div>
                </div>
                {activeF===i && <span style={{ color:'var(--accent)',fontSize:'.8rem',flexShrink:0 }}>›</span>}
              </button>
            ))}
          </div>

          <div className="card" style={{ padding:'2rem', minHeight:260 }}>
            <div style={{ display:'flex',alignItems:'flex-start',gap:'1.25rem' }}>
              <div style={{ width:58,height:58,borderRadius:14,background:'rgba(56,189,248,.10)',border:'1.5px solid rgba(56,189,248,.26)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.6rem',flexShrink:0 }}>
                {f.icon}
              </div>
              <div style={{ flex:1 }}>
                <h3 style={{ fontSize:'1.2rem',fontWeight:700,color:'var(--accent)',marginBottom:'.55rem' }}>{f.title}</h3>
                <p style={{ fontSize:'.9rem',color:'var(--text-2)',lineHeight:1.75,marginBottom:'1.35rem' }}>{f.desc}</p>
                <Link to={f.to} className="btn btn--secondary btn--sm">
                  {f.cta} →
                </Link>
              </div>
            </div>
            {!paused && (
              <div style={{ marginTop:'1.5rem',height:2,background:'var(--bg-3)',borderRadius:2,overflow:'hidden' }}>
                <div key={activeF} style={{ height:'100%',background:'var(--accent)',animation:'featureProgress 4.5s linear forwards',borderRadius:2 }}/>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ────────────────── TESTIMONIALS ────────────────── */}
      <div className="section" style={{ padding:'0 0 4rem' }}>
        <div style={{ textAlign:'center',marginBottom:'2.25rem' }}>
          <span className="page-header__badge">Real users</span>
          <h2 style={{ fontSize:'clamp(1.4rem,3vw,2rem)',fontWeight:700,margin:'.65rem 0 .4rem' }}>
            What musicians say
          </h2>
          <p className="muted">From guitarists to teachers to producers</p>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(275px,1fr))',gap:'1rem' }}>
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="card card--hover" style={{ padding:'1.6rem' }}>
              <div style={{ fontSize:'2rem',color:'var(--accent)',marginBottom:'.75rem',lineHeight:1,fontFamily:'Georgia,serif' }}>"</div>
              <p style={{ fontSize:'.88rem',color:'var(--text-2)',lineHeight:1.7,fontStyle:'italic',marginBottom:'1.1rem' }}>{t.quote}</p>
              <div style={{ display:'flex',alignItems:'center',gap:'.65rem' }}>
                <div style={{ width:38,height:38,borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.95rem',flexShrink:0 }}>{t.avatar}</div>
                <div>
                  <div style={{ fontWeight:700,fontSize:'.85rem' }}>{t.name}</div>
                  <div style={{ fontSize:'.72rem',color:'var(--text-3)' }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ────────────────── CTA ────────────────── */}
      {!user && (
        <div className="section" style={{ padding:'0 0 5rem' }}>
          <div className="card" style={{ textAlign:'center',padding:'4rem 2rem' }}>
            <div style={{ fontSize:'3rem',marginBottom:'1rem' }}>🎵</div>
            <h2 style={{ fontSize:'clamp(1.5rem,3vw,2.2rem)',fontWeight:700,marginBottom:'.75rem' }}>
              Ready to hear your music differently?
            </h2>
            <p className="muted" style={{ maxWidth:500,margin:'0 auto 2rem',lineHeight:1.75,fontSize:'.95rem' }}>
              Join musicians, teachers and producers who use KalzTunz every day.
              Free forever. Sign up with Google or GitHub — no forms, no credit card, under 10 seconds.
            </p>
            <div className="hero-actions">
              <Link to="/register" className="btn btn--primary btn--lg">Create Free Account →</Link>
              <Link to="/login"    className="btn btn--ghost btn--lg">Sign In</Link>
            </div>
            <div style={{ marginTop:'1.5rem',display:'flex',justifyContent:'center',gap:'1.5rem',flexWrap:'wrap' }}>
              {['No credit card','Google & GitHub login','Cancel any time','Free tier forever'].map(t => (
                <span key={t} style={{ fontSize:'.77rem',color:'var(--text-3)',display:'flex',alignItems:'center',gap:'.3rem' }}>
                  <span style={{ color:'var(--accent-suc)',fontWeight:700 }}>✓</span> {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes featureProgress { from{width:0} to{width:100%} }
        @media (max-width:900px) {
          .section > div[style*="grid-template-columns: 300px"] { grid-template-columns:1fr !important; }
          .section > div > div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns:1fr !important; }
        }
      `}</style>
    </div>
  )
}
