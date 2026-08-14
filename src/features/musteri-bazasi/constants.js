import { formatSenedlerCount, parseSenedler } from '../../lib/senedler'
import { formatDate } from '../../lib/formatDate'

export { formatDate }

/** Live Supabase tables */
export const MUSTERI_TABLE = 'musteri_bazasi'
export const MUSTERILER_TABLE = 'musteriler'
export const COLUMN_SETTINGS_TABLE = 'ui_column_settings'
export const COLUMN_SETTINGS_KEY = 'musteri_bazasi'
/** Separate visibility/order/width for Məhkəmə list (same underlying müştəri columns). */
export const MEHKEME_COLUMN_SETTINGS_KEY = 'mehkeme_bazasi'

export const MEHKEME_NATIVE_KEYS = [
  'mehkeme_isare',
  'rusum_odenilib',
  'mehkeme_status',
  'mehkeme_qeyd',
]

/** Fields with select-or-type suggestions from existing DB values */
export const SUGGEST_FIELDS = new Set(['model', 'reng', 'yaddas', 'satici'])

/**
 * Faiz = cərimə məbləği (penalty).
 * Will be filled automatically from a future payments/penalty table.
 * Until then it stays 0 / read-only on the form.
 */

export const VEZIYYET_OPTIONS = ['Qalıb', 'Bitib', 'Məhkəmə']
export const MEHKEME_STATUS_OPTIONS = ['Məhkəmə gedir', 'İcradadır', 'Tamamlanıb']
export const NEW_MUSTERI_VALUE = '__new__'

export const FIELD_TYPES = [
  { value: 'text', label: 'Mətn' },
  { value: 'number', label: 'Rəqəm' },
  { value: 'money', label: 'Pul (AZN)' },
  { value: 'date', label: 'Tarix' },
  { value: 'select', label: 'Seçim siyahısı' },
]

/**
 * Default columns (system). Users can reorder / hide; custom columns are appended.
 * group: person = müştəri fields | record = sale/device | meta = auto
 */
