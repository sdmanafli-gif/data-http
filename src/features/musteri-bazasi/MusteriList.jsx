import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useColumnConfig } from './useColumnConfig'
import ResizableDataTable from './ResizableDataTable'
import SummaryCards from './SummaryCards'
import MusteriRecordModule from './MusteriRecordModule'
import { applyKeyOrder } from './columnOrder'
import { MUSTERI_TABLE } from './constants'
import '../../styles/shared.css'
import './musteri-schedule.css'

// "IMEI, iCloud, nömrə və s." axtarışının baxdığı sütunlar (hamısı text tiplidir)
const OTHER_SEARCH_COLUMNS = [
  'imei_1',
  'imei_2',
  'icloud',
  'icloud_bagli_nomre',
  'itunes',
  'itunes_bagli_nomre',
  'nomre_1',
  'nomre_2',
  'nomre_3',
  'nomre_4',
  'nomre_5',
  'muqavile_nomresi',
  'model',
  'reng',
  'yaddas',
  'serial_no',
  'model_no',
  'kimden_alinib',
  'zamin',
  'satici',
  'kommentler',
]

function sumField(rows, key) {
  return rows.reduce((acc, row) => {
    const n = Number(row[key])
    return acc + (Number.isNaN(n) ? 0 : n)
  }, 0)
}

export default function MusteriList() {
  const navigate = useNavigate()
  const { access } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const openId = searchParams.get('open')
  const { columns, loading: colsLoading, saveColumns } = useColumnConfig()
  const [items, setItems] = useState([])
  const [viewRows, setViewRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchId, setSearchId] = useState('')
  const [searchName, setSearchName] = useState('')
  const [searchOther, setSearchOther] = useState('')
  const [localCols, setLocalCols] = useState([])
  const [openRow, setOpenRow] = useState(null)
  const resizeTimer = useRef(null)

  useEffect(() => {
    setLocalCols(columns)
  }, [columns])

  const visibleCols = useMemo(
    () => access.filterColumns('musteri-bazasi', localCols).filter((c) => c.visible !== false),
    [localCols, access]
  )

  async function load() {
    setLoading(true)
    setError(null)
    // PostgREST filter dəyərlərini pozan simvolları təmizləyir
    const clean = (v) =>
      v.trim().replace(/[,()"\\]/g, ' ').replace(/%/g, '\\%').replace(/_/g, '\\_').trim()
    const idTerm = searchId.trim()
    const nameTerm = clean(searchName)
    const otherTerm = clean(searchOther)
    const { data, error: e } = await fetchAllPages(() => {
      let q = supabase.from(MUSTERI_TABLE).select('*').order('sira_no', { ascending: true })
      q = access.applyDataFilters(q, 'musteri-bazasi')
      if (/^\d{1,9}$/.test(idTerm)) {
        q = q.eq('sira_no', Number(idTerm))
      }
      if (nameTerm) {
        q = q.ilike('ad_soyad', `%${nameTerm}%`)
      }
      if (otherTerm) {
        q = q.or(OTHER_SEARCH_COLUMNS.map((c) => `${c}.ilike.%${otherTerm}%`).join(','))
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
  }, [searchId, searchName, searchOther])

  useEffect(() => {
    if (!openId || loading) return
    const found = items.find((r) => r.id === openId)
    if (found) {
      if (access.rowInDataScope(found, 'musteri-bazasi')) setOpenRow(found)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from(MUSTERI_TABLE).select('*').eq('id', openId).maybeSingle()
      if (!cancelled && data && access.rowInDataScope(data, 'musteri-bazasi')) setOpenRow(data)
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
        <div className="form-group" style={{ marginBottom: 0, flex: '0 1 140px' }}>
          <label>Müştəri №</label>
          <input
            value={searchId}
            onChange={(e) => setSearchId(e.target.value.replace(/\D/g, '').slice(0, 9))}
            inputMode="numeric"
            placeholder="məs. 123"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px', maxWidth: 280 }}>
          <label>Ad Soyad</label>
          <input value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Ad və ya soyad…" />
        </div>
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 240px', maxWidth: 360 }}>
          <label>IMEI, iCloud, nömrə və s.</label>
          <input
            value={searchOther}
            onChange={(e) => setSearchOther(e.target.value)}
            placeholder="IMEI, iCloud, telefon, model…"
          />
        </div>
        <Link to="/musteri-bazasi/sutunlar" className="btn btn--secondary">
          Sütunları idarə et
        </Link>
      </div>

      {!loading && !colsLoading && (
        <SummaryCards
          totals={totals}
          rowCount={viewRows.length}
          storageKey="summary:musteri"
          allowedKeys={access.allowedSummaryCards('musteri-bazasi')}
        />
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
            prefsKey="musteri_bazasi"
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
