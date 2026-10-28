import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  loadQebzLogo,
  drawQebz,
  canvasToPdfBlob,
  qebzFileName,
  downloadBlob,
  waPhone,
  qebzMessage,
} from '../lib/qebz'
import { drawKreditCixaris, kreditMessage } from '../lib/kreditQebz'
import '../styles/shared.css'

/**
 * «Qəbz» düyməsi: klikləyəndə qəbz pəncərəsi açılır (önbaxış, PDF yüklə, WhatsApp).
 * buildData: () => Promise<qəbz məlumatı> — klikləyəndə çağırılır (bazanı yalnız oxuyur).
 */
export default function QebzButton({ buildData, label = 'Qəbz', className = 'btn btn--secondary', style }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={className}
        style={style}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        {label}
      </button>
      {open && <QebzModal buildData={buildData} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Qəbzi səhifə-səhifə canvas-a çəkir */
function renderPages(d, logo) {
  return d.kind === 'kredit' ? drawKreditCixaris(d, logo) : [drawQebz(d, logo)]
}

function QebzModal({ buildData, onClose }) {
  const { profile } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [phone, setPhone] = useState('')
  const [preview, setPreview] = useState([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const terdibEden = profile?.display_name || 'Mobideal'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await buildData()
        if (cancelled) return
        setData({ ...d, terdibEden })
        setPhone(d.telefon || '')
      } catch (err) {
        if (!cancelled) setError(err?.message || String(err))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Telefon dəyişəndə önbaxış yenilənir
  useEffect(() => {
    if (!data) return
    let cancelled = false
    loadQebzLogo().then((logo) => {
      if (cancelled) return
      const pages = renderPages({ ...data, telefon: phone }, logo)
      setPreview(pages.map((c) => c.toDataURL('image/png')))
    })
    return () => {
      cancelled = true
    }
  }, [data, phone])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function makePdf() {
    const logo = await loadQebzLogo()
    const full = { ...data, telefon: phone }
    const pages = renderPages(full, logo)
    return { blob: canvasToPdfBlob(pages), name: qebzFileName(full), full }
  }

  async function onDownload() {
    setBusy(true)
    setNote('')
    try {
      const { blob, name } = await makePdf()
      downloadBlob(blob, name)
    } catch (err) {
      setError(err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  async function onWhatsApp() {
    setBusy(true)
    setNote('')
    try {
      const { blob, name, full } = await makePdf()
      const text = full.kind === 'kredit' ? kreditMessage(full) : qebzMessage(full)
      const file = new File([blob], name, { type: 'application/pdf' })
      // Telefonda (və bəzi kompüterlərdə) faylı birbaşa paylaşmaq olur → WhatsApp seçilir
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text })
          return
        } catch (err) {
          if (err?.name === 'AbortError') return
        }
      }
      // Olmazsa: PDF yüklənir, WhatsApp həmin nömrə ilə açılır, faylı əlavə edirsiniz
      downloadBlob(blob, name)
      const num = waPhone(phone)
      const url = `https://wa.me/${num}?text=${encodeURIComponent(text)}`
      window.open(url, '_blank', 'noopener')
      setNote(
        num
          ? 'PDF yükləndi. WhatsApp açıldı — yüklənmiş PDF faylını söhbətə əlavə edib göndərin.'
          : 'PDF yükləndi. Telefon nömrəsi düzgün deyil, WhatsApp-da kontaktı özünüz seçin.'
      )
    } catch (err) {
      setError(err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  const title = data?.kind === 'kredit' ? 'Kredit çıxarışı' : 'Ödəniş qəbzi'

  return (
    <div className="telefon-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="card qebz-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="qebz-modal__head">
          <h2 className="card__title" style={{ margin: 0 }}>{title}</h2>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Bağla
          </button>
        </div>

        {error && <p style={{ color: 'var(--color-accent)' }}>{error}</p>}
        {!data && !error && <p className="empty-state">Hazırlanır…</p>}

        {data && (
          <>
            <div className="qebz-modal__controls">
              <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
                <label>WhatsApp nömrəsi</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="məs. 050 123 45 67"
                  inputMode="tel"
                />
              </div>
              <button type="button" className="btn btn--secondary" disabled={busy} onClick={onDownload}>
                PDF yüklə
              </button>
              <button type="button" className="btn btn--primary" disabled={busy} onClick={onWhatsApp}>
                WhatsApp-a göndər
              </button>
            </div>
            {note && <p className="qebz-modal__note">{note}</p>}
            <div className="qebz-modal__preview">
              {preview.length ? (
                preview.map((src, i) => <img key={i} src={src} alt={`Səhifə ${i + 1}`} />)
              ) : (
                <p className="empty-state">Hazırlanır…</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
