import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { confirmDelete } from '../../lib/confirmDelete'
import { useColumnConfig } from './useColumnConfig'
import ResizableDataTable from '../musteri-bazasi/ResizableDataTable'
import { applyKeyOrder } from '../musteri-bazasi/columnOrder'
import {
  DEPO_TABLE,
  formatCell,
  getRowValue,
  formatMoney,
} from './constants'
import { LEDGER_TABLE } from '../borc-nisye/constants'
import CollapsibleSummary from '../../components/CollapsibleSummary'
import '../../styles/shared.css'

function sumField(rows, key) {
  return rows.reduce((acc, row) => {
    const n = Number(row[key])
    return acc + (Number.isNaN(n) ? 0 : n)
  }, 0)
}

export default function DepoList() {
  const navigate = useNavigate()
  const { columns, loading: colsLoading, saveColumns } = useColumnConfig()
  const [items, setItems] = useState([])
  const [viewRows, setViewRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [localCols, setLocalCols] = useState([])
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [deletingId, setDeletingId] = useState(null)
  const resizeTimer = useRef(null)

  useEffect(() => setLocalCols(columns), [columns])

  const visibleCols = useMemo(() => localCols.filter((c) => c.visible !== false), [localCols])

  async function load() {
    setLoading(true)
    setError(null)
    const term = search.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')
    const { data, error: e } = await fetchAllPages(() => {
      let q = supabase.from(DEPO_TABLE).select('*').order('sira_no', { ascending: true })
      if (term) {
        q = q.or(
          `model.ilike.%${term}%,imei_1.ilike.%${term}%,imei_2.ilike.%${term}%,reng.ilike.%${term}%,kimden_alinib.ilike.%${term}%,nomre.ilike.%${term}%,sexsiyyet.ilike.%${term}%,serial_no.ilike.%${term}%`
        )
      }
      return q
    })
    if (e) {
      setError(e.message)
      setItems([])
    } else {
      const rows = data || []
      // Mövcud items first so Satış is easy to find
      rows.sort((a, b) => {
        const av = a.status === 'available' ? 0 : 1
        const bv = b.status === 'available' ? 0 : 1
        if (av !== bv) return av - bv
        return (a.sira_no ?? 0) - (b.sira_no ?? 0)
      })
      setItems(rows)
    }
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [search])

  async function handleDeleteRow(row) {
    const label = row.model || (row.sira_no != null ? `#${row.sira_no}` : 'bu qeyd')
    if (!confirmDelete(`«${label}» Depodan silinsin?`)) return
    setDeletingId(row.id)
    setError(null)
    try {
      await supabase.from(LEDGER_TABLE).delete().eq('depo_id', row.id).eq('tip', 'nisye_aldim')
      const { error: err } = await supabase.from(DEPO_TABLE).delete().eq('id', row.id)
      if (err) throw err
      setItems((prev) => prev.filter((r) => r.id !== row.id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const availableCount = viewRows.filter((r) => r.status === 'available').length
  const totals = useMemo(
    () => ({
      alis: sumField(viewRows, 'alis_qiymeti'),
      miqdar: sumField(viewRows, 'miqdar'),
    }),
    [viewRows]
  )

  function toggleSelect(row) {
    if (row.status !== 'available') return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(row.id)) next.delete(row.id)
      else next.add(row.id)
      return next
    })
  }

  function startSale(ids) {
    const list = [...ids]
    if (!list.length) return
    navigate('/depo/satish', { state: { ids: list } })
  }

  const handleReorder = useCallback(
    async (orderedVisible) => {
      const next = applyKeyOrder(localCols, orderedVisible.map((c) => c.key))
      setLocalCols(next)
      try { await saveColumns(next) } catch (err) { setError(err.message) }
    },
    [localCols, saveColumns]
  )

  const handleResize = useCallback(
    (key, width) => {
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

  if (error) return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginBottom: 16 }}>
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 240px', maxWidth: 360 }}>
          <label>Axtarış</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Model, IMEI…" />
        </div>
        <Link to="/depo/sutunlar" className="btn btn--secondary">Sütunları idarə et</Link>
      </div>

      {selectedIds.size > 0 && (
        <div
          className="card"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            marginBottom: 16,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
          }}
        >
          <span style={{ fontSize: 14 }}>
            Səbət: <strong>{selectedIds.size}</strong> məhsul seçilib
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--secondary" onClick={() => setSelectedIds(new Set())}>
              Seçimi təmizlə
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => startSale(selectedIds)}
            >
              Satış ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {!loading && !colsLoading && (
        <CollapsibleSummary title="Cəmlər" storageKey="summary:depo">
          <div className="musteri-summary">
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Mövcud</div>
              <div className="musteri-summary__value">{availableCount}</div>
            </div>
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Ümumi alış</div>
              <div className="musteri-summary__value">{formatMoney(totals.alis)}</div>
            </div>
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Ümumi miqdar</div>
              <div className="musteri-summary__value">{totals.miqdar}</div>
            </div>
            <div className="musteri-summary__card musteri-summary__card--meta">
              <div className="musteri-summary__label">Sətir sayı</div>
              <div className="musteri-summary__value">{viewRows.length}</div>
            </div>
          </div>
        </CollapsibleSummary>
      )}

      <div className="card">
        {loading || colsLoading ? (
          <p className="empty-state">Yüklənir…</p>
        ) : (
          <ResizableDataTable
            columns={visibleCols}
            rows={items}
            onReorderColumns={handleReorder}
            onResizeColumn={handleResize}
            formatCell={formatCell}
            getRowValue={getRowValue}
            onRowOpen={(row) => navigate(`/depo/${row.id}`)}
            onDisplayRowsChange={setViewRows}
            prefsKey="depo"
            selection={{
              selectedIds,
              isSelectable: (row) => row.status === 'available',
              onToggle: toggleSelect,
            }}
            renderActions={(row) => (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {row.status === 'available' && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => startSale([row.id])}
                  >
                    Satış
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--danger"
                  disabled={deletingId === row.id}
                  onClick={() => handleDeleteRow(row)}
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >
                  {deletingId === row.id ? '…' : 'Sil'}
                </button>
              </div>
            )}
          />
        )}
      </div>
    </>
  )
}
