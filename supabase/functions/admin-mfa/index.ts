// Admin-only: list / delete MFA factors for any user (including other admins).
// Body:
//   { action: 'list', userId }
//   { action: 'unenroll', userId, factorId }
//   { action: 'unenroll_all', userId }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeFactors(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.factors)) return obj.factors as Array<Record<string, unknown>>
    if (Array.isArray(obj.totp)) return obj.totp as Array<Record<string, unknown>>
    if (Array.isArray(obj.all)) return obj.all as Array<Record<string, unknown>>
  }
  return []
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await supabaseUser.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await supabaseUser
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') {
      return json({ error: 'Only admin can manage MFA for users' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const userId = body?.userId
    const action = body?.action || 'list'
    if (!userId || typeof userId !== 'string') {
      return json({ error: 'userId required' }, 400)
    }

    // Service-role client — can manage MFA for any auth user (admin or manager).
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    async function listFactors() {
      // Prefer Auth Admin MFA API when available
      try {
        const { data, error } = await admin.auth.admin.mfa.listFactors({ userId })
        if (!error) {
          const factors = normalizeFactors(data)
          if (factors.length || data) return factors
        }
      } catch (_) {
        /* fall through to REST */
      }

      const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}/factors`, {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      })
      const text = await res.text()
      if (!res.ok) throw new Error(text || 'Failed to list factors')
      return normalizeFactors(text ? JSON.parse(text) : [])
    }

    async function deleteFactor(factorId: string) {
      try {
        const { error } = await admin.auth.admin.mfa.deleteFactor({ id: factorId, userId })
        if (!error) return
      } catch (_) {
        /* fall through to REST */
      }

      const res = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${userId}/factors/${factorId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
        },
      )
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || 'Failed to delete factor')
      }
    }

    if (action === 'list') {
      const factors = await listFactors()
      return json({ factors, ok: true })
    }

    if (action === 'unenroll') {
      const factorId = body?.factorId
      if (!factorId || typeof factorId !== 'string') {
        return json({ error: 'factorId required' }, 400)
      }
      await deleteFactor(factorId)
      return json({ ok: true })
    }

    if (action === 'unenroll_all') {
      const factors = await listFactors()
      const ids = factors
        .map((f) => String(f.id || ''))
        .filter(Boolean)
      for (const id of ids) {
        await deleteFactor(id)
      }
      return json({ ok: true, removed: ids.length })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
