-- ============================================================
-- Mobideal — bütün cədvəllər (bir dəfə Supabase SQL Editor-da Run edin)
-- ============================================================
-- Addım: Supabase Dashboard → SQL Editor → New query → bu faylı yapışdırın → Run
-- ============================================================

-- 1. Müştərilər (clients)
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  address text,
  notes text,
  fin_number text,
  birth_date date,
  id_serial text,
  id_issue_date date,
  id_issued_by text,
  registration_address text,
  residential_address text,
  phone_2 text,
  phone_3 text,
  phone_4 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Məhsul kataloqu (unikal Növ, Model, Rəng, Memory — inventara əlavə zamanı seçim/yeni)
create table if not exists public.product_catalogue (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  model text not null,
  color text not null,
  memory text not null,
  created_at timestamptz not null default now(),
  unique (type, model, color, memory)
);
create index if not exists idx_product_catalogue_lookup on public.product_catalogue (type, model, color, memory);
alter table public.product_catalogue enable row level security;
create policy "Allow all for anon" on public.product_catalogue for all using (true) with check (true);

-- 3. İnventar (hər sətir = bir fiziki telefon; product_id = kataloqdan seçim)
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.product_catalogue(id) on delete set null,
  status text not null default 'available' check (status in ('available', 'sold', 'reserved', 'returned', 'other')),
  type text,
  model text,
  color text,
  condition_type text check (condition_type is null or trim(condition_type) in ('teze', 'kohne')),
  battery text,
  memory text,
  imei_1 text,
  imei_2 text,
  serial_no text,
  model_no text,
  sim_type text check (sim_type is null or sim_type in ('sim', 'esim', 'both')),
  purchase_price numeric(12, 2),
  member text,
  member_no text,
  purchase_date date,
  shift text,
  payment_due_date date,
  documents text,
  "user" text,
  comments text,
  comments_device text,
  client_number text,
  return_amount numeric(12, 2),
  quantity int not null default 1 check (quantity >= 0),
  attachments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Satışlar (sales — müştəri + növ + ümumi məbləğ; sətirlər sale_items-dadır)
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_type text not null check (sale_type in ('credit', 'cash', 'nise')),
  client_id uuid not null references public.clients(id) on delete restrict,
  inventory_id uuid references public.inventory(id) on delete set null,
  total_amount numeric(12, 2) not null,
  terms_months int,
  terms_monthly_amount numeric(12, 2),
  terms_ilkin_date date,
  terms_payment_start_date date,
  terms_notes text,
  notes text,
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_number text,
  purchase_price numeric(12, 2),
  total_paid numeric(12, 2) default 0,
  remaining_debt numeric(12, 2),
  expected_income numeric(12, 2),
  actual_income numeric(12, 2),
  delivery_date date,
  end_date date,
  payment_day int check (payment_day is null or (payment_day >= 1 and payment_day <= 31)),
  seller_name text,
  seller_commission numeric(12, 2),
  down_payment numeric(12, 2),
  contract_number text,
  initial_payment_completed boolean default false,
  initial_payment_remaining numeric(12, 2),
  days_to_complete_initial_payment int,
  credit_documents text
);

-- 4b. Satış sətirləri (bir satışda bir neçə məhsul: inventar + miqdar + vahid qiymət)
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

-- 5. Ödənişlər (payments — per sale, for credit/nise tracking)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  amount numeric(12, 2) not null,
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

-- 6. Təchizatçılar (suppliers — mağazalar / şəxslər, onlardan məhsul alırıq)
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  contact_person text,
  notes text,
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- İnventar → təchizatçı əlaqəsi (optional)
alter table public.inventory
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

-- Köhnə inventar cədvəli üçün: çatmayan sütunları əlavə et (product_id, quantity və s.)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inventory' and column_name = 'product_id') then
    alter table public.inventory add column product_id uuid references public.product_catalogue(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inventory' and column_name = 'user') then
    alter table public.inventory add column "user" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inventory' and column_name = 'comments') then
    alter table public.inventory add column comments text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inventory' and column_name = 'client_number') then
    alter table public.inventory add column client_number text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inventory' and column_name = 'return_amount') then
    alter table public.inventory add column return_amount numeric(12, 2);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inventory' and column_name = 'quantity') then
    alter table public.inventory add column quantity int not null default 1 check (quantity >= 0);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inventory' and column_name = 'attachments') then
    alter table public.inventory add column attachments text;
  end if;
end $$;

-- Indexes
create index if not exists idx_inventory_status on public.inventory(status);
create index if not exists idx_inventory_product_id on public.inventory(product_id);
create index if not exists idx_inventory_supplier_id on public.inventory(supplier_id);
create index if not exists idx_sales_client_id on public.sales(client_id);
create index if not exists idx_sales_sale_type on public.sales(sale_type);
create index if not exists idx_payments_sale_id on public.payments(sale_id);

-- RLS
alter table public.clients enable row level security;
alter table public.product_catalogue enable row level security;
alter table public.inventory enable row level security;
alter table public.sales enable row level security;
alter table public.payments enable row level security;
alter table public.suppliers enable row level security;

create policy "Allow all for anon" on public.clients for all using (true) with check (true);
create policy "Allow all for anon" on public.product_catalogue for all using (true) with check (true);
create policy "Allow all for anon" on public.inventory for all using (true) with check (true);
create policy "Allow all for anon" on public.sales for all using (true) with check (true);
create policy "Allow all for anon" on public.payments for all using (true) with check (true);
create policy "Allow all for anon" on public.suppliers for all using (true) with check (true);

-- iCloud tracking (kredit satışındakı cihazlar üçün iCloud qeydiyyat nömrəsi)
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
alter table public.icloud_tracking enable row level security;
create policy "Allow all for anon" on public.icloud_tracking for all using (true) with check (true);

-- Aylıq takip (kredit satışı üzrə aylıq: gözlənilən / ödənilən / status)
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

-- Bazara borc (təchizatçılara borc — B2B tərəfdaşlar)
create table if not exists public.bazara_borc (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  amount numeric(12, 2) not null,
  description text,
  debt_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists idx_bazara_borc_supplier_id on public.bazara_borc(supplier_id);
create index if not exists idx_bazara_borc_debt_date on public.bazara_borc(debt_date);
alter table public.bazara_borc enable row level security;
create policy "Allow all for anon" on public.bazara_borc for all using (true) with check (true);

-- Telefon nömrələri (ad, nömrə, yeniləmə tarixi)
create table if not exists public.telefon_nomreleri (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text,
  update_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists idx_telefon_nomreleri_update_date on public.telefon_nomreleri(update_date);
alter table public.telefon_nomreleri enable row level security;
create policy "Allow all for anon" on public.telefon_nomreleri for all using (true) with check (true);
