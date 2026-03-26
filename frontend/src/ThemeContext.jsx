import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext(null)
export const useTheme = () => useContext(ThemeContext)

export function ThemeProvider({ children }) {
  const [theme, _setTheme] = useState(() => {
    const stored = localStorage.getItem('kalztunz_theme')
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('kalztunz_theme', theme)
  }, [theme])

  // Sync OS-level changes when no preference is stored
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => {
      if (!localStorage.getItem('kalztunz_theme')) {
        _setTheme(e.matches ? 'dark' : 'light')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggleTheme = useCallback(() => {
    _setTheme(t => t === 'dark' ? 'light' : 'dark')
  }, [])

  // setTheme accepts 'dark' | 'light' | 'system'
  const setTheme = useCallback((mode) => {
    if (mode === 'system') {
      localStorage.removeItem('kalztunz_theme')
      _setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    } else {
      _setTheme(mode)
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, setThemeMode: setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
