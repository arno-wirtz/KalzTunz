import { useState, useRef, useCallback } from 'react'
import { useTutorial } from './Tutorial'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { useTheme } from '../ThemeContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/* ── helpers ────────────────────────────────────────── */
function Toggle({ on, onChange, label, desc }) {
  return (
    <div className="settings-row">
      <div className="settings-row__info">
        <div className="settings-row__label">{label}</div>
        {desc && <div className="settings-row__desc">{desc}</div>}
      </div>
      <button
        className="toggle" role="switch" aria-checked={on}
        onClick={() => onChange(!on)}
        style={{ background:'none', border:'none', cursor:'pointer', padding:0 }}
      >
        <div className={`toggle-track ${on ? 'on' : ''}`}>
          <div className="toggle-thumb" />
        </div>
      </button>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="settings-section">
      <div className="settings-section__title">{title}</div>
      {children}
    </div>
  )
}

/* ── Avatar Upload Modal ────────────────────────────── */
function AvatarModal({ currentSrc, onSave, onClose }) {
  const [tab,     setTab]    = useState('local')   // local | url | google
  const [preview, setPreview]= useState(currentSrc || '')
  const [urlInput,setUrlInput]= useState('')
  const [error,   setError]  = useState(null)
  const [saving,  setSaving] = useState(false)
  const fileRef = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5 MB'); return }
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleUrl = () => {
    const trimmed = urlInput.trim()
    if (!trimmed) { setError('Enter a valid image URL'); return }
    // Basic URL check
    try { new URL(trimmed) } catch { setError('Invalid URL'); return }
    setError(null)
    setPreview(trimmed)
  }

  const handleSave = async () => {
    if (!preview || preview === currentSrc) { onClose(); return }
    setSaving(true)
    try {
      // In production: POST to /api/auth/avatar with FormData
      // Here we persist to localStorage via updateUser
      await new Promise(r => setTimeout(r, 600)) // simulate upload
      onSave(preview)
      onClose()
    } catch (e) {
      setError('Upload failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position:'fixed',inset:0,background:'var(--overlay)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem',animation:'fadeIn .18s ease' }}
      onClick={onClose}
    >
      <div
        style={{ background:'var(--bg-1)',border:'1px solid var(--border-hi)',borderRadius:18,padding:'1.75rem',width:'100%',maxWidth:460,boxShadow:'var(--shadow)',animation:'authSlideIn .22s ease' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem' }}>
          <h2 style={{ fontSize:'1.05rem',fontWeight:800 }}>Change Profile Photo</h2>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',fontSize:'1.1rem',lineHeight:1 }}>✕</button>
        </div>

        {/* Preview */}
        <div style={{ display:'flex',justifyContent:'center',marginBottom:'1.25rem' }}>
          <div style={{
            width:96,height:96,borderRadius:'50%',overflow:'hidden',
            background:'var(--bg-3)',border:'3px solid var(--border-hi)',
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:'2.2rem',flexShrink:0,
          }}>
            {preview
              ? <img src={preview} alt="Preview" style={{ width:'100%',height:'100%',objectFit:'cover' }} onError={() => { setPreview(''); setError('Could not load image from that URL') }} />
              : '👤'
            }
          </div>
        </div>

        {/* Tab selector */}
        <div style={{ display:'flex',background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:10,padding:3,gap:2,marginBottom:'1.1rem' }}>
          {[['local','💻 From Device'],['url','🔗 Image URL'],['google','📸 Google Photos']].map(([k,l]) => (
            <button key={k} onClick={() => { setTab(k); setError(null) }} style={{
              flex:1,padding:'.35rem .5rem',borderRadius:8,border:'none',cursor:'pointer',
              fontFamily:'inherit',fontWeight:700,fontSize:'.74rem',transition:'all .18s',
              background: tab === k ? 'var(--accent)' : 'transparent',
              color: tab === k ? '#fff' : 'var(--text-2)',
            }}>{l}</button>
          ))}
        </div>

        {/* Local upload */}
        {tab === 'local' && (
          <div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display:'none' }} />
            <button
              className="btn btn--secondary"
              style={{ width:'100%',justifyContent:'center',gap:'.5rem' }}
              onClick={() => fileRef.current?.click()}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H13v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              Choose from your computer
            </button>
            <p style={{ fontSize:'.72rem',color:'var(--text-3)',textAlign:'center',marginTop:'.5rem' }}>
              JPG, PNG, GIF or WEBP — max 5 MB
            </p>
          </div>
        )}

        {/* URL input */}
        {tab === 'url' && (
          <div style={{ display:'flex',flexDirection:'column',gap:'.6rem' }}>
            <div className="form-group">
              <label className="form-label">Image URL</label>
              <input
                className="form-input"
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                autoFocus
              />
            </div>
            <button className="btn btn--secondary btn--sm" style={{ alignSelf:'flex-start' }} onClick={handleUrl}>
              Preview →
            </button>
          </div>
        )}

        {/* Google Photos */}
        {tab === 'google' && (
          <div style={{ textAlign:'center',padding:'1rem 0' }}>
            <div style={{ fontSize:'2.5rem',marginBottom:'.75rem' }}>📸</div>
            <p style={{ fontSize:'.875rem',color:'var(--text-2)',marginBottom:'1rem',lineHeight:1.55 }}>
              Open Google Photos, select a photo, click <strong>Share → Copy link</strong>, then paste the URL below.
            </p>
            <div className="form-group">
              <label className="form-label">Google Photos share link</label>
              <input
                className="form-input"
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://photos.google.com/…"
              />
              <span className="form-hint">Must be a public/shared link with direct image access</span>
            </div>
            <button className="btn btn--secondary btn--sm" style={{ marginTop:'.5rem' }} onClick={handleUrl}>
              Preview →
            </button>
            <div style={{ marginTop:'.75rem',padding:'.6rem .8rem',background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.2)',borderRadius:8,fontSize:'.72rem',color:'var(--accent-warn)' }}>
              ⚠ Google Photos requires the link to be set to "Anyone with the link can view"
            </div>
          </div>
        )}

        {error && <div className="alert alert--error" style={{ marginTop:'.75rem' }}>{error}</div>}

        <div style={{ display:'flex',gap:'.6rem',justifyContent:'flex-end',marginTop:'1.25rem' }}>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving || !preview}>
            {saving ? <><span className="spinner" style={{ width:13,height:13,borderWidth:2 }}/> Saving…</> : 'Save Photo'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Account Panel ──────────────────────────────────── */
function AccountPanel() {
  const { user, updateUser } = useAuth()
  const { startTour } = useTutorial()
  const [username, setUsername] = useState(user?.username || '')
  const [bio,      setBio]      = useState(user?.bio      || '')
  const [location, setLocation] = useState(user?.location || '')
  const [website,  setWebsite]  = useState(user?.website  || '')
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState(null)
  const [showAvatar, setShowAvatar] = useState(false)

  const avatarSrc = user?.profile_pic
    || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.username || 'U')}&backgroundColor=0d1a2e&textColor=3d9bff`

  const handleSave = async () => {
    setSaving(true); setMsg(null)
    try {
      // Simulate API call — in production: PATCH /api/auth/profile
      await new Promise(r => setTimeout(r, 700))
      updateUser({ username, bio, location, website })
      setMsg({ type:'success', text:'Profile updated successfully ✓' })
    } catch {
      setMsg({ type:'error', text:'Failed to save. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarSave = useCallback((dataUrl) => {
    updateUser({ profile_pic: dataUrl })
    setMsg({ type:'success', text:'Profile photo updated ✓' })
  }, [updateUser])

  return (
    <div className="settings-panel">
      <Section title="Profile Photo">
        <div style={{ display:'flex',alignItems:'center',gap:'1.25rem',padding:'.25rem 0' }}>
          {/* Clickable avatar with hover overlay */}
          <div
            className="avatar-upload-wrap"
            onClick={() => setShowAvatar(true)}
            title="Change profile photo"
          >
            <div style={{
              width:80,height:80,borderRadius:'50%',overflow:'hidden',
              background:'var(--bg-3)',border:'3px solid var(--border-hi)',
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.8rem',
            }}>
              <img src={avatarSrc} alt={user?.username} style={{ width:'100%',height:'100%',objectFit:'cover' }} />
            </div>
            <div className="avatar-upload-overlay">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="white"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
              Change
            </div>
          </div>

          <div>
            <button className="btn btn--secondary btn--sm" onClick={() => setShowAvatar(true)}>
              📷 Change Photo
            </button>
            <p className="form-hint" style={{ marginTop:'.4rem' }}>
              Upload from device, paste URL, or use Google Photos.<br/>JPG, PNG, GIF — max 5 MB.
            </p>
          </div>
        </div>
      </Section>

      <Section title="App Tour">
        <div className="settings-row" style={{borderBottom:'none'}}>
          <div className="settings-row__info">
            <div className="settings-row__label">🎓 Restart App Tour</div>
            <div className="settings-row__desc">Replay the onboarding tutorial to rediscover KalzTunz features</div>
          </div>
          <button className="btn btn--secondary btn--sm" onClick={startTour}>Start Tour</button>
        </div>
      </Section>

      <Section title="Personal Information">
        <div className="form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="your_username" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={user?.email || ''} disabled style={{ opacity:.5 }} />
              <span className="form-hint">Email cannot be changed here</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Bio</label>
            <textarea className="form-textarea" value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell the community about yourself…" rows={3} maxLength={300} />
            <span className="form-hint">{bio.length}/300</span>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" />
            </div>
            <div className="form-group">
              <label className="form-label">Website</label>
              <input className="form-input" type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yoursite.com" />
            </div>
          </div>

          {msg && <div className={`alert alert--${msg.type === 'success' ? 'success' : 'error'}`}>{msg.text}</div>}

          <div>
            <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spinner" style={{ width:14,height:14,borderWidth:2 }}/> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </div>
      </Section>

      <Section title="Connected Accounts">
        {[
          { name:'Google', icon:'🔵', connected: user?.oauth_provider === 'google', hint:'Sign in with your Google account' },
          { name:'GitHub', icon:'⚫', connected: user?.oauth_provider === 'github', hint:'Sign in with your GitHub account' },
        ].map(acc => (
          <div key={acc.name} className="settings-row">
            <div className="settings-row__info">
              <div className="settings-row__label">{acc.icon} {acc.name}</div>
              <div className="settings-row__desc">{acc.connected ? `Connected via ${acc.name} OAuth` : acc.hint}</div>
            </div>
            <button className={`btn btn--sm ${acc.connected ? 'btn--ghost' : 'btn--secondary'}`}>
              {acc.connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        ))}
      </Section>

      <Section title="Change Password">
        <div className="form">
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input className="form-input" type="password" placeholder="••••••••" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input className="form-input" type="password" placeholder="Min 8 characters" />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New</label>
              <input className="form-input" type="password" placeholder="Repeat password" />
            </div>
          </div>
          <div><button className="btn btn--secondary btn--sm">Update Password</button></div>
        </div>
      </Section>

      {showAvatar && (
        <AvatarModal currentSrc={user?.profile_pic} onSave={handleAvatarSave} onClose={() => setShowAvatar(false)} />
      )}
    </div>
  )
}

/* ── Appearance Panel ───────────────────────────────── */
function AppearancePanel() {
  const { theme, setTheme } = useTheme()
  const THEMES = [
    { key:'dark',   label:'Dark',   preview: <div style={{ height:44,borderRadius:8,background:'linear-gradient(135deg,#0d1220,#1a2338)',border:'1px solid #2a3f5f',display:'flex',alignItems:'flex-end',padding:'4px 6px',gap:3 }}><div style={{ width:16,height:8,background:'#3d9bff',borderRadius:2 }}/><div style={{ width:24,height:6,background:'#1e2d45',borderRadius:2 }}/></div> },
    { key:'light',  label:'Light',  preview: <div style={{ height:44,borderRadius:8,background:'linear-gradient(135deg,#ffffff,#f0f4fa)',border:'1px solid #dae0ec',display:'flex',alignItems:'flex-end',padding:'4px 6px',gap:3 }}><div style={{ width:16,height:8,background:'#1a7fe8',borderRadius:2 }}/><div style={{ width:24,height:6,background:'#dde4f0',borderRadius:2 }}/></div> },
    { key:'system', label:'System', preview: <div style={{ height:44,borderRadius:8,overflow:'hidden',border:'1px solid var(--border)',display:'flex' }}><div style={{ flex:1,background:'linear-gradient(135deg,#0d1220,#1a2338)' }}/><div style={{ flex:1,background:'linear-gradient(135deg,#ffffff,#f0f4fa)' }}/></div> },
  ]
  return (
    <div className="settings-panel">
      <Section title="Theme">
        <div className="theme-grid">
          {THEMES.map(t => (
            <div key={t.key} className={`theme-option ${theme === t.key ? 'active' : ''}`} onClick={() => setTheme(t.key)}>
              <div className="theme-option__preview">{t.preview}</div>
              <div className="theme-option__label">{t.label}</div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Display">
        <div className="settings-row">
          <div className="settings-row__info">
            <div className="settings-row__label">Compact Mode</div>
            <div className="settings-row__desc">Reduce spacing for a denser layout</div>
          </div>
          <div className="toggle-track"><div className="toggle-thumb"/></div>
        </div>
      </Section>
    </div>
  )
}

/* ── Notifications Panel ────────────────────────────── */
function NotificationsPanel() {
  const [p, setP] = useState({ follows:true, likes:true, comments:false, newsletter:false, push_tracks:true, push_system:true })
  const t = k => setP(prev => ({ ...prev, [k]: !prev[k] }))
  return (
    <div className="settings-panel">
      <Section title="Email Notifications">
        <Toggle on={p.follows}    onChange={() => t('follows')}    label="New followers"  desc="When someone follows you" />
        <Toggle on={p.likes}      onChange={() => t('likes')}      label="Track likes"    desc="When someone likes your track" />
        <Toggle on={p.comments}   onChange={() => t('comments')}   label="Comments"       desc="When someone comments on your content" />
        <Toggle on={p.newsletter} onChange={() => t('newsletter')} label="Newsletter"     desc="Monthly platform updates and tips" />
      </Section>
      <Section title="In-App">
        <Toggle on={p.push_tracks} onChange={() => t('push_tracks')} label="New tracks from followed artists" desc="Get notified when people you follow post" />
        <Toggle on={p.push_system} onChange={() => t('push_system')} label="System alerts"                   desc="Important account and platform updates" />
      </Section>
    </div>
  )
}

/* ── Privacy Panel ──────────────────────────────────── */
function PrivacyPanel() {
  const [p, setP] = useState({ public_library:true, show_activity:true, indexable:true })
  const t = k => setP(prev => ({ ...prev, [k]: !prev[k] }))
  return (
    <div className="settings-panel">
      <Section title="Profile Visibility">
        <Toggle on={p.public_library} onChange={() => t('public_library')} label="Public library"  desc="Anyone can view your saved and liked tracks" />
        <Toggle on={p.show_activity}  onChange={() => t('show_activity')}  label="Show activity"   desc="Show your recent plays in activity feeds" />
        <Toggle on={p.indexable}      onChange={() => t('indexable')}      label="Search indexing" desc="Allow your profile to appear in search results" />
      </Section>
      <Section title="Data">
        <div className="settings-row">
          <div className="settings-row__info">
            <div className="settings-row__label">Download your data</div>
            <div className="settings-row__desc">Export all your tracks, extractions, and account data</div>
          </div>
          <button className="btn btn--ghost btn--sm">Request Export</button>
        </div>
      </Section>
    </div>
  )
}

/* ── Audio Panel ────────────────────────────────────── */
function AudioPanel() {
  const [quality, setQuality] = useState('high')
  const [autoplay,  setAutoplay]  = useState(true)
  const [normalize, setNormalize] = useState(true)
  return (
    <div className="settings-panel">
      <Section title="Playback">
        <div className="settings-row">
          <div className="settings-row__info">
            <div className="settings-row__label">Streaming Quality</div>
            <div className="settings-row__desc">Higher quality uses more data</div>
          </div>
          <select className="form-select" value={quality} onChange={e => setQuality(e.target.value)} style={{ width:'auto',fontSize:'.8rem' }}>
            <option value="low">Low (96 kbps)</option>
            <option value="normal">Normal (160 kbps)</option>
            <option value="high">High (320 kbps)</option>
          </select>
        </div>
        <Toggle on={autoplay}  onChange={setAutoplay}  label="Autoplay"         desc="Continue playing after a track ends" />
        <Toggle on={normalize} onChange={setNormalize} label="Volume normalize" desc="Equalise volume levels across tracks" />
      </Section>
      <Section title="Downloads">
        <div className="settings-row">
          <div className="settings-row__info">
            <div className="settings-row__label">Download Format</div>
          </div>
          <select className="form-select" style={{ width:'auto',fontSize:'.8rem' }}>
            <option>MP3 (320 kbps)</option>
            <option>FLAC (lossless)</option>
            <option>WAV</option>
          </select>
        </div>
      </Section>
    </div>
  )
}

/* ── Danger Panel ───────────────────────────────────── */
function DangerPanel() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [typing,  setTyping]  = useState('')
  return (
    <div className="settings-panel">
      <Section title="Danger Zone">
        <div className="settings-row">
          <div className="settings-row__info">
            <div className="settings-row__label" style={{ color:'var(--accent-err)' }}>Sign out everywhere</div>
            <div className="settings-row__desc">Invalidate all active sessions on all devices</div>
          </div>
          <button className="btn btn--danger btn--sm" onClick={() => { logout(); navigate('/login') }}>Sign Out All</button>
        </div>
        <div className="settings-row" style={{ borderBottom:'none' }}>
          <div className="settings-row__info">
            <div className="settings-row__label" style={{ color:'var(--accent-err)' }}>Delete account</div>
            <div className="settings-row__desc">Permanently remove your account and all data. Cannot be undone.</div>
          </div>
          <button className="btn btn--danger btn--sm" onClick={() => setConfirm(true)}>Delete Account</button>
        </div>
        {confirm && (
          <div style={{ marginTop:'1rem',padding:'1rem',borderRadius:10,background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.22)' }}>
            <p style={{ fontSize:'.875rem',marginBottom:'.75rem' }}>Type <strong>DELETE</strong> to confirm:</p>
            <div style={{ display:'flex',gap:'.6rem' }}>
              <input className="form-input" placeholder="DELETE" value={typing} onChange={e => setTyping(e.target.value)} style={{ maxWidth:180 }} />
              <button className="btn btn--danger btn--sm" disabled={typing !== 'DELETE'} onClick={() => alert('Account deletion would be processed here.')}>Confirm</button>
              <button className="btn btn--ghost btn--sm" onClick={() => { setConfirm(false); setTyping('') }}>Cancel</button>
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}

/* ── Main Settings ──────────────────────────────────── */
const NAV = [
  { key:'account',       icon:'👤', label:'Account' },
  { key:'appearance',    icon:'🎨', label:'Appearance' },
  { key:'notifications', icon:'🔔', label:'Notifications' },
  { key:'privacy',       icon:'🔒', label:'Privacy' },
  { key:'audio',         icon:'🎵', label:'Audio' },
  { key:'danger',        icon:'⚠️',  label:'Danger Zone' },
]

export default function Settings() {
  const [active, setActive] = useState('account')
  const PANELS = {
    account: <AccountPanel />, appearance: <AppearancePanel />,
    notifications: <NotificationsPanel />, privacy: <PrivacyPanel />,
    audio: <AudioPanel />, danger: <DangerPanel />,
  }
  return (
    <div className="page-wrap" style={{ paddingTop:'2rem' }}>
      <div className="page-header" style={{ marginBottom:'1.75rem' }}>
        <div className="page-header__badge">⚙ Settings</div>
        <h1 className="page-header__title">Settings</h1>
        <p className="page-header__sub">Manage your account, photo, appearance, and preferences</p>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav">
          {NAV.map(item => (
            <button key={item.key} className={`settings-nav-item ${active === item.key ? 'active' : ''}`} onClick={() => setActive(item.key)}>
              <span style={{ fontSize:'1rem' }}>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div key={active} className="fade-up">{PANELS[active]}</div>
      </div>
    </div>
  )
}
