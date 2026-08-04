import { useEffect, useMemo, useRef, useState } from 'react'

const BLANK = '__blank__'
const EQ = '__eq__:'
const NUM = '__num__:'

const AMOUNT_OPS = [
  { value: 'gt', label: '≥ çox' },
  { value: 'lt', label: '≤ az' },
  { value: 'between', label: 'arası' },
  { value: 'eq', label: '= bərabər' },
]

function selectedToDraft(selected) {
  const q = typeof selected === 'string' ? selected : ''
  if (!q || q === BLANK) return ''
  if (q.startsWith(EQ)) return q.slice(EQ.length)
  return q
}

export function parseNumFilter(raw) {
  const q = typeof raw === 'string' ? raw : ''
  if (!q.startsWith(NUM)) return null
  const parts = q.slice(NUM.length).split(':')
  const op = parts[0] || 'gt'
  const a = parts[1] === undefined || parts[1] === '' ? '' : parts[1]
  const b = parts[2] === undefined || parts[2] === '' ? '' : parts[2]
  return { op, a, b }
}

export function encodeNumFilter(op, a, b = '') {
  const o = op || 'gt'
  if (o === 'between') return `${NUM}between:${a ?? ''}:${b ?? ''}`
  return `${NUM}${o}:${a ?? ''}`
}

export function encodeExactFilter(value) {
  if (value == null || String(value).trim() === '') return BLANK
  return `${EQ}${value}`
}

export function isAmountColumn(col) {
  return col?.type === 'money' || col?.type === 'number'
}

