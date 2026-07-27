import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { confirmDelete } from '../../lib/confirmDelete'
import '../../styles/shared.css'

export default function TechizatciList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase.from('suppliers').select('*').order('name')
    if (e) {
      setError(e.message)
      setItems([])
    } else setItems(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirmDelete('Bu təchizatçını silmək istədiyinizə əminsiniz?')) return
    const { error: e } = await supabase.from('suppliers').delete().eq('id', id)
    if (e) setError(e.message)
    else load()
  }

  if (loading) return <p className="empty-state">Yüklənir…</p>
  if (error) return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>

  return (
    <div className="card list-card">
      <div className="table-wrap">
        <table className="data-table list-table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Telefon</th>
              <th>Ünvan</th>
              <th>Əlaqədar şəxs</th>
              <th className="th-actions"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} className="empty-state">Təchizatçı yoxdur. «Yeni təchizatçı» ilə əlavə edin.</td></tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td>{row.name || '—'}</td>
                  <td>{row.phone || '—'}</td>
                  <td>{row.address || '—'}</td>
                  <td>{row.contact_person || '—'}</td>
                  <td className="td-actions">
                    <Link to={`/techizatci-bazasi/${row.id}/redakte`} className="btn btn--secondary btn-sm">Redaktə</Link>
                    <button type="button" className="btn btn--danger btn-sm" onClick={() => handleDelete(row.id)}>Sil</button>
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
