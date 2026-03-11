import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import '../../styles/shared.css'

export default function TechizatciAdd() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Ad doldurulmalıdır.')
      return
    }
    setSaving(true)
    const { data, error: err } = await supabase
      .from('suppliers')
      .insert({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        contact_person: contactPerson.trim() || null,
        notes: notes.trim() || null,
      })
      .select('id')
      .single()
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    navigate('/techizatci-bazasi')
  }

  return (
    <div className="card">
      <h2 className="card__title">Yeni təchizatçı</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Ad (mağaza / şəxs)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="məs. ABC Mağaza" required />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Telefon</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Əlaqədar şəxs</label>
            <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Ünvan</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Qeydlər</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saxlanılır…' : 'Əlavə et'}</button>
          <button type="button" className="btn btn--secondary" onClick={() => navigate('/techizatci-bazasi')}>Ləğv et</button>
        </div>
      </form>
    </div>
  )
}
