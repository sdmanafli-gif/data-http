import * as XLSX from 'xlsx'
import { parseExcelDate, parseAmount } from './constants'

function normalizeHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** Target fields the user can map Excel columns onto. */
export const IMPORT_FIELDS = [
  { key: 'kime', label: 'Kimə', required: true },
  { key: 'tarix', label: 'Tarix' },
  { key: 'qaytarma_tarixi', label: 'Qaytarma tarixi' },
  { key: 'borc_verdim', label: 'Borc verdim' },
  { key: 'borc_aldim', label: 'Borc aldım' },
  { key: 'nisye_verdim', label: 'Nisyə verdim' },
  { key: 'nisye_odenis', label: 'Nisyə ödəniş' },
  { key: 'mehsul', label: 'Məhsul' },
  { key: 'imei_1', label: 'IMEI 1' },
  { key: 'imei_2', label: 'IMEI 2' },
  { key: 'qeyd', label: 'Qeyd' },
]

const HEADER_ALIASES = {
  kime: 'kime',
  'kimə': 'kime',
  tarix: 'tarix',
  date: 'tarix',
  qaytarma: 'qaytarma_tarixi',
  'qaytarma tarixi': 'qaytarma_tarixi',
  'ödəniş tarixi': 'qaytarma_tarixi',
  'odenis tarixi': 'qaytarma_tarixi',
  due: 'qaytarma_tarixi',
  'borc verdim': 'borc_verdim',
  'borc aldım': 'borc_aldim',
  'borc aldim': 'borc_aldim',
  'nisyə verdim': 'nisye_verdim',
  'nisye verdim': 'nisye_verdim',
  'nisyə ödəniş': 'nisye_odenis',
  'nisyə odenis': 'nisye_odenis',
  'nisye odenis': 'nisye_odenis',
  'nisyə odəniş': 'nisye_odenis',
  mehsul: 'mehsul',
  'məhsul': 'mehsul',
  'imei 1': 'imei_1',
  'imeı 1': 'imei_1',
  imei1: 'imei_1',
  'imei 2': 'imei_2',
  'imeı 2': 'imei_2',
  imei2: 'imei_2',
  qeyd: 'qeyd',
  note: 'qeyd',
  komment: 'qeyd',
  'kommentlər': 'qeyd',
}


const SKIP_IF_CONTAINS = ['cəmi', 'cemi', 'qalıq', 'qaliq']

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
          reject(new Error('Vərəq tapılmadı.'))
          return
        }
        const sheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true, cellDates: true })
        if (!json.length) {
          reject(new Error('Fayl boşdur.'))
          return
        }
        resolve({ sheetName, headers: Object.keys(json[0]), rows: json })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Fayl oxunmadı.'))
    reader.readAsArrayBuffer(file)
  })
}

/** Suggest excelHeader → fieldKey mapping (auto). */
export function suggestMapping(excelHeaders) {
  const valid = new Set(IMPORT_FIELDS.map((f) => f.key))
  const mapping = {}
  const used = new Set()
  for (const header of excelHeaders) {
    const n = normalizeHeader(header)
    if (SKIP_IF_CONTAINS.some((s) => n.includes(s))) {
      mapping[header] = ''
      continue
    }
    // Skip second "Müştəri" summary blocks by requiring alias match only
    let key = HEADER_ALIASES[n] || null
    if (!key && n === 'müştəri') {
      mapping[header] = ''
      continue
    }
    if (key && valid.has(key) && !used.has(key)) {
      mapping[header] = key
      used.add(key)
    } else {
      mapping[header] = ''
    }
  }
  return mapping
}

/** Convert excelHeader→fieldKey into fieldKey→excelHeader for row parsing. */
export function mappingToHeaderMap(mapping) {
  const map = {}
  for (const [header, key] of Object.entries(mapping || {})) {
    if (key) map[key] = header
  }
  return map
}

export function countPreviewEntries(rows, mapping) {
  const headerMap = mappingToHeaderMap(mapping)
  let n = 0
  for (const row of rows) n += excelRowToEntries(row, headerMap).length
  return n
}

/**
 * One Excel row may contain several amount columns → multiple ledger entries.
 * Amount 0 / empty with a note still creates a comment entry.
 */
export function excelRowToEntries(row, headerMap) {
  const get = (key) => {
    const h = headerMap[key]
    return h == null ? '' : row[h]
  }

  const kime = String(get('kime') ?? '').trim()
  if (!kime) return []

  const tarix = parseExcelDate(get('tarix'))
  const qaytarma_tarixi = parseExcelDate(get('qaytarma_tarixi'))
  const mehsul = String(get('mehsul') ?? '').trim() || null
  const imei_1 = String(get('imei_1') ?? '').trim() || null
  const imei_2 = String(get('imei_2') ?? '').trim() || null
  const qeyd = String(get('qeyd') ?? '').trim() || null
  const hasNote = Boolean(qeyd || mehsul)

  const tips = [
    ['borc_verdim', get('borc_verdim')],
    ['borc_aldim', get('borc_aldim')],
    ['nisye_verdim', get('nisye_verdim')],
    ['nisye_odenis', get('nisye_odenis')],
  ]

  const entries = []
  for (const [tip, raw] of tips) {
    const blank = raw === null || raw === undefined || String(raw).trim() === ''
    if (blank) continue
    const mebleg = parseAmount(raw, { allowZero: true })
    if (mebleg == null) continue
    // Skip pure zeros unless this row is intentionally recording with a note
    // (Excel often has literal 0). Keep zero rows when note exists OR when
    // user mapped only this amount column with 0.
    if (mebleg === 0 && !hasNote) continue
    entries.push({
      kime,
      tarix,
      qaytarma_tarixi,
      tip,
      mebleg,
      mehsul,
      imei_1,
      imei_2,
      qeyd,
      updated_at: new Date().toISOString(),
    })
  }

  // No amount columns filled, but there is a comment / product note
  if (!entries.length && hasNote) {
    entries.push({
      kime,
      tarix,
      qaytarma_tarixi,
      tip: 'qeyd',
      mebleg: 0,
      mehsul,
      imei_1,
      imei_2,
      qeyd,
      updated_at: new Date().toISOString(),
    })
  }

  return entries
}
