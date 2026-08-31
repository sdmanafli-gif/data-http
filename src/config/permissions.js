/**
 * Per-user access control (stored on profiles.permissions / invitations.permissions).
 *
 * Shape:
 * {
 *   tabs: { [moduleId]: { visible, canView, canCreate, canEdit, canDelete } },
 *   columns: { [moduleId]: string[] | null },
 *   summaryCards: { [moduleId]: string[] | null }, // null = all, [] = hide cəmlər
 *   dataScope: { mode: 'all' | 'sira_no_range', siraNoFrom, siraNoTo },
 *   valueFilters: {
 *     [moduleId]: { [columnKey]: string[] | null }
 *   }
 * }
 */

import {
  DEFAULT_COLUMNS as MUSTERI_COLUMNS,
  VEZIYYET_OPTIONS,
} from '../features/musteri-bazasi/constants'
import {
  DEFAULT_COLUMNS as DEPO_COLUMNS,
  STATUS_LABELS,
  ODENIS_NOVU_LABELS,
  CONDITION_OPTIONS,
  SIM_OPTIONS,
} from '../features/depo/constants'
import { DEFAULT_COLUMNS as YIGIM_COLUMNS } from '../features/yigim/constants'
import { DEFAULT_COLUMNS as NAGD_COLUMNS, SATIS_NOVU_MAP } from '../features/nagd-satish/constants'
import {
  DEFAULT_COLUMNS as BORC_COLUMNS,
  ENTRY_TYPES,
  OVERVIEW_BORC_COLUMNS,
  OVERVIEW_NISYE_COLUMNS,
} from '../features/borc-nisye/constants'
import {
  PAYMENT_TYPES,
  ODENIS_TABLE_COLUMNS,
  ODENIS_USULU_MAP,
} from '../features/odenisler/constants'

export const INACTIVITY_LOGOUT_MS = 30 * 60 * 1000

const DEPO_OPTION_LABELS = {
  status: STATUS_LABELS,
  odenis_novu: ODENIS_NOVU_LABELS,
  veziyyet_cihaz: Object.fromEntries(CONDITION_OPTIONS.map((o) => [o.value, o.label])),
  sim_type: Object.fromEntries(SIM_OPTIONS.map((o) => [o.value, o.label])),
}

/** Summary / «Cəmlər» cards per module (admin can allow a subset or none). */
export const SUMMARY_CARDS_BY_MODULE = {
  depo: [
    { key: 'availableMiqdar', label: 'Mövcud miqdar' },
    { key: 'availableAlisValue', label: 'Mövcud alış dəyəri' },
    { key: 'allTimeAlisValue', label: 'İndiyədək ümumi alış' },
    { key: 'availableLines', label: 'Mövcud sətir' },
    { key: 'soldMiqdar', label: `${STATUS_LABELS.sold} miqdar` },
    { key: 'soldAlisValue', label: `${STATUS_LABELS.sold} alış dəyəri` },
    { key: 'reservedReturned', label: `${STATUS_LABELS.reserved} / ${STATUS_LABELS.returned}` },
    { key: 'filterLines', label: 'Filtrdə sətir / miqdar' },
    { key: 'byNov', label: 'Mövcud modellər (növə görə)' },
  ],
  'musteri-bazasi': [
    { key: 'alis_qiymeti', label: 'Alış qiyməti' },
    { key: 'satis_qiymeti', label: 'Satış qiyməti' },
    { key: 'verilib', label: 'Verilib' },
    { key: 'qalan_borc', label: 'Qalan borc' },
    { key: 'faiz', label: 'Faiz (cərimə)' },
    { key: 'row_count', label: 'Sətir sayı' },
  ],
  'nagd-satish': [
    { key: 'alis', label: 'Ümumi alış' },
    { key: 'satis', label: 'Ümumi satış' },
    { key: 'xeyir', label: 'Ümumi xeyir' },
    { key: 'xeyirFaizle', label: 'Xeyir (faizlə)' },
    { key: 'row_count', label: 'Sətir sayı' },
  ],
  yigim: [
    { key: 'owed', label: 'Gözlənilən yığım' },
    { key: 'paid', label: 'Ödənilib' },
    { key: 'remaining', label: 'Qalan / pending' },
    { key: 'penalty', label: 'Cərimə' },
    { key: 'faktiki', label: 'Faktiki gəlir (müştərilər)' },
    { key: 'lateCount', label: 'Gecikmiş sətir' },
    { key: 'row_musteri', label: 'Sətir / müştəri' },
  ],
  odenisler: [
    { key: 'ilkin', label: 'İlkin' },
    { key: 'ayliq', label: 'Aylıq' },
    { key: 'faiz', label: 'Faiz' },
    { key: 'cemi', label: 'Cəmi' },
    { key: 'row_count', label: 'Sətir sayı' },
  ],
  'borc-nisye': [
    { key: 'borc_verdim', label: 'Borc Verdim (cəmi)' },
    { key: 'borc_aldim', label: 'Borc Aldım (cəmi)' },
    { key: 'qaliq_borc', label: 'Qalıq (Borc)' },
    { key: 'borc_musteri', label: 'Borc — müştəri sayı' },
    { key: 'nisye_verdim', label: 'Nisyə Verdim (cəmi)' },
    { key: 'nisye_aldim', label: 'Nisyə Aldım (cəmi)' },
    { key: 'nisye_odenis', label: 'Nisyə Ödəniş (cəmi)' },
    { key: 'qaliq_nisye', label: 'Qalıq (Nisyə)' },
    { key: 'nisye_musteri', label: 'Nisyə — müştəri sayı' },
  ],
  mehkeme: [
    { key: 'alis_qiymeti', label: 'Alış qiyməti' },
    { key: 'satis_qiymeti', label: 'Satış qiyməti' },
    { key: 'verilib', label: 'Verilib' },
    { key: 'qalan_borc', label: 'Qalan borc' },
    { key: 'faiz', label: 'Faiz (cərimə)' },
    { key: 'rusum_odenilib', label: 'Rüsüm cəmi' },
    { key: 'row_count', label: 'Sətir sayı' },
  ],
}

