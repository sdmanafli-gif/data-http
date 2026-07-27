import * as XLSX from 'xlsx'
import { PAYMENT_TYPES } from './constants'

export const IMPORT_FIELDS = [
  { key: 'sira_no', label: '# / №', type: 'number' },
  { key: 'ad_soyad', label: 'Ad Soyad Ata adı', type: 'text' },
  { key: 'tip', label: 'Ödəniş tipi', type: 'tip' },
  { key: 'mebleg', label: 'Məbləğ', type: 'money' },
  { key: 'tarix', label: 'Tarix', type: 'date' },
  { key: 'qeyd', label: 'Qeyd', type: 'text' },
]

const ALIASES = {
  '#': 'sira_no',
  '№': 'sira_no',
  no: 'sira_no',
  'sira no': 'sira_no',
  sira_no: 'sira_no',
  'ad soyad': 'ad_soyad',
  'ad soyad ata adi': 'ad_soyad',
  'ad soyad ata adı': 'ad_soyad',
  ad_soyad: 'ad_soyad',
  tip: 'tip',
  'odenis tipi': 'tip',
  'ödəniş tipi': 'tip',
  nov: 'tip',
  'növ': 'tip',
  mebleg: 'mebleg',
  'məbləğ': 'mebleg',
  amount: 'mebleg',
  meblag: 'mebleg',
  tarix: 'tarix',
  date: 'tarix',
  'odenis tarixi': 'tarix',
  'ödəniş tarixi': 'tarix',
  qeyd: 'qeyd',
  note: 'qeyd',
  komment: 'qeyd',
}

const TIP_ALIASES = {
  ilkin: 'ilkin',
  'ilkin odenis': 'ilkin',
  'ilkin ödəniş': 'ilkin',
  'ilkin ödeniş': 'ilkin',
  ayliq: 'ayliq',
  aylıq: 'ayliq',
  'ayliq odenis': 'ayliq',
  'aylıq ödəniş': 'ayliq',
  'aylish odenish': 'ayliq',
  'aylış ödəniş': 'ayliq',
  faiz: 'faiz',
  'faiz borc': 'faiz',
  'faiz borcu': 'faiz',
  cerime: 'faiz',
  cərimə: 'faiz',
}

function normalizeHeader(h) {
  return String(h ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

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
        const json = XLSX.utils.sheet_to_json(sheet, {
          defval: '',
          raw: false,
          dateNF: 'dd.mm.yyyy',
        })
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

export function suggestMapping(excelHeaders) {
  const byKey = new Map(IMPORT_FIELDS.map((c) => [c.key, c.key]))
  const byLabel = new Map(IMPORT_FIELDS.map((c) => [normalizeHeader(c.label), c.key]))
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
    if (a > 12 && b <= 12) {
      const t = a
      a = b
      b = t
    }
    return `${iso[1]}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
  }
  const m = s.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/)
  if (m) {
    let day = Number(m[1])
    let month = Number(m[2])
    let year = Number(m[3])
    if (year < 100) year += year >= 70 ? 1900 : 2000
    if (month > 12 && day <= 12) {
      const t = day
      day = month
      month = t
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  // Excel serial as string number
  const serial = Number(s)
  if (!Number.isNaN(serial) && serial > 20000 && serial < 80000) {
    const d = XLSX.SSF.parse_date_code(serial)
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
    }
  }
  return null
}

export function parseTip(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null
  const n = normalizeHeader(raw)
  if (TIP_ALIASES[n]) return TIP_ALIASES[n]
  const exact = PAYMENT_TYPES.find((t) => normalizeHeader(t.label) === n || t.value === n)
  return exact?.value || null
}

export function excelRowToPayload(excelRow, mapping) {
  const raw = {}
  for (const [excelHeader, dbKey] of Object.entries(mapping)) {
    if (!dbKey) continue
    raw[dbKey] = excelRow[excelHeader]
  }

  const tip = parseTip(raw.tip)
  const mebleg = parseMoney(raw.mebleg)
  const tarix = parseDate(raw.tarix) || new Date().toISOString().slice(0, 10)
  let sira_no = null
  if (raw.sira_no !== '' && raw.sira_no != null) {
    const n = Number(String(raw.sira_no).replace(/\s/g, ''))
    if (!Number.isNaN(n)) sira_no = n
  }

  return {
    sira_no,
    ad_soyad: raw.ad_soyad != null ? String(raw.ad_soyad).trim() : '',
    tip,
    mebleg,
    tarix,
    qeyd: raw.qeyd != null && String(raw.qeyd).trim() ? String(raw.qeyd).trim() : null,
  }
}

/**
 * Resolve musteri_bazasi row: prefer sira_no, else exact ad_soyad match.
 */
export function resolveClient(draft, bySira, byName) {
  if (draft.sira_no != null && bySira.has(draft.sira_no)) {
    return bySira.get(draft.sira_no)
  }
  const name = String(draft.ad_soyad || '').trim().toLowerCase()
  if (name && byName.has(name)) {
    const list = byName.get(name)
    if (list.length === 1) return list[0]
    if (draft.sira_no != null) {
      const hit = list.find((c) => c.sira_no === draft.sira_no)
      if (hit) return hit
    }
    return null // ambiguous
  }
  return null
}
