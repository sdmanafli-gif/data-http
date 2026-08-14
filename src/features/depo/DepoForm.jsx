import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { confirmDelete } from '../../lib/confirmDelete'
import { uploadSenedlerFiles } from '../../lib/senedler'
import { useColumnConfig } from './useColumnConfig'
import SuggestInput from '../musteri-bazasi/SuggestInput'
import RecordModule from '../../components/RecordModule'
import SenedlerField from '../../components/SenedlerField'
import {
  DEPO_TABLE,
  SUGGEST_FIELDS,
  STATUS_LABELS,
  ODENIS_NOVU_OPTIONS,
  CONDITION_OPTIONS,
  SIM_OPTIONS,
  emptyDepoForm,
  toDepoPayload,
  rowToForm,
  getFieldValue,
  setFormField,
  formatCell,
  getRowValue,
  validateDepoNisye,
  validateDepoDeviceCondition,
  getDepoMissingRequiredFields,
  syncDepoPurchaseNisyeLedger,
} from './constants'
import { LEDGER_TABLE } from '../borc-nisye/constants'
import '../musteri-bazasi/musteri-table.css'
import '../../styles/shared.css'
import '../../components/record-module.css'

function DynamicField({
  col,
  value,
  onChange,
  suggestions,
  forceReadonly = false,
  required = false,
  hint = null,
  invalid = false,
}) {
  if (col.type === 'files') return null
  const readonly = forceReadonly || col.readonly
  const isRequired = required || col.required
  const groupClass = `form-group${invalid ? ' form-group--invalid' : ''}`

  if (readonly) {
    return (
      <div className={groupClass}>
        <label>
          {col.label}
          {forceReadonly ? ' (avtomatik)' : ' (avtomatik)'}
        </label>
        <input readOnly value={value === '' || value == null ? '—' : String(value)} />
        {hint ? (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>{hint}</p>
        ) : null}
      </div>
    )
  }
  if (SUGGEST_FIELDS.has(col.key)) {
    return (
      <div className={groupClass}>
        <SuggestInput
          id={`depo-${col.key}`}
          label={`${col.label}${isRequired ? ' *' : ''}`}
          value={value}
          onChange={onChange}
          options={suggestions?.[col.key] || []}
        />
        {invalid ? <p className="form-group__error">Bu sahə mütləqdir</p> : null}
        {hint && !invalid ? (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>{hint}</p>
        ) : null}
      </div>
    )
  }
  if (col.type === 'select') {
    let options = col.options || []
    if (col.key === 'status') {
      options = options.map((v) => ({ value: v, label: STATUS_LABELS[v] || v }))
    } else if (col.key === 'odenis_novu') {
      options = ODENIS_NOVU_OPTIONS
    } else if (col.key === 'veziyyet_cihaz') {
      options = CONDITION_OPTIONS
    } else if (col.key === 'sim_type') {
      options = SIM_OPTIONS
    } else {
      options = options.map((v) => ({ value: v, label: v }))
    }
    return (
      <div className={groupClass}>
        <label>
          {col.label}
          {isRequired ? ' *' : ''}
        </label>
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
        >
          <option value="">— Seçin —</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {invalid ? <p className="form-group__error">Bu sahə mütləqdir</p> : null}
        {hint && !invalid ? (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>{hint}</p>
        ) : null}
      </div>
    )
  }
  const inputType = col.type === 'date' ? 'date' : col.type === 'number' || col.type === 'money' ? 'number' : 'text'
  return (
    <div className={groupClass}>
      <label>
        {col.label}
        {isRequired ? ' *' : ''}
      </label>
      <input
        type={inputType}
        step={col.type === 'money' || col.type === 'number' ? '0.01' : undefined}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
      />
      {invalid ? <p className="form-group__error">Bu sahə mütləqdir</p> : null}
      {hint && !invalid ? (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>{hint}</p>
      ) : null}
    </div>
  )
}

function uniqueSorted(values) {
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'az')
  )
}

