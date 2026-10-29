/**
 * Kredit çıxarışı (kredit qəbzi): bir neçə A4 səhifəyə çəkilir.
 *  1) Xülasə: İlkin, N ay × aylıq, Cəmi, Ödənilib, Qalan borc, Gecikmə faizi,
 *     Ödənilən faiz, Qalan faiz borcu, Cəmi qalan borc + faiz borcu
 *  2) Ödəniş qrafiki: hansı ay ödənilib, hansı qalıb
 *  3) Ödəniş tarixləri: müştərinin etdiyi ödənişlər
 *
 * data: {
 *   tarix, no, musteri, telefon, mehsul, verilmeTarixi,
 *   summary: [{ label, value, bold?, accent? }],
 *   schedule: [{ no, label, tarix, mebleg, odenilib, qaliq, gecikme, status, statusLabel }],
 *   paidMonths, leftMonths, totalMonths,
 *   payments: [{ tarix, tip, mebleg, usul }],
 *   terdibEden
 * }
 */
import { formatQebzMoney, formatQebzDate } from './qebz'

const W = 1240
const H = 1754
const L = 90
const R = W - 90
const TOP = 80
const BOTTOM = H - 110
const RED = '#e30613'
const TEXT = '#222'
const MUTED = '#777'
const FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif'

const FILL = {
  odenib: '#e8f5e9',
  odenib_gec: '#fff8e1',
  qismen: '#fff8e1',
  gecikib: '#fdecea',
  gozleyir: '#ffffff',
}

function money(v) {
  return formatQebzMoney(v)
}

function newCanvas() {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'
  return { canvas: c, ctx }
}

function hLine(ctx, y, color = RED, width = 2) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(L, y)
  ctx.lineTo(R, y)
  ctx.stroke()
}

function fitText(ctx, text, maxWidth) {
  let s = String(text ?? '')
  if (ctx.measureText(s).width <= maxWidth) return s
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1)
  return `${s}…`
}

/** Səhifələri idarə edən kiçik "sənəd" */
function createDoc() {
  const pages = []
  let cur = null
  const doc = {
    y: 0,
    get ctx() {
      return cur.ctx
    },
    newPage() {
      cur = newCanvas()
      pages.push(cur)
      hLine(cur.ctx, TOP)
      doc.y = TOP + 40
    },
    /** h px yer yoxdursa yeni səhifə; yeni səhifə açılıbsa true */
    ensure(h) {
      if (doc.y + h > BOTTOM) {
        doc.newPage()
        return true
      }
      return false
    },
    pages,
  }
  doc.newPage()
  return doc
}

function sectionTitle(doc, text) {
  doc.ensure(120)
  const ctx = doc.ctx
  doc.y += 56
  ctx.fillStyle = RED
  ctx.textAlign = 'left'
  ctx.font = `bold 30px ${FONT}`
  ctx.fillText(text, L, doc.y)
  doc.y += 18
}

/**
 * Cədvəl: columns [{ label, width, align? }], rows [{ cells: [], fill?, bold? }]
 * Səhifə dolanda başlıq yeni səhifədə təkrarlanır.
 */
