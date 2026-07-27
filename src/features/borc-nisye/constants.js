import { formatSenedlerCount, parseSenedler } from '../../lib/senedler'
import { formatDate } from '../../lib/formatDate'

export { formatDate }

export const LEDGER_TABLE = 'borc_nisye_ledger'
export const COLUMN_SETTINGS_TABLE = 'ui_column_settings'
export const COLUMN_SETTINGS_KEY = 'borc_nisye_ledger'

export const ENTRY_TYPES = [
  { value: 'borc_verdim', label: 'Borc verdim', track: 'borc', sign: +1 },
  { value: 'borc_aldim', label: 'Borc aldım', track: 'borc', sign: -1 },
  { value: 'nisye_verdim', label: 'Nisyə verdim', track: 'nisye', sign: +1 },
  { value: 'nisye_aldim', label: 'Nisyə aldım', track: 'nisye', sign: -1 },
  { value: 'nisye_odenis', label: 'Nisyə ödəniş', track: 'nisye', sign: -1 },
  { value: 'qeyd', label: 'Qeyd (şərh)', track: null, sign: 0 },
]

export const ENTRY_TYPE_MAP = Object.fromEntries(ENTRY_TYPES.map((t) => [t.value, t]))

/**
 * Calendar direction from tip:
 * - collect: they owe me → I need to collect
 * - pay: I took money / bought on credit → I need to pay back
 */
export function dueDirection(tip) {
  if (tip === 'borc_aldim' || tip === 'nisye_aldim') return 'pay'
  if (tip === 'borc_verdim' || tip === 'nisye_verdim') return 'collect'
  return null
}

export function dueDirectionLabel(direction) {
  if (direction === 'pay') return 'Ödəyəcəyəm'
  if (direction === 'collect') return 'Alacağam'
  return '—'
}

/** Overview section columns (Borc table) */
export const OVERVIEW_BORC_COLUMNS = [
  { key: 'kime', label: 'Müştəri', type: 'text', visible: true, width: 220 },
  { key: 'borc_verdim', label: 'Borc Verdim (cəmi)', type: 'money', visible: true, width: 160 },
  { key: 'borc_aldim', label: 'Borc Aldım (cəmi)', type: 'money', visible: true, width: 160 },
  { key: 'qaliq_borc', label: 'Qalıq (Borc)', type: 'money', visible: true, width: 140 },
]

/** Overview section columns (Nisyə table) */
export const OVERVIEW_NISYE_COLUMNS = [
  { key: 'kime', label: 'Müştəri', type: 'text', visible: true, width: 220 },
  { key: 'nisye_verdim', label: 'Nisyə Verdim (cəmi)', type: 'money', visible: true, width: 160 },
  { key: 'nisye_aldim', label: 'Nisyə Aldım (cəmi)', type: 'money', visible: true, width: 160 },
  { key: 'nisye_odenis', label: 'Nisyə Ödəniş (cəmi)', type: 'money', visible: true, width: 160 },
  { key: 'qaliq_nisye', label: 'Qalıq (Nisyə)', type: 'money', visible: true, width: 140 },
]

export const DEFAULT_COLUMNS = [
  { key: 'sira_no', label: '#', type: 'number', visible: false, formVisible: false, readonly: true, system: true },
  { key: 'tarix', label: 'Tarix', type: 'date', visible: true, formVisible: true, readonly: false, system: true },
  { key: 'qaytarma_tarixi', label: 'Qaytarma tarixi', type: 'date', visible: true, formVisible: true, readonly: false, system: true },
  { key: 'kime', label: 'Kimə', type: 'text', visible: true, formVisible: true, readonly: false, system: true },
  { key: 'tip', label: 'Əməliyyat', type: 'select', visible: true, formVisible: true, readonly: false, system: true, options: ENTRY_TYPES.map((t) => t.value) },
  { key: 'mebleg', label: 'Məbləğ', type: 'money', visible: true, formVisible: true, readonly: false, system: true },
  { key: 'mehsul', label: 'Məhsul', type: 'text', visible: true, formVisible: true, readonly: false, system: true },
  { key: 'imei_1', label: 'IMEI 1', type: 'text', visible: true, formVisible: true, readonly: false, system: true },
  { key: 'imei_2', label: 'IMEI 2', type: 'text', visible: true, formVisible: true, readonly: false, system: true },
  { key: 'qeyd', label: 'Qeyd', type: 'text', visible: true, formVisible: true, readonly: false, system: true },
  { key: 'senedler', label: 'Sənədlər', type: 'files', visible: true, formVisible: true, readonly: false, system: true },
]

