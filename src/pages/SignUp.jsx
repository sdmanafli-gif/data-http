import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { PUBLIC_SIGNUP_ENABLED } from '../config/auth'
import '../styles/shared.css'
import './auth.css'

export default function SignUp() {
  const { signUp, session } = useAuth()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('token')?.trim() || ''

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingInvite, setCheckingInvite] = useState(Boolean(inviteToken))
  const [inviteInfo, setInviteInfo] = useState(null)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  const allowOpenSignup = PUBLIC_SIGNUP_ENABLED && !inviteToken
  const allowInviteSignup = Boolean(inviteToken)

  useEffect(() => {
    if (!inviteToken) {
      setCheckingInvite(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setCheckingInvite(true)
      setError(null)
      const { data, error: rpcError } = await supabase.rpc('get_invitation_by_token', {
        invite_token: inviteToken,
      })
      if (cancelled) return
      if (rpcError) {
        setError(rpcError.message)
        setInviteInfo(null)
      } else if (!data || data.length === 0) {
        setError('Dəvət linki etibarsızdır və ya vaxtı bitib.')
        setInviteInfo(null)
      } else {
        const row = Array.isArray(data) ? data[0] : data
        setInviteInfo(row)
        setEmail(row.email || '')
      }
      setCheckingInvite(false)
    })()
    return () => {
      cancelled = true
    }
  }, [inviteToken])

  if (session) {
    return <Navigate to="/" replace />
  }

  if (!allowOpenSignup && !allowInviteSignup) {
    return <Navigate to="/daxil-ol" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (!email.trim() || !password) {
      setError('Email və parol daxil edin.')
      return
    }
    if (password.length < 6) {
      setError('Parol ən azı 6 simvol olmalıdır.')
      return
    }
    if (password !== password2) {
      setError('Parollar eyni deyil.')
      return
    }
    if (inviteToken && inviteInfo?.email && email.trim().toLowerCase() !== inviteInfo.email.toLowerCase()) {
      setError('Email dəvətdəki ünvanla eyni olmalıdır.')
      return
    }

    setLoading(true)
    try {
      const result = await signUp({
        email,
        password,
        displayName,
        inviteToken: inviteToken || null,
      })
      if (result?.needsEmailConfirmation) {
        setInfo('Qeydiyyat uğurludur. Emailinizi təsdiqləyin, sonra daxil olun.')
      }
      // If session exists, AuthProvider will redirect via App
    } catch (err) {
      const msg = err?.message ?? 'Qeydiyyat mümkün olmadı.'
      if (msg.includes('Invitation') || msg.includes('dəvət')) {
        setError('Qeydiyyat yalnız dəvət ilə mümkündür. Dəvət linki istifadə edin.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="auth-card__brand">Mobideal</h1>
        <p className="auth-card__subtitle">
          {inviteToken ? 'Dəvət ilə qeydiyyat (Menecer)' : 'İlk hesab — Admin olacaqsınız'}
        </p>

        {checkingInvite ? (
          <p className="auth-card__muted">Dəvət yoxlanılır…</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="signup-name">Ad (istəyə bağlı)</label>
              <input
                id="signup-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Adınız"
                autoComplete="name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                autoComplete="email"
                required
                readOnly={Boolean(inviteInfo?.email)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="signup-password">Parol</label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ən azı 6 simvol"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="signup-password2">Parolu təkrarlayın</label>
              <input
                id="signup-password2"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            {error && <p className="auth-card__error">{error}</p>}
            {info && <p className="auth-card__success">{info}</p>}
            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading || (Boolean(inviteToken) && !inviteInfo)}
              style={{ width: '100%' }}
            >
              {loading ? 'Yaradılır…' : 'Qeydiyyatdan keç'}
            </button>
          </form>
        )}

        <p className="auth-card__footer">
          Artıq hesabınız var? <Link to="/daxil-ol">Daxil ol</Link>
        </p>
      </div>
    </div>
  )
}
