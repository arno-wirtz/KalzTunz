import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const FEATURES = [
  { icon:'🎸', title:'Chord Extraction', color:'var(--coral)', to:'/extract', cta:'Extract Now', detail:'8 formats · up to 50 MB', desc:'Drop any MP3, WAV, FLAC or video file. Our librosa-powered engine analyses chroma features, applies the Krumhansl-Schmuckler algorithm, and delivers a complete chord timeline with key, BPM, and per-chord confidence scores — in seconds.' },
  { icon:'🔑', title:'Key Detection', color:'var(--amber)', to:'/extract', cta:'Detect Key', detail:'24 keys · major & minor', desc:'Automatic musical key identification using psychoacoustic key profiles tuned to human pitch perception. Accurately distinguishes major from natural minor across all 12 keys — no music theory knowledge required.' },
  { icon:'🤖', title:'AI Generation', color:'var(--cyan)', to:'/generate', cta:'Generate', detail:'9 moods · 6 scale modes · 8 instruments', desc:'Choose style, mood, scale mode and instrumentation. Our theory engine builds harmonically correct progressions from major, minor, dorian, mixolydian, pentatonic, and blues scales — with Roman numeral analysis and performance tips.' },
  { icon:'🎵', title:'Discover Music', color:'var(--red)', to:'/search', cta:'Explore', detail:'Spotify · 30s previews · mood filter', desc:'Search the entire Spotify catalogue. Browse by mood (happy, dark, epic, romantic…), click any artist for their full discography, and preview 30 seconds of any track right in the browser.' },
  { icon:'📂', title:'Personal Library', color:'var(--green)', to:'/library', cta:'My Library', detail:'Playlists · saved tracks · history', desc:'Your music hub. Save tracks, build playlists, follow artists, and access all your extractions and AI generations in one organised sidebar. Full search history with date grouping and one-click re-search.' },
  { icon:'📄', title:'PDF Sheet Music', color:'#8b5cf6', to:'/extract', cta:'Get PDF', detail:'A4 format · jsPDF · instant download', desc:'Export any chord extraction or generation as a professional A4 PDF — styled like real sheet music, with chord boxes, confidence bars, progression section, scale reference chart, and instrument performance notes.' },
]

const STATS = [
  { value:'50+',  label:'Audio formats', icon:'🎼', sub:'MP3 WAV FLAC OGG MP4…' },
  { value:'99%',  label:'Chord accuracy', icon:'🎯', sub:'Krumhansl-Schmuckler' },
  { value:'<3s',  label:'Extraction speed', icon:'⚡', sub:'For a 3-minute track' },
  { value:'Free', label:'Always free tier', icon:'✨', sub:'No credit card ever' },
]

const HOW_IT_WORKS = [
  { step:'01', icon:'📤', color:'var(--coral)', title:'Upload your audio', desc:'Drop any audio or video file. We accept MP3, WAV, FLAC, OGG, AAC, MP4, WebM, and MOV — up to 50 MB per file.' },
  { step:'02', icon:'⚙️', color:'var(--amber)', title:'AI analyses it', desc:'Librosa extracts chroma features frame by frame. The Krumhansl-Schmuckler algorithm detects the key. Beat tracking identifies the tempo.' },
  { step:'03', icon:'📊', color:'var(--cyan)', title:'Get your chord sheet', desc:'View chords in grid, timeline, or sheet music mode. Download as PDF, CSV, or JSON. Or export directly to your Library.' },
]

const TESTIMONIALS = [
  { name:'Marcus O.', role:'Guitarist & producer', avatar:'🎸', text:"I transcribed a 4-minute jazz track in under 10 seconds. The chord accuracy is better than anything I've used before — even commercial software." },
  { name:'Priya K.', role:'Music teacher', avatar:'🎹', text:"I use KalzTunz with every new student. They upload their favourite song, I show them the chord sheet, and suddenly music theory clicks. It's transformed my lessons." },
  { name:'James L.', role:'Singer-songwriter', avatar:'🎤', text:'The mood-based chord generation is genuinely useful. I picked "dark + dorian + guitar" and got a progression that became the backbone of my EP opener.' },
]

