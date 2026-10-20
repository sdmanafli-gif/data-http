import { useMemo, useState } from 'react'
import { formatDate } from '../lib/formatDate'

/**
 * Yığım-dakı kimi dövr filtri: Ay / Həftə / İl / Özəl aralıq / Hamısı.
 * usePeriodFilter() vəziyyəti saxlayır, <PeriodFilterControls /> düymələri göstərir.
 */

const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
  'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
]

export const PERIODS = [
  { value: 'month', label: 'Ay' },
  { value: 'week', label: 'Həftə' },
  { value: 'year', label: 'İl' },
  { value: 'custom', label: 'Özəl aralıq' },
  { value: 'all', label: 'Hamısı' },
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
  return addDays(d, -((d.getDay() + 6) % 7))
}

function periodRange(period, { year, month, weekStart, customFrom, customTo }) {
  if (period === 'all') return { from: null, to: null }
  if (period === 'week') return { from: toYmd(weekStart), to: toYmd(addDays(weekStart, 6)) }
  if (period === 'month') {
    return { from: toYmd(new Date(year, month, 1)), to: toYmd(new Date(year, month + 1, 0)) }
  }
  if (period === 'year') return { from: `${year}-01-01`, to: `${year}-12-31` }
  let from = customFrom || null
  let to = customTo || null
  if (from && to && from > to) [from, to] = [to, from]
  return { from, to }
}

function periodTitle(period, { year, month, weekStart }) {
  if (period === 'week') {
    return `${formatDate(toYmd(weekStart))} – ${formatDate(toYmd(addDays(weekStart, 6)))}`
  }
  if (period === 'month') return `${MONTHS[month]} ${year}`
  if (period === 'year') return String(year)
  return ''
}

/** true if ISO date string (YYYY-MM-DD…) is inside range; empty range = always true */
export function inPeriod(value, range) {
  if (!range?.from && !range?.to) return true
  if (!value) return false
  const ymd = String(value).slice(0, 10)
  if (range.from && ymd < range.from) return false
  if (range.to && ymd > range.to) return false
  return true
}

export function usePeriodFilter(initialPeriod = 'all') {
  const [period, setPeriod] = useState(initialPeriod)
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const range = useMemo(
    () => periodRange(period, { year, month, weekStart, customFrom, customTo }),
    [period, year, month, weekStart, customFrom, customTo]
  )

  function shift(dir) {
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

  function today() {
    const n = new Date()
    setYear(n.getFullYear())
    setMonth(n.getMonth())
    setWeekStart(startOfWeek(n))
  }

  return {
    period,
    setPeriod,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    range,
    title: periodTitle(period, { year, month, weekStart }),
    shift,
    today,
  }
}

export function PeriodFilterControls({ filter, label = 'Dövr' }) {
  const { period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo, title, shift, today } =
    filter
  return (
    <>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>{label}</label>
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
            <button type="button" className="btn btn--secondary" onClick={() => shift(-1)}>
              ‹
            </button>
            <span style={{ minWidth: 140, textAlign: 'center', fontWeight: 600 }}>{title}</span>
            <button type="button" className="btn btn--secondary" onClick={() => shift(1)}>
              ›
            </button>
            <button type="button" className="btn btn--secondary" onClick={today}>
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
    </>
  )
}