const SYSTEM_KEYS = new Set(DEFAULT_COLUMNS.map((c) => c.key))

export function mergeColumnConfig(saved) {
  const byKey = new Map()
  DEFAULT_COLUMNS.forEach((c, i) => byKey.set(c.key, { ...c, order: i }))
  if (Array.isArray(saved)) {
    saved.forEach((c, i) => {
      if (!c?.key || !SYSTEM_KEYS.has(c.key)) return
      const base = byKey.get(c.key)
      byKey.set(c.key, {
        ...base,
        label: c.label || base.label,
        visible: typeof c.visible === 'boolean' ? c.visible : base.visible,
        formVisible: typeof c.formVisible === 'boolean' ? c.formVisible : base.formVisible,
        order: typeof c.order === 'number' ? c.order : i,
        width: typeof c.width === 'number' ? c.width : base.width,
      })
    })
  }
  return Array.from(byKey.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return `${n.toLocaleString('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₼`
}

export function tipLabel(tip) {
  return ENTRY_TYPE_MAP[tip]?.label || tip || '—'
}

export function formatCell(value, col) {
  if (col?.type === 'files' || col?.key === 'senedler') return formatSenedlerCount(value)
  if (col.key === 'tip') return tipLabel(value)
  if (value === null || value === undefined || value === '') return '—'
  if (col.type === 'money') return formatMoney(value)
  if (col.type === 'date') return formatDate(value)
  return String(value)
}

export function getRowValue(row, col) {
  if (!row || !col) return null
  if (col.custom) return row.extra?.[col.key] ?? null
  return row[col.key] ?? null
}

export function counterpartPath(kime) {
  return `/borc-nisye/taraf/${encodeURIComponent(String(kime || '').trim())}`
}

export function emptyLedgerForm() {
  return {
    kime: '',
    tarix: new Date().toISOString().slice(0, 10),
    qaytarma_tarixi: '',
    tip: 'nisye_verdim',
    mebleg: '',
    mehsul: '',
    imei_1: '',
    imei_2: '',
    qeyd: '',
    senedler: [],
  }
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

function dateOrNull(v) {
  return v || null
}

export function toLedgerPayload(form) {
  const mebleg = numOrNull(form.mebleg)
  const payload = {
    kime: String(form.kime || '').trim(),
    tarix: dateOrNull(form.tarix),
    qaytarma_tarixi: dateOrNull(form.qaytarma_tarixi),
    tip: form.tip,
    mebleg: mebleg == null ? 0 : mebleg,
    mehsul: String(form.mehsul || '').trim() || null,
    imei_1: String(form.imei_1 || '').trim() || null,
    imei_2: String(form.imei_2 || '').trim() || null,
    qeyd: String(form.qeyd || '').trim() || null,
    updated_at: new Date().toISOString(),
  }
  if (form.depo_id) payload.depo_id = form.depo_id
  payload.senedler = parseSenedler(form.senedler)
  return payload
}

/** Build ledger row(s) from a Depo sale basket item. */
export function depoItemToLedgerPayload(item, { kime, tip, tarix, qaytarma_tarixi, mebleg, mehsul, qeyd }) {
  const label = String(mehsul ?? item.model ?? '').trim()
  return {
    kime: String(kime || '').trim(),
    tarix: tarix || new Date().toISOString().slice(0, 10),
    qaytarma_tarixi: qaytarma_tarixi || null,
    tip: tip || 'nisye_verdim',
    mebleg: Number(mebleg) || 0,
    mehsul: label || null,
    imei_1: item.imei_1 || null,
    imei_2: item.imei_2 || null,
    depo_id: item.id,
    qeyd: qeyd || null,
    updated_at: new Date().toISOString(),
  }
}

export function rowToForm(row) {
  return {
    kime: row.kime || '',
    tarix: row.tarix || '',
    qaytarma_tarixi: row.qaytarma_tarixi || '',
    tip: row.tip || 'borc_verdim',
    mebleg: row.mebleg == null ? '' : String(row.mebleg),
    mehsul: row.mehsul || '',
    imei_1: row.imei_1 || '',
    imei_2: row.imei_2 || '',
    qeyd: row.qeyd || '',
    senedler: parseSenedler(row.senedler),
  }
}

/** Rows with a due date, for the calendar. */
export function buildDueEvents(rows) {
  const today = new Date().toISOString().slice(0, 10)
  const list = []
  for (const row of rows || []) {
    const due = row.qaytarma_tarixi
    if (!due) continue
    const direction = dueDirection(row.tip)
    if (!direction) continue
    list.push({
      id: row.id,
      kime: row.kime,
      tip: row.tip,
      mebleg: Number(row.mebleg) || 0,
      mehsul: row.mehsul || null,
      qeyd: row.qeyd || null,
      tarix: row.tarix || null,
      qaytarma_tarixi: due,
      direction,
      overdue: due < today,
    })
  }
  list.sort((a, b) => {
    if (a.qaytarma_tarixi !== b.qaytarma_tarixi) {
      return a.qaytarma_tarixi.localeCompare(b.qaytarma_tarixi)
    }
    return String(a.kime || '').localeCompare(String(b.kime || ''), 'az')
  })
  return list
}

/** Aggregate journal rows into per-person borc / nisye balances. */
export function computeBalances(rows) {
  const map = new Map()
  for (const row of rows || []) {
    const name = String(row.kime || '').trim()
    if (!name) continue
    if (!map.has(name)) {
      map.set(name, {
        kime: name,
        borc_verdim: 0,
        borc_aldim: 0,
        nisye_verdim: 0,
        nisye_aldim: 0,
        nisye_odenis: 0,
      })
    }
    const b = map.get(name)
    const amt = Number(row.mebleg) || 0
    if (row.tip === 'borc_verdim') b.borc_verdim += amt
    else if (row.tip === 'borc_aldim') b.borc_aldim += amt
    else if (row.tip === 'nisye_verdim') b.nisye_verdim += amt
    else if (row.tip === 'nisye_aldim') b.nisye_aldim += amt
    else if (row.tip === 'nisye_odenis') b.nisye_odenis += amt
  }

  const list = [...map.values()].map((b) => ({
    ...b,
    qaliq_borc: b.borc_verdim - b.borc_aldim,
    // Verdim − ödəniş − aldım (mənim onlara borcum)
    qaliq_nisye: b.nisye_verdim - b.nisye_odenis - b.nisye_aldim,
  }))

  list.sort((a, b) => a.kime.localeCompare(b.kime, 'az'))
  return list
}

export function parseExcelDate(v) {
  if (v == null || v === '') return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10)
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Excel serial date
    const epoch = Date.UTC(1899, 11, 30)
    const d = new Date(epoch + Math.round(v) * 86400000)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (m) {
    const dd = m[1].padStart(2, '0')
    const mm = m[2].padStart(2, '0')
    let yyyy = m[3]
    if (yyyy.length === 2) yyyy = `20${yyyy}`
    return `${yyyy}-${mm}-${dd}`
  }
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

export function parseAmount(v, { allowZero = false } = {}) {
  if (v === null || v === undefined || v === '') return allowZero ? 0 : null
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'))
  if (Number.isNaN(n)) return null
  if (n === 0) return allowZero ? 0 : null
  return Math.abs(n)
}
