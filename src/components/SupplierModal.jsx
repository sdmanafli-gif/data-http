import { useState } from 'react'
import { supabase } from '../lib/supabase'
import '../styles/shared.css'

export default function SupplierModal({ onClose, onSaved }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [comments, setComments] = useState('')
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
        comments: comments.trim() || null,
      })
      .select('*')
      .single()
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onSaved(data)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 420, margin: 'var(--space-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: 'var(--space-md)' }}>Yeni təchizatçı</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Ad (mağaza / şəxs)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Telefon</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Ünvan</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Əlaqədar şəxs</label>
            <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Şərh</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              placeholder="Məs: xüsusi razılaşma, ödəniş şərtləri və s."
            />
          </div>
          {error && (
            <p style={{ color: 'var(--color-accent)', fontSize: 13, marginBottom: 'var(--space-sm)' }}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saxlanılır…' : 'Əlavə et'}
            </button>
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Ləğv et
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
