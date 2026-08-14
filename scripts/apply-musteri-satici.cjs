const fs = require('fs')
const { Client } = require('pg')

const sql = fs.readFileSync('setup/tables/24_musteri_satici.sql', 'utf8')
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
  console.log('Applied musteri_bazasi satici + satici_faizi; updated gozlenilen/faktiki formulas')
  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
