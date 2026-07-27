import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Mobideal: Supabase env missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env'
  )
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

/**
 * Supabase/PostgREST returns max 1000 rows by default.
 * Call buildQuery() for each page (must return a fresh builder), then .range is applied.
 *
 * @param {() => import('@supabase/supabase-js').PostgrestFilterBuilder} buildQuery
 * @param {{ pageSize?: number }} [opts]
 * @returns {Promise<{ data: any[] | null, error: any }>}
 */
export async function fetchAllPages(buildQuery, { pageSize = 1000 } = {}) {
  const all = []
  let from = 0

  for (;;) {
    const to = from + pageSize - 1
    const { data, error } = await buildQuery().range(from, to)
    if (error) return { data: null, error }
    const batch = data || []
    all.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  return { data: all, error: null }
}
