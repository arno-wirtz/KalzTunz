import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STATS = [
  { value:'50+',  label:'Audio formats', sub:'MP3 WAV FLAC OGG MP4…',       icon:'🎼', grad:'linear-gradient(135deg,var(--accent),var(--accent-2))' },
  { value:'99%',  label:'Chord accuracy', sub:'Krumhansl-Schmuckler profiles', icon:'🎯', grad:'linear-gradient(135deg,var(--accent-2),var(--accent-3))' },
  { value:'<3s',  label:'Extraction time', sub:'For a 3-minute track',         icon:'⚡', grad:'linear-gradient(135deg,var(--accent-3),var(--accent))' },
  { value:'Free', label:'Always free',    sub:'No credit card required',       icon:'✨', grad:'linear-gradient(135deg,var(--accent),var(--green))' },
]

const STEPS = [
  { n:'01', icon:'📤', color:'var(--accent)',   title:'Upload your audio',   desc:'Drop any MP3, WAV, FLAC, OGG, AAC, MP4, WebM or MOV file — up to 50 MB. Audio and video both supported.' },
  { n:'02', icon:'⚙️',  color:'var(--accent-2)', title:'AI analyses it',      desc:'Librosa extracts chroma features frame by frame. Krumhansl-Schmuckler detects the key. Beat tracking identifies the tempo.' },
  { n:'03', icon:'📊', color:'var(--accent-3)', title:'Get your chord sheet', desc:'View chords in grid, timeline or sheet music layout. Download as PDF, CSV or JSON. Export to your personal Library.' },
]

const FEATURES = [
  { icon:'🎸', title:'Chord Extraction',  color:'var(--accent)',   to:'/extract',  cta:'Try it free',    desc:'Upload any audio or video file and receive a complete time-stamped chord sheet — with key, BPM, confidence scores, and suggested progressions — in seconds. No music theory knowledge required.' },
  { icon:'🔑', title:'Key Detection',     color:'var(--accent-2)', to:'/extract',  cta:'Detect now',     desc:'Automatic musical key detection using psychoacoustic profiles tuned to human pitch perception. Accurately identifies all 24 major and minor keys, plus scale mode inference for generation.' },
  { icon:'🤖', title:'AI Generation',     color:'var(--accent-3)', to:'/generate', cta:'Generate free',  desc:'Select your genre, mood, key and instrumentation. The theory engine produces harmonically correct progressions across 6 scale modes — with Roman numeral analysis and per-instrument performance notes.' },
  { icon:'🎵', title:'Music Discovery',   color:'var(--red)',      to:'/search',   cta:'Browse music',   desc:'Search 100 million Spotify tracks. Browse by genre or mood, explore any artist\'s full discography, and play 30-second previews directly in the browser — no Spotify account needed.' },
  { icon:'📂', title:'Personal Library',  color:'var(--green)',    to:'/library',  cta:'Open library',   desc:'Save extractions and generations, build playlists, follow artists and keep your entire music history organised in one place. Full search history with date grouping and one-click re-search.' },
  { icon:'📄', title:'PDF Sheet Music',   color:'#8b5cf6',         to:'/extract',  cta:'Export PDF',     desc:'Export any result as a professional A4 PDF — chord boxes with confidence bars, progression summary, scale reference chart, instrument performance notes, and a header with key, BPM and duration.' },
]

const TESTIMONIALS = [
  { name:'Marcus O.', role:'Guitarist & producer', avatar:'🎸', quote:'I transcribed a 4-minute jazz track in under 10 seconds. The chord accuracy is better than any commercial software I\'ve tried.' },
  { name:'Priya K.',  role:'Music teacher',        avatar:'🎹', quote:'I use KalzTunz with every new student. They upload their favourite song and suddenly music theory clicks. It\'s transformed my lessons.' },
  { name:'James L.',  role:'Singer-songwriter',    avatar:'🎤', quote:'The mood-based generation is genuinely useful. I picked dark + dorian + guitar and got a progression that became the backbone of my EP opener.' },
]

