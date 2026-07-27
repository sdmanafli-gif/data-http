import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { useColumnConfig } from './useColumnConfig'
import ResizableDataTable from './ResizableDataTable'
import SummaryCards from './SummaryCards'
import MusteriRecordModule from './MusteriRecordModule'
import { applyKeyOrder } from './columnOrder'
import { MUSTERI_TABLE } from './constants'
import '../../styles/shared.css'
import './musteri-schedule.css'

function sumField(rows, key) {
  return rows.reduce((acc, row) => {
    const n = Number(row[key])
    return acc + (Number.isNaN(n) ? 0 : n)
  }, 0)
}

export default function MusteriList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const openId = searchParams.get('open')
  const { columns, loading: colsLoading, saveColumns } = useColumnConfig()
  const [items, setItems] = useState([])
  const [viewRows, setViewRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [localCols, setLocalCols] = useState([])
  const [openRow, setOpenRow] = useState(null)
  const resizeTimer = useRef(null)

  useEffect(() => {
    setLocalCols(columns)
  }, [columns])

  const visibleCols = useMemo(
    () => localCols.filter((c) => c.visible !== false),
    [localCols]
  )

  async function load() {
    setLoading(true)
    setError(null)
    const term = search.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')
    const { data, error: e } = await fetchAllPages(() => {
      let q = supabase.from(MUSTERI_TABLE).select('*').order('sira_no', { ascending: true })
      if (term) {
        const parts = [
          `ad_soyad.ilike.%${term}%`,
          `model.ilike.%${term}%`,
          `imei_1.ilike.%${term}%`,
          `nomre_1.ilike.%${term}%`,
          `muqavile_nomresi.ilike.%${term}%`,
        ]
        if (/^\d+$/.test(term)) {
          parts.push(`sira_no.eq.${Number(term)}`)
        }
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
  }, [search])

  useEffect(() => {
    if (!openId || loading) return
    const found = items.find((r) => r.id === openId)
    if (found) {
      setOpenRow(found)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from(MUSTERI_TABLE).select('*').eq('id', openId).maybeSingle()
      if (!cancelled && data) setOpenRow(data)
    })()
    return () => {
      cancelled = true
    }
  }, [openId, items, loading])

  function closeOpenRow() {
    setOpenRow(null)
    if (openId) {
      const next = new URLSearchParams(searchParams)
      next.delete('open')
      setSearchParams(next, { replace: true })
    }
  }

  const totals = useMemo(
    () => ({
      alis_qiymeti: sumField(viewRows, 'alis_qiymeti'),
      satis_qiymeti: sumField(viewRows, 'satis_qiymeti'),
      verilib: sumField(viewRows, 'verilib'),
      qalan_borc: sumField(viewRows, 'qalan_borc'),
      faiz: sumField(viewRows, 'faiz'),
    }),
    [viewRows]
  )

  const handleReorder = useCallback(
    async (orderedVisible) => {
      const next = applyKeyOrder(localCols, orderedVisible.map((c) => c.key))
      setLocalCols(next)
      try {
        await saveColumns(next)
      } catch (err) {
        setError(err.message)
      }
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

  if (error) {
    return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
          alignItems: 'flex-end',
          marginBottom: 'var(--space-md)',
        }}
      >
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 240px', maxWidth: 360 }}>
          <label>Axtarış (№, ad, model, IMEI, nömrə, müqavilə)</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="№ və ya mətn…" />
        </div>
        <Link to="/musteri-bazasi/sutunlar" className="btn btn--secondary">
          Sütunları idarə et
        </Link>
        <Link to="/musteri-bazasi/idxal" className="btn btn--secondary">
          Excel idxal
        </Link>
      </div>

      {!loading && !colsLoading && (
        <SummaryCards totals={totals} rowCount={viewRows.length} />
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
            onRowOpen={(row) => setOpenRow(row)}
            onDisplayRowsChange={setViewRows}
          />
        )}
      </div>

      {openRow && (
        <div
          className="telefon-modal-overlay musteri-record-overlay"
          onClick={closeOpenRow}
          role="presentation"
        >
          <div className="telefon-modal musteri-record-modal" onClick={(e) => e.stopPropagation()}>
            <MusteriRecordModule
              key={openRow.id}
              record={openRow}
              onClose={closeOpenRow}
              onEdit={(row) => {
                closeOpenRow()
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
