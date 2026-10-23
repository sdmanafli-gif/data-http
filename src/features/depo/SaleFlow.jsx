import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { findOrCreateMusteri } from '../../lib/musteriler'
import MusteriSelect from '../musteri-bazasi/MusteriSelect'
import SuggestInput from '../musteri-bazasi/SuggestInput'
import MusteriSectionedFields from '../musteri-bazasi/MusteriSectionedFields'
import MusteriNotesAndFiles from '../musteri-bazasi/MusteriNotesAndFiles'
import { useColumnConfig } from '../musteri-bazasi/useColumnConfig'
import {
  MUSTERI_TABLE,
  MUSTERILER_TABLE,
  NEW_MUSTERI_VALUE,
  VEZIYYET_OPTIONS,
  personFieldsFromMusteri,
  mergePersonPrefill,
  toMusterilerPayload,
  toMusteriPayload,
  emptyMusteriForm,
  setFormField,
  formatMoney,
  applyVeziyyetFromAmounts,
  isMusteriFormColumnActive,
} from '../musteri-bazasi/constants'
import { fetchNextMusteriNumbers, fetchNextIcloudNumber, formatIcloudEmail, formatItunesEmail, parseIcloudNumber, isAutoItunesEmail } from '../musteri-bazasi/nextRecordNumbers'
import { computeIlkinOdenis, buildSaleScheduleWithIlkin, canBuildSchedule } from '../musteri-bazasi/paymentSchedule'
import { ODENISLER_TABLE, syncMusteriPaymentTotals } from '../odenisler/constants'
import SaleSchedulePreview from './SaleSchedulePreview'
import { DEPO_TABLE, SALE_TYPES } from './constants'
import {
  NAGD_TABLE,
  depoItemToNagdPayload,
  formatMoney as formatNagdMoney,
  computeXeyirFaizle,
} from '../nagd-satish/constants'
import {
  LEDGER_TABLE,
  depoItemToLedgerPayload,
  counterpartPath,
} from '../borc-nisye/constants'
import '../../styles/shared.css'
import '../../components/record-module.css'
import DepoFilterFields, { EMPTY_DEPO_FILTERS, applyDepoFilters, nextFilters } from './DepoFilterPanel'
import {
  NEW_PICK,
  emptySource,
  emptySystem,
  validateSourceAndSystem,
  customerExtraFields,
  HaradanBlock,
} from './DepoSourceFields'
import { loadTechizatcilar, findOrCreateTechizatci } from '../../lib/techizatcilar'
import { normMusteriName } from '../../lib/musteriler'
import './depo-form.css'

/** Prefill from Depo — shown read-only on kredit form */
const DEPO_READONLY_KEYS = new Set([
  'model',
  'reng',
  'yaddas',
  'imei_1',
  'imei_2',
  'serial_no',
  'model_no',
  'battery_faiz',
  'kimden_alinib',
])

/** Basket price editors own these on kredit satış */
const KREDIT_SKIP_KEYS = new Set([
  'alis_qiymeti',
  'satis_qiymeti',
  'veziyyet',
  'verilib',
  // Hidden on satış (moved out of «Digər ödəniş sahələri»)
  'gozlenilen_gelir',
  'faktiki_gelir',
  'faiz',
  // Per-device block below owns cihaz fields
  'model',
  'reng',
  'yaddas',
  'imei_1',
  'imei_2',
  'serial_no',
  'model_no',
  'battery_faiz',
  'icloud',
  'icloud_bagli_nomre',
  'itunes',
  'itunes_bagli_nomre',
  'kimden_alinib',
])

const KREDIT_OPEN_SECTIONS = new Set(['esas', 'elaqe', 'cihaz'])

/** Text/device fields joined with `/` when one credit sale has multiple products. */
const KREDIT_JOIN_TEXT_KEYS = [
  'model',
  'reng',
  'yaddas',
  'imei_1',
  'imei_2',
  'serial_no',
  'model_no',
  'kimden_alinib',
  'icloud',
  'icloud_bagli_nomre',
  'itunes',
  'itunes_bagli_nomre',
]

/**
 * Per-device cihaz fields on kredit satış.
 * `musteriKey`: linked to Müştəri Bazası column manager (null = depo-only, always shown).
 */
const CIHAZ_LINE_FIELDS = [
  { key: 'model', label: 'Model', editable: false, musteriKey: 'model' },
  { key: 'reng', label: 'Rəng', editable: false, musteriKey: 'reng' },
  { key: 'yaddas', label: 'Yaddaş', editable: false, musteriKey: 'yaddas' },
  { key: 'imei_1', label: 'IMEI 1', editable: false, musteriKey: 'imei_1' },
  { key: 'imei_2', label: 'IMEI 2', editable: false, musteriKey: 'imei_2' },
  { key: 'serial_no', label: 'Seriya No', editable: false, musteriKey: 'serial_no' },
  { key: 'model_no', label: 'Model No', editable: false, musteriKey: 'model_no' },
  { key: 'battery_faiz', label: 'Battery %', editable: false, musteriKey: 'battery_faiz' },
  { key: 'kimden_alinib', label: 'Kimdən alınıb', editable: false, musteriKey: 'kimden_alinib' },
  { key: 'icloud', label: 'iCloud', editable: true, musteriKey: 'icloud' },
  { key: 'icloud_bagli_nomre', label: 'iCloud bağlı nömrə', editable: true, musteriKey: 'icloud_bagli_nomre' },
  { key: 'itunes', label: 'iTunes', editable: true, musteriKey: 'itunes' },
  { key: 'itunes_bagli_nomre', label: 'iTunes bağlı nömrə', editable: true, musteriKey: 'itunes_bagli_nomre' },
]

function uniqueSorted(values) {
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'az')
  )
}

function depoPrefill(item) {
  if (!item) return {}
  return {
    model: item.model || '',
    reng: item.reng || '',
    yaddas: item.yaddas || '',
    imei_1: item.imei_1 || '',
    imei_2: item.imei_2 || '',
    serial_no: item.serial_no || '',
    model_no: item.model_no || '',
    battery_faiz: item.battery_faiz != null ? String(item.battery_faiz) : '',
    kimden_alinib: item.kimden_alinib || '',
  }
}

function emptyLineCihaz(item, appleIdNum = null) {
  const base = {
    ...depoPrefill(item),
    icloud: '',
    icloud_bagli_nomre: '',
    itunes: '',
    itunes_bagli_nomre: '',
  }
  if (appleIdNum != null && Number.isFinite(Number(appleIdNum))) {
    const n = Math.trunc(Number(appleIdNum))
    base.icloud = formatIcloudEmail(n)
    base.itunes = formatItunesEmail(n)
  }
  return base
}

function joinSlash(parts) {
  return (parts || []).map((p) => (p == null || p === '' ? '' : String(p).trim())).join('/')
}

/**
 * One müştəri row for the whole basket: device fields joined with `/`, money summed.
 */
