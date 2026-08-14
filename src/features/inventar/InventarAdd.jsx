import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SupplierModal from '../../components/SupplierModal'
import SearchableSelect from '../../components/SearchableSelect'
import { REF_NOV, REF_RENG, REF_MEMORY, buildOptions, buildMemoryOptions, getModelsForNov, normalizeColor, normalizeMemory } from '../mehsul-bazasi/referenceOptions'
import { STATUS_OPTIONS, CONDITION_OPTIONS, SOHBE_OPTIONS, SIM_TYPE_OPTIONS, INVENTORY_LABELS } from './constants'
import '../../styles/shared.css'

const emptyInventory = {
  status: 'available',
  type: '',
  model: '',
  color: '',
  condition_type: '',
  battery: '',
  memory: '',
  imei_1: '',
  imei_2: '',
  serial_no: '',
  model_no: '',
  sim_type: '',
  purchase_price: '',
  member: '',
  member_no: '',
  purchase_date: '',
  shift: '',
  payment_due_date: '',
  documents: '',
  user: '',
  comments: '',
  client_number: '',
  return_amount: '',
  quantity: 1,
  supplier_id: '',
  attachments: '',
}

function toInputDate(d) {
  if (!d) return ''
  const x = new Date(d)
  return isNaN(x.getTime()) ? '' : x.toISOString().slice(0, 10)
}

