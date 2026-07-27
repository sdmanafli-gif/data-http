import fs from 'fs'
import pg from 'pg'

const sql = fs.readFileSync('setup/tables/03_musteriler.sql', 'utf8')
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
const c = await client.query('select count(*)::int as n from musteriler')
const linked = await client.query(
  'select count(*)::int as n from musteri_bazasi where musteri_id is not null'
)
console.log('musteriler:', c.rows[0].n, '| musteri_bazasi linked:', linked.rows[0].n)
await client.end()
