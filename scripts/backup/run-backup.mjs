/**
 * Hourly Mobideal backup → Cloudflare R2 (S3-compatible, free tier)
 *
 * Exports:
 *  - Postgres: schema+data SQL dump + CSV per public table
 *  - Supabase Storage: all files from configured buckets
 *
 * Env (required):
 *  SUPABASE_DB_URL
 *  SUPABASE_URL
 *  SUPABASE_SERVICE_ROLE_KEY
 *  R2_ACCOUNT_ID
 *  R2_ACCESS_KEY_ID
 *  R2_SECRET_ACCESS_KEY
 *  R2_BUCKET
 *
 * Env (optional):
 *  BACKUP_BUCKETS            comma list (default: Mobideal)
 *  BACKUP_RETENTION_HOURS    default 24 — bu müddətdə HƏR saatlıq backup saxlanılır
 *  BACKUP_DAILY_DAYS         default 30 — daha köhnələrdən hər gün üçün 1 backup (günün ilki) saxlanılır
 *  BACKUP_PREFIX             default mobideal-backup
 *  R2_ENDPOINT               override (default https://<account>.r2.cloudflarestorage.com)
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import archiver from 'archiver'

const WORK = path.join(process.cwd(), '.backup-work')
const OUT_DIR = path.join(WORK, 'out')

function required(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  )
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (b) => {
      stderr += b.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-2000)}`))
    })
  })
}

async function dumpSql(dbUrl, destFile) {
  await run('pg_dump', [
    dbUrl,
    '--no-owner',
    '--no-acl',
    '--clean',
    '--if-exists',
    '-f',
    destFile,
  ])
}

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  let s
  if (value instanceof Date) s = value.toISOString()
  else if (typeof value === 'object') s = JSON.stringify(value)
  else s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

async function exportCsvs(dbUrl, csvDir) {
  fs.mkdirSync(csvDir, { recursive: true })
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    const { rows } = await client.query(`
      select table_name
        from information_schema.tables
       where table_schema = 'public'
         and table_type = 'BASE TABLE'
       order by table_name
    `)
    for (const { table_name } of rows) {
      const file = path.join(csvDir, `${table_name}.csv`)
      const res = await client.query(`select * from public."${table_name}"`)
      const cols = res.fields.map((f) => f.name)
      const lines = [cols.map(csvEscape).join(',')]
      for (const row of res.rows) {
        lines.push(cols.map((c) => csvEscape(row[c])).join(','))
      }
      fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8')
      console.log(`  csv  ${table_name} (${res.rows.length} rows)`)
    }
  } finally {
    await client.end()
  }
}

async function downloadBucket(supabase, bucket, destRoot) {
  const base = path.join(destRoot, bucket)
  fs.mkdirSync(base, { recursive: true })

  async function walk(prefix = '') {
    let offset = 0
    for (;;) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, {
        limit: 1000,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error) {
        console.warn(`  storage list ${bucket}/${prefix}: ${error.message}`)
        return
      }
      const items = data || []
      if (!items.length) break

      for (const item of items) {
        const rel = prefix ? `${prefix}/${item.name}` : item.name
        const isFolder = item.id === null
        if (isFolder) {
          await walk(rel)
          continue
        }
        const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(rel)
        if (dlErr) {
          console.warn(`  skip ${bucket}/${rel}: ${dlErr.message}`)
          continue
        }
        const outPath = path.join(base, rel)
        fs.mkdirSync(path.dirname(outPath), { recursive: true })
        fs.writeFileSync(outPath, Buffer.from(await blob.arrayBuffer()))
      }

      if (items.length < 1000) break
      offset += 1000
    }
  }

  await walk('')
  console.log(`  storage bucket "${bucket}" done`)
}

async function zipDirectory(srcDir, zipPath) {
  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(srcDir, false)
    archive.finalize()
  })
}

function r2Client() {
  const accountId = required('R2_ACCOUNT_ID')
  const endpoint =
    process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`
  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: required('R2_ACCESS_KEY_ID'),
      secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    },
  })
}

async function uploadToR2(client, bucket, key, filePath) {
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: 'application/zip',
    },
  })
  await upload.done()
}

/**
 * Saxlama qaydası:
 *  - son `retentionHours` saat: bütün saatlıq backup-lar qalır
 *  - ondan köhnə, son `dailyDays` gün: hər gün üçün yalnız 1 backup (Bakı vaxtı ilə günün ilki)
 *  - daha köhnələr silinir
 */
