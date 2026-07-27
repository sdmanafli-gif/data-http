-- ============================================================
-- Mobideal — FULL fresh database setup (new Supabase project)
-- ============================================================
-- How to run:
--   1. Create a new project at https://supabase.com
--   2. Dashboard → SQL Editor → New query
--   3. Paste this entire file → Run
--   4. Dashboard → Authentication → Users → Add user (email + password)
--      First user automatically becomes admin (via trigger below)
--   5. Dashboard → Storage: bucket "Mobideal" is created by this script
--   6. Copy Project URL + anon key into project root .env
-- ============================================================

-- ------------------------------------------------------------
-- 1. Clients (müştərilər)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 2. Product catalogue (məhsul bazası)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 3. Suppliers (təchizatçılar) — before inventory (FK)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 4. Inventory (inventar)
-- ------------------------------------------------------------
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.product_catalogue(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status text not null default 'available'
    check (status in ('available', 'sold', 'reserved', 'returned', 'other')),
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
create index if not exists idx_inventory_status on public.inventory(status);
create index if not exists idx_inventory_product_id on public.inventory(product_id);
create index if not exists idx_inventory_supplier_id on public.inventory(supplier_id);

-- ------------------------------------------------------------
-- 5. Sales (satışlar)
-- ------------------------------------------------------------
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
create index if not exists idx_sales_client_id on public.sales(client_id);
create index if not exists idx_sales_sale_type on public.sales(sale_type);

-- ------------------------------------------------------------
-- 6. Sale items (satış sətirləri)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 7. Payments (ödənişlər)
-- ------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  amount numeric(12, 2) not null,
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_sale_id on public.payments(sale_id);

-- ------------------------------------------------------------
-- 8. iCloud tracking
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 9. Monthly tracking (aylıq yığım)
-- ------------------------------------------------------------
create table if not exists public.sale_monthly_tracking (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  year_month text not null,
  expected_amount numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  status text not null default 'missing'
    check (status in ('fulfilled', 'partial', 'missing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sale_id, year_month)
);
create index if not exists idx_sale_monthly_tracking_sale_id on public.sale_monthly_tracking(sale_id);
create index if not exists idx_sale_monthly_tracking_year_month on public.sale_monthly_tracking(year_month);

-- ------------------------------------------------------------
-- 10. Bazara borc (supplier debts)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 11. Telefon nömrələri
-- ------------------------------------------------------------
create table if not exists public.telefon_nomreleri (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text,
  update_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists idx_telefon_nomreleri_update_date on public.telefon_nomreleri(update_date);

-- ------------------------------------------------------------
-- 12. Auth profiles + store manager config
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'store_manager'
    check (role in ('admin', 'store_manager')),
  email text,
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.store_manager_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  config jsonb not null default '{}',
  updated_at timestamptz default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- First Auth user → admin; later users → store_manager
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  assign_role text;
begin
  select case
    when exists (select 1 from public.profiles limit 1) then 'store_manager'
    else 'admin'
  end into assign_role;
  insert into public.profiles (id, role, email)
  values (new.id, assign_role, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.profiles_deny_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role is distinct from new.role and not public.is_admin() then
    raise exception 'Only admin can change role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_deny_role_change on public.profiles;
create trigger profiles_deny_role_change
  before update on public.profiles
  for each row execute function public.profiles_deny_role_change();

-- ------------------------------------------------------------
-- 13. Row Level Security (open for business tables; strict for profiles)
-- ------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.product_catalogue enable row level security;
alter table public.suppliers enable row level security;
alter table public.inventory enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.icloud_tracking enable row level security;
alter table public.sale_monthly_tracking enable row level security;
alter table public.bazara_borc enable row level security;
alter table public.telefon_nomreleri enable row level security;
alter table public.profiles enable row level security;
alter table public.store_manager_config enable row level security;

drop policy if exists "Allow all for anon" on public.clients;
drop policy if exists "Allow all for anon" on public.product_catalogue;
drop policy if exists "Allow all for anon" on public.suppliers;
drop policy if exists "Allow all for anon" on public.inventory;
drop policy if exists "Allow all for anon" on public.sales;
drop policy if exists "Allow all for anon" on public.sale_items;
drop policy if exists "Allow all for anon" on public.payments;
drop policy if exists "Allow all for anon" on public.icloud_tracking;
drop policy if exists "Allow all for anon" on public.sale_monthly_tracking;
drop policy if exists "Allow all for anon" on public.bazara_borc;
drop policy if exists "Allow all for anon" on public.telefon_nomreleri;

create policy "Allow all for anon" on public.clients for all using (true) with check (true);
create policy "Allow all for anon" on public.product_catalogue for all using (true) with check (true);
create policy "Allow all for anon" on public.suppliers for all using (true) with check (true);
create policy "Allow all for anon" on public.inventory for all using (true) with check (true);
create policy "Allow all for anon" on public.sales for all using (true) with check (true);
create policy "Allow all for anon" on public.sale_items for all using (true) with check (true);
create policy "Allow all for anon" on public.payments for all using (true) with check (true);
create policy "Allow all for anon" on public.icloud_tracking for all using (true) with check (true);
create policy "Allow all for anon" on public.sale_monthly_tracking for all using (true) with check (true);
create policy "Allow all for anon" on public.bazara_borc for all using (true) with check (true);
create policy "Allow all for anon" on public.telefon_nomreleri for all using (true) with check (true);

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;

create policy "Users can read own profile" on public.profiles
  for select using (id = auth.uid());
create policy "Admins can read all profiles" on public.profiles
  for select using (public.is_admin());
create policy "Users can insert own profile" on public.profiles
  for insert with check (id = auth.uid());
create policy "Users can update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "Admins can update any profile" on public.profiles
  for update using (public.is_admin());

drop policy if exists "Users can read own config" on public.store_manager_config;
drop policy if exists "Admins can read all config" on public.store_manager_config;
drop policy if exists "Admins can insert config" on public.store_manager_config;
drop policy if exists "Admins can update config" on public.store_manager_config;
drop policy if exists "Admins can delete config" on public.store_manager_config;

create policy "Users can read own config" on public.store_manager_config
  for select using (user_id = auth.uid());
create policy "Admins can read all config" on public.store_manager_config
  for select using (public.is_admin());
create policy "Admins can insert config" on public.store_manager_config
  for insert with check (public.is_admin());
create policy "Admins can update config" on public.store_manager_config
  for update using (public.is_admin());
create policy "Admins can delete config" on public.store_manager_config
  for delete using (public.is_admin());

-- ------------------------------------------------------------
-- 14. Storage bucket for inventory attachments
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('Mobideal', 'Mobideal', true)
on conflict (id) do nothing;

drop policy if exists "Mobideal anon insert" on storage.objects;
drop policy if exists "Mobideal anon select" on storage.objects;
drop policy if exists "Mobideal anon delete" on storage.objects;

create policy "Mobideal anon insert"
  on storage.objects for insert to public
  with check (bucket_id = 'Mobideal');
create policy "Mobideal anon select"
  on storage.objects for select to public
  using (bucket_id = 'Mobideal');
create policy "Mobideal anon delete"
  on storage.objects for delete to public
  using (bucket_id = 'Mobideal');
