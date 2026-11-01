import { useEffect, useMemo, useState } from 'react'
import { supabase, fetchAllPages } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { DEPO_TABLE, formatCell, getRowValue } from './constants'
import { REF_NOV } from '../mehsul-bazasi/referenceOptions'
import { loadQebzLogo, canvasToPdfBlob, downloadBlob } from '../../lib/qebz'
import { drawQaliqMal, joinPages, canvasToPngBlob, printPages } from '../../lib/qaliqMal'
import { uploadQebzImage } from '../../components/QebzButton'
import { openWhatsApp, waWebUrl } from '../../lib/whatsapp'
import '../../styles/shared.css'

/** Tam məlumatda göstərilməyən sütunlar (hamısı «Mövcud»dur, sənəd sayı lazım deyil) */
const SKIP_TAM = new Set(['status', 'senedler', 'sira_no'])

const STOK_COLS = [
  { key: 'nov', label: 'Növ' },
  { key: 'model', label: 'Model' },
  { key: 'reng', label: 'Rəng' },
  { key: 'yaddas', label: 'Yaddaş' },
  { key: 'miqdar', label: 'Miqdar', align: 'right' },
]

const MAX_PNG = 5 * 1024 * 1024 // fayl yerinin limiti

const lcAz = (v) => String(v || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('az')
const clean = (v) => String(v || '').trim().replace(/\s+/g, ' ')

function rowQty(row) {
  const n = Number(row?.miqdar)
  if (row?.miqdar === null || row?.miqdar === undefined || row?.miqdar === '' || !Number.isFinite(n)) return 1
  return Math.max(0, n)
}

function uniqSorted(values) {
  const seen = new Map()
  for (const v of values) {
    const t = clean(v)
    if (t && !seen.has(lcAz(t))) seen.set(lcAz(t), t)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'az'))
}

const NOV_ORDER = new Map(REF_NOV.map((n, i) => [n.toLowerCase(), i]))
const cmpText = (a, b) => clean(a).localeCompare(clean(b), 'az', { numeric: true, sensitivity: 'base' })

function cmpRows(a, b) {
  const na = NOV_ORDER.get(lcAz(a.nov)) ?? 999
  const nb = NOV_ORDER.get(lcAz(b.nov)) ?? 999
  if (na !== nb) return na - nb
  return (
    cmpText(a.nov, b.nov) ||
    cmpText(a.model, b.model) ||
    cmpText(a.reng, b.reng) ||
    cmpText(a.yaddas, b.yaddas)
  )
}

