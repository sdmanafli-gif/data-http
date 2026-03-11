-- Bazara borc: mağazanın təchizatçılara (B2B tərəfdaşlara) borcu — alış-ödəniş qeydləri

create table if not exists public.bazara_borc (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  amount numeric(12, 2) not null,
  description text,
  debt_date date not null default current_date,
  created_at timestamptz not null default now()
);

comment on table public.bazara_borc is 'Bazara borc — təchizatçılara (mağazalara) borc; amount > 0 = borc əlavə, amount < 0 = ödəniş';
comment on column public.bazara_borc.amount is 'Məbləğ: müsbət = borc, mənfi = ödəniş (AZN)';

create index if not exists idx_bazara_borc_supplier_id on public.bazara_borc(supplier_id);
create index if not exists idx_bazara_borc_debt_date on public.bazara_borc(debt_date);

alter table public.bazara_borc enable row level security;
create policy "Allow all for anon" on public.bazara_borc for all using (true) with check (true);
