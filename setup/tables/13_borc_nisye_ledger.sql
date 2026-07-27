-- ============================================================
-- Borc / Nisyə ledger — action journal + computed balances
-- ============================================================
-- One row = one action (borc_verdim | borc_aldim | nisye_verdim | nisye_odenis)
-- Overview totals are summed in the app (not stored).
-- ============================================================

create table if not exists public.borc_nisye_ledger (
  id uuid primary key default gen_random_uuid(),
  sira_no int,
  kime text not null,
  tarix date,
  tip text not null
    check (tip in ('borc_verdim', 'borc_aldim', 'nisye_verdim', 'nisye_odenis', 'qeyd')),
  mebleg numeric(12, 2) not null default 0
    check (mebleg >= 0),
  mehsul text,
  imei_1 text,
  imei_2 text,
  qeyd text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_borc_nisye_kime on public.borc_nisye_ledger (kime);
create index if not exists idx_borc_nisye_tarix on public.borc_nisye_ledger (tarix desc nulls last);
create index if not exists idx_borc_nisye_tip on public.borc_nisye_ledger (tip);
create index if not exists idx_borc_nisye_sira on public.borc_nisye_ledger (sira_no);

create or replace function public.borc_nisye_set_sira_no()
returns trigger
language plpgsql
as $$
begin
  if new.sira_no is null then
    select coalesce(max(sira_no), 0) + 1 into new.sira_no from public.borc_nisye_ledger;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_borc_nisye_sira_no on public.borc_nisye_ledger;
create trigger trg_borc_nisye_sira_no
  before insert on public.borc_nisye_ledger
  for each row
  execute function public.borc_nisye_set_sira_no();

alter table public.borc_nisye_ledger enable row level security;
drop policy if exists "Allow all for anon" on public.borc_nisye_ledger;
create policy "Allow all for anon" on public.borc_nisye_ledger
  for all using (true) with check (true);

-- Change history (if audit helpers already exist)
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'change_history_log'
  ) then
    drop trigger if exists trg_change_history_borc_nisye on public.borc_nisye_ledger;
    create trigger trg_change_history_borc_nisye
      after insert or update or delete on public.borc_nisye_ledger
      for each row execute function public.change_history_log();
  end if;
end $$;

-- Prefer kime · mehsul labels for this ledger when audit helpers exist
create or replace function public.change_history_item_label(tbl text, row_data jsonb)
returns text
language plpgsql
immutable
as $$
declare
  parts text[] := array[]::text[];
  sira text;
  model text;
  imei text;
  name text;
  kime text;
  mehsul text;
  tip text;
begin
  sira := nullif(trim(coalesce(row_data->>'sira_no', '')), '');
  model := nullif(trim(coalesce(row_data->>'model', '')), '');
  imei := nullif(trim(coalesce(row_data->>'imei_1', '')), '');
  name := nullif(trim(coalesce(row_data->>'ad_soyad', '')), '');
  kime := nullif(trim(coalesce(row_data->>'kime', '')), '');
  mehsul := nullif(trim(coalesce(row_data->>'mehsul', '')), '');
  tip := nullif(trim(coalesce(row_data->>'tip', '')), '');

  if sira is not null then
    parts := array_append(parts, '#' || sira);
  end if;

  if tbl = 'borc_nisye_ledger' then
    if kime is not null then parts := array_append(parts, kime); end if;
    if tip is not null then parts := array_append(parts, tip); end if;
    if mehsul is not null then parts := array_append(parts, mehsul); end if;
  elsif tbl = 'musteri_bazasi' then
    if name is not null then parts := array_append(parts, name); end if;
    if model is not null then parts := array_append(parts, model); end if;
  elsif tbl = 'nagd_satish' then
    if kime is not null then parts := array_append(parts, kime); end if;
    if model is not null then parts := array_append(parts, model); end if;
    if imei is not null then parts := array_append(parts, imei); end if;
  else
    if model is not null then parts := array_append(parts, model); end if;
    if imei is not null then parts := array_append(parts, imei); end if;
  end if;

  if array_length(parts, 1) is null then
    return coalesce(row_data->>'id', 'qeyd');
  end if;
  return array_to_string(parts, ' · ');
end;
$$;
