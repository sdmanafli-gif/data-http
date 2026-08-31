/**
 * Apply ödəniş kassa schema (created_by, card/cash, withdrawals).
 *
 *   node --env-file=.env.local scripts/setup-odenis-kassa.mjs
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
const sqlPath = path.join(root, 'setup', 'tables', '27_odenis_kassa.sql')
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
  const check = await client.query(`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'odenisler'
      and column_name in ('created_by', 'odenis_usulu', 'kart_nomresi')
    order by column_name
  `)
  console.log('OK columns:', check.rows.map((r) => r.column_name).join(', '))
  const tables = await client.query(`
    select tablename from pg_tables
    where schemaname = 'public' and tablename in ('kassa_cixarislar', 'odenis_kartlar')
    order by tablename
  `)
  console.log('OK tables:', tables.rows.map((r) => r.tablename).join(', '))
} finally {
  await client.end()
}
