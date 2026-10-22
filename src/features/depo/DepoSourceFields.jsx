/**
 * Depo formu: "Haradan" (Təchizatçı / Müştəri) və "Sistem" (var / yox) blokları.
 */

export const NEW_PICK = '__new__'

export function emptySource() {
  return {
    tip: '', // '' | 'techizatci' | 'musteri'
    pick: '', // '' | '__new__' | 't:<id>' | 'n:<ad>' | 'm:<id>'
    yeni: { ad_soyad: '', tukan: '', nomre_1: '', nomre_2: '', komment: '' },
  }
}

export function emptySystem() {
  return { sistem: 'yox', nov: '', mebleg: '', adi: '', zamin: '' }
}

/** DB sətrindən formun "Haradan" vəziyyəti */
export function sourceFromRow(row) {
  const s = emptySource()
  if (!row) return s
  if (row.haradan_tip === 'techizatci') {
    s.tip = 'techizatci'
    if (row.techizatci_id) s.pick = `t:${row.techizatci_id}`
    else if (row.kimden_alinib) s.pick = `n:${row.kimden_alinib}`
  } else if (row.haradan_tip === 'musteri') {
    s.tip = 'musteri'
    if (row.musteri_id) s.pick = `m:${row.musteri_id}`
  }
  return s
}

/** DB sətrindən formun "Sistem" vəziyyəti */
export function systemFromRow(row) {
  const s = emptySystem()
  if (!row || !row.sistem) return s
  s.sistem = 'var'
  s.nov = row.sistem_nov || ''
  s.mebleg = row.sistem_mebleg != null ? String(row.sistem_mebleg) : ''
  s.adi = row.sistem_adi || ''
  s.zamin = row.sistem_zamin || ''
  return s
}

