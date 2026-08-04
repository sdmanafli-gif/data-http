-- Faktiki gəlir = Verilib + Faiz − Alış
-- (Faiz ödənişləri də faktiki gəlirə daxil edilir)

alter table public.musteri_bazasi
  drop column if exists faktiki_gelir;

alter table public.musteri_bazasi
  add column faktiki_gelir numeric(12, 2)
  generated always as (
    coalesce(verilib, 0) + coalesce(faiz, 0) - coalesce(alis_qiymeti, 0)
  ) stored;
