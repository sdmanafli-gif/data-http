/**
 * Credit payment schedule for Müştəri Bazası.
 *
 * İlkin ödəniş = satış_qiyməti − (aylıq_odeniş × neçə_ay)  (never negative)
 * İlkin date   = verilmə_tarixi
 * Then neçə_ay monthly payments on ödəniş_günü, starting next month.
 *
 * Matching: İlkin + Aylıq ödənişlər cover schedule FIFO.
 * Faiz Borc is excluded (stays separate).
 * Penalty (display only): 0.5% of aylıq ödəniş × delay days.
 */

/** Daily penalty rate vs monthly installment amount */
export const PENALTY_RATE_PER_DAY = 0.005 // 0.5%

function toYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseYmd(ymd) {
  if (!ymd) return null
  const s = String(ymd).slice(0, 10)
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

function dateWithDay(year, monthIndex, dayOfMonth) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const day = Math.min(Math.max(1, dayOfMonth), lastDay)
  return toYmd(new Date(year, monthIndex, day))
}

/** Whole calendar days from a → b (ymd). Negative if b < a. */
export function daysBetween(fromYmd, toYmd) {
  const a = parseYmd(fromYmd)
  const b = parseYmd(toYmd)
  if (!a || !b) return 0
  const ms = b.getTime() - a.getTime()
  return Math.round(ms / 86400000)
}

export function computeIlkinOdenis(row) {
  const aylıq = Number(row?.ayliq_odenis)
  const months = Number(row?.nece_ay)
  const sale = Number(row?.satis_qiymeti)
  if (!Number.isFinite(aylıq) || !Number.isFinite(months) || !Number.isFinite(sale)) return null
  if (months <= 0) return null
  return Math.max(0, sale - aylıq * months)
}

export function canBuildSchedule(row) {
  if (!row) return false
  if (!parseYmd(row.verilme_tarixi)) return false
  const months = Number(row.nece_ay)
  const aylıq = Number(row.ayliq_odenis)
  const payDay = Number(row.odenis_gunu)
  const sale = Number(row.satis_qiymeti)
  if (!Number.isFinite(months) || months <= 0) return false
  if (!Number.isFinite(aylıq) || aylıq < 0) return false
  if (!Number.isFinite(payDay) || payDay < 1 || payDay > 31) return false
  if (!Number.isFinite(sale)) return false
  return true
}

/**
 * Build installment rows for one müştəri credit record.
 * @returns {Array<{ type, label, installment, tarix, mebleg }>}
 */
export function buildPaymentSchedule(row) {
  if (!canBuildSchedule(row)) return []

  const start = parseYmd(row.verilme_tarixi)
  const months = Number(row.nece_ay)
  const aylıq = Number(row.ayliq_odenis)
  const payDay = Number(row.odenis_gunu)
  const ilkin = computeIlkinOdenis(row)

  const schedule = []

  schedule.push({
    type: 'ilkin',
    label: 'İlkin ödəniş',
    installment: 0,
    tarix: toYmd(start),
    mebleg: ilkin == null ? 0 : Math.max(0, ilkin),
  })

  for (let i = 1; i <= months; i += 1) {
    const dueMonth = start.getMonth() + i
    const dueYear = start.getFullYear() + Math.floor(dueMonth / 12)
    const monthIndex = ((dueMonth % 12) + 12) % 12
    schedule.push({
      type: 'ayliq',
      label: `Aylıq ödəniş (${i}/${months})`,
      installment: i,
      tarix: dateWithDay(dueYear, monthIndex, payDay),
      mebleg: aylıq,
    })
  }

  return schedule
}

/**
 * Apply İlkin/Aylıq payments onto schedule (FIFO by due date).
 * Faiz tip is ignored.
 *
 * @param {Array} schedule from buildPaymentSchedule
 * @param {Array<{ tip, mebleg, tarix }>} payments
 * @param {{ aylıq?: number, today?: string }} opts
 * @returns matched schedule lines with paid/remaining/delay/penalty
 */
