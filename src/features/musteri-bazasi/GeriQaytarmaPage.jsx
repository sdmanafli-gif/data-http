import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SuggestInput from './SuggestInput'
import ClientPaymentsPanel from '../odenisler/ClientPaymentsPanel'
import { useColumnConfig } from './useColumnConfig'
import {
  MUSTERI_TABLE,
  SUGGEST_FIELDS,
  emptyMusteriForm,
  toMusteriPayload,
  rowToForm,
  getFieldValue,
  setFormField,
  formatMoney,
} from './constants'
import {
  emptyDepoForm,
  STATUS_LABELS,
  SUGGEST_FIELDS as DEPO_SUGGEST,
  getFieldValue as getDepoField,
  setFormField as setDepoField,
} from '../depo/constants'
import {
  findDepoForMusteri,
  musteriToDepoForm,
  restoreDepoKeep,
  restoreDepoWithEdits,
  createDepoFromForm,
  depoRowToForm,
} from './returnUtils'
import '../../styles/shared.css'

const MUSTERI_EDIT_KEYS = [
  'ad_soyad',
  'alis_qiymeti',
  'satis_qiymeti',
  'verilib',
  'faiz',
  'veziyyet',
  'nece_ay',
  'ayliq_odenis',
  'odenis_gunu',
  'birinci_ayliq_odenis_tarixi',
  'verilme_tarixi',
  'bitme_tarixi',
  'model',
  'reng',
  'yaddas',
  'imei_1',
  'imei_2',
  'battery_faiz',
  'kimden_alinib',
  'kommentler',
]

const DEPO_FIELD_META = {
  model: { label: 'Model', type: 'text' },
  reng: { label: 'Rəng', type: 'text' },
  yaddas: { label: 'Yaddaş', type: 'text' },
  battery_faiz: { label: 'Battery %', type: 'number' },
  alis_qiymeti: { label: 'Alış qiyməti', type: 'money' },
  alis_tarixi: { label: 'Alış tarixi', type: 'date' },
  kimden_alinib: { label: 'Hardan / Kimdən', type: 'text' },
  imei_1: { label: 'IMEI 1', type: 'text' },
  imei_2: { label: 'IMEI 2', type: 'text' },
  serial_no: { label: 'Serial No', type: 'text' },
  model_no: { label: 'Model No', type: 'text' },
  nomre: { label: 'Nömrə', type: 'text' },
  sexsiyyet: { label: 'Şəxsiyyət', type: 'text' },
  veziyyet_cihaz: { label: 'Təzə / Köhnə', type: 'select', options: ['teze', 'kohne'] },
  miqdar: { label: 'Miqdar', type: 'number' },
  kommentler: { label: 'Kommentlər', type: 'text' },
}

function FieldInput({ col, value, onChange }) {
  if (!col) return null
  if (SUGGEST_FIELDS.has(col.key) || DEPO_SUGGEST.has(col.key)) {
    return (
      <SuggestInput
        id={`gq-${col.key}`}
        label={col.label}
        value={value}
        onChange={onChange}
        options={[]}
      />
    )
  }
  if (col.type === 'select') {
    return (
      <div className="form-group">
        <label>{col.label}</label>
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Seçin —</option>
          {(col.options || []).map((o) => (
            <option key={o} value={o}>
              {col.key === 'veziyyet_cihaz'
                ? o === 'teze'
                  ? 'Təzə'
                  : o === 'kohne'
                    ? 'Köhnə'
                    : o
                : o}
            </option>
          ))}
        </select>
      </div>
    )
  }
  const inputType =
    col.type === 'date' ? 'date' : col.type === 'number' || col.type === 'money' ? 'number' : 'text'
  const readOnly = Boolean(col.readonly) && col.key !== 'faiz' && col.key !== 'verilib'
  return (
    <div className="form-group">
      <label>{col.label}</label>
      <input
        type={inputType}
        step={col.type === 'money' || col.type === 'number' ? '0.01' : undefined}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
      />
    </div>
  )
}