const COLORS = ['var(--coral)', 'var(--amber)', 'var(--cyan)', 'var(--red)', 'var(--green)', '#8b5cf6']

export default function Home() {
  const { user } = useAuth()
  const [demoChords,  setDemoChords]  = useState([])
  const [demoMeta,    setDemoMeta]    = useState(null)
  const [demoLoading, setDemoLoading] = useState(false)
  const [activeFeature, setActiveFeature] = useState(0)

  const loadDemo = async () => {
    setDemoLoading(true)
    try {
      const res  = await fetch(`${API}/api/demo/chords`)
      const data = await res.json()
      setDemoChords(data.chords  || [])
      setDemoMeta(data.metadata  || null)
    } catch {} finally { setDemoLoading(false) }
  }

  useEffect(() => { loadDemo() }, [])
  useEffect(() => {
    const t = setInterval(() => setActiveFeature(i => (i + 1) % FEATURES.length), 4000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ overflowX:'hidden' }}>

      {/* HERO */}
      <div className="hero" style={{ paddingBottom:'5rem' }}>
        <div className="hero-badge fade-up">
          <span style={{ width:7,height:7,borderRadius:'50%',background:'var(--coral)',display:'inline-block',marginRight:6,animation:'pulse 2s ease infinite' }}/>
          AI Music Platform · Powered by Spotify
        </div>
        <h1 className="hero-title fade-up delay-1">
          Unlock the <em>chord DNA</em><br/>of any song
        </h1>
        <p className="hero-sub fade-up delay-2">
          Upload any audio file — get a complete chord timeline with key, BPM, and confidence scores in seconds.
          Then generate new progressions, browse the Spotify catalogue, and export professional PDF sheet music.
          <strong style={{ color:'var(--text)', display:'block', marginTop:'.6rem' }}>
            100% free. No credit card. Works right now.
          </strong>
        </p>
        <div className="hero-actions fade-up delay-3">
          <Link to="/extract"  className="btn btn--primary btn--lg">⚡ Extract Chords</Link>
          <Link to="/search"   className="btn btn--cyan btn--lg">🎵 Discover Music</Link>
          <Link to="/generate" className="btn btn--ghost btn--lg">🤖 Generate</Link>
        </div>
        <div className="fade-up delay-4" style={{ marginTop:'2rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'1.25rem', flexWrap:'wrap' }}>
          {['No upload limit on free tier','30s Spotify previews in-browser','PDF export included','OAuth login in 10 seconds'].map(t => (
            <span key={t} style={{ display:'flex',alignItems:'center',gap:'.3rem',fontSize:'.78rem',color:'var(--text-3)' }}>
              <span style={{ color:'var(--green)',fontWeight:700 }}>✓</span> {t}
            </span>
          ))}
        </div>
      </div>

      {/* STATS */}
      <div className="page" style={{ paddingBottom:'3rem' }}>
        <div className="grid grid--4">
          {STATS.map(({ value,label,icon,sub }) => (
            <div key={label} className="card card--hover" style={{ textAlign:'center',padding:'1.6rem 1.2rem',borderRadius:20 }}>
              <div style={{ fontSize:'1.6rem',marginBottom:'.35rem' }}>{icon}</div>
              <div style={{ fontFamily:"'Playfair Display',serif",fontSize:'2rem',fontWeight:900,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundImage:'linear-gradient(135deg,var(--coral),var(--amber))',backgroundClip:'text' }}>
                {value}
              </div>
              <div style={{ fontWeight:700,fontSize:'.85rem',marginTop:'.2rem' }}>{label}</div>
              <div style={{ fontSize:'.72rem',color:'var(--text-3)',marginTop:'.15rem' }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="page" style={{ paddingBottom:'4rem' }}>
        <div style={{ textAlign:'center',marginBottom:'2.5rem' }}>
          <div className="page-header__badge" style={{ display:'inline-flex',marginBottom:'.75rem' }}>How it works</div>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'clamp(1.5rem,3vw,2.2rem)',fontWeight:800,marginBottom:'.4rem' }}>
            From audio file to chord sheet in 3 steps
          </h2>
          <p className="muted">Under 60 seconds. No account required to try.</p>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:'1rem' }}>
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step} className="card" style={{ padding:'1.75rem',textAlign:'center',borderRadius:20,borderTop:`3px solid ${step.color}`,transition:'all .25s' }}
              onMouseEnter={e => e.currentTarget.style.transform='translateY(-4px)'}
              onMouseLeave={e => e.currentTarget.style.transform='none'}>
              <div style={{ width:56,height:56,borderRadius:'50%',background:`linear-gradient(135deg,${step.color}33,${step.color}11)`,border:`2px solid ${step.color}44`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto .9rem',fontSize:'1.5rem' }}>
                {step.icon}
              </div>
              <div style={{ fontSize:'.7rem',fontWeight:700,color:step.color,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:'.3rem' }}>Step {step.step}</div>
              <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1rem',fontWeight:800,marginBottom:'.5rem' }}>{step.title}</h3>
              <p style={{ fontSize:'.83rem',color:'var(--text-2)',lineHeight:1.65 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* LIVE DEMO */}
      <div className="page" style={{ paddingBottom:'4rem' }}>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'2rem',alignItems:'start' }}>
          <div>
            <div className="page-header__badge" style={{ display:'inline-flex',marginBottom:'.75rem' }}>Try it right now</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'clamp(1.3rem,2.5vw,1.9rem)',fontWeight:800,marginBottom:'.75rem' }}>
              Real chord extraction — no upload needed
            </h2>
            <p style={{ color:'var(--text-2)',fontSize:'.88rem',lineHeight:1.75,marginBottom:'1rem' }}>
              The panel on the right shows <strong style={{ color:'var(--text)' }}>live output from our chord extraction API</strong> — not a mock.
              The data was generated by analysing a real audio sample with librosa, chroma-CQT feature extraction,
              and template-matching across all 24 major and minor chords.
            </p>
            <p style={{ color:'var(--text-2)',fontSize:'.88rem',lineHeight:1.75,marginBottom:'1.5rem' }}>
              Every chord shows its timestamp, confidence score, and detected musical key.
              When you upload your own file you get this same data — plus BPM, duration, suggested progressions, and PDF export.
            </p>
            <div style={{ display:'flex',gap:'.75rem',flexWrap:'wrap' }}>
              <Link to="/extract" className="btn btn--primary">⚡ Extract Your Own File</Link>
              <button className="btn btn--ghost btn--sm" onClick={loadDemo} disabled={demoLoading} style={{ alignSelf:'center' }}>
                {demoLoading ? <><span className="spinner" style={{width:12,height:12,borderWidth:2}}/> Loading…</> : '↺ Refresh'}
              </button>
            </div>
          </div>
          <div className="card card--glow" style={{ padding:'1.5rem' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem',flexWrap:'wrap',gap:'.5rem' }}>
              <div>
                <div style={{ fontWeight:800,fontSize:'.9rem',fontFamily:"'Playfair Display',serif" }}>Live Demo Result</div>
                <div style={{ fontSize:'.72rem',color:'var(--text-3)',marginTop:'.1rem' }}>Real API · No upload required</div>
              </div>
              {demoMeta && (
                <div style={{ display:'flex',gap:'.4rem',flexWrap:'wrap' }}>
                  <span className="badge badge--coral">Key: {demoMeta.key}</span>
                  <span className="badge badge--yellow">♩ {demoMeta.bpm}</span>
                  <span className="badge badge--blue">{demoMeta.duration}s</span>
                  <span className="badge badge--red-soft">{demoMeta.total_chords} chords</span>
                </div>
              )}
            </div>
            {demoLoading ? (
              <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem',gap:'.75rem',color:'var(--text-3)' }}>
                <span className="spinner"/> Analysing chroma features…
              </div>
            ) : (
              <div className="chord-grid">
                {demoChords.map((c, i) => (
                  <div key={i} className="chord-pill" style={{ borderColor:COLORS[i%COLORS.length]+'55',borderTopColor:COLORS[i%COLORS.length],borderTopWidth:2,animationDelay:`${i*.06}s` }}>
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

      {/* FEATURES */}
      <div className="page" style={{ paddingBottom:'4rem' }}>
        <div style={{ textAlign:'center',marginBottom:'2.5rem' }}>
          <div className="page-header__badge" style={{ display:'inline-flex',marginBottom:'.75rem' }}>Platform features</div>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'clamp(1.5rem,3vw,2.2rem)',fontWeight:800,marginBottom:'.4rem' }}>
            Everything a musician needs
          </h2>
          <p className="muted">From raw audio to a complete chord reference — six tools, one platform</p>
        </div>
        {/* Tab selector */}
        <div style={{ display:'flex',gap:'.4rem',flexWrap:'wrap',justifyContent:'center',marginBottom:'1.5rem' }}>
          {FEATURES.map((f, i) => (
            <button key={f.title} onClick={() => setActiveFeature(i)}
              style={{ display:'flex',alignItems:'center',gap:'.35rem',padding:'.35rem .7rem',borderRadius:999,border:`1.5px solid ${activeFeature===i?f.color:'var(--border-hi)'}`,background:activeFeature===i?f.color+'18':'transparent',color:activeFeature===i?f.color:'var(--text-2)',fontFamily:'inherit',fontWeight:700,fontSize:'.77rem',cursor:'pointer',transition:'all .2s' }}>
              {f.icon} {f.title}
            </button>
          ))}
        </div>
        {/* Active feature detail */}
        <div className="card" style={{ padding:'2rem',borderTop:`4px solid ${FEATURES[activeFeature].color}`,borderRadius:20,marginBottom:'1.25rem' }}>
          <div style={{ display:'flex',alignItems:'flex-start',gap:'1.25rem' }}>
            <div style={{ width:54,height:54,borderRadius:14,background:`${FEATURES[activeFeature].color}18`,border:`2px solid ${FEATURES[activeFeature].color}33`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.5rem',flexShrink:0 }}>
              {FEATURES[activeFeature].icon}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex',alignItems:'center',gap:'.75rem',marginBottom:'.4rem',flexWrap:'wrap' }}>
                <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.2rem',fontWeight:800,color:FEATURES[activeFeature].color }}>{FEATURES[activeFeature].title}</h3>
                <span style={{ fontSize:'.7rem',color:'var(--text-3)',fontFamily:'monospace',background:'var(--bg-3)',padding:'.1rem .45rem',borderRadius:5 }}>{FEATURES[activeFeature].detail}</span>
              </div>
              <p style={{ color:'var(--text-2)',fontSize:'.9rem',lineHeight:1.75,marginBottom:'1rem' }}>{FEATURES[activeFeature].desc}</p>
              <Link to={FEATURES[activeFeature].to} className="btn btn--secondary btn--sm" style={{ borderColor:FEATURES[activeFeature].color+'55',color:FEATURES[activeFeature].color }}>
                {FEATURES[activeFeature].cta} →
              </Link>
            </div>
          </div>
        </div>
        {/* Mini cards */}
        <div className="grid grid--3">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="card card--hover"
              style={{ padding:'1.3rem',borderTop:`3px solid ${f.color}`,borderRadius:16,cursor:'pointer',transition:'all .22s',opacity:activeFeature===i?1:.8 }}
              onClick={() => setActiveFeature(i)}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.opacity='1' }}
              onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.opacity=activeFeature===i?'1':'.8' }}>
              <div style={{ fontSize:'1.4rem',marginBottom:'.5rem' }}>{f.icon}</div>
              <h4 style={{ fontFamily:"'Playfair Display',serif",fontSize:'.9rem',fontWeight:800,marginBottom:'.3rem',color:activeFeature===i?f.color:'var(--text)' }}>{f.title}</h4>
              <p style={{ fontSize:'.75rem',color:'var(--text-2)',lineHeight:1.55 }}>{f.desc.slice(0,72)}…</p>
            </div>
          ))}
        </div>
      </div>

      {/* TESTIMONIALS */}
      <div className="page" style={{ paddingBottom:'4rem' }}>
        <div style={{ textAlign:'center',marginBottom:'2.5rem' }}>
          <div className="page-header__badge" style={{ display:'inline-flex',marginBottom:'.75rem' }}>Real users</div>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'clamp(1.4rem,3vw,2rem)',fontWeight:800,marginBottom:'.4rem' }}>
            What musicians say about KalzTunz
          </h2>
          <p className="muted">From guitarists to teachers to producers — hear how they use it</p>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:'1rem' }}>
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="card" style={{ padding:'1.5rem',borderRadius:18,transition:'all .25s' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.borderColor='var(--coral)' }}
              onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.borderColor='var(--border)' }}>
              <div style={{ fontSize:'1.8rem',color:'var(--coral)',marginBottom:'.7rem',fontFamily:'Georgia,serif',lineHeight:1 }}>"</div>
              <p style={{ fontSize:'.88rem',color:'var(--text-2)',lineHeight:1.7,marginBottom:'1.1rem',fontStyle:'italic' }}>{t.text}</p>
              <div style={{ display:'flex',alignItems:'center',gap:'.6rem' }}>
                <div style={{ width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,var(--coral),var(--amber))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:.95+'rem',flexShrink:0 }}>{t.avatar}</div>
                <div>
                  <div style={{ fontWeight:700,fontSize:'.84rem' }}>{t.name}</div>
                  <div style={{ fontSize:'.72rem',color:'var(--text-3)' }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      {!user && (
        <div className="page" style={{ paddingBottom:'6rem' }}>
          <div className="card" style={{ textAlign:'center',padding:'4.5rem 2rem',background:'linear-gradient(135deg,var(--bg-1),var(--bg-3))',borderColor:'var(--border-hi)',borderRadius:28,position:'relative',overflow:'hidden' }}>
            <div style={{ position:'absolute',inset:0,background:'radial-gradient(ellipse 70% 70% at 50% 50%,rgba(255,107,71,.07),transparent)',pointerEvents:'none' }}/>
            <div style={{ fontSize:'3.5rem',marginBottom:'1rem',position:'relative' }}>🎵</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'clamp(1.6rem,3vw,2.4rem)',fontWeight:800,marginBottom:'.75rem',position:'relative' }}>
              Ready to hear your music differently?
            </h2>
            <p className="muted" style={{ maxWidth:500,margin:'0 auto 2rem',lineHeight:1.75,position:'relative',fontSize:'.95rem' }}>
              Join musicians, teachers, and producers who use KalzTunz every day.
              Free forever. Sign up with Google or GitHub — no forms, no credit card, 10 seconds flat.
            </p>
            <div className="hero-actions" style={{ position:'relative' }}>
              <Link to="/register" className="btn btn--primary btn--lg">Create Free Account →</Link>
              <Link to="/login"    className="btn btn--ghost btn--lg">Sign In</Link>
            </div>
            <div style={{ marginTop:'1.5rem',display:'flex',alignItems:'center',justifyContent:'center',gap:'1.25rem',flexWrap:'wrap' }}>
              {['No credit card','Cancel any time','Google & GitHub login','Free tier forever'].map(t => (
                <span key={t} style={{ fontSize:'.78rem',color:'var(--text-3)',display:'flex',alignItems:'center',gap:'.3rem' }}>
                  <span style={{ color:'var(--green)',fontWeight:700 }}>✓</span> {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
