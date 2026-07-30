import * as XLSX from 'xlsx'
import { VEZIYYET_OPTIONS } from './constants'

/** Columns that cannot be imported (auto/generated only) */
export const IMPORT_SKIP_KEYS = new Set([
  'gozlenilen_gelir',
  'faktiki_gelir',
  'qalan_borc',
])

/** Still importable even if marked readonly on the form (e.g. # / №) */
export const IMPORT_ALLOW_READONLY = new Set(['sira_no', 'faiz'])

/** Alias labels → db key for auto-mapping */
const ALIASES = {
  '#': 'sira_no',
  '№': 'sira_no',
  'no.': 'sira_no',
  'no': 'sira_no',
  'nə': 'sira_no',
  'nomre': 'sira_no',
  'sira': 'sira_no',
  'sira no': 'sira_no',
  'sira_no': 'sira_no',
  fio: 'ad_soyad',
  'фио': 'ad_soyad',
  'ad soyad': 'ad_soyad',
  'ad soyad ata adi': 'ad_soyad',
  'ad soyad ata adı': 'ad_soyad',
  'alış qiyməti': 'alis_qiymeti',
  'alis qiymeti': 'alis_qiymeti',
  'satış qiyməti': 'satis_qiymeti',
  'satis qiymeti': 'satis_qiymeti',
  'gözlənilən gəlir': 'gozlenilen_gelir',
  'faktiki gəlir': 'faktiki_gelir',
  verilib: 'verilib',
  'qalan borc': 'qalan_borc',
  'verilmə tarixi': 'verilme_tarixi',
  'verilme tarixi': 'verilme_tarixi',
  'bitmə tarixi': 'bitme_tarixi',
  'bitme tarixi': 'bitme_tarixi',
  'neçə ay': 'nece_ay',
  'nece ay': 'nece_ay',
  'ödəniş günü': 'odenis_gunu',
  'odenis gunu': 'odenis_gunu',
  'odeniş günü': 'odenis_gunu',
  'payment day': 'odenis_gunu',
  'aylıq ödəniş': 'ayliq_odenis',
  'ayliq odenis': 'ayliq_odenis',
  faiz: 'faiz',
  model: 'model',
  'rəng': 'reng',
  reng: 'reng',
  color: 'reng',
  icloud: 'icloud',
  'icloud bağlı nömrə': 'icloud_bagli_nomre',
  itunes: 'itunes',
  'itunes bağlı nömrə': 'itunes_bagli_nomre',
  'imei 1': 'imei_1',
  imei1: 'imei_1',
  'imei 2': 'imei_2',
  imei2: 'imei_2',
  'yaddaş': 'yaddas',
  yaddas: 'yaddas',
  memory: 'yaddas',
  'kimdən alınıb': 'kimden_alinib',
  'kimden alinib': 'kimden_alinib',
  'battery %': 'battery_faiz',
  battery: 'battery_faiz',
  'müqavilə nömrəsi': 'muqavile_nomresi',
  'muqavile nomresi': 'muqavile_nomresi',
  kommentler: 'kommentler',
  'kommentlər': 'kommentler',
  komment: 'kommentler',
  comments: 'kommentler',
  'nömrə 1': 'nomre_1',
  'nomre 1': 'nomre_1',
  'nömrə 2': 'nomre_2',
  'nomre 2': 'nomre_2',
  'nömrə 3': 'nomre_3',
  'nomre 3': 'nomre_3',
  'nömrə 4': 'nomre_4',
  'nomre 4': 'nomre_4',
  'nömrə 5': 'nomre_5',
  'nomre 5': 'nomre_5',
  zamin: 'zamin',
  'vəziyyət': 'veziyyet',
  veziyyet: 'veziyyet',
}

function normalizeHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function getImportableColumns(columns) {
  return columns.filter((c) => {
    if (IMPORT_SKIP_KEYS.has(c.key)) return false
    if (c.readonly && !IMPORT_ALLOW_READONLY.has(c.key)) return false
    return true
  })
}

/**
 * Read first sheet → { headers: string[], rows: object[] }
 * rows use header strings as keys.
 */
export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
          reject(new Error('Excel faylında vərəq tapılmadı.'))
          return
        }
        const sheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json(sheet, {
          defval: '',
          raw: false,
          dateNF: 'dd.mm.yyyy',
        })
        if (!json.length) {
          reject(new Error('Excel faylı boşdur və ya başlıq yoxdur.'))
          return
        }
        const headers = Object.keys(json[0])
        resolve({
          sheetName,
          headers,
          rows: json,
        })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Fayl oxunmadı.'))
    reader.readAsArrayBuffer(file)
  })
}

export function suggestMapping(excelHeaders, importableColumns) {
  const byKey = new Map(importableColumns.map((c) => [c.key, c.key]))
  const byLabel = new Map(
    importableColumns.map((c) => [normalizeHeader(c.label), c.key])
  )
  const mapping = {}
  for (const header of excelHeaders) {
    const n = normalizeHeader(header)
    if (ALIASES[n] && byKey.has(ALIASES[n]) && !IMPORT_SKIP_KEYS.has(ALIASES[n])) {
      mapping[header] = ALIASES[n]
      continue
    }
    if (byLabel.has(n)) {
      mapping[header] = byLabel.get(n)
      continue
    }
    if (byKey.has(n)) {
      mapping[header] = n
      continue
    }
    mapping[header] = ''
  }
  return mapping
}

