import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import '../../styles/shared.css'

function formatMoney(n) {
  if (n == null || Number.isNaN(n)) return '0,00'
  return Number(n).toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function toInputDate(d) {
  if (!d) return ''
  const x = new Date(d)
  return isNaN(x.getTime()) ? '' : x.toISOString().slice(0, 10)
}

export default function BazaraBorcList() {
  const [suppliers, setSuppliers] = useState([])
  const [entries, setEntries] = useState([])
  const [totals, setTotals] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ supplier_id: '', amount: '', description: '', debt_date: toInputDate(new Date()) })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [supRes, entRes] = await Promise.all([
        supabase.from('suppliers').select('id, name').order('name'),
        supabase.from('bazara_borc').select('id, supplier_id, amount, description, debt_date, created_at').order('debt_date', { ascending: false }),
      ])
      if (supRes.error) throw supRes.error
      if (entRes.error) throw entRes.error

      setSuppliers(supRes.data || [])
      setEntries(entRes.data || [])

      const bySupplier = {}
      ;(entRes.data || []).forEach((e) => {
        bySupplier[e.supplier_id] = (bySupplier[e.supplier_id] || 0) + Number(e.amount)
      })
      setTotals(bySupplier)
    } catch (err) {
      setError(err?.message || String(err))
    }
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    const supplier_id = form.supplier_id?.trim()
    const amount = Number(form.amount)
    const debt_date = form.debt_date || new Date().toISOString().slice(0, 10)
    if (!supplier_id || Number.isNaN(amount) || amount === 0) {
      setError('Təchizatçı seçin və məbləğ daxil edin (müsbət = borc, mənfi = ödəniş).')
      return
    }
    setSaving(true)
    const { error: err } = await supabase
      .from('bazara_borc')
      .insert({ supplier_id, amount, description: form.description?.trim() || null, debt_date })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setForm({ supplier_id: '', amount: '', description: '', debt_date: toInputDate(new Date()) })
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Bu qeydi silmək istədiyinizə əminsiniz?')) return
    const { error: err } = await supabase.from('bazara_borc').delete().eq('id', id)
    if (err) setError(err.message)
    else load()
  }

  const supplierNames = {}
  suppliers.forEach((s) => { supplierNames[s.id] = s.name })

  if (loading) return <p className="empty-state">Yüklənir…</p>
  if (error && !entries.length && !suppliers.length) return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>

  return (
    <div className="card">
      <h2 className="card__title">Bazara borc — təchizatçılara borc</h2>
      <p style={{ margin: '0 0 var(--space-lg) 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
        B2B tərəfdaşlardan (mağazalardan) alış zamanı borc və onlara edilən ödənişlərin qeydi. Müsbət məbləğ = borc əlavə, mənfi = ödəniş.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        {suppliers.filter((s) => (totals[s.id] || 0) > 0).map((s) => (
          <div key={s.id} style={{ padding: 'var(--space-md)', background: 'var(--color-bg)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.name}</div>
            <div style={{ fontWeight: 600 }}>{formatMoney(totals[s.id])} AZN</div>
          </div>
        ))}
        {suppliers.length > 0 && Object.keys(totals).filter((id) => (totals[id] || 0) > 0).length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Hal-hazırda borc qeydi yoxdur.</p>
        )}
      </div>

      <h3 className="card__title">Yeni qeyd</h3>
      <form onSubmit={handleAdd} style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="form-row">
          <div className="form-group">
            <label>Təchizatçı</label>
            <select value={form.supplier_id} onChange={(e) => setForm((p) => ({ ...p, supplier_id: e.target.value }))} required>
              <option value="">— Seçin —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Məbləğ (AZN)</label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="Müsbət = borc, mənfi = ödəniş"
            />
          </div>
          <div className="form-group">
            <label>Tarix</label>
            <input type="date" value={form.debt_date} onChange={(e) => setForm((p) => ({ ...p, debt_date: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label>Qeyd (opsional)</label>
          <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Məs. alış fakturası №..." />
        </div>
        {error && <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saxlanılır…' : 'Əlavə et'}</button>
      </form>

      <h3 className="card__title">Son qeydlər</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Təchizatçı</th>
              <th>Tarix</th>
              <th className="num">Məbləğ</th>
              <th>Qeyd</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: 'var(--color-text-muted)' }}>Qeyd yoxdur.</td>
              </tr>
            ) : (
              entries.map((row) => (
                <tr key={row.id}>
                  <td>{supplierNames[row.supplier_id] ?? '—'}</td>
                  <td>{toInputDate(row.debt_date) || '—'}</td>
                  <td className="num" style={{ color: Number(row.amount) < 0 ? 'var(--color-accent)' : undefined }}>{formatMoney(row.amount)}</td>
                  <td>{(row.description || '').slice(0, 40)}{(row.description || '').length > 40 ? '…' : ''}</td>
                  <td>
                    <button type="button" className="btn btn--danger" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => handleDelete(row.id)}>Sil</button>
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
