-- Kommentlər column for Müştəri Bazası
alter table public.musteri_bazasi
  add column if not exists kommentler text;
