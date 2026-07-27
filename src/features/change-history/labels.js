/** Human-readable field labels across modules (fallback = key). */
export const FIELD_LABELS = {
  sira_no: '# / №',
  ad_soyad: 'Ad Soyad Ata adı',
  nomre_1: 'Nömrə 1',
  nomre_2: 'Nömrə 2',
  nomre_3: 'Nömrə 3',
  nomre_4: 'Nömrə 4',
  nomre_5: 'Nömrə 5',
  zamin: 'Zamin',
  alis_qiymeti: 'Alış qiyməti',
  satis_qiymeti: 'Satış qiyməti',
  verilib: 'Verilib',
  verilme_tarixi: 'Verilmə tarixi',
  bitme_tarixi: 'Bitmə tarixi',
  nece_ay: 'Neçə ay',
  odenis_gunu: 'Ödəniş günü',
  ayliq_odenis: 'Aylıq ödəniş',
  faiz: 'Faiz (cərimə)',
  model: 'Model',
  reng: 'Rəng',
  yaddas: 'Yaddaş',
  imei_1: 'IMEI 1',
  imei_2: 'IMEI 2',
  battery_faiz: 'Battery %',
  icloud: 'iCloud',
  icloud_bagli_nomre: 'iCloud bağlı nömrə',
  itunes: 'iTunes',
  itunes_bagli_nomre: 'iTunes bağlı nömrə',
  kimden_alinib: 'Kimdən alınıb',
  muqavile_nomresi: 'Müqavilə nömrəsi',
  kommentler: 'Kommentlər',
  veziyyet: 'Vəziyyət',
  veziyyet_manual: 'Vəziyyət (əl ilə)',
  veziyyet_cihaz: 'Cihaz vəziyyəti',
  mehkeme_isare: 'Məhkəmə işarə',
  rusum_odenilib: 'Rüsüm ödənilib',
  mehkeme_status: 'Məhkəmə statusu',
  mehkeme_qeyd: 'Məhkəmə komment',
  status: 'Status',
  nov: 'Növ',
  serial_no: 'Seriya №',
  model_no: 'Model №',
  sim_type: 'SIM',
  alis_tarixi: 'Alış tarixi',
  nomre: 'Nömrə',
  sexsiyyet: 'Şəxsiyyət',
  miqdar: 'Miqdar',
  sold_at: 'Satılıb',
  depo_id: 'Depo qeydi',
  musteri_id: 'Müştəri',
  satis_novu: 'Satış növü',
  tarix: 'Tarix',
  qaytarma_tarixi: 'Qaytarma tarixi',
  kime: 'Kimə',
  odenis_novu: 'Ödəniş növü',
  satici: 'Satıcı',
  satici_faizi: 'Satıcı faizi',
  tip: 'Əməliyyat',
  mebleg: 'Məbləğ',
  mehsul: 'Məhsul',
  qeyd: 'Qeyd',
  senedler: 'Sənədlər',
  musteri_bazasi_id: 'Müştəri bazası',
}

export const ACTION_LABELS = {
  insert: 'Yaradılıb',
  update: 'Redaktə edilib',
  delete: 'Silinib',
}

export const MODULE_TABLES = {
  musteri: 'musteri_bazasi',
  depo: 'depo',
  nagd: 'nagd_satish',
  borcNisye: 'borc_nisye_ledger',
  odenisler: 'odenisler',
}

export function fieldLabel(key) {
  if (!key) return ''
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]
  if (key.startsWith('extra.')) return key.slice(6) || key
  return key
}

export function formatChangeValue(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Bəli' : 'Xeyr'
  return String(v)
}

export function formatHistoryTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('az-AZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(iso)
  }
}
