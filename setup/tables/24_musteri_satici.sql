-- Satıcı + satıcı faizi on müştəri_bazası (same idea as nağd_satish).
-- Gözlənilən / faktiki gəlir = əvvəlki məntiq − satıcı faizi
-- (satıcı faizi alışın üstünə düşən işçi komissiyası kimi çıxılır)

alter table public.musteri_bazasi
  add column if not exists satici text;

alter table public.musteri_bazasi
  add column if not exists satici_faizi numeric(12, 2) not null default 0;

alter table public.musteri_bazasi
  drop column if exists gozlenilen_gelir;

alter table public.musteri_bazasi
  add column gozlenilen_gelir numeric(12, 2)
  generated always as (
    coalesce(satis_qiymeti, 0) - coalesce(alis_qiymeti, 0) - coalesce(satici_faizi, 0)
  ) stored;

alter table public.musteri_bazasi
  drop column if exists faktiki_gelir;

alter table public.musteri_bazasi
  add column faktiki_gelir numeric(12, 2)
  generated always as (
    coalesce(verilib, 0) + coalesce(faiz, 0) - coalesce(alis_qiymeti, 0) - coalesce(satici_faizi, 0)
  ) stored;

comment on column public.musteri_bazasi.satici is 'Satışı edən işçi';
comment on column public.musteri_bazasi.satici_faizi is 'İşçi komissiyası (AZN) — alışın üstünə, gəlirdən çıxılır';
