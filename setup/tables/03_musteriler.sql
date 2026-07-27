-- ============================================================
-- Müştərilər — reusable customer list for Müştəri Bazası
-- ============================================================

create table if not exists public.musteriler (
  id uuid primary key default gen_random_uuid(),
  ad_soyad text not null,
  nomre_1 text,
  nomre_2 text,
  nomre_3 text,
  nomre_4 text,
  nomre_5 text,
  zamin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_musteriler_ad_soyad on public.musteriler (ad_soyad);

alter table public.musteri_bazasi
  add column if not exists musteri_id uuid references public.musteriler(id) on delete set null;

create index if not exists idx_musteri_bazasi_musteri_id on public.musteri_bazasi (musteri_id);

-- Backfill: one musteriler row per distinct ad_soyad already in musteri_bazasi
insert into public.musteriler (ad_soyad, nomre_1, nomre_2, nomre_3, nomre_4, nomre_5, zamin)
select distinct on (lower(trim(mb.ad_soyad)))
  trim(mb.ad_soyad),
  mb.nomre_1,
  mb.nomre_2,
  mb.nomre_3,
  mb.nomre_4,
  mb.nomre_5,
  mb.zamin
from public.musteri_bazasi mb
where mb.ad_soyad is not null
  and trim(mb.ad_soyad) <> ''
  and not exists (
    select 1 from public.musteriler m
    where lower(trim(m.ad_soyad)) = lower(trim(mb.ad_soyad))
  )
order by lower(trim(mb.ad_soyad)), mb.created_at desc;

update public.musteri_bazasi mb
set musteri_id = m.id
from public.musteriler m
where mb.musteri_id is null
  and lower(trim(mb.ad_soyad)) = lower(trim(m.ad_soyad));

alter table public.musteriler enable row level security;

drop policy if exists "Allow all for anon" on public.musteriler;
create policy "Allow all for anon"
  on public.musteriler for all
  using (true) with check (true);
