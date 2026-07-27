import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useColumnConfig } from './useColumnConfig'
import { NAGD_TABLE, toNagdPayload } from './constants'
import {
  parseExcelFile,
  suggestMapping,
  getImportableColumns,
  excelRowToForm,
} from './excelImportUtils'
import '../../styles/shared.css'

export default function ExcelImport() {
  const navigate = useNavigate()
  const { columns, loading: colsLoading } = useColumnConfig()
  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [error, setError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  const importable = useMemo(() => getImportableColumns(columns), [columns])
  const columnsByKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns])
  const usedTargets = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping])

  async function onFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      const parsed = await parseExcelFile(file)
      setFileName(file.name)
      setHeaders(parsed.headers)
      setRows(parsed.rows)
      setMapping(suggestMapping(parsed.headers, importable))
      setStep(2)
    } catch (err) {
      setError(err.message)
    }
  }

  async function runImport() {
    setImporting(true)
    setError(null)
    let ok = 0
    let failed = 0
    const errors = []
    try {
      for (let i = 0; i < rows.length; i++) {
        try {
          const form = excelRowToForm(rows[i], mapping, columnsByKey)
          const payload = toNagdPayload(form, columns)
          const { error: insErr } = await supabase.from(NAGD_TABLE).insert(payload)
          if (insErr) throw insErr
          ok += 1
        } catch (err) {
          failed += 1
          errors.push(`Sətir ${i + 2}: ${err.message}`)
        }
      }
      setResult({ ok, failed, errors: errors.slice(0, 20) })
      setStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  if (colsLoading) return <div className="card"><p className="empty-state">Yüklənir…</p></div>

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2 className="card__title" style={{ margin: 0 }}>Nağd satış — Excel idxal</h2>
        <Link to="/nagd-satish" className="btn btn--secondary">Geri</Link>
      </div>
      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      {step === 1 && (
        <div className="form-group">
          <label>Excel faylı (.xlsx / .xls / .csv)</label>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} />
        </div>
      )}

      {step >= 2 && (
        <>
          <p style={{ fontSize: 13 }}>{fileName} · {rows.length} sətir</p>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table className="data-table">
              <thead>
                <tr><th>Excel</th><th>Nümunə</th><th>Sahə</th></tr>
              </thead>
              <tbody>
                {headers.map((h) => (
                  <tr key={h}>
                    <td>{h}</td>
                    <td>{String(rows[0]?.[h] ?? '—')}</td>
                    <td>
                      <select value={mapping[h] || ''} onChange={(e) => setMapping((p) => ({ ...p, [h]: e.target.value }))}>
                        <option value="">— Keç —</option>
                        {importable.map((c) => (
                          <option key={c.key} value={c.key} disabled={usedTargets.has(c.key) && mapping[h] !== c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn--primary" disabled={importing} onClick={runImport}>
            {importing ? 'İdxal…' : `${rows.length} sətiri idxal et`}
          </button>
        </>
      )}

      {step === 3 && result && (
        <div style={{ marginTop: 16 }}>
          <p>Uğurlu: <strong>{result.ok}</strong>{result.failed > 0 && <> · Xəta: <strong>{result.failed}</strong></>}</p>
          {result.errors?.length > 0 && (
            <ul style={{ color: 'var(--color-accent)', fontSize: 13 }}>
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <button type="button" className="btn btn--primary" onClick={() => navigate('/nagd-satish')}>
            Siyahıya qayıt
          </button>
        </div>
      )}
    </div>
  )
}