export function systemAmount(sys) {
  if (sys?.sistem !== 'var' || sys.nov !== 'menim') return 0
  const n = Number(String(sys.mebleg || '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Saxlamazdan əvvəl yoxlama; xəta mətni və ya null */
export function validateSourceAndSystem(src, sys) {
  if (src.tip && !src.pick) {
    return src.tip === 'techizatci' ? 'Təchizatçı seçin və ya «Yeni Təchizatçı» yaradın.' : 'Müştəri seçin və ya «Yeni Müştəri» yaradın.'
  }
  if (src.tip && src.pick === NEW_PICK && !String(src.yeni.ad_soyad || '').trim()) {
    return 'Yeni üçün Ad / Soyad / Ata adı yazılmalıdır.'
  }
  if (sys.sistem === 'var') {
    if (!sys.nov) return 'Hansı sistem olduğunu seçin (Mənim / Digər).'
    if (sys.nov === 'menim') {
      const n = Number(String(sys.mebleg || '').replace(',', '.'))
      if (!Number.isFinite(n) || n <= 0) return '«Mənim» sistem üçün məbləğ yazın.'
    }
    if (sys.nov === 'diger' && !String(sys.adi || '').trim()) return '«Digər» üçün hansı sistem olduğunu yazın.'
  }
  return null
}

/** DB-yə yazılacaq sistem sahələri */
export function systemPayload(sys) {
  if (sys.sistem !== 'var') {
    return { sistem: false, sistem_nov: null, sistem_mebleg: null, sistem_adi: null, sistem_zamin: null }
  }
  return {
    sistem: true,
    sistem_nov: sys.nov || null,
    sistem_mebleg: sys.nov === 'menim' ? systemAmount(sys) : null,
    sistem_adi: sys.nov === 'diger' ? String(sys.adi || '').trim() || null : null,
    sistem_zamin: sys.nov === 'diger' ? String(sys.zamin || '').trim() || null : null,
  }
}

const hintStyle = { margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }
const boxStyle = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  padding: 12,
  background: 'var(--color-bg)',
  display: 'grid',
  gap: 10,
}

/**
 * @param {{ src, setSrc, suppliers: {value,label,name}[], customers: {value,label,name}[], onPickName: (name)=>void }} p
 */
export function HaradanBlock({ src, setSrc, suppliers, customers, onPickName }) {
  const isSup = src.tip === 'techizatci'
  const list = isSup ? suppliers : customers
  const setYeni = (k, v) =>
    setSrc((prev) => {
      const next = { ...prev, yeni: { ...prev.yeni, [k]: v } }
      if (k === 'ad_soyad') onPickName(v)
      return next
    })

  return (
    <div style={boxStyle}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Haradan</label>
        <select
          value={src.tip}
          onChange={(e) => {
            const tip = e.target.value
            setSrc({ ...emptySource(), tip })
            onPickName('')
          }}
        >
          <option value="">— Seçin —</option>
          <option value="techizatci">Təchizatçı</option>
          <option value="musteri">Müştəri</option>
        </select>
      </div>

      {src.tip && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>{isSup ? 'Təchizatçı' : 'Müştəri'}</label>
          <select
            value={src.pick}
            onChange={(e) => {
              const pick = e.target.value
              setSrc((prev) => ({ ...prev, pick }))
              if (pick === NEW_PICK) onPickName(src.yeni.ad_soyad || '')
              else onPickName(list.find((o) => o.value === pick)?.name || '')
            }}
          >
            <option value="">— Seçin —</option>
            <option value={NEW_PICK}>{isSup ? '+ Yeni Təchizatçı' : '+ Yeni Müştəri'}</option>
            {list.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p style={hintStyle}>
            {isSup ? 'Siyahı Kontaktlar → Təchizatçılar bölməsindəndir' : 'Siyahı Kontaktlar → Müştərilər bölməsindəndir'}
          </p>
        </div>
      )}

      {src.tip && src.pick === NEW_PICK && (
        <>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Ad / Soyad / Ata adı *</label>
            <input value={src.yeni.ad_soyad} onChange={(e) => setYeni('ad_soyad', e.target.value)} />
          </div>
          {isSup && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hansı Tükan</label>
              <input value={src.yeni.tukan} onChange={(e) => setYeni('tukan', e.target.value)} />
            </div>
          )}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Əlaqə Nömrəsi 1</label>
            <input value={src.yeni.nomre_1} onChange={(e) => setYeni('nomre_1', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Əlaqə Nömrəsi 2</label>
            <input value={src.yeni.nomre_2} onChange={(e) => setYeni('nomre_2', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Komment</label>
            <textarea rows={2} value={src.yeni.komment} onChange={(e) => setYeni('komment', e.target.value)} />
          </div>
        </>
      )}
    </div>
  )
}

/**
 * @param {{ sys, setSys, baseAmount: number }} p
 */
export function SistemBlock({ sys, setSys, baseAmount }) {
  const set = (k, v) => setSys((prev) => ({ ...prev, [k]: v }))
  const extra = systemAmount(sys)
  return (
    <div style={boxStyle}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Sistemi</label>
        <select
          value={sys.sistem}
          onChange={(e) => setSys(e.target.value === 'var' ? { ...emptySystem(), sistem: 'var' } : emptySystem())}
        >
          <option value="yox">Yox</option>
          <option value="var">Var</option>
        </select>
      </div>

      {sys.sistem === 'var' && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Hansı Sistem *</label>
          <select value={sys.nov} onChange={(e) => setSys({ ...emptySystem(), sistem: 'var', nov: e.target.value })}>
            <option value="">— Seçin —</option>
            <option value="menim">Mənim</option>
            <option value="diger">Digər</option>
          </select>
        </div>
      )}

      {sys.sistem === 'var' && sys.nov === 'menim' && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Sistemin məbləği (AZN) *</label>
          <input type="number" step="0.01" value={sys.mebleg} onChange={(e) => set('mebleg', e.target.value)} />
          <p style={hintStyle}>
            Saxlananda alış qiymətinin üstünə gəlir
            {extra > 0 ? ` — alış: ${baseAmount || 0} + ${extra} = ${Math.round(((baseAmount || 0) + extra) * 100) / 100} AZN` : ''}
          </p>
        </div>
      )}

      {sys.sistem === 'var' && sys.nov === 'diger' && (
        <>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Hansı Sistem *</label>
            <input value={sys.adi} onChange={(e) => set('adi', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Zamin Kim?</label>
            <input value={sys.zamin} onChange={(e) => set('zamin', e.target.value)} />
          </div>
        </>
      )}
    </div>
  )
}
