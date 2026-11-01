/**
 * Ödəniş qəbzi: şəkil (canvas) çəkir və ondan PDF düzəldir.
 * Kənar paket yoxdur — PDF-i özümüz yığırıq (bir səhifə, içində JPEG şəkil).
 *
 * data: {
 *   tarix: 'YYYY-MM-DD', no: string, qarsiTeref: string, telefon: string,
 *   mebleg: number, odenisNovu: string, emeliyyat: string,
 *   mehsul?: string, yekunBorcText: string, terdibEden: string, qeyd?: string
 * }
 */
import { QEBZ_LOGO } from './qebzLogo'

const W = 1240 // A4, ~150 dpi
const H = 1754
const RED = '#e30613'
const TEXT = '#222'
const MUTED = '#777'
const FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif'

let logoPromise = null

/** Loqo şəkli — yüklənməsə null (yerinə yazı çəkilir) */
export function loadQebzLogo() {
  if (!logoPromise) {
    logoPromise = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = QEBZ_LOGO
    })
  }
  return logoPromise
}

export function formatQebzMoney(value) {
  const n = Number(value) || 0
  const [int, dec] = Math.abs(n).toFixed(2).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${n < 0 ? '−' : ''}${grouped},${dec} AZN`
}

export function formatQebzDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  if (!y || !m || !d) return String(iso)
  return `${d}-${m}-${y}`
}

/** Yazını en-ə görə sətirlərə bölür */
function wrap(ctx, text, maxWidth) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean)
  if (!words.length) return ['—']
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function hLine(ctx, x1, x2, y, color = RED, width = 2) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
}

/** Qəbzi canvas-a çəkir */
export function drawQebz(data, logo) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  const L = 90
  const R = W - 90

  // Yuxarı xətt + loqo
  hLine(ctx, L, R, 80)
  let y = 110
  if (logo) {
    const lw = 520
    const lh = (logo.height / logo.width) * lw
    ctx.drawImage(logo, (W - lw) / 2, y, lw, lh)
    y += lh + 50
  } else {
    ctx.fillStyle = RED
    ctx.font = `bold 72px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('MOBİDEAL', W / 2, y + 80)
    y += 140
  }

  // Başlıq
  ctx.fillStyle = TEXT
  ctx.textAlign = 'center'
  ctx.font = `bold 40px ${FONT}`
  ctx.fillText('ÖDƏNİŞ QƏBZİ', W / 2, y)
  y += 80

  // Tarix və №
  ctx.textAlign = 'left'
  ctx.font = `bold 28px ${FONT}`
  ctx.fillText('Tarix:', L, y)
  ctx.font = `28px ${FONT}`
  ctx.fillText(formatQebzDate(data.tarix), L + 170, y)
  y += 56
  ctx.font = `bold 28px ${FONT}`
  ctx.fillText('Qəbz №:', L, y)
  ctx.font = `28px ${FONT}`
  ctx.fillText(String(data.no || '—'), L + 170, y)
  y += 50

  // Cədvəl
  const rows = [
    ['Qarşı tərəf', data.qarsiTeref],
    ['Telefon', data.telefon || '—'],
    ['Məbləğ', formatQebzMoney(data.mebleg), true],
  ]
  if (data.odenisNovu) rows.push(['Ödəniş növü', data.odenisNovu])
  rows.push(['Əməliyyat növü', data.emeliyyat || '—'])
  if (data.mehsul) rows.push(['Məhsul', data.mehsul])
  if (data.qeyd) rows.push(['Qeyd', data.qeyd])
  rows.push(['Yekun borc', data.yekunBorcText || '—', true])

  const mid = L + (R - L) / 2
  const padX = 18
  const lineH = 38
  ctx.strokeStyle = RED
  ctx.lineWidth = 2
  const top = y
  for (const [label, value, bold] of rows) {
    ctx.font = `${bold ? 'bold ' : ''}27px ${FONT}`
    const lines = wrap(ctx, value, R - mid - padX * 2)
    const rowH = Math.max(1, lines.length) * lineH + 22
    ctx.strokeRect(L, y, R - L, rowH)
    ctx.beginPath()
    ctx.moveTo(mid, y)
    ctx.lineTo(mid, y + rowH)
    ctx.stroke()
    ctx.fillStyle = TEXT
    ctx.font = `27px ${FONT}`
    ctx.fillText(label, L + padX, y + 38)
    ctx.font = `${bold ? 'bold ' : ''}27px ${FONT}`
    lines.forEach((ln, i) => ctx.fillText(ln, mid + padX, y + 38 + i * lineH))
    y += rowH
  }
  if (y === top) y += 10

  // İmzalar
  y += 70
  hLine(ctx, L, R, y)
  y += 60
  ctx.textAlign = 'center'
  ctx.font = `bold 27px ${FONT}`
  ctx.fillText('Qəbzi tərtib edən:', L + (mid - L) / 2, y)
  ctx.fillText('Qəbzi alan:', mid + (R - mid) / 2, y)
  y += 50
  ctx.font = `27px ${FONT}`
  ctx.fillText(data.terdibEden || 'Mobideal', L + (mid - L) / 2, y)
  ctx.fillText(data.qarsiTeref || '—', mid + (R - mid) / 2, y)
  y += 50
  hLine(ctx, L, R, y)
  y += 50
  ctx.fillStyle = MUTED
  ctx.font = `22px ${FONT}`
  ctx.fillText('Bu qəbz elektron qaydada formalaşdırılıb', W / 2, y)

  return canvas
}