export default function DepoForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { columns, loading: colsLoading } = useColumnConfig()
  const [form, setForm] = useState(() => emptyDepoForm())
  const [record, setRecord] = useState(null)
  const [editing, setEditing] = useState(false)
  const [suggestions, setSuggestions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [pendingFiles, setPendingFiles] = useState([])
  const [invalidKeys, setInvalidKeys] = useState(() => new Set())

  const formColumns = useMemo(() => {
    return columns
      .filter((c) => c.formVisible !== false && c.visible !== false && c.key !== 'sira_no')
      .filter((c) => {
        if (c.key === 'qaytarma_tarixi' && form.odenis_novu !== 'nisye') return false
        return true
      })
  }, [columns, form.odenis_novu])

  const viewColumns = useMemo(
    () => columns.filter((c) => c.visible !== false),
    [columns]
  )

  useEffect(() => {
    if (colsLoading) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const { data } = await fetchAllPages(() =>
          supabase.from(DEPO_TABLE).select('model, reng, yaddas, kimden_alinib, sexsiyyet')
        )
        const rows = data || []
        setSuggestions({
          model: uniqueSorted(rows.map((r) => r.model)),
          reng: uniqueSorted(rows.map((r) => r.reng)),
          yaddas: uniqueSorted(rows.map((r) => r.yaddas)),
          kimden_alinib: uniqueSorted(rows.map((r) => r.kimden_alinib)),
          sexsiyyet: uniqueSorted(rows.map((r) => r.sexsiyyet)),
        })
        if (isEdit) {
          const { data: row, error: e } = await supabase.from(DEPO_TABLE).select('*').eq('id', id).single()
          if (cancelled) return
          if (e) throw e
          setRecord(row)
          setForm(rowToForm(row, columns))
          setEditing(false)
        } else {
          setRecord(null)
          setForm(emptyDepoForm(columns))
          setEditing(true)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit, colsLoading])

  async function handleDelete() {
    if (!id || !record) return
    const label = record.model || (record.sira_no != null ? `#${record.sira_no}` : 'bu qeyd')
    if (!confirmDelete(`«${label}» Depodan silinsin?`)) return
    setDeleting(true)
    setError(null)
    try {
      // Remove linked «Nisyə aldım» purchase entry created from this item
      await supabase.from(LEDGER_TABLE).delete().eq('depo_id', id).eq('tip', 'nisye_aldim')
      const { error: err } = await supabase.from(DEPO_TABLE).delete().eq('id', id)
      if (err) throw err
      navigate('/depo')
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const missing = getDepoMissingRequiredFields(form)
    if (missing.length) {
      setInvalidKeys(new Set(missing.map((m) => m.key)))
      setError(`Mütləq sahələr boşdur: ${missing.map((m) => m.label).join(', ')}`)
      return
    }
    setInvalidKeys(new Set())
    const conditionErr = validateDepoDeviceCondition(form)
    if (conditionErr) {
      setInvalidKeys(new Set(['veziyyet_cihaz']))
      setError(conditionErr)
      return
    }
    const nisyeErr = validateDepoNisye(form)
    if (nisyeErr) {
      setError(nisyeErr)
      return
    }
    setSaving(true)
    try {
      const payload = toDepoPayload(form, columns)
      let err
      let newId = id
      let savedRow = null
      if (isEdit) {
        const { data, error: uErr } = await supabase
          .from(DEPO_TABLE)
          .update(payload)
          .eq('id', id)
          .select('*')
          .single()
        err = uErr
        savedRow = data
      } else {
        const { data: created, error: insErr } = await supabase
          .from(DEPO_TABLE)
          .insert(payload)
          .select('*')
          .single()
        err = insErr
        newId = created?.id
        savedRow = created
      }
      if (err) throw err

      if (!isEdit && newId && pendingFiles.length > 0) {
        const { files: uploaded, error: upErr } = await uploadSenedlerFiles(
          'depo',
          newId,
          pendingFiles
        )
        if (uploaded.length) {
          const nextSenedler = [...(savedRow?.senedler || []), ...uploaded]
          const { data: withFiles, error: senedErr } = await supabase
            .from(DEPO_TABLE)
            .update({ senedler: nextSenedler, updated_at: new Date().toISOString() })
            .eq('id', newId)
            .select('*')
            .single()
          if (senedErr) throw senedErr
          savedRow = withFiles
          setPendingFiles([])
        }
        if (upErr && (!uploaded || uploaded.length === 0)) throw new Error(upErr)
        if (upErr) {
          // Partial upload — still navigate but keep message
          setError(upErr)
        }
      }

      if (savedRow) {
        const { error: ledErr } = await syncDepoPurchaseNisyeLedger(supabase, savedRow)
        if (ledErr) throw ledErr
      }

      if (isEdit) {
        if (savedRow) {
          setRecord(savedRow)
          setForm(rowToForm(savedRow, columns))
        }
        setEditing(false)
      } else if (newId) {
        navigate(`/depo/${newId}`)
      } else {
        navigate('/depo')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading || colsLoading) {
    return <div className="card"><p className="empty-state">Yüklənir…</p></div>
  }

  if (isEdit && !editing && record) {
    const title = record.model || (record.sira_no != null ? `# ${record.sira_no}` : 'Depo qeydi')
    return (
      <>
        {error && <p style={{ color: 'var(--color-accent)', marginBottom: 12 }}>{error}</p>}
      <RecordModule
        title={title}
        subtitle={[
          record.reng,
          STATUS_LABELS[record.status] || record.status,
        ].filter(Boolean).join(' · ') || undefined}
        columns={viewColumns.filter((c) => c.key !== 'senedler')}
        row={record}
        formatCell={formatCell}
        getRowValue={getRowValue}
        actions={
          <>
            {record.status === 'available' && (
              <Link to={`/depo/${record.id}/satish`} className="btn btn--primary">
                Satış
              </Link>
            )}
            <button type="button" className="btn btn--primary" onClick={() => setEditing(true)}>
              Redaktə
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Silinir…' : 'Sil'}
            </button>
            <Link to="/depo" className="btn btn--secondary">
              Siyahıya qayıt
            </Link>
          </>
        }
      >
        <div style={{ marginTop: 20 }}>
          <SenedlerField
            folder="depo"
            recordId={record.id}
            value={record.senedler}
            onChange={async (next) => {
              const { error: e } = await supabase
                .from(DEPO_TABLE)
                .update({ senedler: next, updated_at: new Date().toISOString() })
                .eq('id', record.id)
              if (e) setError(e.message)
              else {
                setRecord((r) => (r ? { ...r, senedler: next } : r))
                setForm((f) => ({ ...f, senedler: next }))
              }
            }}
          />
        </div>
      </RecordModule>
      </>
    )
  }

  return (
    <div className="card">
      <div className="record-module__header">
        <h2 className="card__title" style={{ margin: 0 }}>
          {isEdit ? 'Depo qeydini redaktə et' : 'Yeni depo qeydi'}
        </h2>
        {isEdit && (
          <div className="record-module__actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setError(null)
                if (record) setForm(rowToForm(record, columns))
                setEditing(false)
              }}
            >
              Baxışa qayıt
            </button>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          {formColumns.filter((c) => c.key !== 'senedler').map((col) => {
            const isYeni = form.veziyyet_cihaz === 'teze'
            const isKohne = form.veziyyet_cihaz === 'kohne'
            return (
              <DynamicField
                key={col.key}
                col={col}
                value={getFieldValue(form, col)}
                onChange={(v) => {
                  setForm((prev) => {
                    let next = setFormField(prev, col, v)
                    if (col.key === 'veziyyet_cihaz') {
                      if (v === 'teze') {
                        next = { ...next, battery_faiz: '100' }
                      } else if (v === 'kohne' && prev.veziyyet_cihaz === 'teze') {
                        next = { ...next, battery_faiz: '' }
                      }
                    }
                    return next
                  })
                  if (v !== '' && v != null) {
                    setInvalidKeys((prev) => {
                      if (!prev.has(col.key)) return prev
                      const next = new Set(prev)
                      next.delete(col.key)
                      return next
                    })
                  }
                }}
                suggestions={suggestions}
                forceReadonly={col.key === 'battery_faiz' && isYeni}
                required={
                  col.key === 'veziyyet_cihaz' ||
                  (form.odenis_novu === 'nisye' &&
                    ['kimden_alinib', 'qaytarma_tarixi', 'alis_qiymeti'].includes(col.key))
                }
                invalid={invalidKeys.has(col.key)}
                hint={
                  col.key === 'veziyyet_cihaz'
                    ? 'Yeni → battery 100%. Köhnə → battery istəyə bağlıdır.'
                    : col.key === 'battery_faiz' && isYeni
                      ? 'Yeni cihaz üçün avtomatik 100%'
                      : col.key === 'battery_faiz' && isKohne
                        ? 'Köhnə cihaz üçün battery istəyə bağlıdır'
                        : null
                }
              />
            )
          })}
        </div>
        <div style={{ marginTop: 16 }}>
          <SenedlerField
            folder="depo"
            recordId={id || null}
            value={form.senedler}
            pendingFiles={pendingFiles}
            onPendingChange={setPendingFiles}
            onChange={async (next) => {
              setForm((f) => ({ ...f, senedler: next }))
              if (!id) return
              const { error: e } = await supabase
                .from(DEPO_TABLE)
                .update({ senedler: next, updated_at: new Date().toISOString() })
                .eq('id', id)
              if (e) setError(e.message)
              else setRecord((r) => (r ? { ...r, senedler: next } : r))
            }}
          />
        </div>
        {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saxlanılır…' : 'Saxla'}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              if (isEdit) {
                if (record) setForm(rowToForm(record, columns))
                setEditing(false)
              } else {
                navigate('/depo')
              }
            }}
          >
            Ləğv et
          </button>
          {isEdit && (
            <button
              type="button"
              className="btn btn--danger"
              disabled={deleting || saving}
              onClick={handleDelete}
            >
              {deleting ? 'Silinir…' : 'Sil'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
