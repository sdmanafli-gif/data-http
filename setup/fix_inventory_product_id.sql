-- Çatmayan product_id (və digər sütunları) inventara əlavə et — köhnə bazada "product_id does not exist" xətası üçün
-- Supabase SQL Editor-da yalnız bu faylı run edin.

-- 1. Məhsul kataloqu yoxdursa yarat
create table if not exists public.product_catalogue (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  model text not null,
  color text not null,
  memory text not null,
  created_at timestamptz not null default now(),
  unique (type, model, color, memory)
);

-- 2. İnventarda çatmayan sütunları əlavə et
alter table public.inventory add column if not exists product_id uuid references public.product_catalogue(id) on delete set null;
alter table public.inventory add column if not exists "user" text;
alter table public.inventory add column if not exists comments text;
alter table public.inventory add column if not exists client_number text;
alter table public.inventory add column if not exists return_amount numeric(12, 2);
alter table public.inventory add column if not exists quantity int not null default 1 check (quantity >= 0);

-- 3. İndeks
create index if not exists idx_inventory_product_id on public.inventory(product_id);
