import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Navigate } from 'react-router-dom'
import { ROLE_LABELS } from '../config/auth'
import '../styles/shared.css'

export default function UserList() {
  const { profile, isAdmin } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('profiles')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false })
    setLoading(false)
    if (e) {
      setError(e.message)
      return
    }
    setList(data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <div className="card">
        <p className="empty-state">Yüklənir…</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h1 className="card__title">İstifadəçilər</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: 'var(--space-lg)' }}>
        Admin və menecerlər. Yeni istifadəçi əlavə etmək üçün «Dəvət et» səhifəsindən istifadə edin.
      </p>
      {error && (
        <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error}</p>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Rol</th>
              <th>Yaradılma</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={3}>İstifadəçi yoxdur.</td>
              </tr>
            ) : (
              list.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.email || '—'}
                    {row.id === profile?.id ? (
                      <span style={{ marginLeft: 8, color: 'var(--color-text-muted)', fontSize: 12 }}>(Siz)</span>
                    ) : null}
                  </td>
                  <td>{ROLE_LABELS[row.role] ?? row.role}</td>
                  <td>{row.created_at ? new Date(row.created_at).toLocaleDateString('az-AZ') : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
