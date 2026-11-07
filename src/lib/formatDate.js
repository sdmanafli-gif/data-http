/**
 * Display dates as dd.mm.yyyy (DB stays ISO / date).
 */
export function formatDate(value) {
  if (value === null || value === undefined || value === '') return '—'
  const s = String(value).trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

/**
 * Bu günün tarixi YYYY-MM-DD — kompüterin (Bakı) vaxtı ilə.
 * `new Date().toISOString().slice(0, 10)` UTC verir: gecə 00:00–04:00 arası dünənki tarixi yazırdı.
 */
export function todayYmd(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
