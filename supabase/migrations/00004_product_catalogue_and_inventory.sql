-- Mobideal: Məhsul kataloqu (unikal Növ, Model, Rəng, Memory) + inventar əlavə sahələr
-- Product catalogue: unique (type, model, color, memory). Inventory: product_id + user, comments, client_number, return_amount

-- 1. Məhsul kataloqu (unikal kombinasiya: Növ, Model, Rəng, Memory)
create table if not exists public.product_catalogue (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  model text not null,
  color text not null,
  memory text not null,
  created_at timestamptz not null default now(),
  unique (type, model, color, memory)
);

create index if not exists idx_product_catalogue_lookup
  on public.product_catalogue (type, model, color, memory);

alter table public.product_catalogue enable row level security;
create policy "Allow all for anon" on public.product_catalogue for all using (true) with check (true);

-- 2. İnventar → məhsul kataloqu əlaqəsi + əlavə sahələr
alter table public.inventory
  add column if not exists product_id uuid references public.product_catalogue(id) on delete set null,
  add column if not exists "user" text,
  add column if not exists comments text,
  add column if not exists client_number text,
  add column if not exists return_amount numeric(12, 2);

create index if not exists idx_inventory_product_id on public.inventory(product_id);
