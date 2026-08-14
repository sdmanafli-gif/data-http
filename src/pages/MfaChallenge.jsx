import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import '../styles/shared.css'
import './auth.css'

export default function MfaChallenge() {
  const { verifyTotpLogin, signOut, mfaLoading, profile } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const trimmed = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(trimmed)) {
      setError('6 rəqəmli kod daxil edin.')
      return
    }
    try {
      await verifyTotpLogin(trimmed)
    } catch (err) {
      setError(err?.message ?? 'Kod yanlışdır və ya vaxtı keçib.')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="auth-card__brand">Mobideal</h1>
        <p className="auth-card__subtitle">
          İki mərhələli təsdiq — authenticator tətbiqindən bir dəfəlik kodu daxil edin
          {profile?.email ? ` (${profile.email})` : ''}.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="mfa-code">Təhlükəsizlik kodu</label>
            <input
              id="mfa-code"
              className="auth-otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              autoFocus
              required
            />
          </div>
          {error && <p className="auth-card__error">{error}</p>}
          <button
            type="submit"
            className="btn btn--primary"
            disabled={mfaLoading}
            style={{ width: '100%' }}
          >
            {mfaLoading ? 'Yoxlanılır…' : 'Təsdiq et'}
          </button>
        </form>
        <p className="auth-card__footer">
          <button type="button" className="auth-text-btn" onClick={() => signOut()}>
            Çıxış
          </button>
        </p>
      </div>
    </div>
  )
}
