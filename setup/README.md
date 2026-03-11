# Mobideal — quraşdırma addımları

Bu qovluqda yalnız məlumatları daxil etməyiniz üçün lazım olan fayllar var.

---

## 1. Supabase açarları (`.env`)

**Fayl:** layihə kökündə **`.env`** (package.json ilə eyni qovluqda)

1. `.env` faylını açın.
2. Aşağıdakı iki sətri Supabase-dan götürdüyünüz məlumatlarla əvəz edin:
   - **VITE_SUPABASE_URL** — Supabase Dashboard → Project Settings → API → **Project URL**
   - **VITE_SUPABASE_ANON_KEY** — eyni səhifədə **anon public** açarı (Reveal ilə kopyalayın)
3. Faylı saxlayın.

---

## 2. Supabase cədvəlləri (SQL)

**Fayl:** **`setup/SUPABASE_TABLES.sql`**

1. Supabase Dashboard açın → **SQL Editor** → **New query**.
2. `setup/SUPABASE_TABLES.sql` faylını açın, bütün məzmunu kopyalayın.
3. SQL Editor-a yapışdırın və **Run** düyməsinə basın.
4. Bütün cədvəllər (clients, **product_catalogue**, inventory, sales, payments, suppliers) yaranacaq.

**Qeyd:** Əgər cədvəlləri əvvəldən yaratmısınızsa: run edin `00004_product_catalogue_and_inventory.sql`, sonra `00005_quantity_and_sale_items.sql` (miqdar + satış sətirləri cədvəli).

---

## 3. Yoxlama

1. Terminalda: `npm run dev`
2. Brauzerdə tətbiqi açın.
3. Sol panelin altında **"Supabase bağlı"** görsəniz, hər şey qoşulub.
