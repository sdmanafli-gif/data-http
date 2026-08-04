const fs = require('fs')
const { Client } = require('pg')

const sql = fs.readFileSync('setup/tables/23_sexsi_kreditler.sql', 'utf8')
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
  console.log('Applied sexsi_kreditler + sexsi_kredit_odenisleri')
  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
