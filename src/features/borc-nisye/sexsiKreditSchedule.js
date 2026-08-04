/**
 * Şəxsi kredit ödəniş qrafiki.
 * Cəmi məbləğ / neçə ay → aylıq (son ay qalan fərqi alır).
 * Tarixlər: birinci_odenis_tarixi (və ya verilmə + 1 ay), sonra eyni gün.
 */

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

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

export function computeMonthlyAmount(cemi, months) {
  const total = Number(cemi)
  const m = Number(months)
  if (!Number.isFinite(total) || !Number.isFinite(m) || m <= 0) return null
  return round2(total / m)
}

export function splitInstallments(cemi, months) {
  const total = round2(cemi)
  const m = Math.trunc(Number(months))
  if (!Number.isFinite(total) || m <= 0) return []
  const base = round2(total / m)
  const amounts = []
  let sum = 0
  for (let i = 1; i < m; i += 1) {
    amounts.push(base)
    sum = round2(sum + base)
  }
  amounts.push(round2(total - sum))
  return amounts
}

export function firstPaymentAnchor(kredit) {
  const explicit = parseYmd(kredit?.birinci_odenis_tarixi)
  if (explicit) return explicit
  const start = parseYmd(kredit?.verilme_tarixi)
  if (!start) return null
  return new Date(start.getFullYear(), start.getMonth() + 1, start.getDate())
}

export function canBuildSexsiSchedule(kredit) {
  if (!kredit) return false
  if (!parseYmd(kredit.verilme_tarixi)) return false
  const months = Number(kredit.nece_ay)
  const total = Number(kredit.cemi_mebleg)
  if (!Number.isFinite(months) || months <= 0) return false
  if (!Number.isFinite(total) || total < 0) return false
  return Boolean(firstPaymentAnchor(kredit))
}

/** Auto schedule (ignores custom odenis_qrafiki). */
export function buildSexsiSchedule(kredit) {
  if (!canBuildSexsiSchedule(kredit)) return []
  const months = Math.trunc(Number(kredit.nece_ay))
  const amounts = splitInstallments(kredit.cemi_mebleg, months)
  const overrideAylik = Number(kredit.aylik_odenis)
  const useOverride = Number.isFinite(overrideAylik) && overrideAylik > 0
  const anchor = firstPaymentAnchor(kredit)
  const anchorDay = anchor.getDate()
  const schedule = []

  for (let i = 1; i <= months; i += 1) {
    const due = new Date(anchor.getFullYear(), anchor.getMonth() + (i - 1), 1)
    const tarix = dateWithDay(due.getFullYear(), due.getMonth(), anchorDay)
    let mebleg = amounts[i - 1]
    if (useOverride) {
      if (i < months) mebleg = round2(overrideAylik)
      else mebleg = round2(Number(kredit.cemi_mebleg) - overrideAylik * (months - 1))
    }
    schedule.push({
      type: 'ayliq',
      label: `Ödəniş (${i}/${months})`,
      installment: i,
      tarix,
      mebleg: Math.max(0, mebleg),
    })
  }
  return schedule
}

export function normalizeSexsiScheduleLines(lines, kredit) {
  const months = Number(kredit?.nece_ay) || 0
  return (lines || []).map((item, idx) => {
    const installment =
      Number(item.installment) > 0 ? Number(item.installment) : idx + 1
    return {
      type: 'ayliq',
      label: `Ödəniş (${installment}${months ? `/${months}` : ''})`,
      installment,
      tarix: item.tarix ? String(item.tarix).slice(0, 10) : '',
      mebleg: round2(item.mebleg),
    }
  })
}

export function resolveSexsiSchedule(kredit) {
  if (Array.isArray(kredit?.odenis_qrafiki) && kredit.odenis_qrafiki.length > 0) {
    return normalizeSexsiScheduleLines(kredit.odenis_qrafiki, kredit)
  }
  return buildSexsiSchedule(kredit)
}

export function scheduleIsCustom(kredit) {
  return Array.isArray(kredit?.odenis_qrafiki) && kredit.odenis_qrafiki.length > 0
}

