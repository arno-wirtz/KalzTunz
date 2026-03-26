import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../App'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function AuthCallback() {
  const [params]   = useSearchParams()
  const { login }  = useAuth()
  const navigate   = useNavigate()
  const [errMsg,   setErrMsg] = useState(null)

  useEffect(() => {
    const accessToken  = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const errorMsg     = params.get('error')

    if (errorMsg) {
      setErrMsg(decodeURIComponent(errorMsg))
      return
    }
    if (!accessToken) {
      setErrMsg('No access token received. Please try signing in again.')
      return
    }

    // Fetch full user profile from /api/auth/me
    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(`Profile fetch failed (${r.status})`)
        return r.json()
      })
      .then(user => {
        if (!user?.id) throw new Error('Invalid user profile received')
        login(user, accessToken, refreshToken || '', false)
        navigate('/', { replace: true })
      })
      .catch(err => {
        console.error('OAuth callback error:', err)
        setErrMsg(err.message || 'Sign-in failed. Please try again.')
      })
  }, [])

  if (errMsg) {
    return (
      <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
        <div style={{ textAlign:'center', maxWidth:400 }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>⚠️</div>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.3rem', marginBottom:'.75rem' }}>Sign-in failed</h2>
          <p style={{ color:'var(--text-2)', fontSize:'.875rem', marginBottom:'1.5rem', lineHeight:1.6 }}>{errMsg}</p>
          <Link to="/login" className="btn btn--primary">← Back to Login</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', color:'var(--text-2)' }}>
        <span className="spinner spinner--lg" style={{ display:'block', margin:'0 auto 1rem' }} />
        <p style={{ fontSize:'.9rem', fontWeight:600 }}>Completing sign-in…</p>
        <p style={{ fontSize:'.78rem', color:'var(--text-3)', marginTop:'.35rem' }}>You will be redirected automatically</p>
      </div>
    </div>
  )
}