function optionEntries(col, labelMap = {}) {
  if (col.type === 'checkbox') {
    return [
      { value: 'true', label: 'Bəli / işarəli' },
      { value: 'false', label: 'Xeyr / boş' },
    ]
  }
  if (!Array.isArray(col.options) || col.options.length === 0) return []
  return col.options.map((v) => {
    const value = String(v)
    return { value, label: labelMap[value] || labelMap[v] || value }
  })
}

function filterFieldsFromColumns(columns, labelMaps = {}) {
  return columns
    .filter(
      (c) =>
        (c.type === 'select' && Array.isArray(c.options) && c.options.length > 0) ||
        c.type === 'checkbox'
    )
    .map((c) => ({
      key: c.key,
      label: c.label,
      options: optionEntries(c, labelMaps[c.key] || {}),
    }))
    .filter((f) => f.options.length > 0)
}

function colsFrom(defs) {
  return (defs || []).map((c) => ({ key: c.key, label: c.label }))
}

/** Şəxsi kreditlər table on Borc/Nisyə overview. */
const SEXSI_KREDIT_TABLE_COLUMNS = [
  { key: 'ad', label: 'Ad (şəxsi kredit)', type: 'text' },
  { key: 'kimden', label: 'Haradan (şəxsi kredit)', type: 'text' },
  { key: 'verilme_tarixi', label: 'Tarix (şəxsi kredit)', type: 'date' },
  { key: 'cemi_mebleg', label: 'Cəmi (şəxsi kredit)', type: 'money' },
  { key: 'nece_ay', label: 'Ay (şəxsi kredit)', type: 'number' },
  { key: 'paid', label: 'Ödənilib (şəxsi kredit)', type: 'money' },
  { key: 'remaining', label: 'Qalan (şəxsi kredit)', type: 'money' },
]

const BORC_TIP_LABELS = Object.fromEntries(ENTRY_TYPES.map((t) => [t.value, t.label]))
const ODENIS_TIP_LABELS = Object.fromEntries(PAYMENT_TYPES.map((t) => [t.value, t.label]))

/** Borc/Nisyə: ledger + overview + şəxsi kredit columns (unique keys). */
const BORC_MODULE_COLUMNS = (() => {
  const byKey = new Map()
  for (const c of [
    ...BORC_COLUMNS,
    ...OVERVIEW_BORC_COLUMNS,
    ...OVERVIEW_NISYE_COLUMNS,
    ...SEXSI_KREDIT_TABLE_COLUMNS,
  ]) {
    if (!byKey.has(c.key)) byKey.set(c.key, c)
  }
  return Array.from(byKey.values())
})()

