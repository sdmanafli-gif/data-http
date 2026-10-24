import { supabase, fetchAllPages } from './supabase'

/**
 * Müştərilər (musteriler) — təkrarların qarşısını almaq və birləşdirmək.
 */

const TABLE = 'musteriler'
const PHONE_KEYS = ['nomre_1', 'nomre_2', 'nomre_3', 'nomre_4', 'nomre_5']

/** Ad müqayisəsi üçün: kiçik hərf, dırnaq / mötərizə / nöqtə atılır, boşluqlar birləşir */
export function normMusteriName(s) {
  return String(s || '')
    .toLocaleLowerCase('az')
    .replace(/["'“”«»().,\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Telefonun son 9 rəqəmi (050 123 45 67 = +994 50 123 45 67); 7-dən az rəqəmdirsə boş */
export function phoneKey(s) {
  const d = String(s || '').replace(/\D/g, '')
  if (d.length < 7) return ''
  return d.slice(-9)
}

/**
 * Yeni müştəri lazımdırsa: eyni adlı müştəri artıq varsa ONU qaytarır
 * (yalnız onun boş nömrə / zamin sahələrini doldurur), yoxdursa yenisini yaradır.
 * @param {object} payload toMusterilerPayload(...) nəticəsi
 * @returns {Promise<string>} musteriler.id
 */
export async function findOrCreateMusteri(payload) {
  const key = normMusteriName(payload.ad_soyad)
  const { data: list, error } = await fetchAllPages(() =>
    supabase
      .from(TABLE)
      .select('id, ad_soyad, nomre_1, nomre_2, nomre_3, nomre_4, nomre_5, zamin, created_at')
      .order('created_at', { ascending: true })
  )
  if (error) throw error
  const found = key ? (list || []).find((m) => normMusteriName(m.ad_soyad) === key) : null
  if (found) {
    const patch = {}
    for (const k of [...PHONE_KEYS, 'zamin']) {
      if (!String(found[k] || '').trim() && String(payload[k] || '').trim()) patch[k] = payload[k]
    }
    if (Object.keys(patch).length) {
      const { error: upErr } = await supabase
        .from(TABLE)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', found.id)
      if (upErr) throw upErr
    }
    return found.id
  }
  const { data, error: insErr } = await supabase.from(TABLE).insert(payload).select('id').single()
  if (insErr) throw insErr
  return data.id
}

function isEmpty(v) {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  return false
}

function asList(v) {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }
  return []
}

/**
 * Bir neçə müştərini birinə birləşdirir:
 *  1) digərlərinin bütün alışları (musteri_bazasi) əsas müştəriyə keçir
 *  2) əsas müştərinin boş sahələri digərlərindən doldurulur, fərqli nömrələr boş yerlərə yazılır
 *  3) sənədlər (vəsiqə faylları) birləşir
 *  4) yalnız bundan sonra artıq müştəri qeydləri silinir
 * Ardıcıllıq elədir ki, yarıda xəta olsa belə heç bir alış itmir.
 */
export async function mergeMusteriler(targetId, otherIds) {
  const others = (otherIds || []).filter((id) => id && id !== targetId)
  if (!targetId || !others.length) throw new Error('Birləşdirmək üçün ən az 2 müştəri seçin.')

  const { data: rows, error: loadErr } = await supabase
    .from(TABLE)
    .select('*')
    .in('id', [targetId, ...others])
  if (loadErr) throw loadErr
  const target = (rows || []).find((r) => r.id === targetId)
  if (!target) throw new Error('Əsas müştəri tapılmadı.')
  const otherRows = others.map((id) => (rows || []).find((r) => r.id === id)).filter(Boolean)

  // 1) Alışları köçür
  const { error: moveErr } = await supabase
    .from('musteri_bazasi')
    .update({ musteri_id: targetId })
    .in('musteri_id', others)
  if (moveErr) throw moveErr
  // Depoda bu müştəridən alınmış məhsullar da əsas müştəriyə keçsin (sütun hələ yoxdursa keç)
  const { error: depoErr } = await supabase
    .from('depo')
    .update({ musteri_id: targetId })
    .in('musteri_id', others)
  if (depoErr && !/musteri_id|schema cache|does not exist/i.test(depoErr.message || '')) throw depoErr

  // 2) Sahələri birləşdir
  const patch = {}
  const skip = new Set(['id', 'ad_soyad', 'created_at', 'updated_at', 'senedler', ...PHONE_KEYS])
  for (const o of otherRows) {
    for (const [k, v] of Object.entries(o)) {
      if (skip.has(k) || !(k in target)) continue
      if (isEmpty(target[k]) && isEmpty(patch[k]) && !isEmpty(v)) patch[k] = v
    }
  }

  // Nömrələr: fərqli olanları boş yerlərə; yer qalmasa Nömrə 5-ə əlavə et (heç biri itmir)
  const phones = PHONE_KEYS.map((k) => target[k])
  const seen = new Set(phones.map(phoneKey).filter(Boolean))
  const extra = []
  for (const o of otherRows) {
    for (const k of PHONE_KEYS) {
      const v = String(o[k] || '').trim()
      if (!v) continue
      const pk = phoneKey(v) || v
      if (seen.has(pk)) continue
      seen.add(pk)
      extra.push(v)
    }
  }
  for (let i = 0; i < PHONE_KEYS.length && extra.length; i++) {
    if (isEmpty(phones[i])) phones[i] = extra.shift()
  }
  if (extra.length) phones[4] = [phones[4], ...extra].filter((x) => !isEmpty(x)).join(', ')
  PHONE_KEYS.forEach((k, i) => {
    if ((phones[i] || null) !== (target[k] || null)) patch[k] = phones[i]
  })

  // 3) Sənədlər
  if ('senedler' in target) {
    const all = [...asList(target.senedler)]
    const paths = new Set(all.map((f) => f?.path))
    for (const o of otherRows) {
      for (const f of asList(o.senedler)) {
        if (f?.path && !paths.has(f.path)) {
          paths.add(f.path)
          all.push({ ...f, slot: undefined })
        }
      }
    }
    if (all.length !== asList(target.senedler).length) patch.senedler = all
  }

  if (Object.keys(patch).length) {
    const { error: upErr } = await supabase
      .from(TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', targetId)
    if (upErr) throw upErr
  }

  // 4) Artıq qeydləri sil (alışları artıq köçürülüb)
  const { error: delErr } = await supabase.from(TABLE).delete().in('id', others)
  if (delErr) throw delErr

  return { moved: others.length }
}
