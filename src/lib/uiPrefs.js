/**
 * Browser-local UI prefs (columns, zoom, filters, panels).
 * Survives tab changes and reloads; column layouts also sync to Supabase.
 */

function safeParse(raw, fallback = null) {
  try {
    if (raw == null || raw === '') return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function getItem(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function setItem(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore quota / private mode */
  }
}

const COL_PREFIX = 'mobideal_columns_v1:'
const ZOOM_PREFIX = 'mobideal_table_zoom_v1:'
const FILTER_PREFIX = 'mobideal_table_filters_v1:'
const SORT_PREFIX = 'mobideal_table_sort_v1:'
const FLAG_PREFIX = 'mobideal_ui_flag_v1:'

/** @returns {{ columns: any[], updated_at: string } | null} */
export function loadLocalColumnSettings(tableKey) {
  const parsed = safeParse(getItem(COL_PREFIX + tableKey))
  if (!parsed) return null
  if (Array.isArray(parsed)) return { columns: parsed, updated_at: null }
  if (Array.isArray(parsed.columns)) {
    return { columns: parsed.columns, updated_at: parsed.updated_at || null }
  }
  return null
}

export function saveLocalColumnSettings(tableKey, columns) {
  setItem(
    COL_PREFIX + tableKey,
    JSON.stringify({
      columns,
      updated_at: new Date().toISOString(),
    })
  )
}

export function loadTableZoom(prefsKey = 'default', fallback = 1) {
  const v = Number(getItem(ZOOM_PREFIX + prefsKey))
  if (!Number.isNaN(v) && v >= 0.5 && v <= 2) return v
  // legacy single key
  if (prefsKey === 'musteri_bazasi' || prefsKey === 'default') {
    const legacy = Number(getItem('mobideal_musteri_table_zoom'))
    if (!Number.isNaN(legacy) && legacy >= 0.5 && legacy <= 2) return legacy
  }
  return fallback
}

export function saveTableZoom(prefsKey, zoom) {
  setItem(ZOOM_PREFIX + (prefsKey || 'default'), String(zoom))
}

export function loadTableFilters(prefsKey) {
  const parsed = safeParse(getItem(FILTER_PREFIX + prefsKey), {})
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

export function saveTableFilters(prefsKey, filters) {
  setItem(FILTER_PREFIX + (prefsKey || 'default'), JSON.stringify(filters || {}))
}

export function loadTableSort(prefsKey) {
  const parsed = safeParse(getItem(SORT_PREFIX + prefsKey), null)
  if (parsed && typeof parsed === 'object' && (parsed.key == null || typeof parsed.key === 'string')) {
    return { key: parsed.key ?? null, dir: parsed.dir === 'desc' ? 'desc' : 'asc' }
  }
  return { key: null, dir: 'asc' }
}

export function saveTableSort(prefsKey, sort) {
  setItem(SORT_PREFIX + (prefsKey || 'default'), JSON.stringify(sort || { key: null, dir: 'asc' }))
}

/** Boolean flags: summary open, panel open, etc. */
export function loadUiFlag(flagKey, defaultValue = false) {
  const raw = getItem(FLAG_PREFIX + flagKey)
  if (raw === '1') return true
  if (raw === '0') return false
  return defaultValue
}

export function saveUiFlag(flagKey, value) {
  setItem(FLAG_PREFIX + flagKey, value ? '1' : '0')
}

const PAGE_FILTER_PREFIX = 'mobideal_page_filters_v1:'

/** Persist arbitrary page filter state (period, search, etc.). */
export function loadPageFilters(pageKey, fallback = null) {
  const parsed = safeParse(getItem(PAGE_FILTER_PREFIX + pageKey), null)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  return fallback
}

export function savePageFilters(pageKey, value) {
  setItem(PAGE_FILTER_PREFIX + (pageKey || 'default'), JSON.stringify(value || {}))
}
