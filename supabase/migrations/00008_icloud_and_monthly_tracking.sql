-- iCloud tracking: which number each device (from credit sales) is registered under
-- Monthly tracking: per sale per month — expected vs paid vs missing (for credit sales)

-- 1. iCloud tracking (one row per device in a credit sale: registered number for that device)
create table if not exists public.icloud_tracking (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  inventory_id uuid references public.inventory(id) on delete set null,
  registered_number text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_icloud_tracking_sale_id on public.icloud_tracking(sale_id);
create index if not exists idx_icloud_tracking_inventory_id on public.icloud_tracking(inventory_id);
create unique index if not exists idx_icloud_tracking_sale_inventory on public.icloud_tracking(sale_id, inventory_id) where inventory_id is not null;
alter table public.icloud_tracking enable row level security;
create policy "Allow all for anon" on public.icloud_tracking for all using (true) with check (true);

comment on table public.icloud_tracking is 'iCloud qeydiyyat nömrəsi — kredit satışındakı hər cihaz üçün hansı nömrə ilə qeydiyyatdadır';
comment on column public.icloud_tracking.registered_number is 'iCloud-un qeydiyyatda olduğu nömrə';

-- 2. Monthly tracking per credit sale (expected vs paid per month; status: fulfilled / partial / missing)
create table if not exists public.sale_monthly_tracking (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  year_month text not null,
  expected_amount numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  status text not null default 'missing' check (status in ('fulfilled', 'partial', 'missing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sale_id, year_month)
);
create index if not exists idx_sale_monthly_tracking_sale_id on public.sale_monthly_tracking(sale_id);
create index if not exists idx_sale_monthly_tracking_year_month on public.sale_monthly_tracking(year_month);
alter table public.sale_monthly_tracking enable row level security;
create policy "Allow all for anon" on public.sale_monthly_tracking for all using (true) with check (true);

comment on table public.sale_monthly_tracking is 'Kredit satışı üzrə aylıq takip: gözlənilən / ödənilən / qalan';
comment on column public.sale_monthly_tracking.year_month is 'İl-ay: YYYY-MM';
comment on column public.sale_monthly_tracking.status is 'fulfilled = tam ödənilib, partial = qismən, missing = ödənilməyib';