export function validateSexsiSchedule(schedule, kredit) {
  const warnings = []
  const lines = normalizeSexsiScheduleLines(schedule, kredit)
  if (!lines.length) {
    warnings.push('Qrafik boşdur.')
    return warnings
  }
  const total = Number(kredit?.cemi_mebleg)
  const months = Number(kredit?.nece_ay)
  const sum = round2(lines.reduce((a, l) => a + (Number(l.mebleg) || 0), 0))

  if (Number.isFinite(total) && Math.abs(sum - total) > 0.01) {
    warnings.push(
      `Qrafik cəmi (${sum}) kredit məbləğinə (${total}) bərabər deyil. Fərq: ${round2(sum - total)}.`
    )
  }
  if (Number.isFinite(months) && months > 0 && lines.length !== months) {
    warnings.push(`Ödəniş sayı (${lines.length}) neçə aya (${months}) uyğun gəlmir.`)
  }
  for (let i = 0; i < lines.length; i += 1) {
    if (!parseYmd(lines[i].tarix)) warnings.push(`Sətir ${i + 1}: tarix düzgün deyil.`)
    if ((Number(lines[i].mebleg) || 0) < 0) warnings.push(`Sətir ${i + 1}: məbləğ mənfi ola bilməz.`)
  }
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].tarix && lines[i - 1].tarix && lines[i].tarix < lines[i - 1].tarix) {
      warnings.push(`Tarixlər artan sırada deyil (${lines[i - 1].tarix} → ${lines[i].tarix}).`)
      break
    }
  }
  return warnings
}

/** FIFO match payments onto schedule. */
export function matchSexsiPayments(schedule, payments, { today } = {}) {
  const todayYmd = today || toYmd(new Date())
  const lines = (schedule || []).map((item) => ({
    ...item,
    owed: Number(item.mebleg) || 0,
    paid: 0,
    remaining: Number(item.mebleg) || 0,
    delayDays: 0,
    status: 'gozleyir',
  }))

  const usable = (payments || [])
    .map((p) => ({
      mebleg: Number(p.mebleg) || 0,
      tarix: p.tarix ? String(p.tarix).slice(0, 10) : todayYmd,
    }))
    .filter((p) => p.mebleg > 0)
    .sort((a, b) => a.tarix.localeCompare(b.tarix))

  for (const pay of usable) {
    let left = pay.mebleg
    for (const line of lines) {
      if (left <= 0) break
      if (line.remaining <= 0) continue
      const take = Math.min(line.remaining, left)
      line.paid = round2(line.paid + take)
      line.remaining = round2(line.remaining - take)
      left = round2(left - take)
    }
  }

  for (const line of lines) {
    if (line.remaining <= 0.001) {
      line.remaining = 0
      line.status = 'odenib'
    } else if (line.paid > 0) {
      line.status = line.tarix < todayYmd ? 'gecikib' : 'qismen'
    } else if (line.tarix < todayYmd) {
      line.status = 'gecikib'
    } else {
      line.status = 'gozleyir'
    }
    if (line.remaining > 0 && line.tarix < todayYmd) {
      const a = parseYmd(line.tarix)
      const b = parseYmd(todayYmd)
      line.delayDays = a && b ? Math.max(0, Math.round((b - a) / 86400000)) : 0
    }
  }
  return lines
}

export function sexsiScheduleTotals(matched) {
  let owed = 0
  let paid = 0
  let remaining = 0
  for (const line of matched || []) {
    owed += Number(line.owed) || 0
    paid += Number(line.paid) || 0
    remaining += Number(line.remaining) || 0
  }
  return {
    owed: round2(owed),
    paid: round2(paid),
    remaining: round2(remaining),
    count: (matched || []).length,
  }
}

export function statusLabelAz(status) {
  switch (status) {
    case 'odenib':
      return 'Ödənib'
    case 'qismen':
      return 'Qismən'
    case 'gecikib':
      return 'Gecikib'
    default:
      return 'Gözləyir'
  }
}

export function summarizeKredit(kredit, payments) {
  const schedule = resolveSexsiSchedule(kredit)
  const matched = matchSexsiPayments(schedule, payments)
  const totals = sexsiScheduleTotals(matched)
  return { schedule, matched, totals }
}
