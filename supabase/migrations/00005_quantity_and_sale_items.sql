-- Mobideal: İnventar miqdarı (quantity) + Satış sətirləri (bir satışda bir neçə məhsul)

-- 1. İnventarda miqdar
alter table public.inventory
  add column if not exists quantity int not null default 1
    check (quantity >= 0);

-- 2. Satış sətirləri (bir satışa bir neçə inventar məhsulu)
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  inventory_id uuid not null references public.inventory(id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_price numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sale_items_sale_id on public.sale_items(sale_id);
create index if not exists idx_sale_items_inventory_id on public.sale_items(inventory_id);

alter table public.sale_items enable row level security;
create policy "Allow all for anon" on public.sale_items for all using (true) with check (true);

-- 3. Köhnə satışlar üçün sales.inventory_id saxlanılır (nullable); yeni satışlar sale_items ilə
alter table public.sales
  alter column inventory_id drop not null;

comment on column public.inventory.quantity is 'Stokda olan miqdar (ədəd)';
comment on table public.sale_items is 'Satışa daxil olan məhsullar (inventar + miqdar + vahid qiymət)';
