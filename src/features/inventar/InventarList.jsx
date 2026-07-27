import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { confirmDelete } from '../../lib/confirmDelete'
import { formatDate } from '../../lib/formatDate'
import { STATUS_OPTIONS, CONDITION_OPTIONS, INVENTORY_LABELS } from './constants'
import '../../styles/shared.css'

function formatMoney(n) {
  if (n == null || n === '') return '—'
  return Number(n).toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function statusLabel(value) {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value
}

function conditionLabel(value) {
  if (!value) return '—'
  const v = String(value).trim().toLowerCase()
  return CONDITION_OPTIONS.find((o) => o.value === v)?.label ?? value
}

export default function InventarList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [imeiSearch, setImeiSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterModel, setFilterModel] = useState('')
  const [filterColor, setFilterColor] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false })
    if (e) {
      setError(e.message)
      setItems([])
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  const filterOptions = useMemo(() => {
    const types = []
    const models = []
    const colors = []
    items.forEach((row) => {
      if (row.type && !types.includes(row.type)) types.push(row.type)
      if (row.model && !models.includes(row.model)) models.push(row.model)
      if (row.color && !colors.includes(row.color)) colors.push(row.color)
    })
    return { types: types.sort(), models: models.sort(), colors: colors.sort() }
  }, [items])

  const filteredItems = useMemo(() => {
    return items.filter((row) => {
      if (imeiSearch.trim()) {
        const imei = (row.imei_1 || '').toString()
        if (!imei.toLowerCase().includes(imeiSearch.trim().toLowerCase())) return false
      }
      if (filterStatus && row.status !== filterStatus) return false
      if (filterType && row.type !== filterType) return false
      if (filterModel && row.model !== filterModel) return false
      if (filterColor && row.color !== filterColor) return false
      return true
    })
  }, [items, imeiSearch, filterStatus, filterType, filterModel, filterColor])

  async function handleDelete(id) {
    if (!confirmDelete('Bu inventar sətirini silmək istədiyinizə əminsiniz?')) return
    const { error: e } = await supabase.from('inventory').delete().eq('id', id)
    if (e) setError(e.message)
    else load()
  }

  const hasFilters = imeiSearch.trim() || filterStatus || filterType || filterModel || filterColor
  function clearFilters() {
    setImeiSearch('')
    setFilterStatus('')
    setFilterType('')
    setFilterModel('')
    setFilterColor('')
  }

  if (loading) return <p className="empty-state">Yüklənir…</p>
  if (error) return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>

  return (
    <div className="card list-card">
      <div className="list-toolbar">
        <div className="list-search">
          <label htmlFor="inventar-imei-search">IMEI 1 ilə axtarış</label>
          <input
            id="inventar-imei-search"
            type="text"
            placeholder="IMEI nömrəsi..."
            value={imeiSearch}
            onChange={(e) => setImeiSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="list-filters">
          <div className="filter-group">
            <label>{INVENTORY_LABELS.status}</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
              <option value="">Hamısı</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Növ</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="filter-select">
              <option value="">Hamısı</option>
              {filterOptions.types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Model</label>
            <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)} className="filter-select">
              <option value="">Hamısı</option>
              {filterOptions.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Rəng</label>
            <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)} className="filter-select">
              <option value="">Hamısı</option>
              {filterOptions.colors.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button type="button" className="btn btn--secondary btn-sm" onClick={clearFilters}>Filtrləri təmizlə</button>
          )}
        </div>
      </div>
      <p className="list-meta">
        {filteredItems.length === items.length
          ? `Cəmi ${items.length} sətir`
          : `${filteredItems.length} / ${items.length} sətir göstərilir`}
      </p>
      <div className="table-wrap">
        <table className="data-table list-table">
          <thead>
            <tr>
              <th>{INVENTORY_LABELS.status}</th>
              <th>{INVENTORY_LABELS.type}</th>
              <th>{INVENTORY_LABELS.model}</th>
              <th>{INVENTORY_LABELS.color}</th>
              <th>Vəziyyət (Təzə/Köhnə)</th>
              <th>{INVENTORY_LABELS.memory}</th>
              <th className="num">{INVENTORY_LABELS.quantity}</th>
              <th>{INVENTORY_LABELS.imei_1}</th>
              <th className="num">{INVENTORY_LABELS.purchase_price}</th>
              <th>{INVENTORY_LABELS.shift}</th>
              <th>{INVENTORY_LABELS.created_at}</th>
              <th className="th-actions"></th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr><td colSpan={12} className="empty-state">Nəticə yoxdur. Axtarış və ya filtrləri dəyişin.</td></tr>
            ) : (
              filteredItems.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className={`status-badge status-badge--${row.status || 'other'}`}>
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td>{row.type || '—'}</td>
                  <td>{row.model || '—'}</td>
                  <td>{row.color || '—'}</td>
                  <td>
                    {row.condition_type ? (
                      <span className={`condition-badge condition-badge--${String(row.condition_type).trim().toLowerCase()}`}>
                        {conditionLabel(row.condition_type)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{row.memory || '—'}</td>
                  <td className="num">{row.quantity ?? 1}</td>
                  <td>{row.imei_1 || '—'}</td>
                  <td className="num money">{formatMoney(row.purchase_price)}</td>
                  <td>{row.shift || '—'}</td>
                  <td>{formatDate(row.created_at)}</td>
                  <td className="td-actions">
                    <Link to={`/inventar/${row.id}`} className="link-row">Ətraflı</Link>
                    {(row.status === 'available' && (row.quantity ?? 1) > 0) ? (
                      <Link to={`/inventar/satish?prefill=${row.id}`} className="btn btn--primary btn-sm">Satış et</Link>
                    ) : null}
                    <Link to={`/inventar/${row.id}/redakte`} className="btn btn--secondary btn-sm">Redaktə</Link>
                    <button type="button" className="btn btn--danger btn-sm" onClick={() => handleDelete(row.id)}>Sil</button>
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
