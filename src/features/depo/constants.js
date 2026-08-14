import { formatSenedlerCount, parseSenedler } from '../../lib/senedler'
import { formatDate } from '../../lib/formatDate'
import { LEDGER_TABLE } from '../borc-nisye/constants'

export { formatDate }

export const DEPO_TABLE = 'depo'
export const COLUMN_SETTINGS_TABLE = 'ui_column_settings'
export const COLUMN_SETTINGS_KEY = 'depo_v5'

export const STATUS_OPTIONS = ['available', 'sold', 'reserved', 'returned', 'other']
export const STATUS_LABELS = {
  available: 'Mövcud',
  sold: 'Satılıb',
  reserved: 'Rezerv',
  returned: 'Qaytarılıb',
  other: 'Digər',
}

export const ODENIS_NOVU_OPTIONS = [
  { value: 'nagd', label: 'Nağdı' },
  { value: 'nisye', label: 'Nisyə' },
]

export const ODENIS_NOVU_LABELS = Object.fromEntries(ODENIS_NOVU_OPTIONS.map((o) => [o.value, o.label]))

export const CONDITION_OPTIONS = [
  { value: 'teze', label: 'Yeni' },
  { value: 'kohne', label: 'Köhnə' },
]

export const SIM_OPTIONS = [
  { value: 'sim', label: 'SIM' },
  { value: 'esim', label: 'eSIM' },
  { value: 'both', label: 'SIM + eSIM' },
]

export const SALE_TYPES = [
  { value: 'kredit', label: 'Kredit' },
  { value: 'nagd', label: 'Nağd' },
  { value: 'borc_nisye', label: 'Borc / Nisyə' },
]

export const SUGGEST_FIELDS = new Set(['model', 'reng', 'yaddas', 'kimden_alinib', 'sexsiyyet'])

export const FIELD_TYPES = [
  { value: 'text', label: 'Mətn' },
  { value: 'number', label: 'Rəqəm' },
  { value: 'money', label: 'Pul (AZN)' },
  { value: 'date', label: 'Tarix' },
  { value: 'select', label: 'Seçim siyahısı' },
]

