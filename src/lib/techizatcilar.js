import { supabase } from './supabase'
import { normMusteriName } from './musteriler'
import { phoneKeyOf } from './oxsarAdlar'

/**
 * Təchizatçılar (techizatcilar cədvəli) — Depoda "Yeni Təchizatçı" ilə yaradılır,
 * Kontaktlar → Təchizatçılar bölməsində görünür.
 */
export const TECHIZATCI_TABLE = 'techizatcilar'

/** Bütün təchizatçılar (cədvəl hələ yoxdursa boş siyahı) */
export async function loadTechizatcilar() {
  const { data, error } = await supabase
    .from(TECHIZATCI_TABLE)
    .select('*')
    .order('ad_soyad', { ascending: true })
  if (error) return { data: [], error }
  return { data: data || [], error: null }
}

/**
 * Eyni adlı təchizatçı varsa onu qaytarır (boş sahələrini doldurur), yoxdursa yaradır.
 * @param {{ad_soyad:string, tukan?:string, nomre_1?:string, nomre_2?:string, komment?:string}} t
 * @returns {Promise<string>} id
 */
export async function findOrCreateTechizatci(t) {
  const ad = String(t.ad_soyad || '').trim()
  if (!ad) throw new Error('Təchizatçının Ad / Soyad / Ata adı yazılmalıdır.')
  const clean = {
    ad_soyad: ad,
    tukan: String(t.tukan || '').trim() || null,
    nomre_1: String(t.nomre_1 || '').trim() || null,
    nomre_2: String(t.nomre_2 || '').trim() || null,
    komment: String(t.komment || '').trim() || null,
  }
  const { data: list, error } = await loadTechizatcilar()
  if (error) throw error
  const key = normMusteriName(ad)
  const found = list.find((x) => normMusteriName(x.ad_soyad) === key)
  if (found) {
    const patch = {}
    for (const k of ['tukan', 'nomre_1', 'nomre_2', 'komment']) {
      if (!String(found[k] || '').trim() && clean[k]) patch[k] = clean[k]
    }
    if (Object.keys(patch).length) {
      const { error: upErr } = await supabase
        .from(TECHIZATCI_TABLE)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', found.id)
      if (upErr) throw upErr
    }
    return found.id
  }
  const { data, error: insErr } = await supabase
    .from(TECHIZATCI_TABLE)
    .insert(clean)
    .select('id')
    .single()
  if (insErr) throw insErr
  return data.id
}

function chunkIds(arr, size = 200) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Bir neçə təchizatçını birinə birləşdirir (Kontaktlar → Təchizatçılar → Birləşdir).
 *  1) digərlərindən alınan bütün məhsulların Depodakı «Kimdən» xanasına əsasın adı yazılır
 *  2) Borc / Nisyə yazılarında da ad əsasın adına dəyişir
 *  3) Tükan / nömrə / komment: əsasın boş xanaları digərlərindən doldurulur, fərqli nömrələr itmir
 *  4) yalnız bundan sonra artıq təchizatçı qeydləri silinir
 * Ardıcıllıq elədir ki, yarıda xəta olsa belə heç bir məhsul və ya yazı itmir.
 *
 * @param {{name:string, info:object|null, items:Array}} target
 * @param {Array<{name:string, key:string, info:object|null, items:Array}>} others
 * @param {string[]} ledgerNames Borc / Nisyədə digərlərinin adı ilə yazılmış «kime» dəyərləri
 * @param {string} ledgerTable
 */
export async function mergeTechizatcilar(target, others, ledgerNames, ledgerTable) {
  const list = (others || []).filter((o) => o && o.key !== target?.key)
  if (!target || !list.length) throw new Error('Birləşdirmək üçün ən az 2 təchizatçı seçin.')
  const name = target.name
  const now = new Date().toISOString()

  // 1) Depo — «Kimdən»
  const itemIds = list.flatMap((o) => o.items.map((d) => d.id))
  for (const ids of chunkIds(itemIds)) {
    const { error } = await supabase.from('depo').update({ kimden_alinib: name, updated_at: now }).in('id', ids)
    if (error) throw error
  }

  // 2) Borc / Nisyə
  for (const old of ledgerNames || []) {
    if (old === name) continue
    const { error } = await supabase.from(ledgerTable).update({ kime: name }).eq('kime', old)
    if (error) throw error
  }

  // 3) Kart məlumatları
  const infos = [target.info, ...list.map((o) => o.info)].filter(Boolean)
  if (infos.length) {
    const base = target.info || {}
    const merged = {
      ad_soyad: name,
      tukan: base.tukan || null,
      nomre_1: base.nomre_1 || null,
      nomre_2: base.nomre_2 || null,
      komment: base.komment || null,
    }
    const seen = new Set([merged.nomre_1, merged.nomre_2].filter(Boolean).map((p) => phoneKeyOf(p) || p))
    const extraPhones = []
    const komments = merged.komment ? [merged.komment] : []
    for (const o of list) {
      const i = o.info
      if (!i) continue
      if (!merged.tukan && i.tukan) merged.tukan = i.tukan
      for (const p of [i.nomre_1, i.nomre_2]) {
        const v = String(p || '').trim()
        if (!v) continue
        const k = phoneKeyOf(v) || v
        if (seen.has(k)) continue
        seen.add(k)
        extraPhones.push(v)
      }
      const km = String(i.komment || '').trim()
      if (km && !komments.includes(km)) komments.push(km)
    }
    if (!merged.nomre_1 && extraPhones.length) merged.nomre_1 = extraPhones.shift()
    if (!merged.nomre_2 && extraPhones.length) merged.nomre_2 = extraPhones.shift()
    if (extraPhones.length) merged.nomre_2 = [merged.nomre_2, ...extraPhones].filter(Boolean).join(', ')
    merged.komment = komments.join(' | ') || null

    // Əsasın öz qeydi yoxdursa, digərlərinin birinin qeydini əsas adla saxlayırıq
    const keepId = target.info?.id || list.find((o) => o.info)?.info.id
    const { error: upErr } = await supabase
      .from(TECHIZATCI_TABLE)
      .update({ ...merged, updated_at: now })
      .eq('id', keepId)
    if (upErr) throw upErr

    // 4) Artıq qeydlər
    const delIds = infos.map((i) => i.id).filter((id) => id && id !== keepId)
    if (delIds.length) {
      // Depoda silinəcək qeydlərə bağlı məhsullar əsas qeydə bağlansın (bağlantı itməsin)
      const { error: linkErr } = await supabase
        .from('depo')
        .update({ techizatci_id: keepId })
        .in('techizatci_id', delIds)
      if (linkErr) throw linkErr
      const { error: delErr } = await supabase.from(TECHIZATCI_TABLE).delete().in('id', delIds)
      if (delErr) throw delErr
    }
  }
  return { moved: itemIds.length }
}
