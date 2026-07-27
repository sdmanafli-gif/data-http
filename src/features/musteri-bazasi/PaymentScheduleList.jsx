import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatMoney, formatDate } from './constants'
import { ODENISLER_TABLE } from '../odenisler/constants'
import {
  buildPaymentSchedule,
  computeIlkinOdenis,
  canBuildSchedule,
  scheduleTotals,
  matchPaymentsToSchedule,
  matchedScheduleTotals,
  statusLabel,
  PENALTY_RATE_PER_DAY,
} from './paymentSchedule'

/**
 * Credit payment schedule matched against İlkin/Aylıq ödənişlər.
 * Penalty is display-only on this table.
 */
export default function PaymentScheduleList({ record }) {
  const [payments, setPayments] = useState([])
  const [loadingPay, setLoadingPay] = useState(Boolean(record?.id))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!record?.id) {
      setPayments([])
      setLoadingPay(false)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      setLoadingPay(true)
      const { data, error: e } = await supabase
        .from(ODENISLER_TABLE)
        .select('id, tip, mebleg, tarix')
        .eq('musteri_bazasi_id', record.id)
        .in('tip', ['ilkin', 'ayliq'])
        .order('tarix', { ascending: true })
      if (cancelled) return
      if (e) {
        setError(e.message)
        setPayments([])
      } else {
        setError(null)
        setPayments(data || [])
      }
      setLoadingPay(false)
    })()
    return () => {
      cancelled = true
    }
  }, [record?.id])

  const schedule = useMemo(
    () => (canBuildSchedule(record) ? buildPaymentSchedule(record) : []),
    [record]
  )

  const matched = useMemo(
    () =>
      matchPaymentsToSchedule(schedule, payments, {
        aylıq: Number(record?.ayliq_odenis) || 0,
      }),
    [schedule, payments, record?.ayliq_odenis]
  )

  const totals = useMemo(() => scheduleTotals(schedule), [schedule])
  const matchTotals = useMemo(() => matchedScheduleTotals(matched), [matched])
  const ilkin = computeIlkinOdenis(record)

  if (!canBuildSchedule(record)) {
    return (
      <div className="musteri-schedule">
        <h3 className="card__title">Ödəniş qrafiki</h3>
        <p className="empty-state">
          Qrafik üçün verilmə tarixi, neçə ay, ödəniş günü, aylıq ödəniş və satış qiyməti lazımdır.
        </p>
      </div>
    )
  }

  return (
    <div className="musteri-schedule">
      <h3 className="card__title">Ödəniş qrafiki</h3>
      <div className="musteri-schedule__summary">
        <div className="musteri-schedule__stat">
          <span className="musteri-schedule__stat-label">İlkin ödəniş</span>
          <span className="musteri-schedule__stat-value">{formatMoney(ilkin ?? 0)}</span>
        </div>
        <div className="musteri-schedule__stat">
          <span className="musteri-schedule__stat-label">Aylıq × {Number(record.nece_ay)}</span>
          <span className="musteri-schedule__stat-value">{formatMoney(totals.aylıq)}</span>
        </div>
        <div className="musteri-schedule__stat">
          <span className="musteri-schedule__stat-label">Ödənilib (qrafik)</span>
          <span className="musteri-schedule__stat-value">{formatMoney(matchTotals.paid)}</span>
        </div>
        <div className="musteri-schedule__stat">
          <span className="musteri-schedule__stat-label">Qalan (qrafik)</span>
          <span className="musteri-schedule__stat-value">{formatMoney(matchTotals.remaining)}</span>
        </div>
        <div className="musteri-schedule__stat">
          <span className="musteri-schedule__stat-label">Cərimə (cəmi)</span>
          <span className="musteri-schedule__stat-value">{formatMoney(matchTotals.penalty)}</span>
        </div>
      </div>
      <p className="musteri-schedule__hint">
        İlkin / Aylıq ödənişlər qrafiki sırayla örtür. Faiz Borc ayrıca saxlanılır.
        Gecikmə cəriməsi = aylıq × {(PENALTY_RATE_PER_DAY * 100).toFixed(2)}% × gün (yalnız bu cədvəldə göstərilir).
      </p>
      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}
      {loadingPay ? (
        <p className="empty-state">Ödənişlər yüklənir…</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Növ</th>
                <th>Vaxtı</th>
                <th>Məbləğ</th>
                <th>Ödənilib</th>
                <th>Qalan</th>
                <th>Gecikmə</th>
                <th>Cərimə</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {matched.map((item) => (
                <tr
                  key={`${item.type}-${item.installment}`}
                  className={[
                    item.type === 'ilkin' ? 'musteri-schedule__row--ilkin' : '',
                    item.status === 'gecikib' || item.status === 'odenib_gec'
                      ? 'musteri-schedule__row--late'
                      : '',
                    item.status === 'odenib' ? 'musteri-schedule__row--paid' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <td>{item.type === 'ilkin' ? 'İlkin' : item.installment}</td>
                  <td>{item.label}</td>
                  <td>{formatDate(item.tarix)}</td>
                  <td style={{ fontWeight: 600 }}>{formatMoney(item.owed)}</td>
                  <td>{formatMoney(item.paid)}</td>
                  <td>{formatMoney(item.remaining)}</td>
                  <td>
                    {item.delayDays > 0 ? (
                      <span className="musteri-schedule__overdue">{item.delayDays} gün</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {item.penalty > 0 ? (
                      <span className="musteri-schedule__overdue">{formatMoney(item.penalty)}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        item.status === 'gecikib' || item.status === 'odenib_gec'
                          ? 'musteri-schedule__overdue'
                          : item.status === 'odenib'
                            ? 'musteri-schedule__paid'
                            : 'musteri-schedule__upcoming'
                      }
                    >
                      {statusLabel(item.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
