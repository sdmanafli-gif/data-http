import { formatMoney } from './constants'

const CARDS = [
  { key: 'alis_qiymeti', label: 'Alış qiyməti' },
  { key: 'satis_qiymeti', label: 'Satış qiyməti' },
  { key: 'verilib', label: 'Verilib' },
  { key: 'qalan_borc', label: 'Qalan borc' },
  { key: 'faiz', label: 'Faiz (cərimə)' },
]

export default function SummaryCards({ totals, rowCount }) {
  return (
    <div className="musteri-summary">
      {CARDS.map((card) => (
        <div key={card.key} className="musteri-summary__card">
          <div className="musteri-summary__label">{card.label}</div>
          <div className="musteri-summary__value">{formatMoney(totals[card.key] ?? 0)}</div>
        </div>
      ))}
      <div className="musteri-summary__card musteri-summary__card--meta">
        <div className="musteri-summary__label">Sətir sayı</div>
        <div className="musteri-summary__value">{rowCount}</div>
      </div>
    </div>
  )
}
