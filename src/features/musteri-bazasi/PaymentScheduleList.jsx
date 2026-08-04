import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { supabase } from '../../lib/supabase'
import { MUSTERI_TABLE, formatMoney, formatDate } from './constants'
import { ODENISLER_TABLE } from '../odenisler/constants'
import {
  computeIlkinOdenis,
  canBuildSchedule,
  scheduleTotals,
  matchPaymentsToSchedule,
  matchedScheduleTotals,
  statusLabel,
  PENALTY_RATE_PER_DAY,
  resolvePaymentSchedule,
  scheduleIsCustom,
  normalizeScheduleLines,
  validatePaymentSchedule,
} from './paymentSchedule'

function snapshotFileName(record) {
  const sira =
    record?.sira_no != null && String(record.sira_no).trim() !== ''
      ? String(record.sira_no).trim()
      : null
  const raw = String(record?.ad_soyad || 'musteri')
  const safe = raw
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
  const parts = [sira ? `No-${sira}` : null, safe || 'musteri'].filter(Boolean)
  return `odenis-qrafiki-${parts.join('-')}.png`
}

/**
 * Credit payment schedule — auto-built, optionally editable with validation.
 */
export default function PaymentScheduleList({ record, onRecordUpdated }) {
  const snapRef = useRef(null)
  const [payments, setPayments] = useState([])
  const [loadingPay, setLoadingPay] = useState(Boolean(record?.id))
  const [error, setError] = useState(null)
  const [snapping, setSnapping] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState([])
  const [saving, setSaving] = useState(false)
  const [confirmWarnings, setConfirmWarnings] = useState(null)
  const [localRecord, setLocalRecord] = useState(record)

  useEffect(() => {
    setLocalRecord(record)
    setEditing(false)
    setConfirmWarnings(null)
  }, [record])

  useEffect(() => {
    if (!localRecord?.id) {
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
        .eq('musteri_bazasi_id', localRecord.id)
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
  }, [localRecord?.id])

  const baseSchedule = useMemo(
    () => resolvePaymentSchedule(localRecord),
    [localRecord]
  )

  const schedule = editing ? draft : baseSchedule
  const isCustom = scheduleIsCustom(localRecord)

  const matched = useMemo(
    () =>
      matchPaymentsToSchedule(schedule, payments, {
        aylıq: Number(localRecord?.ayliq_odenis) || 0,
      }),
    [schedule, payments, localRecord?.ayliq_odenis]
  )

  const totals = useMemo(() => scheduleTotals(schedule), [schedule])
  const matchTotals = useMemo(() => matchedScheduleTotals(matched), [matched])
  const ilkin = computeIlkinOdenis(localRecord)

  const displayRows = editing
    ? draft.map((item) => ({
        ...item,
        owed: Number(item.mebleg) || 0,
        paid: 0,
        remaining: Number(item.mebleg) || 0,
        delayDays: 0,
        penalty: 0,
        status: 'gozleyir',
      }))
    : matched

  function startEdit() {
    setDraft(normalizeScheduleLines(baseSchedule, localRecord).map((l) => ({ ...l })))
    setEditing(true)
    setConfirmWarnings(null)
    setError(null)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft([])
    setConfirmWarnings(null)
  }

  function updateDraftLine(index, patch) {
    setDraft((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line))
    )
  }

  async function persistSchedule(lines, { clearCustom = false } = {}) {
    if (!localRecord?.id) {
      setError('Əvvəlcə qeydi saxlayın, sonra qrafiki dəyişin.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const normalized = clearCustom
        ? null
        : normalizeScheduleLines(lines, localRecord)
      const payload = {
        odenis_qrafiki: normalized,
        updated_at: new Date().toISOString(),
      }
      if (!clearCustom && normalized) {
        const firstAyliq = normalized.find((l) => l.type === 'ayliq')
        if (firstAyliq?.tarix) {
          payload.birinci_ayliq_odenis_tarixi = firstAyliq.tarix
        }
      }
      const { data, error: e } = await supabase
        .from(MUSTERI_TABLE)
        .update(payload)
        .eq('id', localRecord.id)
        .select('*')
        .single()
      if (e) throw e
      const next = data || { ...localRecord, ...payload }
      setLocalRecord(next)
      onRecordUpdated?.(next)
      setEditing(false)
      setDraft([])
      setConfirmWarnings(null)
    } catch (err) {
      setError(err?.message || 'Qrafik saxlanılmadı.')
    } finally {
      setSaving(false)
    }
  }

  function requestSave() {
    const normalized = normalizeScheduleLines(draft, localRecord)
    const warnings = validatePaymentSchedule(normalized, localRecord)
    if (warnings.length > 0) {
      setConfirmWarnings({ lines: normalized, warnings })
      return
    }
    persistSchedule(normalized)
  }

  async function saveAsPhoto() {
    if (!snapRef.current || snapping) return
    setSnapping(true)
    setError(null)
    try {
      const dataUrl = await toPng(snapRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      const link = document.createElement('a')
      link.download = snapshotFileName(localRecord)
      link.href = dataUrl
      link.click()
    } catch (err) {
      setError(err?.message || 'Şəkil yaradıla bilmədi.')
    } finally {
      setSnapping(false)
    }
  }

  if (!canBuildSchedule(localRecord) && !(Array.isArray(localRecord?.odenis_qrafiki) && localRecord.odenis_qrafiki.length)) {
    return (
      <div className="musteri-schedule">
        <h3 className="card__title">Ödəniş qrafiki</h3>
        <p className="empty-state">
          Qrafik üçün verilmə tarixi, neçə ay, aylıq ödəniş, satış qiyməti və
          {' '}
          <strong>birinci aylıq ödəniş tarixi</strong>
          {' '}
          (və ya ödəniş günü) lazımdır.
        </p>
      </div>
    )
  }

  return (
    <div className="musteri-schedule">
      <div className="musteri-schedule__toolbar">
        <h3 className="card__title" style={{ margin: 0 }}>
          Ödəniş qrafiki
          {isCustom ? (
            <span className="musteri-schedule__badge">əl ilə</span>
          ) : (
            <span className="musteri-schedule__badge musteri-schedule__badge--auto">avtomatik</span>
          )}
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {!editing && localRecord?.id && (
            <button type="button" className="btn btn--secondary" onClick={startEdit}>
              Qrafiki dəyiş
            </button>
          )}
          {!editing && isCustom && localRecord?.id && (
            <button
              type="button"
              className="btn btn--secondary"
              disabled={saving}
              onClick={() => {
                if (
                  !window.confirm(
                    'Əl ilə saxlanmış qrafik silinsin və avtomatik hesablamaya qayıdılsın?'
                  )
                ) {
                  return
                }
                persistSchedule([], { clearCustom: true })
              }}
            >
              Avtomatikə qayıt
            </button>
          )}
          {editing && (
            <>
              <button type="button" className="btn btn--secondary" onClick={cancelEdit} disabled={saving}>
                Ləğv et
              </button>
              <button type="button" className="btn btn--primary" onClick={requestSave} disabled={saving}>
                {saving ? 'Saxlanılır…' : 'Saxla'}
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn--secondary"
            onClick={saveAsPhoto}
            disabled={snapping || loadingPay || displayRows.length === 0 || editing}
            title="Cədvəlin şəklini yüklə"
          >
            {snapping ? 'Şəkil hazırlanır…' : 'Şəkil kimi saxla'}
          </button>
        </div>
      </div>

      {confirmWarnings && (
        <div className="musteri-schedule__confirm">
          <strong>Diqqət — uyğunsuzluqlar tapıldı</strong>
          <ul>
            {confirmWarnings.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p style={{ margin: '8px 0 12px', fontSize: 13 }}>
            Dəyişiklikləri yenə də saxlamaq istəyirsiniz?
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--primary"
              disabled={saving}
              onClick={() => persistSchedule(confirmWarnings.lines)}
            >
              Bəli, saxla
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={saving}
              onClick={() => setConfirmWarnings(null)}
            >
              Düzəlişə qayıt
            </button>
          </div>
        </div>
      )}

      <div ref={snapRef} className="musteri-schedule__snapshot">
        <div className="musteri-schedule__snap-heading">
          {localRecord?.sira_no != null && String(localRecord.sira_no).trim() !== '' ? (
            <strong className="musteri-schedule__snap-sira">№ {localRecord.sira_no}</strong>
          ) : null}
          <strong>Ödəniş qrafiki</strong>
          {localRecord?.ad_soyad ? <span>{localRecord.ad_soyad}</span> : null}
          {localRecord?.model ? <span>{localRecord.model}</span> : null}
          {localRecord?.imei_1 ? <span>IMEI: {localRecord.imei_1}</span> : null}
        </div>

        <div className="musteri-schedule__summary">
          <div className="musteri-schedule__stat">
            <span className="musteri-schedule__stat-label">İlkin ödəniş</span>
            <span className="musteri-schedule__stat-value">{formatMoney(ilkin ?? totals.ilkin)}</span>
          </div>
          <div className="musteri-schedule__stat">
            <span className="musteri-schedule__stat-label">
              Aylıq × {Number(localRecord?.nece_ay) || '—'}
            </span>
            <span className="musteri-schedule__stat-value">{formatMoney(totals.aylıq)}</span>
          </div>
          <div className="musteri-schedule__stat">
            <span className="musteri-schedule__stat-label">Qrafik cəmi</span>
            <span className="musteri-schedule__stat-value">{formatMoney(totals.cemi)}</span>
          </div>
          {!editing && (
            <>
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
            </>
          )}
        </div>
        <p className="musteri-schedule__hint">
          İlkin / Aylıq ödənişlər qrafiki sırayla örtür. Faiz Borc ayrıca saxlanılır.
          Gecikmə cəriməsi = aylıq × {(PENALTY_RATE_PER_DAY * 100).toFixed(2)}% × gün (yalnız bu cədvəldə göstərilir).
          {localRecord?.birinci_ayliq_odenis_tarixi
            ? ` Birinci aylıq: ${formatDate(localRecord.birinci_ayliq_odenis_tarixi)}.`
            : ''}
          {editing ? ' Redaktə rejimində tarix və məbləği dəyişə bilərsiniz.' : ''}
        </p>
        {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}
        {loadingPay && !editing ? (
          <p className="empty-state">Ödənişlər yüklənir…</p>
        ) : (
          <div className="table-wrap musteri-schedule__table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Növ</th>
                  <th>Vaxtı</th>
                  <th>Məbləğ</th>
                  {!editing && (
                    <>
                      <th>Ödənilib</th>
                      <th>Qalan</th>
                      <th>Gecikmə</th>
                      <th>Cərimə</th>
                      <th>Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((item, index) => (
                  <tr
                    key={`${item.type}-${item.installment}-${index}`}
                    className={[
                      item.type === 'ilkin' &&
                      (editing ||
                        (item.status !== 'odenib' &&
                          item.status !== 'odenib_gec' &&
                          item.status !== 'gecikib'))
                        ? 'musteri-schedule__row--ilkin'
                        : '',
                      !editing && item.status === 'gecikib'
                        ? 'musteri-schedule__row--late'
                        : '',
                      !editing && item.status === 'odenib_gec'
                        ? 'musteri-schedule__row--paid-late'
                        : '',
                      !editing && item.status === 'odenib'
                        ? 'musteri-schedule__row--paid'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <td>{item.type === 'ilkin' ? 'İlkin' : item.installment}</td>
                    <td>{item.label}</td>
                    <td>
                      {editing ? (
                        <input
                          type="date"
                          value={draft[index]?.tarix || ''}
                          onChange={(e) => updateDraftLine(index, { tarix: e.target.value })}
                          style={{ width: '100%', minWidth: 140 }}
                        />
                      ) : (
                        formatDate(item.tarix)
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {editing ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={draft[index]?.mebleg ?? ''}
                          onChange={(e) =>
                            updateDraftLine(index, {
                              mebleg: e.target.value === '' ? '' : Number(e.target.value),
                            })
                          }
                          style={{ width: '100%', minWidth: 100 }}
                        />
                      ) : (
                        formatMoney(item.owed)
                      )}
                    </td>
                    {!editing && (
                      <>
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
                              item.status === 'gecikib'
                                ? 'musteri-schedule__overdue'
                                : item.status === 'odenib_gec'
                                  ? 'musteri-schedule__paid-late'
                                  : item.status === 'odenib'
                                    ? 'musteri-schedule__paid'
                                    : 'musteri-schedule__upcoming'
                            }
                          >
                            {statusLabel(item.status)}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
