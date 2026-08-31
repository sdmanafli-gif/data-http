-- ============================================================
-- Ödəniş kassası: who collected what + card/cash + withdrawals
-- ============================================================
-- odenisler.created_by  → staff who entered the payment
-- odenisler.odenis_usulu → nagd | kart
-- odenisler.kart_nomresi → card number when odenis_usulu = kart
-- kassa_cixarislar       → admin withdrawals from a staff balance
-- ============================================================

alter table public.odenisler
  add column if not exists created_by uuid references auth.users (id) on delete set null;

alter table public.odenisler
  add column if not exists odenis_usulu text
    check (odenis_usulu is null or odenis_usulu in ('nagd', 'kart'));

alter table public.odenisler
  add column if not exists kart_nomresi text;

-- Default existing rows to cash if unset
update public.odenisler
set odenis_usulu = 'nagd'
where odenis_usulu is null;

alter table public.odenisler
  alter column odenis_usulu set default 'nagd';

create index if not exists idx_odenisler_created_by on public.odenisler (created_by);
create index if not exists idx_odenisler_usulu on public.odenisler (odenis_usulu);
create index if not exists idx_odenisler_kart on public.odenisler (kart_nomresi);

create or replace function public.odenisler_set_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  if new.odenis_usulu is null then
    new.odenis_usulu := 'nagd';
  end if;
  if new.odenis_usulu = 'nagd' then
    new.kart_nomresi := null;
  elsif new.odenis_usulu = 'kart' then
    new.kart_nomresi := nullif(trim(new.kart_nomresi), '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_odenisler_set_created_by on public.odenisler;
create trigger trg_odenisler_set_created_by
  before insert or update on public.odenisler
  for each row execute function public.odenisler_set_created_by();

-- Known cards (for dropdown); also discoverable from odenisler.kart_nomresi
create table if not exists public.odenis_kartlar (
  id uuid primary key default gen_random_uuid(),
  kart_nomresi text not null unique,
  label text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_odenis_kartlar_nomre on public.odenis_kartlar (kart_nomresi);

alter table public.odenis_kartlar enable row level security;
drop policy if exists "Allow all for anon" on public.odenis_kartlar;
drop policy if exists "Authenticated can manage cards" on public.odenis_kartlar;
create policy "Authenticated can manage cards" on public.odenis_kartlar
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Admin withdrawals from a staff member's collected cash
create table if not exists public.kassa_cixarislar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mebleg numeric(12, 2) not null check (mebleg > 0),
  tarix date not null default (current_date),
  -- optional scope: null = from user's total; nagd / kart + kart_nomresi for scoped
  odenis_usulu text
    check (odenis_usulu is null or odenis_usulu in ('nagd', 'kart')),
  kart_nomresi text,
  qeyd text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_kassa_cixarislar_user on public.kassa_cixarislar (user_id);
create index if not exists idx_kassa_cixarislar_tarix on public.kassa_cixarislar (tarix desc nulls last);

alter table public.kassa_cixarislar enable row level security;
drop policy if exists "Admins manage withdrawals" on public.kassa_cixarislar;
drop policy if exists "Users read own withdrawals" on public.kassa_cixarislar;

create policy "Admins manage withdrawals" on public.kassa_cixarislar
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Users read own withdrawals" on public.kassa_cixarislar
  for select
  using (user_id = auth.uid());

comment on column public.odenisler.created_by is 'Staff user who recorded the payment';
comment on column public.odenisler.odenis_usulu is 'nagd = cash, kart = card';
comment on column public.odenisler.kart_nomresi is 'Card number when odenis_usulu = kart';
comment on table public.kassa_cixarislar is 'Admin payouts / withdrawals from staff collected payments';
