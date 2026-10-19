-- ============================================================
-- Kassa: mədaxil (pul əlavə etmə) və çıxarış eyni cədvəldə
-- kassa_cixarislar.nov → 'cixaris' (balansdan çıxır) | 'medaxil' (balansa əlavə olunur)
-- Köhnə qeydlər avtomatik 'cixaris' olur.
-- ============================================================

alter table public.kassa_cixarislar
  add column if not exists nov text not null default 'cixaris'
    check (nov in ('cixaris', 'medaxil'));

comment on column public.kassa_cixarislar.nov is 'cixaris = withdrawal from balance, medaxil = deposit to balance';
