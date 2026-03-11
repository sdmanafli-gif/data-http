import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import '../../styles/shared.css'

export default function MusteriAdd({ onSaved, initialData }) {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState(initialData?.full_name ?? '')
  const [phone, setPhone] = useState(initialData?.phone ?? '')
  const [address, setAddress] = useState(initialData?.address ?? '')
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!fullName.trim()) {
      setError('Ad, soyad doldurulmalıdır.')
      return
    }
    setSaving(true)
    const { data, error: err } = await supabase
      .from('clients')
      .insert({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      })
      .select('*')
      .single()
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    if (onSaved) onSaved(data)
    else navigate('/musteri-bazasi')
  }

  return (
    <div className="card">
      <h2 className="card__title">{initialData ? 'Müştəri redaktə' : 'Yeni müştəri'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Ad, soyad</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Telefon</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Ünvan</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Qeydlər</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saxlanılır…' : 'Saxla'}</button>
          {!onSaved && (
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/musteri-bazasi')}>Ləğv et</button>
          )}
        </div>
      </form>
    </div>
  )
}