function toNumber(cell) {
  if (cell === null || cell === undefined || cell === '') return null
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null
  const cleaned = String(cell)
    .replace(/\s/g, '')
    .replace(/AZN/gi, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function matchesNumFilter(cell, parsed) {
  if (!parsed) return true
  const n = toNumber(cell)
  if (n === null) return false
  const a = parsed.a === '' || parsed.a == null ? null : Number(parsed.a)
  const b = parsed.b === '' || parsed.b == null ? null : Number(parsed.b)

  switch (parsed.op) {
    case 'gt':
      return a == null || Number.isNaN(a) ? true : n >= a
    case 'lt':
      return a == null || Number.isNaN(a) ? true : n <= a
    case 'eq':
      return a == null || Number.isNaN(a) ? true : Math.abs(n - a) < 0.0001
    case 'between': {
      if (a != null && !Number.isNaN(a) && n < a) return false
      if (b != null && !Number.isNaN(b) && n > b) return false
      return true
    }
    default:
      return true
  }
}

/** Support typing ">100", ">=100", "<50", "10-200", "10..200" in amount filters. */
function parseAmountShorthand(q) {
  const s = String(q).trim().replace(/\s/g, '')
  let m = s.match(/^(>=|<=|≥|≤|>|<|=)(-?\d+(?:[.,]\d+)?)$/)
  if (m) {
    const sym = m[1]
    const a = m[2].replace(',', '.')
    if (sym === '>' || sym === '≥' || sym === '>=') return { op: 'gt', a, b: '' }
    if (sym === '<' || sym === '≤' || sym === '<=') return { op: 'lt', a, b: '' }
    if (sym === '=') return { op: 'eq', a, b: '' }
  }
  m = s.match(/^(-?\d+(?:[.,]\d+)?)(?:\.\.|-|–|—)(-?\d+(?:[.,]\d+)?)$/)
  if (m) {
    return { op: 'between', a: m[1].replace(',', '.'), b: m[2].replace(',', '.') }
  }
  return null
}

/**
 * Filter UI for money/number columns: ≥ / ≤ / arası / =.
 */
export function AmountColumnFilter({ columnKey, label, value, onChange }) {
  const parsed = parseNumFilter(value) || { op: 'gt', a: '', b: '' }
  const op = AMOUNT_OPS.some((o) => o.value === parsed.op) ? parsed.op : 'gt'

  function emit(nextOp, a, b) {
    const emptyA = a === '' || a == null
    const emptyB = b === '' || b == null
    if (nextOp === 'between') {
      if (emptyA && emptyB) onChange?.(columnKey, '')
      else onChange?.(columnKey, encodeNumFilter('between', a ?? '', b ?? ''))
      return
    }
    if (emptyA) onChange?.(columnKey, '')
    else onChange?.(columnKey, encodeNumFilter(nextOp, a ?? ''))
  }

  return (
    <div
      className="musteri-th__amount-filter"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <select
        className="musteri-th__filter-op"
        value={op}
        onChange={(e) => emit(e.target.value, parsed.a, parsed.b)}
        aria-label={`${label} müqayisə`}
        title="Müqayisə"
      >
        {AMOUNT_OPS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        type="number"
        step="any"
        className="musteri-th__filter-input musteri-th__filter-input--amount"
        value={parsed.a}
        onChange={(e) => emit(op, e.target.value, parsed.b)}
        placeholder={op === 'between' ? 'min' : 'məbləğ'}
        aria-label={`${label} ${op === 'between' ? 'min' : 'dəyər'}`}
      />
      {op === 'between' && (
        <input
          type="number"
          step="any"
          className="musteri-th__filter-input musteri-th__filter-input--amount"
          value={parsed.b}
          onChange={(e) => emit(op, parsed.a, e.target.value)}
          placeholder="max"
          aria-label={`${label} max`}
        />
      )}
    </div>
  )
}

function FunnelIcon({ active }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M1.5 2h9L7.2 6.2V10L4.8 8.8V6.2L1.5 2Z"
        stroke="currentColor"
        strokeWidth={active ? 1.6 : 1.25}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.22 : 0}
      />
    </svg>
  )
}

/**
 * Filter control inside the column header (funnel → popover).
 * Replaces the old second filter row under headers.
 */
export function HeaderColumnFilter({ column, value, onChange }) {
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const active = Boolean(value && String(value).trim())
  const isAmount = isAmountColumn(column)

  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      className={`musteri-th__filter-pop${active ? ' musteri-th__filter-pop--active' : ''}${open ? ' musteri-th__filter-pop--open' : ''}`}
      ref={rootRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="musteri-th__filter-btn"
        title={active ? 'Filter aktiv' : 'Filter'}
        aria-label={`${column.label} filter`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <FunnelIcon active={active || open} />
      </button>
      {open && (
        <div className="musteri-th__filter-panel">
          {isAmount ? (
            <AmountColumnFilter
              columnKey={column.key}
              label={column.label}
              value={value ?? ''}
              onChange={(_, next) => onChange?.(column.key, next)}
            />
          ) : (
            <input
              type={column.type === 'date' ? 'date' : 'search'}
              className="musteri-th__filter-input"
              value={value ?? ''}
              onChange={(e) => onChange?.(column.key, e.target.value)}
              placeholder="Axtar…"
              aria-label={`${column.label} filter`}
              autoFocus
            />
          )}
          {active && (
            <button
              type="button"
              className="btn btn--secondary musteri-th__filter-clear"
              onClick={() => onChange?.(column.key, '')}
            >
              Təmizlə
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Excel-like column filter: type to filter the table live (contains match).
 * Optional value list — click a value to set an exact filter.
 */
export default function ColumnFilter({
  columnKey,
  label,
  allRows,
  getValue,
  selected,
  onChange,
  open,
  onToggle,
  onClose,
}) {
  const rootRef = useRef(null)
  const query = typeof selected === 'string' ? selected : ''
  const [draft, setDraft] = useState(() => selectedToDraft(query))

  useEffect(() => {
    if (open) setDraft(selectedToDraft(query))
  }, [open, query])

  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose?.()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])

  const uniqueValues = useMemo(() => {
    const set = new Set()
    for (const row of allRows || []) {
      const raw = getValue(row)
      if (raw === null || raw === undefined || String(raw).trim() === '') set.add('(boş)')
      else set.add(String(raw))
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'az', { numeric: true }))
  }, [allRows, getValue])

  const listOptions = useMemo(() => {
    const q = draft.trim().toLowerCase()
    if (!q) return uniqueValues.slice(0, 80)
    return uniqueValues.filter((v) => v.toLowerCase().includes(q)).slice(0, 80)
  }, [uniqueValues, draft])

  const isActive = Boolean(query.trim())
  const activeExact = query === BLANK ? '(boş)' : query.startsWith(EQ) ? query.slice(EQ.length) : null

  function applyLive(next) {
    setDraft(next)
    onChange?.(columnKey, next)
  }

  function pickValue(v) {
    if (v === '(boş)') {
      setDraft('')
      onChange?.(columnKey, BLANK)
    } else {
      setDraft(v)
      onChange?.(columnKey, `${EQ}${v}`)
    }
    onClose?.()
  }

  function clearFilter() {
    setDraft('')
    onChange?.(columnKey, '')
  }

  return (
    <div className="col-filter" ref={rootRef}>
      <button
        type="button"
        className={`col-filter__btn ${isActive ? 'col-filter__btn--active' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onToggle?.(columnKey)
        }}
        title={`${label} filter`}
        aria-label={`${label} filter`}
      >
        ▾
      </button>
      {open && (
        <div className="col-filter__menu" onMouseDown={(e) => e.stopPropagation()}>
          <div className="col-filter__search">
            <input
              autoFocus
              value={draft}
              onChange={(e) => applyLive(e.target.value)}
              placeholder="Yazın — cədvəl dərhal filter olunur…"
            />
          </div>
          <div className="col-filter__list">
            {listOptions.length === 0 ? (
              <div className="col-filter__empty">Uyğun dəyər yoxdur</div>
            ) : (
              listOptions.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`col-filter__value${activeExact === v ? ' col-filter__value--active' : ''}`}
                  onClick={() => pickValue(v)}
                  title={v}
                >
                  {v}
                </button>
              ))
            )}
          </div>
          <div className="col-filter__actions">
            <button type="button" className="btn btn--secondary" onClick={clearFilter}>
              Filteri təmizlə
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function rowPassesFilters(row, filters, columns, getRowValue) {
  for (const col of columns || []) {
    const raw = filters?.[col.key]
    if (raw === null || raw === undefined) continue
    const q = String(raw)
    if (!q.trim()) continue

    const cell = getRowValue(row, col)
    const isBlank = cell === null || cell === undefined || String(cell).trim() === ''

    if (q === BLANK) {
      if (!isBlank) return false
      continue
    }

    const numParsed = parseNumFilter(q)
    if (numParsed) {
      if (!matchesNumFilter(cell, numParsed)) return false
      continue
    }

    // Plain numeric compare for money/number when user types ">100" / "<50" / "10-20"
    if (isAmountColumn(col)) {
      const shorthand = parseAmountShorthand(q)
      if (shorthand) {
        if (!matchesNumFilter(cell, shorthand)) return false
        continue
      }
      const asNum = toNumber(q)
      if (asNum != null) {
        if (!matchesNumFilter(cell, { op: 'eq', a: String(asNum), b: '' })) return false
        continue
      }
    }

    const cellText = isBlank ? '' : String(cell)

    if (q.startsWith(EQ)) {
      if (cellText !== q.slice(EQ.length)) return false
      continue
    }

    if (!cellText.toLowerCase().includes(q.trim().toLowerCase())) return false
  }
  return true
}

export function sortRows(rows, sort, columns, getRowValue) {
  if (!sort?.key) return rows
  const col = columns.find((c) => c.key === sort.key)
  if (!col) return rows
  const dir = sort.dir === 'desc' ? -1 : 1
  const next = [...rows]
  next.sort((a, b) => {
    const av = getRowValue(a, col)
    const bv = getRowValue(b, col)
    const aEmpty = av === null || av === undefined || String(av).trim() === ''
    const bEmpty = bv === null || bv === undefined || String(bv).trim() === ''
    if (aEmpty && bEmpty) return 0
    if (aEmpty) return 1
    if (bEmpty) return -1
    if (col.type === 'money' || col.type === 'number') {
      const an = toNumber(av)
      const bn = toNumber(bv)
      if (an != null && bn != null) return (an - bn) * dir
    }
    if (col.type === 'date') {
      const at = new Date(av).getTime()
      const bt = new Date(bv).getTime()
      if (!Number.isNaN(at) && !Number.isNaN(bt)) return (at - bt) * dir
    }
    return String(av).localeCompare(String(bv), 'az', { numeric: true }) * dir
  })
  return next
}
