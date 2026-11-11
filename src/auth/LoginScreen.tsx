import { useState, type CSSProperties } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { TurretDivider } from '../ui/TurretDivider'

// Private single-user app. Primary sign-in is a passwordless magic link;
// email+password is offered as a fallback (free-tier email is rate-limited).
export function LoginScreen() {
  const [mode, setMode] = useState<'magic' | 'password'>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setStatus(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setStatus('Check your email for a sign-in link.')
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setStatus(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div className="eyebrow">Electronic Data Book</div>
        <h1 style={title}>EDB</h1>
        <p style={subhead}>Precision rifle &amp; range logbook — private.</p>

        <TurretDivider />

        {!isSupabaseConfigured && (
          <div style={notice}>
            Backend not configured yet (placeholder keys). Sign-in activates once the
            Supabase project is connected.
          </div>
        )}

        {mode === 'magic' ? (
          <form onSubmit={sendMagicLink}>
            <label style={label}>Email</label>
            <input
              style={input}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <button style={primaryBtn} type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        ) : (
          <form onSubmit={signInWithPassword}>
            <label style={label}>Email</label>
            <input
              style={input}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <label style={label}>Password</label>
            <input
              style={input}
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button style={primaryBtn} type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        {status && <div style={statusMsg}>{status}</div>}
        {error && <div style={errorMsg}>{error}</div>}

        <button
          style={toggleBtn}
          onClick={() => {
            setMode(mode === 'magic' ? 'password' : 'magic')
            setError(null)
            setStatus(null)
          }}
        >
          {mode === 'magic' ? 'Use password instead' : 'Use a magic link instead'}
        </button>
      </div>
    </div>
  )
}

const wrap: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
}
const card: CSSProperties = {
  width: '100%',
  maxWidth: 380,
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: '28px 24px',
  textAlign: 'center',
}
const title: CSSProperties = {
  fontFamily: 'Rajdhani, sans-serif',
  fontWeight: 700,
  fontSize: 40,
  letterSpacing: 1,
  textTransform: 'uppercase',
  margin: '2px 0 4px',
  color: '#f2f4f0',
}
const subhead: CSSProperties = { color: 'var(--text-dim)', fontSize: 13, margin: '0 0 8px' }
const label: CSSProperties = {
  display: 'block',
  textAlign: 'left',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
  margin: '12px 0 6px',
}
const input: CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  borderRadius: 6,
  padding: '11px 12px',
  fontSize: 14,
  outline: 'none',
}
const primaryBtn: CSSProperties = {
  width: '100%',
  marginTop: 18,
  background: 'var(--impact)',
  color: '#201200',
  border: 'none',
  borderRadius: 6,
  padding: '12px 20px',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
}
const toggleBtn: CSSProperties = {
  marginTop: 16,
  background: 'none',
  border: 'none',
  color: 'var(--text-dim)',
  fontSize: 12.5,
  cursor: 'pointer',
  textDecoration: 'underline',
}
const statusMsg: CSSProperties = { marginTop: 14, color: 'var(--ok)', fontSize: 12.5 }
const errorMsg: CSSProperties = { marginTop: 14, color: 'var(--danger)', fontSize: 12.5 }
const notice: CSSProperties = {
  margin: '4px 0 4px',
  padding: '9px 11px',
  background: 'var(--panel-2)',
  border: '1px solid var(--line)',
  borderRadius: 6,
  color: 'var(--text-faint)',
  fontSize: 11.5,
  lineHeight: 1.5,
}
