import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { ROLE_LABELS } from '../config/auth'
import { fullPermissions, normalizePermissions } from '../config/permissions'
import PermissionEditor from '../components/PermissionEditor'
import '../styles/shared.css'

export default function UserList() {
  const {
    profile,
    isAdmin,
    updateUserRole,
    updateUserPermissions,
    deleteUserAccount,
    adminListMfaFactors,
    adminUnenrollMfa,
    adminUnenrollAllMfa,
  } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [editUser, setEditUser] = useState(null)
  const [editPerms, setEditPerms] = useState(() => fullPermissions())
  const [mfaUser, setMfaUser] = useState(null)
  const [mfaFactors, setMfaFactors] = useState([])
  const [mfaLoading, setMfaLoading] = useState(false)
  const editRef = useRef(null)

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('profiles')
      .select('id, email, role, permissions, created_at')
      .order('created_at', { ascending: false })
    setLoading(false)
    if (e) {
      setError(e.message)
      return
    }
    setList(data ?? [])
  }

  useEffect(() => {
    if (!isAdmin) return
    load()
  }, [isAdmin])

  useEffect(() => {
    if (editUser && editRef.current) {
      editRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [editUser])

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  async function handleRoleChange(row, role) {
    if (row.id === profile?.id && role !== 'admin') {
      setError('Öz admin rolunuzu silə bilməzsiniz.')
      return
    }
    setBusyId(row.id)
    setError(null)
    setSuccess(null)
    try {
      await updateUserRole(row.id, role)
      setSuccess(`Rol yeniləndi: ${row.email || row.id}`)
      await load()
    } catch (err) {
      setError(err?.message ?? 'Rol dəyişmədi.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(row) {
    if (row.id === profile?.id) {
      setError('Öz hesabınızı silə bilməzsiniz.')
      return
    }
    if (!window.confirm(`${row.email || row.id} silinsin? Bu geri alınmaz.`)) return
    setBusyId(row.id)
    setError(null)
    setSuccess(null)
    try {
      await deleteUserAccount(row.id)
      setSuccess('İstifadəçi silindi.')
      if (editUser?.id === row.id) setEditUser(null)
      await load()
    } catch (err) {
      setError(err?.message ?? 'İstifadəçi silinmədi.')
    } finally {
      setBusyId(null)
    }
  }

  function openPermissions(row) {
    setMfaUser(null)
    setEditUser(row)
    setEditPerms(normalizePermissions(row.permissions))
    setError(null)
    setSuccess(null)
  }

  async function savePermissions() {
    if (!editUser) return
    setBusyId(editUser.id)
    setError(null)
    setSuccess(null)
    try {
      await updateUserPermissions(editUser.id, editPerms)
      setSuccess(`İcazələr saxlanıldı: ${editUser.email || editUser.id}`)
      setEditUser(null)
      await load()
    } catch (err) {
      setError(err?.message ?? 'İcazələr saxlanılmadı.')
    } finally {
      setBusyId(null)
    }
  }

  function normalizeFactorList(factors) {
    const list = Array.isArray(factors) ? factors : []
    return list.filter((f) => {
      if (!f?.id) return false
      const status = String(f.status || '').toLowerCase()
      // Keep verified / active TOTP (and unknown status — admin API varies)
      if (status && status !== 'verified' && status !== 'unverified') return true
      return true
    })
  }

  async function openMfa(row) {
    setEditUser(null)
    setMfaUser(row)
    setMfaFactors([])
    setMfaLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const factors = await adminListMfaFactors(row.id)
      setMfaFactors(normalizeFactorList(factors))
    } catch (err) {
      // Keep panel open so admin can still try «Bütün MFA-nı sil» / see deploy hint
      setError(err?.message ?? 'MFA faktorları yüklənmədi.')
      setMfaFactors([])
    } finally {
      setMfaLoading(false)
    }
  }

  async function removeMfaFactor(factorId) {
    if (!mfaUser) return
    const who = mfaUser.email || mfaUser.id
    if (!window.confirm(`${who} üçün bu authenticator silinsin? (Sonuncu olsa belə — admin də daxil)`)) {
      return
    }
    setMfaLoading(true)
    setError(null)
    try {
      await adminUnenrollMfa(mfaUser.id, factorId)
      const factors = await adminListMfaFactors(mfaUser.id)
      setMfaFactors(normalizeFactorList(factors))
      setSuccess(`MFA silindi: ${who}`)
    } catch (err) {
      setError(err?.message ?? 'MFA silinmədi.')
    } finally {
      setMfaLoading(false)
    }
  }

  async function removeAllMfa() {
    if (!mfaUser) return
    const who = mfaUser.email || mfaUser.id
    if (
      !window.confirm(
        `${who} üçün BÜTÜN MFA silinsin? (Admin hesabları da daxil — sonra yenidən quraşdırmalıdır)`
      )
    ) {
      return
    }
    setMfaLoading(true)
    setError(null)
    try {
      const result = await adminUnenrollAllMfa(mfaUser.id)
      const factors = await adminListMfaFactors(mfaUser.id)
      setMfaFactors(normalizeFactorList(factors))
      setSuccess(`Bütün MFA silindi: ${who}${result?.removed != null ? ` (${result.removed})` : ''}`)
    } catch (err) {
      setError(err?.message ?? 'MFA silinmədi.')
    } finally {
      setMfaLoading(false)
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
    <div>
      <div className="card">
        <h1 className="card__title">İstifadəçilər</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: 'var(--space-lg)' }}>
          Mövcud istifadəçinin məhdudiyyətlərini dəyişmək üçün «İcazələr» düyməsinə basın (tab, sütun, cəmlər,
          dəyər filtri, sira_no). Yeni istifadəçi üçün «Dəvət et».
        </p>
        {error && (
          <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error}</p>
        )}
        {success && (
          <p style={{ color: '#1f6b3a', marginBottom: 'var(--space-md)' }}>{success}</p>
        )}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Rol</th>
                <th>Yaradılma</th>
                <th>Əməliyyat</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={4}>İstifadəçi yoxdur.</td>
                </tr>
              ) : (
                list.map((row) => (
                  <tr
                    key={row.id}
                    style={
                      editUser?.id === row.id
                        ? { outline: '2px solid var(--color-primary, #2563eb)', outlineOffset: -2 }
                        : undefined
                    }
                  >
                    <td>
                      {row.email || '—'}
                      {row.id === profile?.id ? (
                        <span style={{ marginLeft: 8, color: 'var(--color-text-muted)', fontSize: 12 }}>
                          (Siz)
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <select
                        value={row.role === 'admin' ? 'admin' : 'manager'}
                        disabled={busyId === row.id}
                        onChange={(e) => handleRoleChange(row, e.target.value)}
                      >
                        <option value="manager">{ROLE_LABELS.manager}</option>
                        <option value="admin">{ROLE_LABELS.admin}</option>
                      </select>
                    </td>
                    <td>
                      {row.created_at ? new Date(row.created_at).toLocaleDateString('az-AZ') : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          disabled={busyId === row.id}
                          onClick={() => openPermissions(row)}
                        >
                          İcazələr
                        </button>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          disabled={busyId === row.id || mfaLoading}
                          onClick={() => openMfa(row)}
                          title="Bu istifadəçinin MFA-sını gör / sil"
                        >
                          MFA sil
                        </button>
                        {row.id !== profile?.id && (
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            disabled={busyId === row.id}
                            onClick={() => handleDelete(row)}
                          >
                            Sil
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editUser && (
        <div className="card" ref={editRef}>
          <div className="page-header" style={{ marginBottom: 12 }}>
            <div>
              <h2 className="card__title" style={{ margin: 0 }}>
                İcazələri redaktə et
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
                {editUser.email || editUser.id} — dəyişikliklər hesabda saxlanır (özünüzə aiddirsə dərhal
                tətbiq olunur).
              </p>
            </div>
            <button type="button" className="btn btn--secondary" onClick={() => setEditUser(null)}>
              Bağla
            </button>
          </div>
          <PermissionEditor value={editPerms} onChange={setEditPerms} />
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 16,
              position: 'sticky',
              bottom: 8,
              padding: 12,
              background: 'var(--color-bg, #fff)',
              borderTop: '1px solid var(--color-border, #ddd)',
              zIndex: 2,
            }}
          >
            <button
              type="button"
              className="btn btn--primary"
              disabled={busyId === editUser.id}
              onClick={savePermissions}
            >
              {busyId === editUser.id ? 'Saxlanılır…' : 'İcazələri saxla'}
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setEditUser(null)}>
              Ləğv et
            </button>
          </div>
        </div>
      )}

      {mfaUser && (
        <div className="card">
          <div className="page-header" style={{ marginBottom: 12 }}>
            <div>
              <h2 className="card__title" style={{ margin: 0 }}>
                MFA sil — {mfaUser.email || mfaUser.id}
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
                Rol: {ROLE_LABELS[mfaUser.role] ?? mfaUser.role}. İstənilən istifadəçinin (digər adminlər
                daxil) MFA-sını silə bilərsiniz.
              </p>
            </div>
            <button type="button" className="btn btn--secondary" onClick={() => setMfaUser(null)}>
              Bağla
            </button>
          </div>
          {error && (
            <p style={{ color: 'var(--color-accent)', marginBottom: 12 }}>{error}</p>
          )}
          {mfaLoading ? (
            <p className="empty-state">Yüklənir…</p>
          ) : (
            <>
              {mfaFactors.length === 0 ? (
                <p className="empty-state" style={{ marginBottom: 12 }}>
                  Siyahıda faktor yoxdur (və ya yüklənmədi). Aşağıdakı düymə ilə yenə də bütün MFA-nı
                  silməyə cəhd edə bilərsiniz.
                </p>
              ) : (
                <ul className="mfa-factor-list">
                  {mfaFactors.map((f) => (
                    <li key={f.id} className="mfa-factor-list__item">
                      <span>
                        {f.friendly_name || f.friendlyName || 'Authenticator'}{' '}
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                          ({f.factor_type || f.factorType || f.status || 'totp'})
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        disabled={mfaLoading}
                        onClick={() => removeMfaFactor(f.id)}
                      >
                        Sil
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={mfaLoading}
                  onClick={removeAllMfa}
                >
                  Bütün MFA-nı sil
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={mfaLoading}
                  onClick={() => openMfa(mfaUser)}
                >
                  Yenilə
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
