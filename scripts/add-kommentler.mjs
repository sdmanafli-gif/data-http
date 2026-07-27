import pg from 'pg'

const client = new pg.Client({
  host: 'aws-0-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.amvzitdyxivhidgunmrx',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
})

await client.connect()
await client.query(`
  alter table public.musteri_bazasi
  add column if not exists kommentler text
`)
console.log('OK: kommentler column added')
await client.end()
