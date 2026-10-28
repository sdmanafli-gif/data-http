-- ============================================================
-- 42: Yığım — hər ödəniş sətri üçün komment və «söz verdiyi tarix»
-- setir = '<növ>-<taksit №>' (məs. 'ayliq-3', 'ilkin-0') — Yığım cədvəlinin sətrinə uyğun
-- Mövcud cədvəllərə toxunmur, yalnız yeni cədvəl yaradır.
-- ============================================================

create table if not exists public.yigim_qeydler (
  id uuid primary key default gen_random_uuid(),
  musteri_id uuid not null references public.musteri_bazasi (id) on delete cascade,
  setir text not null,
  komment text,
  soz_tarixi date,
  updated_at timestamptz not null default now(),
  unique (musteri_id, setir)
);

create index if not exists idx_yigim_qeydler_soz on public.yigim_qeydler (soz_tarixi);

alter table public.yigim_qeydler enable row level security;
drop policy if exists "Staff full access" on public.yigim_qeydler;
create policy "Staff full access" on public.yigim_qeydler
  for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
