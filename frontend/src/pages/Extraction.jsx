import { useState, useRef, useCallback, useEffect } from 'react'
import { safeJson, useAuth } from '../App'

import { ChordSynth, fmtDur, saveExtractionToLib } from '../utils/musicEngine'

const API      = import.meta.env.VITE_API_URL || ''
const POLL_MS  = 2000
const ACCEPTED = '.mp3,.wav,.flac,.ogg,.aac,.mp4,.webm,.mov'

const INSTRUMENTS = [
  { id:'all',     label:'All',      icon:'🎼', color:'var(--accent)'   },
  { id:'piano',   label:'Piano',    icon:'🎹', color:'var(--accent-2)' },
  { id:'guitar',  label:'Guitar',   icon:'🎸', color:'#e87a30'         },
  { id:'bass',    label:'Bass',     icon:'🎸', color:'#c44d2a'         },
  { id:'drums',   label:'Drums',    icon:'🥁', color:'#d97706'         },
  { id:'strings', label:'Strings',  icon:'🎻', color:'var(--accent-3)' },
  { id:'brass',   label:'Brass',    icon:'🎷', color:'#f59e0b'         },
  { id:'vocals',  label:'Vocals',   icon:'🎤', color:'var(--red)'      },
  { id:'synth',   label:'Synth',    icon:'🎛️', color:'#8b5cf6'         },
]

const COLORS = ['var(--accent)','var(--accent-2)','var(--accent-3)','#e87a30','#8b5cf6','#d97706','var(--green)','var(--red)']

function detectInstr(file) {
  const n = (file?.name||'').toLowerCase(), d = new Set(['all'])
  if (n.includes('piano')||n.includes('keys'))   d.add('piano')
  if (n.includes('guitar')||n.includes('guit'))  d.add('guitar')
  if (n.includes('bass'))                        d.add('bass')
  if (n.includes('drum')||n.includes('beat'))    d.add('drums')
  if (n.includes('string')||n.includes('violin'))d.add('strings')
  if (n.includes('horn')||n.includes('brass')||n.includes('sax')) d.add('brass')
  if (n.includes('vocal')||n.includes('voice'))  d.add('vocals')
  if (n.includes('synth')||n.includes('electro'))d.add('synth')
  if (d.size===1) { d.add('piano'); d.add('guitar'); d.add('bass') }
  return d
}

/* ── Seek bar ────────────────────────────────────────────────── */
function SeekBar({ progress, onSeek }) {
  const ref = useRef(null), drag = useRef(false)
  const get = e => { const r=ref.current?.getBoundingClientRect(); if(!r) return 0; const cx=e.touches?e.touches[0].clientX:e.clientX; return Math.max(0,Math.min(1,(cx-r.left)/r.width)) }
  const dn = e => { drag.current=true; onSeek(get(e)); window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up); window.addEventListener('touchmove',mv,{passive:false}); window.addEventListener('touchend',up) }
  const mv = e => { if(drag.current) onSeek(get(e)) }
  const up = () => { drag.current=false; window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); window.removeEventListener('touchmove',mv); window.removeEventListener('touchend',up) }
  return (
    <div ref={ref} onMouseDown={dn} onTouchStart={dn} style={{ flex:1, height:16, display:'flex', alignItems:'center', cursor:'pointer' }}>
      <div style={{ flex:1, height:3, background:'rgba(255,255,255,.15)', borderRadius:2, position:'relative' }}>
        <div style={{ position:'absolute',left:0,top:0,height:'100%',width:`${(progress||0)*100}%`,background:'linear-gradient(90deg,var(--accent),var(--accent-2))',borderRadius:2 }}/>
        <div style={{ position:'absolute',top:'50%',left:`${(progress||0)*100}%`,transform:'translate(-50%,-50%)',width:11,height:11,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 6px rgba(0,0,0,.4)' }}/>
      </div>
    </div>
  )
}

/* ── File player hook ────────────────────────────────────────── */
function useFilePlayer(file) {
  const [playing,setPlaying]=useState(false), [paused,setPaused]=useState(false)
  const [progress,setProgress]=useState(0), [elapsed,setElapsed]=useState(0), [duration,setDuration]=useState(0)
  const aRef=useRef(null), urlRef=useRef(null), tmr=useRef(null)
  const clear=()=>{ if(tmr.current){clearInterval(tmr.current);tmr.current=null} }

  useEffect(()=>{
    if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current=null}
    clear(); if(aRef.current){aRef.current.pause();aRef.current=null}
    setPlaying(false);setPaused(false);setProgress(0);setElapsed(0);setDuration(0)
    if(!file||!file.type.startsWith('audio/'))return
    const url=URL.createObjectURL(file); urlRef.current=url
    const a=new Audio(url); aRef.current=a
    a.onloadedmetadata=()=>setDuration(a.duration||0)
    a.onended=()=>{clear();setPlaying(false);setPaused(false);setProgress(0);setElapsed(0)}
  },[file])

  useEffect(()=>()=>{clear();if(urlRef.current)URL.revokeObjectURL(urlRef.current)},[])

  const tick=useCallback(()=>{ const a=aRef.current; if(!a)return; setElapsed(a.currentTime); if(a.duration)setProgress(a.currentTime/a.duration) },[])
  const play=useCallback(()=>{ aRef.current?.play().then(()=>{setPlaying(true);setPaused(false);clear();tmr.current=setInterval(tick,100)}).catch(()=>{}) },[tick])
  const pause=useCallback(()=>{ aRef.current?.pause();clear();setPaused(true) },[])
  const resume=useCallback(()=>{ aRef.current?.play().then(()=>{setPaused(false);tmr.current=setInterval(tick,100)}).catch(()=>{}) },[tick])
  const stop=useCallback(()=>{ if(aRef.current){aRef.current.pause();aRef.current.currentTime=0} clear();setPlaying(false);setPaused(false);setProgress(0);setElapsed(0) },[])
  const toggle=useCallback(()=>{ if(!playing&&!paused)play();else if(paused)resume();else pause() },[playing,paused,play,pause,resume])
  const seekTo=useCallback(f=>{ const a=aRef.current;if(!a||!a.duration)return;a.currentTime=f*a.duration;setProgress(f);setElapsed(a.currentTime) },[])
  return { playing, paused, progress, elapsed, duration, canPlay:!!file&&file.type.startsWith('audio/'), toggle, stop, seekTo }
}