function drawTable(doc, columns, rows) {
  const rowH = 44
  const fontSize = 23
  const drawHeader = () => {
    const ctx = doc.ctx
    ctx.fillStyle = RED
    ctx.fillRect(L, doc.y, R - L, rowH)
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${fontSize}px ${FONT}`
    let x = L
    for (const col of columns) {
      ctx.textAlign = col.align === 'right' ? 'right' : 'left'
      const tx = col.align === 'right' ? x + col.width - 12 : x + 12
      ctx.fillText(fitText(ctx, col.label, col.width - 20), tx, doc.y + 30)
      x += col.width
    }
    doc.y += rowH
  }

  doc.ensure(rowH * 2)
  drawHeader()
  for (const row of rows) {
    if (doc.ensure(rowH)) drawHeader()
    const ctx = doc.ctx
    ctx.fillStyle = row.fill || '#fff'
    ctx.fillRect(L, doc.y, R - L, rowH)
    ctx.strokeStyle = '#e3a3a6'
    ctx.lineWidth = 1
    ctx.strokeRect(L, doc.y, R - L, rowH)
    ctx.fillStyle = TEXT
    ctx.font = `${row.bold ? 'bold ' : ''}${fontSize}px ${FONT}`
    let x = L
    row.cells.forEach((cell, i) => {
      const col = columns[i]
      ctx.textAlign = col.align === 'right' ? 'right' : 'left'
      const tx = col.align === 'right' ? x + col.width - 12 : x + 12
      ctx.fillText(fitText(ctx, cell, col.width - 20), tx, doc.y + 30)
      x += col.width
    })
    doc.y += rowH
  }
}

/** İki sütunlu (ad — dəyər) cədvəl, göndərdiyiniz qəbzdəki kimi */
function drawKeyValue(doc, rows) {
  const mid = L + (R - L) * 0.55
  const rowH = 52
  for (const r of rows) {
    doc.ensure(rowH)
    const ctx = doc.ctx
    if (r.accent) {
      ctx.fillStyle = '#fdecea'
      ctx.fillRect(L, doc.y, R - L, rowH)
    }
    ctx.strokeStyle = RED
    ctx.lineWidth = 2
    ctx.strokeRect(L, doc.y, R - L, rowH)
    ctx.beginPath()
    ctx.moveTo(mid, doc.y)
    ctx.lineTo(mid, doc.y + rowH)
    ctx.stroke()
    ctx.fillStyle = TEXT
    ctx.textAlign = 'left'
    ctx.font = `${r.bold ? 'bold ' : ''}26px ${FONT}`
    ctx.fillText(fitText(ctx, r.label, mid - L - 30), L + 18, doc.y + 35)
    ctx.textAlign = 'right'
    ctx.font = `${r.bold ? 'bold ' : ''}26px ${FONT}`
    ctx.fillText(fitText(ctx, r.value, R - mid - 30), R - 18, doc.y + 35)
    doc.y += rowH
  }
}

export function drawKreditCixaris(data, logo) {
  const doc = createDoc()
  let ctx = doc.ctx

  // Loqo + başlıq
  if (logo) {
    const lw = 460
    const lh = (logo.height / logo.width) * lw
    ctx.drawImage(logo, (W - lw) / 2, doc.y - 10, lw, lh)
    doc.y += lh + 20
  } else {
    ctx.fillStyle = RED
    ctx.font = `bold 64px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('MOBİDEAL', W / 2, doc.y + 60)
    doc.y += 100
  }
  ctx.fillStyle = TEXT
  ctx.textAlign = 'center'
  ctx.font = `bold 38px ${FONT}`
  ctx.fillText('KREDİT ÇIXARIŞI', W / 2, doc.y + 20)
  doc.y += 70

  // Başlıq məlumatı (2 sütun)
  const info = [
    ['Tarix:', formatQebzDate(data.tarix)],
    ['Qəbz №:', data.no || '—'],
    ['Müştəri:', data.musteri || '—'],
    ['Telefon:', data.telefon || '—'],
    ['Məhsul:', data.mehsul || '—'],
    ['Kredit tarixi:', formatQebzDate(data.verilmeTarixi)],
  ]
  const colW = (R - L) / 2
  ctx.textAlign = 'left'
  info.forEach(([k, v], i) => {
    const x = L + (i % 2) * colW
    const y = doc.y + Math.floor(i / 2) * 44
    ctx.font = `bold 25px ${FONT}`
    ctx.fillStyle = TEXT
    ctx.fillText(k, x, y)
    ctx.font = `25px ${FONT}`
    ctx.fillText(fitText(ctx, v, colW - 190), x + 170, y)
  })
  doc.y += Math.ceil(info.length / 2) * 44 + 10

  // 1) Xülasə
  sectionTitle(doc, 'Kredit məlumatı')
  drawKeyValue(doc, data.summary || [])

  // 2) Qrafik
  const months = data.totalMonths || 0
  sectionTitle(
    doc,
    months
      ? `Ödəniş qrafiki — ${data.paidMonths} ay ödənilib, ${data.leftMonths} ay qalıb`
      : 'Ödəniş qrafiki'
  )
  if (data.schedule?.length) {
    drawTable(
      doc,
      [
        { label: '№', width: 70 },
        { label: 'Tarix', width: 160 },
        { label: 'Məbləğ', width: 170, align: 'right' },
        { label: 'Ödənilib', width: 170, align: 'right' },
        { label: 'Qalıq', width: 160, align: 'right' },
        { label: 'Gecikmə', width: 130, align: 'right' },
        { label: 'Vəziyyət', width: R - L - 860 },
      ],
      data.schedule.map((s) => ({
        fill: FILL[s.status] || '#fff',
        cells: [
          s.no,
          formatQebzDate(s.tarix),
          money(s.mebleg),
          money(s.odenilib),
          money(s.qaliq),
          s.gecikme > 0 ? `${s.gecikme} gün` : '—',
          s.statusLabel,
        ],
      }))
    )
  } else {
    doc.ensure(50)
    doc.ctx.fillStyle = MUTED
    doc.ctx.textAlign = 'left'
    doc.ctx.font = `24px ${FONT}`
    doc.ctx.fillText('Bu kredit üçün qrafik qurulmayıb.', L, doc.y + 34)
    doc.y += 50
  }

  // Qrafikin altında: bu günə ödənilməli məbləğ (gecikmədə olan + faiz) — iri, qırmızı
  const bo = data.bugunOdenilmeli
  if (bo) {
    doc.ensure(150)
    const c = doc.ctx
    const boxY = doc.y + 24
    const boxH = 118
    c.fillStyle = '#fdecea'
    c.fillRect(L, boxY, R - L, boxH)
    c.strokeStyle = RED
    c.lineWidth = 3
    c.strokeRect(L, boxY, R - L, boxH)
    c.fillStyle = RED
    c.textAlign = 'center'
    c.font = `bold 40px ${FONT}`
    c.fillText(fitText(c, `BU GÜNƏ ÖDƏNİLMƏLİ MƏBLƏĞ: ${money(bo.cemi)}`, R - L - 40), W / 2, boxY + 52)
    c.font = `bold 27px ${FONT}`
    c.fillText(
      fitText(c, `GECİKMƏDƏ OLAN MƏBLƏĞ ${money(bo.gecikmede)} + FAİZ ${money(bo.faiz)}`, R - L - 40),
      W / 2,
      boxY + 96
    )
    doc.y = boxY + boxH + 6
  }

  // 3) Ödəniş tarixləri
  sectionTitle(doc, 'Ödəniş tarixləri')
  if (data.payments?.length) {
    const sum = data.payments.reduce((a, p) => a + (Number(p.mebleg) || 0), 0)
    drawTable(
      doc,
      [
        { label: '№', width: 70 },
        { label: 'Tarix', width: 200 },
        { label: 'Növ', width: 330 },
        { label: 'Üsul', width: 200 },
        { label: 'Məbləğ', width: R - L - 800, align: 'right' },
      ],
      [
        ...data.payments.map((p, i) => ({
          cells: [String(i + 1), formatQebzDate(p.tarix), p.tip, p.usul || '—', money(p.mebleg)],
        })),
        { bold: true, fill: '#f5f5f5', cells: ['', 'Cəmi', '', '', money(sum)] },
      ]
    )
  } else {
    doc.ensure(50)
    doc.ctx.fillStyle = MUTED
    doc.ctx.textAlign = 'left'
    doc.ctx.font = `24px ${FONT}`
    doc.ctx.fillText('Hələ ödəniş yoxdur.', L, doc.y + 34)
    doc.y += 50
  }

  // İmzalar
  doc.ensure(230)
  ctx = doc.ctx
  doc.y += 60
  hLine(ctx, doc.y)
  doc.y += 55
  const mid = L + (R - L) / 2
  ctx.fillStyle = TEXT
  ctx.textAlign = 'center'
  ctx.font = `bold 26px ${FONT}`
  ctx.fillText('Qəbzi tərtib edən:', L + (mid - L) / 2, doc.y)
  ctx.fillText('Qəbzi alan:', mid + (R - mid) / 2, doc.y)
  doc.y += 46
  ctx.font = `26px ${FONT}`
  ctx.fillText(data.terdibEden || 'Mobideal', L + (mid - L) / 2, doc.y)
  ctx.fillText(fitText(ctx, data.musteri || '—', (R - mid) - 20), mid + (R - mid) / 2, doc.y)
  doc.y += 40
  hLine(ctx, doc.y)

  // Bir neçə səhifədirsə — altda yalnız səhifə nömrəsi
  const total = doc.pages.length
  if (total > 1) {
    doc.pages.forEach((pg, i) => {
      const c = pg.ctx
      c.fillStyle = MUTED
      c.font = `22px ${FONT}`
      c.textAlign = 'center'
      c.fillText(`Səhifə ${i + 1} / ${total}`, W / 2, H - 60)
    })
  }

  return doc.pages.map((p) => p.canvas)
}

export function kreditMessage(data) {
  const get = (label) => data.summary?.find((r) => r.label === label)?.value
  return [
    `Kredit çıxarışı № ${data.no}`,
    `Tarix: ${formatQebzDate(data.tarix)}`,
    `Qalan borc: ${get('Qalan borc') || '—'}`,
    `Qalan faiz borcu: ${get('Qalan faiz borcu') || '—'}`,
    'Mobideal',
  ].join('\n')
}
