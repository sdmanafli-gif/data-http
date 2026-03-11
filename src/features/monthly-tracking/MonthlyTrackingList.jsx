import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import '../../styles/shared.css'

function formatMoney(n) {
  if (n == null || n === '') return '—'
  return Number(n).toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STATUS_LABELS = { fulfilled: 'Ödənilib', partial: 'Qismən', missing: 'Ödənilməyib' }

export default function MonthlyTrackingList() {
  const [yearMonth, setYearMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    load()
  }, [yearMonth])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [y, m] = yearMonth.split('-').map(Number)
      const monthStart = new Date(y, m - 1, 1)
      const monthEnd = new Date(y, m, 0, 23, 59, 59)
      const nextMonthStart = new Date(y, m, 1)

      const { data: sales, error: e1 } = await supabase
        .from('sales')
        .select('id, client_id, contract_number, total_amount, terms_months, terms_monthly_amount, terms_payment_start_date, total_paid, remaining_debt, clients(full_name)')
        .eq('sale_type', 'credit')
      if (e1) throw e1

      const saleIds = (sales || []).map((s) => s.id)
      if (saleIds.length === 0) {
        setRows([])
        setLoading(false)
        return
      }

      const { data: payments } = await supabase
        .from('payments')
        .select('sale_id, amount, paid_at')
        .in('sale_id', saleIds)
        .gte('paid_at', monthStart.toISOString())
        .lt('paid_at', nextMonthStart.toISOString())

      const paidBySale = {}
      ;(payments || []).forEach((p) => {
        paidBySale[p.sale_id] = (paidBySale[p.sale_id] || 0) + Number(p.amount)
      })

      const result = []
      ;(sales || []).forEach((s) => {
        const start = s.terms_payment_start_date ? new Date(s.terms_payment_start_date) : null
        const months = Number(s.terms_months) || 0
        const end = start && months ? new Date(start.getFullYear(), start.getMonth() + months, 0) : null
        const activeThisMonth = start && monthEnd >= start && (!end || monthStart <= end)
        const expected = activeThisMonth ? (Number(s.terms_monthly_amount) || 0) : 0
        const paid = paidBySale[s.id] || 0
        let status = 'missing'
        if (paid >= expected && expected > 0) status = 'fulfilled'
        else if (paid > 0) status = 'partial'
        result.push({
          sale_id: s.id,
          client_name: s.clients?.full_name ?? '—',
          contract_number: s.contract_number ?? '—',
          expected_amount: expected,
          paid_amount: paid,
          remaining: Math.max(0, expected - paid),
          status,
        })
      })
      setRows(result)
    } catch (err) {
      setError(err?.message || String(err))
      setRows([])
    }
    setLoading(false)
  }

  if (error) return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>

  const totalExpected = rows.reduce((a, r) => a + r.expected_amount, 0)
  const totalPaid = rows.reduce((a, r) => a + r.paid_amount, 0)
  const totalMissing = rows.reduce((a, r) => a + r.remaining, 0)

  return (
    <div className="card">
      <h2 className="card__title">Aylıq yığım (kredit satışları)</h2>
      <p style={{ margin: '0 0 var(--space-md) 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
        Seçilmiş ay üzrə müştəriyə görə gözlənilən, ödənilən və qalan məbləğlər.
      </p>
      <div style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 500 }}>Ay:</label>
        <input
          type="month"
          value={yearMonth}
          onChange={(e) => setYearMonth(e.target.value)}
          style={{ padding: 'var(--space-sm) var(--space-md)' }}
        />
      </div>
      {loading ? (
        <p className="empty-state">Yüklənir…</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            <div style={{ padding: 'var(--space-md)', background: 'var(--color-bg)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Gözlənilən</div>
              <div style={{ fontWeight: 600 }}>{formatMoney(totalExpected)}</div>
            </div>
            <div style={{ padding: 'var(--space-md)', background: 'var(--color-bg)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Ödənilən</div>
              <div style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{formatMoney(totalPaid)}</div>
            </div>
            <div style={{ padding: 'var(--space-md)', background: 'var(--color-bg)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Qalan</div>
              <div style={{ fontWeight: 600 }}>{formatMoney(totalMissing)}</div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Müştəri</th>
                  <th>Müqavilə</th>
                  <th className="num">Gözlənilən</th>
                  <th className="num">Ödənilən</th>
                  <th className="num">Qalan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ color: 'var(--color-text-muted)' }}>Bu ay üçün kredit satışı tapılmadı.</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.sale_id}>
                      <td>{row.client_name}</td>
                      <td>{row.contract_number}</td>
                      <td className="num">{formatMoney(row.expected_amount)}</td>
                      <td className="num">{formatMoney(row.paid_amount)}</td>
                      <td className="num">{formatMoney(row.remaining)}</td>
                      <td>{STATUS_LABELS[row.status] ?? row.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
