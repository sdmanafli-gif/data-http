-- ============================================================
-- Depo (inventory) + link sales on musteri_bazasi
-- ============================================================

create table if not exists public.depo (
  id uuid primary key default gen_random_uuid(),
  sira_no int,
  status text not null default 'available'
    check (status in ('available', 'sold', 'reserved', 'returned', 'other')),
  nov text,
  model text,
  reng text,
  yaddas text,
  veziyyet_cihaz text check (veziyyet_cihaz is null or veziyyet_cihaz in ('teze', 'kohne')),
  battery_faiz numeric(5, 2),
  imei_1 text,
  imei_2 text,
  serial_no text,
  model_no text,
  sim_type text check (sim_type is null or sim_type in ('sim', 'esim', 'both')),
  alis_qiymeti numeric(12, 2),
  alis_tarixi date,
  kimden_alinib text,
  nomre text,
  sexsiyyet text,
  miqdar int not null default 1 check (miqdar >= 0),
  kommentler text,
  extra jsonb not null default '{}'::jsonb,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_depo_status on public.depo (status);
create index if not exists idx_depo_sira_no on public.depo (sira_no);
create index if not exists idx_depo_model on public.depo (model);
create index if not exists idx_depo_imei_1 on public.depo (imei_1);

create or replace function public.depo_set_sira_no()
returns trigger
language plpgsql
as $$
begin
  if new.sira_no is null then
    select coalesce(max(sira_no), 0) + 1 into new.sira_no from public.depo;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_depo_sira_no on public.depo;
create trigger trg_depo_sira_no
  before insert on public.depo
  for each row
  execute function public.depo_set_sira_no();

alter table public.depo enable row level security;
drop policy if exists "Allow all for anon" on public.depo;
create policy "Allow all for anon" on public.depo for all using (true) with check (true);

-- Link Müştəri Bazası rows to Depo + sale type
alter table public.musteri_bazasi
  add column if not exists depo_id uuid references public.depo(id) on delete set null;

alter table public.musteri_bazasi
  add column if not exists satis_novu text
  check (satis_novu is null or satis_novu in ('kredit', 'nise', 'nagd'));

create index if not exists idx_musteri_bazasi_depo_id on public.musteri_bazasi (depo_id);
create index if not exists idx_musteri_bazasi_satis_novu on public.musteri_bazasi (satis_novu);
