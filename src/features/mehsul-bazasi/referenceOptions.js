/**
 * Normalized reference options for Növ, Model, Rəng, Yaddaş.
 * - Each Növ (type) has specific models only.
 * - Colors: official English only (Azerbaijani/variants normalized).
 * - Memory: always "X GB" or "X TB" (and "N/A" when none).
 */

// ─── Növ (type) ───────────────────────────────────────────────────────────
export const REF_NOV = [
  'Accessoires',
  'Dyson',
  'Headphones',
  'Ipad',
  'Iphone',
  'Mac',
  'Other Phones',
  'Playstation',
  'Saat',
  'Samsung',
]

// ─── Növ → Models (official English; only these shown for selected type) ───
export const NOV_TO_MODELS = {
  Accessoires: [
    'Magic Keyboard',
    'Apple Pencil Pro',
    'Apple 20W Charger',
  ],
  Dyson: [
    'Dyson',
    'Dyson Straight+Wavy',
  ],
  Headphones: [
    'Air Pods 4 ANC',
  ],
  Ipad: [
    'iPad Air 11 Inch M2',
    'iPad Air 11 Inch M3',
    'iPad 10',
    'iPad 16',
    'iPad Pro',
  ],
  Iphone: [
    'iPhone 8 Plus',
    'iPhone X',
    'iPhone Xs Max',
    'iPhone 11',
    'iPhone 11 Pro',
    'iPhone 11 Pro Max',
    'iPhone 12',
    'iPhone 12 Pro',
    'iPhone 12 Pro Max',
    'iPhone 13',
    'iPhone 13 mini',
    'iPhone 13 Pro',
    'iPhone 13 Pro Max',
    'iPhone 14',
    'iPhone 14 Pro',
    'iPhone 14 Pro Max',
    'iPhone 15',
    'iPhone 15 Pro',
    'iPhone 15 Pro Max',
    'iPhone 16',
    'iPhone 16 Plus',
    'iPhone 16 Pro',
    'iPhone 16 Pro Max',
    'iPhone 16 E',
    'iPhone 17',
    'iPhone 17 Air',
    'iPhone 17 Pro',
    'iPhone 17 Pro Max',
  ],
  Mac: [
    'MacBook Air 13',
    'MacBook Air 15',
    'MacBook Pro',
  ],
  'Other Phones': [
    'Motorola',
    'Redmi Note 14 Pro',
    'Redmi 14',
  ],
  Playstation: [
    'PlayStation',
    'PlayStation 5',
    'Slim 5',
  ],
  Saat: [
    'Apple Watch Ultra',
    'Apple Watch Ultra 2',
    'Apple Watch 11',
    'Apple Watch SE',
  ],
  Samsung: [
    'Samsung A16',
    'Samsung A25',
    'Samsung S24',
    'Samsung S24 Ultra',
    'Samsung S25',
    'Samsung S25 Ultra',
  ],
}

// ─── Color: Azerbaijani / variants → official English ───────────────────────
const COLOR_NORMALIZE_MAP = {
  ag: 'Silver',
  qara: 'Black',
  'space grat': 'Space Gray',
  'space gray': 'Space Gray',
  stralight: 'Starlight',
  'conmic orange': 'Cosmic Orange',
  'cosmic orange': 'Cosmic Orange',
  'deep blur': 'Deep Blue',
  'deep blue': 'Deep Blue',
  'pasific blue': 'Pacific Blue',
  'pacific blue': 'Pacific Blue',
  'natural gray': 'Natural Gray',
  'natural grey': 'Natural Gray',
  icyblue: 'Icy Blue',
  'icy blue': 'Icy Blue',
  midnight: 'Midnight',
  'midnight green': 'Midnight Green',
  ping: 'Pink',
  black: 'Black',
  white: 'White',
  blue: 'Blue',
  red: 'Red',
  green: 'Green',
  gold: 'Gold',
  silver: 'Silver',
  purple: 'Purple',
  pink: 'Pink',
  graphite: 'Graphite',
  'space black': 'Space Black',
  'sierra blue': 'Sierra Blue',
  'natural titanium': 'Natural Titanium',
  'desert titanium': 'Desert Titanium',
  'black titanium': 'Black Titanium',
  'blue titanium': 'Blue Titanium',
  'deep purple': 'Deep Purple',
  'starlight': 'Starlight',
  'teal': 'Teal',
  'ultramarine': 'Ultramarine',
  'midnight black': 'Midnight Black',
  'sky blue': 'Sky Blue',
  'silver blue': 'Silver Blue',
  'violet titanium': 'Violet Titanium',
  'graphite green': 'Graphite Green',
  'orange': 'Orange',
  'straight+wavy': 'Straight+Wavy',
}

