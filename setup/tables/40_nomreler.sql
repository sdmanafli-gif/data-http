-- ============================================================
-- 40: Nömrələr (Kontaktlar altında) — mağazanın SIM nömrələri və balans artırma
-- Nömrə · Kimin adınadır · Son balans artırılma tarixi · Neçə gündən bir · Növbəti tarix
-- Növbəti tarix bazada saxlanmır — saytda hesablanır (son tarix + gün).
-- Mövcud cədvəllərə toxunmur, yalnız yeni cədvəl yaradır.
-- ============================================================

create table if not exists public.nomreler (
  id uuid primary key default gen_random_uuid(),
  nomre text not null,
  kimin_adina text,
  son_artirma date,
  gun_araligi int check (gun_araligi is null or gun_araligi > 0),
  qeyd text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_nomreler_son_artirma on public.nomreler (son_artirma);

alter table public.nomreler enable row level security;
drop policy if exists "Staff full access" on public.nomreler;
create policy "Staff full access" on public.nomreler
  for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
