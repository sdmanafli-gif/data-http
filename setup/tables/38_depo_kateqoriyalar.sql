-- ============================================================
-- Depo: Məhsul Kateqoriyası (qrup) → Növ
-- Yalnız YENİ cədvəl və boş sütun — mövcud məlumatlara toxunmur.
-- ============================================================

begin;

create table if not exists public.depo_kateqoriyalar (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  parent_id uuid references public.depo_kateqoriyalar (id) on delete cascade,
  sira integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists depo_kateqoriyalar_ad_uniq
  on public.depo_kateqoriyalar (
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(ad)
  );

alter table public.depo_kateqoriyalar enable row level security;
drop policy if exists "Staff full access" on public.depo_kateqoriyalar;
create policy "Staff full access" on public.depo_kateqoriyalar
  for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

alter table public.depo
  add column if not exists kateqoriya text;

-- Qruplar
insert into public.depo_kateqoriyalar (ad, sira)
select v.ad, v.sira
from (values
  ('Telefon', 1),
  ('Noutbook', 2),
  ('Toz Soran', 3),
  ('Kamera', 4),
  ('Playstation', 5),
  ('Aksesuarlar', 6)
) as v(ad, sira)
where not exists (
  select 1 from public.depo_kateqoriyalar k
  where k.parent_id is null and lower(k.ad) = lower(v.ad)
);

-- Növlər
insert into public.depo_kateqoriyalar (ad, parent_id, sira)
select v.ad, p.id, v.sira
from (values
  ('Telefon', 'iPhone', 1),
  ('Telefon', 'Samsung', 2),
  ('Noutbook', 'Acer', 1),
  ('Noutbook', 'MSI', 2),
  ('Noutbook', 'MacBook', 3),
  ('Noutbook', 'Asus', 4),
  ('Toz Soran', 'Roborock', 1),
  ('Toz Soran', 'Dyson', 2),
  ('Kamera', 'Canon', 1),
  ('Playstation', 'Playstation 5 Slim', 1),
  ('Playstation', 'Playstation 5 Pro', 2),
  ('Aksesuarlar', 'Power Bank', 1),
  ('Aksesuarlar', 'Adapter', 2),
  ('Aksesuarlar', 'Şnur', 3),
  ('Aksesuarlar', 'Plyonka', 4),
  ('Aksesuarlar', 'Kabura', 5),
  ('Aksesuarlar', 'Kamera Qoruyucu', 6)
) as v(qrup, ad, sira)
join public.depo_kateqoriyalar p
  on p.parent_id is null and lower(p.ad) = lower(v.qrup)
where not exists (
  select 1 from public.depo_kateqoriyalar k
  where k.parent_id = p.id and lower(k.ad) = lower(v.ad)
);

commit;