export function matchPaymentsToSchedule(schedule, payments, opts = {}) {
  const today = opts.today || toYmd(new Date())
  const aylıq =
    opts.aylıq != null && Number.isFinite(Number(opts.aylıq))
      ? Number(opts.aylıq)
      : Number(schedule.find((s) => s.type === 'ayliq')?.mebleg) || 0

  const lines = (schedule || []).map((item) => ({
    ...item,
    owed: Number(item.mebleg) || 0,
    paid: 0,
    remaining: Number(item.mebleg) || 0,
    coveredAt: null, // ymd when fully paid
    delayDays: 0,
    penalty: 0,
    status: 'gozleyir', // gozleyir | qismən | odenib | gecikib
  }))

  const usable = (payments || [])
    .filter((p) => p && (p.tip === 'ilkin' || p.tip === 'ayliq'))
    .map((p) => ({
      tip: p.tip,
      mebleg: Number(p.mebleg) || 0,
      tarix: p.tarix ? String(p.tarix).slice(0, 10) : today,
    }))
    .filter((p) => p.mebleg > 0)
    .sort((a, b) => {
      if (a.tarix !== b.tarix) return a.tarix.localeCompare(b.tarix)
      return 0
    })

  // Apply each payment left-to-right across unpaid schedule lines
  for (const pay of usable) {
    let left = pay.mebleg
    for (const line of lines) {
      if (left <= 0) break
      if (line.remaining <= 0) continue
      const take = Math.min(line.remaining, left)
      line.paid += take
      line.remaining = Math.round((line.remaining - take) * 100) / 100
      left = Math.round((left - take) * 100) / 100
      if (line.remaining <= 0.001) {
        line.remaining = 0
        line.coveredAt = pay.tarix
      }
    }
  }

  for (const line of lines) {
    if (line.owed <= 0) {
      line.status = 'odenib'
      line.delayDays = 0
      line.penalty = 0
      continue
    }

    // Delay: if fully paid after due → coveredAt − due; if still open and due passed → today − due
    let delay = 0
    if (line.remaining <= 0 && line.coveredAt) {
      delay = Math.max(0, daysBetween(line.tarix, line.coveredAt))
    } else if (line.remaining > 0 && line.tarix < today) {
      delay = Math.max(0, daysBetween(line.tarix, today))
    }
    line.delayDays = delay
    line.penalty =
      delay > 0 && aylıq > 0
        ? Math.round(aylıq * PENALTY_RATE_PER_DAY * delay * 100) / 100
        : 0

    if (line.remaining <= 0) {
      line.status = delay > 0 ? 'odenib_gec' : 'odenib'
    } else if (line.paid > 0) {
      line.status = line.tarix < today ? 'gecikib' : 'qismen'
    } else if (line.tarix < today) {
      line.status = 'gecikib'
    } else {
      line.status = 'gozleyir'
    }
  }

  return lines
}

export function matchedScheduleTotals(matched) {
  let owed = 0
  let paid = 0
  let remaining = 0
  let penalty = 0
  let delayMax = 0
  for (const line of matched || []) {
    owed += Number(line.owed) || 0
    paid += Number(line.paid) || 0
    remaining += Number(line.remaining) || 0
    penalty += Number(line.penalty) || 0
    delayMax = Math.max(delayMax, Number(line.delayDays) || 0)
  }
  return {
    owed,
    paid,
    remaining,
    penalty,
    delayMax,
    count: (matched || []).length,
  }
}

/**
 * Flatten all credit müştəri schedules into calendar events (always "collect").
 */
export function buildAllPaymentEvents(rows, { today = toYmd(new Date()) } = {}) {
  const list = []
  for (const row of rows || []) {
    const schedule = buildPaymentSchedule(row)
    for (const item of schedule) {
      list.push({
        id: `${row.id}-${item.type}-${item.installment}`,
        musteriId: row.id,
        ad_soyad: row.ad_soyad || '—',
        model: row.model || null,
        veziyyet: row.veziyyet || null,
        type: item.type,
        label: item.label,
        installment: item.installment,
        tarix: item.tarix,
        mebleg: item.mebleg,
        direction: 'collect',
        overdue: item.tarix < today,
      })
    }
  }
  list.sort((a, b) => {
    if (a.tarix !== b.tarix) return a.tarix.localeCompare(b.tarix)
    return String(a.ad_soyad).localeCompare(String(b.ad_soyad), 'az')
  })
  return list
}

export function scheduleTotals(schedule) {
  let ilkin = 0
  let aylıq = 0
  for (const item of schedule || []) {
    if (item.type === 'ilkin') ilkin += Number(item.mebleg) || 0
    else aylıq += Number(item.mebleg) || 0
  }
  return { ilkin, aylıq, cemi: ilkin + aylıq, count: (schedule || []).length }
}

export function statusLabel(status) {
  switch (status) {
    case 'odenib':
      return 'Ödənib'
    case 'odenib_gec':
      return 'Ödənib (gec)'
    case 'qismen':
      return 'Qismən'
    case 'gecikib':
      return 'Gecikib'
    case 'gozleyir':
    default:
      return 'Gözləyir'
  }
}
