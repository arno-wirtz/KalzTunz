import { useState, useCallback, useRef, useEffect } from 'react'
import { safeJson, useAuth } from '../App'
import { Link } from 'react-router-dom'

import { ChordSynth, buildLocal, buildScaleRef, fmtDur, KEY_FREQS, chordFreqs, saveGenerationToLib, CHROMATIC, SCALE_INT } from '../utils/musicEngine'
import {
  IconBolt, IconReplay, IconMic, IconGuitar, IconHorn, IconSliders, IconDrum, IconStrings, IconHat, IconHeart, IconCloud, IconLeaf,
  IconSmile, IconFrown, IconWave, IconMoon, IconFlame, IconEye, IconSunrise, IconKey,
  IconPiano, IconPerson, IconBaby, IconAngel, IconGroup, IconRobot, IconMicUp, IconMicSoft,
  IconClose, IconCheck, IconCopy,
} from '../components/Icons'

const API = import.meta.env.VITE_API_URL ?? ''  // same-origin in production (unified service)

/* ── Data ───────────────────────────────────────────────────── */
const GENRES = [
  { id:'pop',       label:'Pop',       Icon: IconMic,     color:'#f59e0b', desc:'Catchy, radio-friendly' },
  { id:'rock',      label:'Rock',      Icon: IconGuitar,  color:'#ef4444', desc:'Power & attitude' },
  { id:'jazz',      label:'Jazz',      Icon: IconHorn,    color:'#d4a017', desc:'Complex harmony' },
  { id:'electronic',label:'Electronic',Icon: IconSliders, color:'var(--accent-3)', desc:'Synth & arpeggios' },
  { id:'hip-hop',   label:'Hip-Hop',   Icon: IconDrum,    color:'#8b5cf6', desc:'Groove & rhythm' },
  { id:'classical', label:'Classical', Icon: IconStrings, color:'#6366f1', desc:'Bach to Beethoven' },
  { id:'country',   label:'Country',   Icon: IconHat,     color:'#d97706', desc:'Open tunings' },
  { id:'rnb',       label:'R&B',       Icon: IconHeart,   color:'#ec4899', desc:'Soul & neo-soul' },
  { id:'ambient',   label:'Ambient',   Icon: IconCloud,   color:'#0ea5e9', desc:'Floating pads' },
  { id:'indie',     label:'Indie',     Icon: IconLeaf,    color:'#22c55e', desc:'Dreamy alt-chords' },
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
  happy:      { Icon: IconSmile,   color:'#f59e0b', desc:'Bright & positive' },
  sad:        { Icon: IconFrown,   color:'#7c5ce7', desc:'Melancholic & tender' },
  energetic:  { Icon: IconBolt,    color:'#ef4444', desc:'High-drive intensity' },
  calm:       { Icon: IconWave,    color:'var(--accent-3)', desc:'Peaceful & serene' },
  dark:       { Icon: IconMoon,    color:'#64748b', desc:'Tense & cinematic' },
  romantic:   { Icon: IconHeart,   color:'#ec4899', desc:'Warm & expressive' },
  epic:       { Icon: IconFlame,   color:'#dc2626', desc:'Grand & sweeping' },
  mysterious: { Icon: IconEye,     color:'#8b5cf6', desc:'Ethereal & unexpected' },
  uplifting:  { Icon: IconSunrise, color:'#f97316', desc:'Hopeful & triumphant' },
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
  { id:'piano',   label:'Piano',      Icon: IconPiano },
  { id:'guitar',  label:'Guitar',     Icon: IconGuitar },
  { id:'bass',    label:'Bass',       Icon: IconGuitar },
  { id:'strings', label:'Strings',    Icon: IconStrings },
  { id:'brass',   label:'Brass/Wind', Icon: IconHorn },
  { id:'drums',   label:'Drums',      Icon: IconDrum },
  { id:'synth',   label:'Synth',      Icon: IconSliders },
  { id:'vocals',  label:'Vocals',     Icon: IconMic },
]
const VOICE_TYPES = [
  { id:'woman',    label:'Woman',    Icon: IconPerson, desc:'Warm soprano / alto' },
  { id:'man',      label:'Man',      Icon: IconPerson, desc:'Rich tenor / baritone' },
  { id:'baby',     label:'Baby',     Icon: IconBaby,   desc:'Light, innocent, high' },
  { id:'angel',    label:'Angel',    Icon: IconAngel,  desc:'Ethereal & celestial' },
  { id:'choir',    label:'Choir',    Icon: IconGroup,  desc:'Full SATB harmony' },
  { id:'robot',    label:'Robot',    Icon: IconRobot,  desc:'Vocoder / auto-tune' },
  { id:'falsetto', label:'Falsetto', Icon: IconMicUp,  desc:'Breathy high register' },
  { id:'whisper',  label:'Whisper',  Icon: IconMicSoft,desc:'Intimate, spoken feel' },
]

/* ═══════════════════════════════════════════════════════════════
   PROFESSIONAL SHEET MUSIC PDF GENERATOR
   ═══════════════════════════════════════════════════════════════ */

const CHORD_NOTES = {
  'C':  [0,4,7], 'Cm': [0,3,7], 'C#': [1,5,8], 'C#m':[1,4,8],
  'D':  [2,6,9], 'Dm': [2,5,9], 'D#': [3,7,10],'D#m':[3,6,10],
  'E':  [4,8,11],'Em': [4,7,11],'F':  [5,9,12], 'Fm': [5,8,12],
  'F#': [6,10,13],'F#m':[6,9,13],'G': [7,11,14],'Gm': [7,10,14],
  'G#': [8,12,15],'G#m':[8,11,15],'A': [9,13,16],'Am': [9,12,16],
  'A#': [10,14,17],'A#m':[10,13,17],'B':[11,15,18],'Bm':[11,14,18],
  'Cdim':[0,3,6],'Ddim':[2,5,8],'Edim':[4,7,10],'Fdim':[5,8,11],
  'Gdim':[7,10,13],'Adim':[9,12,15],'Bdim':[11,14,17],
}

function midiToStaffPos(semitone) {
  const octave = Math.floor(semitone / 12)
  const note   = semitone % 12
  const diatonic = [0,0,1,1,2,3,3,4,4,5,5,6]
  return octave * 7 + diatonic[note]
}

function drawNoteHead(doc, x, staffY, staffPos, filled=true, stemUp=true) {
  const SPACE = 2.5
  const y = staffY - (staffPos - 4) * SPACE
  const rx = 1.3, ry = 1.0
  if (filled) {
    doc.setFillColor(20,20,20); doc.ellipse(x, y, rx, ry, 'F')
  } else {
    doc.setDrawColor(20,20,20); doc.setLineWidth(0.3); doc.ellipse(x, y, rx, ry, 'D')
  }
  const stemLen = 7
  if (stemUp) { doc.setLineWidth(0.25); doc.setDrawColor(20,20,20); doc.line(x+rx, y, x+rx, y-stemLen) }
  else        { doc.setLineWidth(0.25); doc.setDrawColor(20,20,20); doc.line(x-rx, y, x-rx, y+stemLen) }
  doc.setLineWidth(0.25); doc.setDrawColor(60,60,60)
  for (let lp = 0; lp <= 2; lp++) {
    if (staffPos <= lp * 2) doc.line(x-2.2, staffY-(lp*2-4)*SPACE, x+2.2, staffY-(lp*2-4)*SPACE)
  }
  for (let lp = 10; lp <= 12; lp += 2) {
    if (staffPos >= lp) doc.line(x-2.2, staffY-(lp-4)*SPACE, x+2.2, staffY-(lp-4)*SPACE)
  }
  return y
}

function drawStaff(doc, x, y, width) {
  const SPACE = 2.5
  doc.setDrawColor(80,80,80); doc.setLineWidth(0.22)
  for (let i = 0; i < 5; i++) {
    doc.line(x, y + i * SPACE, x + width, y + i * SPACE)
  }
  return y + 4 * SPACE
}

function drawTrebleClef(doc, x, y) {
  doc.setFont('times','bold'); doc.setFontSize(22); doc.setTextColor(30,30,30)
  doc.text('𝄞', x, y+8, {baseline:'top'})
  doc.setDrawColor(40,40,40); doc.setLineWidth(0.4)
}

function drawTimeSignature(doc, x, y) {
  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(20,20,20)
  doc.text('4', x, y+1,   {align:'center'})
  doc.text('4', x, y+6.5, {align:'center'})
}

function drawAccidental(doc, x, y, type) {
  doc.setFont('times','normal'); doc.setFontSize(8); doc.setTextColor(20,20,20)
  if (type === 'sharp') doc.text('♯', x-2, y)
  if (type === 'flat')  doc.text('♭', x-2, y)
}

