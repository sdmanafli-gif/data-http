import { useEffect, useMemo, useState } from 'react'
import { supabase, fetchAllPages } from '../lib/supabase'
import { computeBalances, LEDGER_TABLE } from '../features/borc-nisye/constants'
import { buildYigimRows } from '../features/yigim/YigimPage'
import '../styles/shared.css'
import './analitika.css'

/**
 * Analitika — biznesin ümumi vəziyyəti bir səhifədə (yalnız oxuyur, heç nə yazmır).
 *  · Satışlar: Nağd / Nisyə (nagd_satish) və Kredit (musteri_bazasi)
 *  · Mənfəət: satış − alış − satıcı faizi (+ yığılan cərimə faizi − nömrə xərcləri)
 *  · Yığım: ödəniş qrafikinə görə gözlənilən / yığılan, gecikmələr
 *  · Borc / alacaq: kredit qalıqları + Borc / Nisyə qalıqları, Depodakı mal
 */

const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek']
const MONTHS_FULL = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr']

const PERIODS = [
  { value: 'this_month', label: 'Bu ay' },
  { value: 'last_month', label: 'Keçən ay' },
  { value: 'last_3', label: 'Son 3 ay' },
  { value: 'this_year', label: 'Bu il' },
  { value: 'last_12', label: 'Son 12 ay' },
  { value: 'all', label: 'Hamısı' },
  { value: 'custom', label: 'Özəl' },
]

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function azn(n, { sign = false } = {}) {
  const v = r2(n)
  const [i, d] = Math.abs(v).toFixed(2).split('.')
  const s = `${i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${d === '00' ? '' : `,${d}`} ₼`
  if (v < 0) return `−${s}`
  return sign && v > 0 ? `+${s}` : s
}

