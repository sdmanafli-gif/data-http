/**
 * Credit payment schedule for Müştəri Bazası.
 *
 * İlkin ödəniş = satış_qiyməti − (aylıq_odeniş × neçə_ay)  (never negative)
 * İlkin date   = verilmə_tarixi
 *
 * Aylıq dates:
 *   - If birinci_ayliq_odenis_tarixi is set → use it for month 1,
 *     then same day each following month.
 *   - Else → verilmə month + i, on ödəniş_günü.
 *
 * Custom override: row.odenis_qrafiki (jsonb array) when present.
 *
 * Matching: İlkin + Aylıq ödənişlər cover schedule FIFO.
 * Faiz Borc payments cover per-line cərimə FIFO (earliest installments first).
 * Penalty (display): 0.5% of aylıq ödəniş × delay days.
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
  const sale = Number(row.satis_qiymeti)
  if (!Number.isFinite(months) || months <= 0) return false
  if (!Number.isFinite(aylıq) || aylıq < 0) return false
  if (!Number.isFinite(sale)) return false

  const firstMonthly = parseYmd(row.birinci_ayliq_odenis_tarixi)
  if (firstMonthly) return true

  const payDay = Number(row.odenis_gunu)
  if (!Number.isFinite(payDay) || payDay < 1 || payDay > 31) return false
  return true
}

/**
 * Build installment rows for one müştəri credit record (always auto formula).
 * @returns {Array<{ type, label, installment, tarix, mebleg }>}
 */
export function buildPaymentSchedule(row) {
  if (!canBuildSchedule(row)) return []

  const start = parseYmd(row.verilme_tarixi)
  const months = Number(row.nece_ay)
  const aylıq = Number(row.ayliq_odenis)
  const payDay = Number(row.odenis_gunu)
  const firstMonthly = parseYmd(row.birinci_ayliq_odenis_tarixi)
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
    let tarix
    if (firstMonthly) {
      const anchorDay = firstMonthly.getDate()
      const due = new Date(firstMonthly.getFullYear(), firstMonthly.getMonth() + (i - 1), 1)
      tarix = dateWithDay(due.getFullYear(), due.getMonth(), anchorDay)
    } else {
      const dueMonth = start.getMonth() + i
      const dueYear = start.getFullYear() + Math.floor(dueMonth / 12)
      const monthIndex = ((dueMonth % 12) + 12) % 12
      tarix = dateWithDay(dueYear, monthIndex, payDay)
    }
    schedule.push({
      type: 'ayliq',
      label: `Aylıq ödəniş (${i}/${months})`,
      installment: i,
      tarix,
      mebleg: aylıq,
    })
  }

  return schedule
}

/**
 * Build schedule for a new credit sale, optionally overriding ilkin amount/date
 * (used when down payment is partial and remaining is due later → Yığım).
 */
export function buildSaleScheduleWithIlkin(row, { ilkinMebleg, ilkinTarix } = {}) {
  const base = buildPaymentSchedule(row)
  if (!base.length) return null
  const patched = base.map((line) => {
    if (line.type !== 'ilkin') return line
    return {
      ...line,
      mebleg: ilkinMebleg != null ? Number(ilkinMebleg) : line.mebleg,
      tarix: ilkinTarix ? String(ilkinTarix).slice(0, 10) : line.tarix,
    }
  })
  return normalizeScheduleLines(patched, row)
}

/** Normalize a custom/auto schedule line list for storage & display. */
export function normalizeScheduleLines(lines, row) {
  const months = Number(row?.nece_ay) || 0
  return (lines || []).map((item, idx) => {
    const type = item.type === 'ilkin' ? 'ilkin' : 'ayliq'
    const installment =
      type === 'ilkin' ? 0 : Number(item.installment) > 0 ? Number(item.installment) : idx
    return {
      type,
      label:
        type === 'ilkin'
          ? 'İlkin ödəniş'
          : `Aylıq ödəniş (${installment}${months ? `/${months}` : ''})`,
      installment,
      tarix: item.tarix ? String(item.tarix).slice(0, 10) : '',
      mebleg: Math.round((Number(item.mebleg) || 0) * 100) / 100,
    }
  })
}

/**
 * Prefer saved custom qrafik; otherwise auto-build.
 */
export function resolvePaymentSchedule(row) {
  if (Array.isArray(row?.odenis_qrafiki) && row.odenis_qrafiki.length > 0) {
    return normalizeScheduleLines(row.odenis_qrafiki, row)
  }
  return buildPaymentSchedule(row)
}