export const APP_MODULES = [
  {
    id: 'depo',
    path: '/depo',
    label: 'Depo',
    columns: colsFrom(DEPO_COLUMNS),
    filterFields: filterFieldsFromColumns(DEPO_COLUMNS, DEPO_OPTION_LABELS),
    summaryCards: SUMMARY_CARDS_BY_MODULE.depo,
  },
  {
    id: 'musteri-bazasi',
    path: '/musteri-bazasi',
    label: 'Müştəri Bazası',
    columns: colsFrom(MUSTERI_COLUMNS.filter((c) => c.group !== 'mehkeme')),
    filterFields: filterFieldsFromColumns(
      MUSTERI_COLUMNS.filter((c) => c.group !== 'mehkeme')
    ),
    summaryCards: SUMMARY_CARDS_BY_MODULE['musteri-bazasi'],
  },
  {
    id: 'nagd-satish',
    path: '/nagd-satish',
    label: 'Nağd satış',
    columns: colsFrom(NAGD_COLUMNS),
    filterFields: filterFieldsFromColumns(NAGD_COLUMNS, { satis_novu: SATIS_NOVU_MAP }),
    summaryCards: SUMMARY_CARDS_BY_MODULE['nagd-satish'],
  },
  {
    id: 'yigim',
    path: '/yigim',
    label: 'Yığım',
    columns: colsFrom(YIGIM_COLUMNS),
    filterFields: [
      {
        key: 'veziyyet',
        label: 'Vəziyyət',
        options: VEZIYYET_OPTIONS.map((v) => ({ value: v, label: v })),
      },
    ],
    summaryCards: SUMMARY_CARDS_BY_MODULE.yigim,
  },
  {
    id: 'odenisler',
    path: '/odenisler',
    label: 'Ödənişlər',
    columns: colsFrom(ODENIS_TABLE_COLUMNS),
    filterFields: filterFieldsFromColumns(ODENIS_TABLE_COLUMNS, {
      tip: ODENIS_TIP_LABELS,
      odenis_usulu: ODENIS_USULU_MAP,
    }),
    summaryCards: SUMMARY_CARDS_BY_MODULE.odenisler,
  },
  {
    id: 'borc-nisye',
    path: '/borc-nisye',
    label: 'Borc / Nisyə',
    columns: colsFrom(BORC_MODULE_COLUMNS),
    filterFields: filterFieldsFromColumns(BORC_COLUMNS, { tip: BORC_TIP_LABELS }),
    summaryCards: SUMMARY_CARDS_BY_MODULE['borc-nisye'],
  },
  {
    id: 'mehkeme',
    path: '/mehkeme',
    label: 'Məhkəmə',
    columns: colsFrom(MUSTERI_COLUMNS),
    filterFields: filterFieldsFromColumns(MUSTERI_COLUMNS),
    summaryCards: SUMMARY_CARDS_BY_MODULE.mehkeme,
  },
]

const MODULE_BY_ID = Object.fromEntries(APP_MODULES.map((m) => [m.id, m]))

export function defaultTabPerm() {
  return {
    visible: true,
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  }
}

/** Full access — used for admins and new unrestricted invites. */
export function fullPermissions() {
  const tabs = {}
  const columns = {}
  const summaryCards = {}
  const valueFilters = {}
  for (const mod of APP_MODULES) {
    tabs[mod.id] = defaultTabPerm()
    columns[mod.id] = null
    summaryCards[mod.id] = null
    valueFilters[mod.id] = {}
  }
  return {
    tabs,
    columns,
    summaryCards,
    dataScope: { mode: 'all', siraNoFrom: null, siraNoTo: null },
    valueFilters,
  }
}

function normalizeValueFilters(raw) {
  const out = {}
  for (const mod of APP_MODULES) {
    out[mod.id] = {}
    const src = raw?.[mod.id]
    if (!src || typeof src !== 'object') continue
    const allowedKeys = new Set((mod.filterFields || []).map((f) => f.key))
    for (const [key, vals] of Object.entries(src)) {
      if (!allowedKeys.has(key)) continue
      if (vals == null) {
        out[mod.id][key] = null
      } else if (Array.isArray(vals)) {
        const cleaned = vals.map(String).filter(Boolean)
        const field = (mod.filterFields || []).find((f) => f.key === key)
        const allOpts = field?.options?.map((o) => o.value) || []
        if (allOpts.length > 0 && cleaned.length >= allOpts.length && allOpts.every((o) => cleaned.includes(o))) {
          out[mod.id][key] = null
        } else {
          out[mod.id][key] = cleaned
        }
      }
    }
  }
  return out
}

