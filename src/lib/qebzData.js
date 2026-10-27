/**
 * Qəbz üçün məlumat yığır (bazanı yalnız oxuyur, heç nə yazmır).
 */
import { supabase } from './supabase'
import { formatQebzMoney } from './qebz'
import { normMusteriName } from './musteriler'
import { ODENISLER_TABLE, MUSTERI_TABLE, tipLabel as odenisTipLabel, usuluLabel } from '../features/odenisler/constants'
import { LEDGER_TABLE, tipLabel as ledgerTipLabel, computeBalances } from '../features/borc-nisye/constants'
import {
  resolvePaymentSchedule,
  matchPaymentsToSchedule,
  matchedScheduleTotals,
  scheduleTotals,
  statusLabel,
} from '../features/musteri-bazasi/paymentSchedule'

/** Xanada nömrədən başqa yazı da ola bilər (məs. «051 559 30 65 Ad Soyad») — yalnız nömrəni götürür */
export function cleanPhone(raw) {
  const m = String(raw || '').match(/\+?\d[\d\s()-]{6,}\d/)
  return m ? m[0].trim() : ''
}

/** Ödəniş üsulu qəbzdə: «Kart» yazılmır, əvəzinə «Hesab» */
function usulText(usulu, fallback = '') {
  if (usulu === 'kart') return 'Hesab'
  if (usulu === 'nagd') return 'Nağd'
  const l = usuluLabel(usulu)
  if (!l || l === '—') return fallback
  return /kart/i.test(l) ? 'Hesab' : l
}

/** Borc/Nisyə: aldıqda Mədaxil, verdikdə Məxaric */
const LEDGER_DIRECTION = {
  borc_aldim: 'Mədaxil',
  nisye_aldim: 'Mədaxil',
  nisye_odenis: 'Mədaxil',
  borc_verdim: 'Məxaric',
  nisye_verdim: 'Məxaric',
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
    odenisNovu: usulText(pay.odenis_usulu, 'Nağd'),
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

  return {
    tarix: row.tarix,
    no: row.sira_no != null ? `BN-${row.sira_no}` : `BN-${String(row.id).slice(0, 6).toUpperCase()}`,
    qarsiTeref: kime,
    telefon,
    mebleg: Number(row.mebleg) || 0,
    odenisNovu: null,
    emeliyyat: LEDGER_DIRECTION[row.tip] || ledgerTipLabel(row.tip),
    yekunBorcText,
  }
}

/** Bugünkü tarix yerli vaxtla (UTC ilə gecə saatlarında bir gün geri düşməsin) */
function todayLocal() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/**
 * Kredit çıxarışı — saytdakı «Ödəniş qrafiki» ilə eyni hesablama (paymentSchedule.js).
 */
export async function buildKreditCixaris(musteriId) {
  const [{ data: m, error }, { data: pays, error: pErr }] = await Promise.all([
    supabase.from(MUSTERI_TABLE).select('*').eq('id', musteriId).single(),
    supabase
      .from(ODENISLER_TABLE)
      .select('id, tip, mebleg, tarix, odenis_usulu, created_at')
      .eq('musteri_bazasi_id', musteriId),
  ])
  if (error) throw error
  if (pErr) throw pErr

  const payments = [...(pays || [])].sort(sortByTime)
  const schedule = resolvePaymentSchedule(m)
  const matched = matchPaymentsToSchedule(schedule, payments, { aylıq: Number(m.ayliq_odenis) || 0 })
  const t = matchedScheduleTotals(matched, payments)
  const st = scheduleTotals(schedule)

  const round = (n) => Math.round((Number(n) || 0) * 100) / 100
  const sale = Number(m.satis_qiymeti) || st.cemi
  // Qrafik yoxdursa: ödənilib = ilkin + aylıq ödənişlər
  const paid = schedule.length
    ? round(t.paid)
    : round(payments.filter((p) => p.tip !== 'faiz').reduce((a, p) => a + (Number(p.mebleg) || 0), 0))
  const qalan = schedule.length ? round(t.remaining) : Math.max(0, round(sale - paid))
  const faizPaid = round(t.penaltyPaid)
  const faizQaliq = round(t.penaltyRemaining)

  const ayliqLines = schedule.filter((s) => s.type === 'ayliq')
  const months = Number(m.nece_ay) || ayliqLines.length
  const ayliq = Number(m.ayliq_odenis) || Number(ayliqLines[0]?.mebleg) || 0
  const ilkin = schedule.length ? st.ilkin : Math.max(0, sale - months * ayliq)
  const ayStr = (n) => String(Math.round(n * 100) / 100).replace('.', ',')

  const summary = [
    { label: 'İlkin ödəniş', value: formatQebzMoney(ilkin) },
    { label: `${months} ay × ${ayStr(ayliq)} AZN`, value: formatQebzMoney(months * ayliq) },
    { label: 'Cəmi məbləğ', value: formatQebzMoney(sale), bold: true },
    { label: 'Ödənilib', value: formatQebzMoney(paid) },
    { label: 'Qalan borc', value: formatQebzMoney(qalan), bold: true },
    { label: 'Gecikmə faizi', value: formatQebzMoney(t.penalty) },
    { label: 'Ödənilən faiz', value: formatQebzMoney(faizPaid) },
    { label: 'Qalan faiz borcu', value: formatQebzMoney(faizQaliq) },
    { label: 'Cəmi qalan borc və faiz borcu', value: formatQebzMoney(qalan + faizQaliq), bold: true, accent: true },
  ]

  const ayliqMatched = matched.filter((l) => l.type === 'ayliq')
  const paidMonths = ayliqMatched.filter((l) => (Number(l.remaining) || 0) <= 0).length

  return {
    kind: 'kredit',
    tarix: todayLocal(),
    no: `KC-${m.sira_no ?? '?'}`,
    musteri: m.ad_soyad,
    qarsiTeref: m.ad_soyad,
    telefon: cleanPhone(m.nomre_1),
    mehsul: [m.model, m.yaddas, m.reng].filter(Boolean).join(' '),
    verilmeTarixi: m.verilme_tarixi,
    summary,
    totalMonths: ayliqMatched.length,
    paidMonths,
    leftMonths: ayliqMatched.length - paidMonths,
    schedule: matched.map((l) => ({
      no: l.type === 'ilkin' ? 'İlkin' : String(l.installment),
      tarix: l.tarix,
      mebleg: l.owed,
      odenilib: l.paid,
      qaliq: l.remaining,
      gecikme: l.delayDays,
      status: l.status,
      statusLabel: statusLabel(l.status),
    })),
    payments: payments.map((p) => ({
      tarix: p.tarix,
      tip: odenisTipLabel(p.tip),
      mebleg: Number(p.mebleg) || 0,
      usul: usulText(p.odenis_usulu),
    })),
  }
}
