-- ============================================================
-- Müştərilər (Kontaktlar): vəsiqəni verən orqan + hər nömrənin "kimdir" qeydi
-- Yalnız YENİ boş sütunlar — mövcud məlumatlara toxunmur.
-- ============================================================

alter table public.musteriler
  add column if not exists sv_veren_orqan text,
  add column if not exists nomre_1_kim text,
  add column if not exists nomre_2_kim text,
  add column if not exists nomre_3_kim text,
  add column if not exists nomre_4_kim text,
  add column if not exists nomre_5_kim text;
