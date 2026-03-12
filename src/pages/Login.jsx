import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import '../styles/shared.css'

export default function Login() {
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
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err?.message ?? 'Daxil olmaq mümkün olmadı.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        padding: 'var(--space-lg)',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <h1 className="card__title" style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>
          Mobideal
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-lg)' }}>
          Daxil olmaq üçün email və parolunuzu daxil edin.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="form-group">
            <label>Parol</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Yoxlanılır…' : 'Daxil ol'}
          </button>
        </form>
      </div>
    </div>
  )
}
