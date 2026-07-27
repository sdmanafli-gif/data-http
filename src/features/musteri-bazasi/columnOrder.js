/** Move item in array from → to index */
export function moveItem(arr, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return arr
  if (fromIndex >= arr.length || toIndex >= arr.length) return arr
  const next = [...arr]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

/**
 * Reorder only the keys in `orderedKeys` inside `columns`,
 * keeping non-listed columns in their relative places.
 */
export function applyKeyOrder(columns, orderedKeys) {
  const keySet = new Set(orderedKeys)
  const queue = [...orderedKeys]
  return columns.map((col, i) => {
    if (keySet.has(col.key)) {
      const key = queue.shift()
      const found = columns.find((c) => c.key === key) || col
      return { ...found, order: i }
    }
    return { ...col, order: i }
  })
}

export const TABLE_ZOOM_KEY = 'mobideal_musteri_table_zoom'
export const TABLE_ZOOM_MIN = 0.7
export const TABLE_ZOOM_MAX = 1.6
export const TABLE_ZOOM_STEP = 0.1

export function loadTableZoom() {
  try {
    const v = Number(localStorage.getItem(TABLE_ZOOM_KEY))
    if (!Number.isNaN(v) && v >= TABLE_ZOOM_MIN && v <= TABLE_ZOOM_MAX) return v
  } catch (_) {}
  return 1
}

export function saveTableZoom(zoom) {
  try {
    localStorage.setItem(TABLE_ZOOM_KEY, String(zoom))
  } catch (_) {}
}
