/**
 * Depo formu: "Haradan" (Təchizatçı / Müştəri) və "Sistem" (var / yox) blokları.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import SearchableSelect from '../../components/SearchableSelect'
import { MUSTERI_TABLE } from '../musteri-bazasi/constants'
import { normMusteriName } from '../../lib/musteriler'

export const NEW_PICK = '__new__'

export function emptySource() {
  return {
    tip: '', // '' | 'techizatci' | 'musteri'
    pick: '', // '' | '__new__' | 't:<id>' | 'n:<ad>' | 'm:<id>'
    yeni: {
      ad_soyad: '',
      tukan: '',
      nomre_1: '',
      nomre_2: '',
      komment: '',
      // yalnız Yeni Müştəri üçün
      sv_seriya: '',
      fin_kod: '',
      dogum_tarixi: '',
      yasayis_unvani: '',
    },
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

// Görünüş: depo-form.css (.depo-box, .depo-inline, .depo-msg)

const SUPPLIER_NEW_FIELDS = [
  { key: 'ad_soyad', label: 'Ad / Soyad / Ata adı *' },
  { key: 'tukan', label: 'Hansı Tükan' },
  { key: 'nomre_1', label: 'Əlaqə Nömrəsi 1' },
  { key: 'nomre_2', label: 'Əlaqə Nömrəsi 2' },
  { key: 'komment', label: 'Komment', type: 'textarea' },
]

const CUSTOMER_NEW_FIELDS = [
  { key: 'ad_soyad', label: 'Ad / Soyad / Ata adı *' },
  { key: 'sv_seriya', label: 'Şəxsiyyət vəsiqəsinin Nömrəsi' },
  { key: 'fin_kod', label: 'FİN kodu' },
  { key: 'dogum_tarixi', label: 'Doğum Tarixi', type: 'date' },
  { key: 'nomre_1', label: 'Telefon Nömrəsi 1' },
  { key: 'nomre_2', label: 'Telefon Nömrəsi 2' },
  { key: 'yasayis_unvani', label: 'Yaşayış Ünvanı' },
  { key: 'komment', label: 'Komment', type: 'textarea' },
]

/** Yeni Müştəri üçün musteriler cədvəlinə yazılacaq əlavə sahələr (boş olanlar yox) */
export function customerExtraFields(yeni) {
  const out = {}
  for (const k of ['sv_seriya', 'fin_kod', 'dogum_tarixi', 'yasayis_unvani', 'komment']) {
    const v = String(yeni?.[k] || '').trim()
    if (v) out[k] = v
  }
  return out
}

/**
 * @param {{ src, setSrc, suppliers: {value,label,name}[], customers: {value,label,name}[], onPickName: (name)=>void, children?: any }} p
 */
