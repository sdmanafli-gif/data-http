import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useColumnConfig } from './useColumnConfig'
import '../../styles/shared.css'

export default function ColumnManager() {
  const { columns: saved, loading, error: loadError, saveColumns } = useColumnConfig()
  const [cols, setCols] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

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
        <h2 className="card__title" style={{ margin: 0 }}>Yığım — sütunları idarə et</h2>
        <Link to="/yigim" className="btn btn--secondary">Geri</Link>
      </div>
      <p style={{ marginTop: 0, color: 'var(--color-text-muted)', fontSize: 13 }}>
        Sütunları gizlədin, adını dəyişin və ya sırasını dəyişin. Yığım cədvəli eyni ayarları istifadə edir.
      </p>
      {(error || loadError) && <p style={{ color: 'var(--color-accent)' }}>{error || loadError}</p>}
      {success && <p style={{ color: '#1f6b3a' }}>{success}</p>}

      <div className="table-wrap" style={{ marginBottom: 24 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Sıra</th>
              <th>Ad</th>
              <th>Tip</th>
              <th>Görünür</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cols.map((col, index) => (
              <tr key={col.key} style={{ opacity: col.visible === false ? 0.45 : 1 }}>
                <td>{index + 1}</td>
                <td>
                  <input
                    value={col.label}
                    onChange={(e) =>
                      setCols((p) =>
                        p.map((c, i) => (i === index ? { ...c, label: e.target.value } : c))
                      )
                    }
                  />
                </td>
                <td>{col.type}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={col.visible !== false}
                    onChange={() =>
                      setCols((p) =>
                        p.map((c, i) =>
                          i === index ? { ...c, visible: !(c.visible !== false) } : c
                        )
                      )
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                  >
                    ↑
                  </button>{' '}
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => move(index, 1)}
                    disabled={index === cols.length - 1}
                  >
                    ↓
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" className="btn btn--primary" disabled={saving} onClick={handleSave}>
        {saving ? 'Saxlanılır…' : 'Ayarları saxla'}
      </button>
    </div>
  )
}