export function scheduleIsCustom(row) {
  return Array.isArray(row?.odenis_qrafiki) && row.odenis_qrafiki.length > 0
}

/**
 * Validate schedule against müştəri credit fields.
 * Returns warning strings (empty = OK).
 */
export function validatePaymentSchedule(schedule, row) {
  const warnings = []
  const lines = normalizeScheduleLines(schedule, row)
  if (!lines.length) {
    warnings.push('Qrafik boşdur.')
    return warnings
  }

  const sale = Number(row?.satis_qiymeti)
  const months = Number(row?.nece_ay)
  const aylıq = Number(row?.ayliq_odenis)
  const expectedIlkin = computeIlkinOdenis(row)
  const totals = scheduleTotals(lines)

  if (Number.isFinite(sale)) {
    const diff = Math.round((totals.cemi - sale) * 100) / 100
    if (Math.abs(diff) > 0.01) {
      warnings.push(
        `Qrafik cəmi (${formatAz(totals.cemi)}) satış qiymətinə (${formatAz(sale)}) bərabər deyil. Fərq: ${formatAz(diff)}.`
      )
    }
  }

  const aylıqLines = lines.filter((l) => l.type === 'ayliq')
  const ilkinLines = lines.filter((l) => l.type === 'ilkin')

  if (Number.isFinite(months) && months > 0 && aylıqLines.length !== months) {
    warnings.push(
      `Aylıq ödəniş sayı (${aylıqLines.length}) neçə aya (${months}) uyğun gəlmir.`
    )
  }

  if (ilkinLines.length !== 1) {
    warnings.push(`İlkin ödəniş sətiri ${ilkinLines.length} dəfədir (1 olmalıdır).`)
  }

  if (Number.isFinite(aylıq) && aylıqLines.some((l) => Math.abs((Number(l.mebleg) || 0) - aylıq) > 0.01)) {
    warnings.push(
      `Bəzi aylıq məbləğlər aylıq ödənişə (${formatAz(aylıq)}) uyğun gəlmir.`
    )
  }

  if (
    expectedIlkin != null &&
    ilkinLines[0] &&
    Math.abs((Number(ilkinLines[0].mebleg) || 0) - expectedIlkin) > 0.01
  ) {
    warnings.push(
      `İlkin ödəniş (${formatAz(ilkinLines[0].mebleg)}) gözlənilənə (${formatAz(expectedIlkin)}) uyğun gəlmir.`
    )
  }

  for (let i = 0; i < lines.length; i += 1) {
    if (!parseYmd(lines[i].tarix)) {
      warnings.push(`Sətir ${i + 1}: tarix düzgün deyil.`)
    }
    if ((Number(lines[i].mebleg) || 0) < 0) {
      warnings.push(`Sətir ${i + 1}: məbləğ mənfi ola bilməz.`)
    }
  }

  for (let i = 1; i < lines.length; i += 1) {
    const a = lines[i - 1].tarix
    const b = lines[i].tarix
    if (a && b && b < a) {
      warnings.push(`Tarixlər artan sırada deyil (${a} → ${b}).`)
      break
    }
  }

  const firstCustom = aylıqLines[0]?.tarix
  const firstField = row?.birinci_ayliq_odenis_tarixi
    ? String(row.birinci_ayliq_odenis_tarixi).slice(0, 10)
    : null
  if (firstField && firstCustom && firstCustom !== firstField) {
    warnings.push(
      `Birinci aylıq tarix (${firstCustom}) sahədəki tarixdən (${firstField}) fərqlidir.`
    )
  }

  return warnings
}

function formatAz(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `${x.toLocaleString('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} AZN`
}

