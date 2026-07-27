import { useEffect, useMemo, useRef, useState } from 'react'

const BLANK = '__blank__'
const EQ = '__eq__:'

function selectedToDraft(selected) {
  const q = typeof selected === 'string' ? selected : ''
  if (!q || q === BLANK) return ''
  if (q.startsWith(EQ)) return q.slice(EQ.length)
  return q
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
      const an = Number(av)
      const bn = Number(bv)
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return (an - bn) * dir
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
