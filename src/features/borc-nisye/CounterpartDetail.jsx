import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { confirmDelete } from '../../lib/confirmDelete'
import SuggestInput from '../musteri-bazasi/SuggestInput'
import {
  LEDGER_TABLE,
  ENTRY_TYPES,
  emptyLedgerForm,
  toLedgerPayload,
  formatMoney,
  formatDate,
  tipLabel,
  computeBalances,
  counterpartPath,
} from './constants'
import '../../styles/shared.css'

function uniqueSorted(values) {
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'az')
  )
}

export default function CounterpartDetail() {
  const { kime: kimeParam } = useParams()
  const kime = decodeURIComponent(kimeParam || '').trim()
  const navigate = useNavigate()

  const [entries, setEntries] = useState([])
  const [names, setNames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(() => ({ ...emptyLedgerForm(), kime }))
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    const [{ data, error: e }, { data: allNames }] = await Promise.all([
      fetchAllPages(() =>
        supabase.from(LEDGER_TABLE).select('*').eq('kime', kime).order('tarix', { ascending: false })
      ),
      fetchAllPages(() => supabase.from(LEDGER_TABLE).select('kime')),
    ])
    if (e) {
      setError(e.message)
      setEntries([])
    } else {
      const rows = data || []
      rows.sort((a, b) => {
        const at = a.tarix || ''
        const bt = b.tarix || ''
        if (at !== bt) return bt.localeCompare(at)
        return (b.sira_no ?? 0) - (a.sira_no ?? 0)
      })
      setEntries(rows)
    }
    setNames(uniqueSorted((allNames || []).map((r) => r.kime)))
    setLoading(false)
  }

  useEffect(() => {
    if (!kime) return
    load()
  }, [kime])

  useEffect(() => {
    setForm((f) => ({ ...emptyLedgerForm(), ...f, kime }))
  }, [kime])

  const balance = useMemo(() => {
    const list = computeBalances(entries)
    return list[0] || {
      borc_verdim: 0,
      borc_aldim: 0,
      qaliq_borc: 0,
      nisye_verdim: 0,
      nisye_odenis: 0,
      qaliq_nisye: 0,
    }
  }, [entries])

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    const payload = toLedgerPayload({ ...form, kime: form.kime || kime })
    if (!payload.kime) {
      setError('Kimə mütləqdir.')
      return
    }
    if (payload.mebleg == null || Number(payload.mebleg) < 0) {
      setError('Məbləğ düzgün deyil.')
      return
    }
    if (Number(payload.mebleg) === 0 && !payload.qeyd && !payload.mehsul) {
      setError('Məbləğ 0 olduqda Qeyd və ya Məhsul yazın.')
      return
    }
    if (payload.tip === 'qeyd' && !payload.qeyd && !payload.mehsul) {
      setError('Qeyd tipi üçün şərh yazın.')
      return
    }
    setSaving(true)
    try {
      const { error: err } = await supabase.from(LEDGER_TABLE).insert(payload)
      if (err) throw err
      const nextName = payload.kime
      setShowForm(false)
      setForm({ ...emptyLedgerForm(), kime: nextName })
      if (nextName !== kime) {
        navigate(counterpartPath(nextName), { replace: true })
      } else {
        await load()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(row) {
    if (!row?.id) return
    const label = `${tipLabel(row.tip)} · ${formatMoney(row.mebleg)}`
    if (!confirmDelete(`Bu əməliyyat silinsin?\n${label}`)) return
    setError(null)
    const { error: e } = await supabase.from(LEDGER_TABLE).delete().eq('id', row.id)
    if (e) {
      setError(e.message)
      return
    }
    await load()
  }

  if (!kime) {
    return (
      <div className="card">
        <p className="empty-state">Kontragent seçilməyib.</p>
        <Link to="/borc-nisye" className="btn btn--secondary">İcmala qayıt</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{kime}</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            Bütün əməliyyatlar və qalıqlar
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/borc-nisye" className="btn btn--secondary">İcmal</Link>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'Formu bağla' : 'Yeni əməliyyat'}
          </button>
        </div>
      </div>

      <div className="musteri-summary">
        <div className="musteri-summary__card">
          <div className="musteri-summary__label">Qalıq borc</div>
          <div className="musteri-summary__value">{formatMoney(balance.qaliq_borc)}</div>
        </div>
        <div className="musteri-summary__card">
          <div className="musteri-summary__label">Qalıq nisyə</div>
          <div className="musteri-summary__value">{formatMoney(balance.qaliq_nisye)}</div>
        </div>
        <div className="musteri-summary__card musteri-summary__card--meta">
          <div className="musteri-summary__label">Əməliyyat sayı</div>
          <div className="musteri-summary__value">{entries.length}</div>
        </div>
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 className="card__title">Yeni əməliyyat</h2>
          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
            <SuggestInput
              id="detail-kime"
              label="Kimə"
              value={form.kime}
              onChange={(v) => setForm((f) => ({ ...f, kime: v }))}
              options={names}
            />
            <div className="form-group">
              <label>Tarix</label>
              <input
                type="date"
                value={form.tarix || ''}
                onChange={(e) => setForm((f) => ({ ...f, tarix: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Qaytarma / ödəniş tarixi</label>
              <input
                type="date"
                value={form.qaytarma_tarixi || ''}
                onChange={(e) => setForm((f) => ({ ...f, qaytarma_tarixi: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Əməliyyat növü</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {ENTRY_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={`btn ${form.tip === t.value ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        tip: t.value,
                        mebleg: t.value === 'qeyd' && !f.mebleg ? '0' : f.mebleg,
                      }))
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Məbləğ (boş = 0, yalnız qeyd üçün)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.mebleg}
                onChange={(e) => setForm((f) => ({ ...f, mebleg: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label>Məhsul</label>
              <input value={form.mehsul} onChange={(e) => setForm((f) => ({ ...f, mehsul: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>IMEI 1</label>
                <input value={form.imei_1} onChange={(e) => setForm((f) => ({ ...f, imei_1: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>IMEI 2</label>
                <input value={form.imei_2} onChange={(e) => setForm((f) => ({ ...f, imei_2: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Qeyd</label>
              <textarea
                rows={2}
                value={form.qeyd}
                onChange={(e) => setForm((f) => ({ ...f, qeyd: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saxlanılır…' : 'Saxla'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h2 className="card__title">Əməliyyatlar</h2>
        {loading ? (
          <p className="empty-state">Yüklənir…</p>
        ) : entries.length === 0 ? (
          <p className="empty-state">Bu kontragent üçün hələ qeyd yoxdur.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarix</th>
                  <th>Qaytarma</th>
                  <th>Əməliyyat</th>
                  <th>Məbləğ</th>
                  <th>Məhsul</th>
                  <th>IMEI</th>
                  <th>Qeyd</th>
                  <th style={{ width: 160 }}>Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.tarix)}</td>
                    <td>{formatDate(row.qaytarma_tarixi)}</td>
                    <td>{tipLabel(row.tip)}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(row.mebleg)}</td>
                    <td>{row.mehsul || '—'}</td>
                    <td>{[row.imei_1, row.imei_2].filter(Boolean).join(' / ') || '—'}</td>
                    <td>{row.qeyd || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn--secondary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => navigate(`/borc-nisye/qeyd/${row.id}?edit=1`)}
                        >
                          Redaktə
                        </button>
                        <button
                          type="button"
                          className="btn btn--danger"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => deleteEntry(row)}
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
