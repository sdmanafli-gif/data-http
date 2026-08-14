import { useMemo } from 'react'
import SearchableSelect from '../../components/SearchableSelect'
import { clientOptionLabel } from './constants'

/**
 * Searchable client picker by №, Ad Soyad, or model.
 */
export default function ClientPicker({
  clients = [],
  valueId = '',
  onSelect,
  disabled,
  required = true,
}) {
  const options = useMemo(
    () =>
      (clients || []).map((c) => ({
        value: c.id,
        label: clientOptionLabel(c),
        keywords: [c.sira_no, c.ad_soyad, c.model, c.imei_1, c.nomre_1]
          .filter((x) => x != null && String(x).trim() !== '')
          .join(' '),
        raw: c,
      })),
    [clients]
  )

  const selected = clients.find((c) => c.id === valueId)

  return (
    <>
      <SearchableSelect
        id="odenis-client"
        label="Müştəri (№ və ya ad)"
        options={options}
        value={valueId || ''}
        onChange={(_v, opt) => onSelect?.(opt?.raw || null)}
        placeholder="№, ad və ya model ilə axtar…"
        emptyOption={{ value: '', label: '— Müştəri seçin —' }}
        disabled={disabled}
        required={required}
      />
      {selected && (
        <p className="form-hint" style={{ marginTop: -8 }}>
          Seçildi: {selected.sira_no != null ? `#${selected.sira_no} · ` : ''}
          {selected.ad_soyad || '—'}
          {selected.model ? ` · ${selected.model}` : ''}
        </p>
      )}
    </>
  )
}
