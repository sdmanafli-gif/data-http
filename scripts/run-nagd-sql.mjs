import fs from 'fs'
import pg from 'pg'

const sql = fs.readFileSync('setup/tables/11_nagd_satish.sql', 'utf8')
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
console.log('OK: nagd_satish')
await client.end()
