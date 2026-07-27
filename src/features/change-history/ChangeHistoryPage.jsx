import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  ACTION_LABELS,
  fieldLabel,
  formatChangeValue,
  formatHistoryTime,
} from './labels'
import './change-history.css'

const PAGE_SIZE = 80

/**
 * Module-level change history (Tarixçə).
 * @param {{ tableName: string, title: string, backTo: string, recordPath?: (id: string) => string }} props
 */
export default function ChangeHistoryPage({ tableName, title, backTo, recordPath }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionFilter, setActionFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error: e } = await supabase
        .from('change_history')
        .select('*')
        .eq('table_name', tableName)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)
      if (cancelled) return
      if (e) {
        setError(e.message)
        setRows([])
      } else {
        setRows(data || [])
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [tableName])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (actionFilter !== 'all' && r.action !== actionFilter) return false
      if (!q) return true
      const blob = [
        r.item_label,
        r.actor_label,
        ACTION_LABELS[r.action],
        JSON.stringify(r.changes || {}),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [rows, actionFilter, search])

  return (
    <div className="change-history">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{title} — Tarixçə</h1>
          <p className="change-history__hint">
            Yalnız baş vermiş əməliyyatlar: yaradılma, redaktə, silinmə. Son {PAGE_SIZE} qeyd.
          </p>
        </div>
        <Link to={backTo} className="btn btn--secondary">
          Siyahıya qayıt
        </Link>
      </div>

      <div className="change-history__toolbar">
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 220px', maxWidth: 320 }}>
          <label>Axtarış</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Məhsul, sahə, istifadəçi…"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Əməliyyat</label>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="all">Hamısı</option>
            <option value="insert">Yaradılıb</option>
            <option value="update">Redaktə</option>
            <option value="delete">Silinib</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="empty-state" style={{ color: 'var(--color-accent)' }}>
          {error.includes('change_history') || error.includes('schema cache')
            ? 'Tarixçə cədvəli hələ yaradılmayıb. setup/tables/12_change_history.sql faylını Supabase SQL Editor-də işə salın.'
            : error}
        </p>
      )}

      {loading ? (
        <p className="empty-state">Yüklənir…</p>
      ) : filtered.length === 0 && !error ? (
        <p className="empty-state">Hələ dəyişiklik qeydi yoxdur. Yeni redaktə və ya əlavədən sonra burada görünəcək.</p>
      ) : (
        <ul className="change-history__list">
          {filtered.map((row) => {
            const open = expandedId === row.id
            const changes = row.changes && typeof row.changes === 'object' ? row.changes : {}
            const entries = Object.entries(changes)
            const snapshot = row.snapshot && typeof row.snapshot === 'object' ? row.snapshot : {}
            const skipSnap = new Set([
              'id',
              'created_at',
              'updated_at',
              'extra',
              'gozlenilen_gelir',
              'faktiki_gelir',
              'qalan_borc',
              'xeyir',
              'xeyir_faizle',
            ])
            const snapshotEntries = Object.entries(snapshot).filter(([k, v]) => {
              if (skipSnap.has(k)) return false
              if (v === null || v === undefined || v === '') return false
              if (typeof v === 'object') return false
              return true
            })
            const actionLabel = ACTION_LABELS[row.action] || row.action
            const href = recordPath && row.record_id && row.action !== 'delete'
              ? recordPath(row.record_id)
              : null

            return (
              <li key={row.id} className={`change-history__item change-history__item--${row.action}`}>
                <button
                  type="button"
                  className="change-history__head"
                  onClick={() => setExpandedId((id) => (id === row.id ? null : row.id))}
                >
                  <span className={`change-history__badge change-history__badge--${row.action}`}>
                    {actionLabel}
                  </span>
                  <span className="change-history__item-label">
                    {href ? (
                      <Link to={href} onClick={(e) => e.stopPropagation()}>
                        {row.item_label || 'Qeyd'}
                      </Link>
                    ) : (
                      row.item_label || 'Qeyd'
                    )}
                  </span>
                  <span className="change-history__meta">
                    {formatHistoryTime(row.created_at)}
                    {row.actor_label ? ` · ${row.actor_label}` : ''}
                    {entries.length > 0 ? ` · ${entries.length} sahə` : ''}
                  </span>
                  <span className="change-history__chevron" aria-hidden>
                    {open ? '▴' : '▾'}
                  </span>
                </button>

                {open && (
                  <div className="change-history__body">
                    {row.action === 'insert' && entries.length === 0 ? (
                      snapshotEntries.length > 0 ? (
                        <table className="change-history__diff">
                          <thead>
                            <tr>
                              <th>Sahə</th>
                              <th colSpan={2}>Dəyər</th>
                            </tr>
                          </thead>
                          <tbody>
                            {snapshotEntries.map(([key, value]) => (
                              <tr key={key}>
                                <td>{fieldLabel(key)}</td>
                                <td colSpan={2} className="change-history__new">
                                  {formatChangeValue(value)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="change-history__empty-diff">Yeni qeyd yaradılıb.</p>
                      )
                    ) : entries.length === 0 ? (
                      <p className="change-history__empty-diff">Sahə dəyişikliyi yoxdur.</p>
                    ) : (
                      <table className="change-history__diff">
                        <thead>
                          <tr>
                            <th>Sahə</th>
                            <th>Əvvəl</th>
                            <th>Sonra</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map(([key, diff]) => (
                            <tr key={key}>
                              <td>{fieldLabel(key)}</td>
                              <td className="change-history__old">
                                {formatChangeValue(diff?.old)}
                              </td>
                              <td className="change-history__new">
                                {formatChangeValue(diff?.new)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
