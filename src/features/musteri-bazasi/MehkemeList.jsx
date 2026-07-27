import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { useColumnConfig } from './useColumnConfig'
import ResizableDataTable from './ResizableDataTable'
import SummaryCards from './SummaryCards'
import MusteriRecordModule from './MusteriRecordModule'
import { applyKeyOrder } from './columnOrder'
import {
  MUSTERI_TABLE,
  MEHKEME_STATUS_OPTIONS,
  formatCell,
  getRowValue,
  formatMoney,
} from './constants'
import '../../styles/shared.css'
import './musteri-table.css'
import './musteri-schedule.css'

const MEHKEME_COL_KEYS = new Set([
  'mehkeme_isare',
  'rusum_odenilib',
  'mehkeme_status',
  'mehkeme_qeyd',
])

const MEHKEME_EXTRA = [
  {
    key: 'mehkeme_isare',
    label: '☐',
    type: 'checkbox',
    visible: true,
    width: 52,
    system: true,
  },
  {
    key: 'rusum_odenilib',
    label: 'Rüsüm ödənilib',
    type: 'money',
    visible: true,
    width: 130,
    system: true,
  },
  {
    key: 'mehkeme_status',
    label: 'Məhkəmə statusu',
    type: 'select',
    visible: true,
    width: 160,
    system: true,
    options: MEHKEME_STATUS_OPTIONS,
  },
  {
    key: 'mehkeme_qeyd',
    label: 'Məhkəmə komment',
    type: 'text',
    visible: true,
    width: 200,
    system: true,
  },
]

function sumField(rows, key) {
  return rows.reduce((acc, row) => {
    const n = Number(row[key])
    return acc + (Number.isNaN(n) ? 0 : n)
  }, 0)
}

