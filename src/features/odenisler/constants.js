import { formatDate } from '../../lib/formatDate'
import { VEZIYYET_OPTIONS } from '../musteri-bazasi/constants'

export const ODENISLER_TABLE = 'odenisler'
export const MUSTERI_TABLE = 'musteri_bazasi'
export const ODENIS_KARTLAR_TABLE = 'odenis_kartlar'
export const KASSA_CIXARISLAR_TABLE = 'kassa_cixarislar'

/** Kassa only tracks payments/withdrawals from this date (inclusive). */
export const KASSA_TRACKING_FROM = '2026-08-31'

export const PAYMENT_TYPES = [
  { value: 'ilkin', label: 'İlkin Ödəniş', covers: 'ilkin' },
  { value: 'ayliq', label: 'Aylıq Ödəniş', covers: 'ayliq' },
  { value: 'faiz', label: 'Faiz Borc', covers: 'faiz' },
]

export const PAYMENT_TYPE_MAP = Object.fromEntries(PAYMENT_TYPES.map((t) => [t.value, t]))

export const ODENIS_USULU_OPTIONS = [
  { value: 'nagd', label: 'Nağd' },
  { value: 'kart', label: 'Kart' },
]

export const ODENIS_USULU_MAP = Object.fromEntries(ODENIS_USULU_OPTIONS.map((o) => [o.value, o.label]))

/** Fixed list columns for Ödənişlər (also used by permission editor). */
export const ODENIS_TABLE_COLUMNS = [
  { key: 'tarix', label: 'Tarix', type: 'date', visible: true, width: 120 },
  { key: 'sira_no', label: '#', type: 'number', visible: true, width: 70 },
  { key: 'ad_soyad', label: 'Ad Soyad Ata adı', type: 'text', visible: true, width: 200 },
  {
    key: 'veziyyet',
    label: 'Vəziyyət',
    type: 'select',
    options: [...VEZIYYET_OPTIONS],
    visible: true,
    width: 120,
  },
  {
    key: 'tip',
    label: 'Tip',
    type: 'select',
    options: PAYMENT_TYPES.map((t) => t.value),
    visible: true,
    width: 130,
  },
  { key: 'mebleg', label: 'Məbləğ', type: 'money', visible: true, width: 120 },
  {
    key: 'odenis_usulu',
    label: 'Üsul',
    type: 'select',
    options: ODENIS_USULU_OPTIONS.map((o) => o.value),
    visible: true,
    width: 90,
  },
  { key: 'kart_nomresi', label: 'Kart', type: 'text', visible: true, width: 140 },
  { key: 'qeyd', label: 'Qeyd', type: 'text', visible: true, width: 180 },
]

export function tipLabel(tip) {
  return PAYMENT_TYPE_MAP[tip]?.label || tip || '—'
}

export function usuluLabel(usulu) {
  return ODENIS_USULU_MAP[usulu] || usulu || '—'
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
    odenis_usulu: prefill.odenis_usulu || 'nagd',
    kart_nomresi: prefill.kart_nomresi || '',
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
  const usulu = form.odenis_usulu === 'kart' ? 'kart' : 'nagd'
  const kart = usulu === 'kart' ? String(form.kart_nomresi || '').trim() : null
  return {
    musteri_bazasi_id: form.musteri_bazasi_id || null,
    sira_no: form.sira_no === '' || form.sira_no == null ? null : Number(form.sira_no),
    ad_soyad: String(form.ad_soyad || '').trim(),
    tip: form.tip,
    mebleg: mebleg == null ? null : mebleg,
    tarix: form.tarix || null,
    odenis_usulu: usulu,
    kart_nomresi: kart || null,
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
    odenis_usulu: row.odenis_usulu === 'kart' ? 'kart' : 'nagd',
    kart_nomresi: row.kart_nomresi || '',
    qeyd: row.qeyd || '',
  }
}

export function methodKey(usulu, kart) {
  if (usulu === 'kart') return `kart:${String(kart || '').trim() || '—'}`
  return 'nagd'
}

export function methodLabel(usulu, kart) {
  if (usulu === 'kart') return `Kart · ${String(kart || '').trim() || '—'}`
  return 'Nağd'
}

/**
 * Ensure kart exists in odenis_kartlar for future dropdowns.
 */
export async function ensureOdenisKart(supabase, kartNomresi, createdBy) {
  const kart = String(kartNomresi || '').trim()
  if (!kart) return { error: null }
  const { error } = await supabase.from(ODENIS_KARTLAR_TABLE).upsert(
    {
      kart_nomresi: kart,
      created_by: createdBy || null,
    },
    { onConflict: 'kart_nomresi', ignoreDuplicates: true }
  )
  return { error }
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
    .select('id, alis_qiymeti, satis_qiymeti, veziyyet_manual, veziyyet')
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
    const buy = Number(musteri.alis_qiymeti) || 0
    const qalan = sale - verilib
    if (buy === 0 && sale === 0) patch.veziyyet = 'Bitib'
    else if (sale > 0 && qalan <= 0) patch.veziyyet = 'Bitib'
    else patch.veziyyet = 'Qalıb'
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
