import fs from 'fs'
import pg from 'pg'

const sql = fs.readFileSync('setup/tables/04_column_settings.sql', 'utf8')
const client = new pg.Client({
  host: 'aws-0-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.amvzitdyxivhidgunmrx',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
await client.query(sql)
console.log('OK: ui_column_settings + musteri_bazasi.extra')
await client.end()
