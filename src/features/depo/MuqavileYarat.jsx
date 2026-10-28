import { useEffect, useState } from 'react'
import { docxToHtml, DOCX_HTML_CSS } from './muqavile'

/** Çap / baxış üçün tam HTML səhifə */
function pageHtml(bodyHtml, title, forPrint) {
  const screen = forPrint
    ? ''
    : `body{background:#e9ecef;margin:0;padding:16px}
       .dx-doc{max-width:210mm;margin:0 auto;padding:18mm 16mm;box-shadow:0 2px 12px rgba(0,0,0,.15)}
       .dx-doc .dx-page-break{border-top:2px dashed #adb5bd;margin:14mm -16mm}`
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    @page{size:A4;margin:15mm 15mm}
    html,body{margin:0}
    ${DOCX_HTML_CSS}
    ${screen}
  </style></head><body><div class="dx-doc">${bodyHtml}</div></body></html>`
}

export function printHtmlDocument(html) {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(iframe)
  const win = iframe.contentWindow
  win.document.open()
  win.document.write(html)
  win.document.close()
  const cleanup = () => setTimeout(() => iframe.remove(), 1000)
  setTimeout(() => {
    win.focus()
    win.addEventListener('afterprint', cleanup, { once: true })
    win.print()
    setTimeout(cleanup, 60000)
  }, 250)
}

function DocxPreviewModal({ file, html, onClose, onPrint, onDownload }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="telefon-modal-overlay depo-file-preview-overlay" onClick={onClose} role="presentation">
      <div className="card depo-file-preview" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={file.name}>
        <div className="depo-file-preview__header">
          <h2 className="card__title depo-file-preview__title" title={file.name}>
            {file.name}
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--secondary" onClick={onDownload}>
              Yüklə
            </button>
            <button type="button" className="btn btn--secondary" onClick={onPrint}>
              Çap et
            </button>
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Bağla
            </button>
          </div>
        </div>
        <div className="depo-file-preview__body" style={{ padding: 0 }}>
          {html == null ? (
            <p style={{ padding: 16 }}>Yüklənir…</p>
          ) : (
            <iframe title={file.name} srcDoc={pageHtml(html, file.name, false)} style={{ height: '80vh' }} />
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Kredit satışında «Fayl Yarat»: YARAT → müqavilə (Word) yaranır, altında Bax / Yüklə / Çap et.
 * @param {{ file: File|null, onCreate: () => Promise<File>, onChange: (f: File|null) => void, disabledReason?: string, stale?: boolean }} p
 */
export default function MuqavileYarat({
  file,
  onCreate,
  onChange,
  disabledReason,
  stale = false,
  title = 'Fayl Yarat',
  buttonLabel = 'YARAT',
  note = 'Satış tamamlananda müqavilə son məlumatlarla yenidən hazırlanıb müştərinin sənədlərinə əlavə olunacaq.',
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null) // { html }

  async function create() {
    setError(null)
    setBusy(true)
    try {
      const f = await onCreate()
      onChange(f)
    } catch (err) {
      setError(err?.message || 'Müqavilə yaradılmadı.')
    } finally {
      setBusy(false)
    }
  }

  function download() {
    if (!file) return
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  async function openPreview() {
    if (!file) return
    setError(null)
    setPreview({ html: null })
    try {
      setPreview({ html: await docxToHtml(file) })
    } catch (err) {
      setPreview(null)
      setError(err?.message || 'Faylı göstərmək olmadı.')
    }
  }

  async function print() {
    if (!file) return
    setError(null)
    try {
      const html = preview?.html || (await docxToHtml(file))
      printHtmlDocument(pageHtml(html, file.name, true))
    } catch (err) {
      setError(err?.message || 'Çap etmək olmadı.')
    }
  }

  return (
    <div className="depo-box muqavile-yarat">
      <div className="depo-files__title">{title}</div>
      <div>
        <button
          type="button"
          className="btn btn--primary muqavile-yarat__btn"
          onClick={create}
          disabled={busy || Boolean(disabledReason)}
          title={disabledReason || 'Müqaviləni (Word) yarat'}
        >
          {busy ? 'Yaradılır…' : file ? `YENİDƏN ${buttonLabel}` : buttonLabel}
        </button>
        {disabledReason && <span className="depo-msg depo-msg--hint" style={{ marginLeft: 12 }}>{disabledReason}</span>}
      </div>
      {error && <p className="depo-msg" style={{ color: 'var(--color-accent)' }}>{error}</p>}
      {file && (
        <div className="depo-file-slot">
          <span className="depo-file-slot__name" title={file.name}>
            {file.name}
          </span>
          <button type="button" className="btn btn--secondary depo-file-slot__btn" onClick={openPreview}>
            Bax
          </button>
          <button type="button" className="btn btn--secondary depo-file-slot__btn" onClick={download}>
            Yüklə
          </button>
          <button type="button" className="btn btn--secondary depo-file-slot__btn" onClick={print}>
            Çap et
          </button>
        </div>
      )}
      {file && stale && (
        <p className="depo-msg" style={{ margin: 0, color: '#e65100' }}>
          Formda məlumat dəyişib — faylı yeniləmək üçün «YENİDƏN {buttonLabel}» basın.
        </p>
      )}
      {file && (
        <p className="depo-msg depo-msg--hint" style={{ margin: 0 }}>
          {note}
        </p>
      )}
      {preview && file && (
        <DocxPreviewModal
          file={file}
          html={preview.html}
          onClose={() => setPreview(null)}
          onPrint={print}
          onDownload={download}
        />
      )}
    </div>
  )
}
