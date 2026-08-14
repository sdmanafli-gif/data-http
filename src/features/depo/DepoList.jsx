import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { confirmDelete } from '../../lib/confirmDelete'
import { useAuth } from '../../contexts/AuthContext'
import { useColumnConfig } from './useColumnConfig'
import ResizableDataTable from '../musteri-bazasi/ResizableDataTable'
import { applyKeyOrder } from '../musteri-bazasi/columnOrder'
import {
  DEPO_TABLE,
  STATUS_LABELS,
  formatCell,
  getRowValue,
  formatMoney,
} from './constants'
import { LEDGER_TABLE } from '../borc-nisye/constants'
import CollapsibleSummary from '../../components/CollapsibleSummary'
import { REF_NOV, NOV_TO_MODELS } from '../mehsul-bazasi/referenceOptions'
import '../../styles/shared.css'
import '../musteri-bazasi/musteri-table.css'

const MODELLESS = '— (modelsiz)'

/** Quantity for one depo row (min 0; blank treated as 1 for available stock). */
function rowQty(row) {
  const n = Number(row?.miqdar)
  if (!Number.isFinite(n)) return 1
  return Math.max(0, n)
}

/** Purchase cost of row stock: alış × miqdar */
function rowAlisValue(row) {
  const price = Number(row?.alis_qiymeti)
  if (!Number.isFinite(price)) return 0
  return price * rowQty(row)
}

const NOV_ORDER = new Map(REF_NOV.map((n, i) => [n.toLowerCase(), i]))

