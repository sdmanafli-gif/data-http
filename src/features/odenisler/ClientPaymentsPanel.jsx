import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { confirmDelete } from '../../lib/confirmDelete'
import {
  ODENISLER_TABLE,
  tipLabel,
  formatMoney,
  formatDate,
  sumPaymentsByType,
  syncMusteriPaymentTotals,
} from './constants'

/**
 * Payments recorded for one müştəri (shown inside client module / return flow).
 */
export default function ClientPaymentsPanel({ musteriId, manageable = false, onChanged }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    if (!musteriId) return
    setLoading(true)
    const { data, error: e } = await supabase
      .from(ODENISLER_TABLE)
      .select('*')
      .eq('musteri_bazasi_id', musteriId)
      .order('tarix', { ascending: false })
    if (e) {
      setError(e.message)
      setRows([])
    } else {
      setRows(data || [])
      setError(null)
    }
    setLoading(false)
  }, [musteriId])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => sumPaymentsByType(rows), [rows])

  async function handleDelete(row) {
    if (!confirmDelete(`${formatDate(row.tarix)} · ${tipLabel(row.tip)} · ${formatMoney(row.mebleg)}\n\nBu ödəniş silinsin?`)) {
      return
    }
    setBusyId(row.id)
    setError(null)
    try {
      const { error: err } = await supabase.from(ODENISLER_TABLE).delete().eq('id', row.id)
      if (err) throw err
      const { error: syncErr } = await syncMusteriPaymentTotals(supabase, musteriId)
      if (syncErr) throw syncErr
      await load()
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="musteri-schedule" style={{ marginTop: manageable ? 0 : 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        {!manageable && <h3 className="card__title" style={{ margin: 0 }}>Ödənişlər</h3>}
        {manageable && <div />}
        <Link
          to={`/odenisler/yeni?musteri=${musteriId}`}
          className="btn btn--primary"
          style={{ whiteSpace: 'nowrap' }}
        >
          Ödəniş et
        </Link>
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      {loading ? (
        <p className="empty-state">Yüklənir…</p>
      ) : rows.length === 0 ? (
        <p className="empty-state">Hələ ödəniş yoxdur.</p>
      ) : (
        <>
          <div className="musteri-schedule__summary" style={{ marginTop: 12 }}>
            <div className="musteri-schedule__stat">
              <span className="musteri-schedule__stat-label">İlkin</span>
              <span className="musteri-schedule__stat-value">{formatMoney(totals.ilkin)}</span>
            </div>
            <div className="musteri-schedule__stat">
              <span className="musteri-schedule__stat-label">Aylıq</span>
              <span className="musteri-schedule__stat-value">{formatMoney(totals.ayliq)}</span>
            </div>
            <div className="musteri-schedule__stat">
              <span className="musteri-schedule__stat-label">Faiz</span>
              <span className="musteri-schedule__stat-value">{formatMoney(totals.faiz)}</span>
            </div>
            <div className="musteri-schedule__stat">
              <span className="musteri-schedule__stat-label">Cəmi</span>
              <span className="musteri-schedule__stat-value">{formatMoney(totals.cemi)}</span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarix</th>
                  <th>Tip</th>
                  <th>Məbləğ</th>
                  <th>Qeyd</th>
                  {manageable && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/odenisler/${r.id}${manageable ? '?edit=1' : ''}`}>
                        {formatDate(r.tarix)}
                      </Link>
                    </td>
                    <td>{tipLabel(r.tip)}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(r.mebleg)}</td>
                    <td>{r.qeyd || '—'}</td>
                    {manageable && (
                      <td>
                        <button
                          type="button"
                          className="btn btn--secondary"
                          style={{ color: 'var(--color-accent)', padding: '4px 10px', fontSize: 12 }}
                          disabled={busyId === r.id}
                          onClick={() => handleDelete(r)}
                        >
                          {busyId === r.id ? '…' : 'Sil'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
