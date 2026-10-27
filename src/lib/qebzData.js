/**
 * Qəbz üçün məlumat yığır (bazanı yalnız oxuyur, heç nə yazmır).
 */
import { supabase } from './supabase'
import { formatQebzMoney } from './qebz'
import { normMusteriName } from './musteriler'
import { ODENISLER_TABLE, MUSTERI_TABLE, tipLabel as odenisTipLabel, usuluLabel } from '../features/odenisler/constants'
import { LEDGER_TABLE, tipLabel as ledgerTipLabel, computeBalances } from '../features/borc-nisye/constants'

/** Xanada nömrədən başqa yazı da ola bilər (məs. «051 559 30 65 Ad Soyad») — yalnız nömrəni götürür */
export function cleanPhone(raw) {
  const m = String(raw || '').match(/\+?\d[\d\s()-]{6,}\d/)
  return m ? m[0].trim() : ''
}

function sortByTime(a, b) {
  const at = a.tarix || ''
  const bt = b.tarix || ''
  if (at !== bt) return at.localeCompare(bt)
  const ac = a.created_at || ''
  const bc = b.created_at || ''
  if (ac !== bc) return ac.localeCompare(bc)
  return String(a.id).localeCompare(String(b.id))
}

/**
 * Kredit ödənişi qəbzi.
 * Qəbz № = K-<müştəri №>/<neçənci ödənişdir>.
 * Yekun borc = satış qiyməti − bu ödənişə qədər (daxil) ödənənlər (faiz ödənişləri sayılmır).
 */
export async function buildCreditQebz(paymentId) {
  const { data: pay, error } = await supabase.from(ODENISLER_TABLE).select('*').eq('id', paymentId).single()
  if (error) throw error

  const [{ data: m, error: mErr }, { data: all, error: aErr }] = await Promise.all([
    supabase
      .from(MUSTERI_TABLE)
      .select('id, sira_no, ad_soyad, nomre_1, satis_qiymeti, model')
      .eq('id', pay.musteri_bazasi_id)
      .maybeSingle(),
    supabase
      .from(ODENISLER_TABLE)
      .select('id, tip, mebleg, tarix, created_at')
      .eq('musteri_bazasi_id', pay.musteri_bazasi_id),
  ])
  if (mErr) throw mErr
  if (aErr) throw aErr

  const list = [...(all || [])].sort(sortByTime)
  const idx = list.findIndex((p) => p.id === pay.id)
  let paid = 0
  for (let i = 0; i <= idx; i++) {
    if (list[i].tip !== 'faiz') paid += Number(list[i].mebleg) || 0
  }
  const sale = Number(m?.satis_qiymeti) || 0
  const qalan = Math.max(0, Math.round((sale - paid) * 100) / 100)
  const siraNo = m?.sira_no ?? pay.sira_no

  return {
    tarix: pay.tarix,
    no: `K-${siraNo ?? '?'}/${idx + 1}`,
    qarsiTeref: m?.ad_soyad || pay.ad_soyad,
    telefon: cleanPhone(m?.nomre_1),
    mebleg: Number(pay.mebleg) || 0,
    odenisNovu: usuluLabel(pay.odenis_usulu) !== '—' ? usuluLabel(pay.odenis_usulu) : 'Nağd',
    emeliyyat: `Mədaxil — ${odenisTipLabel(pay.tip)}`,
    mehsul: m?.model || '',
    yekunBorcText: formatQebzMoney(qalan),
  }
}

/** Ada görə telefon: əvvəl Təchizatçılar, sonra Müştərilər */
async function phoneByName(name) {
  const k = normMusteriName(name)
  if (!k) return ''
  const [{ data: t }, { data: m }] = await Promise.all([
    supabase.from('techizatcilar').select('ad_soyad, nomre_1').ilike('ad_soyad', name.trim()),
    supabase.from('musteriler').select('ad_soyad, nomre_1').ilike('ad_soyad', name.trim()),
  ])
  const hit = [...(t || []), ...(m || [])].find((r) => normMusteriName(r.ad_soyad) === k && r.nomre_1)
  return cleanPhone(hit?.nomre_1)
}

/**
 * Borc / Nisyə əməliyyatı qəbzi.
 * Yekun borc = bu əməliyyata qədər (daxil) qalıq borc + qalıq nisyə.
 * Müsbət → qarşı tərəf bizə borcludur, mənfi → biz ona borcluyuq.
 */
export async function buildLedgerQebz(row) {
  const kime = String(row.kime || '').trim()
  const [{ data: all, error }, telefon] = await Promise.all([
    supabase.from(LEDGER_TABLE).select('id, kime, tip, mebleg, tarix, sira_no, created_at').eq('kime', kime),
    phoneByName(kime),
  ])
  if (error) throw error

  const list = [...(all || [])].sort((a, b) => {
    const at = a.tarix || ''
    const bt = b.tarix || ''
    if (at !== bt) return at.localeCompare(bt)
    const as = a.sira_no ?? 0
    const bs = b.sira_no ?? 0
    if (as !== bs) return as - bs
    return sortByTime(a, b)
  })
  const idx = list.findIndex((r) => r.id === row.id)
  const upTo = idx >= 0 ? list.slice(0, idx + 1) : list
  const bal = computeBalances(upTo)[0] || { qaliq_borc: 0, qaliq_nisye: 0 }
  const net = Math.round(((bal.qaliq_borc || 0) + (bal.qaliq_nisye || 0)) * 100) / 100

  let yekunBorcText = formatQebzMoney(0)
  if (net > 0) yekunBorcText = `${formatQebzMoney(net)} (sizin borcunuz)`
  else if (net < 0) yekunBorcText = `${formatQebzMoney(-net)} (bizim borcumuz)`

  const mehsul = [row.mehsul, [row.imei_1, row.imei_2].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')

  return {
    tarix: row.tarix,
    no: row.sira_no != null ? `BN-${row.sira_no}` : `BN-${String(row.id).slice(0, 6).toUpperCase()}`,
    qarsiTeref: kime,
    telefon,
    mebleg: Number(row.mebleg) || 0,
    odenisNovu: null,
    emeliyyat: ledgerTipLabel(row.tip),
    mehsul,
    yekunBorcText,
  }
}
