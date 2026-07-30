import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { loadLocalColumnSettings, saveLocalColumnSettings } from '../../lib/uiPrefs'
import {
  COLUMN_SETTINGS_TABLE,
  COLUMN_SETTINGS_KEY,
  MEHKEME_COLUMN_SETTINGS_KEY,
  DEFAULT_COLUMNS,
  mergeColumnConfig,
  mergeMehkemeColumnConfig,
} from './constants'

function normalizeColumns(nextColumns) {
  return nextColumns.map((c, i) => ({
    key: c.key,
    label: c.label,
    type: c.type,
    visible: c.visible !== false,
    formVisible: c.formVisible !== false,
    order: i,
    width: typeof c.width === 'number' ? c.width : undefined,
    system: Boolean(c.system),
    custom: Boolean(c.custom || !c.system),
    options: c.options || undefined,
  }))
}

/**
 * @param {{ tableKey?: string }} [options]
 */
export function useColumnConfig(options = {}) {
  const tableKey = options.tableKey || COLUMN_SETTINGS_KEY
  const isMehkeme = tableKey === MEHKEME_COLUMN_SETTINGS_KEY

  const [columns, setColumns] = useState(() => {
    const local = loadLocalColumnSettings(tableKey)
    if (isMehkeme) {
      const musteriLocal = loadLocalColumnSettings(COLUMN_SETTINGS_KEY)
      const musteriCols = mergeColumnConfig(musteriLocal?.columns)
      return mergeMehkemeColumnConfig(local?.columns, musteriCols)
    }
    return mergeColumnConfig(local?.columns)
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [settingsId, setSettingsId] = useState(null)
  const musteriColsRef = useRef(mergeColumnConfig(loadLocalColumnSettings(COLUMN_SETTINGS_KEY)?.columns))

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    if (isMehkeme) {
      const localMehkeme = loadLocalColumnSettings(MEHKEME_COLUMN_SETTINGS_KEY)
      const localMusteri = loadLocalColumnSettings(COLUMN_SETTINGS_KEY)

      const [musteriRes, mehkemeRes] = await Promise.all([
        supabase
          .from(COLUMN_SETTINGS_TABLE)
          .select('id, columns, updated_at')
          .eq('table_key', COLUMN_SETTINGS_KEY)
          .maybeSingle(),
        supabase
          .from(COLUMN_SETTINGS_TABLE)
          .select('id, columns, updated_at')
          .eq('table_key', MEHKEME_COLUMN_SETTINGS_KEY)
          .maybeSingle(),
      ])

      if (musteriRes.error) setError(musteriRes.error.message)
      if (mehkemeRes.error) setError(mehkemeRes.error.message)

      const musteriCols = mergeColumnConfig(
        musteriRes.data?.columns ?? localMusteri?.columns
      )
      musteriColsRef.current = musteriCols
      if (musteriRes.data?.columns) {
        saveLocalColumnSettings(COLUMN_SETTINGS_KEY, musteriRes.data.columns)
      }

      const mehkemeSaved = mehkemeRes.data?.columns ?? localMehkeme?.columns
      setSettingsId(mehkemeRes.data?.id ?? null)
      setColumns(mergeMehkemeColumnConfig(mehkemeSaved, musteriCols))
      if (mehkemeRes.data?.columns) {
        saveLocalColumnSettings(MEHKEME_COLUMN_SETTINGS_KEY, mehkemeRes.data.columns)
      } else if (localMehkeme?.columns && !mehkemeRes.data) {
        // Push local prefs to server when DB row missing
        try {
          const payload = {
            table_key: MEHKEME_COLUMN_SETTINGS_KEY,
            columns: localMehkeme.columns,
            updated_at: new Date().toISOString(),
          }
          const { data } = await supabase
            .from(COLUMN_SETTINGS_TABLE)
            .upsert(payload, { onConflict: 'table_key' })
            .select('id')
            .single()
          if (data?.id) setSettingsId(data.id)
        } catch (_) {
          /* local still works */
        }
      }
      setLoading(false)
      return
    }

    const local = loadLocalColumnSettings(tableKey)
    const { data, error: e } = await supabase
      .from(COLUMN_SETTINGS_TABLE)
      .select('id, columns, updated_at')
      .eq('table_key', tableKey)
      .maybeSingle()

    if (e) {
      setError(e.message)
      setColumns(mergeColumnConfig(local?.columns))
    } else if (data?.columns) {
      setSettingsId(data.id ?? null)
      saveLocalColumnSettings(tableKey, data.columns)
      setColumns(mergeColumnConfig(data.columns))
    } else if (local?.columns) {
      setSettingsId(null)
      setColumns(mergeColumnConfig(local.columns))
      try {
        const payload = {
          table_key: tableKey,
          columns: local.columns,
          updated_at: new Date().toISOString(),
        }
        const { data: upserted } = await supabase
          .from(COLUMN_SETTINGS_TABLE)
          .upsert(payload, { onConflict: 'table_key' })
          .select('id')
          .single()
        if (upserted?.id) setSettingsId(upserted.id)
      } catch (_) {
        /* keep local */
      }
    } else {
      setSettingsId(null)
      setColumns(mergeColumnConfig(null))
    }
    setLoading(false)
  }, [isMehkeme, tableKey])

  useEffect(() => {
    reload()
  }, [reload])

  async function saveColumns(nextColumns) {
    const normalized = normalizeColumns(nextColumns)
    // Always persist locally first so tab switches / reload keep the view
    saveLocalColumnSettings(tableKey, normalized)

    if (isMehkeme) {
      setColumns(mergeMehkemeColumnConfig(normalized, musteriColsRef.current))
    } else {
      setColumns(mergeColumnConfig(normalized))
    }

    const payload = {
      table_key: tableKey,
      columns: normalized,
      updated_at: new Date().toISOString(),
    }

    let err
    if (settingsId) {
      ;({ error: err } = await supabase
        .from(COLUMN_SETTINGS_TABLE)
        .update(payload)
        .eq('id', settingsId))
    } else {
      const { data, error: e } = await supabase
        .from(COLUMN_SETTINGS_TABLE)
        .upsert(payload, { onConflict: 'table_key' })
        .select('id')
        .single()
      err = e
      if (data?.id) setSettingsId(data.id)
    }
    if (err) {
      // Local save already done — surface soft warning, do not roll back UI
      setError(`Serverə yazılmadı (lokal saxlanıldı): ${err.message}`)
      return
    }
    setError(null)
  }

  return {
    columns,
    loading,
    error,
    reload,
    saveColumns,
    defaults: isMehkeme ? mergeMehkemeColumnConfig(null, musteriColsRef.current) : DEFAULT_COLUMNS,
    tableKey,
  }
}
