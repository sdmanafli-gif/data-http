import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { LEDGER_TABLE } from './constants'
import {
  IMPORT_FIELDS,
  parseExcelFile,
  suggestMapping,
  mappingToHeaderMap,
  countPreviewEntries,
  excelRowToEntries,
} from './excelImportUtils'
import '../../styles/shared.css'

export default function ExcelImport() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [error, setError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  const usedTargets = useMemo(
    () => new Set(Object.values(mapping).filter(Boolean)),
    [mapping]
  )

  const previewCount = useMemo(
    () => (rows.length ? countPreviewEntries(rows, mapping) : 0),
    [rows, mapping]
  )

  const hasKime = usedTargets.has('kime')

  async function onFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setResult(null)
    try {
      const parsed = await parseExcelFile(file)
      setFileName(file.name)
      setHeaders(parsed.headers)
      setRows(parsed.rows)
      setMapping(suggestMapping(parsed.headers))
      setStep(2)
    } catch (err) {
      setError(err.message)
    }
  }

  function setFieldForHeader(header, fieldKey) {
    setMapping((prev) => {
      const next = { ...prev }
      // Clear other headers that already use this field
      if (fieldKey) {
        for (const h of Object.keys(next)) {
          if (h !== header && next[h] === fieldKey) next[h] = ''
        }
      }
      next[header] = fieldKey
      return next
    })
  }

  async function runImport() {
    if (!hasKime) {
      setError('“Kimə” sahəsini Excel sütununa map edin.')
      return
    }
    setImporting(true)
    setError(null)
    let ok = 0
    let skipped = 0
    let failed = 0
    const errors = []
    const headerMap = mappingToHeaderMap(mapping)
    try {
      for (let i = 0; i < rows.length; i++) {
        const entries = excelRowToEntries(rows[i], headerMap)
        if (!entries.length) {
          skipped += 1
          continue
        }
        for (const payload of entries) {
          try {
            const { error: insErr } = await supabase.from(LEDGER_TABLE).insert(payload)
            if (insErr) throw insErr
            ok += 1
          } catch (err) {
            failed += 1
            errors.push(`Sətir ${i + 2}: ${err.message}`)
          }
        }
      }
      setResult({ ok, skipped, failed, errors: errors.slice(0, 20) })
      setStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2 className="card__title" style={{ margin: 0 }}>Borc / Nisyə — Excel idxal</h2>
        <Link to="/borc-nisye" className="btn btn--secondary">Geri</Link>
      </div>

      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: 680 }}>
        Hər Excel sütununu sahəyə map edin. Bir sətirdə bir neçə məbləğ (Borc verdim / aldım,
        Nisyə verdim / ödəniş) varsa, hər biri ayrıca əməliyyat kimi yazılır.
        “Cəmi / Qalıq” sütunlarını “— Keç —” saxlayın.
      </p>

      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      {step === 1 && (
        <div className="form-group">
          <label>Excel faylı (.xlsx / .xls / .csv)</label>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} />
        </div>
      )}

      {step === 2 && (
        <>
          <p style={{ fontSize: 14, marginBottom: 12 }}>
            {fileName} · {rows.length} Excel sətri · təxminən <strong>{previewCount}</strong> əməliyyat
          </p>

          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Excel sütunu</th>
                  <th>Nümunə</th>
                  <th>Sahə (map)</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h) => (
                  <tr key={h}>
                    <td>{h || '(boş başlıq)'}</td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {String(rows[0]?.[h] ?? '—')}
                    </td>
                    <td>
                      <select
                        value={mapping[h] || ''}
                        onChange={(e) => setFieldForHeader(h, e.target.value)}
                      >
                        <option value="">— Keç —</option>
                        {IMPORT_FIELDS.map((f) => (
                          <option
                            key={f.key}
                            value={f.key}
                            disabled={usedTargets.has(f.key) && mapping[h] !== f.key}
                          >
                            {f.label}
                            {f.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!hasKime && (
            <p style={{ fontSize: 13, color: 'var(--color-accent)' }}>
              Kimə * — mütləq map edilməlidir.
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--primary"
              disabled={importing || !hasKime || previewCount === 0}
              onClick={runImport}
            >
              {importing ? 'İdxal olunur…' : `İdxalı başlat (${previewCount})`}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setStep(1)
                setResult(null)
              }}
            >
              Başqa fayl
            </button>
          </div>
        </>
      )}

      {step === 3 && result && (
        <div>
          <p>
            Uğurlu: <strong>{result.ok}</strong>
            {' · '}Boş sətir: {result.skipped}
            {' · '}Xəta: {result.failed}
          </p>
          {result.errors.length > 0 && (
            <ul style={{ fontSize: 13, color: 'var(--color-accent)' }}>
              {result.errors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--primary" onClick={() => navigate('/borc-nisye')}>
              İcmala qayıt
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setStep(1)
                setResult(null)
              }}
            >
              Yenə idxal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