export function HaradanBlock({ src, setSrc, suppliers, customers, onPickName, children, title = 'Haradan', customerSearch = title === 'Haradan' }) {
  const isSup = src.tip === 'techizatci'
  const list = isSup ? suppliers : customers
  const choose = (pick) => {
    setSrc((prev) => ({ ...prev, pick }))
    if (pick === NEW_PICK) onPickName(src.yeni.ad_soyad || '')
    else onPickName(list.find((o) => o.value === pick)?.name || '')
  }
  const setYeni = (k, v) =>
    setSrc((prev) => {
      const next = { ...prev, yeni: { ...prev.yeni, [k]: v } }
      if (k === 'ad_soyad') onPickName(v)
      return next
    })

  return (
    <div className="depo-box">
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>{title}</label>
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

      {src.tip && !isSup && customerSearch && (
        <CustomerSearchRow src={src} customers={customers} choose={choose} />
      )}

      {src.tip && (isSup || !customerSearch) && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>{isSup ? 'Təchizatçı' : 'Müştəri'}</label>
          <div className="depo-inline">
            <select value={src.pick} onChange={(e) => choose(e.target.value)}>
              <option value="">— Seçin —</option>
              <option value={NEW_PICK}>{isSup ? '+ Yeni Təchizatçı' : '+ Yeni Müştəri'}</option>
              {list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="depo-msg depo-msg--hint">
              {isSup ? 'Siyahı Kontaktlar → Təchizatçılar bölməsindəndir' : 'Siyahı Kontaktlar → Müştərilər bölməsindəndir'}
            </p>
          </div>
        </div>
      )}

      {src.tip && src.pick === NEW_PICK && (
        <>
          {(isSup ? SUPPLIER_NEW_FIELDS : CUSTOMER_NEW_FIELDS).map((f) => (
            <div key={f.key} className="form-group" style={{ marginBottom: 0 }}>
              <label>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea rows={2} value={src.yeni[f.key] || ''} onChange={(e) => setYeni(f.key, e.target.value)} />
              ) : (
                <input
                  type={f.type === 'date' ? 'date' : 'text'}
                  value={src.yeni[f.key] || ''}
                  onChange={(e) => setYeni(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </>
      )}

      {/* Fayllar (Təchizatçı və ya Müştəri — fərq etmir) */}
      {children}
    </div>
  )
}

/**
 * Müştəri seçimi: solda kiçik «Müştəri №» (yalnız nömrə ilə tapır),
 * sağda Ad Soyad Ata adı yazıb axtarmaq + bütün müştərilərin siyahısı.
 * Müştəri № = Müştəri Bazasındakı sıra nömrəsi (sira_no).
 */
function CustomerSearchRow({ src, customers, choose }) {
  const [no, setNo] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const n = no.trim()
    if (!/^\d{1,9}$/.test(n)) {
      setMsg('')
      return
    }
    let cancelled = false
    setMsg('Axtarılır…')
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from(MUSTERI_TABLE)
        .select('musteri_id, ad_soyad')
        .eq('sira_no', Number(n))
        .limit(1)
      if (cancelled) return
      const row = data?.[0]
      if (error || !row) {
        setMsg(`№ ${n} tapılmadı`)
        return
      }
      let opt = row.musteri_id ? customers.find((o) => o.value === `m:${row.musteri_id}`) : null
      if (!opt && row.ad_soyad) {
        const k = normMusteriName(row.ad_soyad)
        opt = customers.find((o) => normMusteriName(o.name) === k)
      }
      if (!opt) {
        setMsg(`№ ${n}: ${row.ad_soyad || ''} — siyahıda tapılmadı`)
        return
      }
      setMsg('')
      choose(opt.value)
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [no, customers])

  const options = [{ value: NEW_PICK, label: '+ Yeni Müştəri' }, ...customers]

  return (
    <div className="depo-customer-search">
      <div className="form-group depo-customer-search__id">
        <label>Müştəri №</label>
        <input
          value={no}
          onChange={(e) => setNo(e.target.value.replace(/\D/g, '').slice(0, 9))}
          inputMode="numeric"
          placeholder="məs. 123"
          autoComplete="off"
        />
      </div>
      <div className="depo-customer-search__name">
        <SearchableSelect
          label="Müştəri"
          options={options}
          value={src.pick}
          onChange={(v) => {
            setNo('')
            choose(v || '')
          }}
          placeholder="Ad Soyad Ata adı yazın və ya siyahıdan seçin…"
          noResultsText="Bu adla müştəri yoxdur. «+ Yeni Müştəri» seçin."
        />
      </div>
      {msg ? <p className="depo-msg depo-msg--hint depo-customer-search__msg">{msg}</p> : null}
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
    <div className="depo-box">
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
          <div className="depo-inline">
            <input type="number" step="0.01" value={sys.mebleg} onChange={(e) => set('mebleg', e.target.value)} />
            <p className="depo-msg depo-msg--hint">
              Saxlananda alış qiymətinin üstünə gəlir
              {extra > 0 ? ` — alış: ${baseAmount || 0} + ${extra} = ${Math.round(((baseAmount || 0) + extra) * 100) / 100} AZN` : ''}
            </p>
          </div>
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
