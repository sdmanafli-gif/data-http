import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { loadUiFlag, saveUiFlag } from '../../lib/uiPrefs'
import {
  SEXSI_KREDIT_TABLE,
  SEXSI_KREDIT_ODENIS_TABLE,
  formatMoney,
  formatDate,
} from './sexsiKreditConstants'
import { summarizeKredit } from './sexsiKreditSchedule'
import CollapsibleSummary from '../../components/CollapsibleSummary'
import ResizableDataTable from '../musteri-bazasi/ResizableDataTable'
import '../../styles/shared.css'
import '../musteri-bazasi/musteri-table.css'

const SEXSI_KREDIT_COLUMNS = [
  { key: 'ad', label: 'Ad', type: 'text', visible: true, width: 160 },
  { key: 'kimden', label: 'Haradan', type: 'text', visible: true, width: 140 },
  { key: 'verilme_tarixi', label: 'Tarix', type: 'date', visible: true, width: 120 },
  { key: 'cemi_mebleg', label: 'Cəmi', type: 'money', visible: true, width: 120 },
  { key: 'nece_ay', label: 'Ay', type: 'number', visible: true, width: 80 },
  { key: 'paid', label: 'Ödənilib', type: 'money', visible: true, width: 120 },
  { key: 'remaining', label: 'Qalan', type: 'money', visible: true, width: 120 },
]

function formatSexsiCell(value, col) {
  if (col?.type === 'money') return formatMoney(value)
  if (col?.type === 'date' || col?.key === 'verilme_tarixi') return formatDate(value)
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

/**
 * Collapsible «Şəxsi kreditlər» frame on Borc/Nisyə overview.
 */
export default function SexsiKreditPanel() {
  const navigate = useNavigate()
  const { access } = useAuth()
  const [open, setOpen] = useState(() => loadUiFlag('borc-nisye:sexsi-kredit-open', true))
  const [kreditler, setKreditler] = useState([])

  const visibleCols = useMemo(
    () =>
      access
        .filterColumns('borc-nisye', SEXSI_KREDIT_COLUMNS)
        .filter((c) => c.visible !== false),
    [access]
  )
  const [paymentsByKredit, setPaymentsByKredit] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewRows, setViewRows] = useState([])

  useEffect(() => {
    saveUiFlag('borc-nisye:sexsi-kredit-open', open)
  }, [open])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [{ data: kredits, error: kErr }, { data: pays, error: pErr }] = await Promise.all([
          fetchAllPages(() =>
            supabase
              .from(SEXSI_KREDIT_TABLE)
              .select('*')
              .order('verilme_tarixi', { ascending: false })
          ),
          fetchAllPages(() =>
            supabase.from(SEXSI_KREDIT_ODENIS_TABLE).select('id, kredit_id, mebleg, tarix')
          ),
        ])
        if (cancelled) return
        if (kErr) throw kErr
        if (pErr) throw pErr
        const map = new Map()
        for (const p of pays || []) {
          if (!map.has(p.kredit_id)) map.set(p.kredit_id, [])
          map.get(p.kredit_id).push(p)
        }
        setKreditler(kredits || [])
        setPaymentsByKredit(map)
      } catch (e) {
        if (!cancelled) {
          setError(e.message)
          setKreditler([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(() => {
    return (kreditler || []).map((k) => {
      const { totals } = summarizeKredit(k, paymentsByKredit.get(k.id) || [])
      return {
        ...k,
        paid: totals.paid,
        remaining: totals.remaining,
      }
    })
  }, [kreditler, paymentsByKredit])

  const sums = useMemo(() => {
    let cemi = 0
    let paid = 0
    let remaining = 0
    for (const r of viewRows) {
      cemi += Number(r.cemi_mebleg) || 0
      paid += Number(r.paid) || 0
      remaining += Number(r.remaining) || 0
    }
    return { cemi, paid, remaining, count: viewRows.length }
  }, [viewRows])

  return (
    <section
      className={`borc-nisye-panel sexsi-kredit-panel${open ? '' : ' borc-nisye-panel--collapsed'}`}
      style={{ marginTop: 16, flex: '1 1 100%', maxWidth: '100%' }}
    >
      <div className="borc-nisye-panel__head">
        <h2 className="card__title">Şəxsi kreditlər</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {open && (
            <button
              type="button"
              className="btn btn--primary"
              style={{ padding: '6px 12px', fontSize: 13 }}
              onClick={() => navigate('/borc-nisye/sexsi-kredit/yeni')}
            >
              Kredit yarat
            </button>
          )}
          <button
            type="button"
            className="borc-nisye-panel__toggle"
            onClick={() => setOpen((v) => !v)}
            title={open ? 'Bağla' : 'Aç'}
            aria-expanded={open}
          >
            {open ? '«' : '»'}
          </button>
        </div>
      </div>

      {open && (
        <div className="borc-nisye-panel__body">
          {error && (
            <p style={{ color: 'var(--color-accent)', fontSize: 13 }}>
              {error.includes('sexsi_kredit') || error.includes('schema cache')
                ? 'Cədvəl hələ yaradılmayıb — Supabase-də setup/tables/23_sexsi_kreditler.sql işlədin.'
                : error}
            </p>
          )}

          {!loading && (
            <CollapsibleSummary title="Kredit cəmləri" storageKey="summary:sexsi-kredit" defaultOpen>
              <div className="musteri-summary">
                <div className="musteri-summary__card musteri-summary__card--meta">
                  <div className="musteri-summary__label">Kredit sayı</div>
                  <div className="musteri-summary__value">{sums.count}</div>
                </div>
                <div className="musteri-summary__card">
                  <div className="musteri-summary__label">Ümumi götürülən</div>
                  <div className="musteri-summary__value">{formatMoney(sums.cemi)}</div>
                </div>
                <div className="musteri-summary__card">
                  <div className="musteri-summary__label">Ödənilib</div>
                  <div className="musteri-summary__value">{formatMoney(sums.paid)}</div>
                </div>
                <div className="musteri-summary__card">
                  <div className="musteri-summary__label">Qalan</div>
                  <div className="musteri-summary__value">{formatMoney(sums.remaining)}</div>
                </div>
              </div>
            </CollapsibleSummary>
          )}

          <div className="card">
            {loading ? (
              <p className="empty-state">Yüklənir…</p>
            ) : (
              <ResizableDataTable
                columns={visibleCols}
                rows={rows}
                formatCell={formatSexsiCell}
                onRowOpen={(row) => navigate(`/borc-nisye/sexsi-kredit/${row.id}`)}
                onDisplayRowsChange={setViewRows}
                emptyText="Hələ şəxsi kredit yoxdur."
                prefsKey="sexsi_kredit_overview"
              />
            )}
          </div>
        </div>
      )}
    </section>
  )
}
