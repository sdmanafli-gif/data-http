/**
 * «Qalıq mal» siyahısı: Depoda mövcud malları A4 səhifələrə (canvas) çəkir.
 * Səhifələrdən PDF (yüklə), çap (print) və bir uzun şəkil (WhatsApp linki) düzəldilir.
 *
 * data: {
 *   title: string, subtitle: string, tarix: string,
 *   columns: [{ label: string, align?: 'left'|'right'|'center' }],
 *   rows: string[][], total: string, landscape: boolean
 * }
 */

const RED = '#e30613'
const TEXT = '#222'
const MUTED = '#777'
const STRIPE = '#f6f6f6'
const FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif'

const PAD_X = 10
const PAD_Y = 8

/** Sözləri en-ə görə sətirlərə bölür; çox uzun sözü (IMEI və s.) hərf-hərf bölür */
function wrapCell(ctx, text, maxWidth) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines = []
  let line = ''
  const pushLong = (w) => {
    let part = ''
    for (const ch of w) {
      if (ctx.measureText(part + ch).width > maxWidth && part) {
        lines.push(part)
        part = ch
      } else part += ch
    }
    return part
  }
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width <= maxWidth) {
      line = test
      continue
    }
    if (line) lines.push(line)
    line = ctx.measureText(w).width > maxWidth ? pushLong(w) : w
  }
  if (line) lines.push(line)
  return lines
}

/** Sütun enləri: məzmuna görə; sığmasa şrift kiçilir, yenə sığmasa yazı sətirlərə bölünür */
function layoutColumns(ctx, data, avail) {
  const measure = (f) => {
    return data.columns.map((c, i) => {
      ctx.font = `bold ${f}px ${FONT}`
      let w = ctx.measureText(c.label).width
      ctx.font = `${f}px ${FONT}`
      for (const r of data.rows) w = Math.max(w, ctx.measureText(String(r[i] ?? '')).width)
      return Math.ceil(w) + PAD_X * 2
    })
  }
  let font = 22
  let widths = measure(font)
  while (widths.reduce((a, b) => a + b, 0) > avail && font > 14) {
    font -= 1
    widths = measure(font)
  }
  const sum = widths.reduce((a, b) => a + b, 0)
  if (sum <= avail) {
    // Artıq yer sütunlara bərabər paylanır
    const extra = (avail - sum) / widths.length
    widths = widths.map((w) => w + extra)
  } else {
    // Sığmır: enlər azaldılır (hər sütuna ən azı başlığın sözü qədər yer)
    const min = data.columns.map(() => 60)
    const flex = widths.map((w, i) => Math.max(0, w - min[i]))
    const flexSum = flex.reduce((a, b) => a + b, 0)
    const room = avail - min.reduce((a, b) => a + b, 0)
    widths = widths.map((_, i) => min[i] + (flexSum ? (flex[i] / flexSum) * room : 0))
  }
  return { font, widths }
}

function newPage(W, H) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'
  return { c, ctx }
}

function hLine(ctx, x1, x2, y, color = RED, width = 2) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
}

