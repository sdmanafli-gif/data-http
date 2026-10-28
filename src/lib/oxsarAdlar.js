/**
 * Oxşar adlar — eyni adamın / tükanın fərqli yazılmış qeydlərini tapmaq üçün.
 *
 * İki qeyd "oxşar" sayılır, əgər:
 *  1) adları eynidir (böyük/kiçik hərf, ə/e, ş/s, ç/c, ı/i, ö/o, ü/u, ğ/g fərqi,
 *     boşluq, mötərizə, nöqtə, "661#" kimi nömrələr nəzərə alınmır)
 *     məs: "BulBul Store" = "bul bul store", "549# Həsənov Rakif" = "550. Həsənov Rakif"
 *  2) qısa ad uzun adın başlanğıcıdır (qısa ad ən azı 6 hərf və ya 2 söz olmalıdır)
 *     məs: "BulBul" ↔ "bul bul store", "Murad sumqayit" ↔ "Murad sumqayit ( yanindaki qiz )"
 *  3) 1 hərf səhvi var (ad ən azı 8 hərfdirsə)
 *     məs: "İmanov Cavanşir" ↔ "İmanov Cavaşir", "Xalid Sumqayit" ↔ "Xalid sumaqayit"
 *  4) telefon nömrəsi eynidir (son 9 rəqəm)
 *
 * Bu yalnız TƏKLİFDİR — birləşdirmə qərarını istifadəçi özü verir.
 */

const TRANSLIT = { ə: 'e', ı: 'i', ö: 'o', ü: 'u', ş: 's', ç: 'c', ğ: 'g' }

/** Ad → söz siyahısı (translit, kiçik hərf, nömrə/işarələr atılır) */
export function nameTokens(s, { dropParens = false } = {}) {
  let t = String(s || '').toLocaleLowerCase('az')
  if (dropParens) t = t.replace(/\([^)]*\)?/g, ' ')
  t = t.replace(/[əıöüşçğ]/g, (ch) => TRANSLIT[ch] || ch).normalize('NFD').replace(/[̀-ͯ]/g, '')
  t = t.replace(/[^a-z0-9]+/g, ' ')
  return t
    .split(' ')
    .filter(Boolean)
    .filter((w) => !/^\d{1,4}$/.test(w)) // "661#", "572 )", "#903" kimi sıra nömrələri
}

/** Telefonun son 9 rəqəmi; 7-dən az rəqəmdirsə boş */
export function phoneKeyOf(s) {
  const d = String(s || '').replace(/\D/g, '')
  if (d.length < 7) return ''
  return d.slice(-9)
}

/** a və b arasında ən çox 1 hərf fərqi (əvəz / əlavə / silmə) varmı */
function withinOneEdit(a, b) {
  if (a === b) return true
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > 1) return false
  if (la > lb) return withinOneEdit(b, a)
  let i = 0
  while (i < la && a[i] === b[i]) i++
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1)
  return a.slice(i) === b.slice(i + 1)
}

/** qısa sözlər birləşəndə uzunun ilk sözləri ilə eyni olurmu ("bulbul" ↔ "bul bul store") */
function isTokenPrefix(shortTokens, longTokens) {
  const target = shortTokens.join('')
  let acc = ''
  for (const w of longTokens) {
    acc += w
    if (acc === target) return true
    if (acc.length >= target.length) return false
  }
  return false
}

/**
 * Oxşar qrupları tapır.
 * @param {Array} items
 * @param {(x)=>string} getId
 * @param {(x)=>string} getName
 * @param {(x)=>string[]} getPhones
 * @returns {Map<string, number>} id → qrup nömrəsi (yalnız 2+ üzvlü qruplar)
 */
export function findSimilarGroups(items, getId, getName, getPhones = () => []) {
  const n = items.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const union = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  const info = items.map((x) => {
    const tokens = nameTokens(getName(x))
    const base = nameTokens(getName(x), { dropParens: true })
    return {
      tokens,
      base: base.length ? base : tokens,
      compact: tokens.join(''),
      baseCompact: (base.length ? base : tokens).join(''),
    }
  })

  // 1) eyni ad (tam, mötərizəsiz və ya sözlərin yeri dəyişik: "Kenan Orange" = "orange kenan").
  //    Qısa tək sözlü ad ("Rufet") mötərizəsiz müqayisədə istifadə olunmur — yoxsa hamısı bir qrupa düşür.
  const strong = (t) => t.length >= 2 || t.join('').length >= 6
  const byKey = new Map()
  info.forEach((f, i) => {
    const keys = [f.compact]
    if (strong(f.base)) keys.push(f.baseCompact)
    if (f.tokens.length >= 2) keys.push('S:' + [...f.tokens].sort().join('|'))
    for (const k of new Set(keys)) {
      if (!k) continue
      if (byKey.has(k)) union(byKey.get(k), i)
      else byKey.set(k, i)
    }
  })

  // 4) eyni telefon
  const byPhone = new Map()
  items.forEach((x, i) => {
    for (const p of new Set((getPhones(x) || []).map(phoneKeyOf).filter(Boolean))) {
      if (byPhone.has(p)) union(byPhone.get(p), i)
      else byPhone.set(p, i)
    }
  })

  // 2) və 3) — cüt-cüt müqayisə
  for (let i = 0; i < n; i++) {
    const a = info[i]
    if (!a.compact) continue
    for (let j = i + 1; j < n; j++) {
      const b = info[j]
      if (!b.compact) continue
      if (find(i) === find(j)) continue
      // başlanğıc
      const [s, l] = a.base.join('').length <= b.base.join('').length ? [a.base, b.base] : [b.base, a.base]
      const sLen = s.join('').length
      if ((sLen >= 6 || s.length >= 2) && isTokenPrefix(s, l)) {
        union(i, j)
        continue
      }
      // 1 hərf səhvi
      const ca = a.baseCompact
      const cb = b.baseCompact
      if (Math.min(ca.length, cb.length) >= 8 && Math.abs(ca.length - cb.length) <= 1 && withinOneEdit(ca, cb)) {
        union(i, j)
      }
    }
  }

  const groups = new Map()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r).push(i)
  }
  const out = new Map()
  let g = 0
  for (const members of groups.values()) {
    if (members.length < 2) continue
    g++
    for (const i of members) out.set(getId(items[i]), g)
  }
  return out
}
