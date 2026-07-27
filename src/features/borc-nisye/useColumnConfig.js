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
  const [settingsId, setSettingsId] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from(COLUMN_SETTINGS_TABLE)
      .select('id, columns')
      .eq('table_key', COLUMN_SETTINGS_KEY)
      .maybeSingle()
    setSettingsId(data?.id ?? null)
    setColumns(mergeColumnConfig(data?.columns))
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
      system: true,
    }))
    const payload = {
      table_key: COLUMN_SETTINGS_KEY,
      columns: normalized,
      updated_at: new Date().toISOString(),
    }
    if (settingsId) {
      const { error } = await supabase.from(COLUMN_SETTINGS_TABLE).update(payload).eq('id', settingsId)
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from(COLUMN_SETTINGS_TABLE)
        .upsert(payload, { onConflict: 'table_key' })
        .select('id')
        .single()
      if (error) throw error
      if (data?.id) setSettingsId(data.id)
    }
    setColumns(mergeColumnConfig(normalized))
  }

  return { columns, loading, saveColumns }
}
