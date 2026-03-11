import { useState, useEffect } from 'react'
import '../../styles/shared.css'

const DEFAULT_RATES = { 6: 64, 8: 70, 10: 80, 12: 110, 15: 120, 18: 130, 24: 200 }
const DURATIONS = [6, 8, 10, 12, 15, 18, 24]

const STORAGE_KEY = 'mobideal_qiymet_cedveli_rates'

function loadStoredRates() {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) return { ...DEFAULT_RATES, ...JSON.parse(s) }
  } catch (_) {}
  return { ...DEFAULT_RATES }
}

function saveRates(rates) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rates))
  } catch (_) {}
}

function formatNum(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return Number(n).toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatNumRoundUp(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return Math.ceil(Number(n)).toLocaleString('az-AZ', { maximumFractionDigits: 0 })
}

export default function QiymetCedveli() {
  const [totalCost, setTotalCost] = useState('')
  const [downPayment, setDownPayment] = useState('')
  const [rates, setRates] = useState(loadStoredRates)

  useEffect(() => {
    saveRates(rates)
  }, [rates])

  const total = Number(totalCost) || 0
  const down = Number(downPayment) || 0
  const loan = Math.max(0, total - down)

  function setRateForDuration(months, value) {
    const v = Number(value)
    if (Number.isNaN(v)) return
    setRates((prev) => ({ ...prev, [months]: v }))
  }

  return (
    <div className="card">
      <h2 className="card__title">Qiymət cədvəli — aylıq ödəniş kalkulyatoru</h2>
      <p style={{ margin: '0 0 var(--space-lg) 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
        Satış qiyməti və ilkin ödəniş daxil edin; bütün müddətlər üzrə aylıq ödəniş cədvəldə göstərilir. Faiz sütununu dəyişə bilərsiniz.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
        <div className="form-group">
          <label>Satış qiyməti (AZN)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={totalCost}
            onChange={(e) => setTotalCost(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="form-group">
          <label>Ilkin ödəniş (AZN)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={downPayment}
            onChange={(e) => setDownPayment(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Kredit məbləği</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatNumRoundUp(loan)} AZN</div>
      </div>

      <h3 className="card__title">Bütün müddətlər üzrə aylıq ödəniş</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Müddət (ay)</th>
              <th>Faiz (%)</th>
              <th className="num">Aylıq ödəniş (AZN)</th>
              <th className="num">Ümumi geri ödəniş (AZN)</th>
              <th className="num">Qazanc (AZN)</th>
            </tr>
          </thead>
          <tbody>
            {DURATIONS.map((m) => {
              const rate = rates[m] ?? 0
              const totalRepay = loan * (1 + rate / 100)
              const monthly = m > 0 ? totalRepay / m : 0
              const earnings = totalRepay - loan
              return (
                <tr key={m}>
                  <td>{m}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={rates[m] ?? ''}
                      onChange={(e) => setRateForDuration(m, e.target.value)}
                      style={{ width: 72 }}
                    />
                  </td>
                  <td className="num">{formatNumRoundUp(monthly)}</td>
                  <td className="num">{formatNumRoundUp(totalRepay)}</td>
                  <td className="num">{formatNumRoundUp(earnings)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
