import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { PUBLIC_SIGNUP_ENABLED } from '../config/auth'
import '../styles/shared.css'
import './auth.css'

export default function SignIn() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Email və parol daxil edin.')
      return
    }
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err?.message ?? 'Daxil olmaq mümkün olmadı.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="auth-card__brand">Mobideal</h1>
        <p className="auth-card__subtitle">Hesabınıza daxil olun</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="signin-password">Parol</label>
            <input
              id="signin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="auth-card__error">{error}</p>}
          <button type="submit" className="btn btn--primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Yoxlanılır…' : 'Daxil ol'}
          </button>
        </form>
        {PUBLIC_SIGNUP_ENABLED && (
          <p className="auth-card__footer">
            Hesabınız yoxdur? <Link to="/qeydiyyat">Qeydiyyat</Link>
          </p>
        )}
      </div>
    </div>
  )
}
