import { useMemo } from 'react'

/**
 * Depo "Axtarış" paneli: tarix aralığı, Kateqoriya, Növ, Model, Qalıb / Satılıb.
 * Depo siyahısında (Cəmlərin altında) və Satışda "Əlavə məhsul əlavə et" pəncərəsində istifadə olunur.
 */
export const EMPTY_DEPO_FILTERS = { tarixDen: '', tarixDek: '', kateqoriya: '', nov: '', model: '', veziyyet: '' }

const lcAz = (v) => String(v || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('az')

function uniqSorted(values) {
  const seen = new Map()
  for (const v of values) {
    const t = String(v || '').trim().replace(/\s+/g, ' ')
    if (t && !seen.has(lcAz(t))) seen.set(lcAz(t), t)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'az'))
}

/**
 * Model siyahısı seçilmiş Kateqoriya və Növə görə: Telefon / iPhone seçiləndə
 * yalnız iPhone modelləri, Aksesuar / Adapter seçiləndə yalnız adapter modelləri.
 */
export function modelsFor(rows, kateqoriya, nov) {
  const kat = lcAz(kateqoriya)
  const n = lcAz(nov)
  return uniqSorted(
    (rows || [])
      .filter((r) => (!kat || lcAz(r.kateqoriya) === kat) && (!n || lcAz(r.nov) === n))
      .map((r) => r.model)
  )
}

export function countActiveFilters(filters) {
  return Object.values(filters || {}).filter(Boolean).length
}

/** Kateqoriya dəyişəndə Növ sıfırlanır */
export function nextFilters(prev, key, value) {
  const next = { ...prev, [key]: value }
  if (key === 'kateqoriya') next.nov = ''
  return next
}

export function applyDepoFilters(rows, f) {
  const kat = lcAz(f.kateqoriya)
  const nov = lcAz(f.nov)
  const model = lcAz(f.model)
  return rows.filter((r) => {
    const d = String(r.alis_tarixi || '').slice(0, 10)
    if (f.tarixDen && (!d || d < f.tarixDen)) return false
    if (f.tarixDek && (!d || d > f.tarixDek)) return false
    if (kat && lcAz(r.kateqoriya) !== kat) return false
    if (nov && lcAz(r.nov) !== nov) return false
    if (model && !lcAz(r.model).includes(model)) return false
    if (f.veziyyet === 'qalib' && r.status !== 'available') return false
    if (f.veziyyet === 'satilib' && r.status !== 'sold') return false
    return true
  })
}

/**
 * @param {{
 *   rows: object[],            // seçim siyahıları bu sətirlərdən yığılır
 *   filters: typeof EMPTY_DEPO_FILTERS,
 *   onChange: (key, value) => void,
 *   onClear: () => void,
 *   foundCount?: number,
 *   showVeziyyet?: boolean,
 *   idPrefix?: string,
 * }} p
 */
export default function DepoFilterFields({
  rows,
  filters,
  onChange,
  onClear,
  foundCount,
  showVeziyyet = true,
  showDates = true,
  idPrefix = 'depo-filter',
}) {
  const options = useMemo(() => {
    const kat = lcAz(filters.kateqoriya)
    return {
      kateqoriya: uniqSorted(rows.map((r) => r.kateqoriya)),
      nov: uniqSorted(rows.filter((r) => !kat || lcAz(r.kateqoriya) === kat).map((r) => r.nov)),
      model: modelsFor(rows, filters.kateqoriya, filters.nov),
    }
  }, [rows, filters.kateqoriya, filters.nov])

  const active = countActiveFilters(showVeziyyet ? filters : { ...filters, veziyyet: '' })

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
      {showDates && (
        <>
          <div className="form-group" style={{ marginBottom: 0, width: 150 }}>
            <label>Tarixdən</label>
            <input type="date" value={filters.tarixDen} onChange={(e) => onChange('tarixDen', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0, width: 150 }}>
            <label>Tarixədək</label>
            <input type="date" value={filters.tarixDek} onChange={(e) => onChange('tarixDek', e.target.value)} />
          </div>
        </>
      )}
      <div className="form-group" style={{ marginBottom: 0, width: 170 }}>
        <label>Kateqoriya</label>
        <select value={filters.kateqoriya} onChange={(e) => onChange('kateqoriya', e.target.value)}>
          <option value="">Hamısı</option>
          {options.kateqoriya.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 0, width: 170 }}>
        <label>Növ</label>
        <select value={filters.nov} onChange={(e) => onChange('nov', e.target.value)}>
          <option value="">Hamısı</option>
          {options.nov.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 0, width: 200 }}>
        <label>Model</label>
        <input
          list={`${idPrefix}-models`}
          value={filters.model}
          onChange={(e) => onChange('model', e.target.value)}
          placeholder="Model yazın…"
          autoComplete="off"
        />
        <datalist id={`${idPrefix}-models`}>
          {options.model.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </div>
      {showVeziyyet && (
        <div className="form-group" style={{ marginBottom: 0, width: 150 }}>
          <label>Qalıb / Satılıb</label>
          <select value={filters.veziyyet} onChange={(e) => onChange('veziyyet', e.target.value)}>
            <option value="">Hamısı</option>
            <option value="qalib">Qalıb</option>
            <option value="satilib">Satılıb</option>
          </select>
        </div>
      )}
      <button type="button" className="btn btn--secondary" disabled={!active} onClick={onClear}>
        Təmizlə
      </button>
      {foundCount != null && (
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)', paddingBottom: 8 }}>
          Tapıldı: <strong>{foundCount}</strong>
        </span>
      )}
    </div>
  )
}
