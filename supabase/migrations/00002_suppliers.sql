-- Mobideal: Təchizatçılar — mağazalar / şəxslər, onlardan məhsul alırıq
-- Run in Supabase Dashboard → SQL Editor after 00001_initial_tables.sql

-- Təchizatçılar (suppliers: stores or persons we buy from)
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  contact_person text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Link inventory to supplier (optional: where we bought this item)
alter table public.inventory
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

create index if not exists idx_inventory_supplier_id on public.inventory(supplier_id);

alter table public.suppliers enable row level security;
create policy "Allow all for anon" on public.suppliers for all using (true) with check (true);