async function pruneOldBackups(client, bucket, prefix, retentionHours, dailyDays) {
  const now = Date.now()
  const hourlyCutoff = now - retentionHours * 3600 * 1000
  const dailyCutoff = now - dailyDays * 24 * 3600 * 1000
  const all = []
  let token
  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    )
    for (const obj of listed.Contents || []) {
      const modified = obj.LastModified ? obj.LastModified.getTime() : 0
      if (modified && obj.Key) all.push({ key: obj.Key, t: modified })
    }
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined
  } while (token)

  all.sort((a, b) => a.t - b.t)
  const keptDays = new Set()
  let kept = 0
  for (const o of all) {
    if (o.t >= hourlyCutoff) {
      kept++
      continue
    }
    // Bakı günü (UTC+4)
    const day = new Date(o.t + 4 * 3600 * 1000).toISOString().slice(0, 10)
    if (o.t >= dailyCutoff && !keptDays.has(day)) {
      keptDays.add(day)
      kept++
      continue
    }
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: o.key }))
    console.log(`  pruned ${o.key}`)
  }
  console.log(`  kept ${kept} backups (${keptDays.size} daily + recent hourly)`)
}

async function main() {
  const dbUrl = required('SUPABASE_DB_URL')
  const supabaseUrl = required('SUPABASE_URL')
  const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY')
  const r2Bucket = required('R2_BUCKET')
  const buckets = (process.env.BACKUP_BUCKETS || 'Mobideal')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  // Son 24 saat saatlıq + 30 gün gündəlik (R2 pulsuz 10 GB-ın çox altında qalır)
  const retentionHours = Number(process.env.BACKUP_RETENTION_HOURS || 24)
  const dailyDays = Number(process.env.BACKUP_DAILY_DAYS || 30)
  const prefix = process.env.BACKUP_PREFIX || 'mobideal-backup'
  const tag = stamp()
  const zipName = `${prefix}-${tag}.zip`
  const objectKey = `${prefix}/${zipName}`

  fs.rmSync(WORK, { recursive: true, force: true })
  fs.mkdirSync(OUT_DIR, { recursive: true })

  console.log('1) Postgres SQL dump…')
  await dumpSql(dbUrl, path.join(OUT_DIR, 'database.sql'))

  console.log('2) CSV export of public tables…')
  await exportCsvs(dbUrl, path.join(OUT_DIR, 'csv'))

  console.log('3) Storage files…')
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const storageRoot = path.join(OUT_DIR, 'storage')
  for (const b of buckets) {
    await downloadBucket(supabase, b, storageRoot)
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'MANIFEST.json'),
    JSON.stringify(
      {
        created_at: new Date().toISOString(),
        destination: 'cloudflare-r2',
        r2_bucket: r2Bucket,
        buckets,
        retention_hours: retentionHours,
        daily_days: dailyDays,
      },
      null,
      2
    )
  )

  console.log('4) Zip…')
  const zipPath = path.join(WORK, zipName)
  await zipDirectory(OUT_DIR, zipPath)
  const sizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2)
  console.log(`   ${zipName} (${sizeMb} MB)`)

  console.log('5) Upload to Cloudflare R2…')
  const s3 = r2Client()
  await uploadToR2(s3, r2Bucket, objectKey, zipPath)
  console.log(`   uploaded s3://${r2Bucket}/${objectKey}`)

  console.log(`6) Prune: keep ${retentionHours}h hourly + ${dailyDays} days daily…`)
  await pruneOldBackups(s3, r2Bucket, `${prefix}/`, retentionHours, dailyDays)

  fs.rmSync(WORK, { recursive: true, force: true })
  console.log('Backup complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
