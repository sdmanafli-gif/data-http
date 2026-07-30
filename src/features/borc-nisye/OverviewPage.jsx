import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import ResizableDataTable from '../musteri-bazasi/ResizableDataTable'
import CollapsibleSummary from '../../components/CollapsibleSummary'
import { loadUiFlag, saveUiFlag } from '../../lib/uiPrefs'
import {
  LEDGER_TABLE,
  computeBalances,
  formatMoney,
  formatCell,
  counterpartPath,
  OVERVIEW_BORC_COLUMNS,
  OVERVIEW_NISYE_COLUMNS,
} from './constants'
import '../musteri-bazasi/musteri-table.css'
import '../../styles/shared.css'

function getBalanceValue(row, col) {
  return row?.[col.key]
}

function sumBalances(rows, keys) {
  const acc = Object.fromEntries(keys.map((k) => [k, 0]))
  for (const r of rows || []) {
    for (const k of keys) acc[k] += Number(r[k]) || 0
  }
  return acc
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(true)
  const [borcView, setBorcView] = useState([])
  const [nisyeView, setNisyeView] = useState([])
  const [borcOpen, setBorcOpen] = useState(() => loadUiFlag('borc-nisye:borc-open', true))
  const [nisyeOpen, setNisyeOpen] = useState(() => loadUiFlag('borc-nisye:nisye-open', true))

  useEffect(() => {
    saveUiFlag('borc-nisye:borc-open', borcOpen)
  }, [borcOpen])

  useEffect(() => {
    saveUiFlag('borc-nisye:nisye-open', nisyeOpen)
  }, [nisyeOpen])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error: e } = await fetchAllPages(() =>
        supabase.from(LEDGER_TABLE).select('kime, tip, mebleg')
      )
      if (cancelled) return
      if (e) {
        setError(e.message)
        setRows([])
      } else setRows(data || [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const balances = useMemo(() => computeBalances(rows), [rows])

  const matched = useMemo(() => {
    const q = search.trim().toLowerCase()
    return balances.filter((b) => {
      if (!q) return true
      return b.kime.toLowerCase().includes(q)
    })
  }, [balances, search])

  const borcRows = useMemo(() => {
    return matched
      .filter((b) => {
        if (onlyOpen) return b.qaliq_borc !== 0 || b.borc_verdim !== 0 || b.borc_aldim !== 0
        return b.borc_verdim !== 0 || b.borc_aldim !== 0 || b.qaliq_borc !== 0
      })
      .map((b) => ({
        id: `borc:${b.kime}`,
        kime: b.kime,
        borc_verdim: b.borc_verdim,
        borc_aldim: b.borc_aldim,
        qaliq_borc: b.qaliq_borc,
      }))
  }, [matched, onlyOpen])

  const nisyeRows = useMemo(() => {
    return matched
      .filter((b) => {
        if (onlyOpen) {
          return (
            b.qaliq_nisye !== 0 ||
            b.nisye_verdim !== 0 ||
            b.nisye_aldim !== 0 ||
            b.nisye_odenis !== 0
          )
        }
        return (
          b.nisye_verdim !== 0 ||
          b.nisye_aldim !== 0 ||
          b.nisye_odenis !== 0 ||
          b.qaliq_nisye !== 0
        )
      })
      .map((b) => ({
        id: `nisye:${b.kime}`,
        kime: b.kime,
        nisye_verdim: b.nisye_verdim,
        nisye_aldim: b.nisye_aldim,
        nisye_odenis: b.nisye_odenis,
        qaliq_nisye: b.qaliq_nisye,
      }))
  }, [matched, onlyOpen])

  const borcTotals = useMemo(
    () => sumBalances(borcView, ['borc_verdim', 'borc_aldim', 'qaliq_borc']),
    [borcView]
  )
  const nisyeTotals = useMemo(
    () => sumBalances(nisyeView, ['nisye_verdim', 'nisye_aldim', 'nisye_odenis', 'qaliq_nisye']),
    [nisyeView]
  )

  function openCounterpart(row) {
    if (row?.kime) navigate(counterpartPath(row.kime))
  }

  function toggleBorc() {
    setBorcOpen((open) => !open)
  }

  function toggleNisye() {
    setNisyeOpen((open) => !open)
  }

  if (error) {
    return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>
  }

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginBottom: 16 }}>
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 220px', maxWidth: 360 }}>
          <label>Axtarış</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kontragent…" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 4 }}>
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          Yalnız açıq qalıqlar
        </label>
      </div>

      <div className="borc-nisye-split">
        <section className={`borc-nisye-panel${borcOpen ? '' : ' borc-nisye-panel--collapsed'}`}>
          <div className="borc-nisye-panel__head">
            <h2 className="card__title">Borc</h2>
            <button
              type="button"
              className="borc-nisye-panel__toggle"
              onClick={toggleBorc}
              title={borcOpen ? 'Borc bölməsini bağla' : 'Borc bölməsini aç'}
              aria-expanded={borcOpen}
            >
              {borcOpen ? '«' : '»'}
            </button>
          </div>
          {borcOpen && (
            <div className="borc-nisye-panel__body">
              {!loading && (
                <CollapsibleSummary title="Borc cəmləri" storageKey="summary:borc-panel">
                  <div className="musteri-summary">
                    <div className="musteri-summary__card musteri-summary__card--meta">
                      <div className="musteri-summary__label">Müştəri</div>
                      <div className="musteri-summary__value">{borcView.length}</div>
                    </div>
                    <div className="musteri-summary__card">
                      <div className="musteri-summary__label">Borc Verdim (cəmi)</div>
                      <div className="musteri-summary__value">{formatMoney(borcTotals.borc_verdim)}</div>
                    </div>
                    <div className="musteri-summary__card">
                      <div className="musteri-summary__label">Borc Aldım (cəmi)</div>
                      <div className="musteri-summary__value">{formatMoney(borcTotals.borc_aldim)}</div>
                    </div>
                    <div className="musteri-summary__card">
                      <div className="musteri-summary__label">Qalıq (Borc)</div>
                      <div className="musteri-summary__value">{formatMoney(borcTotals.qaliq_borc)}</div>
                    </div>
                  </div>
                </CollapsibleSummary>
              )}
              <div className="card">
                {loading ? (
                  <p className="empty-state">Yüklənir…</p>
                ) : (
                  <ResizableDataTable
                    columns={OVERVIEW_BORC_COLUMNS}
                    rows={borcRows}
                    formatCell={formatCell}
                    getRowValue={getBalanceValue}
                    onRowOpen={openCounterpart}
                    onDisplayRowsChange={setBorcView}
                    emptyText="Borc qeydi yoxdur."
                    prefsKey="borc_overview"
                  />
                )}
              </div>
            </div>
          )}
        </section>

        <section className={`borc-nisye-panel${nisyeOpen ? '' : ' borc-nisye-panel--collapsed'}`}>
          <div className="borc-nisye-panel__head">
            <h2 className="card__title">Nisyə</h2>
            <button
              type="button"
              className="borc-nisye-panel__toggle"
              onClick={toggleNisye}
              title={nisyeOpen ? 'Nisyə bölməsini bağla' : 'Nisyə bölməsini aç'}
              aria-expanded={nisyeOpen}
            >
              {nisyeOpen ? '»' : '«'}
            </button>
          </div>
          {nisyeOpen && (
            <div className="borc-nisye-panel__body">
              {!loading && (
                <CollapsibleSummary title="Nisyə cəmləri" storageKey="summary:nisye-panel">
                  <div className="musteri-summary">
                    <div className="musteri-summary__card musteri-summary__card--meta">
                      <div className="musteri-summary__label">Müştəri</div>
                      <div className="musteri-summary__value">{nisyeView.length}</div>
                    </div>
                    <div className="musteri-summary__card">
                      <div className="musteri-summary__label">Nisyə Verdim (cəmi)</div>
                      <div className="musteri-summary__value">{formatMoney(nisyeTotals.nisye_verdim)}</div>
                    </div>
                    <div className="musteri-summary__card">
                      <div className="musteri-summary__label">Nisyə Aldım (cəmi)</div>
                      <div className="musteri-summary__value">{formatMoney(nisyeTotals.nisye_aldim)}</div>
                    </div>
                    <div className="musteri-summary__card">
                      <div className="musteri-summary__label">Nisyə Ödəniş (cəmi)</div>
                      <div className="musteri-summary__value">{formatMoney(nisyeTotals.nisye_odenis)}</div>
                    </div>
                    <div className="musteri-summary__card">
                      <div className="musteri-summary__label">Qalıq (Nisyə)</div>
                      <div className="musteri-summary__value">{formatMoney(nisyeTotals.qaliq_nisye)}</div>
                    </div>
                  </div>
                </CollapsibleSummary>
              )}
              <div className="card">
                {loading ? (
                  <p className="empty-state">Yüklənir…</p>
                ) : (
                  <ResizableDataTable
                    columns={OVERVIEW_NISYE_COLUMNS}
                    rows={nisyeRows}
                    formatCell={formatCell}
                    getRowValue={getBalanceValue}
                    onRowOpen={openCounterpart}
                    onDisplayRowsChange={setNisyeView}
                    emptyText="Nisyə qeydi yoxdur."
                    prefsKey="nisye_overview"
                  />
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
