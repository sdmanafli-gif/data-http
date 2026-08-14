import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import MusteriSelect from './MusteriSelect'
import RecordModule from '../../components/RecordModule'
import PaymentScheduleList from './PaymentScheduleList'
import MusteriDynamicField from './MusteriDynamicField'
import MusteriNotesAndFiles from './MusteriNotesAndFiles'
import { useColumnConfig } from './useColumnConfig'
import { applyKeyOrder, moveItem } from './columnOrder'
import {
  MUSTERI_TABLE,
  MUSTERILER_TABLE,
  NEW_MUSTERI_VALUE,
  emptyMusteriForm,
  toMusteriPayload,
  toMusterilerPayload,
  personFieldsFromMusteri,
  mergePersonPrefill,
  rowToForm,
  formatMoney,
  formatCell,
  getFieldValue,
  setFormField,
  getRowValue,
  buildMusteriViewSections,
  isMusteriSectionOmittedColumn,
} from './constants'
import { fetchNextMusteriNumbers, fetchNextIcloudNumber, formatIcloudEmail, formatItunesEmail, parseIcloudNumber, isAutoItunesEmail } from './nextRecordNumbers'
import '../../styles/shared.css'
import '../../components/record-module.css'
import './musteri-table.css'
import './musteri-schedule.css'

function uniqueSorted(values) {
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'az')
  )
}

