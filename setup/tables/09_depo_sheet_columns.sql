-- Align Depo with inventory sheet: Nömrə + Şəxsiyyət
alter table public.depo
  add column if not exists nomre text;

alter table public.depo
  add column if not exists sexsiyyet text;

create index if not exists idx_depo_nomre on public.depo (nomre);
