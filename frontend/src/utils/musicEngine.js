/**
 * KalzTunz Music Engine — shared by Generate, Extraction, Library, Search
 * Chord synthesis, theory helpers, localStorage library management,
 * and centralized app-history tracking (searches, plays, extractions,
 * generations, playlists — one shared log, filtered per-page).
 */
export const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
export const SCALE_INT = { major:[0,2,4,5,7,9,11], minor:[0,2,3,5,7,8,10], dorian:[0,2,3,5,7,9,10], mixolydian:[0,2,4,5,7,9,10], pentatonic:[0,2,4,7,9], blues:[0,3,5,6,7,10] }
export const CHORD_TY  = { major:['','','m','','','m','dim'], minor:['m','dim','','m','m','',''], dorian:['m','m','','','m','dim',''], mixolydian:['','m','dim','','m','m',''], pentatonic:['','m','m','',''], blues:['m','m','m','','m',''] }
export const ROMAN_MAJ = ['I','ii','iii','IV','V','vi','vii°']
export const ROMAN_MIN = ['i','ii°','III','iv','v','VI','VII']
export const MOOD_PROG = { happy:[[0,3,4,3],[0,4,5,3]], sad:[[0,5,3,6],[0,3,6,4]], energetic:[[0,4,5,4],[0,3,4,0]], calm:[[0,5,3,4],[0,3,5,4]], dark:[[0,6,3,7],[0,5,6,3]], romantic:[[0,5,3,4],[0,3,5,6]], epic:[[0,7,5,4],[0,5,7,4]], mysterious:[[0,1,5,0],[6,0,5,3]], uplifting:[[0,4,5,3],[0,3,4,5]] }
export const KEY_FREQS = { C:261.63,'C#':277.18,D:293.66,'D#':311.13,E:329.63,F:349.23,'F#':369.99,G:392,'G#':415.3,A:440,'A#':466.16,B:493.88 }
export const STAFF_POS = { C:5,D:6,E:0,F:1,G:2,A:3,B:4 }
export const fmtDur = s => { const n=Math.max(0,s||0); return `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}` }

export function chordFreqs(name, hz) {
  const st = n => hz * Math.pow(2,n/12)
  if (name.endsWith('dim')) return [hz/2, hz, st(3), st(6)]
  if (name.endsWith('m'))   return [hz/2, hz, st(3), st(7)]
  return [hz/2, hz, st(4), st(7)]
}

export function buildLocal(root, mode, mood, num) {
  const ri=CHROMATIC.indexOf(root), int=SCALE_INT[mode]||SCALE_INT.major, ty=CHORD_TY[mode]||CHORD_TY.major
  const sc=int.map(i=>CHROMATIC[(ri+i)%12]), tp=MOOD_PROG[mood]||MOOD_PROG.happy
  return Array.from({length:num},(_,i)=>tp[i%tp.length].map(d=>`${sc[d%sc.length]}${ty[d%ty.length]||''}`).join(' — '))
}

export function buildScaleRef(root, mode) {
  const ri=CHROMATIC.indexOf(root), int=SCALE_INT[mode]||SCALE_INT.major, ty=CHORD_TY[mode]||CHORD_TY.major, rom=mode==='minor'?ROMAN_MIN:ROMAN_MAJ
  return int.map((iv,i)=>({ note:CHROMATIC[(ri+iv)%12], chord:`${CHROMATIC[(ri+iv)%12]}${ty[i]||''}`, roman:rom[Math.min(i,rom.length-1)], quality:ty[i]||'' }))
}

