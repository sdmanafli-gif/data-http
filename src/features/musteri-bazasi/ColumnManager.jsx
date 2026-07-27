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

  function toggleVisible(index) {
    setCols((prev) =>
      prev.map((c, i) =>
        i === index
          ? { ...c, visible: !c.visible, formVisible: !c.visible }
          : c
      )
    )
  }

  function setLabel(index, label) {
    setCols((prev) => prev.map((c, i) => (i === index ? { ...c, label } : c)))
  }

  function addColumn() {
    const label = newLabel.trim()
    if (!label) {
      setError('Yeni sütun üçün ad yazın.')
      return
    }
    setError(null)
    const key = slugifyColumnKey(label)
    setCols((prev) => [
      ...prev,
      {
        key,
        label,
        type: newType,
        visible: true,
        formVisible: true,
        readonly: false,
        system: false,
        custom: true,
        group: 'custom',
        order: prev.length,
      },
    ])
    setNewLabel('')
    setNewType('text')
  }

  function removeCustom(index) {
    const col = cols[index]
    if (col.system) return
    if (!confirmDelete(`«${col.label}» sütunu silinsin? Mövcud dəyərlər qalacaq, amma siyahıda görünməyəcək.`)) return
    setCols((prev) => prev.filter((_, i) => i !== index))
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

  if (loading) {
    return (
      <div className="card">
        <p className="empty-state">Yüklənir…</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 'var(--space-md)' }}>
        <h2 className="card__title" style={{ margin: 0 }}>Sütunları idarə et</h2>
        <Link to="/musteri-bazasi" className="btn btn--secondary">Geri</Link>
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 'var(--space-lg)' }}>
        Siyahı və forma eyni sıranı istifadə edir. Sütunu yuxarı/aşağı aparın, gizlədin və ya yeni sütun əlavə edin.
      </p>

      {(error || loadError) && (
        <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error || loadError}</p>
      )}
      {success && <p style={{ color: '#1f6b3a', marginBottom: 'var(--space-md)' }}>{success}</p>}

      <div className="table-wrap" style={{ marginBottom: 'var(--space-lg)' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>Sıra</th>
              <th>Ad</th>
              <th>Tip</th>
              <th>Görünür</th>
              <th style={{ width: 160 }}>Əməliyyat</th>
            </tr>
          </thead>
          <tbody>
            {cols.map((col, index) => (
              <tr key={col.key} style={{ opacity: col.visible === false ? 0.45 : 1 }}>
                <td>{index + 1}</td>
                <td>
                  <input
                    value={col.label}
                    onChange={(e) => setLabel(index, e.target.value)}
                    style={{ width: '100%', minWidth: 140 }}
                  />
                  {!col.system && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>özəl sütun</div>
                  )}
                </td>
                <td>{FIELD_TYPES.find((t) => t.value === col.type)?.label || col.type}</td>
                <td>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={col.visible !== false}
                      onChange={() => toggleVisible(index)}
                    />
                    {col.visible !== false ? 'Bəli' : 'Gizli'}
                  </label>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn--secondary" onClick={() => move(index, -1)} disabled={index === 0}>
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
                  {!col.system && (
                    <>
                      {' '}
                      <button type="button" className="btn btn--danger" onClick={() => removeCustom(index)}>
                        Sil
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ background: 'var(--color-bg)', marginBottom: 'var(--space-lg)' }}>
        <h3 className="card__title">Yeni sütun əlavə et</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Sütun adı</label>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Məs: Satıcı adı" />
          </div>
          <div className="form-group">
            <label>Tip</label>
            <select value={newType} onChange={(e) => setNewType(e.target.value)}>
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="button" className="btn btn--secondary" onClick={addColumn}>
              Əlavə et
            </button>
          </div>
        </div>
      </div>

      <button type="button" className="btn btn--primary" disabled={saving} onClick={handleSave}>
        {saving ? 'Saxlanılır…' : 'Ayarları saxla'}
      </button>
    </div>
  )
}
