import { useMemo, useState } from 'react'
import { clientOptionLabel } from './constants'

/**
 * Searchable client picker by № or Ad Soyad.
 * Selecting fills id / sira_no / ad_soyad via onSelect.
 */
export default function ClientPicker({
  clients = [],
  valueId = '',
  onSelect,
  disabled,
  required = true,
}) {
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => {
      const no = c.sira_no != null ? String(c.sira_no) : ''
      const name = String(c.ad_soyad || '').toLowerCase()
      const model = String(c.model || '').toLowerCase()
      return no.includes(q) || name.includes(q) || model.includes(q)
    })
  }, [clients, filter])

  const selected = clients.find((c) => c.id === valueId)

  function handleChange(e) {
    const id = e.target.value
    if (!id) {
      onSelect?.(null)
      return
    }
    const found = clients.find((c) => c.id === id)
    onSelect?.(found || null)
  }

  return (
    <div className="form-group">
      <label htmlFor="odenis-client-filter">Müştəri (№ və ya ad) *</label>
      <input
        id="odenis-client-filter"
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="№ və ya ad ilə axtar…"
        disabled={disabled}
        autoComplete="off"
        style={{ marginBottom: 8 }}
      />
      <select
        id="odenis-client"
        value={valueId || ''}
        onChange={handleChange}
        disabled={disabled}
        required={required}
      >
        <option value="">— Müştəri seçin —</option>
        {filtered.map((c) => (
          <option key={c.id} value={c.id}>
            {clientOptionLabel(c)}
          </option>
        ))}
      </select>
      {selected && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
          Seçildi: {selected.sira_no != null ? `#${selected.sira_no} · ` : ''}
          {selected.ad_soyad || '—'}
          {selected.model ? ` · ${selected.model}` : ''}
        </p>
      )}
      {filter && filtered.length === 0 && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-accent)' }}>
          Uyğun müştəri tapılmadı.
        </p>
      )}
    </div>
  )
}
