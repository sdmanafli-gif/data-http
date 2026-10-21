-- ============================================================
-- Kontaktlar: müştəri kartı üçün əlavə sahələr (yalnız yeni boş sütunlar)
-- Mövcud məlumatlara toxunmur.
-- ============================================================

alter table public.musteriler
  add column if not exists sexsi_nomre_1 text,
  add column if not exists sexsi_nomre_2 text,
  add column if not exists zamin_nomre text,
  add column if not exists sv_seriya text,
  add column if not exists fin_kod text,
  add column if not exists dogum_tarixi date,
  add column if not exists qeydiyyat_unvani text,
  add column if not exists yasayis_unvani text,
  add column if not exists sv_verilme_tarixi date,
  add column if not exists sv_bitme_tarixi date,
  add column if not exists senedler jsonb not null default '[]'::jsonb;