export default function MusteriForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const startInEdit = searchParams.get('edit') === '1'
  const navigate = useNavigate()
  const { columns, loading: colsLoading, saveColumns } = useColumnConfig()

  const [form, setForm] = useState(() => emptyMusteriForm())
  const [record, setRecord] = useState(null)
  const [editing, setEditing] = useState(startInEdit)
  const [customers, setCustomers] = useState([])
  const [suggestions, setSuggestions] = useState({ model: [], reng: [], yaddas: [], satici: [] })
  const [mode, setMode] = useState('pick')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [orderedFormCols, setOrderedFormCols] = useState([])
  const [dragKey, setDragKey] = useState(null)
  const [overKey, setOverKey] = useState(null)

  const formColumns = useMemo(
    () =>
      columns.filter(
        (c) =>
          c.formVisible !== false &&
          c.visible !== false &&
          !isMusteriSectionOmittedColumn(c)
      ),
    [columns]
  )

  const viewColumns = useMemo(
    () => columns.filter((c) => c.visible !== false),
    [columns]
  )

  const viewSections = useMemo(
    () => buildMusteriViewSections(viewColumns),
    [viewColumns]
  )

  useEffect(() => {
    setOrderedFormCols(formColumns)
  }, [formColumns])

  async function loadCustomers() {
    const { data, error: e } = await fetchAllPages(() =>
      supabase.from(MUSTERILER_TABLE).select('*').order('ad_soyad')
    )
    if (e) throw e
    setCustomers(data || [])
  }

  async function loadSuggestions() {
    const { data, error: e } = await fetchAllPages(() =>
      supabase.from(MUSTERI_TABLE).select('model, reng, yaddas, satici')
    )
    if (e) throw e
    const rows = data || []
    setSuggestions({
      model: uniqueSorted(rows.map((r) => r.model)),
      reng: uniqueSorted(rows.map((r) => r.reng)),
      yaddas: uniqueSorted(rows.map((r) => r.yaddas)),
      satici: uniqueSorted(rows.map((r) => r.satici)),
    })
  }

  useEffect(() => {
    if (colsLoading) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        await Promise.all([loadCustomers(), loadSuggestions()])
        if (isEdit) {
          const { data, error: e } = await supabase.from(MUSTERI_TABLE).select('*').eq('id', id).single()
          if (cancelled) return
          if (e) throw e
          setRecord(data)
          setForm(rowToForm(data, columns))
          setMode(data.musteri_id ? 'existing' : 'new')
          setEditing(startInEdit)
        } else {
          setRecord(null)
          setMode('pick')
          const base = emptyMusteriForm(columns)
          try {
            const [next, appleN] = await Promise.all([
              fetchNextMusteriNumbers(),
              fetchNextIcloudNumber(),
            ])
            if (cancelled) return
            setForm({
              ...base,
              sira_no: next.sira_no,
              muqavile_nomresi: next.muqavile_nomresi,
              icloud: formatIcloudEmail(appleN),
              itunes: formatItunesEmail(appleN),
            })
          } catch {
            if (cancelled) return
            setForm(base)
          }
          setEditing(true)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit, colsLoading, startInEdit])

  function setField(col, value) {
    setForm((prev) => {
      let next = setFormField(prev, col, value)
      if (col.key === 'icloud') {
        const newN = parseIcloudNumber(value)
        const oldN = parseIcloudNumber(prev.icloud)
        if (newN != null && (oldN == null || isAutoItunesEmail(prev.itunes, oldN) || !prev.itunes)) {
          next = { ...next, itunes: formatItunesEmail(newN) }
        }
      }
      return next
    })
  }

  async function persistFormOrder(nextFormCols) {
    setOrderedFormCols(nextFormCols)
    const nextAll = applyKeyOrder(columns, nextFormCols.map((c) => c.key))
    try {
      await saveColumns(nextAll)
    } catch (err) {
      setError(err.message)
    }
  }

  function onFieldDragStart(e, key) {
    setDragKey(key)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', key)
  }

  function onFieldDrop(e, targetKey) {
    e.preventDefault()
    const fromKey = dragKey || e.dataTransfer.getData('text/plain')
    setDragKey(null)
    setOverKey(null)
    if (!fromKey || fromKey === targetKey) return
    const keys = orderedFormCols.map((c) => c.key)
    const from = keys.indexOf(fromKey)
    const to = keys.indexOf(targetKey)
    if (from < 0 || to < 0) return
    persistFormOrder(moveItem(orderedFormCols, from, to))
  }

  async function handleSelectExisting(customer) {
    setMode('existing')
    const { data: latest } = await supabase
      .from(MUSTERI_TABLE)
      .select('ad_soyad, nomre_1, nomre_2, nomre_3, nomre_4, nomre_5, zamin')
      .eq('musteri_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const person = mergePersonPrefill(customer, latest)
    setForm((prev) => ({
      ...prev,
      ...person,
    }))
  }

  function handleSelectNew() {
    setMode('new')
    setForm((prev) => ({
      ...prev,
      ...personFieldsFromMusteri(null),
    }))
  }

  const preview = useMemo(() => {
    const alis = Number(form.alis_qiymeti) || 0
    const satis = Number(form.satis_qiymeti) || 0
    const verilib = Number(form.verilib) || 0
    const faiz = Number(form.faiz) || 0
    const saticiFaizi = Number(form.satici_faizi) || 0
    return {
      gozlenilen_gelir: formatMoney(satis - alis - saticiFaizi),
      faktiki_gelir: formatMoney(verilib + faiz - alis - saticiFaizi),
      qalan_borc: formatMoney(satis - verilib),
      faiz: formatMoney(faiz),
    }
  }, [form.alis_qiymeti, form.satis_qiymeti, form.verilib, form.faiz, form.satici_faizi])

  const showPersonFields = mode === 'new' || mode === 'existing'
  const selectValue = mode === 'new' ? NEW_MUSTERI_VALUE : form.musteri_id || ''

  async function ensureMusteriId() {
    const person = toMusterilerPayload(form)
    if (!person.ad_soyad) {
      throw new Error('Ad Soyad Ata adı doldurulmalıdır.')
    }

    if (mode === 'existing' && form.musteri_id) {
      const { error: updErr } = await supabase
        .from(MUSTERILER_TABLE)
        .update(person)
        .eq('id', form.musteri_id)
      if (updErr) throw updErr
      return form.musteri_id
    }

    const { data, error: insErr } = await supabase
      .from(MUSTERILER_TABLE)
      .insert(person)
      .select('id')
      .single()
    if (insErr) throw insErr
    return data.id
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (mode === 'pick') {
      setError('Əvvəlcə müştəri seçin və ya yeni müştəri yaradın.')
      return
    }
    if (!form.ad_soyad?.trim()) {
      setError('Ad Soyad Ata adı doldurulmalıdır.')
      return
    }

    const months = Number(form.nece_ay)
    if (Number.isFinite(months) && months > 0 && !form.birinci_ayliq_odenis_tarixi) {
      setError('Kredit üçün «Birinci aylıq ödəniş tarixi» doldurulmalıdır.')
      return
    }

    setSaving(true)
    try {
      const musteriId = await ensureMusteriId()
      // Faiz stays as stored / 0 until penalty table exists
      const payload = toMusteriPayload(
        { ...form, faiz: form.faiz === '' || form.faiz == null ? '0' : form.faiz },
        musteriId,
        columns
      )
      let err
      let newId = id
      if (isEdit) {
        ;({ error: err } = await supabase.from(MUSTERI_TABLE).update(payload).eq('id', id))
      } else {
        const { data: created, error: insErr } = await supabase
          .from(MUSTERI_TABLE)
          .insert(payload)
          .select('id')
          .single()
        err = insErr
        newId = created?.id
      }
      if (err) throw err
      if (isEdit) {
        const { data: refreshed } = await supabase.from(MUSTERI_TABLE).select('*').eq('id', id).single()
        if (refreshed) {
          setRecord(refreshed)
          setForm(rowToForm(refreshed, columns))
        }
        setEditing(false)
      } else if (newId) {
        navigate(`/musteri-bazasi/${newId}`)
      } else {
        navigate('/musteri-bazasi')
      }
    } catch (err) {
      setError(err?.message ?? 'Saxlanılmadı.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || colsLoading) {
    return (
      <div className="card">
        <p className="empty-state">Yüklənir…</p>
      </div>
    )
  }

  if (isEdit && !editing && record) {
    const title =
      record.ad_soyad ||
      (record.sira_no != null ? `# ${record.sira_no}` : 'Müştəri qeydi')
    return (
      <RecordModule
        title={title}
        subtitle={record.sira_no != null ? `# ${record.sira_no}` : undefined}
        sections={viewSections}
        row={record}
        formatCell={formatCell}
        getRowValue={getRowValue}
        actions={
          <>
            <Link to={`/musteri-bazasi/${record.id}/geri-qaytarma`} className="btn btn--secondary">
              Geri qaytarma
            </Link>
            <button type="button" className="btn btn--primary" onClick={() => setEditing(true)}>
              Redaktə
            </button>
            <Link to="/musteri-bazasi" className="btn btn--secondary">
              Siyahıya qayıt
            </Link>
          </>
        }
      >
        <MusteriNotesAndFiles
          asDetails
          columns={columns}
          form={form}
          onKommentChange={async (v) => {
            setForm((f) => ({ ...f, kommentler: v }))
            const { error: e } = await supabase
              .from(MUSTERI_TABLE)
              .update({ kommentler: v, updated_at: new Date().toISOString() })
              .eq('id', record.id)
            if (e) setError(e.message)
            else setRecord((r) => (r ? { ...r, kommentler: v } : r))
          }}
          senedlerProps={{
            folder: 'musteri_bazasi',
            recordId: record.id,
            value: record.senedler,
            onChange: async (next) => {
              const { error: e } = await supabase
                .from(MUSTERI_TABLE)
                .update({ senedler: next, updated_at: new Date().toISOString() })
                .eq('id', record.id)
              if (e) setError(e.message)
              else {
                setRecord((r) => (r ? { ...r, senedler: next } : r))
                setForm((f) => ({ ...f, senedler: next }))
              }
            },
          }}
        />

        <PaymentScheduleList
          record={record}
          onRecordUpdated={(next) => {
            setRecord(next)
            setForm(rowToForm(next, columns))
          }}
        />
      </RecordModule>
    )
  }

  return (
    <div className="card">
      <div className="record-module__header">
        <h2 className="card__title" style={{ margin: 0 }}>
          {isEdit ? 'Qeydi redaktə et' : 'Yeni qeyd'}
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
      <form onSubmit={handleSubmit}>
        <MusteriSelect
          customers={customers}
          value={selectValue}
          onSelectExisting={handleSelectExisting}
          onSelectNew={handleSelectNew}
          disabled={saving}
        />

        {showPersonFields && (
          <>
            <p className="musteri-form-dnd__hint">
              Sahələri ⋮⋮ tutub yuxarı/aşağı sürükleyin — sıra həm formada, həm cədvəldə saxlanılır.
            </p>
            <div className="musteri-form-dnd">
              {orderedFormCols.map((col) => (
                <div
                  key={col.key}
                  className={[
                    'musteri-form-dnd__item',
                    dragKey === col.key ? 'musteri-form-dnd__item--dragging' : '',
                    overKey === col.key && dragKey !== col.key ? 'musteri-form-dnd__item--over' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (overKey !== col.key) setOverKey(col.key)
                  }}
                  onDrop={(e) => onFieldDrop(e, col.key)}
                  onDragLeave={() => setOverKey((k) => (k === col.key ? null : k))}
                >
                  <span
                    className="musteri-form-dnd__handle"
                    draggable
                    onDragStart={(e) => onFieldDragStart(e, col.key)}
                    onDragEnd={() => {
                      setDragKey(null)
                      setOverKey(null)
                    }}
                    title="Sürükleyib sıranı dəyişin"
                    aria-label="Sürükələ"
                  >
                    ⋮⋮
                  </span>
                  <div className="musteri-form-dnd__body">
                    <MusteriDynamicField
                      col={
                        col.key === 'birinci_ayliq_odenis_tarixi' &&
                        Number(form.nece_ay) > 0
                          ? { ...col, required: true }
                          : col
                      }
                      value={getFieldValue(form, col)}
                      onChange={(v) => setField(col, v)}
                      computedDisplay={preview[col.key]}
                      suggestions={suggestions}
                    />
                  </div>
                </div>
              ))}
            </div>

            <MusteriNotesAndFiles
              columns={columns}
              form={form}
              onKommentChange={(v) => setForm((f) => ({ ...f, kommentler: v }))}
              senedlerProps={{
                folder: 'musteri_bazasi',
                recordId: id || null,
                value: form.senedler,
                onChange: async (next) => {
                  setForm((f) => ({ ...f, senedler: next }))
                  if (!id) return
                  const { error: e } = await supabase
                    .from(MUSTERI_TABLE)
                    .update({ senedler: next, updated_at: new Date().toISOString() })
                    .eq('id', id)
                  if (e) setError(e.message)
                  else setRecord((r) => (r ? { ...r, senedler: next } : r))
                },
              }}
            />
          </>
        )}

        {error && <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
          <button type="submit" className="btn btn--primary" disabled={saving || mode === 'pick'}>
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
                navigate('/musteri-bazasi')
              }
            }}
          >
            Ləğv et
          </button>
        </div>
      </form>
    </div>
  )
}