export class ChordSynth {
  constructor() { this._r(); this._cbs={progress:[],chordIdx:[],end:[]} }
  _r() { this.ctx=null; this.gain=null; this.tmr=null; this.pauseAt=0; this.wall=0; this.chords=[]; this.bpm=120; this.total=0 }
  on(e,f){ (this._cbs[e]||(this._cbs[e]=[])).push(f); return this }
  _emit(e,d){ (this._cbs[e]||[]).forEach(f=>f(d)) }
  _ctx(){ if(!this.ctx||this.ctx.state==='closed') this.ctx=new(window.AudioContext||window.webkitAudioContext)(); return this.ctx }
  load(str,bpm=120){ this.chords=str.split(' — ').filter(Boolean); this.bpm=bpm; this.total=this.chords.length*(60/bpm)*4; return this }
  _sched(from){ const ctx=this._ctx(),spc=(60/this.bpm)*4; this.gain=ctx.createGain(); this.gain.gain.value=0.14; this.gain.connect(ctx.destination); this.chords.forEach((chord,ci)=>{ const rel=ci*spc-from; if(rel+spc<0)return; const at=ctx.currentTime+Math.max(0,rel),end=at+spc*0.88; const root=chord.replace(/m$|dim$|aug$/,'').replace(/[^A-G#]/g,''),hz=KEY_FREQS[root]||261.63; chordFreqs(chord,hz).forEach((freq,fi)=>{ const o=ctx.createOscillator(),env=ctx.createGain(); o.type=fi===0?'sawtooth':'triangle'; o.frequency.value=freq; env.gain.setValueAtTime(0,at); env.gain.linearRampToValueAtTime(fi===0?.55:.38,at+0.06); env.gain.setValueAtTime(fi===0?.45:.30,end-0.1); env.gain.linearRampToValueAtTime(0,end); o.connect(env);env.connect(this.gain);o.start(at);o.stop(end+0.05) }) }) }
  _tick(from){ if(this.tmr)clearInterval(this.tmr); this.wall=Date.now()-from*1000; const spc=(60/this.bpm)*4; this.tmr=setInterval(()=>{ const el=(Date.now()-this.wall)/1000; if(el>=this.total){this.stop();this._emit('end');return} this._emit('progress',{elapsed:el,progress:el/this.total}); this._emit('chordIdx',Math.min(Math.floor(el/spc),this.chords.length-1)) },80) }
  play(from=0){ this.stop(); if(!this.chords.length)return; this.pauseAt=from; this._sched(from); this._tick(from) }
  pause(){ if(this.tmr){clearInterval(this.tmr);this.tmr=null} this.pauseAt=(Date.now()-this.wall)/1000; if(this.ctx?.state==='running')this.ctx.suspend().catch(()=>{}) }
  resume(){ if(this.ctx?.state==='suspended'){this.ctx.resume().then(()=>this._tick(this.pauseAt)).catch(()=>{})}else{this.play(this.pauseAt)} }
  seekTo(f){ const t=Math.max(0,f)*this.total; this.stop(); this._sched(t); this._tick(t) }
  stop(){ if(this.tmr){clearInterval(this.tmr);this.tmr=null} try{this.gain?.disconnect()}catch{} try{this.ctx?.close()}catch{} this.ctx=null;this.gain=null }
  get duration(){ return this.total }
}

const LS='kalztunz_library_data'
const empty=()=>({saved:[],liked:[],artists:[],playlists:[],extractions:[],generations:[]})
export const loadLibData=()=>{ try{return JSON.parse(localStorage.getItem(LS)||'null')||empty()}catch{return empty()} }
export const saveLibData=d=>{ try{localStorage.setItem(LS,JSON.stringify(d))}catch{} }

/* ════════════════════════════════════════════════════════════════
   APP HISTORY — one shared, centralized activity log.
   Every page writes here (search, artist view, track play, playlist
   play, extraction saved, generation saved) so Library's "History"
   section is a real unified app-history feed, not just search terms.
   Individual pages can filter by `type` when they only want a subset
   (e.g. Search's dropdown only wants type 'search'/'artist').
   ════════════════════════════════════════════════════════════════ */
const HISTORY_KEY = 'kalztunz_search_history'
const HISTORY_MAX = 100

export const loadHistory = () => {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}
export const saveHistory = h => {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX))) } catch {}
}

/**
 * addHistoryEntry('search'|'artist'|'play'|'extraction'|'generation'|'playlist', label, meta?)
 * De-duplicates by (type, label) so repeatedly playing/searching the same
 * thing bumps it to the top instead of spamming the list.
 */
export function addHistoryEntry(type, label, meta = {}) {
  if (!label) return null
  const history = loadHistory()
  const entry = { id: Date.now() + Math.random(), query: label, type, timestamp: new Date().toISOString(), meta }
  const deduped = history.filter(h => !(h.type === type && h.query.toLowerCase() === label.toLowerCase()))
  saveHistory([entry, ...deduped])
  return entry
}

export const HISTORY_ICONS = { search:'🔍', artist:'👤', play:'▶', extraction:'🎸', generation:'🤖', playlist:'📂' }

export function saveGenerationToLib(r){
  const d=loadLibData()
  const e={ id:`g${Date.now()}`, title:`${(r.genre||'generated').charAt(0).toUpperCase()+(r.genre||'generated').slice(1)} — ${r.key} ${r.mode}`, style:r.genre||'generated', key:`${r.key} ${r.mode}`, bpm:r.bpm||120, mood:r.mood||'', instruments:r.instruments||[], voiceType:r.voiceType||'', progressions:r.progressions||[], scaleRef:r.scaleRef||[], instrNotes:r.instrNotes||{}, status:'finished', createdAt:new Date().toISOString() }
  d.generations=[e,...(d.generations||[]).filter(g=>g.id!==e.id).slice(0,49)]; saveLibData(d)
  addHistoryEntry('generation', e.title, { id: e.id })
  return e
}

export function saveExtractionToLib(r,file){
  const d=loadLibData()
  const e={ id:`ex${Date.now()}`, title:file?.name?.replace(/\.[^.]+$/,'')||'Extraction', key:r.metadata?.key||'?', bpm:r.metadata?.bpm||0, duration:r.metadata?.duration||0, totalChords:r.chords?.length||0, progressions:r.suggested_progressions||[], createdAt:new Date().toISOString() }
  d.extractions=[e,...(d.extractions||[]).filter(x=>x.id!==e.id).slice(0,49)]; saveLibData(d)
  addHistoryEntry('extraction', e.title, { id: e.id })
  return e
}