/** Siyahını A4 səhifələrə çəkir, canvas siyahısı qaytarır */
export function drawQaliqMal(data, logo) {
  const W = data.landscape ? 1754 : 1240
  const H = data.landscape ? 1240 : 1754
  const L = 60
  const R = W - 60
  const BOTTOM = H - 90

  const probe = newPage(10, 10).ctx
  const { font, widths } = layoutColumns(probe, data, R - L)
  const lineH = Math.round(font * 1.3)

  // Hər sətirin hündürlüyü (bölünmüş yazıya görə)
  probe.font = `${font}px ${FONT}`
  const rowLines = data.rows.map((r) => r.map((v, i) => wrapCell(probe, v, widths[i] - PAD_X * 2)))
  probe.font = `bold ${font}px ${FONT}`
  const headLines = data.columns.map((c, i) => wrapCell(probe, c.label, widths[i] - PAD_X * 2))
  const headH = Math.max(...headLines.map((l) => l.length)) * lineH + PAD_Y * 2

  const pages = []
  let page = null
  let y = 0

  const drawHead = () => {
    const { ctx } = page
    ctx.fillStyle = RED
    ctx.fillRect(L, y, R - L, headH)
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${font}px ${FONT}`
    let x = L
    data.columns.forEach((c, i) => {
      headLines[i].forEach((t, k) => {
        ctx.textAlign = 'left'
        ctx.fillText(t, x + PAD_X, y + PAD_Y + (k + 1) * lineH - Math.round(lineH * 0.25))
      })
      x += widths[i]
    })
    y += headH
  }

  const startPage = (first) => {
    page = newPage(W, H)
    pages.push(page)
    const { ctx } = page
    hLine(ctx, L, R, 50)
    y = 74
    if (first) {
      if (logo) {
        const lw = 300
        const lh = (logo.height / logo.width) * lw
        ctx.drawImage(logo, L, y, lw, lh)
      } else {
        ctx.fillStyle = RED
        ctx.font = `bold 48px ${FONT}`
        ctx.textAlign = 'left'
        ctx.fillText('MOBİDEAL', L, y + 50)
      }
      ctx.fillStyle = TEXT
      ctx.textAlign = 'right'
      ctx.font = `bold 38px ${FONT}`
      ctx.fillText(data.title, R, y + 40)
      ctx.font = `24px ${FONT}`
      ctx.fillStyle = MUTED
      ctx.fillText(`Tarix: ${data.tarix}`, R, y + 80)
      if (data.subtitle) ctx.fillText(data.subtitle, R, y + 114)
      y += 150
    } else {
      ctx.fillStyle = MUTED
      ctx.textAlign = 'left'
      ctx.font = `22px ${FONT}`
      ctx.fillText(`${data.title} (davamı)`, L, y + 10)
      y += 36
    }
    drawHead()
  }

  startPage(true)

  data.rows.forEach((r, ri) => {
    const rh = Math.max(...rowLines[ri].map((l) => l.length)) * lineH + PAD_Y * 2
    if (y + rh > BOTTOM) startPage(false)
    const { ctx } = page
    if (ri % 2 === 1) {
      ctx.fillStyle = STRIPE
      ctx.fillRect(L, y, R - L, rh)
    }
    ctx.fillStyle = TEXT
    ctx.font = `${font}px ${FONT}`
    let x = L
    r.forEach((_, i) => {
      const align = data.columns[i].align || 'left'
      rowLines[ri][i].forEach((t, k) => {
        const ty = y + PAD_Y + (k + 1) * lineH - Math.round(lineH * 0.25)
        if (align === 'right') {
          ctx.textAlign = 'right'
          ctx.fillText(t, x + widths[i] - PAD_X, ty)
        } else if (align === 'center') {
          ctx.textAlign = 'center'
          ctx.fillText(t, x + widths[i] / 2, ty)
        } else {
          ctx.textAlign = 'left'
          ctx.fillText(t, x + PAD_X, ty)
        }
      })
      x += widths[i]
    })
    y += rh
    hLine(ctx, L, R, y, '#e2e2e2', 1)
  })

  if (!data.rows.length) {
    const { ctx } = page
    ctx.fillStyle = MUTED
    ctx.textAlign = 'center'
    ctx.font = `24px ${FONT}`
    ctx.fillText('Seçilən üzrə mövcud mal yoxdur', W / 2, y + 50)
    y += 80
  }

  // Cəm
  if (data.total) {
    if (y + 70 > BOTTOM) startPage(false)
    const { ctx } = page
    hLine(ctx, L, R, y + 4)
    ctx.fillStyle = TEXT
    ctx.textAlign = 'right'
    ctx.font = `bold 26px ${FONT}`
    ctx.fillText(data.total, R, y + 46)
    y += 60
  }

  // Səhifə nömrələri
  pages.forEach((p, i) => {
    p.ctx.fillStyle = MUTED
    p.ctx.font = `20px ${FONT}`
    p.ctx.textAlign = 'left'
    p.ctx.fillText('Mobideal', L, H - 45)
    p.ctx.textAlign = 'right'
    p.ctx.fillText(`Səhifə ${i + 1} / ${pages.length}`, R, H - 45)
    p.endY = i === pages.length - 1 ? y : null
  })

  return pages.map((p) => {
    p.c.contentEnd = p.endY
    return p.c
  })
}

/**
 * Bütün səhifələri bir uzun şəklə yığır (WhatsApp linki üçün).
 * Son səhifənin altındakı boş yer kəsilir. scale < 1 — fayl böyük olanda kiçildilir.
 */
export function joinPages(pages, scale = 1) {
  const W = pages[0].width
  const H = pages[0].height
  const heights = pages.map((c, i) =>
    i === pages.length - 1 && c.contentEnd ? Math.min(H, c.contentEnd + 40) : H
  )
  const out = document.createElement('canvas')
  out.width = Math.round(W * scale)
  out.height = Math.round(heights.reduce((a, b) => a + b, 0) * scale)
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, out.width, out.height)
  let y = 0
  pages.forEach((c, i) => {
    const h = heights[i]
    ctx.drawImage(c, 0, 0, W, h, 0, Math.round(y * scale), out.width, Math.round(h * scale))
    y += h
  })
  return out
}

export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Şəkil yaradılmadı'))), 'image/png')
  )
}

/** Səhifələri gizli pəncərədə çap edir (hər səhifə bir A4 vərəq) */
export function printPages(pages, landscape) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  const imgs = pages
    .map((c) => `<img src="${c.toDataURL('image/png')}" />`)
    .join('')
  doc.open()
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Qalıq mal</title><style>
    @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 0; }
    html, body { margin: 0; padding: 0; }
    img { display: block; width: 100%; height: auto; page-break-after: always; break-after: page; }
    img:last-child { page-break-after: auto; break-after: auto; }
  </style></head><body>${imgs}</body></html>`)
  doc.close()
  const go = () => {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
    setTimeout(() => iframe.remove(), 60000)
  }
  const all = [...doc.images]
  Promise.all(all.map((im) => (im.complete ? null : new Promise((r) => (im.onload = im.onerror = r))))).then(go)
}
