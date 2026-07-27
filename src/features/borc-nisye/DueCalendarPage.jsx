import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import {
  LEDGER_TABLE,
  buildDueEvents,
  counterpartPath,
  dueDirectionLabel,
  formatMoney,
  formatDate,
  tipLabel,
} from './constants'
import '../../styles/shared.css'
import '../musteri-bazasi/musteri-table.css'
import './due-calendar.css'

const WEEKDAYS = ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B']
const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
  'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
]

const PERIODS = [
  { value: 'week', label: 'Həftə' },
  { value: 'month', label: 'Ay' },
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

function parseYmd(ymd) {
  if (!ymd) return null
  const [y, m, d] = String(ymd).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}

/** Monday-based week start */
function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = (d.getDay() + 6) % 7
  return addDays(d, -weekday)
}

function buildMonthCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1)
  const weekday = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < weekday; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toYmd(new Date(year, monthIndex, day)))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function buildWeekCells(weekStart) {
  return Array.from({ length: 7 }, (_, i) => toYmd(addDays(weekStart, i)))
}

function inRange(ymd, from, to) {
  if (!ymd) return false
  if (from && ymd < from) return false
  if (to && ymd > to) return false
  return true
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
  const from = customFrom || null
  const to = customTo || null
  if (from && to && from > to) return { from: to, to: from }
  return { from, to }
}

function periodTitle(period, { year, month, weekStart, customFrom, customTo }) {
  if (period === 'week') {
    return `${formatDate(toYmd(weekStart))} – ${formatDate(toYmd(addDays(weekStart, 6)))}`
  }
  if (period === 'month') return `${MONTHS[month]} ${year}`
  if (period === 'year') return String(year)
  if (period === 'custom') {
    if (!customFrom && !customTo) return 'Özəl aralıq'
    return `${formatDate(customFrom) || '…'} – ${formatDate(customTo) || '…'}`
  }
  return 'Bütün tarixlər'
}

function statsLabel(period) {
  if (period === 'week') return { collect: 'Bu həftə alınacaq', pay: 'Bu həftə ödəniləcək' }
  if (period === 'month') return { collect: 'Bu ay alınacaq', pay: 'Bu ay ödəniləcək' }
  if (period === 'year') return { collect: 'Bu il alınacaq', pay: 'Bu il ödəniləcək' }
  if (period === 'custom') return { collect: 'Aralıqda alınacaq', pay: 'Aralıqda ödəniləcək' }
  return { collect: 'Cəmi alınacaq', pay: 'Cəmi ödəniləcək' }
}

function EventList({ items, emptyText, onSelect }) {
  if (!items.length) return <p className="empty-state">{emptyText}</p>
  return (
    <ul className="due-cal__list">
      {items.map((ev) => (
        <li
          key={ev.id}
          className={`due-cal__item due-cal__item--${ev.direction}${ev.overdue ? ' due-cal__item--overdue' : ''}${onSelect ? ' due-cal__item--clickable' : ''}`}
          onClick={onSelect ? () => onSelect(ev.qaytarma_tarixi) : undefined}
        >
          <div className="due-cal__item-top">
            <span>{formatDate(ev.qaytarma_tarixi)}</span>
            <span className="due-cal__amount">{formatMoney(ev.mebleg)}</span>
          </div>
          <div className="due-cal__item-meta">
            <strong>{dueDirectionLabel(ev.direction)}</strong>
            <span>
              {' '}
              · <Link to={counterpartPath(ev.kime)} onClick={(e) => e.stopPropagation()}>{ev.kime}</Link>
            </span>
            <span> · {tipLabel(ev.tip)}</span>
            {ev.mehsul ? <span> · {ev.mehsul}</span> : null}
          </div>
          {ev.overdue && <div className="due-cal__badge">Gecikib</div>}
        </li>
      ))}
    </ul>
  )
}

