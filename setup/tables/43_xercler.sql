-- ============================================================
-- 43: Xərclər — işə aid rasxodlar (icarə, maaş, kommunal və s.)
-- Analitikada xalis mənfəətdən çıxılır.
-- Mövcud cədvəllərə toxunmur, yalnız yeni cədvəl yaradır.
-- ============================================================

create table if not exists public.xercler (
  id uuid primary key default gen_random_uuid(),
  tarix date not null default current_date,
  kateqoriya text not null,
  mebleg numeric(12, 2) not null check (mebleg >= 0),
  odenis_usulu text,          -- 'nagd' | 'hesab'
  qeyd text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_xercler_tarix on public.xercler (tarix);

alter table public.xercler enable row level security;
drop policy if exists "Staff full access" on public.xercler;
create policy "Staff full access" on public.xercler
  for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
