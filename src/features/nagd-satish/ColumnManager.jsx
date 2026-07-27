import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useColumnConfig } from './useColumnConfig'
import { FIELD_TYPES, slugifyColumnKey } from './constants'
import { confirmDelete } from '../../lib/confirmDelete'
import '../../styles/shared.css'

export default function ColumnManager() {
  const { columns: saved, loading, error: loadError, saveColumns } = useColumnConfig()
  const [cols, setCols] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState('text')

  useEffect(() => {
    setCols(saved.map((c, i) => ({ ...c, order: i })))
  }, [saved])

  function move(index, dir) {
    const next = [...cols]
    const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    setCols(next.map((c, i) => ({ ...c, order: i })))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await saveColumns(cols)
      setSuccess('Sütun ayarları saxlanıldı.')
    } catch (err) {
      setError(err?.message ?? 'Saxlanılmadı.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card"><p className="empty-state">Yüklənir…</p></div>

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2 className="card__title" style={{ margin: 0 }}>Nağd satış — sütunları idarə et</h2>
        <Link to="/nagd-satish" className="btn btn--secondary">Geri</Link>
      </div>
      {(error || loadError) && <p style={{ color: 'var(--color-accent)' }}>{error || loadError}</p>}
      {success && <p style={{ color: '#1f6b3a' }}>{success}</p>}
      <div className="table-wrap" style={{ marginBottom: 24 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Sıra</th><th>Ad</th><th>Tip</th><th>Görünür</th><th></th>
            </tr>
          </thead>
          <tbody>
            {cols.map((col, index) => (
              <tr key={col.key} style={{ opacity: col.visible === false ? 0.45 : 1 }}>
                <td>{index + 1}</td>
                <td>
                  <input value={col.label} onChange={(e) => setCols((p) => p.map((c, i) => i === index ? { ...c, label: e.target.value } : c))} />
                </td>
                <td>{col.type}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={col.visible !== false}
                    onChange={() => setCols((p) => p.map((c, i) => i === index ? { ...c, visible: !c.visible, formVisible: !c.visible } : c))}
                  />
                </td>
                <td>
                  <button type="button" className="btn btn--secondary" onClick={() => move(index, -1)} disabled={index === 0}>↑</button>{' '}
                  <button type="button" className="btn btn--secondary" onClick={() => move(index, 1)} disabled={index === cols.length - 1}>↓</button>
                  {!col.system && (
                    <button
                      type="button"
                      className="btn btn--danger"
                      style={{ marginLeft: 6 }}
                      onClick={() => {
                        if (!confirmDelete('Bu sütun silinsin?')) return
                        setCols((p) => p.filter((_, i) => i !== index))
                      }}
                    >
                      Sil
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-group">
          <label>Yeni sütun adı</label>
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Tip</label>
          <select value={newType} onChange={(e) => setNewType(e.target.value)}>
            {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              if (!newLabel.trim()) return
              setCols((p) => [
                ...p,
                {
                  key: slugifyColumnKey(newLabel),
                  label: newLabel.trim(),
                  type: newType,
                  visible: true,
                  formVisible: true,
                  system: false,
                  custom: true,
                  order: p.length,
                },
              ])
              setNewLabel('')
            }}
          >
            Əlavə et
          </button>
        </div>
      </div>
      <button type="button" className="btn btn--primary" disabled={saving} onClick={handleSave}>
        {saving ? 'Saxlanılır…' : 'Saxla'}
      </button>
    </div>
  )
}
