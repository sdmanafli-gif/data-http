/**
 * Kredit satış müqaviləsi (Word) — public/templates/muqavile.docx şablonunu doldurur.
 * Heç bir əlavə kitabxana lazım deyil: docx = zip, brauzerin öz (De)CompressionStream-i ilə açılır/yığılır.
 * Şablonda yer tutucular: {AD}, {NOMRE}, {TARIX} … ; cədvəl sətirləri {M_*}, {A_*}, {Q_*} ilə təkrarlanır.
 */

export const MUQAVILE_TEMPLATE_URL = '/templates/muqavile.docx'
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/* ───────────── zip ───────────── */

async function pipeBytes(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream))
  return new Uint8Array(await res.arrayBuffer())
}

/** @returns {Promise<Array<{ name: string, data: Uint8Array }>>} */
export async function readZip(buffer) {
  const u8 = new Uint8Array(buffer)
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  let eocd = -1
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Şablon faylı zədəlidir (zip tapılmadı).')
  const count = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const dec = new TextDecoder()
  const out = []
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Şablon faylı zədəlidir.')
    const method = dv.getUint16(p + 10, true)
    const csize = dv.getUint32(p + 20, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const local = dv.getUint32(p + 42, true)
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen
    const lNameLen = dv.getUint16(local + 26, true)
    const lExtraLen = dv.getUint16(local + 28, true)
    const start = local + 30 + lNameLen + lExtraLen
    const raw = u8.slice(start, start + csize)
    let data
    if (method === 0) data = raw
    else if (method === 8) data = await pipeBytes(raw, new DecompressionStream('deflate-raw'))
    else throw new Error(`Dəstəklənməyən sıxılma üsulu: ${method}`)
    out.push({ name, data })
  }
  return out
}

let CRC_TABLE = null
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      CRC_TABLE[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** @returns {Promise<Blob>} */
export async function writeZip(files, mime = 'application/zip') {
  const enc = new TextEncoder()
  const now = new Date()
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  const parts = []
  const central = []
  let offset = 0
  for (const f of files) {
    const nameBytes = enc.encode(f.name)
    const comp = await pipeBytes(f.data, new CompressionStream('deflate-raw'))
    const crc = crc32(f.data)
    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true)
    lh.setUint16(4, 20, true)
    lh.setUint16(6, 0x0800, true)
    lh.setUint16(8, 8, true)
    lh.setUint16(10, dosTime, true)
    lh.setUint16(12, dosDate, true)
    lh.setUint32(14, crc, true)
    lh.setUint32(18, comp.length, true)
    lh.setUint32(22, f.data.length, true)
    lh.setUint16(26, nameBytes.length, true)
    lh.setUint16(28, 0, true)
    parts.push(new Uint8Array(lh.buffer), nameBytes, comp)
    const ch = new DataView(new ArrayBuffer(46))
    ch.setUint32(0, 0x02014b50, true)
    ch.setUint16(4, 20, true)
    ch.setUint16(6, 20, true)
    ch.setUint16(8, 0x0800, true)
    ch.setUint16(10, 8, true)
    ch.setUint16(12, dosTime, true)
    ch.setUint16(14, dosDate, true)
    ch.setUint32(16, crc, true)
    ch.setUint32(20, comp.length, true)
    ch.setUint32(24, f.data.length, true)
    ch.setUint16(28, nameBytes.length, true)
    ch.setUint32(42, offset, true)
    central.push(new Uint8Array(ch.buffer), nameBytes)
    offset += 30 + nameBytes.length + comp.length
  }
  const cdSize = central.reduce((s, b) => s + b.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, cdSize, true)
  end.setUint32(16, offset, true)
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: mime })
}

/* ───────────── format ───────────── */

const AY_ADLARI = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr',
]

/** 2025 → «ci», 2026 → «cı», 2029 → «cu», 2023 → «cü» */
export function saySekilcisi(n) {
  const num = Math.abs(Math.trunc(Number(n) || 0))
  const last = num % 10
  const byDigit = { 1: 'ci', 2: 'ci', 3: 'cü', 4: 'cü', 5: 'ci', 6: 'cı', 7: 'ci', 8: 'ci', 9: 'cu' }
  if (last) return byDigit[last]
  const tens = Math.floor(num / 10) % 10
  const byTens = { 1: 'cu', 2: 'ci', 3: 'cu', 4: 'cı', 5: 'ci', 6: 'cı', 7: 'ci', 8: 'ci', 9: 'cı' }
  if (tens) return byTens[tens]
  if (Math.floor(num / 100) % 10) return 'cü'
  return 'ci'
}

