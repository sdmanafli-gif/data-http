import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import {
  ODENISLER_TABLE,
  PAYMENT_TYPES,
  tipLabel,
  formatMoney,
  formatDate,
  sumPaymentsByType,
} from './constants'
import CollapsibleSummary from '../../components/CollapsibleSummary'
import '../musteri-bazasi/musteri-table.css'
import '../../styles/shared.css'

export default function OdenisList() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [tipFilter, setTipFilter] = useState('')

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

  const totals = useMemo(() => sumPaymentsByType(items), [items])

  if (error) {
    return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>
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
              <option key={t.value} value={t.value}>{t.label}</option>
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
              <div className="musteri-summary__value">{items.length}</div>
            </div>
          </div>
        </CollapsibleSummary>
      )}

      <div className="card">
        {loading ? (
          <p className="empty-state">Yüklənir…</p>
        ) : items.length === 0 ? (
          <p className="empty-state">Ödəniş yoxdur.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarix</th>
                  <th>#</th>
                  <th>Ad Soyad Ata adı</th>
                  <th>Tip</th>
                  <th>Məbləğ</th>
                  <th>Qeyd</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/odenisler/${row.id}`)}
                  >
                    <td>{formatDate(row.tarix)}</td>
                    <td>{row.sira_no ?? '—'}</td>
                    <td>{row.ad_soyad || '—'}</td>
                    <td>{tipLabel(row.tip)}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(row.mebleg)}</td>
                    <td>{row.qeyd || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
