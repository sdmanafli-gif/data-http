import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { confirmDelete } from '../../lib/confirmDelete'
import SuggestInput from '../musteri-bazasi/SuggestInput'
import RecordModule from '../../components/RecordModule'
import SenedlerField from '../../components/SenedlerField'
import {
  LEDGER_TABLE,
  ENTRY_TYPES,
  DEFAULT_COLUMNS,
  emptyLedgerForm,
  toLedgerPayload,
  rowToForm,
  formatCell,
  getRowValue,
  tipLabel,
  counterpartPath,
} from './constants'
import '../musteri-bazasi/musteri-table.css'
import '../../styles/shared.css'
import '../../components/record-module.css'

function uniqueSorted(values) {
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'az')
  )
}

export default function LedgerForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { access } = useAuth()
  const prefKime = searchParams.get('kime') || ''
  const startInEdit = searchParams.get('edit') === '1'
  const [form, setForm] = useState(() => ({ ...emptyLedgerForm(), kime: prefKime }))
  const [record, setRecord] = useState(null)
  const [editing, setEditing] = useState(!isEdit || startInEdit)
  const [names, setNames] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  const viewColumns = useMemo(
    () =>
      access
        .filterColumns('borc-nisye', DEFAULT_COLUMNS)
        .filter((c) => c.visible !== false),
    [access]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await fetchAllPages(() =>
        supabase.from(LEDGER_TABLE).select('kime')
      )
      if (cancelled) return
      setNames(uniqueSorted((data || []).map((r) => r.kime)))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isEdit) {
      setForm({ ...emptyLedgerForm(), kime: prefKime })
      setRecord(null)
      setEditing(true)
      setLoading(false)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error: e } = await supabase.from(LEDGER_TABLE).select('*').eq('id', id).single()
      if (cancelled) return
      if (e) {
        setError(e.message)
        setRecord(null)
      } else {
        setRecord(data)
        setForm(rowToForm(data))
        setEditing(startInEdit)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, isEdit, prefKime, startInEdit])

  async function onDelete() {
    if (!id || !record) return
    if (!confirmDelete('Bu əməliyyat silinsin?')) return
    setDeleting(true)
    setError(null)
    try {
      const { error: err } = await supabase.from(LEDGER_TABLE).delete().eq('id', id)
      if (err) throw err
      navigate(counterpartPath(record.kime || prefKime))
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }
  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    const payload = toLedgerPayload(form)
    if (!payload.kime) {
      setError('Kimə mütləqdir.')
      return
    }
    if (!payload.tip) {
      setError('Əməliyyat seçin.')
      return
    }
    if (payload.mebleg == null || payload.mebleg < 0) {
      setError('Məbləğ düzgün deyil.')
      return
    }
    if (Number(payload.mebleg) === 0 && !payload.qeyd && !payload.mehsul) {
      setError('Məbləğ 0 olduqda Qeyd və ya Məhsul yazın.')
      return
    }
    if (payload.tip === 'qeyd' && !payload.qeyd && !payload.mehsul) {
      setError('Qeyd tipi üçün şərh yazın.')
      return
    }
    setSaving(true)
    try {
      let err
      let newId = id
      if (isEdit) {
        ;({ error: err } = await supabase.from(LEDGER_TABLE).update(payload).eq('id', id))
      } else {
        const { data: created, error: insErr } = await supabase
          .from(LEDGER_TABLE)
          .insert(payload)
          .select('id')
          .single()
        err = insErr
        newId = created?.id
      }
      if (err) throw err
      if (isEdit) {
        navigate(counterpartPath(payload.kime))
      } else if (newId) {
        navigate(`/borc-nisye/qeyd/${newId}`)
      } else {
        navigate(counterpartPath(payload.kime))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="empty-state">Yüklənir…</p>

  if (isEdit && !editing && record) {
    return (
      <RecordModule
        title={record.kime || 'Qeyd'}
        subtitle={`${tipLabel(record.tip)} · ${formatCell(record.mebleg, { type: 'money' })}`}
        columns={viewColumns.filter((c) => c.key !== 'senedler')}
        row={record}
        formatCell={formatCell}
        getRowValue={getRowValue}
        actions={
          <>
            <button type="button" className="btn btn--primary" onClick={() => setEditing(true)}>
              Redaktə
            </button>
            <button type="button" className="btn btn--danger" disabled={deleting} onClick={onDelete}>
              {deleting ? 'Silinir…' : 'Sil'}
            </button>
            <Link to={counterpartPath(record.kime)} className="btn btn--secondary">
              Kontragentə qayıt
            </Link>
          </>
        }
      >
        <div style={{ marginTop: 20 }}>
          <SenedlerField
            folder="borc_nisye"
            recordId={record.id}
            value={record.senedler}
            onChange={async (next) => {
              const { error: e } = await supabase
                .from(LEDGER_TABLE)
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
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2 className="card__title" style={{ margin: 0 }}>
          {isEdit ? 'Əməliyyatı redaktə et' : 'Yeni əməliyyat'}
        </h2>
        <Link to="/borc-nisye" className="btn btn--secondary">Geri</Link>
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      <form onSubmit={onSubmit} className="form-grid" style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
        <SuggestInput
          id="ledger-kime"
          label="Kimə"
          value={form.kime}
          onChange={(v) => setForm((f) => ({ ...f, kime: v }))}
          options={names}
        />

        <div className="form-group">
          <label>Tarix</label>
          <input
            type="date"
            value={form.tarix || ''}
            onChange={(e) => setForm((f) => ({ ...f, tarix: e.target.value }))}
          />
        </div>

        <div className="form-group">
          <label>Qaytarma / ödəniş tarixi</label>
          <input
            type="date"
            value={form.qaytarma_tarixi || ''}
            onChange={(e) => setForm((f) => ({ ...f, qaytarma_tarixi: e.target.value }))}
          />
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
            Borc/nisyə verdinizdə — nə vaxt alınacaq; borc aldıqda — nə vaxt ödəyəcəksiniz
          </p>
        </div>

        <div className="form-group">
          <label>Əməliyyat</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {ENTRY_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`btn ${form.tip === t.value ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setForm((f) => ({ ...f, tip: t.value }))}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Məbləğ (boş = 0, yalnız qeyd üçün)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.mebleg}
            onChange={(e) => setForm((f) => ({ ...f, mebleg: e.target.value }))}
            placeholder="0"
          />
        </div>

        <div className="form-group">
          <label>Məhsul</label>
          <input
            value={form.mehsul}
            onChange={(e) => setForm((f) => ({ ...f, mehsul: e.target.value }))}
            placeholder="Telefon, PlayStation…"
          />
        </div>
        <div className="form-group">
          <label>IMEI 1</label>
          <input value={form.imei_1} onChange={(e) => setForm((f) => ({ ...f, imei_1: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>IMEI 2</label>
          <input value={form.imei_2} onChange={(e) => setForm((f) => ({ ...f, imei_2: e.target.value }))} />
        </div>

        <div className="form-group">
          <label>Qeyd</label>
          <textarea
            rows={3}
            value={form.qeyd}
            onChange={(e) => setForm((f) => ({ ...f, qeyd: e.target.value }))}
          />
        </div>

        <SenedlerField
          folder="borc_nisye"
          recordId={id || null}
          value={form.senedler}
          onChange={async (next) => {
            setForm((f) => ({ ...f, senedler: next }))
            if (!id) return
            const { error: e } = await supabase
              .from(LEDGER_TABLE)
              .update({ senedler: next, updated_at: new Date().toISOString() })
              .eq('id', id)
            if (e) setError(e.message)
            else setRecord((r) => (r ? { ...r, senedler: next } : r))
          }}
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saxlanılır…' : 'Saxla'}
          </button>
          {isEdit && (
            <>
              <button type="button" className="btn btn--secondary" onClick={() => setEditing(false)}>
                Ləğv et
              </button>
              <button type="button" className="btn btn--danger" disabled={deleting} onClick={onDelete}>
                {deleting ? 'Silinir…' : 'Sil'}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
