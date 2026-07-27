import { NEW_MUSTERI_VALUE } from './constants'

/**
 * Select an existing müştəri or choose "Yeni müştəri".
 */
export default function MusteriSelect({
  customers,
  value,
  onSelectExisting,
  onSelectNew,
  disabled,
}) {
  const selectValue = value === NEW_MUSTERI_VALUE ? NEW_MUSTERI_VALUE : value || ''

  function handleChange(e) {
    const v = e.target.value
    if (v === NEW_MUSTERI_VALUE) {
      onSelectNew()
      return
    }
    if (!v) {
      onSelectNew()
      return
    }
    const found = customers.find((c) => c.id === v)
    if (found) onSelectExisting(found)
  }

  return (
    <div className="form-group">
      <label htmlFor="musteri-select">Müştəri *</label>
      <select
        id="musteri-select"
        value={selectValue}
        onChange={handleChange}
        disabled={disabled}
        required={selectValue !== NEW_MUSTERI_VALUE && !selectValue}
      >
        <option value="">— Müştəri seçin —</option>
        <option value={NEW_MUSTERI_VALUE}>+ Yeni müştəri yarat</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.ad_soyad}
            {c.nomre_1 ? ` (${c.nomre_1})` : ''}
          </option>
        ))}
      </select>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
        Mövcud müştərini seçin və ya «Yeni müştəri yarat» ilə əlavə edin.
      </p>
    </div>
  )
}
