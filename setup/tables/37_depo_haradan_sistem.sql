-- ============================================================
-- Depo: "Haradan" (Təchizatçı / Müştəri) və "Sistem" sahələri
-- + Təchizatçılar cədvəli (Kontaktlar → Təchizatçılar)
-- Yalnız YENİ cədvəl / boş sütunlar — mövcud məlumatlara toxunmur.
-- ============================================================

begin;

create table if not exists public.techizatcilar (
  id uuid primary key default gen_random_uuid(),
  ad_soyad text not null,
  tukan text,
  nomre_1 text,
  nomre_2 text,
  komment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.techizatcilar enable row level security;
drop policy if exists "Staff full access" on public.techizatcilar;
create policy "Staff full access" on public.techizatcilar
  for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

alter table public.musteriler
  add column if not exists komment text;

alter table public.depo
  add column if not exists haradan_tip text
    check (haradan_tip is null or haradan_tip in ('techizatci', 'musteri')),
  add column if not exists techizatci_id uuid references public.techizatcilar (id) on delete set null,
  add column if not exists musteri_id uuid references public.musteriler (id) on delete set null,
  add column if not exists sistem boolean not null default false,
  add column if not exists sistem_nov text
    check (sistem_nov is null or sistem_nov in ('menim', 'diger')),
  add column if not exists sistem_mebleg numeric(12, 2),
  add column if not exists sistem_adi text,
  add column if not exists sistem_zamin text;

commit;
