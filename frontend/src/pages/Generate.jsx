import { useState, useCallback, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/* ── Data ───────────────────────────────────────────────────── */
const GENRES = [
  { id:'pop',       label:'Pop',       icon:'🎤', color:'#f59e0b', desc:'Catchy, radio-friendly' },
  { id:'rock',      label:'Rock',      icon:'🎸', color:'#ef4444', desc:'Power & attitude' },
  { id:'jazz',      label:'Jazz',      icon:'🎷', color:'#d4a017', desc:'Complex harmony' },
  { id:'electronic',label:'Electronic',icon:'🎛️', color:'var(--accent-3)', desc:'Synth & arpeggios' },
  { id:'hip-hop',   label:'Hip-Hop',   icon:'🥁', color:'#8b5cf6', desc:'Groove & rhythm' },
  { id:'classical', label:'Classical', icon:'🎻', color:'#6366f1', desc:'Bach to Beethoven' },
  { id:'country',   label:'Country',   icon:'🤠', color:'#d97706', desc:'Open tunings' },
  { id:'rnb',       label:'R&B',       icon:'💜', color:'#ec4899', desc:'Soul & neo-soul' },
  { id:'ambient',   label:'Ambient',   icon:'🌌', color:'#0ea5e9', desc:'Floating pads' },
  { id:'indie',     label:'Indie',     icon:'🌿', color:'#22c55e', desc:'Dreamy alt-chords' },
]

const GENRE_MOODS = {
  pop:['happy','uplifting','romantic','energetic','calm'],
  rock:['energetic','dark','epic','mysterious','uplifting'],
  jazz:['mysterious','calm','romantic','dark','uplifting'],
  electronic:['energetic','dark','mysterious','epic','calm'],
  'hip-hop':['energetic','dark','mysterious','uplifting','sad'],
  classical:['romantic','epic','calm','mysterious','sad'],
  country:['happy','romantic','sad','uplifting','calm'],
  rnb:['romantic','sad','uplifting','calm','dark'],
  ambient:['calm','mysterious','dark','uplifting','romantic'],
  indie:['sad','mysterious','uplifting','romantic','calm'],
}
const MOOD_META = {
  happy:      { icon:'😊', color:'#f59e0b', desc:'Bright & positive' },
  sad:        { icon:'😢', color:'#7c5ce7', desc:'Melancholic & tender' },
  energetic:  { icon:'⚡', color:'#ef4444', desc:'High-drive intensity' },
  calm:       { icon:'😌', color:'var(--accent-3)', desc:'Peaceful & serene' },
  dark:       { icon:'🌑', color:'#64748b', desc:'Tense & cinematic' },
  romantic:   { icon:'💕', color:'#ec4899', desc:'Warm & expressive' },
  epic:       { icon:'🔥', color:'#dc2626', desc:'Grand & sweeping' },
  mysterious: { icon:'🔮', color:'#8b5cf6', desc:'Ethereal & unexpected' },
  uplifting:  { icon:'🌅', color:'#f97316', desc:'Hopeful & triumphant' },
}
const SCALE_MODES = [
  { id:'major',      label:'Major',      desc:'Bright, resolved, happy' },
  { id:'minor',      label:'Minor',      desc:'Dark, emotional, introspective' },
  { id:'dorian',     label:'Dorian',     desc:'Minor with raised 6th — jazzy' },
  { id:'mixolydian', label:'Mixolydian', desc:'Major with flat 7 — bluesy' },
  { id:'pentatonic', label:'Pentatonic', desc:'5-note — folk & rock staple' },
  { id:'blues',      label:'Blues',      desc:'Pentatonic + flat 5 blue note' },
]
const KEYS     = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const INSTRUMENTS_LIST = [
  { id:'piano',   label:'Piano',      icon:'🎹' },
  { id:'guitar',  label:'Guitar',     icon:'🎸' },
  { id:'bass',    label:'Bass',       icon:'🎸' },
  { id:'strings', label:'Strings',    icon:'🎻' },
  { id:'brass',   label:'Brass/Wind', icon:'🎷' },
  { id:'drums',   label:'Drums',      icon:'🥁' },
  { id:'synth',   label:'Synth',      icon:'🎛️' },
  { id:'vocals',  label:'Vocals',     icon:'🎤' },
]
const VOICE_TYPES = [
  { id:'woman',    label:'Woman',    icon:'👩', desc:'Warm soprano / alto' },
  { id:'man',      label:'Man',      icon:'👨', desc:'Rich tenor / baritone' },
  { id:'baby',     label:'Baby',     icon:'👶', desc:'Light, innocent, high' },
  { id:'angel',    label:'Angel',    icon:'👼', desc:'Ethereal & celestial' },
  { id:'choir',    label:'Choir',    icon:'🎼', desc:'Full SATB harmony' },
  { id:'robot',    label:'Robot',    icon:'🤖', desc:'Vocoder / auto-tune' },
  { id:'falsetto', label:'Falsetto', icon:'🎵', desc:'Breathy high register' },
  { id:'whisper',  label:'Whisper',  icon:'🤫', desc:'Intimate, spoken feel' },
]

/* ── Music theory helpers ────────────────────────────────────── */
const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const SCALE_INT = { major:[0,2,4,5,7,9,11], minor:[0,2,3,5,7,8,10], dorian:[0,2,3,5,7,9,10], mixolydian:[0,2,4,5,7,9,10], pentatonic:[0,2,4,7,9], blues:[0,3,5,6,7,10] }
const CHORD_TY  = { major:['','','m','','','m','dim'], minor:['m','dim','','m','m','',''], dorian:['m','m','','','m','dim',''], mixolydian:['','m','dim','','m','m',''], pentatonic:['','m','m','',''], blues:['m','m','m','','m',''] }
const MOOD_PROG = { happy:[[0,3,4,3],[0,4,5,3]], sad:[[0,5,3,6],[0,3,6,4]], energetic:[[0,4,5,4],[0,3,4,0]], calm:[[0,5,3,4],[0,3,5,4]], dark:[[0,6,3,7],[0,5,6,3]], romantic:[[0,5,3,4],[0,3,5,6]], epic:[[0,7,5,4],[0,5,7,4]], mysterious:[[0,1,5,0],[6,0,5,3]], uplifting:[[0,4,5,3],[0,3,4,5]] }

function buildLocal(root, mode, mood, num) {
  const ri  = CHROMATIC.indexOf(root)
  const int = SCALE_INT[mode] || SCALE_INT.major
  const ty  = CHORD_TY[mode] || CHORD_TY.major
  const sc  = int.map(i => CHROMATIC[(ri+i)%12])
  const tp  = MOOD_PROG[mood] || MOOD_PROG.happy
  return Array.from({length:num}, (_,i) =>
    tp[i%tp.length].map(d => `${sc[d%sc.length]}${ty[d%ty.length]||''}`).join(' — ')
  )
}
function fmtDur(s) { return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}` }

/* ── PDF export ──────────────────────────────────────────────── */
async function exportPDF(params, progs) {
  if (!window.jspdf) await new Promise((res,rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    s.onload = res; s.onerror = rej; document.head.appendChild(s)
  })
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const W=210,M=15; let y=20
  doc.setFillColor(255,107,71); doc.rect(0,0,W,5,'F')
  doc.setFont('times','bold'); doc.setFontSize(22); doc.setTextColor(26,22,18)
  doc.text('KalzTunz Chord Sheet',W/2,y,{align:'center'}); y+=9
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(90,82,72)
  doc.text(`Genre: ${params.genre}  ·  Mood: ${params.mood}  ·  Key: ${params.key} ${params.mode}  ·  BPM: ${params.bpm}`,W/2,y,{align:'center'}); y+=5
  if (params.hasVocals) { doc.text(`Voice type: ${params.voiceType}`,W/2,y,{align:'center'}); y+=5 }
  doc.text(`Duration: ${fmtDur(params.duration)}  ·  ${new Date().toLocaleDateString()}`,W/2,y,{align:'center'}); y+=8
  doc.setDrawColor(224,217,206); doc.line(M,y,W-M,y); y+=7
  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(255,107,71)
  doc.text('CHORD PROGRESSIONS',M,y); y+=7
  const acc=[[255,107,71],[255,179,71],[0,212,200],[232,84,42],[139,92,246],[52,211,153]]
  progs.forEach((prog,pi) => {
    if (y>265){doc.addPage();y=20}
    const ch=prog.split(' — '), cw=(W-M*2)/Math.max(ch.length,1), ch2=20, ac=acc[pi%acc.length]
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(154,146,136)
    doc.text(`Variation ${pi+1}`,M,y); y+=4
    ch.forEach((c,ci) => {
      const x=M+ci*cw
      doc.setFillColor(250,248,244); doc.setDrawColor(...ac)
      doc.roundedRect(x,y,cw-1,ch2,2,2,'FD')
      doc.setFillColor(...ac); doc.roundedRect(x,y,cw-1,2.5,1,1,'F')
      doc.setFont('times','bold'); doc.setFontSize(c.length>3?9:12); doc.setTextColor(26,22,18)
      doc.text(c,x+cw/2-0.5,y+13,{align:'center'})
    }); y+=ch2+5
  })
  doc.setFillColor(255,107,71); doc.rect(0,288,W,4,'F')
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(154,146,136)
  doc.text('© KalzTunz · AI Music Platform',W/2,295,{align:'center'})
  doc.save(`kalztunz_${params.genre}_${params.key}_chords.pdf`)
}

/* ── Walkthrough popup ───────────────────────────────────────── */
const WT = [
  { icon:'🎸', title:'Start with Genre', desc:'Pick your musical style first. Genre shapes which moods, scales and instruments make harmonic sense together.' },
  { icon:'🎭', title:'Choose a Mood',    desc:'Mood sets the emotional tone. Available moods are curated for your genre — no mismatches.' },
  { icon:'🔑', title:'Key & Scale',      desc:'Pick the root note and scale mode. Major = bright; minor = deep; dorian/mixolydian add colour; pentatonic is foolproof.' },
  { icon:'🎛️', title:'Instruments',      desc:'Select instruments for the progression. Choosing Vocals reveals a Voice Type panel — pick your singer character.' },
  { icon:'🎤', title:'Voice Type',       desc:'Woman, Man, Angel, Choir, Robot and more. Each hints at melodic register and style, shown in the PDF performance notes.' },
  { icon:'⚡', title:'Generate!',         desc:'Hit Generate. A local preview appears instantly. The backend then delivers the full theory result. Export PDF when ready.' },
]
function Walkthrough({ onClose }) {
  const [step, setStep] = useState(0)
  const s = WT[step], last = step === WT.length-1
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:900,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem',animation:'fadeIn .18s ease' }} onClick={onClose}>
      <div style={{ width:'100%',maxWidth:460,background:'var(--bg-1)',border:'1px solid var(--border-hi)',borderRadius:24,overflow:'hidden',boxShadow:'0 24px 80px rgba(0,0,0,.6)',animation:'dropIn .28s cubic-bezier(.34,1.2,.64,1)' }} onClick={e=>e.stopPropagation()}>
        {/* progress bar */}
        <div style={{ height:3,background:'var(--bg-3)' }}>
          <div style={{ height:'100%',background:'linear-gradient(90deg,var(--accent),var(--accent-2))',width:`${((step+1)/WT.length)*100}%`,transition:'width .35s ease' }}/>
        </div>
        {/* dots + skip */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'1rem 1.5rem .4rem' }}>
          <div style={{ display:'flex',gap:'.35rem' }}>
            {WT.map((_,i) => (
              <button key={i} onClick={()=>setStep(i)} style={{ width:i===step?18:6,height:6,borderRadius:3,background:i<=step?'var(--accent)':'var(--border-hi)',border:'none',cursor:'pointer',padding:0,transition:'all .22s' }}/>
            ))}
          </div>
          <button onClick={onClose} style={{ background:'none',border:'1px solid var(--border)',borderRadius:999,padding:'.18rem .6rem',cursor:'pointer',fontSize:'.72rem',color:'var(--text-3)',fontFamily:'inherit' }}>Skip tour</button>
        </div>
        {/* content */}
        <div style={{ padding:'1.25rem 2rem 1.75rem',textAlign:'center' }}>
          <div key={step} style={{ fontSize:'2.75rem',marginBottom:'.7rem',animation:'bounceIn .35s cubic-bezier(.34,1.4,.64,1)' }}>{s.icon}</div>
          <div style={{ fontSize:'.68rem',fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:'.3rem' }}>{step+1} / {WT.length}</div>
          <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.25rem',fontWeight:800,marginBottom:'.6rem' }}>{s.title}</h3>
          <p style={{ color:'var(--text-2)',fontSize:'.875rem',lineHeight:1.7 }}>{s.desc}</p>
        </div>
        {/* nav */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.85rem 1.5rem 1.4rem',borderTop:'1px solid var(--border)' }}>
          <button disabled={step===0} onClick={()=>setStep(s=>s-1)} style={{ background:'none',border:'1px solid var(--border)',borderRadius:10,padding:'.4rem .85rem',cursor:step===0?'default':'pointer',opacity:step===0?.35:1,fontFamily:'inherit',fontSize:'.8rem',color:'var(--text-2)' }}>← Back</button>
          <span style={{ fontSize:'.72rem',color:'var(--text-3)' }}>{step+1} of {WT.length}</span>
          {last
            ? <button onClick={onClose} style={{ background:'linear-gradient(135deg,var(--accent),var(--accent-2))',border:'none',borderRadius:10,padding:'.45rem 1.25rem',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.85rem',color:'#fff' }}>Let's create! 🎵</button>
            : <button onClick={()=>setStep(s=>s+1)} style={{ background:'linear-gradient(135deg,var(--accent),var(--accent-2))',border:'none',borderRadius:10,padding:'.45rem 1.25rem',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.85rem',color:'#fff' }}>Next →</button>
          }
        </div>
      </div>
    </div>
  )
}

/* ── Step pill ───────────────────────────────────────────────── */
function Step({ n, label, active, done, color, onClick }) {
  return (
    <button onClick={onClick} style={{ display:'flex',alignItems:'center',gap:'.42rem',padding:'.32rem .72rem',borderRadius:999,background:active?`${color}14`:done?'rgba(52,211,153,.08)':'var(--bg-3)',border:`1.5px solid ${active?color:done?'var(--green)':'var(--border)'}`,transition:'all .2s',cursor:'pointer',fontFamily:'inherit' }}>
      <div style={{ width:19,height:19,borderRadius:'50%',background:active?color:done?'var(--green)':'var(--bg-4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.66rem',fontWeight:800,color:active||done?'#fff':'var(--text-3)',flexShrink:0 }}>
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize:'.73rem',fontWeight:700,color:active?color:done?'var(--green)':'var(--text-3)',whiteSpace:'nowrap' }}>{label}</span>
    </button>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function Generate() {
  const { user } = useAuth()

  // Selections
  const [genre,         setGenre]         = useState(null)
  const [mood,          setMood]          = useState(null)
  const [key,           setKey]           = useState('C')
  const [scaleMode,     setScaleMode]     = useState('major')
  const [instruments,   setInstruments]   = useState([])
  const [voiceType,     setVoiceType]     = useState('woman')
  const [bpm,           setBpm]           = useState(120)
  const [duration,      setDuration]      = useState(120)
  const [numVariations, setNumVariations] = useState(3)

  // UI
  const [wiz,        setWiz]      = useState(1)
  const [showWalk,   setShowWalk] = useState(false)
  const [loading,    setLoading]  = useState(false)
  const [result,     setResult]   = useState(null)
  const [error,      setError]    = useState(null)
  const [jobStatus,  setJobStatus]= useState(null)
  const [pdfLoading, setPdfLoad]  = useState(false)
  const [view,       setView]     = useState('progressions')

  const pollRef = useRef(null)
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const hasVocals = instruments.includes('vocals')
  const canGen    = !!(genre && mood && instruments.length > 0)
  const gObj      = GENRES.find(g => g.id === genre)
  const mObj      = mood ? MOOD_META[mood] : null
  const avMoods   = genre ? GENRE_MOODS[genre] || Object.keys(MOOD_META) : Object.keys(MOOD_META)

  const toggleInstrument = useCallback(id =>
    setInstruments(p => p.includes(id) ? p.filter(i=>i!==id) : [...p,id])
  , [])

  const pollJob = useCallback(jobId => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/jobs/${jobId}`)
        const d = await r.json()
        setJobStatus(d.status)
        if (d.status === 'finished') { clearInterval(pollRef.current); setLoading(false); applyResult(d.result) }
        else if (d.status === 'failed') { clearInterval(pollRef.current); setLoading(false); setError(d.error || 'Generation failed') }
      } catch(e) { console.error(e) }
    }, 1500)
  }, [])

  const applyResult = useCallback(r => {
    if (!r) return
    const progs = (r.progressions||[]).map(p => typeof p==='string'?p:(p.display||p.chords?.join(' — ')||''))
    const sRef  = r.scale_reference || []
    setResult(prev => ({
      ...(prev||{}),
      genre: r.style||genre, mood: r.mood||mood, key: r.root_note||key, mode: r.scale_mode||scaleMode,
      bpm: r.bpm||Number(bpm), duration: r.duration||Number(duration),
      instruments: r.instruments||instruments, voiceType,
      progressions: progs, richProgs: r.progressions||[],
      scaleNotes: sRef.map(s=>s.note||''), scaleRef: sRef,
      instrNotes: r.instrument_notes||{}, isLocal: false,
    }))
  }, [genre,mood,key,scaleMode,bpm,duration,instruments,voiceType])

  const handleGenerate = async () => {
    if (!canGen) return
    setLoading(true); setError(null); setJobStatus(null)
    // Instant local preview
    const localProgs = buildLocal(key, scaleMode, mood, numVariations)
    const ri = CHROMATIC.indexOf(key)
    const sn = (SCALE_INT[scaleMode]||SCALE_INT.major).map(i=>CHROMATIC[(ri+i)%12])
    setResult({ genre, mood, key, mode:scaleMode, bpm:Number(bpm), duration:Number(duration), instruments, voiceType, progressions:localProgs, richProgs:[], scaleNotes:sn, scaleRef:[], instrNotes:{}, isLocal:true })
    try {
      const fd = new FormData()
      fd.append('root_note', key); fd.append('scale_mode', scaleMode); fd.append('mood', mood)
      fd.append('style', genre); fd.append('bpm', String(bpm)); fd.append('duration', String(duration))
      fd.append('instruments', JSON.stringify(hasVocals?[...instruments,`voice:${voiceType}`]:instruments))
      fd.append('num_variations', String(numVariations))
      const res = await fetch(`${API}/api/generate`,{method:'POST',body:fd})
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail||'Generation failed')
      setJobStatus(data.status)
      if (data.mode==='sync'&&data.result) { setLoading(false); applyResult(data.result); return }
      pollJob(data.job_id)
    } catch(e) { setLoading(false); setError(`Showing local preview — backend: ${e.message}`) }
  }

  const handlePDF = async () => {
    if (!result) return; setPdfLoad(true)
    try { await exportPDF({genre,mood,key,mode:scaleMode,bpm,duration,instruments,hasVocals,voiceType}, result.progressions) }
    catch(e) { setError('PDF failed.') } finally { setPdfLoad(false) }
  }

  const COLORS = ['var(--accent)','var(--accent-2)','var(--accent-3)','var(--red)','var(--green)','#8b5cf6']

  return (
    <div className="page-wrap" style={{ paddingTop:'1.75rem' }}>
      {showWalk && <Walkthrough onClose={()=>setShowWalk(false)}/>}

      {/* ── Header ── */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'1rem',marginBottom:'1.5rem',flexWrap:'wrap' }}>
        <div>
          <div className="page-header__badge" style={{ marginBottom:'.45rem' }}>🤖 AI Generation</div>
          <h1 style={{ fontFamily:"'Playfair Display',serif",fontSize:'clamp(1.5rem,3vw,2rem)',fontWeight:800,marginBottom:'.3rem' }}>Generate Chord Progressions</h1>
          <p style={{ color:'var(--text-2)',fontSize:'.875rem' }}>Pick your genre first — settings adapt to your choice. Follow the steps below.</p>
        </div>
        <button onClick={()=>setShowWalk(true)} style={{ display:'flex',alignItems:'center',gap:'.4rem',padding:'.4rem .9rem',borderRadius:11,border:'1.5px solid var(--border-hi)',background:'var(--bg-2)',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.8rem',color:'var(--text-2)',transition:'all .2s',flexShrink:0 }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-hi)';e.currentTarget.style.color='var(--text-2)'}}>
          ❓ How to use
        </button>
      </div>

      {/* ── Step breadcrumb ── */}
      <div style={{ display:'flex',gap:'.38rem',flexWrap:'wrap',marginBottom:'1.75rem',alignItems:'center' }}>
        {[{n:1,label:'Genre',color:'var(--accent)',done:!!genre,active:wiz===1},{n:2,label:'Mood',color:'var(--accent-2)',done:!!mood,active:wiz===2},{n:3,label:'Key & Scale',color:'var(--accent-3)',done:wiz>3,active:wiz===3},{n:4,label:'Instruments',color:'#e87a30',done:wiz>4&&instruments.length>0,active:wiz===4},{n:5,label:'Parameters',color:'var(--green)',done:false,active:wiz===5}].map((s,i,arr) => (
          <span key={s.n} style={{ display:'flex',alignItems:'center',gap:'.28rem' }}>
            <Step {...s} onClick={()=>setWiz(s.n)}/>
            {i<arr.length-1 && <span style={{ color:'var(--border-hi)',fontSize:'.8rem' }}>›</span>}
          </span>
        ))}
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 380px',gap:'1.4rem',alignItems:'start' }}>

        {/* LEFT: Steps */}
        <div style={{ display:'flex',flexDirection:'column',gap:'1.1rem' }}>

          {/* STEP 1 — Genre */}
          <div className="card" style={{ padding:'1.5rem',borderTop:`3px solid ${wiz===1?'var(--accent)':'var(--border)'}`,transition:'border-color .3s' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.1rem',flexWrap:'wrap',gap:'.5rem' }}>
              <div>
                <div style={{ fontWeight:800,fontSize:'1rem',fontFamily:"'Playfair Display',serif" }}>
                  <span style={{ color:'var(--accent)',marginRight:'.35rem' }}>①</span>Genre
                </div>
                <div style={{ fontSize:'.76rem',color:'var(--text-3)',marginTop:'.08rem' }}>What musical world are you creating in?</div>
              </div>
              {gObj && <span className="badge badge--coral">{gObj.icon} {gObj.label}</span>}
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:'.5rem' }}>
              {GENRES.map(g => (
                <button key={g.id} onClick={()=>{setGenre(g.id);setMood(null);setWiz(2)}}
                  style={{ display:'flex',flexDirection:'column',alignItems:'flex-start',padding:'.75rem .85rem',borderRadius:12,border:`2px solid ${genre===g.id?g.color:'var(--border)'}`,background:genre===g.id?`${g.color}12`:'var(--bg-2)',cursor:'pointer',fontFamily:'inherit',transition:'all .2s',textAlign:'left' }}
                  onMouseEnter={e=>{if(genre!==g.id){e.currentTarget.style.borderColor=g.color+'66';e.currentTarget.style.background=`${g.color}07`}}}
                  onMouseLeave={e=>{if(genre!==g.id){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg-2)'}}}>
                  <span style={{ fontSize:'1.35rem',marginBottom:'.3rem' }}>{g.icon}</span>
                  <span style={{ fontWeight:700,fontSize:'.83rem',color:genre===g.id?g.color:'var(--text)' }}>{g.label}</span>
                  <span style={{ fontSize:'.67rem',color:'var(--text-3)',marginTop:'.06rem',lineHeight:1.35 }}>{g.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* STEP 2 — Mood (only when genre picked) */}
          {genre && (
            <div className="card" style={{ padding:'1.5rem',borderTop:`3px solid ${wiz===2?'var(--accent-2)':'var(--border)'}`,transition:'border-color .3s',animation:'fadeUp .28s ease' }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.1rem',flexWrap:'wrap',gap:'.5rem' }}>
                <div>
                  <div style={{ fontWeight:800,fontSize:'1rem',fontFamily:"'Playfair Display',serif" }}>
                    <span style={{ color:'var(--accent-2)',marginRight:'.35rem' }}>②</span>Mood
                    <span style={{ fontWeight:400,fontSize:'.74rem',color:'var(--text-3)',marginLeft:'.5rem' }}>for {gObj?.label}</span>
                  </div>
                  <div style={{ fontSize:'.76rem',color:'var(--text-3)',marginTop:'.08rem' }}>Sets the emotional tone and progression pattern</div>
                </div>
                {mObj && <span style={{ fontSize:'.82rem',fontWeight:700,color:mObj.color }}>{mObj.icon} {mood}</span>}
              </div>
              <div style={{ display:'flex',flexWrap:'wrap',gap:'.5rem' }}>
                {avMoods.map(m => {
                  const mt = MOOD_META[m]
                  return (
                    <button key={m} onClick={()=>{setMood(m);setWiz(3)}}
                      style={{ display:'flex',alignItems:'center',gap:'.45rem',padding:'.55rem .9rem',borderRadius:12,border:`2px solid ${mood===m?mt.color:'var(--border)'}`,background:mood===m?`${mt.color}14`:`${mt.color}08`,cursor:'pointer',fontFamily:'inherit',transition:'all .2s' }}
                      onMouseEnter={e=>{if(mood!==m){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.borderColor=mt.color+'55'}}}
                      onMouseLeave={e=>{if(mood!==m){e.currentTarget.style.transform='';e.currentTarget.style.borderColor='var(--border)'}}}>
                      <span style={{ fontSize:'1.15rem' }}>{mt.icon}</span>
                      <div>
                        <div style={{ fontWeight:700,fontSize:'.8rem',color:mood===m?mt.color:'var(--text)',textTransform:'capitalize' }}>{m}</div>
                        <div style={{ fontSize:'.62rem',color:'var(--text-3)' }}>{mt.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 3 — Key & Scale */}
          {genre && mood && (
            <div className="card" style={{ padding:'1.5rem',borderTop:`3px solid ${wiz===3?'var(--accent-3)':'var(--border)'}`,transition:'border-color .3s',animation:'fadeUp .28s ease' }}>
              <div style={{ fontWeight:800,fontSize:'1rem',fontFamily:"'Playfair Display',serif",marginBottom:'.2rem' }}>
                <span style={{ color:'var(--accent-3)',marginRight:'.35rem' }}>③</span>Key &amp; Scale
              </div>
              <div style={{ fontSize:'.76rem',color:'var(--text-3)',marginBottom:'1.1rem' }}>Root note + scale mode define every chord in the progression</div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.1rem' }}>
                <div>
                  <div className="form-label" style={{ marginBottom:'.5rem' }}>Root Note — <span style={{ color:'var(--accent-3)',fontWeight:700 }}>{key}</span></div>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:'.32rem' }}>
                    {KEYS.map(k => (
                      <button key={k} onClick={()=>{setKey(k);setWiz(3)}}
                        style={{ width:36,height:36,borderRadius:9,border:`2px solid ${key===k?'var(--accent-3)':'var(--border)'}`,background:key===k?'rgba(0,212,200,.12)':'var(--bg-2)',color:key===k?'var(--accent-3)':'var(--text)',fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:'.8rem',cursor:'pointer',transition:'all .16s' }}>
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="form-label" style={{ marginBottom:'.5rem' }}>Scale Mode — <span style={{ color:'var(--accent-3)',fontWeight:700,textTransform:'capitalize' }}>{scaleMode}</span></div>
                  <div style={{ display:'flex',flexDirection:'column',gap:'.32rem' }}>
                    {SCALE_MODES.map(s => (
                      <button key={s.id} onClick={()=>{setScaleMode(s.id);setWiz(4)}}
                        style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.42rem .7rem',borderRadius:9,border:`1.5px solid ${scaleMode===s.id?'var(--accent-3)':'var(--border)'}`,background:scaleMode===s.id?'rgba(0,212,200,.08)':'var(--bg-2)',cursor:'pointer',fontFamily:'inherit',transition:'all .16s',textAlign:'left' }}>
                        <div>
                          <span style={{ fontWeight:700,fontSize:'.8rem',color:scaleMode===s.id?'var(--accent-3)':'var(--text)' }}>{s.label}</span>
                          <span style={{ fontSize:'.67rem',color:'var(--text-3)',marginLeft:'.4rem' }}>{s.desc}</span>
                        </div>
                        {scaleMode===s.id && <span style={{ color:'var(--accent-3)',fontSize:'.75rem' }}>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 — Instruments */}
          {genre && mood && (
            <div className="card" style={{ padding:'1.5rem',borderTop:`3px solid ${wiz===4?'#e87a30':'var(--border)'}`,transition:'border-color .3s',animation:'fadeUp .28s ease' }}>
              <div style={{ fontWeight:800,fontSize:'1rem',fontFamily:"'Playfair Display',serif",marginBottom:'.2rem' }}>
                <span style={{ color:'#e87a30',marginRight:'.35rem' }}>④</span>Instrumentation
                <span style={{ fontWeight:400,fontSize:'.74rem',color:'var(--text-3)',marginLeft:'.5rem' }}>{instruments.length} selected</span>
              </div>
              <div style={{ fontSize:'.76rem',color:'var(--text-3)',marginBottom:'1rem' }}>Choose the instruments — selecting Vocals reveals voice type options below</div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:'.48rem' }}>
                {INSTRUMENTS_LIST.map(inst => (
                  <button key={inst.id} onClick={()=>{toggleInstrument(inst.id);setWiz(4)}}
                    style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:'.3rem',padding:'.7rem .5rem',borderRadius:12,border:`2px solid ${instruments.includes(inst.id)?'#e87a30':'var(--border)'}`,background:instruments.includes(inst.id)?'rgba(232,122,48,.1)':'var(--bg-2)',cursor:'pointer',fontFamily:'inherit',transition:'all .2s' }}
                    onMouseEnter={e=>{if(!instruments.includes(inst.id)){e.currentTarget.style.borderColor='#e87a3066';e.currentTarget.style.transform='translateY(-2px)'}}}
                    onMouseLeave={e=>{if(!instruments.includes(inst.id)){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform=''}}}>
                    <span style={{ fontSize:'1.35rem' }}>{inst.icon}</span>
                    <span style={{ fontSize:'.77rem',fontWeight:700,color:instruments.includes(inst.id)?'#e87a30':'var(--text)' }}>{inst.label}</span>
                    {instruments.includes(inst.id) && <span style={{ fontSize:'.58rem',color:'#e87a30' }}>✓</span>}
                  </button>
                ))}
              </div>

              {/* Voice type — only when vocals selected */}
              {hasVocals && (
                <div style={{ marginTop:'1.1rem',paddingTop:'1rem',borderTop:'1px solid var(--border)',animation:'fadeUp .22s ease' }}>
                  <div style={{ fontWeight:700,fontSize:'.875rem',marginBottom:'.65rem',display:'flex',alignItems:'center',gap:'.42rem' }}>
                    🎤 Voice Type
                    <span style={{ fontWeight:400,fontSize:'.72rem',color:'var(--text-3)' }}>Only for songs with a singer</span>
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(105px,1fr))',gap:'.42rem' }}>
                    {VOICE_TYPES.map(v => (
                      <button key={v.id} onClick={()=>setVoiceType(v.id)}
                        style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:'.22rem',padding:'.58rem .4rem',borderRadius:10,border:`2px solid ${voiceType===v.id?'var(--red)':'var(--border)'}`,background:voiceType===v.id?'rgba(232,54,93,.1)':'var(--bg-2)',cursor:'pointer',fontFamily:'inherit',transition:'all .18s' }}>
                        <span style={{ fontSize:'1.2rem' }}>{v.icon}</span>
                        <span style={{ fontSize:'.75rem',fontWeight:700,color:voiceType===v.id?'var(--red)':'var(--text)' }}>{v.label}</span>
                        <span style={{ fontSize:'.6rem',color:'var(--text-3)',textAlign:'center',lineHeight:1.3 }}>{v.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5 — Parameters */}
          {genre && mood && (
            <div className="card" style={{ padding:'1.5rem',borderTop:`3px solid ${wiz===5?'var(--green)':'var(--border)'}`,animation:'fadeUp .28s ease' }}>
              <div style={{ fontWeight:800,fontSize:'1rem',fontFamily:"'Playfair Display',serif",marginBottom:'.2rem' }}>
                <span style={{ color:'var(--green)',marginRight:'.35rem' }}>⑤</span>Parameters
              </div>
              <div style={{ fontSize:'.76rem',color:'var(--text-3)',marginBottom:'1rem' }}>Fine-tune tempo, length and number of variations</div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1rem' }}>
                {[
                  { label:`BPM — ${bpm}`, min:60, max:220, step:1, val:bpm, set:v=>{setBpm(v);setWiz(5)}, hint:'Tempo' },
                  { label:`Duration — ${fmtDur(duration)}`, min:30, max:300, step:10, val:duration, set:v=>{setDuration(v);setWiz(5)}, hint:'Song length' },
                  { label:`Variations — ${numVariations}`, min:1, max:6, step:1, val:numVariations, set:v=>setNumVariations(Number(v)), hint:'Progressions' },
                ].map(p => (
                  <div key={p.label} className="form-group">
                    <label className="form-label">{p.label}</label>
                    <input type="range" min={p.min} max={p.max} step={p.step} value={p.val} onChange={e=>p.set(e.target.value)}/>
                    <span className="form-hint">{p.hint}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate button */}
          <button className="btn btn--primary" onClick={handleGenerate} disabled={loading||!canGen}
            style={{ padding:'.9rem',fontSize:'1rem',justifyContent:'center',borderRadius:16,opacity:canGen?1:.45 }}>
            {loading
              ? <><span className="spinner" style={{width:16,height:16,borderWidth:2}}/> {jobStatus==='queued'?'Queued…':'Generating…'}</>
              : canGen ? '🎵 Generate Progressions' : `Complete steps ${!genre?'① ':''} ${!mood?'② ':''} ${!instruments.length?'④ ':''}above`
            }
          </button>

          {error   && <div className="alert alert--warn" style={{ fontSize:'.82rem' }}>{error}</div>}
          {jobStatus && !['finished','failed'].includes(jobStatus) && (
            <div style={{ display:'flex',alignItems:'center',gap:'.55rem',padding:'.6rem 1rem',background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:12 }}>
              <span className="spinner" style={{width:11,height:11,borderWidth:2,flexShrink:0}}/>
              <span style={{ fontSize:'.8rem',color:'var(--text-2)' }}>{jobStatus==='queued'?'Job queued — worker picking up…':'Running theory engine…'}</span>
            </div>
          )}
        </div>

        {/* RIGHT: Summary + Results (sticky) */}
        <div style={{ display:'flex',flexDirection:'column',gap:'1rem',position:'sticky',top:80 }}>

          {/* Summary */}
          <div className="card" style={{ padding:'1.25rem' }}>
            <div style={{ fontWeight:800,fontSize:'.92rem',fontFamily:"'Playfair Display',serif",marginBottom:'.85rem' }}>Your Selection</div>
            <div style={{ display:'flex',flexDirection:'column',gap:'.42rem' }}>
              {[
                { label:'Genre',       val: gObj ? `${gObj.icon} ${gObj.label}` : '—',                         color: gObj?.color },
                { label:'Mood',        val: mObj ? `${mObj.icon} ${mood}` : '—',                               color: mObj?.color },
                { label:'Key',         val: `${key} ${scaleMode}`,                                              color:'var(--accent-3)' },
                { label:'Instruments', val: instruments.length ? instruments.join(', ') : '—',                  color:'#e87a30' },
                ...(hasVocals ? [{label:'Voice', val:`${VOICE_TYPES.find(v=>v.id===voiceType)?.icon} ${voiceType}`, color:'var(--red)'}] : []),
                { label:'BPM',         val: `${bpm} ♩`,                                                        color:'var(--accent-2)' },
                { label:'Duration',    val: fmtDur(duration),                                                   color:'var(--text-2)' },
              ].map(({label,val,color}) => (
                <div key={label} style={{ display:'flex',alignItems:'baseline',justifyContent:'space-between',fontSize:'.81rem',paddingBottom:'.32rem',borderBottom:'1px solid var(--border)' }}>
                  <span style={{ color:'var(--text-3)',fontWeight:600 }}>{label}</span>
                  <span style={{ fontWeight:700,color:color||'var(--text)',textAlign:'right',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          {result ? (
            <div className="card" style={{ padding:'1.25rem' }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.85rem',flexWrap:'wrap',gap:'.4rem' }}>
                <div style={{ fontWeight:800,fontSize:'.9rem',fontFamily:"'Playfair Display',serif" }}>
                  {result.isLocal ? <><span style={{color:'var(--accent-2)'}}>⚡</span> Preview</> : <><span style={{color:'var(--green)'}}>✅</span> Generated</>}
                </div>
                <div style={{ display:'flex',gap:'.28rem' }}>
                  {[['progressions','🎵'],['scale','🎼']].map(([v,l]) => (
                    <button key={v} onClick={()=>setView(v)} style={{ padding:'.22rem .5rem',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.72rem',transition:'all .16s',background:view===v?'var(--accent)':'var(--bg-3)',color:view===v?'#fff':'var(--text-2)' }}>{l} {v}</button>
                  ))}
                </div>
              </div>

              {view==='progressions' && (
                <div style={{ display:'flex',flexDirection:'column',gap:'.55rem' }}>
                  {result.progressions.map((prog,pi) => {
                    const chords = prog.split(' — '), col = COLORS[pi%COLORS.length]
                    return (
                      <div key={pi} style={{ padding:'.7rem',background:pi===0?`${col}08`:'var(--bg-2)',border:`1px solid ${pi===0?col+'33':'var(--border)'}`,borderRadius:12 }}>
                        <div style={{ fontSize:'.63rem',color:'var(--text-3)',marginBottom:'.4rem',textTransform:'uppercase',letterSpacing:'.04em' }}>
                          Variation {pi+1} {pi===0&&<span style={{color:col}}>★ Primary</span>}
                        </div>
                        <div style={{ display:'flex',gap:'.28rem',flexWrap:'wrap' }}>
                          {chords.map((c,ci) => (
                            <div key={ci} style={{ flex:'1 1 42px',minWidth:40,padding:'.45rem .25rem',textAlign:'center',background:'var(--bg-1)',border:`1.5px solid ${col}33`,borderTop:`3px solid ${col}`,borderRadius:9,fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:'.9rem',color:col,transition:'transform .14s' }}
                              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-3px)'}
                              onMouseLeave={e=>e.currentTarget.style.transform=''}>
                              {c}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {view==='scale' && (
                <div>
                  <div style={{ fontWeight:700,fontSize:'.82rem',marginBottom:'.6rem' }}>{result.key} {result.mode} Scale</div>
                  <div style={{ display:'flex',gap:'.28rem',flexWrap:'wrap',marginBottom:'1rem' }}>
                    {result.scaleNotes.map((n,i) => (
                      <div key={i} style={{ flex:1,minWidth:34,padding:'.45rem .2rem',textAlign:'center',background:i===0?'rgba(255,107,71,.1)':'var(--bg-2)',border:`1.5px solid ${i===0?'var(--accent)':'var(--border)'}`,borderRadius:8,fontSize:'.8rem',fontWeight:700,color:i===0?'var(--accent)':'var(--text)' }}>{n}</div>
                    ))}
                  </div>
                  {result.instruments.length > 0 && (
                    <div style={{ fontSize:'.78rem',color:'var(--text-2)',lineHeight:1.65 }}>
                      <div style={{ fontWeight:700,fontSize:'.8rem',marginBottom:'.45rem' }}>💡 Performance notes</div>
                      {result.instruments.map(id => {
                        const inst = INSTRUMENTS_LIST.find(i=>i.id===id)
                        const note = result.instrNotes?.[id]
                        const fb = { guitar:`Capo for ${result.key}. Strum D-DU-UDU.`, piano:`Root octaves LH, inversions RH.`, bass:`Root beat 1, 5th beat 3.`, drums:`${result.bpm}bpm — kick 1, snare 2&4.`, vocals:`Voice (${result.voiceType}): stay in ${result.key} scale.`, strings:`Long bow on root + 5th.`, synth:`Slow-attack pad + 1-3-5-7 arp.`, brass:`Staccato beat 1, sustain off-beats.` }
                        if (!inst) return null
                        return <div key={id} style={{ padding:'.28rem 0',borderBottom:'1px solid var(--border)' }}><span style={{color:'var(--accent)',fontWeight:700}}>{inst.icon} {inst.label}: </span>{note||fb[id]||''}</div>
                      })}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display:'flex',gap:'.38rem',flexWrap:'wrap',marginTop:'1rem',paddingTop:'.75rem',borderTop:'1px solid var(--border)' }}>
                <button className="btn btn--primary btn--sm" onClick={handlePDF} disabled={pdfLoading}>{pdfLoading?<><span className="spinner" style={{width:10,height:10,borderWidth:1.5}}/> …</>:'⬇ PDF'}</button>
                <button className="btn btn--secondary btn--sm" onClick={()=>navigator.clipboard.writeText(result.progressions.join('\n')).catch(()=>{})}>📋 Copy</button>
                <button className="btn btn--ghost btn--sm" onClick={handleGenerate} disabled={loading}>↺ Regenerate</button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding:'2.5rem',textAlign:'center',color:'var(--text-3)' }}>
              <div style={{ fontSize:'2.5rem',marginBottom:'.75rem' }}>🎵</div>
              <div style={{ fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:'.95rem',color:'var(--text-2)',marginBottom:'.35rem' }}>Your chord sheet will appear here</div>
              <div style={{ fontSize:'.78rem' }}>Complete the steps on the left, then hit Generate</div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes dropIn  { from{opacity:0;transform:scale(.92) translateY(-10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes bounceIn{ from{transform:scale(.5) rotate(-8deg);opacity:0} to{transform:scale(1) rotate(0);opacity:1} }
        @media (max-width:920px) {
          .page-wrap > div[style*="grid-template-columns: 1fr 380px"] { grid-template-columns:1fr !important; }
          .page-wrap > div[style*="grid-template-columns: 1fr 380px"] > div:last-child { position:static !important; }
        }
      `}</style>
    </div>
  )
}
