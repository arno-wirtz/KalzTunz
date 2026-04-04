import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '../App'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const POLL_MS  = 2000
const ACCEPTED = '.mp3,.wav,.flac,.ogg,.aac,.mp4,.webm,.mov'

const INSTRUMENTS = [
  { id:'all',     label:'All',       icon:'🎼', color:'var(--coral)' },
  { id:'piano',   label:'Piano',     icon:'🎹', color:'var(--amber)' },
  { id:'guitar',  label:'Guitar',    icon:'🎸', color:'#e87a30' },
  { id:'bass',    label:'Bass',      icon:'🎸', color:'#c44d2a' },
  { id:'drums',   label:'Drums',     icon:'🥁', color:'#d97706' },
  { id:'strings', label:'Strings',   icon:'🎻', color:'var(--cyan)' },
  { id:'brass',   label:'Brass',     icon:'🎷', color:'#f59e0b' },
  { id:'vocals',  label:'Vocals',    icon:'🎤', color:'var(--red)' },
  { id:'synth',   label:'Synth',     icon:'🎛️', color:'#8b5cf6' },
]

const CHORD_COLORS = ['var(--coral)','var(--amber)','var(--cyan)','#e87a30','#c44d2a','#8b5cf6','#d97706','var(--green)','var(--red)']

function fmtDur(s) {
  const m = Math.floor(s/60), sec = Math.floor(s%60)
  return `${m}:${String(sec).padStart(2,'0')}`
}

function detectInstruments(file) {
  const n = (file?.name||'').toLowerCase()
  const det = new Set(['all'])
  if (n.includes('piano')||n.includes('keys'))   det.add('piano')
  if (n.includes('guitar')||n.includes('guit'))  det.add('guitar')
  if (n.includes('bass'))                        det.add('bass')
  if (n.includes('drum')||n.includes('beat'))    det.add('drums')
  if (n.includes('string')||n.includes('violin'))det.add('strings')
  if (n.includes('horn')||n.includes('brass')||n.includes('sax')) det.add('brass')
  if (n.includes('vocal')||n.includes('voice'))  det.add('vocals')
  if (n.includes('synth')||n.includes('electro'))det.add('synth')
  if (det.size === 1) { det.add('piano'); det.add('guitar'); det.add('bass') }
  return det
}

/* ═══════════════════════════════════════════════════════════════
   EXTRACTION — PROFESSIONAL SHEET MUSIC PDF
   Full staff notation, bar lines, chord symbols, confidence bars,
   progressions, scale reference, instrument-filtered view.
   ═══════════════════════════════════════════════════════════════ */
const CHORD_NOTES_EX = {
  'C':[0,4,7],'Cm':[0,3,7],'C#':[1,5,8],'C#m':[1,4,8],
  'D':[2,6,9],'Dm':[2,5,9],'D#':[3,7,10],'D#m':[3,6,10],
  'E':[4,8,11],'Em':[4,7,11],'F':[5,9,12],'Fm':[5,8,12],
  'F#':[6,10,13],'F#m':[6,9,13],'G':[7,11,14],'Gm':[7,10,14],
  'G#':[8,12,15],'G#m':[8,11,15],'A':[9,13,16],'Am':[9,12,16],
  'A#':[10,14,17],'A#m':[10,13,17],'B':[11,15,18],'Bm':[11,14,18],
  'Cdim':[0,3,6],'Ddim':[2,5,8],'Gdim':[7,10,13],'Adim':[9,12,15],
}

