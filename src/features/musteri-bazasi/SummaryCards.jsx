import CollapsibleSummary from '../../components/CollapsibleSummary'
import { formatMoney, moneyCellClass } from './constants'

const CARDS = [
  { key: 'alis_qiymeti', label: 'Alış qiyməti' },
  { key: 'satis_qiymeti', label: 'Satış qiyməti' },
  { key: 'verilib', label: 'Verilib' },
  { key: 'qalan_borc', label: 'Qalan borc' },
  { key: 'faiz', label: 'Faiz (cərimə)' },
]

function valueToneClass(key, value) {
  const cls = moneyCellClass({ key, type: 'money' }, value)
  if (!cls) return undefined
  if (cls.includes('num--pos')) return 'musteri-summary__value--pos'
  if (cls.includes('num--neg')) return 'musteri-summary__value--neg'
  return 'musteri-summary__value--neutral'
}

/**
 * @param {string[]|null} [allowedKeys] null = all; [] = hide entirely
 */
export default function SummaryCards({
  totals,
  rowCount,
  extraCards = [],
  storageKey = 'summary:musteri',
  allowedKeys = null,
}) {
  if (Array.isArray(allowedKeys) && allowedKeys.length === 0) return null

  const allow = (key) => allowedKeys == null || allowedKeys.includes(key)
  const cards = CARDS.filter((c) => allow(c.key))
  const extras = extraCards.filter((c) => allow(c.key))
  const showRowCount = allow('row_count')

  if (cards.length === 0 && extras.length === 0 && !showRowCount) return null

  return (
    <CollapsibleSummary title="Cəmlər" storageKey={storageKey}>
      <div className="musteri-summary">
        {cards.map((card) => {
          const value = totals[card.key] ?? 0
          return (
            <div key={card.key} className="musteri-summary__card">
              <div className="musteri-summary__label">{card.label}</div>
              <div className={`musteri-summary__value ${valueToneClass(card.key, value)}`}>
                {formatMoney(value)}
              </div>
            </div>
          )
        })}
        {extras.map((card) => {
          const value = card.value ?? 0
          const tone = card.format === 'raw' ? undefined : valueToneClass(card.key, value)
          return (
            <div key={card.key} className="musteri-summary__card">
              <div className="musteri-summary__label">{card.label}</div>
              <div className={`musteri-summary__value${tone ? ` ${tone}` : ''}`}>
                {card.format === 'raw' ? value : formatMoney(value)}
              </div>
            </div>
          )
        })}
        {showRowCount && (
          <div className="musteri-summary__card musteri-summary__card--meta">
            <div className="musteri-summary__label">Sətir sayı</div>
            <div className="musteri-summary__value">{rowCount}</div>
          </div>
        )}
      </div>
    </CollapsibleSummary>
  )
}
