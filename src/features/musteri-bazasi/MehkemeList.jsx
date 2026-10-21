import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useColumnConfig } from './useColumnConfig'
import ResizableDataTable from './ResizableDataTable'
import SummaryCards from './SummaryCards'
import MusteriRecordModule from './MusteriRecordModule'
import { applyKeyOrder } from './columnOrder'
import {
  MUSTERI_TABLE,
  MEHKEME_STATUS_OPTIONS,
  MEHKEME_DATE_KEYS,
  MEHKEME_COLUMN_SETTINGS_KEY,
  formatCell,
  getRowValue,
} from './constants'
import '../../styles/shared.css'
import './musteri-table.css'
import './musteri-schedule.css'

function sumField(rows, key) {
  return rows.reduce((acc, row) => {
    const n = Number(row[key])
    return acc + (Number.isNaN(n) ? 0 : n)
  }, 0)
}

function parseAmount(raw) {
  if (raw === '' || raw == null) return null
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

/**
 * Məhkəmə list — own column settings (all müştəri cols + native məhkəmə fields).
 */
export default function MehkemeList() {
  const navigate = useNavigate()
  const { access, isAdmin } = useAuth()
  const { columns, loading: colsLoading, saveColumns } = useColumnConfig({
    tableKey: MEHKEME_COLUMN_SETTINGS_KEY,
  })
  const [items, setItems] = useState([])
  const [viewRows, setViewRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [localCols, setLocalCols] = useState([])
  const [openRow, setOpenRow] = useState(null)
  const [savingId, setSavingId] = useState(null)
  // Məhkəmədəki satışların ödənişləri: { [musteri_bazasi_id]: [{ tarix, mebleg }] }
  const [paymentsBySale, setPaymentsBySale] = useState({})
  const resizeTimer = useRef(null)

  useEffect(() => {
    setLocalCols(columns)
  }, [columns])

  const visibleCols = useMemo(
    () => access.filterColumns('mehkeme', localCols || []).filter((c) => c.visible !== false),
    [localCols, access]
  )

  async function load() {
    setLoading(true)
    setError(null)
    const term = search.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')
    const { data, error: e } = await fetchAllPages(() => {
      let q = supabase
        .from(MUSTERI_TABLE)
        .select('*')
        .eq('veziyyet', 'Məhkəmə')
        .order('sira_no', { ascending: true })
      q = access.applyDataFilters(q, 'mehkeme')
      if (statusFilter) q = q.eq('mehkeme_status', statusFilter)
      if (term) {
        const parts = [
          `ad_soyad.ilike.%${term}%`,
          `model.ilike.%${term}%`,
          `imei_1.ilike.%${term}%`,
          `nomre_1.ilike.%${term}%`,
          `muqavile_nomresi.ilike.%${term}%`,
          `mehkeme_qeyd.ilike.%${term}%`,
        ]
        if (/^\d{1,9}$/.test(term)) parts.push(`sira_no.eq.${Number(term)}`)
        q = q.or(parts.join(','))
      }
      return q
    })
    if (e) {
      setError(e.message)
      setItems([])
    } else {
      setItems(data || [])
      await loadPayments((data || []).map((r) => r.id))
    }
    setLoading(false)
  }

  async function loadPayments(ids) {
    if (!ids.length) {
      setPaymentsBySale({})
      return
    }
    const map = {}
    // URL çox uzun olmasın deyə hissə-hissə
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      const { data, error: pe } = await fetchAllPages(() =>
        supabase
          .from('odenisler')
          .select('id, musteri_bazasi_id, tarix, mebleg')
          .in('musteri_bazasi_id', chunk)
          .order('id', { ascending: true })
      )
      if (pe) {
        setError(pe.message)
        return
      }
      for (const p of data || []) {
        if (!map[p.musteri_bazasi_id]) map[p.musteri_bazasi_id] = []
        map[p.musteri_bazasi_id].push(p)
      }
    }
    setPaymentsBySale(map)
  }

  // Hüquqdan S. Ödəniş: Hüquqa Verildi tarixindən (həmin gün daxil) sonrakı ödənişlərin cəmi
  const rowsWithHuquq = useMemo(
    () =>
      items.map((r) => {
        if (!r.huquqa_verilme_tarixi) return { ...r, huquqdan_sonra_odenis: null }
        const from = String(r.huquqa_verilme_tarixi).slice(0, 10)
        const list = (paymentsBySale[r.id] || []).filter((p) => String(p.tarix || '').slice(0, 10) >= from)
        const sum = list.reduce((a, p) => a + (Number(p.mebleg) || 0), 0)
        return { ...r, huquqdan_sonra_odenis: Math.round(sum * 100) / 100, huquqdan_sonra_say: list.length }
      }),
    [items, paymentsBySale]
  )

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [search, statusFilter])

  const totals = useMemo(
    () => ({
      alis_qiymeti: sumField(viewRows, 'alis_qiymeti'),
      satis_qiymeti: sumField(viewRows, 'satis_qiymeti'),
      verilib: sumField(viewRows, 'verilib'),
      qalan_borc: sumField(viewRows, 'qalan_borc'),
      faiz: sumField(viewRows, 'faiz'),
      rusum_odenilib: sumField(viewRows, 'rusum_odenilib'),
      huquqdan_sonra_odenis: sumField(viewRows, 'huquqdan_sonra_odenis'),
    }),
    [viewRows]
  )

  const handleReorder = useCallback(
    async (orderedVisible) => {
      const nextLocal = applyKeyOrder(
        localCols,
        orderedVisible.map((c) => c.key)
      )
      setLocalCols(nextLocal)
      try {
        await saveColumns(nextLocal)
      } catch (err) {
        setError(err.message)
      }
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

  async function patchRow(id, patch) {
    setSavingId(id)
    setError(null)
    try {
      const { data: saved, error: err } = await supabase
        .from(MUSTERI_TABLE)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .maybeSingle()
      if (err) throw err
      // Baza statusa görə tarixləri özü yazır — qaytarılan sətri götür
      const merged = saved ? { ...patch, ...saved } : patch
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...merged } : r)))
      if (openRow?.id === id) setOpenRow((r) => (r ? { ...r, ...merged } : r))
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  const renderCell = useCallback(
    (row, col, value) => {
      const busy = savingId === row.id
      if (col.key === 'mehkeme_isare') {
        return (
          <input
            type="checkbox"
            checked={Boolean(row.mehkeme_isare)}
            disabled={busy}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => patchRow(row.id, { mehkeme_isare: e.target.checked })}
            aria-label="İşarə"
          />
        )
      }
      if (col.key === 'rusum_odenilib') {
        return (
          <input
            type="number"
            step="0.01"
            min="0"
            disabled={busy}
            defaultValue={row.rusum_odenilib ?? ''}
            key={`rusum-${row.id}-${row.rusum_odenilib ?? ''}`}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const next = parseAmount(e.target.value)
              const prev =
                row.rusum_odenilib == null || row.rusum_odenilib === ''
                  ? null
                  : Number(row.rusum_odenilib)
              if (next === prev) return
              patchRow(row.id, { rusum_odenilib: next })
            }}
            style={{ width: '100%', minWidth: 90 }}
          />
        )
      }
      if (col.key === 'mehkeme_status') {
        return (
          <select
            value={row.mehkeme_status || ''}
            disabled={busy}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => patchRow(row.id, { mehkeme_status: e.target.value || null })}
            style={{ width: '100%', minWidth: 140 }}
          >
            <option value="">— Seçin —</option>
            {MEHKEME_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )
      }
      if (col.key === 'huquqdan_sonra_odenis') {
        if (value == null) return '—'
        return (
          <span title={`${row.huquqdan_sonra_say || 0} ödəniş`}>
            {formatCell(value, col)}
            {row.huquqdan_sonra_say ? ` (${row.huquqdan_sonra_say})` : ''}
          </span>
        )
      }
      if (MEHKEME_DATE_KEYS.includes(col.key)) {
        // Tarixlər status dəyişəndə avtomatik yazılır; əl ilə yalnız admin dəyişə bilər
        if (!isAdmin) return formatCell(value, col)
        return (
          <input
            type="date"
            disabled={busy}
            defaultValue={row[col.key] || ''}
            key={`${col.key}-${row.id}-${row[col.key] || ''}`}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const next = e.target.value || null
              const prev = row[col.key] || null
              if (next === prev) return
              patchRow(row.id, { [col.key]: next })
            }}
            style={{ width: '100%', minWidth: 120 }}
          />
        )
      }
      if (col.key === 'mehkeme_qeyd') {
        return (
          <input
            type="text"
            disabled={busy}
            defaultValue={row.mehkeme_qeyd || ''}
            key={`qeyd-${row.id}-${row.mehkeme_qeyd || ''}`}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const next = e.target.value.trim() || null
              const prev = row.mehkeme_qeyd || null
              if (next === prev) return
              patchRow(row.id, { mehkeme_qeyd: next })
            }}
            placeholder="Komment…"
            style={{ width: '100%', minWidth: 140 }}
          />
        )
      }
      return formatCell(value, col)
    },
    [savingId, isAdmin]
  )

  if (error && !items.length && !loading) {
    return <p className="empty-state" style={{ color: 'var(--color-accent)' }}>{error}</p>
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'flex-end',
          marginBottom: 16,
        }}
      >
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 220px', maxWidth: 320 }}>
          <label>Axtarış</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="№, ad, model, IMEI, nömrə…"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
          <label>Məhkəmə statusu</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Hamısı</option>
            {MEHKEME_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <Link to="/mehkeme/sutunlar" className="btn btn--secondary">
          Sütunları idarə et
        </Link>
        <Link to="/musteri-bazasi" className="btn btn--secondary">
          Müştəri Bazası
        </Link>
      </div>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      {!loading && !colsLoading && (
        <SummaryCards
          totals={totals}
          rowCount={viewRows.length}
          storageKey="summary:mehkeme"
          allowedKeys={access.allowedSummaryCards('mehkeme')}
          extraCards={[
            {
              key: 'rusum_odenilib',
              label: 'Rüsüm cəmi',
              value: totals.rusum_odenilib,
            },
            {
              key: 'huquqdan_sonra_odenis',
              label: 'Hüquqdan S. Ödəniş',
              value: totals.huquqdan_sonra_odenis,
            },
          ]}
        />
      )}

      <div className="card">
        {loading || colsLoading ? (
          <p className="empty-state">Yüklənir…</p>
        ) : (
          <ResizableDataTable
            columns={visibleCols}
            rows={rowsWithHuquq}
            onReorderColumns={handleReorder}
            onResizeColumn={handleResize}
            formatCell={formatCell}
            getRowValue={getRowValue}
            renderCell={renderCell}
            onRowOpen={(row) => setOpenRow(row)}
            onDisplayRowsChange={setViewRows}
            emptyText="Vəziyyəti «Məhkəmə» olan qeyd yoxdur. Müştəri Bazasında vəziyyəti Məhkəmə edin."
            prefsKey="mehkeme_bazasi"
          />
        )}
      </div>

      {openRow && (
        <div
          className="telefon-modal-overlay musteri-record-overlay"
          onClick={() => setOpenRow(null)}
          role="presentation"
        >
          <div className="telefon-modal musteri-record-modal" onClick={(e) => e.stopPropagation()}>
            <MusteriRecordModule
              key={openRow.id}
              record={openRow}
              onClose={() => setOpenRow(null)}
              onEdit={(row) => {
                setOpenRow(null)
                navigate(`/musteri-bazasi/${row.id}?edit=1`)
              }}
              onUpdated={(updated) => {
                setOpenRow(updated)
                setItems((prev) =>
                  prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
                )
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}