function ymdParts(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''))
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]), s: [m[3], m[2], m[1]].join('.') } : null
}

export function dmy(v) {
  return ymdParts(v)?.s || ''
}

function dmyIl(v) {
  const p = ymdParts(v)
  return p ? `${p.s}-${saySekilcisi(p.y)} il` : ''
}

function tarixSozle(v) {
  const p = ymdParts(v)
  return p ? `${p.d} ${AY_ADLARI[p.m - 1]} ${p.y}-${saySekilcisi(p.y)} il` : ''
}

export function pul(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

function muqavileNomresi(raw) {
  const s = String(raw ?? '').trim()
  return /^\d+$/.test(s) ? s.padStart(8, '0') : s
}

function malAdi(cihaz, item, withColor) {
  const model = String(cihaz?.model || item?.model || '').trim()
  const yaddas = String(cihaz?.yaddas || item?.yaddas || '').trim()
  const reng = String(cihaz?.reng || item?.reng || '').trim()
  // Növ (məs. iPhone, MacBook) modeldə yazılmayıbsa önə əlavə olunur: «iPhone 11 64 Gb»
  const nov = String(item?.nov || '').trim()
  const parts = nov && !model.toLowerCase().includes(nov.toLowerCase()) ? [nov, model] : [model]
  if (yaddas && !model.toLowerCase().includes(yaddas.toLowerCase())) parts.push(yaddas)
  if (withColor && reng) parts.push(reng)
  return parts.filter(Boolean).join(' ') || '—'
}

/** Telefon kateqoriyasıdır? Kateqoriya yazılmayıbsa — IMEI varsa telefon sayılır */
function isTelefon(item, cihaz) {
  const kat = String(item?.kateqoriya || '').trim().toLocaleLowerCase('az')
  if (kat) return kat === 'telefon'
  return Boolean(String(cihaz?.imei_1 || item?.imei_1 || '').trim())
}

function malImeiText(p) {
  const imei = [p.imei1, p.imei2].filter(Boolean).join(', ')
  return imei ? `${p.ad} markalı, İMEİ kodu: ${imei}` : `${p.ad} markalı`
}

/**
 * Formdakı məlumatlardan müqavilə sahələri.
 * @param {{
 *   musteriForm: object, kontakt: object, basket: object[], linePrices: object, lineCihaz: object,
 *   paidNow: number, scheduleLines: Array<{type:string,tarix:string,mebleg:number}>,
 * }} p
 */
export function buildMuqavileData({ musteriForm, kontakt, basket, linePrices, lineCihaz, paidNow, scheduleLines }) {
  const f = musteriForm || {}
  const k = kontakt || {}
  const verilme = f.verilme_tarixi
  const ad = String(f.ad_soyad || '').trim()

  const products = (basket || []).map((item, i) => {
    const c = lineCihaz?.[item.id] || {}
    const satis = Number(linePrices?.[item.id]?.satis) || 0
    return {
      no: String(i + 1),
      ad: malAdi(c, item, false),
      adReng: malAdi(c, item, true),
      qiymet: pul(satis),
      satis,
      imei1: String(c.imei_1 || item.imei_1 || '').trim(),
      imei2: String(c.imei_2 || item.imei_2 || '').trim(),
      telefon: isTelefon(item, c),
    }
  })
  const satisCem = products.reduce((s, p) => s + p.satis, 0)
  const paid = Math.round((Number(paidNow) || 0) * 100) / 100
  const nisye = Math.max(0, Math.round((satisCem - paid) * 100) / 100)

  // Qrafik: bu gün verilən ilkin hissə çıxılır; qalan ilkin «İlk», aylıqlar 1, 2, 3…
  const rows = []
  let balans = nisye
  let skippedPaid = paid <= 0.009
  let ay = 0
  for (const line of scheduleLines || []) {
    const mebleg = Number(line.mebleg) || 0
    if (line.type === 'ilkin') {
      if (!skippedPaid) {
        skippedPaid = true
        continue
      }
      if (mebleg <= 0.009) continue
      balans = Math.round((balans - mebleg) * 100) / 100
      rows.push({ tarix: dmy(line.tarix), no: 'İlk', mebleg: pul(mebleg), balans: pul(Math.max(0, balans)) })
      continue
    }
    ay += 1
    balans = Math.round((balans - mebleg) * 100) / 100
    rows.push({ tarix: dmy(line.tarix), no: String(ay), mebleg: pul(mebleg), balans: pul(Math.max(0, balans)) })
  }

  const mob = (n) => {
    const nomre = String(f[`nomre_${n}`] || '').trim()
    if (!nomre) return ''
    const kim = String(k[`nomre_${n}_kim`] || '').trim()
    return kim ? `${nomre} ${kim}` : nomre
  }

  return {
    values: {
      NOMRE: muqavileNomresi(f.muqavile_nomresi || f.sira_no),
      TARIX: dmy(verilme),
      TARIX_IL: dmyIl(verilme),
      TARIX_SOZ: tarixSozle(verilme),
      AD: ad,
      SOYAD: ad.split(/\s+/)[0] || '',
      TEL: String(f.nomre_1 || '').trim(),
      FIN: String(k.fin_kod || '').trim(),
      SERIYA: String(k.sv_seriya || '').trim(),
      DOGUM: dmy(k.dogum_tarixi),
      SV_TARIX: dmy(k.sv_verilme_tarixi),
      SV_ORQAN: String(k.sv_veren_orqan || '').trim(),
      QEYD_UNVAN: String(k.qeydiyyat_unvani || '').trim(),
      YASAYIS_UNVAN: String(k.yasayis_unvani || '').trim(),
      SATIS: pul(satisCem),
      ILKIN: pul(paid),
      NISYE: pul(nisye),
      AYLIQ: pul(f.ayliq_odenis),
      MUDDET: String(f.nece_ay || ''),
      MAL_IMEI: products.map(malImeiText).join('; '),
      MOB1: mob(1),
      MOB2: mob(2),
      MOB3: mob(3),
      MOB4: mob(4),
      MOB5: mob(5),
    },
    /** «1 saylı Əlavə» (İMEİ razılığı) səhifəsi — yalnız telefonlar üçün, hər telefona ayrıca səhifə */
    phonePages: products.filter((p) => p.telefon).map((p) => ({ MAL_IMEI: malImeiText(p) })),
    /** Boş olanda bütün sətri (paraqrafı) silinən sahələr */
    removeIfEmpty: ['MOB2', 'MOB3', 'MOB4', 'MOB5'],
    tables: [
      {
        marker: '{M_NO}',
        rows: products.map((p) => ({
          M_NO: p.no, M_AD: p.ad, M_QIYMET: p.qiymet, M_MIQDAR: '1', M_MEBLEG: p.qiymet, M_IMEI1: p.imei1, M_IMEI2: p.imei2,
        })),
      },
      {
        marker: '{A_NO}',
        rows: products.map((p) => ({ A_NO: p.no, A_AD: p.adReng, A_QIYMET: p.qiymet, A_MIQDAR: '1', A_MEBLEG: p.qiymet })),
      },
      {
        marker: '{Q_TARIX}',
        rows: rows.map((r) => ({ Q_TARIX: r.tarix, Q_NO: r.no, Q_MEBLEG: r.mebleg, Q_BALANS: r.balans })),
      },
    ],
  }
}

/* ───────────── doldurma ───────────── */

function xmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** `<w:tr>` / `<w:p>` başlanğıcı (w:trPr, w:pPr ilə qarışdırmadan) */
function lastOpenTag(xml, tag, before) {
  return Math.max(xml.lastIndexOf(`<${tag}>`, before), xml.lastIndexOf(`<${tag} `, before))
}

function enclosing(xml, tag, idx) {
  const start = lastOpenTag(xml, tag, idx)
  const endTag = `</${tag}>`
  const end = xml.indexOf(endTag, idx)
  if (start < 0 || end < 0) return null
  return [start, end + endTag.length]
}

function fillPlaceholders(xml, values) {
  return xml.replace(/\{([A-Z0-9_]+)\}/g, (m, key) => (key in values ? xmlEscape(values[key]) : m))
}

export function fillDocumentXml(xml, data) {
  let out = xml
  for (const t of data.tables) {
    const idx = out.indexOf(t.marker)
    if (idx < 0) continue
    const range = enclosing(out, 'w:tr', idx)
    if (!range) continue
    const rowXml = out.slice(range[0], range[1])
    const filled = t.rows.map((r) => fillPlaceholders(rowXml, r)).join('')
    out = out.slice(0, range[0]) + filled + out.slice(range[1])
  }
  for (const key of data.removeIfEmpty || []) {
    if (String(data.values[key] ?? '').trim()) continue
    // Eyni sahə bir neçə yerdə ola bilər (cədvəl, mətn qutusu) — hamısını sil
    for (let guard = 0; guard < 20; guard++) {
      const idx = out.indexOf(`{${key}}`)
      if (idx < 0) break
      const range = enclosing(out, 'w:p', idx)
      if (!range) break
      out = out.slice(0, range[0]) + out.slice(range[1])
    }
  }
  // «1 saylı Əlavə» səhifəsi (sənədin sonu): hər telefon üçün ayrıca səhifə; telefon yoxdursa səhifə silinir
  if (Array.isArray(data.phonePages)) {
    const mi = out.indexOf('{MAL_IMEI}')
    const ti = out.indexOf('{TARIX_SOZ}')
    const bodyEnd = out.lastIndexOf('<w:sectPr')
    if (mi >= 0 && ti >= 0 && ti < mi && bodyEnd > mi) {
      const start = lastOpenTag(out, 'w:p', ti)
      const block = out.slice(start, bodyEnd)
      if (data.phonePages.length) {
        const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
        const pages = data.phonePages.map((pg, k) => (k ? pageBreak : '') + fillPlaceholders(block, pg)).join('')
        out = out.slice(0, start) + pages + out.slice(bodyEnd)
      } else {
        // Səhifəni və onu yeni səhifəyə itələyən boş sətirləri sil (əvvəlki səhifənin «İmza: ___ Tarix» sətrindən sonra)
        const imza = out.lastIndexOf('İmza: ____', start)
        const cut = imza >= 0 ? out.indexOf('</w:p>', imza) + 6 : start
        out = out.slice(0, cut) + out.slice(bodyEnd)
      }
    }
  }
  // «Mal haqqında məlumat» cədvəli sabit hündürlüklü çərçivədədir — bir neçə məhsul sığsın deyə çərçivə böyüyə bilsin
  out = out.replace(/(<w:framePr [^>]*?)w:hRule="exact"/g, '$1w:hRule="atLeast"')
  return fillPlaceholders(out, data.values)
}

/** Müqavilə faylını (.docx) yaradır */
export async function createMuqavileDocx(data) {
  const res = await fetch(MUQAVILE_TEMPLATE_URL, { cache: 'no-cache' })
  if (!res.ok) throw new Error('Müqavilə şablonu tapılmadı.')
  const entries = await readZip(await res.arrayBuffer())
  const enc = new TextEncoder()
  const dec = new TextDecoder()
  const files = entries.map((e) =>
    e.name === 'word/document.xml'
      ? { name: e.name, data: enc.encode(fillDocumentXml(dec.decode(e.data), data)) }
      : e
  )
  const blob = await writeZip(files, DOCX_MIME)
  const safeAd = String(data.values.AD || 'Musteri').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_')
  const name = `Muqavile_${data.values.NOMRE || ''}_${safeAd}.docx`
  return new File([blob], name, { type: DOCX_MIME })
}

/* ───────────── baxış / çap üçün HTML ───────────── */

const TWIP_PT = 1 / 20

function attr(el, name) {
  return el?.getAttribute(name) ?? null
}

function child(el, name) {
  if (!el) return null
  for (const c of el.childNodes) if (c.nodeName === name) return c
  return null
}

function children(el, name) {
  const out = []
  if (!el) return out
  for (const c of el.childNodes) if (c.nodeName === name) out.push(c)
  return out
}

function htmlEscape(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function toRoman(n) {
  const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let s = ''
  for (const [v, r] of map) while (n >= v) { s += r; n -= v }
  return s
}

function fmtNum(n, fmt) {
  if (fmt === 'lowerLetter') return String.fromCharCode(96 + ((n - 1) % 26) + 1)
  if (fmt === 'upperLetter') return String.fromCharCode(64 + ((n - 1) % 26) + 1)
  if (fmt === 'lowerRoman') return toRoman(n).toLowerCase()
  if (fmt === 'upperRoman') return toRoman(n)
  if (fmt === 'bullet') return '•'
  return String(n)
}

/** Docx → sadə HTML (Bax və Çap et üçün). Word faylının özü dəyişmir. */
export async function docxToHtml(fileOrBlob) {
  const entries = await readZip(await fileOrBlob.arrayBuffer())
  const dec = new TextDecoder()
  const get = (n) => {
    const e = entries.find((x) => x.name === n)
    return e ? new DOMParser().parseFromString(dec.decode(e.data), 'application/xml') : null
  }
  const doc = get('word/document.xml')
  const numbering = get('word/numbering.xml')
  const styles = get('word/styles.xml')
  if (!doc) throw new Error('Sənəd oxunmadı.')

  // nömrələmə: numId → abstractNum → lvl
  const abstract = {}
  const numMap = {}
  if (numbering) {
    for (const a of numbering.getElementsByTagName('w:abstractNum')) {
      const lv = {}
      for (const l of children(a, 'w:lvl')) {
        lv[attr(l, 'w:ilvl')] = {
          start: Number(attr(child(l, 'w:start'), 'w:val') || 1),
          fmt: attr(child(l, 'w:numFmt'), 'w:val') || 'decimal',
          text: attr(child(l, 'w:lvlText'), 'w:val') ?? '',
        }
      }
      abstract[attr(a, 'w:abstractNumId')] = lv
    }
    for (const n of numbering.getElementsByTagName('w:num')) {
      numMap[attr(n, 'w:numId')] = attr(child(n, 'w:abstractNumId'), 'w:val')
    }
  }
  const styleNum = {}
  const styleBold = {}
  if (styles) {
    for (const s of styles.getElementsByTagName('w:style')) {
      const id = attr(s, 'w:styleId')
      const ppr = child(s, 'w:pPr')
      const np = child(ppr, 'w:numPr')
      if (np) styleNum[id] = { numId: attr(child(np, 'w:numId'), 'w:val'), ilvl: attr(child(np, 'w:ilvl'), 'w:val') || '0' }
      const rpr = child(s, 'w:rPr')
      if (child(rpr, 'w:b') && attr(child(rpr, 'w:b'), 'w:val') !== '0') styleBold[id] = true
    }
  }
  const counters = {}

  function numberPrefix(ppr) {
    let np = child(ppr, 'w:numPr')
    let numId = attr(child(np, 'w:numId'), 'w:val')
    let ilvl = attr(child(np, 'w:ilvl'), 'w:val') || '0'
    if (!numId) {
      const st = attr(child(ppr, 'w:pStyle'), 'w:val')
      if (st && styleNum[st]) ({ numId, ilvl } = styleNum[st])
    }
    if (!numId || numId === '0') return ''
    const absId = numMap[numId]
    const lvls = abstract[absId]
    if (!lvls) return ''
    const lv = Number(ilvl)
    const c = (counters[absId] ||= [])
    c[lv] = (c[lv] ?? (lvls[lv]?.start ?? 1) - 1) + 1
    for (let i = lv + 1; i < 10; i++) c[i] = undefined
    const def = lvls[lv]
    if (!def) return ''
    if (def.fmt === 'bullet') return '• '
    const text = def.text.replace(/%(\d)/g, (_, d) => {
      const i = Number(d) - 1
      const v = c[i] ?? lvls[i]?.start ?? 1
      return fmtNum(v, lvls[i]?.fmt)
    })
    return text ? `${text} ` : ''
  }

  function runHtml(r, pBold) {
    const rpr = child(r, 'w:rPr')
    const css = []
    const b = child(rpr, 'w:b')
    if ((b && attr(b, 'w:val') !== '0' && attr(b, 'w:val') !== 'false') || (pBold && !b)) css.push('font-weight:bold')
    const i = child(rpr, 'w:i')
    if (i && attr(i, 'w:val') !== '0') css.push('font-style:italic')
    const u = child(rpr, 'w:u')
    if (u && attr(u, 'w:val') !== 'none') css.push('text-decoration:underline')
    const sz = attr(child(rpr, 'w:sz'), 'w:val')
    if (sz) css.push(`font-size:${Number(sz) / 2}pt`)
    let html = ''
    for (const n of r.childNodes) {
      if (n.nodeName === 'w:t') html += htmlEscape(n.textContent).replace(/ {2,}/g, (m) => '&nbsp;'.repeat(m.length))
      else if (n.nodeName === 'w:tab') html += '<span class="dx-tab"></span>'
      else if (n.nodeName === 'w:br') html += attr(n, 'w:type') === 'page' ? '<span class="dx-pb"></span>' : '<br>'
    }
    return css.length ? `<span style="${css.join(';')}">${html}</span>` : html
  }

  function paraHtml(p) {
    const ppr = child(p, 'w:pPr')
    const css = []
    const jc = attr(child(ppr, 'w:jc'), 'w:val')
    if (jc === 'center') css.push('text-align:center')
    else if (jc === 'right' || jc === 'end') css.push('text-align:right')
    else if (jc === 'both' || jc === 'distribute') css.push('text-align:justify')
    const ind = child(ppr, 'w:ind')
    if (ind) {
      const left = Number(attr(ind, 'w:left') || attr(ind, 'w:start') || 0)
      const first = Number(attr(ind, 'w:firstLine') || 0) - Number(attr(ind, 'w:hanging') || 0)
      if (left) css.push(`margin-left:${left * TWIP_PT}pt`)
      if (first) css.push(`text-indent:${first * TWIP_PT}pt`)
    }
    const st = attr(child(ppr, 'w:pStyle'), 'w:val')
    const pBold = Boolean(st && styleBold[st])
    const pageBefore = child(ppr, 'w:pageBreakBefore')
    let inner = numberPrefix(ppr)
    const walk = (el) => {
      for (const n of el.childNodes) {
        if (n.nodeName === 'w:r') inner += runHtml(n, pBold)
        else if (n.nodeName === 'w:hyperlink' || n.nodeName === 'w:ins' || n.nodeName === 'w:smartTag' || n.nodeName === 'w:sdt' || n.nodeName === 'w:sdtContent') walk(n)
      }
    }
    walk(p)
    const pb = pageBefore ? '<div class="dx-page-break"></div>' : ''
    const html = `${pb}<p${css.length ? ` style="${css.join(';')}"` : ''}>${inner || '&nbsp;'}</p>`
    return html.replace(/<span class="dx-pb"><\/span>/g, '</p><div class="dx-page-break"></div><p>')
  }

  function tableHtml(tbl) {
    let html = '<table class="dx-table">'
    for (const tr of children(tbl, 'w:tr')) {
      html += '<tr>'
      for (const tc of children(tr, 'w:tc')) {
        const tcpr = child(tc, 'w:tcPr')
        const span = Number(attr(child(tcpr, 'w:gridSpan'), 'w:val') || 1)
        const vm = child(tcpr, 'w:vMerge')
        if (vm && attr(vm, 'w:val') !== 'restart') {
          html += `<td${span > 1 ? ` colspan="${span}"` : ''} class="dx-merged"></td>`
          continue
        }
        html += `<td${span > 1 ? ` colspan="${span}"` : ''}>${blocks(tc)}</td>`
      }
      html += '</tr>'
    }
    return `${html}</table>`
  }

  function blocks(el) {
    let html = ''
    for (const n of el.childNodes) {
      if (n.nodeName === 'w:p') html += paraHtml(n)
      else if (n.nodeName === 'w:tbl') html += tableHtml(n)
      else if (n.nodeName === 'w:sdt') html += blocks(child(n, 'w:sdtContent') || n)
    }
    return html
  }

  const body = child(doc.documentElement, 'w:body')
  return blocks(body)
}

export const DOCX_HTML_CSS = `
.dx-doc{font-family:"Times New Roman",Times,serif;font-size:11pt;line-height:1.25;color:#000;background:#fff}
.dx-doc p{margin:0 0 4pt}
.dx-doc .dx-tab{display:inline-block;width:36pt}
.dx-doc .dx-table{border-collapse:collapse;width:100%;margin:4pt 0}
.dx-doc .dx-table td{border:1px solid #000;padding:2pt 4pt;vertical-align:top}
.dx-doc .dx-table td p{margin:0}
.dx-doc .dx-page-break{break-after:page;page-break-after:always;height:0}
`