function buildCombinedKreditForm({
  basket,
  linePrices,
  lineCihaz,
  musteriForm,
  paidTotal,
}) {
  const joined = {}
  for (const key of KREDIT_JOIN_TEXT_KEYS) {
    joined[key] = joinSlash(
      basket.map((item) => {
        const cihaz = lineCihaz[item.id] || emptyLineCihaz(item)
        const v = cihaz[key]
        return v == null ? '' : v
      })
    )
  }

  let alis = 0
  let satis = 0
  for (const item of basket) {
    const lp = linePrices[item.id] || {}
    alis += Number(lp.alis) || 0
    satis += Number(lp.satis) || 0
  }
  alis = Math.round(alis * 100) / 100
  satis = Math.round(satis * 100) / 100
  const paid = Math.round((Number(paidTotal) || 0) * 100) / 100

  const depoIds = basket.map((item) => item.id).filter(Boolean)
  const batteryJoined = joinSlash(
    basket.map((item) => {
      const cihaz = lineCihaz[item.id] || emptyLineCihaz(item)
      return cihaz.battery_faiz ?? ''
    })
  )
  const firstBattery = (lineCihaz[basket[0]?.id] || emptyLineCihaz(basket[0])).battery_faiz

  return {
    ...musteriForm,
    ...joined,
    // Numeric DB column — keep first device; full list in extra
    battery_faiz: firstBattery != null && firstBattery !== '' ? String(firstBattery) : '',
    alis_qiymeti: String(alis),
    satis_qiymeti: String(satis),
    verilib: String(paid),
    faiz: musteriForm.faiz === '' || musteriForm.faiz == null ? '0' : musteriForm.faiz,
    veziyyet: 'Qalıb',
    veziyyet_manual: false,
    kommentler: musteriForm.kommentler,
    senedler: musteriForm.senedler,
    extra: {
      ...(musteriForm.extra || {}),
      depo_ids: depoIds,
      line_alis: joinSlash(basket.map((item) => linePrices[item.id]?.alis ?? '')),
      line_satis: joinSlash(basket.map((item) => linePrices[item.id]?.satis ?? '')),
      line_battery_faiz: batteryJoined,
    },
  }
}

/**
 * Sale from Depo (basket):
 * 0) Review basket — add/remove items
 * 1) Choose type Kredit / Nağd / Borc·Nisyə
 * 2) Müştəri + terms → creates Müştəri Bazası / Nağd / Borc ledger + updates Depo
 */
