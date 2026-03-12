import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Navigate } from 'react-router-dom'
import '../styles/shared.css'

const ROLE_LABELS = { admin: 'Admin', store_manager: 'Mağaza meneceri' }

export default function UserList() {
  const { profile, isAdmin } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

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

  async function handleDelete(userId) {
    if (userId === profile?.id) {
      setError('Öz hesabınızı silə bilməzsiniz.')
      return
    }
    if (!window.confirm('Bu istifadəçini silmək istədiyinizə əminsiniz? Bu geri alına bilməz.')) return
    setDeletingId(userId)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      await load()
    } catch (err) {
      setError(err?.message ?? 'İstifadəçi silinə bilmədi.')
    } finally {
      setDeletingId(null)
    }
  }

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
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-lg)' }}>
        Bütün istifadəçilər (Supabase Auth). Silmək istifadəçini auth cədvəlindən tam silir.
      </p>
      {error && (
        <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error}</p>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Rol</th>
              <th>Yaradılma</th>
              <th style={{ width: '100px' }}>Əməliyyat</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={4}>İstifadəçi yoxdur.</td>
              </tr>
            ) : (
              list.map((row) => (
                <tr key={row.id}>
                  <td>{row.email || '—'}</td>
                  <td>{ROLE_LABELS[row.role] ?? row.role}</td>
                  <td>{row.created_at ? new Date(row.created_at).toLocaleDateString('az-AZ') : '—'}</td>
                  <td>
                    {row.id === profile?.id ? (
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Siz</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--secondary"
                        disabled={deletingId === row.id}
                        onClick={() => handleDelete(row.id)}
                      >
                        {deletingId === row.id ? '…' : 'Sil'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
