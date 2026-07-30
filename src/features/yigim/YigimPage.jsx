import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import {
  MUSTERI_TABLE,
  formatMoney,
  formatDate,
} from '../musteri-bazasi/constants'
import { ODENISLER_TABLE } from '../odenisler/constants'
import {
  canBuildSchedule,
  buildPaymentSchedule,
  matchPaymentsToSchedule,
  statusLabel,
} from '../musteri-bazasi/paymentSchedule'
import CollapsibleSummary from '../../components/CollapsibleSummary'
import '../../styles/shared.css'
import '../musteri-bazasi/musteri-table.css'
import '../musteri-bazasi/musteri-schedule.css'

const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
  'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
]

const PERIODS = [
  { value: 'month', label: 'Ay' },
  { value: 'week', label: 'Həftə' },
  { value: 'year', label: 'İl' },
  { value: 'custom', label: 'Özəl aralıq' },
  { value: 'all', label: 'Hamısı' },
]

const STATUS_FILTERS = [
  { value: '', label: 'Hamısı' },
  { value: 'pending', label: 'Gözləyən / qalan' },
  { value: 'late', label: 'Gecikmiş' },
  { value: 'paid', label: 'Ödənib' },
  { value: 'partial', label: 'Qismən' },
]

function toYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = (d.getDay() + 6) % 7
  return addDays(d, -weekday)
}

function periodRange(period, { year, month, weekStart, customFrom, customTo }) {
  if (period === 'all') return { from: null, to: null }
  if (period === 'week') {
    return { from: toYmd(weekStart), to: toYmd(addDays(weekStart, 6)) }
  }
  if (period === 'month') {
    return {
      from: toYmd(new Date(year, month, 1)),
      to: toYmd(new Date(year, month + 1, 0)),
    }
  }
  if (period === 'year') {
    return { from: `${year}-01-01`, to: `${year}-12-31` }
  }
  let from = customFrom || null
  let to = customTo || null
  if (from && to && from > to) {
    const t = from
    from = to
    to = t
  }
  return { from, to }
}

function periodTitle(period, ctx) {
  if (period === 'week') {
    return `${formatDate(toYmd(ctx.weekStart))} – ${formatDate(toYmd(addDays(ctx.weekStart, 6)))}`
  }
  if (period === 'month') return `${MONTHS[ctx.month]} ${ctx.year}`
  if (period === 'year') return String(ctx.year)
  if (period === 'custom') {
    if (!ctx.customFrom && !ctx.customTo) return 'Özəl aralıq'
    return `${formatDate(ctx.customFrom) || '…'} – ${formatDate(ctx.customTo) || '…'}`
  }
  return 'Bütün tarixlər'
}

function inRange(ymd, from, to) {
  if (!ymd) return false
  if (from && ymd < from) return false
  if (to && ymd > to) return false
  return true
}

function matchesStatusFilter(row, filter) {
  if (!filter) return true
  if (filter === 'pending') {
    return row.remaining > 0
  }
  if (filter === 'late') {
    return row.status === 'gecikib' || row.status === 'odenib_gec' || row.delayDays > 0
  }
  if (filter === 'paid') {
    return row.status === 'odenib' || row.status === 'odenib_gec'
  }
  if (filter === 'partial') {
    return row.status === 'qismen'
  }
  return true
}

/**
 * Build flat yığım rows from müştəri + ödənişlər.
 */
