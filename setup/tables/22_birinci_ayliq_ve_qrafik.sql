-- Birinci aylıq ödəniş tarixi + əl ilə düzəldilmiş ödəniş qrafiki
alter table public.musteri_bazasi
  add column if not exists birinci_ayliq_odenis_tarixi date;

alter table public.musteri_bazasi
  add column if not exists odenis_qrafiki jsonb;

comment on column public.musteri_bazasi.birinci_ayliq_odenis_tarixi is
  'Kreditin birinci aylıq ödənişinin başlanğıc tarixi — qrafik üçün prioritet';

comment on column public.musteri_bazasi.odenis_qrafiki is
  'Əl ilə saxlanmış ödəniş qrafiki (null = avtomatik hesablama)';
