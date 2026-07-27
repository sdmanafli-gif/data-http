import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { useColumnConfig } from './useColumnConfig'
import ResizableDataTable from '../musteri-bazasi/ResizableDataTable'
import { applyKeyOrder } from '../musteri-bazasi/columnOrder'
import { NAGD_TABLE, formatCell, getRowValue, formatMoney } from './constants'
import '../../styles/shared.css'

function sumField(rows, key) {
  return rows.reduce((acc, row) => {
    const n = Number(row[key])
    return acc + (Number.isNaN(n) ? 0 : n)
  }, 0)
}

export default function NagdList() {
  const navigate = useNavigate()
  const { columns, loading: colsLoading, saveColumns } = useColumnConfig()
  const [items, setItems] = useState([])
  const [viewRows, setViewRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [localCols, setLocalCols] = useState([])
  const resizeTimer = useRef(null)

  useEffect(() => setLocalCols(columns), [columns])
  const visibleCols = useMemo(() => localCols.filter((c) => c.visible !== false), [localCols])

  async function load() {
    setLoading(true)
    setError(null)
    const term = search.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')
    const { data, error: e } = await fetchAllPages(() => {
      let q = supabase.from(NAGD_TABLE).select('*').order('sira_no', { ascending: true })
      if (term) {
        q = q.or(
          `kime.ilike.%${term}%,model.ilike.%${term}%,imei_1.ilike.%${term}%,imei_2.ilike.%${term}%,satici.ilike.%${term}%,serial_no.ilike.%${term}%`
        )
      }
      return q
    })
    if (e) {
      setError(e.message)
      setItems([])
    } else setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [search])

  const totals = useMemo(
    () => ({
      alis: sumField(viewRows, 'alis_qiymeti'),
      satis: sumField(viewRows, 'satis_qiymeti'),
      xeyir: sumField(viewRows, 'xeyir'),
      xeyirFaizle: sumField(viewRows, 'xeyir_faizle'),
    }),
    [viewRows]
  )

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
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kimə, model, IMEI, satıcı…" />
        </div>
        <Link to="/nagd-satish/sutunlar" className="btn btn--secondary">Sütunları idarə et</Link>
        <Link to="/nagd-satish/idxal" className="btn btn--secondary">Excel idxal</Link>
      </div>

      {!loading && !colsLoading && (
        <div className="musteri-summary">
          <div className="musteri-summary__card">
            <div className="musteri-summary__label">Ümumi alış</div>
            <div className="musteri-summary__value">{formatMoney(totals.alis)}</div>
          </div>
          <div className="musteri-summary__card">
            <div className="musteri-summary__label">Ümumi satış</div>
            <div className="musteri-summary__value">{formatMoney(totals.satis)}</div>
          </div>
          <div className="musteri-summary__card">
            <div className="musteri-summary__label">Ümumi xeyir</div>
            <div className="musteri-summary__value">{formatMoney(totals.xeyir)}</div>
          </div>
          <div className="musteri-summary__card">
            <div className="musteri-summary__label">Xeyir (faizlə)</div>
            <div className="musteri-summary__value">{formatMoney(totals.xeyirFaizle)}</div>
          </div>
          <div className="musteri-summary__card musteri-summary__card--meta">
            <div className="musteri-summary__label">Sətir sayı</div>
            <div className="musteri-summary__value">{viewRows.length}</div>
          </div>
        </div>
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
            onRowOpen={(row) => navigate(`/nagd-satish/${row.id}`)}
            onDisplayRowsChange={setViewRows}
          />
        )}
      </div>
    </>
  )
}