export function buildYigimRows(musteriler, payments) {
  const byMusteri = new Map()
  for (const p of payments || []) {
    const mid = p.musteri_bazasi_id
    if (!mid) continue
    if (!byMusteri.has(mid)) byMusteri.set(mid, [])
    byMusteri.get(mid).push(p)
  }

  const rows = []
  for (const m of musteriler || []) {
    if (!canBuildSchedule(m)) continue
    const schedule = buildPaymentSchedule(m)
    const matched = matchPaymentsToSchedule(schedule, byMusteri.get(m.id) || [], {
      aylıq: Number(m.ayliq_odenis) || 0,
    })
    for (const line of matched) {
      rows.push({
        id: `${m.id}-${line.type}-${line.installment}`,
        musteriId: m.id,
        sira_no: m.sira_no,
        ad_soyad: m.ad_soyad || '—',
        model: m.model || null,
        nomre_1: m.nomre_1 || null,
        veziyyet: m.veziyyet || null,
        type: line.type,
        label: line.label,
        installment: line.installment,
        tarix: line.tarix,
        owed: line.owed,
        paid: line.paid,
        remaining: line.remaining,
        delayDays: line.delayDays,
        penalty: line.penalty,
        status: line.status,
        coveredAt: line.coveredAt,
      })
    }
  }

  rows.sort((a, b) => {
    if (a.tarix !== b.tarix) return a.tarix.localeCompare(b.tarix)
    const na = a.sira_no ?? 999999
    const nb = b.sira_no ?? 999999
    if (na !== nb) return na - nb
    return a.installment - b.installment
  })
  return rows
}

