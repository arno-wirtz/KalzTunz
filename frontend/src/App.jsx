import { useState, useEffect, useContext, createContext, useCallback, useRef } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { ThemeProvider, useTheme } from './ThemeContext'
import Home from './pages/Home'
import Generate from './pages/Generate'
import Extraction from './pages/Extraction'
import Search from './pages/Search'
import Library from './pages/Library'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Register from './pages/Register'
import AuthCallback from './pages/AuthCallback'
import Tutorial, { useTutorial } from './pages/Tutorial'
import './App.css'

// ==================== AUTH CONTEXT ====================

const AuthContext = createContext(null)
export function useAuth() { return useContext(AuthContext) }

function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('kalztunz_user')
    const token  = localStorage.getItem('kalztunz_token')
    if (stored && token) { try { setUser(JSON.parse(stored)) } catch {} }
    setLoading(false)
  }, [])

  const login = useCallback((userData, token, refreshToken, triggerTutorial) => {
    setUser(userData)
    localStorage.setItem('kalztunz_user',          JSON.stringify(userData))
    localStorage.setItem('kalztunz_token',         token)
    localStorage.setItem('kalztunz_refresh_token', refreshToken)
    if (triggerTutorial) {
      // Clear done flag and set a pending flag — useTutorial picks it up on next render
      localStorage.removeItem('kalztunz_tutorial_done')
      localStorage.setItem('kalztunz_show_tutorial', '1')
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('kalztunz_user')
    localStorage.removeItem('kalztunz_token')
    localStorage.removeItem('kalztunz_refresh_token')
  }, [])

  const updateUser = useCallback((patch) => {
    setUser(prev => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      localStorage.setItem('kalztunz_user', JSON.stringify(next))
      return next
    })
  }, [])

  const getToken = useCallback(() => localStorage.getItem('kalztunz_token'), [])

  return (
    <AuthContext.Provider value={{ user, login, logout, getToken, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// ==================== NAV SEARCH ====================

function NavSearch() {
  const navigate = useNavigate()
  const [q,       setQ]       = useState('')
  const [focused, setFocused] = useState(false)
  const ref = useRef(null)
  const submit = (e) => {
    e.preventDefault()
    const trimmed = q.trim()
    if (trimmed) { navigate(`/search?q=${encodeURIComponent(trimmed)}`); setQ(''); ref.current?.blur() }
  }
  return (
    <form className={`nav-search ${focused ? 'focused' : ''}`} onSubmit={submit}>
      <svg className="nav-search-icon" viewBox="0 0 20 20" fill="none">
        <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <input ref={ref} type="search" value={q} onChange={e => setQ(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        placeholder="Search songs, moods, artists…" className="nav-search-input" />
    </form>
  )
}

// ==================== NAV ====================

function Nav() {
  const { user, logout } = useAuth()
  const { theme, palette, toggleTheme, setPalette, COLOR_PALETTES } = useTheme()
  const { startTour } = useTutorial()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [open, setOpen] = useState(false)
  const [drop, setDrop] = useState(false)
  const dropRef = useRef(null)

  const isActive = p => p === '/' ? location.pathname === '/' : location.pathname.startsWith(p)
  const close    = () => setOpen(false)

  useEffect(() => {
    const h = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDrop(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => { setOpen(false); setDrop(false) }, [location.pathname])

  const avatarSrc = user?.profile_pic
    || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.username || 'U')}&backgroundColor=0d1a2e&textColor=ff6b47`

  const NAV_LINKS = [
    ['/', 'Home'],
    ['/search', 'Discover'],
    ['/extract', 'Extract'],
    ['/generate', 'Generate'],
  ]

  return (
    <nav className="nav">
      <div className="nav-inner">
        {/* Logo */}
        <Link to="/" className="nav-logo" onClick={close}>
          <span className="nav-logo-mark">
            <span className="nav-logo-wave">
              <span/><span/><span/><span/><span/>
            </span>
          </span>
          KalzTunz
        </Link>

        {/* Desktop search */}
        <div className="nav-search-wrap"><NavSearch /></div>

        {/* Hamburger */}
        <button className="nav-burger" onClick={() => setOpen(o => !o)} aria-label="Menu">
          <span className={`bar bar-1 ${open ? 'open' : ''}`}/>
          <span className={`bar bar-2 ${open ? 'open' : ''}`}/>
          <span className={`bar bar-3 ${open ? 'open' : ''}`}/>
        </button>

        <div className={`nav-links ${open ? 'nav-links--open' : ''}`}>
          {/* Mobile search */}
          <div className="nav-search-mobile"><NavSearch /></div>

          {/* Nav links */}
          {NAV_LINKS.map(([p, l]) => (
            <Link key={p} to={p} className={`nav-link ${isActive(p) ? 'active' : ''}`} onClick={close}>{l}</Link>
          ))}
          {user && (
            <Link to="/library" className={`nav-link ${isActive('/library') ? 'active' : ''}`} onClick={close}>Library</Link>
          )}

          {/* Theme toggle */}
          <button className="nav-theme" onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-label="Toggle theme"
            style={{ display:'flex',alignItems:'center',gap:'.35rem' }}>
            {theme === 'dark' ? '☀️' : '🌙'}
            <span style={{ width:8,height:8,borderRadius:'50%',background:'var(--accent)',flexShrink:0,boxShadow:`0 0 6px var(--accent)` }}/>
          </button>

          {/* Auth */}
          {user ? (
            <div className="nav-user-wrap" ref={dropRef}>
              <button className="nav-user-btn" onClick={() => setDrop(o => !o)} aria-label="Account menu">
                <div className="nav-avatar-ring">
                  <img src={avatarSrc} alt={user.username} className="nav-avatar" />
                </div>
                <span className="nav-uname">{user.username}</span>
                <svg width={9} height={9} viewBox="0 0 10 6" fill="currentColor"
                  style={{color:'var(--text-3)',flexShrink:0,transition:'transform .2s',transform:drop?'rotate(180deg)':'none'}}>
                  <path d="M0 0l5 6 5-6z"/>
                </svg>
              </button>

              {drop && (
                <div className="nav-drop">
                  {/* Profile → Settings */}
                  <Link to="/settings" className="nav-drop-profile" onClick={() => { setDrop(false); close() }}>
                    <img src={avatarSrc} alt={user.username} className="nav-drop-avatar" />
                    <div>
                      <div className="nav-drop-name">{user.username}</div>
                      <div className="nav-drop-email">{user.email}</div>
                      <div className="nav-drop-settings-hint">⚙ View profile & settings →</div>
                    </div>
                  </Link>

                  <div className="nav-drop-sep"/>

                  <Link to="/library" className="nav-drop-item" onClick={() => { setDrop(false); close() }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                    My Library
                  </Link>
                  <Link to="/settings" className="nav-drop-item" onClick={() => { setDrop(false); close() }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
                    Settings
                  </Link>
                  <button className="nav-drop-item" onClick={() => { setDrop(false); close(); startTour() }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
                    App Tour
                  </button>

                  <div className="nav-drop-sep"/>

                  <button className="nav-drop-item nav-drop-item--danger"
                    onClick={() => { logout(); navigate('/'); close(); setDrop(false) }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="nav-auth">
              <Link to="/login"    className="nav-btn nav-btn--ghost"   onClick={close}>Sign In</Link>
              <Link to="/register" className="nav-btn nav-btn--primary" onClick={close}>Get Started</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

// ==================== PROTECTED ROUTE ====================

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-loader"><span className="spinner spinner--lg"/></div>
  return user ? children : <Navigate to="/login" replace />
}

// ==================== APP INNER ====================

function AppInner() {
  const { show: showTutorial, markDone } = useTutorial()

  return (
    <div className="app">
      <Nav />
      <main className="main">
        <Routes>
          {/* Home is the default landing page */}
          <Route path="/"              element={<Home />} />
          <Route path="/search"        element={<Search />} />
          <Route path="/extract"       element={<Extraction />} />
          <Route path="/generate"      element={<Generate />} />
          <Route path="/library"       element={<Protected><Library /></Protected>} />
          <Route path="/settings"      element={<Protected><Settings /></Protected>} />
          <Route path="/login"         element={<Login />} />
          <Route path="/register"      element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* Catch-all redirects to home */}
          <Route path="*"              element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-logo">KalzTunz</span>
          <nav className="footer-nav">
            <Link to="/">Home</Link>
            <Link to="/search">Discover</Link>
            <Link to="/extract">Extract</Link>
            <Link to="/generate">Generate</Link>
            <a href="/docs" target="_blank" rel="noreferrer">API</a>
          </nav>
          <span className="footer-copy">© 2025 KalzTunz</span>
        </div>
      </footer>

      {/* Tutorial overlay */}
      {showTutorial && <Tutorial onDone={markDone} />}
    </div>
  )
}

// ==================== ROOT ──────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
