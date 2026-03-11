import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import '../../styles/shared.css'

// Display: dd.mm.yyyy
function formatDate(d) {
  if (!d) return '—'
  const x = new Date(d)
  if (isNaN(x.getTime())) return '—'
  const day = String(x.getDate()).padStart(2, '0')
  const month = String(x.getMonth() + 1).padStart(2, '0')
  const year = x.getFullYear()
  return `${day}.${month}.${year}`
}

// From DB/Date → dd.mm.yyyy for input fields
function toDdMmYyyy(d) {
  if (!d) return ''
  const x = new Date(d)
  return isNaN(x.getTime()) ? '' : formatDate(x)
}

// Parse dd.mm.yyyy or d.m.yyyy → YYYY-MM-DD for Supabase
function parseDdMmYyyyToIso(str) {
  if (!str || typeof str !== 'string') return ''
  const trimmed = str.trim()
  const parts = trimmed.split(/[./-]/).map((p) => p.trim()).filter(Boolean)
  if (parts.length !== 3) return ''
  const [d, m, y] = parts.map((p) => parseInt(p, 10))
  if (Number.isNaN(d) || Number.isNaN(m) || Number.isNaN(y)) return ''
  const year = y < 100 ? 2000 + y : y
  const month = m - 1
  const date = new Date(year, month, d)
  if (date.getDate() !== d || date.getMonth() !== month || date.getFullYear() !== year) return ''
  return date.toISOString().slice(0, 10)
}

function daysSince(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.floor((today - d) / (24 * 60 * 60 * 1000))
}

const OVER_90_DAYS = 90

export default function TelefonNomreleriList() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ phone: '', name: '', update_date: toDdMmYyyy(new Date()) })
  const [selectedId, setSelectedId] = useState(null)
  const [updateDate, setUpdateDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('telefon_nomreleri')
      .select('*')
      .order('update_date', { ascending: true })
    setLoading(false)
    if (e) {
      setError(e.message)
      setList([])
      return
    }
    setList(data || [])
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    const phone = addForm.phone?.trim()
    if (!phone) {
      setError('Telefon nömrəsi daxil edin.')
      return
    }
    const isoDate = parseDdMmYyyyToIso(addForm.update_date) || new Date().toISOString().slice(0, 10)
    setSaving(true)
    const { error: err } = await supabase
      .from('telefon_nomreleri')
      .insert({ phone, name: addForm.name?.trim() || null, update_date: isoDate })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setAddForm({ phone: '', name: '', update_date: toDdMmYyyy(new Date()) })
    setShowAdd(false)
    load()
  }

  async function handleUpdate() {
    const isoDate = parseDdMmYyyyToIso(updateDate)
    if (!selectedId || !isoDate) return
    setError(null)
    setSaving(true)
    const { error: err } = await supabase
      .from('telefon_nomreleri')
      .update({ update_date: isoDate })
      .eq('id', selectedId)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setSelectedId(null)
    setUpdateDate('')
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Bu nömrəni silmək istədiyinizə əminsiniz?')) return
    const { error: err } = await supabase.from('telefon_nomreleri').delete().eq('id', id)
    if (err) setError(err.message)
    else load()
  }

  const selectedRow = list.find((r) => r.id === selectedId)

  if (loading) return <p className="empty-state">Yüklənir…</p>

  return (
    <div className="card">
      <h2 className="card__title">Telefon nömrələri</h2>
      <p style={{ margin: '0 0 var(--space-md) 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
        Nömrə, ad və son yeniləmə tarixi. Yeniləmədən 90 gündən çox keçənlər qırmızı göstərilir; ən köhnə yenilənənlər yuxarıdadır.
      </p>

      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <button type="button" className="btn btn--primary" onClick={() => setShowAdd(true)}>+ Nömrə əlavə et</button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="card" style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)' }}>
          <h3 className="card__title">Yeni nömrə</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Telefon nömrəsi</label>
              <input value={addForm.phone} onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+994..." required />
            </div>
            <div className="form-group">
              <label>Ad</label>
              <input value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ad (opsional)" />
            </div>
            <div className="form-group">
              <label>Yeniləmə tarixi (gg.aa.iiii)</label>
              <input type="text" value={addForm.update_date} onChange={(e) => setAddForm((p) => ({ ...p, update_date: e.target.value }))} placeholder="01.01.2026" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saxlanılır…' : 'Əlavə et'}</button>
            <button type="button" className="btn btn--secondary" onClick={() => { setShowAdd(false); setError(null); }}>Ləğv et</button>
          </div>
        </form>
      )}

      {selectedId && (
        <div className="telefon-modal-overlay" onClick={() => { setSelectedId(null); setUpdateDate(''); }} role="presentation">
          <div className="telefon-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="card__title">Yeniləmə tarixini dəyiş — {selectedRow?.phone}</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Yeni tarix (gg.aa.iiii)</label>
                <input type="text" value={updateDate} onChange={(e) => setUpdateDate(e.target.value)} placeholder="01.01.2026" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button type="button" className="btn btn--primary" disabled={saving || !parseDdMmYyyyToIso(updateDate)} onClick={handleUpdate}>{saving ? 'Saxlanılır…' : 'Yenilə'}</button>
              <button type="button" className="btn btn--secondary" onClick={() => { setSelectedId(null); setUpdateDate(''); }}>Ləğv et</button>
            </div>
          </div>
        </div>
      )}

      {error && <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Telefon nömrəsi</th>
              <th>Ad</th>
              <th>Yeniləmə tarixi</th>
              <th>Gün fərqi (bu gündən)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: 'var(--color-text-muted)' }}>Nömrə yoxdur. Əlavə edin.</td>
              </tr>
            ) : (
              list.map((row) => {
                const days = daysSince(row.update_date)
                const isOver90 = days != null && days > OVER_90_DAYS
                return (
                  <tr key={row.id} style={isOver90 ? { backgroundColor: 'rgba(196, 30, 42, 0.08)', color: 'var(--color-accent)' } : undefined}>
                    <td>{row.phone || '—'}</td>
                    <td>{row.name || '—'}</td>
                    <td>{formatDate(row.update_date)}</td>
                    <td>{days != null ? `${days} gün` : '—'}</td>
                    <td>
                      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn--secondary" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => { setSelectedId(row.id); setUpdateDate(toDdMmYyyy(row.update_date)); }}>Yenilə</button>
                        <button type="button" className="btn btn--danger" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => handleDelete(row.id)}>Sil</button>
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
