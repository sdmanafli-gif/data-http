const fs = require('fs')
const { Client } = require('pg')

const sql = fs.readFileSync('setup/tables/21_faktiki_gelir_include_faiz.sql', 'utf8')
const password = process.env.SUPABASE_DB_PASSWORD
if (!password) {
  console.error('Set SUPABASE_DB_PASSWORD')
  process.exit(1)
}

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
  const sample = await client.query(`
    select sira_no, alis_qiymeti, verilib, faiz, faktiki_gelir
      from public.musteri_bazasi
     where coalesce(faiz, 0) > 0
     order by sira_no
     limit 5
  `)
  console.log('Applied faktiki_gelir = verilib + faiz - alış')
  console.log('Sample rows with faiz:', sample.rows)
  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