async function exportPDF(result, file, instrument, progressions) {
  if (!window.jspdf) await new Promise((res,rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    s.onload = res; s.onerror = rej; document.head.appendChild(s)
  })
  const { jsPDF } = window.jspdf
  const { chords=[], metadata={} } = result
  const title     = file?.name?.replace(/\.[^.]+$/,'') || 'KalzTunz Extraction'
  const instrLabel= INSTRUMENTS.find(i=>i.id===instrument)?.label || 'All'
  const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const W=210, M=14, INNER=W-M*2; let y=0, page=1

  const CORAL=[255,107,71], AMBER=[255,179,71]
  const DARK=[18,16,12], GREY=[90,82,72], LGREY=[160,155,148], LLGREY=[225,220,213]
  const ACCENTS=[[255,107,71],[255,179,71],[0,180,168],[232,84,42],[139,92,246],[52,211,153],[217,119,6],[232,54,93]]

  const newPage = () => {
    doc.addPage(); page++; y=16
    doc.setFillColor(...CORAL); doc.rect(0,0,W,3,'F')
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...LGREY)
    doc.text(`KalzTunz Extraction · ${metadata.key||'?'} · ${metadata.bpm||'?'} BPM · ${instrLabel}`, M, 9)
    doc.text(`Page ${page}`, W-M, 9, {align:'right'})
    doc.setDrawColor(...LLGREY); doc.setLineWidth(0.2); doc.line(M,11,W-M,11)
  }
  const check = (need=30) => { if (y+need>282) newPage() }

  // ── PAGE 1 HEADER ──────────────────────────────────────────
  doc.setFillColor(...CORAL); doc.rect(0,0,W,8,'F')
  doc.setFillColor(...AMBER); doc.triangle(0,8,55,8,0,24,'F')
  y=26

  doc.setFont('times','bold'); doc.setFontSize(24); doc.setTextColor(...DARK)
  doc.text(title, W/2, y, {align:'center', maxWidth:INNER}); y+=9

  doc.setFont('times','italic'); doc.setFontSize(11); doc.setTextColor(...GREY)
  doc.text(`Chord Extraction · ${metadata.key||'?'} · ${metadata.bpm||'?'} BPM · ${fmtDur(metadata.duration||0)}`, W/2, y, {align:'center'}); y+=6

  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...LGREY)
  doc.text(`Instrument filter: ${instrLabel}  ·  ${chords.length} chords detected  ·  ${new Date().toLocaleDateString()}`, W/2, y, {align:'center'}); y+=5

  doc.setDrawColor(...CORAL); doc.setLineWidth(0.8); doc.line(M,y,W-M,y)
  doc.setDrawColor(...AMBER); doc.setLineWidth(0.3); doc.line(M,y+1,W-M,y+1)
  y+=7

  // ── SECTION: NOTATION OVERVIEW ─────────────────────────────
  // Show chords in bars of 4 across a real 5-line staff
  const CHORDSPERBAR = 4
  const SPACE = 2.5
  const staffW = INNER - 13
  const barCount = Math.ceil(chords.length / CHORDSPERBAR)
  const BARSPERLINE = 4
  const lineCount   = Math.ceil(barCount / BARSPERLINE)
  const barW        = staffW / Math.min(BARSPERLINE, barCount)

  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...CORAL)
  doc.text('CHORD NOTATION', M, y); y+=5

  // Draw key signature helper
  const KEY_SHARPS={'G':1,'D':2,'A':3,'E':4,'B':5,'F#':6,'C#':7}
  const KEY_FLATS ={'F':1,'Bb':2,'Eb':3,'Ab':4,'Db':5,'Gb':6,'Cb':7}
  const rootNote = (metadata.key||'C').split(' ')[0]

  for (let lineIdx=0; lineIdx<Math.min(lineCount,8); lineIdx++) {
    check(34)
    const staffX = M + 12
    // Draw 5-line staff
    doc.setDrawColor(70,70,70); doc.setLineWidth(0.2)
    for (let l=0; l<5; l++) doc.line(staffX, y+l*SPACE, staffX+staffW, y+l*SPACE)
    const staffBottom = y+4*SPACE

    // Treble clef
    doc.setFont('times','bold'); doc.setFontSize(17); doc.setTextColor(30,30,30)
    doc.text('𝄞', staffX-10, y+9)

    // Time sig
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(30,30,30)
    doc.text('4', staffX+1.5, y+2.5, {align:'center'})
    doc.text('4', staffX+1.5, y+7,   {align:'center'})

    // Key sig
    let ksx = staffX+7
    if (KEY_SHARPS[rootNote]) {
      doc.setFont('times','bold'); doc.setFontSize(8); doc.setTextColor(30,30,30)
      for (let s=0;s<Math.min(KEY_SHARPS[rootNote],4);s++) { doc.text('♯',ksx,y+1.5+s*1.4); ksx+=3.2 }
    } else if (KEY_FLATS[rootNote]) {
      doc.setFont('times','bold'); doc.setFontSize(8); doc.setTextColor(30,30,30)
      for (let s=0;s<Math.min(KEY_FLATS[rootNote],4);s++) { doc.text('♭',ksx,y+2.5+s*1.4); ksx+=3 }
    }

    const barsThisLine = Math.min(BARSPERLINE, barCount - lineIdx*BARSPERLINE)
    const chordsInLine = chords.slice(lineIdx*CHORDSPERBAR*BARSPERLINE, (lineIdx+1)*CHORDSPERBAR*BARSPERLINE)

    chordsInLine.forEach((chord, ci) => {
      const bar    = Math.floor(ci / CHORDSPERBAR)
      const beat   = ci % CHORDSPERBAR
      const barX   = staffX + 15 + bar * barW
      const beatX  = barX + beat * (barW / CHORDSPERBAR) + barW/(CHORDSPERBAR*2)
      const ac     = ACCENTS[(lineIdx*barsThisLine+bar) % ACCENTS.length]

      // Bar line
      if (beat === 0 && (bar > 0 || lineIdx > 0 || ci > 0)) {
        doc.setDrawColor(60,60,60); doc.setLineWidth(0.3)
        doc.line(barX, y, barX, staffBottom)
      }

      // Chord name above staff
      doc.setFont('times','bold'); doc.setFontSize(8.5); doc.setTextColor(...ac)
      doc.text(chord.name, beatX, y-1.8, {align:'center'})

      // Confidence indicator (thin bar above chord name)
      const confW = 5 * (chord.confidence||0.5)
      doc.setFillColor(...LLGREY); doc.rect(beatX-2.5, y-4, 5, 0.8, 'F')
      doc.setFillColor(...ac); doc.rect(beatX-2.5, y-4, confW, 0.8, 'F')

      // Note head on staff
      const diat=[0,0,1,1,2,3,3,4,4,5,5,6]
      const chromatic=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
      const baseNote = chord.name.replace(/m$|dim$|aug$/,'').replace('#','#')
      const nIdx = chromatic.indexOf(baseNote)
      const dp   = nIdx>=0 ? diat[nIdx] : 0
      const noteY= y + 4*SPACE - (dp-2)*SPACE

      // Ledger lines
      doc.setDrawColor(80,80,80); doc.setLineWidth(0.18)
      if (noteY < y-0.4) for (let ly=y-SPACE;ly>=noteY-0.4;ly-=SPACE) doc.line(beatX-2,ly,beatX+2,ly)
      if (noteY > staffBottom+0.4) for (let ly=staffBottom+SPACE;ly<=noteY+0.4;ly+=SPACE) doc.line(beatX-2,ly,beatX+2,ly)

      // Note head
      doc.setFillColor(...DARK); doc.ellipse(beatX, noteY, 1.3, 0.95, 'F')
      // Stem
      doc.setDrawColor(...DARK); doc.setLineWidth(0.28)
      if (noteY > y+2*SPACE) doc.line(beatX+1.3, noteY, beatX+1.3, noteY-6.5)
      else                   doc.line(beatX-1.3, noteY, beatX-1.3, noteY+6.5)

      // Beat dot
      if (beat < 3) {
        doc.setFillColor(...LLGREY)
        doc.circle(barX+((beat+1)*barW/CHORDSPERBAR), staffBottom+2.8, 0.35,'F')
      }
    })

    // Double bar at end of last bar in line
    const endX = staffX + 15 + barsThisLine*barW
    doc.setDrawColor(40,40,40); doc.setLineWidth(0.3); doc.line(endX,y,endX,staffBottom)
    doc.setLineWidth(0.9); doc.line(endX+1,y,endX+1,staffBottom)
    y = staffBottom + 6

    // Timestamp labels under each measure
    for (let b=0;b<barsThisLine;b++) {
      const bX = staffX+15+b*barW+barW/2
      const startChord = chords[(lineIdx*BARSPERLINE+b)*CHORDSPERBAR]
      if (startChord) {
        doc.setFont('courier','normal'); doc.setFontSize(5.5); doc.setTextColor(...LGREY)
        doc.text(`${startChord.time?.toFixed(1)}s`, bX, y, {align:'center'})
      }
    }
    y += 5
  }

  // ── CHORD DETAIL GRID (full timeline) ──────────────────────
  check(20)
  doc.setDrawColor(...LLGREY); doc.setLineWidth(0.2); doc.line(M,y,W-M,y); y+=5
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...CORAL)
  doc.text('FULL CHORD TIMELINE', M, y); y+=4

  const COLS=8, cellW=INNER/COLS, cellH=15
  chords.forEach((c,i) => {
    if (i%COLS===0&&i>0) y+=cellH+3
    if (i%COLS===0) check(cellH+4)
    const col=i%COLS, x=M+col*cellW
    const ac=ACCENTS[i%ACCENTS.length]
    doc.setFillColor(252,250,246); doc.setDrawColor(...ac); doc.setLineWidth(0.3)
    doc.roundedRect(x,y,cellW-1,cellH,1.5,1.5,'FD')
    doc.setFillColor(...ac); doc.rect(x,y,cellW-1,2,'F')
    doc.setFont('times','bold'); doc.setFontSize(c.name.length>3?8:10); doc.setTextColor(...DARK)
    doc.text(c.name, x+cellW/2-0.5, y+9, {align:'center'})
    doc.setFont('courier','normal'); doc.setFontSize(5.5); doc.setTextColor(...LGREY)
    doc.text(`${c.time?.toFixed(1)}s`, x+cellW/2-0.5, y+12.5, {align:'center'})
    // Confidence bar
    const bx=x+1, by=y+cellH-2.5, bw=cellW-3
    doc.setFillColor(...LLGREY); doc.rect(bx,by,bw,1.2,'F')
    doc.setFillColor(...ac);     doc.rect(bx,by,bw*(c.confidence||0),1.2,'F')
  })
  y += cellH + 8

  // ── PROGRESSIONS ────────────────────────────────────────────
  if (progressions?.length) {
    check(20)
    doc.setDrawColor(...LLGREY); doc.setLineWidth(0.2); doc.line(M,y,W-M,y); y+=5
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...CORAL)
    doc.text('SUGGESTED PROGRESSIONS', M, y); y+=4
    progressions.forEach((p,i) => {
      check(8)
      const chList = p.split(' — ')
      const cw2 = INNER/Math.max(chList.length,1)
      const ac   = ACCENTS[i%ACCENTS.length]
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...LGREY)
      doc.text(`Progression ${i+1}`, M, y); y+=3.5
      chList.forEach((ch,ci) => {
        const x=M+ci*cw2
        doc.setFillColor(252,250,246); doc.setDrawColor(...ac); doc.setLineWidth(0.28)
        doc.roundedRect(x,y,cw2-1,12,1.5,1.5,'FD')
        doc.setFillColor(...ac); doc.roundedRect(x,y,cw2-1,2,0.8,0.8,'F')
        doc.setFont('times','bold'); doc.setFontSize(ch.length>3?8.5:11); doc.setTextColor(...DARK)
        doc.text(ch, x+cw2/2-0.5, y+9, {align:'center'})
      })
      y += 16
    })
  }

  // ── FOOTER (all pages) ──────────────────────────────────────
  const totalPages = page
  for (let p=1;p<=totalPages;p++) {
    doc.setPage(p)
    doc.setFillColor(...CORAL); doc.rect(0,289,W,5,'F')
    doc.setFillColor(...AMBER); doc.rect(0,289,W,1.5,'F')
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(255,255,255)
    doc.text(`KalzTunz  ·  Chord Extraction  ·  ${title}`, M, 292.5)
    doc.text(`${instrLabel}  ·  ${metadata.key||''}  ·  Page ${p} of ${totalPages}`, W-M, 292.5, {align:'right'})
  }
  doc.save(`${title.replace(/[^a-z0-9]/gi,'_')}_${instrLabel.replace(/\s/g,'_')}_sheet.pdf`)
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function Extraction() {
  const { user, getToken } = useAuth()

  const [file,         setFile]         = useState(null)
  const [dragging,     setDragging]     = useState(false)
  const [fileType,     setFileType]     = useState('audio')
  const [minConf,      setMinConf]      = useState(0.6)
  const [instrument,   setInstrument]   = useState('all')
  const [availInstr,   setAvailInstr]   = useState(new Set(['all']))

  const [jobId,        setJobId]        = useState(null)
  const [jobStatus,    setJobStatus]    = useState(null)
  const [result,       setResult]       = useState(null)
  const [error,        setError]        = useState(null)
  const [uploading,    setUploading]    = useState(false)

  const [view,         setView]         = useState('grid')   // grid | timeline | sheet
  const [pdfLoading,   setPdfLoading]   = useState(false)

  const pollRef  = useRef(null)
  const inputRef = useRef(null)
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const pickFile = useCallback((f) => {
    if (!f) return
    setFile(f); setResult(null); setError(null); setJobId(null); setJobStatus(null); setInstrument('all')
    if (f.type.startsWith('video/')) setFileType('video'); else setFileType('audio')
    setAvailInstr(detectInstruments(f))
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0])
  }, [pickFile])

  const startPolling = useCallback((id) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const headers = {}
        const token = getToken?.()
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res  = await fetch(`${API}/api/jobs/${id}`, { headers })
        const data = await res.json()
        setJobStatus(data.status)
        if (data.status === 'finished') {
          clearInterval(pollRef.current)
          setResult(data.result)
          setAvailInstr(detectInstruments(null))
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current)
          setError(data.error || 'Extraction failed.')
        }
      } catch(e) { console.error('Poll error:', e) }
    }, POLL_MS)
  }, [getToken])

  const handleSubmit = async () => {
    if (!file) return
    setUploading(true); setError(null); setResult(null); setJobId(null); setJobStatus(null)
    try {
      const fd = new FormData()
      fd.append('file',           file)
      fd.append('file_type',      fileType)
      fd.append('min_confidence', String(minConf))
      fd.append('track_filter',   instrument === 'all' ? 'all' : instrument)
      fd.append('user_id',        user?.id || 'anonymous')
      const headers = {}
      const token = getToken?.()
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res  = await fetch(`${API}/api/extract-chords`, { method:'POST', headers, body:fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Upload failed')
      setJobId(data.job_id)
      if (data.mode === 'sync' && data.result) {
        setJobStatus('finished'); setResult(data.result)
      } else {
        setJobStatus('queued'); startPolling(data.job_id)
      }
    } catch(e) { setError(e.message) } finally { setUploading(false) }
  }

  const filteredChords = (result?.chords||[]).filter(c => {
    if (instrument === 'all') return true
    if (instrument === 'bass')   return c.confidence > 0.55 && c.name.endsWith('m')
    if (instrument === 'guitar') return c.confidence > 0.60
    if (instrument === 'vocals') return c.confidence > 0.72
    return true
  })

  const handlePDF = async () => {
    if (!result) return; setPdfLoading(true)
    try { await exportPDF({ chords:filteredChords, metadata:result.metadata }, file, instrument, result.suggested_progressions||[]) }
    catch(e) { setError('PDF failed. Try again.') } finally { setPdfLoading(false) }
  }
  const handleCSV = () => {
    if (!filteredChords.length) return
    const blob = new Blob(['chord,time_s,end_time_s,confidence,key\n'+filteredChords.map(c=>`${c.name},${c.time?.toFixed(3)},${c.end_time?.toFixed(3)},${c.confidence?.toFixed(4)},${c.key||''}`).join('\n')], { type:'text/csv' })
    const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:`${file?.name||'chords'}_chords.csv` })
    a.click()
  }
  const handleJSON = () => {
    if (!result) return
    const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(new Blob([JSON.stringify({metadata:result.metadata,chords:filteredChords},null,2)],{type:'application/json'})), download:`${file?.name||'chords'}_chords.json` })
    a.click()
  }

  const isProcessing = jobStatus && !['finished','failed'].includes(jobStatus)
  const statusColors = { queued:'badge--yellow', started:'badge--blue', finished:'badge--green', failed:'badge--red' }
  const statusLabels = { queued:'Queued', started:'Processing…', finished:'Done', failed:'Failed' }
  const hasResult    = !!result && filteredChords.length > 0

  /* ── Sheet music view ─────────────────────────────── */
  const SheetView = () => {
    const rows = []
    for (let i=0; i<filteredChords.length; i+=8) rows.push(filteredChords.slice(i,i+8))
    return (
      <div>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.65rem 1rem',background:'var(--bg-2)',borderRadius:10,marginBottom:'1rem',border:'1px solid var(--border)' }}>
          <span style={{ fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:'.95rem' }}>{file?.name?.replace(/\.[^.]+$/,'')||'Untitled'}</span>
          <div style={{ display:'flex',gap:'1rem',fontSize:'.78rem',color:'var(--text-2)',fontFamily:"'Space Mono',monospace" }}>
            <span>♩ = {result?.metadata?.bpm||'?'}</span>
            <span>{result?.metadata?.key||'?'}</span>
            <span>4/4</span>
          </div>
        </div>
        {rows.map((row,ri) => (
          <div key={ri} style={{ marginBottom:'.75rem',position:'relative' }}>
            <span style={{ position:'absolute',left:-22,top:16,fontSize:'.62rem',color:'var(--text-3)',fontFamily:'monospace' }}>{ri*8+1}</span>
            {[12,24,36,48,60].map(yy => <div key={yy} style={{ position:'absolute',top:yy,left:0,right:0,height:1,background:'var(--border)',opacity:.35 }}/>)}
            <div style={{ display:'grid',gridTemplateColumns:`repeat(${row.length},1fr)`,gap:2,position:'relative',zIndex:1 }}>
              {row.map((c,ci) => {
                const col = CHORD_COLORS[(ri*8+ci)%CHORD_COLORS.length]
                return (
                  <div key={ci} style={{ background:'var(--bg-1)',border:`1px solid ${col}44`,borderTop:`3px solid ${col}`,borderRadius:8,padding:'.5rem .3rem',textAlign:'center',transition:'transform .15s' }}
                    onMouseEnter={e=>e.currentTarget.style.transform='translateY(-3px)'}
                    onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                    <div style={{ fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:'.95rem',color:col }}>{c.name}</div>
                    <div style={{ fontSize:'.58rem',color:'var(--text-3)',marginTop:2 }}>{c.time?.toFixed(1)}s</div>
                    <div style={{ height:3,background:'var(--bg-3)',borderRadius:2,marginTop:3,overflow:'hidden' }}>
                      <div style={{ height:'100%',width:`${(c.confidence||0)*100}%`,background:col,borderRadius:2 }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {result?.suggested_progressions?.length > 0 && (
          <div style={{ marginTop:'1rem',padding:'.85rem 1rem',background:'var(--bg-2)',borderRadius:10,border:'1px solid var(--border)' }}>
            <div style={{ fontSize:'.7rem',fontWeight:700,color:'var(--coral)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'.5rem' }}>Suggested Progressions</div>
            {result.suggested_progressions.map((p,i) => (
              <div key={i} style={{ fontSize:'.85rem',fontFamily:"'Space Mono',monospace",color:i===0?'var(--coral)':'var(--text)',padding:'.3rem',background:i===0?'rgba(255,107,71,.06)':'transparent',borderRadius:5,marginBottom:'.2rem' }}>
                <span style={{ color:'var(--text-3)',fontSize:'.7rem',marginRight:'.4rem' }}>#{i+1}</span>{p}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page-wrap page--extract" style={{ paddingTop:'2rem' }}>

      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom:'1.75rem' }}>
        <div className="page-header__badge">🎸 Chord Extraction</div>
        <h1 className="page-header__title">Extract Chords from Any Audio</h1>
        <p className="page-header__sub">
          Upload an audio or video file — get a full chord timeline, key detection, BPM, and PDF sheet music export.
          Filter by instrument and view in grid, timeline, or sheet music mode.
        </p>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'340px 1fr',gap:'1.5rem',alignItems:'start' }}>

        {/* ── LEFT PANEL ── */}
        <div style={{ display:'flex',flexDirection:'column',gap:'1rem' }}>

          {/* Upload zone */}
          <div>
            <div style={{ fontWeight:700,fontSize:'.82rem',color:'var(--text-2)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'.5rem' }}>
              1 · Upload File
            </div>
            <div
              className={`upload-zone ${dragging ? 'upload-zone--drag' : ''}`}
              onDragOver={e=>{e.preventDefault();setDragging(true)}}
              onDragLeave={()=>setDragging(false)}
              onDrop={onDrop}
              onClick={()=>inputRef.current?.click()}
              style={{ borderRadius:16 }}
            >
              <div className="upload-zone__icon" style={{ fontSize:'2rem' }}>{file ? '🎵' : '📂'}</div>
              <div className="upload-zone__title" style={{ fontSize:'.9rem' }}>{file ? file.name : 'Drop audio or video here'}</div>
              <div className="upload-zone__sub" style={{ fontSize:'.75rem' }}>
                {file ? `${(file.size/1024/1024).toFixed(2)} MB · ${fileType}` : 'MP3 WAV FLAC OGG AAC MP4 MOV — max 50 MB'}
              </div>
              <input ref={inputRef} type="file" accept={ACCEPTED} onChange={e=>pickFile(e.target.files?.[0])} style={{ position:'absolute',inset:0,opacity:0,cursor:'pointer' }}/>
            </div>
          </div>

          {/* Options */}
          <div className="card" style={{ padding:'1.1rem' }}>
            <div style={{ fontWeight:700,fontSize:'.82rem',color:'var(--text-2)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'.75rem' }}>
              2 · Options
            </div>
            <div className="form" style={{ gap:'.65rem' }}>
              <div className="form-group">
                <label className="form-label">File Type</label>
                <select className="form-select" value={fileType} onChange={e=>setFileType(e.target.value)}>
                  <option value="audio">Audio</option>
                  <option value="video">Video (extracts audio)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Min Confidence — {(minConf*100).toFixed(0)}%</label>
                <input type="range" min="0" max="1" step="0.05" value={minConf} onChange={e=>setMinConf(parseFloat(e.target.value))} />
                <span className="form-hint">Lower = more chords · Higher = more accurate</span>
              </div>
            </div>
          </div>

          {/* Instrument filter */}
          <div className="card" style={{ padding:'1.1rem' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.65rem' }}>
              <div style={{ fontWeight:700,fontSize:'.82rem',color:'var(--text-2)',textTransform:'uppercase',letterSpacing:'.05em' }}>
                3 · Instrument Filter
              </div>
              {availInstr.size > 1 && (
                <span style={{ fontSize:'.68rem',color:'var(--text-3)' }}>{availInstr.size-1} detected</span>
              )}
            </div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:'.35rem' }}>
              {INSTRUMENTS.filter(inst=>availInstr.has(inst.id)).map(inst => (
                <button key={inst.id} onClick={()=>setInstrument(inst.id)}
                  style={{ display:'flex',alignItems:'center',gap:'.28rem',padding:'.28rem .6rem',borderRadius:999,border:`1.5px solid ${instrument===inst.id?inst.color:'var(--border-hi)'}`,background:instrument===inst.id?`${inst.color}18`:'transparent',color:instrument===inst.id?inst.color:'var(--text-2)',fontSize:'.74rem',fontWeight:600,cursor:'pointer',transition:'all .18s',fontFamily:'inherit' }}>
                  {inst.icon} {inst.label}
                </button>
              ))}
            </div>
            {availInstr.size <= 1 && (
              <p style={{ fontSize:'.72rem',color:'var(--text-3)',marginTop:'.4rem' }}>Upload a file to detect instruments</p>
            )}
          </div>

          {/* Extract button */}
          <button className="btn btn--primary"
            onClick={handleSubmit}
            disabled={!file || uploading || isProcessing}
            style={{ padding:'.8rem',fontSize:'.95rem',justifyContent:'center',borderRadius:14 }}>
            {uploading
              ? <><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Uploading…</>
              : isProcessing
                ? <><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Processing…</>
                : '⚡ Extract Chords'
            }
          </button>

          {error && <div className="alert alert--error" style={{ fontSize:'.82rem' }}>{error}</div>}

          {/* Job status card */}
          {jobId && (
            <div className="card" style={{ padding:'.9rem' }}>
              <div style={{ display:'flex',alignItems:'center',gap:'.55rem',marginBottom:'.35rem' }}>
                <span style={{ fontWeight:700,fontSize:'.8rem' }}>Job Status</span>
                {jobStatus && (
                  <span className={`badge ${statusColors[jobStatus]||'badge--blue'}`} style={{ fontSize:'.65rem' }}>
                    {isProcessing && <span className="spinner" style={{width:8,height:8,borderWidth:1.5,marginRight:3}}/>}
                    {statusLabels[jobStatus]||jobStatus}
                  </span>
                )}
              </div>
              <div style={{ fontSize:'.68rem',color:'var(--text-3)',fontFamily:'monospace' }}>ID: {jobId.slice(0,16)}…</div>
              {isProcessing && (
                <div className="status-bar" style={{ marginTop:'.5rem' }}>
                  <div className="status-bar__fill" style={{ width:jobStatus==='started'?'65%':'20%' }}/>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL — Results ── */}
        <div style={{ display:'flex',flexDirection:'column',gap:'1rem' }}>

          {/* Empty state */}
          {!hasResult && !isProcessing && (
            <div className="card" style={{ textAlign:'center',padding:'4rem 2rem',color:'var(--text-3)' }}>
              <div style={{ fontSize:'3rem',marginBottom:'1rem' }}>🎼</div>
              <p style={{ fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:'1rem',color:'var(--text-2)',marginBottom:'.5rem' }}>Ready to extract</p>
              <p style={{ fontSize:'.82rem' }}>Upload a file on the left and click Extract</p>
              <div style={{ display:'flex',justifyContent:'center',gap:'1rem',flexWrap:'wrap',marginTop:'1.25rem' }}>
                {['MP3 WAV FLAC','Key + BPM detection','Chord timeline','PDF export'].map(t => (
                  <span key={t} style={{ fontSize:'.74rem',padding:'.2rem .55rem',borderRadius:6,background:'var(--bg-2)',border:'1px solid var(--border)' }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Processing state */}
          {isProcessing && (
            <div className="card" style={{ textAlign:'center',padding:'3rem' }}>
              <span className="spinner spinner--lg" style={{ display:'block',margin:'0 auto 1rem' }}/>
              <p style={{ fontWeight:700,marginBottom:'.3rem' }}>Analysing audio…</p>
              <p style={{ fontSize:'.82rem',color:'var(--text-3)' }}>Extracting chroma features · Detecting key · Estimating BPM</p>
            </div>
          )}

          {hasResult && (
            <>
              {/* Metadata row */}
              <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'.6rem' }}>
                {[
                  { label:'Key',      val:result.metadata?.key||'—',         icon:'🔑', color:'var(--coral)' },
                  { label:'BPM',      val:result.metadata?.bpm||'—',         icon:'♩',  color:'var(--amber)' },
                  { label:'Duration', val:fmtDur(result.metadata?.duration||0), icon:'⏱', color:'var(--cyan)' },
                  { label:'Chords',   val:filteredChords.length,              icon:'🎼', color:'var(--green)' },
                ].map(({ label,val,icon,color }) => (
                  <div key={label} style={{ background:'var(--bg-1)',border:'1px solid var(--border)',borderRadius:14,padding:'.9rem',textAlign:'center',transition:'all .2s' }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.transform='translateY(-2px)'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none'}}>
                    <div style={{ fontSize:'1.1rem',marginBottom:'.2rem' }}>{icon}</div>
                    <div style={{ fontFamily:"'Space Mono',monospace",fontSize:'1.05rem',fontWeight:700,color }}>{val}</div>
                    <div style={{ fontSize:'.66rem',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.04em' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Toolbar */}
              <div style={{ display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap' }}>
                {/* View switcher */}
                <div style={{ display:'flex',background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:10,padding:3,gap:2 }}>
                  {[['grid','⊞ Grid'],['timeline','↔ Timeline'],['sheet','♩ Sheet']].map(([v,l]) => (
                    <button key={v} onClick={()=>setView(v)} style={{ padding:'.28rem .65rem',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.74rem',transition:'all .18s',background:view===v?'var(--coral)':'transparent',color:view===v?'#fff':'var(--text-2)' }}>{l}</button>
                  ))}
                </div>

                {/* Active instrument badge */}
                {instrument !== 'all' && (
                  <div style={{ display:'flex',alignItems:'center',gap:'.4rem',padding:'.25rem .65rem',borderRadius:999,background:'rgba(255,107,71,.08)',border:'1px solid rgba(255,107,71,.22)',fontSize:'.75rem',color:'var(--coral)' }}>
                    {INSTRUMENTS.find(i=>i.id===instrument)?.icon} {INSTRUMENTS.find(i=>i.id===instrument)?.label}
                    <span style={{ color:'var(--text-3)',fontSize:'.68rem' }}>({filteredChords.length}/{result.chords?.length})</span>
                    <button onClick={()=>setInstrument('all')} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',fontSize:'.7rem',padding:'0 0 0 .2rem' }}>×</button>
                  </div>
                )}

                {/* Downloads */}
                <div style={{ marginLeft:'auto',display:'flex',gap:'.35rem' }}>
                  <button className="btn btn--sm btn--secondary" onClick={handleCSV} title="Download CSV">↓ CSV</button>
                  <button className="btn btn--sm btn--secondary" onClick={handleJSON} title="Download JSON">↓ JSON</button>
                  <button className="btn btn--sm btn--primary" onClick={handlePDF} disabled={pdfLoading} title="Download PDF sheet music">
                    {pdfLoading?<><span className="spinner" style={{width:10,height:10,borderWidth:1.5}}/> …</>:'⬇ PDF Sheet'}
                  </button>
                </div>
              </div>

              {/* Main chord view */}
              <div className="card" style={{ padding:view==='sheet'?'1.5rem':'1.25rem',overflow:'auto' }}>

                {view === 'grid' && (
                  <>
                    <div style={{ fontWeight:700,fontSize:'.875rem',marginBottom:'.85rem' }}>
                      Chord Timeline
                      <span style={{ fontWeight:400,color:'var(--text-3)',fontSize:'.78rem',marginLeft:'.5rem' }}>{filteredChords.length} chords</span>
                    </div>
                    <div className="chord-grid">
                      {filteredChords.map((c,i) => {
                        const col = CHORD_COLORS[i%CHORD_COLORS.length]
                        return (
                          <div key={i} className="chord-pill" style={{ borderColor:`${col}44`,borderTopColor:col,borderTopWidth:2 }}>
                            <span className="chord-pill__name" style={{ color:col }}>{c.name}</span>
                            <span className="chord-pill__time">{c.time?.toFixed(1)}s</span>
                            <span className="chord-pill__conf">{(c.confidence*100).toFixed(0)}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {view === 'timeline' && (
                  <>
                    <div style={{ fontWeight:700,fontSize:'.875rem',marginBottom:'.85rem' }}>
                      Timeline — {fmtDur(result.metadata?.duration||0)} total
                    </div>
                    <div style={{ position:'relative',height:80,background:'var(--bg-2)',borderRadius:10,overflow:'hidden',marginBottom:'.6rem' }}>
                      {filteredChords.map((c,i) => {
                        const dur = result.metadata?.duration||1
                        const left  = (c.time/dur)*100
                        const width = Math.max(((c.end_time||c.time+1)-c.time)/dur*100, 0.8)
                        const col   = CHORD_COLORS[i%CHORD_COLORS.length]
                        return (
                          <div key={i} title={`${c.name} @ ${c.time?.toFixed(1)}s`}
                            style={{ position:'absolute',left:`${left}%`,width:`${width}%`,top:8,height:64,background:`${col}22`,borderLeft:`2px solid ${col}`,borderRadius:'0 4px 4px 0',display:'flex',flexDirection:'column',justifyContent:'center',paddingLeft:3,overflow:'hidden',cursor:'default',transition:'background .15s' }}
                            onMouseEnter={e=>e.currentTarget.style.background=`${col}44`}
                            onMouseLeave={e=>e.currentTarget.style.background=`${col}22`}>
                            <span style={{ fontSize:'.72rem',fontWeight:800,color:col,fontFamily:"'Space Mono',monospace",whiteSpace:'nowrap' }}>{c.name}</span>
                            <span style={{ fontSize:'.56rem',color:'var(--text-3)',whiteSpace:'nowrap' }}>{c.time?.toFixed(1)}s</span>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ display:'flex',justifyContent:'space-between',fontSize:'.63rem',color:'var(--text-3)',fontFamily:'monospace',paddingInline:2 }}>
                      {Array.from({length:9},(_,i) => <span key={i}>{fmtDur((result.metadata?.duration||0)*i/8)}</span>)}
                    </div>
                  </>
                )}

                {view === 'sheet' && <SheetView />}
              </div>

              {/* Progressions */}
              {result.suggested_progressions?.length > 0 && view !== 'sheet' && (
                <div className="card" style={{ padding:'1.25rem' }}>
                  <div style={{ fontWeight:700,fontSize:'.875rem',marginBottom:'.7rem' }}>🎵 Suggested Progressions</div>
                  {result.suggested_progressions.map((p,i) => (
                    <div key={i} style={{ padding:'.5rem .75rem',borderRadius:10,marginBottom:'.4rem',background:i===0?'rgba(255,107,71,.06)':'var(--bg-2)',border:`1px solid ${i===0?'rgba(255,107,71,.22)':'var(--border)'}`,fontFamily:"'Space Mono',monospace",fontSize:'.87rem',color:i===0?'var(--coral)':'var(--text)',display:'flex',alignItems:'center',gap:'.65rem' }}>
                      <span style={{ color:'var(--text-3)',fontSize:'.7rem' }}>#{i+1}</span> {p}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width:900px) {
          .page-wrap > div[style*="grid-template-columns: 340px"] { grid-template-columns:1fr !important; }
        }
      `}</style>
    </div>
  )
}