export default function DueCalendarPage() {
  const today = toYmd(new Date())
  const now = new Date()
  const [period, setPeriod] = useState('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now))
  const [customFrom, setCustomFrom] = useState(() =>
    toYmd(new Date(now.getFullYear(), now.getMonth(), 1))
  )
  const [customTo, setCustomTo] = useState(() =>
    toYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  )
  const [selected, setSelected] = useState(today)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: e } = await fetchAllPages(() =>
          supabase
            .from(LEDGER_TABLE)
            .select('id, kime, tip, mebleg, mehsul, qeyd, tarix, qaytarma_tarixi')
            .not('qaytarma_tarixi', 'is', null)
        )
        if (cancelled) return
        if (e) throw e
        setEvents(buildDueEvents(data || []))
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const range = useMemo(
    () => periodRange(period, { year, month, weekStart, customFrom, customTo }),
    [period, year, month, weekStart, customFrom, customTo]
  )

  const filteredEvents = useMemo(
    () => events.filter((ev) => inRange(ev.qaytarma_tarixi, range.from, range.to)),
    [events, range]
  )

  const byDate = useMemo(() => {
    const map = new Map()
    for (const ev of filteredEvents) {
      const key = ev.qaytarma_tarixi
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(ev)
    }
    return map
  }, [filteredEvents])

  const cells = useMemo(() => {
    if (period === 'week') return buildWeekCells(weekStart)
    if (period === 'month') return buildMonthCells(year, month)
    return null
  }, [period, weekStart, year, month])

  const dayEvents = byDate.get(selected) || []

  const stats = useMemo(() => {
    let collect = 0
    let pay = 0
    let overdue = 0
    for (const ev of filteredEvents) {
      if (ev.direction === 'collect') collect += ev.mebleg
      if (ev.direction === 'pay') pay += ev.mebleg
      if (ev.overdue) overdue += 1
    }
    return { collect, pay, overdue }
  }, [filteredEvents])

  const yearMonths = useMemo(() => {
    if (period !== 'year') return []
    return MONTHS.map((label, idx) => {
      const prefix = `${year}-${String(idx + 1).padStart(2, '0')}`
      const monthEvents = filteredEvents.filter((e) => e.qaytarma_tarixi.startsWith(prefix))
      let collect = 0
      let pay = 0
      for (const ev of monthEvents) {
        if (ev.direction === 'collect') collect += ev.mebleg
        if (ev.direction === 'pay') pay += ev.mebleg
      }
      return { idx, label, count: monthEvents.length, collect, pay }
    })
  }, [period, year, filteredEvents])

  const labels = statsLabel(period)
  const title = periodTitle(period, { year, month, weekStart, customFrom, customTo })

  function goToday() {
    const d = new Date()
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setWeekStart(startOfWeek(d))
    setSelected(toYmd(d))
    if (period === 'custom') {
      setCustomFrom(toYmd(new Date(d.getFullYear(), d.getMonth(), 1)))
      setCustomTo(toYmd(new Date(d.getFullYear(), d.getMonth() + 1, 0)))
    }
  }

  function shift(delta) {
    if (period === 'week') {
      const next = addDays(weekStart, delta * 7)
      setWeekStart(next)
      setSelected(toYmd(next))
      return
    }
    if (period === 'month') {
      const d = new Date(year, month + delta, 1)
      setYear(d.getFullYear())
      setMonth(d.getMonth())
      return
    }
    if (period === 'year') {
      setYear((y) => y + delta)
    }
  }

  function onPeriodChange(next) {
    setPeriod(next)
    if (next === 'week') {
      const anchor = parseYmd(selected) || new Date()
      setWeekStart(startOfWeek(anchor))
    }
    if (next === 'month' && selected) {
      const d = parseYmd(selected)
      if (d) {
        setYear(d.getFullYear())
        setMonth(d.getMonth())
      }
    }
    if (next === 'year' && selected) {
      const d = parseYmd(selected)
      if (d) setYear(d.getFullYear())
    }
  }

  function openMonth(idx) {
    setMonth(idx)
    setPeriod('month')
    setSelected(toYmd(new Date(year, idx, 1)))
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 style={{ marginBottom: 4 }}>Ödəniş kalendari</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            Qaytarma tarixinə görə: nəyi alacaqsınız, nəyi ödəyəcəksiniz
          </p>
        </div>
        <Link to="/borc-nisye" className="btn btn--secondary">
          İcmala qayıt
        </Link>
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      <div className="card due-cal__filters">
        <div className="due-cal__period-tabs" role="tablist" aria-label="Tarix filtri">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={period === p.value}
              className={`btn ${period === p.value ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => onPeriodChange(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'custom' ? (
          <div className="due-cal__custom-range">
            <div className="form-group">
              <label>Başlanğıc</label>
              <input
                type="date"
                value={customFrom || ''}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Son</label>
              <input
                type="date"
                value={customTo || ''}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
            <button type="button" className="btn btn--secondary" onClick={goToday}>
              Bu ay
            </button>
          </div>
        ) : period !== 'all' ? (
          <div className="due-cal__nav">
            <button type="button" className="btn btn--secondary" onClick={() => shift(-1)}>
              ←
            </button>
            <h2 className="card__title" style={{ margin: 0 }}>
              {title}
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn--secondary" onClick={goToday}>
                Bu gün
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => shift(1)}>
                →
              </button>
            </div>
          </div>
        ) : (
          <div className="due-cal__nav">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                const d = new Date(year, month - 1, 1)
                setYear(d.getFullYear())
                setMonth(d.getMonth())
              }}
            >
              ←
            </button>
            <h2 className="card__title" style={{ margin: 0 }}>
              {MONTHS[month]} {year} · bütün qeydlər
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn--secondary" onClick={goToday}>
                Bu gün
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  const d = new Date(year, month + 1, 1)
                  setYear(d.getFullYear())
                  setMonth(d.getMonth())
                }}
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="musteri-summary">
        <div className="musteri-summary__card">
          <div className="musteri-summary__label">{labels.collect}</div>
          <div className="musteri-summary__value">{formatMoney(stats.collect)}</div>
        </div>
        <div className="musteri-summary__card">
          <div className="musteri-summary__label">{labels.pay}</div>
          <div className="musteri-summary__value">{formatMoney(stats.pay)}</div>
        </div>
        <div className="musteri-summary__card musteri-summary__card--meta">
          <div className="musteri-summary__label">Gecikmiş / qeyd sayı</div>
          <div className="musteri-summary__value">
            {stats.overdue} / {filteredEvents.length}
          </div>
        </div>
      </div>

      <div className="due-cal">
        <div className="card due-cal__month">
          {loading ? (
            <p className="empty-state">Yüklənir…</p>
          ) : period === 'year' ? (
            <div className="due-cal__year-grid">
              {yearMonths.map((m) => (
                <button
                  key={m.idx}
                  type="button"
                  className={`due-cal__year-card${m.count ? ' due-cal__year-card--has' : ''}`}
                  onClick={() => openMonth(m.idx)}
                >
                  <strong>{m.label}</strong>
                  <span className="due-cal__year-count">{m.count} qeyd</span>
                  <span className="due-cal__year-money">
                    <span className="due-cal__dot due-cal__dot--collect" /> {formatMoney(m.collect)}
                  </span>
                  <span className="due-cal__year-money">
                    <span className="due-cal__dot due-cal__dot--pay" /> {formatMoney(m.pay)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              {(period === 'all' || period === 'custom') && (
                <h2 className="card__title" style={{ marginBottom: 12 }}>
                  {period === 'custom' && customFrom
                    ? `${MONTHS[Number(customFrom.slice(5, 7)) - 1] || ''} ${customFrom.slice(0, 4)}`
                    : `${MONTHS[month]} ${year}`}
                </h2>
              )}
              <div className="due-cal__weekdays">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="due-cal__weekday">
                    {w}
                  </div>
                ))}
              </div>
              <div className={`due-cal__grid${period === 'week' ? ' due-cal__grid--week' : ''}`}>
                {(
                  period === 'week'
                    ? buildWeekCells(weekStart)
                    : buildMonthCells(
                        period === 'custom' && customFrom
                          ? Number(customFrom.slice(0, 4))
                          : year,
                        period === 'custom' && customFrom
                          ? Number(customFrom.slice(5, 7)) - 1
                          : month
                      )
                ).map((ymd, idx) => {
                  if (!ymd) {
                    return <div key={`e-${idx}`} className="due-cal__cell due-cal__cell--empty" />
                  }
                  const dayList = (period === 'all' ? events : filteredEvents).filter(
                    (e) => e.qaytarma_tarixi === ymd
                  )
                  const hasCollect = dayList.some((e) => e.direction === 'collect')
                  const hasPay = dayList.some((e) => e.direction === 'pay')
                  const hasOverdue = dayList.some((e) => e.overdue)
                  const dayNum = Number(ymd.slice(-2))
                  return (
                    <button
                      key={ymd}
                      type="button"
                      className={[
                        'due-cal__cell',
                        ymd === today ? 'due-cal__cell--today' : '',
                        ymd === selected ? 'due-cal__cell--selected' : '',
                        hasOverdue ? 'due-cal__cell--overdue' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setSelected(ymd)}
                    >
                      <span className="due-cal__day">{dayNum}</span>
                      {(hasCollect || hasPay) && (
                        <span className="due-cal__dots">
                          {hasCollect && <span className="due-cal__dot due-cal__dot--collect" />}
                          {hasPay && <span className="due-cal__dot due-cal__dot--pay" />}
                        </span>
                      )}
                      {dayList.length > 0 && (
                        <span className="due-cal__count">{dayList.length}</span>
                      )}
                    </button>
                  )
                })}
              </div>
              <div className="due-cal__legend">
                <span>
                  <span className="due-cal__dot due-cal__dot--collect" /> Alacağam
                </span>
                <span>
                  <span className="due-cal__dot due-cal__dot--pay" /> Ödəyəcəyəm
                </span>
              </div>
            </>
          )}
        </div>

        <div className="card due-cal__detail">
          <h2 className="card__title">
            {period === 'week' || period === 'month'
              ? formatDate(selected)
              : selected
                ? formatDate(selected)
                : 'Dövr üzrə siyahı'}
          </h2>
          {(period === 'week' || period === 'month' || selected) && dayEvents.length === 0 ? (
            <p className="empty-state">
              {period === 'week' || period === 'month'
                ? 'Bu gün üçün qaytarma yoxdur.'
                : 'Bu tarix üçün qaytarma yoxdur (siyahıdan seçin).'}
            </p>
          ) : (period === 'week' || period === 'month' || selected) && dayEvents.length > 0 ? (
            <ul className="due-cal__list">
              {dayEvents.map((ev) => (
                <li
                  key={ev.id}
                  className={`due-cal__item due-cal__item--${ev.direction}${ev.overdue ? ' due-cal__item--overdue' : ''}`}
                >
                  <div className="due-cal__item-top">
                    <strong>{dueDirectionLabel(ev.direction)}</strong>
                    <span className="due-cal__amount">{formatMoney(ev.mebleg)}</span>
                  </div>
                  <div className="due-cal__item-meta">
                    <Link to={counterpartPath(ev.kime)}>{ev.kime}</Link>
                    <span>· {tipLabel(ev.tip)}</span>
                    {ev.mehsul ? <span>· {ev.mehsul}</span> : null}
                  </div>
                  {ev.overdue && <div className="due-cal__badge">Gecikib</div>}
                </li>
              ))}
            </ul>
          ) : null}

          <h3 className="card__title" style={{ marginTop: 24 }}>
            Dövr üzrə siyahı ({filteredEvents.length})
          </h3>
          <EventList
            items={filteredEvents}
            emptyText="Bu dövrdə qaytarma yoxdur."
            onSelect={setSelected}
          />
        </div>
      </div>
    </div>
  )
}
