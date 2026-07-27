import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { confirmDelete } from '../../lib/confirmDelete'
import SupplierModal from '../../components/SupplierModal'
import { STATUS_OPTIONS, CONDITION_OPTIONS, SOHBE_OPTIONS, SIM_TYPE_OPTIONS, INVENTORY_LABELS } from './constants'
import '../../styles/shared.css'

function toInputDate(d) {
  if (!d) return ''
  const x = new Date(d)
  return isNaN(x.getTime()) ? '' : x.toISOString().slice(0, 10)
}

export default function InventarEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [pendingFiles, setPendingFiles] = useState([])

  useEffect(() => {
    if (!id) return
    load()
    loadSuppliers()
  }, [id])

  async function loadSuppliers() {
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(data || [])
  }

  async function load() {
    setLoading(true)
    const { data, error: e } = await supabase.from('inventory').select('*').eq('id', id).single()
    setLoading(false)
    if (e) {
      setError(e.message)
      setForm(null)
      return
    }
    setForm({
      ...data,
      purchase_price: data.purchase_price != null ? data.purchase_price : '',
      return_amount: data.return_amount != null ? data.return_amount : '',
      quantity: data.quantity ?? 1,
      purchase_date: toInputDate(data.purchase_date),
      payment_due_date: toInputDate(data.payment_due_date),
      comments_device: data.comments_device ?? '',
    })
  }

  function updateForm(field, value) {
    setForm((prev) => (prev ? { ...prev, [field]: value } : null))
  }

  async function removeAttachment(idx) {
    if (!form || !id) return
    let list = []
    try {
      if (form.attachments) list = JSON.parse(form.attachments)
    } catch (_) {}
    if (!Array.isArray(list) || idx < 0 || idx >= list.length) return
    const item = list[idx]
    if (!confirmDelete(`«${item?.name || 'Fayl'}» silinsin?`)) return
    await supabase.storage.from('Mobideal').remove([item.path])
    const newList = list.filter((_, i) => i !== idx)
    const attachmentsJson = newList.length > 0 ? JSON.stringify(newList) : null
    const { error: err } = await supabase.from('inventory').update({ attachments: attachmentsJson, updated_at: new Date().toISOString() }).eq('id', id)
    if (err) setError(err.message)
    else updateForm('attachments', attachmentsJson || '')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form) return
    setError(null)
    const row = {
      quantity: Math.max(0, Number(form.quantity) || 1),
      supplier_id: form.supplier_id || null,
      status: form.status,
      type: form.type?.trim() || null,
      model: form.model?.trim() || null,
      color: form.color?.trim() || null,
      condition_type: form.condition_type || null,
      battery: form.battery?.trim() || null,
      memory: form.memory?.trim() || null,
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
      comments_device: form.comments_device?.trim() || null,
      client_number: form.client_number?.trim() || null,
      return_amount: form.return_amount !== '' ? Number(form.return_amount) : null,
      updated_at: new Date().toISOString(),
    }
    let attachmentsList = []
    try {
      if (form.attachments) attachmentsList = JSON.parse(form.attachments)
    } catch (_) {}
    if (!Array.isArray(attachmentsList)) attachmentsList = []
    if (pendingFiles.length > 0) {
      const bucket = 'Mobideal'
      let storageError = null
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i]
        const path = `inventory/${id}/${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: false })
        if (upErr) {
          storageError = upErr.message
          break
        }
        attachmentsList.push({ name: file.name, path })
      }
      if (storageError) {
        setError(`Fayl yüklənə bilmədi: ${storageError}. Storage-da "Mobideal" bucket və policy (00007) yoxlayın.`)
        return
      }
      row.attachments = JSON.stringify(attachmentsList)
    }
    setSaving(true)
    const { error: err } = await supabase.from('inventory').update(row).eq('id', id)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    navigate(`/inventar/${id}`)
  }

  if (loading) return <p className="empty-state">Yüklənir…</p>
  if (error && !form) return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>
  if (!form) return null

  const attachmentList = (() => {
    try {
      return form.attachments ? JSON.parse(form.attachments) : []
    } catch (_) {
      return []
    }
  })()

  return (
    <div className="card list-card edit-page">
      <h2 className="card__title">İnventar — redaktə</h2>
      <p className="edit-page-desc">Sahələri kateqoriyalara görə düzülüb; hər bloku açıb bağlaya bilərsiniz.</p>
      <form onSubmit={handleSubmit}>
        <details className="collapse-section" open>
          <summary className="collapse-section__title">Vəziyyət və alış növü</summary>
          <div className="collapse-section__body">
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
                <label>{INVENTORY_LABELS.quantity}</label>
                <input type="number" min={0} value={form.quantity} onChange={(e) => updateForm('quantity', e.target.value)} />
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
              <div className="form-group" style={{ flex: 2 }}>
                <label>{INVENTORY_LABELS.supplier_id}</label>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <select value={form.supplier_id || ''} onChange={(e) => updateForm('supplier_id', e.target.value)} style={{ flex: 1, maxWidth: 320 }}>
                    <option value="">— Seçin —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn--secondary" onClick={() => setShowSupplierModal(true)}>Yeni təchizatçı</button>
                </div>
              </div>
            </div>
          </div>
        </details>

        <details className="collapse-section">
          <summary className="collapse-section__title">Məhsul məlumatları</summary>
          <div className="collapse-section__body">
            <div className="form-row">
              <div className="form-group">
                <label>Növ</label>
                <input value={form.type} onChange={(e) => updateForm('type', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Model</label>
                <input value={form.model} onChange={(e) => updateForm('model', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Rəng</label>
                <input value={form.color} onChange={(e) => updateForm('color', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Yaddaş</label>
                <input value={form.memory} onChange={(e) => updateForm('memory', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{INVENTORY_LABELS.condition_type}</label>
                <select value={form.condition_type || ''} onChange={(e) => updateForm('condition_type', e.target.value)}>
                  <option value="">—</option>
                  {CONDITION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{INVENTORY_LABELS.battery}</label>
                <input value={form.battery} onChange={(e) => updateForm('battery', e.target.value)} />
              </div>
              <div className="form-group">
                <label>{INVENTORY_LABELS.sim_type}</label>
                <select value={form.sim_type || ''} onChange={(e) => updateForm('sim_type', e.target.value)}>
                  {SIM_TYPE_OPTIONS.map((o) => (
                    <option key={o.value || '_'} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </details>

        <details className="collapse-section">
          <summary className="collapse-section__title">Texniki identifikasiya (IMEI, serial, model nömrəsi)</summary>
          <div className="collapse-section__body">
            <div className="form-row">
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
          </div>
        </details>

        <details className="collapse-section">
          <summary className="collapse-section__title">Alış və təchizatçı (qiymət, tarix, üzv)</summary>
          <div className="collapse-section__body">
            <div className="form-row">
              <div className="form-group">
                <label>{INVENTORY_LABELS.purchase_price}</label>
                <input type="number" step="0.01" value={form.purchase_price} onChange={(e) => updateForm('purchase_price', e.target.value)} />
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
                <label>{INVENTORY_LABELS.member}</label>
                <input value={form.member} onChange={(e) => updateForm('member', e.target.value)} />
              </div>
              <div className="form-group">
                <label>{INVENTORY_LABELS.member_no}</label>
                <input value={form.member_no} onChange={(e) => updateForm('member_no', e.target.value)} />
              </div>
            </div>
          </div>
        </details>

        <details className="collapse-section">
          <summary className="collapse-section__title">Qaytarma və müştəri</summary>
          <div className="collapse-section__body">
            <div className="form-row">
              <div className="form-group">
                <label>{INVENTORY_LABELS.client_number}</label>
                <input value={form.client_number} onChange={(e) => updateForm('client_number', e.target.value)} />
              </div>
              <div className="form-group">
                <label>{INVENTORY_LABELS.return_amount}</label>
                <input type="number" step="0.01" value={form.return_amount} onChange={(e) => updateForm('return_amount', e.target.value)} />
              </div>
              <div className="form-group">
                <label>{INVENTORY_LABELS.user}</label>
                <input value={form.user} onChange={(e) => updateForm('user', e.target.value)} />
              </div>
            </div>
          </div>
        </details>

        <details className="collapse-section">
          <summary className="collapse-section__title">Sənədlər və şərhlər</summary>
          <div className="collapse-section__body">
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
              {attachmentList.length > 0 && (
                <ul className="attachment-list">
                  {attachmentList.map((item, idx) => {
                    const url = supabase.storage.from('Mobideal').getPublicUrl(item.path).data.publicUrl
                    return (
                      <li key={idx}>
                        <a href={url} target="_blank" rel="noopener noreferrer">{item.name}</a>
                        <button type="button" className="btn btn--danger btn-sm" onClick={() => removeAttachment(idx)}>Sil</button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {pendingFiles.length > 0 && (
                <p className="form-hint">+ {pendingFiles.length} yeni fayl saxlanılacaq</p>
              )}
            </div>
            <div className="form-group">
              <label>{INVENTORY_LABELS.comments}</label>
              <textarea value={form.comments} onChange={(e) => updateForm('comments', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{INVENTORY_LABELS.comments_device}</label>
              <textarea value={form.comments_device} onChange={(e) => updateForm('comments_device', e.target.value)} placeholder="Cihazla bağlı qeyd" />
            </div>
          </div>
        </details>

        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saxlanılır…' : 'Saxla'}</button>
          <button type="button" className="btn btn--secondary" onClick={() => navigate(`/inventar/${id}`)}>Ləğv et</button>
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
