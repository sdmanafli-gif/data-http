import { useMemo, useState } from 'react'
import { formatMoney } from '../musteri-bazasi/constants'
import {
  normalizeScheduleLines,
  validatePaymentSchedule,
  scheduleTotals,
} from '../musteri-bazasi/paymentSchedule'
import '../musteri-bazasi/musteri-schedule.css'

/**
 * Preview / edit ödəniş qrafiki before completing a kredit sale.
 *
 * drafts: [{ itemId, label, scheduleRow, lines, buildLines }]
 */
export default function SaleSchedulePreview({
  drafts,
  onDraftsChange,
  onBack,
  onConfirm,
  saving,
}) {
  const [generated, setGenerated] = useState(
    () => (drafts || []).some((d) => Array.isArray(d.lines) && d.lines.length > 0)
  )
  const [confirmWarnings, setConfirmWarnings] = useState(null)
  const [localError, setLocalError] = useState(null)

  const allTotals = useMemo(() => {
    let cemi = 0
    let ilkin = 0
    let aylıq = 0
    for (const d of drafts || []) {
      const t = scheduleTotals(d.lines || [])
      cemi += t.cemi
      ilkin += t.ilkin
      aylıq += t.aylıq
    }
    return { cemi, ilkin, aylıq }
  }, [drafts])

  function generate() {
    setLocalError(null)
    setConfirmWarnings(null)
    const next = (drafts || []).map((d) => {
      const built = d.buildLines?.() || d.lines || []
      return {
        ...d,
        lines: normalizeScheduleLines(built, d.scheduleRow).map((l) => ({ ...l })),
      }
    })
    if (!next.some((d) => d.lines?.length)) {
      setLocalError(
        'Qrafik yaradıla bilmədi. Verilmə tarixi, neçə ay, aylıq ödəniş, satış və birinci aylıq tarixi yoxlanılmalıdır.'
      )
      return
    }
    onDraftsChange(next)
    setGenerated(true)
  }

  function updateLine(draftIndex, lineIndex, patch) {
    const next = (drafts || []).map((d, di) => {
      if (di !== draftIndex) return d
      const lines = (d.lines || []).map((line, li) =>
        li === lineIndex ? { ...line, ...patch } : line
      )
      return { ...d, lines }
    })
    onDraftsChange(next)
    setConfirmWarnings(null)
  }

  function requestConfirm() {
    setLocalError(null)
    if (!generated || !(drafts || []).some((d) => d.lines?.length)) {
      setLocalError('Əvvəlcə «Qrafiki yarat» düyməsinə basın.')
      return
    }

    const allWarnings = []
    const normalizedDrafts = (drafts || []).map((d) => {
      const lines = normalizeScheduleLines(d.lines || [], d.scheduleRow)
      const warnings = validatePaymentSchedule(lines, d.scheduleRow)
      for (const w of warnings) {
        allWarnings.push(drafts.length > 1 ? `${d.label}: ${w}` : w)
      }
      return { ...d, lines }
    })

    onDraftsChange(normalizedDrafts)

    if (allWarnings.length > 0) {
      setConfirmWarnings(allWarnings)
      return
    }
    onConfirm(normalizedDrafts)
  }

  function confirmDespiteWarnings() {
    const normalizedDrafts = (drafts || []).map((d) => ({
      ...d,
      lines: normalizeScheduleLines(d.lines || [], d.scheduleRow),
    }))
    setConfirmWarnings(null)
    onConfirm(normalizedDrafts)
  }

  return (
    <div className="card">
      <h2 className="card__title">Ödəniş qrafiki — təsdiq</h2>
      <p style={{ marginTop: 0, color: 'var(--color-text-muted)', fontSize: 13 }}>
        Çoxlu məhsul bir müştəri sətirində birləşdirilir. Qrafiki yaradın, yoxlayın və ya redaktə edin, sonra təsdiq edin.
      </p>

      {!generated && (
        <div style={{ marginBottom: 16 }}>
          <button type="button" className="btn btn--primary" onClick={generate}>
            Qrafiki yarat
          </button>
        </div>
      )}

      {generated &&
        (drafts || []).map((draft, draftIndex) => {
          const totals = scheduleTotals(draft.lines || [])
          const sale = Number(draft.scheduleRow?.satis_qiymeti) || 0
          const diff = Math.round((totals.cemi - sale) * 100) / 100
          return (
            <div key={draft.itemId} className="musteri-schedule" style={{ marginTop: draftIndex ? 28 : 12 }}>
              <div className="musteri-schedule__toolbar">
                <h3 className="card__title" style={{ margin: 0 }}>
                  {draft.label}
                  <span className="musteri-schedule__badge">redaktə edilə bilər</span>
                </h3>
              </div>
              <div className="musteri-schedule__summary-row" style={{ marginBottom: 12 }}>
                <div className="musteri-schedule__stat">
                  <span className="musteri-schedule__stat-label">İlkin</span>
                  <span className="musteri-schedule__stat-value">{formatMoney(totals.ilkin)}</span>
                </div>
                <div className="musteri-schedule__stat">
                  <span className="musteri-schedule__stat-label">Aylıq cəmi</span>
                  <span className="musteri-schedule__stat-value">{formatMoney(totals.aylıq)}</span>
                </div>
                <div className="musteri-schedule__stat">
                  <span className="musteri-schedule__stat-label">Qrafik cəmi</span>
                  <span className="musteri-schedule__stat-value">{formatMoney(totals.cemi)}</span>
                </div>
                <div className="musteri-schedule__stat">
                  <span className="musteri-schedule__stat-label">Satış</span>
                  <span className="musteri-schedule__stat-value">{formatMoney(sale)}</span>
                </div>
                {Math.abs(diff) > 0.01 && (
                  <div className="musteri-schedule__stat">
                    <span className="musteri-schedule__stat-label">Fərq</span>
                    <span className="musteri-schedule__stat-value musteri-schedule__stat-value--warn">
                      {formatMoney(diff)}
                    </span>
                  </div>
                )}
              </div>

              <div className="table-wrap musteri-schedule__table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Növ</th>
                      <th>Vaxtı</th>
                      <th>Məbləğ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draft.lines || []).map((item, index) => (
                      <tr
                        key={`${item.type}-${item.installment}-${index}`}
                        className={item.type === 'ilkin' ? 'musteri-schedule__row--ilkin' : ''}
                      >
                        <td>{item.type === 'ilkin' ? 'İlkin' : item.installment}</td>
                        <td>{item.label}</td>
                        <td>
                          <input
                            type="date"
                            value={item.tarix || ''}
                            onChange={(e) =>
                              updateLine(draftIndex, index, { tarix: e.target.value })
                            }
                            style={{ width: '100%', minWidth: 140 }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.mebleg ?? ''}
                            onChange={(e) =>
                              updateLine(draftIndex, index, {
                                mebleg: e.target.value === '' ? '' : Number(e.target.value),
                              })
                            }
                            style={{ width: '100%', minWidth: 100 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}

      {generated && drafts?.length > 1 && (
        <p style={{ marginTop: 12, fontSize: 13 }}>
          Ümumi qrafik cəmi: <strong>{formatMoney(allTotals.cemi)}</strong>
        </p>
      )}

      {localError && <p style={{ color: 'var(--color-accent)' }}>{localError}</p>}

      {confirmWarnings && (
        <div
          className="musteri-schedule__warn"
          style={{
            marginTop: 16,
            padding: 12,
            border: '1px solid var(--color-accent)',
            borderRadius: 8,
            background: 'color-mix(in srgb, var(--color-accent) 8%, white)',
          }}
        >
          <strong style={{ color: 'var(--color-accent)' }}>Diqqət — qrafik uyğunsuzluğu</strong>
          <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
            {confirmWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p style={{ margin: '0 0 12px', fontSize: 13 }}>
            Dəyərlər uyğun gəlmir. Yenə də təsdiq edib satışı tamamlamaq istəyirsiniz?
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--primary"
              disabled={saving}
              onClick={confirmDespiteWarnings}
            >
              {saving ? 'Saxlanılır…' : 'Bəli, təsdiq et və satışı tamamla'}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={saving}
              onClick={() => setConfirmWarnings(null)}
            >
              Xeyr, redaktəyə qayıt
            </button>
          </div>
        </div>
      )}

      {!confirmWarnings && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
          <button type="button" className="btn btn--secondary" onClick={onBack} disabled={saving}>
            Formaya qayıt
          </button>
          {generated && (
            <button type="button" className="btn btn--secondary" onClick={generate} disabled={saving}>
              Qrafiki yenidən yarat
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary"
            disabled={saving || !generated}
            onClick={requestConfirm}
          >
            {saving ? 'Saxlanılır…' : 'Təsdiq et və satışı tamamla'}
          </button>
        </div>
      )}
    </div>
  )
}
