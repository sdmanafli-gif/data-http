-- ============================================================
-- Məhkəmə tab fields on musteri_bazasi
-- ============================================================
-- Shown when veziyyet = 'Məhkəmə'
-- ============================================================

alter table public.musteri_bazasi
  add column if not exists mehkeme_isare boolean not null default false;

alter table public.musteri_bazasi
  add column if not exists rusum_odenilib numeric(12, 2);

alter table public.musteri_bazasi
  add column if not exists mehkeme_status text
    check (
      mehkeme_status is null
      or mehkeme_status in ('Məhkəmə gedir', 'İcradadır', 'Tamamlanıb')
    );

alter table public.musteri_bazasi
  add column if not exists mehkeme_qeyd text;

create index if not exists idx_musteri_bazasi_mehkeme_status
  on public.musteri_bazasi (mehkeme_status);

comment on column public.musteri_bazasi.mehkeme_isare is 'Məhkəmə tab checkbox';
comment on column public.musteri_bazasi.rusum_odenilib is 'Rüsüm ödənilib (məbləğ)';
comment on column public.musteri_bazasi.mehkeme_status is 'Məhkəmə gedir | İcradadır | Tamamlanıb';
comment on column public.musteri_bazasi.mehkeme_qeyd is 'Məhkəmə kommentləri';
