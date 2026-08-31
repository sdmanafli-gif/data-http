import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { confirmDelete } from '../lib/confirmDelete'
import {
  ODENISLER_TABLE,
  KASSA_CIXARISLAR_TABLE,
  KASSA_TRACKING_FROM,
  formatMoney,
  formatDate,
  methodKey,
  methodLabel,
} from '../features/odenisler/constants'
import CollapsibleSummary from '../components/CollapsibleSummary'
import '../styles/shared.css'

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function userLabel(profiles, userId) {
  if (!userId) return 'Naməlum'
  const p = profiles.get(userId)
  return p?.email || userId.slice(0, 8)
}

/**
 * Admin cash desk: payments collected by staff, by card, combined; withdrawals.
 */
export default function KassaDesk() {
  const { isAdmin, user } = useAuth()
  const [tab, setTab] = useState('user') // user | card | combined
  const [payments, setPayments] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [profiles, setProfiles] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateFrom, setDateFrom] = useState(KASSA_TRACKING_FROM)
  const [dateTo, setDateTo] = useState('')

  const [wdUserId, setWdUserId] = useState('')
  const [wdMebleg, setWdMebleg] = useState('')
  const [wdTarix, setWdTarix] = useState(() => new Date().toISOString().slice(0, 10))
  const [wdScope, setWdScope] = useState('all') // all | nagd | kart:xxx
  const [wdQeyd, setWdQeyd] = useState('')
  const [editingWdId, setEditingWdId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [success, setSuccess] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let from = dateFrom || KASSA_TRACKING_FROM
      let to = dateTo || null
      if (from < KASSA_TRACKING_FROM) from = KASSA_TRACKING_FROM
      if (from && to && from > to) {
        const t = from
        from = to
        to = t
        if (from < KASSA_TRACKING_FROM) from = KASSA_TRACKING_FROM
      }

      let payQ = () => {
        let q = supabase
          .from(ODENISLER_TABLE)
          .select('id, mebleg, tarix, created_at, created_by, odenis_usulu, kart_nomresi, ad_soyad, tip')
          .gte('tarix', from)
          .not('created_by', 'is', null)
          .order('created_at', { ascending: false })
        if (to) q = q.lte('tarix', to)
        return q
      }

      let wdQ = () => {
        let q = supabase
          .from(KASSA_CIXARISLAR_TABLE)
          .select('*')
          .gte('tarix', from)
          .order('tarix', { ascending: false })
          .order('created_at', { ascending: false })
        if (to) q = q.lte('tarix', to)
        return q
      }

      const [{ data: pays, error: pErr }, { data: wds, error: wErr }, { data: profs, error: prErr }] =
        await Promise.all([
          fetchAllPages(payQ),
          fetchAllPages(wdQ),
          supabase.from('profiles').select('id, email, role').order('email'),
        ])
      if (pErr) throw pErr
      if (wErr) throw wErr
      if (prErr) throw prErr

      setPayments(pays || [])
      setWithdrawals(wds || [])
      setProfiles(new Map((profs || []).map((p) => [p.id, p])))
    } catch (err) {
      setError(err.message)
      setPayments([])
      setWithdrawals([])
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (!isAdmin) return
    load()
  }, [isAdmin, load])

  const byUser = useMemo(() => {
    const map = new Map()
    for (const p of payments) {
      if (!p.created_by) continue
      const uid = p.created_by
      const cur = map.get(uid) || { userId: uid, collected: 0, withdrawn: 0, count: 0 }
      cur.collected += Number(p.mebleg) || 0
      cur.count += 1
      map.set(uid, cur)
    }
    for (const w of withdrawals) {
      const uid = w.user_id
      if (!uid) continue
      const cur = map.get(uid) || { userId: uid, collected: 0, withdrawn: 0, count: 0 }
      cur.withdrawn += Number(w.mebleg) || 0
      map.set(uid, cur)
    }
    return [...map.values()]
      .map((r) => ({
        ...r,
        collected: round2(r.collected),
        withdrawn: round2(r.withdrawn),
        balance: round2(r.collected - r.withdrawn),
        label: userLabel(profiles, r.userId),
      }))
      .sort((a, b) => b.balance - a.balance || a.label.localeCompare(b.label, 'az'))
  }, [payments, withdrawals, profiles])

  const byCard = useMemo(() => {
    const map = new Map()
    for (const p of payments) {
      const key = methodKey(p.odenis_usulu || 'nagd', p.kart_nomresi)
      const cur = map.get(key) || {
        key,
        label: methodLabel(p.odenis_usulu || 'nagd', p.kart_nomresi),
        collected: 0,
        withdrawn: 0,
        count: 0,
      }
      cur.collected += Number(p.mebleg) || 0
      cur.count += 1
      map.set(key, cur)
    }
    for (const w of withdrawals) {
      const key = w.odenis_usulu
        ? methodKey(w.odenis_usulu, w.kart_nomresi)
        : null
      if (!key) continue
      const cur = map.get(key) || {
        key,
        label: methodLabel(w.odenis_usulu, w.kart_nomresi),
        collected: 0,
        withdrawn: 0,
        count: 0,
      }
      cur.withdrawn += Number(w.mebleg) || 0
      map.set(key, cur)
    }
    return [...map.values()]
      .map((r) => ({
        ...r,
        collected: round2(r.collected),
        withdrawn: round2(r.withdrawn),
        balance: round2(r.collected - r.withdrawn),
      }))
      .sort((a, b) => b.balance - a.balance || a.label.localeCompare(b.label, 'az'))
  }, [payments, withdrawals])

  const combined = useMemo(() => {
    const map = new Map()
    for (const p of payments) {
      if (!p.created_by) continue
      const uid = p.created_by
      const mKey = methodKey(p.odenis_usulu || 'nagd', p.kart_nomresi)
      const key = `${uid}||${mKey}`
      const cur = map.get(key) || {
        key,
        userId: uid,
        method: mKey,
        collected: 0,
        withdrawn: 0,
        count: 0,
      }
      cur.collected += Number(p.mebleg) || 0
      cur.count += 1
      map.set(key, cur)
    }
    for (const w of withdrawals) {
      if (!w.odenis_usulu || !w.user_id) continue
      const uid = w.user_id
      const mKey = methodKey(w.odenis_usulu, w.kart_nomresi)
      const key = `${uid}||${mKey}`
      const cur = map.get(key) || {
        key,
        userId: uid,
        method: mKey,
        collected: 0,
        withdrawn: 0,
        count: 0,
      }
      cur.withdrawn += Number(w.mebleg) || 0
      map.set(key, cur)
    }
    return [...map.values()]
      .map((r) => ({
        ...r,
        collected: round2(r.collected),
        withdrawn: round2(r.withdrawn),
        balance: round2(r.collected - r.withdrawn),
        userLabel: userLabel(profiles, r.userId),
        methodLabel: r.method === 'nagd' ? 'Nağd' : methodLabel('kart', r.method.replace(/^kart:/, '')),
      }))
      .sort(
        (a, b) =>
          a.userLabel.localeCompare(b.userLabel, 'az') ||
          a.methodLabel.localeCompare(b.methodLabel, 'az')
      )
  }, [payments, withdrawals, profiles])

  const cardOptions = useMemo(() => {
    const set = new Set()
    for (const p of payments) {
      if (p.odenis_usulu === 'kart' && p.kart_nomresi) set.add(p.kart_nomresi)
    }
    for (const w of withdrawals) {
      if (w.odenis_usulu === 'kart' && w.kart_nomresi) set.add(w.kart_nomresi)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'az'))
  }, [payments, withdrawals])

  const staffOptions = useMemo(() => {
    return [...profiles.values()]
      .map((p) => ({ id: p.id, label: p.email || p.id }))
      .sort((a, b) => a.label.localeCompare(b.label, 'az'))
  }, [profiles])

  const totals = useMemo(() => {
    const collected = round2(payments.reduce((s, p) => s + (Number(p.mebleg) || 0), 0))
    const withdrawn = round2(withdrawals.reduce((s, w) => s + (Number(w.mebleg) || 0), 0))
    return { collected, withdrawn, balance: round2(collected - withdrawn) }
  }, [payments, withdrawals])

  function resetWithdrawForm() {
    setEditingWdId(null)
    setWdUserId('')
    setWdMebleg('')
    setWdTarix(new Date().toISOString().slice(0, 10))
    setWdScope('all')
    setWdQeyd('')
  }

  function startEditWithdrawal(w) {
    setError(null)
    setSuccess(null)
    setEditingWdId(w.id)
    setWdUserId(w.user_id || '')
    setWdMebleg(w.mebleg != null ? String(w.mebleg) : '')
    setWdTarix(w.tarix || new Date().toISOString().slice(0, 10))
    setWdQeyd(w.qeyd || '')
    if (w.odenis_usulu === 'nagd') setWdScope('nagd')
    else if (w.odenis_usulu === 'kart' && w.kart_nomresi) setWdScope(`kart:${w.kart_nomresi}`)
    else setWdScope('all')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onWithdraw(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!wdUserId) {
      setError('İstifadəçi seçin.')
      return
    }
    const mebleg = Number(wdMebleg)
    if (!Number.isFinite(mebleg) || mebleg <= 0) {
      setError('Çıxarış məbləği 0-dan böyük olmalıdır.')
      return
    }

    const editingRow = editingWdId
      ? withdrawals.find((w) => w.id === editingWdId)
      : null
    const creditBack =
      editingRow && editingRow.user_id === wdUserId ? Number(editingRow.mebleg) || 0 : 0
    const userRow = byUser.find((r) => r.userId === wdUserId)
    const available = round2((userRow?.balance || 0) + creditBack)
    if (mebleg - available > 0.009) {
      setError(`Balans kifayət etmir (qalıq: ${formatMoney(available)}).`)
      return
    }

    const payload = {
      user_id: wdUserId,
      mebleg,
      tarix: wdTarix || new Date().toISOString().slice(0, 10),
      qeyd: String(wdQeyd || '').trim() || null,
      odenis_usulu: null,
      kart_nomresi: null,
    }
    if (wdScope === 'nagd') {
      payload.odenis_usulu = 'nagd'
    } else if (wdScope.startsWith('kart:')) {
      payload.odenis_usulu = 'kart'
      payload.kart_nomresi = wdScope.slice(5)
    }
    if (!editingWdId) {
      payload.created_by = user?.id || null
    }

    setSaving(true)
    try {
      if (editingWdId) {
        const { error: err } = await supabase
          .from(KASSA_CIXARISLAR_TABLE)
          .update(payload)
          .eq('id', editingWdId)
        if (err) throw err
        setSuccess('Çıxarış yeniləndi.')
      } else {
        const { error: err } = await supabase.from(KASSA_CIXARISLAR_TABLE).insert(payload)
        if (err) throw err
        setSuccess('Çıxarış qeydə alındı.')
      }
      resetWithdrawForm()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onDeleteWithdrawal(w) {
    if (!w?.id) return
    if (!confirmDelete('Bu çıxarış silinsin?')) return
    setError(null)
    setSuccess(null)
    setDeletingId(w.id)
    try {
      const { error: err } = await supabase.from(KASSA_CIXARISLAR_TABLE).delete().eq('id', w.id)
      if (err) throw err
      if (editingWdId === w.id) resetWithdrawForm()
      setSuccess('Çıxarış silindi.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <div>
      <div className="page-header">
        <h1>Kassa / Ödəniş yığımı</h1>
        <Link to="/admin/users" className="btn btn--secondary">
          İstifadəçilər
        </Link>
      </div>

      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 0 }}>
        Kassa uçotu {formatDate(KASSA_TRACKING_FROM)} tarixindən başlayır. Yalnız kim tərəfindən
        daxil edildiyi məlum olan ödənişlər sayılır; köhnə / naməlum qeydlər daxil edilmir.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Tarixdən</label>
          <input
            type="date"
            min={KASSA_TRACKING_FROM}
            value={dateFrom}
            onChange={(e) => {
              const v = e.target.value
              setDateFrom(v && v < KASSA_TRACKING_FROM ? KASSA_TRACKING_FROM : v || KASSA_TRACKING_FROM)
            }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Tarixədək</label>
          <input type="date" min={KASSA_TRACKING_FROM} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => {
            setDateFrom(KASSA_TRACKING_FROM)
            setDateTo('')
          }}
        >
          Hamısı
        </button>
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}
      {success && <p style={{ color: '#1f6b3a' }}>{success}</p>}

      {!loading && (
        <CollapsibleSummary title="Ümumi" storageKey="summary:kassa">
          <div className="musteri-summary">
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Yığılıb</div>
              <div className="musteri-summary__value">{formatMoney(totals.collected)}</div>
            </div>
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Çıxarılıb</div>
              <div className="musteri-summary__value">{formatMoney(totals.withdrawn)}</div>
            </div>
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Qalıq</div>
              <div className="musteri-summary__value">{formatMoney(totals.balance)}</div>
            </div>
          </div>
        </CollapsibleSummary>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card__title">
          {editingWdId ? 'Çıxarışı redaktə et' : 'Çıxarış (yalnız admin)'}
        </h2>
        <form onSubmit={onWithdraw} className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="form-group">
            <label>İstifadəçi *</label>
            <select value={wdUserId} onChange={(e) => setWdUserId(e.target.value)} required>
              <option value="">Seçin…</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Məbləğ *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={wdMebleg}
              onChange={(e) => setWdMebleg(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Tarix</label>
            <input
              type="date"
              min={KASSA_TRACKING_FROM}
              value={wdTarix}
              onChange={(e) => setWdTarix(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Hansı üsuldan</label>
            <select value={wdScope} onChange={(e) => setWdScope(e.target.value)}>
              <option value="all">Ümumi balans</option>
              <option value="nagd">Yalnız nağd</option>
              {cardOptions.map((c) => (
                <option key={c} value={`kart:${c}`}>
                  Kart · {c}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: '1 1 160px' }}>
            <label>Qeyd</label>
            <input value={wdQeyd} onChange={(e) => setWdQeyd(e.target.value)} />
          </div>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saxlanır…' : editingWdId ? 'Yenilə' : 'Çıxarış et'}
          </button>
          {editingWdId && (
            <button
              type="button"
              className="btn btn--secondary"
              disabled={saving}
              onClick={() => {
                resetWithdrawForm()
                setSuccess(null)
                setError(null)
              }}
            >
              Ləğv et
            </button>
          )}
        </form>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          { id: 'user', label: 'İstifadəçiyə görə' },
          { id: 'card', label: 'Karta / nağda görə' },
          { id: 'combined', label: 'Birlikdə' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn ${tab === t.id ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <p className="empty-state">Yüklənir…</p>
        ) : tab === 'user' ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>İstifadəçi</th>
                  <th style={{ textAlign: 'right' }}>Ödəniş sayı</th>
                  <th style={{ textAlign: 'right' }}>Yığılıb</th>
                  <th style={{ textAlign: 'right' }}>Çıxarılıb</th>
                  <th style={{ textAlign: 'right' }}>Qalıq</th>
                </tr>
              </thead>
              <tbody>
                {byUser.map((r) => (
                  <tr
                    key={r.userId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setWdUserId(r.userId)}
                  >
                    <td>{r.label}</td>
                    <td style={{ textAlign: 'right' }}>{r.count}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(r.collected)}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(r.withdrawn)}</td>
                    <td style={{ textAlign: 'right' }}><strong>{formatMoney(r.balance)}</strong></td>
                  </tr>
                ))}
                {!byUser.length && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      Məlumat yoxdur.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : tab === 'card' ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Üsul / Kart</th>
                  <th style={{ textAlign: 'right' }}>Ödəniş sayı</th>
                  <th style={{ textAlign: 'right' }}>Yığılıb</th>
                  <th style={{ textAlign: 'right' }}>Çıxarılıb</th>
                  <th style={{ textAlign: 'right' }}>Qalıq</th>
                </tr>
              </thead>
              <tbody>
                {byCard.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td style={{ textAlign: 'right' }}>{r.count}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(r.collected)}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(r.withdrawn)}</td>
                    <td style={{ textAlign: 'right' }}><strong>{formatMoney(r.balance)}</strong></td>
                  </tr>
                ))}
                {!byCard.length && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      Məlumat yoxdur.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>İstifadəçi</th>
                  <th>Üsul / Kart</th>
                  <th style={{ textAlign: 'right' }}>Ödəniş sayı</th>
                  <th style={{ textAlign: 'right' }}>Yığılıb</th>
                  <th style={{ textAlign: 'right' }}>Çıxarılıb</th>
                  <th style={{ textAlign: 'right' }}>Qalıq</th>
                </tr>
              </thead>
              <tbody>
                {combined.map((r) => (
                  <tr key={r.key}>
                    <td>{r.userLabel}</td>
                    <td>{r.methodLabel}</td>
                    <td style={{ textAlign: 'right' }}>{r.count}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(r.collected)}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(r.withdrawn)}</td>
                    <td style={{ textAlign: 'right' }}><strong>{formatMoney(r.balance)}</strong></td>
                  </tr>
                ))}
                {!combined.length && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Məlumat yoxdur.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && withdrawals.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 className="card__title">Son çıxarışlar</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarix</th>
                  <th>İstifadəçi</th>
                  <th>Üsul</th>
                  <th style={{ textAlign: 'right' }}>Məbləğ</th>
                  <th>Qeyd</th>
                  <th style={{ textAlign: 'right' }}>Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.slice(0, 40).map((w) => (
                  <tr
                    key={w.id}
                    style={
                      editingWdId === w.id
                        ? { background: 'rgba(31, 107, 58, 0.08)' }
                        : undefined
                    }
                  >
                    <td>{formatDate(w.tarix)}</td>
                    <td>{userLabel(profiles, w.user_id)}</td>
                    <td>
                      {w.odenis_usulu
                        ? methodLabel(w.odenis_usulu, w.kart_nomresi)
                        : 'Ümumi'}
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(w.mebleg)}</td>
                    <td>{w.qeyd || '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn--secondary"
                        style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }}
                        disabled={saving || deletingId === w.id}
                        onClick={() => startEditWithdrawal(w)}
                      >
                        Redaktə
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary"
                        style={{
                          padding: '4px 10px',
                          fontSize: 12,
                          color: 'var(--color-accent)',
                        }}
                        disabled={saving || deletingId === w.id}
                        onClick={() => onDeleteWithdrawal(w)}
                      >
                        {deletingId === w.id ? 'Silinir…' : 'Sil'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
