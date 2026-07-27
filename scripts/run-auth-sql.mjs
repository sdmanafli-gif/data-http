import fs from 'fs'
import pg from 'pg'

const sql = fs.readFileSync('setup/tables/02_auth_profiles_invitations.sql', 'utf8')
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
const t = await client.query(
  `select tablename from pg_tables where schemaname='public' and tablename in ('profiles','invitations')`
)
console.log('OK tables:', t.rows.map((r) => r.tablename).join(', '))
await client.end()
