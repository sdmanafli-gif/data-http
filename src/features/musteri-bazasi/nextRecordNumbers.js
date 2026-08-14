import { supabase, fetchAllPages } from '../../lib/supabase'
import { MUSTERI_TABLE } from './constants'

/** Müqavilə № width: 10577 → 00010577 */
const MUQAVILE_PAD = 8

const ICLOUD_RE = /^smelektro(\d+)@icloud\.com$/i

function parsePositiveInt(value) {
  const t = String(value ?? '').trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function formatMuqavileNo(n) {
  return String(Math.trunc(n)).padStart(MUQAVILE_PAD, '0')
}

/** Extract N from smelektroN@icloud.com */
export function parseIcloudNumber(value) {
  const m = String(value ?? '').trim().match(ICLOUD_RE)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

export function formatIcloudEmail(n) {
  return `smelektro${Math.trunc(n)}@icloud.com`
}

export function formatItunesEmail(n) {
  return `test_app${Math.trunc(n)}@icloud.com`
}

export function isAutoItunesEmail(value, n) {
  if (n == null) return false
  return String(value ?? '').trim().toLowerCase() === formatItunesEmail(n).toLowerCase()
}

/**
 * Next müştəri № (sira_no) and müqavilə № = max in DB + 1.
 * Müqavilə only counts pure numeric values; result is zero-padded (8 digits).
 */
export async function fetchNextMusteriNumbers() {
  const [{ data: maxSiraRow, error: siraErr }, { data: muqRows, error: muqErr }] =
    await Promise.all([
      supabase
        .from(MUSTERI_TABLE)
        .select('sira_no')
        .not('sira_no', 'is', null)
        .order('sira_no', { ascending: false })
        .limit(1)
        .maybeSingle(),
      fetchAllPages(() =>
        supabase
          .from(MUSTERI_TABLE)
          .select('muqavile_nomresi')
          .not('muqavile_nomresi', 'is', null)
      ),
    ])

  if (siraErr) throw siraErr
  if (muqErr) throw muqErr

  const maxSira = Number(maxSiraRow?.sira_no)
  let maxMuq = 0
  for (const r of muqRows || []) {
    const n = parsePositiveInt(r.muqavile_nomresi)
    if (n != null && n > maxMuq) maxMuq = n
  }

  return {
    sira_no: String((Number.isFinite(maxSira) ? maxSira : 0) + 1),
    muqavile_nomresi: formatMuqavileNo(maxMuq + 1),
  }
}

/**
 * Next Apple ID number from icloud column (smelektroN@icloud.com → max N + 1).
 */
export async function fetchNextIcloudNumber() {
  const { data, error } = await fetchAllPages(() =>
    supabase.from(MUSTERI_TABLE).select('icloud').not('icloud', 'is', null)
  )
  if (error) throw error

  let max = 0
  for (const r of data || []) {
    const n = parseIcloudNumber(r.icloud)
    if (n != null && n > max) max = n
  }
  return max + 1
}

/** Apply offset for multi-item basket sales (base + index). */
export function offsetRecordNumbers(base, index) {
  const i = Math.max(0, Number(index) || 0)
  const sira = parsePositiveInt(base?.sira_no)
  const muq = parsePositiveInt(base?.muqavile_nomresi)
  return {
    sira_no: sira != null ? String(sira + i) : base?.sira_no ?? '',
    muqavile_nomresi: muq != null ? formatMuqavileNo(muq + i) : base?.muqavile_nomresi ?? '',
  }
}
