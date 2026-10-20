import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useColumnConfig } from './useColumnConfig'
import ResizableDataTable from './ResizableDataTable'
import SummaryCards from './SummaryCards'
import MusteriRecordModule from './MusteriRecordModule'
import { applyKeyOrder } from './columnOrder'
import { MUSTERI_TABLE, formatCell } from './constants'
import CollapsibleSummary from '../../components/CollapsibleSummary'
import { formatDate } from '../../lib/formatDate'
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

// Vəziyyət xanası: Bitib → qırmızı, Qalıb → yaşıl, Məhkəmə → sarı nişan
const VEZIYYET_BADGE = {
  Bitib: { background: '#c62828', color: '#fff' },
  Qalıb: { background: '#2e7d32', color: '#fff' },
  Məhkəmə: { background: '#fbc02d', color: '#000' },
}

function renderMusteriCell(row, col, raw) {
  if (col.key === 'veziyyet' && VEZIYYET_BADGE[raw]) {
    return (
      <span
        style={{
          ...VEZIYYET_BADGE[raw],
          display: 'inline-block',
          padding: '2px 10px',
          borderRadius: 4,
          fontWeight: 600,
          lineHeight: 1.4,
        }}
      >
        {raw}
      </span>
    )
  }
  return formatCell(raw, col)
}

// Cəmlər kartlarının sırası
const MUSTERI_SUMMARY_CARDS = [
  { key: 'alis_qiymeti', label: 'Alış qiyməti' },
  { key: 'satis_qiymeti', label: 'Satış qiyməti' },
  { key: 'verilib', label: 'Verilib' },
  { key: 'qalan_borc', label: 'Qalan borc (cəmi)' },
  { key: 'mehkeme_borc', label: 'Məhkəmə', toneKey: 'qalan_borc' },
  { key: 'qalan_yigim', label: 'Qalan Yığım', toneKey: 'qalan_borc' },
  { key: 'faiz', label: 'Faiz verilib', toneKey: 'verilib' },
  { key: 'menfeet', label: 'Mənfəət', toneKey: 'faktiki_gelir' },
]

// Axtarış / Filtr: dövr (verilmə tarixinə görə) və vəziyyət
const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
  'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
]

const PERIODS = [
  { value: 'month', label: 'Ay' },
  { value: 'week', label: 'Həftə' },
  { value: 'year', label: 'İl' },
  { value: 'custom', label: 'Özəl aralıq' },
  { value: 'all', label: 'Hamısı' },
]

const VEZIYYET_FILTERS = [
  { value: '', label: 'Hamısı' },
  { value: 'Qalıb', label: 'Qalıb' },
  { value: 'Bitib', label: 'Bitib' },
  { value: 'Məhkəmə', label: 'Məhkəmə' },
]

function toYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return addDays(d, -((d.getDay() + 6) % 7))
}

function periodRange(period, { year, month, weekStart, customFrom, customTo }) {
  if (period === 'all') return { from: null, to: null }
  if (period === 'week') return { from: toYmd(weekStart), to: toYmd(addDays(weekStart, 6)) }
  if (period === 'month') {
    return { from: toYmd(new Date(year, month, 1)), to: toYmd(new Date(year, month + 1, 0)) }
  }
  if (period === 'year') return { from: `${year}-01-01`, to: `${year}-12-31` }
  let from = customFrom || null
  let to = customTo || null
  if (from && to && from > to) [from, to] = [to, from]
  return { from, to }
}

function periodTitle(period, ctx) {
  if (period === 'week') {
    return `${formatDate(toYmd(ctx.weekStart))} – ${formatDate(toYmd(addDays(ctx.weekStart, 6)))}`
  }
  if (period === 'month') return `${MONTHS[ctx.month]} ${ctx.year}`
  if (period === 'year') return String(ctx.year)
  return ''
}

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
  const [period, setPeriod] = useState('all')
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [veziyyetFilter, setVeziyyetFilter] = useState('')
  const range = useMemo(
    () => periodRange(period, { year, month, weekStart, customFrom, customTo }),
    [period, year, month, weekStart, customFrom, customTo]
  )
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
      if (veziyyetFilter) q = q.eq('veziyyet', veziyyetFilter)
      if (range.from) q = q.gte('verilme_tarixi', range.from)
      if (range.to) q = q.lte('verilme_tarixi', range.to)
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
  }, [searchId, searchName, searchOther, veziyyetFilter, range.from, range.to])

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
      // Məhkəmə statusunda olan müştərilərin qalan borcu
      mehkeme_borc: sumField(
        viewRows.filter((r) => r.veziyyet === 'Məhkəmə'),
        'qalan_borc'
      ),
      // Qalan Yığım: Məhkəmə statusunda olan müştərilər daxil edilmir
      qalan_yigim: sumField(
        viewRows.filter((r) => r.veziyyet !== 'Məhkəmə'),
        'qalan_borc'
      ),
      faiz: sumField(viewRows, 'faiz'),
      // Mənfəət = Verilib + Faiz ödənişləri − Alış qiyməti
      menfeet:
        sumField(viewRows, 'verilib') + sumField(viewRows, 'faiz') - sumField(viewRows, 'alis_qiymeti'),
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

  function shiftPeriod(dir) {
    if (period === 'week') {
      setWeekStart((w) => addDays(w, dir * 7))
      return
    }
    if (period === 'month') {
      const d = new Date(year, month + dir, 1)
      setYear(d.getFullYear())
      setMonth(d.getMonth())
      return
    }
    if (period === 'year') setYear((y) => y + dir)
  }

  if (error) {
    return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>
  }

  return (
    <>
      <CollapsibleSummary title="Axtarış / Filtr" storageKey="summary:musteri-filter" defaultOpen>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-md)',
            alignItems: 'flex-end',
            marginBottom: 'var(--space-md)',
          }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Dövr (verilmə tarixi)</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`btn ${period === p.value ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={() => setPeriod(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {(period === 'month' || period === 'week' || period === 'year') && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Naviqasiya</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button type="button" className="btn btn--secondary" onClick={() => shiftPeriod(-1)}>
                  ‹
                </button>
                <span style={{ minWidth: 140, textAlign: 'center', fontWeight: 600 }}>
                  {periodTitle(period, { year, month, weekStart })}
                </span>
                <button type="button" className="btn btn--secondary" onClick={() => shiftPeriod(1)}>
                  ›
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => {
                    const n = new Date()
                    setYear(n.getFullYear())
                    setMonth(n.getMonth())
                    setWeekStart(startOfWeek(n))
                  }}
                >
                  Bu gün
                </button>
              </div>
            </div>
          )}
          {period === 'custom' && (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Başlanğıc</label>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Son</label>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </>
          )}
          <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
            <label>Vəziyyət</label>
            <select value={veziyyetFilter} onChange={(e) => setVeziyyetFilter(e.target.value)}>
              {VEZIYYET_FILTERS.map((v) => (
                <option key={v.value || 'all'} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-md)',
            alignItems: 'flex-end',
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
      </CollapsibleSummary>

      {!loading && !colsLoading && (
        <SummaryCards
          totals={totals}
          rowCount={viewRows.length}
          storageKey="summary:musteri"
          cards={MUSTERI_SUMMARY_CARDS}
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
            renderCell={renderMusteriCell}
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
