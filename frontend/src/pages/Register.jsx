import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { AuthLogoPanel } from './Login'

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

/* Password strength meter */
function StrengthMeter({ password }) {
  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'Uppercase letter',       pass: /[A-Z]/.test(password) },
    { label: 'Lowercase letter',       pass: /[a-z]/.test(password) },
    { label: 'Number',                 pass: /\d/.test(password) },
    { label: 'Special character',      pass: /[!@#$%^&*()_+\-=[\]{};':",.<>?]/.test(password) },
  ]
  const score = checks.filter(c => c.pass).length
  const colors = ['#ef4444','#f59e0b','#f59e0b','#22c55e','#22c55e']
  const labels = ['','Weak','Fair','Good','Strong','Very Strong']

  if (!password) return null

  return (
    <div style={{marginTop:'.5rem'}}>
      <div style={{display:'flex',gap:3,marginBottom:'.4rem'}}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{
            flex:1, height:3, borderRadius:2,
            background: i <= score ? colors[score-1] : 'var(--bg-3)',
            transition:'background .25s',
          }}/>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:'.68rem',color: score > 0 ? colors[score-1] : 'var(--text-3)',fontWeight:700}}>
          {labels[score]}
        </span>
        <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap',justifyContent:'flex-end'}}>
          {checks.map(c => (
            <span key={c.label} style={{
              fontSize:'.62rem',
              color: c.pass ? 'var(--accent-3)' : 'var(--text-3)',
              display:'flex',alignItems:'center',gap:'.2rem',
            }}>
              {c.pass ? '✓' : '·'} {c.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Register() {
  const { login }  = useAuth()
  const navigate   = useNavigate()

  const [step,     setStep]     = useState(1)  // 1=credentials, 2=profile
  const [username, setUsername] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [fullName, setFullName] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [showC,    setShowC]    = useState(false)
  const [agree,    setAgree]    = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [success,  setSuccess]  = useState(false)

  const EyeIcon2 = ({ open }) => open
    ? <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx={12} cy={12} r={3}/></svg>
    : <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1={1} y1={1} x2={23} y2={23}/></svg>

  const validateStep1 = () => {
    if (username.length < 3) return 'Username must be at least 3 characters'
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return 'Username: letters, numbers, _ and - only'
    if (!email.includes('@')) return 'Enter a valid email address'
    if (password.length < 8) return 'Password must be at least 8 characters'
    if (!/[A-Z]/.test(password)) return 'Password needs an uppercase letter'
    if (!/\d/.test(password)) return 'Password needs a number'
    if (password !== confirm) return 'Passwords do not match'
    return null
  }

  const handleStep1 = (e) => {
    e.preventDefault()
    const err = validateStep1()
    if (err) { setError(err); return }
    setError(null)
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!agree) { setError('Please accept the Terms of Service to continue'); return }
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, confirm_password: confirm }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Registration failed. Please try again.')
      setSuccess(true)
      setTimeout(() => {
        login(data.user, data.access_token, data.refresh_token, true)
        navigate('/', { replace: true })
      }, 1200)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-split">
      <AuthLogoPanel tagline="Join thousands of musicians & producers" />

      <div className="auth-form-panel">
        <div className="auth-form-inner" style={{animationName:'authSlideIn'}}>

          {/* Step indicator */}
          <div style={{display:'flex',alignItems:'center',gap:'.5rem',marginBottom:'1.75rem'}}>
            {[1,2].map(s => (
              <div key={s} style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
                <div style={{
                  width:28,height:28,borderRadius:'50%',
                  background: step >= s ? 'var(--accent)' : 'var(--bg-3)',
                  border: `2px solid ${step >= s ? 'var(--accent)' : 'var(--border-hi)'}`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:'.75rem',fontWeight:800,
                  color: step >= s ? '#fff' : 'var(--text-3)',
                  transition:'all .25s',
                }}>{success && s === 2 ? '✓' : s}</div>
                <span style={{fontSize:'.75rem',color:step >= s ? 'var(--text)' : 'var(--text-3)',fontWeight:step >= s ? 700 : 400}}>
                  {s === 1 ? 'Credentials' : 'Profile'}
                </span>
                {s < 2 && <div style={{width:24,height:2,background:step > s ? 'var(--accent)' : 'var(--border)',borderRadius:1,transition:'background .25s'}}/>}
              </div>
            ))}
          </div>

          {success ? (
            <div style={{textAlign:'center',padding:'2rem 0'}}>
              <div style={{fontSize:'3rem',marginBottom:'1rem'}}>🎉</div>
              <h2 style={{fontSize:'1.4rem',fontWeight:800,marginBottom:'.4rem'}}>Welcome to KalzTunz!</h2>
              <p style={{color:'var(--text-2)',fontSize:'.875rem'}}>Your account is ready. Taking you to the app…</p>
              <div style={{display:'flex',justifyContent:'center',marginTop:'1.25rem'}}>
                <span className="spinner spinner--lg"/>
              </div>
            </div>
          ) : step === 1 ? (
            <>
              <div style={{marginBottom:'1.5rem'}}>
                <h1 className="auth-title">Create your account</h1>
                <p className="auth-sub">It's free and always will be</p>
              </div>

              {/* OAuth */}
              <div style={{display:'flex',flexDirection:'column',gap:'.5rem',marginBottom:'1.25rem'}}>
                <a href={`${API}/api/auth/google`} className="oauth-btn">
                  <GoogleIcon /> Sign up with Google
                </a>
                <a href={`${API}/api/auth/github`} className="oauth-btn">
                  <GitHubIcon /> Sign up with GitHub
                </a>
              </div>

              <div className="auth-divider">or register with email</div>

              <form onSubmit={handleStep1} className="form" style={{marginTop:'1rem'}}>
                <div className="form-group">
                  <label className="form-label" htmlFor="r-user">Username</label>
                  <input id="r-user" className="form-input" type="text"
                    value={username} onChange={e => setUsername(e.target.value)}
                    placeholder="your_username" autoComplete="username"
                    required minLength={3} maxLength={50} autoFocus />
                  <span className="form-hint">Letters, numbers, _ and - only. Min 3 characters.</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="r-email">Email</label>
                  <input id="r-email" className="form-input" type="email"
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" autoComplete="email" required />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="r-pw">Password</label>
                  <div style={{position:'relative'}}>
                    <input id="r-pw" className="form-input"
                      type={showPw ? 'text' : 'password'}
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Min 8 characters" autoComplete="new-password"
                      required style={{paddingRight:'2.8rem'}} />
                    <button type="button" onClick={() => setShowPw(p => !p)} style={{
                      position:'absolute',right:'.75rem',top:'50%',transform:'translateY(-50%)',
                      background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',display:'flex',
                    }}>
                      <EyeIcon2 open={showPw} />
                    </button>
                  </div>
                  <StrengthMeter password={password} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="r-conf">Confirm Password</label>
                  <div style={{position:'relative'}}>
                    <input id="r-conf" className="form-input"
                      type={showC ? 'text' : 'password'}
                      value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="Repeat your password" autoComplete="new-password"
                      required style={{
                        paddingRight:'2.8rem',
                        borderColor: confirm && password !== confirm ? 'var(--accent-err)' : undefined,
                      }} />
                    <button type="button" onClick={() => setShowC(p => !p)} style={{
                      position:'absolute',right:'.75rem',top:'50%',transform:'translateY(-50%)',
                      background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',display:'flex',
                    }}>
                      <EyeIcon2 open={showC} />
                    </button>
                  </div>
                  {confirm && password !== confirm && (
                    <span className="form-error">Passwords don't match</span>
                  )}
                </div>

                {error && <div className="alert alert--error">{error}</div>}

                <button type="submit" className="btn btn--primary auth-submit-btn">
                  Continue →
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{marginBottom:'1.5rem'}}>
                <h1 className="auth-title">Almost there! 🎵</h1>
                <p className="auth-sub">Finish setting up your profile</p>
              </div>

              <form onSubmit={handleSubmit} className="form">
                <div className="form-group">
                  <label className="form-label" htmlFor="r-name">Display Name <span style={{color:'var(--text-3)',fontWeight:400}}>(optional)</span></label>
                  <input id="r-name" className="form-input" type="text"
                    value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder="Your real name or artist name" autoFocus />
                </div>

                {/* Genres of interest */}
                <div className="form-group">
                  <label className="form-label">Favourite Genres <span style={{color:'var(--text-3)',fontWeight:400}}>(optional)</span></label>
                  <div className="chip-group">
                    {['Pop','Rock','Jazz','Electronic','Hip-Hop','Classical','Ambient','Indie','R&B'].map(g => (
                      <button type="button" key={g} className="chip">{g}</button>
                    ))}
                  </div>
                  <span className="form-hint">Helps us personalise your discovery feed</span>
                </div>

                {/* Summary box */}
                <div style={{
                  background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10,
                  padding:'1rem', fontSize:'.82rem', color:'var(--text-2)',
                }}>
                  <div style={{fontWeight:700,color:'var(--text)',marginBottom:'.5rem'}}>Account summary</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.3rem'}}>
                    <span>Username:</span> <strong style={{color:'var(--text)'}}>{username}</strong>
                    <span>Email:</span>    <strong style={{color:'var(--text)'}}>{email}</strong>
                  </div>
                </div>

                {/* Terms */}
                <label style={{display:'flex',alignItems:'flex-start',gap:'.55rem',cursor:'pointer'}}>
                  <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)}
                    style={{accentColor:'var(--accent)',width:15,height:15,marginTop:2,flexShrink:0}} />
                  <span style={{fontSize:'.8rem',color:'var(--text-2)',lineHeight:1.5}}>
                    I agree to the <a href="#" style={{color:'var(--accent)'}}>Terms of Service</a> and{' '}
                    <a href="#" style={{color:'var(--accent)'}}>Privacy Policy</a>
                  </span>
                </label>

                {error && <div className="alert alert--error">{error}</div>}

                <div style={{display:'flex',gap:'.65rem'}}>
                  <button type="button" className="btn btn--ghost"
                    onClick={() => { setStep(1); setError(null) }}>
                    ← Back
                  </button>
                  <button type="submit" className="btn btn--primary auth-submit-btn" disabled={loading} style={{flex:1}}>
                    {loading ? <><span className="spinner" style={{width:16,height:16,borderWidth:2}}/> Creating account…</> : '🎉 Create Account'}
                  </button>
                </div>
              </form>
            </>
          )}

          {!success && (
            <div className="auth-switch-box" style={{marginTop:'1.25rem'}}>
              <p>Already have an account?</p>
              <Link to="/login" className="btn btn--secondary" style={{justifyContent:'center'}}>
                Sign in instead
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