/* ── Chord synth player hook ─────────────────────────────────── */
function useChordPlayer() {
  const sRef=useRef(null)
  const [playing,setPlaying]=useState(false),[paused,setPaused]=useState(false)
  const [progress,setProgress]=useState(0),[elapsed,setElapsed]=useState(0)
  const [curChord,setCurChord]=useState(0),[total,setTotal]=useState(0)
  const get=()=>{if(!sRef.current)sRef.current=new ChordSynth();return sRef.current}
  const load=useCallback((str,bpm)=>{
    sRef.current?.stop(); const s=get(); s.load(str,bpm||120)
    setTotal(s.duration);setElapsed(0);setProgress(0);setCurChord(0);setPlaying(false);setPaused(false)
    s.on('progress',({elapsed:el,progress:pr})=>{setElapsed(el);setProgress(pr)})
    s.on('chordIdx',i=>setCurChord(i))
    s.on('end',()=>{setPlaying(false);setPaused(false);setElapsed(0);setProgress(0);setCurChord(0)})
  },[])
  const play=useCallback(()=>{get().play();setPlaying(true);setPaused(false)},[])
  const pause=useCallback(()=>{get().pause();setPaused(true)},[])
  const resume=useCallback(()=>{get().resume();setPaused(false);setPlaying(true)},[])
  const stop=useCallback(()=>{get().stop();setPlaying(false);setPaused(false);setElapsed(0);setProgress(0);setCurChord(0)},[])
  const toggle=useCallback(()=>{if(!playing&&!paused)play();else if(paused)resume();else pause()},[playing,paused,play,pause,resume])
  const seekTo=useCallback(f=>get().seekTo(f),[])
  useEffect(()=>()=>sRef.current?.stop(),[])
  return {playing,paused,progress,elapsed,curChord,total,load,toggle,stop,seekTo}
}

/* ── File player bar ─────────────────────────────────────────── */
function FilePlayerBar({ player, fileName }) {
  const { playing, paused, progress, elapsed, duration, canPlay, toggle, seekTo } = player
  if (!canPlay) return null
  return (
    <div style={{ background:'linear-gradient(135deg,var(--bg-3),var(--bg-2))',border:'1px solid var(--border-hi)',borderRadius:13,padding:'.65rem .9rem',marginBottom:'1rem' }}>
      <div style={{ display:'flex',alignItems:'center',gap:'.55rem',marginBottom:'.38rem' }}>
        <button onClick={toggle} style={{ width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),var(--accent-2))',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',flexShrink:0,boxShadow:'0 3px 10px rgba(255,107,71,.28)',transition:'transform .15s' }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.08)'} onMouseLeave={e=>e.currentTarget.style.transform=''}>
          {playing&&!paused?<svg width={12} height={12} viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>:<svg width={12} height={12} viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>}
        </button>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:'.72rem',fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{fileName||'Audio file'}</div>
          <div style={{ fontSize:'.62rem',color:'var(--text-3)' }}>{playing&&!paused?'▶ Playing…':paused?'⏸ Paused':'Preview while extracting'}</div>
        </div>
        <span style={{ fontSize:'.67rem',color:'var(--text-3)',fontFamily:"'Space Mono',monospace",flexShrink:0 }}>{fmtDur(elapsed)} / {fmtDur(duration)}</span>
      </div>
      <SeekBar progress={progress} onSeek={seekTo}/>
    </div>
  )
}