function dataUrlToBytes(dataUrl) {
  const b64 = dataUrl.split(',')[1]
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * JPEG şəkillərdən A4 PDF düzəldir — hər şəkil bir səhifə.
 * pages: [{ bytes: Uint8Array, w: number, h: number }]
 */
export function jpegPagesToPdfBlob(pages) {
  const enc = new TextEncoder()
  // A4: şəkil enlidirsə səhifə yan (landşaft) qoyulur
  const A4S = 595.28
  const A4L = 841.89
  const parts = []
  const offsets = []
  let length = 0
  const push = (chunk) => {
    const bytes = typeof chunk === 'string' ? enc.encode(chunk) : chunk
    parts.push(bytes)
    length += bytes.length
  }
  const obj = (n, body) => {
    offsets[n] = length
    push(`${n} 0 obj\n`)
    for (const b of body) push(b)
    push('\nendobj\n')
  }

  // 1 = Catalog, 2 = Pages, sonra hər səhifə üçün 3 obyekt: Page, Image, Contents
  const n = pages.length
  const pageObj = (i) => 3 + i * 3
  push('%PDF-1.4\n')
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>'])
  const kids = pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')
  obj(2, [`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`])
  pages.forEach((pg, i) => {
    const po = pageObj(i)
    const pageW = pg.w > pg.h ? A4L : A4S
    const pageH = pg.w > pg.h ? A4S : A4L
    const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`
    obj(po, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 ${po + 1} 0 R >> >> /Contents ${po + 2} 0 R >>`,
    ])
    obj(po + 1, [
      `<< /Type /XObject /Subtype /Image /Width ${pg.w} /Height ${pg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.bytes.length} >>\nstream\n`,
      pg.bytes,
      '\nendstream',
    ])
    obj(po + 2, [`<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`])
  })

  const total = 3 + n * 3
  const xref = length
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`
  for (let k = 1; k < total; k++) x += `${String(offsets[k]).padStart(10, '0')} 00000 n \n`
  push(x)
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts, { type: 'application/pdf' })
}

/** Köhnə ad: bir şəkil → bir səhifəlik PDF */
export function jpegToPdfBlob(jpegBytes, imgW, imgH) {
  return jpegPagesToPdfBlob([{ bytes: jpegBytes, w: imgW, h: imgH }])
}

/** Bir və ya bir neçə canvas → PDF (hər canvas bir səhifə) */
export function canvasToPdfBlob(canvasOrList) {
  const list = Array.isArray(canvasOrList) ? canvasOrList : [canvasOrList]
  return jpegPagesToPdfBlob(
    list.map((c) => ({ bytes: dataUrlToBytes(c.toDataURL('image/jpeg', 0.9)), w: c.width, h: c.height }))
  )
}

export function qebzFileName(data) {
  const safe = String(data.qarsiTeref || 'qebz')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
  return `Qebz-${String(data.no || '').replace(/[^\w-]+/g, '-')}-${safe}.pdf`
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Telefonu WhatsApp üçün 994XXXXXXXXX formatına salır; alınmasa '' */
export function waPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('994')) return d.length === 12 ? d : ''
  if (d.startsWith('0')) d = d.slice(1)
  if (d.length === 9) return `994${d}`
  return ''
}

/** WhatsApp-a göndərmək üçün qısa mətn */
export function qebzMessage(data) {
  return [
    `Ödəniş qəbzi № ${data.no}`,
    `Tarix: ${formatQebzDate(data.tarix)}`,
    `Məbləğ: ${formatQebzMoney(data.mebleg)}`,
    `Yekun borc: ${data.yekunBorcText}`,
    'Mobideal',
  ].join('\n')
}
