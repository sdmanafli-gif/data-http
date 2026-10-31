-- ============================================================
-- 44: Xərclər — İş / Şəxsi bölgüsü və öz əlavə etdiyiniz növlər
-- Köhnə xərclər «İş» sayılır (default 'is'). Analitikada yalnız İş xərcləri mənfəətdən çıxılır.
-- ============================================================

alter table public.xercler
  add column if not exists qrup text not null default 'is';

alter table public.xercler drop constraint if exists xercler_qrup_check;
alter table public.xercler
  add constraint xercler_qrup_check check (qrup in ('is', 'sexsi'));

create index if not exists idx_xercler_qrup_tarix on public.xercler (qrup, tarix);

-- Əlavə edilən növlər (hazır siyahıdan başqa)
create table if not exists public.xerc_kateqoriyalar (
  id uuid primary key default gen_random_uuid(),
  qrup text not null check (qrup in ('is', 'sexsi')),
  ad text not null,
  created_at timestamptz not null default now(),
  unique (qrup, ad)
);

alter table public.xerc_kateqoriyalar enable row level security;
drop policy if exists "Staff full access" on public.xerc_kateqoriyalar;
create policy "Staff full access" on public.xerc_kateqoriyalar
  for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
