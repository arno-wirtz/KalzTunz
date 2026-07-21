import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext(null)
export const useTheme = () => useContext(ThemeContext)

/*
  Single unified theme per the design spec — light blue (#38BDF8) primary
  accent, red (#EF4444) danger, light green (#4ADE80) success. All colors
  live in App.css's [data-theme="dark"] / [data-theme="light"] blocks.
  This context's only job is to track and persist which mode is active
  and sync with the OS preference when the user hasn't explicitly chosen.
*/

export function ThemeProvider({ children }) {
  const [mode, _setMode] = useState(() => {
    const s = localStorage.getItem('kalztunz_theme')
    if (s === 'light' || s === 'dark') return s
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
  }, [mode])

  // OS theme sync — only applies while the user hasn't explicitly picked a mode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h  = (e) => {
      if (!localStorage.getItem('kalztunz_theme')) {
        _setMode(e.matches ? 'dark' : 'light')
      }
    }
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  const toggleTheme = useCallback(() => {
    _setMode(m => {
      const next = m === 'dark' ? 'light' : 'dark'
      localStorage.setItem('kalztunz_theme', next)
      return next
    })
  }, [])

  const setTheme = useCallback((m) => {
    if (m === 'system') {
      localStorage.removeItem('kalztunz_theme')
      _setMode(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    } else {
      localStorage.setItem('kalztunz_theme', m)
      _setMode(m)
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme: mode, toggleTheme, setTheme, setThemeMode: setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