function parseAmount(raw) {
  if (raw === '' || raw == null) return null
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

/**
 * Same müştəri columns as Müştəri Bazası, filtered to veziyyet = Məhkəmə,
 * plus editable məhkəmə fields.
 */
export default function MehkemeList() {
  const navigate = useNavigate()
  const { columns, loading: colsLoading, saveColumns } = useColumnConfig()
  const [items, setItems] = useState([])
  const [viewRows, setViewRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [localCols, setLocalCols] = useState([])
  const [openRow, setOpenRow] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const resizeTimer = useRef(null)

  useEffect(() => {
    setLocalCols(columns)
  }, [columns])

  /** All visible müştəri columns + məhkəmə extras first (always shown here). */
  const displayColumns = useMemo(() => {
    const base = (localCols || [])
      .filter((c) => c.visible !== false && !MEHKEME_COL_KEYS.has(c.key) && c.type !== 'files')
      .map((c) => ({ ...c }))
    return [...MEHKEME_EXTRA, ...base]
  }, [localCols])

  async function load() {
    setLoading(true)
    setError(null)
    const term = search.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')
    const { data, error: e } = await fetchAllPages(() => {
      let q = supabase
        .from(MUSTERI_TABLE)
        .select('*')
        .eq('veziyyet', 'Məhkəmə')
        .order('sira_no', { ascending: true })
      if (statusFilter) q = q.eq('mehkeme_status', statusFilter)
      if (term) {
        const parts = [
          `ad_soyad.ilike.%${term}%`,
          `model.ilike.%${term}%`,
          `imei_1.ilike.%${term}%`,
          `nomre_1.ilike.%${term}%`,
          `muqavile_nomresi.ilike.%${term}%`,
          `mehkeme_qeyd.ilike.%${term}%`,
        ]
        if (/^\d+$/.test(term)) parts.push(`sira_no.eq.${Number(term)}`)
        q = q.or(parts.join(','))
      }
      return q
    })
    if (e) {
      setError(e.message)
      setItems([])
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [search, statusFilter])

  const totals = useMemo(
    () => ({
      alis_qiymeti: sumField(viewRows, 'alis_qiymeti'),
      satis_qiymeti: sumField(viewRows, 'satis_qiymeti'),
      verilib: sumField(viewRows, 'verilib'),
      qalan_borc: sumField(viewRows, 'qalan_borc'),
      faiz: sumField(viewRows, 'faiz'),
      rusum_odenilib: sumField(viewRows, 'rusum_odenilib'),
    }),
    [viewRows]
  )

  const handleReorder = useCallback(
    async (orderedVisible) => {
      // Keep məhkəmə extras pinned at front; persist only müştəri column order
      const mehkemeOrdered = orderedVisible.filter((c) => MEHKEME_COL_KEYS.has(c.key))
      const restOrdered = orderedVisible.filter((c) => !MEHKEME_COL_KEYS.has(c.key))
      const nextLocal = applyKeyOrder(localCols, restOrdered.map((c) => c.key))
      setLocalCols(nextLocal)
      // displayColumns rebuilds from MEHKEME_EXTRA + nextLocal — preserve mehkeme order in EXTRA constant
      void mehkemeOrdered
      try {
        await saveColumns(nextLocal)
      } catch (err) {
        setError(err.message)
      }
    },
    [localCols, saveColumns]
  )

  const handleResize = useCallback(
    (key, width) => {
      if (MEHKEME_COL_KEYS.has(key)) return
      setLocalCols((prev) => {
        const next = prev.map((c) => (c.key === key ? { ...c, width } : c))
        clearTimeout(resizeTimer.current)
        resizeTimer.current = setTimeout(() => {
          saveColumns(next).catch((err) => setError(err.message))
        }, 400)
        return next
      })
    },
    [saveColumns]
  )

  async function patchRow(id, patch) {
    setSavingId(id)
    setError(null)
    try {
      const { error: err } = await supabase
        .from(MUSTERI_TABLE)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (err) throw err
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
      if (openRow?.id === id) setOpenRow((r) => (r ? { ...r, ...patch } : r))
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  const renderCell = useCallback(
    (row, col, value) => {
      const busy = savingId === row.id
      if (col.key === 'mehkeme_isare') {
        return (
          <input
            type="checkbox"
            checked={Boolean(row.mehkeme_isare)}
            disabled={busy}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => patchRow(row.id, { mehkeme_isare: e.target.checked })}
            aria-label="İşarə"
          />
        )
      }
      if (col.key === 'rusum_odenilib') {
        return (
          <input
            type="number"
            step="0.01"
            min="0"
            disabled={busy}
            defaultValue={row.rusum_odenilib ?? ''}
            key={`rusum-${row.id}-${row.rusum_odenilib ?? ''}`}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const next = parseAmount(e.target.value)
              const prev =
                row.rusum_odenilib == null || row.rusum_odenilib === ''
                  ? null
                  : Number(row.rusum_odenilib)
              if (next === prev) return
              patchRow(row.id, { rusum_odenilib: next })
            }}
            style={{ width: '100%', minWidth: 90 }}
          />
        )
      }
      if (col.key === 'mehkeme_status') {
        return (
          <select
            value={row.mehkeme_status || ''}
            disabled={busy}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => patchRow(row.id, { mehkeme_status: e.target.value || null })}
            style={{ width: '100%', minWidth: 140 }}
          >
            <option value="">— Seçin —</option>
            {MEHKEME_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )
      }
      if (col.key === 'mehkeme_qeyd') {
        return (
          <input
            type="text"
            disabled={busy}
            defaultValue={row.mehkeme_qeyd || ''}
            key={`qeyd-${row.id}-${row.mehkeme_qeyd || ''}`}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const next = e.target.value.trim() || null
              const prev = row.mehkeme_qeyd || null
              if (next === prev) return
              patchRow(row.id, { mehkeme_qeyd: next })
            }}
            placeholder="Komment…"
            style={{ width: '100%', minWidth: 140 }}
          />
        )
      }
      return formatCell(value, col)
    },
    [savingId]
  )

  if (error && !items.length && !loading) {
    return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'flex-end',
          marginBottom: 16,
        }}
      >
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 220px', maxWidth: 320 }}>
          <label>Axtarış</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="№, ad, model, IMEI, nömrə…"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
          <label>Məhkəmə statusu</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Hamısı</option>
            {MEHKEME_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <Link to="/musteri-bazasi/sutunlar" className="btn btn--secondary">
          Sütunları idarə et
        </Link>
        <Link to="/musteri-bazasi" className="btn btn--secondary">
          Müştəri Bazası
        </Link>
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      {!loading && !colsLoading && (
        <>
          <SummaryCards totals={totals} rowCount={viewRows.length} />
          <div className="musteri-summary" style={{ marginTop: 0 }}>
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Rüsüm cəmi</div>
              <div className="musteri-summary__value">{formatMoney(totals.rusum_odenilib)}</div>
            </div>
          </div>
        </>
      )}

      <div className="card">
        {loading || colsLoading ? (
          <p className="empty-state">Yüklənir…</p>
        ) : (
          <ResizableDataTable
            columns={displayColumns}
            rows={items}
            onReorderColumns={handleReorder}
            onResizeColumn={handleResize}
            formatCell={formatCell}
            getRowValue={getRowValue}
            renderCell={renderCell}
            onRowOpen={(row) => setOpenRow(row)}
            onDisplayRowsChange={setViewRows}
            emptyText="Vəziyyəti «Məhkəmə» olan qeyd yoxdur. Müştəri Bazasında vəziyyəti Məhkəmə edin."
          />
        )}
      </div>

      {openRow && (
        <div
          className="telefon-modal-overlay musteri-record-overlay"
          onClick={() => setOpenRow(null)}
          role="presentation"
        >
          <div className="telefon-modal musteri-record-modal" onClick={(e) => e.stopPropagation()}>
            <MusteriRecordModule
              key={openRow.id}
              record={openRow}
              onClose={() => setOpenRow(null)}
              onEdit={(row) => {
                setOpenRow(null)
                navigate(`/musteri-bazasi/${row.id}?edit=1`)
              }}
              onUpdated={(updated) => {
                setOpenRow(updated)
                setItems((prev) =>
                  prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
                )
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}