function todayText() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`
}

function todayIso() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * «Qalıq Mal» düyməsi (Depo): Kateqoriya / Növ seçilir, «Tam məlumat» və ya «Stok»,
 * sonra Yüklə (PDF) / Print / WhatsApp (yalnız link).
 * columns — Depo cədvəlində istifadəçinin gördüyü sütunlar (Tam məlumat üçün).
 */
export default function QaliqMalButton({ columns }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
        Qalıq Mal
      </button>
      {open && <QaliqMalModal columns={columns} onClose={() => setOpen(false)} />}
    </>
  )
}

function QaliqMalModal({ columns, onClose }) {
  const { access } = useAuth()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [kateqoriya, setKateqoriya] = useState('')
  const [nov, setNov] = useState('')
  const [mode, setMode] = useState('')
  const [preview, setPreview] = useState([])
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState('')
  const [note, setNote] = useState('')

  // Yalnız mövcud (satılmamış) mallar — bazanı yalnız oxuyur
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error: e } = await fetchAllPages(() => {
        let q = supabase.from(DEPO_TABLE).select('*').eq('status', 'available').order('sira_no', { ascending: true })
        q = access.applyDataFilters(q, 'depo')
        return q
      })
      if (cancelled) return
      if (e) setError(e.message)
      else setRows(data || [])
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const options = useMemo(() => {
    const list = rows || []
    const kat = lcAz(kateqoriya)
    return {
      kateqoriya: uniqSorted(list.map((r) => r.kateqoriya)),
      nov: uniqSorted(list.filter((r) => !kat || lcAz(r.kateqoriya) === kat).map((r) => r.nov)),
    }
  }, [rows, kateqoriya])

  const selected = useMemo(() => {
    const kat = lcAz(kateqoriya)
    const n = lcAz(nov)
    return (rows || [])
      .filter((r) => (!kat || lcAz(r.kateqoriya) === kat) && (!n || lcAz(r.nov) === n))
      .sort(cmpRows)
  }, [rows, kateqoriya, nov])

  /** Çap üçün hazır məlumat (başlıq, sütunlar, sətirlər) */
  const sheet = useMemo(() => {
    if (!mode) return null
    const subtitle = [kateqoriya && `Kateqoriya: ${kateqoriya}`, nov && `Növ: ${nov}`]
      .filter(Boolean)
      .join(' · ') || 'Bütün mallar'
    const totalQty = selected.reduce((s, r) => s + rowQty(r), 0)

    if (mode === 'stok') {
      // Eyni Növ / Model / Rəng / Yaddaş bir sətirdə, miqdar cəmlənir
      const groups = new Map()
      for (const r of selected) {
        const key = [r.nov, r.model, r.reng, r.yaddas].map(lcAz).join('|')
        const g = groups.get(key)
        if (g) g.qty += rowQty(r)
        else groups.set(key, { r, qty: rowQty(r) })
      }
      return {
        title: 'QALIQ MAL — STOK',
        subtitle,
        tarix: todayText(),
        landscape: false,
        columns: STOK_COLS,
        rows: [...groups.values()].map(({ r, qty }) => [
          clean(r.nov) || '—',
          clean(r.model) || '—',
          clean(r.reng) || '—',
          clean(r.yaddas) || '—',
          String(qty),
        ]),
        total: `Cəmi: ${totalQty} ədəd`,
      }
    }

    const cols = (columns || []).filter((c) => !SKIP_TAM.has(c.key))
    return {
      title: 'QALIQ MAL — TAM MƏLUMAT',
      subtitle,
      tarix: todayText(),
      landscape: true,
      columns: cols.map((c) => ({
        label: c.label,
        align: c.type === 'money' || c.type === 'number' ? 'right' : 'left',
      })),
      rows: selected.map((r) => cols.map((c) => formatCell(getRowValue(r, c), c))),
      total: `Cəmi: ${totalQty} ədəd`,
    }
  }, [mode, selected, columns, kateqoriya, nov])

  async function makePages() {
    const logo = await loadQebzLogo()
    return drawQaliqMal(sheet, logo)
  }

  // Seçim dəyişəndə önbaxış yenilənir, köhnə link silinir
  useEffect(() => {
    setLink('')
    setNote('')
    if (!sheet) {
      setPreview([])
      return
    }
    let cancelled = false
    makePages().then((pages) => {
      if (!cancelled) setPreview(pages.map((c) => c.toDataURL('image/png')))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet])

  const fileBase = `Qaliq-mal-${mode === 'stok' ? 'stok' : 'tam'}-${todayIso()}`

  async function onDownload() {
    setBusy(true)
    try {
      downloadBlob(canvasToPdfBlob(await makePages()), `${fileBase}.pdf`)
    } catch (err) {
      setError(err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  async function onPrint() {
    setBusy(true)
    try {
      printPages(await makePages(), sheet.landscape)
    } catch (err) {
      setError(err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  async function onWhatsApp() {
    setNote('')
    setBusy(true)
    try {
      let url = link
      if (!url) {
        const pages = await makePages()
        let blob = null
        for (const scale of [1, 0.8, 0.6, 0.45]) {
          blob = await canvasToPngBlob(joinPages(pages, scale))
          if (blob.size <= MAX_PNG) break
        }
        if (blob.size > MAX_PNG) {
          setNote('Siyahı çox böyükdür — Kateqoriya və ya Növ seçib kiçildin, ya da «Yüklə» ilə PDF göndərin.')
          return
        }
        url = await uploadQebzImage(blob)
        setLink(url)
      }
      // Mesajda yalnız link — WhatsApp kimə göndərəcəyinizi soruşur
      openWhatsApp('', url)
      setNote('WhatsApp açıldı — söhbəti seçib «Göndər» basın.')
    } catch (err) {
      setNote(`Link yaradılmadı: ${err?.message || String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(link)
      setNote('Link kopyalandı.')
    } catch {
      setNote('Kopyalamaq alınmadı — linki əl ilə seçib kopyalayın.')
    }
  }

  return (
    <div className="telefon-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="card qebz-modal"
        style={{ width: 'min(860px, 96vw)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Qalıq mal"
      >
        <div className="qebz-modal__head">
          <h2 className="card__title" style={{ margin: 0 }}>Qalıq Mal</h2>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Bağla
          </button>
        </div>

        {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}
        {!rows && !error && <p className="empty-state">Yüklənir…</p>}

        {rows && (
          <>
            <div className="qebz-modal__controls">
              <div className="form-group" style={{ marginBottom: 0, width: 190 }}>
                <label>Kateqoriya</label>
                <select
                  value={kateqoriya}
                  onChange={(e) => {
                    setKateqoriya(e.target.value)
                    setNov('')
                  }}
                >
                  <option value="">Hamısı</option>
                  {options.kateqoriya.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0, width: 190 }}>
                <label>Növ</label>
                <select value={nov} onChange={(e) => setNov(e.target.value)}>
                  <option value="">Hamısı</option>
                  {options.nov.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <span className="qebz-modal__note" style={{ alignSelf: 'center' }}>
                {selected.reduce((s, r) => s + rowQty(r), 0)} ədəd mövcuddur
              </span>
            </div>

            <div className="qebz-modal__controls">
              <button
                type="button"
                className={`btn ${mode === 'tam' ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setMode('tam')}
              >
                Tam məlumat
              </button>
              <button
                type="button"
                className={`btn ${mode === 'stok' ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setMode('stok')}
              >
                Stok
              </button>
            </div>

            {!mode && (
              <p className="qebz-modal__note">
                «Tam məlumat» — bütün sütunlar. «Stok» — yalnız Növ / Model / Rəng / Yaddaş / Miqdar.
              </p>
            )}

            {mode && (
              <>
                <div className="qebz-modal__controls">
                  <button type="button" className="btn btn--secondary" disabled={busy} onClick={onDownload}>
                    Yüklə
                  </button>
                  <button type="button" className="btn btn--secondary" disabled={busy} onClick={onPrint}>
                    Print
                  </button>
                  <button type="button" className="btn btn--primary" disabled={busy} onClick={onWhatsApp}>
                    {busy ? 'Hazırlanır…' : 'WhatsApp-a göndər'}
                  </button>
                </div>
                {(note || link) && (
                  <p className="qebz-modal__note">
                    {note}
                    {link && (
                      <>
                        {' '}
                        <a href={link} target="_blank" rel="noopener noreferrer">Linki aç</a>
                        {' · '}
                        <button
                          type="button"
                          onClick={onCopy}
                          style={{ background: 'none', border: 0, padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
                        >
                          Linki kopyala
                        </button>
                        {' · '}
                        <a href={waWebUrl('', link)} target="_blank" rel="noopener noreferrer">WhatsApp Web ilə aç</a>
                      </>
                    )}
                  </p>
                )}
                <div className="qebz-modal__preview">
                  {preview.length ? (
                    preview.map((src, i) => <img key={i} src={src} alt={`Səhifə ${i + 1}`} />)
                  ) : (
                    <p className="empty-state">Hazırlanır…</p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