function normalizeSummaryCards(raw) {
  const out = {}
  for (const mod of APP_MODULES) {
    const catalog = mod.summaryCards || []
    const allKeys = catalog.map((c) => c.key)
    const list = raw?.[mod.id]
    if (list == null) {
      out[mod.id] = null
    } else if (Array.isArray(list)) {
      const cleaned = list.map(String).filter((k) => allKeys.includes(k))
      if (catalog.length > 0 && cleaned.length >= catalog.length) out[mod.id] = null
      else out[mod.id] = cleaned
    } else {
      out[mod.id] = null
    }
  }
  return out
}

export function normalizePermissions(raw) {
  const base = fullPermissions()
  if (!raw || typeof raw !== 'object') return base

  const tabs = { ...base.tabs }
  if (raw.tabs && typeof raw.tabs === 'object') {
    for (const mod of APP_MODULES) {
      const t = raw.tabs[mod.id]
      if (!t || typeof t !== 'object') continue
      const visible = t.visible !== false && t.canView !== false
      tabs[mod.id] = {
        visible,
        canView: visible,
        canCreate: t.canCreate !== false && visible,
        canEdit: t.canEdit !== false && visible,
        canDelete: t.canDelete !== false && visible,
      }
    }
  }

  const columns = { ...base.columns }
  if (raw.columns && typeof raw.columns === 'object') {
    for (const mod of APP_MODULES) {
      const list = raw.columns[mod.id]
      if (list == null) {
        columns[mod.id] = null
      } else if (Array.isArray(list)) {
        columns[mod.id] = list.map(String)
      }
    }
  }

  const ds = raw.dataScope && typeof raw.dataScope === 'object' ? raw.dataScope : {}
  const mode = ds.mode === 'sira_no_range' ? 'sira_no_range' : 'all'
  const siraNoFrom =
    ds.siraNoFrom === '' || ds.siraNoFrom == null ? null : Number(ds.siraNoFrom)
  const siraNoTo = ds.siraNoTo === '' || ds.siraNoTo == null ? null : Number(ds.siraNoTo)

  return {
    tabs,
    columns,
    summaryCards: normalizeSummaryCards(raw.summaryCards),
    dataScope: {
      mode,
      siraNoFrom: Number.isFinite(siraNoFrom) ? siraNoFrom : null,
      siraNoTo: Number.isFinite(siraNoTo) ? siraNoTo : null,
    },
    valueFilters: normalizeValueFilters(raw.valueFilters),
  }
}

export function moduleIdFromPath(pathname) {
  if (!pathname) return null
  const clean = pathname.split('?')[0]
  for (const mod of APP_MODULES) {
    if (clean === mod.path || clean.startsWith(`${mod.path}/`)) return mod.id
  }
  return null
}

function coerceFilterCompare(raw) {
  if (raw === true || raw === false) return String(raw)
  if (raw == null) return 'false'
  return String(raw)
}

/**
 * @param {object|null} permissionsRaw
 * @param {boolean} isAdmin - admins always bypass limits
 */
