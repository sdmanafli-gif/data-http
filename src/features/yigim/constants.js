export const COLUMN_SETTINGS_TABLE = 'ui_column_settings'
export const COLUMN_SETTINGS_KEY = 'yigim'

/** Fixed Yığım table columns (computed rows — no custom DB fields). */
export const DEFAULT_COLUMNS = [
  { key: 'tarix', label: 'Vaxtı', type: 'date', visible: true, system: true },
  { key: 'sira_no', label: '#', type: 'number', visible: true, system: true },
  { key: 'ad_soyad', label: 'Müştəri', type: 'text', visible: true, system: true },
  { key: 'veziyyet', label: 'Vəziyyət', type: 'text', visible: true, system: true },
  { key: 'model', label: 'Model', type: 'text', visible: true, system: true },
  { key: 'label', label: 'Növ', type: 'text', visible: true, system: true },
  { key: 'owed', label: 'Məbləğ', type: 'money', visible: true, system: true },
  { key: 'paid', label: 'Ödənilib', type: 'money', visible: true, system: true },
  { key: 'remaining', label: 'Qalan', type: 'money', visible: true, system: true },
  { key: 'faktiki_gelir', label: 'Faktiki gəlir', type: 'money', visible: true, system: true },
  { key: 'delayDays', label: 'Gecikmə', type: 'number', visible: true, system: true },
  { key: 'penalty', label: 'Cərimə', type: 'money', visible: true, system: true },
  { key: 'statusText', label: 'Status', type: 'text', visible: true, system: true },
]

const SYSTEM_KEYS = new Set(DEFAULT_COLUMNS.map((c) => c.key))

export function mergeColumnConfig(saved) {
  const byKey = new Map()
  DEFAULT_COLUMNS.forEach((c, i) => byKey.set(c.key, { ...c, order: i }))

  if (Array.isArray(saved)) {
    saved.forEach((c, i) => {
      if (!c?.key || !SYSTEM_KEYS.has(c.key)) return
      const base = byKey.get(c.key)
      byKey.set(c.key, {
        ...base,
        label: c.label || base.label,
        visible: c.visible !== false,
        order: typeof c.order === 'number' ? c.order : i,
        width: typeof c.width === 'number' ? c.width : base.width,
      })
    })
  }

  return Array.from(byKey.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}