function shortAzn(n) {
  const v = Math.abs(num(n))
  const sgn = num(n) < 0 ? '−' : ''
  if (v >= 1_000_000) return `${sgn}${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (v >= 1000) return `${sgn}${Math.round(v / 1000)}k`
  return `${sgn}${Math.round(v)}`
}

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null)
const pctText = (p) => (p == null ? '—' : `${String(p).replace('.', ',')}%`)

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayYmd() {
  return ymd(new Date())
}

function dmy(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '—'
}

function periodRange(period, customFrom, customTo) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (period) {
    case 'this_month':
      return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) }
    case 'last_month':
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) }
    case 'last_3':
      return { from: ymd(new Date(y, m - 2, 1)), to: ymd(new Date(y, m + 1, 0)) }
    case 'this_year':
      return { from: `${y}-01-01`, to: `${y}-12-31` }
    case 'last_12':
      return { from: ymd(new Date(y, m - 11, 1)), to: ymd(new Date(y, m + 1, 0)) }
    case 'custom': {
      let from = customFrom || null
      let to = customTo || null
      if (from && to && from > to) [from, to] = [to, from]
      return { from, to }
    }
    default:
      return { from: null, to: null }
  }
}

/** Eyni uzunluqda əvvəlki dövr (müqayisə üçün) */
function previousRange({ from, to }) {
  if (!from || !to) return null
  const a = new Date(`${from}T00:00:00`)
  const b = new Date(`${to}T00:00:00`)
  const days = Math.round((b - a) / 86400000) + 1
  // Tam ay(lar)dırsa — əvvəlki eyni sayda ay
  if (a.getDate() === 1 && new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1).getDate() === 1) {
    const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1
    return { from: ymd(new Date(a.getFullYear(), a.getMonth() - months, 1)), to: ymd(new Date(a.getFullYear(), a.getMonth(), 0)) }
  }
  return { from: ymd(new Date(a.getFullYear(), a.getMonth(), a.getDate() - days)), to: ymd(new Date(a.getFullYear(), a.getMonth(), a.getDate() - 1)) }
}

const inRange = (d, r) => {
  const s = String(d || '').slice(0, 10)
  if (!s) return false
  if (r.from && s < r.from) return false
  if (r.to && s > r.to) return false
  return true
}

const monthKey = (d) => String(d || '').slice(0, 7)

/* ---------- Hesablamalar ---------- */

function nagdProfit(r) {
  return num(r.satis_qiymeti) - num(r.alis_qiymeti) - num(r.satici_faizi)
}

function kreditProfit(m) {
  if (m.gozlenilen_gelir != null && m.gozlenilen_gelir !== '') return num(m.gozlenilen_gelir)
  return num(m.satis_qiymeti) - num(m.alis_qiymeti) - num(m.satici_faizi)
}

function salesSummary(data, range) {
  const nagd = { count: 0, satis: 0, alis: 0, menfeet: 0 }
  const nisye = { count: 0, satis: 0, alis: 0, menfeet: 0 }
  const kredit = { count: 0, satis: 0, alis: 0, menfeet: 0, qalan: 0 }
  for (const r of data.nagd) {
    if (!inRange(r.tarix, range)) continue
    const t = r.satis_novu === 'nisye' ? nisye : nagd
    t.count += 1
    t.satis += num(r.satis_qiymeti)
    t.alis += num(r.alis_qiymeti)
    t.menfeet += nagdProfit(r)
  }
  for (const m of data.kredit) {
    if (!inRange(m.verilme_tarixi, range)) continue
    kredit.count += 1
    kredit.satis += num(m.satis_qiymeti)
    kredit.alis += num(m.alis_qiymeti)
    kredit.menfeet += kreditProfit(m)
    kredit.qalan += Math.max(0, num(m.qalan_borc))
  }
  let faiz = 0
  let odenis = 0
  for (const p of data.odenisler) {
    if (!inRange(p.tarix, range)) continue
    odenis += num(p.mebleg)
    if (p.tip === 'faiz') faiz += num(p.mebleg)
  }
  let alis = 0
  let alisCount = 0
  for (const d of data.depo) {
    if (!inRange(d.alis_tarixi, range)) continue
    alis += num(d.alis_qiymeti) * Math.max(1, num(d.miqdar) || 1)
    alisCount += 1
  }
  let nomreXerc = 0
  for (const n of data.nomreler) if (inRange(n.alis_tarixi, range)) nomreXerc += num(n.alis_qiymeti)
  for (const b of data.nomreBalans) if (inRange(b.tarix, range)) nomreXerc += num(b.mebleg)

  const satisCemi = nagd.satis + nisye.satis + kredit.satis
  const satisMenfeet = nagd.menfeet + nisye.menfeet + kredit.menfeet
  const xalis = satisMenfeet + faiz - nomreXerc
  return {
    nagd,
    nisye,
    kredit,
    faiz: r2(faiz),
    odenis: r2(odenis),
    alis: r2(alis),
    alisCount,
    nomreXerc: r2(nomreXerc),
    satisCemi: r2(satisCemi),
    satisCount: nagd.count + nisye.count + kredit.count,
    satisMenfeet: r2(satisMenfeet),
    xalis: r2(xalis),
  }
}

function collectionSummary(yigimRows, range, today) {
  let owed = 0
  let paid = 0
  let lines = 0
  for (const r of yigimRows) {
    if (!inRange(r.tarix, range)) continue
    if (r.tarix > today) continue // gələcək taksitlər yığım faizini korlamasın
    owed += num(r.owed)
    paid += num(r.paid)
    lines += 1
  }
  return { owed: r2(owed), paid: r2(paid), remaining: r2(owed - paid), lines, rate: pct(paid, owed) }
}

/* ---------- Kiçik komponentlər ---------- */

function Kpi({ label, value, hint, tone, delta }) {
  return (
    <div className={`an-kpi${tone ? ` an-kpi--${tone}` : ''}`}>
      <div className="an-kpi__label">{label}</div>
      <div className="an-kpi__value">{value}</div>
      {(hint || delta) && (
        <div className="an-kpi__hint">
          {delta}
          {hint}
        </div>
      )}
    </div>
  )
}

function Delta({ cur, prev }) {
  if (prev == null || !(Math.abs(prev) > 0.009)) return null
  const p = Math.round(((cur - prev) / Math.abs(prev)) * 100)
  if (!Number.isFinite(p)) return null
  const up = p >= 0
  return (
    <span className={`an-delta ${up ? 'an-delta--up' : 'an-delta--down'}`} title="Əvvəlki eyni dövrlə müqayisə">
      {up ? '▲' : '▼'} {Math.abs(p)}%{' '}
    </span>
  )
}

/** Sadə qruplaşdırılmış sütun qrafiki (SVG, kənar paket yoxdur) */
function BarChart({ data, series, height = 220 }) {
  const W = 760
  const H = height
  const pad = { l: 46, r: 8, t: 12, b: 28 }
  const values = data.flatMap((d) => series.map((s) => num(d[s.key])))
  const max = Math.max(1, ...values)
  const min = Math.min(0, ...values)
  const span = max - min || 1
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const y = (v) => pad.t + ((max - v) / span) * innerH
  const groupW = innerW / Math.max(1, data.length)
  const barW = Math.max(3, Math.min(22, (groupW * 0.8) / series.length))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + span * t)
  return (
    <div className="an-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" preserveAspectRatio="none">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="an-chart__grid" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="an-chart__axis">
              {shortAzn(t)}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} className="an-chart__zero" />
        {data.map((d, i) => {
          const gx = pad.l + i * groupW + (groupW - barW * series.length) / 2
          return (
            <g key={d.label}>
              {series.map((s, j) => {
                const v = num(d[s.key])
                const top = y(Math.max(0, v))
                const h = Math.max(1, Math.abs(y(v) - y(0)))
                return (
                  <rect
                    key={s.key}
                    x={gx + j * barW}
                    y={top}
                    width={barW - 1}
                    height={h}
                    rx="2"
                    fill={v < 0 ? 'var(--color-danger)' : s.color}
                  >
                    <title>{`${d.full || d.label} · ${s.label}: ${azn(v)}`}</title>
                  </rect>
                )
              })}
              <text x={pad.l + i * groupW + groupW / 2} y={H - 8} textAnchor="middle" className="an-chart__axis">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="an-legend">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function ShareBar({ items }) {
  const total = items.reduce((a, it) => a + Math.max(0, num(it.value)), 0)
  return (
    <div>
      <div className="an-share">
        {items.map((it) =>
          it.value > 0 ? (
            <span
              key={it.label}
              style={{ width: `${(it.value / (total || 1)) * 100}%`, background: it.color }}
              title={`${it.label}: ${azn(it.value)} (${pctText(pct(it.value, total))})`}
            />
          ) : null
        )}
      </div>
      <div className="an-legend">
        {items.map((it) => (
          <span key={it.label}>
            <i style={{ background: it.color }} />
            {it.label}: <b>{pctText(pct(it.value, total))}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

function TopList({ title, rows, empty = 'Məlumat yoxdur.' }) {
  return (
    <div className="card an-card">
      <h3 className="an-h3">{title}</h3>
      {rows.length === 0 ? (
        <p className="empty-state" style={{ margin: 0 }}>{empty}</p>
      ) : (
        <ol className="an-top">
          {rows.map((r, i) => (
            <li key={`${r.name}-${i}`}>
              <span className="an-top__name" title={r.name}>{r.name}</span>
              {r.sub && <span className="an-top__sub">{r.sub}</span>}
              <b className={r.tone ? `an-tone--${r.tone}` : undefined}>{r.value}</b>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/* ---------- Səhifə ---------- */

export default function AnalitikaPage() {
  const [period, setPeriod] = useState('this_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [warn, setWarn] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    setWarn(null)
    try {
      const [k, o, n, l, d] = await Promise.all([
        fetchAllPages(() =>
          supabase
            .from('musteri_bazasi')
            .select(
              'id, sira_no, ad_soyad, model, veziyyet, satis_qiymeti, alis_qiymeti, satici_faizi, verilib, faiz, qalan_borc, gozlenilen_gelir, faktiki_gelir, ayliq_odenis, nece_ay, odenis_gunu, birinci_ayliq_odenis_tarixi, odenis_qrafiki, verilme_tarixi'
            )
            .order('id', { ascending: true })
        ),
        fetchAllPages(() => supabase.from('odenisler').select('id, musteri_bazasi_id, tip, mebleg, tarix').order('id', { ascending: true })),
        fetchAllPages(() =>
          supabase
            .from('nagd_satish')
            .select('id, tarix, satis_novu, model, kime, alis_qiymeti, satis_qiymeti, satici_faizi')
            .order('id', { ascending: true })
        ),
        fetchAllPages(() => supabase.from(LEDGER_TABLE).select('id, kime, tip, mebleg, tarix').order('id', { ascending: true })),
        fetchAllPages(() =>
          supabase
            .from('depo')
            .select('id, model, kimden_alinib, alis_qiymeti, alis_tarixi, miqdar, status')
            .order('id', { ascending: true })
        ),
      ])
      const err = k.error || o.error || n.error || l.error || d.error
      if (err) throw err
      // Nömrə xərcləri — cədvəllər yoxdursa sadəcə 0 sayılır
      const [nm, nb] = await Promise.all([
        fetchAllPages(() => supabase.from('nomreler').select('id, alis_tarixi, alis_qiymeti').order('id', { ascending: true })),
        fetchAllPages(() => supabase.from('nomre_balanslar').select('id, tarix, mebleg').order('id', { ascending: true })),
      ])
      if (nm.error || nb.error) setWarn('Nömrə xərcləri yüklənmədi — hesablamaya daxil edilmədi.')
      setData({
        kredit: k.data || [],
        odenisler: o.data || [],
        nagd: n.data || [],
        ledger: l.data || [],
        depo: d.data || [],
        nomreler: nm.error ? [] : nm.data || [],
        nomreBalans: nb.error ? [] : nb.data || [],
      })
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const today = todayYmd()
  const range = useMemo(() => periodRange(period, customFrom, customTo), [period, customFrom, customTo])
  const prevRange = useMemo(() => previousRange(range), [range])

  const yigimRows = useMemo(() => {
    if (!data) return []
    const pays = data.odenisler.filter((p) => p.tip === 'ilkin' || p.tip === 'ayliq')
    const veziyyetById = new Map(data.kredit.map((m) => [m.id, m.veziyyet]))
    return buildYigimRows(data.kredit, pays).map((r) => ({ ...r, veziyyet: veziyyetById.get(r.musteriId) || r.veziyyet }))
  }, [data])

  const a = useMemo(() => {
    if (!data) return null
    const cur = salesSummary(data, range)
    const prev = prevRange ? salesSummary(data, prevRange) : null
    const col = collectionSummary(yigimRows, range, today)
    const prevCol = prevRange ? collectionSummary(yigimRows, prevRange, today) : null

    // Gecikmiş (bu günə qədər, aktiv müştərilər)
    const lateByCustomer = new Map()
    let lateSum = 0
    for (const r of yigimRows) {
      if (r.veziyyet !== 'Qalıb') continue
      if (!(r.tarix < today) || !(num(r.remaining) > 0.009)) continue
      lateSum += num(r.remaining)
      const g = lateByCustomer.get(r.musteriId) || { name: r.ad_soyad, sira: r.sira_no, sum: 0, days: 0 }
      g.sum += num(r.remaining)
      g.days = Math.max(g.days, num(r.delayDays))
      lateByCustomer.set(r.musteriId, g)
    }

    // Alacaq / borc (bu gün)
    let kreditQalan = 0
    let mehkemeQalan = 0
    let aktivMusteri = 0
    for (const m of data.kredit) {
      const q = Math.max(0, num(m.qalan_borc))
      if (m.veziyyet === 'Məhkəmə') mehkemeQalan += q
      else if (m.veziyyet === 'Qalıb') {
        kreditQalan += q
        if (q > 0) aktivMusteri += 1
      }
    }
    let ledgerAlacaq = 0
    let ledgerBorc = 0
    const ledgerPeople = []
    for (const b of computeBalances(data.ledger)) {
      const net = num(b.qaliq_borc) + num(b.qaliq_nisye)
      if (net > 0.009) ledgerAlacaq += net
      else if (net < -0.009) ledgerBorc += -net
      if (Math.abs(net) > 0.009) ledgerPeople.push({ name: b.kime, net })
    }
    let depoDeyer = 0
    let depoSay = 0
    for (const d of data.depo) {
      if (d.status !== 'available') continue
      const q = Math.max(1, num(d.miqdar) || 1)
      depoDeyer += num(d.alis_qiymeti) * q
      depoSay += q
    }
    const alacaq = kreditQalan + ledgerAlacaq
    const netMovqe = alacaq + depoDeyer - ledgerBorc

    // Son 12 ay qrafikləri
    const now = new Date()
    const months = []
    for (let i = 11; i >= 0; i -= 1) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      months.push({ key, label: MONTHS[dt.getMonth()], full: `${MONTHS_FULL[dt.getMonth()]} ${dt.getFullYear()}`, nagd: 0, kredit: 0, menfeet: 0, owed: 0, paid: 0, alis: 0 })
    }
    const mIdx = new Map(months.map((m, i) => [m.key, i]))
    const add = (key, field, v) => {
      const i = mIdx.get(key)
      if (i != null) months[i][field] += v
    }
    for (const r of data.nagd) {
      add(monthKey(r.tarix), 'nagd', num(r.satis_qiymeti))
      add(monthKey(r.tarix), 'menfeet', nagdProfit(r))
    }
    for (const m of data.kredit) {
      add(monthKey(m.verilme_tarixi), 'kredit', num(m.satis_qiymeti))
      add(monthKey(m.verilme_tarixi), 'menfeet', kreditProfit(m))
    }
    for (const p of data.odenisler) if (p.tip === 'faiz') add(monthKey(p.tarix), 'menfeet', num(p.mebleg))
    for (const nmr of data.nomreler) add(monthKey(nmr.alis_tarixi), 'menfeet', -num(nmr.alis_qiymeti))
    for (const b of data.nomreBalans) add(monthKey(b.tarix), 'menfeet', -num(b.mebleg))
    for (const r of yigimRows) {
      if (r.tarix > today) continue
      add(monthKey(r.tarix), 'owed', num(r.owed))
      add(monthKey(r.tarix), 'paid', num(r.paid))
    }
    for (const d of data.depo) add(monthKey(d.alis_tarixi), 'alis', num(d.alis_qiymeti) * Math.max(1, num(d.miqdar) || 1))

    // Top siyahılar (dövr üzrə)
    const modelMap = new Map()
    const addModel = (model, satis, menfeet) => {
      const k = String(model || '').trim()
      if (!k) return
      const g = modelMap.get(k) || { name: k, count: 0, satis: 0, menfeet: 0 }
      g.count += 1
      g.satis += satis
      g.menfeet += menfeet
      modelMap.set(k, g)
    }
    for (const r of data.nagd) if (inRange(r.tarix, range)) addModel(r.model, num(r.satis_qiymeti), nagdProfit(r))
    for (const m of data.kredit) if (inRange(m.verilme_tarixi, range)) addModel(m.model, num(m.satis_qiymeti), kreditProfit(m))
    const topModels = [...modelMap.values()].sort((x, y) => y.count - x.count || y.satis - x.satis).slice(0, 6)

    const supMap = new Map()
    for (const d of data.depo) {
      if (!inRange(d.alis_tarixi, range)) continue
      const k = String(d.kimden_alinib || '').trim()
      if (!k) continue
      const g = supMap.get(k) || { name: k, count: 0, sum: 0 }
      g.count += 1
      g.sum += num(d.alis_qiymeti) * Math.max(1, num(d.miqdar) || 1)
      supMap.set(k, g)
    }
    const topSuppliers = [...supMap.values()].sort((x, y) => y.sum - x.sum).slice(0, 6)

    const topDebtors = data.kredit
      .filter((m) => m.veziyyet === 'Qalıb' && num(m.qalan_borc) > 0)
      .sort((x, y) => num(y.qalan_borc) - num(x.qalan_borc))
      .slice(0, 6)
    const topLate = [...lateByCustomer.values()].sort((x, y) => y.sum - x.sum).slice(0, 6)

    // Depoda mal neçə ayın satışına bəs edir (son 3 ayın orta alış dəyəri ilə)
    const last3 = months.slice(-3)
    const avgCostSold = last3.reduce((s, m) => s + (m.nagd + m.kredit - Math.max(0, m.menfeet)), 0) / 3

    return {
      cur,
      prev,
      col,
      prevCol,
      lateSum: r2(lateSum),
      lateCount: lateByCustomer.size,
      kreditQalan: r2(kreditQalan),
      mehkemeQalan: r2(mehkemeQalan),
      aktivMusteri,
      ledgerAlacaq: r2(ledgerAlacaq),
      ledgerBorc: r2(ledgerBorc),
      ledgerPeople,
      depoDeyer: r2(depoDeyer),
      depoSay,
      alacaq: r2(alacaq),
      netMovqe: r2(netMovqe),
      months,
      topModels,
      topSuppliers,
      topDebtors,
      topLate,
      stockMonths: avgCostSold > 0 ? Math.round((depoDeyer / avgCostSold) * 10) / 10 : null,
    }
  }, [data, yigimRows, range, prevRange, today])

  /** Avtomatik məsləhətlər */
  const tips = useMemo(() => {
    if (!a) return []
    const t = []
    const { cur, prev, col } = a
    if (cur.xalis < 0) {
      t.push({ tone: 'bad', text: `Bu dövrdə xalis nəticə mənfidir (${azn(cur.xalis)}). Alış qiymətlərinə və satıcı faizlərinə baxın.` })
    }
    if (col.rate != null && col.rate < 85 && col.owed > 0) {
      t.push({
        tone: col.rate < 70 ? 'bad' : 'warn',
        text: `Yığım faizi ${pctText(col.rate)}: gözlənilən ${azn(col.owed)}-dən ${azn(col.remaining)} yığılmayıb. Yığım səhifəsində «Gecikmiş» filtri ilə zəngləri planlayın.`,
      })
    } else if (col.rate != null && col.owed > 0) {
      t.push({ tone: 'good', text: `Yığım yaxşıdır: ${pctText(col.rate)} yığılıb.` })
    }
    if (a.lateCount > 0) {
      t.push({
        tone: 'warn',
        text: `${a.lateCount} müştərinin cəmi ${azn(a.lateSum)} gecikmiş ödənişi var. Ən böyük 5-i aşağıda «Ən çox gecikənlər» siyahısındadır.`,
      })
    }
    if (prev && prev.satisCemi > 0) {
      const ch = Math.round(((cur.satisCemi - prev.satisCemi) / prev.satisCemi) * 100)
      if (ch <= -20) t.push({ tone: 'warn', text: `Satış əvvəlki dövrdən ${Math.abs(ch)}% azdır. Reklam / aksiya düşünün.` })
      else if (ch >= 20) t.push({ tone: 'good', text: `Satış əvvəlki dövrdən ${ch}% çoxdur.` })
    }
    const margins = [
      { name: 'Nağd', m: pct(cur.nagd.menfeet, cur.nagd.satis) },
      { name: 'Nisyə', m: pct(cur.nisye.menfeet, cur.nisye.satis) },
      { name: 'Kredit', m: pct(cur.kredit.menfeet, cur.kredit.satis) },
    ].filter((x) => x.m != null)
    const low = margins.filter((x) => x.m < 8)
    if (low.length) {
      t.push({ tone: 'warn', text: `Aşağı marja: ${low.map((x) => `${x.name} ${pctText(x.m)}`).join(', ')}. Bu satışlarda qiymətə yenidən baxın.` })
    }
    if (cur.kredit.satis > 0 && cur.kredit.qalan > 0) {
      t.push({
        tone: 'info',
        text: `Bu dövrün kredit satışlarından ${azn(cur.kredit.qalan)} hələ müştərilərdədir — mənfəətin bu hissəsi yığıldıqca real pula çevriləcək.`,
      })
    }
    if (a.stockMonths != null && a.stockMonths > 3) {
      t.push({ tone: 'warn', text: `Depodakı mal (${azn(a.depoDeyer)}) təxminən ${String(a.stockMonths).replace('.', ',')} aylıq satışa bəs edir — yeni alışları azaltmaq olar.` })
    }
    if (a.ledgerBorc > 0) {
      t.push({ tone: 'info', text: `Sizin borcunuz (Borc / Nisyə): ${azn(a.ledgerBorc)}. Qaytarma tarixlərini Borc / Nisyə səhifəsində izləyin.` })
    }
    if (a.mehkemeQalan > 0) {
      t.push({ tone: 'info', text: `Məhkəmədə olan müştərilərin qalığı: ${azn(a.mehkemeQalan)} (alacağa daxil edilməyib).` })
    }
    if (!t.length) t.push({ tone: 'good', text: 'Hər şey qaydasındadır — ciddi problem görünmür.' })
    return t
  }, [a])

  const periodLabel =
    period === 'custom'
      ? `${dmy(range.from)} – ${dmy(range.to)}`
      : PERIODS.find((p) => p.value === period)?.label || ''

  return (
    <div className="an-page">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Analitika</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            Satış, mənfəət, yığım, borc və alacaq bir yerdə. Yalnız baxış üçündür, heç nə dəyişmir.
          </p>
        </div>
        <button type="button" className="btn btn--secondary" onClick={load} disabled={loading}>
          Yenilə
        </button>
      </div>

      <div className="an-periods">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={`btn ${period === p.value ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span>—</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </>
        )}
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}
      {warn && <p style={{ color: 'var(--color-warning)', fontSize: 13 }}>{warn}</p>}

      {loading || !a ? (
        <div className="card">
          <p className="empty-state">Yüklənir…</p>
        </div>
      ) : (
        <>
          {/* Bir sözlə */}
          <div className={`an-verdict an-verdict--${a.cur.xalis >= 0 ? 'good' : 'bad'}`}>
            <div className="an-verdict__word">{a.cur.xalis >= 0 ? 'MƏNFƏƏTDƏSİNİZ' : 'ZƏRƏRDƏSİNİZ'}</div>
            <div className="an-verdict__sum">{azn(a.cur.xalis, { sign: true })}</div>
            <div className="an-verdict__text">
              {periodLabel}: {a.cur.satisCount} satış, dövriyyə {azn(a.cur.satisCemi)}. Satış mənfəəti {azn(a.cur.satisMenfeet)}
              {a.cur.faiz > 0 ? ` + cərimə faizi ${azn(a.cur.faiz)}` : ''}
              {a.cur.nomreXerc > 0 ? ` − nömrə xərcləri ${azn(a.cur.nomreXerc)}` : ''}.
              {a.prev && Math.abs(a.prev.xalis) > 0.009 && (
                <> Əvvəlki dövr: {azn(a.prev.xalis, { sign: true })}.</>
              )}
            </div>
            <div className="an-verdict__pos">
              Ümumi vəziyyət (bu gün): alacaq {azn(a.alacaq)} + depodakı mal {azn(a.depoDeyer)} − borcunuz {azn(a.ledgerBorc)} ={' '}
              <b>{azn(a.netMovqe)}</b>
            </div>
          </div>

          {/* Əsas göstəricilər */}
          <div className="an-kpis">
            <Kpi
              label="Satış dövriyyəsi"
              value={azn(a.cur.satisCemi)}
              delta={a.prev && <Delta cur={a.cur.satisCemi} prev={a.prev.satisCemi} />}
              hint={`${a.cur.satisCount} satış`}
            />
            <Kpi
              label="Xalis mənfəət"
              value={azn(a.cur.xalis)}
              tone={a.cur.xalis >= 0 ? 'good' : 'bad'}
              delta={a.prev && <Delta cur={a.cur.xalis} prev={a.prev.xalis} />}
              hint={`marja ${pctText(pct(a.cur.xalis, a.cur.satisCemi))}`}
            />
            <Kpi
              label="Daxil olan ödənişlər"
              value={azn(a.cur.odenis)}
              delta={a.prev && <Delta cur={a.cur.odenis} prev={a.prev.odenis} />}
              hint="kredit ilkin + aylıq + faiz"
            />
            <Kpi label="Alışlar (Depoya)" value={azn(a.cur.alis)} hint={`${a.cur.alisCount} məhsul`} />
            <Kpi
              label="Yığım faizi"
              value={pctText(a.col.rate)}
              tone={a.col.rate == null ? undefined : a.col.rate >= 85 ? 'good' : a.col.rate >= 70 ? 'warn' : 'bad'}
              hint={`${azn(a.col.paid)} / ${azn(a.col.owed)}`}
            />
            <Kpi label="Gecikmiş ödənişlər" value={azn(a.lateSum)} tone={a.lateSum > 0 ? 'bad' : 'good'} hint={`${a.lateCount} müştəri`} />
            <Kpi label="Alacaq (bizə borclu)" value={azn(a.alacaq)} hint={`kredit ${azn(a.kreditQalan)} · borc/nisyə ${azn(a.ledgerAlacaq)}`} />
            <Kpi label="Borcunuz" value={azn(a.ledgerBorc)} tone={a.ledgerBorc > 0 ? 'warn' : undefined} hint="Borc / Nisyə üzrə" />
          </div>

          {/* Məsləhətlər */}
          <div className="card an-card">
            <h3 className="an-h3">Məsləhətlər</h3>
            <ul className="an-tips">
              {tips.map((t, i) => (
                <li key={i} className={`an-tip an-tip--${t.tone}`}>
                  {t.text}
                </li>
              ))}
            </ul>
          </div>

          {/* Satış növləri */}
          <div className="card an-card">
            <h3 className="an-h3">Satışlar — {periodLabel}</h3>
            <div className="table-wrap">
              <table className="data-table an-table">
                <thead>
                  <tr>
                    <th>Növ</th>
                    <th className="num">Say</th>
                    <th className="num">Satış</th>
                    <th className="num">Alış</th>
                    <th className="num">Mənfəət</th>
                    <th className="num">Marja</th>
                    <th className="num">Orta mənfəət</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Nağd', a.cur.nagd],
                    ['Nisyə', a.cur.nisye],
                    ['Kredit', a.cur.kredit],
                  ].map(([name, t]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td className="num">{t.count}</td>
                      <td className="num">{azn(t.satis)}</td>
                      <td className="num">{azn(t.alis)}</td>
                      <td className={`num ${t.menfeet < 0 ? 'an-tone--bad' : 'an-tone--good'}`}>{azn(t.menfeet)}</td>
                      <td className="num">{pctText(pct(t.menfeet, t.satis))}</td>
                      <td className="num">{t.count ? azn(t.menfeet / t.count) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Cəmi</td>
                    <td className="num">{a.cur.satisCount}</td>
                    <td className="num">{azn(a.cur.satisCemi)}</td>
                    <td className="num">{azn(a.cur.nagd.alis + a.cur.nisye.alis + a.cur.kredit.alis)}</td>
                    <td className="num">{azn(a.cur.satisMenfeet)}</td>
                    <td className="num">{pctText(pct(a.cur.satisMenfeet, a.cur.satisCemi))}</td>
                    <td className="num">{a.cur.satisCount ? azn(a.cur.satisMenfeet / a.cur.satisCount) : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ marginTop: 12 }}>
              <ShareBar
                items={[
                  { label: 'Nağd', value: a.cur.nagd.satis, color: '#1f8a65' },
                  { label: 'Nisyə', value: a.cur.nisye.satis, color: '#d9a400' },
                  { label: 'Kredit', value: a.cur.kredit.satis, color: '#2f6fed' },
                ]}
              />
            </div>
          </div>

          {/* Qrafiklər */}
          <div className="an-grid2">
            <div className="card an-card">
              <h3 className="an-h3">Son 12 ay — satış və mənfəət</h3>
              <BarChart
                data={a.months}
                series={[
                  { key: 'nagd', label: 'Nağd + Nisyə satış', color: '#1f8a65' },
                  { key: 'kredit', label: 'Kredit satış', color: '#2f6fed' },
                  { key: 'menfeet', label: 'Mənfəət', color: '#d9a400' },
                ]}
              />
            </div>
            <div className="card an-card">
              <h3 className="an-h3">Son 12 ay — yığım (gözlənilən / yığılan)</h3>
              <BarChart
                data={a.months}
                series={[
                  { key: 'owed', label: 'Gözlənilən', color: '#b9c3d6' },
                  { key: 'paid', label: 'Yığılan', color: '#1f8a65' },
                ]}
              />
            </div>
          </div>
          <div className="card an-card">
            <h3 className="an-h3">Son 12 ay — alışlar (Depoya daxil olan mal)</h3>
            <BarChart data={a.months} series={[{ key: 'alis', label: 'Alış', color: '#c45c26' }]} height={180} />
          </div>

          {/* Borc / alacaq */}
          <div className="card an-card">
            <h3 className="an-h3">Borc və alacaq — bu gün</h3>
            <div className="an-balance">
              <div>
                <h4>Alacaq (bizə borclu)</h4>
                <dl>
                  <dt>Kredit müştəriləri ({a.aktivMusteri})</dt>
                  <dd>{azn(a.kreditQalan)}</dd>
                  <dt>Borc / Nisyə</dt>
                  <dd>{azn(a.ledgerAlacaq)}</dd>
                  <dt className="an-balance__total">Cəmi</dt>
                  <dd className="an-balance__total">{azn(a.alacaq)}</dd>
                  {a.mehkemeQalan > 0 && (
                    <>
                      <dt className="an-muted">Məhkəmədə (ayrıca)</dt>
                      <dd className="an-muted">{azn(a.mehkemeQalan)}</dd>
                    </>
                  )}
                </dl>
              </div>
              <div>
                <h4>Borcunuz</h4>
                <dl>
                  <dt>Borc / Nisyə üzrə</dt>
                  <dd>{azn(a.ledgerBorc)}</dd>
                </dl>
                <h4 style={{ marginTop: 16 }}>Depoda mal</h4>
                <dl>
                  <dt>{a.depoSay} ədəd (alış qiyməti ilə)</dt>
                  <dd>{azn(a.depoDeyer)}</dd>
                </dl>
              </div>
              <div className={`an-balance__net ${a.netMovqe >= 0 ? 'an-tone--good' : 'an-tone--bad'}`}>
                <span>Xalis vəziyyət</span>
                <b>{azn(a.netMovqe)}</b>
                <small>alacaq + mal − borc</small>
              </div>
            </div>
          </div>

          {/* Top siyahılar */}
          <div className="an-grid3">
            <TopList
              title="Ən çox gecikənlər"
              rows={a.topLate.map((g) => ({
                name: `${g.sira != null ? `#${g.sira} ` : ''}${g.name}`,
                sub: `${g.days} gün`,
                value: azn(g.sum),
                tone: 'bad',
              }))}
              empty="Gecikmə yoxdur."
            />
            <TopList
              title="Ən çox borcu olan müştərilər"
              rows={a.topDebtors.map((m) => ({
                name: `${m.sira_no != null ? `#${m.sira_no} ` : ''}${m.ad_soyad || '—'}`,
                sub: m.model || '',
                value: azn(m.qalan_borc),
              }))}
            />
            <TopList
              title={`Ən çox satılan modellər — ${periodLabel}`}
              rows={a.topModels.map((m) => ({
                name: m.name,
                sub: `${m.count} əd.`,
                value: azn(m.menfeet),
                tone: m.menfeet < 0 ? 'bad' : 'good',
              }))}
            />
            <TopList
              title={`Ən çox alış etdiyimiz — ${periodLabel}`}
              rows={a.topSuppliers.map((s) => ({ name: s.name, sub: `${s.count} məhsul`, value: azn(s.sum) }))}
            />
            <TopList
              title="Borc / Nisyə — qalıqlar"
              rows={[...a.ledgerPeople]
                .sort((x, y) => Math.abs(y.net) - Math.abs(x.net))
                .slice(0, 6)
                .map((p) => ({
                  name: p.name,
                  sub: p.net > 0 ? 'bizə borclu' : 'biz borcluyuq',
                  value: azn(Math.abs(p.net)),
                  tone: p.net > 0 ? 'good' : 'bad',
                }))}
            />
          </div>

          <p className="an-note">
            Hesablama: Nağd / Nisyə mənfəəti = satış − alış − satıcı faizi; Kredit mənfəəti = satış − alış (hədiyyələr daxil) − satıcı
            faizi, satış günündə sayılır. Xalis mənfəətə yığılan cərimə faizi əlavə, nömrə alışı və balans xərcləri çıxılır. Yığım
            faizi yalnız tarixi çatmış taksitlər üzrədir.
          </p>
        </>
      )}
    </div>
  )
}
