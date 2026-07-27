import fs from 'fs'
import pg from 'pg'

const sql = fs.readFileSync('setup/tables/09_depo_sheet_columns.sql', 'utf8')
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
const r = await client.query(`
  select column_name
  from information_schema.columns
  where table_schema = 'public' and table_name = 'depo'
    and column_name in ('nomre', 'sexsiyyet')
  order by column_name
`)
console.log('OK:', r.rows.map((x) => x.column_name).join(', '))
await client.end()
