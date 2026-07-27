-- Ödəniş günü (ayın günü: 1–31)
alter table public.musteri_bazasi
  add column if not exists odenis_gunu int
  check (odenis_gunu is null or (odenis_gunu >= 1 and odenis_gunu <= 31));