export default function SaleFlow() {
  const { id: routeId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { columns, loading: colsLoading } = useColumnConfig()

  /** Cihaz block fields that are still active in Müştəri Bazası column settings. */
  const visibleCihazFields = useMemo(() => {
    return CIHAZ_LINE_FIELDS.filter((f) => {
      if (f.musteriKey == null) return true
      return isMusteriFormColumnActive(columns, f.musteriKey)
    }).map((f) => {
      const col = f.musteriKey ? (columns || []).find((c) => c.key === f.musteriKey) : null
      return {
        ...f,
        label: col?.label || f.label,
      }
    })
  }, [columns])

  const initialIds = useMemo(() => {
    const fromState = location.state?.ids
    if (Array.isArray(fromState) && fromState.length) return [...new Set(fromState)]
    if (routeId) return [routeId]
    return []
  }, [location.state, routeId])

  const [basket, setBasket] = useState([])
  const [linePrices, setLinePrices] = useState({}) // id → { alis, satis }
  const [lineMehsul, setLineMehsul] = useState({}) // id → mehsul label
  /** Per-basket-item cihaz fields (kredit): depo + icloud/itunes */
  const [lineCihaz, setLineCihaz] = useState({}) // id → cihaz form slice
  /** Next free smelektroN / test_appN number for newly added basket items */
  const nextIcloudSeq = useRef(1)
  const [ledgerNames, setLedgerNames] = useState([])
  const [ledgerMehsul, setLedgerMehsul] = useState([])
  const [availableExtras, setAvailableExtras] = useState([])
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [extraFilter, setExtraFilter] = useState('')
  const [extraFilters, setExtraFilters] = useState(() => ({ ...EMPTY_DEPO_FILTERS }))
  // Borc / Nisyə satış: Kimə (Təchizatçı / Müştəri) — Depodakı "Haradan" kimi
  const [kimeSrc, setKimeSrc] = useState(() => emptySource())
  const [kimeTechizatcilar, setKimeTechizatcilar] = useState([])
  const [kimeDepoNames, setKimeDepoNames] = useState([])
  const [step, setStep] = useState(0) // 0 basket, 1 type, 2 form, 3 schedule preview
  const [saleType, setSaleType] = useState('')
  /** Kredit: draft ödəniş qrafikləri before final save */
  const [scheduleDrafts, setScheduleDrafts] = useState([])
  const [customers, setCustomers] = useState([])
  const [suggestions, setSuggestions] = useState({ model: [], reng: [], yaddas: [], satici: [] })
  const [mode, setMode] = useState('pick')
  const [person, setPerson] = useState({
    musteri_id: '',
    ad_soyad: '',
    nomre_1: '',
    nomre_2: '',
    nomre_3: '',
    nomre_4: '',
    nomre_5: '',
    zamin: '',
  })
  /** Full müştəri form for kredit satış (same columns as Müştəri Bazası). */
  const [musteriForm, setMusteriForm] = useState(() => emptyMusteriForm())
  /** Sale-only down payment fields (not DB columns on their own). */
  const [ilkinOdenis, setIlkinOdenis] = useState('')
  const [ilkinOdenisVerilib, setIlkinOdenisVerilib] = useState('0')
  const [ilkinQaliqTarixi, setIlkinQaliqTarixi] = useState('')
  const [ilkinManual, setIlkinManual] = useState(false)
  const [form, setForm] = useState({
    verilib: '0',
    nece_ay: '',
    ayliq_odenis: '',
    odenis_gunu: '',
    birinci_ayliq_odenis_tarixi: '',
    verilme_tarixi: new Date().toISOString().slice(0, 10),
    bitme_tarixi: '',
    veziyyet: 'Qalıb',
    veziyyet_manual: false,
    satici: '',
    satici_faizi: '0',
    kommentler: '',
    ledger_tip: 'nisye_verdim',
    qaytarma_tarixi: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (colsLoading) return
    setMusteriForm((prev) => {
      const base = emptyMusteriForm(columns)
      return {
        ...base,
        ...prev,
        extra: { ...base.extra, ...(prev.extra || {}) },
        verilme_tarixi: prev.verilme_tarixi || new Date().toISOString().slice(0, 10),
        veziyyet: prev.veziyyet || 'Qalıb',
        senedler: Array.isArray(prev.senedler) ? prev.senedler : [],
      }
    })
  }, [colsLoading, columns])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        if (!initialIds.length) throw new Error('Satış üçün məhsul seçilməyib.')

        const [{ data: cust }, { data: items, error: e1 }, { data: ledgerRows }, { data: depoModels }, { data: musteriSuggest }, nextApple] =
          await Promise.all([
            fetchAllPages(() => supabase.from(MUSTERILER_TABLE).select('*').order('ad_soyad')),
            supabase.from(DEPO_TABLE).select('*').in('id', initialIds),
            fetchAllPages(() => supabase.from(LEDGER_TABLE).select('kime, mehsul')),
            fetchAllPages(() => supabase.from(DEPO_TABLE).select('model')),
            fetchAllPages(() => supabase.from(MUSTERI_TABLE).select('model, reng, yaddas, satici')),
            fetchNextIcloudNumber().catch(() => 1),
          ])
        if (cancelled) return
        if (e1) throw e1

        const ordered = initialIds
          .map((iid) => (items || []).find((r) => r.id === iid))
          .filter(Boolean)

        if (!ordered.length) throw new Error('Məhsullar tapılmadı.')
        const notAvailable = ordered.filter((r) => r.status !== 'available')
        if (notAvailable.length) {
          throw new Error('Seçilmiş məhsullardan bəziləri satış üçün mövcud deyil.')
        }

        const appleStart = Number(nextApple) || 1
        nextIcloudSeq.current = appleStart + ordered.length

        setBasket(ordered)
        setLinePrices(
          Object.fromEntries(
            ordered.map((r) => [
              r.id,
              {
                alis: r.alis_qiymeti != null ? String(r.alis_qiymeti) : '',
                satis: '',
              },
            ])
          )
        )
        setLineMehsul(Object.fromEntries(ordered.map((r) => [r.id, r.model || ''])))
        setLineCihaz(
          Object.fromEntries(ordered.map((r, i) => [r.id, emptyLineCihaz(r, appleStart + i)]))
        )
        setCustomers(cust || [])
        const suggestRows = musteriSuggest || []
        setSuggestions({
          model: uniqueSorted(suggestRows.map((r) => r.model)),
          reng: uniqueSorted(suggestRows.map((r) => r.reng)),
          yaddas: uniqueSorted(suggestRows.map((r) => r.yaddas)),
          satici: uniqueSorted(suggestRows.map((r) => r.satici)),
        })
        setLedgerNames(uniqueSorted((ledgerRows || []).map((r) => r.kime)))
        setLedgerMehsul(
          uniqueSorted([
            ...(ledgerRows || []).map((r) => r.mehsul),
            ...(depoModels || []).map((r) => r.model),
            ...ordered.map((r) => r.model),
          ])
        )
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initialIds])

  useEffect(() => {
    if (saleType !== 'borc_nisye' && saleType !== 'nagd') return
    let cancelled = false
    ;(async () => {
      const [tRes, dRes] = await Promise.all([
        loadTechizatcilar(),
        fetchAllPages(() => supabase.from(DEPO_TABLE).select('kimden_alinib')),
      ])
      if (cancelled) return
      setKimeTechizatcilar(tRes.data || [])
      setKimeDepoNames(uniqueSorted((dRes.data || []).map((r) => r.kimden_alinib)))
    })()
    return () => {
      cancelled = true
    }
  }, [saleType])

  const kimeSupplierOptions = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const t of kimeTechizatcilar) {
      seen.add(normMusteriName(t.ad_soyad))
      out.push({ value: `t:${t.id}`, name: t.ad_soyad, label: t.tukan ? `${t.ad_soyad} (${t.tukan})` : t.ad_soyad })
    }
    for (const n of kimeDepoNames) {
      const k = normMusteriName(n)
      if (!k || seen.has(k)) continue
      seen.add(k)
      out.push({ value: `n:${n}`, name: n, label: n })
    }
    return out.sort((x, y) => x.label.localeCompare(y.label, 'az'))
  }, [kimeTechizatcilar, kimeDepoNames])

  const kimeCustomerOptions = useMemo(
    () =>
      (customers || []).map((m) => ({
        value: `m:${m.id}`,
        name: m.ad_soyad,
        label: m.nomre_1 ? `${m.ad_soyad} · ${m.nomre_1}` : m.ad_soyad,
      })),
    [customers]
  )

  /**
   * "Kimə" blokundan (Təchizatçı / Müştəri) ad və müştəri id-ni çıxarır.
   * Yeni Təchizatçı / Yeni Müştəri seçilibsə Kontaktlara əlavə edir.
   * @returns {Promise<{ kime: string, musteriId: string|null }>}
   */
  async function resolveKimeParty() {
    const isNew = kimeSrc.pick === NEW_PICK
    const kime = String(isNew ? kimeSrc.yeni.ad_soyad : person.ad_soyad || '').trim()
    if (kimeSrc.tip === 'techizatci') {
      if (isNew) await findOrCreateTechizatci(kimeSrc.yeni)
      return { kime, musteriId: null }
    }
    if (kimeSrc.tip === 'musteri') {
      if (!isNew) {
        const mid = kimeSrc.pick.startsWith('m:') ? kimeSrc.pick.slice(2) : null
        return { kime, musteriId: mid }
      }
      const mid = await findOrCreateMusteri({
        ad_soyad: kime,
        nomre_1: kimeSrc.yeni.nomre_1.trim() || null,
        nomre_2: kimeSrc.yeni.nomre_2.trim() || null,
        updated_at: new Date().toISOString(),
      })
      const extra = customerExtraFields(kimeSrc.yeni)
      if (Object.keys(extra).length) {
        const { data: cur } = await supabase.from('musteriler').select('*').eq('id', mid).single()
        const patch = {}
        for (const [k, v] of Object.entries(extra)) {
          if (cur && !String(cur[k] ?? '').trim()) patch[k] = v
        }
        if (Object.keys(patch).length) {
          const { error: mErr } = await supabase.from('musteriler').update(patch).eq('id', mid)
          if (mErr) throw mErr
        }
      }
      return { kime, musteriId: mid }
    }
    return { kime, musteriId: null }
  }

  async function loadExtras() {
    const inBasket = new Set(basket.map((b) => b.id))
    const { data, error: e } = await fetchAllPages(() =>
      supabase
        .from(DEPO_TABLE)
        .select('*')
        .eq('status', 'available')
        .order('sira_no', { ascending: true })
    )
    if (e) {
      setError(e.message)
      return
    }
    setAvailableExtras((data || []).filter((r) => !inBasket.has(r.id)))
  }

  function openAddPicker() {
    setShowAddPicker(true)
    loadExtras()
  }

  function addToBasket(item) {
    const appleN = nextIcloudSeq.current
    nextIcloudSeq.current = appleN + 1
    setBasket((prev) => [...prev, item])
    setLinePrices((prev) => ({
      ...prev,
      [item.id]: {
        alis: item.alis_qiymeti != null ? String(item.alis_qiymeti) : '',
        satis: '',
      },
    }))
    setLineMehsul((prev) => ({ ...prev, [item.id]: item.model || '' }))
    setLineCihaz((prev) => ({ ...prev, [item.id]: emptyLineCihaz(item, appleN) }))
    if (item.model) {
      setLedgerMehsul((prev) => uniqueSorted([...prev, item.model]))
    }
    setAvailableExtras((prev) => prev.filter((r) => r.id !== item.id))
  }

  function removeFromBasket(itemId) {
    if (basket.length <= 1) {
      setError('Səbətdə ən azı 1 məhsul olmalıdır.')
      return
    }
    setBasket((prev) => prev.filter((r) => r.id !== itemId))
    setLinePrices((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
    setLineMehsul((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
    setLineCihaz((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
    setError(null)
  }

  function updateLineCihaz(itemId, key, value) {
    setLineCihaz((prev) => {
      const cur = prev[itemId] || {}
      const next = { ...cur, [key]: value }
      if (key === 'icloud') {
        const newN = parseIcloudNumber(value)
        const oldN = parseIcloudNumber(cur.icloud)
        if (newN != null && (oldN == null || isAutoItunesEmail(cur.itunes, oldN) || !cur.itunes)) {
          next.itunes = formatItunesEmail(newN)
        }
      }
      return { ...prev, [itemId]: next }
    })
  }

  const totals = useMemo(() => {
    let alis = 0
    let satis = 0
    for (const item of basket) {
      const lp = linePrices[item.id] || {}
      alis += Number(lp.alis) || 0
      satis += Number(lp.satis) || 0
    }
    const verilib = saleType === 'nagd' ? (Number(form.verilib) || satis) : Number(ilkinOdenisVerilib) || 0
    return {
      alis,
      satis,
      gozlenilen: satis - alis,
      qalan: satis - verilib,
    }
  }, [basket, linePrices, form.verilib, saleType, ilkinOdenisVerilib])

  const computedIlkin = useMemo(() => {
    const satis =
      basket.length === 1
        ? Number(musteriForm.satis_qiymeti) || totals.satis
        : totals.satis
    return computeIlkinOdenis({
      satis_qiymeti: satis,
      ayliq_odenis: musteriForm.ayliq_odenis,
      nece_ay: musteriForm.nece_ay,
    })
  }, [
    basket.length,
    musteriForm.satis_qiymeti,
    musteriForm.ayliq_odenis,
    musteriForm.nece_ay,
    totals.satis,
  ])

  useEffect(() => {
    if (ilkinManual || computedIlkin == null) return
    setIlkinOdenis(String(Math.round(computedIlkin * 100) / 100))
  }, [computedIlkin, ilkinManual])

  const ilkinRemaining = useMemo(() => {
    const due = Number(ilkinOdenis) || 0
    const paid = Number(ilkinOdenisVerilib) || 0
    return Math.max(0, Math.round((due - paid) * 100) / 100)
  }, [ilkinOdenis, ilkinOdenisVerilib])

  function selectType(type) {
    setSaleType(type)
    setStep(2)
    const totalSatis = String(totals.satis || 0)
    if (type === 'borc_nisye') {
      setMode('new')
      setForm((prev) => ({
        ...prev,
        ledger_tip: 'nisye_verdim',
        verilib: '0',
        nece_ay: '',
        ayliq_odenis: '',
        odenis_gunu: '',
        birinci_ayliq_odenis_tarixi: '',
        bitme_tarixi: '',
      }))
      return
    }
    if (type === 'nagd') {
      setForm((prev) =>
        applyVeziyyetFromAmounts({
          ...prev,
          verilib: totalSatis,
          satis_qiymeti: totalSatis,
          nece_ay: '',
          ayliq_odenis: '',
          odenis_gunu: '',
          birinci_ayliq_odenis_tarixi: '',
          bitme_tarixi: '',
          veziyyet_manual: false,
        })
      )
    } else if (type === 'kredit') {
      const first = basket[0]
      const lp = first ? linePrices[first.id] : null
      setIlkinManual(false)
      setIlkinOdenisVerilib('0')
      setIlkinQaliqTarixi('')
      setMusteriForm((prev) =>
        applyVeziyyetFromAmounts({
          ...emptyMusteriForm(columns),
          ...prev,
          ...personFieldsFromMusteri(
            mode === 'existing' && person.musteri_id
              ? { id: person.musteri_id, ...person }
              : null
          ),
          ...depoPrefill(first),
          alis_qiymeti: lp?.alis != null ? String(lp.alis) : prev.alis_qiymeti || '',
          satis_qiymeti: totalSatis,
          verilib: '0',
          faiz: '0',
          verilme_tarixi: prev.verilme_tarixi || new Date().toISOString().slice(0, 10),
          veziyyet: prev.veziyyet || 'Qalıb',
          veziyyet_manual: false,
          senedler: Array.isArray(prev.senedler) ? prev.senedler : [],
          extra: { ...(prev.extra || {}) },
        })
      )
      setForm((prev) =>
        applyVeziyyetFromAmounts({
          ...prev,
          satis_qiymeti: totalSatis,
          veziyyet_manual: false,
        })
      )
      void (async () => {
        try {
          const next = await fetchNextMusteriNumbers()
          setMusteriForm((prev) => ({
            ...prev,
            sira_no: prev.sira_no || next.sira_no,
            muqavile_nomresi: prev.muqavile_nomresi || next.muqavile_nomresi,
          }))
        } catch (_) {
          /* leave blank; DB trigger still assigns sira_no */
        }
      })()
    } else {
      setForm((prev) =>
        applyVeziyyetFromAmounts({
          ...prev,
          satis_qiymeti: totalSatis,
          veziyyet_manual: false,
        })
      )
    }
  }

  async function handleSelectExisting(customer) {
    setMode('existing')
    const { data: latest } = await supabase
      .from(MUSTERI_TABLE)
      .select('ad_soyad, nomre_1, nomre_2, nomre_3, nomre_4, nomre_5, zamin')
      .eq('musteri_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const merged = mergePersonPrefill(customer, latest)
    setPerson(merged)
    setMusteriForm((prev) => ({ ...prev, ...merged }))
  }

  function handleSelectNew() {
    setMode('new')
    const emptyPerson = personFieldsFromMusteri(null)
    setPerson(emptyPerson)
    setMusteriForm((prev) => ({ ...prev, ...emptyPerson }))
  }

  async function ensureMusteriId() {
    const source = saleType === 'kredit' ? musteriForm : person
    const payload = toMusterilerPayload(source)
    if (!payload.ad_soyad) throw new Error('Ad Soyad Ata adı doldurulmalıdır.')
    if (mode === 'existing' && source.musteri_id) {
      await supabase.from(MUSTERILER_TABLE).update(payload).eq('id', source.musteri_id)
      return source.musteri_id
    }
    // Eyni adlı müştəri varsa yenisini yaratma — satışı mövcud müştəriyə bağla
    const newId = await findOrCreateMusteri(payload)
    if (saleType === 'kredit') {
      setMusteriForm((prev) => ({ ...prev, musteri_id: newId }))
    } else {
      setPerson((prev) => ({ ...prev, musteri_id: newId }))
    }
    return newId
  }

  async function markDepoSold(item) {
    const currentQty = Math.max(1, Number(item.miqdar) || 1)
    const nextQty = currentQty - 1
    const patch = {
      miqdar: Math.max(0, nextQty),
      updated_at: new Date().toISOString(),
    }
    if (nextQty <= 0) {
      patch.status = 'sold'
      patch.sold_at = new Date().toISOString()
      patch.miqdar = 0
    }
    const { error: depoErr } = await supabase.from(DEPO_TABLE).update(patch).eq('id', item.id)
    if (depoErr) throw depoErr
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    for (const item of basket) {
      if (!linePrices[item.id]?.satis) {
        setError(`«${item.model || item.id}» üçün satış qiyməti doldurulmalıdır.`)
        return
      }
    }

    // —— Borc / Nisyə ledger sale ——
    if (saleType === 'borc_nisye') {
      const kimeErr = !kimeSrc.tip
        ? 'Kimə: Təchizatçı və ya Müştəri seçin.'
        : validateSourceAndSystem(kimeSrc, emptySystem())
      if (kimeErr) {
        setError(kimeErr)
        return
      }
      const kime = String(
        kimeSrc.tip && kimeSrc.pick === NEW_PICK ? kimeSrc.yeni.ad_soyad : person.ad_soyad || ''
      ).trim()
      if (!kime) {
        setError('Kimə: Təchizatçı və ya Müştəri seçin.')
        return
      }
      if (!form.qaytarma_tarixi) {
        setError('Nisyə / borc satışı üçün qaytarma tarixi mütləqdir.')
        return
      }
      for (const item of basket) {
        const mehsul = String(lineMehsul[item.id] ?? item.model ?? '').trim()
        if (!mehsul) {
          setError(`«${item.model || item.id}» üçün məhsul adı doldurulmalıdır.`)
          return
        }
      }
      setSaving(true)
      try {
        // Yeni Təchizatçı / Yeni Müştəri seçilibsə — Kontaktlara əlavə et
        await resolveKimeParty()
        const tip = form.ledger_tip || 'nisye_verdim'
        for (const item of basket) {
          const lp = linePrices[item.id]
          const mehsul = String(lineMehsul[item.id] ?? item.model ?? '').trim()
          const payload = depoItemToLedgerPayload(item, {
            kime,
            tip,
            tarix: form.verilme_tarixi,
            qaytarma_tarixi: form.qaytarma_tarixi || null,
            mebleg: lp.satis,
            mehsul,
            qeyd: form.kommentler || null,
          })
          const { error: ledErr } = await supabase.from(LEDGER_TABLE).insert(payload)
          if (ledErr) throw ledErr

          // Nisyə verdim: also record alış/satış/xeyir in Nağd satış (earned on sale date)
          if (tip === 'nisye_verdim') {
            const nagdPayload = depoItemToNagdPayload(item, {
              kime,
              tarix: form.verilme_tarixi,
              alis: lp.alis,
              satis: lp.satis,
              satici: form.satici,
              saticiFaizi: form.satici_faizi,
              kommentler: form.kommentler,
              satisNovu: 'nisye',
            })
            const { error: nagdErr } = await supabase.from(NAGD_TABLE).insert(nagdPayload)
            if (nagdErr) throw nagdErr
          }

          await markDepoSold(item)
        }
        navigate(counterpartPath(kime))
      } catch (err) {
        setError(err.message)
      } finally {
        setSaving(false)
      }
      return
    }

    // —— Nağd satış: Kimə (Təchizatçı / Müştəri) ——
    if (saleType === 'nagd') {
      const kimeErr = !kimeSrc.tip
        ? 'Kimə: Təchizatçı və ya Müştəri seçin.'
        : validateSourceAndSystem(kimeSrc, emptySystem())
      if (kimeErr) {
        setError(kimeErr)
        return
      }
      setSaving(true)
      try {
        const { kime, musteriId } = await resolveKimeParty()
        if (!kime) throw new Error('Kimə: Təchizatçı və ya Müştəri seçin.')
        for (const item of basket) {
          const lp = linePrices[item.id]
          const payload = depoItemToNagdPayload(item, {
            kime,
            musteriId,
            tarix: form.verilme_tarixi,
            alis: lp.alis,
            satis: lp.satis,
            satici: form.satici,
            saticiFaizi: form.satici_faizi,
            kommentler: form.kommentler,
            satisNovu: 'nagd',
          })
          const { error: nagdErr } = await supabase.from(NAGD_TABLE).insert(payload)
          if (nagdErr) throw nagdErr
          await markDepoSold(item)
        }
        navigate('/nagd-satish')
      } catch (err) {
        setError(err.message)
      } finally {
        setSaving(false)
      }
      return
    }

    if (mode === 'pick') {
      setError('Müştəri seçin və ya yeni yaradın.')
      return
    }
    if (saleType === 'kredit') {
      if (!String(musteriForm.ad_soyad || '').trim()) {
        setError('Ad Soyad Ata adı doldurulmalıdır.')
        return
      }
      if (!musteriForm.nece_ay) {
        setError('Kredit üçün «Neçə ay» doldurulmalıdır.')
        return
      }
      if (!musteriForm.birinci_ayliq_odenis_tarixi) {
        setError('Kredit üçün «Birinci aylıq ödəniş tarixi» doldurulmalıdır.')
        return
      }
      if (musteriForm.ayliq_odenis === '' || musteriForm.ayliq_odenis == null) {
        setError('Kredit üçün «Aylıq ödəniş» doldurulmalıdır.')
        return
      }
      const paidNow = Number(ilkinOdenisVerilib) || 0
      const ilkinDue = Number(ilkinOdenis) || 0
      if (paidNow < 0) {
        setError('İlkin ödəniş verilib mənfi ola bilməz.')
        return
      }
      if (ilkinDue < 0) {
        setError('İlkin ödəniş mənfi ola bilməz.')
        return
      }
      if (paidNow - ilkinDue > 0.009) {
        setError('İlkin ödəniş verilib, ilkin ödənişdən çox ola bilməz.')
        return
      }
      if (ilkinDue - paidNow > 0.009 && !ilkinQaliqTarixi) {
        setError('Qalan ilkin ödəniş üçün ödəniş tarixini daxil edin.')
        return
      }

      // One combined ödəniş qrafiki for the whole basket (single müştəri row)
      const totalSatis = totals.satis
      const itemIlkin = Number(ilkinOdenis) || 0
      const paidForItem = Number(ilkinOdenisVerilib) || 0
      const remainingForItem = Math.max(0, Math.round((itemIlkin - paidForItem) * 100) / 100)
      const verilme =
        musteriForm.verilme_tarixi || new Date().toISOString().slice(0, 10)
      const ilkinDueDate =
        remainingForItem > 0.009 ? ilkinQaliqTarixi || verilme : verilme

      const scheduleRow = {
        satis_qiymeti: Number(totalSatis) || 0,
        ayliq_odenis: Number(musteriForm.ayliq_odenis) || 0,
        nece_ay: Number(musteriForm.nece_ay) || 0,
        verilme_tarixi: verilme,
        birinci_ayliq_odenis_tarixi: musteriForm.birinci_ayliq_odenis_tarixi,
        odenis_gunu: musteriForm.odenis_gunu,
      }

      const label = basket
        .map((item) => `${item.model || 'Məhsul'} · ${item.reng || '—'} · ${item.imei_1 || '—'}`)
        .join(' / ')

      const drafts = [
        {
          itemId: 'combined',
          basketIds: basket.map((item) => item.id),
          label,
          scheduleRow,
          itemIlkin,
          ilkinDueDate,
          paidForItem,
          lines: [],
          buildLines: () => {
            if (!canBuildSchedule(scheduleRow)) return []
            return (
              buildSaleScheduleWithIlkin(scheduleRow, {
                ilkinMebleg: itemIlkin,
                ilkinTarix: ilkinDueDate,
              }) || []
            )
          },
        },
      ]
      setScheduleDrafts(drafts)
      setStep(3)
      return
    }

    setSaving(true)
    try {
      const musteriId = await ensureMusteriId()

      for (let index = 0; index < basket.length; index++) {
        const item = basket[index]
        const lp = linePrices[item.id]
        const satis = lp.satis
        const alis = lp.alis

        if (saleType === 'nagd') {
          const payload = depoItemToNagdPayload(item, {
            kime: person.ad_soyad,
            musteriId,
            tarix: form.verilme_tarixi,
            alis,
            satis,
            satici: form.satici,
            saticiFaizi: form.satici_faizi,
            kommentler: form.kommentler,
            satisNovu: 'nagd',
          })
          const { error: nagdErr } = await supabase.from(NAGD_TABLE).insert(payload)
          if (nagdErr) throw nagdErr
          await markDepoSold(item)
          continue
        }
      }

      navigate('/nagd-satish')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function finishKreditSale(approvedDrafts) {
    setSaving(true)
    setError(null)
    try {
      const musteriId = await ensureMusteriId()
      const draft =
        (approvedDrafts || []).find((d) => d.itemId === 'combined') ||
        (approvedDrafts || [])[0] ||
        null

      const paidTotal =
        draft?.paidForItem != null ? draft.paidForItem : Number(ilkinOdenisVerilib) || 0
      const itemIlkin =
        draft?.itemIlkin != null ? draft.itemIlkin : Number(ilkinOdenis) || 0

      const verilme =
        musteriForm.verilme_tarixi || new Date().toISOString().slice(0, 10)

      const saleForm = buildCombinedKreditForm({
        basket,
        linePrices,
        lineCihaz,
        musteriForm,
        paidTotal,
      })

      const payload = {
        ...toMusteriPayload(saleForm, musteriId, columns),
        depo_id: basket[0]?.id || null,
        satis_novu: saleType,
      }

      const approvedLines = draft?.lines?.length ? draft.lines : null
      if (approvedLines?.length) {
        payload.odenis_qrafiki = approvedLines
        const firstAyliq = approvedLines.find((l) => l.type === 'ayliq')
        if (firstAyliq?.tarix) {
          payload.birinci_ayliq_odenis_tarixi = firstAyliq.tarix
        }
      } else if (draft?.scheduleRow && canBuildSchedule(draft.scheduleRow)) {
        const qrafik = buildSaleScheduleWithIlkin(draft.scheduleRow, {
          ilkinMebleg: itemIlkin,
          ilkinTarix: draft.ilkinDueDate || verilme,
        })
        if (qrafik?.length) payload.odenis_qrafiki = qrafik
      } else {
        const scheduleRow = {
          satis_qiymeti: Number(saleForm.satis_qiymeti) || 0,
          ayliq_odenis: Number(saleForm.ayliq_odenis) || 0,
          nece_ay: Number(saleForm.nece_ay) || 0,
          verilme_tarixi: verilme,
          birinci_ayliq_odenis_tarixi: saleForm.birinci_ayliq_odenis_tarixi,
          odenis_gunu: saleForm.odenis_gunu,
        }
        if (canBuildSchedule(scheduleRow)) {
          const qrafik = buildSaleScheduleWithIlkin(scheduleRow, {
            ilkinMebleg: itemIlkin,
            ilkinTarix:
              Math.max(0, itemIlkin - paidTotal) > 0.009
                ? ilkinQaliqTarixi || verilme
                : verilme,
          })
          if (qrafik?.length) payload.odenis_qrafiki = qrafik
        }
      }

      const { data: inserted, error: saleErr } = await supabase
        .from(MUSTERI_TABLE)
        .insert(payload)
        .select('id, sira_no, ad_soyad')
        .single()
      if (saleErr) throw saleErr

      if (paidTotal > 0.009 && inserted?.id) {
        const { error: payErr } = await supabase.from(ODENISLER_TABLE).insert({
          musteri_bazasi_id: inserted.id,
          sira_no: inserted.sira_no ?? null,
          ad_soyad: inserted.ad_soyad || saleForm.ad_soyad,
          tip: 'ilkin',
          mebleg: paidTotal,
          tarix: verilme,
          qeyd:
            basket.length > 1
              ? `Kredit satış (${basket.length} məhsul) — ilkin ödəniş verilib`
              : 'Kredit satış — ilkin ödəniş verilib',
          updated_at: new Date().toISOString(),
        })
        if (payErr) throw payErr
        const { error: syncErr } = await syncMusteriPaymentTotals(supabase, inserted.id)
        if (syncErr) throw syncErr
      }

      for (const item of basket) {
        await markDepoSold(item)
      }

      navigate('/musteri-bazasi')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading || colsLoading) return <div className="card"><p className="empty-state">Yüklənir…</p></div>
  if (!basket.length) {
    return (
      <div className="card">
        <p style={{ color: 'var(--color-accent)' }}>{error || 'Səbət boşdur'}</p>
        <Link to="/depo" className="btn btn--secondary">Depoya qayıt</Link>
      </div>
    )
  }

  const selectValue =
    mode === 'new'
      ? NEW_MUSTERI_VALUE
      : (saleType === 'kredit' ? musteriForm.musteri_id : person.musteri_id) || ''

  const kreditPreview = {
    gozlenilen_gelir: formatMoney(
      (Number(musteriForm.satis_qiymeti) || totals.satis || 0) -
        (Number(musteriForm.alis_qiymeti) || totals.alis || 0) -
        (Number(musteriForm.satici_faizi) || 0)
    ),
    faktiki_gelir: formatMoney(
      (Number(ilkinOdenisVerilib) || 0) +
        (Number(musteriForm.faiz) || 0) -
        (Number(musteriForm.alis_qiymeti) || totals.alis || 0) -
        (Number(musteriForm.satici_faizi) || 0)
    ),
    qalan_borc: formatMoney(
      (Number(musteriForm.satis_qiymeti) || totals.satis || 0) - (Number(ilkinOdenisVerilib) || 0)
    ),
    faiz: formatMoney(Number(musteriForm.faiz) || 0),
  }

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2 className="card__title" style={{ margin: 0 }}>
          {step === 0 ? `Satış səbəti (${basket.length})` : `Satış (${basket.length} məhsul)`}
        </h2>
        <Link to="/depo" className="btn btn--secondary">Geri</Link>
      </div>

      {error && <p style={{ color: 'var(--color-accent)', marginBottom: 12 }}>{error}</p>}

      {/* Səbət xülasəsi yalnız satış növü seçiləndə; formda məhsullar aşağıda göstərilir */}
      {step === 1 && (
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--color-bg)', borderRadius: 6, fontSize: 13 }}>
          {basket.map((item) => (
            <div key={item.id}>
              {item.model || '—'} · {item.reng || '—'} · IMEI {item.imei_1 || '—'}
              {' · '}Satış: {formatMoney(linePrices[item.id]?.satis)}
            </div>
          ))}
          <button type="button" className="btn btn--secondary" style={{ marginTop: 8 }} onClick={() => setStep(0)}>
            Səbəti dəyiş
          </button>
        </div>
      )}

      {step === 0 && (
        <>
          <h3 className="card__title">Səbətdəki məhsullar</h3>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Rəng</th>
                  <th>IMEI</th>
                  <th>Miqdar</th>
                  <th>Alış</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {basket.map((item) => (
                  <tr key={item.id}>
                    <td>{item.model || '—'}</td>
                    <td>{item.reng || '—'}</td>
                    <td>{item.imei_1 || '—'}</td>
                    <td className="num">{item.miqdar ?? 1}</td>
                    <td className="num">{formatMoney(item.alis_qiymeti)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--danger"
                        disabled={basket.length <= 1}
                        onClick={() => removeFromBasket(item.id)}
                      >
                        Çıxar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <button type="button" className="btn btn--secondary" onClick={openAddPicker}>
              Əlavə məhsul əlavə et
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setShowAddPicker(false)
                setStep(1)
              }}
            >
              Davam et — satış növü
            </button>
          </div>

          {showAddPicker && (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                <h3 className="card__title" style={{ margin: 0 }}>Mövcud məhsullardan seçin</h3>
                <button type="button" className="btn btn--secondary" onClick={() => setShowAddPicker(false)}>
                  Bağla
                </button>
              </div>
              <div style={{ marginBottom: 12 }}>
                <DepoFilterFields
                  rows={availableExtras}
                  filters={extraFilters}
                  onChange={(k, v) => setExtraFilters((prev) => nextFilters(prev, k, v))}
                  onClear={() => {
                    setExtraFilters({ ...EMPTY_DEPO_FILTERS })
                    setExtraFilter('')
                  }}
                  showVeziyyet={false}
                  idPrefix="depo-extra-filters"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label htmlFor="depo-extra-filter">Axtar</label>
                <input
                  id="depo-extra-filter"
                  type="search"
                  value={extraFilter}
                  onChange={(e) => setExtraFilter(e.target.value)}
                  placeholder="Model, rəng, IMEI…"
                  autoComplete="off"
                />
              </div>
              {availableExtras.length === 0 ? (
                <p className="empty-state">Əlavə edilə biləcək məhsul yoxdur.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Kateqoriya</th>
                        <th>Növ</th>
                        <th>Model</th>
                        <th>Rəng</th>
                        <th>IMEI</th>
                        <th>Tarix</th>
                        <th>Qiymət</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {applyDepoFilters(availableExtras, extraFilters)
                        .filter((item) => {
                          const q = extraFilter.trim().toLowerCase()
                          if (!q) return true
                          const hay = `${item.model || ''} ${item.reng || ''} ${item.imei_1 || ''} ${item.imei_2 || ''}`.toLowerCase()
                          return hay.includes(q)
                        })
                        .map((item) => (
                        <tr key={item.id}>
                          <td>{item.kateqoriya || '—'}</td>
                          <td>{item.nov || '—'}</td>
                          <td>{item.model || '—'}</td>
                          <td>{item.reng || '—'}</td>
                          <td>{item.imei_1 || '—'}</td>
                          <td>{item.alis_tarixi ? String(item.alis_tarixi).slice(0, 10).split('-').reverse().join('.') : '—'}</td>
                          <td className="num">{formatMoney(item.alis_qiymeti)}</td>
                          <td>
                            <button type="button" className="btn btn--primary" onClick={() => addToBasket(item)}>
                              Səbətə əlavə et
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <h3 className="card__title">Satış növünü seçin</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {SALE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className="btn btn--secondary"
                style={{ padding: '20px 16px', fontSize: 16, fontWeight: 600 }}
                onClick={() => selectType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--color-text-muted)' }}>
            Kredit — aylıq şərtlər · Nağd — nağd satış · Borc / Nisyə — kontragent jurnalı
          </p>
        </>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit}>
          <p style={{ marginBottom: 16 }}>
            Satış növü: <strong>{SALE_TYPES.find((t) => t.value === saleType)?.label}</strong>{' '}
            <button type="button" className="btn btn--secondary" style={{ marginLeft: 8 }} onClick={() => setStep(1)}>
              Dəyiş
            </button>
          </p>

          {saleType === 'borc_nisye' ? (
            <>
              {/* Sahələr alt-alta (Depo formu kimi) */}
              <div className="depo-stack">
              <HaradanBlock
                title="Kimə"
                src={kimeSrc}
                setSrc={setKimeSrc}
                suppliers={kimeSupplierOptions}
                customers={kimeCustomerOptions}
                onPickName={(name) => setPerson((p) => ({ ...p, ad_soyad: name }))}
              />

              <div className="form-group">
                <label>Əməliyyat</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { value: 'nisye_verdim', label: 'Nisyə verdim' },
                    { value: 'borc_verdim', label: 'Borc verdim' },
                  ].map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className={`btn ${form.ledger_tip === t.value ? 'btn--primary' : 'btn--secondary'}`}
                      onClick={() => setForm((f) => ({ ...f, ledger_tip: t.value }))}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Tarix</label>
                <div className="depo-inline">
                  <input
                    type="date"
                    value={form.verilme_tarixi}
                    onChange={(e) => setForm((f) => ({ ...f, verilme_tarixi: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Qaytarma / ödəniş tarixi *</label>
                <div className="depo-inline">
                  <input
                    type="date"
                    value={form.qaytarma_tarixi || ''}
                    onChange={(e) => setForm((f) => ({ ...f, qaytarma_tarixi: e.target.value }))}
                    required
                  />
                  <p className="depo-msg depo-msg--hint">
                    Nə vaxt məbləğ alınmalı / ödənilməlidir (kalendarda görünəcək)
                  </p>
                </div>
              </div>

              <h3 className="card__title" style={{ margin: '4px 0 0' }}>Məhsul qiymətləri</h3>
              {basket.map((item) => (
                <div key={item.id} className="depo-box">
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
                    Depo: {item.model || '—'} · {item.reng || '—'} · {item.imei_1 || '—'}
                  </p>
                  <SuggestInput
                    id={`sale-borc-mehsul-${item.id}`}
                    label="Məhsul"
                    value={lineMehsul[item.id] ?? ''}
                    onChange={(v) => setLineMehsul((prev) => ({ ...prev, [item.id]: v }))}
                    options={ledgerMehsul}
                    placeholder="Mövcuddan seçin və ya yeni yazın…"
                    required
                  />
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Alış</label>
                    <div className="depo-inline">
                      <input
                        type="number"
                        step="0.01"
                        value={linePrices[item.id]?.alis ?? ''}
                        onChange={(e) =>
                          setLinePrices((prev) => ({
                            ...prev,
                            [item.id]: { ...prev[item.id], alis: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Satış (məbləğ) *</label>
                    <div className="depo-inline">
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={linePrices[item.id]?.satis ?? ''}
                        onChange={(e) =>
                          setLinePrices((prev) => ({
                            ...prev,
                            [item.id]: { ...prev[item.id], satis: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="form-group">
                <label>Qeyd</label>
                <textarea
                  rows={2}
                  value={form.kommentler}
                  onChange={(e) => setForm((f) => ({ ...f, kommentler: e.target.value }))}
                />
              </div>
              </div>

              {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <button type="button" className="btn btn--secondary" onClick={() => setStep(0)}>
                  Səbətə qayıt
                </button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saxlanılır…' : `Satışı tamamla (${basket.length})`}
                </button>
              </div>
            </>
          ) : (
            <>
          {saleType !== 'nagd' && (
            <MusteriSelect
              customers={customers}
              value={selectValue}
              onSelectExisting={handleSelectExisting}
              onSelectNew={handleSelectNew}
            />
          )}

          {(mode === 'new' || mode === 'existing') && saleType === 'kredit' && (
            <>
              <h3 className="card__title">Məhsul qiymətləri</h3>
              {basket.map((item) => (
                <div key={item.id} className="form-row" style={{ alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: '2 1 200px' }}>
                    <label>Məhsul</label>
                    <input
                      readOnly
                      value={`${item.model || '—'} · ${item.reng || '—'} · ${item.imei_1 || '—'}`}
                    />
                  </div>
                  <div className="form-group">
                    <label>Alış</label>
                    <input
                      type="number"
                      step="0.01"
                      value={linePrices[item.id]?.alis ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setLinePrices((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], alis: v },
                        }))
                        if (basket.length === 1) {
                          setMusteriForm((f) =>
                            setFormField(f, { key: 'alis_qiymeti', custom: false }, v)
                          )
                        }
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Satış *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={linePrices[item.id]?.satis ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setLinePrices((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], satis: v },
                        }))
                        if (basket.length === 1) {
                          setMusteriForm((f) =>
                            setFormField(f, { key: 'satis_qiymeti', custom: false }, v)
                          )
                        }
                      }}
                    />
                  </div>
                </div>
              ))}

              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label>İlkin ödəniş</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ilkinOdenis}
                    onChange={(e) => {
                      setIlkinManual(true)
                      setIlkinOdenis(e.target.value)
                    }}
                  />
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
                    Avtomatik: satış − (aylıq × neçə ay). Əl ilə dəyişə bilərsiniz.
                  </p>
                </div>
                <div className="form-group">
                  <label>İlkin ödəniş verilib</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ilkinOdenisVerilib}
                    onChange={(e) => setIlkinOdenisVerilib(e.target.value)}
                  />
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
                    Satışdan sonra Ödənişlər tabına əlavə olunur.
                  </p>
                </div>
                <div className="form-group">
                  <label>Ümumi gözlənilən gəlir</label>
                  <input readOnly value={formatMoney(totals.gozlenilen)} />
                </div>
                <div className="form-group">
                  <label>Ümumi satış</label>
                  <input readOnly value={formatMoney(totals.satis)} />
                </div>
              </div>

              {ilkinRemaining > 0.009 && (
                <div className="form-row" style={{ marginBottom: 12 }}>
                  <div className="form-group">
                    <label>Qalan ilkin ödəniş</label>
                    <input readOnly value={formatMoney(ilkinRemaining)} />
                  </div>
                  <div className="form-group">
                    <label>Qalan ilkin ödəniş tarixi *</label>
                    <input
                      type="date"
                      required
                      value={ilkinQaliqTarixi}
                      onChange={(e) => setIlkinQaliqTarixi(e.target.value)}
                    />
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
                      Bu məbləğ Yığım tabında bu tarixlə görünəcək.
                    </p>
                  </div>
                </div>
              )}

              {visibleCihazFields.length > 0 && (
                <>
              <h3 className="card__title">Cihaz məlumatları</h3>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                Hər səbət məhsulu üçün ayrıca saxlanılır. Sütunlar Müştəri Bazası ayarları ilə eynidir.
              </p>
              {basket.map((item, idx) => {
                const cihaz = lineCihaz[item.id] || emptyLineCihaz(item)
                return (
                  <details key={item.id} className="collapse-section" defaultOpen>
                    <summary className="collapse-section__title">
                      Cihaz {idx + 1}: {item.model || '—'} · {item.reng || '—'} · {item.imei_1 || '—'}
                    </summary>
                    <div className="form-row" style={{ paddingTop: 8 }}>
                      {visibleCihazFields.map((field) => (
                        <div className="form-group" key={field.key}>
                          <label>
                            {field.label}
                            {!field.editable ? ' (depodan)' : ''}
                          </label>
                          {field.editable ? (
                            <input
                              value={cihaz[field.key] ?? ''}
                              onChange={(e) => updateLineCihaz(item.id, field.key, e.target.value)}
                            />
                          ) : (
                            <input readOnly value={cihaz[field.key] || '—'} />
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )
              })}
                </>
              )}

              <MusteriSectionedFields
                columns={columns}
                form={musteriForm}
                onFieldChange={(col, v) => {
                  setMusteriForm((prev) => setFormField(prev, col, v))
                  if (
                    ['ad_soyad', 'nomre_1', 'nomre_2', 'nomre_3', 'nomre_4', 'nomre_5', 'zamin'].includes(
                      col.key
                    )
                  ) {
                    setPerson((p) => ({ ...p, [col.key]: v }))
                  }
                }}
                suggestions={suggestions}
                computedDisplay={kreditPreview}
                readonlyKeys={DEPO_READONLY_KEYS}
                skipKeys={KREDIT_SKIP_KEYS}
                forceOpenIds={KREDIT_OPEN_SECTIONS}
                requiredKeys={new Set(['ad_soyad', 'nece_ay', 'birinci_ayliq_odenis_tarixi'])}
              />

              <MusteriNotesAndFiles
                columns={columns}
                form={musteriForm}
                onKommentChange={(v) =>
                  setMusteriForm((prev) => setFormField(prev, { key: 'kommentler' }, v))
                }
                senedlerProps={{
                  folder: 'musteri_bazasi',
                  recordId: null,
                  value: musteriForm.senedler,
                  onChange: (files) => setMusteriForm((prev) => ({ ...prev, senedler: files })),
                }}
              />
            </>
          )}

          {saleType === 'nagd' && (
            <div className="depo-stack">
              <HaradanBlock
                title="Kimə"
                src={kimeSrc}
                setSrc={setKimeSrc}
                suppliers={kimeSupplierOptions}
                customers={kimeCustomerOptions}
                onPickName={(name) => setPerson((p) => ({ ...p, ad_soyad: name }))}
              />

              {/* Alış qiyməti Depodan avtomatik götürülür (formda göstərilmir) */}
              <h3 className="card__title" style={{ margin: '4px 0 0' }}>Məhsul qiymətləri</h3>
              {basket.map((item) => (
                <div key={item.id} className="depo-box">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Məhsul</label>
                    <div className="depo-inline">
                      <input
                        readOnly
                        value={`${item.model || '—'} · ${item.reng || '—'} · ${item.imei_1 || '—'}`}
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Satış *</label>
                    <div className="depo-inline">
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={linePrices[item.id]?.satis ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          setLinePrices((prev) => ({
                            ...prev,
                            [item.id]: { ...prev[item.id], satis: v },
                          }))
                          if (basket.length === 1) {
                            setForm((f) => ({ ...f, verilib: v }))
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}

                <div className="form-group">
                  <label>Ümumi satış</label>
                  <div className="depo-inline">
                    <input readOnly value={formatMoney(totals.satis)} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Satış tarixi</label>
                  <div className="depo-inline">
                    <input
                      type="date"
                      value={form.verilme_tarixi}
                      onChange={(e) => setForm((f) => ({ ...f, verilme_tarixi: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Satıcı</label>
                  <div className="depo-inline">
                    <input
                      value={form.satici}
                      onChange={(e) => setForm((f) => ({ ...f, satici: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Satıcı Faizi</label>
                  <div className="depo-inline">
                    <input
                      type="number"
                      step="0.01"
                      value={form.satici_faizi}
                      onChange={(e) => setForm((f) => ({ ...f, satici_faizi: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Kommentlər</label>
                  <div className="depo-inline">
                    <input
                      value={form.kommentler}
                      onChange={(e) => setForm((f) => ({ ...f, kommentler: e.target.value }))}
                    />
                  </div>
                </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || (mode === 'pick' && saleType !== 'nagd')}
            >
              {saving
                ? 'Saxlanılır…'
                : saleType === 'kredit'
                  ? `Ödəniş qrafikinə keç (${basket.length})`
                  : `Satışı tamamla (${basket.length})`}
            </button>
            <Link to="/depo" className="btn btn--secondary">Ləğv et</Link>
          </div>
            </>
          )}
        </form>
      )}

      {step === 3 && saleType === 'kredit' && (
        <>
          {error && (
            <p style={{ color: 'var(--color-accent)', marginBottom: 12 }}>{error}</p>
          )}
          <SaleSchedulePreview
            drafts={scheduleDrafts}
            onDraftsChange={setScheduleDrafts}
            onBack={() => {
              setError(null)
              setStep(2)
            }}
            onConfirm={(approved) => finishKreditSale(approved)}
            saving={saving}
          />
        </>
      )}
    </div>
  )
}
