import { useMemo } from 'react'
import SearchableSelect from '../../components/SearchableSelect'
import { NEW_MUSTERI_VALUE } from './constants'

/**
 * Select an existing müştəri or choose "Yeni müştəri" — searchable.
 */
export default function MusteriSelect({
  customers,
  value,
  onSelectExisting,
  onSelectNew,
  disabled,
}) {
  const selectValue = value === NEW_MUSTERI_VALUE ? NEW_MUSTERI_VALUE : value || ''

  const options = useMemo(
    () => [
      {
        value: NEW_MUSTERI_VALUE,
        label: '+ Yeni müştəri yarat',
        keywords: 'yeni musteri yarat new',
      },
      ...(customers || []).map((c) => ({
        value: c.id,
        label: `${c.ad_soyad || '—'}${c.nomre_1 ? ` (${c.nomre_1})` : ''}`,
        keywords: [c.ad_soyad, c.nomre_1, c.nomre_2, c.nomre_3, c.zamin]
          .filter(Boolean)
          .join(' '),
        raw: c,
      })),
    ],
    [customers]
  )

  function handleChange(v, opt) {
    if (v === NEW_MUSTERI_VALUE || !v) {
      onSelectNew()
      return
    }
    const found = opt?.raw || customers.find((c) => c.id === v)
    if (found) onSelectExisting(found)
  }

  return (
    <SearchableSelect
      id="musteri-select"
      label="Müştəri"
      options={options}
      value={selectValue}
      onChange={handleChange}
      placeholder="Ad, nömrə ilə axtar və ya seçin…"
      emptyOption={{ value: '', label: '— Müştəri seçin —' }}
      disabled={disabled}
      required={selectValue !== NEW_MUSTERI_VALUE && !selectValue}
      hint="Mövcud müştərini axtarıb seçin və ya «Yeni müştəri yarat» ilə əlavə edin."
    />
  )
}