export default function GeriQaytarmaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { columns, loading: colsLoading } = useColumnConfig()

  const [loading, setLoading] = useState(true)
  const [savingMusteri, setSavingMusteri] = useState(false)
  const [returning, setReturning] = useState(false)
  const [error, setError] = useState(null)
  const [okMsg, setOkMsg] = useState(null)

  const [record, setRecord] = useState(null)
  const [form, setForm] = useState(() => emptyMusteriForm())

  const [depo, setDepo] = useState(null)
  const [depoMatch, setDepoMatch] = useState(null)
  const [depoMode, setDepoMode] = useState('keep')
  const [depoForm, setDepoForm] = useState(() => emptyDepoForm())

  const colsByKey = useMemo(() => new Map((columns || []).map((c) => [c.key, c])), [columns])

  const musteriFields = useMemo(
    () =>
      MUSTERI_EDIT_KEYS.map((key) => {
        const base = colsByKey.get(key) || { key, label: key, type: 'text' }
        if (key === 'faiz' || key === 'verilib') return { ...base, readonly: false }
        return base
      }),
    [colsByKey]
  )

  async function reloadMusteri() {
    const { data, error: e } = await supabase.from(MUSTERI_TABLE).select('*').eq('id', id).single()
    if (e) throw e
    setRecord(data)
    setForm(rowToForm(data, columns))
    return data
  }

  useEffect(() => {
    if (colsLoading || !id) return undefined
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: e } = await supabase.from(MUSTERI_TABLE).select('*').eq('id', id).single()
        if (cancelled) return
        if (e) throw e
        setRecord(data)
        setForm(rowToForm(data, columns))

        const found = await findDepoForMusteri(supabase, data)
        if (cancelled) return
        if (found.error) throw found.error
        setDepo(found.depo)
        setDepoMatch(found.match)
        if (found.depo) {
          setDepoMode('keep')
          setDepoForm(depoRowToForm(found.depo))
        } else {
          setDepoMode('create')
          setDepoForm(musteriToDepoForm(data, null))
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, colsLoading, columns])

  async function saveMusteri() {
    setSavingMusteri(true)
    setError(null)
    setOkMsg(null)
    try {
      const payload = toMusteriPayload(form, form.musteri_id || record?.musteri_id, columns)
      const { error: err } = await supabase.from(MUSTERI_TABLE).update(payload).eq('id', id)
      if (err) throw err
      await reloadMusteri()
      setOkMsg('Müştəri qeydi yeniləndi.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingMusteri(false)
    }
  }

  async function completeReturn() {
    if (
      !window.confirm(
        'Cihaz Depoya mövcud olaraq qaytarılacaq. Müştəri kredit sətri saxlanılacaq.\n\nDavam edilsin?'
      )
    ) {
      return
    }
    setReturning(true)
    setError(null)
    setOkMsg(null)
    try {
      const musteriPayload = toMusteriPayload(form, form.musteri_id || record?.musteri_id, columns)
      const { error: mErr } = await supabase.from(MUSTERI_TABLE).update(musteriPayload).eq('id', id)
      if (mErr) throw mErr

      let depoId = depo?.id || null

      if (depo && depoMode === 'keep') {
        const { data, error: dErr } = await restoreDepoKeep(supabase, depo)
        if (dErr) throw dErr
        depoId = data.id
      } else if (depo && depoMode === 'edit') {
        const { data, error: dErr } = await restoreDepoWithEdits(supabase, depo.id, depoForm)
        if (dErr) throw dErr
        depoId = data.id
      } else {
        const { data, error: dErr } = await createDepoFromForm(supabase, depoForm)
        if (dErr) throw dErr
        depoId = data.id
      }

      const note = `Geri qaytarma: ${new Date().toISOString().slice(0, 10)}`
      const komment = [musteriPayload.kommentler, note].filter(Boolean).join(' · ')
      const { error: linkErr } = await supabase
        .from(MUSTERI_TABLE)
        .update({
          depo_id: depoId,
          kommentler: komment,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (linkErr) throw linkErr

      navigate(`/depo/${depoId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setReturning(false)
    }
  }

  if (loading || colsLoading) {
    return (
      <div className="card">
        <p className="empty-state">Yüklənir…</p>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="card">
        <p style={{ color: 'var(--color-accent)' }}>{error || 'Qeyd tapılmadı.'}</p>
        <Link to="/musteri-bazasi" className="btn btn--secondary">
          Geri
        </Link>
      </div>
    )
  }

  const showDepoForm = !depo || depoMode === 'edit' || depoMode === 'create'

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="card__title" style={{ margin: 0 }}>Geri qaytarma</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
            #{record.sira_no ?? '—'} · {record.ad_soyad || '—'}
            {record.model ? ` · ${record.model}` : ''}
          </p>
        </div>
        <Link to={`/musteri-bazasi?open=${id}`} className="btn btn--secondary">
          Geri
        </Link>
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}
      {okMsg && <p style={{ color: 'var(--color-success, #0a7)' }}>{okMsg}</p>}

      <section style={{ marginBottom: 28 }}>
        <h3 className="card__title">1. Müştəri qeydi</h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 0 }}>
          Kredit sətri saxlanılır — dəyərləri burada dəyişə bilərsiniz.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          {musteriFields.map((col) => (
            <FieldInput
              key={col.key}
              col={col}
              value={getFieldValue(form, col)}
              onChange={(v) => setForm((f) => setFormField(f, col, v))}
            />
          ))}
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--secondary" disabled={savingMusteri} onClick={saveMusteri}>
            {savingMusteri ? 'Saxlanır…' : 'Müştərini saxla'}
          </button>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)', alignSelf: 'center' }}>
            Verilib: {formatMoney(form.verilib)} · Satış: {formatMoney(form.satis_qiymeti)}
          </span>
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h3 className="card__title">2. Ödənişlər</h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 0 }}>
          Lazım olsa ödənişləri silin və ya redaktə edin (məs. pul qaytarıldıqda).
        </p>
        <ClientPaymentsPanel
          musteriId={id}
          manageable
          onChanged={async () => {
            try {
              await reloadMusteri()
            } catch (_) {
              /* ignore */
            }
          }}
        />
      </section>

      <section style={{ marginBottom: 28 }}>
        <h3 className="card__title">3. Depo — cihazı mövcud et</h3>
        {depo ? (
          <>
            <p style={{ fontSize: 13 }}>
              Tapıldı ({depoMatch === 'depo_id' ? 'depo bağlantısı' : 'IMEI'}):{' '}
              <strong>{depo.model || '—'}</strong>
              {depo.imei_1 ? ` · IMEI ${depo.imei_1}` : ''}
              {' · '}
              Status: <strong>{STATUS_LABELS[depo.status] || depo.status}</strong>
            </p>
            <div className="form-group">
              <label>
                <input
                  type="radio"
                  name="depoMode"
                  checked={depoMode === 'keep'}
                  onChange={() => {
                    setDepoMode('keep')
                    setDepoForm(depoRowToForm(depo))
                  }}
                />{' '}
                Qeydi olduğu kimi saxla (yalnız mövcud et)
              </label>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="radio"
                  name="depoMode"
                  checked={depoMode === 'edit'}
                  onChange={() => {
                    setDepoMode('edit')
                    setDepoForm(musteriToDepoForm(record, depo))
                  }}
                />{' '}
                Dəyərləri dəyiş (hardan, qiymət və s.)
              </label>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13 }}>
            Depoda uyğun cihaz tapılmadı. Yeni Depo qeydi yaradılacaq — məlumatları yoxlayın.
          </p>
        )}

        {showDepoForm && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
              marginTop: 12,
            }}
          >
            {Object.entries(DEPO_FIELD_META).map(([key, meta]) => {
              const col = { key, ...meta }
              return (
                <FieldInput
                  key={key}
                  col={col}
                  value={getDepoField(depoForm, col)}
                  onChange={(v) => setDepoForm((f) => setDepoField(f, col, v))}
                />
              )
            })}
          </div>
        )}
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--primary" disabled={returning} onClick={completeReturn}>
          {returning ? 'Qaytarılır…' : 'Cihazı depoya qaytar'}
        </button>
        <Link to={`/musteri-bazasi?open=${id}`} className="btn btn--secondary">
          Ləğv et
        </Link>
      </div>
    </div>
  )
}
