-- ============================================================
-- Serial No / Model No on müştəri_bazası (from Depo on sale)
-- ============================================================

alter table public.musteri_bazasi
  add column if not exists serial_no text;

alter table public.musteri_bazasi
  add column if not exists model_no text;

create index if not exists idx_musteri_bazasi_serial_no
  on public.musteri_bazasi (serial_no);

create index if not exists idx_musteri_bazasi_model_no
  on public.musteri_bazasi (model_no);

comment on column public.musteri_bazasi.serial_no is
  'Device serial number(s) from Depo; multi-product sales joined with /';

comment on column public.musteri_bazasi.model_no is
  'Device model number(s) from Depo; multi-product sales joined with /';