/**
 * Apply İlkin/Aylıq payments onto schedule (FIFO by due date).
 * Then allocate Faiz payments onto per-line cərimə (FIFO: first installments first).
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
    coveredAt: null,
    delayDays: 0,
    penalty: 0,
    penaltyPaid: 0,
    penaltyRemaining: 0,
    status: 'gozleyir',
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
      line.penaltyPaid = 0
      line.penaltyRemaining = 0
      continue
    }

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
    line.penaltyPaid = 0
    line.penaltyRemaining = line.penalty

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

  // Faiz ödənişləri → cərimə örtülməsi (əvvəlki sətirlər / vaxtı keçənlər əvvəl)
  const faizPays = (payments || [])
    .filter((p) => p && p.tip === 'faiz')
    .map((p) => ({
      mebleg: Number(p.mebleg) || 0,
      tarix: p.tarix ? String(p.tarix).slice(0, 10) : today,
    }))
    .filter((p) => p.mebleg > 0)
    .sort((a, b) => {
      if (a.tarix !== b.tarix) return a.tarix.localeCompare(b.tarix)
      return 0
    })

  for (const pay of faizPays) {
    let left = pay.mebleg
    for (const line of lines) {
      if (left <= 0) break
      if (line.penaltyRemaining <= 0) continue
      const take = Math.min(line.penaltyRemaining, left)
      line.penaltyPaid = Math.round((line.penaltyPaid + take) * 100) / 100
      line.penaltyRemaining = Math.round((line.penaltyRemaining - take) * 100) / 100
      left = Math.round((left - take) * 100) / 100
      if (line.penaltyRemaining <= 0.001) line.penaltyRemaining = 0
    }
  }

  return lines
}

export function matchedScheduleTotals(matched, payments = []) {
  let owed = 0
  let paid = 0
  let remaining = 0
  let penalty = 0
  let penaltyPaidAllocated = 0
  let penaltyRemaining = 0
  let delayMax = 0
  for (const line of matched || []) {
    owed += Number(line.owed) || 0
    paid += Number(line.paid) || 0
    remaining += Number(line.remaining) || 0
    penalty += Number(line.penalty) || 0
    penaltyPaidAllocated += Number(line.penaltyPaid) || 0
    penaltyRemaining += Number(line.penaltyRemaining) || 0
    delayMax = Math.max(delayMax, Number(line.delayDays) || 0)
  }

  let faizPaid = 0
  for (const p of payments || []) {
    if (p?.tip === 'faiz') faizPaid += Number(p.mebleg) || 0
  }
  faizPaid = Math.round(faizPaid * 100) / 100
  const cerimeQaliq = Math.max(0, Math.round((penalty - faizPaid) * 100) / 100)

  return {
    owed,
    paid,
    remaining,
    penalty: Math.round(penalty * 100) / 100,
    /** Sum of Faiz Borc payments from ödənişlər */
    penaltyPaid: faizPaid,
    /** Cərimə − faiz ödənilib (not below 0) */
    penaltyRemaining: cerimeQaliq,
    penaltyPaidAllocated: Math.round(penaltyPaidAllocated * 100) / 100,
    delayMax,
    count: (matched || []).length,
  }
}

/**
 * Debt due as of today from matched schedule lines (unpaid amounts with tarix ≤ today).
 * Helps answer: "customer missed N months — how much do they owe today?"
 */
export function dueAsOfTodayTotals(matched, today = toYmd(new Date())) {
  const asOf = String(today).slice(0, 10)
  let dueNow = 0
  let overdue = 0
  let dueToday = 0
  let overdueLines = 0
  let overdueAylik = 0
  let penaltyDue = 0
  let oldestOverdue = null

  for (const line of matched || []) {
    const tarix = line.tarix ? String(line.tarix).slice(0, 10) : ''
    if (!tarix || tarix > asOf) continue

    const penRem = Number(line.penaltyRemaining ?? line.penalty) || 0
    if (penRem > 0) {
      penaltyDue = Math.round((penaltyDue + penRem) * 100) / 100
    }

    const rem = Number(line.remaining) || 0
    if (rem <= 0.001) continue

    dueNow = Math.round((dueNow + rem) * 100) / 100

    if (tarix < asOf) {
      overdue = Math.round((overdue + rem) * 100) / 100
      overdueLines += 1
      if (line.type === 'ayliq') overdueAylik += 1
      if (!oldestOverdue || tarix < oldestOverdue) oldestOverdue = tarix
    } else {
      dueToday = Math.round((dueToday + rem) * 100) / 100
    }
  }

  return {
    asOf,
    /** Unpaid schedule amounts due on or before today */
    dueNow,
    /** Strictly overdue (before today) */
    overdue,
    /** Due exactly today */
    dueToday,
    overdueLines,
    /** Count of unpaid monthly installments past due */
    overdueAylik,
    penaltyDue,
    dueWithPenalty: Math.round((dueNow + penaltyDue) * 100) / 100,
    oldestOverdue,
  }
}

export function buildAllPaymentEvents(rows, { today = toYmd(new Date()) } = {}) {
  const list = []
  for (const row of rows || []) {
    const schedule = resolvePaymentSchedule(row)
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
