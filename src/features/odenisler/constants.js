import { formatDate } from '../../lib/formatDate'

export const ODENISLER_TABLE = 'odenisler'
export const MUSTERI_TABLE = 'musteri_bazasi'

export const PAYMENT_TYPES = [
  { value: 'ilkin', label: 'İlkin Ödəniş', covers: 'ilkin' },
  { value: 'ayliq', label: 'Aylıq Ödəniş', covers: 'ayliq' },
  { value: 'faiz', label: 'Faiz Borc', covers: 'faiz' },
]

export const PAYMENT_TYPE_MAP = Object.fromEntries(PAYMENT_TYPES.map((t) => [t.value, t]))

export function tipLabel(tip) {
  return PAYMENT_TYPE_MAP[tip]?.label || tip || '—'
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return `${n.toLocaleString('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₼`
}

export { formatDate }

export function emptyOdenisForm(prefill = {}) {
  return {
    musteri_bazasi_id: prefill.musteri_bazasi_id || '',
    sira_no: prefill.sira_no != null ? String(prefill.sira_no) : '',
    ad_soyad: prefill.ad_soyad || '',
    tip: prefill.tip || 'ayliq',
    mebleg: prefill.mebleg != null ? String(prefill.mebleg) : '',
    tarix: prefill.tarix || new Date().toISOString().slice(0, 10),
    qeyd: prefill.qeyd || '',
  }
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

export function toOdenisPayload(form) {
  const mebleg = numOrNull(form.mebleg)
  return {
    musteri_bazasi_id: form.musteri_bazasi_id || null,
    sira_no: form.sira_no === '' || form.sira_no == null ? null : Number(form.sira_no),
    ad_soyad: String(form.ad_soyad || '').trim(),
    tip: form.tip,
    mebleg: mebleg == null ? null : mebleg,
    tarix: form.tarix || null,
    qeyd: String(form.qeyd || '').trim() || null,
    updated_at: new Date().toISOString(),
  }
}

export function rowToForm(row) {
  return {
    musteri_bazasi_id: row.musteri_bazasi_id || '',
    sira_no: row.sira_no == null ? '' : String(row.sira_no),
    ad_soyad: row.ad_soyad || '',
    tip: row.tip || 'ayliq',
    mebleg: row.mebleg == null ? '' : String(row.mebleg),
    tarix: row.tarix || '',
    qeyd: row.qeyd || '',
  }
}

export function clientOptionLabel(row) {
  const no = row.sira_no != null ? `#${row.sira_no}` : '—'
  const name = row.ad_soyad || 'Adsız'
  const model = row.model ? ` · ${row.model}` : ''
  return `${no} · ${name}${model}`
}

/**
 * After insert/delete, sync musteri_bazasi.verilib and .faiz from payment sums.
 * İlkin + Aylıq → verilib; Faiz → faiz.
 */
export async function syncMusteriPaymentTotals(supabase, musteriBazasiId) {
  if (!musteriBazasiId) return { error: null }

  const { data: payments, error } = await supabase
    .from(ODENISLER_TABLE)
    .select('tip, mebleg')
    .eq('musteri_bazasi_id', musteriBazasiId)
  if (error) return { error }

  let verilib = 0
  let faiz = 0
  for (const p of payments || []) {
    const amt = Number(p.mebleg) || 0
    if (p.tip === 'faiz') faiz += amt
    else verilib += amt
  }

  const { data: musteri, error: mErr } = await supabase
    .from(MUSTERI_TABLE)
    .select('id, satis_qiymeti, veziyyet_manual, veziyyet')
    .eq('id', musteriBazasiId)
    .single()
  if (mErr) return { error: mErr }

  const patch = {
    verilib,
    faiz,
    updated_at: new Date().toISOString(),
  }
  if (musteri.veziyyet === 'Məhkəmə') {
    // never overwrite Məhkəmə
  } else {
    const sale = Number(musteri.satis_qiymeti) || 0
    const qalan = sale - verilib
    patch.veziyyet = sale > 0 && qalan <= 0 ? 'Bitib' : 'Qalıb'
    patch.veziyyet_manual = false
  }

  const { error: uErr } = await supabase.from(MUSTERI_TABLE).update(patch).eq('id', musteriBazasiId)
  return { error: uErr || null, verilib, faiz, veziyyet: patch.veziyyet }
}

export function sumPaymentsByType(rows) {
  const out = { ilkin: 0, ayliq: 0, faiz: 0, cemi: 0 }
  for (const r of rows || []) {
    const amt = Number(r.mebleg) || 0
    if (r.tip === 'ilkin') out.ilkin += amt
    else if (r.tip === 'ayliq') out.ayliq += amt
    else if (r.tip === 'faiz') out.faiz += amt
    out.cemi += amt
  }
  return out
}
