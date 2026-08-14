# Hourly archive → Cloudflare R2 (free tier)

Mobideal backs up **all public Postgres tables** (SQL + CSV) and **Storage files** (`Mobideal` bucket) every hour, then uploads a zip to **Cloudflare R2**.

- Independent of your main Supabase Storage as the archive
- No email notifications
- Keeps the last **24 hours** of backups (fits free ~10 GB better than 48h)

## One-time setup (Cloudflare R2)

1. Create a free account at [Cloudflare](https://dash.cloudflare.com/sign-up).
2. Sidebar → **R2 Object Storage** → enable R2 if asked.
3. **Create bucket** e.g. `mobideal-backups` (leave public access **off**).
4. **Manage R2 API Tokens** → **Create API token**
   - Permission: **Object Read & Write** (or Admin Read & Write for that bucket)
   - Copy **Access Key ID** and **Secret Access Key**
5. Note your **Account ID** (R2 overview page, right side).

## Supabase secrets

In Supabase Dashboard:

- **Database** → connection string (Session pooler or direct URI with password), e.g.  
  `postgresql://postgres.YOUR_REF:PASSWORD@aws-0-….pooler.supabase.com:5432/postgres`
- **API** → Project URL + **service_role** key (not anon)

## GitHub repository secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → add:

| Secret | Value |
|--------|--------|
| `SUPABASE_DB_URL` | Postgres URI |
| `SUPABASE_URL` | `https://YOUR_REF.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `R2_ACCOUNT_ID` | Cloudflare account id |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET` | e.g. `mobideal-backups` |

You do **not** need Google Drive secrets anymore. Remove old Drive secrets if you added them.

## Enable / test

1. Push this workflow to your default branch.
2. **Actions** → **Backup to Cloudflare R2** → **Run workflow**.
3. In Cloudflare → R2 → your bucket → you should see  
   `mobideal-backup/mobideal-backup-….zip`

Scheduled runs: every hour at :05 UTC.

## What’s in each zip

```
database.sql
csv/*.csv
storage/Mobideal/…
MANIFEST.json
```

## Free tier tip

R2 free allowance is limited (~10 GB storage). If backups grow large:

- Lower `BACKUP_RETENTION_HOURS` (e.g. `12`) in the workflow, or
- Run every 6 hours instead of hourly (`cron: '5 */6 * * *'`).

## Download a backup

Cloudflare dashboard → R2 → bucket → object → **Download**,  
or use any S3 client with the same API keys / endpoint:

`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

## Local test (optional)

```bash
cd scripts/backup
npm install
export SUPABASE_DB_URL='…'
export SUPABASE_URL='…'
export SUPABASE_SERVICE_ROLE_KEY='…'
export R2_ACCOUNT_ID='…'
export R2_ACCESS_KEY_ID='…'
export R2_SECRET_ACCESS_KEY='…'
export R2_BUCKET='mobideal-backups'
# needs pg_dump on PATH
node run-backup.mjs
```
