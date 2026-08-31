import { formatSenedlerCount, parseSenedler } from '../../lib/senedler'
import { formatDate } from '../../lib/formatDate'

export { formatDate }

export const NAGD_TABLE = 'nagd_satish'
export const COLUMN_SETTINGS_TABLE = 'ui_column_settings'
export const COLUMN_SETTINGS_KEY = 'nagd_satish'

export const SUGGEST_FIELDS = new Set(['kime', 'model', 'reng', 'yaddas', 'kimden_alinib', 'satici'])

export const SATIS_NOVU_OPTIONS = [
  { value: 'nagd', label: 'Nağd' },
  { value: 'nisye', label: 'Nisyə' },
]

export const SATIS_NOVU_MAP = Object.fromEntries(SATIS_NOVU_OPTIONS.map((o) => [o.value, o.label]))

export const FIELD_TYPES = [
  { value: 'text', label: 'Mətn' },
  { value: 'number', label: 'Rəqəm' },
  { value: 'money', label: 'Pul (AZN)' },
  { value: 'date', label: 'Tarix' },
  { value: 'select', label: 'Seçim siyahısı' },
]

export const DEFAULT_COLUMNS = [
  { key: 'tarix', label: 'Tarix', type: 'date', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  {
    key: 'satis_novu',
    label: 'Satış növü',
    type: 'select',
    visible: true,
    formVisible: true,
    readonly: false,
    system: true,
    group: 'record',
    options: SATIS_NOVU_OPTIONS.map((o) => o.value),
  },
  { key: 'kime', label: 'Kimə', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'model', label: 'Model', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'imei_1', label: 'İMEİ 1', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'imei_2', label: 'İMEİ 2', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'serial_no', label: 'Seriya No', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'model_no', label: 'Model No', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'reng', label: 'Rəng', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'yaddas', label: 'Yaddaş', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'kimden_alinib', label: 'Kimdən alınıb', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'alis_tarixi', label: 'Alış tarixi', type: 'date', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'alis_qiymeti', label: 'Alış qiyməti', type: 'money', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'satis_qiymeti', label: 'Satış qiyməti', type: 'money', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'xeyir', label: 'Xeyir', type: 'money', visible: true, formVisible: true, readonly: true, system: true, group: 'record' },
  { key: 'satici', label: 'Satıcı', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'satici_faizi', label: 'Satıcı Faizi', type: 'money', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'xeyir_faizle', label: 'Xeyir (Faizlə)', type: 'money', visible: true, formVisible: true, readonly: true, system: true, group: 'record' },
  { key: 'sira_no', label: '# / №', type: 'number', visible: false, formVisible: false, readonly: true, system: true, group: 'meta' },
  { key: 'kommentler', label: 'Kommentlər', type: 'text', visible: false, formVisible: false, readonly: false, system: true, group: 'extra' },
  { key: 'senedler', label: 'Sənədlər', type: 'files', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
]

const SYSTEM_KEYS = new Set(DEFAULT_COLUMNS.map((c) => c.key))
const GENERATED_KEYS = new Set(['xeyir', 'xeyir_faizle'])

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
          label: c.label || base.label,
          visible: typeof c.visible === 'boolean' ? c.visible : base.visible,
          formVisible: typeof c.formVisible === 'boolean' ? c.formVisible : base.formVisible,
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
  return Array.from(byKey.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return `${n.toLocaleString('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₼`
}

export function formatCell(value, col) {
  if (col?.type === 'files' || col?.key === 'senedler') return formatSenedlerCount(value)
  if (col?.key === 'satis_novu') return SATIS_NOVU_MAP[value] || value || '—'
  if (value === null || value === undefined || value === '') return '—'
  if (col.type === 'money') return formatMoney(value)
  if (col.type === 'date') return formatDate(value)
  return String(value)
}

export function emptyNagdForm(columns = DEFAULT_COLUMNS) {
  const base = {
    extra: {},
    tarix: new Date().toISOString().slice(0, 10),
    satis_novu: 'nagd',
    satici_faizi: '0',
    senedler: [],
  }
  for (const col of columns) {
    if (col.key === 'sira_no' || col.key === 'senedler' || GENERATED_KEYS.has(col.key)) continue
    if (col.custom) base.extra[col.key] = ''
    else if (col.key === 'tarix') base.tarix = new Date().toISOString().slice(0, 10)
    else if (col.key === 'satis_novu') base.satis_novu = 'nagd'
    else if (col.key === 'satici_faizi') base.satici_faizi = '0'
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
  'tarix', 'satis_novu', 'kime', 'model', 'imei_1', 'imei_2', 'serial_no', 'model_no', 'reng', 'yaddas',
  'kimden_alinib', 'alis_tarixi', 'alis_qiymeti', 'satis_qiymeti', 'satici', 'satici_faizi', 'kommentler',
]

export function toNagdPayload(form, columns = DEFAULT_COLUMNS) {
  const payload = { updated_at: new Date().toISOString() }
  const sira = numOrNull(form.sira_no)
  if (sira !== null) payload.sira_no = Math.trunc(sira)
  if (form.musteri_id) payload.musteri_id = form.musteri_id
  if (form.depo_id) payload.depo_id = form.depo_id

  for (const key of SYSTEM_DB_KEYS) {
    const col = columns.find((c) => c.key === key)
    const type = col?.type || 'text'
    const raw = form[key]
    if (key === 'satis_novu') {
      payload.satis_novu = raw === 'nisye' ? 'nisye' : 'nagd'
      continue
    }
    if (type === 'money' || type === 'number') {
      let n = numOrNull(raw)
      if (key === 'satici_faizi') n = n ?? 0
      payload[key] = n
    } else if (type === 'date') {
      payload[key] = dateOrNull(raw)
    } else {
      payload[key] = textOrNull(raw)
    }
  }

  const extra = { ...(form.extra || {}) }
  for (const col of columns) {
    if (!col.custom) continue
    const v = form.extra?.[col.key] ?? form[col.key] ?? ''
    if (col.type === 'number' || col.type === 'money') extra[col.key] = numOrNull(v)
    else if (col.type === 'date') extra[col.key] = dateOrNull(v)
    else extra[col.key] = textOrNull(v)
  }
  payload.extra = extra
  payload.senedler = parseSenedler(form.senedler)
  return payload
}

export function rowToForm(row, columns = DEFAULT_COLUMNS) {
  const f = emptyNagdForm(columns)
  f.extra = { ...(row.extra || {}) }
  f.musteri_id = row.musteri_id || ''
  f.depo_id = row.depo_id || ''
  f.senedler = parseSenedler(row.senedler)
  for (const col of columns) {
    if (col.key === 'senedler') continue
    if (col.custom) {
      const v = row.extra?.[col.key]
      f.extra[col.key] = v == null ? '' : String(v)
    } else if (row[col.key] != null) {
      f[col.key] = String(row[col.key])
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

export function computeXeyir(alis, satis) {
  return (Number(satis) || 0) - (Number(alis) || 0)
}

export function computeXeyirFaizle(alis, satis, saticiFaizi) {
  return computeXeyir(alis, satis) - (Number(saticiFaizi) || 0)
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

/** Build nagd row payload from depo item + sale form */
export function depoItemToNagdPayload(
  item,
  { kime, musteriId, tarix, alis, satis, satici, saticiFaizi, kommentler, satisNovu }
) {
  return {
    tarix: tarix || new Date().toISOString().slice(0, 10),
    satis_novu: satisNovu === 'nisye' ? 'nisye' : 'nagd',
    kime: kime || null,
    musteri_id: musteriId || null,
    model: item.model || null,
    imei_1: item.imei_1 || null,
    imei_2: item.imei_2 || null,
    serial_no: item.serial_no || null,
    model_no: item.model_no || null,
    reng: item.reng || null,
    yaddas: item.yaddas || null,
    kimden_alinib: item.kimden_alinib || null,
    alis_tarixi: item.alis_tarixi || null,
    alis_qiymeti: alis != null && alis !== '' ? Number(alis) : (item.alis_qiymeti != null ? Number(item.alis_qiymeti) : null),
    satis_qiymeti: satis != null && satis !== '' ? Number(satis) : null,
    satici: satici || null,
    satici_faizi: saticiFaizi != null && saticiFaizi !== '' ? Number(saticiFaizi) : 0,
    depo_id: item.id,
    kommentler: kommentler || null,
    extra: {},
    updated_at: new Date().toISOString(),
  }
}
