import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { confirmDelete } from '../../lib/confirmDelete'
import { useColumnConfig } from './useColumnConfig'
import SuggestInput from '../musteri-bazasi/SuggestInput'
import RecordModule from '../../components/RecordModule'
import DepoFileSlots, { uploadPendingSlots } from './DepoFileSlots'
import DepoKateqoriyaBlock, { loadKateqoriyalar } from './DepoKateqoriya'
import MuqavileYarat from './MuqavileYarat'
import { createAlisDocx, dmy } from './muqavile'
import { parseSenedler, uploadSenedlerFiles } from '../../lib/senedler'
import {
  DEPO_TABLE,
  SUGGEST_FIELDS,
  STATUS_LABELS,
  ODENIS_NOVU_OPTIONS,
  CONDITION_OPTIONS,
  SIM_OPTIONS,
  emptyDepoForm,
  toDepoPayload,
  rowToForm,
  getFieldValue,
  setFormField,
  formatCell,
  getRowValue,
  validateDepoNisye,
  validateDepoDeviceCondition,
  getDepoMissingRequiredFields,
  syncDepoPurchaseNisyeLedger,
} from './constants'
import { LEDGER_TABLE } from '../borc-nisye/constants'
import { findOrCreateMusteri, normMusteriName } from '../../lib/musteriler'
import { loadTechizatcilar, findOrCreateTechizatci } from '../../lib/techizatcilar'
import {
  NEW_PICK,
  emptySource,
  emptySystem,
  sourceFromRow,
  systemFromRow,
  systemAmount,
  systemPayload,
  validateSourceAndSystem,
  customerExtraFields,
  HaradanBlock,
  SistemBlock,
} from './DepoSourceFields'
import '../musteri-bazasi/musteri-table.css'
import '../../styles/shared.css'
import '../../components/record-module.css'
import './depo-form.css'

/** Yaddaş üçün sabit seçimlər */
const YADDAS_OPTIONS = ['32 Gb', '64 Gb', '128 Gb', '256 Gb', '512 Gb', '1 Tb', '2 Tb']

/** Bir neçə məhsul birdən: bu sahələr bütün məhsullar üçün ortaqdır (Məhsul 1-dən götürülür) */
const SHARED_ITEM_KEYS = new Set([
  'kimden_alinib', 'alis_tarixi', 'odenis_novu', 'qaytarma_tarixi', 'nomre', 'status', 'sira_no', 'senedler', 'kommentler',
])

/** Yeni qeyddə məhsul çərçivələrindən yuxarıda (ortaq) göstərilən sahələr */
const TOP_KEYS = new Set(['kimden_alinib', 'odenis_novu', 'qaytarma_tarixi'])

/** Formda göstərilməyən sahələr (bazadakı dəyəri saxlanılır) */
const FORM_HIDDEN_KEYS = new Set(['sexsiyyet'])

/** Xananın sağında: xəta və ya izah */
function FieldMsg({ hint = null, invalid = false }) {
  if (invalid) return <p className="form-group__error depo-msg">Bu sahə mütləqdir</p>
  if (hint) return <p className="depo-msg depo-msg--hint">{hint}</p>
  return null
}

function DynamicField({
  col,
  value,
  onChange,
  suggestions,
  forceReadonly = false,
  required = false,
  hint = null,
  invalid = false,
}) {
  if (col.type === 'files') return null
  const readonly = forceReadonly || col.readonly
  const isRequired = required || col.required
  const groupClass = `form-group${invalid ? ' form-group--invalid' : ''}`

  if (readonly) {
    return (
      <div className={groupClass}>
        <label>
          {col.label}
          {forceReadonly ? ' (avtomatik)' : ' (avtomatik)'}
        </label>
        <div className="depo-inline">
          <input readOnly value={value === '' || value == null ? '—' : String(value)} />
          <FieldMsg hint={hint} />
        </div>
      </div>
    )
  }
  if (col.key === 'yaddas') {
    // Sabit siyahı; köhnə qeyddə siyahıda olmayan dəyər varsa, o da görünür (itmir)
    const cur = String(value ?? '').trim()
    const extraOpt = cur && !YADDAS_OPTIONS.includes(cur) ? cur : null
    return (
      <div className={groupClass}>
        <label>
          {col.label}
          {isRequired ? ' *' : ''}
        </label>
        <div className="depo-inline">
          <select value={cur} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid}>
            <option value="">— Seçin —</option>
            {extraOpt && <option value={extraOpt}>{extraOpt} (köhnə yazılış)</option>}
            {YADDAS_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <FieldMsg hint={hint} invalid={invalid} />
        </div>
      </div>
    )
  }
  if (SUGGEST_FIELDS.has(col.key)) {
    return (
      <div className={`${groupClass} depo-inline depo-inline--suggest`}>
        <SuggestInput
          id={`depo-${col.key}`}
          label={`${col.label}${isRequired ? ' *' : ''}`}
          value={value}
          onChange={onChange}
          options={suggestions?.[col.key] || []}
        />
        <FieldMsg hint={hint} invalid={invalid} />
      </div>
    )
  }
  if (col.type === 'select') {
    let options = col.options || []
    if (col.key === 'status') {
      options = options.map((v) => ({ value: v, label: STATUS_LABELS[v] || v }))
    } else if (col.key === 'odenis_novu') {
      options = ODENIS_NOVU_OPTIONS
    } else if (col.key === 'veziyyet_cihaz') {
      options = CONDITION_OPTIONS
    } else if (col.key === 'sim_type') {
      options = SIM_OPTIONS
    } else {
      options = options.map((v) => ({ value: v, label: v }))
    }
    return (
      <div className={groupClass}>
        <label>
          {col.label}
          {isRequired ? ' *' : ''}
        </label>
        <div className="depo-inline">
          <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={invalid}
          >
            <option value="">— Seçin —</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <FieldMsg hint={hint} invalid={invalid} />
        </div>
      </div>
    )
  }
  const inputType = col.type === 'date' ? 'date' : col.type === 'number' || col.type === 'money' ? 'number' : 'text'
  return (
    <div className={groupClass}>
      <label>
        {col.label}
        {isRequired ? ' *' : ''}
      </label>
      <div className="depo-inline">
        <input
          type={inputType}
          step={col.type === 'money' || col.type === 'number' ? '0.01' : undefined}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
        />
        <FieldMsg hint={hint} invalid={invalid} />
      </div>
    </div>
  )
}

