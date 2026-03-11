import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import '../../styles/shared.css'

export default function MusteriList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    let q = supabase.from('clients').select('*').order('full_name')
    const term = search.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')
    if (term) {
      q = q.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
    }
    const { data, error: e } = await q
    if (e) {
      setError(e.message)
      setItems([])
    } else setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [search])

  async function handleDelete(id) {
    if (!window.confirm('Bu müştərini silmək istədiyinizə əminsiniz?')) return
    const { error: e } = await supabase.from('clients').delete().eq('id', id)
    if (e) setError(e.message)
    else load()
  }

  if (error) return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>

  return (
    <>
      <div className="form-group" style={{ marginBottom: 'var(--space-md)', maxWidth: 320 }}>
        <label>Axtarış (ad, telefon)</label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Axtar..." />
      </div>
      <div className="card">
        {loading ? (
          <p className="empty-state">Yüklənir…</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ad, soyad</th>
                  <th>Telefon</th>
                  <th>Ünvan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={4} className="empty-state">Müştəri tapılmadı.</td></tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.full_name || '—'}</td>
                      <td>{row.phone || '—'}</td>
                      <td>{row.address || '—'}</td>
                      <td>
                        <button type="button" className="btn btn--danger" onClick={() => handleDelete(row.id)}>Sil</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