// Official English color list only (for datalist)
export const REF_RENG = [
  'Black',
  'Black Titanium',
  'Blue',
  'Blue Titanium',
  'Cosmic Orange',
  'Deep Blue',
  'Deep Purple',
  'Desert Titanium',
  'Gold',
  'Graphite',
  'Graphite Green',
  'Green',
  'Icy Blue',
  'Midnight',
  'Midnight Black',
  'Midnight Green',
  'Natural Gray',
  'Natural Titanium',
  'Orange',
  'Pacific Blue',
  'Pink',
  'Purple',
  'Red',
  'Sierra Blue',
  'Silver',
  'Silver Blue',
  'Sky Blue',
  'Space Black',
  'Space Gray',
  'Starlight',
  'Straight+Wavy',
  'Teal',
  'Ultramarine',
  'Violet Titanium',
  'White',
]

/** Normalize color to official English (ignores Azerbaijani; lowercase lookup). */
export function normalizeColor(input) {
  if (!input || typeof input !== 'string') return ''
  const s = input.trim()
  if (!s) return ''
  const key = s.toLowerCase()
  return COLOR_NORMALIZE_MAP[key] ?? s
}

// ─── Memory: 64, 128, 256, 512 GB; 1 TB, 2 TB, etc.; or yoxdur ───────────────
export const REF_MEMORY = [
  'yoxdur',
  '64 GB',
  '128 GB',
  '256 GB',
  '512 GB',
  '1 TB',
  '2 TB',
]

/** Normalize memory: "128 Gb" → "128 GB", "yoxdu"/"yoxdur" → "yoxdur", "1 Tb" → "1 TB". */
export function normalizeMemory(input) {
  if (!input || typeof input !== 'string') return ''
  const s = input.trim()
  if (!s) return ''
  const lower = s.toLowerCase()
  if (lower === 'yoxdu' || lower === 'yoxdur' || lower === 'yox' || lower === '—' || lower === '-') return 'yoxdur'
  const gb = s.match(/^(\d+)\s*g[b]?$/i)
  if (gb) return `${gb[1]} GB`
  const tb = s.match(/^(\d+)\s*t[b]?$/i)
  if (tb) return `${tb[1]} TB`
  const numOnly = s.match(/^(\d+)$/)
  if (numOnly) return `${numOnly[1]} GB`
  return s
}

function uniq(arr) {
  return [...new Set(arr)].filter(Boolean)
}

/** Combined options: reference + fromDb, unique, sorted */
export function buildOptions(reference, fromDb) {
  return uniq([...(fromDb || []), ...(reference || [])]).sort()
}

/** Sort key for memory: yoxdur = 0, then 64, 128, 256, 512 (GB), then 1, 2, … (TB as 1024, 2048…) */
function memorySortKey(s) {
  const lower = (s || '').toLowerCase()
  if (lower === 'yoxdur' || lower === 'yoxdu' || lower === '') return 0
  const gb = (s || '').match(/^(\d+)\s*gb$/i)
  if (gb) return Number(gb[1])
  const tb = (s || '').match(/^(\d+)\s*tb$/i)
  if (tb) return Number(tb[1]) * 1024
  return 9999
}

/** Combined memory options: reference + fromDb, unique, sorted small → big (yoxdur first, then 64 GB, 128 GB, … 1 TB, 2 TB) */
export function buildMemoryOptions(reference, fromDb) {
  const list = uniq([...(fromDb || []), ...(reference || [])])
  return list.sort((a, b) => memorySortKey(a) - memorySortKey(b))
}

/** Models for a given Növ: reference list + DB models that belong to this type */
export function getModelsForNov(nov, fromDbByType) {
  const ref = NOV_TO_MODELS[nov] || []
  const fromDb = fromDbByType && Array.isArray(fromDbByType[nov]) ? fromDbByType[nov] : []
  return uniq([...fromDb, ...ref]).sort()
}
