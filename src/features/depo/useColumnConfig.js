import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { loadLocalColumnSettings, saveLocalColumnSettings } from '../../lib/uiPrefs'
import {
  COLUMN_SETTINGS_TABLE,
  COLUMN_SETTINGS_KEY,
  DEFAULT_COLUMNS,
  mergeColumnConfig,
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

export function useColumnConfig() {
  const tableKey = COLUMN_SETTINGS_KEY
  const [columns, setColumns] = useState(() =>
    mergeColumnConfig(loadLocalColumnSettings(tableKey)?.columns)
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [settingsId, setSettingsId] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const local = loadLocalColumnSettings(tableKey)
    const { data, error: e } = await supabase
      .from(COLUMN_SETTINGS_TABLE)
      .select('id, columns')
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
      setColumns(mergeColumnConfig(local.columns))
      try {
        const { data: upserted } = await supabase
          .from(COLUMN_SETTINGS_TABLE)
          .upsert(
            {
              table_key: tableKey,
              columns: local.columns,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'table_key' }
          )
          .select('id')
          .single()
        if (upserted?.id) setSettingsId(upserted.id)
      } catch (_) {}
    } else {
      setColumns(mergeColumnConfig(null))
    }
    setLoading(false)
  }, [tableKey])

  useEffect(() => {
    reload()
  }, [reload])

  async function saveColumns(nextColumns) {
    const normalized = normalizeColumns(nextColumns)
    saveLocalColumnSettings(tableKey, normalized)
    setColumns(mergeColumnConfig(normalized))

    const payload = {
      table_key: tableKey,
      columns: normalized,
      updated_at: new Date().toISOString(),
    }

    let err
    if (settingsId) {
      ;({ error: err } = await supabase.from(COLUMN_SETTINGS_TABLE).update(payload).eq('id', settingsId))
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
      setError(`Serverə yazılmadı (lokal saxlanıldı): ${err.message}`)
      return
    }
    setError(null)
  }

  return { columns, loading, error, reload, saveColumns, defaults: DEFAULT_COLUMNS }
}