async function exportPDF(params, progs, richProgs, scaleRef, instrNotes, filterInstrument) {
  if (!window.jspdf) await new Promise((res,rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    s.onload = res; s.onerror = rej; document.head.appendChild(s)
  })
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  const W=210, M=14, INNER=W-M*2; let y=0, page=1

  const CORAL  = [56,189,248]
  const AMBER  = [14,165,233]
  const DARK   = [18,16,12]
  const GREY   = [90,82,72]
  const LGREY  = [160,155,148]
  const LLGREY = [230,226,220]

  const newPage = () => {
    doc.addPage(); page++; y = 18
    doc.setFillColor(...CORAL); doc.rect(0,0,W,3,'F')
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...LGREY)
    doc.text(`KalzTunz · ${params.key} ${params.mode} · ${params.genre} · ${params.bpm} BPM`, M, 8)
    doc.text(`Page ${page}`, W-M, 8, {align:'right'})
    doc.setDrawColor(...LLGREY); doc.setLineWidth(0.2); doc.line(M,10,W-M,10)
    y = 16
  }

  const checkPage = (need=30) => { if (y + need > 282) newPage() }

  doc.setFillColor(...CORAL); doc.rect(0,0,W,8,'F')
  doc.setFillColor(...AMBER);
  doc.triangle(0,8, 45,8, 0,22, 'F')

  y = 24
  doc.setFont('times','bold'); doc.setFontSize(28); doc.setTextColor(...DARK)
  doc.text(params.genre ? params.genre.charAt(0).toUpperCase()+params.genre.slice(1)+' Chord Sheet' : 'Chord Sheet', W/2, y, {align:'center'}); y+=9

  doc.setFont('times','italic'); doc.setFontSize(13); doc.setTextColor(...GREY)
  doc.text(`${params.key} ${params.mode}  ·  ${params.mood} mood`, W/2, y, {align:'center'}); y+=7

  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...GREY)
  const meta = [
    `Tempo: ${params.bpm} BPM`,
    `Duration: ${fmtDur(params.duration)}`,
    `Time: 4/4`,
    `Instruments: ${params.instruments.join(', ')||'General'}`,
    params.hasVocals ? `Voice: ${params.voiceType}` : null,
    `Date: ${new Date().toLocaleDateString()}`,
  ].filter(Boolean).join('   ·   ')
  doc.text(meta, W/2, y, {align:'center', maxWidth:INNER}); y+=6

  if (filterInstrument && filterInstrument !== 'all') {
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...CORAL)
    doc.text(`Filtered for: ${filterInstrument.toUpperCase()} PART`, W/2, y, {align:'center'}); y+=5
  }

  doc.setDrawColor(...CORAL); doc.setLineWidth(0.8); doc.line(M, y, W-M, y)
  doc.setDrawColor(...AMBER); doc.setLineWidth(0.3); doc.line(M, y+1, W-M, y+1)
  y += 6

  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...CORAL)
  doc.text('SCALE REFERENCE', M, y); y+=4

  if (scaleRef && scaleRef.length) {
    const colW = INNER / scaleRef.length
    scaleRef.forEach((s, i) => {
      const x = M + i * colW
      const isRoot = i === 0
      doc.setFillColor(isRoot ? 255 : 248, isRoot ? 248 : 246, isRoot ? 240 : 244)
      doc.setDrawColor(...(isRoot ? CORAL : LLGREY))
      doc.setLineWidth(isRoot ? 0.5 : 0.2)
      doc.roundedRect(x, y, colW-1, 14, 1.5, 1.5, 'FD')
      doc.setFillColor(...(isRoot ? CORAL : AMBER))
      doc.rect(x, y, colW-1, 2, 'F')
      doc.setFont('times','italic'); doc.setFontSize(7); doc.setTextColor(...GREY)
      doc.text(s.roman||'', x+colW/2-0.5, y+5.5, {align:'center'})
      doc.setFont('times','bold'); doc.setFontSize(9.5); doc.setTextColor(...DARK)
      doc.text(s.chord||s.note||'', x+colW/2-0.5, y+10.5, {align:'center'})
      if (s.quality) {
        doc.setFont('helvetica','normal'); doc.setFontSize(5.5); doc.setTextColor(...LGREY)
        doc.text(s.quality==='m'?'min':s.quality==='dim'?'dim':'maj', x+colW/2-0.5, y+13.5, {align:'center'})
      }
    })
    y += 18
  }

  checkPage(50)
  doc.setDrawColor(...LLGREY); doc.setLineWidth(0.2); doc.line(M,y,W-M,y); y+=5
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...CORAL)
  doc.text('CHORD PROGRESSIONS', M, y); y+=5

  const ACCENTS = [[56,189,248],[14,165,233],[34,211,238],[74,222,128],[139,92,246],[248,113,113]]
  const primaryProgs = richProgs && richProgs.length ? richProgs : progs.map(p => ({ display:p, chords:p.split(' — '), timeline:[] }))

  primaryProgs.forEach((variation, vi) => {
    checkPage(60)
    const ac = ACCENTS[vi % ACCENTS.length]
    const chords = variation.chords || variation.display?.split(' — ') || []
    const romanNums = (variation.timeline || []).slice(0, chords.length).map(t => t.roman || '')

    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...ac)
    doc.text(`Variation ${vi+1}${vi===0?' — Primary':''}`, M, y); y+=4

    const staffX = M+12
    const staffW = INNER-13
    const SPACE  = 2.6

    doc.setDrawColor(70,70,70); doc.setLineWidth(0.2)
    for (let line=0; line<5; line++) {
      doc.line(staffX, y+line*SPACE, staffX+staffW, y+line*SPACE)
    }
    const staffBottom = y + 4*SPACE
    const staffMid    = y + 2*SPACE

    doc.setFont('times','bold'); doc.setFontSize(18); doc.setTextColor(30,30,30)
    doc.text('𝄞', staffX-9, y+10)

    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(30,30,30)
    doc.text('4', staffX+1.5, y+2.5, {align:'center'})
    doc.text('4', staffX+1.5, y+7.5, {align:'center'})

    const KEY_SHARPS = {'G':1,'D':2,'A':3,'E':4,'B':5,'F#':6,'C#':7}
    const KEY_FLATS  = {'F':1,'Bb':2,'Eb':3,'Ab':4,'Db':5,'Gb':6,'Cb':7}
    const rootNote = params.key.split(' ')[0]
    let keySigX = staffX + 7
    if (KEY_SHARPS[rootNote]) {
      doc.setFont('times','bold'); doc.setFontSize(9); doc.setTextColor(30,30,30)
      for (let s=0; s<KEY_SHARPS[rootNote]; s++) {
        doc.text('♯', keySigX, y+1+s*1.5); keySigX+=3.5
      }
    } else if (KEY_FLATS[rootNote]) {
      doc.setFont('times','bold'); doc.setFontSize(9); doc.setTextColor(30,30,30)
      for (let s=0; s<KEY_FLATS[rootNote]; s++) {
        doc.text('♭', keySigX, y+3+s*1.5); keySigX+=3.5
      }
    }

    const barCount = chords.length
    const barW = (staffW - 16) / Math.max(barCount, 1)

    chords.forEach((chordName, ci) => {
      const barX = staffX + 16 + ci * barW

      if (ci > 0) {
        doc.setDrawColor(60,60,60); doc.setLineWidth(0.35)
        doc.line(barX, y, barX, staffBottom)
      }

      doc.setFont('times','bold'); doc.setFontSize(10); doc.setTextColor(...ac)
      doc.text(chordName, barX+barW/2, y-2, {align:'center'})

      if (romanNums[ci]) {
        doc.setFont('times','italic'); doc.setFontSize(6.5); doc.setTextColor(...GREY)
        doc.text(romanNums[ci], barX+barW/2, y-6, {align:'center'})
      }

      const notesForChord = CHORD_NOTES[chordName] || CHORD_NOTES[chordName.replace('m','').replace('dim','')] || [0,4,7]
      const noteXpos = barX + barW*0.45

      notesForChord.slice(0,3).forEach((semitone, ni) => {
        const chromatic   = [0,0,1,1,2,3,3,4,4,5,5,6]
        const diatonic    = chromatic[((semitone % 12) + 12) % 12]
        const staffPos    = diatonic - 2 + (ni < 2 ? 0 : 1)
        const noteY       = staffBottom - staffPos * SPACE

        if (noteY < y - 0.5) {
          doc.setDrawColor(80,80,80); doc.setLineWidth(0.2)
          for (let ly = y - SPACE; ly >= noteY - 0.5; ly -= SPACE) {
            doc.line(noteXpos - 2, ly, noteXpos + 2, ly)
          }
        }
        if (noteY > staffBottom + 0.5) {
          doc.setDrawColor(80,80,80); doc.setLineWidth(0.2)
          for (let ly = staffBottom + SPACE; ly <= noteY + 0.5; ly += SPACE) {
            doc.line(noteXpos - 2, ly, noteXpos + 2, ly)
          }
        }

        const isRoot = ni === 0
        doc.setFillColor(...(isRoot ? DARK : [60,60,60]))
        doc.ellipse(noteXpos, noteY, 1.4, 1.0, 'F')

        doc.setDrawColor(...(isRoot ? DARK : [60,60,60])); doc.setLineWidth(0.3)
        if (noteY > staffMid) {
          doc.line(noteXpos+1.4, noteY, noteXpos+1.4, noteY - 7)
        } else {
          doc.line(noteXpos-1.4, noteY, noteXpos-1.4, noteY + 7)
        }
      })

      for (let b=1; b<=3; b++) {
        doc.setFillColor(...LLGREY)
        doc.circle(barX + barW * b/4, staffBottom + 3.5, 0.4, 'F')
      }
    })

    const finalX = staffX + 16 + barCount * barW
    doc.setDrawColor(40,40,40); doc.setLineWidth(0.35)
    doc.line(finalX, y, finalX, staffBottom)
    doc.setLineWidth(1.0)
    doc.line(finalX+1, y, finalX+1, staffBottom)

    y = staffBottom + 8

    const boxW = INNER / Math.max(chords.length, 1)
    chords.forEach((chord, ci) => {
      const x = M + ci * boxW
      doc.setFillColor(250,248,244); doc.setDrawColor(...ac)
      doc.setLineWidth(0.35)
      doc.roundedRect(x, y, boxW-1, 18, 2, 2, 'FD')
      doc.setFillColor(...ac); doc.rect(x, y, boxW-1, 2.5, 'F')
      if (romanNums[ci]) {
        doc.setFont('times','italic'); doc.setFontSize(6.5); doc.setTextColor(100,90,80)
        doc.text(romanNums[ci], x+boxW/2-0.5, y+6, {align:'center'})
      }
      doc.setFont('times','bold')
      doc.setFontSize(chord.length > 3 ? 9 : 12); doc.setTextColor(...DARK)
      doc.text(chord, x+boxW/2-0.5, y+12.5, {align:'center'})
      doc.setFont('helvetica','normal'); doc.setFontSize(5); doc.setTextColor(...LGREY)
      doc.text(`${ci*4+1}`, x+2, y+17)
    })
    y += 22

    if (params.hasVocals || params.instruments?.includes('vocals')) {
      checkPage(14)
      doc.setFont('helvetica','italic'); doc.setFontSize(7); doc.setTextColor(...LGREY)
      doc.text('Melody line:', M, y)
      doc.setDrawColor(...LLGREY); doc.setLineWidth(0.18)
      chords.forEach((_, ci) => {
        const lx = M+45+ci*(INNER-45)/Math.max(chords.length,1)
        doc.line(lx, y, lx+(INNER-45)/Math.max(chords.length,1)-2, y)
      })
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(180,170,160)
      doc.text(`(${params.voiceType||'vocals'} — ${params.key} ${params.mode} scale)`, M+45, y-1.5)
      y += 7
    }
  })

  const instrList = Object.keys(instrNotes || {})
    .filter(k => filterInstrument === 'all' || !filterInstrument || k === filterInstrument)

  if (instrList.length) {
    checkPage(20)
    doc.setDrawColor(...LLGREY); doc.setLineWidth(0.2); doc.line(M,y,W-M,y); y+=5
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...CORAL)
    doc.text('INSTRUMENT PERFORMANCE NOTES', M, y); y+=4

    const INSTR_ICONS = { piano:'Piano', guitar:'Guitar', bass:'Bass', drums:'Drums', strings:'Strings', vocals:'Vocals', synth:'Synth', brass:'Brass/Wind' }

    instrList.forEach(instr => {
      checkPage(22)
      const note  = instrNotes[instr] || ''
      const label = INSTR_ICONS[instr] || instr
      const isFiltered = filterInstrument === instr

      doc.setFillColor(...(isFiltered ? CORAL : [245,242,238]))
      doc.roundedRect(M, y, INNER, 7, 1.5, 1.5, 'F')
      doc.setFont('helvetica','bold'); doc.setFontSize(8)
      doc.setTextColor(...(isFiltered ? [255,255,255] : DARK))
      doc.text(label.toUpperCase(), M+3, y+4.5)
      if (isFiltered) {
        doc.setFont('helvetica','normal'); doc.setFontSize(6.5)
        doc.text('FEATURED PART', W-M-2, y+4.5, {align:'right'})
      }
      y += 8

      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...GREY)
      const lines = doc.splitTextToSize(note, INNER-4)
      lines.forEach(line => {
        checkPage(6)
        doc.text(line, M+2, y); y += 4.5
      })

      if (instr === 'guitar' || instr === 'piano') {
        checkPage(10)
        y += 1
        doc.setFont('courier','normal'); doc.setFontSize(7); doc.setTextColor(100,95,88)
        if (instr === 'guitar') {
          doc.text('Pattern:  1  +  2  +  3  +  4  +', M+2, y); y+=4
          doc.text('          D     D  U     U  D  U ', M+2, y); y+=5
        } else {
          doc.text('LH:   |  Root  |  5th   |  Root  |  5th  |', M+2, y); y+=4
          doc.text('RH:   |  1-3-5 chord    |  inversion      |', M+2, y); y+=5
        }
      }
      if (instr === 'drums') {
        checkPage(14)
        y += 1
        doc.setFont('courier','normal'); doc.setFontSize(7); doc.setTextColor(100,95,88)
        doc.text('Beat:    1    2    3    4', M+2, y); y+=3.5
        doc.text('Kick:    X              X', M+2, y); y+=3.5
        doc.text('Snare:        X         X', M+2, y); y+=3.5
        doc.text('Hi-hat:  x    x    x    x', M+2, y); y+=5
      }
      y += 2
    })
  }

  if (scaleRef && scaleRef.length) {
    checkPage(40)
    doc.setDrawColor(...LLGREY); doc.setLineWidth(0.2); doc.line(M,y,W-M,y); y+=5
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...CORAL)
    doc.text('SCALE FINGERING REFERENCE', M, y); y+=4

    const scW = INNER-5
    doc.setDrawColor(80,80,80); doc.setLineWidth(0.18)
    const SSPACE = 2.2
    for (let l=0; l<5; l++) doc.line(M, y+l*SSPACE, M+scW, y+l*SSPACE)

    doc.setFont('times','bold'); doc.setFontSize(14); doc.setTextColor(40,40,40)
    doc.text('𝄞', M, y+6)

    const scaleNoteNames = scaleRef.map(s => s.note)
    const scaleStepX = (scW-15) / Math.max(scaleNoteNames.length, 1)
    scaleNoteNames.forEach((note, ni) => {
      const nx = M + 13 + ni * scaleStepX
      const chromatic = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
      const diat = [0,0,1,1,2,3,3,4,4,5,5,6]
      const idx = chromatic.indexOf(note)
      const dp  = idx >= 0 ? diat[idx] : 0
      const noteY = y + 4*SSPACE - (dp - 2)*SSPACE
      doc.setFillColor(...DARK); doc.ellipse(nx, noteY, 1.1, 0.85, 'F')
      doc.setDrawColor(...DARK); doc.setLineWidth(0.25)
      doc.line(nx+1.1, noteY, nx+1.1, noteY-5.5)
      doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...CORAL)
      doc.text(note, nx, y+4*SSPACE+5, {align:'center'})
      doc.setFont('helvetica','normal'); doc.setFontSize(5.5); doc.setTextColor(...GREY)
      doc.text(String(ni+1), nx, y+4*SSPACE+8.5, {align:'center'})
    })
    y += 4*SSPACE + 14
  }

  const totalPages = page
  for (let p=1; p<=totalPages; p++) {
    doc.setPage(p)
    doc.setFillColor(...CORAL); doc.rect(0,289,W,5,'F')
    doc.setFillColor(...AMBER); doc.rect(0,289,W,1.5,'F')
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(255,255,255)
    doc.text('KalzTunz  ·  AI Music Platform  ·  kalztunz.com', M, 292.5)
    doc.text(`${params.key} ${params.mode}  ·  ${params.genre}  ·  ${params.bpm} BPM  ·  Page ${p} of ${totalPages}`, W-M, 292.5, {align:'right'})
  }

  const fname = `KalzTunz_${params.genre||'chord'}_${(params.key||'').replace('#','sharp')}_${params.mode||'major'}${filterInstrument && filterInstrument!=='all'?'_'+filterInstrument:''}.pdf`
  doc.save(fname)
}