export default function InventarAdd() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [dbData, setDbData] = useState({ types: [], modelByType: {}, colors: [], memories: [] })
  const [selectedProductId, setSelectedProductId] = useState('')
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [newProduct, setNewProduct] = useState({ type: '', model: '', color: '', memory: '' })
  const [form, setForm] = useState(emptyInventory)
  const [suppliers, setSuppliers] = useState([])
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [pendingFiles, setPendingFiles] = useState([])

  const productOptions = useMemo(() => {
    const reng = buildOptions(REF_RENG, dbData.colors.map(normalizeColor).filter(Boolean))
    const memoryOpts = buildMemoryOptions(REF_MEMORY, dbData.memories.map(normalizeMemory).filter(Boolean))
    return {
      nov: buildOptions(REF_NOV, dbData.types),
      model: getModelsForNov(newProduct.type, dbData.modelByType),
      reng,
      memory: memoryOpts,
    }
  }, [newProduct.type, dbData])

  useEffect(() => {
    loadProducts()
    loadSuppliers()
  }, [])

  async function loadSuppliers() {
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(data || [])
  }

  async function loadProducts() {
    const { data } = await supabase
      .from('product_catalogue')
      .select('*')
      .order('type')
      .order('model')
      .order('color')
      .order('memory')
    const list = data || []
    setProducts(list)
    const types = []
    const modelByType = {}
    const colors = []
    const memories = []
    list.forEach((r) => {
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

  function applyProduct(p) {
    if (!p) return
    setForm((prev) => ({
      ...prev,
      type: p.type || '',
      model: p.model || '',
      color: p.color || '',
      memory: p.memory || '',
    }))
  }

  function onSelectProduct(id) {
    setSelectedProductId(id === '__new__' ? '' : id)
    setShowNewProduct(id === '__new__')
    if (id === '__new__') {
      setNewProduct({ type: '', model: '', color: '', memory: '' })
      setForm((prev) => ({ ...prev, type: '', model: '', color: '', memory: '' }))
    } else if (!id) {
      setForm((prev) => ({ ...prev, type: '', model: '', color: '', memory: '' }))
    } else {
      const p = products.find((x) => x.id === id)
      applyProduct(p)
    }
  }

  const catalogueSelectOptions = useMemo(
    () => [
      {
        value: '__new__',
        label: '+ Yeni məhsul əlavə et',
        keywords: 'yeni mehsul elave et new',
      },
      ...products.map((p) => ({
        value: p.id,
        label: `${p.type} · ${p.model} · ${p.color} · ${p.memory}`,
        keywords: [p.type, p.model, p.color, p.memory].filter(Boolean).join(' '),
      })),
    ],
    [products]
  )

  const supplierSelectOptions = useMemo(
    () =>
      suppliers.map((s) => ({
        value: s.id,
        label: s.name || '—',
        keywords: s.name || '',
      })),
    [suppliers]
  )

  function updateNewProduct(field, value) {
    setNewProduct((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'type') next.model = ''
      return next
    })
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'type' ? { model: '' } : {}),
    }))
  }

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    let productId = selectedProductId
    if (showNewProduct) {
      const { type, model, color, memory } = newProduct
      if (!type?.trim() || !model?.trim() || !color?.trim() || !memory?.trim()) {
        setError('Yeni məhsul üçün Növ, Model, Rəng və Yaddaş doldurulmalıdır.')
        return
      }
      const typeT = type.trim()
      const modelT = model.trim()
      const colorT = normalizeColor(color)
      const memoryT = normalizeMemory(memory)
      const { data: inserted, error: insertErr } = await supabase
        .from('product_catalogue')
        .insert({ type: typeT, model: modelT, color: colorT, memory: memoryT })
        .select('id')
        .single()
      if (insertErr) {
        if (insertErr.code === '23505') setError('Bu məhsul kombinasiyası artıq kataloqda var. Siyahıdan seçin.')
        else setError(insertErr.message)
        return
      }
      productId = inserted.id
    }

    const row = {
      product_id: productId || null,
      supplier_id: form.supplier_id || null,
      quantity: Math.max(0, Number(form.quantity) || 1),
      status: form.status,
      type: form.type?.trim() || null,
      model: form.model?.trim() || null,
      color: normalizeColor(form.color) || form.color?.trim() || null,
      condition_type: form.condition_type || null,
      battery: form.battery?.trim() || null,
      memory: normalizeMemory(form.memory) || form.memory?.trim() || null,
      imei_1: form.imei_1?.trim() || null,
      imei_2: form.imei_2?.trim() || null,
      serial_no: form.serial_no?.trim() || null,
      model_no: form.model_no?.trim() || null,
      sim_type: form.sim_type || null,
      purchase_price: form.purchase_price !== '' ? Number(form.purchase_price) : null,
      member: form.member?.trim() || null,
      member_no: form.member_no?.trim() || null,
      purchase_date: form.purchase_date || null,
      shift: form.shift || null,
      payment_due_date: form.payment_due_date || null,
      documents: form.documents?.trim() || null,
      user: form.user?.trim() || null,
      comments: form.comments?.trim() || null,
      client_number: form.client_number?.trim() || null,
      return_amount: form.return_amount !== '' ? Number(form.return_amount) : null,
    }

    setSaving(true)
    const { data, error: insertErr } = await supabase.from('inventory').insert(row).select('id').single()
    if (insertErr) {
      setSaving(false)
      setError(insertErr.message)
      return
    }
    if (pendingFiles.length > 0) {
      const bucket = 'Mobideal'
      const uploaded = []
      let lastStorageError = null
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i]
        const path = `inventory/${data.id}/${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: false })
        if (upErr) {
          lastStorageError = upErr.message
          if (uploaded.length === 0 && i === 0) {
            setSaving(false)
            setError(`Fayl yüklənə bilmədi: ${upErr.message}. Storage-da "Mobideal" bucket yaradılıb və 00007_storage_mobideal_policies.sql işlədilib?`)
            return
          }
        } else {
          uploaded.push({ name: file.name, path })
        }
      }
      if (uploaded.length > 0) {
        const attachmentsJson = JSON.stringify(uploaded)
        const { error: updateErr } = await supabase.from('inventory').update({ attachments: attachmentsJson }).eq('id', data.id)
        if (updateErr) {
          setSaving(false)
          setError(`Fayllar yükləndi amma sətir yenilənə bilmədi: ${updateErr.message}`)
          return
        }
      }
      if (lastStorageError && uploaded.length < pendingFiles.length) {
        setSaving(false)
        setError(`${uploaded.length} fayl yükləndi, ${pendingFiles.length - uploaded.length} uğursuz: ${lastStorageError}`)
        return
      }
    }
    setSaving(false)
    navigate(`/inventar/${data.id}`)
  }

  return (
    <div className="card">
      <h2 className="card__title">İnventara əlavə et</h2>
      <p style={{ margin: '0 0 var(--space-lg) 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
        Əvvəlcə məhsulu kataloqdan seçin və ya yeni məhsul əlavə edin (Növ, Model, Rəng, Yaddaş). Sonra qalan sahələri doldurun.
      </p>

      <SearchableSelect
        id="inventar-product"
        label="Məhsul (kataloqdan)"
        options={catalogueSelectOptions}
        value={showNewProduct ? '__new__' : selectedProductId}
        onChange={onSelectProduct}
        placeholder="Növ, model, rəng, yaddaş ilə axtar…"
        emptyOption={{ value: '', label: '— Seçin —' }}
      />

      {showNewProduct && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)' }}>
          <div className="card__title">Yeni məhsul (kataloqa əlavə olunacaq)</div>
          <p style={{ margin: '0 0 var(--space-md) 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
            Siyahıdan seçin və ya özünüz yazın.
          </p>
          <div className="form-row">
            <div className="form-group">
              <label>Növ</label>
              <input
                list="inventar-nov"
                value={newProduct.type}
                onChange={(e) => updateNewProduct('type', e.target.value)}
                placeholder="Seçin və ya yazın..."
                autoComplete="off"
              />
              <datalist id="inventar-nov">
                {productOptions.nov.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
            <div className="form-group">
              <label>Model</label>
              <input
                list="inventar-model"
                value={newProduct.model}
                onChange={(e) => updateNewProduct('model', e.target.value)}
                placeholder="Seçin və ya yazın..."
                autoComplete="off"
              />
              <datalist id="inventar-model">
                {productOptions.model.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
            <div className="form-group">
              <label>Rəng</label>
              <input
                list="inventar-reng"
                value={newProduct.color}
                onChange={(e) => updateNewProduct('color', e.target.value)}
                placeholder="Seçin və ya yazın..."
                autoComplete="off"
              />
              <datalist id="inventar-reng">
                {productOptions.reng.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
            <div className="form-group">
              <label>Yaddaş</label>
              <input
                list="inventar-memory"
                value={newProduct.memory}
                onChange={(e) => updateNewProduct('memory', e.target.value)}
                placeholder="Seçin və ya yazın..."
                autoComplete="off"
              />
              <datalist id="inventar-memory">
                {productOptions.memory.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card__title">İnventar məlumatları</div>

        <div className="form-row">
          <div className="form-group">
            <label>{INVENTORY_LABELS.quantity}</label>
            <input type="number" min={0} value={form.quantity} onChange={(e) => updateForm('quantity', e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, maxWidth: 360 }}>
                <SearchableSelect
                  id="inventar-supplier"
                  label={INVENTORY_LABELS.supplier_id}
                  options={supplierSelectOptions}
                  value={form.supplier_id}
                  onChange={(v) => updateForm('supplier_id', v)}
                  placeholder="Təchizatçı axtar…"
                  emptyOption={{ value: '', label: '— Seçin —' }}
                />
              </div>
              <button type="button" className="btn btn--secondary" onClick={() => setShowSupplierModal(true)}>
                Yeni təchizatçı
              </button>
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{INVENTORY_LABELS.status}</label>
            <select value={form.status} onChange={(e) => updateForm('status', e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{INVENTORY_LABELS.condition_type}</label>
            <select value={form.condition_type} onChange={(e) => updateForm('condition_type', e.target.value)}>
              <option value="">—</option>
              {CONDITION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{INVENTORY_LABELS.shift}</label>
            <select value={form.shift} onChange={(e) => updateForm('shift', e.target.value)}>
              {SOHBE_OPTIONS.map((o) => (
                <option key={o.value || '_'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Növ</label>
            <input value={form.type} onChange={(e) => updateForm('type', e.target.value)} readOnly={!showNewProduct} />
          </div>
          <div className="form-group">
            <label>Model</label>
            <input value={form.model} onChange={(e) => updateForm('model', e.target.value)} readOnly={!showNewProduct} />
          </div>
          <div className="form-group">
            <label>Rəng</label>
            <input value={form.color} onChange={(e) => updateForm('color', e.target.value)} readOnly={!showNewProduct} />
          </div>
          <div className="form-group">
            <label>Memory</label>
            <input value={form.memory} onChange={(e) => updateForm('memory', e.target.value)} readOnly={!showNewProduct} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{INVENTORY_LABELS.battery}</label>
            <input value={form.battery} onChange={(e) => updateForm('battery', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{INVENTORY_LABELS.sim_type}</label>
            <select value={form.sim_type} onChange={(e) => updateForm('sim_type', e.target.value)}>
              {SIM_TYPE_OPTIONS.map((o) => (
                <option key={o.value || '_'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{INVENTORY_LABELS.imei_1}</label>
            <input value={form.imei_1} onChange={(e) => updateForm('imei_1', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{INVENTORY_LABELS.imei_2}</label>
            <input value={form.imei_2} onChange={(e) => updateForm('imei_2', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{INVENTORY_LABELS.serial_no}</label>
            <input value={form.serial_no} onChange={(e) => updateForm('serial_no', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{INVENTORY_LABELS.model_no}</label>
            <input value={form.model_no} onChange={(e) => updateForm('model_no', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{INVENTORY_LABELS.purchase_price}</label>
            <input type="number" step="0.01" value={form.purchase_price} onChange={(e) => updateForm('purchase_price', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{INVENTORY_LABELS.member}</label>
            <input value={form.member} onChange={(e) => updateForm('member', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{INVENTORY_LABELS.member_no}</label>
            <input value={form.member_no} onChange={(e) => updateForm('member_no', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{INVENTORY_LABELS.purchase_date}</label>
            <input type="date" value={form.purchase_date} onChange={(e) => updateForm('purchase_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{INVENTORY_LABELS.payment_due_date}</label>
            <input type="date" value={form.payment_due_date} onChange={(e) => updateForm('payment_due_date', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{INVENTORY_LABELS.user}</label>
            <input value={form.user} onChange={(e) => updateForm('user', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{INVENTORY_LABELS.client_number}</label>
            <input value={form.client_number} onChange={(e) => updateForm('client_number', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{INVENTORY_LABELS.return_amount}</label>
            <input type="number" step="0.01" value={form.return_amount} onChange={(e) => updateForm('return_amount', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>{INVENTORY_LABELS.documents}</label>
          <textarea value={form.documents} onChange={(e) => updateForm('documents', e.target.value)} />
        </div>
        <div className="form-group">
          <label>{INVENTORY_LABELS.attachments}</label>
          <input
            type="file"
            multiple
            onChange={(e) => setPendingFiles((prev) => [...prev, ...(e.target.files ? Array.from(e.target.files) : [])])}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
          />
          {pendingFiles.length > 0 && (
            <p style={{ marginTop: 4, fontSize: 13, color: 'var(--color-text-muted)' }}>
              {pendingFiles.length} fayl seçildi. Saxlandıqdan sonra Storage (Mobideal) əlavə olunacaq.
            </p>
          )}
        </div>
        <div className="form-group">
          <label>{INVENTORY_LABELS.comments}</label>
          <textarea value={form.comments} onChange={(e) => updateForm('comments', e.target.value)} />
        </div>

        {error && <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saxlanılır…' : 'Əlavə et'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => navigate('/inventar')}>
            Ləğv et
          </button>
        </div>
      </form>

      {showSupplierModal && (
        <SupplierModal
          onClose={() => setShowSupplierModal(false)}
          onSaved={async (newSupplier) => {
            await loadSuppliers()
            updateForm('supplier_id', newSupplier.id)
            setShowSupplierModal(false)
          }}
        />
      )}
    </div>
  )
}