function parseMoney(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return raw
  let s = String(raw).trim()
  if (!s) return null
  s = s.replace(/AZN/gi, '').replace(/\s/g, '')
  // 1.400,50 or 1,400.50 or 1400
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, '')
  } else {
    s = s.replace(',', '.')
  }
  const n = Number(s)
  return Number.isNaN(n) ? null : n
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Build YYYY-MM-DD only if the calendar date is real. */
function toIsoDate(year, month, day) {
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${pad2(m)}-${pad2(d)}`
}

/**
 * Normalize dates for import. Preferred Excel format: dd.mm.yyyy
 * Stores as YYYY-MM-DD for Postgres.
 */
function parseDate(raw) {
  if (raw === null || raw === undefined || raw === '') return null

  // Excel serial number (when raw:true) — rare with our parser but safe
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 20000 && raw < 80000) {
    const parsed = XLSX.SSF?.parse_date_code?.(raw)
    if (parsed) return toIsoDate(parsed.y, parsed.m, parsed.d)
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return toIsoDate(raw.getFullYear(), raw.getMonth() + 1, raw.getDate())
  }

  const s = String(raw).trim()
  if (!s) return null

  // ISO / Postgres-like: YYYY-MM-DD (optionally with time)
  // Also repair bad "YYYY-DD-MM" leftovers (e.g. 2024-27-02)
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const y = Number(iso[1])
    let a = Number(iso[2])
    let b = Number(iso[3])
    if (a > 12 && b <= 12) {
      // was year-day-month → swap to year-month-day
      return toIsoDate(y, b, a)
    }
    return toIsoDate(y, a, b)
  }

  // dd.mm.yyyy / dd/mm/yyyy / dd-mm-yyyy (user format)
  const m = s.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/)
  if (m) {
    let day = Number(m[1])
    let month = Number(m[2])
    let year = Number(m[3])
    if (year < 100) year += year >= 70 ? 1900 : 2000

    // If Excel dumped US mm/dd/yyyy (e.g. 02/27/2024), middle is > 12 → swap
    if (month > 12 && day <= 12) {
      const tmp = day
      day = month
      month = tmp
    }

    return toIsoDate(year, month, day)
  }

  // Do not use Date.parse() — it treats slash dates as US mm/dd and breaks dd.mm.yyyy
  return null
}

function parseVeziyyet(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  const found = VEZIYYET_OPTIONS.find(
    (o) => o.toLowerCase() === s.toLowerCase()
  )
  if (found) return found
  // common typos without diacritics
  const map = {
    qalib: 'Qalıb',
    bitib: 'Bitib',
    mehkeme: 'Məhkəmə',
    məhkəmə: 'Məhkəmə',
  }
  return map[s.toLowerCase()] || null
}

export function coerceValue(raw, col) {
  if (!col) return null
  if (raw === null || raw === undefined || String(raw).trim() === '') return null
  if (col.key === 'veziyyet') return parseVeziyyet(raw)
  if (col.type === 'money' || col.type === 'number') return parseMoney(raw)
  if (col.type === 'date') return parseDate(raw)
  return String(raw).trim()
}

/**
 * Build form-like object from one excel row + mapping
 */
export function excelRowToForm(excelRow, mapping, columnsByKey) {
  const form = {
    ad_soyad: '',
    sira_no: '',
    verilib: '0',
    faiz: '0',
    veziyyet: 'Qalıb',
    veziyyet_manual: false,
    extra: {},
  }
  let veziyyetFromExcel = false
  for (const [excelHeader, dbKey] of Object.entries(mapping)) {
    if (!dbKey || IMPORT_SKIP_KEYS.has(dbKey)) continue
    const col = columnsByKey.get(dbKey)
    if (!col) continue
    const coerced = coerceValue(excelRow[excelHeader], col)
    if (coerced === null) continue
    if (col.custom) {
      form.extra[dbKey] = coerced
    } else {
      form[dbKey] = typeof coerced === 'number' ? String(coerced) : coerced
      if (dbKey === 'veziyyet') veziyyetFromExcel = true
    }
  }
  if (!form.verilib) form.verilib = '0'
  if (!form.faiz) form.faiz = '0'
  if (veziyyetFromExcel) {
    form.veziyyet_manual = true
  } else {
    form.veziyyet_manual = false
    const paid = Number(form.verilib) || 0
    const sale = Number(form.satis_qiymeti) || 0
    const buy = Number(form.alis_qiymeti) || 0
    if (buy === 0 && sale === 0) form.veziyyet = 'Bitib'
    else if (sale > 0 && paid >= sale) form.veziyyet = 'Bitib'
    else form.veziyyet = 'Qalıb'
  }
  return form
}