/** Redaktə üçün: "Mənim" sistem məbləği alış qiymətindən çıxılır (saxlananda yenidən əlavə olunur) */
function formFromRow(row, columns) {
  const f = rowToForm(row, columns)
  if (row?.sistem && row.sistem_nov === 'menim' && row.sistem_mebleg != null && row.alis_qiymeti != null) {
    const base = Number(row.alis_qiymeti) - Number(row.sistem_mebleg)
    f.alis_qiymeti = String(Math.round(base * 100) / 100)
  }
  return f
}

function uniqueSorted(values) {
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'az')
  )
}

export default function DepoForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { columns, loading: colsLoading } = useColumnConfig()
  const [form, setForm] = useState(() => emptyDepoForm())
  const [record, setRecord] = useState(null)
  const [editing, setEditing] = useState(false)
  const [suggestions, setSuggestions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [pendingFiles, setPendingFiles] = useState({}) // { 1: File, 2: File, 3: File } — yeni qeyd üçün
  const [invalidKeys, setInvalidKeys] = useState(() => new Set())
  // Haradan (Təchizatçı / Müştəri) və Sistem
  const [src, setSrc] = useState(() => emptySource())
  const [sys, setSys] = useState(() => emptySystem())
  const [techizatcilar, setTechizatcilar] = useState([])
  const [musteriler, setMusteriler] = useState([])
  const [kateqoriyalar, setKateqoriyalar] = useState([])
  /** Alış müqaviləsi (Word): satıcı «Haradan» blokundan, cihaz formdan */
  const [alisVeziyyet, setAlisVeziyyet] = useState('')
  const [alisFile, setAlisFile] = useState(null)
  /** Yeni qeyd: eyni satıcıdan əlavə məhsullar (Məhsul 2, 3, …) — hər biri ayrıca depo sətri olur */
  const [extraItems, setExtraItems] = useState([])
  const [mainOpen, setMainOpen] = useState(true)

  const supplierOptions = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const t of techizatcilar) {
      seen.add(normMusteriName(t.ad_soyad))
      out.push({ value: `t:${t.id}`, name: t.ad_soyad, label: t.tukan ? `${t.ad_soyad} (${t.tukan})` : t.ad_soyad })
    }
    for (const n of suggestions.kimden_alinib || []) {
      const k = normMusteriName(n)
      if (!k || seen.has(k)) continue
      seen.add(k)
      out.push({ value: `n:${n}`, name: n, label: n })
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, 'az'))
  }, [techizatcilar, suggestions.kimden_alinib])

  const customerOptions = useMemo(
    () =>
      musteriler.map((m) => ({
        value: `m:${m.id}`,
        name: m.ad_soyad,
        label: m.nomre_1 ? `${m.ad_soyad} · ${m.nomre_1}` : m.ad_soyad,
      })),
    [musteriler]
  )

  function applyRow(row) {
    setRecord(row)
    setForm(formFromRow(row, columns))
    setSrc(sourceFromRow(row))
    setSys(systemFromRow(row))
  }

  /** Fayl siyahısını bazaya yazır (mövcud qeyd üçün) */
  async function saveSenedler(recordId, next) {
    const { error: e } = await supabase
      .from(DEPO_TABLE)
      .update({ senedler: next, updated_at: new Date().toISOString() })
      .eq('id', recordId)
    if (e) {
      setError(e.message)
      return false
    }
    setRecord((r) => (r ? { ...r, senedler: next } : r))
    setForm((f) => ({ ...f, senedler: next }))
    return true
  }

  /** Alış müqaviləsi üçün satıcının məlumatları (Haradan → Yeni / seçilmiş müştəri / təchizatçı) */
  async function alisSatici() {
    const y = src.yeni || {}
    if (src.pick === NEW_PICK) {
      return {
        ad: String(y.ad_soyad || '').trim(),
        seriya: y.sv_seriya,
        fin: y.fin_kod,
        dogum: dmy(y.dogum_tarixi),
        tel: y.nomre_1,
        qeyd: '',
        yasayis: y.yasayis_unvani,
      }
    }
    if (src.tip === 'musteri' && String(src.pick || '').startsWith('m:')) {
      const { data: m } = await supabase.from('musteriler').select('*').eq('id', src.pick.slice(2)).maybeSingle()
      return {
        ad: m?.ad_soyad || form.kimden_alinib || '',
        seriya: m?.sv_seriya,
        fin: m?.fin_kod,
        dogum: dmy(m?.dogum_tarixi),
        tel: m?.nomre_1,
        qeyd: m?.qeydiyyat_unvani,
        yasayis: m?.yasayis_unvani,
      }
    }
    return { ad: String(form.kimden_alinib || '').trim() }
  }

  async function createAlisFromForm() {
    const satici = await alisSatici()
    if (!String(satici.ad || '').trim()) throw new Error('Əvvəlcə «Haradan» bölməsində satıcını (müştəri / təchizatçı) seçin.')
    const qiymet = Number(String(form.alis_qiymeti || '').replace(',', '.')) || 0
    const now = new Date()
    const bugun = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const tarix = dmy(form.alis_tarixi) || dmy(bugun)
    return createAlisDocx({
      nomre: form.sira_no ? `A-${form.sira_no}` : '',
      tarix,
      saat: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      satici,
      mal: {
        model: [form.nov, form.model].map((t) => String(t || '').trim()).filter(Boolean).join(' '),
        reng: form.reng,
        yaddas: form.yaddas,
        imei1: form.imei_1,
        imei2: form.imei_2,
        seriya: form.serial_no,
        veziyyet: alisVeziyyet,
        qiymet,
      },
      odenisText: `Ödəniş üsulu: ${form.odenis_novu === 'nisye' ? 'nisyə (sonradan ödəniş)' : 'nağd'}. Ödəniş tarixi: ${tarix}.`,
    })
  }

  /** Yaradılmış alış müqaviləsini qeydin boş fayl yerinə yükləyir */
  async function attachAlisFile(recordId, currentSenedler) {
    const list = parseSenedler(currentSenedler)
    const used = new Set(list.map((f) => Number(f.slot)))
    const slot = [1, 2, 3].find((n) => !used.has(n))
    const { files: up, error: upErr } = await uploadSenedlerFiles('depo', recordId, [alisFile])
    if (upErr) throw new Error(upErr)
    if (!up[0]) return null
    const next = [...list, slot ? { ...up[0], slot } : up[0]]
    const { data, error: e } = await supabase
      .from(DEPO_TABLE)
      .update({ senedler: next, updated_at: new Date().toISOString() })
      .eq('id', recordId)
      .select('*')
      .single()
    if (e) throw e
    return data
  }

  function setKimden(name) {
    setForm((prev) => ({ ...prev, kimden_alinib: name }))
  }

  function addExtraItem() {
    setMainOpen(false)
    setExtraItems((prev) => [
      ...prev.map((it) => ({ ...it, open: false })),
      {
        key: `${Date.now()}-${Math.random()}`,
        open: true,
        form: { ...emptyDepoForm(columns), kateqoriya: form.kateqoriya || '', nov: form.nov || '' },
      },
    ])
  }

  function updateExtraItem(idx, fn) {
    setExtraItems((prev) => prev.map((it, i) => (i === idx ? fn(it) : it)))
  }

  function removeExtraItem(idx) {
    setExtraItems((prev) => prev.filter((_, i) => i !== idx))
  }

  /** Əlavə məhsulun tam forması: ortaq sahələr Məhsul 1-dən */
  function mergedExtraForm(itemForm) {
    const merged = { ...itemForm }
    for (const k of SHARED_ITEM_KEYS) {
      if (k === 'kommentler' || k === 'senedler' || k === 'sira_no') continue
      merged[k] = form[k]
    }
    merged.extra = { ...(itemForm.extra || {}) }
    return merged
  }

  function extraItemName(f) {
    const model = String(f.model || '').trim()
    const nov = String(f.nov || '').trim()
    if (!model) return nov || '—'
    return nov && !model.toLowerCase().includes(nov.toLowerCase()) ? `${nov} ${model}` : model
  }

  // «Nömrə» sahəsi: Haradan bölməsində seçilən müştəri / təchizatçının telefonu avtomatik yazılır.
  // Əl ilə dəyişilibsə toxunulmur (yalnız boşdursa və ya əvvəlki avtomatik dəyərdirsə yenilənir).
  const autoNomre = useRef('')
  useEffect(() => {
    let tel = ''
    if (src.pick === NEW_PICK) tel = src.yeni?.nomre_1 || ''
    else if (String(src.pick || '').startsWith('m:')) tel = musteriler.find((m) => m.id === src.pick.slice(2))?.nomre_1 || ''
    else if (String(src.pick || '').startsWith('t:')) tel = techizatcilar.find((t) => t.id === src.pick.slice(2))?.nomre_1 || ''
    tel = String(tel).trim()
    if (!tel) return
    setForm((prev) => {
      const cur = String(prev.nomre ?? '').trim()
      if (cur && cur !== autoNomre.current) return prev
      autoNomre.current = tel
      return cur === tel ? prev : { ...prev, nomre: tel }
    })
  }, [src.pick, src.yeni?.nomre_1, musteriler, techizatcilar])

  const formColumns = useMemo(() => {
    return columns
      .filter((c) => c.formVisible !== false && c.visible !== false && c.key !== 'sira_no')
      .filter((c) => !FORM_HIDDEN_KEYS.has(c.key))
      .filter((c) => {
        if (c.key === 'qaytarma_tarixi' && form.odenis_novu !== 'nisye') return false
        return true
      })
  }, [columns, form.odenis_novu])

  const viewColumns = useMemo(
    () => columns.filter((c) => c.visible !== false),
    [columns]
  )

  useEffect(() => {
    if (colsLoading) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const { data } = await fetchAllPages(() =>
          supabase.from(DEPO_TABLE).select('model, reng, yaddas, kimden_alinib, sexsiyyet')
        )
        const rows = data || []
        const [tRes, mRes, kRes] = await Promise.all([
          loadTechizatcilar(),
          fetchAllPages(() => supabase.from('musteriler').select('id, ad_soyad, nomre_1').order('ad_soyad')),
          loadKateqoriyalar(),
        ])
        if (!cancelled) {
          setTechizatcilar(tRes.data || [])
          setMusteriler(mRes.data || [])
          setKateqoriyalar(kRes.data || [])
        }
        setSuggestions({
          model: uniqueSorted(rows.map((r) => r.model)),
          reng: uniqueSorted(rows.map((r) => r.reng)),
          yaddas: uniqueSorted(rows.map((r) => r.yaddas)),
          kimden_alinib: uniqueSorted(rows.map((r) => r.kimden_alinib)),
          sexsiyyet: uniqueSorted(rows.map((r) => r.sexsiyyet)),
        })
        if (isEdit) {
          const { data: row, error: e } = await supabase.from(DEPO_TABLE).select('*').eq('id', id).single()
          if (cancelled) return
          if (e) throw e
          applyRow(row)
          setEditing(false)
        } else {
          setRecord(null)
          setForm(emptyDepoForm(columns))
          setSrc(emptySource())
          setSys(emptySystem())
          setEditing(true)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit, colsLoading])

  async function handleDelete() {
    if (!id || !record) return
    const label = record.model || (record.sira_no != null ? `#${record.sira_no}` : 'bu qeyd')
    if (!confirmDelete(`«${label}» Depodan silinsin?`)) return
    setDeleting(true)
    setError(null)
    try {
      // Remove linked «Nisyə aldım» purchase entry created from this item
      await supabase.from(LEDGER_TABLE).delete().eq('depo_id', id).eq('tip', 'nisye_aldim')
      const { error: err } = await supabase.from(DEPO_TABLE).delete().eq('id', id)
      if (err) throw err
      navigate('/depo')
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  /** Yeni qeyddə «Kimdən» görünmür — xəbərdarlıqda «Haradan» adı göstərilir */
  const missLabel = (m) => (!isEdit && m.key === 'kimden_alinib' ? 'Haradan (satıcı)' : m.label)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const missing = getDepoMissingRequiredFields(form)
    if (missing.length) {
      setMainOpen(true)
      setInvalidKeys(new Set(missing.map((m) => m.key)))
      setError(`Mütləq sahələr boşdur: ${missing.map(missLabel).join(', ')}`)
      return
    }
    setInvalidKeys(new Set())
    const conditionErr = validateDepoDeviceCondition(form)
    if (conditionErr) {
      setInvalidKeys(new Set(['veziyyet_cihaz']))
      setError(conditionErr)
      return
    }
    const nisyeErr = validateDepoNisye(form)
    if (nisyeErr) {
      setError(isEdit ? nisyeErr : nisyeErr.replace('«Kimdən»', '«Haradan» (satıcı)'))
      return
    }
    const srcErr = validateSourceAndSystem(src, sys)
    if (srcErr) {
      setError(srcErr)
      return
    }
    if (!isEdit) {
      for (let i = 0; i < extraItems.length; i++) {
        const mf = mergedExtraForm(extraItems[i].form)
        const miss = getDepoMissingRequiredFields(mf)
        const label = `Məhsul ${i + 2}`
        if (miss.length) {
          updateExtraItem(i, (it) => ({ ...it, open: true }))
          setError(`${label}: mütləq sahələr boşdur — ${miss.map(missLabel).join(', ')}`)
          return
        }
        const cErr = validateDepoDeviceCondition(mf) || validateDepoNisye(mf)
        if (cErr) {
          updateExtraItem(i, (it) => ({ ...it, open: true }))
          setError(`${label}: ${cErr}`)
          return
        }
      }
    }
    setSaving(true)
    try {
      const payload = toDepoPayload(form, columns)

      // Haradan: seçilmiş / yeni Təchizatçı və ya Müştəri
      payload.haradan_tip = src.tip || null
      payload.techizatci_id = null
      payload.musteri_id = null
      if (src.tip === 'techizatci') {
        if (src.pick === NEW_PICK) {
          payload.techizatci_id = await findOrCreateTechizatci(src.yeni)
          payload.kimden_alinib = src.yeni.ad_soyad.trim()
        } else if (src.pick.startsWith('t:')) {
          payload.techizatci_id = src.pick.slice(2)
        }
      } else if (src.tip === 'musteri') {
        if (src.pick === NEW_PICK) {
          const ad = src.yeni.ad_soyad.trim()
          payload.musteri_id = await findOrCreateMusteri({
            ad_soyad: ad,
            nomre_1: src.yeni.nomre_1.trim() || null,
            nomre_2: src.yeni.nomre_2.trim() || null,
            updated_at: new Date().toISOString(),
          })
          // Vəsiqə məlumatları, ünvan, komment — yalnız müştəridə boş olan sahələr doldurulur
          const extra = customerExtraFields(src.yeni)
          if (Object.keys(extra).length) {
            const { data: cur } = await supabase
              .from('musteriler')
              .select('*')
              .eq('id', payload.musteri_id)
              .single()
            const patch = {}
            for (const [k, v] of Object.entries(extra)) {
              if (cur && !String(cur[k] ?? '').trim()) patch[k] = v
            }
            if (Object.keys(patch).length) {
              const { error: mErr } = await supabase.from('musteriler').update(patch).eq('id', payload.musteri_id)
              if (mErr) throw mErr
            }
          }
          payload.kimden_alinib = ad
        } else if (src.pick.startsWith('m:')) {
          payload.musteri_id = src.pick.slice(2)
        }
      }

      // Sistem: "Mənim" məbləği alış qiymətinin üstünə gəlir
      Object.assign(payload, systemPayload(sys))
      const sysAmount = systemAmount(sys)
      if (sysAmount > 0) {
        payload.alis_qiymeti = Math.round(((Number(payload.alis_qiymeti) || 0) + sysAmount) * 100) / 100
      }

      let err
      let newId = id
      let savedRow = null
      if (isEdit) {
        const { data, error: uErr } = await supabase
          .from(DEPO_TABLE)
          .update(payload)
          .eq('id', id)
          .select('*')
          .single()
        err = uErr
        savedRow = data
      } else {
        const { data: created, error: insErr } = await supabase
          .from(DEPO_TABLE)
          .insert(payload)
          .select('*')
          .single()
        err = insErr
        newId = created?.id
        savedRow = created
      }
      if (err) throw err

      // Əlavə məhsullar (Məhsul 2, 3, …): eyni satıcı, tarix və ödəniş növü ilə ayrıca sətirlər
      let extraSaved = 0
      if (!isEdit && extraItems.length) {
        for (let i = 0; i < extraItems.length; i++) {
          const p = toDepoPayload(mergedExtraForm(extraItems[i].form), columns)
          delete p.sira_no
          p.haradan_tip = payload.haradan_tip
          p.techizatci_id = payload.techizatci_id
          p.musteri_id = payload.musteri_id
          p.kimden_alinib = payload.kimden_alinib
          const { data: row, error: xErr } = await supabase.from(DEPO_TABLE).insert(p).select('*').single()
          if (xErr) throw new Error(`Məhsul ${i + 2} saxlanmadı: ${xErr.message}. Məhsul 1${extraSaved ? ` və ${extraSaved} əlavə məhsul` : ''} artıq saxlanıb.`)
          extraSaved += 1
          const { error: lErr } = await syncDepoPurchaseNisyeLedger(supabase, row)
          if (lErr) throw lErr
        }
        setExtraItems([])
      }

      if (!isEdit && newId && Object.keys(pendingFiles).length > 0) {
        const { files: nextSenedler, error: upErr } = await uploadPendingSlots(
          newId,
          savedRow?.senedler,
          pendingFiles
        )
        const { data: withFiles, error: senedErr } = await supabase
          .from(DEPO_TABLE)
          .update({ senedler: nextSenedler, updated_at: new Date().toISOString() })
          .eq('id', newId)
          .select('*')
          .single()
        if (senedErr) throw senedErr
        savedRow = withFiles
        setPendingFiles({})
        if (upErr) setError(upErr)
      }

      // Alış müqaviləsi yaradılıbsa — qeydin fayl yerinə yüklə
      if (alisFile && newId) {
        try {
          const withAlis = await attachAlisFile(newId, savedRow?.senedler)
          if (withAlis) savedRow = withAlis
          setAlisFile(null)
        } catch (aErr) {
          window.alert(`Məhsul saxlandı, amma alış müqaviləsi yüklənmədi: ${aErr.message || aErr}`)
        }
      }

      if (savedRow) {
        const { error: ledErr } = await syncDepoPurchaseNisyeLedger(supabase, savedRow)
        if (ledErr) throw ledErr
      }

      if (isEdit) {
        if (savedRow) applyRow(savedRow)
        setEditing(false)
      } else if (newId && extraSaved > 0) {
        navigate('/depo')
      } else if (newId) {
        navigate(`/depo/${newId}`)
      } else {
        navigate('/depo')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading || colsLoading) {
    return <div className="card"><p className="empty-state">Yüklənir…</p></div>
  }

  if (isEdit && !editing && record) {
    const title = record.model || (record.sira_no != null ? `# ${record.sira_no}` : 'Depo qeydi')
    return (
      <>
        {error && <p style={{ color: 'var(--color-accent)', marginBottom: 12 }}>{error}</p>}
      <RecordModule
        title={title}
        subtitle={[
          record.reng,
          STATUS_LABELS[record.status] || record.status,
        ].filter(Boolean).join(' · ') || undefined}
        columns={viewColumns.filter((c) => c.key !== 'senedler' && c.key !== 'kommentler')}
        row={record}
        formatCell={formatCell}
        getRowValue={getRowValue}
        actions={
          <>
            {record.status === 'available' && (
              <Link to={`/depo/${record.id}/satish`} className="btn btn--primary">
                Satış
              </Link>
            )}
            <button type="button" className="btn btn--primary" onClick={() => setEditing(true)}>
              Redaktə
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Silinir…' : 'Sil'}
            </button>
            <Link to="/depo" className="btn btn--secondary">
              Siyahıya qayıt
            </Link>
          </>
        }
      >
        {(record.haradan_tip || record.sistem) && (
          <dl className="record-module__grid" style={{ marginTop: 16 }}>
            {record.haradan_tip && (
              <div className="record-module__field">
                <dt>Haradan</dt>
                <dd>{record.haradan_tip === 'techizatci' ? 'Təchizatçı' : 'Müştəri'}{record.kimden_alinib ? ` · ${record.kimden_alinib}` : ''}</dd>
              </div>
            )}
            {record.sistem && (
              <div className="record-module__field">
                <dt>Sistem</dt>
                <dd>
                  {record.sistem_nov === 'menim'
                    ? `Mənim · ${record.sistem_mebleg ?? 0} AZN (alış qiymətinə daxildir)`
                    : `Digər · ${record.sistem_adi || '—'}${record.sistem_zamin ? ` · Zamin: ${record.sistem_zamin}` : ''}`}
                </dd>
              </div>
            )}
          </dl>
        )}
        {record.kommentler ? (
          <div className="form-group" style={{ marginTop: 20, marginBottom: 0 }}>
            <label>Komment</label>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{record.kommentler}</p>
          </div>
        ) : null}
        <div style={{ marginTop: 16, maxWidth: 760 }}>
          <DepoFileSlots
            value={record.senedler}
            recordId={record.id}
            onChange={(next) => saveSenedler(record.id, next)}
          />
        </div>
      </RecordModule>
      </>
    )
  }

  /** Bir sahəni (sütunu) formda göstərir — Haradan / Sistem blokları daxil */
  const renderMainCol = (col) => {
            const isYeni = form.veziyyet_cihaz === 'teze'
            const isKohne = form.veziyyet_cihaz === 'kohne'
            const field = (
              <DynamicField
                key={col.key}
                col={col}
                value={getFieldValue(form, col)}
                onChange={(v) => {
                  setForm((prev) => {
                    let next = setFormField(prev, col, v)
                    if (col.key === 'veziyyet_cihaz') {
                      if (v === 'teze') {
                        next = { ...next, battery_faiz: '100' }
                      } else if (v === 'kohne' && prev.veziyyet_cihaz === 'teze') {
                        next = { ...next, battery_faiz: '' }
                      }
                    }
                    return next
                  })
                  if (v !== '' && v != null) {
                    setInvalidKeys((prev) => {
                      if (!prev.has(col.key)) return prev
                      const next = new Set(prev)
                      next.delete(col.key)
                      return next
                    })
                  }
                }}
                suggestions={suggestions}
                forceReadonly={
                  (col.key === 'battery_faiz' && isYeni) ||
                  (col.key === 'kimden_alinib' && Boolean(src.tip && src.pick))
                }
                required={
                  col.key === 'veziyyet_cihaz' ||
                  (form.odenis_novu === 'nisye' &&
                    ['kimden_alinib', 'qaytarma_tarixi', 'alis_qiymeti'].includes(col.key))
                }
                invalid={invalidKeys.has(col.key)}
                hint={
                  col.key === 'veziyyet_cihaz'
                    ? 'Yeni → battery 100%. Köhnə → battery istəyə bağlıdır.'
                    : col.key === 'battery_faiz' && isYeni
                      ? 'Yeni cihaz üçün avtomatik 100%'
                      : col.key === 'battery_faiz' && isKohne
                        ? 'Köhnə cihaz üçün battery istəyə bağlıdır'
                        : null
                }
              />
            )
            if (col.key === 'kimden_alinib') {
              return (
                <div key={col.key} className="depo-subgroup">
                  <HaradanBlock
                    src={src}
                    setSrc={setSrc}
                    suppliers={supplierOptions}
                    customers={customerOptions}
                    onPickName={setKimden}
                  >
                    <DepoFileSlots
                      value={form.senedler}
                      recordId={id || null}
                      pending={pendingFiles}
                      onPendingChange={setPendingFiles}
                      onChange={(next) => saveSenedler(id, next)}
                    />
                  </HaradanBlock>
                  {/* Yeni qeyddə «Kimdən» ayrıca göstərilmir — Haradan-da seçilən addan avtomatik yazılır */}
                  {isEdit && field}
                </div>
              )
            }
            if (col.key === 'alis_qiymeti') {
              return (
                <div key={col.key} className="depo-subgroup">
                  {field}
                  <SistemBlock
                    sys={sys}
                    setSys={setSys}
                    baseAmount={Number(String(form.alis_qiymeti || '').replace(',', '.')) || 0}
                  />
                </div>
              )
            }
            return field
  }

  return (
    <div className="card">
      <div className="record-module__header">
        <h2 className="card__title" style={{ margin: 0 }}>
          {isEdit ? 'Depo qeydini redaktə et' : 'Yeni depo qeydi'}
        </h2>
        {isEdit && (
          <div className="record-module__actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setError(null)
                if (record) applyRow(record)
                setEditing(false)
              }}
            >
              Baxışa qayıt
            </button>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} noValidate>
        {/* Yeni qeyd: Haradan və Ödəniş növü (Nağd / Nisyə) — bütün məhsullar üçün ortaq, yuxarıda */}
        {!isEdit && (
          <div className="depo-stack depo-top" style={{ marginBottom: 10 }}>
            {formColumns.filter((c) => TOP_KEYS.has(c.key)).map(renderMainCol)}
          </div>
        )}
        {/* Sahələr alt-alta (bir sütun). Yeni qeyddə Məhsul 1 də bağlanıb-açılan çərçivədədir */}
        <details
          className={isEdit ? 'depo-item depo-item--plain' : 'depo-item'}
          open={isEdit || mainOpen}
          onToggle={(e) => {
            if (isEdit) return
            const open = e.currentTarget.open
            if (open !== mainOpen) setMainOpen(open)
          }}
          style={{ maxWidth: 760 }}
        >
        <summary className="depo-item__title">
          Məhsul 1: {extraItemName(form)}
          {form.alis_qiymeti ? ` · ${form.alis_qiymeti} AZN` : ''}
        </summary>
        <div className="depo-stack depo-item__body">
          <DepoKateqoriyaBlock
            list={kateqoriyalar}
            setList={setKateqoriyalar}
            kateqoriya={form.kateqoriya || ''}
            nov={form.nov || ''}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          />
          {formColumns
            .filter((c) => c.key !== 'senedler' && c.key !== 'kommentler' && (isEdit || !TOP_KEYS.has(c.key)))
            .map(renderMainCol)}
          {!isEdit && (
            <div>
              <button type="button" className="btn btn--secondary" onClick={() => setMainOpen(false)}>
                Bağla
              </button>
            </div>
          )}
        </div>
        </details>
        {/* "Kimdən" sütunu gizlədilibsə Haradan qutusu görünmür — fayllar yenə də itməsin */}
        {!formColumns.some((c) => c.key === 'kimden_alinib') && (
          <div className="depo-box" style={{ marginTop: 8, maxWidth: 760 }}>
            <DepoFileSlots
              value={form.senedler}
              recordId={id || null}
              pending={pendingFiles}
              onPendingChange={setPendingFiles}
              onChange={(next) => saveSenedler(id, next)}
            />
          </div>
        )}
        {!isEdit && (
          <div style={{ marginTop: 8, maxWidth: 760, display: 'grid', gap: 8 }}>
            {extraItems.map((it, idx) => (
              <details
                key={it.key}
                className="depo-item"
                open={it.open}
                onToggle={(e) => {
                  const open = e.currentTarget.open
                  if (open !== it.open) updateExtraItem(idx, (x) => ({ ...x, open }))
                }}
              >
                <summary className="depo-item__title">
                  Məhsul {idx + 2}: {extraItemName(it.form)}
                  {it.form.alis_qiymeti ? ` · ${it.form.alis_qiymeti} AZN` : ''}
                </summary>
                <div className="depo-stack depo-item__body">
                  <DepoKateqoriyaBlock
                    list={kateqoriyalar}
                    setList={setKateqoriyalar}
                    kateqoriya={it.form.kateqoriya || ''}
                    nov={it.form.nov || ''}
                    onChange={(patch) => updateExtraItem(idx, (x) => ({ ...x, form: { ...x.form, ...patch } }))}
                  />
                  {formColumns
                    .filter((c) => !SHARED_ITEM_KEYS.has(c.key) && c.key !== 'kateqoriya' && c.key !== 'nov')
                    .map((col) => {
                      const f = it.form
                      const isYeni = f.veziyyet_cihaz === 'teze'
                      return (
                        <DynamicField
                          key={col.key}
                          col={col}
                          value={getFieldValue(f, col)}
                          onChange={(v) =>
                            updateExtraItem(idx, (x) => {
                              let next = setFormField(x.form, col, v)
                              if (col.key === 'veziyyet_cihaz') {
                                if (v === 'teze') next = { ...next, battery_faiz: '100' }
                                else if (v === 'kohne' && x.form.veziyyet_cihaz === 'teze') next = { ...next, battery_faiz: '' }
                              }
                              return { ...x, form: next }
                            })
                          }
                          suggestions={suggestions}
                          forceReadonly={col.key === 'battery_faiz' && isYeni}
                          required={
                            col.key === 'veziyyet_cihaz' || (form.odenis_novu === 'nisye' && col.key === 'alis_qiymeti')
                          }
                        />
                      )
                    })}
                  <div className="form-group">
                    <label>Komment</label>
                    <textarea
                      rows={2}
                      value={it.form.kommentler ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        updateExtraItem(idx, (x) => ({ ...x, form: { ...x.form, kommentler: v } }))
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn--secondary" onClick={() => updateExtraItem(idx, (x) => ({ ...x, open: false }))}>
                      Bağla
                    </button>
                    <button type="button" className="btn btn--danger" onClick={() => removeExtraItem(idx)}>
                      Bu məhsulu sil
                    </button>
                  </div>
                </div>
              </details>
            ))}
            <div>
              <button type="button" className="btn btn--primary muqavile-yarat__btn" onClick={addExtraItem}>
                + Məhsul əlavə et (eyni satıcıdan)
              </button>
              <span className="depo-msg depo-msg--hint" style={{ marginLeft: 12 }}>
                Satıcı (Haradan), ödəniş növü və tarix bütün məhsullara aiddir; hər məhsul Depoda ayrıca sətir olur.
              </span>
            </div>
          </div>
        )}
        <div className="form-group" style={{ marginTop: 12, maxWidth: 760 }}>
          <label>Komment</label>
          <textarea
            rows={3}
            value={form.kommentler ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setForm((prev) => ({ ...prev, kommentler: v }))
            }}
            placeholder="Məhsul haqqında qeyd…"
          />
        </div>
        <div className="depo-box kredit-stack" style={{ marginTop: 24, maxWidth: 760 }}>
          <div className="form-group">
            <label>Cihazın vəziyyəti və komplekti (alış müqaviləsi üçün)</label>
            <input
              value={alisVeziyyet}
              onChange={(e) => setAlisVeziyyet(e.target.value)}
              placeholder="məs. işlək, qutusu var, adapter yoxdur"
            />
          </div>
          <MuqavileYarat
            title="Alış Müqaviləsi"
            buttonLabel="MÜQAVİLƏ YARAT"
            note="Saxla basanda müqavilə bu məhsulun boş fayl yerinə yüklənəcək."
            file={alisFile}
            disabledReason={
              !String(form.model || '').trim()
                ? 'Əvvəlcə modeli yazın.'
                : !src.tip && !String(form.kimden_alinib || '').trim()
                  ? 'Əvvəlcə «Haradan» bölməsində satıcını seçin.'
                  : ''
            }
            onCreate={createAlisFromForm}
            onChange={setAlisFile}
          />
        </div>
        {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saxlanılır…' : !isEdit && extraItems.length ? `Saxla (${extraItems.length + 1} məhsul)` : 'Saxla'}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              if (isEdit) {
                if (record) applyRow(record)
                setEditing(false)
              } else {
                navigate('/depo')
              }
            }}
          >
            Ləğv et
          </button>
          {isEdit && (
            <button
              type="button"
              className="btn btn--danger"
              disabled={deleting || saving}
              onClick={handleDelete}
            >
              {deleting ? 'Silinir…' : 'Sil'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