/* ── Drag seek bar ─────────────────────────────────────────── */
function SeekBar({ progress, onSeek }) {
  const ref = useRef(null), drag = useRef(false)
  const get = e => { const r=ref.current?.getBoundingClientRect(); if(!r)return 0; const cx=e.touches?e.touches[0].clientX:e.clientX; return Math.max(0,Math.min(1,(cx-r.left)/r.width)) }
  const dn=e=>{drag.current=true;onSeek(get(e));window.addEventListener('mousemove',mv);window.addEventListener('mouseup',up);window.addEventListener('touchmove',mv,{passive:false});window.addEventListener('touchend',up)}
  const mv=e=>{if(drag.current)onSeek(get(e))}
  const up=()=>{drag.current=false;window.removeEventListener('mousemove',mv);window.removeEventListener('mouseup',up);window.removeEventListener('touchmove',mv);window.removeEventListener('touchend',up)}
  return (
    <div ref={ref} onMouseDown={dn} onTouchStart={dn} style={{flex:1,height:16,display:'flex',alignItems:'center',cursor:'pointer'}}>
      <div style={{flex:1,height:3,background:'rgba(255,255,255,.15)',borderRadius:2,position:'relative'}}>
        <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${(progress||0)*100}%`,background:'linear-gradient(90deg,var(--accent),var(--accent-2))',borderRadius:2}}/>
        <div style={{position:'absolute',top:'50%',left:`${(progress||0)*100}%`,transform:'translate(-50%,-50%)',width:11,height:11,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 6px rgba(0,0,0,.4)'}}/>
      </div>
    </div>
  )
}

/* ── Chord synth player hook ───────────────────────────────── */
function useChordPlayer() {
  const sRef=useRef(null)
  const [playing,setPlaying]=useState(false)
  const [paused,setPaused]=useState(false)
  const [elapsed,setElapsed]=useState(0)
  const [progress,setProgress]=useState(0)
  const [curIdx,setCurIdx]=useState(0)
  const [total,setTotal]=useState(0)
  const get=()=>{if(!sRef.current)sRef.current=new ChordSynth();return sRef.current}
  const load=useCallback((str,bpm)=>{
    sRef.current?.stop()
    const s=get();s.load(str,bpm);setTotal(s.duration);setElapsed(0);setProgress(0);setCurIdx(0);setPlaying(false);setPaused(false)
    s.on('progress',({elapsed:el,progress:pr})=>{setElapsed(el);setProgress(pr)})
    s.on('chordIdx',i=>setCurIdx(i))
    s.on('end',()=>{setPlaying(false);setPaused(false);setElapsed(0);setProgress(0);setCurIdx(0)})
  },[])
  const play  =useCallback(()=>{get().play();  setPlaying(true); setPaused(false)},[])
  const pause =useCallback(()=>{get().pause(); setPaused(true)},[])
  const resume=useCallback(()=>{get().resume();setPaused(false);setPlaying(true)},[])
  const stop  =useCallback(()=>{get().stop();  setPlaying(false);setPaused(false);setElapsed(0);setProgress(0);setCurIdx(0)},[])
  const toggle=useCallback(()=>{if(!playing&&!paused)play();else if(paused)resume();else pause()},[playing,paused,play,pause,resume])
  const seekTo=useCallback(f=>get().seekTo(f),[])
  useEffect(()=>()=>sRef.current?.stop(),[])
  return {playing,paused,elapsed,progress,curIdx,total,load,play,pause,resume,stop,toggle,seekTo}
}

/* ── Player bar ────────────────────────────────────────────── */
function PlayerBar({player,chords,title}) {
  const {playing,paused,elapsed,progress,curIdx,total,toggle,stop,seekTo}=player
  if(!chords?.length)return null
  return (
    <div style={{background:'linear-gradient(135deg,var(--bg-3),var(--bg-2))',border:'1px solid var(--border-hi)',borderRadius:13,padding:'.68rem .95rem',marginBottom:'.85rem'}}>
      <div style={{display:'flex',alignItems:'center',gap:'.55rem',marginBottom:'.38rem'}}>
        <button onClick={toggle} style={{width:33,height:33,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),var(--accent-2))',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',flexShrink:0,boxShadow:'0 3px 10px rgba(56,189,248,.28)',transition:'transform .15s'}} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.08)'} onMouseLeave={e=>e.currentTarget.style.transform=''}>
          {playing&&!paused?<svg width={12} height={12} viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>:<svg width={12} height={12} viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>}
        </button>
        {(playing||paused)&&<button onClick={stop} style={{width:24,height:24,borderRadius:'50%',border:'1px solid var(--border)',background:'var(--bg-4)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-3)',flexShrink:0}}><svg width={8} height={8} viewBox="0 0 24 24" fill="currentColor"><rect x={4} y={4} width={16} height={16}/></svg></button>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:'.73rem',fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title||'Chord Progression'}</div>
          <div style={{fontSize:'.63rem',color:'var(--text-3)'}}>{playing&&!paused?`▶ ${chords[curIdx]||''}…`:paused?'⏸ Paused':'Click ▶ to preview'}</div>
        </div>
        <span style={{fontSize:'.67rem',color:'var(--text-3)',fontFamily:"'Space Mono',monospace",flexShrink:0}}>{fmtDur(elapsed)}/{fmtDur(total)}</span>
      </div>
      <SeekBar progress={progress} onSeek={seekTo}/>
      {(playing||paused)&&<div style={{display:'flex',gap:'.18rem',flexWrap:'wrap',marginTop:'.4rem'}}>{chords.map((c,i)=><div key={i} style={{padding:'.1rem .35rem',borderRadius:5,fontSize:'.62rem',fontWeight:800,fontFamily:"'Space Mono',monospace",background:i===curIdx?'var(--accent)':'var(--bg-4)',color:i===curIdx?'#fff':'var(--text-3)',transition:'all .15s'}}>{c}</div>)}</div>}
    </div>
  )
}

/* ── SVG Sheet Music ───────────────────────────────────────── */
function SheetMusicView({result,player}) {
  if(!result?.progressions?.length)return null
  const progs  = result.progressions
  const scale  = result.scaleRef||buildScaleRef(result.key||'C',result.mode||'major')
  const COLORS = ['#38BDF8','#0EA5E9','#22D3EE','#4ADE80','#8b5cf6','#EF4444','#06b6d4']
  const SP = 11
  const STAFF_TOP = 32
  const STAFF_H   = 4*SP
  const BOX_H     = 26
  const SVG_H     = STAFF_TOP + STAFF_H + BOX_H + 24
  const NOTE_POS  = {C:5,D:6,E:0,F:1,G:2,A:3,B:4}

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:'1rem',marginBottom:'1rem',flexWrap:'wrap'}}>
        {[{label:'Root note',shape:'ellipse'},{label:'3rd',shape:'circle'},{label:'5th',shape:'dot'}].map(({label,shape})=>(
          <div key={label} style={{display:'flex',alignItems:'center',gap:'.32rem'}}>
            <svg width={16} height={16}>
              {shape==='ellipse'&&<ellipse cx={8} cy={8} rx={5.5} ry={4} fill="var(--text)" transform="rotate(-12,8,8)"/>}
              {shape==='circle'&&<circle cx={8} cy={8} r={3.5} fill="var(--accent)" opacity={.7}/>}
              {shape==='dot'&&<circle cx={8} cy={8} r={2.5} fill="var(--accent)" opacity={.4}/>}
            </svg>
            <span style={{fontSize:'.64rem',color:'var(--text-3)'}}>{label}</span>
          </div>
        ))}
      </div>
      <div style={{overflowX:'auto'}}>
      {progs.map((prog,vi)=>{
        const chords=prog.split(' — ').filter(Boolean)
        const col=COLORS[vi%COLORS.length]
        const BAR_W=Math.max(68,Math.min(96,620/Math.max(chords.length,1)))
        const SVG_W=48+chords.length*BAR_W+10
        const isP=vi===0
        return (
          <div key={vi} style={{marginBottom:'1.4rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:'.5rem',marginBottom:'.45rem'}}>
              <span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',flexShrink:0,background:col,boxShadow:`0 0 8px ${col}88`}}/>
              <span style={{fontSize:'.72rem',fontWeight:800,color:col,textTransform:'uppercase',letterSpacing:'.07em'}}>
                Variation {vi+1}{vi===0?' — Primary':''}
              </span>
              {isP&&player&&(
                <button onClick={player.toggle}
                  style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'.3rem',padding:'.22rem .72rem',borderRadius:999,border:`1.5px solid ${col}`,background:`${col}18`,cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.72rem',color:col,transition:'all .2s'}}
                  onMouseEnter={e=>{e.currentTarget.style.background=`${col}30`}}
                  onMouseLeave={e=>{e.currentTarget.style.background=`${col}18`}}>
                  {player.playing&&!player.paused
                    ?<><svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>Pause</>
                    :<><svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Play</>}
                </button>
              )}
            </div>
            <div style={{background:'var(--bg-1)',borderRadius:12,border:'1px solid var(--border)',padding:'.6rem .5rem .5rem',overflowX:'auto'}}>
            <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{display:'block',overflow:'visible',minWidth:Math.max(320,SVG_W)}}>
              {chords.map((_,ci)=>ci%8<4&&<rect key={ci} x={48+ci*BAR_W} y={STAFF_TOP-4} width={BAR_W} height={STAFF_H+8} fill="rgba(255,255,255,.022)" rx={2}/>)}

              {[0,1,2,3,4].map(l=>(
                <line key={l} x1={0} y1={STAFF_TOP+l*SP} x2={SVG_W} y2={STAFF_TOP+l*SP}
                  stroke="var(--border-hi)" strokeWidth={l===0||l===4?1.2:0.7} opacity={l===0||l===4?.85:.65}/>
              ))}

              <text x={6} y={STAFF_TOP+3.8*SP} fontSize={STAFF_H+8} fontFamily="serif"
                fill="var(--text-2)" opacity={0.78}>𝄞</text>

              <text x={42} y={STAFF_TOP+1.5*SP} fontSize={SP*1.35} fontFamily="sans-serif"
                fontWeight="900" fill="var(--text-2)" textAnchor="middle">4</text>
              <text x={42} y={STAFF_TOP+3.5*SP} fontSize={SP*1.35} fontFamily="sans-serif"
                fontWeight="900" fill="var(--text-2)" textAnchor="middle">4</text>

              {chords.map((chord,ci)=>{
                const barX  = 48+ci*BAR_W
                const beatX = barX+BAR_W/2
                const isAct = isP&&player&&player.curIdx===ci&&(player.playing||player.paused)
                const rn    = chord.replace(/m$|dim$|aug$/,'').replace(/maj7|7$/,'').replace(/[^A-G]/g,'')
                const nPos  = NOTE_POS[rn]??2
                const noteY = STAFF_TOP+STAFF_H - nPos*(SP/2)
                const stemUp= nPos < 4
                const isMin = chord.endsWith('m')&&!chord.endsWith('dim')&&!chord.endsWith('maj7')
                const isDim = chord.endsWith('dim')
                const textY = STAFF_TOP + STAFF_H + BOX_H + 2

                const ledgerAbove = noteY < STAFF_TOP - 1
                const ledgerBelow = noteY > STAFF_TOP + STAFF_H + 1

                return (
                  <g key={ci}>
                    {isAct&&<rect x={barX} y={STAFF_TOP-8} width={BAR_W} height={STAFF_H+BOX_H+16} fill={`${col}18`} rx={5}/>}

                    {ci>0&&<line x1={barX} y1={STAFF_TOP} x2={barX} y2={STAFF_TOP+STAFF_H}
                      stroke="var(--border)" strokeWidth={ci%4===0?1.5:0.6} opacity={ci%4===0?.9:.5}/>}

                    {ci%4===0&&ci>0&&<line x1={barX+2.5} y1={STAFF_TOP} x2={barX+2.5} y2={STAFF_TOP+STAFF_H}
                      stroke="var(--border)" strokeWidth={0.5} opacity={0.4}/>}

                    {scale[ci]&&(
                      <text x={beatX} y={STAFF_TOP-11} fontSize={8} fontFamily="serif" fontStyle="italic"
                        fill={isAct?col:"var(--text-3)"} textAnchor="middle" opacity={isAct?1:.8}>
                        {scale[ci].roman}
                      </text>
                    )}

                    <text x={beatX} y={STAFF_TOP-21} fontSize={chord.length>4?9.5:11.5}
                      fontFamily="'Georgia',serif" fontWeight="bold"
                      fill={isAct?col:col} textAnchor="middle" opacity={isAct?1:.75}>
                      {chord}
                    </text>

                    {ledgerAbove&&Array.from({length:Math.ceil((STAFF_TOP-noteY)/SP)},(_,i)=>(
                      <line key={i} x1={beatX-8} y1={STAFF_TOP-(i+1)*SP} x2={beatX+8} y2={STAFF_TOP-(i+1)*SP}
                        stroke="var(--text-2)" strokeWidth={0.8}/>
                    ))}
                    {ledgerBelow&&Array.from({length:Math.ceil((noteY-STAFF_TOP-STAFF_H)/SP)},(_,i)=>(
                      <line key={i} x1={beatX-8} y1={STAFF_TOP+STAFF_H+(i+1)*SP} x2={beatX+8} y2={STAFF_TOP+STAFF_H+(i+1)*SP}
                        stroke="var(--text-2)" strokeWidth={0.8}/>
                    ))}

                    {rn!==chord.replace(/[^A-G#]/g,'').slice(0,2)&&rn.includes('#')&&(
                      <text x={beatX-7} y={noteY+3} fontSize={9} fill="var(--text)" opacity={.8}>#</text>
                    )}

                    <ellipse cx={beatX} cy={noteY} rx={5.5} ry={4.2}
                      fill={isAct?col:"var(--text)"} opacity={isAct?.95:.88}
                      transform={`rotate(-12,${beatX},${noteY})`}/>

                    <circle cx={beatX+1.5} cy={noteY-(isMin?3:4)*(SP/2)} r={3.8}
                      fill={col} opacity={isAct?.7:.45}/>

                    <circle cx={beatX-1} cy={noteY-(isDim?4.5:3.5)*(SP/2)} r={2.8}
                      fill={col} opacity={isAct?.5:.28}/>

                    {stemUp
                      ?<line x1={beatX+5.5} y1={noteY-1} x2={beatX+5.5} y2={noteY-SP*3}
                          stroke={isAct?col:"var(--text)"} strokeWidth={1.5} opacity={isAct?.9:.75}/>
                      :<line x1={beatX-5.5} y1={noteY+1} x2={beatX-5.5} y2={noteY+SP*3}
                          stroke={isAct?col:"var(--text)"} strokeWidth={1.5} opacity={isAct?.9:.75}/>}

                    {[1,2,3].map(b=>(
                      <line key={b} x1={barX+b*BAR_W/4} y1={STAFF_TOP+STAFF_H+4}
                        x2={barX+b*BAR_W/4} y2={STAFF_TOP+STAFF_H+8}
                        stroke="var(--border-hi)" strokeWidth={b===2?1.2:0.7}/>
                    ))}

                    <rect x={barX+2} y={STAFF_TOP+STAFF_H+10} width={BAR_W-4} height={BOX_H-2}
                      rx={5} fill={isAct?`${col}22`:`${col}0e`}
                      stroke={isAct?col:"var(--border)"} strokeWidth={isAct?1.4:.7}/>
                    <rect x={barX+2} y={STAFF_TOP+STAFF_H+10} width={BAR_W-4} height={3}
                      rx={2} fill={col} opacity={isAct?.9:.55}/>
                    <text x={beatX} y={STAFF_TOP+STAFF_H+24}
                      fontSize={chord.length>4?8.5:11} fontFamily="'Georgia',serif" fontWeight="bold"
                      fill={isAct?col:col} textAnchor="middle" opacity={isAct?1:.75}>
                      {chord}
                    </text>
                  </g>
                )
              })}

              <line x1={48+chords.length*BAR_W}   y1={STAFF_TOP} x2={48+chords.length*BAR_W}   y2={STAFF_TOP+STAFF_H} stroke="var(--text)" strokeWidth={1} opacity={.75}/>
              <line x1={48+chords.length*BAR_W+3} y1={STAFF_TOP} x2={48+chords.length*BAR_W+3} y2={STAFF_TOP+STAFF_H} stroke="var(--text)" strokeWidth={3} opacity={.75}/>
            </svg>
            </div>
          </div>
        )
      })}
      </div>
      {scale.length>0&&(
        <div style={{marginTop:'.75rem',borderTop:'1px solid var(--border)',paddingTop:'.75rem'}}>
          <div style={{fontSize:'.68rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'.5rem'}}>Scale: {result.key} {result.mode}</div>
          <div style={{display:'flex',gap:'.25rem',flexWrap:'wrap'}}>
            {scale.map((s,i)=><div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'.32rem .5rem',borderRadius:8,background:i===0?'rgba(56,189,248,.12)':'var(--bg-3)',border:`1px solid ${i===0?'var(--accent)':'var(--border)'}`,minWidth:38}}><span style={{fontSize:'.78rem',fontWeight:800,color:i===0?'var(--accent)':'var(--text)'}}>{s.chord}</span><span style={{fontSize:'.58rem',color:'var(--text-3)',fontStyle:'italic'}}>{s.roman}</span></div>)}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Share modal ───────────────────────────────────────────── */
function ShareModal({result,onClose}) {
  const [copied,setCopied]=useState(false)
  if(!result)return null
  const text=`KalzTunz — ${result.genre||'Chord'} Sheet
Key: ${result.key} ${result.mode} · Mood: ${result.mood} · BPM: ${result.bpm}

${result.progressions.slice(0,3).map((p,i)=>`${i+1}. ${p}`).join('\n')}

Generate free at kalztunz.com`
  const copy=()=>navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2200)}).catch(()=>{})
  const share=p=>{const enc=encodeURIComponent(text);const u={whatsapp:`https://wa.me/?text=${enc}`,twitter:`https://twitter.com/intent/tweet?text=${enc}`,telegram:`https://t.me/share/url?url=https%3A%2F%2Fkalztunz.com&text=${enc}`};if(u[p])window.open(u[p],'_blank','noopener')}
  const nat=()=>navigator.share?.({title:'KalzTunz Chord Sheet',text,url:'https://kalztunz.com'}).catch(()=>{})
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:800,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}} onClick={onClose}>
      <div style={{width:'100%',maxWidth:400,background:'var(--bg-1)',border:'1px solid var(--border-hi)',borderRadius:22,padding:'1.75rem',boxShadow:'0 24px 80px rgba(0,0,0,.55)'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:'1rem',fontWeight:800}}>Share Chord Sheet</h2>
          <button onClick={onClose} style={{background:'none',border:'1px solid var(--border)',borderRadius:999,padding:'.3rem',cursor:'pointer',color:'var(--text-3)',display:'flex'}}><IconClose size={14}/></button>
        </div>
        <div style={{background:'var(--bg-3)',borderRadius:10,padding:'.65rem',fontSize:'.72rem',fontFamily:"'Space Mono',monospace",lineHeight:1.65,color:'var(--text-2)',marginBottom:'1rem',maxHeight:100,overflowY:'auto',border:'1px solid var(--border)',whiteSpace:'pre-wrap'}}>{text}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.45rem',marginBottom:'.6rem'}}>
          {[{l:'WhatsApp',i:'📱',p:'whatsapp',c:'#22c55e'},{l:'Twitter/X',i:'🐦',p:'twitter',c:'#1d9bf0'},{l:'Telegram',i:'✈️',p:'telegram',c:'#0088cc'},{l:'Share…',i:'↗',p:'native',c:'var(--accent)'}].map(({l,i,p,c})=>(
            <button key={p} onClick={()=>p==='native'?nat():share(p)} style={{display:'flex',alignItems:'center',gap:'.45rem',padding:'.48rem .65rem',borderRadius:10,border:`1.5px solid ${c}33`,background:`${c}0e`,cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.78rem',color:c,transition:'all .18s'}} onMouseEnter={e=>{e.currentTarget.style.background=`${c}20`}} onMouseLeave={e=>{e.currentTarget.style.background=`${c}0e`}}>{i} {l}</button>
          ))}
        </div>
        <button onClick={copy} className="btn btn--secondary" style={{width:'100%',justifyContent:'center',gap:'.4rem',background:copied?'rgba(74,222,128,.1)':'',borderColor:copied?'var(--accent-suc)':'',color:copied?'var(--accent-suc)':''}}>{copied?<><IconCheck size={14}/> Copied!</>:<><IconCopy size={14}/> Copy text</>}</button>
      </div>
    </div>
  )
}

