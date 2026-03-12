import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Navigate } from 'react-router-dom'
import '../styles/shared.css'

export default function CreateUser() {
  const { isAdmin } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('store_manager')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!email.trim() || !password) {
      setError('Email və parol daxil edin.')
      return
    }
    if (password.length < 6) {
      setError('Parol ən azı 6 simvol olmalıdır.')
      return
    }
    setLoading(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-user', {
        body: { email: email.trim(), password, role },
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      setSuccess(`İstifadəçi yaradıldı: ${data?.email ?? email}. Rol: ${data?.role ?? role}.`)
      setEmail('')
      setPassword('')
      setRole('store_manager')
    } catch (err) {
      setError(err?.message ?? 'İstifadəçi yaradıla bilmədi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h1 className="card__title">Yeni istifadəçi</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-lg)' }}>
        Yalnız admin yeni istifadəçi yarada bilər. Email və parol təyin edin; istifadəçi daxil ola biləcək.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
          />
        </div>
        <div className="form-group">
          <label>Parol</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="ən azı 6 simvol"
            minLength={6}
            required
          />
        </div>
        <div className="form-group">
          <label>Rol</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="store_manager">Mağaza meneceri</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {error && (
          <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error}</p>
        )}
        {success && (
          <p style={{ color: 'var(--color-success-text)', marginBottom: 'var(--space-md)' }}>{success}</p>
        )}
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Yaradılır…' : 'İstifadəçi yarat'}
        </button>
      </form>
    </div>
  )
}
