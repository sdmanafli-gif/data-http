-- ============================================================
-- Depo: ödəniş növü (Nisyə / Nağdı) + qaytarma tarixi
-- Ledger: tip nisye_aldim (alış — we owe supplier)
-- ============================================================

alter table public.depo
  add column if not exists odenis_novu text
    check (odenis_novu is null or odenis_novu in ('nisye', 'nagd'));

alter table public.depo
  add column if not exists qaytarma_tarixi date;

create index if not exists idx_depo_odenis_novu on public.depo (odenis_novu);

comment on column public.depo.odenis_novu is 'nisye | nagd';
comment on column public.depo.qaytarma_tarixi is 'Nisyə alış üçün qaytarma / ödəmə vaxtı';

-- Allow nisye_aldim on ledger
alter table public.borc_nisye_ledger
  drop constraint if exists borc_nisye_ledger_tip_check;

alter table public.borc_nisye_ledger
  add constraint borc_nisye_ledger_tip_check
  check (tip in (
    'borc_verdim',
    'borc_aldim',
    'nisye_verdim',
    'nisye_odenis',
    'nisye_aldim',
    'qeyd'
  ));
