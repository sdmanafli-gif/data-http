import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  loadTableZoom,
  saveTableZoom,
  moveItem,
  TABLE_ZOOM_MAX,
  TABLE_ZOOM_MIN,
  TABLE_ZOOM_STEP,
} from './columnOrder'
import { formatCell as defaultFormatCell, getRowValue as defaultGetRowValue } from './constants'
import { rowPassesFilters, sortRows } from './ColumnFilter'
import { confirmDelete } from '../../lib/confirmDelete'
import './musteri-table.css'

/**
 * Shared data table: LTR columns, sticky header, native per-column filter row.
 * Selection stays left; Əməliyyat actions stay right.
 */
export default function ResizableDataTable({
  columns,
  rows,
  onReorderColumns,
  onResizeColumn,
  renderActions,
  renderCell,
  onRowOpen,
  selection,
  onDisplayRowsChange,
  emptyText = 'Qeyd tapılmadı.',
  formatCell = defaultFormatCell,
  getRowValue = defaultGetRowValue,
}) {
  const [zoom, setZoom] = useState(loadTableZoom)
  const [dragKey, setDragKey] = useState(null)
  const [overKey, setOverKey] = useState(null)
  const [filters, setFilters] = useState({})
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [labelRowHeight, setLabelRowHeight] = useState(40)
  const resizing = useRef(null)
  const labelsRowRef = useRef(null)
  const showActions = typeof renderActions === 'function'

  useEffect(() => {
    saveTableZoom(zoom)
  }, [zoom])

  useEffect(() => {
    const el = labelsRowRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const update = () => setLabelRowHeight(Math.ceil(el.getBoundingClientRect().height) || 40)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [columns, selection, showActions, zoom])

  useEffect(() => {
    function onMove(e) {
      const r = resizing.current
      if (!r) return
      const dx = e.clientX - r.startX
      const next = Math.max(80, Math.round(r.startW + dx))
      onResizeColumn?.(r.key, next)
    }
    function onUp() {
      resizing.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [onResizeColumn])

  const displayRows = useMemo(() => {
    const filtered = (rows || []).filter((row) =>
      rowPassesFilters(row, filters, columns, getRowValue)
    )
    return sortRows(filtered, sort, columns, getRowValue)
  }, [rows, filters, sort, columns, getRowValue])

  const onDisplayRowsChangeRef = useRef(onDisplayRowsChange)
  onDisplayRowsChangeRef.current = onDisplayRowsChange

  useEffect(() => {
    onDisplayRowsChangeRef.current?.(displayRows)
  }, [displayRows])

  function changeZoom(delta) {
    setZoom((z) => {
      const next = Math.round((z + delta) * 10) / 10
      return Math.min(TABLE_ZOOM_MAX, Math.max(TABLE_ZOOM_MIN, next))
    })
  }

  function onDragStart(e, key) {
    setDragKey(key)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', key)
  }

  function onDragOver(e, key) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (key !== overKey) setOverKey(key)
  }

  function onDrop(e, targetKey) {
    e.preventDefault()
    const fromKey = dragKey || e.dataTransfer.getData('text/plain')
    setDragKey(null)
    setOverKey(null)
    if (!fromKey || fromKey === targetKey) return
    const keys = columns.map((c) => c.key)
    const from = keys.indexOf(fromKey)
    const to = keys.indexOf(targetKey)
    if (from < 0 || to < 0) return
    const nextVisible = moveItem(columns, from, to)
    onReorderColumns?.(nextVisible)
  }

  function startResize(e, col) {
    e.preventDefault()
    e.stopPropagation()
    const th = e.currentTarget.parentElement
    resizing.current = {
      key: col.key,
      startX: e.clientX,
      startW: th?.offsetWidth || col.width || 140,
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return { key: null, dir: 'asc' }
    })
  }

  function setColumnFilter(key, value) {
    setFilters((prev) => {
      const next = { ...prev }
      if (value == null || String(value).trim() === '') delete next[key]
      else next[key] = String(value)
      return next
    })
  }

  function clearAllFilters() {
    setFilters({})
    setSort({ key: null, dir: 'asc' })
  }

  const colSpan = columns.length + (selection ? 1 : 0) + (showActions ? 1 : 0)
  const activeFilterCount = Object.values(filters).filter((v) => String(v || '').trim()).length

  function renderHeaderCell(c) {
    return (
      <th
        key={c.key}
        className={[
          'musteri-th',
          dragKey === c.key ? 'musteri-th--dragging' : '',
          overKey === c.key && dragKey !== c.key ? 'musteri-th--drag-over' : '',
          sort.key === c.key ? 'musteri-th--sorted' : '',
          filters[c.key] ? 'musteri-th--filtered' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ width: c.width || 160, minWidth: c.width || 100 }}
        onDragOver={(e) => onDragOver(e, c.key)}
        onDrop={(e) => onDrop(e, c.key)}
        onDragLeave={() => setOverKey((k) => (k === c.key ? null : k))}
      >
        <div className="musteri-th__row">
          <span
            className="musteri-th__drag"
            draggable
            onDragStart={(e) => onDragStart(e, c.key)}
            onDragEnd={() => {
              setDragKey(null)
              setOverKey(null)
            }}
            title="Sürükleyib sütun sırasını dəyişin"
          >
            <span className="musteri-th__handle" aria-hidden>
              ⋮⋮
            </span>
          </span>
          <button
            type="button"
            className="musteri-th__sort"
            onClick={() => toggleSort(c.key)}
            title="Sırala"
          >
            <span className="musteri-th__label">{c.label}</span>
            <span className="musteri-th__sort-icon" aria-hidden>
              {sort.key === c.key ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
            </span>
          </button>
        </div>
        <span
          className="musteri-th__resizer"
          onMouseDown={(e) => startResize(e, c)}
          title="Eni dəyişin"
        />
      </th>
    )
  }

  function renderFilterCell(c) {
    const type = c.type === 'date' ? 'date' : c.type === 'number' || c.type === 'money' ? 'search' : 'search'
    return (
      <th key={`f-${c.key}`} className="musteri-th musteri-th--filter">
        <input
          type={type === 'date' ? 'date' : 'search'}
          className="musteri-th__filter-input"
          value={filters[c.key] ?? ''}
          onChange={(e) => setColumnFilter(c.key, e.target.value)}
          placeholder="Axtar…"
          aria-label={`${c.label} filter`}
          onClick={(e) => e.stopPropagation()}
        />
      </th>
    )
  }

  function renderBodyCell(row, c) {
    return (
      <td
        key={c.key}
        className={c.type === 'money' || c.type === 'number' ? 'num' : undefined}
        style={{ width: c.width || 160 }}
        onClick={(e) => {
          if (e.target.closest('input, select, textarea, button, a, label')) {
            e.stopPropagation()
          }
        }}
      >
        {renderCell
          ? renderCell(row, c, getRowValue(row, c))
          : formatCell(getRowValue(row, c), c)}
      </td>
    )
  }

  return (
    <>
      <div className="musteri-table-toolbar">
        <button type="button" className="btn btn--secondary" onClick={() => changeZoom(-TABLE_ZOOM_STEP)} title="Kiçilt">
          −
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => setZoom(1)} title="Sıfırla">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => changeZoom(TABLE_ZOOM_STEP)} title="Böyüt">
          +
        </button>
        {(activeFilterCount > 0 || sort.key) && (
          <button type="button" className="btn btn--secondary" onClick={clearAllFilters}>
            Filterləri təmizlə
            {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        )}
        <span className="musteri-table-toolbar__hint">
          Başlığa klik = sırala · altdakı xana = filter
          {displayRows.length !== (rows || []).length
            ? ` · ${displayRows.length} / ${(rows || []).length}`
            : ` · ${displayRows.length} sətir`}
        </span>
      </div>

      <div className="musteri-table-shell">
        <div style={{ zoom, transformOrigin: 'top left' }}>
          <table
            className="data-table data-table--friendly"
            style={{ '--musteri-label-row-h': `${labelRowHeight}px` }}
          >
            <thead>
              <tr className="musteri-thead__labels" ref={labelsRowRef}>
                {selection && (
                  <th className="musteri-th musteri-th--sticky-left" style={{ width: 44, minWidth: 44 }} title="Seç">
                    <span className="musteri-th__label">✓</span>
                  </th>
                )}
                {columns.map((c) => renderHeaderCell(c))}
                {showActions && (
                  <th className="musteri-th musteri-th--actions" style={{ width: 160, minWidth: 140 }}>
                    Əməliyyat
                  </th>
                )}
              </tr>
              <tr className="musteri-thead__filters">
                {selection && (
                  <th className="musteri-th musteri-th--filter musteri-th--sticky-left" style={{ width: 44 }} />
                )}
                {columns.map((c) => renderFilterCell(c))}
                {showActions && (
                  <th className="musteri-th musteri-th--filter musteri-th--actions" />
                )}
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="empty-state">
                    {activeFilterCount > 0
                      ? 'Filterə uyğun qeyd yoxdur. Filteri təmizləyin və ya dəyişin.'
                      : emptyText}
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => {
                  const selectable = selection?.isSelectable ? selection.isSelectable(row) : true
                  const checked = Boolean(selection?.selectedIds?.has?.(row.id))
                  return (
                    <tr
                      key={row.id}
                      className={onRowOpen ? 'data-table__row--clickable' : undefined}
                      onClick={onRowOpen ? () => onRowOpen(row) : undefined}
                      onKeyDown={
                        onRowOpen
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                onRowOpen(row)
                              }
                            }
                          : undefined
                      }
                      tabIndex={onRowOpen ? 0 : undefined}
                    >
                      {selection && (
                        <td
                          className="musteri-td--sticky-left"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!selectable}
                            onChange={() => selection.onToggle?.(row)}
                            aria-label="Seç"
                          />
                        </td>
                      )}
                      {columns.map((c) => renderBodyCell(row, c))}
                      {showActions && (
                        <td
                          className="musteri-td--actions"
                          style={{ whiteSpace: 'nowrap' }}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {renderActions?.(row)}
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export function MusteriRowActions({ row, onDelete }) {
  return (
    <>
      <Link className="btn btn--primary" to={`/musteri-bazasi/${row.id}`} style={{ marginRight: 6 }}>
        Aç
      </Link>
      <button
        type="button"
        className="btn btn--danger"
        onClick={() => {
          if (!confirmDelete('Bu qeyd silinsin?')) return
          onDelete(row.id)
        }}
      >
        Sil
      </button>
    </>
  )
}
