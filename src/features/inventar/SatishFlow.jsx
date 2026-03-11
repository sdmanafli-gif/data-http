import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import MusteriAdd from '../musteri-bazasi/MusteriAdd'
import { INVENTORY_LABELS } from './constants'
import '../../styles/shared.css'

const SALE_TYPES = [
  { value: 'credit', label: 'Kredit' },
  { value: 'nise', label: 'Nisə' },
  { value: 'cash', label: 'Nağd' },
]

function formatMoney(n) {
  if (n == null || n === '') return '—'
  return Number(n).toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SatishFlow() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefillId = searchParams.get('prefill') || null
  const [step, setStep] = useState(1)
  const [inventory, setInventory] = useState([])
  const [selected, setSelected] = useState({}) // { inventoryId: quantity }
  const [saleType, setSaleType] = useState('')
  const [terms, setTerms] = useState({
    total_amount: '',
    terms_months: '',
    terms_monthly_amount: '',
    terms_ilkin_date: '',
    terms_payment_start_date: '',
    terms_notes: '',
    notes: '',
  })
  const [clientSearch, setClientSearch] = useState('')
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [showNewClient, setShowNewClient] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadInventory()
  }, [])

  useEffect(() => {
    if (step !== 4) return
    loadClients()
  }, [step, clientSearch])

  async function loadInventory() {
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .eq('status', 'available')
      .gt('quantity', 0)
      .order('created_at', { ascending: false })
    const list = data || []
    setInventory(list)
    if (prefillId && list.length > 0) {
      const item = list.find((i) => i.id === prefillId)
      if (item) {
        const qty = Math.min(1, item.quantity ?? 1)
        setSelected({ [item.id]: qty })
      }
    }
  }

  async function loadClients() {
    let q = supabase.from('clients').select('*').order('full_name')
    if (clientSearch.trim()) {
      q = q.or(`full_name.ilike.%${clientSearch.trim()}%,phone.ilike.%${clientSearch.trim()}%`)
    }
    const { data } = await q.limit(20)
    setClients(data || [])
  }

  function toggleItem(id, maxQty) {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[id]) delete next[id]
      else next[id] = 1
      return next
    })
  }

  function setItemQty(id, qty, maxQty) {
    const n = Math.max(0, Math.min(Number(qty) || 0, maxQty))
    setSelected((prev) => (n > 0 ? { ...prev, [id]: n } : (() => { const x = { ...prev }; delete x[id]; return x })()))
  }

  const selectedItems = inventory.filter((i) => selected[i.id])
  const totalQuantity = selectedItems.reduce((s, i) => s + (selected[i.id] || 0), 0)

  async function handleCreateSale() {
    setError(null)
    if (!selectedClient?.id) {
      setError('Müştəri seçin və ya yeni əlavə edin.')
      return
    }
    const totalAmount = Number(terms.total_amount)
    if (!totalAmount || totalAmount <= 0) {
      setError('Ümumi məbləğ daxil edin.')
      return
    }
    if (selectedItems.length === 0) {
      setError('Ən azı bir məhsul seçin.')
      return
    }
    setLoading(true)
    try {
      const saleRow = {
        sale_type: saleType,
        client_id: selectedClient.id,
        total_amount: totalAmount,
        terms_months: terms.terms_months ? Number(terms.terms_months) : null,
        terms_monthly_amount: terms.terms_monthly_amount ? Number(terms.terms_monthly_amount) : null,
        terms_ilkin_date: terms.terms_ilkin_date || null,
        terms_payment_start_date: terms.terms_payment_start_date || null,
        terms_notes: terms.terms_notes || null,
        notes: terms.notes || null,
      }
      const { data: sale, error: saleErr } = await supabase.from('sales').insert(saleRow).select('id').single()
      if (saleErr) throw saleErr

      const unitPrice = totalAmount / totalQuantity
      for (const item of selectedItems) {
        const qty = selected[item.id] || 1
        await supabase.from('sale_items').insert({
          sale_id: sale.id,
          inventory_id: item.id,
          quantity: qty,
          unit_price: unitPrice,
        })
        const newQty = (item.quantity ?? 1) - qty
        await supabase
          .from('inventory')
          .update({ quantity: Math.max(0, newQty), status: newQty <= 0 ? 'sold' : 'available' })
          .eq('id', item.id)
      }
      navigate('/inventar')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (showNewClient) {
    return (
      <div className="card">
        <h2 className="card__title">Yeni müştəri — satış üçün</h2>
        <MusteriAdd
          onSaved={(client) => {
            setSelectedClient(client)
            setShowNewClient(false)
          }}
        />
        <button type="button" className="btn btn--secondary" style={{ marginTop: 'var(--space-md)' }} onClick={() => setShowNewClient(false)}>
          Geri
        </button>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="card__title">
        Satış — addım {step}/4
        {step === 1 && ': Məhsul seçimi'}
        {step === 2 && ': Satış növü'}
        {step === 3 && ': Məbləğ və şərtlər'}
        {step === 4 && ': Müştəri'}
      </h2>

      {step === 1 && (
        <>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
            Satış etmək istədiyiniz məhsulları seçin və miqdarı daxil edin.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>{INVENTORY_LABELS.type}</th>
                  <th>{INVENTORY_LABELS.model}</th>
                  <th>{INVENTORY_LABELS.color}</th>
                  <th className="num">Miqdar</th>
                  <th className="num">Alış qiyməti</th>
                  <th>Seç / Satış miqdarı</th>
                </tr>
              </thead>
              <tbody>
                {inventory.length === 0 ? (
                  <tr><td colSpan={7} className="empty-state">Mövcud məhsul yoxdur.</td></tr>
                ) : (
                  inventory.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!selected[row.id]}
                          onChange={() => toggleItem(row.id, row.quantity ?? 1)}
                        />
                      </td>
                      <td>{row.type || '—'}</td>
                      <td>{row.model || '—'}</td>
                      <td>{row.color || '—'}</td>
                      <td className="num">{row.quantity ?? 1}</td>
                      <td className="num money">{formatMoney(row.purchase_price)}</td>
                      <td>
                        {selected[row.id] != null ? (
                          <input
                            type="number"
                            min={1}
                            max={row.quantity ?? 1}
                            value={selected[row.id]}
                            onChange={(e) => setItemQty(row.id, e.target.value, row.quantity ?? 1)}
                            style={{ width: 70 }}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)' }}>
            <button type="button" className="btn btn--primary" disabled={selectedItems.length === 0} onClick={() => setStep(2)}>
              Davam et
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => navigate('/inventar')}>Ləğv et</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>Satış növünü seçin.</p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            {SALE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className="btn"
                style={{
                  padding: 'var(--space-lg)',
                  background: saleType === t.value ? 'var(--color-accent)' : 'var(--color-surface)',
                  color: saleType === t.value ? 'white' : 'var(--color-text)',
                  border: `1px solid ${saleType === t.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}
                onClick={() => setSaleType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 'var(--space-lg)', display: 'flex', gap: 'var(--space-sm)' }}>
            <button type="button" className="btn btn--secondary" onClick={() => setStep(1)}>Geri</button>
            <button type="button" className="btn btn--primary" disabled={!saleType} onClick={() => setStep(3)}>Davam et</button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="form-group">
            <label>Ümumi məbləğ (AZN)</label>
            <input type="number" step="0.01" value={terms.total_amount} onChange={(e) => setTerms((p) => ({ ...p, total_amount: e.target.value }))} required />
          </div>
          {(saleType === 'credit' || saleType === 'nise') && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Müddət (ay)</label>
                  <input type="number" min={1} value={terms.terms_months} onChange={(e) => setTerms((p) => ({ ...p, terms_months: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Aylıq ödəniş məbləği</label>
                  <input type="number" step="0.01" value={terms.terms_monthly_amount} onChange={(e) => setTerms((p) => ({ ...p, terms_monthly_amount: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Verilmə tarixi (ilkin ödəniş)</label>
                  <input type="date" value={terms.terms_ilkin_date} onChange={(e) => setTerms((p) => ({ ...p, terms_ilkin_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Kredit başlanğıc tarixi</label>
                  <input type="date" value={terms.terms_payment_start_date} onChange={(e) => setTerms((p) => ({ ...p, terms_payment_start_date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Şərtlər qeydi</label>
                <textarea value={terms.terms_notes} onChange={(e) => setTerms((p) => ({ ...p, terms_notes: e.target.value }))} />
              </div>
            </>
          )}
          <div className="form-group">
            <label>Qeydlər</label>
            <textarea value={terms.notes} onChange={(e) => setTerms((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)' }}>
            <button type="button" className="btn btn--secondary" onClick={() => setStep(2)}>Geri</button>
            <button type="button" className="btn btn--primary" onClick={() => setStep(4)}>Davam et</button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <div className="form-group">
            <label>Müştəri axtarışı (ad, telefon)</label>
            <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Axtar..." />
          </div>
          {selectedClient ? (
            <div style={{ padding: 'var(--space-md)', background: 'var(--color-bg)', borderRadius: 'var(--radius)', marginBottom: 'var(--space-md)' }}>
              Seçilmiş: <strong>{selectedClient.full_name}</strong> {selectedClient.phone && ` · ${selectedClient.phone}`}
              <button type="button" className="btn btn--secondary" style={{ marginLeft: 'var(--space-sm)' }} onClick={() => setSelectedClient(null)}>Dəyiş</button>
            </div>
          ) : (
            <div className="table-wrap" style={{ marginBottom: 'var(--space-md)' }}>
              <table className="data-table">
                <thead>
                  <tr><th>Ad</th><th>Telefon</th><th></th></tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td>{c.full_name}</td>
                      <td>{c.phone || '—'}</td>
                      <td><button type="button" className="btn btn--secondary" onClick={() => setSelectedClient(c)}>Seç</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button type="button" className="btn btn--secondary" style={{ marginBottom: 'var(--space-md)' }} onClick={() => setShowNewClient(true)}>
            + Yeni müştəri əlavə et
          </button>
          {error && <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button type="button" className="btn btn--secondary" onClick={() => setStep(3)}>Geri</button>
            <button type="button" className="btn btn--primary" disabled={!selectedClient || loading} onClick={handleCreateSale}>
              {loading ? 'Yaradılır…' : 'Satışı tamamla'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
