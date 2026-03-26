import { useState, useCallback, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STYLES  = ['pop','rock','jazz','electronic','hip-hop','classical','country','rnb','ambient','indie']
const MOODS   = ['happy','sad','energetic','calm','dark','romantic','epic','mysterious','uplifting']
const KEYS    = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
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

/* ── Chord theory helpers ─────────────────────────────── */
const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const SCALE_INTERVALS = {
  major:       [0,2,4,5,7,9,11],
  minor:       [0,2,3,5,7,8,10],
  dorian:      [0,2,3,5,7,9,10],
  mixolydian:  [0,2,4,5,7,9,10],
  pentatonic:  [0,2,4,7,9],
}
const CHORD_TYPES = {
  major: ['','','m','','','m','dim'],
  minor: ['m','dim','','m','m','',''],
}

function buildProgression(rootNote, modeKey, styleHint, moodHint) {
  const rootIdx = CHROMATIC.indexOf(rootNote)
  const intervals = SCALE_INTERVALS[modeKey] || SCALE_INTERVALS.major
  const types     = CHORD_TYPES[modeKey]     || CHORD_TYPES.major

  const scaleNotes = intervals.map(i => CHROMATIC[(rootIdx + i) % 12])

  // Common progressions by mood/style
  const PROGS = {
    happy:      [[0,3,4,3],[0,4,5,3],[0,5,3,4]],
    sad:        [[0,5,3,6],[0,3,6,4],[5,0,3,4]],
    energetic:  [[0,4,5,4],[0,3,4,0],[0,5,4,3]],
    calm:       [[0,5,3,4],[0,3,5,4],[3,0,4,5]],
    dark:       [[0,6,3,7],[0,5,6,3],[6,0,5,3]],
    romantic:   [[0,5,3,4],[0,3,5,6],[3,0,6,5]],
    epic:       [[0,7,5,4],[0,5,7,4],[0,4,7,5]],
    mysterious: [[0,1,5,0],[6,0,5,3],[0,7,3,5]],
    uplifting:  [[0,4,5,3],[0,3,4,5],[0,5,4,3]],
    default:    [[0,5,3,4],[0,3,5,4],[0,4,5,0]],
  }

  const templates = PROGS[moodHint] || PROGS.default
  return templates.map(template => {
    const chords = template.map(degree => {
      const noteIdx = degree % scaleNotes.length
      if (noteIdx >= scaleNotes.length) return `${rootNote}${types?.[0] || ''}`
      const note = scaleNotes[noteIdx] || rootNote
      const type = types?.[degree % types.length] || ''
      return `${note}${type}`
    })
    return chords.join(' — ')
  })
}

function fmtDur(s) {
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
}

/* ── PDF Generator for Generate page ────────────────────── */
async function downloadGenerationPDF(params, progressions) {
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      s.onload = res; s.onerror = rej
      document.head.appendChild(s)
    })
  }
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  const W = 210, MARGIN = 15
  let y = 20

  // Gradient header bar
  doc.setFillColor(255, 107, 71)
  doc.rect(0, 0, W, 5, 'F')

  // Title
  doc.setFont('times', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(26, 22, 18)
  doc.text('KalzTunz Chord Sheet', W/2, y, { align:'center' }); y += 10

  // Params
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90, 82, 72)
  doc.text(`Style: ${params.style}  ·  Key: ${params.key} ${params.mode}  ·  Mood: ${params.mood}`, W/2, y, { align:'center' }); y += 6
  doc.text(`BPM: ${params.bpm}  ·  Duration: ${fmtDur(params.duration)}  ·  Generated: ${new Date().toLocaleDateString()}`, W/2, y, { align:'center' }); y += 8

  // Separator
  doc.setDrawColor(224, 217, 206)
  doc.line(MARGIN, y, W - MARGIN, y); y += 8

  // Instruments section
  if (params.instruments.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 107, 71)
    doc.text('INSTRUMENTATION', MARGIN, y); y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(26, 22, 18)
    doc.text(params.instruments.join('  ·  '), MARGIN, y); y += 8
    doc.setDrawColor(224, 217, 206)
    doc.line(MARGIN, y, W-MARGIN, y); y += 7
  }

  // Progressions
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 107, 71)
  doc.text('CHORD PROGRESSIONS', MARGIN, y); y += 7

  const accentColors = [
    [255,107,71],[255,179,71],[0,212,200],[232,84,42],[139,92,246],[52,211,153]
  ]

  progressions.forEach((prog, pi) => {
    if (y > 260) { doc.addPage(); y = 20 }
    const chords = prog.split(' — ')
    const cellW  = (W - MARGIN*2) / Math.max(chords.length, 1)
    const cellH  = 20
    const aColor = accentColors[pi % accentColors.length]

    // Progression label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(154, 146, 136)
    doc.text(`Progression ${pi+1}`, MARGIN, y); y += 4

    chords.forEach((chord, ci) => {
      const x = MARGIN + ci * cellW
      doc.setFillColor(250, 248, 244)
      doc.setDrawColor(...aColor)
      doc.roundedRect(x, y, cellW-1, cellH, 2, 2, 'FD')
      doc.setFillColor(...aColor)
      doc.roundedRect(x, y, cellW-1, 2.5, 1, 1, 'F')

      doc.setFont('times', 'bold')
      doc.setFontSize(chord.length > 3 ? 9 : 13)
      doc.setTextColor(26, 22, 18)
      doc.text(chord, x + cellW/2 - 0.5, y + 13, { align:'center' })
    })
    y += cellH + 5
  })

  // Chord scale reference
  y += 3
  if (y < 230) {
    doc.setDrawColor(224, 217, 206)
    doc.line(MARGIN, y, W-MARGIN, y); y += 7
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 107, 71)
    doc.text('SCALE REFERENCE', MARGIN, y); y += 6

    const root = params.key
    const rootIdx = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(root)
    const intervals = [0,2,4,5,7,9,11]
    const scaleNotes = intervals.map(i => ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][(rootIdx+i)%12])
    const types = params.mode === 'minor' ? ['m','dim','','m','m','',''] : ['','m','m','','','m','dim']
    const romans = params.mode === 'minor'
      ? ['i','ii°','III','iv','v','VI','VII']
      : ['I','ii','iii','IV','V','vi','vii°']

    const noteW = (W - MARGIN*2) / 7
    scaleNotes.forEach((note, i) => {
      const x = MARGIN + i * noteW
      doc.setFillColor(250, 248, 244)
      doc.setDrawColor(224, 217, 206)
      doc.roundedRect(x, y, noteW-1, 16, 2, 2, 'FD')
      doc.setFont('times', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(26, 22, 18)
      doc.text(`${note}${types[i]}`, x + noteW/2 - 0.5, y + 8, { align:'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(154, 146, 136)
      doc.text(romans[i], x + noteW/2 - 0.5, y + 14, { align:'center' })
    })
  }

  // Footer
  doc.setFillColor(255, 107, 71)
  doc.rect(0, 288, W, 4, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(154, 146, 136)
  doc.text('© KalzTunz · AI Music Platform · kalztunz.com', W/2, 295, { align:'center' })

  doc.save(`kalztunz_${params.style}_${params.key}_${params.mode}_chords.pdf`)
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function Generate() {
  const { user } = useAuth()

  const [style,       setStyle]      = useState('pop')
  const [mood,        setMood]       = useState('energetic')
  const [key,         setKey]        = useState('C')
  const [mode,        setMode]       = useState('major')
  const [bpm,         setBpm]        = useState(120)
  const [duration,    setDuration]   = useState(120)
  const [scaleMode,   setScaleMode]  = useState('major')
  const [instruments, setInstruments]= useState(['piano','guitar'])
  const [numVariations, setNumVariations] = useState(3)

  const [loading,   setLoading]   = useState(false)
  const [result,    setResult]    = useState(null)
  const [error,     setError]     = useState(null)
  const [jobStatus, setJobStatus] = useState(null)
  const [pdfLoading,setPdfLoading]= useState(false)
  const [view,      setView]      = useState('progressions')  // progressions | scale

  const toggleInstrument = useCallback((id) => {
    setInstruments(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }, [])

  // Poll a generation job until finished
  const pollRef = useRef(null)
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const pollGenJob = useCallback((jobId) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`${API}/api/jobs/${jobId}`)
        const data = await res.json()
        setJobStatus(data.status)
        if (data.status === 'finished') {
          clearInterval(pollRef.current)
          setLoading(false)
          applyResult(data.result)
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current)
          setLoading(false)
          setError(data.error || 'Generation failed')
        }
      } catch (e) { console.error('Poll error:', e) }
    }, 1500)
  }, [])

  const applyResult = useCallback((r) => {
    if (!r) return
    // Backend returns progressions as rich objects — map to display strings
    const displayProgs = (r.progressions || []).map(p =>
      typeof p === 'string' ? p : (p.display || p.chords?.join(' — ') || '')
    )
    const scaleRef = r.scale_reference || []
    const scaleNotes = scaleRef.map(s => s.note || s.chord?.replace(/m$/,'') || '')

    setResult({
      style:       r.style || style,
      mood:        r.mood  || mood,
      key:         r.root_note || key,
      mode:        r.scale_mode || scaleMode,
      bpm:         r.bpm  || Number(bpm),
      duration:    r.duration || Number(duration),
      instruments: r.instruments || instruments,
      progressions:     displayProgs,
      richProgressions: r.progressions || [],
      scaleNotes:       scaleNotes,
      scaleReference:   scaleRef,
      instrumentNotes:  r.instrument_notes || {},
    })
  }, [style, mood, key, scaleMode, bpm, duration, instruments])

  const handleGenerate = async () => {
    setLoading(true); setError(null); setResult(null); setJobStatus(null)
    try {
      // Build a local preview instantly while the backend processes
      const localProgs = buildProgression(key, scaleMode, style, mood)
      const rootIdx    = CHROMATIC.indexOf(key)
      const intervals  = SCALE_INTERVALS[scaleMode] || SCALE_INTERVALS.major
      setResult({
        style, mood, key, mode: scaleMode, bpm: Number(bpm),
        duration: Number(duration), instruments,
        progressions: Array.from({ length: numVariations }, (_, i) => localProgs[i % localProgs.length]),
        richProgressions: [],
        scaleNotes: intervals.map(i => CHROMATIC[(rootIdx+i)%12]),
        scaleReference: [],
        instrumentNotes: {},
        isLocal: true,
      })

      // Call the real backend endpoint
      const fd = new FormData()
      fd.append('root_note',      key)
      fd.append('scale_mode',     scaleMode)
      fd.append('mood',           mood)
      fd.append('style',          style)
      fd.append('bpm',            String(bpm))
      fd.append('duration',       String(duration))
      fd.append('instruments',    JSON.stringify(instruments))
      fd.append('num_variations', String(numVariations))

      const res  = await fetch(`${API}/api/generate`, { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) throw new Error(data.detail || 'Generation failed')

      setJobStatus(data.status)

      // Sync mode: full result returned immediately
      if (data.mode === 'sync' && data.result) {
        setLoading(false)
        applyResult(data.result)
        return
      }

      // Async mode: poll for result
      pollGenJob(data.job_id)

    } catch (e) {
      setLoading(false)
      // Keep local preview but show the error
      setError(`Backend unavailable — showing local preview. (${e.message})`)
    }
  }

  const handlePDF = async () => {
    if (!result) return
    setPdfLoading(true)
    try {
      await downloadGenerationPDF(
        { style, mood, key, mode: scaleMode, bpm, duration, instruments },
        result.progressions
      )
    } catch (e) {
      setError('PDF generation failed. Try again.')
    } finally {
      setPdfLoading(false)
    }
  }

  const handleCopyText = () => {
    if (!result) return
    const text = result.progressions.map((p,i) => `${i+1}. ${p}`).join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
  }

  const Chip = ({ options, value, onChange, colorFn }) => (
    <div style={{ display:'flex', flexWrap:'wrap', gap:'.38rem' }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)}
          className={`chip ${value===opt ? 'active' : ''}`}
          style={{ textTransform:'capitalize' }}>
          {opt}
        </button>
      ))}
    </div>
  )

  return (
    <div className="page-wrap" style={{ paddingTop:'2rem' }}>

      <div className="page-header">
        <div className="page-header__badge">🤖 AI Generation</div>
        <h1 className="page-header__title">Generate Chord Progressions</h1>
        <p className="page-header__sub">
          Pick style, mood, key, and instruments — get theory-correct progressions with PDF sheet export.
        </p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'380px 1fr', gap:'1.5rem', alignItems:'start' }}>

        {/* ── LEFT: Controls ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

          <div className="card" style={{ padding:'1.25rem' }}>
            <div style={{ fontWeight:700, fontSize:'.875rem', marginBottom:'.75rem' }}>Style</div>
            <Chip options={STYLES} value={style} onChange={setStyle} />
          </div>

          <div className="card" style={{ padding:'1.25rem' }}>
            <div style={{ fontWeight:700, fontSize:'.875rem', marginBottom:'.75rem' }}>Mood</div>
            <Chip options={MOODS} value={mood} onChange={setMood} />
          </div>

          <div className="card" style={{ padding:'1.25rem' }}>
            <div style={{ fontWeight:700, fontSize:'.875rem', marginBottom:'.75rem' }}>🎼 Key & Scale</div>
            <div style={{ marginBottom:'.6rem' }}>
              <div className="form-label" style={{ marginBottom:'.35rem' }}>Root note</div>
              <Chip options={KEYS} value={key} onChange={setKey} />
            </div>
            <div>
              <div className="form-label" style={{ marginBottom:'.35rem' }}>Scale / Mode</div>
              <Chip options={Object.keys(SCALE_INTERVALS)} value={scaleMode} onChange={setScaleMode} />
            </div>
          </div>

          {/* Instruments */}
          <div className="card" style={{ padding:'1.25rem' }}>
            <div style={{ fontWeight:700, fontSize:'.875rem', marginBottom:'.75rem' }}>
              🎛 Instrumentation
              <span style={{ fontSize:'.7rem', color:'var(--text-3)', fontWeight:400, marginLeft:'.4rem' }}>
                ({instruments.length} selected)
              </span>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'.4rem' }}>
              {INSTRUMENTS_LIST.map(inst => (
                <button key={inst.id}
                  onClick={() => toggleInstrument(inst.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:'.3rem',
                    padding:'.3rem .65rem', borderRadius:999, fontFamily:'inherit',
                    border:`1.5px solid ${instruments.includes(inst.id) ? 'var(--coral)' : 'var(--border-hi)'}`,
                    background: instruments.includes(inst.id) ? 'rgba(255,107,71,.12)' : 'transparent',
                    color: instruments.includes(inst.id) ? 'var(--coral)' : 'var(--text-2)',
                    fontSize:'.76rem', fontWeight:600, cursor:'pointer', transition:'all .18s',
                  }}
                >
                  {inst.icon} {inst.label}
                </button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div className="card" style={{ padding:'1.25rem' }}>
            <div style={{ fontWeight:700, fontSize:'.875rem', marginBottom:'.75rem' }}>Parameters</div>
            <div className="form" style={{ gap:'.6rem' }}>
              <div className="form-group">
                <label className="form-label">BPM — {bpm}</label>
                <input type="range" min="60" max="200" step="1" value={bpm} onChange={e=>setBpm(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Duration — {fmtDur(duration)}</label>
                <input type="range" min="30" max="300" step="10" value={duration} onChange={e=>setDuration(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Variations — {numVariations}</label>
                <input type="range" min="1" max="6" step="1" value={numVariations} onChange={e=>setNumVariations(Number(e.target.value))} />
              </div>
            </div>
          </div>

          <button className="btn btn--primary" onClick={handleGenerate} disabled={loading}>
            {loading ? <><span className="spinner" style={{width:15,height:15,borderWidth:2}}/>{jobStatus==='queued'?' Queued…':' Generating…'}</> : '🎵 Generate Progressions'}
          </button>

          {/* Status badge */}
          {jobStatus && jobStatus !== 'finished' && (
            <div style={{display:'flex',alignItems:'center',gap:'.5rem',padding:'.5rem .8rem',background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:10}}>
              <span className="spinner" style={{width:12,height:12,borderWidth:2,flexShrink:0}}/>
              <span style={{fontSize:'.78rem',color:'var(--text-2)'}}>
                {jobStatus === 'queued' ? 'Job queued — worker picking up…' : 'Computing progressions…'}
              </span>
            </div>
          )}

          {error && <div className="alert alert--warn" style={{fontSize:'.82rem'}}>{error}</div>}
        </div>

        {/* ── RIGHT: Output ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

          {!result ? (
            <div className="card" style={{ textAlign:'center', padding:'4rem 2rem', color:'var(--text-3)' }}>
              <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🎵</div>
              <p style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:'.95rem', marginBottom:'.4rem', color:'var(--text-2)' }}>
                Configure & Generate
              </p>
              <p style={{ fontSize:'.82rem' }}>
                Select style, mood, key and instruments then click Generate
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'.6rem' }}>
                {[
                  { label:'Key',     val:`${result.key}`,           icon:'🔑' },
                  { label:'Scale',   val:result.mode,               icon:'🎼' },
                  { label:'BPM',     val:result.bpm,                icon:'♩' },
                  { label:'Duration',val:fmtDur(result.duration),   icon:'⏱' },
                ].map(({ label, val, icon }) => (
                  <div key={label} style={{ background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:14, padding:'.85rem', textAlign:'center' }}>
                    <div style={{ fontSize:'1.1rem', marginBottom:'.2rem' }}>{icon}</div>
                    <div style={{ fontFamily:"'Space Mono',monospace", fontSize:'.95rem', fontWeight:700, color:'var(--coral)', textTransform:'capitalize' }}>{val}</div>
                    <div style={{ fontSize:'.65rem', color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Local preview badge */}
              {result.isLocal && (
                <div style={{display:'flex',alignItems:'center',gap:'.45rem',padding:'.4rem .75rem',background:'rgba(255,179,71,.08)',border:'1px solid rgba(255,179,71,.22)',borderRadius:10,fontSize:'.78rem',color:'var(--amber)'}}>
                  <span className="spinner" style={{width:11,height:11,borderWidth:1.5}}/>
                  Local preview — backend processing…
                </div>
              )}

              {/* Instrument chips */}
              {result.instruments.length > 0 && (
                <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{ fontSize:'.72rem', color:'var(--text-3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em' }}>For:</span>
                  {result.instruments.map(id => {
                    const inst = INSTRUMENTS_LIST.find(i=>i.id===id)
                    return inst ? (
                      <span key={id} style={{ display:'flex', alignItems:'center', gap:'.25rem', padding:'.2rem .55rem', borderRadius:999, background:'rgba(255,107,71,.1)', border:'1px solid rgba(255,107,71,.2)', fontSize:'.74rem', color:'var(--coral)' }}>
                        {inst.icon} {inst.label}
                      </span>
                    ) : null
                  })}
                </div>
              )}

              {/* View + Download toolbar */}
              <div style={{ display:'flex', alignItems:'center', gap:'.5rem', flexWrap:'wrap' }}>
                <div style={{ display:'flex', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10, padding:3, gap:2 }}>
                  {[['progressions','🎵 Progressions'],['scale','🎼 Scale']].map(([v,l]) => (
                    <button key={v} onClick={() => setView(v)} style={{
                      padding:'.3rem .7rem', borderRadius:8, border:'none', cursor:'pointer',
                      fontFamily:'inherit', fontWeight:700, fontSize:'.75rem', transition:'all .18s',
                      background: view===v ? 'var(--coral)' : 'transparent',
                      color: view===v ? '#fff' : 'var(--text-2)',
                    }}>{l}</button>
                  ))}
                </div>

                <div style={{ marginLeft:'auto', display:'flex', gap:'.4rem' }}>
                  <button className="btn btn--sm btn--secondary" onClick={handleCopyText} title="Copy progressions to clipboard">
                    📋 Copy
                  </button>
                  <button className="btn btn--sm btn--primary" onClick={handlePDF} disabled={pdfLoading}
                    title="Download as PDF sheet music">
                    {pdfLoading ? <><span className="spinner" style={{width:11,height:11,borderWidth:1.5}}/> …</> : '⬇ PDF Sheet'}
                  </button>
                </div>
              </div>

              {/* Progressions view */}
              {view === 'progressions' && (
                <div className="card" style={{ padding:'1.5rem' }}>
                  <div style={{ fontWeight:700, fontSize:'.875rem', marginBottom:'1rem', display:'flex', alignItems:'center', gap:'.5rem' }}>
                    Chord Progressions
                    <span style={{ fontSize:'.72rem', color:'var(--text-3)', fontWeight:400 }}>
                      {result.key} {result.mode} · {result.style}
                    </span>
                  </div>

                  {result.progressions.map((prog, pi) => {
                    const chords = prog.split(' — ')
                    const colors = ['var(--coral)','var(--amber)','var(--cyan)','#e87a30','#8b5cf6','var(--green)']
                    return (
                      <div key={pi} style={{
                        marginBottom:'.85rem', padding:'1rem',
                        background: pi===0 ? 'rgba(255,107,71,.06)' : 'var(--bg-2)',
                        border:`1px solid ${pi===0 ? 'rgba(255,107,71,.22)' : 'var(--border)'}`,
                        borderRadius:14,
                      }}>
                        <div style={{ fontSize:'.68rem', color:'var(--text-3)', marginBottom:'.55rem', textTransform:'uppercase', letterSpacing:'.04em' }}>
                          Variation {pi+1} {pi===0 && <span style={{ color:'var(--coral)', marginLeft:'.3rem' }}>★ Primary</span>}
                        </div>
                        <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                          {chords.map((c, ci) => (
                            <div key={ci} style={{
                              flex:'1 1 60px', minWidth:52, padding:'.65rem .5rem',
                              background:'var(--bg-1)', border:`1.5px solid ${colors[ci%colors.length]}44`,
                              borderTop:`3px solid ${colors[ci%colors.length]}`,
                              borderRadius:10, textAlign:'center',
                            }}>
                              <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, fontSize:'1.1rem', color:colors[ci%colors.length] }}>{c}</div>
                              <div style={{ fontSize:'.62rem', color:'var(--text-3)', marginTop:2 }}>
                                {['I','II','III','IV','V','VI','VII'][ci] || ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Scale reference */}
              {view === 'scale' && (
                <div className="card" style={{ padding:'1.5rem' }}>
                  <div style={{ fontWeight:700, fontSize:'.875rem', marginBottom:'1rem' }}>
                    {result.key} {result.mode} Scale
                  </div>
                  <div style={{ display:'flex', gap:'.5rem', marginBottom:'1.25rem' }}>
                    {result.scaleNotes.map((note, i) => {
                      const types = result.mode==='minor'
                        ? ['m','dim','','m','m','','']
                        : ['','m','m','','','m','dim']
                      const romans = result.mode==='minor'
                        ? ['i','ii°','III','iv','v','VI','VII']
                        : ['I','ii','iii','IV','V','vi','vii°']
                      const colors = ['var(--coral)','var(--amber)','var(--cyan)','#e87a30','#8b5cf6','var(--green)','var(--red)']
                      const col = i===0 || i===4 ? 'var(--coral)' : 'var(--text-2)'
                      return (
                        <div key={i} style={{
                          flex:1, padding:'.7rem .3rem', textAlign:'center',
                          background: i===0 ? 'rgba(255,107,71,.1)' : 'var(--bg-2)',
                          border:`1.5px solid ${i===0 ? 'var(--coral)' : 'var(--border)'}`,
                          borderRadius:10,
                        }}>
                          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'.95rem', fontWeight:800, color:col }}>
                            {note}{types[i]}
                          </div>
                          <div style={{ fontSize:'.65rem', color:'var(--text-3)', marginTop:2 }}>{romans[i]}</div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Instrument-specific tips */}
                  {/* Backend performance notes (rich) or local fallback */}
                  {result.instruments.length > 0 && (
                    <div style={{ padding:'.85rem', background:'var(--bg-2)', borderRadius:10, border:'1px solid var(--border)', lineHeight:1.65 }}>
                      <div style={{ fontWeight:700, color:'var(--text)', marginBottom:'.55rem', fontSize:'.84rem' }}>
                        💡 Performance notes
                      </div>
                      {result.instruments.map(id => {
                        const inst = INSTRUMENTS_LIST.find(i=>i.id===id)
                        const note = result.instrumentNotes?.[id]
                        const fallbacks = {
                          guitar:  `Guitar: Open chord shapes for ${result.key}. Capo to match original key.`,
                          piano:   `Piano: Root octaves left hand, chord inversions right hand.`,
                          bass:    `Bass: Root on beat 1, 5th on beat 3. Passing tones on beat 4.`,
                          drums:   `Drums: ${result.bpm} BPM. Kick beat 1, snare beats 2 & 4.`,
                          strings: `Strings: Long bow on root + fifth. Tremolo for tension sections.`,
                          vocals:  `Vocals: Melody from ${result.key} scale. Verse lower, chorus upper register.`,
                          synth:   `Synth: Slow-attack pad on sustained chords. High arpeggiated 1-3-5-7.`,
                          brass:   `Brass: Staccato punctuation on beat 1. Sustained harmony on off-beats.`,
                        }
                        if (!inst) return null
                        return (
                          <div key={id} style={{ fontSize:'.8rem', color:'var(--text-2)', padding:'.25rem 0', borderBottom:'1px solid var(--border)' }}>
                            <span style={{ color:'var(--coral)', fontWeight:700, marginRight:'.4rem' }}>{inst.icon} {inst.label}:</span>
                            {note || fallbacks[id] || ''}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Regenerate */}
              <div style={{ display:'flex', gap:'.6rem' }}>
                <button className="btn btn--secondary btn--sm" onClick={handleGenerate} disabled={loading}>
                  ↺ Regenerate
                </button>
                <Link to="/extract" className="btn btn--ghost btn--sm">
                  🎸 Extract from file instead
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .page-wrap > div[style*="grid-template-columns: 380px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
