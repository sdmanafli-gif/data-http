/**
 * Add serial_no / model_no columns on musteri_bazasi.
 *
 *   node --env-file=.env.local scripts/setup-musteri-serial-model.mjs
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
const sqlPath = path.join(root, 'setup', 'tables', '28_musteri_serial_model_no.sql')
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
    where table_schema = 'public' and table_name = 'musteri_bazasi'
      and column_name in ('serial_no', 'model_no')
    order by column_name
  `)
  console.log('OK columns:', check.rows.map((r) => r.column_name).join(', '))
} finally {
  await client.end()
}