function normalizeSpaces(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Short iPhone line label: "iPhone 17 Pro Max" → "17 Pro Max", "13" → "13" */
function iphoneLineLabel(model) {
  let s = normalizeSpaces(model)
  if (!s) return 'Digər'

  const stripped = s.replace(/^iphone\s+/i, '').trim()
  if (!stripped) return 'Digər'

  // Compact forms: 17ProMax, 13pro, 16e
  let line = stripped
    .replace(/pro\s*max/gi, 'Pro Max')
    .replace(/(\d)\s*pro(?!\s*max)/gi, '$1 Pro')
    .replace(/(\d)\s*plus/gi, '$1 Plus')
    .replace(/(\d)\s*mini/gi, '$1 mini')
    .replace(/(\d)\s*air/gi, '$1 Air')
    .replace(/(\d)\s*e\b/gi, '$1 E')
    .replace(/\s+/g, ' ')
    .trim()

  // Title-case known tokens
  line = line
    .split(' ')
    .map((part, i) => {
      const lower = part.toLowerCase()
      if (lower === 'pro') return 'Pro'
      if (lower === 'max') return 'Max'
      if (lower === 'plus') return 'Plus'
      if (lower === 'mini') return 'mini'
      if (lower === 'air') return 'Air'
      if (lower === 'e') return 'E'
      if (lower === 'xs') return 'Xs'
      if (lower === 'x') return 'X'
      if (lower === 'se') return 'SE'
      if (/^\d+$/.test(part)) return part
      if (i === 0) return part
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .join(' ')

  return line || 'Digər'
}

function iphoneLineSortKey(label) {
  const l = String(label || '').toLowerCase()
  if (l === 'digər' || l === 'diger') return [0, 0, 99, l]

  if (l === 'se' || l.startsWith('se ')) return [1, 0, 0, l]
  if (l === 'x') return [10, 0, 0, l]
  if (l.startsWith('xs')) return [10, 1, l.includes('max') ? 2 : 0, l]

  const numMatch = l.match(/^(\d{1,2})/)
  const gen = numMatch ? Number(numMatch[1]) : 0
  let variant = 0
  if (l.includes('pro max')) variant = 5
  else if (/\bpro\b/.test(l)) variant = 4
  else if (/\bair\b/.test(l)) variant = 3
  else if (/\bplus\b/.test(l)) variant = 2
  else if (/\bmini\b/.test(l)) variant = 1
  else if (/\be\b/.test(l)) variant = 0.5

  return [gen, variant, 0, l]
}

function compareIphoneLines(a, b) {
  const ka = iphoneLineSortKey(a)
  const kb = iphoneLineSortKey(b)
  for (let i = 0; i < 3; i += 1) {
    if (ka[i] !== kb[i]) return kb[i] - ka[i] // newer / higher variant first
  }
  return String(ka[3]).localeCompare(String(kb[3]), 'en')
}

function looksLikeIphoneModel(model) {
  const s = normalizeSpaces(model).toLowerCase()
  if (!s) return false
  if (s.includes('iphone')) return true
  if (/^(x|xs|xs\s*max|se)(\b|$)/i.test(s)) return true
  // "13 Pro", "17 Pro Max", "16", "15 Plus"
  if (/^\d{1,2}(\s*(pro\s*max|pro|plus|mini|air|e))?$/i.test(s)) {
    const n = Number(s.match(/^\d{1,2}/)[0])
    return n >= 8 && n <= 30
  }
  return false
}

/** Resolve product type (növ) from row, or infer from known model lists. */
function resolveNov(row) {
  const model = normalizeSpaces(row?.model)
  const raw = normalizeSpaces(row?.nov || row?.extra?.nov)

  // iPhone models always land in Iphone category
  if (looksLikeIphoneModel(model)) return 'Iphone'

  if (raw) return raw

  const modelLower = model.toLowerCase()
  if (!modelLower) return 'Digər'

  for (const [nov, models] of Object.entries(NOV_TO_MODELS)) {
    if ((models || []).some((m) => normalizeSpaces(m).toLowerCase() === modelLower)) {
      return nov
    }
  }

  if (modelLower.includes('ipad')) return 'Ipad'
  if (modelLower.includes('macbook') || modelLower.startsWith('mac ')) return 'Mac'
  if (modelLower.includes('airpod') || modelLower.includes('headphone')) return 'Headphones'
  if (modelLower.includes('dyson')) return 'Dyson'
  if (
    modelLower.includes('playstation') ||
    modelLower.includes('ps5') ||
    modelLower.includes('ps4')
  ) {
    return 'Playstation'
  }
  if (modelLower.includes('samsung') || modelLower.includes('galaxy')) return 'Samsung'
  if (modelLower.includes('watch') || modelLower.includes('saat')) return 'Saat'
  return 'Digər'
}

function novSortKey(nov) {
  const known = NOV_ORDER.get(String(nov).toLowerCase())
  if (known != null) return known
  if (nov === 'Digər') return 9000
  return 1000
}

/** Sub-category under a növ (iPhone → 13 / 15 / 17 Pro …). */
function resolveSubline(nov, model) {
  if (String(nov).toLowerCase() === 'iphone') {
    return iphoneLineLabel(model)
  }
  return null
}

function buildByNov(availableRows) {
  const byNovMap = new Map()
  for (const r of availableRows) {
    const nov = resolveNov(r)
    const modelName = normalizeSpaces(r.model) || MODELLESS
    const subline = resolveSubline(nov, modelName)
    const qty = rowQty(r)
    const value = rowAlisValue(r)

    let group = byNovMap.get(nov)
    if (!group) {
      group = {
        nov,
        miqdar: 0,
        alisValue: 0,
        sublines: new Map(),
      }
      byNovMap.set(nov, group)
    }
    group.miqdar += qty
    group.alisValue += value

    const subKey = subline || '__all__'
    let sub = group.sublines.get(subKey)
    if (!sub) {
      sub = {
        label: subline,
        miqdar: 0,
        alisValue: 0,
        models: new Map(),
      }
      group.sublines.set(subKey, sub)
    }
    sub.miqdar += qty
    sub.alisValue += value

    const prev = sub.models.get(modelName) || {
      model: modelName,
      miqdar: 0,
      alisValue: 0,
      lines: 0,
    }
    prev.miqdar += qty
    prev.alisValue += value
    prev.lines += 1
    sub.models.set(modelName, prev)
  }

  return [...byNovMap.values()]
    .map((g) => {
      const isIphone = String(g.nov).toLowerCase() === 'iphone'
      const sublines = [...g.sublines.values()]
        .map((s) => ({
          label: s.label,
          miqdar: s.miqdar,
          alisValue: s.alisValue,
          models: [...s.models.values()].sort((a, b) => {
            if (b.miqdar !== a.miqdar) return b.miqdar - a.miqdar
            return a.model.localeCompare(b.model, 'az')
          }),
        }))
        .sort((a, b) => {
          if (isIphone && a.label && b.label) return compareIphoneLines(a.label, b.label)
          return 0
        })

      return {
        nov: g.nov,
        miqdar: g.miqdar,
        alisValue: g.alisValue,
        hasSublines: isIphone,
        sublines,
        models: sublines.flatMap((s) => s.models),
      }
    })
    .sort((a, b) => {
      const ka = novSortKey(a.nov)
      const kb = novSortKey(b.nov)
      if (ka !== kb) return ka - kb
      return a.nov.localeCompare(b.nov, 'az')
    })
}

export default function DepoList() {
  const navigate = useNavigate()
  const { access } = useAuth()
  const { columns, loading: colsLoading, saveColumns } = useColumnConfig()
  const [items, setItems] = useState([])
  const [viewRows, setViewRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [localCols, setLocalCols] = useState([])
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [deletingId, setDeletingId] = useState(null)
  const [selectedModel, setSelectedModel] = useState(null)
  const resizeTimer = useRef(null)

  useEffect(() => setLocalCols(columns), [columns])

  const visibleCols = useMemo(
    () => access.filterColumns('depo', localCols).filter((c) => c.visible !== false),
    [localCols, access]
  )

  async function load() {
    setLoading(true)
    setError(null)
    const term = search.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')
    const { data, error: e } = await fetchAllPages(() => {
      let q = supabase.from(DEPO_TABLE).select('*').order('sira_no', { ascending: true })
      q = access.applyDataFilters(q, 'depo')
      if (term) {
        q = q.or(
          `model.ilike.%${term}%,imei_1.ilike.%${term}%,imei_2.ilike.%${term}%,reng.ilike.%${term}%,kimden_alinib.ilike.%${term}%,nomre.ilike.%${term}%,sexsiyyet.ilike.%${term}%,serial_no.ilike.%${term}%`
        )
      }
      return q
    })
    if (e) {
      setError(e.message)
      setItems([])
    } else {
      const rows = data || []
      // Mövcud items first so Satış is easy to find
      rows.sort((a, b) => {
        const av = a.status === 'available' ? 0 : 1
        const bv = b.status === 'available' ? 0 : 1
        if (av !== bv) return av - bv
        return (a.sira_no ?? 0) - (b.sira_no ?? 0)
      })
      setItems(rows)
    }
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [search])

  async function handleDeleteRow(row) {
    if (!access.canDelete('depo')) {
      setError('Silmək üçün icazəniz yoxdur.')
      return
    }
    const label = row.model || (row.sira_no != null ? `#${row.sira_no}` : 'bu qeyd')
    if (!confirmDelete(`«${label}» Depodan silinsin?`)) return
    setDeletingId(row.id)
    setError(null)
    try {
      await supabase.from(LEDGER_TABLE).delete().eq('depo_id', row.id).eq('tip', 'nisye_aldim')
      const { error: err } = await supabase.from(DEPO_TABLE).delete().eq('id', row.id)
      if (err) throw err
      setItems((prev) => prev.filter((r) => r.id !== row.id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const modelCatalog = useMemo(() => {
    const available = items.filter((r) => r.status === 'available')
    return buildByNov(available)
  }, [items])

  const totals = useMemo(() => {
    const available = viewRows.filter((r) => r.status === 'available')
    const sold = viewRows.filter((r) => r.status === 'sold')
    const reserved = viewRows.filter((r) => r.status === 'reserved')
    const returned = viewRows.filter((r) => r.status === 'returned')

    const availableMiqdar = available.reduce((acc, r) => acc + rowQty(r), 0)
    const availableAlisValue = available.reduce((acc, r) => acc + rowAlisValue(r), 0)
    const allTimeAlisValue = viewRows.reduce((acc, r) => acc + rowAlisValue(r), 0)
    const soldMiqdar = sold.reduce((acc, r) => acc + rowQty(r), 0)
    const soldAlisValue = sold.reduce((acc, r) => acc + rowAlisValue(r), 0)

    return {
      availableLines: available.length,
      availableMiqdar,
      availableAlisValue,
      allTimeAlisValue,
      allLines: viewRows.length,
      allMiqdar: viewRows.reduce((acc, r) => acc + rowQty(r), 0),
      soldMiqdar,
      soldAlisValue,
      reservedMiqdar: reserved.reduce((acc, r) => acc + rowQty(r), 0),
      returnedMiqdar: returned.reduce((acc, r) => acc + rowQty(r), 0),
      byNov: modelCatalog,
    }
  }, [viewRows, modelCatalog])

  function filterByModel(modelName) {
    setSelectedModel((prev) => (prev === modelName ? null : modelName))
  }

  function clearModelFilter() {
    setSelectedModel(null)
  }

  const tableRows = useMemo(() => {
    if (!selectedModel) return items
    return items.filter((r) => {
      if (r.status !== 'available') return false
      const name = normalizeSpaces(r.model) || MODELLESS
      return name === selectedModel
    })
  }, [items, selectedModel])

  function toggleSelect(row) {
    if (row.status !== 'available') return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(row.id)) next.delete(row.id)
      else next.add(row.id)
      return next
    })
  }

  function startSale(ids) {
    const list = [...ids]
    if (!list.length) return
    navigate('/depo/satish', { state: { ids: list } })
  }

  const handleReorder = useCallback(
    async (orderedVisible) => {
      const next = applyKeyOrder(localCols, orderedVisible.map((c) => c.key))
      setLocalCols(next)
      try { await saveColumns(next) } catch (err) { setError(err.message) }
    },
    [localCols, saveColumns]
  )

  const handleResize = useCallback(
    (key, width) => {
      setLocalCols((prev) => {
        const next = prev.map((c) => (c.key === key ? { ...c, width } : c))
        clearTimeout(resizeTimer.current)
        resizeTimer.current = setTimeout(() => {
          saveColumns(next).catch((err) => setError(err.message))
        }, 400)
        return next
      })
    },
    [saveColumns]
  )

  if (error) return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginBottom: 16 }}>
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 240px', maxWidth: 360 }}>
          <label>Axtarış</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Model, IMEI…" />
        </div>
        <Link to="/depo/sutunlar" className="btn btn--secondary">Sütunları idarə et</Link>
      </div>

      {selectedIds.size > 0 && (
        <div
          className="card"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            marginBottom: 16,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
          }}
        >
          <span style={{ fontSize: 14 }}>
            Səbət: <strong>{selectedIds.size}</strong> məhsul seçilib
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--secondary" onClick={() => setSelectedIds(new Set())}>
              Seçimi təmizlə
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => startSale(selectedIds)}
            >
              Satış ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {!loading && !colsLoading && access.canSeeSummary('depo') && (() => {
        const keys = access.allowedSummaryCards('depo')
        const show = (k) => keys == null || keys.includes(k)
        return (
        <CollapsibleSummary title="Cəmlər" storageKey="summary:depo" defaultOpen>
          <div className="musteri-summary">
            {show('availableMiqdar') && (
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Mövcud miqdar</div>
              <div className="musteri-summary__value">{totals.availableMiqdar}</div>
            </div>
            )}
            {show('availableAlisValue') && (
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Mövcud alış dəyəri</div>
              <div className="musteri-summary__value">{formatMoney(totals.availableAlisValue)}</div>
            </div>
            )}
            {show('allTimeAlisValue') && (
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">İndiyədək ümumi alış</div>
              <div className="musteri-summary__value">{formatMoney(totals.allTimeAlisValue)}</div>
            </div>
            )}
            {show('availableLines') && (
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">Mövcud sətir</div>
              <div className="musteri-summary__value">{totals.availableLines}</div>
            </div>
            )}
            {show('soldMiqdar') && (
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">{STATUS_LABELS.sold} miqdar</div>
              <div className="musteri-summary__value">{totals.soldMiqdar}</div>
            </div>
            )}
            {show('soldAlisValue') && (
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">{STATUS_LABELS.sold} alış dəyəri</div>
              <div className="musteri-summary__value">{formatMoney(totals.soldAlisValue)}</div>
            </div>
            )}
            {show('reservedReturned') && (
            <div className="musteri-summary__card">
              <div className="musteri-summary__label">{STATUS_LABELS.reserved} / {STATUS_LABELS.returned}</div>
              <div className="musteri-summary__value">
                {totals.reservedMiqdar} / {totals.returnedMiqdar}
              </div>
            </div>
            )}
            {show('filterLines') && (
            <div className="musteri-summary__card musteri-summary__card--meta">
              <div className="musteri-summary__label">Filtrdə sətir / miqdar</div>
              <div className="musteri-summary__value">
                {totals.allLines} / {totals.allMiqdar}
              </div>
            </div>
            )}
            {show('byNov') && (
            <div className="musteri-summary__card musteri-summary__card--wide">
              <div className="musteri-summary__label">
                Mövcud modellər (növə görə)
                {selectedModel ? (
                  <button
                    type="button"
                    className="depo-model-filter-chip"
                    onClick={clearModelFilter}
                    title="Model filtrini təmizlə"
                  >
                    {selectedModel}
                    <span aria-hidden>×</span>
                  </button>
                ) : null}
              </div>
              {totals.byNov.length === 0 ? (
                <div className="musteri-summary__value" style={{ fontSize: 14, fontWeight: 500 }}>
                  Mövcud məhsul yoxdur
                </div>
              ) : (
                <div className="depo-nov-summary">
                  <p className="depo-nov-summary__hint">Modelə klik → cədvəli filterlə</p>
                  {totals.byNov.map((group) => (
                    <section key={group.nov} className="depo-nov-summary__group">
                      <header className="depo-nov-summary__head">
                        <strong>{group.nov}</strong>
                        <span>
                          {group.miqdar} ədəd · {formatMoney(group.alisValue)}
                        </span>
                      </header>
                      {group.hasSublines ? (
                        <div className="depo-iphone-lines">
                          {group.sublines.map((line) => (
                            <div key={`${group.nov}-${line.label}`} className="depo-iphone-lines__block">
                              <div className="depo-iphone-lines__title">
                                <span className="depo-iphone-lines__badge">{line.label}</span>
                                <span className="depo-iphone-lines__sum">
                                  {line.miqdar} ədəd · {formatMoney(line.alisValue)}
                                </span>
                              </div>
                              <ul className="depo-model-summary">
                                {line.models.map((m) => (
                                  <li key={`${group.nov}-${line.label}-${m.model}`}>
                                    <button
                                      type="button"
                                      className={`depo-model-summary__btn${selectedModel === m.model ? ' depo-model-summary__btn--active' : ''}`}
                                      onClick={() => filterByModel(m.model)}
                                      title={`${m.model} — cədvəldə göstər`}
                                    >
                                      <span className="depo-model-summary__name">{m.model}</span>
                                      <span className="depo-model-summary__meta">
                                        {m.miqdar} ədəd · {formatMoney(m.alisValue)}
                                      </span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ul className="depo-model-summary">
                          {group.models.map((m) => (
                            <li key={`${group.nov}-${m.model}`}>
                              <button
                                type="button"
                                className={`depo-model-summary__btn${selectedModel === m.model ? ' depo-model-summary__btn--active' : ''}`}
                                onClick={() => filterByModel(m.model)}
                                title={`${m.model} — cədvəldə göstər`}
                              >
                                <span className="depo-model-summary__name">{m.model}</span>
                                <span className="depo-model-summary__meta">
                                  {m.miqdar} ədəd · {formatMoney(m.alisValue)}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>
        </CollapsibleSummary>
        )
      })()}

      <div className="card">
        {loading || colsLoading ? (
          <p className="empty-state">Yüklənir…</p>
        ) : (
          <ResizableDataTable
            columns={visibleCols}
            rows={tableRows}
            onReorderColumns={handleReorder}
            onResizeColumn={handleResize}
            formatCell={formatCell}
            getRowValue={getRowValue}
            onRowOpen={(row) => navigate(`/depo/${row.id}`)}
            onDisplayRowsChange={setViewRows}
            prefsKey="depo"
            selection={{
              selectedIds,
              isSelectable: (row) => row.status === 'available',
              onToggle: toggleSelect,
            }}
            renderActions={(row) => (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {row.status === 'available' && access.canEdit('depo') && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => startSale([row.id])}
                  >
                    Satış
                  </button>
                )}
                {access.canDelete('depo') && (
                  <button
                    type="button"
                    className="btn btn--danger"
                    disabled={deletingId === row.id}
                    onClick={() => handleDeleteRow(row)}
                    style={{ padding: '4px 10px', fontSize: 12 }}
                  >
                    {deletingId === row.id ? '…' : 'Sil'}
                  </button>
                )}
              </div>
            )}
          />
        )}
      </div>
    </>
  )
}