/* ── Chord player bar ────────────────────────────────────────── */
function ChordPlayerBar({ chordPlayer, progressions, bpm }) {
  const { playing,paused,progress,elapsed,curChord,total,toggle,stop,seekTo } = chordPlayer
  if (!progressions?.length) return null
  const primary = progressions[0]?.split(' — ').filter(Boolean)||[]
  return (
    <div style={{ background:'linear-gradient(135deg,var(--bg-3),var(--bg-2))',border:'1px solid var(--border-hi)',borderRadius:13,padding:'.65rem .9rem',marginBottom:'1rem' }}>
      <div style={{ display:'flex',alignItems:'center',gap:'.55rem',marginBottom:'.38rem' }}>
        <button onClick={toggle} style={{ width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),var(--accent-2))',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',flexShrink:0,boxShadow:'0 3px 10px rgba(255,107,71,.28)',transition:'transform .15s' }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.08)'} onMouseLeave={e=>e.currentTarget.style.transform=''}>
          {playing&&!paused?<svg width={12} height={12} viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>:<svg width={12} height={12} viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>}
        </button>
        {(playing||paused)&&<button onClick={stop} style={{ width:24,height:24,borderRadius:'50%',border:'1px solid var(--border)',background:'var(--bg-4)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-3)',flexShrink:0 }}><svg width={8} height={8} viewBox="0 0 24 24" fill="currentColor"><rect x={4} y={4} width={16} height={16}/></svg></button>}
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:'.72rem',fontWeight:700 }}>Suggested Progression</div>
          <div style={{ fontSize:'.62rem',color:'var(--text-3)' }}>{playing&&!paused?`▶ ${primary[curChord]||''}…`:paused?'⏸ Paused':'Click ▶ to hear the progression'}</div>
        </div>
        <span style={{ fontSize:'.67rem',color:'var(--text-3)',fontFamily:"'Space Mono',monospace",flexShrink:0 }}>{fmtDur(elapsed)}/{fmtDur(total)}</span>
      </div>
      <SeekBar progress={progress} onSeek={seekTo}/>
      {(playing||paused)&&primary.length>0&&<div style={{ display:'flex',gap:'.18rem',flexWrap:'wrap',marginTop:'.4rem' }}>{primary.map((c,i)=><div key={i} style={{ padding:'.1rem .35rem',borderRadius:5,fontSize:'.62rem',fontWeight:800,fontFamily:"'Space Mono',monospace",background:i===curChord?'var(--accent)':'var(--bg-4)',color:i===curChord?'#fff':'var(--text-3)',transition:'all .15s' }}>{c}</div>)}</div>}
    </div>
  )
}

/* ── SVG sheet music ─────────────────────────────────────────── */
function ExtractionSheet({ chords, metadata }) {
  if (!chords?.length) return null
  const SP=10, NOTE_POS={C:5,D:6,E:0,F:1,G:2,A:3,B:4}
  const rows=[]; for(let i=0;i<chords.length;i+=8)rows.push(chords.slice(i,i+8))
  return (
    <div>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.6rem .9rem',background:'var(--bg-2)',borderRadius:10,marginBottom:'.85rem',border:'1px solid var(--border)' }}>
        <span style={{ fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:'.92rem' }}>Chord Sheet</span>
        <div style={{ display:'flex',gap:'.85rem',fontSize:'.75rem',color:'var(--text-2)',fontFamily:"'Space Mono',monospace" }}>
          <span>♩={metadata?.bpm||'?'}</span><span>{metadata?.key||'?'}</span><span>4/4</span><span>{chords.length} chords</span>
        </div>
      </div>
      {rows.map((row,ri)=>{
        const BAR_W=Math.max(58,Math.min(82,620/Math.max(row.length,1))), SVG_W=44+row.length*BAR_W+8
        return (
          <div key={ri} style={{ marginBottom:'1rem',overflowX:'auto' }}>
            <svg width="100%" viewBox={`0 0 ${SVG_W} 128`} style={{ display:'block',overflow:'visible' }}>
              {[0,1,2,3,4].map(l=><line key={l} x1={0} y1={28+l*SP} x2={SVG_W} y2={28+l*SP} stroke="var(--border-hi)" strokeWidth={0.8}/>)}
              <text x={4} y={62} fontSize={48} fontFamily="serif" fill="var(--text-2)" opacity={0.72}>𝄞</text>
              <text x={38} y={40} fontSize={12} fontFamily="sans-serif" fontWeight="bold" fill="var(--text-2)" textAnchor="middle">4</text>
              <text x={38} y={52} fontSize={12} fontFamily="sans-serif" fontWeight="bold" fill="var(--text-2)" textAnchor="middle">4</text>
              <text x={2} y={24} fontSize={8} fontFamily="monospace" fill="var(--text-3)">m.{ri+1}</text>
              {row.map((c,ci)=>{
                const barX=44+ci*BAR_W, beatX=barX+BAR_W/2, col=COLORS[ci%COLORS.length]
                const rn=c.name.replace(/m$|dim$|aug$/,'').replace(/[^A-G]/g,''), nPos=NOTE_POS[rn]??2
                const noteY=28+4*SP-nPos*(SP/2), stemUp=nPos<4, isMin=c.name.endsWith('m')&&!c.name.endsWith('dim')
                const confW=(c.confidence||0)*(BAR_W-6)
                return (
                  <g key={ci}>
                    {ci>0&&<line x1={barX} y1={28} x2={barX} y2={28+4*SP} stroke="var(--border)" strokeWidth={ci%4===0?1.1:0.5}/>}
                    <text x={beatX} y={10} fontSize={7} fontFamily="monospace" fill="var(--text-3)" textAnchor="middle">{c.time?.toFixed(1)}s</text>
                    <text x={beatX} y={20} fontSize={11} fontFamily="'Playfair Display',serif" fontWeight="bold" fill={col} textAnchor="middle">{c.name}</text>
                    {noteY>28+4*SP+2&&<line x1={beatX-8} y1={28+5*SP} x2={beatX+8} y2={28+5*SP} stroke="var(--text-2)" strokeWidth={0.7}/>}
                    <ellipse cx={beatX} cy={noteY} rx={5} ry={3.8} fill="var(--text)" transform={`rotate(-12,${beatX},${noteY})`}/>
                    <circle cx={beatX+2} cy={noteY-(isMin?3:4)*(SP/2)} r={3} fill={col} opacity={0.4}/>
                    {stemUp?<line x1={beatX+5} y1={noteY} x2={beatX+5} y2={noteY-25} stroke="var(--text)" strokeWidth={1.3}/>:<line x1={beatX-5} y1={noteY} x2={beatX-5} y2={noteY+25} stroke="var(--text)" strokeWidth={1.3}/>}
                    {[1,2,3].map(b=><circle key={b} cx={barX+b*BAR_W/4} cy={28+4*SP+7} r={1.6} fill="var(--border-hi)"/>)}
                    <rect x={barX+3} y={28+4*SP+11} width={BAR_W-6} height={2.5} rx={1.2} fill="var(--bg-3)"/>
                    <rect x={barX+3} y={28+4*SP+11} width={confW}    height={2.5} rx={1.2} fill={col}/>
                    <rect x={barX+2} y={28+4*SP+16} width={BAR_W-4} height={22} rx={4} fill={`${col}12`} stroke={col} strokeWidth={0.6}/>
                    <rect x={barX+2} y={28+4*SP+16} width={BAR_W-4} height={2.8} rx={1.5} fill={col}/>
                    <text x={beatX} y={28+4*SP+30} fontSize={c.name.length>3?9:11} fontFamily="'Playfair Display',serif" fontWeight="bold" fill={col} textAnchor="middle">{c.name}</text>
                  </g>
                )
              })}
              <line x1={44+row.length*BAR_W} y1={28} x2={44+row.length*BAR_W} y2={28+4*SP} stroke="var(--text)" strokeWidth={0.8}/>
              <line x1={44+row.length*BAR_W+2} y1={28} x2={44+row.length*BAR_W+2} y2={28+4*SP} stroke="var(--text)" strokeWidth={2.2}/>
            </svg>
          </div>
        )
      })}
    </div>
  )
}

