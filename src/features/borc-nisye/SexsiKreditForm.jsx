import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  SEXSI_KREDIT_TABLE,
  emptySexsiKreditForm,
  rowToSexsiForm,
  toSexsiKreditPayload,
  validateSexsiKreditForm,
  formatMoney,
} from './sexsiKreditConstants'
import { buildSexsiSchedule, computeMonthlyAmount } from './sexsiKreditSchedule'
import '../../styles/shared.css'

export default function SexsiKreditForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(() => emptySexsiKreditForm())
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isEdit) return undefined
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error: e } = await supabase
        .from(SEXSI_KREDIT_TABLE)
        .select('*')
        .eq('id', id)
        .single()
      if (cancelled) return
      if (e) setError(e.message)
      else setForm(rowToSexsiForm(data))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, isEdit])

  const preview = useMemo(() => {
    const months = Number(form.nece_ay)
    const cemi = Number(String(form.cemi_mebleg).replace(',', '.'))
    const aylik =
      form.aylik_odenis !== '' && form.aylik_odenis != null
        ? Number(String(form.aylik_odenis).replace(',', '.'))
        : computeMonthlyAmount(cemi, months)
    const payload = toSexsiKreditPayload(form)
    const schedule = buildSexsiSchedule(payload)
    return { aylik, schedule, count: schedule.length }
  }, [form])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const err = validateSexsiKreditForm(form)
    if (err) {
      setError(err)
      return
    }
    setSaving(true)
    try {
      const payload = toSexsiKreditPayload(form)
      if (isEdit) {
        const { error: uErr } = await supabase
          .from(SEXSI_KREDIT_TABLE)
          .update(payload)
          .eq('id', id)
        if (uErr) throw uErr
        navigate(`/borc-nisye/sexsi-kredit/${id}`)
      } else {
        const { data, error: iErr } = await supabase
          .from(SEXSI_KREDIT_TABLE)
          .insert({ ...payload, odenis_qrafiki: null })
          .select('id')
          .single()
        if (iErr) throw iErr
        navigate(`/borc-nisye/sexsi-kredit/${data.id}`)
      }
    } catch (ex) {
      setError(ex?.message || 'Saxlanılmadı.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <p className="empty-state">Yüklənir…</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="record-module__header" style={{ marginBottom: 16 }}>
        <h2 className="card__title" style={{ margin: 0 }}>
          {isEdit ? 'Şəxsi krediti redaktə et' : 'Yeni şəxsi kredit'}
        </h2>
        <Link to={isEdit ? `/borc-nisye/sexsi-kredit/${id}` : '/borc-nisye'} className="btn btn--secondary">
          Geri
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Ad (kredit adı) *</label>
            <input
              value={form.ad}
              onChange={(e) => setField('ad', e.target.value)}
              placeholder="məs: Kapital kredit"
              required
            />
          </div>
          <div className="form-group">
            <label>Haradan / Kimdən</label>
            <input
              value={form.kimden}
              onChange={(e) => setField('kimden', e.target.value)}
              placeholder="Bank, şəxs…"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Götürülmə tarixi *</label>
            <input
              type="date"
              value={form.verilme_tarixi}
              onChange={(e) => setField('verilme_tarixi', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Birinci ödəniş tarixi</label>
            <input
              type="date"
              value={form.birinci_odenis_tarixi}
              onChange={(e) => setField('birinci_odenis_tarixi', e.target.value)}
            />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
              Boşdursa götürülmə tarixindən 1 ay sonra hesablanır.
            </p>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Cəmi məbləğ *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.cemi_mebleg}
              onChange={(e) => setField('cemi_mebleg', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Neçə ay *</label>
            <input
              type="number"
              min="1"
              step="1"
              value={form.nece_ay}
              onChange={(e) => setField('nece_ay', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Aylıq ödəniş</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.aylik_odenis}
              onChange={(e) => setField('aylik_odenis', e.target.value)}
              placeholder={
                preview.aylik != null ? `avtomatik ≈ ${preview.aylik}` : 'avtomatik'
              }
            />
          </div>
        </div>

        <div className="form-group">
          <label>Qeyd</label>
          <input value={form.qeyd} onChange={(e) => setField('qeyd', e.target.value)} />
        </div>

        {preview.count > 0 && (
          <div className="musteri-summary" style={{ marginBottom: 16 }}>
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Aylıq (təxmini)</div>
              <div className="musteri-summary__value">{formatMoney(preview.aylik)}</div>
            </div>
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Qrafik sətirləri</div>
              <div className="musteri-summary__value">{preview.count}</div>
            </div>
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">İlk ödəniş</div>
              <div className="musteri-summary__value" style={{ fontSize: 14 }}>
                {preview.schedule[0]?.tarix || '—'}
              </div>
            </div>
          </div>
        )}

        {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saxlanılır…' : isEdit ? 'Yenilə' : 'Kredit yarat'}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => navigate(isEdit ? `/borc-nisye/sexsi-kredit/${id}` : '/borc-nisye')}
          >
            Ləğv et
          </button>
        </div>
      </form>
    </div>
  )
}
