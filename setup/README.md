# Mobideal — quraşdırma (yeni Supabase layihəsi)

## 1. Yeni Supabase project

1. https://supabase.com → **New project**
2. Ad, parol, region seçin → Create

## 2. Cədvəlləri yaratmaq (SQL)

**Fayl:** `setup/SUPABASE_TABLES.sql`

1. Dashboard → **SQL Editor** → **New query**
2. `setup/SUPABASE_TABLES.sql` məzmununu tam kopyalayıb yapışdırın
3. **Run** basın

Bu bir skript yaradır: clients, product_catalogue, suppliers, inventory, sales, sale_items, payments, icloud_tracking, sale_monthly_tracking, bazara_borc, telefon_nomreleri, profiles, store_manager_config + Storage bucket `Mobideal`.

## 3. İlk admin istifadəçi

1. Dashboard → **Authentication** → **Users** → **Add user**
2. Email + password daxil edin
3. İlk istifadəçi avtomatik **admin** olur (SQL trigger)

Əgər rol admin deyilsə, SQL Editor-da:

```sql
ALTER TABLE public.profiles DISABLE TRIGGER profiles_deny_role_change;
UPDATE public.profiles SET role = 'admin', updated_at = now()
WHERE email = 'YOUR_EMAIL@example.com';
ALTER TABLE public.profiles ENABLE TRIGGER profiles_deny_role_change;
```

## 4. `.env` açarları

Layihə kökündə `.env`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Açarlar: Dashboard → **Project Settings** → **API**

## 5. Yoxlama

```bash
npm run dev
```

Sol paneldə **"Supabase bağlı"** görünməlidir. Login səhifəsindən daxil olun.

## 6. (İstəyə bağlı) Edge Functions — istifadəçi yaratmaq/silmək

Supabase CLI ilə:

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase functions deploy create-user
npx supabase functions deploy delete-user
```
