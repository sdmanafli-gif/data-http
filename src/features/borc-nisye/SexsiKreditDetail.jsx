import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { confirmDelete } from '../../lib/confirmDelete'
import {
  SEXSI_KREDIT_TABLE,
  SEXSI_KREDIT_ODENIS_TABLE,
  formatMoney,
  formatDate,
} from './sexsiKreditConstants'
import {
  resolveSexsiSchedule,
  scheduleIsCustom,
  normalizeSexsiScheduleLines,
  validateSexsiSchedule,
  matchSexsiPayments,
  sexsiScheduleTotals,
  statusLabelAz,
} from './sexsiKreditSchedule'
import '../musteri-bazasi/musteri-schedule.css'
import '../../styles/shared.css'

export default function SexsiKreditDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [kredit, setKredit] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [payForm, setPayForm] = useState({
    mebleg: '',
    tarix: new Date().toISOString().slice(0, 10),
    qeyd: '',
  })
  const [savingPay, setSavingPay] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [draft, setDraft] = useState([])
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [confirmWarnings, setConfirmWarnings] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ data: k, error: kErr }, { data: p, error: pErr }] = await Promise.all([
        supabase.from(SEXSI_KREDIT_TABLE).select('*').eq('id', id).single(),
        supabase
          .from(SEXSI_KREDIT_ODENIS_TABLE)
          .select('*')
          .eq('kredit_id', id)
          .order('tarix', { ascending: true }),
      ])
      if (kErr) throw kErr
      if (pErr) throw pErr
      setKredit(k)
      setPayments(p || [])
    } catch (e) {
      setError(e.message)
      setKredit(null)
      setPayments([])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const schedule = useMemo(
    () => (kredit ? resolveSexsiSchedule(kredit) : []),
    [kredit]
  )
  const matched = useMemo(
    () => matchSexsiPayments(editingSchedule ? draft : schedule, payments),
    [editingSchedule, draft, schedule, payments]
  )
  const totals = useMemo(() => sexsiScheduleTotals(matched), [matched])
  const isCustom = scheduleIsCustom(kredit)
  const displayRows = editingSchedule
    ? draft.map((l) => ({
        ...l,
        owed: Number(l.mebleg) || 0,
        paid: 0,
        remaining: Number(l.mebleg) || 0,
        status: 'gozleyir',
        delayDays: 0,
      }))
    : matched

  function startEditSchedule() {
    setDraft(normalizeSexsiScheduleLines(schedule, kredit).map((l) => ({ ...l })))
    setEditingSchedule(true)
    setConfirmWarnings(null)
  }

  function updateDraft(index, patch) {
    setDraft((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  async function persistSchedule(lines, { clearCustom = false } = {}) {
    setSavingSchedule(true)
    setError(null)
    try {
      const payload = {
        odenis_qrafiki: clearCustom
          ? null
          : normalizeSexsiScheduleLines(lines, kredit),
        updated_at: new Date().toISOString(),
      }
      if (!clearCustom && payload.odenis_qrafiki?.[0]?.tarix) {
        payload.birinci_odenis_tarixi = payload.odenis_qrafiki[0].tarix
      }
      const { data, error: e } = await supabase
        .from(SEXSI_KREDIT_TABLE)
        .update(payload)
        .eq('id', id)
        .select('*')
        .single()
      if (e) throw e
      setKredit(data)
      setEditingSchedule(false)
      setDraft([])
      setConfirmWarnings(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingSchedule(false)
    }
  }

  function requestSaveSchedule() {
    const normalized = normalizeSexsiScheduleLines(draft, kredit)
    const warnings = validateSexsiSchedule(normalized, kredit)
    if (warnings.length) {
      setConfirmWarnings({ lines: normalized, warnings })
      return
    }
    persistSchedule(normalized)
  }

  async function addPayment(e) {
    e.preventDefault()
    const mebleg = Number(String(payForm.mebleg).replace(',', '.'))
    if (!Number.isFinite(mebleg) || mebleg <= 0) {
      setError('Ödəniş məbləği düzgün daxil edilməlidir.')
      return
    }
    if (!payForm.tarix) {
      setError('Ödəniş tarixi lazımdır.')
      return
    }
    setSavingPay(true)
    setError(null)
    try {
      const { error: eIns } = await supabase.from(SEXSI_KREDIT_ODENIS_TABLE).insert({
        kredit_id: id,
        mebleg,
        tarix: payForm.tarix,
        qeyd: payForm.qeyd?.trim() || null,
      })
      if (eIns) throw eIns
      setPayForm({
        mebleg: '',
        tarix: new Date().toISOString().slice(0, 10),
        qeyd: '',
      })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingPay(false)
    }
  }

  async function deletePayment(payId) {
    if (!confirmDelete('Bu ödəniş silinsin?')) return
    const { error: e } = await supabase.from(SEXSI_KREDIT_ODENIS_TABLE).delete().eq('id', payId)
    if (e) setError(e.message)
    else await load()
  }

  async function deleteKredit() {
    if (!confirmDelete(`«${kredit?.ad}» krediti və bütün ödənişləri silinsin?`)) return
    const { error: e } = await supabase.from(SEXSI_KREDIT_TABLE).delete().eq('id', id)
    if (e) setError(e.message)
    else navigate('/borc-nisye')
  }

  if (loading) {
    return (
      <div className="card">
        <p className="empty-state">Yüklənir…</p>
      </div>
    )
  }

  if (!kredit) {
    return (
      <div className="card">
        <p className="empty-state">{error || 'Kredit tapılmadı.'}</p>
        <Link to="/borc-nisye" className="btn btn--secondary">
          Geri
        </Link>
      </div>
    )
  }

  return (
    <div className="musteri-schedule" style={{ marginTop: 0 }}>
      <div className="musteri-schedule__toolbar">
        <div>
          <h2 className="card__title" style={{ margin: 0 }}>
            {kredit.ad}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
            {kredit.kimden ? `${kredit.kimden} · ` : ''}
            {formatDate(kredit.verilme_tarixi)} · {formatMoney(kredit.cemi_mebleg)} ·{' '}
            {kredit.nece_ay} ay
            {isCustom ? ' · qrafik: əl ilə' : ' · qrafik: avtomatik'}
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Link to={`/borc-nisye/sexsi-kredit/${id}/redakte`} className="btn btn--secondary">
            Redaktə
          </Link>
          <button type="button" className="btn btn--danger" onClick={deleteKredit}>
            Sil
          </button>
          <Link to="/borc-nisye" className="btn btn--secondary">
            Siyahıya
          </Link>
        </div>
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      <div className="musteri-schedule__summary">
        <div className="musteri-summary__card">
          <div className="musteri-summary__label">Cəmi kredit</div>
          <div className="musteri-summary__value">{formatMoney(kredit.cemi_mebleg)}</div>
        </div>
        <div className="musteri-summary__card">
          <div className="musteri-summary__label">Ödənilib</div>
          <div className="musteri-summary__value">{formatMoney(totals.paid)}</div>
        </div>
        <div className="musteri-summary__card">
          <div className="musteri-summary__label">Qalan</div>
          <div className="musteri-summary__value">{formatMoney(totals.remaining)}</div>
        </div>
        <div className="musteri-summary__card musteri-summary__card--meta">
          <div className="musteri-summary__label">Ödəniş sayı</div>
          <div className="musteri-summary__value">{payments.length}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="card__title">Yeni ödəniş</h3>
        <form onSubmit={addPayment} className="form-row">
          <div className="form-group">
            <label>Məbləğ *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={payForm.mebleg}
              onChange={(e) => setPayForm((f) => ({ ...f, mebleg: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label>Tarix *</label>
            <input
              type="date"
              value={payForm.tarix}
              onChange={(e) => setPayForm((f) => ({ ...f, tarix: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label>Qeyd</label>
            <input
              value={payForm.qeyd}
              onChange={(e) => setPayForm((f) => ({ ...f, qeyd: e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="btn btn--primary" disabled={savingPay}>
              {savingPay ? '…' : 'Ödəniş əlavə et'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="musteri-schedule__toolbar">
          <h3 className="card__title" style={{ margin: 0 }}>
            Ödəniş qrafiki
            {isCustom ? (
              <span className="musteri-schedule__badge">əl ilə</span>
            ) : (
              <span className="musteri-schedule__badge musteri-schedule__badge--auto">
                avtomatik
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!editingSchedule && (
              <button type="button" className="btn btn--secondary" onClick={startEditSchedule}>
                Qrafiki dəyiş
              </button>
            )}
            {!editingSchedule && isCustom && (
              <button
                type="button"
                className="btn btn--secondary"
                disabled={savingSchedule}
                onClick={() => {
                  if (!window.confirm('Avtomatik qrafikə qayıdılsın?')) return
                  persistSchedule([], { clearCustom: true })
                }}
              >
                Avtomatikə qayıt
              </button>
            )}
            {editingSchedule && (
              <>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => {
                    setEditingSchedule(false)
                    setConfirmWarnings(null)
                  }}
                  disabled={savingSchedule}
                >
                  Ləğv et
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={requestSaveSchedule}
                  disabled={savingSchedule}
                >
                  {savingSchedule ? 'Saxlanılır…' : 'Saxla'}
                </button>
              </>
            )}
          </div>
        </div>

        {confirmWarnings && (
          <div className="musteri-schedule__confirm">
            <strong>Diqqət — uyğunsuzluqlar</strong>
            <ul>
              {confirmWarnings.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn--primary"
                disabled={savingSchedule}
                onClick={() => persistSchedule(confirmWarnings.lines)}
              >
                Bəli, saxla
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setConfirmWarnings(null)}
              >
                Düzəlişə qayıt
              </button>
            </div>
          </div>
        )}

        <div className="table-wrap musteri-schedule__table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Növ</th>
                <th>Vaxtı</th>
                <th>Məbləğ</th>
                {!editingSchedule && (
                  <>
                    <th>Ödənilib</th>
                    <th>Qalan</th>
                    <th>Status</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((item, index) => (
                <tr
                  key={`${item.installment}-${index}`}
                  className={
                    !editingSchedule && item.status === 'gecikib'
                      ? 'musteri-schedule__row--late'
                      : !editingSchedule && item.status === 'odenib'
                        ? 'musteri-schedule__row--paid'
                        : undefined
                  }
                >
                  <td>{item.installment}</td>
                  <td>{item.label}</td>
                  <td>
                    {editingSchedule ? (
                      <input
                        type="date"
                        value={draft[index]?.tarix || ''}
                        onChange={(e) => updateDraft(index, { tarix: e.target.value })}
                      />
                    ) : (
                      formatDate(item.tarix)
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {editingSchedule ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={draft[index]?.mebleg ?? ''}
                        onChange={(e) =>
                          updateDraft(index, {
                            mebleg: e.target.value === '' ? '' : Number(e.target.value),
                          })
                        }
                      />
                    ) : (
                      formatMoney(item.owed)
                    )}
                  </td>
                  {!editingSchedule && (
                    <>
                      <td>{formatMoney(item.paid)}</td>
                      <td>{formatMoney(item.remaining)}</td>
                      <td>
                        <span
                          className={
                            item.status === 'gecikib'
                              ? 'musteri-schedule__overdue'
                              : item.status === 'odenib'
                                ? 'musteri-schedule__paid'
                                : 'musteri-schedule__upcoming'
                          }
                        >
                          {statusLabelAz(item.status)}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="card__title">Edilmiş ödənişlər</h3>
        {payments.length === 0 ? (
          <p className="empty-state" style={{ margin: 0 }}>
            Hələ ödəniş yoxdur.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tarix</th>
                  <th>Məbləğ</th>
                  <th>Qeyd</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td>{formatDate(p.tarix)}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(p.mebleg)}</td>
                    <td>{p.qeyd || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--danger"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => deletePayment(p.id)}
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={{ fontWeight: 600 }}>
                    Cəmi
                  </td>
                  <td style={{ fontWeight: 700 }}>{formatMoney(totals.paid)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
