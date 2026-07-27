const fs = require('fs')
const { Client } = require('pg')

const sql = fs.readFileSync('setup/tables/12_change_history.sql', 'utf8')
const password = process.env.SUPABASE_DB_PASSWORD
if (!password) {
  console.error('Set SUPABASE_DB_PASSWORD')
  process.exit(1)
}

const configs = [
  {
    host: 'db.amvzitdyxivhidgunmrx.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password,
    ssl: { rejectUnauthorized: false },
  },
  {
    host: 'aws-0-eu-north-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.amvzitdyxivhidgunmrx',
    password,
    ssl: { rejectUnauthorized: false },
  },
]

async function main() {
  let last
  for (const cfg of configs) {
    const client = new Client(cfg)
    try {
      await client.connect()
      await client.query(sql)
      const r = await client.query(`
        select to_regclass('public.change_history') as t,
               (select count(*)::int from pg_trigger where tgname like 'trg_change_history%') as triggers
      `)
      console.log('OK via', cfg.host, JSON.stringify(r.rows[0]))
      await client.end()
      return
    } catch (e) {
      last = e
      console.error('FAIL', cfg.host, e.message)
      try {
        await client.end()
      } catch (_) {
        /* ignore */
      }
    }
  }
  console.error('All failed', last && last.message)
  process.exit(1)
}

main()
