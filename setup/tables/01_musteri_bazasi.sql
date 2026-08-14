-- ============================================================
-- Cədvəl 1: Müştəri Bazası
-- ============================================================
-- Supabase → SQL Editor → New query → yapışdırın → Run
--
-- Qaydalar:
--   №              → avtomatik (mövcud max + 1)
--   Alış / Satış   → əl ilə
--   Gözlənilən gəlir = Satış − Alış − Satıcı faizi       (avtomatik)
--   Faktiki gəlir    = Verilib + Faiz − Alış − Satıcı faizi (avtomatik)
--   Qalan borc       = Satış − Verilib                 (avtomatik)
--   Satıcı faizi     = işçi komissiyası (AZN), alışın üstünə
--   Verilib          → başqa cədvəldən gələcək (indi əl ilə / default 0)
--   Vəziyyət         → Qalıb | Bitib | Məhkəmə
-- ============================================================

create table if not exists public.musteri_bazasi (
  id uuid primary key default gen_random_uuid(),

  -- № — trigger ilə max+1
  sira_no int,

  -- Ad Soyad Ata adı
  ad_soyad text not null,

  -- Əl ilə daxil edilən qiymətlər
  alis_qiymeti numeric(12, 2),
  satis_qiymeti numeric(12, 2),

  -- Ödənilən məbləğ (sonra ödəniş cədvəlindən yenilənəcək)
  verilib numeric(12, 2) not null default 0,
  faiz numeric(12, 2),
  satici text,
  satici_faizi numeric(12, 2) not null default 0,

  -- Hesablanan sütunlar (yalnız oxunur — INSERT/UPDATE ilə yazılmır)
  -- Gözlənilən = Satış − Alış − Satıcı faizi
  -- Faktiki     = Verilib + Faiz − Alış − Satıcı faizi
  gozlenilen_gelir numeric(12, 2)
    generated always as (
      coalesce(satis_qiymeti, 0) - coalesce(alis_qiymeti, 0) - coalesce(satici_faizi, 0)
    ) stored,
  faktiki_gelir numeric(12, 2)
    generated always as (
      coalesce(verilib, 0) + coalesce(faiz, 0) - coalesce(alis_qiymeti, 0) - coalesce(satici_faizi, 0)
    ) stored,
  qalan_borc numeric(12, 2)
    generated always as (coalesce(satis_qiymeti, 0) - coalesce(verilib, 0)) stored,

  -- Tarixlər və kredit şərtləri
  verilme_tarixi date,
  bitme_tarixi date,
  nece_ay int,
  ayliq_odenis numeric(12, 2),

  -- Cihaz
  model text,
  reng text,
  icloud text,
  icloud_bagli_nomre text,
  itunes text,
  itunes_bagli_nomre text,
  imei_1 text,
  imei_2 text,
  yaddas text,
  kimden_alinib text,
  battery_faiz numeric(5, 2),
  muqavile_nomresi text,

  -- Əlaqə və zamin
  nomre_1 text,
  nomre_2 text,
  nomre_3 text,
  nomre_4 text,
  nomre_5 text,
  zamin text,

  -- Dropdown: Qalıb | Bitib | Məhkəmə
  veziyyet text default 'Qalıb'
    check (veziyyet is null or veziyyet in ('Qalıb', 'Bitib', 'Məhkəmə')),
  veziyyet_manual boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_musteri_bazasi_sira_no on public.musteri_bazasi (sira_no);
create index if not exists idx_musteri_bazasi_ad_soyad on public.musteri_bazasi (ad_soyad);
create index if not exists idx_musteri_bazasi_veziyyet on public.musteri_bazasi (veziyyet);
create index if not exists idx_musteri_bazasi_verilme_tarixi on public.musteri_bazasi (verilme_tarixi);
create index if not exists idx_musteri_bazasi_imei_1 on public.musteri_bazasi (imei_1);

-- № = mövcud ən böyük sira_no + 1
create or replace function public.musteri_bazasi_set_sira_no()
returns trigger
language plpgsql
as $$
begin
  if new.sira_no is null then
    select coalesce(max(sira_no), 0) + 1
      into new.sira_no
      from public.musteri_bazasi;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_musteri_bazasi_sira_no on public.musteri_bazasi;
create trigger trg_musteri_bazasi_sira_no
  before insert on public.musteri_bazasi
  for each row
  execute function public.musteri_bazasi_set_sira_no();

alter table public.musteri_bazasi enable row level security;

drop policy if exists "Allow all for anon" on public.musteri_bazasi;
create policy "Allow all for anon"
  on public.musteri_bazasi for all
  using (true) with check (true);

-- Nümunə sətir (Excel nümunəniz)
-- gozlenilen_gelir / faktiki_gelir / qalan_borc / sira_no avtomatikdir
insert into public.musteri_bazasi (
  ad_soyad,
  alis_qiymeti, satis_qiymeti, verilib,
  verilme_tarixi, bitme_tarixi, nece_ay, ayliq_odenis, faiz,
  model, reng, icloud,
  imei_1, imei_2, yaddas, kimden_alinib, battery_faiz,
  veziyyet
) values (
  'Ceyhun Ataş Dayı Oğlu',
  1400, 1625, 1625,
  '2024-01-31', '2025-01-31', 12, 150, 0,
  '13 Pro Max', 'Sierra Blue', 'smelektro10@icloud.com',
  '359481982886292', '359481982843236', '128 Gb', 'Mamanın Teli', 0,
  'Məhkəmə'
);
