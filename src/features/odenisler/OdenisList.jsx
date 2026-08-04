import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import {
  ODENISLER_TABLE,
  PAYMENT_TYPES,
  tipLabel,
  formatMoney,
  formatDate,
  sumPaymentsByType,
} from './constants'
import ResizableDataTable from '../musteri-bazasi/ResizableDataTable'
import CollapsibleSummary from '../../components/CollapsibleSummary'
import '../musteri-bazasi/musteri-table.css'
import '../../styles/shared.css'

const ODENIS_COLUMNS = [
  { key: 'tarix', label: 'Tarix', type: 'date', visible: true, width: 120 },
  { key: 'sira_no', label: '#', type: 'number', visible: true, width: 70 },
  { key: 'ad_soyad', label: 'Ad Soyad Ata adı', type: 'text', visible: true, width: 200 },
  { key: 'tip_label', label: 'Tip', type: 'text', visible: true, width: 130 },
  { key: 'mebleg', label: 'Məbləğ', type: 'money', visible: true, width: 120 },
  { key: 'qeyd', label: 'Qeyd', type: 'text', visible: true, width: 180 },
]

function formatOdenisCell(value, col) {
  if (col?.type === 'money') return formatMoney(value)
  if (col?.type === 'date' || col?.key === 'tarix') return formatDate(value)
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

export default function OdenisList() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [tipFilter, setTipFilter] = useState('')
  const [viewRows, setViewRows] = useState([])

  async function load() {
    setLoading(true)
    setError(null)
    const term = search.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')
    const { data, error: e } = await fetchAllPages(() => {
      let q = supabase.from(ODENISLER_TABLE).select('*').order('tarix', { ascending: false })
      if (tipFilter) q = q.eq('tip', tipFilter)
      if (term) {
        const asNum = Number(term)
        if (!Number.isNaN(asNum) && /^\d+$/.test(term)) {
          q = q.or(`ad_soyad.ilike.%${term}%,sira_no.eq.${asNum}`)
        } else {
          q = q.ilike('ad_soyad', `%${term}%`)
        }
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
  }, [search, tipFilter])

  const rows = useMemo(
    () =>
      (items || []).map((r) => ({
        ...r,
        tip_label: tipLabel(r.tip),
      })),
    [items]
  )

  const totals = useMemo(() => sumPaymentsByType(viewRows.length ? viewRows : rows), [viewRows, rows])

  if (error) {
    return (
      <p className="empty-state" style={{ color: 'var(--color-accent)' }}>
        {error}
      </p>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginBottom: 16 }}>
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 220px', maxWidth: 320 }}>
          <label>Axtarış</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="№ və ya Ad Soyad…"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
          <label>Tip</label>
          <select value={tipFilter} onChange={(e) => setTipFilter(e.target.value)}>
            <option value="">Hamısı</option>
            {PAYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!loading && (
        <CollapsibleSummary title="Cəmlər" storageKey="summary:odenisler">
          <div className="musteri-summary">
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">İlkin</div>
              <div className="musteri-summary__value">{formatMoney(totals.ilkin)}</div>
            </div>
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Aylıq</div>
              <div className="musteri-summary__value">{formatMoney(totals.ayliq)}</div>
            </div>
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Faiz</div>
              <div className="musteri-summary__value">{formatMoney(totals.faiz)}</div>
            </div>
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Cəmi</div>
              <div className="musteri-summary__value">{formatMoney(totals.cemi)}</div>
            </div>
            <div className="musteri-summary__card musteri-summary__card--meta">
              <div className="musteri-summary__label">Sətir sayı</div>
              <div className="musteri-summary__value">{viewRows.length || rows.length}</div>
            </div>
          </div>
        </CollapsibleSummary>
      )}

      <div className="card">
        {loading ? (
          <p className="empty-state">Yüklənir…</p>
        ) : (
          <ResizableDataTable
            columns={ODENIS_COLUMNS}
            rows={rows}
            formatCell={formatOdenisCell}
            onRowOpen={(row) => navigate(`/odenisler/${row.id}`)}
            onDisplayRowsChange={setViewRows}
            emptyText="Ödəniş yoxdur."
            prefsKey="odenisler"
          />
        )}
      </div>
    </>
  )
}