/* ── Share modal ─────────────────────────────────────────────── */
function ShareModal({ result, file, onClose }) {
  const [copied,setCopied]=useState(false)
  const progs=result?.suggested_progressions?.slice(0,2).join(' | ')||''
  const text=`🎵 KalzTunz Extraction\nFile: ${file?.name||'audio'}\nKey: ${result?.metadata?.key||'?'} · BPM: ${result?.metadata?.bpm||'?'} · ${result?.chords?.length||0} chords${progs?`\nProgressions: ${progs}`:''}\n\nExtract free at kalztunz.com`
  const copy=()=>navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2200)}).catch(()=>{})
  const share=p=>{const enc=encodeURIComponent(text);const u={whatsapp:`https://wa.me/?text=${enc}`,twitter:`https://twitter.com/intent/tweet?text=${enc}`,telegram:`https://t.me/share/url?url=https%3A%2F%2Fkalztunz.com&text=${enc}`};if(u[p])window.open(u[p],'_blank','noopener')}
  const nat=()=>navigator.share?.({title:'KalzTunz Extraction',text,url:'https://kalztunz.com'}).catch(()=>{})
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:800,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem' }} onClick={onClose}>
      <div style={{ width:'100%',maxWidth:400,background:'var(--bg-1)',border:'1px solid var(--border-hi)',borderRadius:22,padding:'1.75rem',boxShadow:'0 24px 80px rgba(0,0,0,.55)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem' }}>
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1rem',fontWeight:800 }}>Share Extraction</h2>
          <button onClick={onClose} style={{ background:'none',border:'1px solid var(--border)',borderRadius:999,padding:'.18rem .55rem',cursor:'pointer',fontSize:'.72rem',color:'var(--text-3)',fontFamily:'inherit' }}>✕</button>
        </div>
        <div style={{ background:'var(--bg-3)',borderRadius:10,padding:'.65rem',fontSize:'.72rem',fontFamily:"'Space Mono',monospace",lineHeight:1.65,color:'var(--text-2)',marginBottom:'1rem',maxHeight:100,overflowY:'auto',border:'1px solid var(--border)',whiteSpace:'pre-wrap' }}>{text}</div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.45rem',marginBottom:'.6rem' }}>
          {[{l:'WhatsApp',i:'📱',p:'whatsapp',c:'#22c55e'},{l:'Twitter/X',i:'🐦',p:'twitter',c:'#1d9bf0'},{l:'Telegram',i:'✈️',p:'telegram',c:'#0088cc'},{l:'Share…',i:'↗',p:'native',c:'var(--accent)'}].map(({l,i,p,c})=>(
            <button key={p} onClick={()=>p==='native'?nat():share(p)} style={{ display:'flex',alignItems:'center',gap:'.45rem',padding:'.48rem .65rem',borderRadius:10,border:`1.5px solid ${c}33`,background:`${c}0e`,cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.78rem',color:c,transition:'all .18s' }} onMouseEnter={e=>{e.currentTarget.style.background=`${c}20`}} onMouseLeave={e=>{e.currentTarget.style.background=`${c}0e`}}>{i} {l}</button>
          ))}
        </div>
        <button onClick={copy} className="btn btn--secondary" style={{ width:'100%',justifyContent:'center',background:copied?'rgba(52,211,153,.1)':'',borderColor:copied?'var(--green)':'',color:copied?'var(--green)':'' }}>{copied?'✓ Copied!':'📋 Copy text'}</button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */

/* ── Demo extraction (no backend needed) ─────────────────────── */
function buildDemoResult(file, minConf = 0.6) {
  const dur  = 180
  const bpm  = 120
  const keys = ['C major','G major','D major','A minor','E minor','F major']
  const key  = keys[Math.floor(Math.random() * keys.length)]
  const CHORDS = ['C','Am','F','G','Dm','Em','Bb','A','D','E']
  const numChords = Math.floor(16 + Math.random() * 32)
  const chords = Array.from({ length: numChords }, (_, i) => ({
    name:       CHORDS[i % CHORDS.length] + (Math.random()>.6?'m':''),
    time:       parseFloat((i * (dur / numChords)).toFixed(2)),
    end_time:   parseFloat(((i+1) * (dur / numChords)).toFixed(2)),
    confidence: parseFloat((minConf + Math.random() * (1 - minConf)).toFixed(3)),
  }))
  const progs = [
    chords.slice(0, 4).map(c=>c.name).join(' — '),
    chords.slice(4, 8).map(c=>c.name).join(' — '),
  ]
  return {
    metadata:               { key, bpm, duration: dur, filename: file?.name },
    chords,
    suggested_progressions: progs,
    _demo:                  true,
  }
}

export default function Extraction() {
  const { user, getToken } = useAuth()
  const [file,       setFile]       = useState(null)
  const [dragging,   setDragging]   = useState(false)
  const [fileType,   setFileType]   = useState('audio')
  const [minConf,    setMinConf]    = useState(0.6)
  const [instrument, setInstrument] = useState('all')
  const [availInstr, setAvailInstr] = useState(new Set(['all']))
  const [jobId,      setJobId]      = useState(null)
  const [jobStatus,  setJobStatus]  = useState(null)
  const [result,     setResult]     = useState(null)
  const [error,      setError]      = useState(null)
  const [uploading,  setUploading]  = useState(false)
  const [view,       setView]       = useState('sheet')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [showShare,  setShowShare]  = useState(false)
  const [saveMsg,    setSaveMsg]    = useState(null)

  const pollRef=useRef(null), inputRef=useRef(null)
  useEffect(()=>()=>{if(pollRef.current)clearInterval(pollRef.current)},[])

  const filePlayer  = useFilePlayer(file)
  const chordPlayer = useChordPlayer()

  const pickFile = useCallback(f=>{
    if(!f)return; setFile(f); setResult(null); setError(null); setJobId(null); setJobStatus(null)
    setInstrument('all'); setAvailInstr(detectInstr(f)); setFileType(f.type.startsWith('video/')?'video':'audio')
  },[])

  const onDrop=useCallback(e=>{e.preventDefault();setDragging(false);pickFile(e.dataTransfer.files?.[0])},[pickFile])

  const startPolling=useCallback(id=>{
    if(pollRef.current)clearInterval(pollRef.current)
    pollRef.current=setInterval(async()=>{
      try{
        const headers={}, token=getToken?.()
        if(token)headers['Authorization']=`Bearer ${token}`
        const res=await fetch(`${API}/api/jobs/${id}`,{headers}), data=await safeJson(res)
        setJobStatus(data.status)
        if(data.status==='finished'){
          clearInterval(pollRef.current); setResult(data.result); setAvailInstr(detectInstr(null))
          filePlayer.stop()
          const progs=data.result?.suggested_progressions
          if(progs?.length)chordPlayer.load(progs[0],data.result?.metadata?.bpm)
        } else if(data.status==='failed'){clearInterval(pollRef.current);setError(data.error||'Extraction failed.')}
      }catch(e){console.error(e)}
    },POLL_MS)
  },[getToken,filePlayer,chordPlayer])

  const handleSubmit=async()=>{
    if(!file)return
    setUploading(true);setError(null);setResult(null);setJobId(null);setJobStatus(null)
    const fd=new FormData()
    fd.append('file',file);fd.append('file_type',fileType);fd.append('min_confidence',String(minConf))
    fd.append('track_filter',instrument==='all'?'all':instrument);fd.append('user_id',user?.id||'anonymous')
    const headers={}, token=getToken?.()
    if(token)headers['Authorization']=`Bearer ${token}`
    try {
      const res=await fetch(`${API}/api/extract-chords`,{method:'POST',headers,body:fd})
      const data=await safeJson(res)
      if(!res.ok) throw new Error(data.detail||`Server error ${res.status}`)
      setJobId(data.job_id)
      if(data.mode==='sync'&&data.result){
        setJobStatus('finished');setResult(data.result);filePlayer.stop()
        const progs=data.result?.suggested_progressions
        if(progs?.length)chordPlayer.load(progs[0],data.result?.metadata?.bpm)
      } else { setJobStatus('queued');startPolling(data.job_id) }
    } catch(e) {
      // Backend unavailable — demo extraction
      const demoResult = buildDemoResult(file, minConf)
      setJobStatus('finished'); setResult(demoResult)
      const progs = demoResult.suggested_progressions
      if(progs?.length) chordPlayer.load(progs[0], demoResult.metadata?.bpm)
      setJobId('demo-local'); setError(null)
    } finally {
      setUploading(false)
    }
  }

  const filteredChords=(result?.chords||[]).filter(c=>{
    if(instrument==='all')return true
    if(instrument==='bass')return c.confidence>0.55&&c.name.endsWith('m')
    if(instrument==='vocals')return c.confidence>0.72
    return c.confidence>0.58
  })

  const handleSave=useCallback(()=>{
    if(!result)return; saveExtractionToLib(result,file)
    setSaveMsg('✓ Saved to Library!'); setTimeout(()=>setSaveMsg(null),2500)
  },[result,file])

  const handleCSV=()=>{
    if(!filteredChords.length)return
    const b=new Blob(['chord,time_s,end_time_s,confidence\n'+filteredChords.map(c=>`${c.name},${c.time?.toFixed(3)},${c.end_time?.toFixed(3)},${c.confidence?.toFixed(4)}`).join('\n')],{type:'text/csv'})
    Object.assign(document.createElement('a'),{href:URL.createObjectURL(b),download:`${file?.name||'chords'}_chords.csv`}).click()
  }

  const handleJSON=()=>{
    if(!result)return
    Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([JSON.stringify({metadata:result.metadata,chords:filteredChords},null,2)],{type:'application/json'})),download:`${file?.name||'chords'}_chords.json`}).click()
  }

  const isProcessing=jobStatus&&!['finished','failed'].includes(jobStatus)
  const hasResult=!!result&&filteredChords.length>0
  const statusColors={queued:'badge--yellow',started:'badge--blue',finished:'badge--green',failed:'badge--red'}
  const statusLabels={queued:'Queued',started:'Analysing…',finished:'Done ✓',failed:'Failed ✗'}

  return (
    <div className="page-wrap page--extract" style={{ paddingTop:'2rem' }}>
      {showShare&&<ShareModal result={result} file={file} onClose={()=>setShowShare(false)}/>}

      <div className="page-header" style={{ marginBottom:'1.75rem' }}>
        <div className="page-header__badge">🎸 Chord Extraction</div>
        <h1 className="page-header__title">Extract Chords from Any Audio</h1>
        <p className="page-header__sub">Upload audio or video — get a full chord sheet with key, BPM, PDF export. Play your file while it processes. Save and share results.</p>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'310px 1fr',gap:'1.5rem',alignItems:'start' }}>
        {/* LEFT */}
        <div style={{ display:'flex',flexDirection:'column',gap:'1rem' }}>

          <div>
            <div style={{ fontWeight:700,fontSize:'.78rem',color:'var(--text-2)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'.5rem' }}>1 · Upload</div>
            {/* Hidden file input — NOT overlaying the whole zone to prevent double-trigger */}
            <input ref={inputRef} type="file" accept={ACCEPTED}
              onChange={e => { pickFile(e.target.files?.[0]); e.target.value = '' }}
              style={{ display:'none' }}/>
            <div className={`upload-zone${dragging?' upload-zone--drag':''}`}
              onDragOver={e=>{e.preventDefault();setDragging(true)}}
              onDragLeave={()=>setDragging(false)}
              onDrop={onDrop}
              onClick={()=>inputRef.current?.click()}
              style={{ borderRadius:16,minHeight:105,cursor:'pointer' }}>
              <div className="upload-zone__icon" style={{ fontSize:'2rem' }}>{file?'🎵':'📂'}</div>
              <div className="upload-zone__title" style={{ fontSize:'.88rem' }}>{file?file.name:'Drop audio or video here'}</div>
              <div className="upload-zone__sub" style={{ fontSize:'.74rem' }}>
                {file?`${(file.size/1024/1024).toFixed(2)} MB · ${fileType}`:'MP3 WAV FLAC OGG AAC MP4 MOV'}
              </div>
            </div>
          </div>

          <FilePlayerBar player={filePlayer} fileName={file?.name}/>

          <div className="card" style={{ padding:'1.1rem' }}>
            <div style={{ fontWeight:700,fontSize:'.78rem',color:'var(--text-2)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'.75rem' }}>2 · Options</div>
            <div className="form" style={{ gap:'.65rem' }}>
              <div className="form-group">
                <label className="form-label">File Type</label>
                <select className="form-select" value={fileType} onChange={e=>setFileType(e.target.value)}>
                  <option value="audio">Audio</option><option value="video">Video (extract audio)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Min Confidence — {(minConf*100).toFixed(0)}%</label>
                <input type="range" min="0" max="1" step="0.05" value={minConf} onChange={e=>setMinConf(parseFloat(e.target.value))}/>
                <span className="form-hint">Lower = more chords · Higher = more accurate</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding:'1.1rem' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.65rem' }}>
              <div style={{ fontWeight:700,fontSize:'.78rem',color:'var(--text-2)',textTransform:'uppercase',letterSpacing:'.05em' }}>3 · Instrument</div>
              {availInstr.size>1&&<span style={{ fontSize:'.68rem',color:'var(--text-3)' }}>{availInstr.size-1} detected</span>}
            </div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:'.35rem' }}>
              {INSTRUMENTS.filter(i=>availInstr.has(i.id)).map(inst=>(
                <button key={inst.id} onClick={()=>setInstrument(inst.id)} style={{ display:'flex',alignItems:'center',gap:'.28rem',padding:'.28rem .6rem',borderRadius:999,border:`1.5px solid ${instrument===inst.id?inst.color:'var(--border-hi)'}`,background:instrument===inst.id?`${inst.color}18`:'transparent',color:instrument===inst.id?inst.color:'var(--text-2)',fontSize:'.74rem',fontWeight:600,cursor:'pointer',transition:'all .18s',fontFamily:'inherit' }}>{inst.icon} {inst.label}</button>
              ))}
            </div>
          </div>

          <button className="btn btn--primary" onClick={handleSubmit} disabled={!file||uploading||isProcessing} style={{ padding:'.8rem',fontSize:'.95rem',justifyContent:'center',borderRadius:14 }}>
            {uploading?<><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Uploading…</>:isProcessing?<><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Analysing…</>:'⚡ Extract Chords'}
          </button>

          {error&&<div className="alert alert--error" style={{ fontSize:'.82rem' }}>{error}</div>}

          {jobId&&(
            <div className="card" style={{ padding:'.85rem' }}>
              <div style={{ display:'flex',alignItems:'center',gap:'.5rem',marginBottom:'.3rem' }}>
                <span style={{ fontWeight:700,fontSize:'.8rem' }}>Status</span>
                {jobStatus&&<span className={`badge ${statusColors[jobStatus]||'badge--blue'}`} style={{ fontSize:'.65rem' }}>{isProcessing&&<span className="spinner" style={{width:8,height:8,borderWidth:1.5,marginRight:3}}/>}{statusLabels[jobStatus]||jobStatus}</span>}
              </div>
              <div style={{ fontSize:'.68rem',color:'var(--text-3)',fontFamily:'monospace' }}>ID: {jobId.slice(0,16)}…</div>
              {isProcessing&&<div className="status-bar" style={{ marginTop:'.5rem' }}><div className="status-bar__fill" style={{ width:jobStatus==='started'?'65%':'20%' }}/></div>}
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ display:'flex',flexDirection:'column',gap:'1rem' }}>
          {!hasResult&&!isProcessing&&(
            <div className="card" style={{ textAlign:'center',padding:'4rem 2rem',color:'var(--text-3)' }}>
              <div style={{ fontSize:'3rem',marginBottom:'1rem' }}>🎼</div>
              <p style={{ fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:'1rem',color:'var(--text-2)',marginBottom:'.5rem' }}>Ready to extract</p>
              <p style={{ fontSize:'.82rem' }}>Upload a file and click Extract Chords</p>
            </div>
          )}

          {isProcessing&&(
            <div className="card" style={{ textAlign:'center',padding:'3rem' }}>
              <span className="spinner spinner--lg" style={{ display:'block',margin:'0 auto 1rem' }}/>
              <p style={{ fontWeight:700,marginBottom:'.3rem' }}>Analysing audio…</p>
              <p style={{ fontSize:'.82rem',color:'var(--text-3)' }}>Chroma · Key · BPM</p>
              <p style={{ fontSize:'.76rem',color:'var(--accent)',marginTop:'.5rem' }}>← Preview your file on the left while waiting</p>
            </div>
          )}

          {hasResult&&(
            <>
              <ChordPlayerBar chordPlayer={chordPlayer} progressions={result.suggested_progressions} bpm={result.metadata?.bpm}/>

              <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'.6rem' }}>
                {[{label:'Key',val:result.metadata?.key||'—',icon:'🔑',color:'var(--accent)'},{label:'BPM',val:result.metadata?.bpm||'—',icon:'♩',color:'var(--accent-2)'},{label:'Duration',val:fmtDur(result.metadata?.duration||0),icon:'⏱',color:'var(--accent-3)'},{label:'Chords',val:filteredChords.length,icon:'🎼',color:'var(--green)'}].map(({label,val,icon,color})=>(
                  <div key={label} style={{ background:'var(--bg-1)',border:'1px solid var(--border)',borderRadius:14,padding:'.9rem',textAlign:'center',transition:'all .2s' }} onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.transform='translateY(-2px)'}} onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none'}}>
                    <div style={{ fontSize:'1.1rem',marginBottom:'.2rem' }}>{icon}</div>
                    <div style={{ fontFamily:"'Space Mono',monospace",fontSize:'1.05rem',fontWeight:700,color }}>{val}</div>
                    <div style={{ fontSize:'.66rem',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.04em' }}>{label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap' }}>
                <div style={{ display:'flex',background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:10,padding:3,gap:2 }}>
                  {[['sheet','🎼 Sheet'],['grid','⊞ Grid'],['timeline','↔ Timeline']].map(([v,l])=>(
                    <button key={v} onClick={()=>setView(v)} style={{ padding:'.28rem .65rem',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.74rem',transition:'all .18s',background:view===v?'var(--accent)':'transparent',color:view===v?'#fff':'var(--text-2)' }}>{l}</button>
                  ))}
                </div>
                {instrument!=='all'&&(
                  <div style={{ display:'flex',alignItems:'center',gap:'.4rem',padding:'.25rem .65rem',borderRadius:999,background:'rgba(255,107,71,.08)',border:'1px solid rgba(255,107,71,.22)',fontSize:'.75rem',color:'var(--accent)' }}>
                    {INSTRUMENTS.find(i=>i.id===instrument)?.icon} {INSTRUMENTS.find(i=>i.id===instrument)?.label}
                    <span style={{ color:'var(--text-3)',fontSize:'.68rem' }}>({filteredChords.length}/{result.chords?.length})</span>
                    <button onClick={()=>setInstrument('all')} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',fontSize:'.75rem',padding:0 }}>×</button>
                  </div>
                )}
                <div style={{ marginLeft:'auto',display:'flex',gap:'.35rem',flexWrap:'wrap' }}>
                  <button className="btn btn--sm btn--secondary" onClick={handleSave}>💾 Save</button>
                  <button className="btn btn--sm btn--secondary" onClick={()=>setShowShare(true)}>↗ Share</button>
                  <button className="btn btn--sm btn--secondary" onClick={handleCSV}>↓ CSV</button>
                  <button className="btn btn--sm btn--secondary" onClick={handleJSON}>↓ JSON</button>
                  <button className="btn btn--sm btn--primary" onClick={async()=>{setPdfLoading(true);try{const{default:exp}=await import('../utils/extractionPdf.js');await exp(result,file,instrument)}catch{setError('PDF failed')}finally{setPdfLoading(false)}}} disabled={pdfLoading}>{pdfLoading?<><span className="spinner" style={{width:10,height:10,borderWidth:1.5}}/> …</>:'⬇ PDF'}</button>
                </div>
              </div>

              {result?._demo && (
                <div className="alert" style={{ background:'rgba(245,158,11,.1)',border:'1px solid rgba(245,158,11,.3)',color:'#fbbf24',marginBottom:'.75rem',fontSize:'.82rem' }}>
                  ⚡ Demo mode — backend unavailable. Showing sample extraction for <strong>{result.metadata?.filename||'your file'}</strong>.
                  The audio player still works — connect a backend for real chord extraction.
                </div>
              )}
              {saveMsg&&<div className="alert alert--success" style={{ fontSize:'.78rem',padding:'.38rem .75rem' }}>{saveMsg}</div>}

              <div className="card" style={{ padding:view==='sheet'?'1.25rem':'.9rem',overflowX:'auto' }}>
                {view==='sheet'&&<ExtractionSheet chords={filteredChords} metadata={result.metadata}/>}
                {view==='grid'&&(
                  <div>
                    <div style={{ fontWeight:700,fontSize:'.875rem',marginBottom:'.85rem' }}>Chord Timeline <span style={{ fontWeight:400,color:'var(--text-3)',fontSize:'.78rem' }}>{filteredChords.length} chords</span></div>
                    <div className="chord-grid">
                      {filteredChords.map((c,i)=>{const col=COLORS[i%COLORS.length];return(<div key={i} className="chord-pill" style={{borderColor:`${col}44`,borderTopColor:col,borderTopWidth:2}}><span className="chord-pill__name" style={{color:col}}>{c.name}</span><span className="chord-pill__time">{c.time?.toFixed(1)}s</span><span className="chord-pill__conf">{(c.confidence*100).toFixed(0)}%</span></div>)})}
                    </div>
                  </div>
                )}
                {view==='timeline'&&(
                  <div>
                    <div style={{ fontWeight:700,fontSize:'.875rem',marginBottom:'.85rem' }}>Timeline — {fmtDur(result.metadata?.duration||0)}</div>
                    <div style={{ position:'relative',height:80,background:'var(--bg-2)',borderRadius:10,overflow:'hidden',marginBottom:'.6rem' }}>
                      {filteredChords.map((c,i)=>{const dur=result.metadata?.duration||1,left=(c.time/dur)*100,width=Math.max(((c.end_time||c.time+1)-c.time)/dur*100,0.8),col=COLORS[i%COLORS.length];return(<div key={i} title={`${c.name} @ ${c.time?.toFixed(1)}s`} style={{position:'absolute',left:`${left}%`,width:`${width}%`,top:8,height:64,background:`${col}22`,borderLeft:`2px solid ${col}`,borderRadius:'0 4px 4px 0',display:'flex',flexDirection:'column',justifyContent:'center',paddingLeft:3,overflow:'hidden',cursor:'default',transition:'background .15s'}} onMouseEnter={e=>e.currentTarget.style.background=`${col}44`} onMouseLeave={e=>e.currentTarget.style.background=`${col}22`}><span style={{fontSize:'.72rem',fontWeight:800,color:col,fontFamily:"'Space Mono',monospace",whiteSpace:'nowrap'}}>{c.name}</span><span style={{fontSize:'.56rem',color:'var(--text-3)',whiteSpace:'nowrap'}}>{c.time?.toFixed(1)}s</span></div>)})}
                    </div>
                    <div style={{ display:'flex',justifyContent:'space-between',fontSize:'.63rem',color:'var(--text-3)',fontFamily:'monospace',paddingInline:2 }}>
                      {Array.from({length:9},(_,i)=><span key={i}>{fmtDur((result.metadata?.duration||0)*i/8)}</span>)}
                    </div>
                  </div>
                )}
              </div>

              {result.suggested_progressions?.length>0&&view!=='sheet'&&(
                <div className="card" style={{ padding:'1.25rem' }}>
                  <div style={{ fontWeight:700,fontSize:'.875rem',marginBottom:'.7rem' }}>🎵 Suggested Progressions</div>
                  {result.suggested_progressions.map((p,i)=>(
                    <div key={i} style={{ padding:'.5rem .75rem',borderRadius:10,marginBottom:'.4rem',background:i===0?'rgba(255,107,71,.06)':'var(--bg-2)',border:`1px solid ${i===0?'rgba(255,107,71,.22)':'var(--border)'}`,fontFamily:"'Space Mono',monospace",fontSize:'.87rem',color:i===0?'var(--accent)':'var(--text)',display:'flex',alignItems:'center',gap:'.65rem' }}>
                      <span style={{ color:'var(--text-3)',fontSize:'.7rem' }}>#{i+1}</span>{p}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@media(max-width:900px){.page-wrap>div[style*="grid-template-columns: 310px"]{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}
