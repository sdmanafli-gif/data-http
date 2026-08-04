import { formatDate } from '../../lib/formatDate'
import { computeMonthlyAmount } from './sexsiKreditSchedule'

export { formatDate }

export const SEXSI_KREDIT_TABLE = 'sexsi_kreditler'
export const SEXSI_KREDIT_ODENIS_TABLE = 'sexsi_kredit_odenisleri'

export function formatMoney(value) {
  const n = Number(value)
  if (value === null || value === undefined || value === '' || Number.isNaN(n)) return '—'
  return `${n.toLocaleString('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} AZN`
}

export function emptySexsiKreditForm() {
  return {
    ad: '',
    kimden: '',
    verilme_tarixi: new Date().toISOString().slice(0, 10),
    cemi_mebleg: '',
    nece_ay: '',
    aylik_odenis: '',
    birinci_odenis_tarixi: '',
    qeyd: '',
  }
}

export function rowToSexsiForm(row) {
  return {
    ad: row.ad || '',
    kimden: row.kimden || '',
    verilme_tarixi: row.verilme_tarixi ? String(row.verilme_tarixi).slice(0, 10) : '',
    cemi_mebleg: row.cemi_mebleg != null ? String(row.cemi_mebleg) : '',
    nece_ay: row.nece_ay != null ? String(row.nece_ay) : '',
    aylik_odenis: row.aylik_odenis != null ? String(row.aylik_odenis) : '',
    birinci_odenis_tarixi: row.birinci_odenis_tarixi
      ? String(row.birinci_odenis_tarixi).slice(0, 10)
      : '',
    qeyd: row.qeyd || '',
  }
}

export function toSexsiKreditPayload(form) {
  const months = Number(form.nece_ay)
  const cemi = Number(String(form.cemi_mebleg).replace(',', '.'))
  let aylik = form.aylik_odenis === '' || form.aylik_odenis == null
    ? null
    : Number(String(form.aylik_odenis).replace(',', '.'))
  if (aylik == null && Number.isFinite(cemi) && Number.isFinite(months) && months > 0) {
    aylik = computeMonthlyAmount(cemi, months)
  }
  return {
    ad: String(form.ad || '').trim(),
    kimden: String(form.kimden || '').trim() || null,
    verilme_tarixi: form.verilme_tarixi || null,
    cemi_mebleg: Number.isFinite(cemi) ? cemi : 0,
    nece_ay: Number.isFinite(months) ? Math.trunc(months) : 1,
    aylik_odenis: Number.isFinite(aylik) ? aylik : null,
    birinci_odenis_tarixi: form.birinci_odenis_tarixi || null,
    qeyd: String(form.qeyd || '').trim() || null,
    updated_at: new Date().toISOString(),
  }
}

export function validateSexsiKreditForm(form) {
  if (!String(form.ad || '').trim()) return 'Kredit adı doldurulmalıdır (məs: Kapital kredit).'
  if (!form.verilme_tarixi) return 'Götürülmə tarixi doldurulmalıdır.'
  const cemi = Number(String(form.cemi_mebleg).replace(',', '.'))
  if (!Number.isFinite(cemi) || cemi <= 0) return 'Cəmi məbləğ düzgün daxil edilməlidir.'
  const months = Number(form.nece_ay)
  if (!Number.isFinite(months) || months <= 0) return 'Neçə ay doldurulmalıdır.'
  return null
}
