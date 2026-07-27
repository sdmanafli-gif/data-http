import * as XLSX from 'xlsx'
import { STATUS_OPTIONS } from './constants'

export const IMPORT_SKIP_KEYS = new Set([])
export const IMPORT_ALLOW_READONLY = new Set(['sira_no'])

const ALIASES = {
  '#': 'sira_no',
  '№': 'sira_no',
  no: 'sira_no',
  model: 'model',
  reng: 'reng',
  'rəng': 'reng',
  color: 'reng',
  battery: 'battery_faiz',
  baterry: 'battery_faiz',
  'battery %': 'battery_faiz',
  tarix: 'alis_tarixi',
  date: 'alis_tarixi',
  'alış tarixi': 'alis_tarixi',
  'alis tarixi': 'alis_tarixi',
  qiymet: 'alis_qiymeti',
  'qiymət': 'alis_qiymeti',
  price: 'alis_qiymeti',
  'alış qiyməti': 'alis_qiymeti',
  'alis qiymeti': 'alis_qiymeti',
  'odenis novu': 'odenis_novu',
  'ödəniş növü': 'odenis_novu',
  odenis_novu: 'odenis_novu',
  nisye: 'odenis_novu',
  'qaytarma tarixi': 'qaytarma_tarixi',
  qaytarma_tarixi: 'qaytarma_tarixi',
  yaddas: 'yaddas',
  'yaddaş': 'yaddas',
  memory: 'yaddas',
  hardan: 'kimden_alinib',
  'kimdən alınıb': 'kimden_alinib',
  'kimden alinib': 'kimden_alinib',
  nomre: 'nomre',
  'nömrə': 'nomre',
  number: 'nomre',
  phone: 'nomre',
  sexsiyyet: 'sexsiyyet',
  'şəxsiyyət': 'sexsiyyet',
  sexsiyet: 'sexsiyyet',
  'imei 1': 'imei_1',
  imei1: 'imei_1',
  'imei 2': 'imei_2',
  imei2: 'imei_2',
  'serial no': 'serial_no',
  serial: 'serial_no',
  'serial nömrəsi': 'serial_no',
  'model no': 'model_no',
  'model nömrəsi': 'model_no',
  status: 'status',
  veziyyet: 'status',
  'vəziyyət': 'status',
  nov: 'nov',
  'növ': 'nov',
  'təzə / köhnə': 'veziyyet_cihaz',
  condition: 'veziyyet_cihaz',
  sim: 'sim_type',
  miqdar: 'miqdar',
  qnt: 'miqdar',
  quantity: 'miqdar',
  'miqdar': 'miqdar',
  kommentler: 'kommentler',
  'kommentlər': 'kommentler',
}

function normalizeHeader(h) {
  return String(h ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function getImportableColumns(columns) {
  return columns.filter((c) => {
    if (IMPORT_SKIP_KEYS.has(c.key)) return false
    if (c.readonly && !IMPORT_ALLOW_READONLY.has(c.key)) return false
    return true
  })
}

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) { reject(new Error('Vərəq tapılmadı.')); return }
        const sheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, dateNF: 'dd.mm.yyyy' })
        if (!json.length) { reject(new Error('Fayl boşdur.')); return }
        resolve({ sheetName, headers: Object.keys(json[0]), rows: json })
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('Fayl oxunmadı.'))
    reader.readAsArrayBuffer(file)
  })
}

export function suggestMapping(excelHeaders, importableColumns) {
  const byKey = new Map(importableColumns.map((c) => [c.key, c.key]))
  const byLabel = new Map(importableColumns.map((c) => [normalizeHeader(c.label), c.key]))
  const mapping = {}
  for (const header of excelHeaders) {
    const n = normalizeHeader(header)
    if (ALIASES[n] && byKey.has(ALIASES[n])) mapping[header] = ALIASES[n]
    else if (byLabel.has(n)) mapping[header] = byLabel.get(n)
    else if (byKey.has(n)) mapping[header] = n
    else mapping[header] = ''
  }
  return mapping
}

function parseMoney(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return raw
  let s = String(raw).trim().replace(/AZN/gi, '').replace(/₼/g, '').replace(/%/g, '').replace(/\s/g, '')
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '')
  else s = s.replace(',', '.')
  const n = Number(s)
  return Number.isNaN(n) ? null : n
}

function parseDate(raw) {
  if (!raw) return null
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear()
    const m = raw.getMonth() + 1
    const d = raw.getDate()
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  const s = String(raw).trim()
  if (!s) return null

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    let y = Number(iso[1])
    let a = Number(iso[2])
    let b = Number(iso[3])
    if (a > 12 && b <= 12) {
      const t = a; a = b; b = t
    }
    if (a < 1 || a > 12 || b < 1 || b > 31) return null
    return `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
  }

  const m = s.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/)
  if (m) {
    let day = Number(m[1])
    let month = Number(m[2])
    let year = Number(m[3])
    if (year < 100) year += year >= 70 ? 1900 : 2000
    if (month > 12 && day <= 12) {
      const t = day; day = month; month = t
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  return null
}

export function coerceValue(raw, col) {
  if (!col || raw === null || raw === undefined || String(raw).trim() === '') return null
  if (col.key === 'status') {
    const s = String(raw).trim().toLowerCase()
    const map = {
      movcud: 'available',
      mövcud: 'available',
      available: 'available',
      satilib: 'sold',
      satılıb: 'sold',
      sold: 'sold',
      rezerv: 'reserved',
      reserved: 'reserved',
      qaytarilib: 'returned',
      qaytarılıb: 'returned',
      returned: 'returned',
      diger: 'other',
      digər: 'other',
      other: 'other',
    }
    if (STATUS_OPTIONS.includes(s)) return s
    return map[s] || 'available'
  }
  if (col.key === 'odenis_novu') {
    const s = String(raw).trim().toLowerCase()
    if (s.includes('nis') || s === 'credit') return 'nisye'
    if (s.includes('nağ') || s.includes('nag') || s === 'cash') return 'nagd'
    if (s === 'nisye' || s === 'nagd') return s
    return null
  }
  if (col.key === 'veziyyet_cihaz') {
    const s = String(raw).trim().toLowerCase()
    if (s.includes('tez') || s === 'new') return 'teze'
    if (s.includes('kohn') || s === 'used') return 'kohne'
    return ['teze', 'kohne'].includes(s) ? s : null
  }
  if (col.key === 'battery_faiz' || col.type === 'money' || col.type === 'number') return parseMoney(raw)
  if (col.type === 'date') return parseDate(raw)
  return String(raw).trim()
}

export function excelRowToForm(excelRow, mapping, columnsByKey) {
  const form = { status: 'available', miqdar: '1', extra: {} }
  for (const [excelHeader, dbKey] of Object.entries(mapping)) {
    if (!dbKey) continue
    const col = columnsByKey.get(dbKey)
    if (!col) continue
    const coerced = coerceValue(excelRow[excelHeader], col)
    if (coerced === null) continue
    if (col.custom) form.extra[dbKey] = coerced
    else form[dbKey] = typeof coerced === 'number' ? String(coerced) : coerced
  }
  if (!form.status) form.status = 'available'
  if (!form.miqdar) form.miqdar = '1'
  return form
}
