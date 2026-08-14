/**
 * One-time setup: enable http extension, apply MFA admin RPCs,
 * store service role URL/key in private.app_secrets (not exposed to clients).
 *
 * Usage (from repo root):
 *   node --env-file=.env.local scripts/setup-admin-mfa-rpc.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function required(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing env: ${name}`)
    process.exit(1)
  }
  return v
}

const supabaseUrl = required('VITE_SUPABASE_URL').replace(/\/$/, '')
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY')
const dbPassword = required('SUPABASE_DB_PASSWORD')
const projectRef = process.env.SUPABASE_PROJECT_REF || 'amvzitdyxivhidgunmrx'

const sqlPath = path.join(root, 'setup', 'tables', '26_admin_mfa_rpc.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST || 'aws-0-eu-north-1.pooler.supabase.com',
  port: Number(process.env.SUPABASE_DB_PORT || 6543),
  database: 'postgres',
  user: process.env.SUPABASE_DB_USER || `postgres.${projectRef}`,
  password: dbPassword,
  ssl: { rejectUnauthorized: false },
})

await client.connect()
try {
  await client.query('create extension if not exists http with schema extensions')
  await client.query(sql)
  await client.query(
    `insert into private.app_secrets (key, value, updated_at)
     values
       ('service_role_key', $1, now()),
       ('supabase_url', $2, now())
     on conflict (key) do update
       set value = excluded.value,
           updated_at = now()`,
    [serviceKey, supabaseUrl]
  )
  const check = await client.query(
    `select proname from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname in ('admin_mfa_list','admin_mfa_unenroll','admin_mfa_unenroll_all')
     order by proname`
  )
  console.log('OK MFA RPCs:', check.rows.map((r) => r.proname).join(', '))
  console.log('OK secrets stored in private.app_secrets')
} finally {
  await client.end()
}
