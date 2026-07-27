import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { useColumnConfig } from './useColumnConfig'
import {
  MUSTERI_TABLE,
  MUSTERILER_TABLE,
  toMusteriPayload,
  toMusterilerPayload,
} from './constants'
import {
  parseExcelFile,
  suggestMapping,
  getImportableColumns,
  excelRowToForm,
  IMPORT_SKIP_KEYS,
} from './excelImportUtils'
import '../../styles/shared.css'

const SKIP = ''

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
  const columnsByKey = useMemo(
    () => new Map(columns.map((c) => [c.key, c])),
    [columns]
  )

  const usedTargets = useMemo(() => {
    const set = new Set()
    for (const v of Object.values(mapping)) {
      if (v) set.add(v)
    }
    return set
  }, [mapping])

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
      setMapping(suggestMapping(parsed.headers, importable))
      setStep(2)
    } catch (err) {
      setError(err?.message ?? 'Excel oxunmadı.')
    }
  }

  function setMap(header, dbKey) {
    setMapping((prev) => ({ ...prev, [header]: dbKey }))
  }

  const mappedAdSoyad = Object.values(mapping).includes('ad_soyad')

  const previewRows = useMemo(() => {
    return rows.slice(0, 5).map((r) => excelRowToForm(r, mapping, columnsByKey))
  }, [rows, mapping, columnsByKey])

  async function ensureMusteriId(form, cache) {
    const name = (form.ad_soyad || '').trim()
    if (!name) throw new Error('Ad Soyad boş olan sətir var.')
    const key = name.toLowerCase()
    if (cache.has(key)) return cache.get(key)

    const { data: existing } = await supabase
      .from(MUSTERILER_TABLE)
      .select('id')
      .ilike('ad_soyad', name)
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      const person = toMusterilerPayload(form)
      await supabase.from(MUSTERILER_TABLE).update(person).eq('id', existing.id)
      cache.set(key, existing.id)
      return existing.id
    }

    const { data, error: insErr } = await supabase
      .from(MUSTERILER_TABLE)
      .insert(toMusterilerPayload(form))
      .select('id')
      .single()
    if (insErr) throw insErr
    cache.set(key, data.id)
    return data.id
  }

  async function runImport() {
    setError(null)
    setResult(null)
    if (!mappedAdSoyad) {
      setError('«Ad Soyad Ata adı» sütununu mütləq map edin.')
      return
    }
    setImporting(true)
    const cache = new Map()
    let ok = 0
    let failed = 0
    let skipped = 0
    const errors = []
    const skipNotes = []

    try {
      // warm cache with existing customers
      const { data: allCust } = await fetchAllPages(() =>
        supabase.from(MUSTERILER_TABLE).select('id, ad_soyad')
      )
      for (const c of allCust || []) {
        if (c.ad_soyad) cache.set(c.ad_soyad.trim().toLowerCase(), c.id)
      }

      // Existing # / № values — skip Excel rows that already exist in DB
      const existingSira = new Set()
      const { data: siraRows, error: siraErr } = await fetchAllPages(() =>
        supabase.from(MUSTERI_TABLE).select('sira_no').not('sira_no', 'is', null)
      )
      if (siraErr) throw siraErr
      for (const r of siraRows || []) {
        const n = Number(r.sira_no)
        if (!Number.isNaN(n)) existingSira.add(n)
      }

      for (let i = 0; i < rows.length; i++) {
        try {
          const form = excelRowToForm(rows[i], mapping, columnsByKey)
          if (!form.ad_soyad?.trim()) {
            failed += 1
            errors.push(`Sətir ${i + 2}: Ad Soyad boşdur`)
            continue
          }

          const siraRaw = form.sira_no
          if (siraRaw !== '' && siraRaw != null) {
            const sira = Math.trunc(Number(String(siraRaw).replace(/\s/g, '').replace(',', '.')))
            if (!Number.isNaN(sira)) {
              if (existingSira.has(sira)) {
                skipped += 1
                if (skipNotes.length < 20) {
                  skipNotes.push(`Sətir ${i + 2}: # ${sira} artıq mövcuddur — keçildi`)
                }
                continue
              }
              existingSira.add(sira) // also skip later duplicates inside the same Excel file
            }
          }

          const musteriId = await ensureMusteriId(form, cache)
          const payload = toMusteriPayload(form, musteriId, columns)
          const { error: insErr } = await supabase.from(MUSTERI_TABLE).insert(payload)
          if (insErr) throw insErr
          ok += 1
        } catch (err) {
          failed += 1
          errors.push(`Sətir ${i + 2}: ${err.message || err}`)
        }
      }
      setResult({ ok, failed, skipped, errors: errors.slice(0, 20), skipNotes })
      setStep(3)
    } catch (err) {
      setError(err?.message ?? 'İdxal uğursuz oldu.')
    } finally {
      setImporting(false)
    }
  }

  if (colsLoading) {
    return (
      <div className="card">
        <p className="empty-state">Yüklənir…</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 'var(--space-md)' }}>
        <h2 className="card__title" style={{ margin: 0 }}>Excel idxal</h2>
        <Link to="/musteri-bazasi" className="btn btn--secondary">Geri</Link>
      </div>

      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 'var(--space-lg)' }}>
        Excel (.xlsx / .xls / .csv) yükləyin, sütunları bazadakı sahələrə uyğunlaşdırın və idxal edin.
        Avtomatik sahələr (Gözlənilən gəlir, Qalan borc və s.) map edilmir — sistem hesablayır.
        Əgər <strong># / №</strong> artıq bazada (və ya eyni faylda) varsa, həmin sətir keçilir.
      </p>

      {error && (
        <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>{error}</p>
      )}

      {step === 1 && (
        <div className="form-group">
          <label htmlFor="excel-file">Excel faylı seçin</label>
          <input
            id="excel-file"
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            onChange={onFileChange}
          />
        </div>
      )}

      {step >= 2 && (
        <>
          <p style={{ fontSize: 13, marginBottom: 'var(--space-md)' }}>
            Fayl: <strong>{fileName}</strong> · {rows.length} sətir · {headers.length} sütun
          </p>

          <h3 className="card__title">Sütun uyğunlaşdırma (mapping)</h3>
          <div className="table-wrap" style={{ marginBottom: 'var(--space-lg)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Excel sütunu</th>
                  <th>Nümunə dəyər</th>
                  <th>Bazadakı sahə</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h) => (
                  <tr key={h}>
                    <td>{h}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {String(rows[0]?.[h] ?? '—')}
                    </td>
                    <td>
                      <select
                        value={mapping[h] ?? SKIP}
                        onChange={(e) => setMap(h, e.target.value)}
                      >
                        <option value={SKIP}>— Keç (idxal etmə) —</option>
                        {importable.map((c) => (
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

          {!mappedAdSoyad && (
            <p style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-md)' }}>
              Xəbərdarlıq: «Ad Soyad Ata adı» map edilməlidir.
            </p>
          )}

          <h3 className="card__title">Önizləmə (ilk 5 sətir)</h3>
          <div className="table-wrap" style={{ marginBottom: 'var(--space-lg)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>Model</th>
                  <th>Alış</th>
                  <th>Satış</th>
                  <th>Vəziyyət</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.ad_soyad || '—'}</td>
                    <td>{r.model || '—'}</td>
                    <td>{r.alis_qiymeti || '—'}</td>
                    <td>{r.satis_qiymeti || '—'}</td>
                    <td>{r.veziyyet || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--primary"
              disabled={importing || !mappedAdSoyad}
              onClick={runImport}
            >
              {importing ? `İdxal olunur…` : `${rows.length} sətiri idxal et`}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={importing}
              onClick={() => {
                setStep(1)
                setHeaders([])
                setRows([])
                setMapping({})
                setFileName('')
              }}
            >
              Başqa fayl
            </button>
          </div>
        </>
      )}

      {step === 3 && result && (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <h3 className="card__title">Nəticə</h3>
          <p>
            Uğurlu: <strong>{result.ok}</strong>
            {result.skipped > 0 && (
              <>
                {' '}
                · Keçildi (dublikat #): <strong>{result.skipped}</strong>
              </>
            )}
            {result.failed > 0 && (
              <>
                {' '}
                · Xəta: <strong style={{ color: 'var(--color-accent)' }}>{result.failed}</strong>
              </>
            )}
          </p>
          {result.skipNotes?.length > 0 && (
            <ul style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {result.skipNotes.map((e, i) => (
                <li key={`skip-${i}`}>{e}</li>
              ))}
            </ul>
          )}
          {result.errors?.length > 0 && (
            <ul style={{ fontSize: 13, color: 'var(--color-accent)' }}>
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
            <button type="button" className="btn btn--primary" onClick={() => navigate('/musteri-bazasi')}>
              Siyahıya qayıt
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setStep(1)
                setResult(null)
                setHeaders([])
                setRows([])
                setMapping({})
              }}
            >
              Yenidən idxal
            </button>
          </div>
        </div>
      )}

      <p style={{ marginTop: 'var(--space-lg)', fontSize: 12, color: 'var(--color-text-muted)' }}>
        Qeyd: avtomatik sahələr map edilmir: {[...IMPORT_SKIP_KEYS].join(', ')}.
        Excel-də <strong>#</strong> və ya <strong>№</strong> sütununu «# / №» sahəsinə uyğunlaşdıra bilərsiniz.
      </p>
    </div>
  )
}