/* ── Walkthrough popup ───────────────────────────────────────── */
const WT = [
  { Icon: IconGuitar,  title:'Start with Genre', desc:'Pick your musical style first. Genre shapes which moods, scales and instruments make harmonic sense together.' },
  { Icon: IconSmile,   title:'Choose a Mood',    desc:'Mood sets the emotional tone. Available moods are curated for your genre — no mismatches.' },
  { Icon: IconKey,     title:'Key & Scale',      desc:'Pick the root note and scale mode. Major = bright; minor = deep; dorian/mixolydian add colour; pentatonic is foolproof.' },
  { Icon: IconSliders, title:'Instruments',      desc:'Select instruments for the progression. Choosing Vocals reveals a Voice Type panel — pick your singer character.' },
  { Icon: IconMic,     title:'Voice Type',       desc:'Woman, Man, Angel, Choir, Robot and more. Each hints at melodic register and style, shown in the PDF performance notes.' },
  { Icon: IconBolt,    title:'Generate!',         desc:'Hit Generate. A local preview appears instantly. The backend then delivers the full theory result. Export PDF when ready.' },
]
function Walkthrough({ onClose }) {
  const [step, setStep] = useState(0)
  const s = WT[step], last = step === WT.length-1
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:900,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem',animation:'fadeIn .18s ease' }} onClick={onClose}>
      <div style={{ width:'100%',maxWidth:460,background:'var(--bg-1)',border:'1px solid var(--border-hi)',borderRadius:24,overflow:'hidden',boxShadow:'0 24px 80px rgba(0,0,0,.6)',animation:'dropIn .28s cubic-bezier(.34,1.2,.64,1)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ height:3,background:'var(--bg-3)' }}>
          <div style={{ height:'100%',background:'linear-gradient(90deg,var(--accent),var(--accent-2))',width:`${((step+1)/WT.length)*100}%`,transition:'width .35s ease' }}/>
        </div>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'1rem 1.5rem .4rem' }}>
          <div style={{ display:'flex',gap:'.35rem' }}>
            {WT.map((_,i) => (
              <button key={i} onClick={()=>setStep(i)} style={{ width:i===step?18:6,height:6,borderRadius:3,background:i<=step?'var(--accent)':'var(--border-hi)',border:'none',cursor:'pointer',padding:0,transition:'all .22s' }}/>
            ))}
          </div>
          <button onClick={onClose} style={{ background:'none',border:'1px solid var(--border)',borderRadius:999,padding:'.18rem .6rem',cursor:'pointer',fontSize:'.72rem',color:'var(--text-3)',fontFamily:'inherit' }}>Skip tour</button>
        </div>
        <div style={{ padding:'1.25rem 2rem 1.75rem',textAlign:'center' }}>
          <div key={step} style={{ display:'flex',justifyContent:'center',marginBottom:'.9rem',color:'var(--accent)',animation:'bounceIn .35s cubic-bezier(.34,1.4,.64,1)' }}><s.Icon size={40}/></div>
          <div style={{ fontSize:'.68rem',fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:'.3rem' }}>{step+1} / {WT.length}</div>
          <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:'1.25rem',fontWeight:800,marginBottom:'.6rem' }}>{s.title}</h3>
          <p style={{ color:'var(--text-2)',fontSize:'.875rem',lineHeight:1.7 }}>{s.desc}</p>
        </div>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.85rem 1.5rem 1.4rem',borderTop:'1px solid var(--border)' }}>
          <button disabled={step===0} onClick={()=>setStep(s=>s-1)} style={{ background:'none',border:'1px solid var(--border)',borderRadius:10,padding:'.4rem .85rem',cursor:step===0?'default':'pointer',opacity:step===0?.35:1,fontFamily:'inherit',fontSize:'.8rem',color:'var(--text-2)' }}>← Back</button>
          <span style={{ fontSize:'.72rem',color:'var(--text-3)' }}>{step+1} of {WT.length}</span>
          {last
            ? <button onClick={onClose} style={{ background:'linear-gradient(135deg,var(--accent),var(--accent-2))',border:'none',borderRadius:10,padding:'.45rem 1.25rem',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.85rem',color:'#fff' }}>Let's create!</button>
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
    <button onClick={onClick} style={{ display:'flex',alignItems:'center',gap:'.42rem',padding:'.32rem .72rem',borderRadius:999,background:active?`${color}14`:done?'rgba(74,222,128,.08)':'var(--bg-3)',border:`1.5px solid ${active?color:done?'var(--accent-suc)':'var(--border)'}`,transition:'all .2s',cursor:'pointer',fontFamily:'inherit' }}>
      <div style={{ width:19,height:19,borderRadius:'50%',background:active?color:done?'var(--accent-suc)':'var(--bg-4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.66rem',fontWeight:800,color:active||done?'#fff':'var(--text-3)',flexShrink:0 }}>
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize:'.73rem',fontWeight:700,color:active?color:done?'var(--accent-suc)':'var(--text-3)',whiteSpace:'nowrap' }}>{label}</span>
    </button>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function Generate() {
  const { user } = useAuth()

  const [genre,         setGenre]         = useState(null)
  const [mood,          setMood]          = useState(null)
  const [key,           setKey]           = useState('C')
  const [scaleMode,     setScaleMode]     = useState('major')
  const [instruments,   setInstruments]   = useState([])
  const [voiceType,     setVoiceType]     = useState('woman')
  const [bpm,           setBpm]           = useState(120)
  const [duration,      setDuration]      = useState(120)
  const [numVariations, setNumVariations] = useState(3)

  const [wiz,        setWiz]      = useState(1)
  const [showWalk,   setShowWalk] = useState(false)
  const [loading,    setLoading]  = useState(false)
  const [result,     setResult]   = useState(null)
  const [error,      setError]    = useState(null)
  const [jobStatus,  setJobStatus]= useState(null)
  const [pdfLoading, setPdfLoad]  = useState(false)
  const [pdfInstr,   setPdfInstr]  = useState('all')
  const [view,       setView]      = useState('sheet')
  const [showShare,  setShowShare] = useState(false)
  const [saveMsg,    setSaveMsg]   = useState(null)
  const player = useChordPlayer()

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
        const d = await safeJson(r)
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
    if (progs.length) player.load(progs[0], r.bpm||Number(bpm))
  }, [genre,mood,key,scaleMode,bpm,duration,instruments,voiceType,player])

  const handleGenerate = async () => {
    if (!canGen) return
    setLoading(true); setError(null); setJobStatus(null)
    const localProgs = buildLocal(key, scaleMode, mood, numVariations)
    const ri = CHROMATIC.indexOf(key)
    const sn = (SCALE_INT[scaleMode]||SCALE_INT.major).map(i=>CHROMATIC[(ri+i)%12])
    setResult({ genre, mood, key, mode:scaleMode, bpm:Number(bpm), duration:Number(duration), instruments, voiceType, progressions:localProgs, richProgs:[], scaleNotes:sn, scaleRef:buildScaleRef(key,scaleMode), instrNotes:{}, isLocal:true })
    if (localProgs.length) player.load(localProgs[0], Number(bpm))
    try {
      const fd = new FormData()
      fd.append('root_note', key); fd.append('scale_mode', scaleMode); fd.append('mood', mood)
      fd.append('style', genre); fd.append('bpm', String(bpm)); fd.append('duration', String(duration))
      fd.append('instruments', JSON.stringify(hasVocals?[...instruments,`voice:${voiceType}`]:instruments))
      fd.append('num_variations', String(numVariations))
      const res = await fetch(`${API}/api/generate`,{method:'POST',body:fd})
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.detail||'Generation failed')
      setJobStatus(data.status)
      if (data.mode==='sync'&&data.result) { setLoading(false); applyResult(data.result); return }
      pollJob(data.job_id)
    } catch(e) {
      setLoading(false)
      const friendly = e.message?.includes('fetch') || e.message?.includes('Failed')
        ? 'Server unreachable — showing instant local preview instead.'
        : `Showing local preview — ${e.message}`
      setError(friendly)
    }
  }

  const handleSave = useCallback(() => {
    if (!result) return
    saveGenerationToLib(result)
    setSaveMsg('✓ Saved to Library!'); setTimeout(() => setSaveMsg(null), 2500)
  }, [result])

  const handlePDF = async () => {
    if (!result) return; setPdfLoad(true)
    try {
      await exportPDF(
        { genre, mood, key, mode:scaleMode, bpm:Number(bpm), duration:Number(duration), instruments, hasVocals, voiceType },
        result.progressions,
        result.richProgs || [],
        result.scaleRef  || [],
        result.instrNotes || {},
        pdfInstr
      )
    } catch(e) { console.error(e); setError('PDF generation failed. Try again.') }
    finally { setPdfLoad(false) }
  }

  const COLORS = ['var(--accent)','var(--accent-2)','var(--accent-3)','var(--red)','var(--green)','#8b5cf6']

  return (
    <div className="page-wrap page--generate" style={{ paddingTop:'1.75rem' }}>
      {showWalk && <Walkthrough onClose={()=>setShowWalk(false)}/>
      }{showShare && <ShareModal result={result} onClose={()=>setShowShare(false)}/>}

      {/* ── Header ── */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'1rem',marginBottom:'1.5rem',flexWrap:'wrap' }}>
        <div>
          <div className="page-header__badge" style={{ marginBottom:'.45rem' }}>AI Generation</div>
          <h1 style={{ fontFamily:"'Playfair Display',serif",fontSize:'clamp(1.5rem,3vw,2rem)',fontWeight:800,marginBottom:'.3rem' }}>Generate Chord Progressions</h1>
          <p style={{ color:'var(--text-2)',fontSize:'.875rem' }}>Pick your genre first — settings adapt to your choice. Follow the steps below.</p>
        </div>
        <button onClick={()=>setShowWalk(true)} style={{ display:'flex',alignItems:'center',gap:'.4rem',padding:'.4rem .9rem',borderRadius:11,border:'1.5px solid var(--border-hi)',background:'var(--bg-2)',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.8rem',color:'var(--text-2)',transition:'all .2s',flexShrink:0 }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-hi)';e.currentTarget.style.color='var(--text-2)'}}>
          How to use
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

      {/* ── Two-column layout — FIXED: was a raw inline gridTemplateColumns
           ("1fr 380px") matched by a brittle CSS `[style*=…]` selector that
           only recognised "1fr 400px", so this page never collapsed to a
           single column on mobile. Now uses the shared .split-layout class
           with the width passed as a CSS custom property, so it always
           collapses correctly regardless of the exact px value. ── */}
      <div className="split-layout" style={{ '--split-w':'380px' }}>

        {/* LEFT: Steps */}
        <div style={{ display:'flex',flexDirection:'column',gap:'1.1rem' }}>

          {/* STEP 1 — Genre */}
          <div className="card" style={{ padding:'1.5rem',borderTop:`3px solid ${wiz===1?'var(--accent)':'var(--border)'}`,transition:'border-color .3s' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.1rem',flexWrap:'wrap',gap:'.5rem' }}>
              <div>
                <div style={{ fontWeight:800,fontSize:'1rem',fontFamily:"'Playfair Display',serif" }}>
                  <span style={{ color:'var(--accent)',marginRight:'.35rem' }}>1</span>Genre
                </div>
                <div style={{ fontSize:'.76rem',color:'var(--text-3)',marginTop:'.08rem' }}>What musical world are you creating in?</div>
              </div>
              {gObj && <span className="badge badge--coral" style={{gap:'.3rem'}}><gObj.Icon size={12}/> {gObj.label}</span>}
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:'.5rem' }}>
              {GENRES.map(g => (
                <button key={g.id} onClick={()=>{setGenre(g.id);setMood(null);setWiz(2)}}
                  style={{ display:'flex',flexDirection:'column',alignItems:'flex-start',padding:'.75rem .85rem',borderRadius:12,border:`2px solid ${genre===g.id?g.color:'var(--border)'}`,background:genre===g.id?`${g.color}12`:'var(--bg-2)',cursor:'pointer',fontFamily:'inherit',transition:'all .2s',textAlign:'left' }}
                  onMouseEnter={e=>{if(genre!==g.id){e.currentTarget.style.borderColor=g.color+'66';e.currentTarget.style.background=`${g.color}07`}}}
                  onMouseLeave={e=>{if(genre!==g.id){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg-2)'}}}>
                  <span style={{ display:'flex',marginBottom:'.3rem',color:genre===g.id?g.color:'var(--text-2)' }}><g.Icon size={22}/></span>
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
                    <span style={{ color:'var(--accent-2)',marginRight:'.35rem' }}>2</span>Mood
                    <span style={{ fontWeight:400,fontSize:'.74rem',color:'var(--text-3)',marginLeft:'.5rem' }}>for {gObj?.label}</span>
                  </div>
                  <div style={{ fontSize:'.76rem',color:'var(--text-3)',marginTop:'.08rem' }}>Sets the emotional tone and progression pattern</div>
                </div>
                {mObj && <span style={{ fontSize:'.82rem',fontWeight:700,color:mObj.color,display:'flex',alignItems:'center',gap:'.3rem' }}><mObj.Icon size={14}/> {mood}</span>}
              </div>
              <div style={{ display:'flex',flexWrap:'wrap',gap:'.5rem' }}>
                {avMoods.map(m => {
                  const mt = MOOD_META[m]
                  return (
                    <button key={m} onClick={()=>{setMood(m);setWiz(3)}}
                      style={{ display:'flex',alignItems:'center',gap:'.45rem',padding:'.55rem .9rem',borderRadius:12,border:`2px solid ${mood===m?mt.color:'var(--border)'}`,background:mood===m?`${mt.color}14`:`${mt.color}08`,cursor:'pointer',fontFamily:'inherit',transition:'all .2s' }}
                      onMouseEnter={e=>{if(mood!==m){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.borderColor=mt.color+'55'}}}
                      onMouseLeave={e=>{if(mood!==m){e.currentTarget.style.transform='';e.currentTarget.style.borderColor='var(--border)'}}}>
                      <span style={{ display:'flex',color:mood===m?mt.color:'var(--text-2)' }}><mt.Icon size={17}/></span>
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
                <span style={{ color:'var(--accent-3)',marginRight:'.35rem' }}>3</span>Key &amp; Scale
              </div>
              <div style={{ fontSize:'.76rem',color:'var(--text-3)',marginBottom:'1.1rem' }}>Root note + scale mode define every chord in the progression</div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.1rem' }}>
                <div>
                  <div className="form-label" style={{ marginBottom:'.5rem' }}>Root Note — <span style={{ color:'var(--accent-3)',fontWeight:700 }}>{key}</span></div>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:'.32rem' }}>
                    {KEYS.map(k => (
                      <button key={k} onClick={()=>{setKey(k);setWiz(3)}}
                        style={{ width:36,height:36,borderRadius:9,border:`2px solid ${key===k?'var(--accent-3)':'var(--border)'}`,background:key===k?'rgba(34,211,238,.12)':'var(--bg-2)',color:key===k?'var(--accent-3)':'var(--text)',fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:'.8rem',cursor:'pointer',transition:'all .16s' }}>
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
                        style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.42rem .7rem',borderRadius:9,border:`1.5px solid ${scaleMode===s.id?'var(--accent-3)':'var(--border)'}`,background:scaleMode===s.id?'rgba(34,211,238,.08)':'var(--bg-2)',cursor:'pointer',fontFamily:'inherit',transition:'all .16s',textAlign:'left' }}>
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
                <span style={{ color:'#e87a30',marginRight:'.35rem' }}>4</span>Instrumentation
                <span style={{ fontWeight:400,fontSize:'.74rem',color:'var(--text-3)',marginLeft:'.5rem' }}>{instruments.length} selected</span>
              </div>
              <div style={{ fontSize:'.76rem',color:'var(--text-3)',marginBottom:'1rem' }}>Choose the instruments — selecting Vocals reveals voice type options below</div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:'.48rem' }}>
                {INSTRUMENTS_LIST.map(inst => (
                  <button key={inst.id} onClick={()=>{toggleInstrument(inst.id);setWiz(4)}}
                    style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:'.3rem',padding:'.7rem .5rem',borderRadius:12,border:`2px solid ${instruments.includes(inst.id)?'#e87a30':'var(--border)'}`,background:instruments.includes(inst.id)?'rgba(232,122,48,.1)':'var(--bg-2)',cursor:'pointer',fontFamily:'inherit',transition:'all .2s' }}
                    onMouseEnter={e=>{if(!instruments.includes(inst.id)){e.currentTarget.style.borderColor='#e87a3066';e.currentTarget.style.transform='translateY(-2px)'}}}
                    onMouseLeave={e=>{if(!instruments.includes(inst.id)){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform=''}}}>
                    <span style={{ display:'flex',color:instruments.includes(inst.id)?'#e87a30':'var(--text-2)' }}><inst.Icon size={22}/></span>
                    <span style={{ fontSize:'.77rem',fontWeight:700,color:instruments.includes(inst.id)?'#e87a30':'var(--text)' }}>{inst.label}</span>
                    {instruments.includes(inst.id) && <span style={{ fontSize:'.58rem',color:'#e87a30' }}>✓</span>}
                  </button>
                ))}
              </div>

              {hasVocals && (
                <div style={{ marginTop:'1.1rem',paddingTop:'1rem',borderTop:'1px solid var(--border)',animation:'fadeUp .22s ease' }}>
                  <div style={{ fontWeight:700,fontSize:'.875rem',marginBottom:'.65rem',display:'flex',alignItems:'center',gap:'.42rem' }}>
                    Voice Type
                    <span style={{ fontWeight:400,fontSize:'.72rem',color:'var(--text-3)' }}>Only for songs with a singer</span>
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(105px,1fr))',gap:'.42rem' }}>
                    {VOICE_TYPES.map(v => (
                      <button key={v.id} onClick={()=>setVoiceType(v.id)}
                        style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:'.22rem',padding:'.58rem .4rem',borderRadius:10,border:`2px solid ${voiceType===v.id?'var(--red)':'var(--border)'}`,background:voiceType===v.id?'rgba(239,68,68,.1)':'var(--bg-2)',cursor:'pointer',fontFamily:'inherit',transition:'all .18s' }}>
                        <span style={{ display:'flex',color:voiceType===v.id?'var(--red)':'var(--text-2)' }}><v.Icon size={19}/></span>
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
                <span style={{ color:'var(--green)',marginRight:'.35rem' }}>5</span>Parameters
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
            style={{ padding:'.9rem',fontSize:'1rem',justifyContent:'center',borderRadius:16,opacity:canGen?1:.45,gap:'.5rem' }}>
            {loading
              ? <><span className="spinner" style={{width:16,height:16,borderWidth:2}}/> {jobStatus==='queued'?'Queued…':'Generating…'}</>
              : canGen ? <><IconBolt size={17}/> Generate Progressions</> : `Complete steps ${!genre?'1 ':''} ${!mood?'2 ':''} ${!instruments.length?'4 ':''}above`
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
                { label:'Genre',       val: gObj ? <span style={{display:'flex',alignItems:'center',gap:'.3rem',justifyContent:'flex-end'}}><gObj.Icon size={13}/> {gObj.label}</span> : '—', color: gObj?.color },
                { label:'Mood',        val: mObj ? <span style={{display:'flex',alignItems:'center',gap:'.3rem',justifyContent:'flex-end'}}><mObj.Icon size={13}/> {mood}</span> : '—', color: mObj?.color },
                { label:'Key',         val: `${key} ${scaleMode}`,                                              color:'var(--accent-3)' },
                { label:'Instruments', val: instruments.length ? instruments.join(', ') : '—',                  color:'#e87a30' },
                ...(hasVocals ? [{label:'Voice', val:(()=>{const vt=VOICE_TYPES.find(v=>v.id===voiceType);return vt?<span style={{display:'flex',alignItems:'center',gap:'.3rem',justifyContent:'flex-end'}}><vt.Icon size={13}/> {voiceType}</span>:voiceType})(), color:'var(--red)'}] : []),
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
                  {result.isLocal ? 'Preview' : 'Generated'}
                </div>
                <div style={{ display:'flex',gap:'.28rem' }}>
                  {[['sheet','Sheet'],['progressions','Chords'],['scale','Scale']].map(([v,l]) => (
                    <button key={v} onClick={()=>setView(v)} style={{ padding:'.22rem .5rem',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'.7rem',transition:'all .16s',background:view===v?'var(--accent)':'var(--bg-3)',color:view===v?'#fff':'var(--text-2)' }}>{l}</button>
                  ))}
                </div>
              </div>

              <PlayerBar
                player={player}
                chords={result.progressions[0]?.split(' — ').filter(Boolean)||[]}
                title={`${result.key} ${result.mode} · ${result.genre||''} · ${result.bpm} BPM`}
              />

              {view==='sheet' && (
                <div style={{ overflowX:'auto' }}>
                  <SheetMusicView result={result} player={player}/>
                </div>
              )}

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
                      <div key={i} style={{ flex:1,minWidth:34,padding:'.45rem .2rem',textAlign:'center',background:i===0?'rgba(56,189,248,.1)':'var(--bg-2)',border:`1.5px solid ${i===0?'var(--accent)':'var(--border)'}`,borderRadius:8,fontSize:'.8rem',fontWeight:700,color:i===0?'var(--accent)':'var(--text)' }}>{n}</div>
                    ))}
                  </div>
                  {result.instruments.length > 0 && (
                    <div style={{ fontSize:'.78rem',color:'var(--text-2)',lineHeight:1.65 }}>
                      <div style={{ fontWeight:700,fontSize:'.8rem',marginBottom:'.45rem' }}>Performance notes</div>
                      {result.instruments.map(id => {
                        const inst = INSTRUMENTS_LIST.find(i=>i.id===id)
                        const note = result.instrNotes?.[id]
                        const fb = { guitar:`Capo for ${result.key}. Strum D-DU-UDU.`, piano:`Root octaves LH, inversions RH.`, bass:`Root beat 1, 5th beat 3.`, drums:`${result.bpm}bpm — kick 1, snare 2&4.`, vocals:`Voice (${result.voiceType}): stay in ${result.key} scale.`, strings:`Long bow on root + 5th.`, synth:`Slow-attack pad + 1-3-5-7 arp.`, brass:`Staccato beat 1, sustain off-beats.` }
                        if (!inst) return null
                        return <div key={id} style={{ padding:'.28rem 0',borderBottom:'1px solid var(--border)',display:'flex',gap:'.4rem',alignItems:'flex-start' }}><span style={{color:'var(--accent)',fontWeight:700,display:'flex',alignItems:'center',gap:'.3rem',flexShrink:0}}><inst.Icon size={13}/> {inst.label}:</span><span>{note||fb[id]||''}</span></div>
                      })}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop:'1rem',paddingTop:'.75rem',borderTop:'1px solid var(--border)' }}>
                <div style={{ marginBottom:'.6rem' }}>
                  <div style={{ fontSize:'.68rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'.35rem' }}>PDF part filter</div>
                  <div style={{ display:'flex',gap:'.3rem',flexWrap:'wrap' }}>
                    {['all',...(result.instruments||[])].map(inst => (
                      <button key={inst} onClick={()=>setPdfInstr(inst)}
                        style={{ padding:'.2rem .5rem',borderRadius:8,border:`1.5px solid ${pdfInstr===inst?'var(--accent)':'var(--border)'}`,background:pdfInstr===inst?'rgba(56,189,248,.1)':'var(--bg-3)',color:pdfInstr===inst?'var(--accent)':'var(--text-2)',fontSize:'.7rem',fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all .16s' }}>
                        {inst==='all'?'Full Score':inst}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display:'flex',gap:'.38rem',flexWrap:'wrap' }}>
                  <button className="btn btn--primary btn--sm" onClick={handlePDF} disabled={pdfLoading}>
                    {pdfLoading?<><span className="spinner" style={{width:10,height:10,borderWidth:1.5}}/> Building…</>:'Sheet Music PDF'}
                  </button>
                  <button className="btn btn--secondary btn--sm" onClick={()=>navigator.clipboard.writeText(result.progressions.join('\n')).catch(()=>{})}>Copy</button>
                  <button className="btn btn--ghost btn--sm" onClick={handleGenerate} disabled={loading} style={{gap:'.35rem'}}><IconReplay size={13}/> Regenerate</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding:'2.5rem',textAlign:'center',color:'var(--text-3)' }}>
              <div style={{ display:'flex',justifyContent:'center',marginBottom:'.75rem',color:'var(--accent)' }}><IconBolt size={40}/></div>
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
      `}</style>
    </div>
  )
}
