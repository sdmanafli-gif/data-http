-- Mobideal: initial tables (simple creation first, logic later)
-- Run in Supabase Dashboard → SQL Editor, or via: supabase db push

-- 1. Müştərilər (clients)
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. İnventar (inventory items — one row per physical phone)
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'available' check (status in ('available', 'sold', 'reserved', 'returned', 'other')),
  type text,
  model text,
  color text,
  condition_type text check (condition_type is null or condition_type in ('teze', 'kohne')),
  battery text,
  memory text,
  imei_1 text,
  imei_2 text,
  serial_no text,
  model_no text,
  purchase_price numeric(12, 2),
  member text,
  member_no text,
  purchase_date date,
  shift text,
  payment_due_date date,
  documents text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Satışlar (sales — links client + inventory + type + terms)
-- sale_type: 'credit' | 'cash' | 'nise'
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_type text not null check (sale_type in ('credit', 'cash', 'nise')),
  client_id uuid not null references public.clients(id) on delete restrict,
  inventory_id uuid not null references public.inventory(id) on delete restrict,
  total_amount numeric(12, 2) not null,
  -- for credit/nise: terms (e.g. months, monthly amount, interest)
  terms_months int,
  terms_monthly_amount numeric(12, 2),
  terms_notes text,
  notes text,
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Ödənişlər (payments — per sale, for credit/nise tracking)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  amount numeric(12, 2) not null,
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

-- Indexes for common lookups
create index if not exists idx_inventory_status on public.inventory(status);
create index if not exists idx_sales_client_id on public.sales(client_id);
create index if not exists idx_sales_inventory_id on public.sales(inventory_id);
create index if not exists idx_sales_sale_type on public.sales(sale_type);
create index if not exists idx_payments_sale_id on public.payments(sale_id);

-- RLS: enable Row Level Security (you can refine policies later)
alter table public.clients enable row level security;
alter table public.inventory enable row level security;
alter table public.sales enable row level security;
alter table public.payments enable row level security;

-- Allow all for anon for now (internal app; tighten with auth later)
create policy "Allow all for anon" on public.clients for all using (true) with check (true);
create policy "Allow all for anon" on public.inventory for all using (true) with check (true);
create policy "Allow all for anon" on public.sales for all using (true) with check (true);
create policy "Allow all for anon" on public.payments for all using (true) with check (true);