export const DEFAULT_COLUMNS = [
  { key: 'sira_no', label: 'Müştərinin nömrəsi', type: 'number', visible: true, formVisible: true, readonly: false, system: true, group: 'meta' },
  { key: 'ad_soyad', label: 'Ad Soyad Ata adı', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'person', required: true },
  { key: 'nomre_1', label: 'Nömrə 1', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'person' },
  { key: 'nomre_2', label: 'Nömrə 2', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'person' },
  { key: 'nomre_3', label: 'Nömrə 3', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'person' },
  { key: 'nomre_4', label: 'Nömrə 4', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'person' },
  { key: 'nomre_5', label: 'Nömrə 5', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'person' },
  { key: 'zamin', label: 'Zamin', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'person' },
  { key: 'alis_qiymeti', label: 'Alış qiyməti', type: 'money', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'satis_qiymeti', label: 'Satış qiyməti', type: 'money', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'verilib', label: 'Verilib', type: 'money', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'satici', label: 'Satıcı', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'satici_faizi', label: 'Satıcı Faizi', type: 'money', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'gozlenilen_gelir', label: 'Gözlənilən gəlir', type: 'money', visible: true, formVisible: true, readonly: true, system: true, group: 'meta' },
  { key: 'faktiki_gelir', label: 'Faktiki gəlir', type: 'money', visible: true, formVisible: true, readonly: true, system: true, group: 'meta' },
  { key: 'qalan_borc', label: 'Qalan borc', type: 'money', visible: true, formVisible: true, readonly: true, system: true, group: 'meta' },
  { key: 'verilme_tarixi', label: 'Verilmə tarixi', type: 'date', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'bitme_tarixi', label: 'Bitmə tarixi', type: 'date', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'nece_ay', label: 'Neçə ay', type: 'number', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'odenis_gunu', label: 'Ödəniş günü', type: 'number', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  {
    key: 'birinci_ayliq_odenis_tarixi',
    label: 'Birinci aylıq ödəniş tarixi',
    type: 'date',
    visible: true,
    formVisible: true,
    readonly: false,
    system: true,
    group: 'record',
  },
  { key: 'ayliq_odenis', label: 'Aylıq ödəniş', type: 'money', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'faiz', label: 'Faiz (cərimə)', type: 'money', visible: true, formVisible: true, readonly: true, system: true, group: 'meta' },
  { key: 'model', label: 'Model', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'reng', label: 'Rəng', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'yaddas', label: 'Yaddaş', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'imei_1', label: 'IMEI 1', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'imei_2', label: 'IMEI 2', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'battery_faiz', label: 'Battery %', type: 'number', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'icloud', label: 'iCloud', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'icloud_bagli_nomre', label: 'iCloud bağlı nömrə', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'itunes', label: 'iTunes', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'itunes_bagli_nomre', label: 'iTunes bağlı nömrə', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'kimden_alinib', label: 'Kimdən alınıb', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'muqavile_nomresi', label: 'Müqavilə nömrəsi', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'kommentler', label: 'Kommentlər', type: 'text', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'senedler', label: 'Sənədlər', type: 'files', visible: true, formVisible: true, readonly: false, system: true, group: 'record' },
  { key: 'veziyyet', label: 'Vəziyyət', type: 'select', visible: true, formVisible: true, readonly: false, system: true, group: 'record', options: VEZIYYET_OPTIONS },
  // Məhkəmə tab — hidden from main list by default
  { key: 'mehkeme_isare', label: 'İşarə', type: 'checkbox', visible: false, formVisible: false, readonly: false, system: true, group: 'mehkeme' },
  { key: 'rusum_odenilib', label: 'Rüsüm ödənilib', type: 'money', visible: false, formVisible: false, readonly: false, system: true, group: 'mehkeme' },
  { key: 'mehkeme_status', label: 'Məhkəmə statusu', type: 'select', visible: false, formVisible: false, readonly: false, system: true, group: 'mehkeme', options: MEHKEME_STATUS_OPTIONS },
  { key: 'mehkeme_qeyd', label: 'Məhkəmə komment', type: 'text', visible: false, formVisible: false, readonly: false, system: true, group: 'mehkeme' },
]

/**
 * Detail-view field groups. Only "Əsas məlumat" opens by default;
 * ödəniş cədvəli is rendered separately and always stays visible.
 */
export const MUSTERI_VIEW_SECTIONS = [
  {
    id: 'esas',
    title: 'Əsas məlumat',
    defaultOpen: true,
    alwaysVisible: true,
    keys: [
      'sira_no',
      'muqavile_nomresi',
      'ad_soyad',
      'nomre_1',
      'alis_qiymeti',
      'satis_qiymeti',
      'verilib',
      'satici',
      'satici_faizi',
      'qalan_borc',
      'ayliq_odenis',
      'nece_ay',
      'odenis_gunu',
      'birinci_ayliq_odenis_tarixi',
      'verilme_tarixi',
      'bitme_tarixi',
      'veziyyet',
    ],
  },
  {
    id: 'elaqe',
    title: 'Əlaqə və zamin',
    defaultOpen: false,
    keys: ['nomre_2', 'nomre_3', 'nomre_4', 'nomre_5', 'zamin'],
  },
  {
    id: 'odenis',
    title: 'Digər ödəniş sahələri',
    defaultOpen: false,
    keys: [
      'gozlenilen_gelir',
      'faktiki_gelir',
      'faiz',
    ],
  },
  {
    id: 'cihaz',
    title: 'Cihaz məlumatları',
    defaultOpen: false,
    keys: [
      'model',
      'reng',
      'yaddas',
      'imei_1',
      'imei_2',
      'battery_faiz',
      'icloud',
      'icloud_bagli_nomre',
      'itunes',
      'itunes_bagli_nomre',
    ],
  },
  {
    id: 'diger',
    title: 'Digər',
    defaultOpen: false,
    keys: ['kimden_alinib', 'kommentler'],
  },
  {
    id: 'mehkeme',
    title: 'Məhkəmə',
    defaultOpen: false,
    keys: ['mehkeme_isare', 'rusum_odenilib', 'mehkeme_status', 'mehkeme_qeyd'],
  },
]

/** Build collapsible section configs from the current column set. */
export function buildMusteriViewSections(columns = DEFAULT_COLUMNS) {
  const visible = (columns || []).filter(
    (c) => c.visible !== false && c.key !== 'senedler' && c.type !== 'files'
  )
  const byKey = new Map(visible.map((c) => [c.key, c]))
  const used = new Set()
  const sections = []

  for (const section of MUSTERI_VIEW_SECTIONS) {
    const cols = section.keys.map((key) => byKey.get(key)).filter(Boolean)
    cols.forEach((c) => used.add(c.key))
    if (cols.length) {
      sections.push({
        id: section.id,
        title: section.title,
        defaultOpen: section.defaultOpen,
        alwaysVisible: Boolean(section.alwaysVisible),
        columns: cols,
      })
    }
  }

  const rest = visible.filter((c) => !used.has(c.key))
  if (rest.length) {
    sections.push({
      id: 'elave',
      title: 'Əlavə sahələr',
      defaultOpen: false,
      columns: rest,
    })
  }

  return sections
}

/**
 * Form layout sections (same categories as detail view).
 * Includes form-visible columns + custom columns; skips files by default.
 */
export function buildMusteriFormSections(columns = DEFAULT_COLUMNS, opts = {}) {
  const skip = opts.skipKeys instanceof Set ? opts.skipKeys : new Set(opts.skipKeys || [])
  const formCols = (columns || []).filter(
    (c) =>
      c &&
      c.key &&
      c.type !== 'files' &&
      c.key !== 'senedler' &&
      c.formVisible !== false &&
      !skip.has(c.key)
  )
  const byKey = new Map(formCols.map((c) => [c.key, c]))
  const used = new Set()
  const sections = []

  for (const section of MUSTERI_VIEW_SECTIONS) {
    const cols = section.keys.map((key) => byKey.get(key)).filter(Boolean)
    cols.forEach((c) => used.add(c.key))
    if (cols.length) {
      sections.push({
        id: section.id,
        title: section.title,
        defaultOpen: section.defaultOpen,
        alwaysVisible: Boolean(section.alwaysVisible),
        columns: cols,
      })
    }
  }

  const rest = formCols.filter((c) => !used.has(c.key))
  if (rest.length) {
    sections.push({
      id: 'elave',
      title: 'Əlavə sahələr',
      defaultOpen: false,
      columns: rest,
    })
  }

  return sections
}

const SYSTEM_KEYS = new Set(DEFAULT_COLUMNS.map((c) => c.key))

/**
 * Defaults for Məhkəmə list: all müştəri columns (incl. custom),
 * with native məhkəmə fields visible and listed first.
 */
export function buildMehkemeDefaultColumns(musteriColumns = DEFAULT_COLUMNS) {
  const native = []
  const rest = []
  for (const c of musteriColumns || []) {
    if (!c?.key) continue
    if (MEHKEME_NATIVE_KEYS.includes(c.key)) {
      native.push({
        ...c,
        visible: true,
        formVisible: true,
        label: c.key === 'mehkeme_isare' ? '☐' : c.label,
        width:
          typeof c.width === 'number'
            ? c.width
            : c.key === 'mehkeme_isare'
              ? 52
              : c.key === 'rusum_odenilib'
                ? 130
                : c.key === 'mehkeme_status'
                  ? 160
                  : c.key === 'mehkeme_qeyd'
                    ? 200
                    : undefined,
        options: c.key === 'mehkeme_status' ? MEHKEME_STATUS_OPTIONS : c.options,
      })
      continue
    }
    rest.push({
      ...c,
      // Files column is awkward in dense tables — off by default for məhkəmə
      visible: c.type === 'files' ? false : c.visible !== false,
    })
  }
  // Ensure natives exist even if missing from musteriColumns
  for (const key of MEHKEME_NATIVE_KEYS) {
    if (native.some((c) => c.key === key)) continue
    const base = DEFAULT_COLUMNS.find((c) => c.key === key)
    if (base) {
      native.push({
        ...base,
        visible: true,
        formVisible: true,
        label: key === 'mehkeme_isare' ? '☐' : base.label,
      })
    }
  }
  return [...native, ...rest].map((c, i) => ({ ...c, order: i }))
}

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
          label: c.key === 'sira_no' ? base.label : c.label || base.label,
          visible: c.visible !== false,
          formVisible:
            c.key === 'sira_no'
              ? true
              : c.formVisible !== false && c.visible !== false,
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

/**
 * Merge saved Məhkəmə column prefs onto the full müştəri column set.
 * @param {any[] | null} saved
 * @param {any[]} [musteriColumns] full müştəri columns (system + custom)
 */
export function mergeMehkemeColumnConfig(saved, musteriColumns = DEFAULT_COLUMNS) {
  const defaults = buildMehkemeDefaultColumns(musteriColumns)
  const byKey = new Map(defaults.map((c, i) => [c.key, { ...c, order: i }]))

  if (Array.isArray(saved)) {
    saved.forEach((c, i) => {
      if (!c?.key) return
      const base = byKey.get(c.key)
      if (base) {
        byKey.set(c.key, {
          ...base,
          label: c.label || base.label,
          visible: c.visible !== false,
          formVisible: c.formVisible !== false && c.visible !== false,
          order: typeof c.order === 'number' ? c.order : i,
          width: typeof c.width === 'number' ? c.width : base.width,
          options: base.options || c.options,
        })
      } else {
        // Custom column added only in məhkəmə settings
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
  return `${n.toLocaleString('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} AZN`
}

/**
 * Semantic money color classes for table cells.
 * Neutral: alış / satış / aylıq · Green: verilib / gözlənilən · Red: qalan borc
 * Faktiki: >0 green, <0 red, 0 neutral.
 */
export function moneyCellClass(col, value) {
  if (col?.type !== 'money') return undefined
  const key = col.key
  const n = value === null || value === undefined || value === '' ? null : Number(value)
  const finite = n != null && Number.isFinite(n)

  if (key === 'alis_qiymeti' || key === 'satis_qiymeti' || key === 'ayliq_odenis' || key === 'satici_faizi') {
    return 'num num--neutral'
  }
  if (key === 'verilib' || key === 'gozlenilen_gelir') {
    return 'num num--pos'
  }
  if (key === 'qalan_borc') {
    return 'num num--neg'
  }
  if (key === 'faktiki_gelir') {
    if (!finite || n === 0) return 'num num--neutral'
    return n > 0 ? 'num num--pos' : 'num num--neg'
  }
  return 'num num--neutral'
}

export function formatCell(value, col) {
  if (col?.type === 'files' || col?.key === 'senedler') return formatSenedlerCount(value)
  if (col?.type === 'checkbox') return value ? 'Bəli' : 'Xeyr'
  if (value === null || value === undefined || value === '') return '—'
  if (col.type === 'money') return formatMoney(value)
  if (col.type === 'date') return formatDate(value)
  return String(value)
}

export function emptyMusteriForm(columns = DEFAULT_COLUMNS) {
  const base = {
    musteri_id: '',
    sira_no: '',
    extra: {},
    veziyyet: 'Qalıb',
    veziyyet_manual: false,
    senedler: [],
  }
  for (const col of columns) {
    if (col.key === 'senedler') continue
    if (col.custom) {
      base.extra[col.key] = ''
    } else if (col.key === 'verilib' || col.key === 'faiz' || col.key === 'satici_faizi') {
      base[col.key] = '0'
    } else if (col.key === 'veziyyet') {
      base.veziyyet = 'Qalıb'
    } else if (col.type === 'checkbox' || col.key === 'mehkeme_isare') {
      base[col.key] = false
    } else {
      base[col.key] = ''
    }
  }
  return base
}

/**
 * Vəziyyət rules (for now):
 * - Məhkəmə is never auto-changed
 * - Alış = 0 and Satış = 0 → Bitib
 * - Qalıb → Bitib when qalan borc = 0 (verilib >= satış)
 * - otherwise Qalıb (when not Məhkəmə)
 */
export function resolveVeziyyet(form) {
  const current = form?.veziyyet || 'Qalıb'
  if (current === 'Məhkəmə') return 'Məhkəmə'

  const paid = Number(form?.verilib)
  const sale = Number(form?.satis_qiymeti)
  const buy = Number(form?.alis_qiymeti)
  const paidN = Number.isFinite(paid) ? paid : 0
  const saleN = Number.isFinite(sale) ? sale : 0
  const buyN = Number.isFinite(buy) ? buy : 0

  if (buyN === 0 && saleN === 0) return 'Bitib'
  if (saleN > 0 && saleN - paidN <= 0) return 'Bitib'
  return 'Qalıb'
}

/** Auto-update vəziyyət from amounts; never overwrite Məhkəmə. */
export function applyVeziyyetFromAmounts(form) {
  if (form?.veziyyet === 'Məhkəmə') return form
  return { ...form, veziyyet: resolveVeziyyet(form) }
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

function dateOrNull(v) {
  if (!v) return null
  return v
}

function textOrNull(v) {
  const t = (v ?? '').toString().trim()
  return t || null
}

export function personFieldsFromMusteri(m) {
  if (!m) {
    return {
      musteri_id: '',
      ad_soyad: '',
      nomre_1: '',
      nomre_2: '',
      nomre_3: '',
      nomre_4: '',
      nomre_5: '',
      zamin: '',
    }
  }
  return {
    musteri_id: m.id,
    ad_soyad: m.ad_soyad ?? '',
    nomre_1: m.nomre_1 ?? '',
    nomre_2: m.nomre_2 ?? '',
    nomre_3: m.nomre_3 ?? '',
    nomre_4: m.nomre_4 ?? '',
    nomre_5: m.nomre_5 ?? '',
    zamin: m.zamin ?? '',
  }
}

/** Merge müştəri master + latest musteri_bazasi row for phones/zamin */
export function mergePersonPrefill(customer, latestRow) {
  const fromMaster = personFieldsFromMusteri(customer)
  if (!latestRow) return fromMaster
  const pick = (key) => {
    const a = fromMaster[key]
    if (a !== null && a !== undefined && String(a).trim() !== '') return String(a)
    const b = latestRow[key]
    if (b !== null && b !== undefined && String(b).trim() !== '') return String(b)
    return ''
  }
  return {
    musteri_id: customer.id,
    ad_soyad: fromMaster.ad_soyad || latestRow.ad_soyad || '',
    nomre_1: pick('nomre_1'),
    nomre_2: pick('nomre_2'),
    nomre_3: pick('nomre_3'),
    nomre_4: pick('nomre_4'),
    nomre_5: pick('nomre_5'),
    zamin: pick('zamin'),
  }
}

export function toMusterilerPayload(form) {
  return {
    ad_soyad: form.ad_soyad.trim(),
    nomre_1: textOrNull(form.nomre_1),
    nomre_2: textOrNull(form.nomre_2),
    nomre_3: textOrNull(form.nomre_3),
    nomre_4: textOrNull(form.nomre_4),
    nomre_5: textOrNull(form.nomre_5),
    zamin: textOrNull(form.zamin),
    updated_at: new Date().toISOString(),
  }
}

const SYSTEM_DB_KEYS = [
  'musteri_id', 'ad_soyad', 'alis_qiymeti', 'satis_qiymeti', 'verilib',
  'verilme_tarixi', 'bitme_tarixi', 'nece_ay', 'odenis_gunu', 'birinci_ayliq_odenis_tarixi', 'ayliq_odenis', 'faiz',
  'satici', 'satici_faizi',
  'model', 'reng', 'icloud', 'icloud_bagli_nomre', 'itunes', 'itunes_bagli_nomre',
  'imei_1', 'imei_2', 'yaddas', 'kimden_alinib', 'battery_faiz', 'muqavile_nomresi',
  'nomre_1', 'nomre_2', 'nomre_3', 'nomre_4', 'nomre_5', 'zamin', 'kommentler', 'veziyyet',
  'mehkeme_isare', 'rusum_odenilib', 'mehkeme_status', 'mehkeme_qeyd',
]

export function toMusteriPayload(form, musteriId, columns = DEFAULT_COLUMNS) {
  const payload = {
    musteri_id: musteriId || null,
    ad_soyad: (form.ad_soyad || '').trim(),
    updated_at: new Date().toISOString(),
  }

  // Optional Excel # / №
  const sira = numOrNull(form.sira_no)
  if (sira !== null) payload.sira_no = Math.trunc(sira)

  for (const key of SYSTEM_DB_KEYS) {
    if (key === 'musteri_id' || key === 'ad_soyad') continue
    const col = columns.find((c) => c.key === key)
    const type = col?.type || 'text'
    const raw = form[key]
    if (type === 'checkbox' || key === 'mehkeme_isare') {
      payload[key] = Boolean(raw === true || raw === 'true' || raw === '1' || raw === 1)
    } else     if (type === 'money' || type === 'number') {
      let n =
        key === 'verilib' || key === 'faiz' || key === 'satici_faizi'
          ? (numOrNull(raw) ?? 0)
          : numOrNull(raw)
      if (key === 'odenis_gunu' && n !== null) {
        n = Math.min(31, Math.max(1, Math.trunc(n)))
      }
      payload[key] = n
    } else if (type === 'date') {
      payload[key] = dateOrNull(raw)
    } else if (key === 'veziyyet') {
      payload.veziyyet = resolveVeziyyet(form)
    } else {
      payload[key] = textOrNull(raw)
    }
  }

  payload.veziyyet_manual = Boolean(form.veziyyet_manual)
  payload.senedler = parseSenedler(form.senedler)

  const extra = { ...(form.extra || {}) }
  for (const col of columns) {
    if (!col.custom) continue
    const v = form.extra?.[col.key] ?? form[col.key] ?? ''
    if (col.type === 'number' || col.type === 'money') {
      extra[col.key] = numOrNull(v)
    } else if (col.type === 'date') {
      extra[col.key] = dateOrNull(v) 
    } else {
      extra[col.key] = textOrNull(v)
    }
  }
  payload.extra = extra
  return payload
}

export function rowToForm(row, columns = DEFAULT_COLUMNS) {
  const f = emptyMusteriForm(columns)
  f.musteri_id = row.musteri_id || ''
  f.extra = { ...(row.extra || {}) }
  f.senedler = parseSenedler(row.senedler)
  f.veziyyet_manual = Boolean(row.veziyyet_manual)
  for (const col of columns) {
    if (col.key === 'senedler') continue
    if (col.custom) {
      const v = row.extra?.[col.key]
      f.extra[col.key] = v === null || v === undefined ? '' : String(v)
    } else if (col.type === 'checkbox' || col.key === 'mehkeme_isare') {
      f[col.key] = Boolean(row[col.key])
    } else if (col.key !== 'sira_no' && row[col.key] !== null && row[col.key] !== undefined) {
      f[col.key] = String(row[col.key])
    } else if (col.key === 'sira_no' && row.sira_no != null) {
      f.sira_no = String(row.sira_no)
    }
  }
  if (!f.veziyyet) f.veziyyet = resolveVeziyyet(f)
  return f
}

export function getFieldValue(form, col) {
  if (col.custom) return form.extra?.[col.key] ?? ''
  return form[col.key] ?? ''
}

export function setFormField(form, col, value) {
  let next
  if (col.custom) {
    next = { ...form, extra: { ...form.extra, [col.key]: value } }
  } else if (col.key === 'veziyyet') {
    // Only Məhkəmə locks auto updates; Qalıb/Bitib stay auto from amounts
    next = { ...form, veziyyet: value, veziyyet_manual: value === 'Məhkəmə' }
  } else {
    next = { ...form, [col.key]: value }
  }
  if (col.key === 'verilib' || col.key === 'satis_qiymeti' || col.key === 'alis_qiymeti') {
    next = applyVeziyyetFromAmounts(next)
  }
  return next
}

export function getRowValue(row, col) {
  if (col.custom) return row.extra?.[col.key]
  return row[col.key]
}

export function slugifyColumnKey(label) {
  const base = String(label || 'sutun')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ğ/g, 'g')
    .replace(/ç/g, 'c')
    .replace(/ş/g, 's')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  return `custom_${base || 'field'}_${Date.now().toString(36)}`
}
