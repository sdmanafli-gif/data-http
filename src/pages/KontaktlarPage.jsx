import { useEffect, useId, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate } from '../lib/formatDate'
import { formatMoney } from '../features/odenisler/constants'
import { computeBalances, counterpartPath, LEDGER_TABLE } from '../features/borc-nisye/constants'
import CollapsibleSummary from '../components/CollapsibleSummary'
import {
  loadPageFilters,
  savePageFilters,
  loadLocalColumnSettings,
  saveLocalColumnSettings,
} from '../lib/uiPrefs'
import ResizableDataTable from '../features/musteri-bazasi/ResizableDataTable'
import { applyKeyOrder } from '../features/musteri-bazasi/columnOrder'
import { parseSenedler, senedlerPublicUrl, SENEDLER_BUCKET } from '../lib/senedler'
import { confirmDelete } from '../lib/confirmDelete'
import { normMusteriName, phoneKey, mergeMusteriler } from '../lib/musteriler'
import '../features/musteri-bazasi/musteri-table.css'
import '../styles/shared.css'
import '../components/record-module.css'

/**
 * Kontaktlar (test): müştərilər və təchizatçılar bir yerdə.
 * Yalnız oxuyur — bazada heç nəyi dəyişmir.
 * Təchizatçılar Depodakı "Hardan" (kimden_alinib) adlarından avtomatik yığılır.
 */

const STATUS_LABELS = {
  available: 'Mövcud',
  sold: 'Satılıb',
  reserved: 'Rezerv',
  returned: 'Qaytarılıb',
  other: 'Digər',
}

