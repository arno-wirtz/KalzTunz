import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext(null)
export const useTheme = () => useContext(ThemeContext)

/*
  Color palettes:
    coral   – warm-electric orange/amber (default)
    ocean   – deep blue + teal
    forest  – emerald + sage
    violet  – purple + pink
    rose    – warm pink + peach
    midnight – deep indigo + electric blue
*/
export const COLOR_PALETTES = {
  coral: {
    label: 'Coral',
    icon: '🔥',
    dark:  { accent:'#ff6b47', accent2:'#ffb347', accent3:'#00d4c8', red:'#e8365d', green:'#34d399', glow:'rgba(255,107,71,.28)', glow2:'rgba(255,179,71,.22)', glow3:'rgba(0,212,200,.22)' },
    light: { accent:'#e8542a', accent2:'#d4821a', accent3:'#00968a', red:'#c41f3b', green:'#1e9e6e', glow:'rgba(232,84,42,.18)', glow2:'rgba(212,130,26,.15)', glow3:'rgba(0,150,138,.15)' },
  },
  ocean: {
    label: 'Ocean',
    icon: '🌊',
    dark:  { accent:'#38bdf8', accent2:'#06b6d4', accent3:'#22d3ee', red:'#e8365d', green:'#34d399', glow:'rgba(56,189,248,.28)', glow2:'rgba(6,182,212,.22)', glow3:'rgba(34,211,238,.22)' },
    light: { accent:'#0284c7', accent2:'#0e7490', accent3:'#0891b2', red:'#c41f3b', green:'#1e9e6e', glow:'rgba(2,132,199,.18)', glow2:'rgba(14,116,144,.15)', glow3:'rgba(8,145,178,.15)' },
  },
  forest: {
    label: 'Forest',
    icon: '🌿',
    dark:  { accent:'#4ade80', accent2:'#a3e635', accent3:'#34d399', red:'#f43f5e', green:'#86efac', glow:'rgba(74,222,128,.28)', glow2:'rgba(163,230,53,.22)', glow3:'rgba(52,211,153,.22)' },
    light: { accent:'#16a34a', accent2:'#65a30d', accent3:'#059669', red:'#be123c', green:'#15803d', glow:'rgba(22,163,74,.18)', glow2:'rgba(101,163,13,.15)', glow3:'rgba(5,150,105,.15)' },
  },
  violet: {
    label: 'Violet',
    icon: '💜',
    dark:  { accent:'#a78bfa', accent2:'#e879f9', accent3:'#818cf8', red:'#f43f5e', green:'#34d399', glow:'rgba(167,139,250,.28)', glow2:'rgba(232,121,249,.22)', glow3:'rgba(129,140,248,.22)' },
    light: { accent:'#7c3aed', accent2:'#a21caf', accent3:'#4f46e5', red:'#be123c', green:'#15803d', glow:'rgba(124,58,237,.18)', glow2:'rgba(162,28,175,.15)', glow3:'rgba(79,70,229,.15)' },
  },
  rose: {
    label: 'Rose',
    icon: '🌸',
    dark:  { accent:'#fb7185', accent2:'#f472b6', accent3:'#fda4af', red:'#e8365d', green:'#34d399', glow:'rgba(251,113,133,.28)', glow2:'rgba(244,114,182,.22)', glow3:'rgba(253,164,175,.22)' },
    light: { accent:'#e11d48', accent2:'#be185d', accent3:'#fb7185', red:'#9f1239', green:'#15803d', glow:'rgba(225,29,72,.18)', glow2:'rgba(190,24,93,.15)', glow3:'rgba(251,113,133,.15)' },
  },
  midnight: {
    label: 'Midnight',
    icon: '🌙',
    dark:  { accent:'#60a5fa', accent2:'#818cf8', accent3:'#a78bfa', red:'#f87171', green:'#34d399', glow:'rgba(96,165,250,.28)', glow2:'rgba(129,140,248,.22)', glow3:'rgba(167,139,250,.22)' },
    light: { accent:'#1d4ed8', accent2:'#4338ca', accent3:'#6d28d9', red:'#dc2626', green:'#15803d', glow:'rgba(29,78,216,.18)', glow2:'rgba(67,56,202,.15)', glow3:'rgba(109,40,217,.15)' },
  },
}

function applyPalette(palette, mode) {
  const p = COLOR_PALETTES[palette]?.[mode]
  if (!p) return
  const r = document.documentElement
  r.style.setProperty('--coral',    p.accent)
  r.style.setProperty('--amber',    p.accent2)
  r.style.setProperty('--cyan',     p.accent3)
  r.style.setProperty('--red',      p.red)
  r.style.setProperty('--green',    p.green)
  r.style.setProperty('--accent',   p.accent)
  r.style.setProperty('--accent-2', p.accent2)
  r.style.setProperty('--accent-3', p.accent3)
  r.style.setProperty('--glow',     `0 0 28px ${p.glow}`)
  r.style.setProperty('--glow-2',   `0 0 28px ${p.glow2}`)
  r.style.setProperty('--glow-3',   `0 0 28px ${p.glow3}`)
  // Update badge colors
  r.style.setProperty('--palette-id', palette)
}

export function ThemeProvider({ children }) {
  const [mode, _setMode] = useState(() => {
    const s = localStorage.getItem('kalztunz_theme')
    if (s === 'light' || s === 'dark') return s
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [palette, _setPalette] = useState(() =>
    localStorage.getItem('kalztunz_palette') || 'coral'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
    document.documentElement.setAttribute('data-palette', palette)
    localStorage.setItem('kalztunz_theme', mode)
    applyPalette(palette, mode)
  }, [mode, palette])

  // OS theme sync
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h  = (e) => {
      if (!localStorage.getItem('kalztunz_theme')) {
        const m = e.matches ? 'dark' : 'light'
        _setMode(m)
        applyPalette(palette, m)
      }
    }
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [palette])

  const toggleTheme = useCallback(() => {
    _setMode(m => {
      const next = m === 'dark' ? 'light' : 'dark'
      applyPalette(palette, next)
      return next
    })
  }, [palette])

  const setTheme = useCallback((m) => {
    if (m === 'system') {
      localStorage.removeItem('kalztunz_theme')
      const next = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      _setMode(next); applyPalette(palette, next)
    } else {
      _setMode(m); applyPalette(palette, m)
    }
  }, [palette])

  const setPalette = useCallback((p) => {
    localStorage.setItem('kalztunz_palette', p)
    _setPalette(p)
    applyPalette(p, mode)
  }, [mode])

  return (
    <ThemeContext.Provider value={{ theme: mode, palette, toggleTheme, setTheme, setThemeMode: setTheme, setPalette, COLOR_PALETTES }}>
      {children}
    </ThemeContext.Provider>
  )
}