/** Column order matches the shop inventory sheet. */
export const DEFAULT_COLUMNS = [
  { key: 'model', label: 'Model', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'reng', label: 'Rəng', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'veziyyet_cihaz', label: 'Status', type: 'select', visible: true, formVisible: true, readonly: false, system: true, group: 'record', options: ['teze', 'kohne'], required: true },
  { key: 'battery_faiz', label: 'Battery', type: 'number', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'alis_tarixi', label: 'Tarix', type: 'date', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'alis_qiymeti', label: 'Qiymət', type: 'money', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'odenis_novu', label: 'Ödəniş növü', type: 'select', visible: true, formVisible: true, readonly: false, system: true, group: 'record', options: ['nagd', 'nisye'] },
  { key: 'qaytarma_tarixi', label: 'Qaytarma tarixi', type: 'date', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'miqdar', label: 'Miqdar', type: 'number', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'yaddas', label: 'Yaddaş', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'kimden_alinib', label: 'Hardan', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'nomre', label: 'Nömrə', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'sexsiyyet', label: 'Şəxsiyyət', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'imei_1', label: 'Imei 1', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'imei_2', label: 'Imei 2', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'serial_no', label: 'Serial No', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'model_no', label: 'Model No', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'status', label: 'Vəziyyət', type: 'select', visible: true, formVisible: true, readonly: false, system: true, group: 'record', options: STATUS_OPTIONS },
  // Kept in DB / column manager, hidden from default sheet view
  { key: 'sira_no', label: '# / №', type: 'number', visible: false, formVisible: false, readonly: true, system: true, group: 'meta' },
  { key: 'nov', label: 'Növ', type: 'text', visible: false, formVisible: false, readonly: false, system: true, group: 'extra' },
  { key: 'sim_type', label: 'SIM növü', type: 'select', visible: false, formVisible: false, readonly: false, system: true, group: 'extra', options: ['sim', 'esim', 'both'] },
  { key: 'kommentler', label: 'Kommentlər', type: 'text', visible: false, formVisible: false, readonly: false, system: true, group: 'extra' },
  { key: 'senedler', label: 'Sənədlər', type: 'files', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
]

const SYSTEM_KEYS = new Set(DEFAULT_COLUMNS.map((c) => c.key))

export function mergeColumnConfig(saved) {
  const byKey = new Map()
  DEFAULT_COLUMNS.forEach((c, i) => byKey.set(c.key, { ...c, order: i }))
  if (Array.isArray(saved)) {
    saved.forEach((c, i) => {
      if (!c?.key) return
      if (SYSTEM_KEYS.has(c.key)) {
        const base = byKey.get(c.key)
        byKey.set(c.key, {
          ...base,
          label: c.key === 'veziyyet_cihaz' ? base.label : c.label || base.label,
          visible:
            c.key === 'veziyyet_cihaz'
              ? true
              : typeof c.visible === 'boolean'
                ? c.visible
                : base.visible,
          formVisible:
            c.key === 'veziyyet_cihaz'
              ? true
              : typeof c.formVisible === 'boolean'
                ? c.formVisible
                : base.formVisible,
          order: typeof c.order === 'number' ? c.order : i,
          width: typeof c.width === 'number' ? c.width : base.width,
        })
      } else {
        byKey.set(c.key, {
          key: c.key,
          label: c.label || c.key,
          type: c.type || 'text',
          visible: c.visible !== false,
          formVisible: c.formVisible !== false && c.visible !== false,
          readonly: false,
          system: false,
          custom: true,
          group: 'custom',
          options: c.options || [],
          order: typeof c.order === 'number' ? c.order : 1000 + i,
          width: typeof c.width === 'number' ? c.width : undefined,
        })
      }
    })
  }

  const cols = Array.from(byKey.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  // Always place Status immediately before Battery
  const statusIdx = cols.findIndex((c) => c.key === 'veziyyet_cihaz')
  if (statusIdx >= 0) {
    const [statusCol] = cols.splice(statusIdx, 1)
    const batIdx = cols.findIndex((c) => c.key === 'battery_faiz')
    if (batIdx >= 0) cols.splice(batIdx, 0, statusCol)
    else cols.push(statusCol)
  }
  return cols.map((c, i) => ({ ...c, order: i }))
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return `${n.toLocaleString('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₼`
}

export function formatCell(value, col) {
  if (col?.type === 'files' || col?.key === 'senedler') return formatSenedlerCount(value)
  if (value === null || value === undefined || value === '') return '—'
  if (col.key === 'status') return STATUS_LABELS[value] || value
  if (col.key === 'odenis_novu') return ODENIS_NOVU_LABELS[value] || value
  if (col.key === 'veziyyet_cihaz') return value === 'teze' ? 'Yeni' : value === 'kohne' ? 'Köhnə' : value
  if (col.key === 'battery_faiz') {
    const n = Number(value)
    if (Number.isNaN(n)) return String(value)
    return `${n}%`
  }
  if (col.type === 'money') return formatMoney(value)
  if (col.type === 'date') return formatDate(value)
  return String(value)
}

export function emptyDepoForm(columns = DEFAULT_COLUMNS) {
  const base = { extra: {}, status: 'available', miqdar: '1', odenis_novu: 'nagd', senedler: [] }
  for (const col of columns) {
    if (col.key === 'sira_no' || col.key === 'senedler') continue
    if (col.custom) base.extra[col.key] = ''
    else if (col.key === 'status') base.status = 'available'
    else if (col.key === 'miqdar') base.miqdar = '1'
    else if (col.key === 'odenis_novu') base.odenis_novu = 'nagd'
    else base[col.key] = ''
  }
  return base
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(String(v).replace(/%/g, '').replace(/\s/g, '').replace(',', '.'))
  return Number.isNaN(n) ? null : n
}
function dateOrNull(v) {
  return v || null
}
function textOrNull(v) {
  const t = (v ?? '').toString().trim()
  return t || null
}

const SYSTEM_DB_KEYS = [
  'status', 'nov', 'model', 'reng', 'yaddas', 'veziyyet_cihaz', 'battery_faiz',
  'imei_1', 'imei_2', 'serial_no', 'model_no', 'sim_type', 'alis_qiymeti',
  'alis_tarixi', 'odenis_novu', 'qaytarma_tarixi', 'kimden_alinib', 'nomre',
  'sexsiyyet', 'miqdar', 'kommentler',
]

export function toDepoPayload(form, columns = DEFAULT_COLUMNS) {
  const payload = { updated_at: new Date().toISOString() }
  const sira = numOrNull(form.sira_no)
  if (sira !== null) payload.sira_no = Math.trunc(sira)

  for (const key of SYSTEM_DB_KEYS) {
    const col = columns.find((c) => c.key === key)
    const type = col?.type || 'text'
    const raw = form[key]
    if (type === 'money' || type === 'number') {
      let n = numOrNull(raw)
      if (key === 'miqdar') n = n ?? 1
      payload[key] = n
    } else if (type === 'date') {
      payload[key] = dateOrNull(raw)
    } else if (type === 'select') {
      payload[key] = textOrNull(raw)
    } else {
      payload[key] = textOrNull(raw)
    }
  }
  payload.status = form.status || 'available'
  if (form.veziyyet_cihaz === 'teze') {
    payload.battery_faiz = 100
  }
  payload.senedler = parseSenedler(form.senedler)

  const extra = { ...(form.extra || {}) }
  for (const col of columns) {
    if (!col.custom) continue
    const v = form.extra?.[col.key] ?? form[col.key] ?? ''
    if (col.type === 'number' || col.type === 'money') extra[col.key] = numOrNull(v)
    else if (col.type === 'date') extra[col.key] = dateOrNull(v)
    else extra[col.key] = textOrNull(v)
  }
  payload.extra = extra
  return payload
}

export function rowToForm(row, columns = DEFAULT_COLUMNS) {
  const f = emptyDepoForm(columns)
  f.extra = { ...(row.extra || {}) }
  f.senedler = parseSenedler(row.senedler)
  for (const col of columns) {
    if (col.key === 'senedler') continue
    if (col.custom) {
      const v = row.extra?.[col.key]
      f.extra[col.key] = v == null ? '' : String(v)
    } else if (col.key !== 'sira_no' && row[col.key] != null) {
      f[col.key] = String(row[col.key])
    } else if (col.key === 'sira_no' && row.sira_no != null) {
      f.sira_no = String(row.sira_no)
    }
  }
  return f
}

export function getFieldValue(form, col) {
  if (col.custom) return form.extra?.[col.key] ?? ''
  return form[col.key] ?? ''
}

export function setFormField(form, col, value) {
  if (col.custom) return { ...form, extra: { ...form.extra, [col.key]: value } }
  return { ...form, [col.key]: value }
}

export function getRowValue(row, col) {
  if (col.custom) return row.extra?.[col.key]
  return row[col.key]
}

/**
 * Validate nisyə purchase fields on Depo form.
 * @returns {string|null} error message
 */
export function validateDepoNisye(form) {
  if (form.odenis_novu !== 'nisye') return null
  const kime = String(form.kimden_alinib || '').trim()
  if (!kime) return 'Nisyə üçün «Hardan / Kimdən alınıb» mütləqdir.'
  if (!form.qaytarma_tarixi) return 'Nisyə üçün qaytarma tarixi mütləqdir.'
  const alis = Number(String(form.alis_qiymeti || '').replace(',', '.'))
  if (!Number.isFinite(alis) || alis <= 0) {
    return 'Nisyə üçün alış qiyməti (məbləğ) mütləqdir.'
  }
  return null
}

/** Yeni → battery 100; Köhnə → battery optional. */
export function validateDepoDeviceCondition(form) {
  const status = form?.veziyyet_cihaz
  if (!status) return 'Status seçilməlidir (Yeni və ya Köhnə).'
  return null
}

/**
 * Required empty fields for Depo form (for red highlight + message).
 * @returns {{ key: string, label: string }[]}
 */
export function getDepoMissingRequiredFields(form) {
  const missing = []
  if (!form?.veziyyet_cihaz) {
    missing.push({ key: 'veziyyet_cihaz', label: 'Status' })
  }
  if (form?.odenis_novu === 'nisye') {
    if (!String(form.kimden_alinib || '').trim()) {
      missing.push({ key: 'kimden_alinib', label: 'Hardan' })
    }
    if (!form.qaytarma_tarixi) {
      missing.push({ key: 'qaytarma_tarixi', label: 'Qaytarma tarixi' })
    }
    const alis = Number(String(form.alis_qiymeti || '').replace(',', '.'))
    if (!Number.isFinite(alis) || alis <= 0) {
      missing.push({ key: 'alis_qiymeti', label: 'Qiymət' })
    }
  }
  return missing
}

/**
 * After Depo save: if ödəniş növü = Nisyə, upsert Borc/Nisyə «Nisyə aldım» entry
 * (Kimə = kimdən, məbləğ = alış, qaytarma tarixi → kalendar ödəniş vəzifəsi).
 */
export async function syncDepoPurchaseNisyeLedger(supabase, depoRow) {
  if (!depoRow?.id) return { error: null }

  if (depoRow.odenis_novu !== 'nisye') {
    return { error: null }
  }

  const kime = String(depoRow.kimden_alinib || '').trim()
  const mebleg = Number(depoRow.alis_qiymeti)
  if (!kime || !Number.isFinite(mebleg) || mebleg <= 0) {
    return { error: new Error('Nisyə ledger üçün kimdən / alış qiyməti lazımdır.') }
  }

  const payload = {
    kime,
    tarix: depoRow.alis_tarixi || new Date().toISOString().slice(0, 10),
    qaytarma_tarixi: depoRow.qaytarma_tarixi || null,
    tip: 'nisye_aldim',
    mebleg,
    mehsul: depoRow.model || null,
    imei_1: depoRow.imei_1 || null,
    imei_2: depoRow.imei_2 || null,
    depo_id: depoRow.id,
    qeyd: 'Depo nisyə alış',
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await supabase
    .from(LEDGER_TABLE)
    .select('id')
    .eq('depo_id', depoRow.id)
    .eq('tip', 'nisye_aldim')
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase.from(LEDGER_TABLE).update(payload).eq('id', existing.id)
    return { error }
  }
  const { error } = await supabase.from(LEDGER_TABLE).insert(payload)
  return { error }
}

export function slugifyColumnKey(label) {
  const base = String(label || 'sutun')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o')
    .replace(/ü/g, 'u').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ş/g, 's')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)
  return `custom_${base || 'field'}_${Date.now().toString(36)}`
}
