const fs = require('fs')
const { Client } = require('pg')

const sql = fs.readFileSync('setup/tables/20_depo_odenis_novu.sql', 'utf8')
const password = process.env.SUPABASE_DB_PASSWORD

async function main() {
  const client = new Client({
    host: 'aws-0-eu-north-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.amvzitdyxivhidgunmrx',
    password,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  await client.query(sql)
  const r = await client.query(`
    select column_name from information_schema.columns
    where table_schema='public' and table_name='depo'
      and column_name in ('odenis_novu','qaytarma_tarixi')
    order by 1
  `)
  console.log('OK depo:', r.rows.map((x) => x.column_name).join(', '))
  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
