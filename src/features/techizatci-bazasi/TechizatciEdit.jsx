import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import '../../styles/shared.css'

export default function TechizatciEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', phone: '', address: '', contact_person: '', notes: '', comments: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return
    load()
  }, [id])

  async function load() {
    setLoading(true)
    const { data, error: e } = await supabase.from('suppliers').select('*').eq('id', id).single()
    setLoading(false)
    if (e) {
      setError(e.message)
      return
    }
    setForm({
      name: data?.name ?? '',
      phone: data?.phone ?? '',
      address: data?.address ?? '',
      contact_person: data?.contact_person ?? '',
      notes: data?.notes ?? '',
      comments: data?.comments ?? '',
    })
  }

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.name?.trim()) {
      setError('Ad doldurulmalıdır.')
      return
    }
    setSaving(true)
    const { error: err } = await supabase
      .from('suppliers')
      .update({
        name: form.name.trim(),
        phone: form.phone?.trim() || null,
        address: form.address?.trim() || null,
        contact_person: form.contact_person?.trim() || null,
        notes: form.notes?.trim() || null,
        comments: form.comments?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    navigate('/techizatci-bazasi')
  }

  if (loading) return <p className="empty-state">Yüklənir…</p>
  if (error && !form.name) return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>

  return (
    <div className="card list-card">
      <h2 className="card__title">Təchizatçı — redaktə</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Ad (mağaza / şəxs)</label>
          <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Telefon</label>
            <input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Əlaqədar şəxs</label>
            <input value={form.contact_person} onChange={(e) => update('contact_person', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Ünvan</label>
          <input value={form.address} onChange={(e) => update('address', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Qeydlər</label>
          <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Şərh</label>
          <textarea value={form.comments} onChange={(e) => update('comments', e.target.value)} placeholder="Əlavə qeydlər" />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saxlanılır…' : 'Saxla'}</button>
          <button type="button" className="btn btn--secondary" onClick={() => navigate('/techizatci-bazasi')}>Ləğv et</button>
        </div>
      </form>
    </div>
  )
}