export default function YigimPage() {
  const now = new Date()
  const [period, setPeriod] = useState('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now))
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [search, setSearch] = useState('')

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [{ data: musteriler, error: mErr }, { data: payments, error: pErr }] = await Promise.all([
        fetchAllPages(() =>
          supabase
            .from(MUSTERI_TABLE)
            .select(
              'id, sira_no, ad_soyad, model, nomre_1, veziyyet, satis_qiymeti, ayliq_odenis, nece_ay, odenis_gunu, verilme_tarixi'
            )
            .eq('veziyyet', 'Qalıb')
            .order('sira_no', { ascending: true })
        ),
        fetchAllPages(() =>
          supabase
            .from(ODENISLER_TABLE)
            .select('id, musteri_bazasi_id, tip, mebleg, tarix')
            .in('tip', ['ilkin', 'ayliq'])
        ),
      ])
      if (mErr) throw mErr
      if (pErr) throw pErr
      setRows(buildYigimRows(musteriler || [], payments || []))
    } catch (err) {
      setError(err.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const range = useMemo(
    () => periodRange(period, { year, month, weekStart, customFrom, customTo }),
    [period, year, month, weekStart, customFrom, customTo]
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (!inRange(r.tarix, range.from, range.to)) return false
      if (!matchesStatusFilter(r, statusFilter)) return false
      if (r.veziyyet !== 'Qalıb') return false
      if (term) {
        const hay = `${r.sira_no ?? ''} ${r.ad_soyad} ${r.model || ''} ${r.nomre_1 || ''}`.toLowerCase()
        if (!hay.includes(term) && !(term.match(/^\d+$/) && String(r.sira_no) === term)) {
          return false
        }
      }
      return true
    })
  }, [rows, range, statusFilter, search])

  const totals = useMemo(() => {
    let owed = 0
    let paid = 0
    let remaining = 0
    let penalty = 0
    let lateCount = 0
    for (const r of filtered) {
      owed += r.owed || 0
      paid += r.paid || 0
      remaining += r.remaining || 0
      penalty += r.penalty || 0
      if (r.status === 'gecikib' || (r.delayDays > 0 && r.remaining > 0)) lateCount += 1
    }
    return { owed, paid, remaining, penalty, lateCount, count: filtered.length }
  }, [filtered])

  const title = periodTitle(period, { year, month, weekStart, customFrom, customTo })

  function shiftPeriod(dir) {
    if (period === 'week') {
      setWeekStart((w) => addDays(w, dir * 7))
      return
    }
    if (period === 'month') {
      const d = new Date(year, month + dir, 1)
      setYear(d.getFullYear())
      setMonth(d.getMonth())
      return
    }
    if (period === 'year') setYear((y) => y + dir)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Yığım</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
            Ödəniş qrafikinə görə toplanmalı məbləğlər · {title}
          </p>
        </div>
        <button type="button" className="btn btn--secondary" onClick={load} disabled={loading}>
          Yenilə
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-end',
          marginBottom: 16,
        }}
      >
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Dövr</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
          </div>
        </div>

        {(period === 'month' || period === 'week' || period === 'year') && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Naviqasiya</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button type="button" className="btn btn--secondary" onClick={() => shiftPeriod(-1)}>
                ‹
              </button>
              <span style={{ minWidth: 140, textAlign: 'center', fontWeight: 600 }}>{title}</span>
              <button type="button" className="btn btn--secondary" onClick={() => shiftPeriod(1)}>
                ›
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  const n = new Date()
                  setYear(n.getFullYear())
                  setMonth(n.getMonth())
                  setWeekStart(startOfWeek(n))
                }}
              >
                Bu gün
              </button>
            </div>
          </div>
        )}

        {period === 'custom' && (
          <>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Başlanğıc</label>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Son</label>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </>
        )}

        <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
          <label>Ödəniş statusu</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_FILTERS.map((s) => (
              <option key={s.value || 'all'} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px', maxWidth: 280 }}>
          <label>Axtarış</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="№, ad, model, nömrə…"
          />
        </div>
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      {!loading && (
        <CollapsibleSummary title="Cəmlər" storageKey="summary:yigim">
          <div className="musteri-summary">
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Gözlənilən yığım</div>
              <div className="musteri-summary__value">{formatMoney(totals.owed)}</div>
            </div>
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Ödənilib</div>
              <div className="musteri-summary__value">{formatMoney(totals.paid)}</div>
            </div>
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Qalan / pending</div>
              <div className="musteri-summary__value">{formatMoney(totals.remaining)}</div>
            </div>
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Cərimə</div>
              <div className="musteri-summary__value">{formatMoney(totals.penalty)}</div>
            </div>
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Gecikmiş sətir</div>
              <div className="musteri-summary__value">{totals.lateCount}</div>
            </div>
            <div className="musteri-summary__card musteri-summary__card--meta">
              <div className="musteri-summary__label">Sətir sayı</div>
              <div className="musteri-summary__value">{totals.count}</div>
            </div>
          </div>
        </CollapsibleSummary>
      )}

      <div className="card">
        {loading ? (
          <p className="empty-state">Yüklənir…</p>
        ) : filtered.length === 0 ? (
          <p className="empty-state">Bu filtrə uyğun yığım yoxdur.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vaxtı</th>
                  <th>#</th>
                  <th>Müştəri</th>
                  <th>Vəziyyət</th>
                  <th>Model</th>
                  <th>Növ</th>
                  <th>Məbləğ</th>
                  <th>Ödənilib</th>
                  <th>Qalan</th>
                  <th>Gecikmə</th>
                  <th>Cərimə</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className={
                      r.status === 'gecikib' || (r.delayDays > 0 && r.remaining > 0)
                        ? 'musteri-schedule__row--late'
                        : r.status === 'odenib' || r.status === 'odenib_gec'
                          ? 'musteri-schedule__row--paid'
                          : undefined
                    }
                  >
                    <td>{formatDate(r.tarix)}</td>
                    <td>
                      <Link to={`/musteri-bazasi?open=${r.musteriId}`}>
                        {r.sira_no ?? '—'}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/musteri-bazasi?open=${r.musteriId}`}>
                        {r.ad_soyad}
                      </Link>
                      {r.nomre_1 ? (
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{r.nomre_1}</div>
                      ) : null}
                    </td>
                    <td>{r.veziyyet || '—'}</td>
                    <td>{r.model || '—'}</td>
                    <td>{r.label}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(r.owed)}</td>
                    <td>{formatMoney(r.paid)}</td>
                    <td>{formatMoney(r.remaining)}</td>
                    <td>
                      {r.delayDays > 0 ? (
                        <span className="musteri-schedule__overdue">{r.delayDays} gün</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {r.penalty > 0 ? (
                        <span className="musteri-schedule__overdue">{formatMoney(r.penalty)}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          r.status === 'gecikib' || r.status === 'odenib_gec'
                            ? 'musteri-schedule__overdue'
                            : r.status === 'odenib'
                              ? 'musteri-schedule__paid'
                              : 'musteri-schedule__upcoming'
                        }
                      >
                        {statusLabel(r.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