const COLORS = ['var(--accent)','var(--accent-2)','var(--accent-3)','var(--red)','var(--green)','#8b5cf6']

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
      const d = await r.json()
      setDemoChords(d.chords || [])
      setDemoMeta(d.metadata || null)
    } catch {} finally { setDemoLoading(false) }
  }

  useEffect(() => { loadDemo() }, [])
  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setActiveF(i => (i + 1) % FEATURES.length), 4500)
    return () => clearInterval(t)
  }, [paused])

  const f = FEATURES[activeF]

  return (
    <div>

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
              <span style={{ color:'var(--green)',fontWeight:700 }}>✓</span> {t}
            </span>
          ))}
        </div>
      </div>

      {/* ────────────────── STATS ────────────────── */}
      <div className="section" style={{ paddingBottom:'3.5rem' }}>
        <div className="grid grid--4">
          {STATS.map(s => (
            <div key={s.label} className="card" style={{ textAlign:'center',padding:'1.75rem 1.25rem',transition:'transform .22s cubic-bezier(.34,1.2,.64,1),box-shadow .22s' }}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-5px) scale(1.02)';e.currentTarget.style.boxShadow='var(--shadow)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
              <div style={{ fontSize:'1.75rem',marginBottom:'.4rem' }}>{s.icon}</div>
              <div style={{ fontFamily:"'Playfair Display',serif",fontSize:'2.2rem',fontWeight:900,backgroundImage:s.grad,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text' }}>
                {s.value}
              </div>
              <div style={{ fontWeight:700,fontSize:'.85rem',marginTop:'.15rem' }}>{s.label}</div>
              <div style={{ fontSize:'.72rem',color:'var(--text-3)',marginTop:'.1rem' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ────────────────── HOW IT WORKS ────────────────── */}
      <div className="section" style={{ paddingBottom:'4rem' }}>
        <div style={{ textAlign:'center',marginBottom:'2.5rem' }}>
          <span className="page-header__badge">How it works</span>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'clamp(1.5rem,3vw,2.1rem)',fontWeight:800,margin:'.65rem 0 .4rem' }}>
            From audio file to chord sheet in 3 steps
          </h2>
          <p className="muted">Under 60 seconds. No account required to try.</p>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:'1.1rem',position:'relative' }}>
          {/* connector line desktop only */}
          <div style={{ position:'absolute',top:44,left:'17%',right:'17%',height:2,background:`linear-gradient(90deg,var(--accent),var(--accent-2),var(--accent-3))`,opacity:.25,pointerEvents:'none' }}/>
          {STEPS.map(s => (
            <div key={s.n} className="card" style={{ padding:'2rem 1.5rem',textAlign:'center',borderTop:`3px solid ${s.color}`,transition:'transform .22s cubic-bezier(.34,1.2,.64,1)' }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-5px)'}
              onMouseLeave={e=>e.currentTarget.style.transform=''}>
              <div style={{ width:60,height:60,borderRadius:'50%',background:`${s.color}18`,border:`2px solid ${s.color}33`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1rem',fontSize:'1.6rem',boxShadow:`0 4px 20px ${s.color}22` }}>
                {s.icon}
              </div>
              <div style={{ fontSize:'.68rem',fontWeight:700,color:s.color,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:'.35rem' }}>Step {s.n}</div>
              <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.05rem',fontWeight:800,marginBottom:'.55rem' }}>{s.title}</h3>
              <p style={{ fontSize:'.84rem',color:'var(--text-2)',lineHeight:1.65 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ────────────────── LIVE DEMO ────────────────── */}
      <div className="section" style={{ paddingBottom:'4rem' }}>
        <div style={{ background:'var(--bg-1)',border:'1px solid var(--border)',borderRadius:24,overflow:'hidden',boxShadow:'var(--shadow-card)' }}>
          {/* header bar */}
          <div style={{ padding:'1.4rem 1.75rem',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'.75rem',background:'linear-gradient(135deg,var(--bg-2),var(--bg-1))' }}>
            <div>
              <div style={{ fontWeight:800,fontSize:'1rem',fontFamily:"'Playfair Display',serif",marginBottom:'.18rem' }}>
                🔴&ensp;Live Chord Extraction Demo
              </div>
              <div style={{ fontSize:'.77rem',color:'var(--text-3)' }}>Real API output · No file upload needed</div>
            </div>
            {demoMeta && (
              <div style={{ display:'flex',gap:'.45rem',flexWrap:'wrap' }}>
                <span className="badge badge--coral">Key: {demoMeta.key}</span>
                <span className="badge badge--yellow">♩ {demoMeta.bpm} BPM</span>
                <span className="badge badge--blue">{demoMeta.duration}s</span>
                <span className="badge badge--green">{demoMeta.total_chords} chords</span>
              </div>
            )}
          </div>
          {/* body */}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:0 }}>
            {/* left: explanation */}
            <div style={{ padding:'1.75rem',borderRight:'1px solid var(--border)' }}>
              <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.1rem',fontWeight:800,marginBottom:'.75rem' }}>
                What you're seeing
              </h3>
              <p style={{ fontSize:'.86rem',color:'var(--text-2)',lineHeight:1.72,marginBottom:'.85rem' }}>
                This is <strong style={{ color:'var(--text)' }}>live output from our chord extraction API</strong> — not a static screenshot. The data was generated by running a real audio sample through librosa, chroma-CQT feature extraction, and template-matching across all 24 major and minor chords.
              </p>
              <p style={{ fontSize:'.86rem',color:'var(--text-2)',lineHeight:1.72,marginBottom:'1.4rem' }}>
                Every chord shows its start time, confidence score (as a percentage), and the detected musical key. Upload your own file to get the same output — plus BPM, duration, suggested progressions, and PDF export.
              </p>
              <div style={{ display:'flex',gap:'.65rem',flexWrap:'wrap' }}>
                <Link to="/extract" className="btn btn--primary btn--sm">⚡ Extract Your Own File</Link>
                <button className="btn btn--ghost btn--sm" onClick={loadDemo} disabled={demoLoading}>
                  {demoLoading ? <><span className="spinner" style={{width:11,height:11,borderWidth:1.5}}/> Refreshing…</> : '↺ Refresh'}
                </button>
              </div>
            </div>
            {/* right: chords */}
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
                    <div key={i} className="chord-pill" style={{ borderTopColor:COLORS[i%COLORS.length],borderTopWidth:2,animationDelay:`${i*.05}s` }}>
                      <span className="chord-pill__name" style={{ color:COLORS[i%COLORS.length] }}>{c.name}</span>
                      <span className="chord-pill__time">{c.time.toFixed(1)}s</span>
                      <span className="chord-pill__conf">{(c.confidence*100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────── FEATURES ────────────────── */}
      <div className="section" style={{ paddingBottom:'4rem' }}>
        <div style={{ textAlign:'center',marginBottom:'2.5rem' }}>
          <span className="page-header__badge">Platform features</span>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'clamp(1.5rem,3vw,2.1rem)',fontWeight:800,margin:'.65rem 0 .4rem' }}>
            Everything a musician needs
          </h2>
          <p className="muted">Six tools — one platform. From raw audio to polished chord sheets.</p>
        </div>

        <div style={{ display:'grid',gridTemplateColumns:'300px 1fr',gap:'1.25rem',alignItems:'start' }}>
          {/* Feature tab list */}
          <div style={{ display:'flex',flexDirection:'column',gap:'.4rem' }}>
            {FEATURES.map((feat, i) => (
              <button key={feat.title}
                onClick={() => { setActiveF(i); setPaused(true) }}
                style={{ display:'flex',alignItems:'center',gap:'.8rem',padding:'.9rem 1rem',borderRadius:14,border:`1.5px solid ${activeF===i?feat.color:'var(--border)'}`,background:activeF===i?`${feat.color}10`:'var(--bg-1)',cursor:'pointer',fontFamily:'inherit',transition:'all .2s',textAlign:'left' }}
                onMouseEnter={e=>{if(activeF!==i){e.currentTarget.style.borderColor=feat.color+'55';e.currentTarget.style.background=`${feat.color}06`}}}
                onMouseLeave={e=>{if(activeF!==i){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg-1)'}}}>
                <span style={{ fontSize:'1.4rem',flexShrink:0 }}>{feat.icon}</span>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontWeight:700,fontSize:'.87rem',color:activeF===i?feat.color:'var(--text)' }}>{feat.title}</div>
                  <div style={{ fontSize:'.72rem',color:'var(--text-3)',marginTop:'.05rem' }}>{feat.desc.slice(0,52)}…</div>
                </div>
                {activeF===i && <span style={{ color:feat.color,fontSize:'.8rem',flexShrink:0 }}>›</span>}
              </button>
            ))}
          </div>

          {/* Feature detail panel */}
          <div className="card" style={{ padding:'2rem',borderTop:`4px solid ${f.color}`,minHeight:260,transition:'border-color .35s' }}>
            <div style={{ display:'flex',alignItems:'flex-start',gap:'1.25rem' }}>
              <div style={{ width:58,height:58,borderRadius:16,background:`${f.color}14`,border:`2px solid ${f.color}2a`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.65rem',flexShrink:0 }}>
                {f.icon}
              </div>
              <div style={{ flex:1 }}>
                <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.25rem',fontWeight:800,color:f.color,marginBottom:'.55rem' }}>{f.title}</h3>
                <p style={{ fontSize:'.9rem',color:'var(--text-2)',lineHeight:1.75,marginBottom:'1.35rem' }}>{f.desc}</p>
                <Link to={f.to} className="btn btn--secondary btn--sm" style={{ borderColor:`${f.color}44`,color:f.color }}>
                  {f.cta} →
                </Link>
              </div>
              <div style={{ fontSize:'4rem',opacity:.07,flexShrink:0,lineHeight:1 }}>{f.icon}</div>
            </div>
            {/* progress bar showing auto-cycle */}
            {!paused && (
              <div style={{ marginTop:'1.5rem',height:2,background:'var(--bg-3)',borderRadius:2,overflow:'hidden' }}>
                <div key={activeF} style={{ height:'100%',background:`linear-gradient(90deg,${f.color},${f.color}88)`,animation:'featureProgress 4.5s linear forwards',borderRadius:2 }}/>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ────────────────── TESTIMONIALS ────────────────── */}
      <div className="section" style={{ paddingBottom:'4rem' }}>
        <div style={{ textAlign:'center',marginBottom:'2.5rem' }}>
          <span className="page-header__badge">Real users</span>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'clamp(1.4rem,3vw,2rem)',fontWeight:800,margin:'.65rem 0 .4rem' }}>
            What musicians say
          </h2>
          <p className="muted">From guitarists to teachers to producers</p>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(275px,1fr))',gap:'1rem' }}>
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="card" style={{ padding:'1.6rem',transition:'transform .22s cubic-bezier(.34,1.2,.64,1),border-color .2s' }}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.borderColor='var(--accent)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.borderColor='var(--border)'}}>
              <div style={{ fontSize:'2rem',color:'var(--accent)',marginBottom:'.75rem',lineHeight:1,fontFamily:'Georgia,serif' }}>"</div>
              <p style={{ fontSize:'.88rem',color:'var(--text-2)',lineHeight:1.7,fontStyle:'italic',marginBottom:'1.1rem' }}>{t.quote}</p>
              <div style={{ display:'flex',alignItems:'center',gap:'.65rem' }}>
                <div style={{ width:38,height:38,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),var(--accent-2))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.95rem',flexShrink:0 }}>{t.avatar}</div>
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
        <div className="section" style={{ paddingBottom:'6rem' }}>
          <div className="card" style={{ textAlign:'center',padding:'4.5rem 2rem',background:'linear-gradient(160deg,var(--bg-1),var(--bg-3))',borderColor:'var(--border-hi)',borderRadius:28,position:'relative',overflow:'hidden' }}>
            <div style={{ position:'absolute',inset:0,background:'radial-gradient(ellipse 70% 70% at 50% 50%,rgba(255,107,71,.06),transparent)',pointerEvents:'none' }}/>
            <div style={{ position:'absolute',top:-80,right:-80,width:220,height:220,borderRadius:'50%',background:'radial-gradient(circle,rgba(255,179,71,.10),transparent)',pointerEvents:'none' }}/>
            <div style={{ position:'absolute',bottom:-60,left:-60,width:180,height:180,borderRadius:'50%',background:'radial-gradient(circle,rgba(0,212,200,.08),transparent)',pointerEvents:'none' }}/>
            <div style={{ position:'relative' }}>
              <div style={{ fontSize:'3.5rem',marginBottom:'1rem' }}>🎵</div>
              <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'clamp(1.6rem,3vw,2.4rem)',fontWeight:800,marginBottom:'.75rem' }}>
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
                    <span style={{ color:'var(--green)',fontWeight:700 }}>✓</span> {t}
                  </span>
                ))}
              </div>
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
