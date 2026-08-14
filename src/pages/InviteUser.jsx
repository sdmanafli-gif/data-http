import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_LABELS } from '../config/auth'
import { fullPermissions } from '../config/permissions'
import PermissionEditor from '../components/PermissionEditor'
import '../styles/shared.css'

function inviteUrl(token) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}`
  return `${base}/qeydiyyat?token=${encodeURIComponent(token)}`
}

export default function InviteUser() {
  const { createInvitation, listInvitations, isAdmin, isManager } = useAuth()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('manager')
  const [permissions, setPermissions] = useState(() => fullPermissions())
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [inviteLink, setInviteLink] = useState(null)
  const [list, setList] = useState([])

  async function load() {
    setListLoading(true)
    try {
      const rows = await listInvitations()
      setList(rows)
    } catch (err) {
      setError(err?.message ?? 'Dəvətlər yüklənmədi.')
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setInviteLink(null)
    if (!email.trim()) {
      setError('Email daxil edin.')
      return
    }
    setLoading(true)
    try {
      const inv = await createInvitation({
        email,
        role: isAdmin ? role : 'manager',
        permissions: isAdmin ? permissions : fullPermissions(),
      })
      const link = inviteUrl(inv.token)
      setInviteLink(link)
      setSuccess(`Dəvət yaradıldı: ${inv.email}. Rol: ${ROLE_LABELS[inv.role] ?? inv.role}.`)
      setEmail('')
      await load()
    } catch (err) {
      setError(err?.message ?? 'Dəvət yaradıla bilmədi.')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink(link) {
    try {
      await navigator.clipboard.writeText(link)
      setSuccess('Link kopyalandı.')
    } catch (_) {
      setError('Link kopyalanmadı — əl ilə seçin.')
    }
  }

  if (!isAdmin && !isManager) {
    return (
      <div className="card">
        <p className="empty-state">Bu səhifəyə giriş yoxdur.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="card">
        <h1 className="card__title">İstifadəçi dəvət et</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: 'var(--space-lg)' }}>
          Qeydiyyat yalnız dəvət linki ilə mümkündür. Dəvətdən əvvəl görünüş və icazələri təyin edin.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="invite-email">Email</label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="menecer@example.com"
              required
            />
          </div>

          {isAdmin && (
            <div className="form-group">
              <label htmlFor="invite-role">Rol</label>
              <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="manager">{ROLE_LABELS.manager}</option>
                <option value="admin">{ROLE_LABELS.admin}</option>
              </select>
            </div>
          )}

          {isAdmin && (
            <div className="form-group">
              <label>İcazələr (tab, sütun, məlumat, əməliyyat)</label>
              <PermissionEditor value={permissions} onChange={setPermissions} />
            </div>
          )}

          {error && <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error}</p>}
          {success && (
            <p style={{ color: '#1f6b3a', marginBottom: 'var(--space-md)' }}>{success}</p>
          )}
          {inviteLink && (
            <div className="form-group">
              <label>Dəvət linki</label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                <input type="text" readOnly value={inviteLink} style={{ flex: 1, minWidth: '200px' }} />
                <button type="button" className="btn btn--secondary" onClick={() => copyLink(inviteLink)}>
                  Kopyala
                </button>
              </div>
            </div>
          )}
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? 'Yaradılır…' : 'Dəvət yarat'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="card__title">Dəvətlər</h2>
        {listLoading ? (
          <p className="empty-state">Yüklənir…</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Status</th>
                  <th>Bitmə</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Hələ dəvət yoxdur.</td>
                  </tr>
                ) : (
                  list.map((row) => {
                    const link = inviteUrl(row.token)
                    const statusLabel =
                      row.status === 'pending'
                        ? 'Gözləyir'
                        : row.status === 'accepted'
                          ? 'Qəbul edilib'
                          : 'Ləğv edilib'
                    return (
                      <tr key={row.id}>
                        <td>{row.email}</td>
                        <td>{ROLE_LABELS[row.role] ?? row.role}</td>
                        <td>{statusLabel}</td>
                        <td>
                          {row.expires_at
                            ? new Date(row.expires_at).toLocaleDateString('az-AZ')
                            : '—'}
                        </td>
                        <td>
                          {row.status === 'pending' ? (
                            <button
                              type="button"
                              className="btn btn--secondary"
                              onClick={() => copyLink(link)}
                            >
                              Kopyala
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
