/**
 * Restrict invitations to admins only.
 *
 *   node --env-file=.env.local scripts/setup-invitations-admin-only.mjs
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

const dbPassword = required('SUPABASE_DB_PASSWORD')
const projectRef = process.env.SUPABASE_PROJECT_REF || 'amvzitdyxivhidgunmrx'
const sqlPath = path.join(root, 'setup', 'tables', '30_invitations_admin_only.sql')
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
  await client.query(sql)
  const policies = await client.query(`
    select policyname, cmd
    from pg_policies
    where schemaname = 'public' and tablename = 'invitations'
    order by policyname
  `)
  console.log('OK policies:')
  for (const row of policies.rows) {
    console.log(`  ${row.cmd}: ${row.policyname}`)
  }
} finally {
  await client.end()
}
