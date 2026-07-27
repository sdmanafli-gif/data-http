const fs = require('fs')
const { Client } = require('pg')

const sql = fs.readFileSync('setup/tables/18_odenisler.sql', 'utf8')
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
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'odenisler'
    order by ordinal_position
  `)
  console.log('OK odenisler columns:', r.rows.map((x) => x.column_name).join(', '))
  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
