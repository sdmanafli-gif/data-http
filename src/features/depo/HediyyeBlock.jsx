import { useEffect, useMemo, useState } from 'react'
import { supabase, fetchAllPages } from '../../lib/supabase'
import SearchableSelect from '../../components/SearchableSelect'
import { DEPO_TABLE } from './constants'

/**
 * Kredit satışı: «Hədiyyələr» — 5 sətir.
 * Hər sətir: hədiyyənin adı (əl ilə yazılır və ya Depodan seçilir) + qiyməti.
 * Depodan seçiləndə qiymət avtomatik (alış qiyməti) gəlir; satış saxlananda həmin məhsul «Satılıb» olur.
 * Hədiyyələrin cəmi satışın gəlirindən çıxılır (alış qiymətinə əlavə olunur).
 */

export const HEDIYYE_SAYI = 5

export function emptyHediyyeler() {
  return Array.from({ length: HEDIYYE_SAYI }, () => ({ ad: '', qiymet: '', depoItem: null }))
}

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Doldurulmuş hədiyyələr */
export function filledHediyyeler(list) {
  return (list || []).filter((h) => String(h.ad || '').trim() || num(h.qiymet) > 0)
}

export function hediyyeTotal(list) {
  return Math.round(filledHediyyeler(list).reduce((a, h) => a + num(h.qiymet), 0) * 100) / 100
}

/** Bazaya (musteri_bazasi.extra) yazılacaq qısa siyahı */
export function hediyyeExtra(list) {
  return filledHediyyeler(list).map((h) => ({
    ad: String(h.ad || '').trim(),
    qiymet: Math.round(num(h.qiymet) * 100) / 100,
    depo_id: h.depoItem?.id || null,
  }))
}

export function depoItemName(item) {
  if (!item) return ''
  return [item.nov, item.model, item.yaddas, item.reng].map((t) => String(t || '').trim()).filter(Boolean).join(' ')
}

function depoItemLabel(item) {
  const extra = [item.imei_1 ? `IMEI ${item.imei_1}` : '', item.serial_no ? `S/N ${item.serial_no}` : '']
    .filter(Boolean)
    .join(' · ')
  const price = item.alis_qiymeti != null ? ` — ${item.alis_qiymeti} AZN` : ''
  return `${item.sira_no != null ? `#${item.sira_no} ` : ''}${depoItemName(item) || '—'}${extra ? ` · ${extra}` : ''}${price}`
}

export default function HediyyeBlock({ value, onChange, excludeIds = [] }) {
  const [depoItems, setDepoItems] = useState([])
  const [loadErr, setLoadErr] = useState('')
  const [pickerRow, setPickerRow] = useState(-1)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await fetchAllPages(() =>
        supabase.from(DEPO_TABLE).select('*').eq('status', 'available').order('sira_no', { ascending: true })
      )
      if (cancelled) return
      if (error) setLoadErr(error.message)
      else setDepoItems(data || [])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const list = value?.length ? value : emptyHediyyeler()
  const taken = useMemo(() => {
    const s = new Set(excludeIds)
    for (const h of list) if (h.depoItem?.id) s.add(h.depoItem.id)
    return s
  }, [excludeIds, list])

  const setRow = (idx, patch) => {
    const next = list.map((h, i) => (i === idx ? { ...h, ...patch } : h))
    onChange(next)
  }

  const total = hediyyeTotal(list)

  return (
    <div className="depo-box hediyye-block">
      <div className="hediyye-block__head">
        <strong>Hədiyyələr</strong>
        {total > 0 && <span className="hediyye-block__total">Cəmi: {total} AZN · gəlirdən çıxılır</span>}
      </div>
      {loadErr && <p className="depo-msg" style={{ color: 'var(--color-accent)' }}>{loadErr}</p>}
      {list.map((h, idx) => {
        const fromDepo = Boolean(h.depoItem)
        const options = depoItems
          .filter((it) => !taken.has(it.id) || it.id === h.depoItem?.id)
          .map((it) => ({ value: it.id, label: depoItemLabel(it) }))
        return (
          <div key={idx} className="hediyye-row">
            <span className="hediyye-row__no">{idx + 1}</span>
            <div className="hediyye-row__name">
              {pickerRow === idx ? (
                <SearchableSelect
                  options={options}
                  value={h.depoItem?.id || ''}
                  onChange={(id) => {
                    const item = depoItems.find((it) => it.id === id) || null
                    if (item) {
                      setRow(idx, {
                        depoItem: item,
                        ad: depoItemName(item),
                        qiymet: item.alis_qiymeti != null ? String(item.alis_qiymeti) : '',
                      })
                    }
                    setPickerRow(-1)
                  }}
                  placeholder="Depoda axtarın (ad, IMEI, №)…"
                  noResultsText="Depoda uyğun məhsul yoxdur."
                />
              ) : (
                <input
                  value={h.ad}
                  readOnly={fromDepo}
                  onChange={(e) => setRow(idx, { ad: e.target.value })}
                  placeholder="Hədiyyənin adı (əl ilə)"
                  title={fromDepo ? 'Depodan seçilib' : undefined}
                />
              )}
            </div>
            <input
              className="hediyye-row__price"
              type="number"
              step="0.01"
              min="0"
              value={h.qiymet}
              readOnly={fromDepo}
              onChange={(e) => setRow(idx, { qiymet: e.target.value })}
              placeholder="Qiymət"
              title={fromDepo ? 'Qiymət depodan (alış qiyməti)' : undefined}
            />
            <div className="hediyye-row__actions">
              {pickerRow === idx ? (
                <button type="button" className="btn btn--secondary" onClick={() => setPickerRow(-1)}>
                  Ləğv
                </button>
              ) : (
                <button type="button" className="btn btn--secondary" onClick={() => setPickerRow(idx)}>
                  Depodan
                </button>
              )}
              {(h.ad || h.qiymet || fromDepo) && pickerRow !== idx && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  title="Sətri təmizlə"
                  onClick={() => setRow(idx, { ad: '', qiymet: '', depoItem: null })}
                >
                  ×
                </button>
              )}
            </div>
            {fromDepo && pickerRow !== idx && (
              <span className="hediyye-row__tag">Depodan · satışda «Satılıb» olacaq</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
