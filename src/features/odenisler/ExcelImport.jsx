import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { ODENISLER_TABLE, MUSTERI_TABLE, syncMusteriPaymentTotals } from './constants'
import {
  parseExcelFile,
  suggestMapping,
  IMPORT_FIELDS,
  excelRowToPayload,
  resolveClient,
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
      setMapping(suggestMapping(parsed.headers))
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
    const touched = new Set()

    try {
      const { data: clients, error: cErr } = await fetchAllPages(() =>
        supabase.from(MUSTERI_TABLE).select('id, sira_no, ad_soyad')
      )
      if (cErr) throw cErr

      const bySira = new Map()
      const byName = new Map()
      for (const c of clients || []) {
        if (c.sira_no != null) bySira.set(Number(c.sira_no), c)
        const key = String(c.ad_soyad || '').trim().toLowerCase()
        if (!key) continue
        if (!byName.has(key)) byName.set(key, [])
        byName.get(key).push(c)
      }

      for (let i = 0; i < rows.length; i++) {
        try {
          const draft = excelRowToPayload(rows[i], mapping)
          if (!draft.tip) throw new Error('Ödəniş tipi tanınmadı (İlkin / Aylıq / Faiz).')
          if (draft.mebleg == null || draft.mebleg <= 0) throw new Error('Məbləğ düzgün deyil.')
          const client = resolveClient(draft, bySira, byName)
          if (!client) {
            throw new Error(
              draft.sira_no != null || draft.ad_soyad
                ? `Müştəri tapılmadı (#${draft.sira_no ?? '—'} / ${draft.ad_soyad || '—'}).`
                : '№ və ya Ad Soyad lazımdır.'
            )
          }
          const payload = {
            musteri_bazasi_id: client.id,
            sira_no: client.sira_no,
            ad_soyad: client.ad_soyad,
            tip: draft.tip,
            mebleg: draft.mebleg,
            tarix: draft.tarix,
            qeyd: draft.qeyd,
            updated_at: new Date().toISOString(),
          }
          const { error: insErr } = await supabase.from(ODENISLER_TABLE).insert(payload)
          if (insErr) throw insErr
          touched.add(client.id)
          ok += 1
        } catch (err) {
          failed += 1
          errors.push(`Sətir ${i + 2}: ${err.message}`)
        }
      }

      for (const mid of touched) {
        const { error: syncErr } = await syncMusteriPaymentTotals(supabase, mid)
        if (syncErr) errors.push(`Sync ${mid}: ${syncErr.message}`)
      }

      setResult({ ok, failed, errors: errors.slice(0, 30) })
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
        <h2 className="card__title" style={{ margin: 0 }}>Ödənişlər — Excel idxal</h2>
        <Link to="/odenisler" className="btn btn--secondary">Geri</Link>
      </div>
      {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}

      {step === 1 && (
        <div className="form-group">
          <label>Excel faylı (.xlsx / .xls / .csv)</label>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} />
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
            Sütunlar: # / № və ya Ad Soyad, Ödəniş tipi (İlkin / Aylıq / Faiz), Məbləğ, Tarix.
          </p>
        </div>
      )}

      {step >= 2 && (
        <>
          <p style={{ fontSize: 13 }}>{fileName} · {rows.length} sətir</p>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Excel</th>
                  <th>Nümunə</th>
                  <th>Sahə</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h) => (
                  <tr key={h}>
                    <td>{h}</td>
                    <td>{String(rows[0]?.[h] ?? '—')}</td>
                    <td>
                      <select
                        value={mapping[h] || ''}
                        onChange={(e) => setMapping((p) => ({ ...p, [h]: e.target.value }))}
                      >
                        <option value="">— Keç —</option>
                        {IMPORT_FIELDS.map((c) => (
                          <option
                            key={c.key}
                            value={c.key}
                            disabled={usedTargets.has(c.key) && mapping[h] !== c.key}
                          >
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
          <p>
            Uğurlu: <strong>{result.ok}</strong>
            {result.failed > 0 && <> · Xəta: <strong>{result.failed}</strong></>}
          </p>
          {result.errors?.length > 0 && (
            <ul style={{ color: 'var(--color-accent)', fontSize: 13 }}>
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          <button type="button" className="btn btn--primary" onClick={() => navigate('/odenisler')}>
            Siyahıya qayıt
          </button>
        </div>
      )}
    </div>
  )
}
