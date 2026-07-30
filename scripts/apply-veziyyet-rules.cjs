const fs = require('fs')
const { Client } = require('pg')

const sql = fs.readFileSync('setup/tables/10_veziyyet_rules.sql', 'utf8')
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

  // Extra backfill for paid-off rows (SQL file already backfills alış=satış=0)
  const r = await client.query(`
    update public.musteri_bazasi
       set veziyyet = 'Bitib',
           veziyyet_manual = false,
           updated_at = now()
     where coalesce(veziyyet, '') <> 'Məhkəmə'
       and coalesce(satis_qiymeti, 0) > 0
       and coalesce(verilib, 0) >= coalesce(satis_qiymeti, 0)
       and coalesce(veziyyet, '') <> 'Bitib'
    returning id
  `)
  console.log('Updated paid-off → Bitib:', r.rowCount)

  const z = await client.query(`
    select count(*)::int as n
      from public.musteri_bazasi
     where coalesce(veziyyet, '') <> 'Məhkəmə'
       and coalesce(alis_qiymeti, 0) = 0
       and coalesce(satis_qiymeti, 0) = 0
       and veziyyet = 'Bitib'
  `)
  console.log('Zero alış+satış marked Bitib:', z.rows[0].n)

  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
