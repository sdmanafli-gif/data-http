import {
  DEPO_TABLE,
  emptyDepoForm,
  toDepoPayload,
  rowToForm as depoRowToForm,
} from '../depo/constants'

function normImei(v) {
  return String(v || '').trim().replace(/\s/g, '')
}

/** Split joined IMEI values from multi-product credit sales (`a/b/c`). */
function splitImeiField(v) {
  return String(v || '')
    .split('/')
    .map((part) => normImei(part))
    .filter(Boolean)
}

/**
 * Find Depo row for a müştəri credit: depo_id / depo_ids first, then IMEI 1 / IMEI 2.
 */
export async function findDepoForMusteri(supabase, musteri) {
  const depoIds = []
  if (musteri?.depo_id) depoIds.push(musteri.depo_id)
  const extraIds = musteri?.extra?.depo_ids
  if (Array.isArray(extraIds)) {
    for (const id of extraIds) {
      if (id && !depoIds.includes(id)) depoIds.push(id)
    }
  }

  for (const depoId of depoIds) {
    const { data, error } = await supabase.from(DEPO_TABLE).select('*').eq('id', depoId).maybeSingle()
    if (error) return { depo: null, error, match: null }
    if (data) return { depo: data, error: null, match: 'depo_id' }
  }

  const imeiCandidates = [
    ...splitImeiField(musteri?.imei_1),
    ...splitImeiField(musteri?.imei_2),
  ]
  const uniqueImeis = [...new Set(imeiCandidates)]
  if (!uniqueImeis.length) {
    return { depo: null, error: null, match: null }
  }

  // Prefer exact filters over .or() with raw IMEI strings
  const candidates = []
  for (const imei of uniqueImeis) {
    const { data: d1, error: e1 } = await supabase.from(DEPO_TABLE).select('*').eq('imei_1', imei).limit(10)
    if (e1) return { depo: null, error: e1, match: null }
    candidates.push(...(d1 || []))
    const { data: d2, error: e2 } = await supabase.from(DEPO_TABLE).select('*').eq('imei_2', imei).limit(10)
    if (e2) return { depo: null, error: e2, match: null }
    candidates.push(...(d2 || []))
  }

  const byId = new Map()
  for (const r of candidates) byId.set(r.id, r)
  const rows = [...byId.values()]
  if (!rows.length) return { depo: null, error: null, match: null }

  // Prefer sold / returned, then exact IMEI match
  const scored = rows.map((r) => {
    let score = 0
    if (r.status === 'sold' || r.status === 'returned') score += 10
    const r1 = normImei(r.imei_1)
    const r2 = normImei(r.imei_2)
    for (const imei of uniqueImeis) {
      if (r1 === imei) score += 5
      if (r2 === imei) score += 2
    }
    return { r, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return { depo: scored[0].r, error: null, match: 'imei' }
}

/** Prefill Depo form from müştəri device fields (for create / edit). */
export function musteriToDepoForm(musteri, existingDepo = null) {
  const base = existingDepo ? depoRowToForm(existingDepo) : emptyDepoForm()
  return {
    ...base,
    model: musteri.model != null ? String(musteri.model) : base.model,
    reng: musteri.reng != null ? String(musteri.reng) : base.reng,
    yaddas: musteri.yaddas != null ? String(musteri.yaddas) : base.yaddas,
    imei_1: musteri.imei_1 != null ? String(musteri.imei_1) : base.imei_1,
    imei_2: musteri.imei_2 != null ? String(musteri.imei_2) : base.imei_2,
    serial_no: musteri.serial_no != null ? String(musteri.serial_no) : base.serial_no,
    model_no: musteri.model_no != null ? String(musteri.model_no) : base.model_no,
    battery_faiz:
      musteri.battery_faiz != null && musteri.battery_faiz !== ''
        ? String(musteri.battery_faiz)
        : base.battery_faiz,
    alis_qiymeti:
      musteri.alis_qiymeti != null && musteri.alis_qiymeti !== ''
        ? String(musteri.alis_qiymeti)
        : base.alis_qiymeti,
    kimden_alinib:
      musteri.kimden_alinib != null ? String(musteri.kimden_alinib) : base.kimden_alinib,
    status: 'available',
    miqdar: existingDepo
      ? String(Math.max(1, (Number(existingDepo.miqdar) || 0) + (existingDepo.status === 'available' ? 0 : 1)))
      : '1',
  }
}

function availableQty(depo) {
  const qty = Number(depo?.miqdar) || 0
  if (depo?.status === 'available' && qty >= 1) return qty
  return Math.max(1, qty + 1)
}

/** Only reopen as mövcud — keep all other Depo fields. */
export async function restoreDepoKeep(supabase, depo) {
  const patch = {
    status: 'available',
    miqdar: availableQty(depo),
    sold_at: null,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from(DEPO_TABLE)
    .update(patch)
    .eq('id', depo.id)
    .select('*')
    .single()
  return { data, error }
}

/** Update Depo fields from form, then set mövcud. */
export async function restoreDepoWithEdits(supabase, depoId, form) {
  const payload = toDepoPayload({
    ...form,
    status: 'available',
    miqdar: form.miqdar || '1',
  })
  payload.sold_at = null
  payload.status = 'available'
  if (payload.miqdar == null || payload.miqdar < 1) payload.miqdar = 1

  const { data, error } = await supabase
    .from(DEPO_TABLE)
    .update(payload)
    .eq('id', depoId)
    .select('*')
    .single()
  return { data, error }
}

/** Create new Depo row from form (device never in Depo). */
export async function createDepoFromForm(supabase, form) {
  const payload = toDepoPayload({
    ...form,
    status: 'available',
    miqdar: form.miqdar || '1',
  })
  payload.status = 'available'
  if (payload.miqdar == null || payload.miqdar < 1) payload.miqdar = 1
  payload.sold_at = null

  const { data, error } = await supabase.from(DEPO_TABLE).insert(payload).select('*').single()
  return { data, error }
}

export { depoRowToForm }