function norm(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function round2(n) {
  return Math.round(num(n) * 100) / 100
}

function phonesOf(m) {
  return [m.nomre_1, m.nomre_2, m.nomre_3, m.nomre_4, m.nomre_5]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
}

// Cədvəl sütunları — sürükləyib yerini dəyişmək və enini dəyişmək olur (brauzerdə yadda qalır)
const CUSTOMER_COLUMNS = [
  { key: 'ad_soyad', label: 'Ad Soyad', type: 'text', width: 220 },
  { key: 'telefon', label: 'Telefon', type: 'text', width: 200 },
  { key: 'zamin', label: 'Zamin', type: 'text', width: 160 },
  { key: 'saleCount', label: 'Alış sayı', type: 'number', width: 100 },
  { key: 'satis', label: 'Satış cəmi', type: 'money', width: 130 },
  { key: 'verilib', label: 'Verilib', type: 'money', width: 130 },
  { key: 'qalan', label: 'Qalan borc', type: 'money', width: 130 },
  { key: 'lastPay', label: 'Son ödəniş', type: 'date', width: 120 },
  { key: 'muqavileCount', label: 'Müqavilə', type: 'number', width: 100 },
  { key: 'senedCount', label: 'Şəxsiyyət', type: 'number', width: 100 },
  { key: 'borcNisye', label: 'Borc / Nisyə', type: 'money', width: 130 },
]

const SUPPLIER_COLUMNS = [
  { key: 'name', label: 'Təchizatçı', type: 'text', width: 220 },
  { key: 'phone', label: 'Telefon (Depodan)', type: 'text', width: 170 },
  { key: 'count', label: 'Məhsul sayı', type: 'number', width: 110 },
  { key: 'total', label: 'Alış cəmi', type: 'money', width: 140 },
  { key: 'lastDate', label: 'Son alış', type: 'date', width: 120 },
  { key: 'qaliqBorc', label: 'Qalıq borc', type: 'money', width: 130 },
  { key: 'qaliqNisye', label: 'Qalıq nisyə', type: 'money', width: 130 },
]

function useStoredColumns(tableKey, defaults) {
  const [cols, setCols] = useState(() => {
    const saved = loadLocalColumnSettings(tableKey)?.columns
    if (!Array.isArray(saved)) return defaults
    const byKey = new Map(defaults.map((c) => [c.key, c]))
    const ordered = saved
      .filter((c) => byKey.has(c.key))
      .map((c) => ({ ...byKey.get(c.key), width: typeof c.width === 'number' ? c.width : byKey.get(c.key).width }))
    const missing = defaults.filter((c) => !saved.some((x) => x.key === c.key))
    return [...ordered, ...missing]
  })
  function update(next) {
    setCols(next)
    saveLocalColumnSettings(tableKey, next.map(({ key, width }) => ({ key, width })))
  }
  return [
    cols,
    (orderedVisible) => update(applyKeyOrder(cols, orderedVisible.map((c) => c.key))),
    (key, width) => update(cols.map((c) => (c.key === key ? { ...c, width } : c))),
  ]
}

function formatKontaktCell(value, col) {
  if (value === null || value === undefined || value === '') return '—'
  if (col.type === 'money') return formatMoney(value)
  if (col.type === 'date') return formatDate(value)
  const text = String(value)
  // Uzun mətn sütunu genişlətməsin: sütun eninə sığışdır, tam mətn üstünə gələndə görünsün
  return (
    <span
      title={text}
      style={{
        display: 'block',
        maxWidth: Math.max(40, (col.width || 160) - 24),
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  )
}

// Kartda "Əlaqə" bölməsi. sexsi_nomre_1/2 və zamin_nomre bazada yeni sütunlardır —
// sütun hələ yoxdursa sahə bağlı görünür və yadda saxlananda göndərilmir.
const CONTACT_FIELDS = [
  { key: 'sexsi_nomre_1', label: 'Şəxsi Nöm 1' },
  { key: 'sexsi_nomre_2', label: 'Şəxsi Nöm 2' },
  { key: 'nomre_1', label: 'Nöm 1' },
  { key: 'nomre_2', label: 'Nöm 2' },
  { key: 'nomre_3', label: 'Nöm 3' },
  { key: 'nomre_4', label: 'Nöm 4' },
  { key: 'nomre_5', label: 'Nöm 5' },
  { key: 'zamin', label: 'Zamin' },
  { key: 'zamin_nomre', label: 'Zamin Nöm' },
]

// Şəxsiyyət vəsiqəsi məlumatları (bazada yeni sütunlar; yoxdursa sahə bağlı qalır)
const ID_FIELDS = [
  { key: 'sv_seriya', label: 'Seriya Nömrəsi' },
  { key: 'fin_kod', label: 'FİN kodu' },
  { key: 'dogum_tarixi', label: 'Doğum Tarixi', type: 'date' },
  { key: 'qeydiyyat_unvani', label: 'Qeydiyyat Ünvanı' },
  { key: 'yasayis_unvani', label: 'Yaşayış Ünvanı' },
  { key: 'sv_verilme_tarixi', label: 'Ş/V Verilmə Tarixi', type: 'date' },
  { key: 'sv_bitme_tarixi', label: 'Ş/V Bitmə Tarixi', type: 'date' },
]

const ID_FILE_SLOTS = [1, 2, 3]

// Vəsiqə faylları ayrıca MƏXFİ yaddaşda saxlanılır (açıq link yoxdur).
// Faylı yalnız sayta daxil olmuş və Kontaktlar icazəsi olan istifadəçi aça bilər —
// açanda 60 saniyəlik müvəqqəti link yaradılır.
const ID_BUCKET = 'mobideal-sexsi'

function safeName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function uploadIdFile(customerId, file) {
  const path = `musteriler/${customerId}/${Date.now()}_${safeName(file.name)}`
  const { error } = await supabase.storage.from(ID_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) return { file: null, error: `Fayl yüklənmədi: ${error.message}` }
  return { file: { name: file.name, path, size: file.size || null, bucket: ID_BUCKET }, error: null }
}

async function removeIdFile(f) {
  if (!f?.path) return null
  const bucket = f.bucket || SENEDLER_BUCKET
  const { error } = await supabase.storage.from(bucket).remove([f.path])
  return error?.message || null
}

async function openIdFile(f) {
  // pəncərəni dərhal aç (brauzer bloklamasın), linki sonra ver
  const win = window.open('', '_blank')
  const bucket = f.bucket || SENEDLER_BUCKET
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(f.path, 60)
  if (error || !data?.signedUrl) {
    win?.close()
    return error?.message || 'Fayl açılmadı'
  }
  if (win) win.location.href = data.signedUrl
  else window.location.href = data.signedUrl
  return null
}

const EDIT_FIELDS = [{ key: 'ad_soyad', label: 'Ad Soyad Ata adı' }, ...CONTACT_FIELDS, ...ID_FIELDS]

/** Faylları 1–3 yerə paylayır (yeri olmayan köhnə faylları ilk boş yerə qoyur) */
function idFilesWithSlots(value) {
  const list = parseSenedler(value).map((f) => ({ ...f }))
  const used = new Set(list.map((f) => Number(f.slot)).filter((n) => ID_FILE_SLOTS.includes(n)))
  for (const f of list) {
    if (ID_FILE_SLOTS.includes(Number(f.slot))) continue
    const free = ID_FILE_SLOTS.find((n) => !used.has(n))
    if (free === undefined) break
    f.slot = free
    used.add(free)
  }
  return list
}

/** Bir fayl yeri: boşdursa "Fayl əlavə et" (kompüterdən seç), doludursa fayl linki + Sil */
function IdFileSlot({ slot, files, customerId, enabled, onChange }) {
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const file = files.find((f) => Number(f.slot) === slot) || null

  async function onPick(e) {
    const picked = Array.from(e.target.files || []).slice(0, 1)
    e.target.value = ''
    if (!picked.length) return
    setBusy(true)
    setErr(null)
    const { file: up, error } = await uploadIdFile(customerId, picked[0])
    setBusy(false)
    if (error) setErr(error)
    if (up) {
      const rest = files.filter((f) => Number(f.slot) !== slot)
      const ok = await onChange([...rest, { ...up, slot }])
      // köhnə fayl əvəzlənibsə, yaddaşdan da sil
      if (ok && file) await removeIdFile(file)
    }
  }

  async function onRemove() {
    if (!file || !confirmDelete(`«${file.name}» silinsin?`)) return
    setBusy(true)
    setErr(null)
    const ok = await onChange(files.filter((f) => f !== file))
    if (ok) {
      const e2 = await removeIdFile(file)
      if (e2) setErr(e2)
    }
    setBusy(false)
  }

  return (
    <div className="record-module__field">
      <dt>Fayl {slot}</dt>
      <dd>
        {file ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <a
              href="#"
              style={{ wordBreak: 'break-all' }}
              onClick={async (e) => {
                e.preventDefault()
                const e3 = await openIdFile(file)
                if (e3) setErr(e3)
              }}
            >
              {file.name || 'fayl'}
            </a>
            <button
              type="button"
              className="btn btn--secondary"
              style={{ padding: '2px 8px', fontSize: 12 }}
              disabled={busy || !enabled}
              onClick={onRemove}
            >
              Sil
            </button>
          </div>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>Fayl yoxdur</span>
        )}
        <div style={{ marginTop: 8 }}>
          <input
            id={inputId}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
            disabled={!enabled || busy}
            onChange={onPick}
          />
          <label
            htmlFor={inputId}
            className="btn btn--secondary"
            style={{
              padding: '4px 10px',
              fontSize: 13,
              opacity: enabled && !busy ? 1 : 0.5,
              cursor: enabled && !busy ? 'pointer' : 'not-allowed',
            }}
            title={enabled ? 'Kompüterdən fayl seç' : 'Bazada sənəd sütunu hələ yoxdur'}
          >
            {busy ? 'Yüklənir…' : file ? 'Dəyiş' : 'Fayl əlavə et'}
          </label>
        </div>
        {err && <div style={{ color: 'var(--color-accent)', fontSize: 12, marginTop: 4 }}>{err}</div>}
      </dd>
    </div>
  )
}

function hasCol(row, key) {
  return Boolean(row) && Object.prototype.hasOwnProperty.call(row, key)
}

function Modal({ title, subtitle, onClose, children, actions = null }) {
  // Müştəri Bazasındakı kart görünüşü: ağ kart, başlıq + düymələr, içində bölmələr
  return (
    <div className="telefon-modal-overlay musteri-record-overlay" onClick={onClose} role="presentation">
      <div className="telefon-modal musteri-record-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card record-module">
          <div className="record-module__header">
            <div>
              <h2 className="card__title" style={{ margin: 0 }}>{title}</h2>
              {subtitle ? <p className="record-module__subtitle">{subtitle}</p> : null}
            </div>
            <div className="record-module__actions">
              {actions}
              <button type="button" className="btn btn--secondary" onClick={onClose}>
                Bağla
              </button>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

/** Kart xanaları: kiçik başlıq + dəyər (redaktədə dəyərin yerində input) */
function FieldGrid({ items }) {
  return (
    <dl className="record-module__grid">
      {items.map((it) => (
        <div key={it.key || it.label} className="record-module__field">
          <dt>{it.label}</dt>
          <dd style={it.color ? { color: it.color } : undefined}>
            {it.value === null || it.value === undefined || it.value === '' ? '—' : it.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function CardSection({ title, children }) {
  // Əsas Məlumatlar / Əlaqə: açılıb-bağlanan, default açıq
  return (
    <div className="record-module__sections">
      <CardDetails title={title} defaultOpen>
        {children}
      </CardDetails>
    </div>
  )
}

function CardDetails({ title, defaultOpen = false, children }) {
  return (
    <details className="collapse-section" open={defaultOpen}>
      <summary className="collapse-section__title">{title}</summary>
      <div className="collapse-section__body">{children}</div>
    </details>
  )
}

const fieldInputStyle = { width: '100%', boxSizing: 'border-box' }

function moneyColor(n) {
  if (n > 0) return '#2e7d32'
  if (n < 0) return '#c62828'
  return undefined
}

function SummaryRow({ items }) {
  return (
    <div className="musteri-summary" style={{ marginBottom: 12 }}>
      {items.map((it) => (
        <div key={it.label} className={`musteri-summary__card${it.meta ? ' musteri-summary__card--meta' : ''}`}>
          <div className="musteri-summary__label">{it.label}</div>
          <div className="musteri-summary__value">{it.value}</div>
        </div>
      ))}
    </div>
  )
}

export default function KontaktlarPage() {
  const { access, isAdmin } = useAuth()
  const canView = access.canAccessModule('kontaktlar')
  const canEditCard = canView && access.canEdit('kontaktlar')
  const [saved] = useState(() => loadPageFilters('kontaktlar', {}) || {})
  const [tab, setTab] = useState(saved.tab === 'techizatci' ? 'techizatci' : 'musteri')
  const [search, setSearch] = useState(saved.search || '')
  const [onlyDebt, setOnlyDebt] = useState(Boolean(saved.onlyDebt))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState({ musteriler: [], satislar: [], odenisler: [], ledger: [], depo: [] })
  const [openCustomerId, setOpenCustomerId] = useState(null)
  const [openSupplier, setOpenSupplier] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState(null)
  // Təkrarlar / Birləşdir (yalnız admin)
  const [dupOnly, setDupOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeTarget, setMergeTarget] = useState(null)
  const [merging, setMerging] = useState(false)
  const [mergeError, setMergeError] = useState(null)
  const [mergeNote, setMergeNote] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [custCols, reorderCustCols, resizeCustCols] = useStoredColumns('kontaktlar_musteri', CUSTOMER_COLUMNS)
  const [supCols, reorderSupCols, resizeSupCols] = useStoredColumns('kontaktlar_techizatci', SUPPLIER_COLUMNS)

  useEffect(() => {
    savePageFilters('kontaktlar', { tab, search, onlyDebt })
  }, [tab, search, onlyDebt])

  useEffect(() => {
    if (!canView) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [m, s, o, l, d] = await Promise.all([
          fetchAllPages(() =>
            supabase
              .from('musteriler')
              .select('*')
              .order('ad_soyad', { ascending: true })
          ),
          fetchAllPages(() =>
            supabase
              .from('musteri_bazasi')
              .select('id, musteri_id, sira_no, ad_soyad, model, alis_qiymeti, satis_qiymeti, verilib, faiz, qalan_borc, veziyyet, verilme_tarixi, senedler')
              .order('sira_no', { ascending: true })
          ),
          fetchAllPages(() =>
            supabase.from('odenisler').select('id, musteri_bazasi_id, mebleg, tarix, tip').order('id', { ascending: true })
          ),
          fetchAllPages(() => supabase.from(LEDGER_TABLE).select('kime, tip, mebleg')),
          fetchAllPages(() =>
            supabase
              .from('depo')
              .select('id, sira_no, kimden_alinib, nomre, model, reng, yaddas, imei_1, alis_qiymeti, alis_tarixi, miqdar, status')
              .order('id', { ascending: true })
          ),
        ])
        const err = m.error || s.error || o.error || l.error || d.error
        if (err) throw err
        if (cancelled) return
        setData({
          musteriler: m.data || [],
          satislar: s.data || [],
          odenisler: o.data || [],
          ledger: l.data || [],
          depo: d.data || [],
        })
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canView, reloadKey])

  // Borc / Nisyə qalıqları ada görə
  const ledgerByName = useMemo(() => {
    const map = new Map()
    for (const b of computeBalances(data.ledger)) map.set(norm(b.kime), b)
    return map
  }, [data.ledger])

  const customers = useMemo(() => {
    const salesByCustomer = new Map()
    const saleToCustomer = new Map()
    for (const s of data.satislar) {
      if (!s.musteri_id) continue
      saleToCustomer.set(s.id, s.musteri_id)
      if (!salesByCustomer.has(s.musteri_id)) salesByCustomer.set(s.musteri_id, [])
      salesByCustomer.get(s.musteri_id).push(s)
    }
    const lastPay = new Map()
    for (const p of data.odenisler) {
      const cid = saleToCustomer.get(p.musteri_bazasi_id)
      if (!cid || !p.tarix) continue
      if (!lastPay.has(cid) || p.tarix > lastPay.get(cid)) lastPay.set(cid, p.tarix)
    }
    return data.musteriler.map((m) => {
      const sales = salesByCustomer.get(m.id) || []
      const led = ledgerByName.get(norm(m.ad_soyad))
      // Müqavilələr: hər satışa (Müştəri Bazasında) əlavə olunan sənədlər avtomatik bura düşür
      const contracts = sales
        .map((s) => ({ sale: s, files: parseSenedler(s.senedler) }))
        .filter((c) => c.files.length > 0)
      const phones = phonesOf(m)
      return {
        ...m,
        phones,
        telefon: phones.join(', '),
        contracts,
        muqavileCount: contracts.length,
        hasSenedColumn: Object.prototype.hasOwnProperty.call(m, 'senedler'),
        senedCount: parseSenedler(m.senedler).length,
        borcNisye: led ? round2(led.qaliq_borc + led.qaliq_nisye) : null,
        sales,
        saleCount: sales.length,
        alis: round2(sales.reduce((a, s) => a + num(s.alis_qiymeti), 0)),
        satis: round2(sales.reduce((a, s) => a + num(s.satis_qiymeti), 0)),
        verilib: round2(sales.reduce((a, s) => a + num(s.verilib), 0)),
        qalan: round2(sales.reduce((a, s) => a + num(s.qalan_borc), 0)),
        // Müştəri Bazasındakı kimi: Mənfəət = Verilib + Faiz − Alış qiyməti
        menfeet: round2(
          sales.reduce((a, s) => a + num(s.verilib) + num(s.faiz) - num(s.alis_qiymeti), 0)
        ),
        lastPay: lastPay.get(m.id) || null,
        ledger: led || null,
      }
    })
  }, [data.musteriler, data.satislar, data.odenisler, ledgerByName])

  const suppliers = useMemo(() => {
    const map = new Map()
    for (const d of data.depo) {
      const name = String(d.kimden_alinib || '').trim().replace(/\s+/g, ' ')
      if (!name) continue
      const key = norm(name)
      if (!map.has(key)) map.set(key, { key, name, items: [], phone: '', lastDate: null, total: 0 })
      const g = map.get(key)
      g.items.push(d)
      const qty = Math.max(1, num(d.miqdar) || 1)
      g.total += num(d.alis_qiymeti) * qty
      if (d.alis_tarixi && (!g.lastDate || d.alis_tarixi > g.lastDate)) {
        g.lastDate = d.alis_tarixi
        if (String(d.nomre || '').trim()) g.phone = String(d.nomre).trim()
      }
      if (!g.phone && String(d.nomre || '').trim()) g.phone = String(d.nomre).trim()
    }
    return [...map.values()]
      .map((g) => {
        const ledger = ledgerByName.get(g.key) || null
        return {
          ...g,
          id: g.key,
          total: round2(g.total),
          count: g.items.length,
          ledger,
          qaliqBorc: ledger ? ledger.qaliq_borc : null,
          qaliqNisye: ledger ? ledger.qaliq_nisye : null,
        }
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'az'))
  }, [data.depo, ledgerByName])

  const q = norm(search)

  // Ehtimal olunan təkrarlar: adı eyni (yazılış fərqi nəzərə alınmır) və ya eyni telefon
  const dupIds = useMemo(() => {
    const byName = new Map()
    const byPhone = new Map()
    for (const c of customers) {
      const n = normMusteriName(c.ad_soyad)
      if (n) byName.set(n, [...(byName.get(n) || []), c.id])
      for (const ph of new Set(c.phones.map(phoneKey).filter(Boolean))) {
        byPhone.set(ph, [...(byPhone.get(ph) || []), c.id])
      }
    }
    const out = new Set()
    for (const ids of [...byName.values(), ...byPhone.values()]) {
      if (ids.length > 1) ids.forEach((id) => out.add(id))
    }
    return out
  }, [customers])

  const shownCustomers = useMemo(() => {
    const list = customers.filter((c) => {
      if (dupOnly && !dupIds.has(c.id)) return false
      if (onlyDebt && c.qalan <= 0) return false
      if (!q) return true
      return [c.ad_soyad, c.zamin, ...c.phones].some((v) => norm(v).includes(q))
    })
    if (dupOnly) {
      list.sort((a, b) => normMusteriName(a.ad_soyad).localeCompare(normMusteriName(b.ad_soyad), 'az'))
    }
    return list
  }, [customers, q, onlyDebt, dupOnly, dupIds])

  const selectedCustomers = customers.filter((c) => selectedIds.has(c.id))

  function toggleSelect(row) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(row.id)) next.delete(row.id)
      else next.add(row.id)
      return next
    })
  }

  function openMerge() {
    if (selectedCustomers.length < 2) return
    // Default əsas: alışı ən çox olan
    const best = [...selectedCustomers].sort((a, b) => b.saleCount - a.saleCount)[0]
    setMergeTarget(best.id)
    setMergeError(null)
    setMergeOpen(true)
  }

  async function runMerge() {
    if (!mergeTarget) return
    const others = selectedCustomers.map((c) => c.id).filter((id) => id !== mergeTarget)
    setMerging(true)
    setMergeError(null)
    try {
      await mergeMusteriler(mergeTarget, others)
      const t = customers.find((c) => c.id === mergeTarget)
      setMergeNote(`${others.length + 1} müştəri «${t?.ad_soyad || ''}» adı altında birləşdirildi.`)
      setMergeOpen(false)
      setSelectedIds(new Set())
      setReloadKey((k) => k + 1)
    } catch (e) {
      setMergeError(e.message || String(e))
    } finally {
      setMerging(false)
    }
  }

  const shownSuppliers = useMemo(
    () =>
      suppliers.filter((s) => {
        if (onlyDebt && !(s.ledger && (s.ledger.qaliq_borc !== 0 || s.ledger.qaliq_nisye !== 0))) return false
        if (!q) return true
        return [s.name, s.phone].some((v) => norm(v).includes(q))
      }),
    [suppliers, q, onlyDebt]
  )

  const openCustomer = openCustomerId ? customers.find((c) => c.id === openCustomerId) || null : null

  function openCustomerCard(c) {
    setOpenCustomerId(c.id)
    setEditing(false)
    setModalError(null)
  }

  function startEdit() {
    if (!openCustomer) return
    setEditForm(Object.fromEntries(EDIT_FIELDS.map((f) => [f.key, openCustomer[f.key] || ''])))
    setModalError(null)
    setEditing(true)
  }

  function patchCustomer(id, patch) {
    setData((d) => ({
      ...d,
      musteriler: d.musteriler.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }))
  }

  async function saveEdit() {
    if (!openCustomer) return
    const ad = String(editForm.ad_soyad || '').trim()
    if (!ad) {
      setModalError('Ad Soyad boş ola bilməz.')
      return
    }
    const patch = Object.fromEntries(
      EDIT_FIELDS.filter((f) => hasCol(openCustomer, f.key)).map((f) => [
        f.key,
        String(editForm[f.key] || '').trim() || null,
      ])
    )
    patch.ad_soyad = ad
    setSaving(true)
    setModalError(null)
    const { error: e } = await supabase
      .from('musteriler')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', openCustomer.id)
    setSaving(false)
    if (e) {
      setModalError(e.message)
      return
    }
    patchCustomer(openCustomer.id, patch)
    setEditing(false)
  }

  async function saveIdFiles(next) {
    if (!openCustomer) return
    const { error: e } = await supabase
      .from('musteriler')
      .update({ senedler: next, updated_at: new Date().toISOString() })
      .eq('id', openCustomer.id)
    if (e) {
      setModalError(e.message)
      return false
    }
    patchCustomer(openCustomer.id, { senedler: next })
    return true
  }

  if (!canView) return <Navigate to="/" replace />

  const custTotals = {
    count: shownCustomers.length,
    satis: round2(shownCustomers.reduce((a, c) => a + c.satis, 0)),
    verilib: round2(shownCustomers.reduce((a, c) => a + c.verilib, 0)),
    qalan: round2(shownCustomers.reduce((a, c) => a + c.qalan, 0)),
  }
  const supTotals = {
    count: shownSuppliers.length,
    items: shownSuppliers.reduce((a, s) => a + s.count, 0),
    total: round2(shownSuppliers.reduce((a, s) => a + s.total, 0)),
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Kontaktlar</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            Müştərilər və təchizatçılar (test). Təchizatçılar Depodakı "Hardan" adlarından avtomatik yığılır.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          { id: 'musteri', label: `Müştərilər (${customers.length})` },
          { id: 'techizatci', label: `Təchizatçılar (${suppliers.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn ${tab === t.id ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <CollapsibleSummary title="Axtarış / Filtr" storageKey="summary:kontaktlar-filter" defaultOpen>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 260px', maxWidth: 380 }}>
            <label>Axtarış</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'musteri' ? 'Ad, telefon, zamin…' : 'Təchizatçı adı, telefon…'}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 4 }}>
            <input type="checkbox" checked={onlyDebt} onChange={(e) => setOnlyDebt(e.target.checked)} />
            {tab === 'musteri' ? 'Yalnız borcu olanlar' : 'Yalnız Borc / Nisyə qalığı olanlar'}
          </label>
          {tab === 'musteri' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 4 }}>
              <input type="checkbox" checked={dupOnly} onChange={(e) => setDupOnly(e.target.checked)} />
              Yalnız təkrarlar (eyni ad və ya nömrə) — {dupIds.size}
            </label>
          )}
        </div>
      </CollapsibleSummary>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      {!loading && tab === 'musteri' && (
        <CollapsibleSummary title="Cəmlər" storageKey="summary:kontaktlar-musteri">
          <SummaryRow
            items={[
              { label: 'Müştəri', value: custTotals.count, meta: true },
              { label: 'Satış cəmi', value: formatMoney(custTotals.satis) },
              { label: 'Verilib', value: formatMoney(custTotals.verilib) },
              { label: 'Qalan borc', value: formatMoney(custTotals.qalan) },
            ]}
          />
        </CollapsibleSummary>
      )}
      {!loading && tab === 'techizatci' && (
        <CollapsibleSummary title="Cəmlər" storageKey="summary:kontaktlar-techizatci">
          <SummaryRow
            items={[
              { label: 'Təchizatçı', value: supTotals.count, meta: true },
              { label: 'Alınan məhsul (sətir)', value: supTotals.items, meta: true },
              { label: 'Alış cəmi', value: formatMoney(supTotals.total) },
            ]}
          />
        </CollapsibleSummary>
      )}

      {mergeNote && (
        <p style={{ color: '#2e7d32', fontWeight: 600 }}>
          {mergeNote}{' '}
          <button type="button" className="btn btn--secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setMergeNote(null)}>
            OK
          </button>
        </p>
      )}

      {isAdmin && tab === 'musteri' && !loading && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <button
            type="button"
            className="btn btn--primary"
            disabled={selectedCustomers.length < 2}
            onClick={openMerge}
            title="Eyni adamın təkrar qeydlərini işarələ və birləşdir"
          >
            Birləşdir ({selectedCustomers.length})
          </button>
          {selectedCustomers.length > 0 && (
            <button type="button" className="btn btn--secondary" onClick={() => setSelectedIds(new Set())}>
              Seçimi təmizlə
            </button>
          )}
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Eyni müştərinin sətirlərini soldakı xanadan işarələ, sonra «Birləşdir» bas.
          </span>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p className="empty-state">Yüklənir…</p>
        ) : tab === 'musteri' ? (
          <ResizableDataTable
            columns={custCols}
            rows={shownCustomers}
            formatCell={formatKontaktCell}
            onReorderColumns={reorderCustCols}
            onResizeColumn={resizeCustCols}
            onRowOpen={openCustomerCard}
            selection={isAdmin ? { selectedIds, onToggle: toggleSelect } : undefined}
            emptyText="Müştəri tapılmadı."
            prefsKey="kontaktlar_musteri"
          />
        ) : (
          <ResizableDataTable
            columns={supCols}
            rows={shownSuppliers}
            formatCell={formatKontaktCell}
            onReorderColumns={reorderSupCols}
            onResizeColumn={resizeSupCols}
            onRowOpen={(row) => setOpenSupplier(row)}
            emptyText="Təchizatçı tapılmadı."
            prefsKey="kontaktlar_techizatci"
          />
        )}
      </div>

      {openCustomer && (
        <Modal
          title={openCustomer.ad_soyad}
          subtitle={[
            openCustomer.phones[0] || '',
            `Alış sayı: ${openCustomer.saleCount}`,
            openCustomer.zamin ? `Zamin: ${openCustomer.zamin}` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
          onClose={() => setOpenCustomerId(null)}
          actions={
            editing ? (
              <>
                <button type="button" className="btn btn--primary" disabled={saving} onClick={saveEdit}>
                  {saving ? 'Saxlanılır…' : 'Yadda saxla'}
                </button>
                <button type="button" className="btn btn--secondary" disabled={saving} onClick={() => setEditing(false)}>
                  Ləğv et
                </button>
              </>
            ) : canEditCard ? (
              <button type="button" className="btn btn--primary" onClick={startEdit}>
                Redaktə
              </button>
            ) : null
          }
        >
          {modalError && <p style={{ color: 'var(--color-accent)' }}>{modalError}</p>}

          <CardSection title="Əsas Məlumatlar">
            <FieldGrid
              items={[
                {
                  key: 'ad_soyad',
                  label: 'Ad Soyad Ata adı',
                  value: editing ? (
                    <input
                      style={fieldInputStyle}
                      value={editForm.ad_soyad ?? ''}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, ad_soyad: e.target.value }))}
                    />
                  ) : (
                    openCustomer.ad_soyad
                  ),
                },
                { label: 'Alış Sayı', value: openCustomer.saleCount },
                { label: 'Alış Qiyməti', value: formatMoney(openCustomer.alis) },
                { label: 'Satış Qiyməti', value: formatMoney(openCustomer.satis) },
                { label: 'Verilib', value: formatMoney(openCustomer.verilib), color: moneyColor(openCustomer.verilib) },
                { label: 'Qalan Borc', value: formatMoney(openCustomer.qalan), color: openCustomer.qalan > 0 ? moneyColor(-1) : undefined },
                { label: 'Mənfəət', value: formatMoney(openCustomer.menfeet), color: moneyColor(openCustomer.menfeet) },
              ]}
            />
          </CardSection>

          <CardSection title="Əlaqə">
            <FieldGrid
              items={CONTACT_FIELDS.map((f) => {
                const exists = hasCol(openCustomer, f.key)
                return {
                  key: f.key,
                  label: f.label,
                  value: editing ? (
                    <input
                      style={fieldInputStyle}
                      value={editForm[f.key] ?? ''}
                      disabled={!exists}
                      placeholder={exists ? '' : 'Bazada sütun hələ yoxdur'}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  ) : (
                    openCustomer[f.key]
                  ),
                }
              })}
            />
          </CardSection>

          <div className="record-module__sections">
            <CardDetails title="Şəxsiyyət vəsiqəsi" defaultOpen>
              <FieldGrid
                items={ID_FIELDS.map((f) => {
                  const exists = hasCol(openCustomer, f.key)
                  const raw = openCustomer[f.key]
                  return {
                    key: f.key,
                    label: f.label,
                    value: editing ? (
                      <input
                        type={f.type === 'date' ? 'date' : 'text'}
                        style={fieldInputStyle}
                        value={editForm[f.key] ?? ''}
                        disabled={!exists}
                        placeholder={exists ? '' : 'Bazada sütun hələ yoxdur'}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      />
                    ) : f.type === 'date' && raw ? (
                      formatDate(raw)
                    ) : (
                      raw
                    ),
                  }
                })}
              />
              <h3 className="record-module__section-title" style={{ marginTop: 16 }}>
                Şəxsiyyət vəsiqəsi faylları
              </h3>
              <dl className="record-module__grid">
                {ID_FILE_SLOTS.map((slot) => (
                  <IdFileSlot
                    key={slot}
                    slot={slot}
                    files={idFilesWithSlots(openCustomer.senedler)}
                    customerId={openCustomer.id}
                    enabled={openCustomer.hasSenedColumn && canEditCard}
                    onChange={saveIdFiles}
                  />
                ))}
              </dl>
              {!openCustomer.hasSenedColumn && (
                <p className="empty-state" style={{ margin: '8px 0 0' }}>
                  Fayl yükləmək üçün bazada müştərilər cədvəlinə sənəd sütunu əlavə olunmalıdır.
                </p>
              )}
            </CardDetails>

            <CardDetails title={`Müqavilələr (${openCustomer.contracts.length})`} defaultOpen>
              {openCustomer.contracts.length === 0 ? (
                <p className="empty-state" style={{ margin: 0 }}>
                  Hələ müqavilə yoxdur. Müştəri Bazasında bu müştərinin satışına sənəd əlavə edəndə burada avtomatik görünəcək.
                </p>
              ) : (
                <dl className="record-module__grid">
                  {openCustomer.contracts.map((c, idx) => (
                    <div key={c.sale.id} className="record-module__field">
                      <dt>
                        Müqavilə {idx + 1} · Satış №{' '}
                        <Link to={`/musteri-bazasi?open=${c.sale.id}`}>{c.sale.sira_no ?? '—'}</Link>
                      </dt>
                      <dd>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                          {[c.sale.model, c.sale.verilme_tarixi ? formatDate(c.sale.verilme_tarixi) : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                        {c.files.map((f) => (
                          <div key={f.path}>
                            <a href={senedlerPublicUrl(f.path)} target="_blank" rel="noopener noreferrer">
                              {f.name || 'fayl'}
                            </a>
                          </div>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardDetails>

            <CardDetails title={`Alışları (${openCustomer.sales.length})`} defaultOpen>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>№</th>
                      <th>Model</th>
                      <th>Verilmə tarixi</th>
                      <th style={{ textAlign: 'right' }}>Satış</th>
                      <th style={{ textAlign: 'right' }}>Verilib</th>
                      <th style={{ textAlign: 'right' }}>Qalan</th>
                      <th>Vəziyyət</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openCustomer.sales.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <Link to={`/musteri-bazasi?open=${s.id}`}>{s.sira_no ?? '—'}</Link>
                        </td>
                        <td>{s.model || '—'}</td>
                        <td>{formatDate(s.verilme_tarixi)}</td>
                        <td style={{ textAlign: 'right' }}>{formatMoney(s.satis_qiymeti)}</td>
                        <td style={{ textAlign: 'right' }}>{formatMoney(s.verilib)}</td>
                        <td style={{ textAlign: 'right' }}>{formatMoney(s.qalan_borc)}</td>
                        <td>{s.veziyyet || '—'}</td>
                      </tr>
                    ))}
                    {!openCustomer.sales.length && (
                      <tr>
                        <td colSpan={7} className="empty-state">Bu müştəriyə bağlı satış yoxdur.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {openCustomer.ledger && (
                <p style={{ marginTop: 12, marginBottom: 0 }}>
                  Borc / Nisyə: qalıq borc <strong>{formatMoney(openCustomer.ledger.qaliq_borc)}</strong>, qalıq nisyə{' '}
                  <strong>{formatMoney(openCustomer.ledger.qaliq_nisye)}</strong> ·{' '}
                  <Link to={counterpartPath(openCustomer.ad_soyad)}>Borc / Nisyə səhifəsini aç</Link>
                </p>
              )}
            </CardDetails>
          </div>
        </Modal>
      )}

      {mergeOpen && (
        <Modal
          title="Müştəriləri birləşdir"
          subtitle="Hansı qeyd əsas qalsın? Digərlərinin alışları, nömrələri və faylları ona keçəcək, özləri silinəcək."
          onClose={() => !merging && setMergeOpen(false)}
          actions={
            <button type="button" className="btn btn--primary" disabled={merging || !mergeTarget} onClick={runMerge}>
              {merging ? 'Birləşdirilir…' : `Birləşdir (${selectedCustomers.length})`}
            </button>
          }
        >
          {mergeError && <p style={{ color: 'var(--color-accent)' }}>{mergeError}</p>}
          <div style={{ display: 'grid', gap: 8 }}>
            {selectedCustomers.map((c) => (
              <label
                key={c.id}
                className="record-module__field"
                style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}
              >
                <input
                  type="radio"
                  name="merge-target"
                  checked={mergeTarget === c.id}
                  onChange={() => setMergeTarget(c.id)}
                  style={{ marginTop: 4 }}
                />
                <span>
                  <strong>{c.ad_soyad}</strong>
                  {mergeTarget === c.id ? ' — əsas' : ''}
                  <br />
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {c.telefon || 'nömrə yoxdur'} · Alış: {c.saleCount} · Satış cəmi: {formatMoney(c.satis)} · Qalan:{' '}
                    {formatMoney(c.qalan)}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12, marginBottom: 0 }}>
            Satış qeydlərinin özü (Müştəri Bazası) dəyişmir və silinmir — sadəcə hamısı bir müştərinin kartında görünəcək.
          </p>
        </Modal>
      )}

      {openSupplier && (
        <Modal
          title={openSupplier.name}
          subtitle={openSupplier.phone ? `Telefon: ${openSupplier.phone}` : 'Telefon qeyd olunmayıb'}
          onClose={() => setOpenSupplier(null)}
        >
          <CardSection title="Əsas Məlumatlar">
            <FieldGrid
              items={[
                { label: 'Təchizatçı', value: openSupplier.name },
                { label: 'Telefon (Depodan)', value: openSupplier.phone },
                { label: 'Məhsul sayı', value: openSupplier.count },
                { label: 'Alış cəmi', value: formatMoney(openSupplier.total) },
                { label: 'Son alış', value: formatDate(openSupplier.lastDate) },
                ...(openSupplier.ledger
                  ? [
                      { label: 'Qalıq borc', value: formatMoney(openSupplier.ledger.qaliq_borc) },
                      { label: 'Qalıq nisyə', value: formatMoney(openSupplier.ledger.qaliq_nisye) },
                    ]
                  : []),
              ]}
            />
            {openSupplier.ledger && (
              <p style={{ marginTop: 12, marginBottom: 0 }}>
                <Link to={counterpartPath(openSupplier.name)}>Borc / Nisyə səhifəsini aç</Link>
              </p>
            )}
          </CardSection>

          <div className="record-module__sections">
            <CardDetails title={`Ondan alınan məhsullar (${openSupplier.count})`} defaultOpen>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tarix</th>
                      <th>Model</th>
                      <th>Rəng</th>
                      <th>Yaddaş</th>
                      <th>IMEI</th>
                      <th style={{ textAlign: 'right' }}>Qiymət</th>
                      <th>Vəziyyət</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...openSupplier.items]
                      .sort((a, b) => String(b.alis_tarixi || '').localeCompare(String(a.alis_tarixi || '')))
                      .map((d) => (
                        <tr key={d.id}>
                          <td>{formatDate(d.alis_tarixi)}</td>
                          <td>{d.model || '—'}</td>
                          <td>{d.reng || '—'}</td>
                          <td>{d.yaddas || '—'}</td>
                          <td>{d.imei_1 || '—'}</td>
                          <td style={{ textAlign: 'right' }}>{formatMoney(d.alis_qiymeti)}</td>
                          <td>{STATUS_LABELS[d.status] || d.status || '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardDetails>
          </div>
        </Modal>
      )}
    </div>
  )
}
