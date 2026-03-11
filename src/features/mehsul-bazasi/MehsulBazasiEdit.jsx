import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { REF_NOV, REF_RENG, REF_MEMORY, buildOptions, buildMemoryOptions, getModelsForNov, normalizeColor, normalizeMemory } from './referenceOptions'
import '../../styles/shared.css'

export default function MehsulBazasiEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ type: '', model: '', color: '', memory: '' })
  const [dbData, setDbData] = useState({ types: [], modelByType: {}, colors: [], memories: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return
    load()
    loadOptions()
  }, [id])

  async function loadOptions() {
    const { data: rows } = await supabase.from('product_catalogue').select('type, model, color, memory')
    const types = []
    const modelByType = {}
    const colors = []
    const memories = []
    ;(rows || []).forEach((r) => {
      if (r.type) {
        if (!types.includes(r.type)) types.push(r.type)
        if (!modelByType[r.type]) modelByType[r.type] = []
        if (r.model && !modelByType[r.type].includes(r.model)) modelByType[r.type].push(r.model)
      }
      if (r.color) colors.push(r.color)
      if (r.memory) memories.push(r.memory)
    })
    setDbData({ types, modelByType, colors, memories })
  }

  async function load() {
    setLoading(true)
    const { data, error: e } = await supabase.from('product_catalogue').select('*').eq('id', id).single()
    setLoading(false)
    if (e) {
      setError(e.message)
      return
    }
    setForm({
      type: data?.type ?? '',
      model: data?.model ?? '',
      color: data?.color ?? '',
      memory: data?.memory ?? '',
    })
  }

  const options = useMemo(() => {
    const reng = buildOptions(REF_RENG, dbData.colors.map(normalizeColor).filter(Boolean))
    const memoryOpts = buildMemoryOptions(REF_MEMORY, dbData.memories.map(normalizeMemory).filter(Boolean))
    return {
      nov: buildOptions(REF_NOV, dbData.types),
      model: getModelsForNov(form.type, dbData.modelByType),
      reng,
      memory: memoryOpts,
    }
  }, [form.type, dbData])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field === 'type') setForm((prev) => ({ ...prev, model: '' }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const t = form.type?.trim()
    const m = form.model?.trim()
    const c = normalizeColor(form.color) || form.color?.trim()
    const mem = normalizeMemory(form.memory) || form.memory?.trim()
    if (!t || !m || !c || !mem) {
      setError('Növ, Model, Rəng və Yaddaş doldurulmalıdır.')
      return
    }
    setSaving(true)
    const { error: err } = await supabase
      .from('product_catalogue')
      .update({ type: t, model: m, color: c, memory: mem })
      .eq('id', id)
    setSaving(false)
    if (err) {
      if (err.code === '23505') setError('Bu kombinasiya (Növ, Model, Rəng, Yaddaş) artıq mövcuddur.')
      else setError(err.message)
      return
    }
    navigate('/mehsul-bazasi')
  }

  if (loading) return <p className="empty-state">Yüklənir…</p>
  if (error && !form.type && !form.model) return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>

  return (
    <div className="card list-card">
      <h2 className="card__title">Məhsul — redaktə</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Növ</label>
            <input list="mehsul-edit-nov" value={form.type} onChange={(e) => update('type', e.target.value)} placeholder="Seçin və ya yazın" autoComplete="off" />
            <datalist id="mehsul-edit-nov">{options.nov.map((v) => <option key={v} value={v} />)}</datalist>
          </div>
          <div className="form-group">
            <label>Model</label>
            <input list="mehsul-edit-model" value={form.model} onChange={(e) => update('model', e.target.value)} placeholder="Seçin və ya yazın" autoComplete="off" />
            <datalist id="mehsul-edit-model">{options.model.map((v) => <option key={v} value={v} />)}</datalist>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Rəng</label>
            <input list="mehsul-edit-reng" value={form.color} onChange={(e) => update('color', e.target.value)} placeholder="Seçin və ya yazın" autoComplete="off" />
            <datalist id="mehsul-edit-reng">{options.reng.map((v) => <option key={v} value={v} />)}</datalist>
          </div>
          <div className="form-group">
            <label>Yaddaş</label>
            <input list="mehsul-edit-memory" value={form.memory} onChange={(e) => update('memory', e.target.value)} placeholder="Seçin və ya yazın" autoComplete="off" />
            <datalist id="mehsul-edit-memory">{options.memory.map((v) => <option key={v} value={v} />)}</datalist>
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saxlanılır…' : 'Saxla'}</button>
          <button type="button" className="btn btn--secondary" onClick={() => navigate('/mehsul-bazasi')}>Ləğv et</button>
        </div>
      </form>
    </div>
  )
}