export function createPermissionApi(permissionsRaw, isAdmin = false) {
  const permissions = normalizePermissions(permissionsRaw)

  function tab(moduleId) {
    if (isAdmin) return defaultTabPerm()
    return permissions.tabs[moduleId] || {
      visible: false,
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    }
  }

  function canAccessModule(moduleId) {
    return Boolean(tab(moduleId).visible && tab(moduleId).canView)
  }

  function canAccessPath(pathname) {
    if (isAdmin) return true
    const id = moduleIdFromPath(pathname)
    if (!id) return true
    return canAccessModule(id)
  }

  function canCreate(moduleId) {
    return Boolean(tab(moduleId).canCreate)
  }

  function canEdit(moduleId) {
    return Boolean(tab(moduleId).canEdit)
  }

  function canDelete(moduleId) {
    return Boolean(tab(moduleId).canDelete)
  }

  function allowedColumnKeys(moduleId) {
    if (isAdmin) return null
    const list = permissions.columns[moduleId]
    return list == null ? null : list
  }

  /** Filter UI column defs; if allowed list is set, hide others. */
  function filterColumns(moduleId, columns) {
    const allowed = allowedColumnKeys(moduleId)
    if (!allowed) return columns
    const set = new Set(allowed)
    return columns
      .map((c) => (set.has(c.key) ? c : { ...c, visible: false }))
      .filter((c) => set.has(c.key))
  }

  /**
   * Summary card keys for a module.
   * null = all cards; [] = hide «Cəmlər» entirely; string[] = subset.
   */
  function allowedSummaryCards(moduleId) {
    if (isAdmin) return null
    const list = permissions.summaryCards[moduleId]
    return list == null ? null : list
  }

  function canSeeSummary(moduleId) {
    const keys = allowedSummaryCards(moduleId)
    if (keys == null) return true
    return keys.length > 0
  }

  function dataScope() {
    if (isAdmin) return { mode: 'all', siraNoFrom: null, siraNoTo: null }
    return permissions.dataScope
  }

  function valueFiltersFor(moduleId) {
    if (isAdmin) return {}
    return permissions.valueFilters[moduleId] || {}
  }

  /** Active restricted filters: { key: string[] } (only non-null lists). */
  function activeValueFilters(moduleId) {
    const filters = valueFiltersFor(moduleId)
    const active = {}
    for (const [key, vals] of Object.entries(filters)) {
      if (Array.isArray(vals) && vals.length > 0) active[key] = vals
    }
    return active
  }

  /** Apply sira_no range to a Supabase query builder (column must exist). */
  function applySiraNoFilter(query, column = 'sira_no') {
    const scope = dataScope()
    if (scope.mode !== 'sira_no_range') return query
    let q = query
    if (scope.siraNoFrom != null) q = q.gte(column, scope.siraNoFrom)
    if (scope.siraNoTo != null) q = q.lte(column, scope.siraNoTo)
    return q
  }

  /**
   * Apply predefined-option value filters for a module.
   * Boolean checkbox columns use true/false; string selects use .in().
   */
  function applyValueFilters(query, moduleId) {
    const active = activeValueFilters(moduleId)
    let q = query
    for (const [key, vals] of Object.entries(active)) {
      const field = (MODULE_BY_ID[moduleId]?.filterFields || []).find((f) => f.key === key)
      const isCheckbox = field?.options?.some((o) => o.value === 'true' || o.value === 'false')
        && field.options.length <= 2
        && field.options.every((o) => o.value === 'true' || o.value === 'false')

      if (isCheckbox) {
        const wantsTrue = vals.includes('true')
        const wantsFalse = vals.includes('false')
        if (wantsTrue && wantsFalse) continue
        if (wantsTrue) q = q.eq(key, true)
        else if (wantsFalse) q = q.or(`${key}.eq.false,${key}.is.null`)
      } else {
        q = q.in(key, vals)
      }
    }
    return q
  }

  /** Apply sira_no + value filters for a module. */
  function applyDataFilters(query, moduleId, siraColumn = 'sira_no') {
    return applyValueFilters(applySiraNoFilter(query, siraColumn), moduleId)
  }

  function rowMatchesValueFilters(row, moduleId) {
    if (isAdmin) return true
    const active = activeValueFilters(moduleId)
    for (const [key, vals] of Object.entries(active)) {
      const raw = row?.[key]
      const cmp = coerceFilterCompare(raw)
      if (!vals.includes(cmp)) return false
    }
    return true
  }

  function rowInSiraScope(row) {
    const scope = dataScope()
    if (scope.mode !== 'sira_no_range') return true
    const n = Number(row?.sira_no)
    if (!Number.isFinite(n)) return false
    if (scope.siraNoFrom != null && n < scope.siraNoFrom) return false
    if (scope.siraNoTo != null && n > scope.siraNoTo) return false
    return true
  }

  function rowInDataScope(row, moduleId) {
    return rowInSiraScope(row) && rowMatchesValueFilters(row, moduleId)
  }

  function visibleModules() {
    return APP_MODULES.filter((m) => canAccessModule(m.id))
  }

  function firstAllowedPath() {
    const first = visibleModules()[0]
    return first?.path || '/musteri-bazasi'
  }

  return {
    isAdmin,
    permissions,
    tab,
    canAccessModule,
    canAccessPath,
    canCreate,
    canEdit,
    canDelete,
    allowedColumnKeys,
    filterColumns,
    allowedSummaryCards,
    canSeeSummary,
    dataScope,
    valueFiltersFor,
    activeValueFilters,
    applySiraNoFilter,
    applyValueFilters,
    applyDataFilters,
    rowMatchesValueFilters,
    rowInSiraScope,
    rowInDataScope,
    visibleModules,
    firstAllowedPath,
    moduleMeta: (id) => MODULE_BY_ID[id] || null,
  }
}
