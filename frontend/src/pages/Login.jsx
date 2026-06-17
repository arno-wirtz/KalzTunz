import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import logoImg from '../assets/kalztunz-logo.png'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" width={18} height={18} style={{flexShrink:0}}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)
const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18} style={{flexShrink:0}}>
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
)
const EyeIcon = ({ open }) => open
  ? <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx={12} cy={12} r={3}/></svg>
  : <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1={1} y1={1} x2={23} y2={23}/></svg>

/* ── Logo Panel (shared between Login & Register) ──────────── */
export function AuthLogoPanel({ tagline }) {
  return (
    <div className="auth-logo-panel">
      <div className="auth-logo-glow auth-logo-glow--warm" />
      <div className="auth-logo-glow auth-logo-glow--cool" />
      <div className="auth-logo-content">
        <img src={logoImg} alt="KalzTunz" className="auth-logo-img" />
        <h2 className="auth-logo-title">KalzTunz</h2>
        <p className="auth-logo-sub">{tagline}</p>
        <div className="auth-feature-pills">
          {['🎸 Chord Extraction','🔑 Key Detection','🤖 AI Generation','🎵 Music Library','👥 Social Platform'].map(f => (
            <span key={f} className="auth-feature-pill">{f}</span>
          ))}
        </div>
      </div>
      <p className="auth-logo-quote">"Music is the universal language of mankind"</p>
    </div>
  )
}

/* ── Login Page ─────────────────────────────────────────────── */
export default function Login() {
  const { login }  = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const from       = location.state?.from?.pathname || '/'

  const [identifier, setIdentifier] = useState('')
  const [password,   setPassword]   = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [remember,   setRemember]   = useState(false)

  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem('kalztunz_remember') || '{}')
      if (d.identifier) { setIdentifier(d.identifier); setRemember(true) }
    } catch {}
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!identifier.trim() || !password) return
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: identifier.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Invalid credentials. Please try again.')
      if (remember) localStorage.setItem('kalztunz_remember', JSON.stringify({ identifier: identifier.trim() }))
      else          localStorage.removeItem('kalztunz_remember')
      login(data.user, data.access_token, data.refresh_token)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-split">
      <AuthLogoPanel tagline="AI-powered music creation & chord extraction" />

      <div className="auth-form-panel">
        <div className="auth-form-inner" style={{animationName:'authSlideIn'}}>
          <div style={{marginBottom:'1.75rem'}}>
            <h1 className="auth-title">Welcome back 👋</h1>
            <p className="auth-sub">Sign in to your KalzTunz account</p>
          </div>

          {/* OAuth */}
          <div style={{display:'flex',flexDirection:'column',gap:'.5rem',marginBottom:'1.25rem'}}>
            <a href={`${API}/api/auth/google`} className="oauth-btn">
              <GoogleIcon /> Continue with Google
            </a>
            <a href={`${API}/api/auth/github`} className="oauth-btn">
              <GitHubIcon /> Continue with GitHub
            </a>
          </div>

          <div className="auth-divider">or sign in with password</div>

          <form onSubmit={handleSubmit} className="form" style={{marginTop:'1rem'}}>
            <div className="form-group">
              <label className="form-label" htmlFor="l-id">Username or Email</label>
              <input id="l-id" className="form-input" type="text"
                value={identifier} onChange={e => setIdentifier(e.target.value)}
                placeholder="username or email@example.com"
                autoComplete="username" required autoFocus />
            </div>

            <div className="form-group">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <label className="form-label" htmlFor="l-pw">Password</label>
                <button type="button" style={{background:'none',border:'none',cursor:'pointer',fontSize:'.72rem',color:'var(--accent)',fontFamily:'inherit',padding:0}}>
                  Forgot password?
                </button>
              </div>
              <div style={{position:'relative'}}>
                <input id="l-pw" className="form-input"
                  type={showPw ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" required
                  style={{paddingRight:'2.8rem'}} />
                <button type="button" onClick={() => setShowPw(p => !p)} style={{
                  position:'absolute',right:'.75rem',top:'50%',transform:'translateY(-50%)',
                  background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',display:'flex',alignItems:'center',
                }}>
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </div>

            <label style={{display:'flex',alignItems:'center',gap:'.5rem',cursor:'pointer'}}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                style={{accentColor:'var(--accent)',width:15,height:15}} />
              <span style={{fontSize:'.82rem',color:'var(--text-2)'}}>Remember me</span>
            </label>

            {error && <div className="alert alert--error">{error}</div>}

            <button type="submit" className="btn btn--primary auth-submit-btn" disabled={loading}>
              {loading ? <><span className="spinner" style={{width:16,height:16,borderWidth:2}}/> Signing in…</> : 'Sign In →'}
            </button>
          </form>

          <div className="auth-switch-box">
            <p>New to KalzTunz?</p>
            <Link to="/register" className="btn btn--secondary" style={{justifyContent:'center'}}>
              Create a free account
            </Link>
          </div>

          <p className="auth-legal">
            By signing in you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  )
}
