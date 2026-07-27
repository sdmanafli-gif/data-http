import * as XLSX from 'xlsx'

export const IMPORT_SKIP_KEYS = new Set(['xeyir', 'xeyir_faizle'])
export const IMPORT_ALLOW_READONLY = new Set(['sira_no'])

const ALIASES = {
  tarix: 'tarix',
  date: 'tarix',
  kime: 'kime',
  'kimə': 'kime',
  model: 'model',
  'imei 1': 'imei_1',
  'imeı 1': 'imei_1',
  'imei1': 'imei_1',
  'imei 2': 'imei_2',
  'imeı 2': 'imei_2',
  'serial no': 'serial_no',
  'seriya no': 'serial_no',
  'model no': 'model_no',
  reng: 'reng',
  'rəng': 'reng',
  yaddas: 'yaddas',
  'yaddaş': 'yaddas',
  'kimden alinib': 'kimden_alinib',
  'kimdən alınıb': 'kimden_alinib',
  'alış tarixi': 'alis_tarixi',
  'alis tarixi': 'alis_tarixi',
  'alış qiyməti': 'alis_qiymeti',
  'alis qiymeti': 'alis_qiymeti',
  'satış qiyməti': 'satis_qiymeti',
  'satis qiymeti': 'satis_qiymeti',
  satici: 'satici',
  'satıcı': 'satici',
  'satıcı faizi': 'satici_faizi',
  'satici faizi': 'satici_faizi',
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
  let s = String(raw).trim().replace(/AZN/gi, '').replace(/₼/g, '').replace(/\s/g, '')
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '')
  else s = s.replace(',', '.')
  const n = Number(s)
  return Number.isNaN(n) ? null : n
}

function parseDate(raw) {
  if (!raw) return null
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`
  }
  const s = String(raw).trim()
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    let a = Number(iso[2])
    let b = Number(iso[3])
    if (a > 12 && b <= 12) { const t = a; a = b; b = t }
    return `${iso[1]}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
  }
  const m = s.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/)
  if (m) {
    let day = Number(m[1])
    let month = Number(m[2])
    let year = Number(m[3])
    if (year < 100) year += year >= 70 ? 1900 : 2000
    if (month > 12 && day <= 12) { const t = day; day = month; month = t }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  return null
}

export function coerceValue(raw, col) {
  if (!col || raw === null || raw === undefined || String(raw).trim() === '') return null
  if (col.type === 'money' || col.type === 'number') return parseMoney(raw)
  if (col.type === 'date') return parseDate(raw)
  return String(raw).trim()
}

export function excelRowToForm(excelRow, mapping, columnsByKey) {
  const form = { satici_faizi: '0', tarix: new Date().toISOString().slice(0, 10), extra: {} }
  for (const [excelHeader, dbKey] of Object.entries(mapping)) {
    if (!dbKey) continue
    const col = columnsByKey.get(dbKey)
    if (!col) continue
    const coerced = coerceValue(excelRow[excelHeader], col)
    if (coerced === null) continue
    if (col.custom) form.extra[dbKey] = coerced
    else form[dbKey] = typeof coerced === 'number' ? String(coerced) : coerced
  }
  if (!form.satici_faizi) form.satici_faizi = '0'
  return form
}
