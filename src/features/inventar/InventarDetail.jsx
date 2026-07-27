import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { confirmDelete } from '../../lib/confirmDelete'
import { formatDate } from '../../lib/formatDate'
import { STATUS_OPTIONS, CONDITION_OPTIONS, INVENTORY_LABELS } from './constants'
import '../../styles/shared.css'

function formatMoney(n) {
  if (n == null || n === '') return '—'
  return Number(n).toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function statusLabel(value) {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value
}

function conditionLabel(value) {
  return CONDITION_OPTIONS.find((o) => o.value === value)?.label ?? value ?? '—'
}

const FIELDS = [
  'status', 'quantity', 'type', 'model', 'color', 'condition_type', 'battery', 'memory',
  'imei_1', 'imei_2', 'serial_no', 'model_no', 'purchase_price', 'member', 'member_no',
  'purchase_date', 'shift', 'payment_due_date', 'documents', 'attachments', 'user', 'created_at', 'comments', 'client_number', 'return_amount', 'supplier_id',
]

export default function InventarDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return
    load()
  }, [id])

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('inventory')
      .select('*, suppliers(name)')
      .eq('id', id)
      .single()
    if (e) {
      setError(e.message)
      setItem(null)
    } else {
      setItem(data)
    }
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirmDelete('Bu inventar sətirini silmək istədiyinizə əminsiniz?')) return
    const { error: err } = await supabase.from('inventory').delete().eq('id', id)
    if (err) setError(err.message)
    else navigate('/inventar')
  }

  async function removeAttachment(idx) {
    if (!item || !id) return
    let list = []
    try {
      if (item.attachments) list = JSON.parse(item.attachments)
    } catch (_) {}
    if (!Array.isArray(list) || idx < 0 || idx >= list.length) return
    const fileItem = list[idx]
    if (!confirmDelete(`«${fileItem?.name || 'Fayl'}» silinsin?`)) return
    await supabase.storage.from('Mobideal').remove([fileItem.path])
    const newList = list.filter((_, i) => i !== idx)
    const attachmentsJson = newList.length > 0 ? JSON.stringify(newList) : null
    const { error: err } = await supabase.from('inventory').update({ attachments: attachmentsJson, updated_at: new Date().toISOString() }).eq('id', id)
    if (err) setError(err.message)
    else load()
  }

  if (loading) return <p className="empty-state">Yüklənir…</p>
  if (error && !item) return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>
  if (!item) return <p className="empty-state">Sətir tapılmadı.</p>

  const renderValue = (key, value) => {
    if (key === 'status') return statusLabel(value)
    if (key === 'condition_type') return conditionLabel(value)
    if (key === 'quantity') return value != null ? Number(value) : '—'
    if (key === 'supplier_id') return item.suppliers?.name ?? '—'
    if (key === 'purchase_price' || key === 'return_amount') return formatMoney(value)
    if (key === 'purchase_date' || key === 'payment_due_date' || key === 'created_at') return formatDate(value)
    if (key === 'attachments') {
      let list = []
      try {
        if (value) list = JSON.parse(value)
      } catch (_) {}
      if (!Array.isArray(list) || list.length === 0) return '—'
      return (
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {list.map((f, i) => {
            const url = supabase.storage.from('Mobideal').getPublicUrl(f.path).data.publicUrl
            return (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a href={url} target="_blank" rel="noopener noreferrer">{f.name}</a>
                <button type="button" className="btn btn--danger" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeAttachment(i)} title="Faylı sil">
                  Sil
                </button>
              </li>
            )
          })}
        </ul>
      )
    }
    return value != null && value !== '' ? String(value) : '—'
  }

  return (
    <div className="card">
      {error && <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error}</p>}
      <div className="page-header" style={{ marginBottom: 'var(--space-md)' }}>
        <h2 className="card__title">İnventar — ətraflı</h2>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--secondary" onClick={() => navigate('/inventar')}>
            Siyahıya qayıt
          </button>
          <button type="button" className="btn btn--primary" onClick={() => navigate(`/inventar/${id}/redakte`)}>
            Redaktə et
          </button>
          <button type="button" className="btn btn--danger" onClick={handleDelete}>
            Sil
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-lg)' }}>
        {FIELDS.map((key) => (
          <div key={key}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 2 }}>{INVENTORY_LABELS[key] || key}</div>
            <div style={{ fontWeight: 500 }}>{renderValue(key, item[key])}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
