import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  COLUMN_SETTINGS_TABLE,
  COLUMN_SETTINGS_KEY,
  DEFAULT_COLUMNS,
  mergeColumnConfig,
} from './constants'

export function useColumnConfig() {
  const [columns, setColumns] = useState(() => mergeColumnConfig(null))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [settingsId, setSettingsId] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from(COLUMN_SETTINGS_TABLE)
      .select('id, columns')
      .eq('table_key', COLUMN_SETTINGS_KEY)
      .maybeSingle()
    if (e) {
      setError(e.message)
      setColumns(mergeColumnConfig(null))
    } else {
      setSettingsId(data?.id ?? null)
      setColumns(mergeColumnConfig(data?.columns))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function saveColumns(nextColumns) {
    const normalized = nextColumns.map((c, i) => ({
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

    const payload = {
      table_key: COLUMN_SETTINGS_KEY,
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
    if (err) throw err
    setColumns(mergeColumnConfig(normalized))
  }

  return { columns, loading, error, reload, saveColumns, defaults: DEFAULT_COLUMNS }
}
