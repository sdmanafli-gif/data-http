-- ============================================================
-- 41: Nömrələr — alış məlumatları + balans artırma tarixçəsi
-- nomreler cədvəlinə yeni sütunlar (köhnə sətirlərə toxunmur, boş qalır)
-- nomre_balanslar — hər balans artırma ayrıca sətir (tarix + məbləğ)
-- Ümumi xərc = alış qiyməti + bütün balans artırmaların cəmi (saytda hesablanır)
-- ============================================================

alter table public.nomreler
  add column if not exists alis_tarixi date,
  add column if not exists nov text,          -- 'icloud' | 'satdiq'
  add column if not exists sebeke text,       -- 'azercell' | 'bakcell' | 'nar'
  add column if not exists veziyyet text,     -- 'yeni' | 'islenmis'
  add column if not exists alis_qiymeti numeric(12, 2);

create table if not exists public.nomre_balanslar (
  id uuid primary key default gen_random_uuid(),
  nomre_id uuid not null references public.nomreler (id) on delete cascade,
  tarix date not null default current_date,
  mebleg numeric(12, 2) not null check (mebleg >= 0),
  qeyd text,
  created_at timestamptz not null default now()
);

create index if not exists idx_nomre_balanslar_nomre on public.nomre_balanslar (nomre_id, tarix);

alter table public.nomre_balanslar enable row level security;
drop policy if exists "Staff full access" on public.nomre_balanslar;
create policy "Staff full access" on public.nomre_balanslar
  for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
