// İnventar sahə göstərişləri (Azərbaycanca) və status/seçim dəyərləri.
// DB sütun adları dəyişmir; yalnız UI-da bu göstərişlər istifadə olunur.
// İzah üçün: docs/COLUMNS_REFERENCE.md

export const STATUS_OPTIONS = [
  { value: 'available', label: 'Mövcud' },
  { value: 'sold', label: 'Satıldı' },
  { value: 'reserved', label: 'Rezerv' },
  { value: 'returned', label: 'Qaytarılıb' },
  { value: 'other', label: 'Digər' },
]

export const CONDITION_OPTIONS = [
  { value: 'teze', label: 'Təzə' },
  { value: 'kohne', label: 'Köhnə' },
]

export const SIM_TYPE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'sim', label: 'SIM' },
  { value: 'esim', label: 'eSIM' },
  { value: 'both', label: 'SIM + eSIM' },
]

export const SOHBE_OPTIONS = [
  { value: 'Nisye', label: 'Nisə' },
  { value: 'Kredit', label: 'Kredit' },
  { value: 'Nagd', label: 'Nağd' },
  { value: '', label: '—' },
]

export const INVENTORY_LABELS = {
  status: 'Vəziyyət',
  type: 'Növ',
  model: 'Model',
  color: 'Rəng',
  condition_type: 'Təzə / Köhnə',
  battery: 'Batareya',
  memory: 'Yaddaş',
  imei_1: 'IMEI 1',
  imei_2: 'IMEI 2',
  serial_no: 'Serial nömrəsi',
  model_no: 'Model nömrəsi',
  sim_type: 'SIM növü (SIM / eSIM)',
  purchase_price: 'Alış qiyməti',
  member: 'Üzv',
  member_no: 'Üzv nömrəsi',
  purchase_date: 'Alış tarixi',
  shift: 'Söhbə',
  payment_due_date: 'Ödəmə tarixi',
  documents: 'Sənədlər',
  user: 'İstifadəçi',
  created_at: 'Yaradılma tarixi',
  updated_at: 'Yenilənmə tarixi',
  comments: 'Şərhlər',
  client_number: 'Müştəri nömrəsi',
  return_amount: 'Qaytarma məbləği',
  product_id: 'Məhsul',
  supplier_id: 'Alındığı yer (təchizatçı)',
  quantity: 'Miqdar',
  attachments: 'Sənədlər (fayl)',
  comments_device: 'Şərh (cihaz)',
}
