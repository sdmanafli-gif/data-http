import fs from 'fs'
import path from 'path'
import pg from 'pg'

const allowed = new Set([
  'musteri_bazasi',
  'musteriler',
  'profiles',
  'invitations',
  'ui_column_settings',
  'depo',
  'nagd_satish',
])

// Files actually reachable from App.jsx (active app)
const activeRoots = [
  'src/App.jsx',
  'src/main.jsx',
  'src/lib',
  'src/contexts',
  'src/config',
  'src/layout',
  'src/pages',
  'src/components',
  'src/features/musteri-bazasi',
]

function walk(d, acc = []) {
  if (!fs.existsSync(d)) return acc
  const st = fs.statSync(d)
  if (st.isFile()) {
    if (/\.(jsx?|tsx?)$/.test(d)) acc.push(d)
    return acc
  }
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    walk(path.join(d, f.name), acc)
  }
  return acc
}

const files = activeRoots.flatMap((r) => walk(r))
const hits = []
for (const file of files) {
  const t = fs.readFileSync(file, 'utf8')
  const re = /\.from\(\s*['"]([^'"]+)['"]\s*\)/g
  let m
  while ((m = re.exec(t))) {
    if (!allowed.has(m[1]) && m[1] !== 'Mobideal') {
      hits.push(`${file}: ${m[1]}`)
    }
  }
}

console.log('Active app .from() outside allowed tables:')
console.log(hits.length ? hits.join('\n') : '(none)')

const client = new pg.Client({
  host: 'aws-0-eu-north-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.amvzitdyxivhidgunmrx',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
const t = await client.query(
  `select tablename from pg_tables where schemaname='public' order by 1`
)
console.log('Live public tables:', t.rows.map((r) => r.tablename).join(', '))
const n = await client.query('select count(*)::int as n from musteri_bazasi')
console.log('musteri_bazasi rows:', n.rows[0].n)
await client.end()
