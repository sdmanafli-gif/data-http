import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import '../../styles/shared.css'

export default function IcloudList() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ registered_number: '', notes: '' })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data: sales, error: e1 } = await supabase
        .from('sales')
        .select('id, contract_number, client_id, total_amount, clients(full_name)')
        .eq('sale_type', 'credit')
        .order('sold_at', { ascending: false })
      if (e1) throw e1

      const saleIds = (sales || []).map((s) => s.id)
      if (saleIds.length === 0) {
        setRows([])
        setLoading(false)
        return
      }

      const { data: items, error: e2 } = await supabase
        .from('sale_items')
        .select('sale_id, inventory_id, quantity, unit_price, inventory(id, model, imei_1, imei_2, type, color, memory)')
        .in('sale_id', saleIds)
      if (e2) throw e2

      const { data: tracking, error: e3 } = await supabase
        .from('icloud_tracking')
        .select('sale_id, inventory_id, id, registered_number, notes')
        .in('sale_id', saleIds)
      if (e3) throw e3

      const trackingMap = {}
      ;(tracking || []).forEach((t) => {
        const key = t.inventory_id ? `${t.sale_id}:${t.inventory_id}` : t.sale_id
        trackingMap[key] = t
      })

      const saleMap = {}
      ;(sales || []).forEach((s) => { saleMap[s.id] = s })

      const merged = (items || []).map((it) => {
        const sale = saleMap[it.sale_id]
        const inv = it.inventory || {}
        const key = it.inventory_id ? `${it.sale_id}:${it.inventory_id}` : it.sale_id
        const t = trackingMap[key]
        return {
          sale_id: it.sale_id,
          inventory_id: it.inventory_id,
          tracking_id: t?.id,
          client_name: sale?.clients?.full_name ?? '—',
          contract_number: sale?.contract_number ?? '—',
          device: inv.model ? [inv.type, inv.model, inv.color, inv.memory].filter(Boolean).join(' · ') : '—',
          imei: [inv.imei_1, inv.imei_2].filter(Boolean).join(' / ') || '—',
          registered_number: t?.registered_number ?? '',
          notes: t?.notes ?? '',
        }
      })
      setRows(merged)
    } catch (err) {
      setError(err?.message || String(err))
      setRows([])
    }
    setLoading(false)
  }

  function startEdit(row) {
    setEditing({ sale_id: row.sale_id, inventory_id: row.inventory_id, tracking_id: row.tracking_id })
    setEditForm({ registered_number: row.registered_number || '', notes: row.notes || '' })
  }

  function cancelEdit() {
    setEditing(null)
  }

  async function saveEdit() {
    if (!editing) return
    setError(null)
    try {
      if (editing.tracking_id) {
        const { error: e } = await supabase
          .from('icloud_tracking')
          .update({
            registered_number: editForm.registered_number.trim() || '—',
            notes: editForm.notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editing.tracking_id)
        if (e) throw e
      } else {
        const { error: e } = await supabase
          .from('icloud_tracking')
          .insert({
            sale_id: editing.sale_id,
            inventory_id: editing.inventory_id || null,
            registered_number: editForm.registered_number.trim() || '—',
            notes: editForm.notes.trim() || null,
          })
        if (e) throw e
      }
      setEditing(null)
      load()
    } catch (err) {
      setError(err?.message || String(err))
    }
  }

  if (loading) return <p className="empty-state">Yüklənir…</p>
  if (error) return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>

  return (
    <div className="card">
      <h2 className="card__title">iCloud qeydiyyat nömrəsi (kredit satışları)</h2>
      <p style={{ margin: '0 0 var(--space-md) 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
        Hər cihaz üçün iCloud-un qeydiyyatda olduğu nömrəni saxlayın. Məlumat kredit satışından gəlir.
      </p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Müştəri</th>
              <th>Müqavilə</th>
              <th>Cihaz</th>
              <th>IMEI</th>
              <th>iCloud nömrəsi</th>
              <th>Qeyd</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ color: 'var(--color-text-muted)' }}>Kredit satışı tapılmadı və ya cihaz yoxdur.</td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={`${row.sale_id}-${row.inventory_id || idx}`}>
                  <td>{row.client_name}</td>
                  <td>{row.contract_number}</td>
                  <td>{row.device}</td>
                  <td>{row.imei}</td>
                  <td>
                    {editing?.sale_id === row.sale_id && editing?.inventory_id === row.inventory_id ? (
                      <input
                        value={editForm.registered_number}
                        onChange={(e) => setEditForm((p) => ({ ...p, registered_number: e.target.value }))}
                        placeholder="Nömrə"
                        style={{ width: '100%', maxWidth: 160 }}
                      />
                    ) : (
                      row.registered_number || '—'
                    )}
                  </td>
                  <td>
                    {editing?.sale_id === row.sale_id && editing?.inventory_id === row.inventory_id ? (
                      <input
                        value={editForm.notes}
                        onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Qeyd"
                        style={{ width: '100%', maxWidth: 140 }}
                      />
                    ) : (
                      (row.notes && row.notes.slice(0, 30)) || '—'
                    )}
                  </td>
                  <td>
                    {editing?.sale_id === row.sale_id && editing?.inventory_id === row.inventory_id ? (
                      <span style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="btn btn--primary" style={{ padding: '4px 8px', fontSize: 12 }} onClick={saveEdit}>Saxla</button>
                        <button type="button" className="btn btn--secondary" style={{ padding: '4px 8px', fontSize: 12 }} onClick={cancelEdit}>Ləğv</button>
                      </span>
                    ) : (
                      <button type="button" className="btn btn--secondary" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => startEdit(row)}>Redaktə</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
