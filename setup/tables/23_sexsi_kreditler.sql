-- Şəxsi kreditlər (öz krediti: bank və s.) — Borc/Nisyə şöbəsi daxilində
create table if not exists public.sexsi_kreditler (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  kimden text,
  verilme_tarixi date not null,
  cemi_mebleg numeric(12, 2) not null
    check (cemi_mebleg >= 0),
  nece_ay int not null
    check (nece_ay > 0),
  aylik_odenis numeric(12, 2),
  birinci_odenis_tarixi date,
  odenis_qrafiki jsonb,
  qeyd text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sexsi_kreditler_verilme
  on public.sexsi_kreditler (verilme_tarixi desc nulls last);

comment on table public.sexsi_kreditler is
  'Şəxsi kreditlər — götürülən kreditlər və ödəniş qrafiki';
comment on column public.sexsi_kreditler.odenis_qrafiki is
  'Əl ilə saxlanmış ödəniş qrafiki (null = avtomatik)';

create table if not exists public.sexsi_kredit_odenisleri (
  id uuid primary key default gen_random_uuid(),
  kredit_id uuid not null
    references public.sexsi_kreditler (id) on delete cascade,
  mebleg numeric(12, 2) not null
    check (mebleg > 0),
  tarix date not null,
  qeyd text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sexsi_kredit_odenis_kredit
  on public.sexsi_kredit_odenisleri (kredit_id);
create index if not exists idx_sexsi_kredit_odenis_tarix
  on public.sexsi_kredit_odenisleri (tarix desc nulls last);

alter table public.sexsi_kreditler enable row level security;
alter table public.sexsi_kredit_odenisleri enable row level security;

drop policy if exists "Allow all for anon" on public.sexsi_kreditler;
create policy "Allow all for anon" on public.sexsi_kreditler
  for all using (true) with check (true);

drop policy if exists "Allow all for anon" on public.sexsi_kredit_odenisleri;
create policy "Allow all for anon" on public.sexsi_kredit_odenisleri
  for all using (true) with check (true);
