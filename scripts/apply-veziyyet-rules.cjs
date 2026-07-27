const fs = require('fs')
const { Client } = require('pg')

const sql = fs.readFileSync('setup/tables/10_veziyyet_rules.sql', 'utf8')
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
    update public.musteri_bazasi
       set veziyyet = 'Bitib',
           veziyyet_manual = false,
           updated_at = now()
     where veziyyet = 'Qalıb'
       and coalesce(satis_qiymeti, 0) > 0
       and coalesce(verilib, 0) >= coalesce(satis_qiymeti, 0)
    returning id, sira_no, ad_soyad
  `)
  console.log('Updated Qalıb→Bitib:', r.rowCount)
  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
