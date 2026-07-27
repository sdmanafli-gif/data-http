const fs = require('fs')
const { Client } = require('pg')

const sql = fs.readFileSync('setup/tables/16_senedler.sql', 'utf8')
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
  const r = await client.query(`
    select table_name
    from information_schema.columns
    where column_name = 'senedler'
      and table_schema = 'public'
    order by table_name
  `)
  console.log('OK columns on', r.rows.map((x) => x.table_name).join(', '))
  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
