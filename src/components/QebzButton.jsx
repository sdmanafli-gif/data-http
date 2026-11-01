import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
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
import { openWhatsApp, waWebUrl } from '../lib/whatsapp'
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

/** Səhifədə məzmunun bitdiyi hündürlük (aşağıdakı boş ağ hissə kəsilir) */
function contentHeight(canvas) {
  const { width, height } = canvas
  const px = canvas.getContext('2d').getImageData(0, 0, width, height).data
  // Ən altdakı səhifə nömrəsi («Səhifə 1 / 2») nəzərə alınmır
  for (let y = height - 120; y > 0; y -= 1) {
    const row = y * width * 4
    for (let x = 0; x < width; x += 4) {
      const i = row + x * 4
      if (px[i] < 245 || px[i + 1] < 245 || px[i + 2] < 245) return Math.min(height, y + 40)
    }
  }
  return height
}

const QEBZ_BUCKET = 'q'
const QISA_LINK = 'https://qbz-az.netlify.app'

/**
 * Qəbz şəklini fayl yerinə yükləyir, qısa linkini qaytarır: qbz-az.netlify.app/xxxxxxxxxx
 * (ayrıca kiçik Netlify saytı — əsas saytla əlaqəsi yoxdur, yalnız «q» fayl yerinə yönləndirir).
 * Ad — 10 simvolluq təsadüfi, təxmin etmək olmur.
 */
export async function uploadQebzImage(blob) {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const rnd = crypto.getRandomValues(new Uint8Array(10))
  const name = Array.from(rnd, (n) => abc[n % abc.length]).join('')
  const { error } = await supabase.storage
    .from(QEBZ_BUCKET)
    .upload(name, blob, { contentType: 'image/png', cacheControl: '31536000', upsert: false })
  if (error) throw error
  return `${QISA_LINK}/${name}`
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
  const [webLink, setWebLink] = useState('')
  const phoneRef = useRef(null)

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

  /** Qəbzin bütün səhifələrini bir şəkilə (PNG) yığır — boş ağ yerlər kəsilir */
  async function makeImageBlob() {
    const logo = await loadQebzLogo()
    const pages = renderPages({ ...data, telefon: phone }, logo)
    const parts = pages.map((c) => ({ c, h: contentHeight(c) }))
    const gap = 16
    const out = document.createElement('canvas')
    out.width = pages[0].width
    out.height = parts.reduce((s, p) => s + p.h, 0) + gap * (parts.length - 1)
    const ctx = out.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, out.width, out.height)
    let y = 0
    for (const p of parts) {
      ctx.drawImage(p.c, 0, 0, p.c.width, p.h, 0, y, p.c.width, p.h)
      y += p.h + gap
    }
    return new Promise((resolve, reject) =>
      out.toBlob((b) => (b ? resolve(b) : reject(new Error('Şəkil yaradılmadı'))), 'image/png')
    )
  }

  async function onWhatsApp() {
    setNote('')
    setWebLink('')
    // Nömrə yoxdursa WhatsApp «kimə göndərim» soruşur — əvvəlcə nömrəni istəyirik
    if (!waPhone(phone)) {
      setNote('Müştərinin WhatsApp nömrəsi yoxdur və ya düzgün deyil. Yuxarıdakı xanaya nömrəni yazıb yenidən basın.')
      phoneRef.current?.focus()
      return
    }
    setBusy(true)
    const isMobile =
      navigator.userAgentData?.mobile === true || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
    const full0 = { ...data, telefon: phone }
    const text = full0.kind === 'kredit' ? kreditMessage(full0) : qebzMessage(full0)
    const num = waPhone(phone)
    try {
      // 1) Qəbz şəkli fayl yerinə yüklənir, mesaja linki əlavə olunur — müştərinin söhbəti hazır mesajla açılır
      let link = ''
      try {
        link = await uploadQebzImage(await makeImageBlob())
      } catch {
        link = ''
      }
      if (link) {
        let msg
        if (full0.kind === 'ledger') {
          // Borc / Nisyə: qısa yazı, link aralarında 2 boş sətirlə
          msg = [
            'Yekun məbləği öyrənmək üçün zəhmət olmasa, Linkə daxil olun',
            '',
            '',
            link,
            '',
            '',
            'Hörmətlə, Mobideal',
          ].join('\n')
        } else {
          const lines = text.split('\n')
          const last = lines.pop()
          msg = [...lines, '', `Qəbz: ${link}`, '', last].join('\n')
        }
        openWhatsApp(num, msg)
        setWebLink(waWebUrl(num, msg))
        setNote('WhatsApp müştərinin söhbətində açıldı — mesaj və qəbz linki hazırdır, sadəcə «Göndər» basın.')
        return
      }
      // 2) Yükləmək alınmadısa — köhnə qayda
      if (isMobile) {
        // Telefonda: qəbz şəkli + yazı birbaşa paylaşılır (WhatsApp seçilir)
        const blob = await makeImageBlob()
        const file = new File([blob], qebzFileName(full0).replace(/\.pdf$/i, '.png'), { type: 'image/png' })
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], text })
            return
          } catch (err) {
            if (err?.name === 'AbortError') return
          }
        }
        openWhatsApp(num, text)
        return
      }
      // Kompüterdə: qəbz şəkli panoya kopyalanır, WhatsApp söhbəti açılır — Ctrl+V
      let copied = false
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': makeImageBlob() })])
        copied = true
      } catch {
        copied = false
      }
      openWhatsApp(num, text)
      setWebLink(waWebUrl(num, text))
      setNote(
        copied
          ? 'Qəbz linki yaradılmadı. Şəkil kopyalandı — WhatsApp söhbətində Ctrl+V basıb göndərin.'
          : 'WhatsApp müştərinin söhbətində açıldı. Şəkli kopyalamaq alınmadı — «PDF yüklə» ilə faylı əlavə edin.'
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
                  ref={phoneRef}
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
            {note && (
              <p className="qebz-modal__note">
                {note}
                {webLink && (
                  <>
                    {' '}
                    Tətbiq açılmadısa:{' '}
                    <a href={webLink} target="_blank" rel="noopener noreferrer">
                      WhatsApp Web ilə aç
                    </a>
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
      </div>
    </div>
  )
}
