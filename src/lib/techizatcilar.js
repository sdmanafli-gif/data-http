import { supabase } from './supabase'
import { normMusteriName } from './musteriler'

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
