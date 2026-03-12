# Edge Functions

## create-user (admin only)

Allows an **admin** to create new users (email + password + role: admin or store_manager).

## delete-user (admin only)

Allows an **admin** to delete a user from Supabase Auth. Body: `{ userId: string }`. Admins cannot delete their own account.

### Deploy

From the project root:

```bash
supabase functions deploy create-user
supabase functions deploy delete-user
```

Secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are set automatically in the Supabase project; no extra config needed when deploying from the Supabase CLI.

### Usage

- **Create user:** Log in as admin → **“Yeni istifadəçi”** (or `/admin/create-user`) → enter email, password, role.
- **Delete user:** Log in as admin → **“İstifadəçilər”** (or `/admin/users`) → list of users with **Sil** (Delete). Confirm to remove the user from Auth (and their profile row is removed by cascade).
