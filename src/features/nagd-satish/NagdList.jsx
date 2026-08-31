import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useColumnConfig } from './useColumnConfig'
import ResizableDataTable from '../musteri-bazasi/ResizableDataTable'
import { applyKeyOrder } from '../musteri-bazasi/columnOrder'
import { NAGD_TABLE, formatCell, getRowValue, formatMoney, SATIS_NOVU_OPTIONS } from './constants'
import CollapsibleSummary from '../../components/CollapsibleSummary'
import '../../styles/shared.css'

function sumField(rows, key) {
  return rows.reduce((acc, row) => {
    const n = Number(row[key])
    return acc + (Number.isNaN(n) ? 0 : n)
  }, 0)
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartYmd() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/** Aggregate nağd satış by buyer (kime) within the current filtered rows. */
function summarizeByBuyer(rows) {
  const map = new Map()
  for (const row of rows || []) {
    const name = String(row.kime || '').trim() || 'Adsız'
    const cur = map.get(name) || { kime: name, count: 0, alis: 0, satis: 0, xeyir: 0 }
    cur.count += 1
    cur.alis += Number(row.alis_qiymeti) || 0
    cur.satis += Number(row.satis_qiymeti) || 0
    cur.xeyir += Number(row.xeyir) || 0
    map.set(name, cur)
  }
  return [...map.values()].sort((a, b) => b.satis - a.satis || a.kime.localeCompare(b.kime, 'az'))
}

export default function NagdList() {
  const navigate = useNavigate()
  const { access } = useAuth()
  const { columns, loading: colsLoading, saveColumns } = useColumnConfig()
  const [items, setItems] = useState([])
  const [viewRows, setViewRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [buyerFilter, setBuyerFilter] = useState('')
  const [novuFilter, setNovuFilter] = useState('') // '' | nagd | nisye
  const [buyerOptions, setBuyerOptions] = useState([])
  const [localCols, setLocalCols] = useState([])
  const resizeTimer = useRef(null)

  useEffect(() => setLocalCols(columns), [columns])
  const visibleCols = useMemo(
    () => access.filterColumns('nagd-satish', localCols).filter((c) => c.visible !== false),
    [localCols, access]
  )

  async function loadBuyers(from, to) {
    let q = supabase.from(NAGD_TABLE).select('kime')
    if (from) q = q.gte('tarix', from)
    if (to) q = q.lte('tarix', to)
    const { data } = await fetchAllPages(() => q)
    const names = new Set()
    for (const row of data || []) {
      const n = String(row.kime || '').trim()
      if (n) names.add(n)
    }
    setBuyerOptions([...names].sort((a, b) => a.localeCompare(b, 'az')))
  }

  async function load() {
    setLoading(true)
    setError(null)
    const term = search.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')
    let from = dateFrom || null
    let to = dateTo || null
    if (from && to && from > to) {
      const t = from
      from = to
      to = t
    }
    void loadBuyers(from, to)
    const { data, error: e } = await fetchAllPages(() => {
      let q = supabase.from(NAGD_TABLE).select('*').order('tarix', { ascending: false }).order('sira_no', { ascending: true })
      if (from) q = q.gte('tarix', from)
      if (to) q = q.lte('tarix', to)
      if (buyerFilter) q = q.eq('kime', buyerFilter)
      if (novuFilter === 'nagd' || novuFilter === 'nisye') q = q.eq('satis_novu', novuFilter)
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
  }, [search, dateFrom, dateTo, buyerFilter, novuFilter])

  const totals = useMemo(
    () => ({
      alis: sumField(viewRows, 'alis_qiymeti'),
      satis: sumField(viewRows, 'satis_qiymeti'),
      xeyir: sumField(viewRows, 'xeyir'),
      xeyirFaizle: sumField(viewRows, 'xeyir_faizle'),
    }),
    [viewRows]
  )

  const byBuyer = useMemo(() => summarizeByBuyer(viewRows), [viewRows])

  const rangeLabel = useMemo(() => {
    if (!dateFrom && !dateTo) return 'Bütün tarixlər'
    if (dateFrom && dateTo) return `${dateFrom} – ${dateTo}`
    if (dateFrom) return `${dateFrom} – …`
    return `… – ${dateTo}`
  }, [dateFrom, dateTo])

  function setPreset(preset) {
    const today = todayYmd()
    if (preset === 'today') {
      setDateFrom(today)
      setDateTo(today)
    } else if (preset === 'month') {
      setDateFrom(monthStartYmd())
      setDateTo(today)
    } else {
      setDateFrom('')
      setDateTo('')
    }
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
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 220px', maxWidth: 320 }}>
          <label>Axtarış</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kimə, model, IMEI, satıcı…" />
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
          <label>Tarixdən</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
          <label>Tarixədək</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
          <label>Kimə</label>
          <select value={buyerFilter} onChange={(e) => setBuyerFilter(e.target.value)}>
            <option value="">Hamısı</option>
            {buyerOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
          <label>Satış növü</label>
          <select value={novuFilter} onChange={(e) => setNovuFilter(e.target.value)}>
            <option value="">Hamısı</option>
            {SATIS_NOVU_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setPreset('today')}>
            Bu gün
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setPreset('month')}>
            Bu ay
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setPreset('all')}>
            Hamısı
          </button>
          <Link to="/nagd-satish/sutunlar" className="btn btn--secondary">
            Sütunları idarə et
          </Link>
        </div>
      </div>

      {!loading && !colsLoading && access.canSeeSummary('nagd-satish') && (() => {
        const keys = access.allowedSummaryCards('nagd-satish')
        const show = (k) => keys == null || keys.includes(k)
        return (
        <>
        <CollapsibleSummary title={`Cəmlər · ${rangeLabel}`} storageKey="summary:nagd">
          <div className="musteri-summary">
            {show('alis') && (
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Ümumi alış</div>
              <div className="musteri-summary__value">{formatMoney(totals.alis)}</div>
            </div>
            )}
            {show('satis') && (
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Ümumi satış</div>
              <div className="musteri-summary__value">{formatMoney(totals.satis)}</div>
            </div>
            )}
            {show('xeyir') && (
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Ümumi xeyir</div>
              <div className="musteri-summary__value">{formatMoney(totals.xeyir)}</div>
            </div>
            )}
            {show('xeyirFaizle') && (
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Xeyir (faizlə)</div>
              <div className="musteri-summary__value">{formatMoney(totals.xeyirFaizle)}</div>
            </div>
            )}
            {show('row_count') && (
            <div className="musteri-summary__card musteri-summary__card--meta">
              <div className="musteri-summary__label">Sətir sayı</div>
              <div className="musteri-summary__value">{viewRows.length}</div>
            </div>
            )}
          </div>
        </CollapsibleSummary>

        <CollapsibleSummary title="Kimə görə nağd satış" storageKey="summary:nagd-by-buyer" defaultOpen={false}>
          {byBuyer.length === 0 ? (
            <p className="empty-state" style={{ margin: 0 }}>Bu aralıqda satış yoxdur.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kimə</th>
                    <th style={{ textAlign: 'right' }}>Sətir</th>
                    <th style={{ textAlign: 'right' }}>Alış</th>
                    <th style={{ textAlign: 'right' }}>Satış</th>
                    <th style={{ textAlign: 'right' }}>Xeyir</th>
                  </tr>
                </thead>
                <tbody>
                  {byBuyer.map((row) => (
                    <tr
                      key={row.kime}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setBuyerFilter(row.kime)}
                      title="Bu alıcını filtrə götür"
                    >
                      <td>{row.kime}</td>
                      <td style={{ textAlign: 'right' }}>{row.count}</td>
                      <td style={{ textAlign: 'right' }}>{formatMoney(row.alis)}</td>
                      <td style={{ textAlign: 'right' }}>{formatMoney(row.satis)}</td>
                      <td style={{ textAlign: 'right' }}>{formatMoney(row.xeyir)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>Cəmi</strong></td>
                    <td style={{ textAlign: 'right' }}><strong>{viewRows.length}</strong></td>
                    <td style={{ textAlign: 'right' }}><strong>{formatMoney(totals.alis)}</strong></td>
                    <td style={{ textAlign: 'right' }}><strong>{formatMoney(totals.satis)}</strong></td>
                    <td style={{ textAlign: 'right' }}><strong>{formatMoney(totals.xeyir)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CollapsibleSummary>
        </>
        )
      })()}

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
            prefsKey="nagd_satish"
            emptyText="Bu filtrə uyğun nağd satış yoxdur."
          />
        )}
      </div>
    </>
  )
}
