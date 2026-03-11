import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { REF_NOV, REF_RENG, REF_MEMORY, buildOptions, buildMemoryOptions, getModelsForNov, normalizeColor, normalizeMemory } from './referenceOptions'
import '../../styles/shared.css'

export default function MehsulBazasiAdd() {
  const navigate = useNavigate()
  const [type, setType] = useState('')
  const [model, setModel] = useState('')
  const [color, setColor] = useState('')
  const [memory, setMemory] = useState('')
  const [dbData, setDbData] = useState({ types: [], modelByType: {}, colors: [], memories: [] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadOptions()
  }, [])

  async function loadOptions() {
    const { data: rows } = await supabase
      .from('product_catalogue')
      .select('type, model, color, memory')
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

  const options = useMemo(() => {
    const reng = buildOptions(REF_RENG, dbData.colors.map(normalizeColor).filter(Boolean))
    const memoryOpts = buildMemoryOptions(REF_MEMORY, dbData.memories.map(normalizeMemory).filter(Boolean))
    return {
      nov: buildOptions(REF_NOV, dbData.types),
      model: getModelsForNov(type, dbData.modelByType),
      reng,
      memory: memoryOpts,
    }
  }, [type, dbData])

  function onTypeChange(nextType) {
    setType(nextType)
    setModel('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const t = type.trim()
    const m = model.trim()
    const c = normalizeColor(color)
    const mem = normalizeMemory(memory)
    if (!t || !m || !c || !mem) {
      setError('Növ, Model, Rəng və Yaddaş doldurulmalıdır.')
      return
    }
    setSaving(true)
    try {
      const { data, error: e2 } = await supabase
        .from('product_catalogue')
        .insert({ type: t, model: m, color: c, memory: mem })
        .select('id')
        .single()
      setSaving(false)
      if (e2) {
        if (e2.code === '23505') setError('Bu kombinasiya (Növ, Model, Rəng, Yaddaş) artıq mövcuddur.')
        else if ((e2.message || '').toLowerCase().includes('fetch')) setError('Şəbəkə xətası. Supabase layihəsinin aktiv olduğunu və .env-i yoxlayın; dev serveri yenidən başladın.')
        else setError(e2.message)
        return
      }
      navigate('/mehsul-bazasi')
    } catch (err) {
      setSaving(false)
      const msg = err?.message || String(err)
      if (msg.includes('fetch') || msg.includes('Network')) {
        setError('Şəbəkə xətası. Supabase layihəsinin aktiv olduğunu, .env-in düzgün olduğunu yoxlayın və dev serveri yenidən başladın. (docs/SUPABASE_SETUP.md)')
      } else {
        setError(msg)
      }
    }
  }

  return (
    <div className="card">
      <h2 className="card__title">Yeni məhsul (kataloq)</h2>
      <p style={{ margin: '0 0 var(--space-md) 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
        Siyahıdan seçin və ya özünüz yazın. Növ, Model, Rəng, Yaddaş — hər biri üçün seçim və ya sərbəst mətn.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Növ</label>
            <input
              list="mehsul-nov"
              value={type}
              onChange={(e) => onTypeChange(e.target.value)}
              placeholder="Seçin və ya yazın..."
              autoComplete="off"
            />
            <datalist id="mehsul-nov">
              {options.nov.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
          <div className="form-group">
            <label>Model</label>
            <input
              list="mehsul-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Seçin və ya yazın..."
              autoComplete="off"
            />
            <datalist id="mehsul-model">
              {options.model.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Rəng</label>
            <input
              list="mehsul-reng"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Seçin və ya yazın..."
              autoComplete="off"
            />
            <datalist id="mehsul-reng">
              {options.reng.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
          <div className="form-group">
            <label>Yaddaş</label>
            <input
              list="mehsul-memory"
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
              placeholder="Seçin və ya yazın..."
              autoComplete="off"
            />
            <datalist id="mehsul-memory">
              {options.memory.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
        </div>
        {error && <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saxlanılır…' : 'Əlavə et'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => navigate('/mehsul-bazasi')}>
            Ləğv et
          </button>
        </div>
      </form>
    </div>
  )
}
