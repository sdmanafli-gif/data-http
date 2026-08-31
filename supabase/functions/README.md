# Edge Functions

## create-user (legacy)

Older admin create-user flow. Prefer **Dəvət et** (`/admin/invite`) for new accounts.

## delete-user

**Recommended (RPC, no Edge Function):**

```bash
node --env-file=.env.local scripts/setup-admin-delete-user-rpc.mjs
```

Uses `admin_delete_user` RPC (same `private.app_secrets` as MFA admin tools).
UI: **İstifadəçilər** → **Sil**.

**Optional Edge Function fallback:**

```bash
npx supabase functions deploy delete-user
```

Allows an **admin** to delete a user from Supabase Auth. Body: `{ userId: string }`. Admins cannot delete their own account.

## Admin MFA (RPC — recommended)

No Edge Function required. One-time DB setup:

```bash
node --env-file=.env.local scripts/setup-admin-mfa-rpc.mjs
```

Uses `admin_mfa_list` / `admin_mfa_unenroll` / `admin_mfa_unenroll_all` RPCs.
UI: **İstifadəçilər** → **MFA sil**.

## admin-mfa Edge Function (optional fallback)

```bash
supabase functions deploy admin-mfa --project-ref amvzitdyxivhidgunmrx
```
