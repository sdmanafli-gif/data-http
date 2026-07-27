import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { useColumnConfig } from './useColumnConfig'
import SuggestInput from '../musteri-bazasi/SuggestInput'
import RecordModule from '../../components/RecordModule'
import SenedlerField from '../../components/SenedlerField'
import {
  NAGD_TABLE,
  SUGGEST_FIELDS,
  emptyNagdForm,
  toNagdPayload,
  rowToForm,
  getFieldValue,
  setFormField,
  formatCell,
  getRowValue,
  formatMoney,
  computeXeyir,
  computeXeyirFaizle,
} from './constants'
import '../musteri-bazasi/musteri-table.css'
import '../../styles/shared.css'
import '../../components/record-module.css'

function DynamicField({ col, value, onChange, suggestions, computedDisplay }) {
  if (col.type === 'files') return null
  if (col.readonly) {
    return (
      <div className="form-group">
        <label>{col.label} (avtomatik)</label>
        <input readOnly value={computedDisplay ?? (value === '' || value == null ? '—' : String(value))} />
      </div>
    )
  }
  if (SUGGEST_FIELDS.has(col.key)) {
    return (
      <SuggestInput
        id={`nagd-${col.key}`}
        label={col.label}
        value={value}
        onChange={onChange}
        options={suggestions?.[col.key] || []}
      />
    )
  }
  const inputType = col.type === 'date' ? 'date' : col.type === 'number' || col.type === 'money' ? 'number' : 'text'
  return (
    <div className="form-group">
      <label>{col.label}</label>
      <input
        type={inputType}
        step={col.type === 'money' || col.type === 'number' ? '0.01' : undefined}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function uniqueSorted(values) {
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'az')
  )
}

export default function NagdForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { columns, loading: colsLoading } = useColumnConfig()
  const [form, setForm] = useState(() => emptyNagdForm())
  const [record, setRecord] = useState(null)
  const [editing, setEditing] = useState(false)
  const [suggestions, setSuggestions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const formColumns = useMemo(
    () => columns.filter((c) => c.formVisible !== false && c.visible !== false && c.key !== 'sira_no'),
    [columns]
  )
  const viewColumns = useMemo(() => columns.filter((c) => c.visible !== false), [columns])

  const preview = useMemo(
    () => ({
      xeyir: formatMoney(computeXeyir(form.alis_qiymeti, form.satis_qiymeti)),
      xeyir_faizle: formatMoney(
        computeXeyirFaizle(form.alis_qiymeti, form.satis_qiymeti, form.satici_faizi)
      ),
    }),
    [form.alis_qiymeti, form.satis_qiymeti, form.satici_faizi]
  )

  useEffect(() => {
    if (colsLoading) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const { data } = await fetchAllPages(() =>
          supabase.from(NAGD_TABLE).select('kime, model, reng, yaddas, kimden_alinib, satici')
        )
        const rows = data || []
        setSuggestions({
          kime: uniqueSorted(rows.map((r) => r.kime)),
          model: uniqueSorted(rows.map((r) => r.model)),
          reng: uniqueSorted(rows.map((r) => r.reng)),
          yaddas: uniqueSorted(rows.map((r) => r.yaddas)),
          kimden_alinib: uniqueSorted(rows.map((r) => r.kimden_alinib)),
          satici: uniqueSorted(rows.map((r) => r.satici)),
        })
        if (isEdit) {
          const { data: row, error: e } = await supabase.from(NAGD_TABLE).select('*').eq('id', id).single()
          if (cancelled) return
          if (e) throw e
          setRecord(row)
          setForm(rowToForm(row, columns))
          setEditing(false)
        } else {
          setRecord(null)
          setForm(emptyNagdForm(columns))
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

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const payload = toNagdPayload(form, columns)
      let err
      let newId = id
      if (isEdit) {
        ;({ error: err } = await supabase.from(NAGD_TABLE).update(payload).eq('id', id))
      } else {
        const { data: created, error: insErr } = await supabase
          .from(NAGD_TABLE)
          .insert(payload)
          .select('id')
          .single()
        err = insErr
        newId = created?.id
      }
      if (err) throw err
      if (isEdit) {
        const { data: refreshed } = await supabase.from(NAGD_TABLE).select('*').eq('id', id).single()
        if (refreshed) {
          setRecord(refreshed)
          setForm(rowToForm(refreshed, columns))
        }
        setEditing(false)
      } else if (newId) {
        navigate(`/nagd-satish/${newId}`)
      } else {
        navigate('/nagd-satish')
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
    return (
      <RecordModule
        title={record.kime || record.model || 'Nağd satış'}
        subtitle={record.tarix ? formatCell(record.tarix, { type: 'date' }) : undefined}
        columns={viewColumns.filter((c) => c.key !== 'senedler')}
        row={record}
        formatCell={formatCell}
        getRowValue={getRowValue}
        actions={
          <>
            <button type="button" className="btn btn--primary" onClick={() => setEditing(true)}>
              Redaktə
            </button>
            <Link to="/nagd-satish" className="btn btn--secondary">Siyahıya qayıt</Link>
          </>
        }
      >
        <div style={{ marginTop: 20 }}>
          <SenedlerField
            folder="nagd_satish"
            recordId={record.id}
            value={record.senedler}
            onChange={async (next) => {
              const { error: e } = await supabase
                .from(NAGD_TABLE)
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
    )
  }

  return (
    <div className="card">
      <div className="record-module__header">
        <h2 className="card__title" style={{ margin: 0 }}>
          {isEdit ? 'Nağd satışı redaktə et' : 'Yeni nağd satış'}
        </h2>
        {isEdit && (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              if (record) setForm(rowToForm(record, columns))
              setEditing(false)
            }}
          >
            Baxışa qayıt
          </button>
        )}
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          {formColumns.filter((c) => c.key !== 'senedler').map((col) => (
            <DynamicField
              key={col.key}
              col={col}
              value={getFieldValue(form, col)}
              onChange={(v) => setForm((prev) => setFormField(prev, col, v))}
              suggestions={suggestions}
              computedDisplay={preview[col.key]}
            />
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <SenedlerField
            folder="nagd_satish"
            recordId={id || null}
            value={form.senedler}
            onChange={async (next) => {
              setForm((f) => ({ ...f, senedler: next }))
              if (!id) return
              const { error: e } = await supabase
                .from(NAGD_TABLE)
                .update({ senedler: next, updated_at: new Date().toISOString() })
                .eq('id', id)
              if (e) setError(e.message)
              else setRecord((r) => (r ? { ...r, senedler: next } : r))
            }}
          />
        </div>
        {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saxlanılır…' : 'Saxla'}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => (isEdit ? setEditing(false) : navigate('/nagd-satish'))}
          >
            Ləğv et
          </button>
        </div>
      </form>
    </div>
  )
}
